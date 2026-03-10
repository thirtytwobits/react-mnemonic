# react-mnemonic

AI-friendly, persistent, type-safe state for React.

[![npm version](https://img.shields.io/npm/v/react-mnemonic.svg)](https://www.npmjs.com/package/react-mnemonic)
[![docs](https://img.shields.io/badge/docs-online-0A7EA4.svg)](https://thirtytwobits.github.io/react-mnemonic/)
[![license](https://img.shields.io/npm/l/react-mnemonic.svg)](https://github.com/thirtytwobits/react-mnemonic/blob/main/LICENSE.md)

`react-mnemonic` gives your components persistent memory through a hook that feels like `useState`. Values survive reloads, can stay in sync across tabs, and remain SSR-safe by default. It is designed to be AI-friendly, prioritizing visible structure and unambiguous specifications. When you need more than raw storage, the package can validate, version, and migrate persisted data.

## Installation

```bash
npm install react-mnemonic
```

React 18 or later is required.

## Quick start

Wrap your app in a `MnemonicProvider`, then call `useMnemonicKey` anywhere
inside it.

```tsx
import { MnemonicProvider, useMnemonicKey } from "react-mnemonic/core";

function Counter() {
    const { value: count, set } = useMnemonicKey("count", {
        defaultValue: 0,
    });

    return (
        <div>
            <p>Count: {count}</p>
            <button onClick={() => set((c) => c + 1)}>Increment</button>
        </div>
    );
}

export default function App() {
    return (
        <MnemonicProvider namespace="my-app">
            <Counter />
        </MnemonicProvider>
    );
}
```

This persists the counter in `localStorage` as `my-app.count`, so the value
survives a full page reload.

## Why use it

- `useState`-like API: `useMnemonicKey` returns `{ value, set, reset, remove }`
- Namespaced persistence through `MnemonicProvider`
- Optional cross-tab synchronization
- SSR-safe defaults for server-rendered React apps
- Optional schema validation, versioning, migrations, and reconciliation
- Zero runtime dependencies with published TypeScript types

## Pick the right entrypoint

- `react-mnemonic/core` for the lean persisted-state path
- `react-mnemonic/schema` when you want schemas, validation, and migrations
- `react-mnemonic` if you need the backward-compatible root entrypoint

## AI resources

| Resource                                                                                          | Purpose                                                                           |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [AI Docs](https://thirtytwobits.github.io/react-mnemonic/docs/ai)                                 | Canonical invariants, decision matrix, recipes, anti-patterns, and setup guidance |
| [`llms.txt`](https://thirtytwobits.github.io/react-mnemonic/llms.txt)                             | Compact retrieval index for tight context windows                                 |
| [`llms-full.txt`](https://thirtytwobits.github.io/react-mnemonic/llms-full.txt)                   | Long-form export for indexing and larger prompt contexts                          |
| [`ai-contract.json`](https://thirtytwobits.github.io/react-mnemonic/ai-contract.json)             | Machine-readable persistence contract for tooling and agent integrations          |
| [DeepWiki priorities](https://github.com/thirtytwobits/react-mnemonic/blob/main/.devin/wiki.json) | Steering file that points DeepWiki toward the highest-signal sources              |
| [AI Assistant Setup](https://thirtytwobits.github.io/react-mnemonic/docs/ai/assistant-setup)      | Generated instruction packs plus the documented MCP-friendly retrieval path       |

## Learn more

- [Documentation home](https://thirtytwobits.github.io/react-mnemonic/)
- [Quick Start](https://thirtytwobits.github.io/react-mnemonic/docs/getting-started/quick-start)
- [Server Rendering](https://thirtytwobits.github.io/react-mnemonic/docs/guides/server-rendering)
- [Canonical Key Definitions](https://thirtytwobits.github.io/react-mnemonic/docs/guides/canonical-key-definitions)
- [Single Source of Truth Schemas](https://thirtytwobits.github.io/react-mnemonic/docs/guides/single-source-of-truth-schemas)
- [Schema Migration](https://thirtytwobits.github.io/react-mnemonic/docs/guides/schema-migration)
- [Auth-Aware Persistence](https://thirtytwobits.github.io/react-mnemonic/docs/guides/auth-aware-persistence)
- [Context7 Rankings](https://thirtytwobits.github.io/react-mnemonic/docs/guides/context7-rankings)
- [API Reference](https://thirtytwobits.github.io/react-mnemonic/docs/api)
- [AI Overview](https://thirtytwobits.github.io/react-mnemonic/docs/ai)

## License

[MIT](https://github.com/thirtytwobits/react-mnemonic/blob/main/LICENSE.md)
