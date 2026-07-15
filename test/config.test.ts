/**
 * Config-driven behavior: the same input judged under two different configs
 * produces the result each config asks for. Nothing about the origin repo's
 * layout (docs/, specs/, adr/) is baked in.
 */
import { describe, it, expect, afterAll } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkBundle } from '../src/check.js';
import { applyLinks, buildIdMap } from '../src/link.js';
import { applyIndexes } from '../src/index.js';
import { DEFAULT_CONFIG, loadConfig, resolveBundleRoot, type OkfConfig } from '../src/config.js';
import { makeBundle, cleanupBundles, read, ROOT_INDEX, ROOT, TSX, CLI } from './helpers.js';

afterAll(cleanupBundles);

describe('config-driven: taxonomy', () => {
  it('the same type warns under one taxonomy and passes under another', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'notes/index.md': '# Catalog\n',
      'notes/a.md': '---\ntype: Playbook\n---\n\n# A\n',
    });
    const strict = checkBundle(dir, DEFAULT_CONFIG);
    expect(strict.warnings.some((w) => w.includes('Playbook'))).toBe(true);

    const custom: OkfConfig = { ...DEFAULT_CONFIG, taxonomy: ['Playbook', 'Runbook'] };
    expect(checkBundle(dir, custom).warnings).toEqual([]);
  });
});

describe('config-driven: reserved files', () => {
  it('a custom reserved file stops being a concept (no frontmatter required)', () => {
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'notes/index.md': '# Catalog\n',
      'notes/GLOSSARY.md': '# Glossary\n\nNo frontmatter here.\n',
    });
    // default config: GLOSSARY.md is a concept and fails RF-2
    expect(checkBundle(dir, DEFAULT_CONFIG).errors.some((e) => e.includes('GLOSSARY'))).toBe(true);

    const custom: OkfConfig = {
      ...DEFAULT_CONFIG,
      reserved: [...DEFAULT_CONFIG.reserved, 'GLOSSARY.md'],
    };
    expect(checkBundle(dir, custom).errors).toEqual([]);
  });
});

describe('config-driven: expected okf_version', () => {
  it('the same bundle warns or not depending on the expected version', () => {
    const dir = makeBundle({
      'index.md': '---\nokf_version: "0.2"\n---\n\n# Bundle\n',
      'notes/index.md': '# Catalog\n',
      'notes/a.md': '---\ntype: Spec\n---\n\n# A\n',
    });
    expect(checkBundle(dir, DEFAULT_CONFIG).warnings.some((w) => w.includes('0.2'))).toBe(true);
    expect(checkBundle(dir, { ...DEFAULT_CONFIG, okfVersion: '0.2' }).warnings).toEqual([]);
  });
});

describe('config-driven: idRules for the link codemod', () => {
  const RFC_CONFIG: OkfConfig = {
    ...DEFAULT_CONFIG,
    idRules: [{ pattern: 'RFC-\\d{3}', dir: 'rfcs' }],
  };

  function rfcBundle(): string {
    return makeBundle({
      'index.md': ROOT_INDEX,
      'rfcs/index.md': '# Catalog\n',
      'rfcs/RFC-001.md': '---\ntype: Spec\n---\n\n# RFC-001\n\nBase.\n',
      'notes/index.md': '# Catalog\n',
      'notes/a.md': '---\ntype: Spec\n---\n\n# A\n\nVer RFC-001 y también SPEC-QA-001.\n',
    });
  }

  it('a custom pattern/dir links its IDs; foreign IDs are not even mentions', () => {
    const dir = rfcBundle();
    expect(buildIdMap(dir, RFC_CONFIG).get('RFC-001')).toBe('/rfcs/RFC-001.md');

    const report = applyLinks(dir, RFC_CONFIG);
    expect(read(dir, 'notes/a.md')).toContain('Ver [RFC-001](/rfcs/RFC-001.md)');
    // SPEC-QA-001 matches no configured rule → not a mention, not unresolved
    expect(read(dir, 'notes/a.md')).toContain('también SPEC-QA-001.');
    expect(report.unresolved).toEqual([]);
  });

  it('the default rules on the same bundle see SPEC ids instead', () => {
    const dir = rfcBundle();
    const report = applyLinks(dir, DEFAULT_CONFIG);
    // no specs/ dir → SPEC-QA-001 is an unresolved mention; RFC-001 is invisible
    expect(read(dir, 'notes/a.md')).toContain('Ver RFC-001 y');
    expect(report.unresolved).toEqual([{ file: 'notes/a.md', id: 'SPEC-QA-001' }]);
  });
});

describe('config-driven: custom generated files', () => {
  it('files listed in `generated` are never rewritten by the codemod', () => {
    const config: OkfConfig = { ...DEFAULT_CONFIG, generated: ['matrix/coverage.md'] };
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'specs/index.md': '# Catalog\n',
      'specs/SPEC-A-001.md': '---\ntype: Spec\n---\n\n# SPEC-A-001\n',
      'matrix/index.md': '# Catalog\n',
      'matrix/coverage.md': '---\ntype: Index\n---\n\n# M\n\nSPEC-A-001 queda en prosa.\n',
    });
    applyLinks(dir, config);
    expect(read(dir, 'matrix/coverage.md')).toContain('SPEC-A-001 queda en prosa.');
  });
});

describe('config file loading (okf.config.json)', () => {
  it('loadConfig merges partial config over defaults and anchors bundleRoot to the file', () => {
    const dir = makeBundle({
      'okf.config.json': JSON.stringify({ bundleRoot: 'kb', taxonomy: ['Note'] }),
      'kb/index.md': ROOT_INDEX,
      'kb/notes/index.md': '# Catalog\n',
      'kb/notes/a.md': '---\ntype: Note\n---\n\n# A\n',
    });
    const loaded = loadConfig(path.join(dir, 'okf.config.json'));
    expect(loaded.config.taxonomy).toEqual(['Note']);
    expect(loaded.config.reserved).toEqual(DEFAULT_CONFIG.reserved); // default preserved
    const bundleRoot = resolveBundleRoot(loaded);
    expect(bundleRoot).toBe(path.join(dir, 'kb'));
    expect(checkBundle(bundleRoot, loaded.config).warnings).toEqual([]);
  });

  it('CLI --config drives check + index against a non-default layout', () => {
    const dir = makeBundle({
      'okf.config.json': JSON.stringify({ bundleRoot: 'kb' }),
      'kb/index.md': ROOT_INDEX,
      'kb/guides/g1.md': '---\ntype: Runbook\ntitle: "G1"\n---\n\n# G1\n',
    });
    const cfg = path.join(dir, 'okf.config.json');
    const idx = spawnSync(TSX, [CLI, 'index', '--config', cfg], { encoding: 'utf-8', cwd: ROOT });
    expect(idx.status).toBe(0);
    expect(read(dir, 'kb/guides/index.md')).toContain('* [G1](g1.md)');
    const chk = spawnSync(TSX, [CLI, 'check', '--config', cfg], { encoding: 'utf-8', cwd: ROOT });
    expect(chk.status).toBe(0);
    expect(chk.stdout).toContain('OK');
  });

  it('an explicit positional bundleRoot overrides the config file', () => {
    const dir = makeBundle({
      'okf.config.json': JSON.stringify({ bundleRoot: 'kb-does-not-exist' }),
      'other/index.md': ROOT_INDEX,
    });
    const cfg = path.join(dir, 'okf.config.json');
    const res = spawnSync(TSX, [CLI, 'check', path.join(dir, 'other'), '--config', cfg], {
      encoding: 'utf-8',
      cwd: ROOT,
    });
    expect(res.status).toBe(0);
  });
});

describe('index generation is config-agnostic on reserved files', () => {
  it('custom reserved files stay out of the generated catalogs', () => {
    const config: OkfConfig = {
      ...DEFAULT_CONFIG,
      reserved: [...DEFAULT_CONFIG.reserved, 'GLOSSARY.md'],
    };
    const dir = makeBundle({
      'index.md': ROOT_INDEX,
      'notes/a.md': '---\ntype: Spec\ntitle: "A"\n---\n\n# A\n',
      'notes/GLOSSARY.md': '# Glossary\n',
    });
    applyIndexes(dir, config);
    const idx = read(dir, 'notes/index.md');
    expect(idx).toContain('* [A](a.md)');
    expect(idx).not.toContain('GLOSSARY');
  });
});
