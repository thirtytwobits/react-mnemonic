const titleElement = document.getElementById("message-title");
const bodyElement = document.getElementById("message-body");
const urlElement = document.getElementById("page-url");
const cardElement = document.getElementById("message-card");

if (
    !(titleElement instanceof HTMLElement) ||
    !(bodyElement instanceof HTMLElement) ||
    !(urlElement instanceof HTMLElement) ||
    !(cardElement instanceof HTMLElement)
) {
    throw new Error("Popup markup is missing required elements.");
}

const RESTRICTED_PREFIXES = [
    "chrome://",
    "chrome-extension://",
    "devtools://",
    "edge://",
    "about:",
    "view-source:",
    "brave://",
    "vivaldi://",
    "opera://",
];

function isRestrictedUrl(url) {
    if (!url) return true;
    return RESTRICTED_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function setMessage({ title, body, pageUrl, restricted }) {
    titleElement.textContent = title;
    bodyElement.textContent = body;
    urlElement.textContent = pageUrl ? `Page: ${pageUrl}` : "";
    cardElement.classList.toggle("restricted", restricted);
}

async function updatePopupMessage() {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const pageUrl = typeof activeTab?.url === "string" ? activeTab.url : "";
        const tabId = typeof activeTab?.id === "number" ? activeTab.id : null;

        if (isRestrictedUrl(pageUrl)) {
            setMessage({
                title: "This is a restricted browser page.",
                body: "react-mnemonic DevTools cannot access this page.",
                pageUrl,
                restricted: true,
            });
            return;
        }

        if (tabId === null) {
            setMessage({
                title: "Unable to inspect this page.",
                body: "No active tab is available for react-mnemonic detection.",
                pageUrl,
                restricted: true,
            });
            return;
        }

        const [scriptResult] = await chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: () => {
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

                const weakRefSupported = Boolean(registry.capabilities?.weakRef);
                const finalizationRegistrySupported = Boolean(
                    registry.capabilities?.finalizationRegistry
                );

                const descriptors = Array.isArray(registry.list()) ? registry.list() : [];
                const providerStatuses = descriptors.map((entry) => ({
                    namespace: String(entry.namespace ?? ""),
                    available: Boolean(entry.available),
                }));

                return {
                    ok: true,
                    weakRefSupported,
                    finalizationRegistrySupported,
                    providerStatuses,
                };
            },
        });

        const result = scriptResult?.result;
        if (!result?.ok) {
            if (result?.reason === "INCOMPATIBLE_REGISTRY") {
                setMessage({
                    title: "Mnemonic DevTools registry is incompatible.",
                    body: "This page appears to use an older devtools shape. Refresh after updating react-mnemonic.",
                    pageUrl,
                    restricted: true,
                });
                return;
            }

            setMessage({
                title: "This site is not exposing Mnemonic DevTools.",
                body: "Either react-mnemonic is not in use, or MnemonicProvider has enableDevTools disabled.",
                pageUrl,
                restricted: true,
            });
            return;
        }

        if (!result.weakRefSupported) {
            setMessage({
                title: "Weak registry support is unavailable.",
                body: "This runtime does not support WeakRef, so provider registry inspection is unavailable.",
                pageUrl,
                restricted: true,
            });
            return;
        }

        const statuses = Array.isArray(result.providerStatuses) ? result.providerStatuses : [];
        const liveNamespaces = statuses
            .filter((entry) => entry.available)
            .map((entry) => entry.namespace)
            .filter(Boolean);
        const staleNamespaces = statuses
            .filter((entry) => !entry.available)
            .map((entry) => entry.namespace)
            .filter(Boolean);

        if (statuses.length === 0) {
            setMessage({
                title: "Mnemonic registry is available.",
                body: "No providers are currently registered on this page.",
                pageUrl,
                restricted: false,
            });
            return;
        }

        if (liveNamespaces.length === 0 && staleNamespaces.length > 0) {
            setMessage({
                title: "No live Mnemonic providers available.",
                body: `Providers are stale/unavailable: ${staleNamespaces.join(
                    ", "
                )}. Open a route where providers are mounted.`,
                pageUrl,
                restricted: false,
            });
            return;
        }

        const staleSuffix =
            staleNamespaces.length > 0 ? ` Stale: ${staleNamespaces.join(", ")}.` : "";
        setMessage({
            title: "Mnemonic providers detected.",
            body: `Live: ${liveNamespaces.join(", ")}.${staleSuffix} Open DevTools and select the "react-mnemonic" tab.`,
            pageUrl,
            restricted: false,
        });
    } catch (error) {
        setMessage({
            title: "Unable to determine page access.",
            body: `react-mnemonic detection failed: ${String(error)}`,
            pageUrl: "",
            restricted: true,
        });
    }
}

void updatePopupMessage();
