# Reviewer Rubric

Every scored run must include a human review JSON file using
`reviewer-template.json`.

Reviewers score each scenario from 1-5 on:

- `persistenceAppropriateness`
- `semanticNuanceCorrectness`
- `unnecessaryUserIntervention`

Mark `criticalSemanticMiss` as `true` when the run fundamentally violates the
prompt's persistence semantics even if other parts are correct.

The benchmark normalizes the three rubric dimensions to a 0-100
`humanReviewScore`.
