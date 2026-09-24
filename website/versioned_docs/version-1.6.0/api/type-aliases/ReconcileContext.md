# Type Alias: ReconcileContext

> **ReconcileContext** = `object`

Defined in: [src/Mnemonic/types.ts:1848](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1848)

Metadata passed to `UseMnemonicKeyOptions.reconcile`.

## Properties

### key

> **key**: `string`

Defined in: [src/Mnemonic/types.ts:1852](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1852)

The unprefixed storage key being reconciled.

---

### latestVersion?

> `optional` **latestVersion**: `number`

Defined in: [src/Mnemonic/types.ts:1862](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1862)

The latest registered schema version for the key, when available.

---

### persistedVersion

> **persistedVersion**: `number`

Defined in: [src/Mnemonic/types.ts:1857](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1857)

The version found in the persisted envelope that was read.
