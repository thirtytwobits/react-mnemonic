# Function: dedupeChildrenBy()

## Call Signature

> **dedupeChildrenBy**\<`T`, `K`\>(`root`, `getKey`): `T`

Defined in: [src/Mnemonic/structural-migrations.ts:214](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/structural-migrations.ts#L214)

Deduplicates each node's immediate children while preserving the first child
encountered for each key. The helper traverses the full tree and returns the
original root when no duplicates are removed.

### Type Parameters

| Type Parameter                                                           | Description                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `T` _extends_ [`StructuralNode`](../interfaces/StructuralNode.md)\<`T`\> | Tree node type (must extend `{ id: string; children?: readonly T[] }` when `helpers` is omitted) |
| `K`                                                                      | Deduplication key type                                                                           |

### Parameters

| Parameter | Type            | Description                                        |
| --------- | --------------- | -------------------------------------------------- |
| `root`    | `T`             | Root node to normalize                             |
| `getKey`  | (`node`) => `K` | Function that computes a dedupe key for each child |

### Returns

`T`

Updated tree with duplicate siblings removed

## Call Signature

> **dedupeChildrenBy**\<`T`, `K`\>(`root`, `getKey`, `helpers`): `T`

Defined in: [src/Mnemonic/structural-migrations.ts:227](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/structural-migrations.ts#L227)

Deduplicates each node's immediate children while preserving the first child
encountered for each key. The helper traverses the full tree and returns the
original root when no duplicates are removed.

### Type Parameters

| Type Parameter | Description            |
| -------------- | ---------------------- |
| `T`            | Tree node type         |
| `K`            | Deduplication key type |

### Parameters

| Parameter | Type                                                                     | Description                                        |
| --------- | ------------------------------------------------------------------------ | -------------------------------------------------- |
| `root`    | `T`                                                                      | Root node to normalize                             |
| `getKey`  | (`node`) => `K`                                                          | Function that computes a dedupe key for each child |
| `helpers` | [`StructuralTreeHelpers`](../interfaces/StructuralTreeHelpers.md)\<`T`\> | Adapter for custom node shapes                     |

### Returns

`T`

Updated tree with duplicate siblings removed
