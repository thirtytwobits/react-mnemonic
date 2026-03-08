import { useLocalStorage } from "usehooks-ts";

type Theme = "light" | "dark";

export function ThemeButton() {
    const [theme, setTheme] = useLocalStorage<Theme>("theme", "light");

    return <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>Theme: {theme}</button>;
}
