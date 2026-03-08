import { useEffect, useState } from "react";

type Draft = {
    step: string;
    profile: Record<string, unknown>;
};

export function App() {
    const [draft, setDraft] = useState<Draft>({
        step: "welcome",
        profile: {},
    });

    useEffect(() => {
        const saved = window.localStorage.getItem("onboardingDraft");
        if (saved) {
            setDraft(JSON.parse(saved) as Draft);
        }
    }, []);

    return (
        <button
            onClick={() => {
                const next = { ...draft, step: "profile" };
                setDraft(next);
                window.localStorage.setItem("onboardingDraft", JSON.stringify(next));
            }}
        >
            {draft.step}
        </button>
    );
}
