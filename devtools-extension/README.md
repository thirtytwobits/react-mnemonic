# react-mnemonic DevTools Extension

Starter Chrome DevTools extension for `react-mnemonic`.

## Detection requirement

This extension requires the inspected page to expose:

`window.__REACT_MNEMONIC_DEVTOOLS__`

That object is registered by `MnemonicProvider` when `enableDevTools` is set.
If `enableDevTools` is disabled (or `react-mnemonic` is not used), the popup
and panel will show a diagnostic message instead of storage data.

Restricted pages (`chrome://*`, extension pages, and other protected URLs) are
also detected and reported in the popup.

## Registry contract

The extension expects a registry-only devtools shape:

- `providers`: weak provider entries keyed by namespace
- `resolve(namespace)`: strengthen provider reference before usage
- `list()`: provider availability descriptors
- `capabilities`: runtime support flags (including `weakRef`)
- `__meta`: polling metadata (`version`, `lastUpdated`, `lastChange`)

The panel never reads providers directly from `providers`. It always calls
`resolve(namespace)` first, then uses provider APIs (`keys/get/set/remove/...`)
on the strengthened reference.

For live updates, the extension polls
`window.__REACT_MNEMONIC_DEVTOOLS__.__meta.version`. Polling is controlled by
the panel's **Auto-refresh** checkbox and can be disabled in the UI.

If a provider becomes unavailable (weak ref can no longer be strengthened), the
panel keeps the last captured snapshot and greys it out with an availability
warning.

## Quick start

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:

   `/Users/thirtytwobits/workspace/github/thirtytwobits/react-mnemonic/devtools-extension`

5. Open DevTools on any page and select the **react-mnemonic** tab.

## Build output (optional)

You can copy a distributable extension folder to `dist/`:

```bash
npm --prefix devtools-extension run build
```
