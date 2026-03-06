// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

import { describe, it, expect } from "vitest";
import {
    dedupeChildrenBy,
    findNodeById,
    insertChildIfMissing,
    renameNode,
    type StructuralTreeHelpers,
} from "./structural-migrations";

type LayoutNode = {
    id: string;
    title: string;
    children?: LayoutNode[];
};

type CustomLayoutNode = {
    key: string;
    label: string;
    nodes?: CustomLayoutNode[];
};

const tree: LayoutNode = {
    id: "root",
    title: "Root",
    children: [
        {
            id: "sidebar",
            title: "Sidebar",
            children: [
                { id: "inbox", title: "Inbox" },
                { id: "prefs", title: "Preferences" },
                { id: "prefs", title: "Preferences duplicate" },
            ],
        },
        { id: "content", title: "Content" },
    ],
};

const customHelpers: StructuralTreeHelpers<CustomLayoutNode> = {
    getId: (node) => node.key,
    getChildren: (node) => node.nodes,
    withChildren: (node, children) => ({ ...node, nodes: children }),
    withId: (node, id) => ({ ...node, key: id }),
};

describe("structural migration helpers", () => {
    it("finds nodes by id in default trees", () => {
        expect(findNodeById(tree, "sidebar")?.title).toBe("Sidebar");
        expect(findNodeById(tree, "missing")).toBeUndefined();
    });

    it("inserts a child once and stays idempotent on repeat application", () => {
        const child: LayoutNode = { id: "search", title: "Search" };
        const once = insertChildIfMissing(tree, "sidebar", child);
        const twice = insertChildIfMissing(once, "sidebar", child);

        expect(findNodeById(once, "search")?.title).toBe("Search");
        expect(findNodeById(twice, "search")?.title).toBe("Search");
        expect(findNodeById(twice, "sidebar")?.children?.filter((node) => node.id === "search")).toHaveLength(1);
        expect(twice).toEqual(once);
    });

    it("renames matching ids and stays idempotent on repeat application", () => {
        const once = renameNode(tree, "prefs", "preferences");
        const twice = renameNode(once, "prefs", "preferences");
        const sidebarChildren = findNodeById(once, "sidebar")?.children ?? [];

        expect(findNodeById(once, "preferences")?.title).toBe("Preferences");
        expect(findNodeById(once, "prefs")).toBeUndefined();
        expect(sidebarChildren.map((node) => node.id)).toEqual(["inbox", "preferences", "preferences"]);
        expect(twice).toEqual(once);
    });

    it("does not rename when the target id already exists", () => {
        const result = renameNode(tree, "sidebar", "content");
        expect(result).toBe(tree);
    });

    it("dedupes duplicate siblings and stays idempotent on repeat application", () => {
        const once = dedupeChildrenBy(tree, (node) => node.id);
        const twice = dedupeChildrenBy(once, (node) => node.id);
        const sidebarChildren = findNodeById(once, "sidebar")?.children ?? [];

        expect(sidebarChildren.map((node) => node.id)).toEqual(["inbox", "prefs"]);
        expect(twice).toEqual(once);
    });

    it("supports custom tree adapters", () => {
        const customTree: CustomLayoutNode = {
            key: "root",
            label: "Root",
            nodes: [{ key: "alpha", label: "Alpha" }],
        };

        const inserted = insertChildIfMissing(customTree, "root", { key: "beta", label: "Beta" }, customHelpers);
        const renamed = renameNode(inserted, "beta", "gamma", customHelpers);

        expect(findNodeById(renamed, "gamma", customHelpers)?.label).toBe("Beta");
        expect(findNodeById(renamed, "beta", customHelpers)).toBeUndefined();
    });

    it("keeps a composed structural migration idempotent when reapplied", () => {
        const migrate = (value: LayoutNode) =>
            dedupeChildrenBy(
                renameNode(
                    insertChildIfMissing(value, "sidebar", { id: "search", title: "Search" }),
                    "prefs",
                    "preferences",
                ),
                (node) => node.id,
            );

        const once = migrate(tree);
        const twice = migrate(once);

        expect(twice).toEqual(once);
        expect(findNodeById(once, "search")?.title).toBe("Search");
        expect(findNodeById(once, "preferences")?.title).toBe("Preferences");
        expect(findNodeById(once, "sidebar")?.children?.map((node) => node.id)).toEqual([
            "inbox",
            "preferences",
            "search",
        ]);
    });
});
