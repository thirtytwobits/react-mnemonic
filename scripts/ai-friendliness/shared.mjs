// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const benchmarkDir = path.join(rootDir, "benchmarks", "ai-friendliness");
export const scenarioDir = path.join(benchmarkDir, "scenarios");
export const validationDir = path.join(benchmarkDir, "validation-fixtures");
export const runDir = path.join(benchmarkDir, "runs");
export const resultsPath = path.join(rootDir, "website", "static", "benchmarks", "ai-friendliness-results.json");

export const fixedLibraryShortlist = [
    "react-mnemonic",
    "zustand/persist",
    "jotai/atomWithStorage",
    "use-local-storage-state",
    "usehooks-ts/useLocalStorage",
];

export const supportedLibraries = [...fixedLibraryShortlist, "raw-localstorage"];

export function toPercent(value) {
    return Number((value * 100).toFixed(2));
}

export function mean(values) {
    if (values.length === 0) {
        return 0;
    }

    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export async function readJson(filePath) {
    return JSON.parse(await readFile(filePath, "utf8"));
}

export async function ensurePathExists(filePath, description) {
    try {
        await stat(filePath);
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
            throw new Error(`${description} not found: ${filePath}`);
        }
        throw error;
    }
}

async function collectFileContents(absoluteDir) {
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    const parts = [];

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        const entryPath = path.join(absoluteDir, entry.name);
        if (entry.isDirectory()) {
            parts.push(await collectFileContents(entryPath));
            continue;
        }

        parts.push(await readFile(entryPath, "utf8"));
    }

    return parts.join("\n");
}

export async function collectSubmissionText(relativeDir) {
    const absoluteDir = path.join(rootDir, relativeDir);
    await ensurePathExists(absoluteDir, "Submission directory");
    return collectFileContents(absoluteDir);
}

export async function loadScenarioManifests() {
    const files = (await readdir(scenarioDir)).filter((file) => file.endsWith(".json")).sort();
    const scenarios = [];

    for (const file of files) {
        const scenarioPath = path.join(scenarioDir, file);
        scenarios.push(await readJson(scenarioPath));
    }

    return scenarios;
}

export async function loadValidationRunManifests() {
    const fixtureNames = (await readdir(validationDir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

    const manifests = [];

    for (const fixtureName of fixtureNames) {
        const manifestPath = path.join(validationDir, fixtureName, "run.manifest.json");
        manifests.push(await readJson(manifestPath));
    }

    return manifests;
}

export async function loadEvaluationRunManifests() {
    const files = (await readdir(runDir)).filter((file) => file.endsWith(".run.json")).sort();
    const manifests = [];

    for (const file of files) {
        manifests.push(await readJson(path.join(runDir, file)));
    }

    return manifests;
}

export function scenarioMapFromList(scenarios) {
    return new Map(scenarios.map((scenario) => [scenario.id, scenario]));
}

export function normalizeHumanReviewScore(review) {
    const earned =
        review.persistenceAppropriateness + review.semanticNuanceCorrectness + review.unnecessaryUserIntervention;

    return Number(((earned / 15) * 100).toFixed(2));
}

export function modelKey(model) {
    return `${model.provider}:${model.modelId}:${model.promptPackVersion}`;
}
