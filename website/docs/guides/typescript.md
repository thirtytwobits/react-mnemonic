---
sidebar_position: 9
title: TypeScript
description: Type-safe usage and available type exports.
---

# TypeScript

react-mnemonic is written in strict TypeScript and ships its own declarations.
All public types are re-exported from the package root. Common helper functions
such as `createSchemaRegistry(...)` are also exported from the root package.

## Type imports

```ts
import type {
    Codec,
    StorageLike,
    MnemonicKeyDescriptor,
    MnemonicProviderOptions,
    MnemonicProviderProps,
    UseMnemonicKeyOptions,
    KeySchema,
    MigrationRule,
    MigrationPath,
    SchemaRegistry,
    StructuralTreeHelpers,
    SchemaMode,
    JsonSchema,
    JsonSchemaType,
    JsonSchemaValidationError,
    CompiledValidator,
} from "react-mnemonic";
```

## Generic inference

`useMnemonicKey` infers `T` from the `defaultValue` option:

```ts
// T is inferred as number
const { value, set } = useMnemonicKey("count", { defaultValue: 0 });

// T is inferred as { name: string; email: string }
const { value, set } = useMnemonicKey("profile", {
    defaultValue: { name: "", email: "" },
});
```

You can also supply the generic explicitly:

```ts
const { value, set } = useMnemonicKey<"light" | "dark">("theme", {
    defaultValue: "light",
});
```

## Descriptor inference

`defineMnemonicKey(...)` preserves the inferred value type and packages the key
contract into a reusable object:

```ts
import { defineMnemonicKey, useMnemonicKey } from "react-mnemonic";

const themeKey = defineMnemonicKey("theme", {
    defaultValue: "light" as "light" | "dark",
});

const { value, set } = useMnemonicKey(themeKey);
// `value` is inferred as "light" | "dark"
```

This is useful when the same durable key is shared across multiple components
or generated code paths.

## Key types

### `Codec<T>`

Bidirectional serialization between `T` and `string`:

```ts
interface Codec<T> {
    encode: (value: T) => string;
    decode: (encoded: string) => T;
}
```

### `KeySchema`

A versioned JSON Schema definition for a storage key:

```ts
interface KeySchema {
    key: string;
    version: number;
    schema: JsonSchema;
}
```

### `MigrationRule`

Defines how to transform data between schema versions:

```ts
interface MigrationRule {
    key: string;
    fromVersion: number;
    toVersion: number;
    migrate: (value: unknown) => unknown;
}
```

### `SchemaRegistry`

The interface for registering schemas and resolving migrations:

```ts
interface SchemaRegistry {
    getSchema(key: string, version: number): KeySchema | undefined;
    getLatestSchema(key: string): KeySchema | undefined;
    getMigrationPath(key: string, from: number, to: number): MigrationRule[] | null;
    getWriteMigration?(key: string, version: number): MigrationRule | undefined;
    registerSchema?(schema: KeySchema): void;
}
```

For immutable registries, prefer `createSchemaRegistry({ schemas, migrations })`
instead of manually implementing this interface.

### `StructuralTreeHelpers<T>`

Adapter type for structural migration helpers when your tree does not use the
default `id` / `children` fields:

```ts
interface StructuralTreeHelpers<T> {
    getId: (node: T) => string;
    getChildren: (node: T) => readonly T[] | undefined;
    withChildren: (node: T, children: T[]) => T;
    withId: (node: T, id: string) => T;
}
```

### `SchemaMode`

```ts
type SchemaMode = "default" | "strict" | "autoschema";
```

### `StorageLike`

The minimal interface for pluggable storage backends. See
[Custom Storage](/docs/guides/custom-storage) for details.
