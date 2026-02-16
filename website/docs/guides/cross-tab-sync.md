---
sidebar_position: 6
title: Cross-Tab Sync
description: Keep state synchronized across browser tabs.
---

# Cross-Tab Sync

Mnemonic can synchronize state changes across open browser tabs so that a write
in one tab is reflected in every other tab that reads the same key.

## Using `localStorage` (built-in)

For `localStorage` backends, enable cross-tab sync with `listenCrossTab`:

```tsx
const { value: theme, set } = useMnemonicKey<"light" | "dark">("theme", {
    defaultValue: "light",
    listenCrossTab: true,
    onChange: (t) => {
        document.documentElement.setAttribute("data-theme", t);
    },
});
```

Under the hood this uses the browser's native `storage` event, which fires in
all tabs **except** the one that made the change. Changes within the same tab
are synchronized automatically via React's state management.

## Custom backends

For non-localStorage backends (e.g., IndexedDB), implement `onExternalChange`
on your `StorageLike`:

```ts
const idbStorage: StorageLike = {
    // ... getItem, setItem, removeItem ...
    onExternalChange: (cb) => {
        const bc = new BroadcastChannel("my-app-sync");
        bc.onmessage = (e) => cb(e.data.keys);
        return () => bc.close();
    },
};
```

The callback accepts an optional array of changed key names. If omitted, all
subscribed hooks re-read their values.
