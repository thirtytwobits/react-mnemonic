# Type Alias: MnemonicHydrationMode

> **MnemonicHydrationMode** = `"immediate"` \| `"client-only"`

Defined in: [src/Mnemonic/types.ts:328](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L328)

Controls when a hook should read persisted storage during client rendering.

- `"immediate"` — Default. The server snapshot is used during SSR/hydration,
  and the hook reads persisted storage as soon as React switches to the
  client snapshot.

- `"client-only"` — Defers all storage reads until after the component has
  mounted on the client. This is useful when you want a deterministic server
  placeholder and prefer the persisted value to appear only after hydration
  completes.
