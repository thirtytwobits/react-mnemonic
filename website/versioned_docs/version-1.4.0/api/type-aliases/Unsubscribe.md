# Type Alias: Unsubscribe()

> **Unsubscribe** = () => `void`

Defined in: [src/Mnemonic/types.ts:901](https://github.com/thirtytwobits/react-mnemonic/blob/eef3c7a84a13b1b7f1efc5357bfeaf99c6da633d/src/Mnemonic/types.ts#L901)

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
