import { gzipSync } from "node:zlib";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const bundlePath = resolve(root, "dist/optional.js");
const sourceMapPath = resolve(root, "dist/optional.js.map");

const rawSize = statSync(bundlePath).size;
const gzipSize = gzipSync(readFileSync(bundlePath)).length;

const rawBudget = 8 * 1024;
const gzipBudget = 3 * 1024;

if (rawSize > rawBudget) {
    throw new Error(
        `react-mnemonic/optional exceeds raw size budget: ${(rawSize / 1024).toFixed(2)} KB > ${(rawBudget / 1024).toFixed(2)} KB`,
    );
}

if (gzipSize > gzipBudget) {
    throw new Error(
        `react-mnemonic/optional exceeds gzip size budget: ${(gzipSize / 1024).toFixed(2)} KB > ${(gzipBudget / 1024).toFixed(2)} KB`,
    );
}

const { sources } = JSON.parse(readFileSync(sourceMapPath, "utf8"));
const forbiddenSources = [
    "../src/Mnemonic/provider.tsx",
    "../src/Mnemonic/use-core.ts",
    "../src/Mnemonic/use.ts",
    "../src/Mnemonic/use-shared.ts",
    "../src/Mnemonic/recovery.ts",
    "../src/Mnemonic/schema-registry.ts",
    "../src/Mnemonic/schema-helpers.ts",
    "../src/Mnemonic/json-schema.ts",
    "../src/Mnemonic/typed-schema.ts",
];

const includedForbiddenSources = forbiddenSources.filter((source) => sources.includes(source));
if (includedForbiddenSources.length > 0) {
    throw new Error(
        `react-mnemonic/optional pulled forbidden runtime sources into the bundle:\n${includedForbiddenSources.join("\n")}`,
    );
}

console.log(
    `react-mnemonic/optional bundle OK: raw ${(rawSize / 1024).toFixed(2)} KB, gzip ${(gzipSize / 1024).toFixed(2)} KB`,
);
