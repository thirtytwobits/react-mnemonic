import { useState } from "react";

export function App() {
    const [theme, setTheme] = useState("dark");

    return (
        <section>
            <h1>Preferences</h1>
            <p>Theme: {theme}</p>
            <button onClick={() => setTheme("light")}>Reset to defaults</button>
            <button onClick={() => setTheme("")}>Remove saved preference</button>
        </section>
    );
}
