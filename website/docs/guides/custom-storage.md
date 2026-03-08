---
sidebar_position: 5
title: Custom Storage
description: Use sessionStorage or a synchronous facade over custom persistence.
---

# Custom Storage

Mnemonic defaults to `localStorage` but accepts any backend that implements the
`StorageLike` interface.

## Architecture note: `StorageLike` is sync-only

`StorageLike` is intentionally synchronous in v1. Mnemonic reads storage
through React's synchronous snapshot contract, so `getItem`, `setItem`, and
`removeItem` must all finish immediately.

That means AsyncStorage-style adapters are not a drop-in fit for this surface.
If your real persistence layer is async, wrap it behind a synchronous in-memory
cache and let that cache satisfy `StorageLike`. Promise-returning methods are
unsupported and are treated as a runtime contract violation.

## The `StorageLike` interface

```ts
interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    key?(index: number): string | null;
    readonly length?: number;
    onExternalChange?: (callback: (changedKeys?: string[]) => void) => () => void;
}
```

Only `getItem`, `setItem`, and `removeItem` are required. The optional
properties enable additional features:

| Property           | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `key(index)`       | Enables DevTools key enumeration             |
| `length`           | Enables DevTools key enumeration             |
| `onExternalChange` | Cross-tab sync for non-localStorage backends |

## Example: IndexedDB with BroadcastChannel

```tsx
import { MnemonicProvider } from "react-mnemonic";
import type { StorageLike } from "react-mnemonic";

const idbStorage: StorageLike = {
    getItem: (key) => {
        // synchronous read from an in-memory cache
        // populated from IndexedDB on startup
        return cache.get(key) ?? null;
    },
    setItem: (key, value) => {
        cache.set(key, value);
        // async write to IDB in background
        idb.put("store", value, key);
    },
    removeItem: (key) => {
        cache.delete(key);
        idb.delete("store", key);
    },
    onExternalChange: (cb) => {
        const bc = new BroadcastChannel("my-app-sync");
        bc.onmessage = (e) => cb(e.data.keys);
        return () => bc.close();
    },
};

function App() {
    return (
        <MnemonicProvider namespace="my-app" storage={idbStorage}>
            {/* components */}
        </MnemonicProvider>
    );
}
```

This pattern keeps the hook contract synchronous while still letting IndexedDB
handle durability in the background.

## `sessionStorage`

For session-scoped persistence, just pass `sessionStorage`:

```tsx
<MnemonicProvider namespace="session" storage={sessionStorage}>
    <App />
</MnemonicProvider>
```

## Error handling

The library handles all storage errors internally — failures are logged but
never thrown to your components. See the `StorageLike` JSDoc for the full
error-handling contract.
