import { MnemonicProvider, createSchemaRegistry, useMnemonicKey } from "../../../dist/schema.js";

const registry = createSchemaRegistry({
    schemas: [
        {
            key: "profile",
            version: 1,
            schema: {
                type: "object",
                properties: {
                    theme: { type: "string" },
                },
                required: ["theme"],
            },
        },
        {
            key: "profile",
            version: 2,
            schema: {
                type: "object",
                properties: {
                    theme: { type: "string" },
                    density: { type: "string" },
                },
                required: ["theme", "density"],
            },
        },
    ],
    migrations: [
        {
            key: "profile",
            fromVersion: 1,
            toVersion: 2,
            migrate: (value) => ({
                ...(value as { theme: "light" | "dark" }),
                density: "comfortable",
            }),
        },
    ],
});

function ProfileButton() {
    const { value, set } = useMnemonicKey("profile", {
        defaultValue: {
            theme: "light" as "light" | "dark",
            density: "comfortable" as "comfortable" | "compact",
        },
        schema: { version: 2 },
        reconcile: (current) => ({
            ...current,
            density: current.density ?? "comfortable",
        }),
    });

    return (
        <button
            onClick={() =>
                set((current) => ({
                    ...current,
                    theme: current.theme === "light" ? "dark" : "light",
                }))
            }
        >
            Theme: {value.theme} / Density: {value.density}
        </button>
    );
}

export function ProfilePersistenceButton() {
    return (
        <MnemonicProvider namespace="bench" schemaRegistry={registry}>
            <ProfileButton />
        </MnemonicProvider>
    );
}
