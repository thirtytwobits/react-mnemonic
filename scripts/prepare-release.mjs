#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const rootPackageJsonPath = path.join(repoRoot, "package.json");
const changelogPath = path.join(repoRoot, "CHANGELOG.md");
const securityPath = path.join(repoRoot, "SECURITY.md");
const contributingPath = path.join(repoRoot, "CONTRIBUTING.md");
const docusaurusConfigPath = path.join(repoRoot, "website", "docusaurus.config.ts");
const assistantSetupPath = path.join(repoRoot, "website", "docs", "ai", "assistant-setup.md");
const versionsJsonPath = path.join(repoRoot, "website", "versions.json");
const websitePackageLockPath = path.join(repoRoot, "website", "package-lock.json");

const bumpKinds = new Set(["patch", "minor", "major", "prepatch", "preminor", "premajor", "prerelease"]);

function readText(filePath) {
    return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, content) {
    fs.writeFileSync(filePath, content, "utf8");
}

function readJson(filePath) {
    return JSON.parse(readText(filePath));
}

function writeJson(filePath, value) {
    writeText(filePath, `${JSON.stringify(value, null, 4)}\n`);
}

function run(command, args, options = {}) {
    const { cwd = repoRoot, stdio = "pipe" } = options;
    return execFileSync(command, args, {
        cwd,
        stdio,
        encoding: "utf8",
    });
}

function logStep(message) {
    console.log(`\n[release:prepare] ${message}`);
}

function fail(message) {
    throw new Error(message);
}

function parseArgs(argv) {
    if (argv.length === 0) {
        fail("Missing version or bump kind. Example: npm run release:prepare -- 1.2.1-beta1");
    }

    const [target, ...rest] = argv;
    const options = {
        target,
        preid: null,
    };

    for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (arg === "--preid") {
            const value = rest[i + 1];
            if (!value || value.startsWith("--")) {
                fail("Missing value for --preid");
            }
            options.preid = value;
            i += 1;
            continue;
        }
        fail(`Unsupported argument: ${arg}`);
    }

    if (options.preid && !["prepatch", "preminor", "premajor", "prerelease"].includes(options.target)) {
        fail("--preid is only supported with prepatch, preminor, premajor, or prerelease");
    }

    return options;
}

function ensureCleanWorktree() {
    const status = run("git", ["status", "--porcelain"]);
    if (status.trim() !== "") {
        fail("Git worktree must be clean before running release prep.");
    }
}

function currentBranchName() {
    return run("git", ["branch", "--show-current"]).trim();
}

function releaseBranchName(version) {
    return `release/v${version}`;
}

function branchExists(branchName) {
    try {
        run("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branchName}`]);
        return true;
    } catch {
        return false;
    }
}

function ensureReleaseBranch(version) {
    const branchName = releaseBranchName(version);
    const currentBranch = currentBranchName();

    if (currentBranch === branchName) {
        return branchName;
    }

    if (branchExists(branchName)) {
        fail(`Release branch ${branchName} already exists.`);
    }

    run("git", ["switch", "-c", branchName], { stdio: "inherit" });
    return branchName;
}

function isExplicitVersion(target) {
    return !bumpKinds.has(target);
}

function parseVersion(version) {
    const match = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<prerelease>[0-9A-Za-z.-]+))?$/.exec(version);
    if (!match?.groups) {
        fail(`Unsupported semver version: ${version}`);
    }

    return {
        major: Number(match.groups.major),
        minor: Number(match.groups.minor),
        patch: Number(match.groups.patch),
        prerelease: match.groups.prerelease ? match.groups.prerelease.split(".") : [],
    };
}

function comparePrereleaseIdentifiers(left, right) {
    const leftNumeric = /^\d+$/.test(left);
    const rightNumeric = /^\d+$/.test(right);

    if (leftNumeric && rightNumeric) {
        return Number(left) - Number(right);
    }
    if (leftNumeric) {
        return -1;
    }
    if (rightNumeric) {
        return 1;
    }
    return left.localeCompare(right);
}

function compareVersionsDescending(left, right) {
    const a = parseVersion(left);
    const b = parseVersion(right);

    if (a.major !== b.major) return b.major - a.major;
    if (a.minor !== b.minor) return b.minor - a.minor;
    if (a.patch !== b.patch) return b.patch - a.patch;

    const aPre = a.prerelease;
    const bPre = b.prerelease;

    if (aPre.length === 0 && bPre.length === 0) return 0;
    if (aPre.length === 0) return -1;
    if (bPre.length === 0) return 1;

    const length = Math.max(aPre.length, bPre.length);
    for (let index = 0; index < length; index += 1) {
        const leftIdentifier = aPre[index];
        const rightIdentifier = bPre[index];

        if (leftIdentifier === undefined) return -1;
        if (rightIdentifier === undefined) return 1;

        const identifierComparison = comparePrereleaseIdentifiers(leftIdentifier, rightIdentifier);
        if (identifierComparison !== 0) {
            return identifierComparison;
        }
    }

    return 0;
}

function resolveTargetVersion(currentVersion, target, preid) {
    if (isExplicitVersion(target)) {
        parseVersion(target);
        return target;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "react-mnemonic-release-"));
    try {
        writeText(
            path.join(tempDir, "package.json"),
            `${JSON.stringify({ name: "release-prepare-temp", version: currentVersion }, null, 2)}\n`,
        );

        const args = ["version", target, "--no-git-tag-version"];
        if (preid) {
            args.push("--preid", preid);
        }
        run("npm", args, { cwd: tempDir });
        return readJson(path.join(tempDir, "package.json")).version;
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

function updateChangelog(version) {
    const changelog = readText(changelogPath);
    const headingPattern = /^## \[(?<current>[^\]]+)\] - Unreleased$/m;
    const match = changelog.match(headingPattern);
    if (!match?.groups?.current) {
        fail("Unable to locate the top unreleased heading in CHANGELOG.md");
    }

    const nextChangelog = changelog.replace(headingPattern, `## [${version}] - Unreleased`);
    if (nextChangelog === changelog) {
        fail("Unable to update CHANGELOG.md heading");
    }
    writeText(changelogPath, nextChangelog);
}

function updateSecurity(version) {
    let security = readText(securityPath);

    const supportSentencePattern = /Security fixes are provided for the current `[^`]+` prerelease/;
    if (!supportSentencePattern.test(security)) {
        fail("Unable to locate the supported prerelease sentence in SECURITY.md");
    }
    security = security.replace(
        supportSentencePattern,
        `Security fixes are provided for the current \`${version}\` prerelease`,
    );

    const currentVersionRowPattern = /^\| [^|]+\s+\| Yes\s+\|$/m;
    if (!currentVersionRowPattern.test(security)) {
        fail("Unable to locate the supported version row in SECURITY.md");
    }
    security = security.replace(currentVersionRowPattern, `| ${version.padEnd(12, " ")} | Yes       |`);

    const previousVersionRowPattern = /^\| < [^|]+ \| No\s+\|$/m;
    if (!previousVersionRowPattern.test(security)) {
        fail("Unable to locate the unsupported version row in SECURITY.md");
    }
    security = security.replace(previousVersionRowPattern, `| < ${version} | No        |`);

    writeText(securityPath, security);
}

function updateContributing(version) {
    let contributing = readText(contributingPath);
    const docsVersionExamplePattern = /npm run docs:version -- [0-9A-Za-z.-]+/;
    if (!docsVersionExamplePattern.test(contributing)) {
        fail("Unable to locate docs:version example in CONTRIBUTING.md");
    }
    contributing = contributing.replace(docsVersionExamplePattern, `npm run docs:version -- ${version}`);

    const releaseTagExamplePattern = /Triggered by tagged releases matching `v\*` \(for example `v[^`]+` or/;
    if (!releaseTagExamplePattern.test(contributing)) {
        fail("Unable to locate release tag example in CONTRIBUTING.md");
    }
    contributing = contributing.replace(
        releaseTagExamplePattern,
        `Triggered by tagged releases matching \`v*\` (for example \`v${version}\` or`,
    );
    writeText(contributingPath, contributing);
}

function updateAssistantSetup(version) {
    const assistantSetup = readText(assistantSetupPath);
    const releasedPathPattern = /- `https:\/\/thirtytwobits\.github\.io\/react-mnemonic\/docs\/[0-9A-Za-z.-]+`/;
    if (!releasedPathPattern.test(assistantSetup)) {
        fail("Unable to locate released docs URL example in assistant-setup.md");
    }
    const nextAssistantSetup = assistantSetup.replace(
        releasedPathPattern,
        `- \`https://thirtytwobits.github.io/react-mnemonic/docs/${version}\``,
    );
    if (nextAssistantSetup === assistantSetup) {
        fail("Unable to update assistant-setup released docs URL");
    }
    writeText(assistantSetupPath, nextAssistantSetup);
}

function updateWebsitePackageLock(version) {
    const websitePackageLock = readJson(websitePackageLockPath);
    if (!websitePackageLock.packages?.[".."]) {
        fail("website/package-lock.json is missing packages['..']");
    }
    websitePackageLock.packages[".."].version = version;
    writeJson(websitePackageLockPath, websitePackageLock);
}

function updateVersionsJson(version) {
    const versions = readJson(versionsJsonPath);
    const nextVersions = Array.from(new Set([version, ...versions])).sort(compareVersionsDescending);
    writeText(versionsJsonPath, `${JSON.stringify(nextVersions, null, 2)}\n`);
    return nextVersions;
}

function buildVersionsBlock(versions) {
    const lines = [
        "                    versions: {",
        "                        current: {",
        '                            label: "Next",',
        '                            path: "next",',
        "                        },",
        ...versions.flatMap((version) => [
            `                        "${version}": {`,
            `                            label: "${version}",`,
            "                        },",
        ]),
        "                    },",
    ];
    return lines.join("\n");
}

function updateDocusaurusConfig(version, versions) {
    let config = readText(docusaurusConfigPath);
    config = config.replace(/lastVersion: "[^"]+"/, `lastVersion: "${version}"`);
    if (!config.includes("                    versions: {")) {
        fail("Unable to locate docs versions block in website/docusaurus.config.ts");
    }
    const versionsSectionPattern = /                    versions: \{[\s\S]*?                blog: false,/m;
    if (!versionsSectionPattern.test(config)) {
        fail("Unable to rewrite docs versions section in website/docusaurus.config.ts");
    }
    config = config.replace(
        versionsSectionPattern,
        `${buildVersionsBlock(versions)}\n                },\n                blog: false,`,
    );
    writeText(docusaurusConfigPath, config);
}

function applySnapshotPostProcessing(version) {
    const shoppingCartPath = path.join(
        repoRoot,
        "website",
        "versioned_docs",
        `version-${version}`,
        "guides",
        "shopping-cart-persistence.md",
    );

    if (!fs.existsSync(shoppingCartPath)) {
        fail(`Missing versioned shopping-cart guide for ${version}`);
    }

    let shoppingCartGuide = readText(shoppingCartPath);
    const liveImport = 'import { ShoppingCart } from "@site/src/components/demo/ShoppingCart";\n\n';
    if (!shoppingCartGuide.includes(liveImport)) {
        fail(`Unable to locate the live ShoppingCart import in ${path.relative(repoRoot, shoppingCartPath)}`);
    }
    shoppingCartGuide = shoppingCartGuide.replace(liveImport, "");

    const interactiveExampleBlock = "## Interactive example\n\n<ShoppingCart />";
    if (!shoppingCartGuide.includes(interactiveExampleBlock)) {
        fail(`Unable to locate the interactive ShoppingCart block in ${path.relative(repoRoot, shoppingCartPath)}`);
    }
    shoppingCartGuide = shoppingCartGuide.replace(
        interactiveExampleBlock,
        [
            "## Release snapshot note",
            "",
            "The current docs site and playground share one live `ShoppingCart` component,",
            `but this frozen \`${version}\` snapshot intentionally does not import`,
            "`@site/src` demo code.",
            "",
            "That keeps this release snapshot self-contained even if the current playground",
            "component evolves later. For the matching implementation shape, use the shared",
            "cart source linked above and the guidance in this document.",
        ].join("\n"),
    );

    writeText(shoppingCartPath, shoppingCartGuide);
}

function commitChanges(version) {
    run("git", ["add", "-A"], { stdio: "inherit" });
    run("git", ["commit", "-m", `Prepare release v${version}`], { stdio: "inherit" });
}

function main() {
    const { target, preid } = parseArgs(process.argv.slice(2));
    const currentVersion = readJson(rootPackageJsonPath).version;
    const currentVersions = readJson(versionsJsonPath);

    logStep("Checking git worktree");
    ensureCleanWorktree();

    logStep("Resolving target version");
    const resolvedVersion = resolveTargetVersion(currentVersion, target, preid);
    console.log(`[release:prepare] current version: ${currentVersion}`);
    console.log(`[release:prepare] target version: ${resolvedVersion}`);

    if (currentVersions.includes(resolvedVersion)) {
        if (isExplicitVersion(target)) {
            fail(`Docs version ${resolvedVersion} already exists in website/versions.json.`);
        }
        fail(`Resolved docs version ${resolvedVersion} already exists in website/versions.json.`);
    }

    if (resolvedVersion === currentVersion) {
        fail(`Resolved version ${resolvedVersion} matches the current package version.`);
    }

    logStep("Creating release branch");
    const branchName = ensureReleaseBranch(resolvedVersion);
    console.log(`[release:prepare] release branch: ${branchName}`);

    logStep("Applying root package version");
    const npmVersionArgs = ["version", target, "--no-git-tag-version"];
    if (preid) {
        npmVersionArgs.push("--preid", preid);
    }
    run("npm", npmVersionArgs, { stdio: "inherit" });

    logStep("Updating website/package-lock.json");
    updateWebsitePackageLock(resolvedVersion);

    logStep("Updating release-facing docs");
    updateChangelog(resolvedVersion);
    updateSecurity(resolvedVersion);
    updateContributing(resolvedVersion);
    updateAssistantSetup(resolvedVersion);

    logStep("Regenerating AI assets");
    run("npm", ["run", "docs:ai"], { stdio: "inherit" });

    logStep("Clearing stale Docusaurus state");
    run("npm", ["--prefix", "website", "run", "clear"], { stdio: "inherit" });

    logStep("Cutting docs snapshot");
    run("npm", ["run", "docs:version", "--", resolvedVersion], { stdio: "inherit" });

    logStep("Updating released versions");
    const nextVersions = updateVersionsJson(resolvedVersion);
    updateDocusaurusConfig(resolvedVersion, nextVersions);

    logStep("Applying snapshot post-processing");
    applySnapshotPostProcessing(resolvedVersion);

    logStep("Running verification checks");
    run("npm", ["run", "format"], { stdio: "inherit" });
    run("npm", ["run", "ai:check"], { stdio: "inherit" });
    run("npm", ["run", "lint"], { stdio: "inherit" });
    run("npm", ["run", "build"], { stdio: "inherit" });
    run("npm", ["run", "test"], { stdio: "inherit" });
    run("npm", ["run", "docs:site"], { stdio: "inherit" });

    logStep("Creating commit");
    commitChanges(resolvedVersion);

    console.log(`\n[release:prepare] Done. Prepared release v${resolvedVersion} on ${branchName}`);
}

try {
    main();
} catch (error) {
    console.error(`\n[release:prepare] Failed: ${error.message}`);
    process.exit(1);
}
