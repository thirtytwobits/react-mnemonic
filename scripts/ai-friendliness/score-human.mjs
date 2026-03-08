// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { normalizeHumanReviewScore } from "./shared.mjs";

export function scoreHumanScenario(review, scenarioId) {
    const scenarioReview = review.scenarios[scenarioId];
    const humanReviewScore = normalizeHumanReviewScore(scenarioReview);
    const criticalFailures = scenarioReview.criticalSemanticMiss ? ["humanCriticalSemanticMiss"] : [];

    return {
        humanReviewScore,
        criticalFailures,
        reviewerNotes: scenarioReview.notes,
        review: scenarioReview,
    };
}
