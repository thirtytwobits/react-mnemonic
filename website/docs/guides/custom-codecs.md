---
sidebar_position: 4
title: Custom Codecs
description: Serialize non-JSON types with custom codecs.
---

# Custom Codecs

The default codec is `JSONCodec`, which handles all JSON-serializable values.
You can create custom codecs using `createCodec` for types that need special
serialization (e.g., `Date`, `Set`, `Map`).

:::warning
Using a custom codec **bypasses JSON Schema validation**. The codec is a
low-level escape hatch for when you need full control over serialization.
:::

## Creating a codec

```ts
import { createCodec } from "react-mnemonic";

const DateCodec = createCodec<Date>(
  (date) => date.toISOString(),       // encode: Date → string
  (str) => new Date(str),             // decode: string → Date
);
```

## Using a codec

Pass the codec in the `codec` option:

```ts
const { value, set } = useMnemonicKey<Date>("lastVisit", {
  defaultValue: new Date(),
  codec: DateCodec,
});
```

## The `Codec<T>` interface

You can also create a codec by implementing the interface directly:

```ts
import type { Codec } from "react-mnemonic";

const SetCodec: Codec<Set<string>> = {
  encode: (s) => JSON.stringify([...s]),
  decode: (raw) => new Set(JSON.parse(raw)),
};
```

## Error handling

If `encode` or `decode` throws, Mnemonic wraps the error in a `CodecError`.
When reading, the `defaultValue` factory receives the error so you can log or
recover:

```ts
import { useMnemonicKey, CodecError } from "react-mnemonic";

const { value } = useMnemonicKey("data", {
  defaultValue: (error) => {
    if (error instanceof CodecError) {
      console.warn("Decode failed:", error.message);
    }
    return fallback;
  },
  codec: myCodec,
});
```
