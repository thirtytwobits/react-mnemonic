# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic
Versioning.

## [1.0.0] - Unreleased

### Added

- Stable `MnemonicProvider` / `useMnemonicKey` persistent-state core
- Schema modes, JSON Schema validation, and migration support
- Read-time reconciliation hooks for persisted defaults
- Namespace-scoped recovery helpers via `useMnemonicRecovery`
- Structural migration helpers for tree-shaped data
- Immutable schema registry helper via `createSchemaRegistry`
- Interactive documentation site and generated API reference

### Changed

- Release automation now targets stable npm publishing and validates docs in CI
- Public documentation now reflects the stable DevTools registry contract
