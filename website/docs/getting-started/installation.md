---
sidebar_position: 1
title: Installation
description: Install react-mnemonic and its peer dependencies.
---

# Installation

## Package manager

Install the npm package:

```bash npm2yarn
npm install react-mnemonic
```

Install a specific version only when you need to pin your app to a particular
release line:

```bash
npm install react-mnemonic@1.3.0
```

## Peer dependencies

React 18 or later is required. CI verifies packaged-consumer installs against
React 18 and React 19.

```json
{
    "peerDependencies": {
        "react": ">=18",
        "react-dom": ">=18"
    }
}
```

## What's included

The package ships:

| Format | File              | Usage                                       |
| ------ | ----------------- | ------------------------------------------- |
| ESM    | `dist/index.js`   | Modern bundlers (Vite, esbuild, webpack 5+) |
| CJS    | `dist/index.cjs`  | Node.js / legacy bundlers                   |
| Types  | `dist/index.d.ts` | TypeScript declarations                     |

The library is tree-shakeable, has zero runtime dependencies, and is SSR-safe
by default. Without extra configuration, hooks render `defaultValue` on the
server and then hydrate to persisted storage on the client.
