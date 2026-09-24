---
sidebar_position: 3
title: Schema Migration
description: Version your stored data and migrate between schema versions.
---

# Schema Migration

When your data shape changes between app versions, Mnemonic's schema registry
and migration rules handle the upgrade automatically. For field-level policy
changes that should apply after reading persisted data, use `reconcile`.

## Schema registry

A schema registry stores versioned schemas for each key and resolves migration
paths to upgrade stored data. For the common immutable case, use
`createSchemaRegistry(...)` instead of hand-rolling the indexing boilerplate.

```tsx
import {
    createSchemaRegistry,
    MnemonicProvider,
    useMnemonicKey,
    insertChildIfMissing,
    renameNode,
    dedupeChildrenBy,
    type KeySchema,
    type MigrationRule,
    type StructuralTreeHelpers,
} from "react-mnemonic/schema";
```

## Registering schemas

```ts
const schemas: KeySchema[] = [
    {
        key: "profile",
        version: 1,
        schema: {
            type: "object",
            properties: { name: { type: "string" }, email: { type: "string" } },
            required: ["name", "email"],
        },
    },
    {
        key: "profile",
        version: 2,
        schema: {
            type: "object",
            properties: {
                name: { type: "string" },
                email: { type: "string" },
                migratedAt: { type: "string" },
            },
            required: ["name", "email", "migratedAt"],
        },
    },
];
```

## Adding migrations

Migrations define how to transform data from one version to the next:

```ts
const migrations: MigrationRule[] = [
    {
        key: "profile",
        fromVersion: 1,
        toVersion: 2,
        migrate: (value) => {
            const v1 = value as { name: string; email: string };
            return { ...v1, migratedAt: new Date().toISOString() };
        },
    },
];

const registry = createSchemaRegistry({
    schemas,
    migrations,
});
```

When a component reads a v1 profile from storage, Mnemonic automatically runs
the migration to produce a v2 value.

`createSchemaRegistry` validates duplicate schemas and ambiguous migration
graphs up front. If you need runtime schema registration for
`schemaMode="autoschema"`, keep a custom mutable `SchemaRegistry`
implementation instead of the immutable helper.

## Structural migration cookbook

For layout-like data, repeated migration steps often boil down to the same
patterns: find a node, insert a child once, rename an id, and dedupe siblings.
Mnemonic ships optional helpers for these common idempotent edits.

```ts
type LayoutNode = {
    id: string;
    title: string;
    children?: LayoutNode[];
};

const layoutMigration: MigrationRule = {
    key: "layout",
    fromVersion: 2,
    toVersion: 3,
    migrate: (value) => {
        const layout = value as LayoutNode;
        return dedupeChildrenBy(
            renameNode(
                insertChildIfMissing(layout, "sidebar", {
                    id: "search",
                    title: "Search",
                }),
                "prefs",
                "preferences",
            ),
            (node) => node.id,
        );
    },
};
```

The helper composition above is idempotent:

- `insertChildIfMissing` appends the child only once
- `renameNode` renames only when the source id exists and the target id is unused
- `dedupeChildrenBy` removes duplicate sibling ids while keeping the first match

If you want that layout rule included in the immutable registry, add it before
calling `createSchemaRegistry({ schemas, migrations: [...] })`.

If your tree shape uses fields other than `id` and `children`, provide a custom
adapter:

```ts
type WidgetNode = {
    key: string;
    label: string;
    nodes?: WidgetNode[];
};

const widgetTree: StructuralTreeHelpers<WidgetNode> = {
    getId: (node) => node.key,
    getChildren: (node) => node.nodes,
    withChildren: (node, children) => ({ ...node, nodes: children }),
    withId: (node, id) => ({ ...node, key: id }),
};

const migrated = renameNode(oldTree, "prefs", "preferences", widgetTree);
```

## Reconciliation vs. migration

Use a schema migration when the stored shape must move from one explicit schema
version to another. Use `reconcile` when you want to keep the stored shape but
selectively enforce newer application defaults or normalize a subset of fields
after decode and migration have already completed.

```tsx
const { value } = useMnemonicKey("profile", {
    defaultValue: { name: "", email: "", marketingOptIn: true },
    reconcile: (persisted, { persistedVersion, latestVersion }) => ({
        ...persisted,
        marketingOptIn: persistedVersion < (latestVersion ?? persistedVersion) ? true : persisted.marketingOptIn,
    }),
});
```

Mnemonic persists the reconciled value once when it changes, so subsequent
reads see the updated value directly.

## Write-time normalizers

A migration where `fromVersion === toVersion` runs on **every write**, acting as
a normalizer. This is useful for trimming whitespace, lowercasing strings, etc.

```ts
const normalizer: MigrationRule = {
    key: "name",
    fromVersion: 1,
    toVersion: 1,
    migrate: (value) => String(value).trim().toLowerCase(),
};
```

## Wiring it up

```tsx
<MnemonicProvider namespace="app" schemaMode="default" schemaRegistry={registry}>
    <ProfileEditor />
</MnemonicProvider>
```

## Pinning the write version

By default, writes use the **latest** registered schema for the key. You can pin
to a specific version during gradual rollouts:

```ts
const { value, set } = useMnemonicKey("profile", {
    defaultValue: { name: "", email: "" },
    schema: { version: 1 },
});
```

## Practical rule of thumb

- Use migrations for structural compatibility between versions.
- Use write-time normalizers for every-write cleanup like trimming or lowercasing.
- Use `reconcile` for conditional, read-time default enforcement that should not
  require a full key reset.
