# Quick Rules For AI Agents

Follow these rules when using `react-mnemonic` in generated code.

## Hard rules

1. Import values and types from the published package root:
   - `import { MnemonicProvider, useMnemonicKey } from "react-mnemonic"`
   - `import type { StorageLike, UseMnemonicKeyOptions } from "react-mnemonic"`
2. Do not create local `.d.ts` files for `react-mnemonic`.
3. Do not write `declare module "react-mnemonic"` or any other ambient module
   shim for the package.
4. Do not import from `dist/*` or private internal module paths.
5. If a type seems missing, inspect the package exports and API docs first
   instead of inventing a replacement contract.

## Persistence rules

1. Persist only state that should survive reload.
2. Use `set(null)` for durable clear intent.
3. Use `remove()` to forget the key entirely.
4. Use `reset()` to persist `defaultValue` again.
5. Use schema migrations for structural upgrades and `reconcile(...)` for
   read-time policy refreshes.

## SSR rules

1. Server rendering uses `defaultValue` unless `ssr.serverValue` is set.
2. Use `ssr.hydration: "client-only"` when persisted browser reads should wait
   until after mount.

## Cross-tab rule

1. When the prompt explicitly requires multi-tab sync, opt into
   `listenCrossTab: true` on the persisted key.
