# Interface: MnemonicDevToolsProviderEntry

Defined in: [src/Mnemonic/types.ts:330](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L330)

Registry entry for a single provider namespace.

## Properties

### lastSeenAt

> **lastSeenAt**: `number`

Defined in: [src/Mnemonic/types.ts:338](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L338)

Timestamp when provider was last confirmed live.

---

### namespace

> **namespace**: `string`

Defined in: [src/Mnemonic/types.ts:332](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L332)

Namespace key for this provider entry.

---

### registeredAt

> **registeredAt**: `number`

Defined in: [src/Mnemonic/types.ts:336](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L336)

Timestamp when this namespace was registered.

---

### staleSince

> **staleSince**: `number` \| `null`

Defined in: [src/Mnemonic/types.ts:340](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L340)

Timestamp when provider was first observed unavailable, or null when live.

---

### weakRef

> **weakRef**: [`MnemonicDevToolsWeakRef`](MnemonicDevToolsWeakRef.md)\<[`MnemonicDevToolsProviderApi`](MnemonicDevToolsProviderApi.md)\>

Defined in: [src/Mnemonic/types.ts:334](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L334)

Weak reference to the provider inspection API.
