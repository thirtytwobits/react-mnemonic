import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type Theme = "light" | "dark";

type ThemeStore = {
    theme: Theme;
    toggle: () => void;
};

const useThemeStore = create<ThemeStore>()(
    persist(
        (set, get) => ({
            theme: "light",
            toggle: () => {
                set({
                    theme: get().theme === "light" ? "dark" : "light",
                });
            },
        }),
        {
            name: "theme",
            storage: createJSONStorage(() => localStorage),
        },
    ),
);

export function ThemeButton() {
    const theme = useThemeStore((state) => state.theme);
    const toggle = useThemeStore((state) => state.toggle);
    return <button onClick={toggle}>Theme: {theme}</button>;
}
