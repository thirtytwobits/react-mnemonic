---
sidebar_position: 5
title: Anti-Patterns
description: Common mistakes that produce incorrect persistence semantics even when the app appears to work.
---

# Anti-Patterns

These patterns often "work" at runtime but still encode the wrong persistence
contract.

## Persisting Runtime-Only UI State

Avoid persisting values when rehydration would be surprising or incorrect:

- hover, focus, drag, selection, or expansion state
- loading flags, optimistic mutation state, and retry counters
- validation errors, dirty flags, and submit-in-progress markers
- transient search text that should disappear on reload
- server cache metadata unless the app explicitly wants to restore it

Prefer splitting state into:

- a persisted durable slice handled by `useMnemonicKey(...)`
- an ephemeral runtime slice handled by `useState(...)`

## Using `remove()` To Mean "Cleared"

If "cleared" is a durable state, do not delete the key.

Wrong:

- `remove()` for a nullable preference, optional form field, or saved filter that should remain explicitly cleared after reload

Prefer:

- `set(null)` or a nullable field inside the persisted object

## Using `reconcile(...)` For Structural Version Jumps

Do not use `reconcile(...)` to paper over a real schema upgrade.

Wrong:

- adding or renaming persistent fields in place with `reconcile(...)`

Prefer:

- a versioned schema plus migration for structural compatibility
- `reconcile(...)` only for conditional policy refresh inside an already valid shape

## Returning Promises From `StorageLike`

`StorageLike` is synchronous in beta 1.

Wrong:

- `getItem: async (...) => ...`
- direct IndexedDB calls from `getItem`, `setItem`, or `removeItem`

Prefer:

- a synchronous facade backed by an in-memory cache
- `onExternalChange(...)` when the real backend can notify out-of-band updates

## Inventing Local Package Shims

Do not "fix" missing type information by shadowing the package.

Wrong:

- `react-mnemonic.d.ts`
- `declare module "react-mnemonic"`
- importing from unpublished internal paths

Prefer:

- `import` and `import type` from `react-mnemonic`
- checking `src/index.ts`, `package.json`, and the API docs before assuming a surface is missing

## Reintroducing Raw `localStorage` In Examples

If `react-mnemonic` is the intended abstraction, do not bypass it in templates,
scaffolds, or user-facing examples.

Wrong:

- direct `localStorage.getItem(...)` or `localStorage.setItem(...)` in example app code that should model durable UI state through the hook

Prefer:

- `useMnemonicKey(...)` for durable app or UI state
- raw storage only in storage adapter implementations, tests, or low-level library internals

## Treating The Provider As Optional

`useMnemonicKey(...)` is not a global singleton hook.

Wrong:

- calling it outside a `MnemonicProvider`
- treating the namespace as irrelevant

Prefer:

- one explicit provider per persisted storage scope
- intentional namespace selection so keys cannot collide silently
