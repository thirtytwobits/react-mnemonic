// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import path from "node:path";
import {
    benchmarkDir,
    ensurePathExists,
    fixedLibraryShortlist,
    readJson,
    rootDir,
    supportedLibraries,
} from "./shared.mjs";

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function isBoolean(value) {
    return typeof value === "boolean";
}

function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function validateScenarioManifest(scenario) {
    assert(isNonEmptyString(scenario.id), "Scenario id must be a non-empty string");
    assert(isNonEmptyString(scenario.title), `Scenario ${scenario.id} is missing a title`);
    assert(isNonEmptyString(scenario.focus), `Scenario ${scenario.id} is missing a focus`);
    assert(isNonEmptyString(scenario.prompt), `Scenario ${scenario.id} is missing a prompt`);
    assert(isNonEmptyString(scenario.starterAppPath), `Scenario ${scenario.id} is missing starterAppPath`);
    assert(
        Array.isArray(scenario.expectedPersistenceDecisions),
        `Scenario ${scenario.id} must define expectedPersistenceDecisions`,
    );
    assert(
        Array.isArray(scenario.criticalFailureConditions),
        `Scenario ${scenario.id} must define criticalFailureConditions`,
    );
    assert(
        isObject(scenario.allowedImplementationShapes),
        `Scenario ${scenario.id} must define allowedImplementationShapes`,
    );
    assert(Array.isArray(scenario.automatedChecks), `Scenario ${scenario.id} must define automatedChecks`);

    await ensurePathExists(path.join(rootDir, scenario.starterAppPath), `Starter app for scenario ${scenario.id}`);

    for (const library of fixedLibraryShortlist) {
        assert(
            Array.isArray(scenario.allowedImplementationShapes[library]),
            `Scenario ${scenario.id} must define allowedImplementationShapes for ${library}`,
        );
    }

    for (const check of scenario.automatedChecks) {
        assert(isNonEmptyString(check.id), `Scenario ${scenario.id} has an automated check without an id`);
        assert(isNonEmptyString(check.description), `Scenario ${scenario.id} check ${check.id} needs a description`);
        assert(
            typeof check.weight === "number" && check.weight > 0,
            `Scenario ${scenario.id} check ${check.id} needs a positive weight`,
        );
        assert(
            isBoolean(check.critical),
            `Scenario ${scenario.id} check ${check.id} must declare critical as a boolean`,
        );
    }
}

export async function loadAndValidateHumanReview(reviewPath, scenarioIds) {
    await ensurePathExists(reviewPath, "Human review file");
    const review = await readJson(reviewPath);

    assert(isNonEmptyString(review.reviewer), `Human review ${reviewPath} must include reviewer`);
    assert(isNonEmptyString(review.reviewedAt), `Human review ${reviewPath} must include reviewedAt`);
    assert(isObject(review.scenarios), `Human review ${reviewPath} must include scenarios`);

    for (const scenarioId of scenarioIds) {
        const scenarioReview = review.scenarios[scenarioId];
        assert(isObject(scenarioReview), `Human review ${reviewPath} is missing scenario review for ${scenarioId}`);

        for (const key of ["persistenceAppropriateness", "semanticNuanceCorrectness", "unnecessaryUserIntervention"]) {
            const value = scenarioReview[key];
            assert(
                Number.isInteger(value) && value >= 1 && value <= 5,
                `Human review ${reviewPath} has invalid ${key} for ${scenarioId}`,
            );
        }

        assert(
            isBoolean(scenarioReview.criticalSemanticMiss),
            `Human review ${reviewPath} must include criticalSemanticMiss for ${scenarioId}`,
        );
        assert(
            isNonEmptyString(scenarioReview.notes),
            `Human review ${reviewPath} must include notes for ${scenarioId}`,
        );
    }

    return review;
}

export async function validateRunManifest(manifest, scenarioMap) {
    assert(isNonEmptyString(manifest.runId), "Run manifest is missing runId");
    assert(isNonEmptyString(manifest.label), `Run ${manifest.runId} is missing label`);
    assert(
        ["validation", "evaluation"].includes(manifest.runType),
        `Run ${manifest.runId} must declare runType as validation or evaluation`,
    );
    assert(isNonEmptyString(manifest.library), `Run ${manifest.runId} must declare library`);
    assert(
        supportedLibraries.includes(manifest.library),
        `Run ${manifest.runId} uses unsupported library ${manifest.library}`,
    );
    assert(isNonEmptyString(manifest.contextProfile), `Run ${manifest.runId} must declare contextProfile`);
    assert(isObject(manifest.model), `Run ${manifest.runId} must include model metadata`);
    assert(isNonEmptyString(manifest.model.provider), `Run ${manifest.runId} must include model.provider`);
    assert(isNonEmptyString(manifest.model.modelId), `Run ${manifest.runId} must include model.modelId`);
    assert(isNonEmptyString(manifest.model.runDate), `Run ${manifest.runId} must include model.runDate`);
    assert(
        isNonEmptyString(manifest.model.promptPackVersion),
        `Run ${manifest.runId} must include model.promptPackVersion`,
    );
    assert(isNonEmptyString(manifest.humanReviewPath), `Run ${manifest.runId} must include humanReviewPath`);
    assert(
        Array.isArray(manifest.scenarios) && manifest.scenarios.length > 0,
        `Run ${manifest.runId} must include scenarios`,
    );

    if (manifest.runType === "evaluation") {
        assert(
            fixedLibraryShortlist.includes(manifest.library),
            `Evaluation run ${manifest.runId} must use one of the public benchmark libraries`,
        );
    }

    const scenarioIds = [];

    for (const scenarioRun of manifest.scenarios) {
        assert(isNonEmptyString(scenarioRun.scenarioId), `Run ${manifest.runId} has a scenario without scenarioId`);
        assert(
            scenarioMap.has(scenarioRun.scenarioId),
            `Run ${manifest.runId} references unknown scenario ${scenarioRun.scenarioId}`,
        );
        assert(
            isNonEmptyString(scenarioRun.transcriptPath),
            `Run ${manifest.runId} scenario ${scenarioRun.scenarioId} must include transcriptPath`,
        );
        assert(
            isNonEmptyString(scenarioRun.submissionDir),
            `Run ${manifest.runId} scenario ${scenarioRun.scenarioId} must include submissionDir`,
        );
        assert(
            Number.isInteger(scenarioRun.followUpPrompts) && scenarioRun.followUpPrompts >= 0,
            `Run ${manifest.runId} scenario ${scenarioRun.scenarioId} must include non-negative followUpPrompts`,
        );
        assert(
            isObject(scenarioRun.firstAttempt),
            `Run ${manifest.runId} scenario ${scenarioRun.scenarioId} must include firstAttempt`,
        );
        assert(
            isBoolean(scenarioRun.firstAttempt.compiled),
            `Run ${manifest.runId} scenario ${scenarioRun.scenarioId} must include firstAttempt.compiled`,
        );
        assert(
            isBoolean(scenarioRun.firstAttempt.tested),
            `Run ${manifest.runId} scenario ${scenarioRun.scenarioId} must include firstAttempt.tested`,
        );

        await ensurePathExists(
            path.join(rootDir, scenarioRun.transcriptPath),
            `Transcript for ${manifest.runId}/${scenarioRun.scenarioId}`,
        );
        await ensurePathExists(
            path.join(rootDir, scenarioRun.submissionDir),
            `Submission directory for ${manifest.runId}/${scenarioRun.scenarioId}`,
        );

        if (scenarioRun.reviewerNotesPath) {
            await ensurePathExists(
                path.join(rootDir, scenarioRun.reviewerNotesPath),
                `Reviewer notes for ${manifest.runId}/${scenarioRun.scenarioId}`,
            );
        }

        scenarioIds.push(scenarioRun.scenarioId);
    }

    const review = await loadAndValidateHumanReview(path.join(rootDir, manifest.humanReviewPath), scenarioIds);

    return review;
}

export async function ensureBenchmarkSchemasExist() {
    await ensurePathExists(path.join(benchmarkDir, "schema", "run-manifest.schema.json"), "Run manifest schema");
    await ensurePathExists(path.join(benchmarkDir, "schema", "human-review.schema.json"), "Human review schema");
}
