# Interface: MnemonicKeyState\<T\>

Defined in: [src/Mnemonic/types.ts:1416](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1416)

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

Defined in: [src/Mnemonic/types.ts:1441](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1441)

Delete the key from storage entirely.

Future reads will fall back to `defaultValue` until the key is written
again.

#### Returns

`void`

---

### reset()

> **reset**: () => `void`

Defined in: [src/Mnemonic/types.ts:1433](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1433)

Reset the key back to `defaultValue` and persist that default.

#### Returns

`void`

---

### set()

> **set**: (`next`) => `void`

Defined in: [src/Mnemonic/types.ts:1428](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1428)

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

Defined in: [src/Mnemonic/types.ts:1420](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1420)

Current decoded value, or the default when the key is absent or invalid.
