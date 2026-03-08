import { useEffect, useState } from "react";

export function App() {
    const [theme, setTheme] = useState("light");

    useEffect(() => {
        const saved = window.localStorage.getItem("theme");
        if (saved) {
            setTheme(saved);
        }
    }, []);

    return <span>{theme}</span>;
}
