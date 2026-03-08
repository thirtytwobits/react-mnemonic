import { useState } from "react";

export function App() {
    const [theme] = useState("system");

    return (
        <header>
            <span>Theme badge: {theme}</span>
        </header>
    );
}
