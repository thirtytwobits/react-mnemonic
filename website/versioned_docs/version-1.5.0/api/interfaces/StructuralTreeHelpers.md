# Interface: StructuralTreeHelpers\<T\>

Defined in: [src/Mnemonic/structural-migrations.ts:14](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/structural-migrations.ts#L14)

Adapter functions for structural migration helpers.

These helpers assume tree-like data, but not a specific node shape. Supply a
`StructuralTreeHelpers<T>` when your nodes use custom field names. When your
nodes already look like `{ id, children }`, the exported helpers work without
any adapter configuration.

## Type Parameters

| Type Parameter | Description    |
| -------------- | -------------- |
| `T`            | Tree node type |

## Properties

### getChildren()

> **getChildren**: (`node`) => readonly `T`[] \| `undefined`

Defined in: [src/Mnemonic/structural-migrations.ts:23](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/structural-migrations.ts#L23)

Returns the node's child list, or `undefined` when it has no children.

#### Parameters

| Parameter | Type |
| --------- | ---- |
| `node`    | `T`  |

#### Returns

readonly `T`[] \| `undefined`

---

### getId()

> **getId**: (`node`) => `string`

Defined in: [src/Mnemonic/structural-migrations.ts:18](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/structural-migrations.ts#L18)

Returns the stable identifier for a node.

#### Parameters

| Parameter | Type |
| --------- | ---- |
| `node`    | `T`  |

#### Returns

`string`

---

### withChildren()

> **withChildren**: (`node`, `children`) => `T`

Defined in: [src/Mnemonic/structural-migrations.ts:28](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/structural-migrations.ts#L28)

Returns a copy of the node with a new child list.

#### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `node`     | `T`   |
| `children` | `T`[] |

#### Returns

`T`

---

### withId()

> **withId**: (`node`, `id`) => `T`

Defined in: [src/Mnemonic/structural-migrations.ts:33](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/structural-migrations.ts#L33)

Returns a copy of the node with a new identifier.

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `node`    | `T`      |
| `id`      | `string` |

#### Returns

`T`
