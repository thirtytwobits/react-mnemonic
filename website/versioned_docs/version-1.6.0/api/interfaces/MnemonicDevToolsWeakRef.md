# Interface: MnemonicDevToolsWeakRef\<T\>

Defined in: [src/Mnemonic/types.ts:439](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L439)

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

Defined in: [src/Mnemonic/types.ts:445](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L445)

Attempts to strengthen the weak reference.

#### Returns

`T` \| `undefined`

The live object, or undefined if it was garbage-collected.
