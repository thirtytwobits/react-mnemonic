// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useState } from "react";
import { MnemonicProvider, useMnemonicKey } from "react-mnemonic";

type Theme = "light" | "dark";
type Density = "comfortable" | "compact";

type BadCompositeState = {
    theme: Theme;
    density: Density;
    sidebarOpen: boolean;
    searchDraft: string;
};

type PersistedPreferences = {
    theme: Theme;
    density: Density;
};

type EphemeralUiState = {
    sidebarOpen: boolean;
    searchDraft: string;
};

const badDefaults: BadCompositeState = {
    theme: "light",
    density: "comfortable",
    sidebarOpen: false,
    searchDraft: "",
};

const persistedDefaults: PersistedPreferences = {
    theme: "light",
    density: "comfortable",
};

const ephemeralDefaults: EphemeralUiState = {
    sidebarOpen: false,
    searchDraft: "",
};

function usePersistentSlice<Persisted extends object, Ephemeral extends object>(
    key: string,
    options: {
        defaultPersistent: Persisted;
        defaultEphemeral: Ephemeral;
    },
) {
    const {
        value: persisted,
        set: setPersisted,
        reset: resetPersisted,
    } = useMnemonicKey<Persisted>(key, {
        defaultValue: options.defaultPersistent,
    });
    const [ephemeral, setEphemeral] = useState<Ephemeral>(options.defaultEphemeral);

    const updatePersisted = <K extends keyof Persisted>(field: K, value: Persisted[K]) => {
        setPersisted((prev) => ({ ...prev, [field]: value }));
    };

    const updateEphemeral = <K extends keyof Ephemeral>(field: K, value: Ephemeral[K]) => {
        setEphemeral((prev) => ({ ...prev, [field]: value }));
    };

    const resetAll = () => {
        resetPersisted();
        setEphemeral(options.defaultEphemeral);
    };

    return {
        persisted,
        ephemeral,
        updatePersisted,
        updateEphemeral,
        resetAll,
    };
}

function BadCompositeCard() {
    const {
        value: state,
        set,
        reset,
    } = useMnemonicKey<BadCompositeState>("bad-composite-ui", {
        defaultValue: badDefaults,
    });

    const update = <K extends keyof BadCompositeState>(field: K, value: BadCompositeState[K]) => {
        set((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <div className="demo-split-card">
            <div className="demo-split-card__header">
                <h3>Anti-pattern: persist the whole UI object</h3>
                <span className="demo-split-pill demo-split-pill--warning">Surprising rehydration</span>
            </div>
            <p className="demo-muted">
                Theme and density belong in storage, but this shape also persists transient UI fields like search text
                and whether the sidebar is open.
            </p>

            <div className="demo-form">
                <div className="demo-form-row">
                    <label htmlFor="bad-theme">Theme (durable)</label>
                    <select
                        id="bad-theme"
                        value={state.theme}
                        onChange={(e) => update("theme", e.target.value as Theme)}
                    >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </div>

                <div className="demo-form-row">
                    <label htmlFor="bad-density">Density (durable)</label>
                    <select
                        id="bad-density"
                        value={state.density}
                        onChange={(e) => update("density", e.target.value as Density)}
                    >
                        <option value="comfortable">Comfortable</option>
                        <option value="compact">Compact</option>
                    </select>
                </div>

                <div className="demo-form-row demo-form-checkbox">
                    <input
                        id="bad-sidebar"
                        type="checkbox"
                        checked={state.sidebarOpen}
                        onChange={(e) => update("sidebarOpen", e.target.checked)}
                    />
                    <label htmlFor="bad-sidebar">Sidebar open (transient, but persisted here)</label>
                </div>

                <div className="demo-form-row">
                    <label htmlFor="bad-search">Search draft (transient, but persisted here)</label>
                    <input
                        id="bad-search"
                        type="text"
                        value={state.searchDraft}
                        onChange={(e) => update("searchDraft", e.target.value)}
                        placeholder="Try typing, then reload"
                    />
                </div>
            </div>

            <div className="demo-split-summary">
                <strong>Reload behavior:</strong> everything below comes back, including the open sidebar and search
                draft.
            </div>

            <pre className="demo-result">{JSON.stringify(state, null, 2)}</pre>

            <div style={{ marginTop: 12 }}>
                <button className="button button--sm button--danger" onClick={() => reset()}>
                    Reset bad example
                </button>
            </div>
        </div>
    );
}

function GoodSplitCard() {
    const { persisted, ephemeral, updatePersisted, updateEphemeral, resetAll } = usePersistentSlice<
        PersistedPreferences,
        EphemeralUiState
    >("good-split-preferences", {
        defaultPersistent: persistedDefaults,
        defaultEphemeral: ephemeralDefaults,
    });

    return (
        <div className="demo-split-card">
            <div className="demo-split-card__header">
                <h3>Recommended: persist only the durable slice</h3>
                <span className="demo-split-pill demo-split-pill--success">Intentional reloads</span>
            </div>
            <p className="demo-muted">
                Durable preferences stay in `useMnemonicKey`, while runtime-only UI fields stay in plain React state.
            </p>

            <div className="demo-form">
                <div className="demo-form-row">
                    <label htmlFor="good-theme">Theme (durable)</label>
                    <select
                        id="good-theme"
                        value={persisted.theme}
                        onChange={(e) => updatePersisted("theme", e.target.value as Theme)}
                    >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </div>

                <div className="demo-form-row">
                    <label htmlFor="good-density">Density (durable)</label>
                    <select
                        id="good-density"
                        value={persisted.density}
                        onChange={(e) => updatePersisted("density", e.target.value as Density)}
                    >
                        <option value="comfortable">Comfortable</option>
                        <option value="compact">Compact</option>
                    </select>
                </div>

                <div className="demo-form-row demo-form-checkbox">
                    <input
                        id="good-sidebar"
                        type="checkbox"
                        checked={ephemeral.sidebarOpen}
                        onChange={(e) => updateEphemeral("sidebarOpen", e.target.checked)}
                    />
                    <label htmlFor="good-sidebar">Sidebar open (transient, in memory only)</label>
                </div>

                <div className="demo-form-row">
                    <label htmlFor="good-search">Search draft (transient, in memory only)</label>
                    <input
                        id="good-search"
                        type="text"
                        value={ephemeral.searchDraft}
                        onChange={(e) => updateEphemeral("searchDraft", e.target.value)}
                        placeholder="Try typing, then reload"
                    />
                </div>
            </div>

            <div className="demo-split-summary">
                <strong>Reload behavior:</strong> theme and density rehydrate, but the sidebar and search draft reset.
            </div>

            <div className="demo-split-state-grid">
                <div>
                    <div className="demo-split-state-label">Persisted slice</div>
                    <pre className="demo-result">{JSON.stringify(persisted, null, 2)}</pre>
                </div>
                <div>
                    <div className="demo-split-state-label">Ephemeral slice</div>
                    <pre className="demo-result">{JSON.stringify(ephemeral, null, 2)}</pre>
                </div>
            </div>

            <div style={{ marginTop: 12 }}>
                <button className="button button--sm button--secondary" onClick={() => resetAll()}>
                    Reset good example
                </button>
            </div>
        </div>
    );
}

export function PersistentVsEphemeralDemo() {
    return (
        <MnemonicProvider namespace="split-demo">
            <div className="demo-split-showcase">
                <div className="demo-alert demo-alert--success">
                    Durable values should come back after reload. Transient UI state should only survive when you
                    intentionally keep it in memory for the current session.
                </div>
                <div className="demo-split-grid">
                    <BadCompositeCard />
                    <GoodSplitCard />
                </div>
            </div>
        </MnemonicProvider>
    );
}
