import { useState } from "react";

export function App() {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) {
        return <main>Dashboard</main>;
    }

    return (
        <aside>
            <p>Launch week sale</p>
            <button onClick={() => setDismissed(true)}>Dismiss</button>
        </aside>
    );
}
