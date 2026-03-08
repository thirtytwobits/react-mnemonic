# AI Friendliness Benchmark

This benchmark measures the behavior that matters most for
`react-mnemonic`:

- can an agent choose persistence without the user asking for
  `localStorage` directly?
- can it keep transient UI state out of persistence?
- can it preserve the semantic difference between `set(null)`, `remove()`,
  and `reset()`?
- can it select the right SSR and schema-evolution tools without extra user
  coaching?

The benchmark assumes the agent-consumable surfaces described by issues #29
and #30 are available: canonical `docs/ai/` content, agent instruction packs,
`llms.txt` exports, and prompt guardrails.

## Primary metrics

- `oneShotPassRate`: percent of scenarios that pass with zero follow-up prompts
- `meanFollowUpPrompts`: average extra prompts required after the initial user
  request
- `semanticScore`: percent of persistence semantics satisfied before
  intervention penalties
- `interventionAdjustedScore`: semantic score minus a per-follow-up penalty

## Protocol

1. Pick a run manifest from `benchmarks/ai-friendliness/runs/`, or author a new
   one for the model you want to evaluate.
2. Each scenario points to a submission directory containing the files produced
   by the agent for that task.
3. Run:

```bash
npm run build
npm run benchmarks:ai
```

The scorer writes `website/static/benchmarks/ai-friendliness-results.json`.

## Included validation runs

- `reference-react-mnemonic.json`
    - ideal one-shot submissions using canonical mnemonic patterns
- `negative-control-localstorage.json`
    - intentionally naive raw-`localStorage` submissions showing the failure mode

These are scorer-validation fixtures, not claims about a specific model.
