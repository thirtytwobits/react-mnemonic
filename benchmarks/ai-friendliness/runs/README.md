# Evaluation Runs

Place real benchmark runs in this directory as `*.run.json`.

These runs are for fixed-model, multi-library comparisons and are the only
inputs used to generate public benchmark tables. Validation fixtures live under
`validation-fixtures/` and are never treated as publishable library results.

## Minimum run contents

Every run manifest must capture:

- the target library
- exact model metadata: provider, model ID, run date, and prompt-pack version
- one scenario entry per captured task
- transcript path
- submission directory
- follow-up prompt count
- first-attempt compile and test status
- optional reviewer notes path
- paired human review JSON

## Pilot path

Use `pilot.template.json` as the starting point for the first end-to-end run.
It is intentionally small so we can validate the workflow before attempting a
full five-library comparison on one model.

Once the pilot flow is stable:

1. duplicate the manifest for each library under the same fixed model
2. fill out the full scenario pack
3. complete the paired reviewer file
4. rerun `npm run benchmarks:ai`

Only after all benchmark libraries exist for the same model does the report
emit a publishable comparison table.
