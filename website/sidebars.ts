import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
    docsSidebar: [
        {
            type: "category",
            label: "Getting Started",
            collapsed: false,
            items: ["getting-started/installation", "getting-started/quick-start"],
        },
        {
            type: "category",
            label: "AI",
            collapsed: false,
            items: [
                "ai/index",
                "ai/invariants",
                "ai/decision-matrix",
                "ai/recipes",
                "ai/anti-patterns",
                "ai/assistant-setup",
            ],
        },
        {
            type: "category",
            label: "Guides",
            collapsed: false,
            items: [
                "guides/schema-modes",
                "guides/json-schema-validation",
                "guides/schema-migration",
                "guides/context7-rankings",
                "guides/canonical-key-definitions",
                "guides/single-source-of-truth-schemas",
                "guides/reset-and-recovery",
                "guides/clearable-persisted-values",
                "guides/auth-aware-persistence",
                "guides/multi-step-form-wizards",
                "guides/persisted-vs-ephemeral-state",
                "guides/server-rendering",
                "guides/custom-codecs",
                "guides/custom-storage",
                "guides/cross-tab-sync",
                "guides/devtools",
                "guides/error-handling",
                "guides/typescript",
            ],
        },
        {
            type: "category",
            label: "API Reference",
            link: {
                type: "doc",
                id: "api/index",
            },
            items: require("./docs/api/typedoc-sidebar.cjs"),
        },
    ],
};

export default sidebars;
