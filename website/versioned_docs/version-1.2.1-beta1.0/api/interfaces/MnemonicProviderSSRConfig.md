# Interface: MnemonicProviderSSRConfig

Defined in: [src/Mnemonic/types.ts:251](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L251)

Provider-level SSR defaults shared by descendant hooks.

## Properties

### hydration?

> `optional` **hydration**: [`MnemonicHydrationMode`](../type-aliases/MnemonicHydrationMode.md)

Defined in: [src/Mnemonic/types.ts:257](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L257)

Default hydration strategy for descendant `useMnemonicKey(...)` hooks.

#### Default

```ts
"immediate";
```
