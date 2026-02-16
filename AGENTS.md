# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the library source. Public exports are in `src/index.ts` and the main module lives in `src/Mnemonic/` (`provider.tsx`, `use.ts`, `codecs.ts`, `types.ts`, `json-schema.ts`, `schema.ts`).
- `example/` contains a Vite + React demo app that imports the library via `"file:.."`. It has its own `package.json`, `tsconfig.json`, and `vite.config.ts`.
- Build outputs are emitted to `dist/` (published via `package.json` `files`). **Rebuild `dist/` after source changes** (`npm run build`) before the example app or consumers can see them.
- Configuration lives at the repo root: `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `vitest.setup.ts`.
- `README.md` contains the public usage example.

## Build, Test, and Development Commands
- `npm run build` builds the package with `tsup` into `dist/`.
- `npm run dev` runs `tsup --watch` for continuous builds.
- `npm run test` runs the Vitest test suite once.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run storybook` starts Storybook at port `6006`.
- `npm run storybook:build` builds the static Storybook site.
- `npm run lint` runs TypeScript type-checking with `tsc --noEmit`.
- `npm run format` formats all files with Prettier.
- `npm run format:check` checks formatting without writing.
- `npm run docs` generates API documentation with TypeDoc into `docs/`.
- `npm run docs:watch` runs TypeDoc in watch mode for live preview.

## Coding Style & Naming Conventions
- TypeScript, ES modules (`"type": "module"`).
- Indentation: 4 spaces. Prefer explicit types on public APIs in `src/index.ts` and `src/Mnemonic/` exports.
- File naming: lower-case with `.ts`/`.tsx`; React hooks use `use*.ts` (example: `use.ts`).
- Keep exports centralized in `src/index.ts`.

## Testing Guidelines
- Test runner: Vitest (`vitest.config.ts`, `vitest.setup.ts`).
- Place tests alongside source or in `src/` with `.test.ts`/`.test.tsx` suffixes.
- Run all tests with `npm run test` and focus during development with `npm run test:watch`.

## Commit & Pull Request Guidelines
- No commit history exists yet. Use clear, imperative messages (e.g., `Add Mnemonic headers`).
- PRs should include a concise summary, testing notes (`npm run test`/`npm run lint`), and screenshots for UI changes (Storybook or rendered components).

## Release & Publishing
- Releases are handled by GitHub Actions on tagged releases. Tag format: `vX.Y.Z` (example: `v0.1.0`).
