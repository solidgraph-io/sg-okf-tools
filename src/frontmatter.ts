/**
 * frontmatter — parse the YAML frontmatter block of an OKF concept (§4).
 */

import YAML from 'yaml';
import { FRONTMATTER_RE } from './md-zones.js';

export type FrontmatterResult =
  | { data: unknown } // parseable frontmatter
  | { error: string } // present but unparseable YAML
  | null; // no frontmatter block at all

/** Parse the frontmatter block opening `content`, if any. */
export function parseFrontmatter(content: string): FrontmatterResult {
  const m = FRONTMATTER_RE.exec(content);
  if (!m) return null;
  try {
    return { data: YAML.parse(m[1]!) };
  } catch (e) {
    return { error: e instanceof Error ? e.message.split('\n')[0]! : String(e) };
  }
}
