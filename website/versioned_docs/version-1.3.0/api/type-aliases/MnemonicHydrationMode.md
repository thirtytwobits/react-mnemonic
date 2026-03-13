# Type Alias: MnemonicHydrationMode

> **MnemonicHydrationMode** = `"immediate"` \| `"client-only"`

Defined in: [src/Mnemonic/types.ts:246](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L246)

Controls when a hook should read persisted storage during client rendering.

- `"immediate"` — Default. The server snapshot is used during SSR/hydration,
  and the hook reads persisted storage as soon as React switches to the
  client snapshot.

- `"client-only"` — Defers all storage reads until after the component has
  mounted on the client. This is useful when you want a deterministic server
  placeholder and prefer the persisted value to appear only after hydration
  completes.
