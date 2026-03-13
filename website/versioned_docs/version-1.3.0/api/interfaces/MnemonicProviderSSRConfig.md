# Interface: MnemonicProviderSSRConfig

Defined in: [src/Mnemonic/types.ts:251](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L251)

Provider-level SSR defaults shared by descendant hooks.

## Properties

### hydration?

> `optional` **hydration**: [`MnemonicHydrationMode`](../type-aliases/MnemonicHydrationMode.md)

Defined in: [src/Mnemonic/types.ts:257](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L257)

Default hydration strategy for descendant `useMnemonicKey(...)` hooks.

#### Default

```ts
"immediate";
```
