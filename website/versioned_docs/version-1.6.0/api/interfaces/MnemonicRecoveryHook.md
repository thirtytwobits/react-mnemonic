# Interface: MnemonicRecoveryHook

Defined in: [src/Mnemonic/types.ts:1320](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1320)

Namespace-scoped recovery helpers returned by [useMnemonicRecovery](../functions/useMnemonicRecovery.md).

These helpers operate on the current provider namespace and are intended for
user-facing recovery UX such as "reset app data" or "clear stale filters".

## Properties

### canEnumerateKeys

> **canEnumerateKeys**: `boolean`

Defined in: [src/Mnemonic/types.ts:1332](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1332)

Whether namespace keys can be enumerated automatically.

`clearAll()` and `clearMatching()` require this to be `true`. If it is
`false`, prefer `clearKeys([...])` with an explicit durable-key list.

---

### clearAll()

> **clearAll**: () => `string`[]

Defined in: [src/Mnemonic/types.ts:1350](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1350)

Clears every key in the current namespace.

Covers keys that only exist as unpersisted writes as well as keys in
storage, so a reset cannot leave a value queued for a later flush.

#### Returns

`string`[]

#### Throws

When the storage backend cannot enumerate namespace keys

---

### clearKeys()

> **clearKeys**: (`keys`) => `string`[]

Defined in: [src/Mnemonic/types.ts:1357](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1357)

Clears a specific set of unprefixed keys in the current namespace.

Duplicate keys are ignored.

#### Parameters

| Parameter | Type                |
| --------- | ------------------- |
| `keys`    | readonly `string`[] |

#### Returns

`string`[]

---

### clearMatching()

> **clearMatching**: (`predicate`) => `string`[]

Defined in: [src/Mnemonic/types.ts:1366](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1366)

Clears namespace keys whose names match the supplied predicate.

The predicate sees unpersisted keys alongside stored ones.

#### Parameters

| Parameter   | Type                 |
| ----------- | -------------------- |
| `predicate` | (`key`) => `boolean` |

#### Returns

`string`[]

#### Throws

When the storage backend cannot enumerate namespace keys

---

### flush()

> **flush**: (`keys?`) => [`MnemonicFlushResult`](MnemonicFlushResult.md)

Defined in: [src/Mnemonic/types.ts:1395](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1395)

Re-attempts writes that never reached storage.

Call this after freeing space — the app evicted its own data, or the user
cleared something — to persist the values that were dropped. Nothing else
retries them.

#### Parameters

| Parameter | Type                | Description                                                                                        |
| --------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| `keys?`   | readonly `string`[] | Unprefixed keys to retry. Defaults to every unpersisted key. Keys with nothing queued are ignored. |

#### Returns

[`MnemonicFlushResult`](MnemonicFlushResult.md)

Which keys reached storage and which are still unpersisted

---

### listKeys()

> **listKeys**: () => `string`[]

Defined in: [src/Mnemonic/types.ts:1340](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1340)

Lists all unprefixed keys currently visible in this namespace.

Returns an empty array when no keys exist or when the storage backend
cannot enumerate keys.

#### Returns

`string`[]

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:1324](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1324)

Current provider namespace without the trailing storage prefix dot.

---

### unpersistedKeys()

> **unpersistedKeys**: () => `string`[]

Defined in: [src/Mnemonic/types.ts:1382](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1382)

Lists unprefixed keys whose current value is not known to be in storage.

Writes that the storage backend rejected — a full quota being the common
case — still update the in-memory cache, so the app keeps showing the new
value while storage holds the old one. This is how an app detects that
divergence.

Unlike `listKeys()`, this does not require an enumerable backend.

#### Returns

`string`[]

Unprefixed keys in the order they entered the queue. A key that
is already queued keeps its position when a later write to it also
fails, so this is first-failure order, not last-written order.
