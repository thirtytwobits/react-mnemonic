# Function: useMnemonicRecovery()

> **useMnemonicRecovery**(`options?`): [`MnemonicRecoveryHook`](../interfaces/MnemonicRecoveryHook.md)

Defined in: [src/Mnemonic/recovery.ts:50](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/recovery.ts#L50)

Hook for namespace-scoped recovery actions such as hard reset and selective clear.

Applications can use this to offer self-service recovery UX for corrupt or
legacy persisted state. The hook operates on the current provider namespace.

See the
[Reset and Recovery guide](https://thirtytwobits.github.io/react-mnemonic/docs/guides/reset-and-recovery)
for soft-reset and hard-reset patterns.

## Parameters

| Parameter | Type                                                                        | Description                                       |
| --------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| `options` | [`UseMnemonicRecoveryOptions`](../interfaces/UseMnemonicRecoveryOptions.md) | Optional recovery callback for telemetry/auditing |

## Returns

[`MnemonicRecoveryHook`](../interfaces/MnemonicRecoveryHook.md)

Namespace recovery helpers

## Throws

If used outside of a MnemonicProvider
