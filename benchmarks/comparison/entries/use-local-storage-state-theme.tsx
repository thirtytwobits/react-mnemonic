import useLocalStorageState from "use-local-storage-state";

type Theme = "light" | "dark";

export function ThemeButton() {
    const [theme, setTheme] = useLocalStorageState<Theme>("theme", {
        defaultValue: "light",
    });

    return <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>Theme: {theme}</button>;
}
