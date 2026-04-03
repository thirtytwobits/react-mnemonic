# Type Alias: MnemonicBootstrapSnapshot\<TValues\>

> **MnemonicBootstrapSnapshot**\<`TValues`\> = `object`

Defined in: [src/Mnemonic/types.ts:319](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L319)

Fully populated snapshot returned by `recallMnemonic(...)`.

## Type Parameters

| Type Parameter                                      | Default type                    | Description                                    |
| --------------------------------------------------- | ------------------------------- | ---------------------------------------------- |
| `TValues` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`string`, `unknown`\> | Decoded values keyed by unprefixed storage key |

## Properties

### raw

> **raw**: `Record`\<`string`, `string` \| `null`\>

Defined in: [src/Mnemonic/types.ts:328](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L328)

Raw storage strings keyed by the unprefixed mnemonic key name.

Keys are only included when the bootstrap read successfully observed the
underlying storage backend. A present `null` still means the key was
confirmed absent at recall time, though providers may revalidate that
absence before the first hook read.

---

### values

> **values**: `TValues`

Defined in: [src/Mnemonic/types.ts:333](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L333)

Decoded values keyed by the unprefixed mnemonic key name.
