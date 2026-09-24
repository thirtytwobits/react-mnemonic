# Type Alias: Unsubscribe()

> **Unsubscribe** = () => `void`

Defined in: [src/Mnemonic/types.ts:978](https://github.com/thirtytwobits/react-mnemonic/blob/5dd792d6e056ac2a6094081133428cfe73e4a5b3/src/Mnemonic/types.ts#L978)

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
