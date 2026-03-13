# Interface: MnemonicDevToolsWeakRef\<T\>

Defined in: [src/Mnemonic/types.ts:295](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L295)

Weak-reference shape used by the devtools registry.

Matches the standard `WeakRef` API while keeping the public type surface
compatible with ES2020 TypeScript lib targets.

## Type Parameters

| Type Parameter         |
| ---------------------- |
| `T` _extends_ `object` |

## Properties

### deref()

> **deref**: () => `T` \| `undefined`

Defined in: [src/Mnemonic/types.ts:301](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L301)

Attempts to strengthen the weak reference.

#### Returns

`T` \| `undefined`

The live object, or undefined if it was garbage-collected.
