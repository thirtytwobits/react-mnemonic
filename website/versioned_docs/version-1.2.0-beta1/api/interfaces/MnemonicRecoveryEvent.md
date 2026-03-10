# Interface: MnemonicRecoveryEvent

Defined in: [src/Mnemonic/types.ts:980](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L980)

Recovery event payload emitted after a namespace recovery action completes.

## Properties

### action

> **action**: [`MnemonicRecoveryAction`](../type-aliases/MnemonicRecoveryAction.md)

Defined in: [src/Mnemonic/types.ts:984](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L984)

Recovery action that just ran.

---

### clearedKeys

> **clearedKeys**: `string`[]

Defined in: [src/Mnemonic/types.ts:994](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L994)

Unprefixed keys cleared by the action.

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:989](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L989)

Namespace where the recovery action ran.
