// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { gzipSync } from "node:zlib";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import * as esbuild from "esbuild";
import prettier from "prettier";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const benchmarkDir = path.join(rootDir, "benchmarks", "comparison");
const entriesDir = path.join(benchmarkDir, "entries");
const resultsPath = path.join(rootDir, "website", "static", "benchmarks", "comparison-results.json");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const sharedBuildOptions = {
    absWorkingDir: benchmarkDir,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    legalComments: "none",
    mainFields: ["module", "browser", "main"],
    minify: true,
    platform: "browser",
    target: ["es2020"],
    treeShaking: true,
    write: false,
    external: ["react", "react-dom", "react/jsx-runtime"],
};

const benchmarks = [
    {
        id: "react-mnemonic-theme",
        label: "react-mnemonic",
        scenario: "Persisted theme toggle",
        category: "common-task",
        entry: path.join(entriesDir, "react-mnemonic-theme.tsx"),
        packageName: "react-mnemonic",
    },
    {
        id: "zustand-persist-theme",
        label: "zustand/persist",
        scenario: "Persisted theme toggle",
        category: "common-task",
        entry: path.join(entriesDir, "zustand-persist-theme.tsx"),
        packageName: "zustand",
    },
    {
        id: "jotai-atom-with-storage-theme",
        label: "jotai/atomWithStorage",
        scenario: "Persisted theme toggle",
        category: "common-task",
        entry: path.join(entriesDir, "jotai-atom-with-storage-theme.tsx"),
        packageName: "jotai",
    },
    {
        id: "use-local-storage-state-theme",
        label: "use-local-storage-state",
        scenario: "Persisted theme toggle",
        category: "common-task",
        entry: path.join(entriesDir, "use-local-storage-state-theme.tsx"),
        packageName: "use-local-storage-state",
    },
    {
        id: "usehooks-ts-theme",
        label: "usehooks-ts/useLocalStorage",
        scenario: "Persisted theme toggle",
        category: "common-task",
        entry: path.join(entriesDir, "usehooks-ts-theme.tsx"),
        packageName: "usehooks-ts",
    },
    {
        id: "react-mnemonic-schema",
        label: "react-mnemonic (schema workflow)",
        scenario: "Schema-aware profile persistence with migration",
        category: "advanced-task",
        entry: path.join(entriesDir, "react-mnemonic-schema.tsx"),
        packageName: "react-mnemonic",
    },
];

function run(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: "inherit",
            env: {
                ...process.env,
                CI: "1",
            },
        });

        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
        });
    });
}

async function ensureReady() {
    try {
        await stat(path.join(benchmarkDir, "node_modules"));
    } catch {
        await run(npmCmd, ["ci"], benchmarkDir);
    }

    await stat(path.join(rootDir, "dist", "index.js"));
}

async function readJson(filePath) {
    return JSON.parse(await readFile(filePath, "utf8"));
}

async function collectVersions() {
    const rootPackage = await readJson(path.join(rootDir, "package.json"));
    const benchmarkPackage = await readJson(path.join(benchmarkDir, "package.json"));

    return {
        react: benchmarkPackage.dependencies.react,
        "react-dom": benchmarkPackage.dependencies["react-dom"],
        "react-mnemonic": rootPackage.version,
        zustand: benchmarkPackage.dependencies.zustand,
        jotai: benchmarkPackage.dependencies.jotai,
        "use-local-storage-state": benchmarkPackage.dependencies["use-local-storage-state"],
        "usehooks-ts": benchmarkPackage.dependencies["usehooks-ts"],
        esbuild: (await readJson(path.join(rootDir, "node_modules", "esbuild", "package.json"))).version,
    };
}

async function measureBundle(entry) {
    const result = await esbuild.build({
        ...sharedBuildOptions,
        entryPoints: [entry],
    });
    const output = result.outputFiles[0];
    return {
        bytes: output.contents.length,
        gzipBytes: gzipSync(output.contents).length,
    };
}

function toKiB(bytes) {
    return Number((bytes / 1024).toFixed(2));
}

async function main() {
    await ensureReady();
    const versions = await collectVersions();
    const measured = [];

    for (const benchmark of benchmarks) {
        const size = await measureBundle(benchmark.entry);
        measured.push({
            id: benchmark.id,
            label: benchmark.label,
            category: benchmark.category,
            scenario: benchmark.scenario,
            packageName: benchmark.packageName,
            packageVersion: versions[benchmark.packageName],
            bundleBytes: size.bytes,
            bundleKiB: toKiB(size.bytes),
            gzipBytes: size.gzipBytes,
            gzipKiB: toKiB(size.gzipBytes),
            entry: path.relative(rootDir, benchmark.entry),
        });
    }

    const report = {
        generatedAt: new Date().toISOString(),
        methodology: {
            bundler: "esbuild",
            bundlerVersion: versions.esbuild,
            format: "esm",
            minified: true,
            externalized: ["react", "react-dom", "react/jsx-runtime"],
            task: "Persisted theme toggle for the common-task entries",
            advancedTask: "Schema-aware profile persistence with migration for react-mnemonic only",
        },
        versions,
        caveats: [
            "These measurements compare the incremental bundle cost beyond React itself.",
            "The common-task entries intentionally model the same user-facing task, not identical internal architectures.",
            "The advanced react-mnemonic entry is included to show the cost of opting into schema-aware persistence; it is not a like-for-like cross-library comparison.",
        ],
        benchmarks: measured,
    };

    await mkdir(path.dirname(resultsPath), { recursive: true });
    const prettierConfig = (await prettier.resolveConfig(resultsPath)) ?? {};
    const formattedReport = await prettier.format(JSON.stringify(report), {
        ...prettierConfig,
        filepath: resultsPath,
        parser: "json",
    });
    await writeFile(resultsPath, formattedReport);

    console.table(
        measured.map((item) => ({
            library: item.label,
            scenario: item.scenario,
            "min+esm (KiB)": item.bundleKiB,
            "gzip (KiB)": item.gzipKiB,
        })),
    );
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
