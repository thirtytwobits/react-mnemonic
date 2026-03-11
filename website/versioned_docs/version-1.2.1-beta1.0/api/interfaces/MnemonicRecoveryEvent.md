# Interface: MnemonicRecoveryEvent

Defined in: [src/Mnemonic/types.ts:980](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L980)

Recovery event payload emitted after a namespace recovery action completes.

## Properties

### action

> **action**: [`MnemonicRecoveryAction`](../type-aliases/MnemonicRecoveryAction.md)

Defined in: [src/Mnemonic/types.ts:984](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L984)

Recovery action that just ran.

---

### clearedKeys

> **clearedKeys**: `string`[]

Defined in: [src/Mnemonic/types.ts:994](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L994)

Unprefixed keys cleared by the action.

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:989](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L989)

Namespace where the recovery action ran.
