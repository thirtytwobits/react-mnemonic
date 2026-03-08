import React from "react";
import ReactDOM from "react-dom/client";
import { MnemonicProvider, useMnemonicKey } from "react-mnemonic";

function App() {
    const theme = useMnemonicKey("theme", {
        defaultValue: "light" as "light" | "dark",
    });

    return (
        <main>
            <h1>Vite Fixture</h1>
            <button onClick={() => theme.set(theme.value === "light" ? "dark" : "light")}>{theme.value}</button>
        </main>
    );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <MnemonicProvider namespace="vite-fixture" storage={window.localStorage}>
            <App />
        </MnemonicProvider>
    </React.StrictMode>,
);
