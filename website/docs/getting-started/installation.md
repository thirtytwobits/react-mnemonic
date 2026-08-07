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

## Published entrypoints

The package publishes multiple subpath entrypoints so apps can pay for the
surface they actually use:

| Import path                | Primary ESM file    | Approx ESM size | Use when                                                                         |
| -------------------------- | ------------------- | --------------- | -------------------------------------------------------------------------------- |
| `react-mnemonic`           | `dist/index.js`     | ~84.6 KB        | You want the top-level full entrypoint                                           |
| `react-mnemonic/core`      | `dist/core.js`      | ~65.3 KB        | A provider is required and you want the lean persisted-state path                |
| `react-mnemonic/schema`    | `dist/schema.js`    | ~84.6 KB        | You want schema validation, autoschema, and migrations                           |
| `react-mnemonic/optional`  | `dist/optional.js`  | ~5.2 KB         | A reusable component should persist when a provider exists and fall back locally |
| `react-mnemonic/bootstrap` | `dist/bootstrap.js` | ~24.5 KB        | You need synchronous recall before React first renders                           |

These are rough current estimates from the built ESM entry files in `dist/`
before consumer-side minification and tree-shaking. They are useful for
relative comparison, not as a hard size guarantee.
