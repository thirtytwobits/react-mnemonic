// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useState, useEffect, useRef } from "react";
import { useMnemonicKey, CodecError, SchemaError } from "react-mnemonic";

interface FormData {
    name: string;
    email: string;
    bio: string;
    role: string;
    newsletter: boolean;
}

const defaultForm: FormData = {
    name: "",
    email: "",
    bio: "",
    role: "developer",
    newsletter: false,
};

const getDefaultForm = (error?: CodecError | SchemaError): FormData => {
    if (error) {
        console.warn("[PersistedForm] Using defaults due to:", error.message);
    }
    return defaultForm;
};

export function PersistedForm() {
    const {
        value: form,
        set,
        remove,
    } = useMnemonicKey<FormData>("form-data", {
        defaultValue: getDefaultForm,
        listenCrossTab: true,
    });

    const [showSaved, setShowSaved] = useState(false);
    const timeout = useRef<ReturnType<typeof setTimeout>>();

    const update = <K extends keyof FormData>(field: K, val: FormData[K]) => {
        set((prev) => ({ ...prev, [field]: val }));
        setShowSaved(true);
        clearTimeout(timeout.current);
        timeout.current = setTimeout(() => setShowSaved(false), 1500);
    };

    useEffect(() => () => clearTimeout(timeout.current), []);

    return (
        <div className="demo-form">
            <div className="demo-form-row">
                <label htmlFor="pf-name">Name</label>
                <input
                    id="pf-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Jane Doe"
                />
            </div>
            <div className="demo-form-row">
                <label htmlFor="pf-email">Email</label>
                <input
                    id="pf-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="jane@example.com"
                />
            </div>
            <div className="demo-form-row">
                <label htmlFor="pf-bio">Bio</label>
                <textarea
                    id="pf-bio"
                    value={form.bio}
                    onChange={(e) => update("bio", e.target.value)}
                    placeholder="Tell us about yourself…"
                />
            </div>
            <div className="demo-form-row">
                <label htmlFor="pf-role">Role</label>
                <select
                    id="pf-role"
                    value={form.role}
                    onChange={(e) => update("role", e.target.value)}
                >
                    <option value="developer">Developer</option>
                    <option value="designer">Designer</option>
                    <option value="manager">Manager</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div className="demo-form-row demo-form-checkbox">
                <input
                    id="pf-newsletter"
                    type="checkbox"
                    checked={form.newsletter}
                    onChange={(e) => update("newsletter", e.target.checked)}
                />
                <label htmlFor="pf-newsletter">Subscribe to newsletter</label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                <button className="button button--sm button--danger" onClick={() => remove()}>
                    Clear all fields
                </button>
                <span
                    style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "var(--ifm-color-success)",
                        opacity: showSaved ? 1 : 0,
                        transition: "opacity 0.3s",
                    }}
                >
                    Saved
                </span>
            </div>
        </div>
    );
}
