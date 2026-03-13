# Type Alias: Unsubscribe()

> **Unsubscribe** = () => `void`

Defined in: [src/Mnemonic/types.ts:825](https://github.com/thirtytwobits/react-mnemonic/blob/4e29aab8931ffb8dacc7fc006858a4afc3aa754c/src/Mnemonic/types.ts#L825)

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
