---
sidebar_position: 2
title: Quick Start
description: Get running with react-mnemonic in under a minute.
---

# Quick Start

Wrap your app in a `MnemonicProvider`, then call `useMnemonicKey` anywhere
inside it.

```tsx title="App.tsx"
import { MnemonicProvider, useMnemonicKey } from "react-mnemonic/core";

function Counter() {
    const { value: count, set } = useMnemonicKey("count", {
        defaultValue: 0,
    });

    return (
        <div>
            <p>Count: {count}</p>
            <button onClick={() => set((c) => c + 1)}>Increment</button>
        </div>
    );
}

export default function App() {
    return (
        <MnemonicProvider namespace="my-app">
            <Counter />
        </MnemonicProvider>
    );
}
```

The counter value persists in `localStorage` under the key `my-app.count` and
survives full page reloads.

Use `react-mnemonic/core` for the lean persisted-state path. If you need JSON
Schema validation, autoschema, or migrations, import from
`react-mnemonic/schema` or the backward-compatible root `react-mnemonic`
entrypoint instead.

In server-rendered apps, the default contract is: render `defaultValue` on the
server, then hydrate to persisted storage on the client. When you need a
deterministic server placeholder or want to defer storage reads until after
mount, see [Server Rendering](../guides/server-rendering).

If that same key needs to appear in multiple components, define it once with
`defineMnemonicKey(...)` and reuse the descriptor. See
[Canonical Key Definitions](../guides/canonical-key-definitions) for the
pattern.

If you want runtime schemas and TypeScript types to come from the same source,
see [Single Source of Truth Schemas](../guides/single-source-of-truth-schemas).

If you want a deterministic implementation guide with invariants, decision
tables, and copy-pastable recipes, see
[AI Overview](../ai).

If you want an external third-party signal for AI coding tools and
documentation sources, see
[Context7 Rankings](../guides/context7-rankings).

Persist only values you want to restore intentionally. Runtime-only UI state
like loading flags, open panels, and draft search text should usually stay in
plain React state instead of the persisted key.

## How it works

1. **`<MnemonicProvider>`** creates a namespaced storage scope. All keys written
   by hooks inside the provider are prefixed with `my-app.` to prevent
   collisions with other providers or libraries.

2. **`useMnemonicKey`** reads the current value from storage (or returns
   `defaultValue` if the key doesn't exist), and returns a `set` function that
   writes back to storage _and_ triggers a React re-render.

3. The value is stored as a **versioned envelope** — a JSON wrapper that tracks
   the schema version. This powers [schema migration](../guides/schema-migration)
   when you upgrade your data shape later.

## The return object

```ts
const { value, set, reset, remove } = useMnemonicKey<T>(key, options);
```

| Property | Type                                 | Description                                   |
| -------- | ------------------------------------ | --------------------------------------------- |
| `value`  | `T`                                  | Current decoded value (or default)            |
| `set`    | `(next: T \| (cur: T) => T) => void` | Update the value (direct or updater function) |
| `reset`  | `() => void`                         | Reset to `defaultValue` and persist it        |
| `remove` | `() => void`                         | Delete the key from storage entirely          |

## Next steps

- [Schema Modes](../guides/schema-modes) — add validation and versioning
- [Schema Migration](../guides/schema-migration) — version data and learn when to use `reconcile`
- [AI Overview](../ai) — the canonical AI-oriented entry point for invariants, decision tables, recipes, and setup
- [AI Assistant Setup](../ai/assistant-setup) — expose the docs through `llms.txt`, DeepWiki, and MCP-friendly retrieval
- [Context7 Rankings](../guides/context7-rankings) — external rankings and usage data from Context7
- [Canonical Key Definitions](../guides/canonical-key-definitions) — define reusable key contracts once
- [Single Source of Truth Schemas](../guides/single-source-of-truth-schemas) — keep runtime schemas and TS types aligned
- [Clearable Persisted Values](../guides/clearable-persisted-values) — model durable clear intent with nullable keys
- [Shopping Cart Persistence](../guides/shopping-cart-persistence) — persist canonical cart lines while deriving totals and keeping clear semantics explicit
- [Auth-Aware Persistence](../guides/auth-aware-persistence) — scope safe persisted state to authenticated users and clean it up on logout or expiry
- [Multi-Step Form Wizards](../guides/multi-step-form-wizards) — persist cross-step drafts without storing transient wizard UI state
- [Persisted vs Ephemeral State](../guides/persisted-vs-ephemeral-state) — keep durable preferences and runtime-only UI state separate
- [Reset and Recovery](../guides/reset-and-recovery) — add soft reset and hard reset flows for persisted state
- [Server Rendering](../guides/server-rendering) — control server placeholders and hydration timing in Next.js or Remix
- [Custom Codecs](../guides/custom-codecs) — serialize `Date`, `Set`, `Map`, etc.
- [Cross-Tab Sync](../guides/cross-tab-sync) — keep tabs in sync
- [API Reference](../api) — full TypeDoc-generated API docs
