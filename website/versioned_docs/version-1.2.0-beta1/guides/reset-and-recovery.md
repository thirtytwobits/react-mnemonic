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

`useMnemonicRecovery()` is the first-class hook for those flows.

## API shape

```tsx
import { useMnemonicRecovery } from "react-mnemonic";

function RecoveryMenu() {
    const { namespace, canEnumerateKeys, listKeys, clearAll, clearKeys, clearMatching } = useMnemonicRecovery({
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
