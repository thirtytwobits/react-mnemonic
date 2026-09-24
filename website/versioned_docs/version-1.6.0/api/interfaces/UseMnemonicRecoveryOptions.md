# Interface: UseMnemonicRecoveryOptions

Defined in: [src/Mnemonic/types.ts:1304](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1304)

Options for [useMnemonicRecovery](../functions/useMnemonicRecovery.md).

## Properties

### onRecover()?

> `optional` **onRecover**: (`event`) => `void`

Defined in: [src/Mnemonic/types.ts:1311](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L1311)

Optional callback invoked after a recovery action completes.

Useful for analytics, audit trails, support diagnostics, or user-facing
confirmation toasts.

#### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `event`   | [`MnemonicRecoveryEvent`](MnemonicRecoveryEvent.md) |

#### Returns

`void`
