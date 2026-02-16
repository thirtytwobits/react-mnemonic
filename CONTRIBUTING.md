# Contributing to react-mnemonic

Thank you for your interest in contributing! This guide covers the development
workflow, project layout, and conventions you'll need to get started.

---

## Prerequisites

- **Node.js** >= 18
- **npm** (ships with Node)
- A modern browser for running the documentation site locally

## Repository layout

```
├── src/                 # Library source (TypeScript)
│   ├── index.ts         # Public API barrel
│   └── Mnemonic/        # Core modules (provider, hook, codecs, schema, types)
├── dist/                # Build output (ESM + CJS + .d.ts) — git-ignored
├── website/             # Docusaurus documentation site
│   ├── docs/            # Markdown guides and auto-generated API reference
│   ├── src/             # Custom pages, components, and CSS
│   └── static/          # Images, logo, favicon
├── coverage/            # Test coverage reports — git-ignored
├── tsconfig.json        # TypeScript config (library)
├── tsup.config.ts       # tsup bundler config
├── vitest.config.ts     # Vitest test runner config
├── vitest.setup.ts      # Vitest setup file
└── typedoc.json         # TypeDoc config for API docs
```

The Docusaurus site in `website/` has its own `package.json` and
`package-lock.json`. It references the library via `"react-mnemonic": "file:.."`,
so **you must build the library before installing website dependencies**.

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/thirtytwobits/react-mnemonic.git
cd react-mnemonic
npm install
```

### 2. Build the library

```bash
npm run build
```

This runs `tsup` and produces `dist/` with ESM, CJS, and TypeScript
declaration files. You must rebuild after any source change before the
documentation site can pick it up.

### 3. Install the documentation site

```bash
cd website
npm install
cd ..
```

## Development workflows

### Library development

| Command               | Description                                    |
| --------------------- | ---------------------------------------------- |
| `npm run build`       | One-shot production build into `dist/`         |
| `npm run dev`         | Watch mode — rebuilds `dist/` on file changes  |
| `npm run test`        | Run the full Vitest test suite once            |
| `npm run test:watch`  | Run Vitest in watch mode                       |
| `npm run lint`        | Type-check with `tsc --noEmit`                 |
| `npm run format`      | Format all files with Prettier                 |
| `npm run format:check`| Check formatting without writing               |

All commands are run from the **repository root**.

### Documentation site

The documentation is built with [Docusaurus](https://docusaurus.io/) and lives
in the `website/` directory. API reference pages are auto-generated from source
via [TypeDoc](https://typedoc.org/) + `docusaurus-plugin-typedoc`.

| Command                  | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `npm run docs`           | Generate standalone TypeDoc API docs into `docs/`  |
| `npm run docs:watch`     | TypeDoc in watch mode for live editing             |
| `npm run docs:site`      | Build the full Docusaurus site (`website/build/`)  |
| `npm run docs:site:start`| Start the Docusaurus dev server with hot reload    |

**Important:** The Docusaurus site depends on the built library. Always run
`npm run build` at the root before building or starting the site.

#### Typical docs workflow

```bash
# Terminal 1 — rebuild library on changes
npm run dev

# Terminal 2 — Docusaurus dev server
npm run docs:site:start
```

The dev server runs at `http://localhost:3000/react-mnemonic/` by default and
hot-reloads on changes to `website/docs/`, `website/src/`, and
`website/static/`.

#### Interactive demo

The site includes a `/demo` page with live interactive examples built as native
React components. The demo source is in `website/src/components/demo/` and the
page itself is at `website/src/pages/demo.tsx`. These components import
`react-mnemonic` directly, so changes require a library rebuild.

## Testing

Tests use [Vitest](https://vitest.dev/) with `jsdom` as the DOM environment.
Test files live alongside their source files with a `.test.ts` or `.test.tsx`
suffix.

```bash
# Run once
npm run test

# Watch mode (re-runs on file changes)
npm run test:watch
```

### Coverage

```bash
npx vitest run --coverage
```

Coverage reports (HTML + LCOV) are written to `coverage/`.

## Code style

- **Language:** TypeScript, ES modules (`"type": "module"`)
- **Indentation:** 4 spaces
- **Formatter:** Prettier (run `npm run format` before committing)
- **File naming:** lowercase with `.ts` / `.tsx` extensions; React hooks use
  `use*.ts`
- **Exports:** keep public API centralized in `src/index.ts`
- **Types:** prefer explicit types on public API surfaces

## Project architecture

### Library (`src/`)

| File                   | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `index.ts`             | Public API barrel — all exports                      |
| `Mnemonic/provider.tsx`| `MnemonicProvider` context provider                  |
| `Mnemonic/use.ts`      | `useMnemonicKey` hook                                |
| `Mnemonic/codecs.ts`   | `JSONCodec`, `createCodec`, `CodecError`             |
| `Mnemonic/json-schema.ts` | JSON Schema validation & compiled validators      |
| `Mnemonic/schema.ts`   | Schema versioning, migration, `SchemaError`          |
| `Mnemonic/types.ts`    | Shared TypeScript types and interfaces               |

### Documentation site (`website/`)

| Path                          | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| `docs/getting-started/`       | Installation and quick-start guides      |
| `docs/guides/`                | In-depth feature guides                  |
| `docs/api/`                   | Auto-generated API reference (TypeDoc)   |
| `src/pages/index.tsx`         | Landing page                             |
| `src/pages/demo.tsx`          | Interactive demo page                    |
| `src/components/demo/`        | Demo React components                    |
| `src/css/`                    | Custom stylesheets                       |
| `docusaurus.config.ts`        | Site configuration                       |
| `sidebars.ts`                 | Sidebar navigation                       |

## Making changes

1. **Create a branch** from `main`.
2. **Make your changes** — update source, tests, and documentation as needed.
3. **Run tests:** `npm run test`
4. **Type-check:** `npm run lint`
5. **Format:** `npm run format`
6. **Build the library:** `npm run build`
7. **Build the docs site** (if docs changed): `npm run docs:site`
8. **Commit** with a clear, imperative message (e.g., `Add schema migration guide`).
9. **Open a PR** with a concise summary and testing notes.

### PR checklist

- [ ] Tests pass (`npm run test`)
- [ ] Type-check passes (`npm run lint`)
- [ ] Code is formatted (`npm run format:check`)
- [ ] Library builds cleanly (`npm run build`)
- [ ] Documentation site builds (if applicable): `npm run docs:site`
- [ ] New public APIs are exported from `src/index.ts`
- [ ] New features include tests

## CI / CD

### Continuous Integration (`ci.yml`)

Runs on every push and pull request:
- Installs dependencies
- Type-checks with `tsc --noEmit` (`npm run lint`)
- Checks formatting with Prettier (`npm run format:check`)
- Builds the library (`npm run build`)
- Runs the test suite (`npm run test`)

### Documentation deployment (`deploy-docs.yml`)

Runs on push to `main`:
1. Installs root dependencies
2. Builds the library (`dist/`)
3. Installs website dependencies
4. Builds the Docusaurus site
5. Deploys to GitHub Pages

### Releases (`release.yml`)

Triggered by tagged releases matching `vX.Y.Z`:
- Publishes to npm

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE.md).
