# Type Alias: SchemaBoundKeyOptions\<T\>

> **SchemaBoundKeyOptions**\<`T`\> = `Omit`\<[`UseMnemonicKeyOptions`](UseMnemonicKeyOptions.md)\<`T`\>, `"schema"`\>

Defined in: [src/Mnemonic/types.ts:1322](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1322)

Key descriptor options inferred from a typed key schema.

This mirrors `UseMnemonicKeyOptions<T>` but intentionally omits the `schema`
override so the descriptor stays pinned to the supplied key schema version.

## Type Parameters

| Type Parameter |
| -------------- |
| `T`            |
