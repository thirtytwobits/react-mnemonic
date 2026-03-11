# Function: useMnemonicKey()

## Call Signature

> **useMnemonicKey**\<`T`, `K`\>(`descriptor`): [`MnemonicKeyState`](../interfaces/MnemonicKeyState.md)\<`T`\>

Defined in: [src/Mnemonic/use.ts:380](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/use.ts#L380)

React hook for persistent, type-safe state management.

### Type Parameters

| Type Parameter         |
| ---------------------- |
| `T`                    |
| `K` _extends_ `string` |

### Parameters

| Parameter    | Type                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `descriptor` | [`MnemonicKeyDescriptor`](../interfaces/MnemonicKeyDescriptor.md)\<`T`, `K`\> |

### Returns

[`MnemonicKeyState`](../interfaces/MnemonicKeyState.md)\<`T`\>

## Call Signature

> **useMnemonicKey**\<`T`\>(`key`, `options`): [`MnemonicKeyState`](../interfaces/MnemonicKeyState.md)\<`T`\>

Defined in: [src/Mnemonic/use.ts:381](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/use.ts#L381)

React hook for persistent, type-safe state management.

### Type Parameters

| Type Parameter |
| -------------- |
| `T`            |

### Parameters

| Parameter | Type                                                                       |
| --------- | -------------------------------------------------------------------------- |
| `key`     | `string`                                                                   |
| `options` | [`UseMnemonicKeyOptions`](../type-aliases/UseMnemonicKeyOptions.md)\<`T`\> |

### Returns

[`MnemonicKeyState`](../interfaces/MnemonicKeyState.md)\<`T`\>
