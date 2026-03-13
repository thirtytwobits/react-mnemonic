---
sidebar_position: 10
title: Multi-Step Form Wizards
description: Persist durable wizard draft data while keeping navigation, validation, and submission state ephemeral.
---

# Multi-Step Form Wizards

`react-mnemonic` is a strong fit for multi-step flows as long as the persistence
boundary stays intentional. Persist the user-authored draft that should survive
reload. Keep step navigation, validation errors, and submission lifecycle state
in plain React state unless resuming those exact runtime details is a product
requirement.

## Recommended state split

| Concern                                                  | Recommended home                                     | Why                                          |
| -------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| Draft values entered across steps                        | `useMnemonicKey(...)`                                | Users expect authored data to survive reload |
| Active step id                                           | `useState(...)` by default                           | Navigation position is usually runtime-only  |
| Completed step badges                                    | Derive from persisted draft plus validation rules    | Avoids duplicated state that can drift       |
| Step-local errors, touched flags, submit-in-flight state | `useState(...)`                                      | These should usually reset with the session  |
| Resume position or resume token                          | Persist only if explicit resume behavior is required | Makes resume semantics intentional           |

If the product really must reopen the wizard on the exact same step after a
reload, persist that state separately and document it as a deliberate resume
feature. Do not bundle transient UI details into the durable draft by default.

## End-to-end example

This example shows:

- a persisted wizard draft
- guarded next and back navigation
- a conditional business-only step
- step-specific validation on `Next`
- full validation on final submit
- cross-step dependency cleanup when account type changes

```tsx
import { useEffect, useState } from "react";
import { defineMnemonicKey, MnemonicProvider, useMnemonicKey } from "react-mnemonic";

type StepId = "account" | "business" | "profile" | "plan" | "review";
type AccountType = "personal" | "business";
type Plan = "starter" | "growth";

type OnboardingDraft = {
    accountType: AccountType;
    companyName: string | null;
    fullName: string;
    email: string;
    teamSize: number;
    plan: Plan;
    acceptedTerms: boolean;
};

const onboardingDraftKey = defineMnemonicKey("onboarding-draft", {
    defaultValue: {
        accountType: "personal" as AccountType,
        companyName: null,
        fullName: "",
        email: "",
        teamSize: 1,
        plan: "starter" as Plan,
        acceptedTerms: false,
    },
    listenCrossTab: true,
});

const stepLabels: Record<StepId, string> = {
    account: "Account",
    business: "Business details",
    profile: "Profile",
    plan: "Plan",
    review: "Review",
};

function getSteps(draft: OnboardingDraft): StepId[] {
    return draft.accountType === "business"
        ? ["account", "business", "profile", "plan", "review"]
        : ["account", "profile", "plan", "review"];
}

function validateStep(stepId: StepId, draft: OnboardingDraft): string[] {
    switch (stepId) {
        case "account":
            return [];
        case "business":
            return draft.accountType === "business" && !draft.companyName?.trim()
                ? ["Company name is required for business accounts."]
                : [];
        case "profile": {
            const errors: string[] = [];
            if (!draft.fullName.trim()) {
                errors.push("Full name is required.");
            }
            if (!draft.email.includes("@")) {
                errors.push("Email must look valid.");
            }
            return errors;
        }
        case "plan":
            return draft.plan === "growth" && draft.teamSize < 3 ? ["Growth plan requires at least 3 seats."] : [];
        case "review":
            return draft.acceptedTerms ? [] : ["Accept the terms before submitting."];
    }
}

function validateAll(steps: StepId[], draft: OnboardingDraft): Partial<Record<StepId, string[]>> {
    return steps.reduce<Partial<Record<StepId, string[]>>>((errorsByStep, stepId) => {
        const errors = validateStep(stepId, draft);
        if (errors.length > 0) {
            errorsByStep[stepId] = errors;
        }
        return errorsByStep;
    }, {});
}

async function submitOnboarding(draft: OnboardingDraft) {
    const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
    });

    if (!response.ok) {
        throw new Error(`Onboarding submission failed: ${response.status} ${response.statusText}`);
    }
}

function OnboardingWizard() {
    const { value: draft, set: setDraft, remove: removeDraft } = useMnemonicKey(onboardingDraftKey);
    const steps = getSteps(draft);
    const [activeStepId, setActiveStepId] = useState<StepId>("account");
    const [stepErrors, setStepErrors] = useState<Partial<Record<StepId, string[]>>>({});
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!steps.includes(activeStepId)) {
            setActiveStepId("account");
        }
    }, [activeStepId, draft.accountType]);

    const activeIndex = steps.indexOf(activeStepId);
    const currentErrors = stepErrors[activeStepId] ?? [];
    const completedSteps = steps.filter((stepId) => validateStep(stepId, draft).length === 0);

    const goNext = () => {
        const errors = validateStep(activeStepId, draft);
        if (errors.length > 0) {
            setStepErrors((prev) => ({ ...prev, [activeStepId]: errors }));
            return;
        }

        const nextStepId = steps[activeIndex + 1];
        if (nextStepId) {
            setActiveStepId(nextStepId);
        }
    };

    const goBack = () => {
        const previousStepId = steps[activeIndex - 1];
        if (previousStepId) {
            setActiveStepId(previousStepId);
        }
    };

    const updateDraft = <K extends keyof OnboardingDraft>(field: K, value: OnboardingDraft[K]) => {
        setDraft((prev) => ({ ...prev, [field]: value }));
        setStepErrors((prev) => ({ ...prev, [activeStepId]: [] }));
        setSubmissionError(null);
    };

    const updateAccountType = (accountType: AccountType) => {
        setDraft((prev) => ({
            ...prev,
            accountType,
            companyName: accountType === "business" ? prev.companyName : null,
        }));
        setStepErrors((prev) => ({ ...prev, account: [], business: [] }));
    };

    const handleSubmit = async () => {
        const errorsByStep = validateAll(steps, draft);
        if (Object.keys(errorsByStep).length > 0) {
            setStepErrors(errorsByStep);
            const firstInvalidStep = steps.find((stepId) => errorsByStep[stepId]?.length);
            if (firstInvalidStep) {
                setActiveStepId(firstInvalidStep);
            }
            return;
        }

        setIsSubmitting(true);
        setSubmissionError(null);

        try {
            await submitOnboarding(draft);
            removeDraft();
            setActiveStepId("account");
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : "Could not finish onboarding.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <ol>
                {steps.map((stepId) => (
                    <li key={stepId}>
                        <strong>{stepLabels[stepId]}</strong>
                        {completedSteps.includes(stepId) ? " complete" : ""}
                    </li>
                ))}
            </ol>

            {activeStepId === "account" ? (
                <fieldset>
                    <legend>Choose account type</legend>
                    <label>
                        <input
                            type="radio"
                            checked={draft.accountType === "personal"}
                            onChange={() => updateAccountType("personal")}
                        />
                        Personal
                    </label>
                    <label>
                        <input
                            type="radio"
                            checked={draft.accountType === "business"}
                            onChange={() => updateAccountType("business")}
                        />
                        Business
                    </label>
                </fieldset>
            ) : null}

            {activeStepId === "business" ? (
                <label>
                    Company name
                    <input
                        value={draft.companyName ?? ""}
                        onChange={(event) => updateDraft("companyName", event.target.value || null)}
                    />
                </label>
            ) : null}

            {activeStepId === "profile" ? (
                <>
                    <label>
                        Full name
                        <input
                            value={draft.fullName}
                            onChange={(event) => updateDraft("fullName", event.target.value)}
                        />
                    </label>
                    <label>
                        Email
                        <input value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} />
                    </label>
                </>
            ) : null}

            {activeStepId === "plan" ? (
                <>
                    <label>
                        Team size
                        <input
                            type="number"
                            min={1}
                            value={draft.teamSize}
                            onChange={(event) => {
                                const parsed = Number(event.target.value);
                                updateDraft(
                                    "teamSize",
                                    Number.isFinite(parsed) && parsed >= 1 ? parsed : draft.teamSize,
                                );
                            }}
                        />
                    </label>
                    <label>
                        Plan
                        <select
                            value={draft.plan}
                            onChange={(event) => updateDraft("plan", event.target.value as Plan)}
                        >
                            <option value="starter">Starter</option>
                            <option value="growth">Growth</option>
                        </select>
                    </label>
                </>
            ) : null}

            {activeStepId === "review" ? (
                <label>
                    <input
                        type="checkbox"
                        checked={draft.acceptedTerms}
                        onChange={(event) => updateDraft("acceptedTerms", event.target.checked)}
                    />
                    I accept the terms
                </label>
            ) : null}

            {currentErrors.length > 0 ? (
                <ul>
                    {currentErrors.map((error) => (
                        <li key={error}>{error}</li>
                    ))}
                </ul>
            ) : null}

            {submissionError ? <p>{submissionError}</p> : null}

            <div>
                <button type="button" onClick={goBack} disabled={activeIndex <= 0 || isSubmitting}>
                    Back
                </button>

                {activeStepId === "review" ? (
                    <button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit"}
                    </button>
                ) : (
                    <button type="button" onClick={goNext} disabled={isSubmitting}>
                        Next
                    </button>
                )}
            </div>
        </div>
    );
}

export function App() {
    return (
        <MnemonicProvider namespace="signup">
            <OnboardingWizard />
        </MnemonicProvider>
    );
}
```

## Why this pattern works

- The draft is the only durable source of truth.
- `activeStepId`, `stepErrors`, `submissionError`, and `isSubmitting` reset naturally on a fresh runtime session.
- Step completion is derived from the draft instead of being persisted separately.
- The business-only step appears and disappears from the persisted draft shape without leaving stale navigation state behind.
- Final submission removes the draft so the next run starts cleanly.

## Step validation vs final submission validation

Use two layers:

- Step validation on `Next` for the fields the user can act on right now.
- Full validation on final submit for cross-step rules and whole-form guarantees.

That split keeps navigation responsive while still protecting the final write.
In the example above:

- `validateStep("business", draft)` only cares about `companyName`
- `validateStep("plan", draft)` can enforce a rule that depends on `teamSize` and `plan`
- `validateAll(...)` runs every active step before the final submission

## Conditional steps and cross-step dependencies

Conditional steps should be derived from the persisted draft, not tracked in a
separate persisted list. That keeps the wizard deterministic after reload.

When one step changes the meaning of another step's fields:

- clear or normalize no-longer-valid draft values immediately
- reset step-local errors in ephemeral state
- redirect the active step if the current step disappears

In the example, switching from `"business"` to `"personal"` clears
`companyName` and moves the user back to a valid step if the business-only step
was active.

## Evolving the wizard draft over time

Wizard drafts often live longer than one deploy, so schema migration matters.
If the stored shape changes, use a versioned schema and migration.

```tsx
import {
    createSchemaRegistry,
    defineKeySchema,
    defineMigration,
    mnemonicSchema,
    MnemonicProvider,
} from "react-mnemonic";

const onboardingDraftV1 = defineKeySchema(
    "onboarding-draft",
    1,
    mnemonicSchema.object({
        accountType: mnemonicSchema.enum(["personal", "business"] as const),
        companyName: mnemonicSchema.nullable(mnemonicSchema.string()),
        fullName: mnemonicSchema.string(),
        email: mnemonicSchema.string(),
        teamSize: mnemonicSchema.number(),
        plan: mnemonicSchema.enum(["starter", "growth"] as const),
        acceptedTerms: mnemonicSchema.boolean(),
    }),
);

const onboardingDraftV2 = defineKeySchema(
    "onboarding-draft",
    2,
    mnemonicSchema.object({
        accountType: mnemonicSchema.enum(["personal", "business"] as const),
        companyName: mnemonicSchema.nullable(mnemonicSchema.string()),
        workspaceName: mnemonicSchema.string(),
        fullName: mnemonicSchema.string(),
        email: mnemonicSchema.string(),
        teamSize: mnemonicSchema.number(),
        plan: mnemonicSchema.enum(["starter", "growth"] as const),
        acceptedTerms: mnemonicSchema.boolean(),
    }),
);

const registry = createSchemaRegistry({
    schemas: [onboardingDraftV1, onboardingDraftV2],
    migrations: [
        defineMigration(onboardingDraftV1, onboardingDraftV2, (value) => {
            const draft = value as {
                companyName: string | null;
                fullName: string;
                accountType: "personal" | "business";
                email: string;
                teamSize: number;
                plan: "starter" | "growth";
                acceptedTerms: boolean;
            };

            return {
                ...draft,
                workspaceName: draft.companyName ?? `${draft.fullName}'s workspace`,
            };
        }),
    ],
});

export function App() {
    return (
        <MnemonicProvider namespace="signup" schemaRegistry={registry}>
            <OnboardingWizard />
        </MnemonicProvider>
    );
}
```

Use `reconcile(...)` only for read-time policy adjustments inside the same
shape, such as forcing a new default plan for legacy drafts. Use migrations for
real structural changes.

## Practical rules of thumb

- Persist the smallest cross-step draft that users would expect to restore.
- Keep navigation, error UI, and submission lifecycle state ephemeral by default.
- Derive completion and conditional step visibility from the durable draft.
- Run step-local validation on `Next`, then full validation on final submit.
- Remove or reset the draft after a successful submission so the wizard does not reopen with stale state.
