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

| Class         | When thrown                                                             |
| ------------- | ----------------------------------------------------------------------- |
| `CodecError`  | Encoding or decoding fails (custom codec)                               |
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

| Code                           | Meaning                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| `INVALID_ENVELOPE`             | Stored JSON doesn't match the envelope format                    |
| `SCHEMA_NOT_FOUND`             | No schema is registered for the stored key/version               |
| `WRITE_SCHEMA_REQUIRED`        | Strict-mode writes require a schema, but none could be resolved  |
| `MIGRATION_PATH_NOT_FOUND`     | No contiguous migration path exists to the latest schema         |
| `MIGRATION_FAILED`             | A migration or write-time normalizer threw                       |
| `MIGRATION_GRAPH_INVALID`      | A schema registry helper was created with an invalid graph       |
| `RECONCILE_FAILED`             | A `reconcile` hook threw or returned an unpersistable value      |
| `SCHEMA_REGISTRATION_CONFLICT` | A schema registration conflicted with an existing definition     |
| `TYPE_MISMATCH`                | The decoded value failed JSON Schema validation                  |
| `MODE_CONFIGURATION_INVALID`   | The active schema mode is missing a required registry capability |

## Reconciliation failures

If a `reconcile` hook throws a `SchemaError`, that error is passed through to
`defaultValue` unchanged. Any other thrown error is normalized to a
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

The console is the default signal, not the only one: pass
[`onStorageError`](#being-told-when-a-write-is-dropped) to the provider to
receive these failures programmatically.

```tsx
const { set } = useMnemonicKey("profile", {
    defaultValue: { name: "", email: "" },
});

// If this fails schema validation, it's logged but not thrown.
// The stored value remains unchanged.
set({ name: "", email: "not-an-email" });
```

## Unpersisted writes

A storage backend can accept a value one moment and reject the next — the usual
cause is the origin hitting its quota, but a blocked origin or a browser with no
usable storage behaves the same way. In every case the write still updates the
in-memory cache and re-renders subscribers, so `set(...)` looks exactly like a
successful one. Nothing about the returned state tells you the value never left
memory.

`useMnemonicRecovery()` exposes the two operations that make this recoverable:

```tsx
import { useMnemonicRecovery } from "react-mnemonic";

function SaveIndicator() {
    const { unpersistedKeys, flush } = useMnemonicRecovery();
    const pending = unpersistedKeys();

    if (pending.length === 0) return <span>Saved</span>;

    return (
        <button
            onClick={() => {
                const { persisted, failed } = flush();
                console.info("Recovered", persisted, "still failing", failed);
            }}
        >
            {pending.length} unsaved {pending.length === 1 ? "change" : "changes"} — retry
        </button>
    );
}
```

- `unpersistedKeys()` lists unprefixed keys whose current value is not known to
  be in storage. It does not require an enumerable backend.
- `flush(keys?)` re-attempts those writes and returns
  `{ persisted, failed }`. Keys with nothing queued are ignored rather than
  rewritten.

A key stops being reported once it is written successfully, once a flush
persists it, or once an external change reloads it from storage. Failed writes
are kept rather than rolled back: the value the user just produced is the one
worth keeping, and rolling it back would discard work that is still
recoverable.

A key is only reported when storage is observed to disagree with what the
provider is serving. A rejected write of a value storage already holds — a
cross-tab echo, or a `reset()` to the value already on disk — is not reported,
so a durable key never shows up as unsaved.

The queue holds one entry per distinct key, not per write: repeated failures on
the same key replace the entry and release the superseded value. What it retains
is normally the same string the provider's cache already holds, so a dropped
write costs a map entry rather than a second copy of the payload.

Freeing space does not retry anything on its own. If your app evicts its own
data — or the user clears something — call `flush()` afterwards, or the pending
values stay in memory until the page unloads.

## Being told when a write is dropped

`unpersistedKeys()` answers "is anything unsaved right now?", which means
something has to think to ask. `onStorageError` is the push half: the provider
calls it the moment a mutation is dropped, so the app can react without polling.

```tsx
<MnemonicProvider
    namespace="app"
    onStorageError={(event) => {
        if (event.reason === "quota") {
            toast.error("Out of space — your changes are not being saved.");
        }
        telemetry.record("mnemonic_write_dropped", {
            key: event.key,
            reason: event.reason,
        });
    }}
>
    <App />
</MnemonicProvider>
```

The event describes the mutation that was dropped:

| Field       | Meaning                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| `key`       | Unprefixed key, as written in application code                               |
| `operation` | `"set"` or `"remove"`. `reset()` reports as `"set"`                          |
| `reason`    | `"quota"`, `"access"`, `"schema"`, `"codec"`, `"contract"`, or `"unknown"`   |
| `error`     | What was thrown, or `undefined` when nothing was                             |
| `bytes`     | Approximate size of the value that could not be written; absent for removals |

`reason` is worth branching on, because the reasons are not equally actionable:

- **`"quota"`** — storage is full. The user can do something about this, so it
  is the case worth surfacing in the UI.
- **`"access"`** — the backend refused for another reason, such as a
  `SecurityError` on a blocked origin, or there is no usable backend at all.
  When there was no backend, `error` is `undefined`.
- **`"schema"`** and **`"codec"`** — the value was rejected before storage was
  ever called. These are application bugs, not environment problems.
- **`"contract"`** — a `StorageLike` returned a Promise. Writes stay disabled
  for the rest of the provider's life, so every later mutation reports this. It
  means the adapter is broken; see
  [Custom storage adapters](./custom-storage.md).
- **`"unknown"`** — an unclassified failure. Treat it like `"access"`.

Three details matter when writing the handler:

- **It fires on every dropped mutation.** The matching console messages are
  logged once and then squelched; this callback is not, so you can count
  failures or track them per key. Debounce in the handler if you are driving a
  toast from it.
- **It only fires for writes that were actually dropped.** A rejected write that
  storage turns out to already satisfy is not reported, exactly as it is not
  queued by `unpersistedKeys()`. The two channels agree.
- **It runs synchronously inside the mutation**, after the cache is updated and
  subscribers are notified, so the handler sees a fully applied write. Throwing
  is contained and logged once; writing to the store from inside it is not
  recommended, and a nested failure is dropped rather than reported so it cannot
  recurse.

A `flush()` retry that fails reports here too, so a provider-level handler does
not have to reconcile two channels to learn that a key is still not saved.

## Development diagnostics

In development builds, Mnemonic also emits a small set of targeted warnings for
likely configuration mistakes. These warnings are intentionally high-signal and
include the recommended fix.

| Warning shape                                                          | What it means                                                                                     | Recommended fix                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `listenCrossTab` on a backend without external notifications           | The current storage backend cannot actually deliver cross-tab updates                             | Use `localStorage` or implement `storage.onExternalChange(...)` on the custom backend                       |
| Custom `codec` combined with `schema.version`                          | Schema-managed reads/writes do not use the codec serialization path                               | Remove the codec for schema-managed keys, or remove `schema.version` if you intended codec-only persistence |
| Same key declared with conflicting contracts in one provider namespace | Different components disagree about the persisted shape/defaults/options for the same logical key | Reuse a shared descriptor with `defineMnemonicKey(...)` or align the options                                |
| `clearAll()` / `clearMatching()` on a non-enumerable backend           | Namespace-wide recovery cannot list keys automatically                                            | Use `clearKeys([...])` with an explicit key list, or supply a backend with `length` and `key(index)`        |
