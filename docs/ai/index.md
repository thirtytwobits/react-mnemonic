# AI Integration Notes

This folder is the compact agent-facing context for `react-mnemonic`.

Use these files when preparing prompts, instruction packs, or retrieval context
for coding agents:

- `quick-rules.md`
  The shortest set of rules agents should follow before writing code.

Primary rule:

- Do not invent local `.d.ts` files or ambient module declarations for
  `react-mnemonic`. The package already ships published types and exported type
  names.

If an agent appears unsure about available types or exports:

1. Check the package root exports in `src/index.ts`.
2. Check the published `types` / `exports` fields in `package.json`.
3. Check the AI contract and API docs before generating shims.
