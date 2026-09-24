# Interface: MnemonicStorageErrorEvent

Defined in: [src/Mnemonic/types.ts:1035](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1035)

A mutation that did not reach storage.

Delivered to [MnemonicProviderOptions.onStorageError](MnemonicProviderOptions.md#onstorageerror). Every field
describes the mutation that was dropped, not the state of the store
afterwards.

## Remarks

What happened to the value depends on how far it got, which
[MnemonicStorageErrorEvent.reason](#reason) tells you:

- **Storage-layer drops** (`"quota"`, `"access"`, `"contract"`) — the value
  was valid and the cache now serves it, but the backend would not take it.
  The key is queued, so [Mnemonic.unpersistedKeys](../type-aliases/Mnemonic.md#unpersistedkeys) reports it and
  [Mnemonic.flush](../type-aliases/Mnemonic.md#flush) can retry it. This is worth telling the user about,
  and it is recoverable.
- **Pre-storage failures** (`"schema"`, `"codec"`, `"unknown"`) — the value
  was rejected before storage was ever called. The cache is unchanged, so
  the previous value still stands; nothing is queued, and there is nothing
  for `flush()` to retry. Retrying would fail identically, because the value
  itself is the problem. These are application bugs.

## See

- [MnemonicProviderOptions.onStorageError](MnemonicProviderOptions.md#onstorageerror) - Where this is delivered
- [Mnemonic.unpersistedKeys](../type-aliases/Mnemonic.md#unpersistedkeys) - What is currently outstanding

## Properties

### bytes?

> `optional` **bytes**: `number`

Defined in: [src/Mnemonic/types.ts:1072](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1072)

Approximate size of the value that could not be written.

Measured as UTF-16 code units times two, which is how browsers account
`localStorage` usage. Absent for removals and for `"schema"` / `"codec"`
failures, where no encoded value was ever produced. Custom backends that
store UTF-8 will see a different real size; treat this as a diagnostic
estimate rather than an exact byte count.

---

### error

> **error**: `unknown`

Defined in: [src/Mnemonic/types.ts:1061](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1061)

The underlying error, when there was one.

`undefined` when the failure had nothing to throw: no storage backend is
available, or writes are disabled after a `"contract"` violation.

---

### key

> **key**: `string`

Defined in: [src/Mnemonic/types.ts:1042](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1042)

Unprefixed key whose mutation was dropped.

This is the key as written in application code, without the namespace
prefix the storage backend sees.

---

### operation

> **operation**: `"set"` \| `"remove"`

Defined in: [src/Mnemonic/types.ts:1050](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1050)

Which kind of mutation was dropped.

`"remove"` covers `remove()` and any internal removal; everything else,
including `reset()`, reports `"set"`.

---

### reason

> **reason**: [`MnemonicStorageErrorReason`](../type-aliases/MnemonicStorageErrorReason.md)

Defined in: [src/Mnemonic/types.ts:1053](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1053)

Why the mutation did not reach storage.
