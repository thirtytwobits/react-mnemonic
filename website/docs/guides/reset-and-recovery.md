---
sidebar_position: 4
title: Reset and Recovery
description: Add soft reset and hard reset flows for persisted state.
---

# Reset and Recovery

Users eventually get stuck on stale, corrupted, or simply undesirable persisted
state. `react-mnemonic` already gives you per-key `reset()` and `remove()`, but
real apps often need a namespace-level recovery flow too:

- clear saved filters without touching durable preferences
- wipe a broken rollout state and keep the app usable
- offer a support-friendly "reset app data" button
- rewrite values that a full storage backend silently dropped

`useMnemonicRecovery()` is the first-class hook for those flows.

## API shape

```tsx
import { useMnemonicRecovery } from "react-mnemonic";

function RecoveryMenu() {
    const { namespace, canEnumerateKeys, listKeys, clearAll, clearKeys, clearMatching, unpersistedKeys, flush } =
        useMnemonicRecovery({
            onRecover: (event) => {
                console.info("Recovery action", event.action, event.namespace, event.clearedKeys);
            },
        });

    return (
        <div>
            <p>Namespace: {namespace}</p>
            <p>Keys: {canEnumerateKeys ? listKeys().join(", ") : "manual list required"}</p>
            <button onClick={() => clearMatching((key) => key.startsWith("filters."))}>Clear filters</button>
            <button onClick={() => clearAll()}>Reset all persisted state</button>
        </div>
    );
}
```

## Soft reset

Use a soft reset when only part of the persisted namespace is suspect.

Examples:

- saved filters no longer match a new search model
- a dismissed onboarding banner should reappear
- a cached preference slice should be repopulated from defaults

```tsx
function ClearSavedFiltersButton() {
    const { clearMatching } = useMnemonicRecovery();

    return <button onClick={() => clearMatching((key) => key.startsWith("filters."))}>Clear saved filters</button>;
}
```

If your app already knows the exact durable keys it owns, `clearKeys([...])` is
even safer:

```tsx
const FILTER_KEYS = ["filters.query", "filters.sort", "filters.tags"] as const;

function ClearSavedFiltersButton() {
    const { clearKeys } = useMnemonicRecovery();

    return <button onClick={() => clearKeys(FILTER_KEYS)}>Clear saved filters</button>;
}
```

## Hard reset

Use a hard reset when you want the current namespace to start over from
defaults. A common pattern is:

1. Clear the namespace.
2. Show a confirmation toast or modal.
3. Reload the app if the current screen depends on the cleared state.

```tsx
function ResetAppButton() {
    const { clearAll } = useMnemonicRecovery();

    return (
        <button
            onClick={() => {
                clearAll();
                window.location.reload();
            }}
        >
            Reset app data
        </button>
    );
}
```

That gives users a deterministic way to escape bad persisted state without
manual support intervention.

## Recovering dropped writes

Clearing is not the only thing that gets an app unstuck. When the storage
backend rejects a write — a full quota is the common case — the value still
lands in the in-memory cache and still re-renders subscribers, so `set(...)`
succeeds from the caller's point of view while storage keeps the old value. The
next reload quietly reverts to whatever last fit.

`unpersistedKeys()` names those keys, and `flush()` rewrites them:

```tsx
function StorageRecoveryBanner() {
    const { unpersistedKeys, flush, clearMatching } = useMnemonicRecovery();
    const pending = unpersistedKeys();

    if (pending.length === 0) return null;

    return (
        <div role="alert">
            <p>{pending.length} change(s) could not be saved.</p>
            <button
                onClick={() => {
                    // Make room first, then rewrite what was dropped.
                    clearMatching((key) => key.startsWith("cache."));
                    const { failed } = flush();
                    if (failed.length > 0) {
                        console.warn("Still unpersisted:", failed);
                    }
                }}
            >
                Free space and retry
            </button>
        </div>
    );
}
```

Notes on the contract:

- `unpersistedKeys()` works on non-enumerable backends too, because the keys
  come from the provider's own write queue rather than from storage.
- `flush(keys?)` defaults to every unpersisted key and returns
  `{ persisted, failed }`. Keys that are already durable are ignored, so the two
  arrays cover exactly what was retried.
- Keys that fail again stay queued, so a later `flush()` can still recover them.
- A queued value is dropped if an external change reloads that key from storage;
  the other tab's write wins rather than being overwritten by a retry.
- `clearAll()` and `clearMatching(...)` cover unpersisted keys as well as stored
  ones, so a reset cannot leave a value behind for a later flush to write back.

Freeing space alone does not retry anything. Something has to call `flush()`.

## Recovery telemetry

`onRecover` lets you record or surface recovery actions:

```tsx
const recovery = useMnemonicRecovery({
    onRecover: ({ action, namespace, clearedKeys }) => {
        analytics.track("mnemonic_recovery", {
            action,
            namespace,
            clearedKeys,
        });
    },
});
```

Useful signals include:

- which reset action ran
- which namespace was affected
- which key groups are causing user pain often enough to warrant migration work

## Custom storage safety note

`clearAll()` and `clearMatching()` require a storage backend that can enumerate
keys. `localStorage` and `sessionStorage` already support that.

If your custom storage only implements:

```ts
getItem(key);
setItem(key, value);
removeItem(key);
```

then namespace-wide enumeration is unavailable. In that case:

- `listKeys()` returns `[]`
- `canEnumerateKeys` is `false`
- `clearAll()` throws
- `clearMatching()` throws
- `clearKeys([...])` still works
- `unpersistedKeys()` and `flush()` still work

The practical pattern for non-enumerable storage is to keep an explicit list of
the durable keys your app owns and pass that to `clearKeys`.

## When to reset vs migrate

Prefer migration or `reconcile` when you can safely preserve user intent.
Prefer recovery/reset when persisted state is invalid, dangerous, or too costly
to transform reliably.

As a rule of thumb:

- if you can upgrade the data deterministically, migrate it
- if you only need to re-apply new defaults, use `reconcile`
- if the user needs an escape hatch from bad persisted state, offer recovery UI
