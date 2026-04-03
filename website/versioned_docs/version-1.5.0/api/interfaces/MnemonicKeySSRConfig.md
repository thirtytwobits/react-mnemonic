# Interface: MnemonicKeySSRConfig\<T\>

Defined in: [src/Mnemonic/types.ts:344](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L344)

Hook-level SSR controls for `useMnemonicKey(...)`.

Lets a key render a deterministic server snapshot and optionally delay
reading persisted storage until after client mount.

## Type Parameters

| Type Parameter | Description                        |
| -------------- | ---------------------------------- |
| `T`            | The decoded value type for the key |

## Properties

### hydration?

> `optional` **hydration**: [`MnemonicHydrationMode`](../type-aliases/MnemonicHydrationMode.md)

Defined in: [src/Mnemonic/types.ts:362](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L362)

Hydration strategy for this key.

When omitted, inherits the provider default.

---

### serverValue?

> `optional` **serverValue**: `T` \| () => `T`

Defined in: [src/Mnemonic/types.ts:355](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L355)

Value to expose during SSR and hydration instead of `defaultValue`.

This value is not persisted automatically. Once hydration completes,
the hook transitions to the stored value (if any) or back to
`defaultValue`.

Factory functions should be deterministic across server render and
client hydration to avoid markup mismatches.
