import { useEffect, useState } from "react";

export function App() {
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (window.localStorage.getItem("bannerDismissed") === "true") {
            setDismissed(true);
        }
    }, []);

    if (dismissed) {
        return null;
    }

    return (
        <button
            onClick={() => {
                setDismissed(true);
                window.localStorage.setItem("bannerDismissed", "true");
            }}
        >
            Dismiss
        </button>
    );
}
