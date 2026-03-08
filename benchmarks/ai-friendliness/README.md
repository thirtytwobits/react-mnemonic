# AI Friendliness Benchmark

This benchmark measures the core product claim behind `react-mnemonic`:
with a fixed coding model, can an agent build visible React UI and choose the
right persistence semantics with little or no user intervention?

It is intentionally repo-native. There is no off-the-shelf public benchmark
that measures "AI friendliness for persistence decisions" across React storage
libraries, so this benchmark defines that protocol directly.

## Comparison mode

- Primary axis: `libraries, fixed model`
- Libraries: `react-mnemonic`, `zustand/persist`, `jotai/atomWithStorage`,
  `use-local-storage-state`, and `usehooks-ts/useLocalStorage`
- Scoring mode: `hybrid`
- Validation fixtures stay in the repo as scorer tests and are never published
  as cross-library results

The benchmark assumes the agent-consumable surfaces from issues #29 and #30
exist and are stable: canonical `docs/ai/` guidance, instruction packs,
`llms.txt` exports, and prompt guardrails.

## Directory layout

- `meta.json`
  Benchmark-level metadata and the fixed library shortlist.
- `scenarios/`
  One manifest per scenario, including prompt, expected persistence decisions,
  critical failures, and allowed implementation shapes per library.
- `starters/`
  Starter React apps with visible UI and no persistence wired yet.
- `validation-fixtures/`
  Reference and negative-control runs used to validate the scorer.
- `runs/`
  Real model-run manifests for fixed-model comparisons.
- `rubric/`
  Human review template and rubric notes.
- `schema/`
  JSON Schemas for run manifests and human reviews.

## Scenarios

The current prompt pack covers the high-risk persistence semantics:

- durable theme plus cross-tab sync
- saved filters versus ephemeral search draft
- nullable clearable field (`set(null)`)
- wizard draft with migration plus reconcile
- SSR placeholder plus client hydration
- dismissed banner
- reset versus remove behavior

## Scoring

Each scenario produces:

- `automatedSemanticScore` (0-100)
- `humanReviewScore` (0-100)
- `interventionCost`
- `semanticScore = 0.7 * automatedSemanticScore + 0.3 * humanReviewScore`
- `interventionAdjustedScore = max(0, semanticScore - 12 * followUpPrompts)`

`oneShotPass` is true only when all of these hold:

- automated semantic score is at least `85`
- human review score is at least `75`
- follow-up prompts are `0`
- there are no critical failures

## Running the benchmark

1. Add or update any real evaluation manifests in `runs/*.run.json`.
2. Make sure every scenario entry points to a transcript and submission
   directory.
3. Fill in the paired human review JSON.
4. Run:

```bash
npm run build
npm run benchmarks:ai
```

The scorer validates manifests, checks referenced paths, scores validation and
evaluation runs, and writes the report to
`website/static/benchmarks/ai-friendliness-results.json`.

## Validation versus publishable results

The repo ships two validation runs on purpose:

- `validation-fixtures/reference`
  Ideal one-shot `react-mnemonic` submissions used to verify the harness can
  award full credit.
- `validation-fixtures/negative-control`
  Raw-`localStorage` anti-patterns used to verify the harness can detect the
  behaviors we do not want.

Those runs validate the benchmark itself. They are not public model-vs-library
claims.

Public comparison tables only appear once one fixed model has been run across
the full library shortlist with completed human review.

## Pilot workflow

Use `runs/pilot.template.json` and `runs/pilot-review.template.json` as the
end-to-end starting point for a first real model run. The pilot is intended to
prove the manifest, transcript, submission, and reviewer workflow before any
cross-library publication pass.
