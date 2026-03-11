# Type Alias: MigrationRule\<TFrom, TTo, K\>

> **MigrationRule**\<`TFrom`, `TTo`, `K`\> = `object`

Defined in: [src/Mnemonic/types.ts:504](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L504)

A single migration step that transforms data from one schema version to
another, or normalizes data at the same version.

Migration rules are composed into a [MigrationPath](MigrationPath.md) by the
[SchemaRegistry](../interfaces/SchemaRegistry.md) to upgrade stored data across multiple versions in
sequence (e.g. v1 -> v2 -> v3).

When `fromVersion === toVersion`, the rule is a **write-time normalizer**
that runs on every write to that version. This is useful for data
normalization (trimming strings, clamping values, injecting defaults).

## Example

```typescript
// Version upgrade migration
const userV1ToV2: MigrationRule = {
    key: "user",
    fromVersion: 1,
    toVersion: 2,
    migrate: (v1) => {
        const old = v1 as { name: string };
        return { firstName: old.name, lastName: "" };
    },
};

// Write-time normalizer (same version)
const trimUserV2: MigrationRule = {
    key: "user",
    fromVersion: 2,
    toVersion: 2,
    migrate: (v) => {
        const user = v as { firstName: string; lastName: string };
        return { firstName: user.firstName.trim(), lastName: user.lastName.trim() };
    },
};
```

## See

- [MigrationPath](MigrationPath.md) - Ordered list of rules applied in sequence
- [SchemaRegistry.getMigrationPath](../interfaces/SchemaRegistry.md#getmigrationpath) - How the path is resolved
- [SchemaRegistry.getWriteMigration](../interfaces/SchemaRegistry.md#getwritemigration) - How write-time normalizers are resolved

## Type Parameters

| Type Parameter         | Default type |
| ---------------------- | ------------ |
| `TFrom`                | `unknown`    |
| `TTo`                  | `unknown`    |
| `K` _extends_ `string` | `string`     |

## Properties

### fromVersion

> **fromVersion**: `number`

Defined in: [src/Mnemonic/types.ts:515](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L515)

The version the stored data is migrating **from**.

Version `0` is allowed, enabling migrations from unversioned data.

---

### key

> **key**: `K`

Defined in: [src/Mnemonic/types.ts:508](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L508)

The unprefixed storage key this rule applies to.

---

### toVersion

> **toVersion**: `number`

Defined in: [src/Mnemonic/types.ts:523](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L523)

The version the stored data is migrating **to**.

When equal to `fromVersion`, this rule is a write-time normalizer
that runs on every write to that version.

## Methods

### migrate()

> **migrate**(`value`): `TTo`

Defined in: [src/Mnemonic/types.ts:535](https://github.com/thirtytwobits/react-mnemonic/blob/d63eebb3795ee1a50eb3bdc404544bc76af7afe5/src/Mnemonic/types.ts#L535)

Transformation function that converts data from `fromVersion`
to `toVersion`.

Receives the decoded value at `fromVersion` and must return
the value in the shape expected by `toVersion`.

#### Parameters

| Parameter | Type    | Description                        |
| --------- | ------- | ---------------------------------- |
| `value`   | `TFrom` | The decoded value at `fromVersion` |

#### Returns

`TTo`

The transformed value for `toVersion`
