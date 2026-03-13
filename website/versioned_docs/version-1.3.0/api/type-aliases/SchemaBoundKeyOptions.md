# Type Alias: SchemaBoundKeyOptions\<T\>

> **SchemaBoundKeyOptions**\<`T`\> = `Omit`\<[`UseMnemonicKeyOptions`](UseMnemonicKeyOptions.md)\<`T`\>, `"schema"`\>

Defined in: [src/Mnemonic/types.ts:1246](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1246)

Key descriptor options inferred from a typed key schema.

This mirrors `UseMnemonicKeyOptions<T>` but intentionally omits the `schema`
override so the descriptor stays pinned to the supplied key schema version.

## Type Parameters

| Type Parameter |
| -------------- |
| `T`            |
