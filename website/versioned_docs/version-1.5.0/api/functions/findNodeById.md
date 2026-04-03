# Function: findNodeById()

## Call Signature

> **findNodeById**\<`T`\>(`root`, `id`): `T` \| `undefined`

Defined in: [src/Mnemonic/structural-migrations.ts:74](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/structural-migrations.ts#L74)

Finds the first node with the requested id using depth-first traversal.

### Type Parameters

| Type Parameter                                                           | Description                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `T` _extends_ [`StructuralNode`](../interfaces/StructuralNode.md)\<`T`\> | Tree node type (must extend `{ id: string; children?: readonly T[] }` when `helpers` is omitted) |

### Parameters

| Parameter | Type     | Description         |
| --------- | -------- | ------------------- |
| `root`    | `T`      | Root node to search |
| `id`      | `string` | Target node id      |

### Returns

`T` \| `undefined`

The matching node, or `undefined`

## Call Signature

> **findNodeById**\<`T`\>(`root`, `id`, `helpers`): `T` \| `undefined`

Defined in: [src/Mnemonic/structural-migrations.ts:84](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/structural-migrations.ts#L84)

Finds the first node with the requested id using depth-first traversal.

### Type Parameters

| Type Parameter | Description    |
| -------------- | -------------- |
| `T`            | Tree node type |

### Parameters

| Parameter | Type                                                                     | Description                    |
| --------- | ------------------------------------------------------------------------ | ------------------------------ |
| `root`    | `T`                                                                      | Root node to search            |
| `id`      | `string`                                                                 | Target node id                 |
| `helpers` | [`StructuralTreeHelpers`](../interfaces/StructuralTreeHelpers.md)\<`T`\> | Adapter for custom node shapes |

### Returns

`T` \| `undefined`

The matching node, or `undefined`
