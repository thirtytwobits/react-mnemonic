// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const benchmarkDir = path.join(rootDir, "benchmarks", "ai-friendliness");
const resultsPath = path.join(rootDir, "website", "static", "benchmarks", "ai-friendliness-results.json");

function toPercent(value) {
    return Number((value * 100).toFixed(2));
}

async function readJson(filePath) {
    return JSON.parse(await readFile(filePath, "utf8"));
}

async function collectSubmissionText(submissionDir) {
    const absoluteDir = path.join(rootDir, submissionDir);
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    const parts = [];

    for (const entry of entries) {
        if (entry.isDirectory()) {
            parts.push(await collectSubmissionText(path.join(submissionDir, entry.name)));
            continue;
        }

        const filePath = path.join(absoluteDir, entry.name);
        const contents = await readFile(filePath, "utf8");
        parts.push(contents);
    }

    return parts.join("\n");
}

function includesAny(text, patterns) {
    return patterns.some((pattern) => pattern.test(text));
}

function hasRawLocalStorage(text) {
    return includesAny(text, [/localStorage\.(getItem|setItem|removeItem)/, /window\.localStorage/]);
}

function hasMnemonicUsage(text) {
    return includesAny(text, [/useMnemonicKey/, /defineMnemonicKey/, /MnemonicProvider/]);
}

function scoreScenario(scenarioId, submissionText) {
    const usesMnemonic = hasMnemonicUsage(submissionText);
    const usesRawLocalStorage = hasRawLocalStorage(submissionText);
    const checks = [];

    switch (scenarioId) {
        case "theme-preference":
            checks.push({
                key: "mnemonicUsage",
                passed: usesMnemonic,
            });
            checks.push({
                key: "crossTab",
                passed: /listenCrossTab\s*:\s*true/.test(submissionText),
            });
            checks.push({
                key: "durableChoice",
                passed: /theme/.test(submissionText),
            });
            checks.push({
                key: "avoidRawStorage",
                passed: !usesRawLocalStorage,
            });
            break;
        case "saved-filters-ephemeral-search":
            checks.push({
                key: "mnemonicUsage",
                passed: usesMnemonic,
            });
            checks.push({
                key: "durableChoice",
                passed: /savedFilters|filters/.test(submissionText),
            });
            checks.push({
                key: "ephemeralBoundary",
                passed: /useState/.test(submissionText) && !/localStorage\.setItem\("draftSearch"/.test(submissionText),
            });
            checks.push({
                key: "avoidRawStorage",
                passed: !usesRawLocalStorage,
            });
            break;
        case "nullable-nickname":
            checks.push({
                key: "mnemonicUsage",
                passed: usesMnemonic,
            });
            checks.push({
                key: "nullableSemantics",
                passed: /defaultValue:\s*null/.test(submissionText) && /set\(null\)/.test(submissionText),
            });
            checks.push({
                key: "durableChoice",
                passed: /nickname/.test(submissionText),
            });
            checks.push({
                key: "avoidRawStorage",
                passed: !usesRawLocalStorage,
            });
            break;
        case "wizard-draft-migration":
            checks.push({
                key: "mnemonicUsage",
                passed: usesMnemonic,
            });
            checks.push({
                key: "schemaWorkflow",
                passed:
                    /createSchemaRegistry/.test(submissionText) &&
                    /schema:\s*\{\s*version:\s*\d+/.test(submissionText) &&
                    /fromVersion/.test(submissionText) &&
                    /migrate:/.test(submissionText) &&
                    /reconcile:/.test(submissionText),
            });
            checks.push({
                key: "durableChoice",
                passed: /onboardingDraft/.test(submissionText),
            });
            checks.push({
                key: "avoidRawStorage",
                passed: !usesRawLocalStorage,
            });
            break;
        case "ssr-theme-badge":
            checks.push({
                key: "mnemonicUsage",
                passed: usesMnemonic,
            });
            checks.push({
                key: "ssrHandling",
                passed: /serverValue/.test(submissionText) && /hydration:\s*"client-only"/.test(submissionText),
            });
            checks.push({
                key: "durableChoice",
                passed: /theme/.test(submissionText),
            });
            checks.push({
                key: "avoidRawStorage",
                passed: !usesRawLocalStorage,
            });
            break;
        case "dismissed-banner":
            checks.push({
                key: "mnemonicUsage",
                passed: usesMnemonic,
            });
            checks.push({
                key: "durableChoice",
                passed: /dismissed|announcementDismissed/.test(submissionText),
            });
            checks.push({
                key: "avoidRawStorage",
                passed: !usesRawLocalStorage,
            });
            checks.push({
                key: "simpleRecipe",
                passed: /defaultValue:\s*false/.test(submissionText),
            });
            break;
        default:
            throw new Error(`Unknown scenario id: ${scenarioId}`);
    }

    return checks;
}

function summarizeScenario(scenario, checks, followUpPrompts, followUpPenalty) {
    const totalWeight = Object.values(scenario.weights).reduce((sum, weight) => sum + weight, 0);
    const earnedWeight = checks.reduce((sum, check) => {
        return sum + (check.passed ? scenario.weights[check.key] : 0);
    }, 0);
    const semanticScore = totalWeight === 0 ? 0 : Number(((earnedWeight / totalWeight) * 100).toFixed(2));
    const interventionAdjustedScore = Math.max(0, semanticScore - followUpPrompts * followUpPenalty);
    const oneShotPass = semanticScore >= 85 && followUpPrompts === 0;

    return {
        scenarioId: scenario.id,
        title: scenario.title,
        prompt: scenario.prompt,
        followUpPrompts,
        semanticScore,
        interventionAdjustedScore,
        oneShotPass,
        checks,
    };
}

async function evaluateRun(benchmark, runManifest) {
    const scenarioResults = [];

    for (const run of runManifest.runs) {
        const scenario = benchmark.scenarios.find((item) => item.id === run.scenarioId);
        if (!scenario) {
            throw new Error(`Scenario ${run.scenarioId} not found in benchmark manifest`);
        }

        const submissionText = await collectSubmissionText(run.submissionDir);
        const checks = scoreScenario(scenario.id, submissionText);
        scenarioResults.push(
            summarizeScenario(scenario, checks, run.followUpPrompts, benchmark.metrics.followUpPenalty),
        );
    }

    const oneShotPassRate = toPercent(
        scenarioResults.filter((result) => result.oneShotPass).length / scenarioResults.length,
    );
    const meanFollowUpPrompts = Number(
        (scenarioResults.reduce((sum, result) => sum + result.followUpPrompts, 0) / scenarioResults.length).toFixed(2),
    );
    const semanticScore = Number(
        (scenarioResults.reduce((sum, result) => sum + result.semanticScore, 0) / scenarioResults.length).toFixed(2),
    );
    const interventionAdjustedScore = Number(
        (
            scenarioResults.reduce((sum, result) => sum + result.interventionAdjustedScore, 0) / scenarioResults.length
        ).toFixed(2),
    );

    return {
        runId: runManifest.runId,
        label: runManifest.label,
        runType: runManifest.runType,
        model: runManifest.model,
        contextProfile: runManifest.contextProfile,
        oneShotPassRate,
        meanFollowUpPrompts,
        semanticScore,
        interventionAdjustedScore,
        scenarioResults,
    };
}

async function ensureReady() {
    const distIndexPath = path.join(rootDir, "dist", "index.js");
    try {
        await stat(distIndexPath);
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
            throw new Error(
                `${distIndexPath} not found - run \`npm run build\` from the project root before running AI benchmarks.`,
            );
        }
        throw error;
    }
}

async function main() {
    await ensureReady();
    const benchmark = await readJson(path.join(benchmarkDir, "scenarios.json"));
    const runFiles = (await readdir(path.join(benchmarkDir, "runs"))).filter((file) => file.endsWith(".json"));
    const results = [];

    for (const runFile of runFiles) {
        const runManifest = await readJson(path.join(benchmarkDir, "runs", runFile));
        results.push(await evaluateRun(benchmark, runManifest));
    }

    const report = {
        generatedAt: new Date().toISOString(),
        benchmarkName: benchmark.benchmarkName,
        assumptions: benchmark.assumptions,
        metrics: benchmark.metrics,
        scenarios: benchmark.scenarios.map((scenario) => ({
            id: scenario.id,
            title: scenario.title,
            focus: scenario.focus,
            prompt: scenario.prompt,
        })),
        results,
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
        results.map((result) => ({
            run: result.label,
            "one-shot %": result.oneShotPassRate,
            "mean follow-ups": result.meanFollowUpPrompts,
            "semantic score": result.semanticScore,
            "adjusted score": result.interventionAdjustedScore,
        })),
    );
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
