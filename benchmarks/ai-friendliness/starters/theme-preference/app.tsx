import { useState } from "react";

export function App() {
    const [theme, setTheme] = useState<"light" | "dark">("light");

    return (
        <section>
            <h1>Theme Settings</h1>
            <p>Current theme: {theme}</p>
            <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>Toggle theme</button>
        </section>
    );
}
