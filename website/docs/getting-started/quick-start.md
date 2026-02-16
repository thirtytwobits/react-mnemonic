---
sidebar_position: 2
title: Quick Start
description: Get running with react-mnemonic in under a minute.
---

# Quick Start

Wrap your app in a `MnemonicProvider`, then call `useMnemonicKey` anywhere
inside it.

```tsx title="App.tsx"
import { MnemonicProvider, useMnemonicKey } from "react-mnemonic";

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

## How it works

1. **`<MnemonicProvider>`** creates a namespaced storage scope. All keys written
   by hooks inside the provider are prefixed with `my-app.` to prevent
   collisions with other providers or libraries.

2. **`useMnemonicKey`** reads the current value from storage (or returns
   `defaultValue` if the key doesn't exist), and returns a `set` function that
   writes back to storage _and_ triggers a React re-render.

3. The value is stored as a **versioned envelope** — a JSON wrapper that tracks
   the schema version. This powers [schema migration](/docs/guides/schema-migration)
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

- [Schema Modes](/docs/guides/schema-modes) — add validation and versioning
- [Custom Codecs](/docs/guides/custom-codecs) — serialize `Date`, `Set`, `Map`, etc.
- [Cross-Tab Sync](/docs/guides/cross-tab-sync) — keep tabs in sync
- [API Reference](/docs/api) — full TypeDoc-generated API docs
