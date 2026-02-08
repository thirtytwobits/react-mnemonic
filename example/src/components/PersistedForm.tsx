// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useState, useEffect, useRef } from "react";
import { useMnemonicKey, CodecError, ValidationError } from "react-mnemonic";

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

/** Validate that the decoded value has the expected FormData shape. */
const isFormData = (val: unknown): val is FormData => {
    if (typeof val !== "object" || val === null) return false;
    const obj = val as Record<string, unknown>;
    return (
        typeof obj.name === "string" &&
        typeof obj.email === "string" &&
        typeof obj.bio === "string" &&
        typeof obj.role === "string" &&
        typeof obj.newsletter === "boolean"
    );
};

/**
 * Error-aware default factory.
 * Defined at module level for a stable reference (avoids re-renders).
 */
const getDefaultForm = (error?: CodecError | ValidationError): FormData => {
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
        validate: isFormData,
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
        <div className="persisted-form">
            <div className="form-row">
                <label htmlFor="pf-name">Name</label>
                <input
                    id="pf-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Jane Doe"
                />
            </div>
            <div className="form-row">
                <label htmlFor="pf-email">Email</label>
                <input
                    id="pf-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="jane@example.com"
                />
            </div>
            <div className="form-row">
                <label htmlFor="pf-bio">Bio</label>
                <textarea
                    id="pf-bio"
                    value={form.bio}
                    onChange={(e) => update("bio", e.target.value)}
                    placeholder="Tell us about yourself…"
                />
            </div>
            <div className="form-row">
                <label htmlFor="pf-role">Role</label>
                <select id="pf-role" value={form.role} onChange={(e) => update("role", e.target.value)}>
                    <option value="developer">Developer</option>
                    <option value="designer">Designer</option>
                    <option value="manager">Manager</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div className="form-row form-checkbox">
                <input
                    id="pf-newsletter"
                    type="checkbox"
                    checked={form.newsletter}
                    onChange={(e) => update("newsletter", e.target.checked)}
                />
                <label htmlFor="pf-newsletter">Subscribe to newsletter</label>
            </div>
            <div className="form-footer">
                <button className="btn btn-danger btn-sm" onClick={() => remove()}>
                    Clear all fields
                </button>
                <span className={`saved-indicator${showSaved ? " visible" : ""}`}>Saved</span>
            </div>
        </div>
    );
}
