# Interface: MnemonicDevToolsWeakRef\<T\>

Defined in: [src/Mnemonic/types.ts:295](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L295)

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

Defined in: [src/Mnemonic/types.ts:301](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L301)

Attempts to strengthen the weak reference.

#### Returns

`T` \| `undefined`

The live object, or undefined if it was garbage-collected.
