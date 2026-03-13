# Interface: MnemonicRecoveryHook

Defined in: [src/Mnemonic/types.ts:1016](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1016)

Namespace-scoped recovery helpers returned by [useMnemonicRecovery](../functions/useMnemonicRecovery.md).

These helpers operate on the current provider namespace and are intended for
user-facing recovery UX such as "reset app data" or "clear stale filters".

## Properties

### canEnumerateKeys

> **canEnumerateKeys**: `boolean`

Defined in: [src/Mnemonic/types.ts:1028](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1028)

Whether namespace keys can be enumerated automatically.

`clearAll()` and `clearMatching()` require this to be `true`. If it is
`false`, prefer `clearKeys([...])` with an explicit durable-key list.

---

### clearAll()

> **clearAll**: () => `string`[]

Defined in: [src/Mnemonic/types.ts:1043](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1043)

Clears every key in the current namespace.

#### Returns

`string`[]

#### Throws

When the storage backend cannot enumerate namespace keys

---

### clearKeys()

> **clearKeys**: (`keys`) => `string`[]

Defined in: [src/Mnemonic/types.ts:1050](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1050)

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

Defined in: [src/Mnemonic/types.ts:1057](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1057)

Clears namespace keys whose names match the supplied predicate.

#### Parameters

| Parameter   | Type                 |
| ----------- | -------------------- |
| `predicate` | (`key`) => `boolean` |

#### Returns

`string`[]

#### Throws

When the storage backend cannot enumerate namespace keys

---

### listKeys()

> **listKeys**: () => `string`[]

Defined in: [src/Mnemonic/types.ts:1036](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1036)

Lists all unprefixed keys currently visible in this namespace.

Returns an empty array when no keys exist or when the storage backend
cannot enumerate keys.

#### Returns

`string`[]

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:1020](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1020)

Current provider namespace without the trailing storage prefix dot.
