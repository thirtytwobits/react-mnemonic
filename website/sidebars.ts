import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
    docsSidebar: [
        {
            type: "category",
            label: "Getting Started",
            collapsed: false,
            items: [
                "getting-started/installation",
                "getting-started/quick-start",
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
