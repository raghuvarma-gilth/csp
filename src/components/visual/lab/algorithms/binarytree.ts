/**
 * Binary tree (no ordering rule).
 *
 * Built level-order from the values, so index `i`'s children are `2i+1` and
 * `2i+2` — the same array-as-tree reading the heap module uses. Nothing here is
 * stored in the lab context: a level-order build is deterministic, so every
 * operation rebuilds the same tree from the input and there is no hidden state.
 */

import { emptyTreeFrame, layoutTree, mark, markAll, treeFrame, type LayoutTreeNode } from "../frames";
import { C, type Hex, type NodeId, type TreeFrame } from "../types";

interface BinNode {
  id: number;
  value: number;
  left: BinNode | null;
  right: BinNode | null;
}

/** Level-order build: values fill the tree row by row, left to right. */
const buildLevelOrder = (values: readonly number[]): BinNode | null => {
  if (!values.length) return null;
  const nodes = values.map((value, id) => ({ id, value, left: null, right: null }) as BinNode);
  nodes.forEach((node, i) => {
    node.left = nodes[2 * i + 1] ?? null;
    node.right = nodes[2 * i + 2] ?? null;
  });
  return nodes[0];
};

interface Decoration {
  badges?: Record<NodeId, string>;
  subLabels?: Record<NodeId, string>;
}

const decorate = (node: BinNode | null, d?: Decoration): LayoutTreeNode | null =>
  node
    ? {
        id: node.id,
        value: node.value,
        left: decorate(node.left, d),
        right: decorate(node.right, d),
        badge: d?.badges?.[node.id] ?? `[${node.id}]`,
        subLabel: d?.subLabels?.[node.id],
      }
    : null;

const snap = (
  root: BinNode | null,
  highlights: Record<NodeId, Hex>,
  description: string,
  codeLine: number,
  d?: Decoration,
): TreeFrame => treeFrame(layoutTree(decorate(root, d)), highlights, description, codeLine);

const EMPTY = "Type some values — they fill the tree level by level";

/* -------------------------------------------------------------------------- */
/* Operations                                                                  */
/* -------------------------------------------------------------------------- */

/** Build the tree one node at a time, so the index arithmetic is visible. */
export function binaryBuildFrames(values: number[]): TreeFrame[] {
  if (!values.length) return [emptyTreeFrame(EMPTY)];
  const frames: TreeFrame[] = [
    emptyTreeFrame("A binary tree has no ordering rule — a node just has up to two children. Fill it level by level."),
  ];
  for (let n = 1; n <= values.length; n += 1) {
    const root = buildLevelOrder(values.slice(0, n));
    const i = n - 1;
    frames.push(
      snap(
        root,
        mark(i, C.done),
        i === 0
          ? `${values[0]} is the root, index 0`
          : `${values[i]} goes at index ${i}, which makes it the ${i % 2 === 1 ? "left" : "right"} child of index ${Math.floor((i - 1) / 2)} (value ${values[Math.floor((i - 1) / 2)]})`,
        i === 0 ? 0 : 1,
      ),
    );
  }
  const root = buildLevelOrder(values);
  const height = (() => {
    const h = (node: BinNode | null): number => (node ? 1 + Math.max(h(node.left), h(node.right)) : 0);
    return h(root);
  })();
  frames.push(
    snap(root, {}, `${values.length} node(s), height ${height}. Index i's children are always 2i+1 and 2i+2 — which is why a complete tree needs no pointers at all.`, 2),
  );
  return frames;
}

type Order = "pre" | "in" | "post";

const ORDER_TEXT: Record<Order, { name: string; shape: string; use: string }> = {
  pre: {
    name: "Pre-order",
    shape: "node, then left subtree, then right subtree",
    use: "Visiting the node first is what lets you copy a tree or write it out to a file — the root arrives before anything that hangs off it.",
  },
  in: {
    name: "In-order",
    shape: "left subtree, then node, then right subtree",
    use: "On a binary *search* tree this comes out sorted. On an unordered tree like this one it does not — the ordering came from the BST rule, not from the traversal.",
  },
  post: {
    name: "Post-order",
    shape: "left subtree, then right subtree, then node",
    use: "Both children are finished before the node is, which is exactly what you need to free a tree, or to compute anything that depends on its children — like height.",
  },
};

const traversalFrames = (values: number[], order: Order): TreeFrame[] => {
  const root = buildLevelOrder(values);
  if (!root) return [emptyTreeFrame(EMPTY)];
  const meta = ORDER_TEXT[order];
  const frames: TreeFrame[] = [snap(root, {}, `${meta.name}: ${meta.shape}`, 0)];
  const visited: NodeId[] = [];
  const emitted: number[] = [];

  const visit = (node: BinNode) => {
    visited.push(node.id);
    emitted.push(node.value);
    frames.push(snap(root, markAll(visited, C.done), `Visit ${node.value} → [${emitted.join(", ")}]`, 2));
  };

  const walk = (node: BinNode | null) => {
    if (!node) return;
    frames.push(snap(root, { ...markAll(visited, C.done), [node.id]: C.inspect }, `Enter ${node.value}`, 1));
    if (order === "pre") visit(node);
    walk(node.left);
    if (order === "in") visit(node);
    walk(node.right);
    if (order === "post") visit(node);
  };

  walk(root);
  frames.push(snap(root, markAll(visited, C.done), `${meta.name}: ${emitted.join(", ")}. ${meta.use}`, 3));
  return frames;
};

export const binaryPreorderFrames = (values: number[]): TreeFrame[] => traversalFrames(values, "pre");
export const binaryInorderFrames = (values: number[]): TreeFrame[] => traversalFrames(values, "in");
export const binaryPostorderFrames = (values: number[]): TreeFrame[] => traversalFrames(values, "post");

/** Level-order traversal — the only one of the four that needs a queue, not recursion. */
export function binaryLevelOrderFrames(values: number[]): TreeFrame[] {
  const root = buildLevelOrder(values);
  if (!root) return [emptyTreeFrame(EMPTY)];
  const frames: TreeFrame[] = [
    snap(root, {}, "Level-order: visit every node at depth 0, then every node at depth 1, and so on. This is the one traversal that needs a queue rather than recursion.", 0),
  ];
  const visited: NodeId[] = [];
  const emitted: number[] = [];
  const badges: Record<NodeId, string> = {};
  let queue: Array<{ node: BinNode; depth: number }> = [{ node: root, depth: 0 }];
  let lastDepth = -1;

  while (queue.length) {
    const { node, depth } = queue.shift() as { node: BinNode; depth: number };
    if (depth !== lastDepth) {
      lastDepth = depth;
      frames.push(snap(root, markAll(visited, C.done), `Starting depth ${depth}`, 1, { badges: { ...badges } }));
    }
    visited.push(node.id);
    emitted.push(node.value);
    badges[node.id] = `d=${depth}`;
    const children = [node.left, node.right].filter(Boolean) as BinNode[];
    children.forEach((c) => queue.push({ node: c, depth: depth + 1 }));
    frames.push(
      snap(root, { ...markAll(visited.slice(0, -1), C.done), [node.id]: C.inspect }, `Dequeue ${node.value}; enqueue its ${children.length} child(ren). Queue: [${queue.map((q) => q.node.value).join(", ")}]`, 2, {
        badges: { ...badges },
      }),
    );
  }
  queue = [];
  frames.push(snap(root, markAll(visited, C.done), `Level order: ${emitted.join(", ")}. Reading it back this way rebuilds the tree exactly, which is why it is the format this lab builds from.`, 3, { badges }));
  return frames;
}

/**
 * Diameter — the longest path between any two nodes, which need not pass through
 * the root. Computed in one post-order pass: at each node, the best path *through*
 * it is `leftHeight + rightHeight`, and the value returned upward is its height.
 */
export function binaryDiameterFrames(values: number[]): TreeFrame[] {
  const root = buildLevelOrder(values);
  if (!root) return [emptyTreeFrame(EMPTY)];
  const frames: TreeFrame[] = [
    snap(root, {}, "The diameter is the longest path between any two nodes — it does not have to pass through the root. One post-order pass finds it.", 0),
  ];
  const badges: Record<NodeId, string> = {};
  const done: NodeId[] = [];
  let best = 0;
  let bestAt: BinNode | null = null;

  const walk = (node: BinNode | null): number => {
    if (!node) return 0;
    const lh = walk(node.left);
    const rh = walk(node.right);
    const through = lh + rh;
    if (through > best) {
      best = through;
      bestAt = node;
    }
    const h = 1 + Math.max(lh, rh);
    badges[node.id] = `h=${h}`;
    done.push(node.id);
    frames.push(
      snap(root, { ...markAll(done.slice(0, -1), C.done), [node.id]: C.inspect }, `${node.value}: a path through it spans ${lh} + ${rh} = ${through} edge(s); its own height is ${h}`, 1, {
        badges: { ...badges },
      }),
    );
    return h;
  };

  walk(root);
  const peak = bestAt as BinNode | null;
  frames.push(
    peak
      ? snap(root, { ...markAll(done, C.done), [peak.id]: C.window }, `Diameter ${best} edge(s), through ${peak.value}. Every node was visited once, so this is O(n) — computing height separately at each node would have been O(n²).`, 2, { badges })
      : snap(root, markAll(done, C.done), `Diameter ${best}`, 2, { badges }),
  );
  return frames;
}
