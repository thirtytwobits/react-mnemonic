// SPDX-License-Identifier: MIT
// Copyright Scott Dixon

/**
 * Adapter functions for structural migration helpers.
 *
 * These helpers assume tree-like data, but not a specific node shape. Supply a
 * `StructuralTreeHelpers<T>` when your nodes use custom field names. When your
 * nodes already look like `{ id, children }`, the exported helpers work without
 * any adapter configuration.
 *
 * @template T - Tree node type
 */
export interface StructuralTreeHelpers<T> {
    /**
     * Returns the stable identifier for a node.
     */
    getId: (node: T) => string;

    /**
     * Returns the node's child list, or `undefined` when it has no children.
     */
    getChildren: (node: T) => readonly T[] | undefined;

    /**
     * Returns a copy of the node with a new child list.
     */
    withChildren: (node: T, children: T[]) => T;

    /**
     * Returns a copy of the node with a new identifier.
     */
    withId: (node: T, id: string) => T;
}

type DefaultStructuralNode<T> = {
    id: string;
    children?: T[];
};

function resolveHelpers<T>(helpers?: StructuralTreeHelpers<T>): StructuralTreeHelpers<T> {
    if (helpers) return helpers;
    return {
        getId: (node: T) => (node as DefaultStructuralNode<T>).id,
        getChildren: (node: T) => (node as DefaultStructuralNode<T>).children,
        withChildren: (node: T, children: T[]) => ({ ...(node as object), children }) as T,
        withId: (node: T, id: string) => ({ ...(node as object), id }) as T,
    };
}

/**
 * Finds the first node with the requested id using depth-first traversal.
 *
 * @template T - Tree node type
 * @param root - Root node to search
 * @param id - Target node id
 * @param helpers - Optional adapter for custom node shapes
 * @returns The matching node, or `undefined`
 */
export function findNodeById<T>(root: T, id: string, helpers?: StructuralTreeHelpers<T>): T | undefined {
    const tree = resolveHelpers(helpers);
    if (tree.getId(root) === id) return root;
    for (const child of tree.getChildren(root) ?? []) {
        const match = findNodeById(child, id, tree);
        if (match) return match;
    }
    return undefined;
}

/**
 * Inserts a child under the target parent when no existing child shares the
 * same id. Returns the original tree when the parent is missing or the child is
 * already present.
 *
 * @template T - Tree node type
 * @param root - Root node to update
 * @param parentId - Parent node that should receive the child
 * @param child - Child node to append
 * @param helpers - Optional adapter for custom node shapes
 * @returns Updated tree with the child inserted once
 */
export function insertChildIfMissing<T>(root: T, parentId: string, child: T, helpers?: StructuralTreeHelpers<T>): T {
    const tree = resolveHelpers(helpers);
    const childId = tree.getId(child);

    const visit = (node: T): [T, boolean] => {
        if (tree.getId(node) === parentId) {
            const children = [...(tree.getChildren(node) ?? [])];
            if (children.some((existing) => tree.getId(existing) === childId)) {
                return [node, false];
            }
            return [tree.withChildren(node, [...children, child]), true];
        }

        const children = tree.getChildren(node);
        if (!children?.length) return [node, false];

        let inserted = false;
        let changed = false;
        const nextChildren = children.map((existingChild) => {
            if (inserted) return existingChild;
            const [nextChild, didInsert] = visit(existingChild);
            inserted ||= didInsert;
            changed ||= nextChild !== existingChild;
            return nextChild;
        });

        if (!changed) return [node, inserted];
        return [tree.withChildren(node, nextChildren), inserted];
    };

    return visit(root)[0];
}

/**
 * Renames every node with the source id while preserving tree structure.
 * Returns the original tree when the source id is missing or the target id
 * already exists elsewhere.
 *
 * @template T - Tree node type
 * @param root - Root node to update
 * @param currentId - Existing id to rename
 * @param nextId - Replacement id
 * @param helpers - Optional adapter for custom node shapes
 * @returns Updated tree with matching node ids renamed
 */
export function renameNode<T>(root: T, currentId: string, nextId: string, helpers?: StructuralTreeHelpers<T>): T {
    const tree = resolveHelpers(helpers);
    if (currentId === nextId) return root;
    if (!findNodeById(root, currentId, tree)) return root;
    if (findNodeById(root, nextId, tree)) return root;

    const visit = (node: T): T => {
        let nextNode = tree.getId(node) === currentId ? tree.withId(node, nextId) : node;
        const children = tree.getChildren(nextNode);
        if (!children?.length) return nextNode;

        let changed = nextNode !== node;
        const nextChildren = children.map((child) => {
            const nextChild = visit(child);
            changed ||= nextChild !== child;
            return nextChild;
        });

        if (!changed) return node;
        return tree.withChildren(nextNode, nextChildren);
    };

    return visit(root);
}

/**
 * Deduplicates each node's immediate children while preserving the first child
 * encountered for each key. The helper traverses the full tree and returns the
 * original root when no duplicates are removed.
 *
 * @template T - Tree node type
 * @template K - Deduplication key type
 * @param root - Root node to normalize
 * @param getKey - Function that computes a dedupe key for each child
 * @param helpers - Optional adapter for custom node shapes
 * @returns Updated tree with duplicate siblings removed
 */
export function dedupeChildrenBy<T, K>(root: T, getKey: (node: T) => K, helpers?: StructuralTreeHelpers<T>): T {
    const tree = resolveHelpers(helpers);

    const visit = (node: T): T => {
        const children = tree.getChildren(node);
        if (!children?.length) return node;

        let changed = false;
        const seen = new Set<K>();
        const nextChildren: T[] = [];

        for (const child of children) {
            const normalizedChild = visit(child);
            changed ||= normalizedChild !== child;

            const key = getKey(normalizedChild);
            if (seen.has(key)) {
                changed = true;
                continue;
            }

            seen.add(key);
            nextChildren.push(normalizedChild);
        }

        if (!changed && nextChildren.length === children.length) return node;
        return tree.withChildren(node, nextChildren);
    };

    return visit(root);
}
