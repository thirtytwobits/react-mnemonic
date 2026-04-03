---
sidebar_position: 6
title: AI Assistant Setup
description: How to expose react-mnemonic's canonical docs to coding assistants, DeepWiki, and MCP-based tooling.
---

# AI Assistant Setup

This page explains how users and agent builders should expose `react-mnemonic`
to coding assistants.

## Canonical Source

The canonical AI-oriented source is this docs section:

- `/docs/ai`
- `/docs/ai/invariants`
- `/docs/ai/decision-matrix`
- `/docs/ai/recipes`
- `/docs/ai/anti-patterns`

Everything else is a companion surface:

- [`/llms.txt`](/llms.txt) for compact retrieval
- [`/llms-full.txt`](/llms-full.txt) for long-form export
- [`/ai-contract.json`](/ai-contract.json) for machine-readable summaries
- [`context7.json`](https://github.com/thirtytwobits/react-mnemonic/blob/main/context7.json) for Context7 library-owner indexing
- repository instruction packs for Codex, Claude Code, Cursor, and Copilot
- [`.devin/wiki.json`](https://github.com/thirtytwobits/react-mnemonic/blob/main/.devin/wiki.json) for DeepWiki prioritization

## Generated Instruction Packs

The repo also ships first-party instruction packs generated from the canonical
AI docs:

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/rules/react-mnemonic-persistence.md`
- `.claude/rules/durable-state-checklist.md`
- `.cursor/rules/react-mnemonic-persistence.mdc`
- `.cursor/rules/react-mnemonic-docs.mdc`
- `.github/copilot-instructions.md`
- `.github/instructions/react-mnemonic-persistence.instructions.md`
- `.github/instructions/react-mnemonic-docs.instructions.md`

Those files are projections over the same persistence contract rather than
independent sources of truth.

## Lowest-Friction Retrieval

When an assistant has only HTTP or search access, give it these URLs first:

1. [`/llms.txt`](/llms.txt)
2. [`/docs/ai`](/docs/ai)
3. [`/llms-full.txt`](/llms-full.txt)
4. [`/ai-contract.json`](/ai-contract.json)

That ordering keeps the first context window compact while still leaving a
long-form export available when the task is more complex.

## DeepWiki

The repo ships [`.devin/wiki.json`](https://github.com/thirtytwobits/react-mnemonic/blob/main/.devin/wiki.json)
to steer DeepWiki toward the files that matter most for correct persistence
behavior:

- canonical AI docs
- `README.md`
- the public export surface in `src/index.ts`
- the hook, provider, and type definitions that define runtime semantics
- the deeper guides for migrations, SSR, clearable values, and custom storage

If you re-index the repository, keep that file up to date with any future
source-of-truth moves.

## Validated MCP-Friendly Path

The lowest-friction MCP setup is exposing this repository through a
filesystem-capable MCP server or any equivalent local-docs MCP layer.

Mount these paths:

- `website/docs/ai/index.md`
- `website/docs/ai/invariants.md`
- `website/docs/ai/decision-matrix.md`
- `website/docs/ai/recipes.md`
- `website/docs/ai/anti-patterns.md`
- `website/static/llms.txt`
- `website/static/llms-full.txt`
- `website/static/ai-contract.json`
- `src/Mnemonic/use.ts`
- `src/Mnemonic/provider.tsx`
- `src/Mnemonic/types.ts`

Why this path is validated:

- the website build regenerates `llms.txt`, `llms-full.txt`, and `ai-contract.json` before Docusaurus runs
- the generation step fails fast if any canonical AI source file is missing
- the docs build already fails on broken links, so the published AI entry points stay connected to the site navigation

This gives an MCP client both the compact docs surfaces and the source files
that define the contract underneath them.

## Hosted Retrieval Path

If your assistant can fetch remote files, use the published GitHub Pages URLs:

- `https://thirtytwobits.github.io/react-mnemonic/llms.txt`
- `https://thirtytwobits.github.io/react-mnemonic/llms-full.txt`
- `https://thirtytwobits.github.io/react-mnemonic/ai-contract.json`
- `https://thirtytwobits.github.io/react-mnemonic/docs/1.5.0`

Use the hosted path when you want versioned, read-only retrieval without
mounting the repository locally.

## Versioned Docs Behavior

The site now uses Docusaurus versioned docs:

- the latest released docs live at `/docs`
- unreleased work from `main` lives at `/docs/next`
- released snapshots live at `/docs/<version>`

Example released path:

- `https://thirtytwobits.github.io/react-mnemonic/docs/1.2.0-beta1`

Current AI retrieval surfaces remain latest-only:

- `/llms.txt`
- `/llms-full.txt`
- `/ai-contract.json`

That means version-specific AI retrieval should currently use the versioned docs
pages themselves rather than the root `llms` exports. Version-specific `llms`
surfaces can be added later if they become necessary.

## Maintenance

Keep the surfaces aligned this way:

- edit the canonical prose in `website/docs/ai/*`
- regenerate companion assets and instruction packs via `npm run docs:ai`
- cut new released doc snapshots via `npm run docs:version -- <version>` when needed
- use `npm run ai:check` in CI or before commits to catch drift in generated AI artifacts and instruction packs
- keep `context7.json` aligned with the same high-signal docs and public API entry points
- keep the DeepWiki priorities in `.devin/wiki.json` aligned with the same sources

The goal is simple: agents should load one canonical contract and then choose
the right persistence behavior without inventing missing semantics.
