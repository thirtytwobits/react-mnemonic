// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { useState, useEffect } from "react";
import { useMnemonicKey } from "react-mnemonic";

const modes = ["light", "system", "dark"] as const;

export function ThemeToggle() {
    const { value: mode, set } = useMnemonicKey<string>("theme-mode", {
        defaultValue: "system",
        listenCrossTab: true,
    });

    const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;

    return (
        <div>
            <div className="theme-toggle">
                {modes.map((m) => (
                    <button key={m} data-active={mode === m} onClick={() => set(m)}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                ))}
            </div>
            {mode === "system" && (
                <p className="theme-resolved">
                    System preference resolved to <strong>{resolved}</strong>
                </p>
            )}
        </div>
    );
}
