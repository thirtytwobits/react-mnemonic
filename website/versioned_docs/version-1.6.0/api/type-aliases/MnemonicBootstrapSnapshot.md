# Type Alias: MnemonicBootstrapSnapshot\<TValues\>

> **MnemonicBootstrapSnapshot**\<`TValues`\> = `object`

Defined in: [src/Mnemonic/types.ts:387](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L387)

Fully populated snapshot returned by `recallMnemonic(...)`.

## Type Parameters

| Type Parameter                                      | Default type                    | Description                                    |
| --------------------------------------------------- | ------------------------------- | ---------------------------------------------- |
| `TValues` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`string`, `unknown`\> | Decoded values keyed by unprefixed storage key |

## Properties

### raw

> **raw**: `Record`\<`string`, `string` \| `null`\>

Defined in: [src/Mnemonic/types.ts:396](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L396)

Raw storage strings keyed by the unprefixed mnemonic key name.

Keys are only included when the bootstrap read successfully observed the
underlying storage backend. A present `null` still means the key was
confirmed absent at recall time, though providers may revalidate that
absence before the first hook read.

---

### values

> **values**: `TValues`

Defined in: [src/Mnemonic/types.ts:401](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L401)

Decoded values keyed by the unprefixed mnemonic key name.
