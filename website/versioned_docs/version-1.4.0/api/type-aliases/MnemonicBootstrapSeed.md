# Type Alias: MnemonicBootstrapSeed\<TValues\>

> **MnemonicBootstrapSeed**\<`TValues`\> = `object`

Defined in: [src/Mnemonic/types.ts:288](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L288)

Initial bootstrap seed for a provider's in-memory cache.

This is primarily used with `recallMnemonic(...)` from
`react-mnemonic/bootstrap`, allowing apps to synchronously recall values
before React renders and then hand the raw snapshot to `MnemonicProvider`
so the first hook read does not hit storage again.

The provider currently consumes `raw` to seed its internal cache. `values`
are included so callers can carry the same snapshot object through app
initialization without splitting it apart.

## Type Parameters

| Type Parameter                                      | Default type                    | Description                                    |
| --------------------------------------------------- | ------------------------------- | ---------------------------------------------- |
| `TValues` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`string`, `unknown`\> | Decoded values keyed by unprefixed storage key |

## Properties

### raw?

> `optional` **raw**: `Record`\<`string`, `string` \| `null`\>

Defined in: [src/Mnemonic/types.ts:302](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L302)

Raw storage strings keyed by the unprefixed mnemonic key name.

Only keys that were read successfully should appear here.

A present `null` entry means the key was confirmed absent when the
bootstrap snapshot was taken. Providers may still choose to revalidate
that absence on first access, so only non-null string entries are
guaranteed to short-circuit an initial storage read.

If storage was unavailable or unreadable during bootstrap, omit the key
entirely so the provider can retry a normal read later.

---

### values?

> `optional` **values**: `TValues`

Defined in: [src/Mnemonic/types.ts:311](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L311)

Decoded values recalled during the bootstrap step.

The provider stores raw snapshots internally, but retaining the decoded
values on the same object is convenient for app-level boot code such as
first-paint theme application.
