import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const isLocalDevelopment = process.env.NODE_ENV === "development";

const config: Config = {
    title: "react-mnemonic",
    tagline: "AI-friendly, persistent, type-safe state management for React",
    favicon: "img/favicon.svg",

    url: "https://thirtytwobits.github.io",
    baseUrl: isLocalDevelopment ? "/" : "/react-mnemonic/",

    organizationName: "thirtytwobits",
    projectName: "react-mnemonic",
    trailingSlash: false,

    onBrokenLinks: "throw",

    markdown: {
        hooks: {
            onBrokenMarkdownLinks: "warn",
        },
    },

    i18n: {
        defaultLocale: "en",
        locales: ["en"],
    },

    scripts: [
        {
            src: "https://context7.com/widget.js",
            async: true,
            "data-library": "/thirtytwobits/react-mnemonic",
        },
    ],

    plugins: [
        [
            "docusaurus-plugin-typedoc",
            {
                entryPoints: ["../src/index.ts"],
                tsconfig: "../tsconfig.json",
                out: "docs/api",
                outputFileStrategy: "members",
                readme: "none",
                excludePrivate: true,
                excludeProtected: true,
                excludeInternal: true,
                sort: ["kind", "alphabetical"],
                kindSortOrder: ["Function", "Interface", "TypeAlias", "Class", "Variable", "Enum"],
                parametersFormat: "table",
                enumMembersFormat: "table",
                typeDeclarationFormat: "table",
                sidebar: {
                    autoConfiguration: true,
                    pretty: true,
                },
            },
        ],
    ],

    presets: [
        [
            "classic",
            {
                docs: {
                    sidebarPath: "./sidebars.ts",
                    editUrl: "https://github.com/thirtytwobits/react-mnemonic/tree/main/website/",
                    lastVersion: "1.4.0",
                    versions: {
                        current: {
                            label: "Next",
                            path: "next",
                        },
                        "1.4.0": {
                            label: "1.4.0",
                        },
                        "1.3.0": {
                            label: "1.3.0",
                        },
                        "1.2.1-beta1.0": {
                            label: "1.2.1-beta1.0",
                        },
                        "1.2.0-beta1": {
                            label: "1.2.0-beta1",
                        },
                    },
                },
                blog: false,
                theme: {
                    customCss: "./src/css/custom.css",
                },
            } satisfies Preset.Options,
        ],
    ],

    themeConfig: {
        navbar: {
            title: "react-mnemonic",
            logo: {
                alt: "react-mnemonic logo",
                src: "img/logo.svg",
                height: 32,
            },
            items: [
                {
                    type: "docSidebar",
                    sidebarId: "docsSidebar",
                    position: "left",
                    label: "Docs",
                },
                {
                    type: "docsVersionDropdown",
                    position: "left",
                    dropdownActiveClassDisabled: true,
                },
                {
                    to: "docs/api",
                    label: "API",
                    position: "left",
                },
                {
                    to: "demo",
                    label: "Demo",
                    position: "left",
                },
                {
                    href: "https://github.com/thirtytwobits/react-mnemonic",
                    label: "GitHub",
                    position: "right",
                },
                {
                    href: "https://www.npmjs.com/package/react-mnemonic",
                    label: "npm",
                    position: "right",
                },
            ],
        },
        footer: {
            style: "dark",
            links: [
                {
                    title: "Docs",
                    items: [
                        { label: "Getting Started", to: "/docs/getting-started/installation" },
                        { label: "AI Docs", to: "/docs/ai" },
                        { label: "Guides", to: "/docs/guides/schema-modes" },
                        { label: "API Reference", to: "/docs/api" },
                    ],
                },
                {
                    title: "Community",
                    items: [
                        {
                            label: "GitHub Issues",
                            href: "https://github.com/thirtytwobits/react-mnemonic/issues",
                        },
                        {
                            label: "GitHub Discussions",
                            href: "https://github.com/thirtytwobits/react-mnemonic/discussions",
                        },
                    ],
                },
                {
                    title: "More",
                    items: [
                        { label: "GitHub", href: "https://github.com/thirtytwobits/react-mnemonic" },
                        { label: "npm", href: "https://www.npmjs.com/package/react-mnemonic" },
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} Scott Dixon. Built with Docusaurus.`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
            additionalLanguages: ["bash", "json"],
        },
        colorMode: {
            defaultMode: "light",
            disableSwitch: false,
            respectPrefersColorScheme: true,
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
