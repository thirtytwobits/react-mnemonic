import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
    title: "react-mnemonic",
    tagline: "Persistent, type-safe state management for React",
    favicon: "img/favicon.svg",

    url: "https://thirtytwobits.github.io",
    baseUrl: "/react-mnemonic/",

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
                src: "img/logo-dark.svg",
                srcDark: "img/logo.svg",
                height: 32,
                width: 32,
            },
            items: [
                {
                    type: "docSidebar",
                    sidebarId: "docsSidebar",
                    position: "left",
                    label: "Docs",
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
