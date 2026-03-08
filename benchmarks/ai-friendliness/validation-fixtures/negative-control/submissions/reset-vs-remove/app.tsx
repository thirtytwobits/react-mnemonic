import { useEffect, useState } from "react";

export function App() {
    const [theme, setTheme] = useState("dark");

    useEffect(() => {
        const saved = window.localStorage.getItem("theme");
        if (saved) {
            setTheme(saved);
        }
    }, []);

    return (
        <>
            <p>Theme: {theme}</p>
            <button
                onClick={() => {
                    setTheme("light");
                    window.localStorage.removeItem("theme");
                }}
            >
                Reset to defaults
            </button>
            <button
                onClick={() => {
                    setTheme("");
                    window.localStorage.removeItem("theme");
                }}
            >
                Remove saved preference
            </button>
        </>
    );
}
