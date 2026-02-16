---
sidebar_position: 5
title: Custom Storage
description: Plug in IndexedDB, sessionStorage, or any storage backend.
---

# Custom Storage

Mnemonic defaults to `localStorage` but accepts any backend that implements the
`StorageLike` interface.

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

| Property           | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `key(index)`       | Enables DevTools key enumeration                  |
| `length`           | Enables DevTools key enumeration                  |
| `onExternalChange` | Cross-tab sync for non-localStorage backends      |

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
