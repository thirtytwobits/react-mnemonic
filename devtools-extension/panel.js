const TABLE_BODY_ID = "storage-table-body";
const STATUS_ID = "status";
const REFRESH_BUTTON_ID = "refresh-button";
const AUTO_REFRESH_TOGGLE_ID = "auto-refresh-toggle";
const TABLE_COLUMN_COUNT = 3;

const AUTO_REFRESH_STORAGE_KEY = "react-mnemonic:auto-refresh";
const POLL_INTERVAL_MS = 500;

const storageTableBody = document.getElementById(TABLE_BODY_ID);
const statusElement = document.getElementById(STATUS_ID);
const refreshButton = document.getElementById(REFRESH_BUTTON_ID);
const autoRefreshToggle = document.getElementById(AUTO_REFRESH_TOGGLE_ID);

if (!(storageTableBody instanceof HTMLTableSectionElement)) {
    throw new Error(`Missing #${TABLE_BODY_ID} table body.`);
}

if (!(statusElement instanceof HTMLElement)) {
    throw new Error(`Missing #${STATUS_ID} status element.`);
}

if (!(refreshButton instanceof HTMLButtonElement)) {
    throw new Error(`Missing #${REFRESH_BUTTON_ID} button.`);
}

if (!(autoRefreshToggle instanceof HTMLInputElement)) {
    throw new Error(`Missing #${AUTO_REFRESH_TOGGLE_ID} input.`);
}

let pollTimerId = null;
let fetchInFlight = false;
let lastSeenVersion = null;
let lastSeenLivenessSignature = null;
let autoRefreshEnabled = true;
let supportsMetaVersion = false;
let mutationInFlight = false;

const lastSnapshotByNamespace = new Map();

function setStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.classList.toggle("error", isError);
}

function createCell(tagName, className, text, colSpan) {
    const cell = document.createElement(tagName);
    cell.className = className;
    cell.textContent = text;
    if (colSpan) {
        cell.colSpan = colSpan;
    }
    return cell;
}

function renderEmptyState(message = "No mnemonic entries found.") {
    storageTableBody.replaceChildren();
    const row = document.createElement("tr");
    row.appendChild(createCell("td", "empty-cell", message, TABLE_COLUMN_COUNT));
    storageTableBody.appendChild(row);
}

function createActionButton(label, title, handler, options = {}) {
    const { danger = false } = options;
    const button = document.createElement("button");
    button.type = "button";
    button.className = danger ? "action-button danger" : "action-button";
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", handler);
    return button;
}

function renderActionPlaceholder() {
    const placeholder = document.createElement("span");
    placeholder.className = "action-placeholder";
    placeholder.textContent = "-";
    return placeholder;
}

function runProviderMutation(action) {
    if (mutationInFlight) return;
    mutationInFlight = true;
    refreshButton.disabled = true;

    const verb =
        action.type === "clear"
            ? `Clearing all keys in "${action.namespace}"...`
            : `Removing "${action.key}" from "${action.namespace}"...`;
    setStatus(verb);

    const namespaceLiteral = JSON.stringify(String(action.namespace));
    const keyLiteral = action.type === "remove" ? JSON.stringify(String(action.key)) : "null";
    const typeLiteral = JSON.stringify(action.type);

    chrome.devtools.inspectedWindow.eval(
        `(() => {
            try {
                const registry = window.__REACT_MNEMONIC_DEVTOOLS__;
                if (!registry || typeof registry !== "object") {
                    return { ok: false, reason: "MISSING_REGISTRY" };
                }

                const hasRegistryApi =
                    typeof registry.list === "function" &&
                    typeof registry.resolve === "function" &&
                    registry.providers &&
                    typeof registry.providers === "object";
                if (!hasRegistryApi) {
                    return { ok: false, reason: "INCOMPATIBLE_REGISTRY" };
                }

                const namespace = ${namespaceLiteral};
                const key = ${keyLiteral};
                const actionType = ${typeLiteral};
                const provider = registry.resolve(namespace);
                if (!provider) {
                    return { ok: false, reason: "PROVIDER_UNAVAILABLE" };
                }

                if (actionType === "clear") {
                    if (typeof provider.clear !== "function") {
                        return { ok: false, reason: "MISSING_PROVIDER_METHOD", method: "clear" };
                    }
                    provider.clear();
                    return { ok: true };
                }

                if (typeof provider.remove !== "function") {
                    return { ok: false, reason: "MISSING_PROVIDER_METHOD", method: "remove" };
                }
                if (typeof key !== "string" || key.length === 0) {
                    return { ok: false, reason: "INVALID_KEY" };
                }

                provider.remove(key);
                return { ok: true };
            } catch (error) {
                return { ok: false, error: String(error) };
            }
        })()`,
        (result, exceptionInfo) => {
            mutationInFlight = false;
            refreshButton.disabled = false;

            if (exceptionInfo?.isException) {
                const message = exceptionInfo.value || "Mutation failed in inspected page.";
                setStatus(message, true);
                return;
            }

            if (!result?.ok) {
                if (result?.reason === "PROVIDER_UNAVAILABLE") {
                    setStatus(`Provider "${action.namespace}" is no longer available.`, true);
                    fetchMnemonicRows({ silent: true });
                    return;
                }
                const message =
                    result?.error ||
                    (result?.reason
                        ? `Unable to run action: ${result.reason}${result.method ? ` (${result.method})` : ""}.`
                        : "Unable to run action.");
                setStatus(message, true);
                return;
            }

            fetchMnemonicRows({ silent: true });
        },
    );
}

function formatValueForTable(value) {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function buildLivenessSignature(namespaces) {
    return namespaces
        .map((entry) => `${entry.namespace}:${entry.available ? 1 : 0}`)
        .sort()
        .join("|");
}

function renderNamespaceRows(namespaces) {
    storageTableBody.replaceChildren();

    if (namespaces.length === 0) {
        renderEmptyState("No mnemonic providers are currently registered.");
        return;
    }

    for (const namespaceEntry of namespaces) {
        const groupRow = document.createElement("tr");
        groupRow.className = namespaceEntry.available ? "group-row" : "group-row stale-group-row";
        const groupCell = createCell("td", "group-cell", "", 2);
        const groupLabel = document.createElement("span");
        groupLabel.className = "group-label";
        groupLabel.textContent = namespaceEntry.available
            ? `${namespaceEntry.namespace} (${namespaceEntry.rows.length})`
            : `${namespaceEntry.namespace} (provider unavailable)`;
        groupCell.appendChild(groupLabel);
        groupRow.appendChild(groupCell);

        const groupActionCell = document.createElement("td");
        groupActionCell.className = "action-cell";
        if (namespaceEntry.available) {
            groupActionCell.appendChild(
                createActionButton(
                    "Clear",
                    `Clear all keys in "${namespaceEntry.namespace}"`,
                    () => {
                        runProviderMutation({
                            type: "clear",
                            namespace: namespaceEntry.namespace,
                        });
                    },
                    { danger: true },
                ),
            );
        } else {
            groupActionCell.appendChild(renderActionPlaceholder());
        }
        groupRow.appendChild(groupActionCell);
        storageTableBody.appendChild(groupRow);

        if (!namespaceEntry.available && namespaceEntry.showingSnapshot) {
            const staleInfoRow = document.createElement("tr");
            staleInfoRow.className = "stale-row";
            staleInfoRow.appendChild(
                createCell(
                    "td",
                    "stale-note-cell",
                    "Provider no longer available. Showing last captured snapshot.",
                    TABLE_COLUMN_COUNT,
                ),
            );
            storageTableBody.appendChild(staleInfoRow);
        }

        if (namespaceEntry.rows.length === 0) {
            const row = document.createElement("tr");
            row.className = namespaceEntry.available ? "" : "stale-row";
            row.appendChild(
                createCell(
                    "td",
                    "empty-cell",
                    namespaceEntry.available ? "(no keys)" : "(no snapshot available)",
                    TABLE_COLUMN_COUNT,
                ),
            );
            storageTableBody.appendChild(row);
            continue;
        }

        for (const entry of namespaceEntry.rows) {
            const row = document.createElement("tr");
            row.className = namespaceEntry.available ? "" : "stale-row";
            row.appendChild(createCell("td", "key-cell", entry.key));
            row.appendChild(createCell("td", "value-cell", formatValueForTable(entry.value)));
            const actionCell = document.createElement("td");
            actionCell.className = "action-cell";
            if (namespaceEntry.available) {
                actionCell.appendChild(
                    createActionButton(
                        "Remove",
                        `Remove "${entry.key}" from "${namespaceEntry.namespace}"`,
                        () => {
                            runProviderMutation({
                                type: "remove",
                                namespace: namespaceEntry.namespace,
                                key: entry.key,
                            });
                        },
                        { danger: true },
                    ),
                );
            } else {
                actionCell.appendChild(renderActionPlaceholder());
            }
            row.appendChild(actionCell);
            storageTableBody.appendChild(row);
        }
    }
}

function loadAutoRefreshPreference() {
    const saved = localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
    if (saved === null) return true;
    return saved !== "false";
}

function saveAutoRefreshPreference() {
    localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, String(autoRefreshEnabled));
}

function stopPolling() {
    if (pollTimerId === null) return;
    clearInterval(pollTimerId);
    pollTimerId = null;
}

function updateAutoRefreshControlState() {
    if (supportsMetaVersion) {
        autoRefreshToggle.disabled = false;
        autoRefreshToggle.checked = autoRefreshEnabled;
        autoRefreshToggle.title = "";
        if (autoRefreshEnabled) {
            startPolling();
        } else {
            stopPolling();
        }
        return;
    }

    autoRefreshToggle.disabled = true;
    autoRefreshToggle.checked = false;
    autoRefreshToggle.title =
        "Auto-refresh requires window.__REACT_MNEMONIC_DEVTOOLS__.__meta.version on the inspected page.";
    stopPolling();
}

function applyStaleSnapshotRetention(namespaces) {
    const display = [];
    for (const namespaceEntry of namespaces) {
        if (namespaceEntry.available) {
            lastSnapshotByNamespace.set(namespaceEntry.namespace, namespaceEntry.rows);
            display.push({
                ...namespaceEntry,
                showingSnapshot: false,
            });
            continue;
        }

        const snapshot = lastSnapshotByNamespace.get(namespaceEntry.namespace);
        if (Array.isArray(snapshot) && snapshot.length > 0) {
            display.push({
                ...namespaceEntry,
                rows: snapshot,
                showingSnapshot: true,
            });
            continue;
        }

        display.push({
            ...namespaceEntry,
            rows: [],
            showingSnapshot: false,
        });
    }
    return display;
}

function fetchMnemonicRows(options = {}) {
    if (fetchInFlight) return;
    fetchInFlight = true;

    const { silent = false } = options;
    if (!silent) {
        setStatus("Loading Mnemonic DevTools registry...");
    }

    chrome.devtools.inspectedWindow.eval(
        `(() => {
            try {
                const registry = window.__REACT_MNEMONIC_DEVTOOLS__;
                if (!registry || typeof registry !== "object") {
                    return { ok: false, reason: "MISSING_REGISTRY" };
                }

                const hasRegistryApi =
                    typeof registry.list === "function" &&
                    typeof registry.resolve === "function" &&
                    registry.providers &&
                    typeof registry.providers === "object";

                if (!hasRegistryApi) {
                    return { ok: false, reason: "INCOMPATIBLE_REGISTRY" };
                }

                const hasMetaVersion = Number.isFinite(registry.__meta?.version);
                const version = hasMetaVersion ? registry.__meta.version : 0;
                const weakRefSupported = Boolean(registry.capabilities?.weakRef);

                if (!weakRefSupported) {
                    return { ok: false, reason: "WEAKREF_UNSUPPORTED", version, hasMetaVersion };
                }

                const descriptors = Array.isArray(registry.list()) ? registry.list() : [];
                const namespaces = [];

                for (const descriptor of descriptors) {
                    const namespace = String(descriptor.namespace ?? "");
                    const provider = registry.resolve(namespace);

                    if (!provider) {
                        namespaces.push({
                            namespace,
                            available: false,
                            rows: [],
                            registeredAt: Number(descriptor.registeredAt ?? 0),
                            lastSeenAt: Number(descriptor.lastSeenAt ?? 0),
                            staleSince: descriptor.staleSince == null ? null : Number(descriptor.staleSince)
                        });
                        continue;
                    }

                    let keys = [];
                    try {
                        keys = Array.isArray(provider.keys()) ? provider.keys() : [];
                    } catch {
                        keys = [];
                    }

                    const rows = [];
                    for (const key of keys) {
                        const keyText = String(key);
                        try {
                            rows.push({
                                key: keyText,
                                value: provider.get(keyText)
                            });
                        } catch (error) {
                            rows.push({
                                key: keyText,
                                value: { __error: String(error) }
                            });
                        }
                    }

                    rows.sort((a, b) => a.key.localeCompare(b.key));
                    namespaces.push({
                        namespace,
                        available: true,
                        rows,
                        registeredAt: Number(descriptor.registeredAt ?? 0),
                        lastSeenAt: Number(descriptor.lastSeenAt ?? 0),
                        staleSince: null
                    });
                }

                namespaces.sort((a, b) => a.namespace.localeCompare(b.namespace));
                const livenessSignature = namespaces
                    .map((entry) => \`\${entry.namespace}:\${entry.available ? 1 : 0}\`)
                    .join("|");

                return {
                    ok: true,
                    hasMetaVersion,
                    version,
                    namespaces,
                    livenessSignature
                };
            } catch (error) {
                return { ok: false, error: String(error) };
            }
        })()`,
        (result, exceptionInfo) => {
            fetchInFlight = false;

            if (exceptionInfo?.isException) {
                const message = exceptionInfo.value || "Failed to read Mnemonic DevTools registry from inspected page.";
                setStatus(message, true);
                renderEmptyState("Unable to read page state.");
                lastSeenVersion = null;
                lastSeenLivenessSignature = null;
                return;
            }

            supportsMetaVersion = Boolean(result?.hasMetaVersion);
            const version = Number.isFinite(result?.version) ? result.version : null;
            lastSeenVersion = version;
            updateAutoRefreshControlState();

            if (!result?.ok) {
                if (result?.reason === "MISSING_REGISTRY") {
                    setStatus("Mnemonic DevTools registry is not exposed on this page.", true);
                    renderEmptyState(
                        "This site is not using react-mnemonic, or MnemonicProvider enableDevTools is disabled.",
                    );
                    lastSeenLivenessSignature = null;
                    return;
                }

                if (result?.reason === "INCOMPATIBLE_REGISTRY") {
                    setStatus("Mnemonic DevTools registry shape is incompatible.", true);
                    renderEmptyState("Expected registry APIs (providers/list/resolve) were not found.");
                    lastSeenLivenessSignature = null;
                    return;
                }

                if (result?.reason === "WEAKREF_UNSUPPORTED") {
                    setStatus("WeakRef is unavailable in this runtime.", true);
                    renderEmptyState("Weak provider registry features are unavailable on this page.");
                    lastSeenLivenessSignature = "weakref:unsupported";
                    return;
                }

                const message = result?.error || "Failed to read Mnemonic DevTools registry from inspected page.";
                setStatus(message, true);
                renderEmptyState("Failed to read Mnemonic DevTools registry from inspected page.");
                lastSeenLivenessSignature = null;
                return;
            }

            const rawNamespaces = Array.isArray(result.namespaces) ? result.namespaces : [];
            const namespaces = applyStaleSnapshotRetention(rawNamespaces);
            const liveCount = rawNamespaces.filter((entry) => entry.available).length;
            const staleCount = rawNamespaces.length - liveCount;

            lastSeenLivenessSignature =
                typeof result.livenessSignature === "string"
                    ? result.livenessSignature
                    : buildLivenessSignature(rawNamespaces);

            renderNamespaceRows(namespaces);

            let totalRows = 0;
            for (const namespaceEntry of namespaces) {
                totalRows += Array.isArray(namespaceEntry.rows) ? namespaceEntry.rows.length : 0;
            }

            setStatus(
                `Loaded ${totalRows} entr${totalRows === 1 ? "y" : "ies"} across ${namespaces.length} provider${
                    namespaces.length === 1 ? "" : "s"
                } (${liveCount} live, ${staleCount} unavailable). Auto-refresh ${
                    supportsMetaVersion ? (autoRefreshEnabled ? "on" : "off") : "unavailable (__meta.version missing)"
                }.`,
            );
        },
    );
}

function pollForChanges() {
    if (!autoRefreshEnabled || fetchInFlight || !supportsMetaVersion) return;

    chrome.devtools.inspectedWindow.eval(
        `(() => {
            try {
                const registry = window.__REACT_MNEMONIC_DEVTOOLS__;
                if (!registry || typeof registry !== "object") {
                    return { ok: false, reason: "MISSING_REGISTRY" };
                }

                const hasRegistryApi =
                    typeof registry.list === "function" &&
                    typeof registry.resolve === "function" &&
                    registry.providers &&
                    typeof registry.providers === "object";

                if (!hasRegistryApi) {
                    return { ok: false, reason: "INCOMPATIBLE_REGISTRY" };
                }

                const version = Number.isFinite(registry.__meta?.version) ? registry.__meta.version : 0;
                const descriptors = Array.isArray(registry.list()) ? registry.list() : [];
                const livenessSignature = descriptors
                    .map((entry) => \`\${String(entry.namespace ?? "")}:\${entry.available ? 1 : 0}\`)
                    .sort()
                    .join("|");

                return { ok: true, version, livenessSignature };
            } catch (error) {
                return { ok: false, error: String(error) };
            }
        })()`,
        (result) => {
            if (!result?.ok) {
                if (lastSeenVersion !== null || lastSeenLivenessSignature !== null) {
                    fetchMnemonicRows({ silent: true });
                }
                return;
            }

            const version = Number.isFinite(result.version) ? result.version : 0;
            const livenessSignature = typeof result.livenessSignature === "string" ? result.livenessSignature : "";

            if (lastSeenVersion === null) {
                lastSeenVersion = version;
            }
            if (lastSeenLivenessSignature === null) {
                lastSeenLivenessSignature = livenessSignature;
            }

            if (version !== lastSeenVersion || livenessSignature !== lastSeenLivenessSignature) {
                fetchMnemonicRows({ silent: true });
            }
        },
    );
}

function startPolling() {
    if (!autoRefreshEnabled || !supportsMetaVersion || pollTimerId !== null) return;
    pollTimerId = setInterval(pollForChanges, POLL_INTERVAL_MS);
}

function setAutoRefreshEnabled(enabled) {
    autoRefreshEnabled = enabled;
    saveAutoRefreshPreference();
    updateAutoRefreshControlState();

    if (enabled && supportsMetaVersion) {
        startPolling();
        fetchMnemonicRows({ silent: true });
        return;
    }

    if (!supportsMetaVersion) {
        setStatus("Auto-refresh unavailable because __meta.version is missing. Click Refresh to sync.", false);
        return;
    }

    setStatus("Auto-refresh disabled. Click Refresh to sync.", false);
}

refreshButton.addEventListener("click", () => fetchMnemonicRows());
autoRefreshToggle.addEventListener("change", () => setAutoRefreshEnabled(autoRefreshToggle.checked));
window.addEventListener("beforeunload", stopPolling);

autoRefreshEnabled = loadAutoRefreshPreference();
updateAutoRefreshControlState();
fetchMnemonicRows();
