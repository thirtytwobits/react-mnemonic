import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

type Theme = "light" | "dark";

const themeAtom = atomWithStorage<Theme>("theme", "light");

export function ThemeButton() {
    const [theme, setTheme] = useAtom(themeAtom);
    return <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>Theme: {theme}</button>;
}
