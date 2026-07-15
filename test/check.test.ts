/**
 * `okf check` — conformance rules (SPEC-DOCS-OKF-001 numbering).
 * Ported from sg-webpage's docs-okf-001.test.ts (synthetic fixtures).
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { checkBundle } from '../src/check.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { makeBundle, cleanupBundles, ROOT_INDEX, VALID_CONCEPT, ROOT, TSX, CLI } from './helpers.js';

afterAll(cleanupBundles);

// ── RF-1: root index.md declares okf_version ──────────────────────────────────

describe('[SPEC-DOCS-OKF-001/RF-1] bundle root index.md with okf_version', () => {
  it('[SPEC-DOCS-OKF-001/RF-1] valid root index → no errors', () => {
    const dir = makeBundle({ 'index.md': ROOT_INDEX, 'specs/a.md': VALID_CONCEPT });
    expect(checkBundle(dir).errors).toEqual([]);
  });

  it('[SPEC-DOCS-OKF-001/RF-1] index.md without okf_version → hard error', () => {
    const dir = makeBundle({ 'index.md': '---\ntitle: "no version"\n---\n\n# Bundle\n' });
    expect(checkBundle(dir).errors.some((e) => e.includes('okf_version'))).toBe(true);
  });

  it('[SPEC-DOCS-OKF-001/RF-1] missing root index.md → hard error', () => {
    const dir = makeBundle({ 'specs/a.md': VALID_CONCEPT });
    expect(checkBundle(dir).errors.some((e) => e.includes('index.md'))).toBe(true);
  });

  it('[SPEC-DOCS-OKF-001/RF-1] okf_version differing from expected → warning, not error', () => {
    const dir = makeBundle({
      'index.md': '---\nokf_version: "9.9"\n---\n\n# Bundle\n',
      'specs/index.md': '# Catalog\n',
      'specs/a.md': VALID_CONCEPT,
    });
    const res = checkBundle(dir);
    expect(res.errors).toEqual([]);
    expect(res.warnings.some((w) => w.includes('"9.9"'))).toBe(true);
  });
});

// ── RF-2: parseable frontmatter in every non-reserved .md (hard) ──────────────

describe('[SPEC-DOCS-OKF-001/RF-2] parseable frontmatter on every concept', () => {
  it('[SPEC-DOCS-OKF-001/RF-2] concept without frontmatter → hard error', () => {
    const dir = makeBundle({ 'index.md': ROOT_INDEX, 'specs/bare.md': '# Bare\n\nNo fm.\n' });
    expect(checkBundle(dir).errors.some((e) => e.includes('bare.md'))).toBe(true);
  });

  it('[SPEC-DOCS-OKF-001/RF-2] unparseable YAML frontmatter → hard error', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/broken.md': '---\ntype: [unclosed\n---\n\n# Broken\n',
    });
    expect(checkBundle(dir).errors.some((e) => e.includes('broken.md'))).toBe(true);
  });
});

// ── RF-3: non-empty `type` (hard) ─────────────────────────────────────────────

describe('[SPEC-DOCS-OKF-001/RF-3] non-empty type in every concept', () => {
  it('[SPEC-DOCS-OKF-001/RF-3] frontmatter without type → hard error', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/untyped.md': '---\ntitle: "no type"\n---\n\n# Untyped\n',
    });
    const res = checkBundle(dir);
    expect(res.errors.some((e) => e.includes('untyped.md') && e.includes('type'))).toBe(true);
  });

  it('[SPEC-DOCS-OKF-001/RF-3] empty type → hard error', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/empty.md': '---\ntype: ""\n---\n\n# Empty\n',
    });
    expect(checkBundle(dir).errors.length).toBeGreaterThan(0);
  });
});

// ── RF-4: taxonomy (warning, permissive) ──────────────────────────────────────

describe('[SPEC-DOCS-OKF-001/RF-4] type outside taxonomy is a warning', () => {
  it('[SPEC-DOCS-OKF-001/RF-4] unknown type → warning, zero errors', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/index.md': '# Catalog\n',
      'specs/odd.md': '---\ntype: Weird\n---\n\n# Odd\n',
    });
    const res = checkBundle(dir);
    expect(res.errors).toEqual([]);
    expect(res.warnings.some((w) => w.includes('Weird'))).toBe(true);
  });

  it('[SPEC-DOCS-OKF-001/RF-4] default taxonomy matches the origin project', () => {
    expect(DEFAULT_CONFIG.taxonomy).toEqual([
      'Spec',
      'ADR',
      'Prompt',
      'Architecture',
      'Methodology',
      'Plan',
      'Runbook',
      'Index',
      'Reference',
    ]);
  });
});

// ── RF-5: bundle-relative links resolve (warning); code zones ignored ─────────

describe('[SPEC-DOCS-OKF-001/RF-5] bundle-relative links must resolve', () => {
  it('[SPEC-DOCS-OKF-001/RF-5] broken /….md link → warning, zero errors', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/index.md': '# Catalog\n',
      'specs/a.md': '---\ntype: Spec\n---\n\n# A\n\nSee [B](/specs/NO-EXISTE.md).\n',
    });
    const res = checkBundle(dir);
    expect(res.errors).toEqual([]);
    expect(res.warnings.some((w) => w.includes('NO-EXISTE.md'))).toBe(true);
  });

  it('[SPEC-DOCS-OKF-001/RF-5] resolving link (with anchor) → no warning', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/index.md': '# Catalog\n',
      'specs/a.md': '---\ntype: Spec\n---\n\n# A\n\nSee [B](/specs/b.md#schema).\n',
      'specs/b.md': VALID_CONCEPT,
    });
    expect(checkBundle(dir).warnings).toEqual([]);
  });

  it('[SPEC-DOCS-OKF-001/RF-5] broken link inside a code fence → no warning', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/index.md': '# Catalog\n',
      'specs/a.md': '---\ntype: Spec\n---\n\n# A\n\n```\n[ejemplo](/specs/NO-EXISTE.md)\n```\n',
    });
    expect(checkBundle(dir).warnings).toEqual([]);
  });

  it('[SPEC-DOCS-OKF-001/RF-5] broken link inside inline code → no warning', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/index.md': '# Catalog\n',
      'specs/a.md': '---\ntype: Spec\n---\n\n# A\n\nEjemplo: `[x](/specs/NO-EXISTE.md)`.\n',
    });
    expect(checkBundle(dir).warnings).toEqual([]);
  });

  it('[SPEC-DOCS-OKF-001/RF-5] same broken link in prose still warns (only code is masked)', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/index.md': '# Catalog\n',
      'specs/a.md':
        '---\ntype: Spec\n---\n\n# A\n\n[x](/specs/NO-EXISTE.md) y `[x](/specs/NO-EXISTE.md)`.\n',
    });
    const { warnings } = checkBundle(dir);
    expect(warnings.filter((w) => w.includes('NO-EXISTE.md'))).toHaveLength(1);
  });
});

// ── RF-6: exit codes — hard fails only on RF-1/RF-2/RF-3 ─────────────────────

describe('[SPEC-DOCS-OKF-001/RF-6] CLI exit codes', () => {
  const runCli = (bundle: string) =>
    spawnSync(TSX, [CLI, 'check', bundle], { encoding: 'utf-8', cwd: ROOT });

  it('[SPEC-DOCS-OKF-001/RF-6] hard violation (missing type) → exit ≠ 0', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/untyped.md': '---\ntitle: "x"\n---\n\n# X\n',
    });
    expect(runCli(dir).status).not.toBe(0);
  });

  it('[SPEC-DOCS-OKF-001/RF-6] warnings only (unknown type + broken link) → exit 0', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/index.md': '# Catalog\n',
      'specs/odd.md': '---\ntype: Weird\n---\n\n# Odd\n\n[gone](/nope.md)\n',
    });
    const res = runCli(dir);
    expect(res.status).toBe(0);
    expect(res.stderr).toContain('warn');
  });
});

// ── RNF-3: permissive consumption ─────────────────────────────────────────────

describe('[SPEC-DOCS-OKF-001/RNF-3] permissive consumer', () => {
  it('[SPEC-DOCS-OKF-001/RNF-3] extra keys + unknown type + broken link → zero errors', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/x.md':
        '---\ntype: Custom\nspec_status: Draft\nepic: EPIC-X\n---\n\n# X\n\n[gone](/y.md)\n',
    });
    expect(checkBundle(dir).errors).toEqual([]);
  });
});

// ── INV-1 / INV-2 / INV-3 ─────────────────────────────────────────────────────

describe('[SPEC-DOCS-OKF-001/INV-1] hard minimum breaks the check', () => {
  it('[SPEC-DOCS-OKF-001/INV-1] each hard rule violated → error reported', () => {
    const dir = makeBundle({
      // no index.md (RF-1), one bare concept (RF-2), one untyped (RF-3)
      'a.md': '# A\n',
      'b.md': '---\ntitle: "b"\n---\n\n# B\n',
    });
    expect(checkBundle(dir).errors.length).toBe(3);
  });
});

describe('[SPEC-DOCS-OKF-001/INV-2] index.md / log.md reserved', () => {
  it('[SPEC-DOCS-OKF-001/INV-2] subdir index.md and log.md need no frontmatter', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/index.md': '# Catalog\n\n(no frontmatter — reserved)\n',
      'log.md': '# Log\n\n- **2026-07-09** — adopted OKF\n',
      'specs/a.md': VALID_CONCEPT,
    });
    const res = checkBundle(dir);
    expect(res.errors).toEqual([]);
    expect(res.concepts).toBe(1); // only specs/a.md counts as a concept
  });
});

describe('[SPEC-DOCS-OKF-001/INV-3] renames surface via link resolution', () => {
  it('[SPEC-DOCS-OKF-001/INV-3] link to a moved concept path → RF-5 warning', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/index.md': '# Catalog\n',
      // b.md moved to specs/b.md but a.md still links the old concept ID /b.md
      'specs/a.md': '---\ntype: Spec\n---\n\n# A\n\nSee [B](/b.md).\n',
      'specs/b.md': VALID_CONCEPT,
    });
    const res = checkBundle(dir);
    expect(res.warnings.some((w) => w.includes('/b.md'))).toBe(true);
    expect(res.errors).toEqual([]);
  });
});
