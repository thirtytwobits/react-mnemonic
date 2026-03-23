# Interface: MnemonicRecoveryEvent

Defined in: [src/Mnemonic/types.ts:1056](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1056)

Recovery event payload emitted after a namespace recovery action completes.

## Properties

### action

> **action**: [`MnemonicRecoveryAction`](../type-aliases/MnemonicRecoveryAction.md)

Defined in: [src/Mnemonic/types.ts:1060](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1060)

Recovery action that just ran.

---

### clearedKeys

> **clearedKeys**: `string`[]

Defined in: [src/Mnemonic/types.ts:1070](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1070)

Unprefixed keys cleared by the action.

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:1065](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L1065)

Namespace where the recovery action ran.
