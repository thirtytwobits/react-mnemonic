---
title: Single Source of Truth Schemas
description: Reuse one schema object for runtime validation, key descriptors, and migrations.
---

# Single Source of Truth Schemas

react-mnemonic has a first-class path for keeping runtime schema validation
and TypeScript types aligned.

The goal is simple: define one schema object, then reuse it for:

- schema registry entries
- `defineMnemonicKey(...)`
- migration callbacks
- `useMnemonicKey(...)` value inference

## The pattern

```tsx
import {
    MnemonicProvider,
    createSchemaRegistry,
    defineKeySchema,
    defineMnemonicKey,
    defineMigration,
    mnemonicSchema,
    useMnemonicKey,
} from "react-mnemonic/schema";

const settingsV1 = defineKeySchema(
    "settings",
    1,
    mnemonicSchema.object({
        theme: mnemonicSchema.enum(["light", "dark"] as const),
    }),
);

const settingsV2 = defineKeySchema(
    "settings",
    2,
    mnemonicSchema.object({
        theme: mnemonicSchema.enum(["light", "dark"] as const),
        density: mnemonicSchema.enum(["compact", "comfortable"] as const),
    }),
);

const settingsKey = defineMnemonicKey(settingsV2, {
    defaultValue: {
        theme: "light",
        density: "comfortable",
    },
    reconcile: (value) => ({
        ...value,
        density: value.density === "compact" ? "compact" : "comfortable",
    }),
});

const registry = createSchemaRegistry({
    schemas: [settingsV1, settingsV2],
    migrations: [
        defineMigration(settingsV1, settingsV2, (value) => ({
            ...value,
            density: "comfortable",
        })),
    ],
});

function SettingsPanel() {
    const { value: settings, set } = useMnemonicKey(settingsKey);

    return (
        <button onClick={() => set({ ...settings, theme: settings.theme === "light" ? "dark" : "light" })}>
            Theme: {settings.theme}
        </button>
    );
}

export default function App() {
    return (
        <MnemonicProvider namespace="app" schemaMode="default" schemaRegistry={registry}>
            <SettingsPanel />
        </MnemonicProvider>
    );
}
```

## What gets inferred

In the example above:

- `settingsKey` is inferred from `settingsV2`
- `defaultValue` must match the schema shape
- `reconcile(value)` receives the decoded settings object
- `useMnemonicKey(settingsKey)` returns a fully typed `value` and `set`
- `defineMigration(settingsV1, settingsV2, ...)` forces the callback to return the v2 shape

That means the schema object does double duty:

- runtime: it is still a normal Mnemonic `JsonSchema`
- compile time: it carries a phantom TypeScript value type

## Available schema helpers

The `mnemonicSchema` builder covers the built-in JSON Schema subset:

- `string(...)`
- `number(...)`
- `integer(...)`
- `boolean()`
- `nullValue()`
- `literal(value)`
- `enum([...])`
- `array(schema, ...)`
- `object({...})`
- `record(valueSchema)`
- `optional(schema)`
- `nullable(schema)`

The returned schemas are plain JSON-compatible objects, so they can be stored in
`KeySchema.schema` without an adapter layer.

## Tradeoffs

This path is stronger than plain `defaultValue` inference, but it is also more
intentional.

Use it when:

- a key is long-lived
- schema versioning matters
- migrations are part of the contract
- you want AI tools and teammates to see one obvious source of truth

Stay with the lightweight path when:

- the key is simple
- you do not need schema versioning
- `defaultValue` inference is already enough

The lightweight path still works:

```ts
const themeKey = defineMnemonicKey("theme", {
    defaultValue: "light" as "light" | "dark",
});
```

## Related guides

- [Schema Migration](/docs/guides/schema-migration)
- [Canonical Key Definitions](/docs/guides/canonical-key-definitions)
- [TypeScript](/docs/guides/typescript)
