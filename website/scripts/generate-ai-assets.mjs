import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const websiteDir = path.resolve(__dirname, "..");
const repoDir = path.resolve(websiteDir, "..");
const docsDir = path.join(websiteDir, "docs", "ai");
const staticDir = path.join(websiteDir, "static");
const packageJsonPath = path.join(repoDir, "package.json");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const siteBaseUrl = new URL(packageJson.homepage).toString().replace(/\/$/, "");
const prettierConfig = (await resolveConfig(packageJsonPath)) ?? {};
const checkMode = process.argv.includes("--check");

const canonicalDocs = [
    {
        id: "index",
        title: "AI Overview",
        summary: "Canonical entry point for the persistence contract, retrieval surfaces, and high-risk rules.",
        sourcePath: path.join(docsDir, "index.md"),
        url: `${siteBaseUrl}/docs/ai`,
    },
    {
        id: "invariants",
        title: "Invariants",
        summary:
            "Deterministic guarantees for provider scope, reads, writes, SSR, type sourcing, and storage adapters.",
        sourcePath: path.join(docsDir, "invariants.md"),
        url: `${siteBaseUrl}/docs/ai/invariants`,
    },
    {
        id: "decision-matrix",
        title: "Decision Matrix",
        summary:
            "Decision tables for null vs remove, migration vs reconcile, persistence boundaries, and SSR mode choice.",
        sourcePath: path.join(docsDir, "decision-matrix.md"),
        url: `${siteBaseUrl}/docs/ai/decision-matrix`,
    },
    {
        id: "recipes",
        title: "Recipes",
        summary:
            "Copy-pastable durable state patterns for themes, filters, drafts, wizards, migrations, and SSR placeholders.",
        sourcePath: path.join(docsDir, "recipes.md"),
        url: `${siteBaseUrl}/docs/ai/recipes`,
    },
    {
        id: "anti-patterns",
        title: "Anti-Patterns",
        summary: "Common mistakes that produce the wrong persistence semantics even when the UI appears to work.",
        sourcePath: path.join(docsDir, "anti-patterns.md"),
        url: `${siteBaseUrl}/docs/ai/anti-patterns`,
    },
    {
        id: "assistant-setup",
        title: "AI Assistant Setup",
        summary: "How to expose the canonical docs through llms files, DeepWiki, and MCP-friendly retrieval paths.",
        sourcePath: path.join(docsDir, "assistant-setup.md"),
        url: `${siteBaseUrl}/docs/ai/assistant-setup`,
    },
];

const keyGuideLinks = [
    {
        title: "Quick Start",
        url: `${siteBaseUrl}/docs/getting-started/quick-start`,
    },
    {
        title: "Schema Migration",
        url: `${siteBaseUrl}/docs/guides/schema-migration`,
    },
    {
        title: "Server Rendering",
        url: `${siteBaseUrl}/docs/guides/server-rendering`,
    },
    {
        title: "Clearable Persisted Values",
        url: `${siteBaseUrl}/docs/guides/clearable-persisted-values`,
    },
    {
        title: "Persisted vs Ephemeral State",
        url: `${siteBaseUrl}/docs/guides/persisted-vs-ephemeral-state`,
    },
    {
        title: "Multi-Step Form Wizards",
        url: `${siteBaseUrl}/docs/guides/multi-step-form-wizards`,
    },
    {
        title: "Custom Storage",
        url: `${siteBaseUrl}/docs/guides/custom-storage`,
    },
    {
        title: "API Reference",
        url: `${siteBaseUrl}/docs/api`,
    },
];

const quickRules = [
    "`useMnemonicKey(...)` must run inside a `MnemonicProvider`.",
    "Persisted keys are stored as `${namespace}.${key}`.",
    "`defaultValue` is required and is the fallback for absent or invalid values.",
    "`set(next)` persists a value, `reset()` persists `defaultValue`, and `remove()` deletes the key.",
    "Use `set(null)` when a cleared state must survive reload.",
    "SSR renders `defaultValue` on the server unless `ssr.serverValue` overrides it.",
    "For multi-step wizards, persist user-authored draft values and derive completion from them; keep active step, validation errors, and submit-in-flight state ephemeral unless resume-on-reload is an explicit feature.",
    "Use schema migrations for structural version upgrades and `reconcile(...)` for conditional read-time policy rewrites.",
    "`StorageLike` is synchronous; async adapters must be hidden behind a synchronous facade.",
    "Import published values and types from `react-mnemonic`; do not invent local ambient shims.",
];

const aiContract = {
    version: 2,
    title: "react-mnemonic AI Contract",
    canonicalDocs: Object.fromEntries(canonicalDocs.map((doc) => [doc.id, doc.url])),
    retrievalSurfaces: {
        llms: `${siteBaseUrl}/llms.txt`,
        llmsFull: `${siteBaseUrl}/llms-full.txt`,
        machineReadable: `${siteBaseUrl}/ai-contract.json`,
        deepWikiConfig: "https://github.com/thirtytwobits/react-mnemonic/blob/main/.devin/wiki.json",
    },
    storageContract: {
        type: "synchronous",
        namespacePattern: "${namespace}.${key}",
        requiredProvider: true,
        customExternalSync: "storage.onExternalChange(callback)",
        actions: {
            set: "persist next value",
            reset: "persist defaultValue",
            remove: "delete key and fall back to defaultValue",
        },
    },
    typeContract: {
        sourceOfTruth: "published package exports",
        importPath: "react-mnemonic",
        allowLocalAmbientShims: false,
        forbiddenPatterns: ["react-mnemonic.d.ts", 'declare module "react-mnemonic"'],
        fallbackOrder: ["src/index.ts", "package.json", "api-docs", "docs/ai"],
    },
    readLifecycle: [
        "load raw snapshot",
        "decode payload",
        "validate and migrate when schemas exist",
        "run reconcile if provided",
        "fall back to defaultValue when absent or invalid",
        "persist read-time rewrite when migration, autoschema, or reconcile changed storage shape",
    ],
    writeLifecycle: [
        "resolve updater against current decoded value",
        "choose schema or codec write path",
        "run write-time migration when configured",
        "validate target schema when schema-managed",
        "encode versioned envelope",
        "write raw snapshot and notify subscribers",
    ],
    decisionShortcuts: {
        durableClearIntent: "set(null)",
        forgetKey: "remove()",
        restoreDefault: "reset()",
        structuralUpgrade: "schema migration",
        conditionalPolicyRewrite: "reconcile",
    },
    ssr: {
        defaultServerValue: "defaultValue",
        optionalServerValue: "ssr.serverValue",
        hydrationModes: ["immediate", "client-only"],
    },
    quickRules,
    recipes: [
        "theme-preference",
        "saved-filters",
        "dismissible-ui",
        "durable-draft",
        "multi-step-wizard",
        "schema-upgrade",
        "ssr-placeholder",
    ],
};

function assertFileExists(filePath) {
    if (!existsSync(filePath)) {
        throw new Error(`Expected AI source file to exist: ${filePath}`);
    }
}

function stripFrontmatter(markdown) {
    return markdown.replace(/^---\n[\s\S]*?\n---\n*/, "").trim();
}

function normalizeNewlines(text) {
    return text.replace(/\r\n/g, "\n");
}

function normalizeInternalLinks(markdown) {
    return markdown.replace(/(!?\[[^\]]*]\()\/(?!\/)/g, `$1${siteBaseUrl}/`);
}

function loadCanonicalDocs() {
    return canonicalDocs.map((doc) => {
        assertFileExists(doc.sourcePath);
        const content = normalizeInternalLinks(
            stripFrontmatter(normalizeNewlines(readFileSync(doc.sourcePath, "utf8"))),
        );
        return {
            ...doc,
            content,
        };
    });
}

function generateLlmsText(docs) {
    const docLinks = docs.map((doc) => `- [${doc.title}](${doc.url}) - ${doc.summary}`).join("\n");
    const guideLinks = keyGuideLinks.map((guide) => `- [${guide.title}](${guide.url})`).join("\n");
    const ruleLines = quickRules.map((rule) => `- ${rule}`).join("\n");

    return `# react-mnemonic
> Persistent, type-safe state management for React with explicit persistence semantics for humans and coding assistants.

Use this file as the compact retrieval index. The canonical AI-oriented prose
lives under \`/docs/ai\`, with \`/llms-full.txt\` as the long-form export and
\`/ai-contract.json\` as the machine-readable companion.

## Recommended reading

${docLinks}

## Key guides

${guideLinks}

## Quick rules

${ruleLines}
`;
}

function generateLlmsFullText(docs) {
    const sectionBlocks = docs
        .map(
            (doc) => `## ${doc.title}
Source: ${doc.url}

${doc.content}
`,
        )
        .join("\n");

    return (
        `# react-mnemonic
> Long-form AI retrieval export for the canonical react-mnemonic documentation.

## Canonical source pages

${docs.map((doc) => `- ${doc.title}: ${doc.url}`).join("\n")}

## Machine-readable companion

- ${siteBaseUrl}/ai-contract.json
- ${siteBaseUrl}/llms.txt

## Quick rules

${quickRules.map((rule) => `- ${rule}`).join("\n")}

${sectionBlocks}`.trimEnd() + "\n"
    );
}

function readTextFileIfExists(filePath) {
    try {
        return readFileSync(filePath, "utf8");
    } catch (error) {
        if (error?.code === "ENOENT") {
            return null;
        }
        throw error;
    }
}

function writeOutputFile(fileName, content) {
    const outputPath = path.join(staticDir, fileName);
    const currentContent = readTextFileIfExists(outputPath);

    if (checkMode) {
        if (currentContent !== content) {
            if (currentContent === null) {
                throw new Error(`Generated AI asset is missing: ${outputPath}. Run npm run docs:ai.`);
            }
            throw new Error(`Generated AI asset is out of date: ${outputPath}. Run npm run docs:ai.`);
        }
        return;
    }

    mkdirSync(staticDir, { recursive: true });
    writeFileSync(outputPath, content, "utf8");
}

const docs = loadCanonicalDocs();

writeOutputFile("llms.txt", generateLlmsText(docs));
writeOutputFile("llms-full.txt", generateLlmsFullText(docs));
writeOutputFile(
    "ai-contract.json",
    await format(JSON.stringify(aiContract), {
        ...prettierConfig,
        parser: "json",
    }),
);
