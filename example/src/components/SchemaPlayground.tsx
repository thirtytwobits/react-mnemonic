// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from "react";
import {
    MnemonicProvider,
    useMnemonicKey,
    JSONCodec,
    CodecError,
    SchemaError,
    validateJsonSchema,
} from "react-mnemonic";
import type {
    SchemaRegistry,
    KeySchema,
    MigrationRule,
    SchemaMode,
    JsonSchema,
} from "react-mnemonic";

// ---------------------------------------------------------------------------
// JSON Schema templates (replace old validator presets)
// ---------------------------------------------------------------------------

const SCHEMA_TEMPLATES = [
    {
        id: "object",
        label: "object",
        schema: { type: "object" } as JsonSchema,
    },
    {
        id: "string",
        label: "string",
        schema: { type: "string" } as JsonSchema,
    },
    {
        id: "number",
        label: "number",
        schema: { type: "number" } as JsonSchema,
    },
    {
        id: "boolean",
        label: "boolean",
        schema: { type: "boolean" } as JsonSchema,
    },
    {
        id: "array",
        label: "array",
        schema: { type: "array" } as JsonSchema,
    },
    {
        id: "name-email",
        label: "name + email object",
        schema: {
            type: "object",
            properties: { name: { type: "string" }, email: { type: "string" } },
            required: ["name", "email"],
        } as JsonSchema,
    },
] as const;

// ---------------------------------------------------------------------------
// Mutable schema registry
// ---------------------------------------------------------------------------

interface MutableRegistry extends SchemaRegistry {
    _schemas: Map<string, KeySchema>;
    _migrations: MigrationRule[];
}

function createMutableRegistry(): MutableRegistry {
    const schemas = new Map<string, KeySchema>();
    const migrations: MigrationRule[] = [];

    return {
        _schemas: schemas,
        _migrations: migrations,
        getSchema(key, version) {
            return schemas.get(`${key}:${version}`);
        },
        getLatestSchema(key) {
            const candidates = Array.from(schemas.values()).filter(
                (s) => s.key === key,
            );
            if (candidates.length === 0) return undefined;
            return candidates.sort((a, b) => b.version - a.version)[0];
        },
        getMigrationPath(key, fromVersion, toVersion) {
            const byKey = migrations.filter((r) => r.key === key);
            const path: MigrationRule[] = [];
            let cur = fromVersion;
            while (cur < toVersion) {
                const next = byKey.find((r) => r.fromVersion === cur && r.toVersion > cur);
                if (!next) return null;
                path.push(next);
                cur = next.toVersion;
            }
            return path;
        },
        getWriteMigration(key, version) {
            const byKey = migrations.filter((r) => r.key === key);
            return byKey.find((r) => r.fromVersion === version && r.toVersion === version);
        },
        registerSchema(schema) {
            const id = `${schema.key}:${schema.version}`;
            if (schemas.has(id)) {
                throw new Error(`Schema already registered for ${id}`);
            }
            schemas.set(id, schema);
        },
    };
}

// ---------------------------------------------------------------------------
// Log helpers
// ---------------------------------------------------------------------------

type LogType = "info" | "error" | "success";
type LogEntry = { id: number; time: string; text: string; type: LogType };
let logIdCounter = 0;

function makeEntry(text: string, type: LogType): LogEntry {
    return {
        id: ++logIdCounter,
        time: new Date().toLocaleTimeString(),
        text,
        type,
    };
}

// ---------------------------------------------------------------------------
// Display types for registered schemas / migrations
// ---------------------------------------------------------------------------

type SchemaDisplay = { key: string; version: number; schema: JsonSchema };
type MigrationDisplay = { key: string; from: number; to: number };

// ---------------------------------------------------------------------------
// Write pre-flight check
// ---------------------------------------------------------------------------

/**
 * Mirrors the hook's internal encodeForWrite validation so the playground can
 * surface the real SchemaError / CodecError instead of a generic message.
 * Returns `null` when the write would succeed.
 */
function preflightEncode(
    value: unknown,
    key: string,
    registry: MutableRegistry,
    schemaMode: SchemaMode,
    schemaVersion?: number,
): Error | null {
    const explicitSchema = schemaVersion !== undefined ? registry.getSchema(key, schemaVersion) : undefined;
    const latestSchema = registry.getLatestSchema(key);
    let targetSchema = explicitSchema;

    if (!targetSchema) {
        if (schemaVersion !== undefined) {
            if (schemaMode !== "strict") {
                targetSchema = latestSchema;
            }
        } else {
            targetSchema = latestSchema;
        }
    }

    if (!targetSchema) {
        if (schemaVersion !== undefined && schemaMode === "strict") {
            return new SchemaError(
                "WRITE_SCHEMA_REQUIRED",
                `Write requires schema for key "${key}" in strict mode`,
            );
        }
        // No schema — encode with JSONCodec (always valid for JSON values).
        try {
            JSONCodec.encode(value);
            return null;
        } catch (err) {
            return err instanceof Error ? err : new Error(String(err));
        }
    }

    // Schema exists — validate against JSON Schema
    const errors = validateJsonSchema(value, targetSchema.schema);
    if (errors.length > 0) {
        return new SchemaError(
            "TYPE_MISMATCH",
            `Schema validation failed for key "${key}": ${errors.map((e) => e.message).join("; ")}`,
        );
    }

    // Check write-time migration
    const writeMigration = registry.getWriteMigration?.(key, targetSchema.version);
    if (writeMigration) {
        try {
            const migrated = writeMigration.migrate(value);
            const migratedErrors = validateJsonSchema(migrated, targetSchema.schema);
            if (migratedErrors.length > 0) {
                return new SchemaError(
                    "TYPE_MISMATCH",
                    `Write-time migration produced invalid value: ${migratedErrors.map((e) => e.message).join("; ")}`,
                );
            }
        } catch (err) {
            return err instanceof Error ? err : new Error(String(err));
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Write result display
// ---------------------------------------------------------------------------

type WriteResultState = { type: "success"; message: string } | { type: "error"; error: Error };

function WriteResult({ result }: { result: WriteResultState | null }): ReactNode {
    if (!result) return null;
    if (result.type === "success") {
        return <div className="sp-success">{result.message}</div>;
    }
    return (
        <div className="sp-error">
            <strong>{result.error.name}</strong>
            {"code" in result.error ? ` [${(result.error as SchemaError).code}]` : ""}:{" "}
            {result.error.message}
        </div>
    );
}

// ---------------------------------------------------------------------------
// PlaygroundWorkbench — rendered inside MnemonicProvider
// ---------------------------------------------------------------------------

const NAMESPACE = "playground";

function PlaygroundWorkbench({
    activeKey,
    writeValue,
    onWriteValueChange,
    onResult,
    registry,
    schemaMode,
    schemaVersion,
    readTrigger,
}: {
    activeKey: string;
    writeValue: string;
    onWriteValueChange: (v: string) => void;
    onResult: (decoded: unknown, error: Error | null) => void;
    registry: MutableRegistry;
    schemaMode: SchemaMode;
    schemaVersion: number | undefined;
    readTrigger: number;
}) {
    const errorRef = useRef<Error | null>(null);

    const [writeResult, setWriteResult] = useState<WriteResultState | null>(null);

    const defaultFactory = useCallback(
        (error?: CodecError | SchemaError) => {
            errorRef.current = error ?? null;
            return undefined as unknown;
        },
        [],
    );

    const { value, set, remove } = useMnemonicKey<unknown>(activeKey, {
        defaultValue: defaultFactory,
        ...(schemaVersion !== undefined ? { schema: { version: schemaVersion } } : {}),
    });

    // Error is only meaningful when value is undefined (fallback was used).
    // Derived from value rather than reset on every render, so it survives
    // re-renders where the hook's internal useMemo does not recompute.
    const readError = value === undefined ? errorRef.current : null;

    // Report result to parent after render.
    const reportedRef = useRef<{ value: unknown; error: Error | null } | null>(null);

    // When readTrigger changes, clear the dedup ref so the effect re-fires.
    const prevTriggerRef = useRef(readTrigger);
    if (prevTriggerRef.current !== readTrigger) {
        prevTriggerRef.current = readTrigger;
        reportedRef.current = null;
    }

    useEffect(() => {
        const current = { value, error: readError };
        if (
            reportedRef.current &&
            reportedRef.current.value === current.value &&
            reportedRef.current.error === current.error
        ) {
            return;
        }
        reportedRef.current = current;
        onResult(value, readError);
    });

    const handleWrite = () => {
        try {
            const parsed: unknown = JSON.parse(writeValue);
            // The hook's set() catches SchemaError/CodecError internally and
            // logs them instead of throwing.  Run the same encode/validate
            // checks ourselves first so we can surface the real error object.
            const error = preflightEncode(
                parsed,
                activeKey,
                registry,
                schemaMode,
                schemaVersion,
            );
            if (error) {
                setWriteResult({ type: "error", error });
                return;
            }
            set(parsed);
            setWriteResult({ type: "success", message: "Value written successfully" });
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setWriteResult({ type: "error", error });
            onResult(value, error);
        }
    };

    const handleRemove = () => {
        try {
            remove();
            setWriteResult({ type: "success", message: "Key removed" });
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setWriteResult({ type: "error", error });
        }
    };

    return (
        <>
            <h4 className="sp-section-title" style={{ marginTop: 12 }}>
                Write Value
            </h4>
            <p className="sp-help">
                Write through the hook&rsquo;s <code>set()</code> function. The value is validated
                against the selected schema (or default behavior when unset).
            </p>
            <div className="form-row">
                <label>Value (JSON)</label>
                <input
                    type="text"
                    value={writeValue}
                    onChange={(e) => onWriteValueChange(e.target.value)}
                />
            </div>
            <div className="sp-button-row">
                <button className="btn btn-primary btn-sm" onClick={handleWrite}>
                    Write via Hook
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleRemove}>
                    Remove Key
                </button>
            </div>
            <WriteResult result={writeResult} />
        </>
    );
}

// ---------------------------------------------------------------------------
// SchemaPlayground — main exported component
// ---------------------------------------------------------------------------

export function SchemaPlayground() {
    // Stable registry ref.
    const [registry] = useState(() => createMutableRegistry());

    // Schema mode.
    const [schemaMode, setSchemaMode] = useState<SchemaMode>("default");

    // Display copies.
    const [schemas, setSchemas] = useState<SchemaDisplay[]>([]);
    const [migrations, setMigrations] = useState<MigrationDisplay[]>([]);

    // Provider remount key.
    const [mountKey, setMountKey] = useState(0);

    // Hook target.
    const [activeKey, setActiveKey] = useState("player");
    const [schemaSelection, setSchemaSelection] = useState<string>("default");

    // Result from workbench.
    const [decoded, setDecoded] = useState<unknown>(undefined);
    const [readError, setReadError] = useState<Error | null>(null);

    // Read trigger — incremented to force workbench to re-report its value.
    const [readTrigger, setReadTrigger] = useState(0);

    // Storage version counter to force inspector re-render.
    const [storageVersion, setStorageVersion] = useState(0);
    const refreshStorage = useCallback(() => setStorageVersion((v) => v + 1), []);

    // Write value text.
    const [writeValue, setWriteValue] = useState('{"name":"Alice"}');

    // Event log.
    const [log, setLog] = useState<LogEntry[]>([]);
    const addLog = useCallback(
        (text: string, type: LogType = "info") =>
            setLog((prev) => [...prev, makeEntry(text, type)]),
        [],
    );

    // ---- Schema form state ----
    const [sKey, setSKey] = useState("player");
    const [sVersion, setSVersion] = useState(1);
    const [sSchemaText, setSSchemaText] = useState('{"type":"object"}');
    const [sSchemaTemplate, setSSchemaTemplate] = useState<string>(SCHEMA_TEMPLATES[0].id);
    const [sSchemaParseError, setSSchemaParseError] = useState<string | null>(null);
    const [sSchemaError, setSSchemaError] = useState<string | null>(null);

    // ---- Migration form state ----
    const [mKey, setMKey] = useState("player");
    const [mFrom, setMFrom] = useState(1);
    const [mTo, setMTo] = useState(2);
    const [mBody, setMBody] = useState('return { ...value, score: 0 }');

    // ---- Seed form state ----
    const [seedKey, setSeedKey] = useState("player");
    const [seedVersion, setSeedVersion] = useState(1);
    const [seedPayload, setSeedPayload] = useState('{"name":"Alice"}');
    const [seedEncodeJson, setSeedEncodeJson] = useState(false);

    // ---- Handlers ----

    const handleAddSchema = () => {
        const id = `${sKey}:${sVersion}`;
        try {
            const parsedSchema = JSON.parse(sSchemaText) as JsonSchema;
            const schema: KeySchema = {
                key: sKey,
                version: sVersion,
                schema: parsedSchema,
            };
            registry.registerSchema?.(schema);
            setSchemas((prev) => [
                ...prev,
                { key: sKey, version: sVersion, schema: parsedSchema },
            ]);
            addLog(`Registered schema ${sKey} v${sVersion}`, "success");
            setSSchemaError(null);
        } catch (err) {
            const message = `Failed to register schema ${id}: ${err instanceof Error ? err.message : String(err)}`;
            addLog(message, "error");
            setSSchemaError(message);
        }
    };

    const handleApplySchemaTemplate = () => {
        const template = SCHEMA_TEMPLATES.find((entry) => entry.id === sSchemaTemplate);
        if (!template) return;
        setSSchemaText(JSON.stringify(template.schema, null, 2));
    };

    useEffect(() => {
        const handle = window.setTimeout(() => {
            const trimmed = sSchemaText.trim();
            if (!trimmed) {
                setSSchemaParseError(null);
                return;
            }
            try {
                JSON.parse(trimmed);
                setSSchemaParseError(null);
            } catch (err) {
                setSSchemaParseError(err instanceof Error ? err.message : String(err));
            }
        }, 300);
        return () => window.clearTimeout(handle);
    }, [sSchemaText]);

    const handleRemoveSchema = (key: string, version: number) => {
        const id = `${key}:${version}`;
        registry._schemas.delete(id);
        setSchemas((prev) => prev.filter((s) => !(s.key === key && s.version === version)));
        addLog(`Removed schema ${id}`, "info");
    };

    const handleAddMigration = () => {
        if (mFrom > mTo) {
            addLog("fromVersion must be <= toVersion", "error");
            return;
        }
        try {
            const migrateFn = new Function("value", mBody.trim()) as (v: unknown) => unknown;
            const rule: MigrationRule = {
                key: mKey,
                fromVersion: mFrom,
                toVersion: mTo,
                migrate: migrateFn,
            };
            registry._migrations.push(rule);
            const label = mFrom === mTo ? `write-time normalizer v${mFrom}` : `v${mFrom} → v${mTo}`;
            setMigrations((prev) => [...prev, { key: mKey, from: mFrom, to: mTo }]);
            addLog(`Added migration ${mKey} ${label}`, "success");
        } catch (err) {
            addLog(`Failed to create migration: ${err instanceof Error ? err.message : String(err)}`, "error");
        }
    };

    const handleRemoveMigration = (index: number) => {
        const removed = migrations[index];
        if (!removed) return;
        // Find and remove from the actual registry array.
        const regIdx = registry._migrations.findIndex(
            (r) => r.key === removed.key && r.fromVersion === removed.from && r.toVersion === removed.to,
        );
        if (regIdx !== -1) registry._migrations.splice(regIdx, 1);
        setMigrations((prev) => prev.filter((_, i) => i !== index));
        addLog(`Removed migration ${removed.key} v${removed.from} → v${removed.to}`, "info");
    };

    const handleSeed = () => {
        const prefixedKey = `${NAMESPACE}.${seedKey}`;
        let payload: unknown;
        try {
            payload = JSON.parse(seedPayload);
        } catch {
            // If payload isn't valid JSON, store as-is (codec-managed string payload)
            payload = seedPayload;
        }
        // When "Encode as JSON" is checked, the envelope payload becomes a JSON
        // string (codec-managed format).  Otherwise it's a raw JSON value
        // (schema-managed format).
        const envelopePayload = seedEncodeJson ? JSON.stringify(payload) : payload;
        const envelope = JSON.stringify({ version: seedVersion, payload: envelopePayload });
        localStorage.setItem(prefixedKey, envelope);
        refreshStorage();
        setMountKey((k) => k + 1);
        addLog(`Seeded ${seedKey} at v${seedVersion}: ${seedPayload}${seedEncodeJson ? " (JSON-encoded)" : ""}`, "success");
    };

    const handleRead = () => {
        setReadTrigger((t) => t + 1);
        refreshStorage();
        addLog("Read current value from hook", "info");
    };

    const handleRemount = () => {
        setMountKey((k) => k + 1);
        addLog("Remounted provider (cache cleared)", "info");
    };

    const handleResetAll = () => {
        // Remove all playground-namespaced keys from localStorage.
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(`${NAMESPACE}.`)) toRemove.push(k);
        }
        toRemove.forEach((k) => localStorage.removeItem(k));
        registry._schemas.clear();
        registry._migrations.length = 0;
        setSchemas([]);
        setMigrations([]);
        setDecoded(undefined);
        setReadError(null);
        refreshStorage();
        setMountKey((k) => k + 1);
        addLog("Reset all — storage, registry, and provider cleared", "info");
    };

    const handleResult = useCallback(
        (value: unknown, error: Error | null) => {
            setDecoded(value);
            setReadError(error);
            refreshStorage();

            // Sync the display list with schemas that the hook may have
            // auto-registered into the MutableRegistry (autoschema mode).
            setSchemas((prev) => {
                const prevIds = new Set(prev.map((s) => `${s.key}:${s.version}`));
                const added: SchemaDisplay[] = [];
                for (const [id, ks] of registry._schemas) {
                    if (!prevIds.has(id)) {
                        added.push({ key: ks.key, version: ks.version, schema: ks.schema });
                    }
                }
                return added.length > 0 ? [...prev, ...added] : prev;
            });
        },
        [refreshStorage, registry],
    );

    const schemaOptions = useMemo(() => {
        const available = schemas
            .filter((schema) => schema.key === activeKey)
            .sort((a, b) => a.version - b.version)
            .map((schema) => ({
                value: String(schema.version),
                label: `v${schema.version}`,
            }));
        return [{ value: "default", label: "default (no schema)" }, ...available];
    }, [schemas, activeKey]);

    useEffect(() => {
        if (schemaSelection === "default") return;
        const exists = schemas.some(
            (schema) => schema.key === activeKey && String(schema.version) === schemaSelection,
        );
        if (!exists) setSchemaSelection("default");
    }, [activeKey, schemas, schemaSelection]);

    // ---- Storage inspector entries ----
    const inspectorEntries: { key: string; version: string; payload: string; raw: string }[] = [];
    const prefix = `${NAMESPACE}.`;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void storageVersion; // read to subscribe to changes
    for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (!fullKey || !fullKey.startsWith(prefix)) continue;
        const raw = localStorage.getItem(fullKey);
        if (raw == null) continue;
        const key = fullKey.slice(prefix.length);
        try {
            const parsed = JSON.parse(raw);
            inspectorEntries.push({
                key,
                version: String(parsed.version ?? "?"),
                payload: typeof parsed.payload === "string" ? parsed.payload : JSON.stringify(parsed.payload),
                raw,
            });
        } catch {
            inspectorEntries.push({ key, version: "?", payload: raw, raw });
        }
    }

    // ---- Storage key suggestions (namespace-stripped) ----
    const storageKeys = useMemo(() => {
        void storageVersion;
        const keys = new Set<string>();
        for (let i = 0; i < localStorage.length; i++) {
            const fullKey = localStorage.key(i);
            if (!fullKey || !fullKey.startsWith(prefix)) continue;
            keys.add(fullKey.slice(prefix.length));
        }
        return Array.from(keys);
    }, [prefix, storageVersion]);

    // ---- Render ----
    return (
        <div className="schema-playground">
            <datalist id="sp-storage-keys">
                {storageKeys.map((k) => (
                    <option key={k} value={k} />
                ))}
            </datalist>

            {/* Section 1: Registry Configuration */}
            <div className="sp-section">
                <h3 className="sp-section-title">Registry Configuration</h3>

                {/* Schema mode */}
                <div className="form-row">
                    <label>Schema Mode</label>
                    <div className="sp-mode-group">
                        {(["default", "strict", "autoschema"] as SchemaMode[]).map((m) => (
                            <label key={m} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input
                                    type="radio"
                                    name="sp-mode"
                                    value={m}
                                    checked={schemaMode === m}
                                    onChange={() => {
                                        setSchemaMode(m);
                                        addLog(`Schema mode → ${m}`, "info");
                                    }}
                                />
                                {m}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Schema form */}
                <h4 className="sp-section-title" style={{ marginTop: 12 }}>
                    Schemas
                </h4>
                <div className="sp-row">
                    <div className="form-row" style={{ flex: 1 }}>
                        <label>Key</label>
                        <input type="text" list="sp-storage-keys" value={sKey} onChange={(e) => setSKey(e.target.value)} />
                    </div>
                    <div className="form-row" style={{ width: 80 }}>
                        <label>Version</label>
                        <input
                            type="number"
                            min={0}
                            value={sVersion}
                            onChange={(e) => setSVersion(Number(e.target.value))}
                        />
                    </div>
                </div>
                <div className="form-row" style={{ marginTop: 4 }}>
                    <label>Schema templates</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select
                            value={sSchemaTemplate}
                            onChange={(e) => setSSchemaTemplate(e.target.value)}
                        >
                            {SCHEMA_TEMPLATES.map((template) => (
                                <option key={template.id} value={template.id}>
                                    {template.label}
                                </option>
                            ))}
                        </select>
                        <button className="btn btn-ghost btn-sm" onClick={handleApplySchemaTemplate}>
                            Apply
                        </button>
                    </div>
                </div>
                <div className="form-row" style={{ marginTop: 4 }}>
                    <label>JSON Schema</label>
                    <textarea
                        rows={3}
                        placeholder='{"type":"object","properties":{"name":{"type":"string"}}}'
                        value={sSchemaText}
                        onChange={(e) => setSSchemaText(e.target.value)}
                    />
                </div>
                {sSchemaText.trim() && !sSchemaParseError && (
                    <div className="sp-success" style={{ marginTop: 4 }}>
                        JSON syntax OK
                    </div>
                )}
                {sSchemaParseError && (
                    <div className="sp-error" style={{ marginTop: 4 }}>
                        <strong>JSON syntax error</strong>: {sSchemaParseError}
                    </div>
                )}
                <div className="sp-button-row">
                    <button className="btn btn-primary btn-sm" onClick={handleAddSchema}>
                        Register Schema
                    </button>
                </div>
                {sSchemaError && (
                    <div className="sp-error" style={{ marginTop: 4 }}>
                        <strong>Schema registration failed</strong>: {sSchemaError}
                    </div>
                )}
                {schemas.length === 0 && (
                    <div className="sp-help" style={{ marginTop: 4 }}>
                        No schemas registered yet.
                    </div>
                )}

                {schemas.length > 0 && (
                    <div className="sp-registry-list">
                        {schemas.map((s) => (
                            <div className="sp-registry-item" key={`${s.key}:${s.version}`}>
                                <span>
                                    {s.key} v{s.version} — {JSON.stringify(s.schema)}
                                </span>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => handleRemoveSchema(s.key, s.version)}
                                >
                                    x
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Migration form */}
                <h4 className="sp-section-title" style={{ marginTop: 12 }}>
                    Migration Rules
                </h4>
                <p className="sp-help">
                    Set <em>From</em> = <em>To</em> for a write-time normalizer (runs on every write).
                </p>
                <div className="sp-row">
                    <div className="form-row" style={{ flex: 1 }}>
                        <label>Key</label>
                        <input type="text" list="sp-storage-keys" value={mKey} onChange={(e) => setMKey(e.target.value)} />
                    </div>
                    <div className="form-row" style={{ width: 80 }}>
                        <label>From</label>
                        <input
                            type="number"
                            min={0}
                            value={mFrom}
                            onChange={(e) => setMFrom(Number(e.target.value))}
                        />
                    </div>
                    <div className="form-row" style={{ width: 80 }}>
                        <label>To</label>
                        <input
                            type="number"
                            min={0}
                            value={mTo}
                            onChange={(e) => setMTo(Number(e.target.value))}
                        />
                    </div>
                </div>
                <div className="form-row" style={{ marginTop: 4 }}>
                    <label>Transform body (receives <code>value</code>, must return new value)</label>
                    <textarea
                        rows={1}
                        placeholder="return { ...value, score: 0 }"
                        value={mBody}
                        onChange={(e) => setMBody(e.target.value)}
                    />
                </div>
                <div className="sp-button-row">
                    <button className="btn btn-primary btn-sm" onClick={handleAddMigration}>
                        Add Migration
                    </button>
                </div>

                {migrations.length > 0 && (
                    <div className="sp-registry-list">
                        {migrations.map((m, i) => (
                            <div className="sp-registry-item" key={i}>
                                <span>
                                    {m.key} {m.from === m.to ? `v${m.from} (normalizer)` : `v${m.from} → v${m.to}`}
                                </span>
                                <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveMigration(i)}>
                                    x
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Section 2: Seed Storage */}
            <div className="sp-section">
                <h3 className="sp-section-title">Seed Storage</h3>
                <p className="sp-help">
                    Write a raw versioned envelope directly to storage to simulate legacy data.
                    Payload is stored as a JSON value for schema-managed keys.
                </p>
                <div className="sp-row">
                    <div className="form-row" style={{ flex: 1 }}>
                        <label>Key</label>
                        <input type="text" list="sp-storage-keys" value={seedKey} onChange={(e) => setSeedKey(e.target.value)} />
                    </div>
                    <div className="form-row" style={{ width: 80 }}>
                        <label>Version</label>
                        <input
                            type="number"
                            min={0}
                            value={seedVersion}
                            onChange={(e) => setSeedVersion(Number(e.target.value))}
                        />
                    </div>
                </div>
                <div className="form-row" style={{ marginTop: 4 }}>
                    <label>Payload (JSON value)</label>
                    <input type="text" value={seedPayload} onChange={(e) => setSeedPayload(e.target.value)} />
                </div>
                <div className="sp-button-row">
                    <button className="btn btn-primary btn-sm" onClick={handleSeed}>
                        Seed
                    </button>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                            type="checkbox"
                            checked={seedEncodeJson}
                            onChange={(e) => setSeedEncodeJson(e.target.checked)}
                        />
                        Encode as JSON string (codec-managed)
                    </label>
                </div>
            </div>

            {/* Section 3: Hook Interaction */}
            <div className="sp-section">
                <h3 className="sp-section-title">Hook Interaction</h3>
                <div className="sp-row">
                    <div className="form-row" style={{ flex: 1 }}>
                        <label>Active Key</label>
                        <input type="text" list="sp-storage-keys" value={activeKey} onChange={(e) => setActiveKey(e.target.value)} />
                    </div>
                    <div className="form-row" style={{ width: 160 }}>
                        <label>Schema Version</label>
                        <select value={schemaSelection} onChange={(e) => setSchemaSelection(e.target.value)}>
                            {schemaOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <p className="sp-help">
                    The schema version applies to both reads and writes. When set, the hook
                    uses that version for validation and envelope formatting.
                </p>

                {/* Read Value */}
                <h4 className="sp-section-title" style={{ marginTop: 12 }}>
                    Read Value
                </h4>
                <p className="sp-help">
                    The current return value of <code>useMnemonicKey(&ldquo;{activeKey}&rdquo;)</code>.
                    After seeding or changing schemas, remount the provider to re-read from storage.
                </p>
                <div>
                    <label className="sp-result-label">Decoded value</label>
                    <pre className="sp-result">
                        {decoded === undefined
                            ? readError
                                ? "(undefined — fallback after decode error)"
                                : "(undefined — key not in storage)"
                            : JSON.stringify(decoded, null, 2)}
                    </pre>
                </div>
                {readError && (
                    <div className="sp-error">
                        <strong>{readError.name}</strong>
                        {"code" in readError ? ` [${(readError as SchemaError).code}]` : ""}:{" "}
                        {readError.message}
                    </div>
                )}
                <div className="sp-button-row">
                    <button className="btn btn-primary btn-sm" onClick={handleRead}>
                        Read
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handleRemount}>
                        Re-read (Remount Provider)
                    </button>
                </div>

                <MnemonicProvider
                    key={mountKey}
                    namespace={NAMESPACE}
                    schemaMode={schemaMode}
                    schemaRegistry={registry}
                >
                    <PlaygroundWorkbench
                        activeKey={activeKey}
                        writeValue={writeValue}
                        onWriteValueChange={setWriteValue}
                        onResult={handleResult}
                        registry={registry}
                        schemaMode={schemaMode}
                        schemaVersion={schemaSelection === "default" ? undefined : Number(schemaSelection)}
                        readTrigger={readTrigger}
                    />
                </MnemonicProvider>

                <div className="sp-button-row">
                    <button className="btn btn-danger btn-sm" onClick={handleResetAll}>
                        Reset All
                    </button>
                </div>
            </div>

            {/* Section 4: Storage Inspector */}
            <div className="sp-section">
                <h3 className="sp-section-title">Storage Inspector</h3>
                {inspectorEntries.length === 0 ? (
                    <p className="sp-help">Storage is empty.</p>
                ) : (
                    <div className="sp-inspector">
                        <table>
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Version</th>
                                    <th>Payload</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inspectorEntries.map((entry) => (
                                    <tr key={entry.key}>
                                        <td>{entry.key}</td>
                                        <td>{entry.version}</td>
                                        <td>
                                            <code>{entry.payload}</code>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Section 5: Event Log */}
            <div className="sp-section">
                <h3 className="sp-section-title">
                    Event Log{" "}
                    <button
                        className="btn btn-ghost btn-sm"
                        style={{ marginLeft: 8 }}
                        onClick={() => setLog([])}
                    >
                        Clear
                    </button>
                </h3>
                <div className="sp-log">
                    {log.length === 0 && <p className="sp-help">No events yet.</p>}
                    {log.map((entry) => (
                        <div key={entry.id} className={`sp-log-entry sp-log-${entry.type}`}>
                            <span className="sp-log-time">{entry.time}</span>
                            <span>{entry.text}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
