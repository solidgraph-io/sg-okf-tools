/**
 * config — bundle configuration for the OKF tools.
 *
 * Everything repo-specific is configuration: where the bundle lives, the
 * expected `okf_version`, the `type` taxonomy, which files are reserved or
 * generated, and how prose IDs resolve to files for the cross-link codemod.
 * Defaults reproduce the behavior the tooling shipped with in `sg-webpage`,
 * so a consumer with that layout needs no config file at all.
 */

import fs from 'node:fs';
import path from 'node:path';

/** One rule mapping prose IDs (e.g. SPEC-QA-001, ADR-0014) to bundle files. */
export interface IdRule {
  /** Regex source matching one ID mention in prose. */
  pattern: string;
  /** Bundle-relative directory whose .md files are the rule's targets. */
  dir: string;
  /**
   * Optional regex over the target filename extracting capture groups for
   * `idTemplate` (e.g. "^(\\d{4})-"). Without it, the ID is `pattern`
   * anchored at the start of the basename (sans .md).
   */
  filePattern?: string;
  /** ID built from `filePattern` captures, e.g. "ADR-$1". */
  idTemplate?: string;
}

export interface OkfConfig {
  /** Bundle root, resolved relative to the config file (or the cwd). */
  bundleRoot: string;
  /** Expected `okf_version` at the root index.md; a mismatch is a warning. */
  okfVersion: string;
  /** Valid `type` values; a value outside the list is a warning (§9). */
  taxonomy: string[];
  /** Reserved files — never concepts, never rewritten (§6/§7, INV-2). */
  reserved: string[];
  /** Bundle-relative generated files the link codemod never rewrites. */
  generated: string[];
  /** ID→path rules for `okf link`. */
  idRules: IdRule[];
}

export const DEFAULT_CONFIG: OkfConfig = {
  bundleRoot: 'docs',
  okfVersion: '0.1',
  taxonomy: [
    'Spec',
    'ADR',
    'Prompt',
    'Architecture',
    'Methodology',
    'Plan',
    'Runbook',
    'Index',
    'Reference',
  ],
  reserved: ['index.md', 'log.md'],
  generated: ['traceability.md'],
  idRules: [
    { pattern: 'SPEC-[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\\d+', dir: 'specs' },
    { pattern: 'ADR-\\d{4}', dir: 'adr', filePattern: '^(\\d{4})-', idTemplate: 'ADR-$1' },
  ],
};

export interface LoadedConfig {
  config: OkfConfig;
  /** Directory bundleRoot is resolved against (config file dir, or cwd). */
  baseDir: string;
}

/**
 * Load configuration: an explicit `configPath`, else `okf.config.json` in
 * `cwd` if present, else pure defaults. Partial configs merge over defaults.
 */
export function loadConfig(configPath?: string, cwd: string = process.cwd()): LoadedConfig {
  const explicit = configPath ? path.resolve(cwd, configPath) : undefined;
  const implicit = path.join(cwd, 'okf.config.json');
  const file = explicit ?? (fs.existsSync(implicit) ? implicit : undefined);

  if (!file) return { config: { ...DEFAULT_CONFIG }, baseDir: cwd };

  if (!fs.existsSync(file)) {
    throw new Error(`okf: config file not found: ${file}`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<OkfConfig>;
  return { config: { ...DEFAULT_CONFIG, ...raw }, baseDir: path.dirname(file) };
}

/** Absolute bundle root for a loaded config (or an explicit override). */
export function resolveBundleRoot(loaded: LoadedConfig, override?: string): string {
  if (override) return path.resolve(override);
  return path.resolve(loaded.baseDir, loaded.config.bundleRoot);
}
