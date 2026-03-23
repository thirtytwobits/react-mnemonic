# Function: renameNode()

## Call Signature

> **renameNode**\<`T`\>(`root`, `currentId`, `nextId`): `T`

Defined in: [src/Mnemonic/structural-migrations.ts:164](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/structural-migrations.ts#L164)

Renames every node with the source id while preserving tree structure.
Returns the original tree when the source id is missing or the target id
already exists elsewhere.

### Type Parameters

| Type Parameter                                                           | Description                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `T` _extends_ [`StructuralNode`](../interfaces/StructuralNode.md)\<`T`\> | Tree node type (must extend `{ id: string; children?: readonly T[] }` when `helpers` is omitted) |

### Parameters

| Parameter   | Type     | Description           |
| ----------- | -------- | --------------------- |
| `root`      | `T`      | Root node to update   |
| `currentId` | `string` | Existing id to rename |
| `nextId`    | `string` | Replacement id        |

### Returns

`T`

Updated tree with matching node ids renamed

## Call Signature

> **renameNode**\<`T`\>(`root`, `currentId`, `nextId`, `helpers`): `T`

Defined in: [src/Mnemonic/structural-migrations.ts:177](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/structural-migrations.ts#L177)

Renames every node with the source id while preserving tree structure.
Returns the original tree when the source id is missing or the target id
already exists elsewhere.

### Type Parameters

| Type Parameter | Description    |
| -------------- | -------------- |
| `T`            | Tree node type |

### Parameters

| Parameter   | Type                                                                     | Description                    |
| ----------- | ------------------------------------------------------------------------ | ------------------------------ |
| `root`      | `T`                                                                      | Root node to update            |
| `currentId` | `string`                                                                 | Existing id to rename          |
| `nextId`    | `string`                                                                 | Replacement id                 |
| `helpers`   | [`StructuralTreeHelpers`](../interfaces/StructuralTreeHelpers.md)\<`T`\> | Adapter for custom node shapes |

### Returns

`T`

Updated tree with matching node ids renamed
