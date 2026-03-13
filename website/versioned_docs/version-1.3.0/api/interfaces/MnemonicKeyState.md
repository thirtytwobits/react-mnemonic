# Interface: MnemonicKeyState\<T\>

Defined in: [src/Mnemonic/types.ts:1078](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1078)

Return shape from [useMnemonicKey](../functions/useMnemonicKey.md).

This mirrors the familiar `useState` mental model while making the storage
semantics explicit:

- `set(...)` writes a new persisted value
- `reset()` writes `defaultValue` back into storage
- `remove()` deletes the key entirely so reads fall back to `defaultValue`

See the
[Clearable Persisted Values guide](https://thirtytwobits.github.io/react-mnemonic/docs/guides/clearable-persisted-values)
for the semantic differences between clearing, resetting, and removing a key.

## See

[UseMnemonicKeyOptions](../type-aliases/UseMnemonicKeyOptions.md) - Hook configuration and lifecycle details

## Type Parameters

| Type Parameter | Description                        |
| -------------- | ---------------------------------- |
| `T`            | The decoded value type for the key |

## Properties

### remove()

> **remove**: () => `void`

Defined in: [src/Mnemonic/types.ts:1103](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1103)

Delete the key from storage entirely.

Future reads will fall back to `defaultValue` until the key is written
again.

#### Returns

`void`

---

### reset()

> **reset**: () => `void`

Defined in: [src/Mnemonic/types.ts:1095](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1095)

Reset the key back to `defaultValue` and persist that default.

#### Returns

`void`

---

### set()

> **set**: (`next`) => `void`

Defined in: [src/Mnemonic/types.ts:1090](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1090)

Persist a new value.

Accepts either a direct replacement value or an updater function that
receives the current decoded value.

#### Parameters

| Parameter | Type                      |
| --------- | ------------------------- |
| `next`    | `T` \| (`current`) => `T` |

#### Returns

`void`

---

### value

> **value**: `T`

Defined in: [src/Mnemonic/types.ts:1082](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1082)

Current decoded value, or the default when the key is absent or invalid.
