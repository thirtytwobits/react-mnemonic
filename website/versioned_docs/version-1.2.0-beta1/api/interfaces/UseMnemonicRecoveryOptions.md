# Interface: UseMnemonicRecoveryOptions

Defined in: [src/Mnemonic/types.ts:1000](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L1000)

Options for [useMnemonicRecovery](../functions/useMnemonicRecovery.md).

## Properties

### onRecover()?

> `optional` **onRecover**: (`event`) => `void`

Defined in: [src/Mnemonic/types.ts:1007](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L1007)

Optional callback invoked after a recovery action completes.

Useful for analytics, audit trails, support diagnostics, or user-facing
confirmation toasts.

#### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `event`   | [`MnemonicRecoveryEvent`](MnemonicRecoveryEvent.md) |

#### Returns

`void`
