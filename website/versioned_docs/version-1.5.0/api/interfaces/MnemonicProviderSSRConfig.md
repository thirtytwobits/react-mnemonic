# Interface: MnemonicProviderSSRConfig

Defined in: [src/Mnemonic/types.ts:265](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L265)

Provider-level SSR defaults shared by descendant hooks.

## Properties

### hydration?

> `optional` **hydration**: [`MnemonicHydrationMode`](../type-aliases/MnemonicHydrationMode.md)

Defined in: [src/Mnemonic/types.ts:271](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L271)

Default hydration strategy for descendant `useMnemonicKey(...)` hooks.

#### Default

```ts
"immediate";
```
