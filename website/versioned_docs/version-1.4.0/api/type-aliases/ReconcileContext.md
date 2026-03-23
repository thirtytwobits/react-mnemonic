# Type Alias: ReconcileContext

> **ReconcileContext** = `object`

Defined in: [src/Mnemonic/types.ts:1586](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1586)

Metadata passed to `UseMnemonicKeyOptions.reconcile`.

## Properties

### key

> **key**: `string`

Defined in: [src/Mnemonic/types.ts:1590](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1590)

The unprefixed storage key being reconciled.

---

### latestVersion?

> `optional` **latestVersion**: `number`

Defined in: [src/Mnemonic/types.ts:1600](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1600)

The latest registered schema version for the key, when available.

---

### persistedVersion

> **persistedVersion**: `number`

Defined in: [src/Mnemonic/types.ts:1595](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1595)

The version found in the persisted envelope that was read.
