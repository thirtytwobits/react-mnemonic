---
title: Optional Persistence
description: Build component libraries that persist when a provider exists and fall back to in-memory state when it does not.
---

# Optional Persistence

Component libraries do not always control whether an application has mounted a
`MnemonicProvider`. The lean optional entrypoint lets those components keep one
API: persist when a provider is available, or quietly use in-memory state when
it is not.

## When to use this

Reach for optional persistence when all of these are true:

- the component may be used by apps that do not mount `MnemonicProvider`
- you want one hook call instead of provider-detection logic at every call site
- restoring the value is helpful when available, but not required for correctness

Use the regular `useMnemonicKey(...)` contract instead when a provider is a hard
requirement and missing durable state should be treated as a setup mistake.

## Pick the right entrypoint

| Entrypoint                 | Estimated size | Use when                                                                 |
| -------------------------- | -------------- | ------------------------------------------------------------------------ |
| `react-mnemonic/optional`  | ~5.2 KB        | You want the tiny component-library shim that falls back to local memory |
| `react-mnemonic/bootstrap` | ~24.5 KB       | You need synchronous first-paint recall before React renders             |
| `react-mnemonic/core`      | ~65.3 KB       | A provider is required and you want the lean persisted-state path        |
| `react-mnemonic/schema`    | ~84.6 KB       | A provider is required and you want schema validation and migrations     |
| `react-mnemonic`           | ~84.6 KB       | You want the top-level full entrypoint                                   |

These are rough current estimates based on the built ESM entry files in
`dist/` before consumer-side minification and tree-shaking. They are useful for
relative comparison, not as a hard size guarantee.

## Lean optional entrypoint

Use `react-mnemonic/optional` when you want the tiny fallback-first behavior:

```tsx
import { useMnemonicKeyOptional } from "react-mnemonic/optional";

export function FilterChip() {
    const { value, set, remove } = useMnemonicKeyOptional("selected", {
        defaultValue: false,
    });

    return <button onClick={() => (value ? remove() : set(true))}>{value ? "Selected" : "Not selected"}</button>;
}
```

- Inside `MnemonicProvider`: values persist normally through the provider-backed bridge.
- Outside `MnemonicProvider`: the hook behaves like local component memory.

That means:

- `set(next)` updates local state only when no provider exists
- `reset()` restores `defaultValue` in memory
- `remove()` forgets the current in-memory value so the hook shows the fallback/default again
- `onMount` and `onChange` still run
- codecs and schema metadata are inert without a provider

The lean entrypoint exports only:

- `useMnemonicKeyOptional(...)`
- `useMnemonicOptional()`
- `defineMnemonicKey(...)`

## App-side usage

The same component can opt into persistence automatically when an app wraps it
with a provider:

```tsx
import { MnemonicProvider } from "react-mnemonic/core";
import { SearchBox } from "@acme/search-ui";

export function App() {
    return (
        <MnemonicProvider namespace="search">
            <SearchBox />
        </MnemonicProvider>
    );
}
```

Inside this boundary, `useMnemonicKeyOptional("search-draft", ...)` will persist
to the provider namespace just like `useMnemonicKey(...)`.

## Schema-capable apps

Optional components can still participate in schema validation and migrations
whenever the application mounts a schema-capable provider:

```tsx
import { useMnemonicKeyOptional } from "react-mnemonic/optional";
import { MnemonicProvider } from "react-mnemonic/schema";

export function DensityPicker() {
    const { value, set } = useMnemonicKeyOptional("settings", {
        defaultValue: { density: "comfortable" as const },
        schema: { version: 2 },
    });

    return (
        <button
            onClick={() =>
                set({
                    density: value.density === "comfortable" ? "compact" : "comfortable",
                })
            }
        >
            Density: {value.density}
        </button>
    );
}
```

Without a provider, schema-specific persistence concerns are inert because no
storage is being read or written.

## Behavior matrix

| Hook                          | With provider                                     | Without provider                                 |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| `useMnemonicKeyOptional(...)` | Normal persisted Mnemonic behavior through bridge | Local in-memory state with the same return shape |
| `useMnemonicOptional()`       | Bridge metadata: namespace and capabilities       | `null`                                           |

## Low-level optional hooks

- `useMnemonicOptional()` returns `null` without a provider.
- Inside a provider, it returns lightweight bridge metadata:
  `namespace` plus `capabilities.persistence` and `capabilities.schema`.

## Important caveats

- The no-provider fallback is local memory, not durable storage.
- The fallback state is not shared across unrelated component trees or browser tabs.
- Lean optional hooks do not expose raw store helpers or recovery helpers.
- Advanced persistence features such as reconciliation and cross-tab controls remain on the required-provider entrypoints.
- If persistence is required for product correctness, do not use the optional hooks.
