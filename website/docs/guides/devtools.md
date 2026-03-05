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
<MnemonicProvider namespace="app" enableDevTools={process.env.NODE_ENV === "development"}>
    <App />
</MnemonicProvider>
```

When enabled, the provider registers a helper object on `window` under the
`__REACT_MNEMONIC_DEVTOOLS__` namespace.

## Browser extension integration

The `react-mnemonic` DevTools extension uses
`window.__REACT_MNEMONIC_DEVTOOLS__` as its required runtime signal.

- If a compatible devtools registry is present, the extension treats the page
  as Mnemonic-enabled.
- If it is missing, the extension reports that the site is either not using
  `react-mnemonic` or has `enableDevTools` disabled.
- On restricted browser pages (for example `chrome://*`), the extension reports
  that access is blocked.

In short: enabling `enableDevTools` also enables extension detection and
inspection.

When enabled, Mnemonic also maintains extension metadata at
`window.__REACT_MNEMONIC_DEVTOOLS__.__meta`:

- `version`: incremented on Mnemonic state changes
- `lastUpdated`: timestamp of the most recent change

The extension uses this metadata for low-cost polling. In the panel UI, polling
can be turned on or off with the **Auto-refresh** toggle.

The registry also exposes runtime capability flags at
`window.__REACT_MNEMONIC_DEVTOOLS__.capabilities`.

## Console API

```js
// Inspect registry capabilities
__REACT_MNEMONIC_DEVTOOLS__.capabilities;

// List providers and availability
__REACT_MNEMONIC_DEVTOOLS__.list();

// Strengthen provider reference for a namespace
const app = __REACT_MNEMONIC_DEVTOOLS__.resolve("app");

// List all keys in the namespace
app?.keys();

// Dump a table of all key-value pairs
app?.dump();

// Read a decoded value
app?.get("theme");

// Write a value
app?.set("theme", "dark");

// Delete a key
app?.remove("theme");

// Remove all keys in the namespace
app?.clear();
```

## Multiple providers

If your app uses multiple providers, each one registers as a weak entry in the
global registry:

```js
const providers = __REACT_MNEMONIC_DEVTOOLS__.list();
for (const provider of providers) {
  const api = __REACT_MNEMONIC_DEVTOOLS__.resolve(provider.namespace);
  console.log(provider.namespace, provider.available, api?.dump());
}
```

If `resolve(namespace)` returns `null`, that provider is no longer available
(for example, it was unmounted and garbage-collected).

:::tip
Leave `enableDevTools` off in production to avoid polluting `window` and
leaking internal state.
:::
