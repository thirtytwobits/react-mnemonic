import { useState } from "react";

export function App() {
    const [step, setStep] = useState("welcome");

    return (
        <section>
            <h1>Onboarding</h1>
            <p>Step: {step}</p>
            <button onClick={() => setStep(step === "welcome" ? "profile" : "welcome")}>Next step</button>
        </section>
    );
}
