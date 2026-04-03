# Function: useMnemonicKey()

## Call Signature

> **useMnemonicKey**\<`T`, `K`\>(`descriptor`): [`MnemonicKeyState`](../interfaces/MnemonicKeyState.md)\<`T`\>

Defined in: [src/Mnemonic/use.ts:397](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/use.ts#L397)

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

Defined in: [src/Mnemonic/use.ts:398](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/use.ts#L398)

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
