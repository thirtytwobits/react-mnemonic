# Type Alias: Unsubscribe()

> **Unsubscribe** = () => `void`

Defined in: [src/Mnemonic/types.ts:825](https://github.com/thirtytwobits/react-mnemonic/blob/72abee8960e1f53c871a1d44079dc2dc1b336261/src/Mnemonic/types.ts#L825)

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
