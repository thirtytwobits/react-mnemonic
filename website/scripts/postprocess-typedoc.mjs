import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, "../docs/api");
const apiIndexPath = path.join(apiDir, "index.md");
const typedocSidebarPath = path.join(apiDir, "typedoc-sidebar.cjs");

const startHereSection = `<!-- START_HERE_START -->
## Start Here

If you're new to the library, begin with these pages:

- [MnemonicProvider](functions/MnemonicProvider.md)
- [useMnemonicKey](functions/useMnemonicKey.md)
- [MnemonicKeyState](interfaces/MnemonicKeyState.md)
- [UseMnemonicKeyOptions](type-aliases/UseMnemonicKeyOptions.md)
- [useMnemonicRecovery](functions/useMnemonicRecovery.md)
- [createSchemaRegistry](functions/createSchemaRegistry.md)

Advanced runtime inspection APIs such as the DevTools registry and underlying
store interfaces are documented below, but most applications do not need them.
<!-- START_HERE_END -->`;

const startHereSidebarCategory = `    // START_HERE_START
    {
      type: "category",
      label: "Start Here",
      items: [
        {
          type: "doc",
          id: "api/functions/MnemonicProvider",
          label: "MnemonicProvider"
        },
        {
          type: "doc",
          id: "api/functions/useMnemonicKey",
          label: "useMnemonicKey"
        },
        {
          type: "doc",
          id: "api/interfaces/MnemonicKeyState",
          label: "MnemonicKeyState"
        },
        {
          type: "doc",
          id: "api/type-aliases/UseMnemonicKeyOptions",
          label: "UseMnemonicKeyOptions"
        },
        {
          type: "doc",
          id: "api/functions/useMnemonicRecovery",
          label: "useMnemonicRecovery"
        },
        {
          type: "doc",
          id: "api/functions/createSchemaRegistry",
          label: "createSchemaRegistry"
        }
      ]
    },
    // START_HERE_END
`;

function replaceMarkedBlock(text, startMarker, endMarker, replacement) {
    const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}\\n?`, "m");
    return pattern.test(text) ? text.replace(pattern, `${replacement}\n`) : text;
}

function postprocessApiIndex() {
    const original = readFileSync(apiIndexPath, "utf8");
    let next = replaceMarkedBlock(original, "<!-- START_HERE_START -->", "<!-- START_HERE_END -->", "");

    if (!next.startsWith("# react-mnemonic")) {
        throw new Error(`Unexpected API index format in ${apiIndexPath}`);
    }

    next = next.replace("# react-mnemonic\n\n", `# react-mnemonic\n\n${startHereSection}\n\n`);
    writeFileSync(apiIndexPath, next, "utf8");
}

function postprocessTypedocSidebar() {
    const original = readFileSync(typedocSidebarPath, "utf8");
    let next = replaceMarkedBlock(original, "// START_HERE_START", "// START_HERE_END", "");

    const anchor = "const typedocSidebar = {\n  items: [\n";
    if (!next.includes(anchor)) {
        throw new Error(`Unexpected sidebar format in ${typedocSidebarPath}`);
    }

    next = next.replace(anchor, `${anchor}${startHereSidebarCategory}`);
    writeFileSync(typedocSidebarPath, next, "utf8");
}

postprocessApiIndex();
postprocessTypedocSidebar();
