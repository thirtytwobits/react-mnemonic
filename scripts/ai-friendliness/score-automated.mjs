// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

const libraryRules = {
    "react-mnemonic": {
        usesTargetLibrary: (text) => /MnemonicProvider/.test(text) && /useMnemonicKey|defineMnemonicKey/.test(text),
        bypassesTargetLibrary: (text) => /localStorage\.(getItem|setItem|removeItem)|window\.localStorage/.test(text),
    },
    "zustand/persist": {
        usesTargetLibrary: (text) => /from\s+"zustand"/.test(text) && /persist\s*\(/.test(text),
        bypassesTargetLibrary: (text) => /localStorage\.(getItem|setItem|removeItem)|window\.localStorage/.test(text),
    },
    "jotai/atomWithStorage": {
        usesTargetLibrary: (text) => /atomWithStorage/.test(text) && /useAtom/.test(text),
        bypassesTargetLibrary: (text) => /localStorage\.(getItem|setItem|removeItem)|window\.localStorage/.test(text),
    },
    "use-local-storage-state": {
        usesTargetLibrary: (text) => /useLocalStorageState/.test(text),
        bypassesTargetLibrary: (text) =>
            /localStorage\.(getItem|setItem|removeItem)|window\.localStorage/.test(text) &&
            !/useLocalStorageState/.test(text),
    },
    "usehooks-ts/useLocalStorage": {
        usesTargetLibrary: (text) => /from\s+"usehooks-ts"/.test(text) && /useLocalStorage/.test(text),
        bypassesTargetLibrary: (text) =>
            /localStorage\.(getItem|setItem|removeItem)|window\.localStorage/.test(text) &&
            !/useLocalStorage/.test(text),
    },
    "raw-localstorage": {
        usesTargetLibrary: (text) => /localStorage\.(getItem|setItem|removeItem)|window\.localStorage/.test(text),
        bypassesTargetLibrary: () => false,
    },
};

function matchesAny(text, patterns) {
    return patterns.some((pattern) => pattern.test(text));
}

function usesPublishedPackageTypes(library, submissionText) {
    if (library !== "react-mnemonic") {
        return true;
    }

    return !matchesAny(submissionText, [
        /\/\*\s*FILE:\s*.*\.d\.ts\s*\*\//,
        /declare\s+module\s+["']react-mnemonic["']/,
        /reference\s+path=.*react-mnemonic/i,
    ]);
}

function includesStorageEventHandling(text) {
    return matchesAny(text, [
        /listenCrossTab\s*:\s*true/,
        /storageSync\s*:\s*true/,
        /addEventListener\(\s*["']storage["']/,
        /BroadcastChannel/,
        /subscribe/i,
    ]);
}

function durableScenarioPatterns(scenarioId) {
    switch (scenarioId) {
        case "theme-preference":
        case "ssr-theme-badge":
        case "reset-vs-remove":
            return [/theme/, /preference/, /preferences/];
        case "saved-filters-ephemeral-search":
            return [/savedFilters/, /filters/, /category/];
        case "nullable-nickname":
            return [/nickname/];
        case "wizard-draft-migration":
            return [/onboardingDraft/, /\bdraft\b/, /acceptedTerms/];
        case "dismissed-banner":
            return [/dismissed/, /announcementDismissed/, /banner/];
        default:
            return [];
    }
}

function usesDurableStateForScenario({ scenario, submissionText }) {
    return matchesAny(submissionText, durableScenarioPatterns(scenario.id));
}

function persistsDraftSearch(submissionText) {
    return matchesAny(submissionText, [
        /localStorage\.(getItem|setItem|removeItem)\([^)]*draftSearch/i,
        /useMnemonicKey\([^)]*draftSearch/i,
        /defineMnemonicKey\([^)]*draftSearch/i,
        /atomWithStorage\([^)]*draftSearch/i,
        /useLocalStorageState\([^)]*draftSearch/i,
        /useLocalStorage\([^)]*draftSearch/i,
        /persist[\s\S]{0,300}draftSearch/i,
    ]);
}

function hasVersionEnvelopeUpgrade(submissionText) {
    return (
        matchesAny(submissionText, [/version\s*:/, /schema:\s*\{\s*version:\s*\d+/]) &&
        matchesAny(submissionText, [
            /migrate:/,
            /\bmigrate\b/,
            /\bupgrade\b/i,
            /fromVersion/,
            /toVersion/,
            /reconcile:/,
        ])
    );
}

function hasExplicitSsrStrategy({ library, submissionText }) {
    switch (library) {
        case "react-mnemonic":
            return /serverValue/.test(submissionText) && /hydration:\s*["']client-only["']/.test(submissionText);
        case "zustand/persist":
            return /skipHydration/.test(submissionText) && /rehydrate/.test(submissionText);
        case "use-local-storage-state":
            return /defaultServerValue/.test(submissionText);
        case "usehooks-ts/useLocalStorage":
            return /initializeWithValue:\s*false/.test(submissionText);
        case "jotai/atomWithStorage":
            return matchesAny(submissionText, [
                /typeof window\s*===?\s*["']undefined["']/,
                /\bmounted\b/,
                /\bisClient\b/,
                /useEffect\(/,
                /ClientOnly/,
            ]);
        default:
            return false;
    }
}

const automatedCheckHandlers = {
    targetLibraryUsage: ({ library, submissionText }) => libraryRules[library].usesTargetLibrary(submissionText),
    publishedPackageTypes: ({ library, submissionText }) => usesPublishedPackageTypes(library, submissionText),
    avoidBypassingTargetLibrary: ({ library, submissionText }) =>
        !libraryRules[library].bypassesTargetLibrary(submissionText),
    durableStateChoice: ({ scenario, submissionText }) => usesDurableStateForScenario({ scenario, submissionText }),
    durableThemeChoice: ({ submissionText }) => /theme/.test(submissionText),
    ephemeralSearchDraft: ({ submissionText }) =>
        /useState/.test(submissionText) && !persistsDraftSearch(submissionText),
    nullableSemantics: ({ submissionText }) =>
        /nickname/.test(submissionText) &&
        /null/.test(submissionText) &&
        (/set\(null\)/.test(submissionText) || /=>\s*null/.test(submissionText) || /:\s*null[,}]/.test(submissionText)),
    schemaWorkflow: ({ submissionText }) => hasVersionEnvelopeUpgrade(submissionText),
    ssrHandling: ({ library, submissionText }) => hasExplicitSsrStrategy({ library, submissionText }),
    simpleDismissRecipe: ({ submissionText }) =>
        /defaultValue:\s*false/.test(submissionText) || /useState\(false\)/.test(submissionText),
    crossTabBehavior: ({ library, submissionText }) => {
        if (library === "use-local-storage-state") {
            return !/storageSync\s*:\s*false/.test(submissionText);
        }

        return includesStorageEventHandling(submissionText);
    },
    resetRemoveSemantics: ({ library, submissionText }) => {
        if (library === "react-mnemonic") {
            return /reset\(\)/.test(submissionText) && /remove\(\)/.test(submissionText);
        }

        return (
            matchesAny(submissionText, [
                /removeItem/,
                /\bremove[A-Z]\w*\(/,
                /\bclear[A-Z]\w*\(/,
                /\bdelete[A-Z]\w*\(/,
            ]) &&
            matchesAny(submissionText, [
                /Reset to defaults/,
                /defaultValue/,
                /setTheme\(/,
                /setPreference\(/,
                /setValue\(/,
            ])
        );
    },
};

export function scoreAutomatedScenario({ library, scenario, scenarioRun, submissionText }) {
    const checkResults = [];

    for (const check of scenario.automatedChecks) {
        const handler = automatedCheckHandlers[check.id];
        if (!handler) {
            throw new Error(`Scenario ${scenario.id} references unknown automated check ${check.id}`);
        }

        const passed = handler({
            library,
            scenario,
            scenarioRun,
            submissionText,
        });

        checkResults.push({
            id: check.id,
            description: check.description,
            weight: check.weight,
            critical: check.critical,
            passed,
        });
    }

    const totalWeight = checkResults.reduce((sum, check) => sum + check.weight, 0);
    const earnedWeight = checkResults.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
    const automatedSemanticScore = totalWeight === 0 ? 0 : Number(((earnedWeight / totalWeight) * 100).toFixed(2));

    const criticalFailures = checkResults.filter((check) => check.critical && !check.passed).map((check) => check.id);

    if (!scenarioRun.firstAttempt.compiled || !scenarioRun.firstAttempt.tested) {
        criticalFailures.push("firstAttemptNotClean");
    }

    return {
        automatedSemanticScore,
        criticalFailures,
        checks: checkResults,
    };
}
