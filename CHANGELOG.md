# Changelog

All notable changes to `@solidgraph-io/okf-tools` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and the
package follows [semver](https://semver.org/). The OKF *bundle* version
(`okf_version` in your root `index.md`) is independent of this tool's version.

## [0.1.0-beta.0] — 2026-07-15

### Added

- Initial extraction from the `sg-webpage` OKF tooling (battle-tested there as
  `scripts/okf-check.ts`, `okf-index.ts`, `okf-link.ts`, `md-zones.ts`).
- CLI `okf check|index|link` with `--config` and `--check` flags.
- Config-driven behavior via `okf.config.json`: bundle root, expected
  `okf_version`, `type` taxonomy, reserved files, generated files and
  ID→path rules for the cross-link codemod.
- Library exports: `checkBundle`, `buildIndexes`/`applyIndexes`/`checkIndexes`,
  `applyLinks`/`checkLinks`/`buildIdMap`/`processDoc`, `parseFrontmatter`,
  `maskCodeZones`/`maskInlineCode` and the config types/defaults.
