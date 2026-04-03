# Interface: UseMnemonicRecoveryOptions

Defined in: [src/Mnemonic/types.ts:1076](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1076)

Options for [useMnemonicRecovery](../functions/useMnemonicRecovery.md).

## Properties

### onRecover()?

> `optional` **onRecover**: (`event`) => `void`

Defined in: [src/Mnemonic/types.ts:1083](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L1083)

Optional callback invoked after a recovery action completes.

Useful for analytics, audit trails, support diagnostics, or user-facing
confirmation toasts.

#### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `event`   | [`MnemonicRecoveryEvent`](MnemonicRecoveryEvent.md) |

#### Returns

`void`
