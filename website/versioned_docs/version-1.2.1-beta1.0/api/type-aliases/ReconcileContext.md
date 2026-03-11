# Type Alias: ReconcileContext

> **ReconcileContext** = `object`

Defined in: [src/Mnemonic/types.ts:1412](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L1412)

Metadata passed to `UseMnemonicKeyOptions.reconcile`.

## Properties

### key

> **key**: `string`

Defined in: [src/Mnemonic/types.ts:1416](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L1416)

The unprefixed storage key being reconciled.

---

### latestVersion?

> `optional` **latestVersion**: `number`

Defined in: [src/Mnemonic/types.ts:1426](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L1426)

The latest registered schema version for the key, when available.

---

### persistedVersion

> **persistedVersion**: `number`

Defined in: [src/Mnemonic/types.ts:1421](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L1421)

The version found in the persisted envelope that was read.
