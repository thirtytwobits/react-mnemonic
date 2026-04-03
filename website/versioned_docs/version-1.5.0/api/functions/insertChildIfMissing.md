# Function: insertChildIfMissing()

## Call Signature

> **insertChildIfMissing**\<`T`\>(`root`, `parentId`, `child`): `T`

Defined in: [src/Mnemonic/structural-migrations.ts:106](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/structural-migrations.ts#L106)

Inserts a child under the target parent when none of that parent's existing
direct children share the same id. Returns the original tree when the parent
is missing or the child is already present as a direct child.

### Type Parameters

| Type Parameter                                                           | Description                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `T` _extends_ [`StructuralNode`](../interfaces/StructuralNode.md)\<`T`\> | Tree node type (must extend `{ id: string; children?: readonly T[] }` when `helpers` is omitted) |

### Parameters

| Parameter  | Type     | Description                               |
| ---------- | -------- | ----------------------------------------- |
| `root`     | `T`      | Root node to update                       |
| `parentId` | `string` | Parent node that should receive the child |
| `child`    | `T`      | Child node to append                      |

### Returns

`T`

Updated tree with the child inserted once

## Call Signature

> **insertChildIfMissing**\<`T`\>(`root`, `parentId`, `child`, `helpers`): `T`

Defined in: [src/Mnemonic/structural-migrations.ts:119](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/structural-migrations.ts#L119)

Inserts a child under the target parent when no existing child shares the
same id. Returns the original tree when the parent is missing or the child is
already present.

### Type Parameters

| Type Parameter | Description    |
| -------------- | -------------- |
| `T`            | Tree node type |

### Parameters

| Parameter  | Type                                                                     | Description                               |
| ---------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `root`     | `T`                                                                      | Root node to update                       |
| `parentId` | `string`                                                                 | Parent node that should receive the child |
| `child`    | `T`                                                                      | Child node to append                      |
| `helpers`  | [`StructuralTreeHelpers`](../interfaces/StructuralTreeHelpers.md)\<`T`\> | Adapter for custom node shapes            |

### Returns

`T`

Updated tree with the child inserted once
