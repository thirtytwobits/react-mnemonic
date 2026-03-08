// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import prettier from "prettier";
import { aggregateReport, summarizeRun } from "./ai-friendliness/aggregate-report.mjs";
import { scoreAutomatedScenario } from "./ai-friendliness/score-automated.mjs";
import { scoreHumanScenario } from "./ai-friendliness/score-human.mjs";
import {
    benchmarkDir,
    collectSubmissionText,
    loadEvaluationRunManifests,
    loadScenarioManifests,
    loadValidationRunManifests,
    mean,
    readJson,
    resultsPath,
    rootDir,
    scenarioMapFromList,
} from "./ai-friendliness/shared.mjs";
import {
    ensureBenchmarkSchemasExist,
    validateRunManifest,
    validateScenarioManifest,
} from "./ai-friendliness/validate-manifest.mjs";

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

function buildScenarioResult({ scenario, scenarioRun, automated, human, followUpPenalty }) {
    const semanticScore = Number((automated.automatedSemanticScore * 0.7 + human.humanReviewScore * 0.3).toFixed(2));
    const interventionCost = scenarioRun.followUpPrompts * followUpPenalty;
    const interventionAdjustedScore = Math.max(0, semanticScore - interventionCost);
    const criticalFailures = [...automated.criticalFailures, ...human.criticalFailures];
    const reviewerCompleted =
        typeof human.review.persistenceAppropriateness === "number" &&
        typeof human.review.semanticNuanceCorrectness === "number" &&
        typeof human.review.unnecessaryUserIntervention === "number";
    const oneShotPass =
        automated.automatedSemanticScore >= 85 &&
        human.humanReviewScore >= 75 &&
        scenarioRun.followUpPrompts === 0 &&
        criticalFailures.length === 0;

    return {
        scenarioId: scenario.id,
        title: scenario.title,
        prompt: scenario.prompt,
        followUpPrompts: scenarioRun.followUpPrompts,
        firstAttempt: scenarioRun.firstAttempt,
        transcriptPath: scenarioRun.transcriptPath,
        submissionDir: scenarioRun.submissionDir,
        reviewerNotesPath: scenarioRun.reviewerNotesPath ?? null,
        automatedSemanticScore: automated.automatedSemanticScore,
        humanReviewScore: human.humanReviewScore,
        semanticScore,
        interventionCost,
        interventionAdjustedScore,
        reviewerCompleted,
        oneShotPass,
        criticalFailures,
        checks: automated.checks,
        humanReview: human.review,
        reviewerNotes: human.reviewerNotes,
    };
}

async function scoreRunManifest({ manifest, scenarioMap, followUpPenalty }) {
    const review = await validateRunManifest(manifest, scenarioMap);
    const scenarioResults = [];

    for (const scenarioRun of manifest.scenarios) {
        const scenario = scenarioMap.get(scenarioRun.scenarioId);
        const submissionText = await collectSubmissionText(scenarioRun.submissionDir);
        const automated = scoreAutomatedScenario({
            library: manifest.library,
            scenario,
            scenarioRun,
            submissionText,
        });
        const human = scoreHumanScenario(review, scenario.id);
        scenarioResults.push(
            buildScenarioResult({
                scenario,
                scenarioRun,
                automated,
                human,
                followUpPenalty,
            }),
        );
    }

    return summarizeRun({
        manifest,
        review,
        scenarioResults,
        followUpPenalty,
    });
}

function ensureValidationCoverage(validationRuns, scenarios) {
    const coveredScenarioIds = new Set(
        validationRuns.flatMap((run) => run.scenarioResults.map((scenarioResult) => scenarioResult.scenarioId)),
    );
    const missingScenarioIds = scenarios
        .map((scenario) => scenario.id)
        .filter((scenarioId) => !coveredScenarioIds.has(scenarioId));

    if (missingScenarioIds.length > 0) {
        throw new Error(`Validation fixtures are missing scenario coverage for: ${missingScenarioIds.join(", ")}`);
    }
}

async function main() {
    await ensureReady();
    await ensureBenchmarkSchemasExist();

    const benchmarkMeta = await readJson(path.join(benchmarkDir, "meta.json"));
    const scenarios = await loadScenarioManifests();
    for (const scenario of scenarios) {
        await validateScenarioManifest(scenario);
    }

    const benchmark = {
        ...benchmarkMeta,
        scenarios,
    };
    const scenarioMap = scenarioMapFromList(scenarios);
    const followUpPenalty = benchmark.metrics.followUpPenalty;

    const validationRuns = [];
    for (const manifest of await loadValidationRunManifests()) {
        validationRuns.push(await scoreRunManifest({ manifest, scenarioMap, followUpPenalty }));
    }
    ensureValidationCoverage(validationRuns, scenarios);

    const evaluationRuns = [];
    for (const manifest of await loadEvaluationRunManifests()) {
        evaluationRuns.push(await scoreRunManifest({ manifest, scenarioMap, followUpPenalty }));
    }

    const report = aggregateReport({
        benchmark,
        validationRuns,
        evaluationRuns,
    });

    await mkdir(path.dirname(resultsPath), { recursive: true });
    const prettierConfig = (await prettier.resolveConfig(resultsPath)) ?? {};
    const formattedReport = await prettier.format(JSON.stringify(report), {
        ...prettierConfig,
        filepath: resultsPath,
        parser: "json",
    });
    await writeFile(resultsPath, formattedReport);

    console.table(
        [...validationRuns, ...evaluationRuns].map((result) => ({
            run: result.label,
            library: result.library,
            "one-shot %": result.oneShotPassRate,
            "mean follow-ups": result.meanFollowUpPrompts,
            automated: result.automatedSemanticScore,
            human: result.humanReviewScore,
            semantic: result.semanticScore,
            adjusted: result.interventionAdjustedScore,
        })),
    );

    if (report.publishableSummary.length > 0) {
        console.table(
            report.publishableSummary.map((entry) => ({
                model: `${entry.model.provider}/${entry.model.modelId}`,
                library: entry.library,
                adjusted: entry.interventionAdjustedScore,
                "one-shot %": entry.oneShotPassRate,
            })),
        );
    }

    console.log(`Average validation semantic score: ${mean(validationRuns.map((run) => run.semanticScore))}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
