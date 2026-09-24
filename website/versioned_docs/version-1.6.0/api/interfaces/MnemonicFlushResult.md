# Interface: MnemonicFlushResult

Defined in: [src/Mnemonic/types.ts:1082](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1082)

Outcome of a flush of previously unpersisted writes.

Returned by [Mnemonic.flush](../type-aliases/Mnemonic.md#flush) and by the `flush` helper on
[MnemonicRecoveryHook](MnemonicRecoveryHook.md). The two arrays partition exactly the keys that
were re-attempted; keys with nothing queued are not reported at all.

## Properties

### failed

> **failed**: `string`[]

Defined in: [src/Mnemonic/types.ts:1095](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1095)

Unprefixed keys that were re-attempted and failed again.

These keys stay queued, so a later flush can retry them.

---

### persisted

> **persisted**: `string`[]

Defined in: [src/Mnemonic/types.ts:1088](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1088)

Unprefixed keys whose queued value reached the storage backend.

These keys are no longer reported by `unpersistedKeys()`.
