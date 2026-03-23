# Interface: MnemonicDevToolsWeakRef\<T\>

Defined in: [src/Mnemonic/types.ts:371](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L371)

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

Defined in: [src/Mnemonic/types.ts:377](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L377)

Attempts to strengthen the weak reference.

#### Returns

`T` \| `undefined`

The live object, or undefined if it was garbage-collected.
