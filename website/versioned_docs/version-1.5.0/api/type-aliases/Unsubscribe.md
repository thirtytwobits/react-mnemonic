# Type Alias: Unsubscribe()

> **Unsubscribe** = () => `void`

Defined in: [src/Mnemonic/types.ts:901](https://github.com/thirtytwobits/react-mnemonic/blob/3d4c1335713c03f2ad6638beac59d49e4f374c59/src/Mnemonic/types.ts#L901)

Function type for unsubscribing from event listeners.

Call this function to remove a subscription and stop receiving updates.

## Returns

`void`

## Example

```typescript
const unsubscribe = store.subscribeRaw("user", () => console.log("Updated!"));
// Later...
unsubscribe(); // Stop listening
```
