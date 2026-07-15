/**
 * md-zones — masking of markdown code zones.
 *
 * Links/refs inside YAML frontmatter, code fences or inline code are examples,
 * not relations: `okf check` must not validate them and `okf link` must not
 * rewrite them. Masking blanks those zones with spaces so offsets and line
 * structure survive (consumers keep scanning the masked text with the
 * original indexes).
 */

/** Frontmatter block opening the file: --- … --- (OKF §4). $1 = the YAML body. */
export const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** A fence delimiter line (``` or ~~~), up to 3 leading spaces per CommonMark. */
export const FENCE_RE = /^\s{0,3}(```|~~~)/;

const blank = (m: string): string => ' '.repeat(m.length);

/** Blank inline code spans (`…`, ``…``) in one line, preserving offsets. */
export function maskInlineCode(line: string): string {
  return line.replace(/(`+)[^`]*\1/g, blank);
}

/** Blank frontmatter, code fences and inline code across a whole document. */
export function maskCodeZones(content: string): string {
  const fm = FRONTMATTER_RE.exec(content);
  const head = fm ? fm[0].replace(/[^\n]/g, ' ') : '';
  const body = content.slice(head.length);

  let inFence = false;
  const lines = body.split('\n').map((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return blank(line);
    }
    return inFence ? blank(line) : maskInlineCode(line);
  });

  return head + lines.join('\n');
}
