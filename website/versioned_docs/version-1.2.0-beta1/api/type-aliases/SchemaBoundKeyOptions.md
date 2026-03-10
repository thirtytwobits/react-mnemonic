# Type Alias: SchemaBoundKeyOptions\<T\>

> **SchemaBoundKeyOptions**\<`T`\> = `Omit`\<[`UseMnemonicKeyOptions`](UseMnemonicKeyOptions.md)\<`T`\>, `"schema"`\>

Defined in: [src/Mnemonic/types.ts:1148](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L1148)

Key descriptor options inferred from a typed key schema.

This mirrors `UseMnemonicKeyOptions<T>` but intentionally omits the `schema`
override so the descriptor stays pinned to the supplied key schema version.

## Type Parameters

| Type Parameter |
| -------------- |
| `T`            |
