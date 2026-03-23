# Interface: UseMnemonicRecoveryOptions

Defined in: [src/Mnemonic/types.ts:1076](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1076)

Options for [useMnemonicRecovery](../functions/useMnemonicRecovery.md).

## Properties

### onRecover()?

> `optional` **onRecover**: (`event`) => `void`

Defined in: [src/Mnemonic/types.ts:1083](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1083)

Optional callback invoked after a recovery action completes.

Useful for analytics, audit trails, support diagnostics, or user-facing
confirmation toasts.

#### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `event`   | [`MnemonicRecoveryEvent`](MnemonicRecoveryEvent.md) |

#### Returns

`void`
