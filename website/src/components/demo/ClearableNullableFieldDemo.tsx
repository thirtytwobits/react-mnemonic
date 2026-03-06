// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { MnemonicProvider, useMnemonicKey } from "react-mnemonic";

const defaultDisplayName = "Anonymous";

function ClearableNullableFieldDemoInner() {
    const {
        value: displayName,
        set,
        reset,
        remove,
    } = useMnemonicKey<string | null>("clearable-display-name", {
        defaultValue: defaultDisplayName,
    });

    const semanticState =
        displayName === null
            ? "Persisted null (clear intent survives reload)"
            : displayName === defaultDisplayName
              ? "Default value is active"
              : "Custom value is active";

    return (
        <div className="demo-split-showcase">
            <div className="demo-split-card">
                <div className="demo-split-card__header">
                    <h3>Clearable persisted field</h3>
                    <span className="demo-split-pill demo-split-pill--success">`null` stays cleared</span>
                </div>
                <p className="demo-muted">
                    This field persists <code>string | null</code>. Empty input is normalized to <code>null</code>,
                    which records a real clear intent instead of deleting the key.
                </p>

                <div className="demo-form">
                    <div className="demo-form-row">
                        <label htmlFor="clearable-display-name">Display name</label>
                        <input
                            id="clearable-display-name"
                            type="text"
                            value={displayName ?? ""}
                            onChange={(e) => {
                                const nextValue = e.target.value.trim();
                                set(nextValue === "" ? null : e.target.value);
                            }}
                            placeholder="Type a name or clear the field"
                        />
                    </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    <button
                        className="button button--sm button--outline button--secondary"
                        onClick={() => set("Scott")}
                    >
                        Set sample
                    </button>
                    <button className="button button--sm button--secondary" onClick={() => set(null)}>
                        Persist null clear
                    </button>
                    <button className="button button--sm button--danger" onClick={() => remove()}>
                        Remove key
                    </button>
                    <button className="button button--sm button--outline" onClick={() => reset()}>
                        Reset default
                    </button>
                </div>

                <div className="demo-split-summary">
                    <strong>Reload behavior:</strong> after <code>set(null)</code>, the field stays cleared. After{" "}
                    <code>remove()</code> or <code>reset()</code>, the default <code>{defaultDisplayName}</code> comes
                    back.
                </div>

                <pre className="demo-result">
                    {JSON.stringify(
                        {
                            displayName,
                            semanticState,
                        },
                        null,
                        2,
                    )}
                </pre>
            </div>
        </div>
    );
}

export function ClearableNullableFieldDemo() {
    return (
        <MnemonicProvider namespace="clearable-demo">
            <ClearableNullableFieldDemoInner />
        </MnemonicProvider>
    );
}
