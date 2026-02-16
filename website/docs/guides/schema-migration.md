---
sidebar_position: 3
title: Schema Migration
description: Version your stored data and migrate between schema versions.
---

# Schema Migration

When your data shape changes between app versions, Mnemonic's schema registry
and migration rules handle the upgrade automatically.

## Schema registry

A schema registry stores versioned schemas for each key and resolves migration
paths to upgrade stored data. Schemas are plain JSON (serializable); migrations
are procedural functions.

```tsx
import {
  MnemonicProvider,
  useMnemonicKey,
  type SchemaRegistry,
  type KeySchema,
  type MigrationRule,
} from "react-mnemonic";

const schemas = new Map<string, KeySchema>();
const migrations: MigrationRule[] = [];

const registry: SchemaRegistry = {
  getSchema: (key, version) => schemas.get(`${key}:${version}`),
  getLatestSchema: (key) =>
    Array.from(schemas.values())
      .filter((schema) => schema.key === key)
      .sort((a, b) => b.version - a.version)[0],
  getMigrationPath: (key, fromVersion, toVersion) => {
    const byKey = migrations.filter((rule) => rule.key === key);
    const path: MigrationRule[] = [];
    let cur = fromVersion;
    while (cur < toVersion) {
      const next = byKey.find((rule) => rule.fromVersion === cur);
      if (!next) return null;
      path.push(next);
      cur = next.toVersion;
    }
    return path;
  },
  getWriteMigration: (key, version) => {
    return migrations.find(
      (r) => r.key === key && r.fromVersion === version && r.toVersion === version,
    );
  },
  registerSchema: (schema) => {
    const id = `${schema.key}:${schema.version}`;
    if (schemas.has(id)) throw new Error(`Schema already registered for ${id}`);
    schemas.set(id, schema);
  },
};
```

## Registering schemas

```ts
registry.registerSchema({
  key: "profile",
  version: 1,
  schema: {
    type: "object",
    properties: { name: { type: "string" }, email: { type: "string" } },
    required: ["name", "email"],
  },
});

registry.registerSchema({
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
});
```

## Adding migrations

Migrations define how to transform data from one version to the next:

```ts
migrations.push({
  key: "profile",
  fromVersion: 1,
  toVersion: 2,
  migrate: (value) => {
    const v1 = value as { name: string; email: string };
    return { ...v1, migratedAt: new Date().toISOString() };
  },
});
```

When a component reads a v1 profile from storage, Mnemonic automatically runs
the migration to produce a v2 value.

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
