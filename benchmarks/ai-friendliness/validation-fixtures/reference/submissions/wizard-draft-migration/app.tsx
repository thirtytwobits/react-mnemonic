import { createSchemaRegistry, MnemonicProvider, useMnemonicKey } from "react-mnemonic";

const registry = createSchemaRegistry({
    schemas: [
        {
            key: "onboardingDraft",
            version: 1,
            schema: {
                type: "object",
                properties: {
                    step: { type: "string" },
                    profile: { type: "object" },
                },
                required: ["step", "profile"],
            },
        },
        {
            key: "onboardingDraft",
            version: 2,
            schema: {
                type: "object",
                properties: {
                    step: { type: "string" },
                    profile: { type: "object" },
                    acceptedTerms: { type: "boolean" },
                },
                required: ["step", "profile", "acceptedTerms"],
            },
        },
    ],
    migrations: [
        {
            key: "onboardingDraft",
            fromVersion: 1,
            toVersion: 2,
            migrate: (value) => ({
                ...(value as { step: string; profile: Record<string, unknown> }),
                acceptedTerms: false,
            }),
        },
    ],
});

function OnboardingDraft() {
    const { value, set } = useMnemonicKey("onboardingDraft", {
        defaultValue: {
            step: "welcome",
            profile: {},
            acceptedTerms: false,
        },
        schema: { version: 2 },
        reconcile: (current) => ({
            ...current,
            acceptedTerms: current.acceptedTerms ?? false,
        }),
    });

    return <button onClick={() => set({ ...value, step: "profile" })}>{value.step}</button>;
}

export function App() {
    return (
        <MnemonicProvider namespace="onboarding" schemaRegistry={registry}>
            <OnboardingDraft />
        </MnemonicProvider>
    );
}
