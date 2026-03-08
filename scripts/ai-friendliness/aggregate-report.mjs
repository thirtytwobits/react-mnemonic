// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { mean, modelKey, toPercent } from "./shared.mjs";

export function summarizeRun({ manifest, review, scenarioResults, followUpPenalty }) {
    const oneShotPassRate = toPercent(
        scenarioResults.filter((scenarioResult) => scenarioResult.oneShotPass).length / scenarioResults.length,
    );

    return {
        runId: manifest.runId,
        label: manifest.label,
        runType: manifest.runType,
        library: manifest.library,
        model: manifest.model,
        contextProfile: manifest.contextProfile,
        humanReviewPath: manifest.humanReviewPath,
        reviewer: review.reviewer,
        reviewedAt: review.reviewedAt,
        reviewerCompleted: scenarioResults.every((scenarioResult) => scenarioResult.reviewerCompleted),
        scoringMode: "hybrid",
        followUpPenalty,
        oneShotPassRate,
        meanFollowUpPrompts: mean(scenarioResults.map((scenarioResult) => scenarioResult.followUpPrompts)),
        automatedSemanticScore: mean(scenarioResults.map((scenarioResult) => scenarioResult.automatedSemanticScore)),
        humanReviewScore: mean(scenarioResults.map((scenarioResult) => scenarioResult.humanReviewScore)),
        semanticScore: mean(scenarioResults.map((scenarioResult) => scenarioResult.semanticScore)),
        interventionAdjustedScore: mean(
            scenarioResults.map((scenarioResult) => scenarioResult.interventionAdjustedScore),
        ),
        firstAttemptCleanRate: toPercent(
            scenarioResults.filter(
                (scenarioResult) => scenarioResult.firstAttempt.compiled && scenarioResult.firstAttempt.tested,
            ).length / scenarioResults.length,
        ),
        criticalFailureCount: scenarioResults.reduce(
            (sum, scenarioResult) => sum + scenarioResult.criticalFailures.length,
            0,
        ),
        scenarioResults,
    };
}

export function aggregateReport({ benchmark, validationRuns, evaluationRuns }) {
    const groupedByModel = new Map();

    for (const run of evaluationRuns) {
        const key = modelKey(run.model);
        const group = groupedByModel.get(key) ?? {
            model: run.model,
            runs: [],
        };
        group.runs.push(run);
        groupedByModel.set(key, group);
    }

    const aggregateByModel = Array.from(groupedByModel.values())
        .map((group) => {
            const aggregateByLibrary = group.runs
                .map((run) => ({
                    library: run.library,
                    oneShotPassRate: run.oneShotPassRate,
                    meanFollowUpPrompts: run.meanFollowUpPrompts,
                    automatedSemanticScore: run.automatedSemanticScore,
                    humanReviewScore: run.humanReviewScore,
                    semanticScore: run.semanticScore,
                    interventionAdjustedScore: run.interventionAdjustedScore,
                    firstAttemptCleanRate: run.firstAttemptCleanRate,
                }))
                .sort((left, right) => left.library.localeCompare(right.library));

            const librariesPresent = aggregateByLibrary.map((item) => item.library);
            const publishable = benchmark.fixedLibraryShortlist.every((library) => librariesPresent.includes(library));

            return {
                model: group.model,
                publishable,
                aggregateByLibrary,
            };
        })
        .sort((left, right) => modelKey(left.model).localeCompare(modelKey(right.model)));

    const publishableSummary = aggregateByModel.flatMap((group) => {
        if (!group.publishable) {
            return [];
        }

        return group.aggregateByLibrary
            .slice()
            .sort((left, right) => right.interventionAdjustedScore - left.interventionAdjustedScore)
            .map((libraryScore) => ({
                model: group.model,
                ...libraryScore,
            }));
    });

    return {
        generatedAt: new Date().toISOString(),
        benchmarkVersion: benchmark.benchmarkVersion,
        benchmarkName: benchmark.benchmarkName,
        evaluationMode: {
            comparisonAxis: "libraries-fixed-model",
            scoringMode: "hybrid",
        },
        assumptions: benchmark.assumptions,
        scoring: {
            followUpPenalty: benchmark.metrics.followUpPenalty,
            formula: "semanticScore = 0.7 * automatedSemanticScore + 0.3 * humanReviewScore",
            interventionFormula: `interventionAdjustedScore = max(0, semanticScore - ${benchmark.metrics.followUpPenalty} * followUpPrompts)`,
            oneShotPass: {
                automatedSemanticScore: ">= 85",
                humanReviewScore: ">= 75",
                followUpPrompts: "=== 0",
                criticalFailures: "must be empty",
            },
        },
        fixedLibraryShortlist: benchmark.fixedLibraryShortlist,
        scenarios: benchmark.scenarios.map((scenario) => ({
            id: scenario.id,
            title: scenario.title,
            focus: scenario.focus,
            prompt: scenario.prompt,
            starterAppPath: scenario.starterAppPath,
        })),
        status: {
            validationRunCount: validationRuns.length,
            evaluationRunCount: evaluationRuns.length,
            hasPublishableResults: publishableSummary.length > 0,
        },
        validationRuns,
        evaluationRuns,
        aggregateByModel,
        publishableSummary,
    };
}
