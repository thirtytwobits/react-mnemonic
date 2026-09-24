# Type Alias: SchemaBoundKeyOptions\<T\>

> **SchemaBoundKeyOptions**\<`T`\> = `Omit`\<[`UseMnemonicKeyOptions`](UseMnemonicKeyOptions.md)\<`T`\>, `"schema"`\>

Defined in: [src/Mnemonic/types.ts:1584](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1584)

Key descriptor options inferred from a typed key schema.

This mirrors `UseMnemonicKeyOptions<T>` but intentionally omits the `schema`
override so the descriptor stays pinned to the supplied key schema version.

## Type Parameters

| Type Parameter |
| -------------- |
| `T`            |
