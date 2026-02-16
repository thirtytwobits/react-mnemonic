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
// JSON Schema templates
// ---------------------------------------------------------------------------

const SCHEMA_TEMPLATES = [
    { id: "object", label: "object", schema: { type: "object" } as JsonSchema },
    { id: "string", label: "string", schema: { type: "string" } as JsonSchema },
    { id: "number", label: "number", schema: { type: "number" } as JsonSchema },
    { id: "boolean", label: "boolean", schema: { type: "boolean" } as JsonSchema },
    { id: "array", label: "array", schema: { type: "array" } as JsonSchema },
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
            const candidates = Array.from(schemas.values()).filter((s) => s.key === key);
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

type SchemaDisplay = { key: string; version: number; schema: JsonSchema };
type MigrationDisplay = { key: string; from: number; to: number };

// ---------------------------------------------------------------------------
// Write pre-flight check
// ---------------------------------------------------------------------------

function preflightEncode(
    value: unknown,
    key: string,
    registry: MutableRegistry,
    schemaMode: SchemaMode,
    schemaVersion?: number,
): Error | null {
    const explicitSchema =
        schemaVersion !== undefined ? registry.getSchema(key, schemaVersion) : undefined;
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
        try {
            JSONCodec.encode(value);
            return null;
        } catch (err) {
            return err instanceof Error ? err : new Error(String(err));
        }
    }

    const errors = validateJsonSchema(value, targetSchema.schema);
    if (errors.length > 0) {
        return new SchemaError(
            "TYPE_MISMATCH",
            `Schema validation failed for key "${key}": ${errors.map((e) => e.message).join("; ")}`,
        );
    }

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

type WriteResultState =
    | { type: "success"; message: string }
    | { type: "error"; error: Error };

function WriteResult({ result }: { result: WriteResultState | null }): ReactNode {
    if (!result) return null;
    if (result.type === "success") {
        return <div className="demo-alert demo-alert--success">{result.message}</div>;
    }
    return (
        <div className="demo-alert demo-alert--error">
            <strong>{result.error.name}</strong>
            {"code" in result.error
                ? ` [${(result.error as SchemaError).code}]`
                : ""}
            : {result.error.message}
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

    const readError = value === undefined ? errorRef.current : null;

    const reportedRef = useRef<{ value: unknown; error: Error | null } | null>(null);
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
            const error = preflightEncode(parsed, activeKey, registry, schemaMode, schemaVersion);
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
            <h4 style={{ marginTop: 12 }}>Write Value</h4>
            <p className="demo-muted" style={{ fontSize: "0.85rem", marginBottom: 8 }}>
                Write through the hook&rsquo;s <code>set()</code> function. The value is
                validated against the selected schema.
            </p>
            <div className="demo-form-row">
                <label>Value (JSON)</label>
                <input
                    type="text"
                    value={writeValue}
                    onChange={(e) => onWriteValueChange(e.target.value)}
                />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="button button--sm button--primary" onClick={handleWrite}>
                    Write via Hook
                </button>
                <button
                    className="button button--sm button--outline button--secondary"
                    onClick={handleRemove}
                >
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
    const [registry] = useState(() => createMutableRegistry());
    const [schemaMode, setSchemaMode] = useState<SchemaMode>("default");
    const [schemas, setSchemas] = useState<SchemaDisplay[]>([]);
    const [migrations, setMigrations] = useState<MigrationDisplay[]>([]);
    const [mountKey, setMountKey] = useState(0);
    const [activeKey, setActiveKey] = useState("player");
    const [schemaSelection, setSchemaSelection] = useState<string>("default");
    const [decoded, setDecoded] = useState<unknown>(undefined);
    const [readError, setReadError] = useState<Error | null>(null);
    const [readTrigger, setReadTrigger] = useState(0);
    const [storageVersion, setStorageVersion] = useState(0);
    const refreshStorage = useCallback(() => setStorageVersion((v) => v + 1), []);
    const [writeValue, setWriteValue] = useState('{"name":"Alice"}');
    const [log, setLog] = useState<LogEntry[]>([]);
    const addLog = useCallback(
        (text: string, type: LogType = "info") =>
            setLog((prev) => [...prev, makeEntry(text, type)]),
        [],
    );

    // Schema form
    const [sKey, setSKey] = useState("player");
    const [sVersion, setSVersion] = useState(1);
    const [sSchemaText, setSSchemaText] = useState('{"type":"object"}');
    const [sSchemaTemplate, setSSchemaTemplate] = useState<string>(SCHEMA_TEMPLATES[0].id);
    const [sSchemaParseError, setSSchemaParseError] = useState<string | null>(null);
    const [sSchemaError, setSSchemaError] = useState<string | null>(null);

    // Migration form
    const [mKey, setMKey] = useState("player");
    const [mFrom, setMFrom] = useState(1);
    const [mTo, setMTo] = useState(2);
    const [mBody, setMBody] = useState("return { ...value, score: 0 }");

    // Seed form
    const [seedKey, setSeedKey] = useState("player");
    const [seedVersion, setSeedVersion] = useState(1);
    const [seedPayload, setSeedPayload] = useState('{"name":"Alice"}');
    const [seedEncodeJson, setSeedEncodeJson] = useState(false);

    // Handlers
    const handleAddSchema = () => {
        const id = `${sKey}:${sVersion}`;
        try {
            const parsedSchema = JSON.parse(sSchemaText) as JsonSchema;
            const schema: KeySchema = { key: sKey, version: sVersion, schema: parsedSchema };
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
        setSchemas((prev) =>
            prev.filter((s) => !(s.key === key && s.version === version)),
        );
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
            const label =
                mFrom === mTo
                    ? `write-time normalizer v${mFrom}`
                    : `v${mFrom} → v${mTo}`;
            setMigrations((prev) => [...prev, { key: mKey, from: mFrom, to: mTo }]);
            addLog(`Added migration ${mKey} ${label}`, "success");
        } catch (err) {
            addLog(
                `Failed to create migration: ${err instanceof Error ? err.message : String(err)}`,
                "error",
            );
        }
    };

    const handleRemoveMigration = (index: number) => {
        const removed = migrations[index];
        if (!removed) return;
        const regIdx = registry._migrations.findIndex(
            (r) =>
                r.key === removed.key &&
                r.fromVersion === removed.from &&
                r.toVersion === removed.to,
        );
        if (regIdx !== -1) registry._migrations.splice(regIdx, 1);
        setMigrations((prev) => prev.filter((_, i) => i !== index));
        addLog(
            `Removed migration ${removed.key} v${removed.from} → v${removed.to}`,
            "info",
        );
    };

    const handleSeed = () => {
        const prefixedKey = `${NAMESPACE}.${seedKey}`;
        let payload: unknown;
        try {
            payload = JSON.parse(seedPayload);
        } catch {
            payload = seedPayload;
        }
        const envelopePayload = seedEncodeJson ? JSON.stringify(payload) : payload;
        const envelope = JSON.stringify({ version: seedVersion, payload: envelopePayload });
        localStorage.setItem(prefixedKey, envelope);
        refreshStorage();
        setMountKey((k) => k + 1);
        addLog(
            `Seeded ${seedKey} at v${seedVersion}: ${seedPayload}${seedEncodeJson ? " (JSON-encoded)" : ""}`,
            "success",
        );
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
            .map((schema) => ({ value: String(schema.version), label: `v${schema.version}` }));
        return [{ value: "default", label: "default (no schema)" }, ...available];
    }, [schemas, activeKey]);

    useEffect(() => {
        if (schemaSelection === "default") return;
        const exists = schemas.some(
            (schema) =>
                schema.key === activeKey && String(schema.version) === schemaSelection,
        );
        if (!exists) setSchemaSelection("default");
    }, [activeKey, schemas, schemaSelection]);

    // Storage inspector
    const inspectorEntries: {
        key: string;
        version: string;
        payload: string;
        raw: string;
    }[] = [];
    const prefix = `${NAMESPACE}.`;
    void storageVersion;
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
                payload:
                    typeof parsed.payload === "string"
                        ? parsed.payload
                        : JSON.stringify(parsed.payload),
                raw,
            });
        } catch {
            inspectorEntries.push({ key, version: "?", payload: raw, raw });
        }
    }

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

    return (
        <div className="demo-sp">
            <datalist id="sp-storage-keys">
                {storageKeys.map((k) => (
                    <option key={k} value={k} />
                ))}
            </datalist>

            {/* Section 1: Registry Configuration */}
            <div className="demo-sp-section">
                <h3>Registry Configuration</h3>

                <div className="demo-form-row">
                    <label>Schema Mode</label>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        {(["default", "strict", "autoschema"] as SchemaMode[]).map((m) => (
                            <label
                                key={m}
                                style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: "normal", textTransform: "none", fontSize: "0.9rem" }}
                            >
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

                <h4 style={{ marginTop: 12 }}>Schemas</h4>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div className="demo-form-row" style={{ flex: 1 }}>
                        <label>Key</label>
                        <input type="text" list="sp-storage-keys" value={sKey} onChange={(e) => setSKey(e.target.value)} />
                    </div>
                    <div className="demo-form-row" style={{ width: 80 }}>
                        <label>Version</label>
                        <input type="number" min={0} value={sVersion} onChange={(e) => setSVersion(Number(e.target.value))} />
                    </div>
                </div>
                <div className="demo-form-row" style={{ marginTop: 4 }}>
                    <label>Schema templates</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select value={sSchemaTemplate} onChange={(e) => setSSchemaTemplate(e.target.value)}>
                            {SCHEMA_TEMPLATES.map((t) => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                        <button className="button button--sm button--outline button--secondary" onClick={handleApplySchemaTemplate}>
                            Apply
                        </button>
                    </div>
                </div>
                <div className="demo-form-row" style={{ marginTop: 4 }}>
                    <label>JSON Schema</label>
                    <textarea
                        rows={3}
                        placeholder='{"type":"object","properties":{"name":{"type":"string"}}}'
                        value={sSchemaText}
                        onChange={(e) => setSSchemaText(e.target.value)}
                    />
                </div>
                {sSchemaText.trim() && !sSchemaParseError && (
                    <div className="demo-alert demo-alert--success" style={{ marginTop: 4 }}>JSON syntax OK</div>
                )}
                {sSchemaParseError && (
                    <div className="demo-alert demo-alert--error" style={{ marginTop: 4 }}>
                        <strong>JSON syntax error</strong>: {sSchemaParseError}
                    </div>
                )}
                <div style={{ marginTop: 8 }}>
                    <button className="button button--sm button--primary" onClick={handleAddSchema}>
                        Register Schema
                    </button>
                </div>
                {sSchemaError && (
                    <div className="demo-alert demo-alert--error" style={{ marginTop: 4 }}>
                        <strong>Schema registration failed</strong>: {sSchemaError}
                    </div>
                )}
                {schemas.length === 0 && (
                    <p className="demo-muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>No schemas registered yet.</p>
                )}
                {schemas.length > 0 && (
                    <div className="demo-registry-list">
                        {schemas.map((s) => (
                            <div className="demo-registry-item" key={`${s.key}:${s.version}`}>
                                <span>{s.key} v{s.version} — {JSON.stringify(s.schema)}</span>
                                <button className="button button--sm button--outline button--secondary" onClick={() => handleRemoveSchema(s.key, s.version)}>x</button>
                            </div>
                        ))}
                    </div>
                )}

                <h4 style={{ marginTop: 12 }}>Migration Rules</h4>
                <p className="demo-muted" style={{ fontSize: "0.85rem", marginBottom: 8 }}>
                    Set <em>From</em> = <em>To</em> for a write-time normalizer.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div className="demo-form-row" style={{ flex: 1 }}>
                        <label>Key</label>
                        <input type="text" list="sp-storage-keys" value={mKey} onChange={(e) => setMKey(e.target.value)} />
                    </div>
                    <div className="demo-form-row" style={{ width: 80 }}>
                        <label>From</label>
                        <input type="number" min={0} value={mFrom} onChange={(e) => setMFrom(Number(e.target.value))} />
                    </div>
                    <div className="demo-form-row" style={{ width: 80 }}>
                        <label>To</label>
                        <input type="number" min={0} value={mTo} onChange={(e) => setMTo(Number(e.target.value))} />
                    </div>
                </div>
                <div className="demo-form-row" style={{ marginTop: 4 }}>
                    <label>Transform body (receives <code>value</code>, must return new value)</label>
                    <textarea
                        rows={1}
                        placeholder="return { ...value, score: 0 }"
                        value={mBody}
                        onChange={(e) => setMBody(e.target.value)}
                    />
                </div>
                <div style={{ marginTop: 8 }}>
                    <button className="button button--sm button--primary" onClick={handleAddMigration}>
                        Add Migration
                    </button>
                </div>
                {migrations.length > 0 && (
                    <div className="demo-registry-list">
                        {migrations.map((m, i) => (
                            <div className="demo-registry-item" key={i}>
                                <span>
                                    {m.key}{" "}
                                    {m.from === m.to
                                        ? `v${m.from} (normalizer)`
                                        : `v${m.from} → v${m.to}`}
                                </span>
                                <button className="button button--sm button--outline button--secondary" onClick={() => handleRemoveMigration(i)}>x</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Section 2: Seed Storage */}
            <div className="demo-sp-section">
                <h3>Seed Storage</h3>
                <p className="demo-muted" style={{ fontSize: "0.85rem", marginBottom: 8 }}>
                    Write a raw versioned envelope directly to storage to simulate legacy data.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div className="demo-form-row" style={{ flex: 1 }}>
                        <label>Key</label>
                        <input type="text" list="sp-storage-keys" value={seedKey} onChange={(e) => setSeedKey(e.target.value)} />
                    </div>
                    <div className="demo-form-row" style={{ width: 80 }}>
                        <label>Version</label>
                        <input type="number" min={0} value={seedVersion} onChange={(e) => setSeedVersion(Number(e.target.value))} />
                    </div>
                </div>
                <div className="demo-form-row" style={{ marginTop: 4 }}>
                    <label>Payload (JSON value)</label>
                    <input type="text" value={seedPayload} onChange={(e) => setSeedPayload(e.target.value)} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                    <button className="button button--sm button--primary" onClick={handleSeed}>
                        Seed
                    </button>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: "normal", textTransform: "none", fontSize: "0.85rem" }}>
                        <input type="checkbox" checked={seedEncodeJson} onChange={(e) => setSeedEncodeJson(e.target.checked)} />
                        Encode as JSON string (codec-managed)
                    </label>
                </div>
            </div>

            {/* Section 3: Hook Interaction */}
            <div className="demo-sp-section">
                <h3>Hook Interaction</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div className="demo-form-row" style={{ flex: 1 }}>
                        <label>Active Key</label>
                        <input type="text" list="sp-storage-keys" value={activeKey} onChange={(e) => setActiveKey(e.target.value)} />
                    </div>
                    <div className="demo-form-row" style={{ width: 160 }}>
                        <label>Schema Version</label>
                        <select value={schemaSelection} onChange={(e) => setSchemaSelection(e.target.value)}>
                            {schemaOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <p className="demo-muted" style={{ fontSize: "0.85rem", margin: "8px 0" }}>
                    The schema version applies to both reads and writes.
                </p>

                <h4 style={{ marginTop: 12 }}>Read Value</h4>
                <p className="demo-muted" style={{ fontSize: "0.85rem", marginBottom: 8 }}>
                    Current return value of <code>useMnemonicKey(&ldquo;{activeKey}&rdquo;)</code>.
                </p>
                <div>
                    <label className="demo-form-row" style={{ marginBottom: 4 }}>
                        <span>Decoded value</span>
                    </label>
                    <pre className="demo-result">
                        {decoded === undefined
                            ? readError
                                ? "(undefined — fallback after decode error)"
                                : "(undefined — key not in storage)"
                            : JSON.stringify(decoded, null, 2)}
                    </pre>
                </div>
                {readError && (
                    <div className="demo-alert demo-alert--error">
                        <strong>{readError.name}</strong>
                        {"code" in readError
                            ? ` [${(readError as SchemaError).code}]`
                            : ""}
                        : {readError.message}
                    </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="button button--sm button--primary" onClick={handleRead}>
                        Read
                    </button>
                    <button className="button button--sm button--primary" onClick={handleRemount}>
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
                        schemaVersion={
                            schemaSelection === "default"
                                ? undefined
                                : Number(schemaSelection)
                        }
                        readTrigger={readTrigger}
                    />
                </MnemonicProvider>

                <div style={{ marginTop: 8 }}>
                    <button className="button button--sm button--danger" onClick={handleResetAll}>
                        Reset All
                    </button>
                </div>
            </div>

            {/* Section 4: Storage Inspector */}
            <div className="demo-sp-section">
                <h3>Storage Inspector</h3>
                {inspectorEntries.length === 0 ? (
                    <p className="demo-muted" style={{ fontSize: "0.85rem" }}>Storage is empty.</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="demo-table">
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
                                        <td><code>{entry.payload}</code></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Section 5: Event Log */}
            <div className="demo-sp-section">
                <h3>
                    Event Log{" "}
                    <button
                        className="button button--sm button--outline button--secondary"
                        style={{ marginLeft: 8 }}
                        onClick={() => setLog([])}
                    >
                        Clear
                    </button>
                </h3>
                <div className="demo-log">
                    {log.length === 0 && (
                        <p className="demo-muted" style={{ fontSize: "0.85rem" }}>No events yet.</p>
                    )}
                    {log.map((entry) => (
                        <div
                            key={entry.id}
                            className={`demo-log-entry ${entry.type === "error" ? "demo-log--error" : entry.type === "success" ? "demo-log--success" : ""}`}
                        >
                            <span className="demo-muted" style={{ flexShrink: 0 }}>
                                {entry.time}
                            </span>
                            <span>{entry.text}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
