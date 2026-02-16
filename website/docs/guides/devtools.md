---
sidebar_position: 7
title: DevTools
description: Inspect and mutate persistent state from the browser console.
---

# DevTools

Mnemonic provides a built-in console inspector for debugging persistent state
during development.

## Enabling DevTools

```tsx
<MnemonicProvider
  namespace="app"
  enableDevTools={process.env.NODE_ENV === "development"}
>
  <App />
</MnemonicProvider>
```

When enabled, the provider registers a helper object on `window` under the
`__REACT_MNEMONIC_DEVTOOLS__` namespace.

## Console API

```js
// List all keys in the namespace
__REACT_MNEMONIC_DEVTOOLS__.app.keys();

// Dump a table of all key-value pairs
__REACT_MNEMONIC_DEVTOOLS__.app.dump();

// Read a decoded value
__REACT_MNEMONIC_DEVTOOLS__.app.get("theme");

// Write a value
__REACT_MNEMONIC_DEVTOOLS__.app.set("theme", "dark");

// Delete a key
__REACT_MNEMONIC_DEVTOOLS__.app.remove("theme");

// Remove all keys in the namespace
__REACT_MNEMONIC_DEVTOOLS__.app.clear();
```

## Multiple providers

If your app uses multiple providers, each one registers under its own namespace:

```js
__REACT_MNEMONIC_DEVTOOLS__.app.dump();
__REACT_MNEMONIC_DEVTOOLS__.settings.dump();
```

:::tip
Leave `enableDevTools` off in production to avoid polluting `window` and
leaking internal state.
:::
