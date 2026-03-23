# Interface: MnemonicKeyState\<T\>

Defined in: [src/Mnemonic/types.ts:1154](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1154)

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

Defined in: [src/Mnemonic/types.ts:1179](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1179)

Delete the key from storage entirely.

Future reads will fall back to `defaultValue` until the key is written
again.

#### Returns

`void`

---

### reset()

> **reset**: () => `void`

Defined in: [src/Mnemonic/types.ts:1171](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1171)

Reset the key back to `defaultValue` and persist that default.

#### Returns

`void`

---

### set()

> **set**: (`next`) => `void`

Defined in: [src/Mnemonic/types.ts:1166](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1166)

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

Defined in: [src/Mnemonic/types.ts:1158](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1158)

Current decoded value, or the default when the key is absent or invalid.
