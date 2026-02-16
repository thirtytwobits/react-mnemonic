---
sidebar_position: 2
title: JSON Schema Validation
description: Validate stored values against a JSON Schema subset.
---

# JSON Schema Validation

Schemas use a subset of JSON Schema for validation. This keeps the validator
small and fully serializable (no `$ref` resolution, no remote fetching).

## Supported keywords

| Keyword                | Applies to       | Description                                                     |
| ---------------------- | ---------------- | --------------------------------------------------------------- |
| `type`                 | any              | Expected type(s). Array form for nullable: `["string", "null"]` |
| `enum`                 | any              | Value must be deeply equal to one entry                         |
| `const`                | any              | Value must be deeply equal to this exact value                  |
| `minimum`              | number / integer | Inclusive lower bound                                           |
| `maximum`              | number / integer | Inclusive upper bound                                           |
| `exclusiveMinimum`     | number / integer | Exclusive lower bound                                           |
| `exclusiveMaximum`     | number / integer | Exclusive upper bound                                           |
| `minLength`            | string           | Minimum string length (inclusive)                               |
| `maxLength`            | string           | Maximum string length (inclusive)                               |
| `properties`           | object           | Property-name → sub-schema mapping                              |
| `required`             | object           | Properties that must be present                                 |
| `additionalProperties` | object           | `false` to disallow extras, or a sub-schema                     |
| `items`                | array            | Schema applied to every element                                 |
| `minItems`             | array            | Minimum array length (inclusive)                                |
| `maxItems`             | array            | Maximum array length (inclusive)                                |

## Defining a schema

Schemas are plain JSON objects — fully serializable, no functions.

```ts
import type { KeySchema } from "react-mnemonic";

const profileSchema: KeySchema = {
    key: "profile",
    version: 1,
    schema: {
        type: "object",
        properties: {
            name: { type: "string", minLength: 1 },
            email: { type: "string" },
            age: { type: "number", minimum: 0 },
        },
        required: ["name", "email"],
    },
};
```

## Standalone validation

Use `validateJsonSchema` to validate any value against a schema outside of
the hook:

```ts
import { validateJsonSchema } from "react-mnemonic";

const errors = validateJsonSchema(
    { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    { name: 42 },
);
// [{ path: ".name", message: 'Expected type "string"' }]
```

## Compiled validators

For performance-sensitive code paths, pre-compile a schema into a reusable
validator function with `compileSchema`. The compiled validator is cached by
schema reference (`WeakMap`), so repeated calls with the same object return
the identical function.

```ts
import { compileSchema } from "react-mnemonic";
import type { CompiledValidator } from "react-mnemonic";

const validate: CompiledValidator = compileSchema({
    type: "object",
    properties: {
        name: { type: "string", minLength: 1 },
        age: { type: "number", minimum: 0 },
    },
    required: ["name"],
});

validate({ name: "Alice", age: 30 }); // []
validate({ age: -1 }); // [{ path: "", … }, { path: ".age", … }]
```

This is useful when you validate the same schema frequently outside of the hook
(e.g. in form validation or server responses). Internally, the hook already uses
compiled validators for all schema checks.
