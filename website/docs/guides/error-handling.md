---
sidebar_position: 8
title: Error Handling
description: Handle decode, validation, migration, and reconciliation errors gracefully.
---

# Error Handling

Mnemonic provides two error classes for failures during read/write operations.
Both are passed to `defaultValue` factories so you can inspect or log the
failure reason.

## Error classes

| Class         | When thrown                                             |
| ------------- | ------------------------------------------------------- |
| `CodecError`  | Encoding or decoding fails (custom codec)               |
| `SchemaError` | Schema validation, migration, reconciliation, or envelope parsing fails |

## Error-aware defaults

When a stored value can't be decoded or validated, the `defaultValue` factory
receives the error:

```tsx
import { useMnemonicKey, CodecError, SchemaError } from "react-mnemonic";

const getDefault = (error?: CodecError | SchemaError) => {
    if (error instanceof CodecError) {
        console.warn("Corrupt stored data:", error.message);
    }
    if (error instanceof SchemaError) {
        console.warn(`Schema issue [${error.code}]:`, error.message);
    }
    return { count: 0 };
};

const { value } = useMnemonicKey("counter", { defaultValue: getDefault });
```

### When `error` is `undefined`

If the factory receives `undefined`, it means the key simply doesn't exist in
storage — the nominal "first visit" path. No error occurred.

## `SchemaError` codes

`SchemaError` includes a `code` property for programmatic handling:

| Code                         | Meaning                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| `INVALID_ENVELOPE`           | Stored JSON doesn't match the envelope format                   |
| `SCHEMA_NOT_FOUND`           | No schema is registered for the stored key/version              |
| `WRITE_SCHEMA_REQUIRED`      | Strict-mode writes require a schema, but none could be resolved |
| `MIGRATION_PATH_NOT_FOUND`   | No contiguous migration path exists to the latest schema        |
| `MIGRATION_FAILED`           | A migration or write-time normalizer threw                      |
| `RECONCILE_FAILED`           | A `reconcile` hook threw or returned an unpersistable value     |
| `SCHEMA_REGISTRATION_CONFLICT` | A schema registration conflicted with an existing definition  |
| `TYPE_MISMATCH`              | The decoded value failed JSON Schema validation                 |
| `MODE_CONFIGURATION_INVALID` | The active schema mode is missing a required registry capability |

## Reconciliation failures

If a `reconcile` hook throws, the hook falls back through `defaultValue` with a
`SchemaError` whose `code` is `RECONCILE_FAILED`.

```tsx
const { value } = useMnemonicKey("preferences", {
    defaultValue: (error) => {
        if (error instanceof SchemaError && error.code === "RECONCILE_FAILED") {
            return { theme: "dark", accents: true };
        }
        return { theme: "light", accents: false };
    },
    reconcile: (persisted) => {
        if (!persisted) throw new Error("bad persisted state");
        return persisted;
    },
});
```

## Write errors

Write errors (from `set` or `reset`) are caught and logged to `console.error`.
They don't throw to the calling component. If a schema validation fails on
write, the value is **not persisted** — the previous stored value remains.

```tsx
const { set } = useMnemonicKey("profile", {
    defaultValue: { name: "", email: "" },
});

// If this fails schema validation, it's logged but not thrown.
// The stored value remains unchanged.
set({ name: "", email: "not-an-email" });
```
