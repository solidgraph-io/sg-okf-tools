/** Shared fixture helpers: synthetic OKF bundles in temp dirs. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ROOT = path.resolve(__dirname, '..');
export const TSX = path.join(ROOT, 'node_modules/.bin/tsx');
export const CLI = path.join(ROOT, 'src/cli.ts');

const tmpDirs: string[] = [];

export function cleanupBundles(): void {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  tmpDirs.length = 0;
}

export function makeBundle(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'okf-tools-fixture-'));
  tmpDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }
  return dir;
}

export function read(dir: string, rel: string): string {
  return fs.readFileSync(path.join(dir, rel), 'utf-8');
}

export const ROOT_INDEX = [
  '---',
  'okf_version: "0.1"',
  '---',
  '',
  '# Bundle',
  '',
  '<!-- okf:index:start -->',
  '<!-- okf:index:end -->',
  '',
].join('\n');

export const VALID_CONCEPT = '---\ntype: Spec\ntitle: "X"\n---\n\n# X\n\nBody.\n';

export function concept(body: string, opts: { type?: string; description?: string } = {}): string {
  const desc = opts.description ? `\ndescription: "${opts.description}"` : '';
  return `---\ntype: ${opts.type ?? 'Spec'}\ntitle: "X"${desc}\n---\n\n${body}`;
}
