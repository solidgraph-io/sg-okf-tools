#!/usr/bin/env node
/**
 * okf — CLI for Open Knowledge Format bundles.
 *
 * Usage:
 *   okf check [bundleRoot] [--config PATH]            conformance (exit ≠ 0 on hard violations)
 *   okf index [bundleRoot] [--config PATH] [--check]  generate / verify per-directory indexes
 *   okf link  [bundleRoot] [--config PATH] [--check]  cross-link codemod (idempotent; --check warning-only)
 *
 * Configuration: --config PATH, else ./okf.config.json if present, else
 * defaults. `bundleRoot` from the config resolves relative to the config
 * file; the positional argument overrides it (resolved from the cwd).
 */

import { loadConfig, resolveBundleRoot } from './config.js';
import { runCheck } from './check.js';
import { runIndex } from './index.js';
import { runLink } from './link.js';

const USAGE = `Usage: okf <check|index|link> [bundleRoot] [--config PATH] [--check]`;

export function main(argv: string[]): number {
  const args = argv.filter((a) => a !== '--');
  const command = args[0];
  const checkMode = args.includes('--check');

  const configIdx = args.indexOf('--config');
  const configPath = configIdx !== -1 ? args[configIdx + 1] : undefined;
  if (configIdx !== -1 && !configPath) {
    console.error('okf: --config requires a path');
    return 2;
  }

  const positionals = args
    .slice(1)
    .filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--config');
  const bundleOverride = positionals[0];

  let loaded;
  try {
    loaded = loadConfig(configPath);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const bundleRoot = resolveBundleRoot(loaded, bundleOverride);

  switch (command) {
    case 'check':
      return runCheck(bundleRoot, loaded.config);
    case 'index':
      return runIndex(bundleRoot, loaded.config, checkMode);
    case 'link':
      return runLink(bundleRoot, loaded.config, checkMode);
    default:
      console.error(USAGE);
      return 2;
  }
}

process.exit(main(process.argv.slice(2)));
