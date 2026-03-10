# Interface: StructuralNode\<T\>

Defined in: [src/Mnemonic/structural-migrations.ts:44](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/structural-migrations.ts#L44)

Default tree node shape supported by the structural migration helpers.

If your nodes already use `id` and `children`, you can call the helpers
directly without supplying `StructuralTreeHelpers`.

## Type Parameters

| Type Parameter | Description    |
| -------------- | -------------- |
| `T`            | Tree node type |

## Properties

### children?

> `optional` **children**: readonly `T`[]

Defined in: [src/Mnemonic/structural-migrations.ts:53](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/structural-migrations.ts#L53)

Optional child nodes.

---

### id

> **id**: `string`

Defined in: [src/Mnemonic/structural-migrations.ts:48](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/structural-migrations.ts#L48)

Stable node identifier used for lookup and rename operations.
