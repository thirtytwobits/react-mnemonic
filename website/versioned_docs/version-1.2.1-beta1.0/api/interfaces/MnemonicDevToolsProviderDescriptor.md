# Interface: MnemonicDevToolsProviderDescriptor

Defined in: [src/Mnemonic/types.ts:346](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L346)

Lightweight provider status returned by `list()`.

## Properties

### available

> **available**: `boolean`

Defined in: [src/Mnemonic/types.ts:350](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L350)

Whether the provider can currently be resolved to a live API instance.

---

### lastSeenAt

> **lastSeenAt**: `number`

Defined in: [src/Mnemonic/types.ts:354](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L354)

Timestamp when the provider was last observed as live.

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:348](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L348)

Namespace registered by the provider.

---

### registeredAt

> **registeredAt**: `number`

Defined in: [src/Mnemonic/types.ts:352](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L352)

Timestamp when the provider namespace was first registered.

---

### staleSince

> **staleSince**: `number` \| `null`

Defined in: [src/Mnemonic/types.ts:356](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L356)

Timestamp when the provider first became unavailable, or `null` when live.
