/**
 * @solidgraph-io/okf-tools — library entrypoint.
 *
 * Everything the CLI does is available programmatically, plus the low-level
 * helpers (md-zones, frontmatter) for other tooling to reuse.
 */

export {
  DEFAULT_CONFIG,
  loadConfig,
  resolveBundleRoot,
  type IdRule,
  type OkfConfig,
  type LoadedConfig,
} from './config.js';
export { parseFrontmatter, type FrontmatterResult } from './frontmatter.js';
export { FRONTMATTER_RE, FENCE_RE, maskCodeZones, maskInlineCode } from './md-zones.js';
export { checkBundle, type OkfResult } from './check.js';
export {
  buildIndexes,
  applyIndexes,
  checkIndexes,
  GENERATED_MARK,
  ROOT_BLOCK_START,
  ROOT_BLOCK_END,
} from './index.js';
export {
  applyLinks,
  checkLinks,
  buildIdMap,
  processDoc,
  type LinkReport,
  type LinkedRef,
  type UnresolvedRef,
} from './link.js';
