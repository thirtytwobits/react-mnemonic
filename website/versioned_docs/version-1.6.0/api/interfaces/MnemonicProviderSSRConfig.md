# Interface: MnemonicProviderSSRConfig

Defined in: [src/Mnemonic/types.ts:333](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L333)

Provider-level SSR defaults shared by descendant hooks.

## Properties

### hydration?

> `optional` **hydration**: [`MnemonicHydrationMode`](../type-aliases/MnemonicHydrationMode.md)

Defined in: [src/Mnemonic/types.ts:339](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L339)

Default hydration strategy for descendant `useMnemonicKey(...)` hooks.

#### Default

```ts
"immediate";
```
