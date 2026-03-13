# Interface: UseMnemonicRecoveryOptions

Defined in: [src/Mnemonic/types.ts:1000](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1000)

Options for [useMnemonicRecovery](../functions/useMnemonicRecovery.md).

## Properties

### onRecover()?

> `optional` **onRecover**: (`event`) => `void`

Defined in: [src/Mnemonic/types.ts:1007](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L1007)

Optional callback invoked after a recovery action completes.

Useful for analytics, audit trails, support diagnostics, or user-facing
confirmation toasts.

#### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `event`   | [`MnemonicRecoveryEvent`](MnemonicRecoveryEvent.md) |

#### Returns

`void`
