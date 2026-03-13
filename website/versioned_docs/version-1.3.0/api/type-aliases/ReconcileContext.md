# Type Alias: ReconcileContext

> **ReconcileContext** = `object`

Defined in: [src/Mnemonic/types.ts:1510](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1510)

Metadata passed to `UseMnemonicKeyOptions.reconcile`.

## Properties

### key

> **key**: `string`

Defined in: [src/Mnemonic/types.ts:1514](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1514)

The unprefixed storage key being reconciled.

---

### latestVersion?

> `optional` **latestVersion**: `number`

Defined in: [src/Mnemonic/types.ts:1524](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1524)

The latest registered schema version for the key, when available.

---

### persistedVersion

> **persistedVersion**: `number`

Defined in: [src/Mnemonic/types.ts:1519](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1519)

The version found in the persisted envelope that was read.
