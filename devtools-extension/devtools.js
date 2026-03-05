try {
    chrome.devtools.panels.create("react-mnemonic", "assets/logo.svg", "panel.html", () => {
        if (chrome.runtime.lastError) {
            console.error("[react-mnemonic devtools] Failed to create panel:", chrome.runtime.lastError.message);
        }
    });
} catch (error) {
    console.error("[react-mnemonic devtools] Unexpected error creating panel:", error);
}
