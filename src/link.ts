/**
 * link — OKF cross-links codemod.
 *
 *   - ID → path map from the configured `idRules` (e.g. SPEC ids by filename
 *     under specs/, ADR numbers by 4-digit slug under adr/).
 *   - Per document, the FIRST prose mention of each distinct target becomes a
 *     bundle-absolute link [SPEC-X](/specs/SPEC-X.md) — one relation per doc.
 *   - Untouchable zones: YAML frontmatter, code fences, inline code, existing
 *     markdown links, headings, and self-references (a doc never links itself).
 *   - Refs that do not resolve to an existing file stay in prose and are
 *     reported as warnings (never break the build — RF-5 is permissive).
 *   - Idempotent: re-running produces no changes and never nests links.
 *   - Reserved files (INV-2) and configured generated files (e.g. a
 *     traceability matrix kept as a mechanical gate) are never rewritten.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONFIG, type IdRule, type OkfConfig } from './config.js';
import { FRONTMATTER_RE, FENCE_RE, maskInlineCode } from './md-zones.js';

export interface LinkedRef {
  file: string; // bundle-relative doc
  id: string; // e.g. SPEC-QA-001, ADR-0014
  target: string; // bundle-absolute path, e.g. /specs/SPEC-QA-001.md
}

export interface UnresolvedRef {
  file: string;
  id: string;
}

export interface LinkReport {
  changed: string[]; // bundle-relative files rewritten (sorted)
  linked: LinkedRef[];
  unresolved: UnresolvedRef[];
}

// ── ID map ────────────────────────────────────────────────────────────────────

function idFromFilename(name: string, rule: IdRule): string | null {
  const base = path.basename(name, '.md');
  if (rule.filePattern && rule.idTemplate) {
    const m = new RegExp(rule.filePattern).exec(name);
    if (!m) return null;
    return rule.idTemplate.replace(/\$(\d+)/g, (_, g: string) => m[Number(g)] ?? '');
  }
  const m = new RegExp(`^(?:${rule.pattern})`).exec(base);
  return m ? m[0] : null;
}

/** Concept ID → bundle-absolute path, per the configured idRules. */
export function buildIdMap(
  bundleRoot: string,
  config: OkfConfig = DEFAULT_CONFIG,
): Map<string, string> {
  const reserved = new Set(config.reserved);
  const map = new Map<string, string>();
  for (const rule of config.idRules) {
    const dir = path.join(bundleRoot, rule.dir);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith('.md') || reserved.has(name)) continue;
      const id = idFromFilename(name, rule);
      if (id) map.set(id, `/${rule.dir}/${name}`);
    }
  }
  return map;
}

/** The doc's own concept ID, if a rule derives one for it. */
function selfId(rel: string, config: OkfConfig): string | null {
  const relPosix = rel.split(path.sep).join('/');
  for (const rule of config.idRules) {
    if (path.posix.dirname(relPosix) !== rule.dir) continue;
    const id = idFromFilename(path.posix.basename(relPosix), rule);
    if (id) return id;
  }
  return null;
}

// ── zone masking ──────────────────────────────────────────────────────────────

/** Blank inline code and existing markdown links, preserving offsets. */
function maskLine(line: string): string {
  // inline code first (backticks bind tighter), then links/images (label + target)
  return maskInlineCode(line).replace(/!?\[[^\]]*\]\([^)]*\)/g, (m) => ' '.repeat(m.length));
}

/** A mention is linkable only as a standalone word, not inside a path or label. */
function boundaryOk(masked: string, start: number, end: number): boolean {
  const prev = start > 0 ? masked[start - 1]! : '';
  if (/[A-Za-z0-9_\-/[\]]/.test(prev)) return false; // word/path/link-label context
  if (masked.startsWith('.md', end)) return false; // filename in prose (…/SPEC-X.md)
  return true;
}

// ── rewrite ───────────────────────────────────────────────────────────────────

interface DocResult {
  content: string;
  linked: { id: string; target: string }[];
  unresolved: string[];
}

export function processDoc(
  content: string,
  map: Map<string, string>,
  own: string | null,
  config: OkfConfig = DEFAULT_CONFIG,
): DocResult {
  const refRe = new RegExp(config.idRules.map((r) => r.pattern).join('|'), 'g');

  // Split off frontmatter (untouchable)
  const fm = FRONTMATTER_RE.exec(content);
  const head = fm ? fm[0] : '';
  const body = content.slice(head.length);

  // Targets already linked anywhere in the doc (absolute or relative form) —
  // one relation per doc: an existing link to a target suppresses new ones.
  const linkedBasenames = new Set<string>();
  for (const m of content.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
    linkedBasenames.add(path.posix.basename(m[1]!));
  }

  const linked: { id: string; target: string }[] = [];
  const unresolved = new Set<string>();
  const done = new Set<string>();
  let inFence = false;

  const lines = body.split('\n').map((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence || /^\s{0,3}#/.test(line)) return line;

    const masked = maskLine(line);
    let out = '';
    let cursor = 0;
    for (const m of masked.matchAll(refRe)) {
      const id = m[0];
      const start = m.index;
      const end = start + id.length;
      if (!boundaryOk(masked, start, end)) continue;
      if (id === own) continue;
      const target = map.get(id);
      if (!target) {
        unresolved.add(id);
        continue;
      }
      if (done.has(id) || linkedBasenames.has(path.posix.basename(target))) continue;
      out += line.slice(cursor, start) + `[${id}](${target})`;
      cursor = end;
      done.add(id);
      linked.push({ id, target });
    }
    return out + line.slice(cursor);
  });

  return { content: head + lines.join('\n'), linked, unresolved: [...unresolved].sort() };
}

// ── bundle walk ───────────────────────────────────────────────────────────────

function collectMdFiles(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectMdFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
}

function processBundle(bundleRoot: string, config: OkfConfig, write: boolean): LinkReport {
  const reserved = new Set(config.reserved);
  const generated = new Set(config.generated);
  const map = buildIdMap(bundleRoot, config);
  const report: LinkReport = { changed: [], linked: [], unresolved: [] };

  const files: string[] = [];
  collectMdFiles(bundleRoot, files);
  files.sort();

  for (const file of files) {
    const rel = path.relative(bundleRoot, file);
    const base = path.basename(file);
    if (reserved.has(base) || generated.has(rel.split(path.sep).join('/'))) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const res = processDoc(content, map, selfId(rel, config), config);

    for (const l of res.linked) report.linked.push({ file: rel, ...l });
    for (const id of res.unresolved) report.unresolved.push({ file: rel, id });

    if (res.content !== content) {
      if (write) fs.writeFileSync(file, res.content, 'utf-8');
      report.changed.push(rel);
    }
  }

  return report;
}

/** Rewrite the bundle in place; returns what changed. */
export function applyLinks(bundleRoot: string, config: OkfConfig = DEFAULT_CONFIG): LinkReport {
  return processBundle(bundleRoot, config, true);
}

/** Dry run: `pending` = linkable refs still in prose (warning-only, never a gate). */
export function checkLinks(
  bundleRoot: string,
  config: OkfConfig = DEFAULT_CONFIG,
): { pending: LinkedRef[]; unresolved: UnresolvedRef[] } {
  const report = processBundle(bundleRoot, config, false);
  return { pending: report.linked, unresolved: report.unresolved };
}

/** CLI runner for `okf link [--check]` (always exit 0 — warning-only). */
export function runLink(bundleRoot: string, config: OkfConfig, checkMode: boolean): number {
  if (checkMode) {
    const { pending, unresolved } = checkLinks(bundleRoot, config);
    for (const p of pending) {
      console.warn(`[okf-link] warn ${p.file}: linkable ref ${p.id} → ${p.target}`);
    }
    for (const u of unresolved) {
      console.warn(`[okf-link] warn ${u.file}: unresolved ref ${u.id} (left in prose)`);
    }
    console.log(
      `[okf-link] check — ${pending.length} linkable ref(s) in prose, ${unresolved.length} unresolved.`,
    );
    return 0; // warning-only by design (the hard gates live elsewhere)
  }

  const report = applyLinks(bundleRoot, config);
  for (const l of report.linked) console.log(`[okf-link] ${l.file}: ${l.id} → ${l.target}`);
  for (const u of report.unresolved) {
    console.warn(`[okf-link] warn ${u.file}: unresolved ref ${u.id} (left in prose)`);
  }
  console.log(
    `[okf-link] ${report.changed.length} file(s) updated — ${report.linked.length} ref(s) linked, ` +
      `${report.unresolved.length} unresolved.`,
  );
  return 0;
}
