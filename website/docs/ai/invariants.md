---
sidebar_position: 2
title: Invariants
description: Deterministic runtime guarantees for provider scope, reads, writes, SSR, type sourcing, and storage adapters.
---

# Invariants

This page is the shortest authoritative statement of what `react-mnemonic`
guarantees.

## Core Runtime Invariants

- `useMnemonicKey(...)` must run inside a `MnemonicProvider`.
- Every persisted key is stored as `${namespace}.${key}` in the underlying backend.
- `defaultValue` is required and defines the fallback when a key is absent, malformed, or rejected by validation.
- `set(next)` persists the next value for the key.
- `reset()` persists `defaultValue` again.
- `remove()` deletes the key entirely, so the next read falls back to `defaultValue`.
- `listenCrossTab` is advisory. Native browser storage uses the `storage` event; custom adapters must implement `storage.onExternalChange(...)` for equivalent behavior.
- `StorageLike` is synchronous. Returning a Promise from `getItem`, `setItem`, or `removeItem` is an invalid contract.
- SSR defaults to `defaultValue` on the server unless `ssr.serverValue` is supplied.
- `reconcile(...)` runs after decode and migration. If it returns a different persisted result, the library rewrites storage with that reconciled value.
- Schema migrations handle structural version-to-version upgrades. `reconcile(...)` handles conditional read-time policy updates inside an already valid shape.

## Type Sourcing Rules

- Import values from `react-mnemonic`, not internal package paths.
- Import exported types from `react-mnemonic` with `import type`.
- Do not create local `react-mnemonic.d.ts` files.
- Do not write `declare module "react-mnemonic"` in consumer code.
- If a type seems missing, check `src/index.ts`, `package.json`, and the API docs before inventing a replacement contract.

## Exact Read Lifecycle

Normal client reads follow this order:

1. Load the raw snapshot for the key from the provider cache and storage layer.
2. If the raw value is absent, use `defaultValue`.
3. Parse the versioned envelope.
4. Decode the payload through the codec path or schema-managed JSON path.
5. Validate against the stored schema version when a schema exists.
6. Run schema migrations when the stored version is older than the latest registered version.
7. Run `reconcile(...)` if provided.
8. If migration, autoschema inference, or reconciliation changed the persisted representation, schedule a rewrite back to storage.
9. If any read path is invalid, fall back to `defaultValue` and pass the relevant error to a fallback factory when applicable.

SSR and hydration add one rule before the normal read path:

1. On the server, the hook uses the SSR snapshot instead of reading browser storage.
2. Without explicit SSR config, that snapshot renders `defaultValue`.
3. With `ssr.serverValue`, that snapshot renders the provided placeholder.
4. With `hydration: "client-only"`, persisted storage is not read until after mount.

## Exact Write Lifecycle

Writes follow this order:

1. Resolve the next value directly or by calling the updater with the current decoded value.
2. Choose the write path:
    - schema-managed latest version by default
    - explicit pinned schema version when configured
    - codec-only v0 envelope when no schema applies
3. Run a write-time migration when a registry rule has `fromVersion === toVersion`.
4. Validate the value against the target schema when schema-managed.
5. Encode the versioned envelope.
6. Write the raw string through the provider cache and storage layer.
7. If the storage backend rejected the write, queue the key as unpersisted. Otherwise clear any entry queued for it.
8. Notify subscribers for the key.

The cache is updated whether or not step 6 reached storage, so a rejected write
is still what components see. Rejection is reported through
`useMnemonicRecovery().unpersistedKeys()` and retried through `flush(...)`. A
queued entry clears when the key is written successfully, when a flush persists
it, or when an external change reloads that key from storage.

## Storage Adapter Boundaries

Custom storage adapters are supported, but the contract is intentionally
strict:

- The adapter must be synchronous.
- The adapter must expose `getItem`, `setItem`, and `removeItem`.
- `key(index)` and `length` are optional and are only needed for enumeration-style features.
- Cross-tab or external-process sync is not automatic for custom adapters. Add `onExternalChange(...)` when your backend can detect out-of-band writes.
- If you wrap `localStorage`, preserve the native `storage` event semantics or implement `onExternalChange(...)` yourself.

## Source Files

- [`src/Mnemonic/use.ts`](https://github.com/thirtytwobits/react-mnemonic/blob/main/src/Mnemonic/use.ts)
- [`src/Mnemonic/provider.tsx`](https://github.com/thirtytwobits/react-mnemonic/blob/main/src/Mnemonic/provider.tsx)
- [`src/Mnemonic/types.ts`](https://github.com/thirtytwobits/react-mnemonic/blob/main/src/Mnemonic/types.ts)
