# Type Alias: MnemonicStorageErrorReason

> **MnemonicStorageErrorReason** = `"quota"` \| `"access"` \| `"schema"` \| `"codec"` \| `"contract"` \| `"unknown"`

Defined in: [src/Mnemonic/types.ts:1008](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1008)

Why a mutation never reached the storage backend.

- `"quota"` — The backend threw `QuotaExceededError`. Storage is full.
- `"access"` — The backend threw for another reason (`SecurityError` from a
  blocked origin, a disk error from a custom backend), or there is no usable
  backend at all. `error` is `undefined` in the no-backend case, because
  nothing was thrown.
- `"schema"` — The value failed JSON Schema validation, so it was never
  offered to the backend. `error` is a `SchemaError`.
- `"codec"` — The value could not be encoded to a string. `error` is a
  `CodecError`.
- `"contract"` — The backend broke the synchronous `StorageLike` contract by
  returning a thenable. Writes stay disabled for the rest of the provider's
  life, so every later mutation reports this reason. `error` is `undefined`;
  a contract violation is a broken backend, not a thrown error.
- `"unknown"` — The write failed for a reason the library does not classify.
  Rare; treat it the same as `"access"` for user-facing purposes.

## See

[MnemonicStorageErrorEvent](../interfaces/MnemonicStorageErrorEvent.md) - Event carrying this reason
