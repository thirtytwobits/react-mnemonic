// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from "react";
import {
    MnemonicProvider,
    useMnemonicKey,
    JSONCodec,
    StringCodec,
    NumberCodec,
    BooleanCodec,
    CodecError,
    ValidationError,
    SchemaError,
} from "react-mnemonic";
import type {
    StorageLike,
    Codec,
    SchemaRegistry,
    KeySchema,
    MigrationRule,
    SchemaMode,
} from "react-mnemonic";

// ---------------------------------------------------------------------------
// Codec lookup
// ---------------------------------------------------------------------------

const CODEC_OPTIONS = ["JSON", "String", "Number", "Boolean"] as const;
type CodecName = (typeof CODEC_OPTIONS)[number];

const CODEC_MAP: Record<CodecName, Codec<any>> = {
    JSON: JSONCodec,
    String: StringCodec,
    Number: NumberCodec,
    Boolean: BooleanCodec,
};

const VALIDATOR_PRESETS = [
    {
        id: "is-object",
        label: "is object",
        body: 'typeof value === "object" && value !== null',
    },
    {
        id: "is-string",
        label: "is string",
        body: 'typeof value === "string"',
    },
    {
        id: "is-number",
        label: "is finite number",
        body: 'typeof value === "number" && Number.isFinite(value)',
    },
    {
        id: "is-boolean",
        label: "is boolean",
        body: 'typeof value === "boolean"',
    },
    {
        id: "is-array",
        label: "is array",
        body: "Array.isArray(value)",
    },
    {
        id: "has-name-email",
        label: "has name + email",
        body:
            'typeof value === "object" && value !== null && typeof (value as any).name === "string" && typeof (value as any).email === "string"',
    },
] as const;

function normalizeValidatorExpression(input: string): string {
    let trimmed = input.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("return ")) {
        trimmed = trimmed.slice("return ".length).trim();
    }
    if (trimmed.endsWith(";")) {
        trimmed = trimmed.slice(0, -1).trim();
    }
    return trimmed;
}

// ---------------------------------------------------------------------------
// In-memory storage (same pattern as test helpers)
// ---------------------------------------------------------------------------

interface MemoryStorage extends StorageLike {
    _map: Map<string, string>;
    _writeCount: number;
}

function createMemoryStorage(): MemoryStorage {
    const map = new Map<string, string>();
    let writeCount = 0;
    return {
        _map: map,
        get _writeCount() {
            return writeCount;
        },
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => {
            writeCount++;
            map.set(key, value);
        },
        removeItem: (key) => map.delete(key),
        get length() {
            return map.size;
        },
        key: (index) => Array.from(map.keys())[index] ?? null,
    };
}

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
                const next = byKey.find((r) => r.fromVersion === cur);
                if (!next) return null;
                path.push(next);
                cur = next.toVersion;
            }
            return path;
        },
        registerSchema(schema) {
            const id = `${schema.key}:${schema.version}`;
            if (schema.version === 0) {
                throw new Error("Schema version 0 is reserved");
            }
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

type SchemaDisplay = { key: string; version: number; codec: CodecName; hasValidator: boolean };
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
    hookCodec: Codec<any>,
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
        // No schema specified/registered — encode with hook codec.
        try {
            hookCodec.encode(value);
            return null;
        } catch (err) {
            return err instanceof Error ? err : new Error(String(err));
        }
    }

    // Schema exists — validate then encode with schema codec
    if (targetSchema.validate) {
        try {
            if (!targetSchema.validate(value)) {
                return new SchemaError(
                    "TYPE_MISMATCH",
                    `Schema validation failed for key "${key}"`,
                );
            }
        } catch (err) {
            return new SchemaError(
                "TYPE_MISMATCH",
                `Schema validation threw for key "${key}"`,
                err,
            );
        }
    }

    try {
        targetSchema.codec.encode(value as any);
        return null;
    } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
    }
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
    hookCodec,
    writeValue,
    onWriteValueChange,
    onResult,
    storage,
    registry,
    schemaMode,
    schemaSelection,
    schemaOptions,
    onSchemaSelectionChange,
}: {
    activeKey: string;
    hookCodec: CodecName;
    writeValue: string;
    onWriteValueChange: (v: string) => void;
    onResult: (decoded: unknown, error: Error | null) => void;
    storage: MemoryStorage;
    registry: MutableRegistry;
    schemaMode: SchemaMode;
    schemaSelection: string;
    schemaOptions: { value: string; label: string }[];
    onSchemaSelectionChange: (v: string) => void;
}) {
    const schemaVersion = schemaSelection === "default" ? undefined : Number(schemaSelection);
    const errorRef = useRef<Error | null>(null);
    errorRef.current = null;

    const [writeResult, setWriteResult] = useState<WriteResultState | null>(null);

    const defaultFactory = useCallback(
        (error?: CodecError | ValidationError | SchemaError) => {
            if (error) errorRef.current = error;
            return undefined as unknown;
        },
        [],
    );

    const { value, set, remove } = useMnemonicKey<unknown>(activeKey, {
        defaultValue: defaultFactory,
        codec: CODEC_MAP[hookCodec],
        ...(schemaVersion !== undefined ? { schema: { version: schemaVersion } } : {}),
    });

    const readError = errorRef.current;

    // Report result to parent after render.
    const reportedRef = useRef<{ value: unknown; error: Error | null } | null>(null);
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
            let parsed: unknown;
            if (hookCodec === "JSON") {
                parsed = JSON.parse(writeValue);
            } else if (hookCodec === "Number") {
                parsed = Number(writeValue);
                if (Number.isNaN(parsed)) throw new Error("Not a valid number");
            } else if (hookCodec === "Boolean") {
                parsed = writeValue === "true";
            } else {
                parsed = writeValue;
            }
            // The hook's set() catches SchemaError/CodecError internally and
            // logs them instead of throwing.  Run the same encode/validate
            // checks ourselves first so we can surface the real error object.
            const error = preflightEncode(
                parsed,
                activeKey,
                CODEC_MAP[hookCodec],
                registry,
                schemaMode,
                schemaVersion,
            );
            if (error) {
                setWriteResult({ type: "error", error });
                return;
            }
            const before = storage._writeCount;
            set(parsed);
            if (storage._writeCount > before) {
                setWriteResult({ type: "success", message: "Value written successfully" });
            } else {
                setWriteResult({
                    type: "error",
                    error: new Error("Write rejected by hook"),
                });
            }
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
                Write through the hook&rsquo;s <code>set()</code> function. The value is encoded
                using the selected schema (or default schema behavior when unset).
            </p>
            <div className="form-row">
                <label>Schema</label>
                <select value={schemaSelection} onChange={(e) => onSchemaSelectionChange(e.target.value)}>
                    {schemaOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
            <div className="form-row">
                <label>Value</label>
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
    // Stable storage and registry refs.
    const [storage] = useState(() => createMemoryStorage());
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
    const [hookCodec, setHookCodec] = useState<CodecName>("JSON");
    const [writeSchemaSelection, setWriteSchemaSelection] = useState<string>("default");

    // Result from workbench.
    const [decoded, setDecoded] = useState<unknown>(undefined);
    const [readError, setReadError] = useState<Error | null>(null);

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
    const [sCodec, setSCodec] = useState<CodecName>("JSON");
    const [sValidator, setSValidator] = useState("");
    const [sValidatorPreset, setSValidatorPreset] = useState(VALIDATOR_PRESETS[0].id);
    const [sValidatorError, setSValidatorError] = useState<string | null>(null);
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

    // ---- Handlers ----

    const handleAddSchema = () => {
        const id = `${sKey}:${sVersion}`;
        if (sVersion === 0) {
            const message = `Schema ${id} rejected (version 0 is reserved)`;
            addLog(message, "error");
            setSSchemaError(message);
            return;
        }
        try {
            let validate: ((v: unknown) => v is any) | undefined;
            const validatorExpression = normalizeValidatorExpression(sValidator);
            if (validatorExpression) {
                validate = new Function(
                    "value",
                    `return (${validatorExpression});`,
                ) as (v: unknown) => v is any;
            }
            const schema: KeySchema = {
                key: sKey,
                version: sVersion,
                codec: CODEC_MAP[sCodec],
                ...(validate ? { validate } : {}),
            };
            registry.registerSchema?.(schema);
            setSchemas((prev) => [
                ...prev,
                { key: sKey, version: sVersion, codec: sCodec, hasValidator: !!validate },
            ]);
            addLog(`Registered schema ${sKey} v${sVersion} (${sCodec})`, "success");
            setSSchemaError(null);
        } catch (err) {
            const message = `Failed to register schema: ${err instanceof Error ? err.message : String(err)}`;
            addLog(message, "error");
            setSSchemaError(message);
        }
    };

    const handleAddValidatorPreset = () => {
        const preset = VALIDATOR_PRESETS.find((entry) => entry.id === sValidatorPreset);
        if (!preset) return;
        setSValidator((prev) => {
            const existing = normalizeValidatorExpression(prev);
            const nextRule = `(${preset.body})`;
            if (!existing) return nextRule;
            return `(${existing}) && ${nextRule}`;
        });
    };

    useEffect(() => {
        const handle = window.setTimeout(() => {
            const expression = normalizeValidatorExpression(sValidator);
            if (!expression) {
                setSValidatorError(null);
                return;
            }
            try {
                new Function("value", `return (${expression});`);
                setSValidatorError(null);
            } catch (err) {
                setSValidatorError(err instanceof Error ? err.message : String(err));
            }
        }, 300);
        return () => window.clearTimeout(handle);
    }, [sValidator]);

    const handleRemoveSchema = (key: string, version: number) => {
        const id = `${key}:${version}`;
        registry._schemas.delete(id);
        setSchemas((prev) => prev.filter((s) => !(s.key === key && s.version === version)));
        addLog(`Removed schema ${id}`, "info");
    };

    const handleAddMigration = () => {
        if (mFrom >= mTo) {
            addLog("fromVersion must be less than toVersion", "error");
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
            setMigrations((prev) => [...prev, { key: mKey, from: mFrom, to: mTo }]);
            addLog(`Added migration ${mKey} v${mFrom} → v${mTo}`, "success");
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
        const envelope = JSON.stringify({ version: seedVersion, payload: seedPayload });
        storage._map.set(prefixedKey, envelope);
        refreshStorage();
        setMountKey((k) => k + 1);
        addLog(`Seeded ${seedKey} at v${seedVersion}: ${seedPayload}`, "success");
    };

    const handleRemount = () => {
        setMountKey((k) => k + 1);
        addLog("Remounted provider (cache cleared)", "info");
    };

    const handleResetAll = () => {
        storage._map.clear();
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
        },
        [refreshStorage],
    );

    const schemaOptions = useMemo(() => {
        const available = schemas
            .filter((schema) => schema.key === activeKey)
            .sort((a, b) => a.version - b.version)
            .map((schema) => ({
                value: String(schema.version),
                label: `v${schema.version} (${schema.codec})`,
            }));
        return [{ value: "default", label: "default (no schema)" }, ...available];
    }, [schemas, activeKey]);

    useEffect(() => {
        if (writeSchemaSelection === "default") return;
        const exists = schemas.some(
            (schema) => schema.key === activeKey && String(schema.version) === writeSchemaSelection,
        );
        if (!exists) setWriteSchemaSelection("default");
    }, [activeKey, schemas, writeSchemaSelection]);

    // ---- Storage inspector entries ----
    const inspectorEntries: { key: string; version: string; payload: string; raw: string }[] = [];
    const prefix = `${NAMESPACE}.`;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void storageVersion; // read to subscribe to changes
    for (const [fullKey, raw] of storage._map) {
        if (!fullKey.startsWith(prefix)) continue;
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

    // ---- Render ----
    return (
        <div className="schema-playground">
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
                        <input type="text" value={sKey} onChange={(e) => setSKey(e.target.value)} />
                    </div>
                    <div className="form-row" style={{ width: 80 }}>
                        <label>Version</label>
                        <input
                            type="number"
                            min={1}
                            value={sVersion}
                            onChange={(e) => setSVersion(Number(e.target.value))}
                        />
                    </div>
                    <div className="form-row" style={{ width: 120 }}>
                        <label>Codec</label>
                        <select value={sCodec} onChange={(e) => setSCodec(e.target.value as CodecName)}>
                            {CODEC_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="form-row" style={{ marginTop: 4 }}>
                    <label>Validator presets</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select
                            value={sValidatorPreset}
                            onChange={(e) => setSValidatorPreset(e.target.value)}
                        >
                            {VALIDATOR_PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.label}
                                </option>
                            ))}
                        </select>
                        <button className="btn btn-ghost btn-sm" onClick={handleAddValidatorPreset}>
                            Add
                        </button>
                    </div>
                </div>
                <div className="form-row" style={{ marginTop: 4 }}>
                    <label>Validator body (optional)</label>
                    <textarea
                        rows={1}
                        placeholder='(typeof value === "object" && value !== null)'
                        value={sValidator}
                        onChange={(e) => setSValidator(e.target.value)}
                    />
                </div>
                {sValidator.trim() && !sValidatorError && (
                    <div className="sp-success" style={{ marginTop: 4 }}>
                        Validator syntax OK
                    </div>
                )}
                {sValidatorError && (
                    <div className="sp-error" style={{ marginTop: 4 }}>
                        <strong>Validator syntax error</strong>: {sValidatorError}
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
                                    {s.key} v{s.version} ({s.codec})
                                    {s.hasValidator ? " +validate" : ""}
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
                <div className="sp-row">
                    <div className="form-row" style={{ flex: 1 }}>
                        <label>Key</label>
                        <input type="text" value={mKey} onChange={(e) => setMKey(e.target.value)} />
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
                            min={1}
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
                                    {m.key} v{m.from} → v{m.to}
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
                </p>
                <div className="sp-row">
                    <div className="form-row" style={{ flex: 1 }}>
                        <label>Key</label>
                        <input type="text" value={seedKey} onChange={(e) => setSeedKey(e.target.value)} />
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
                    <label>Payload (codec-encoded string)</label>
                    <input type="text" value={seedPayload} onChange={(e) => setSeedPayload(e.target.value)} />
                </div>
                <div className="sp-button-row">
                    <button className="btn btn-primary btn-sm" onClick={handleSeed}>
                        Seed
                    </button>
                </div>
            </div>

            {/* Section 3: Hook Interaction */}
            <div className="sp-section">
                <h3 className="sp-section-title">Hook Interaction</h3>
                <div className="sp-row">
                    <div className="form-row" style={{ flex: 1 }}>
                        <label>Active Key</label>
                        <input type="text" value={activeKey} onChange={(e) => setActiveKey(e.target.value)} />
                    </div>
                    <div className="form-row" style={{ width: 120 }}>
                        <label>Hook Codec</label>
                        <select value={hookCodec} onChange={(e) => setHookCodec(e.target.value as CodecName)}>
                            {CODEC_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

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
                        {decoded === undefined ? "(undefined — no data or fallback)" : JSON.stringify(decoded, null, 2)}
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
                    <button className="btn btn-ghost btn-sm" onClick={handleRemount}>
                        Re-read (Remount Provider)
                    </button>
                </div>

                <MnemonicProvider
                    key={mountKey}
                    namespace={NAMESPACE}
                    storage={storage}
                    schemaMode={schemaMode}
                    schemaRegistry={registry}
                >
                    <PlaygroundWorkbench
                        activeKey={activeKey}
                        hookCodec={hookCodec}
                        writeValue={writeValue}
                        onWriteValueChange={setWriteValue}
                        onResult={handleResult}
                        storage={storage}
                        registry={registry}
                        schemaMode={schemaMode}
                        schemaSelection={writeSchemaSelection}
                        schemaOptions={schemaOptions}
                        onSchemaSelectionChange={setWriteSchemaSelection}
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
