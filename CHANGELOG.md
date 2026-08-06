# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic
Versioning.

## [1.5.0] - Unreleased

### Added

- Beta `MnemonicProvider` / `useMnemonicKey` persistent-state core
- Schema modes, JSON Schema validation, and migration support
- Read-time reconciliation hooks for persisted defaults
- Namespace-scoped recovery helpers via `useMnemonicRecovery`
- Structural migration helpers for tree-shaped data
- Immutable schema registry helper via `createSchemaRegistry`
- Interactive documentation site and generated API reference
- `unpersistedKeys()` and `flush(keys?)` on the `Mnemonic` store and on `useMnemonicRecovery()`, for detecting and re-attempting writes that never reached storage

### Changed

- Release automation now publishes tagged releases to the npm `latest` dist-tag and validates docs in CI
- Public documentation now reflects the current DevTools registry contract

### Fixed

- A storage write rejected by the backend (a full quota being the common case) is no longer indistinguishable from a durable one. The provider still serves the cached value, but now records the key as unpersisted so applications can report it and retry it with `flush()` once space frees up. Previously the value was lost on the next reload with no programmatic trace ([#101](https://github.com/thirtytwobits/react-mnemonic/issues/101))
