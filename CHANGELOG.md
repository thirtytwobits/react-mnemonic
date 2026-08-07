# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries under `[Unreleased]` describe work merged since the last tag. Each
release moves that section under a dated heading of its own.

## [Unreleased]

### Added

- `unpersistedKeys()` and `flush(keys?)` on the `Mnemonic` store and on `useMnemonicRecovery()`, for detecting and re-attempting writes that never reached storage ([#101](https://github.com/thirtytwobits/react-mnemonic/issues/101))
- `onStorageError` on `MnemonicProvider`, called when a mutation does not reach storage. The event carries the unprefixed `key`, the `operation`, a classified `reason` (`"quota"`, `"access"`, `"schema"`, `"codec"`, `"contract"`, `"unknown"`), the underlying `error`, and the approximate `bytes` that could not be written. Exported as `MnemonicStorageErrorEvent` and `MnemonicStorageErrorReason` ([#102](https://github.com/thirtytwobits/react-mnemonic/issues/102))

### Changed

- Dependabot now runs scheduled version updates across all four npm manifests and the Actions workflows, with minor and patch updates grouped into one pull request ([#105](https://github.com/thirtytwobits/react-mnemonic/pull/105))
- Documentation cross-links undo-focused use cases to `react-amnesia` ([#94](https://github.com/thirtytwobits/react-mnemonic/pull/94))

### Fixed

- A storage write rejected by the backend (a full quota being the common case) is no longer indistinguishable from a durable one. The provider still serves the cached value, but now records the key as unpersisted so applications can report it and retry it with `flush()` once space frees up. Previously the value was lost on the next reload with no programmatic trace ([#101](https://github.com/thirtytwobits/react-mnemonic/issues/101))
- An unclassified encode failure in `useMnemonicKeyOptional(...).set(...)` escaped to the caller instead of being reported, breaking the contract that a set never throws ([#114](https://github.com/thirtytwobits/react-mnemonic/pull/114))
- Cleared the dependency vulnerability backlog in the documentation site and consumer fixtures. The published package was never affected ([#105](https://github.com/thirtytwobits/react-mnemonic/pull/105))

## [1.5.0] - 2026-04-03

### Fixed

- Optional bridge behaviour is consistent across entrypoints ([#87](https://github.com/thirtytwobits/react-mnemonic/pull/87))

## [1.4.0] - 2026-03-22

### Added

- `react-mnemonic/bootstrap` entrypoint for synchronous first-paint recall before React renders ([#81](https://github.com/thirtytwobits/react-mnemonic/pull/81))
- Development warning when nested `MnemonicProvider`s share a namespace ([#76](https://github.com/thirtytwobits/react-mnemonic/pull/76))

### Changed

- Root entrypoint documentation reworded, and the AI quick start gained a provider wrapper example ([#78](https://github.com/thirtytwobits/react-mnemonic/pull/78), [#79](https://github.com/thirtytwobits/react-mnemonic/pull/79))

### Fixed

- GitHub Pages artifact deployment ([#71](https://github.com/thirtytwobits/react-mnemonic/pull/71))
- CodeQL findings across the library ([#75](https://github.com/thirtytwobits/react-mnemonic/pull/75))

## [1.3.0] - 2026-03-12

### Changed

- Optional persistence redesigned around a leaner bridge ([#69](https://github.com/thirtytwobits/react-mnemonic/pull/69))
- Project branding moved to new logo assets ([#66](https://github.com/thirtytwobits/react-mnemonic/pull/66))
- Documentation deploys only on release tags ([#67](https://github.com/thirtytwobits/react-mnemonic/pull/67))

## [1.2.1-beta1.0] - 2026-03-10

### Added

- Versioned Docusaurus documentation ([#63](https://github.com/thirtytwobits/react-mnemonic/pull/63))
- Multi-step wizard guidance for AI assistants ([#60](https://github.com/thirtytwobits/react-mnemonic/pull/60))

### Changed

- Shopping cart guide and demo expanded ([#61](https://github.com/thirtytwobits/react-mnemonic/pull/61))

## [1.2.0-beta1] - 2026-03-10

### Added

- Schema runtime split into optional entrypoints, so the lean path no longer carries validation and migration code ([#47](https://github.com/thirtytwobits/react-mnemonic/pull/47))
- Auth-aware persistence patterns documented ([#55](https://github.com/thirtytwobits/react-mnemonic/pull/55))
- Context7 indexing configuration and a capability matrix replacing the previous benchmark guide ([#53](https://github.com/thirtytwobits/react-mnemonic/pull/53), [#54](https://github.com/thirtytwobits/react-mnemonic/pull/54), [#56](https://github.com/thirtytwobits/react-mnemonic/pull/56))

### Changed

- README scope tightened and the package landing page shortened ([#48](https://github.com/thirtytwobits/react-mnemonic/pull/48))

## [1.1.0-beta0] - 2026-03-08

### Added

- SSR hydration controls ([#34](https://github.com/thirtytwobits/react-mnemonic/pull/34))
- Key descriptors via `defineMnemonicKey(...)`, with hardened SSR coverage ([#31](https://github.com/thirtytwobits/react-mnemonic/pull/31))
- Typed schema cohesion helpers ([#33](https://github.com/thirtytwobits/react-mnemonic/pull/33))
- Development diagnostics for risky persistence setups ([#37](https://github.com/thirtytwobits/react-mnemonic/pull/37))
- Agent-facing documentation surfaces, generated instruction packs, and drift checks ([#42](https://github.com/thirtytwobits/react-mnemonic/pull/42), [#43](https://github.com/thirtytwobits/react-mnemonic/pull/43))
- AI contract guide ([#36](https://github.com/thirtytwobits/react-mnemonic/pull/36))
- Property-based tests and consumer fixtures ([#38](https://github.com/thirtytwobits/react-mnemonic/pull/38))
- Published comparison benchmarks ([#39](https://github.com/thirtytwobits/react-mnemonic/pull/39))

### Changed

- Release automation publishes tagged releases to the npm `latest` dist-tag and validates docs in CI
- Sync-only `StorageLike` contract clarified ([#35](https://github.com/thirtytwobits/react-mnemonic/pull/35))
- API documentation discoverability improved ([#20](https://github.com/thirtytwobits/react-mnemonic/pull/20))

### Fixed

- SonarCloud findings and complexity hotspots in the library core ([#41](https://github.com/thirtytwobits/react-mnemonic/pull/41), [#44](https://github.com/thirtytwobits/react-mnemonic/pull/44))

## [1.0.0-beta.0] - 2026-03-06

### Added

- `MnemonicProvider` / `useMnemonicKey` persistent-state core
- Schema modes, JSON Schema validation, and migration support
- Read-time reconciliation hooks for persisted defaults
- Namespace-scoped recovery helpers via `useMnemonicRecovery`
- Structural migration helpers for tree-shaped data
- Immutable schema registry helper via `createSchemaRegistry`
- Interactive documentation site and generated API reference

## [0.1.1-alpha.0] - 2026-02-16

### Added

- Initial alpha publish of the persistent-state core

[unreleased]: https://github.com/thirtytwobits/react-mnemonic/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/thirtytwobits/react-mnemonic/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/thirtytwobits/react-mnemonic/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/thirtytwobits/react-mnemonic/compare/v1.2.1-beta1...v1.3.0
[1.2.1-beta1.0]: https://github.com/thirtytwobits/react-mnemonic/compare/v1.2.0-beta1...v1.2.1-beta1
[1.2.0-beta1]: https://github.com/thirtytwobits/react-mnemonic/compare/v1.1.0-beta.0...v1.2.0-beta1
[1.1.0-beta0]: https://github.com/thirtytwobits/react-mnemonic/compare/v1.0.0-beta.0...v1.1.0-beta.0
[1.0.0-beta.0]: https://github.com/thirtytwobits/react-mnemonic/compare/v0.1.1-alpha.0...v1.0.0-beta.0
[0.1.1-alpha.0]: https://github.com/thirtytwobits/react-mnemonic/releases/tag/v0.1.1-alpha.0
