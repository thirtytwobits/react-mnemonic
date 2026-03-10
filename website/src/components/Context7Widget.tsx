import { useEffect } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";

const SCRIPT_SELECTOR = 'script[data-context7-widget="react-mnemonic"]';

function Context7WidgetInner() {
    useEffect(() => {
        const existing = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
        if (existing) {
            return;
        }

        const script = document.createElement("script");
        script.src = "https://context7.com/widget.js";
        script.async = true;
        script.dataset.library = "/thirtytwobits/react-mnemonic";
        script.dataset.context7Widget = "react-mnemonic";

        document.body.appendChild(script);

        return () => {
            script.remove();
        };
    }, []);

    return null;
}

export default function Context7Widget() {
    return <BrowserOnly>{() => <Context7WidgetInner />}</BrowserOnly>;
}
