---
sidebar_position: 1
title: Schema Modes
description: Choose how react-mnemonic validates and versions stored data.
---

# Schema Modes

Mnemonic supports optional schema versioning through the `schemaMode` prop on
`MnemonicProvider` and an optional `schemaRegistry`.

```tsx
<MnemonicProvider
  namespace="app"
  schemaMode="default"
  schemaRegistry={registry}
>
  <App />
</MnemonicProvider>
```

## Available modes

### `default`

Schemas are optional. Reads use a schema when one exists for the stored version,
otherwise the hook codec. Writes use the highest registered schema for the key;
if no schemas are registered, writes use an unversioned (v0) envelope.

This is the default mode — no configuration needed.

### `strict`

Every stored version **must** have a registered schema. Reads without a matching
schema fall back to `defaultValue` with a `SchemaError`. Writes require a
registered schema when any schemas exist, but fall back to a v0 envelope when
the registry has none.

```tsx
<MnemonicProvider namespace="app" schemaMode="strict" schemaRegistry={registry}>
  <App />
</MnemonicProvider>
```

### `autoschema`

Like `default`, but if no schema exists for a key, the first successful read
**infers and registers** a v1 schema automatically. Subsequent reads/writes use
that schema.

```tsx
<MnemonicProvider namespace="app" schemaMode="autoschema" schemaRegistry={registry}>
  <App />
</MnemonicProvider>
```

## Version zero

Version `0` is valid for schemas and migrations. Schemas at version `0` are
treated like any other version. An unregistered key defaults to version `0`.

## Registry immutability

In `default` and `strict` modes, the schema registry is treated as **immutable**
for the lifetime of the provider. The hook caches registry lookups to keep read
and write hot paths fast. To ship new schemas or migrations, publish a new app
version and remount the provider.

`autoschema` remains mutable because inferred schemas are registered at runtime.
