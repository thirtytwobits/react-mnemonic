# Interface: MnemonicRecoveryHook

Defined in: [src/Mnemonic/types.ts:1092](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1092)

Namespace-scoped recovery helpers returned by [useMnemonicRecovery](../functions/useMnemonicRecovery.md).

These helpers operate on the current provider namespace and are intended for
user-facing recovery UX such as "reset app data" or "clear stale filters".

## Properties

### canEnumerateKeys

> **canEnumerateKeys**: `boolean`

Defined in: [src/Mnemonic/types.ts:1104](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1104)

Whether namespace keys can be enumerated automatically.

`clearAll()` and `clearMatching()` require this to be `true`. If it is
`false`, prefer `clearKeys([...])` with an explicit durable-key list.

---

### clearAll()

> **clearAll**: () => `string`[]

Defined in: [src/Mnemonic/types.ts:1119](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1119)

Clears every key in the current namespace.

#### Returns

`string`[]

#### Throws

When the storage backend cannot enumerate namespace keys

---

### clearKeys()

> **clearKeys**: (`keys`) => `string`[]

Defined in: [src/Mnemonic/types.ts:1126](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1126)

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

Defined in: [src/Mnemonic/types.ts:1133](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1133)

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

Defined in: [src/Mnemonic/types.ts:1112](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1112)

Lists all unprefixed keys currently visible in this namespace.

Returns an empty array when no keys exist or when the storage backend
cannot enumerate keys.

#### Returns

`string`[]

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:1096](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1096)

Current provider namespace without the trailing storage prefix dot.
