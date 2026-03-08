// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { mkdtemp, readdir, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = path.join(rootDir, "fixtures", "consumers");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const fixtures = [
    { name: "vite-react", description: "Vite client build compatibility" },
    { name: "react-ssr", description: "React SSR + hydration compatibility" },
];

function run(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: "inherit",
            env: {
                ...process.env,
                CI: "1",
            },
        });

        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
        });
    });
}

async function main() {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "react-mnemonic-consumers-"));

    try {
        await run(npmCmd, ["run", "build"], rootDir);
        await run(npmCmd, ["pack", "--pack-destination", tempRoot], rootDir);

        const tarball = (await readdir(tempRoot)).find((file) => file.endsWith(".tgz"));
        if (!tarball) {
            throw new Error("npm pack did not produce a tarball");
        }

        const tarballPath = path.join(tempRoot, tarball);

        for (const fixture of fixtures) {
            const templateDir = path.join(fixturesDir, fixture.name);
            const workingDir = path.join(tempRoot, fixture.name);
            console.log(`\n[consumer-fixture] ${fixture.name}: ${fixture.description}`);

            await cp(templateDir, workingDir, { recursive: true });
            await run(npmCmd, ["install"], workingDir);
            await run(npmCmd, ["install", "--no-save", tarballPath], workingDir);
            await run(npmCmd, ["run", "check"], workingDir);
        }
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
