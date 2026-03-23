# Interface: MnemonicProviderSSRConfig

Defined in: [src/Mnemonic/types.ts:265](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L265)

Provider-level SSR defaults shared by descendant hooks.

## Properties

### hydration?

> `optional` **hydration**: [`MnemonicHydrationMode`](../type-aliases/MnemonicHydrationMode.md)

Defined in: [src/Mnemonic/types.ts:271](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L271)

Default hydration strategy for descendant `useMnemonicKey(...)` hooks.

#### Default

```ts
"immediate";
```
