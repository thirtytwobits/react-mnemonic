# Class: SchemaError

Defined in: [src/Mnemonic/schema.ts:47](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/schema.ts#L47)

Error thrown for schema registry, versioning, and migration failures.

Each instance carries a machine-readable [code](#code) that categorises
the failure. When a `defaultValue` factory is provided to
`useMnemonicKey`, the `SchemaError` is passed as the `error` argument
so the factory can inspect the failure reason.

Error codes:

| Code                           | Meaning                                                                     |
| ------------------------------ | --------------------------------------------------------------------------- |
| `INVALID_ENVELOPE`             | The raw stored value is not a valid `MnemonicEnvelope`.                     |
| `SCHEMA_NOT_FOUND`             | No schema registered for the stored key + version.                          |
| `WRITE_SCHEMA_REQUIRED`        | Strict mode requires a schema to write, but none was found.                 |
| `MIGRATION_PATH_NOT_FOUND`     | No contiguous migration path between the stored and latest version.         |
| `MIGRATION_FAILED`             | A migration step threw during execution.                                    |
| `MIGRATION_GRAPH_INVALID`      | The schema registry helper received an ambiguous or cyclic migration graph. |
| `RECONCILE_FAILED`             | A read-time reconciliation hook threw or returned an unpersistable value.   |
| `SCHEMA_REGISTRATION_CONFLICT` | `registerSchema` was called with a conflicting definition.                  |
| `TYPE_MISMATCH`                | The decoded value failed JSON Schema validation.                            |
| `MODE_CONFIGURATION_INVALID`   | The schema mode requires a capability the registry doesn't provide.         |

## Example

```typescript
defaultValue: (error) => {
    if (error instanceof SchemaError) {
        console.warn(`Schema issue [${error.code}]:`, error.message);
    }
    return { name: "Guest" };
};
```

## See

- [SchemaMode](../type-aliases/SchemaMode.md) - How the provider uses schemas
- [SchemaRegistry](../interfaces/SchemaRegistry.md) - Where schemas and migrations are registered

## Extends

- `Error`

## Constructors

### Constructor

> **new SchemaError**(`code`, `message`, `cause?`): `SchemaError`

Defined in: [src/Mnemonic/schema.ts:75](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/schema.ts#L75)

Creates a new SchemaError.

#### Parameters

| Parameter | Type                                                                                                                                                                                                                                                                                | Description                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `code`    | `"INVALID_ENVELOPE"` \| `"SCHEMA_NOT_FOUND"` \| `"WRITE_SCHEMA_REQUIRED"` \| `"MIGRATION_PATH_NOT_FOUND"` \| `"MIGRATION_FAILED"` \| `"MIGRATION_GRAPH_INVALID"` \| `"RECONCILE_FAILED"` \| `"SCHEMA_REGISTRATION_CONFLICT"` \| `"TYPE_MISMATCH"` \| `"MODE_CONFIGURATION_INVALID"` | Machine-readable failure category |
| `message` | `string`                                                                                                                                                                                                                                                                            | Human-readable error description  |
| `cause?`  | `unknown`                                                                                                                                                                                                                                                                           | Optional underlying error         |

#### Returns

`SchemaError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `readonly` `optional` **cause**: `unknown`

Defined in: [src/Mnemonic/schema.ts:66](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/schema.ts#L66)

The underlying error that caused this failure, if any.

---

### code

> `readonly` **code**: `"INVALID_ENVELOPE"` \| `"SCHEMA_NOT_FOUND"` \| `"WRITE_SCHEMA_REQUIRED"` \| `"MIGRATION_PATH_NOT_FOUND"` \| `"MIGRATION_FAILED"` \| `"MIGRATION_GRAPH_INVALID"` \| `"RECONCILE_FAILED"` \| `"SCHEMA_REGISTRATION_CONFLICT"` \| `"TYPE_MISMATCH"` \| `"MODE_CONFIGURATION_INVALID"`

Defined in: [src/Mnemonic/schema.ts:51](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/schema.ts#L51)

Machine-readable code identifying the category of schema failure.

---

### message

> **message**: `string`

Defined in: website/node_modules/typescript/lib/lib.es5.d.ts:1077

#### Inherited from

`Error.message`

---

### name

> **name**: `string`

Defined in: website/node_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

`Error.name`

---

### stack?

> `optional` **stack**: `string`

Defined in: website/node_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

`Error.stack`
