---
sidebar_position: 8
title: Error Handling
description: Handle decode, validation, and migration errors gracefully.
---

# Error Handling

Mnemonic provides two error classes for failures during read/write operations.
Both are passed to `defaultValue` factories so you can inspect or log the
failure reason.

## Error classes

| Class        | When thrown                                |
| ------------ | ----------------------------------------- |
| `CodecError` | Encoding or decoding fails (custom codec) |
| `SchemaError`| Schema validation, migration, or envelope parsing fails |

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
    console.warn("Schema validation failed:", error.message);
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

| Code                | Meaning                                        |
| ------------------- | ---------------------------------------------- |
| `INVALID_ENVELOPE`  | Stored JSON doesn't match the envelope format  |
| `MISSING_SCHEMA`    | No schema registered for this key/version      |
| `MIGRATION_FAILED`  | A migration rule threw or returned bad data    |
| `VALIDATION_FAILED` | Value doesn't pass JSON Schema validation      |

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
