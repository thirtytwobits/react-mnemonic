---
sidebar_position: 4
title: AI Contract Guide
description: Deterministic invariants, lifecycle order, decision tables, and canonical recipes for humans and AI agents.
---

# AI Contract Guide

This guide is the compact implementation contract for `react-mnemonic`.

Use it when you want the most deterministic summary of:

- what `useMnemonicKey(...)` guarantees
- when values are read, rewritten, or deleted
- which persistence action to choose for a given UI need
- how to implement common patterns without inventing a new contract

If you want the narrative background for one topic, follow the linked guides.
If you want the shortest reliable contract for implementation work, stay here.

## Core invariants

- `useMnemonicKey(...)` must run inside a `MnemonicProvider`.
- Every stored key is namespaced as `${namespace}.${key}` in the underlying storage backend.
- `defaultValue` is required and defines the fallback when a key is absent or invalid.
- `set(next)` persists a new value for the key.
- `reset()` persists `defaultValue` again.
- `remove()` deletes the key entirely, so the next read falls back to `defaultValue`.
- Persist only values you intentionally want to rehydrate after reload.
- `StorageLike` is intentionally synchronous in v1/beta.
- SSR is safe by default: the server renders `defaultValue` unless you opt into `ssr.serverValue`.
- `reconcile(...)` runs after decode/migration and can rewrite the stored value when it returns a different persisted result.
- Schema migrations handle structural version-to-version upgrades; `reconcile(...)` handles conditional read-time policy updates.

## Structured summary

```json
{
    "storageContract": {
        "type": "synchronous",
        "namespacePattern": "${namespace}.${key}",
        "actions": {
            "set": "persist next value",
            "reset": "persist defaultValue",
            "remove": "delete key and fall back to defaultValue"
        }
    },
    "readLifecycle": [
        "load raw snapshot",
        "decode payload",
        "validate and migrate when schemas exist",
        "run reconcile if provided",
        "fall back to defaultValue when absent or invalid",
        "persist read-time rewrite if migration/autoschema/reconcile changed storage shape"
    ],
    "ssr": {
        "defaultServerValue": "defaultValue",
        "optionalServerValue": "ssr.serverValue",
        "hydrationModes": ["immediate", "client-only"]
    },
    "decisionShortcuts": {
        "durableClearIntent": "set(null)",
        "forgetKey": "remove()",
        "restoreDefault": "reset()",
        "structuralUpgrade": "schema migration",
        "conditionalPolicyRewrite": "reconcile"
    }
}
```

A static companion file is also available at [`/ai-contract.json`](/ai-contract.json).

## Exact lifecycle order

### Reads

Normal client reads follow this order:

1. Load the raw snapshot for the key from the provider cache/storage layer.
2. If the raw value is absent, use `defaultValue`.
3. Parse the versioned envelope.
4. Decode the payload through the codec path or schema-managed JSON path.
5. Validate against the stored schema version when a schema exists.
6. Run schema migrations when the stored version is older than the latest version.
7. Run `reconcile(...)` if provided.
8. If migration, autoschema inference, or reconciliation changed the persisted representation, schedule a rewrite back to storage.
9. If any read path is invalid, fall back to `defaultValue` and pass the relevant error to a fallback factory when applicable.

SSR and hydration add one rule before the normal read path:

1. On the server, the hook uses the SSR snapshot instead of reading browser storage.
2. Without explicit SSR config, that snapshot renders `defaultValue`.
3. With `ssr.serverValue`, that snapshot renders the provided placeholder.
4. With `hydration: "client-only"`, persisted storage is not read until after mount.

### Writes

Writes follow this order:

1. Resolve the next value directly or by calling the updater with the current decoded value.
2. Choose the write path:
    - schema-managed latest version by default
    - explicit pinned schema version when configured
    - codec-only v0 envelope when no schema applies
3. Run a write-time migration when a registry rule has `fromVersion === toVersion`.
4. Validate the value against the target schema when schema-managed.
5. Encode the versioned envelope.
6. Write the raw string through the provider cache/storage layer.
7. Notify subscribers for the key.

## Decision tables

### `set(null)` vs `remove()` vs `reset()`

| Need                                  | Action      | Result after reload          |
| ------------------------------------- | ----------- | ---------------------------- |
| Keep an explicit “cleared” state      | `set(null)` | Still cleared                |
| Forget the key entirely               | `remove()`  | Falls back to `defaultValue` |
| Restore the default as a stored value | `reset()`   | Rehydrates `defaultValue`    |

Rule of thumb:

- Use `set(null)` for durable clear intent.
- Use `remove()` for absence.
- Use `reset()` when the default itself should become the new persisted value.

### Migration vs `reconcile(...)`

| Situation                                                       | Use                                                | Why                                                           |
| --------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| Stored shape changed between explicit versions                  | Schema migration                                   | Structural compatibility belongs to version transitions       |
| Every write should normalize the value                          | Write-time migration (`fromVersion === toVersion`) | Keeps writes canonical                                        |
| Existing shape is fine, but defaults/policy should be refreshed | `reconcile(...)`                                   | Conditional read-time rewrite without inventing a new version |
| Invalid or stale data should be discarded                       | Recovery / reset flow                              | Safer than forcing a questionable transform                   |

### Should this state persist?

| State shape                                    | Persist?    | Why                                          |
| ---------------------------------------------- | ----------- | -------------------------------------------- |
| Theme, density, durable layout preference      | Yes         | Users expect it after reload                 |
| Saved filters users intentionally restore      | Yes         | This is durable preference state             |
| User-authored draft content                    | Usually yes | Lost work is expensive                       |
| Hover/focus/drag/loading/optimistic flags      | No          | Rehydrating runtime-only UI feels wrong      |
| Temporary form dirtiness and validation errors | No          | These describe a session, not durable intent |
| Server response cache timestamps               | Usually no  | Prefer cache logic over UI persistence       |

### SSR mode choice

| Need                                     | Config                                                |
| ---------------------------------------- | ----------------------------------------------------- |
| Default SSR behavior                     | No SSR config                                         |
| Deterministic server placeholder         | `ssr.serverValue`                                     |
| Delay persisted read until after mount   | `ssr.hydration: "client-only"`                        |
| Make every key inherit delayed hydration | `MnemonicProvider ssr={{ hydration: "client-only" }}` |

## Canonical recipes

These recipes are intentionally compact and copy-pastable.

### 1. Theme preference with cross-tab sync

```tsx
import { defineMnemonicKey, useMnemonicKey } from "react-mnemonic";

export const themeKey = defineMnemonicKey("theme", {
    defaultValue: "light" as "light" | "dark",
    listenCrossTab: true,
});

export function ThemeToggle() {
    const { value: theme, set } = useMnemonicKey(themeKey);

    return <button onClick={() => set(theme === "light" ? "dark" : "light")}>Theme: {theme}</button>;
}
```

Use when:

- the value should survive reload
- multiple components should share one contract
- other tabs should stay in sync

### 2. Saved filters with durable clear intent

```tsx
import { useMnemonicKey } from "react-mnemonic";

type Filters = {
    status: "all" | "open" | "closed";
    assignee: string | null;
};

export function FilterBar() {
    const {
        value: filters,
        set,
        reset,
        remove,
    } = useMnemonicKey<Filters>("issue-filters", {
        defaultValue: {
            status: "all",
            assignee: null,
        },
    });

    return (
        <>
            <button onClick={() => set((prev) => ({ ...prev, status: "open" }))}>Open only</button>
            <button onClick={() => set((prev) => ({ ...prev, assignee: null }))}>Clear assignee</button>
            <button onClick={() => reset()}>Restore default filters</button>
            <button onClick={() => remove()}>Forget filter history</button>
            <pre>{JSON.stringify(filters, null, 2)}</pre>
        </>
    );
}
```

Use `null` inside the persisted object when “cleared” should survive reload.

### 3. Dismissible announcement UI

```tsx
import { useMnemonicKey } from "react-mnemonic";

export function ReleaseBanner() {
    const {
        value: dismissed,
        set,
        remove,
    } = useMnemonicKey("release-banner-dismissed", {
        defaultValue: false,
    });

    if (dismissed) {
        return <button onClick={() => remove()}>Show banner again</button>;
    }

    return (
        <div>
            <p>We shipped a new migration helper.</p>
            <button onClick={() => set(true)}>Dismiss</button>
        </div>
    );
}
```

Use `set(true)` when the dismissal itself is the durable user preference. Use
`remove()` only when you want to forget that dismissal and return to first-load
defaults.

### 4. Durable draft content with ephemeral form metadata

```tsx
import { useState } from "react";
import { useMnemonicKey } from "react-mnemonic";

export function DraftEditor() {
    const {
        value: body,
        set,
        remove,
    } = useMnemonicKey("compose-draft", {
        defaultValue: "",
    });
    const [isDirty, setIsDirty] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    return (
        <>
            <textarea
                value={body}
                onChange={(e) => {
                    const next = e.target.value;
                    set(next);
                    setIsDirty(true);
                    setValidationError(next.length > 500 ? "Draft is too long" : null);
                }}
            />
            <button onClick={() => remove()}>Discard draft</button>
            <p>Dirty: {String(isDirty)}</p>
            <p>Error: {validationError ?? "none"}</p>
        </>
    );
}
```

Persist the authored draft. Keep runtime metadata like `isDirty` and
`validationError` in plain React state.

### 5. Schema upgrade with migration plus reconciliation

```tsx
import {
    MnemonicProvider,
    createSchemaRegistry,
    defineKeySchema,
    defineMigration,
    mnemonicSchema,
    useMnemonicKey,
} from "react-mnemonic";

const profileV1 = defineKeySchema(
    "profile",
    1,
    mnemonicSchema.object({
        name: mnemonicSchema.string(),
    }),
);

const profileV2 = defineKeySchema(
    "profile",
    2,
    mnemonicSchema.object({
        name: mnemonicSchema.string(),
        email: mnemonicSchema.string(),
        marketingOptIn: mnemonicSchema.boolean(),
    }),
);

const registry = createSchemaRegistry({
    schemas: [profileV1, profileV2],
    migrations: [
        defineMigration(profileV1, profileV2, (value) => ({
            ...(value as { name: string }),
            email: "",
            marketingOptIn: false,
        })),
    ],
});

function ProfileEditor() {
    const { value, set } = useMnemonicKey("profile", {
        defaultValue: {
            name: "",
            email: "",
            marketingOptIn: true,
        },
        reconcile: (persisted, { persistedVersion, latestVersion }) => ({
            ...persisted,
            marketingOptIn: persistedVersion < (latestVersion ?? persistedVersion) ? true : persisted.marketingOptIn,
        }),
    });

    return <button onClick={() => set({ ...value, email: "hello@example.com" })}>Save</button>;
}

export function App() {
    return (
        <MnemonicProvider namespace="app" schemaMode="default" schemaRegistry={registry}>
            <ProfileEditor />
        </MnemonicProvider>
    );
}
```

Migration handles the structural version change. `reconcile(...)` handles the
conditional policy decision.

### 6. SSR placeholder for theme

```tsx
import { useMnemonicKey } from "react-mnemonic";

export function ThemeLabel({ serverTheme }: { serverTheme: "light" | "dark" | "system" }) {
    const { value } = useMnemonicKey("theme", {
        defaultValue: "light" as "light" | "dark" | "system",
        ssr: {
            serverValue: serverTheme,
            hydration: "client-only",
        },
    });

    return <span>{value}</span>;
}
```

Use this when:

- the server already knows a placeholder value
- you want the server markup and hydration markup to match
- local persisted storage should not win until after mount

## What not to persist

Avoid persisting values when rehydration would be surprising or incorrect:

- hover, focus, drag, selection, or expansion state
- loading flags, optimistic mutation state, retry counters
- validation errors, dirty flags, and submit-in-progress markers
- transient search text that should disappear when the user reloads
- server cache metadata unless the app explicitly wants to restore it

When in doubt, split state into:

- a persisted durable slice handled by `useMnemonicKey(...)`
- an ephemeral runtime slice handled by `useState(...)`

## Fast implementation rules

- Prefer `defineMnemonicKey(...)` when the same key appears in more than one place.
- Prefer nullable persisted fields over `remove()` when “cleared” is a real durable state.
- Prefer migrations for structural compatibility.
- Prefer `reconcile(...)` for conditional read-time policy enforcement.
- Prefer the smallest durable slice first; grow persistence only when reload behavior is clearly desirable.

## Related guides

- [Canonical Key Definitions](/docs/guides/canonical-key-definitions)
- [Clearable Persisted Values](/docs/guides/clearable-persisted-values)
- [Persisted vs Ephemeral State](/docs/guides/persisted-vs-ephemeral-state)
- [Schema Migration](/docs/guides/schema-migration)
- [Server Rendering](/docs/guides/server-rendering)
