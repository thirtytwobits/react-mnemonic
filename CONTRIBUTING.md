# Contributing to react-mnemonic

Thank you for your interest in contributing! This guide covers the development
workflow, project layout, and conventions you'll need to get started.

---

## Prerequisites

- **Node.js** >= 18 for library work, **Node.js** >= 20 for the docs site
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

| Command                  | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `npm run build`          | One-shot production build into `dist/`          |
| `npm run dev`            | Watch mode — rebuilds `dist/` on file changes   |
| `npm run test`           | Run the full Vitest test suite once             |
| `npm run test:consumers` | Pack the library and validate consumer fixtures |
| `npm run test:coverage`  | Run Vitest with LCOV + HTML coverage output     |
| `npm run test:watch`     | Run Vitest in watch mode                        |
| `npm run lint`           | Type-check with `tsc --noEmit`                  |
| `npm run format`         | Format all files with Prettier                  |
| `npm run format:check`   | Check formatting without writing                |

All commands are run from the **repository root**.

### Documentation site

The documentation is built with [Docusaurus](https://docusaurus.io/) and lives
in the `website/` directory. API reference pages are auto-generated from source
via [TypeDoc](https://typedoc.org/) + `docusaurus-plugin-typedoc`.

| Command                             | Description                                                |
| ----------------------------------- | ---------------------------------------------------------- |
| `npm run docs`                      | Generate standalone TypeDoc API docs into `docs/`          |
| `npm run docs:watch`                | TypeDoc in watch mode for live editing                     |
| `npm run docs:version -- <version>` | Snapshot the current docs as a released Docusaurus version |
| `npm run release:prepare -- <arg>`  | Bump the in-repo release version, cut docs, verify, commit |
| `npm run docs:site`                 | Build the full Docusaurus site (`website/build/`)          |
| `npm run docs:site:start`           | Start the Docusaurus dev server with hot reload            |

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

#### Cutting a docs version

The docs site now uses Docusaurus versioning:

- the latest released docs live at `/docs`
- unreleased work in `main` lives at `/docs/next`
- frozen snapshots live under `/docs/<version>`

To cut a new released docs snapshot:

```bash
npm run docs:version -- 1.5.0
```

That command:

1. regenerates the current API docs
2. regenerates the AI retrieval assets and instruction packs
3. snapshots the current docs tree into Docusaurus versioned docs

After running it:

- commit `website/versions.json`
- commit `website/versioned_docs/`
- commit `website/versioned_sidebars/`
- build the site with `npm run docs:site`
- merge to `main` so the normal docs deployment publishes the new version

Version names should match the package version you intend to release, without
the leading `v`. Tagging remains `vX.Y.Z`, but the docs version should be
`X.Y.Z`.

#### Preparing an in-repo release bump

To automate the local release-prep flow before tag and push:

```bash
npm run release:prepare -- 1.3.0
npm run release:prepare -- prerelease --preid beta
npm run release:prepare -- patch
```

This command:

1. requires a clean worktree
2. creates and switches to a local release branch named `release/v<version>`
3. bumps the package version and release-facing docs references
4. cuts the matching Docusaurus docs snapshot
5. runs the release verification checks
6. creates a local commit named `Prepare release v<version>`

It does not create a git tag, push to GitHub, publish to npm, or create a
GitHub release.

Bump-kind behavior follows `npm version`, including prerelease identifier
handling.

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

### Test layers

`react-mnemonic` relies on several complementary test layers, each aimed at
catching a different class of persistence failure:

- **Unit and integration tests** exercise the everyday hook, provider, SSR,
  schema, recovery, and devtools behavior.
- **Property-based tests** stress invariants that should hold across many
  generated inputs, such as JSON envelope round-trips and contiguous migration
  chains.
- **Malformed-envelope corpus and fuzz tests** focus on unknown or hostile
  persisted input so the read path keeps failing closed with predictable
  fallback behavior.
- **Consumer compatibility fixtures** pack the built library, install it into
  realistic consumer templates, and validate import/build/hydration behavior in
  app-like environments.

The consumer fixture runner is available as:

```bash
npm run test:consumers
```

Fixture templates live in `fixtures/consumers/` and are copied into a temporary
directory before installation so the repo stays clean.

### Coverage

```bash
npm run test:coverage
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

| File                      | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `index.ts`                | Public API barrel — all exports              |
| `Mnemonic/provider.tsx`   | `MnemonicProvider` context provider          |
| `Mnemonic/use.ts`         | `useMnemonicKey` hook                        |
| `Mnemonic/codecs.ts`      | `JSONCodec`, `createCodec`, `CodecError`     |
| `Mnemonic/json-schema.ts` | JSON Schema validation & compiled validators |
| `Mnemonic/schema.ts`      | Schema versioning, migration, `SchemaError`  |
| `Mnemonic/types.ts`       | Shared TypeScript types and interfaces       |

### Documentation site (`website/`)

| Path                    | Purpose                                |
| ----------------------- | -------------------------------------- |
| `docs/getting-started/` | Installation and quick-start guides    |
| `docs/guides/`          | In-depth feature guides                |
| `docs/api/`             | Auto-generated API reference (TypeDoc) |
| `src/pages/index.tsx`   | Landing page                           |
| `src/pages/demo.tsx`    | Interactive demo page                  |
| `src/components/demo/`  | Demo React components                  |
| `src/css/`              | Custom stylesheets                     |
| `docusaurus.config.ts`  | Site configuration                     |
| `sidebars.ts`           | Sidebar navigation                     |

## Making changes

1. **Create a branch** from `main`.
2. **Make your changes** — update source, tests, and documentation as needed.
3. **Run tests:** `npm run test`
4. **Run consumer fixtures when packaging behavior changes:** `npm run test:consumers`
5. **Type-check:** `npm run lint`
6. **Format:** `npm run format`
7. **Build the library:** `npm run build`
8. **Build the docs site** (if docs changed): `npm run docs:site`
9. **Commit** with a clear, imperative message (e.g., `Add schema migration guide`).
10. **Open a PR** with a concise summary and testing notes.

### PR checklist

- [ ] Tests pass (`npm run test`)
- [ ] Consumer fixtures pass when packaging/SSR integration changes (`npm run test:consumers`)
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
- **Package install test** — after the above passes, a matrix job packs the
  tarball and installs it with **npm**, **yarn**, and **pnpm** in parallel, then
  verifies ESM imports, CJS requires, and TypeScript type resolution
  (`moduleResolution: "nodenext"`).

### SonarQube Cloud

This repository relies on SonarQube Cloud automatic analysis instead of a
GitHub Actions scanner workflow.

Maintainer setup:

1. Import `thirtytwobits/react-mnemonic` into SonarQube Cloud.
2. In SonarQube Cloud project settings, enable automatic analysis for the
   repository.
3. Keep [`.sonarcloud.properties`](./.sonarcloud.properties)
   in sync with the intended automatic-analysis scope. This repository pins
   automatic analysis to `sonar.sources=src` and excludes `src/**/*.test.ts`
   and `src/**/*.test.tsx`, so website, docs, build output, and devtools files
   are excluded by scope rather than by broad path patterns.

Important tradeoff:

- Automatic analysis does not consume this repository's LCOV coverage output, so
  SonarQube coverage metrics are not populated from `npm run test:coverage`.
- Automatic analysis uses `.sonarcloud.properties`, not `sonar-project.properties`.
- Some automatic-analysis settings can also be changed in the SonarQube Cloud UI,
  but the repository should treat `.sonarcloud.properties` as the source of truth
  for version-controlled scope settings.

### Code Scanning (`codeql.yml`)

Runs on pushes to `main`, pull requests targeting `main`, and a weekly schedule:

- Analyzes the repository with GitHub CodeQL for `javascript-typescript`
- Uses `build-mode: none`, which is the supported mode for this interpreted codebase
- Scans the shipped library, docs-site source, docs tooling scripts, and the
  browser devtools extension

If GitHub's CodeQL default setup is already enabled in the repository settings,
disable it before relying on this workflow so the repository does not run two
separate CodeQL configurations.

### Documentation deployment (`deploy-docs.yml`)

Runs on push to `main`:

1. Installs root dependencies
2. Builds the library (`dist/`)
3. Installs website dependencies
4. Builds the Docusaurus site
5. Deploys to GitHub Pages

### Releases (`release.yml`)

Triggered by tagged releases matching `v*` (for example `v1.5.0` or
`v1.1.0`):

The repository-local prep flow happens before this via
`npm run release:prepare -- <version-or-bump-kind>`.

- Type-checks and format-checks the code
- Builds and tests the library
- Generates the API docs and builds the docs site
- Publishes every tagged release to the npm `latest` dist-tag
- Uses npm trusted publishing via GitHub OIDC instead of a long-lived publish token
- Includes npm provenance attestation

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE.md).
