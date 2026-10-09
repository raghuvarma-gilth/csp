/**
 * Binary search tree.
 *
 * The tree persists in the lab context between operations, so a student can
 * insert, then delete, then check the invariant still holds on the same tree.
 * Nothing here is module-level, so two mounted labs never share a tree.
 */

import { emptyTreeFrame, layoutTree, mark, markAll, treeFrame, type LayoutTreeNode } from "../frames";
import { C, type Hex, type LabContext, type NodeId, type TreeFrame } from "../types";

export interface BstNode {
  id: number;
  value: number;
  left: BstNode | null;
  right: BstNode | null;
}

interface BstState {
  root: BstNode | null;
  nextId: number;
}

const state = (ctx: LabContext): BstState => {
  if (!ctx.bst) ctx.bst = { root: null, nextId: 0 } satisfies BstState;
  return ctx.bst as BstState;
};

const newNode = (s: BstState, value: number): BstNode => {
  const node: BstNode = { id: s.nextId, value, left: null, right: null };
  s.nextId += 1;
  return node;
};

/** Raw insert, no frames — used when seeding a tree from the values field. */
const rawInsert = (s: BstState, value: number): void => {
  const node = newNode(s, value);
  if (!s.root) {
    s.root = node;
    return;
  }
  let current = s.root;
  for (;;) {
    if (value < current.value) {
      if (!current.left) {
        current.left = node;
        return;
      }
      current = current.left;
    } else if (value > current.value) {
      if (!current.right) {
        current.right = node;
        return;
      }
      current = current.right;
    } else {
      // A BST holds a set; a duplicate is simply not stored.
      s.nextId -= 1;
      return;
    }
  }
};

/**
 * Every operation but `build` needs a tree to work on. Rather than showing an
 * empty scene and a "insert something first" message, seed the tree from the
 * values field the student already filled in.
 */
const ensureTree = (ctx: LabContext, values: number[]): BstState => {
  const s = state(ctx);
  if (!s.root && values.length) values.forEach((v) => rawInsert(s, v));
  return s;
};

interface Decoration {
  badges?: Record<NodeId, string>;
  subLabels?: Record<NodeId, string>;
  ghosts?: ReadonlySet<NodeId>;
}

const decorate = (node: BstNode | null, d?: Decoration): LayoutTreeNode | null => {
  if (!node) return null;
  return {
    id: node.id,
    value: node.value,
    left: decorate(node.left, d),
    right: decorate(node.right, d),
    badge: d?.badges?.[node.id],
    subLabel: d?.subLabels?.[node.id],
    ghost: d?.ghosts?.has(node.id),
  };
};

const snap = (
  root: BstNode | null,
  highlights: Record<NodeId, Hex>,
  description: string,
  codeLine: number,
  d?: Decoration,
): TreeFrame => treeFrame(layoutTree(decorate(root, d)), highlights, description, codeLine);

const inorderValues = (node: BstNode | null, out: BstNode[] = []): BstNode[] => {
  if (!node) return out;
  inorderValues(node.left, out);
  out.push(node);
  inorderValues(node.right, out);
  return out;
};

const heightOf = (node: BstNode | null): number =>
  node ? 1 + Math.max(heightOf(node.left), heightOf(node.right)) : 0;

/* -------------------------------------------------------------------------- */
/* Operations                                                                  */
/* -------------------------------------------------------------------------- */

/** Insert every value in the input, showing the comparisons that place each one. */
export function bstBuildFrames(values: number[], ctx: LabContext): TreeFrame[] {
  const s = state(ctx);
  s.root = null;
  s.nextId = 0;
  if (!values.length) return [emptyTreeFrame("Type some values to build a tree from")];

  const frames: TreeFrame[] = [
    emptyTreeFrame("Build a BST by inserting each value in the order given — the order decides the shape"),
  ];
  values.forEach((value) => {
    const path: NodeId[] = [];
    const node = newNode(s, value);
    if (!s.root) {
      s.root = node;
      frames.push(snap(s.root, mark(node.id, C.done), `${value} becomes the root`, 0));
      return;
    }
    let current: BstNode = s.root;
    let attachedTo = current;
    let side: "left" | "right" = "left";
    for (;;) {
      path.push(current.id);
      frames.push(
        snap(s.root, { ...markAll(path.slice(0, -1), C.faded), [current.id]: C.inspect }, `Compare ${value} with ${current.value}`, 1),
      );
      if (value < current.value) {
        if (!current.left) {
          current.left = node;
          attachedTo = current;
          side = "left";
          break;
        }
        current = current.left;
      } else if (value > current.value) {
        if (!current.right) {
          current.right = node;
          attachedTo = current;
          side = "right";
          break;
        }
        current = current.right;
      } else {
        s.nextId -= 1;
        frames.push(snap(s.root, mark(current.id, C.remove), `${value} is already in the tree — a BST holds a set, so nothing is added`, 3));
        return;
      }
    }
    frames.push(
      snap(s.root, mark(node.id, C.done), `${value} ${side === "left" ? "<" : ">"} ${attachedTo.value}, and ${attachedTo.value} has no ${side} child — so ${value} becomes a new leaf there`, 2),
    );
  });

  const sortedCheck = inorderValues(s.root).map((n) => n.value);
  frames.push(
    snap(s.root, {}, `Tree built, height ${heightOf(s.root)}. Reading it in order gives ${sortedCheck.join(" < ")} — sorted, which is the whole point.`, 4),
  );
  return frames;
}

export function bstInsertFrames(values: number[], value: number, ctx: LabContext): TreeFrame[] {
  const s = ensureTree(ctx, values);
  const node = newNode(s, value);
  if (!s.root) {
    s.root = node;
    return [snap(s.root, mark(node.id, C.done), `The tree was empty — ${value} becomes the root`, 0)];
  }
  const frames: TreeFrame[] = [snap(s.root, {}, `Insert ${value}, starting at the root`, 0)];
  const path: NodeId[] = [];
  let current: BstNode = s.root;
  for (;;) {
    path.push(current.id);
    frames.push(
      snap(s.root, { ...markAll(path.slice(0, -1), C.faded), [current.id]: C.inspect }, `${value} vs ${current.value} — go ${value < current.value ? "left" : value > current.value ? "right" : "nowhere"}`, 1),
    );
    if (value < current.value) {
      if (!current.left) {
        current.left = node;
        break;
      }
      current = current.left;
    } else if (value > current.value) {
      if (!current.right) {
        current.right = node;
        break;
      }
      current = current.right;
    } else {
      s.nextId -= 1;
      frames.push(snap(s.root, mark(current.id, C.remove), `${value} is already present — nothing to do`, 3));
      return frames;
    }
  }
  frames.push(
    snap(s.root, mark(node.id, C.done), `Inserted as a leaf after ${path.length} comparison(s) — O(h), where h is the height`, 2),
  );
  return frames;
}

export function bstSearchFrames(values: number[], target: number, ctx: LabContext): TreeFrame[] {
  const s = ensureTree(ctx, values);
  if (!s.root) return [emptyTreeFrame("The tree is empty")];
  const frames: TreeFrame[] = [snap(s.root, {}, `Search for ${target}`, 0)];
  const path: NodeId[] = [];
  let current: BstNode | null = s.root;
  while (current) {
    path.push(current.id);
    frames.push(
      snap(s.root, { ...markAll(path.slice(0, -1), C.faded), [current.id]: C.inspect }, `At ${current.value}`, 1),
    );
    if (target === current.value) {
      frames.push(
        snap(s.root, mark(current.id, C.done), `Found ${target} in ${path.length} comparison(s) — every step discarded a whole subtree`, 2),
      );
      return frames;
    }
    const goLeft = target < current.value;
    const discarded = goLeft ? current.right : current.left;
    const discardedIds = inorderValues(discarded).map((n) => n.id);
    frames.push(
      snap(
        s.root,
        { ...markAll(discardedIds, C.faded), [current.id]: C.inspect },
        `${target} ${goLeft ? "<" : ">"} ${current.value} — the ${goLeft ? "right" : "left"} subtree cannot contain it, so ignore ${discardedIds.length} node(s)`,
        goLeft ? 3 : 4,
      ),
    );
    current = goLeft ? current.left : current.right;
  }
  frames.push(snap(s.root, markAll(path, C.remove), `Ran out of tree — ${target} is not present`, 5));
  return frames;
}

/**
 * Delete, with all three cases. The two-child case is the one worth watching:
 * the node's value is replaced by its in-order successor, because that is the
 * only value that can sit there without breaking the ordering.
 */
export function bstDeleteFrames(values: number[], value: number, ctx: LabContext): TreeFrame[] {
  const s = ensureTree(ctx, values);
  if (!s.root) return [emptyTreeFrame("The tree is empty")];
  const frames: TreeFrame[] = [snap(s.root, {}, `Delete ${value}`, 0)];

  // Find the node and its parent.
  let parent: BstNode | null = null;
  let current: BstNode | null = s.root;
  while (current && current.value !== value) {
    frames.push(snap(s.root, mark(current.id, C.inspect), `${value} vs ${current.value} — go ${value < current.value ? "left" : "right"}`, 1));
    parent = current;
    current = value < current.value ? current.left : current.right;
  }
  if (!current) {
    frames.push(snap(s.root, {}, `${value} is not in the tree, so there is nothing to delete`, 6));
    return frames;
  }
  const doomed = current;
  frames.push(snap(s.root, mark(doomed.id, C.remove), `Found ${value}. It has ${(doomed.left ? 1 : 0) + (doomed.right ? 1 : 0)} child(ren).`, 2));

  const replaceInParent = (replacement: BstNode | null) => {
    if (!parent) s.root = replacement;
    else if (parent.left === doomed) parent.left = replacement;
    else parent.right = replacement;
  };

  if (!doomed.left && !doomed.right) {
    replaceInParent(null);
    frames.push(snap(s.root, {}, "Case 1 — a leaf. Detach it and the tree is still valid.", 3));
  } else if (!doomed.left || !doomed.right) {
    const child = doomed.left ?? doomed.right;
    frames.push(snap(s.root, { [doomed.id]: C.remove, [(child as BstNode).id]: C.move }, "Case 2 — one child. Everything below it is already on the correct side, so promote it.", 4));
    replaceInParent(child);
    frames.push(snap(s.root, mark((child as BstNode).id, C.done), `${(child as BstNode).value} takes the deleted node's place`, 4));
  } else {
    // Two children: in-order successor is the leftmost node of the right subtree.
    let succParent = doomed;
    let succ = doomed.right as BstNode;
    frames.push(snap(s.root, { [doomed.id]: C.remove, [succ.id]: C.inspect }, "Case 3 — two children. Walk to the smallest value in the right subtree.", 5));
    while (succ.left) {
      succParent = succ;
      succ = succ.left;
      frames.push(snap(s.root, { [doomed.id]: C.remove, [succ.id]: C.inspect }, `Keep going left: ${succ.value}`, 5));
    }
    frames.push(
      snap(s.root, { [doomed.id]: C.remove, [succ.id]: C.done }, `${succ.value} is the in-order successor — the only value that can replace ${value} without breaking the ordering`, 5),
    );
    doomed.value = succ.value;
    if (succParent === doomed) succParent.right = succ.right;
    else succParent.left = succ.right;
    frames.push(snap(s.root, mark(doomed.id, C.done), `Copy ${succ.value} up, then delete the successor from where it was (it had at most one child)`, 5));
  }

  const inorder = inorderValues(s.root).map((n) => n.value);
  frames.push(snap(s.root, {}, `Done. In-order: ${inorder.join(" < ") || "empty"} — still sorted, so the BST property survived.`, 7));
  return frames;
}

export function bstInorderFrames(values: number[], ctx: LabContext): TreeFrame[] {
  const s = ensureTree(ctx, values);
  if (!s.root) return [emptyTreeFrame("The tree is empty")];
  const frames: TreeFrame[] = [snap(s.root, {}, "In-order traversal: left subtree, then the node, then the right subtree", 0)];
  const visited: NodeId[] = [];
  const emitted: number[] = [];

  const walk = (node: BstNode | null) => {
    if (!node) return;
    frames.push(snap(s.root, { ...markAll(visited, C.done), [node.id]: C.inspect }, `Descend into ${node.value}'s left subtree first`, 1));
    walk(node.left);
    visited.push(node.id);
    emitted.push(node.value);
    frames.push(snap(s.root, markAll(visited, C.done), `Visit ${node.value} → [${emitted.join(", ")}]`, 2));
    walk(node.right);
  };

  walk(s.root);
  frames.push(snap(s.root, markAll(visited, C.done), `In-order gives ${emitted.join(", ")} — ascending, for free`, 3));
  return frames;
}

export function bstMinMaxFrames(values: number[], ctx: LabContext): TreeFrame[] {
  const s = ensureTree(ctx, values);
  if (!s.root) return [emptyTreeFrame("The tree is empty")];
  const frames: TreeFrame[] = [snap(s.root, {}, "The smallest value is the leftmost node; the largest is the rightmost", 0)];

  const leftPath: NodeId[] = [];
  let node: BstNode = s.root;
  while (node.left) {
    leftPath.push(node.id);
    node = node.left;
    frames.push(snap(s.root, { ...markAll(leftPath, C.faded), [node.id]: C.inspect }, `Go left: ${node.value}`, 1));
  }
  const min = node;
  frames.push(snap(s.root, mark(min.id, C.done), `No left child — minimum is ${min.value}`, 2));

  const rightPath: NodeId[] = [];
  node = s.root;
  while (node.right) {
    rightPath.push(node.id);
    node = node.right;
    frames.push(snap(s.root, { ...markAll(rightPath, C.faded), [min.id]: C.done, [node.id]: C.inspect }, `Go right: ${node.value}`, 3));
  }
  frames.push(
    snap(s.root, { [min.id]: C.done, [node.id]: C.done }, `Maximum is ${node.value}. Both cost O(h), not O(n).`, 4),
  );
  return frames;
}

/** The in-order successor of a value: the next-largest key in the tree. */
export function bstSuccessorFrames(values: number[], value: number, ctx: LabContext): TreeFrame[] {
  const s = ensureTree(ctx, values);
  if (!s.root) return [emptyTreeFrame("The tree is empty")];
  const frames: TreeFrame[] = [snap(s.root, {}, `Find the next value after ${value}`, 0)];

  let target: BstNode | null = s.root;
  while (target && target.value !== value) {
    target = value < target.value ? target.left : target.right;
  }
  if (!target) {
    frames.push(snap(s.root, {}, `${value} is not in the tree`, 5));
    return frames;
  }
  frames.push(snap(s.root, mark(target.id, C.inspect), `Found ${value}`, 1));

  if (target.right) {
    let node = target.right;
    frames.push(snap(s.root, { [target.id]: C.inspect, [node.id]: C.cursor }, "It has a right subtree, so the successor is the smallest value in it", 2));
    while (node.left) {
      node = node.left;
      frames.push(snap(s.root, { [target.id]: C.inspect, [node.id]: C.cursor }, `Go left: ${node.value}`, 2));
    }
    frames.push(snap(s.root, mark(node.id, C.done), `Successor of ${value} is ${node.value}`, 3));
    return frames;
  }

  frames.push(snap(s.root, mark(target.id, C.inspect), "No right subtree — the successor is the lowest ancestor we turned left at on the way down", 4));
  let successor: BstNode | null = null;
  let current: BstNode | null = s.root;
  while (current && current.value !== value) {
    if (value < current.value) {
      successor = current;
      frames.push(snap(s.root, { [target.id]: C.inspect, [current.id]: C.cursor }, `Turned left at ${current.value} — remember it as a candidate`, 4));
      current = current.left;
    } else {
      frames.push(snap(s.root, { [target.id]: C.inspect, [current.id]: C.faded }, `Turned right at ${current.value} — it is smaller, so not a candidate`, 4));
      current = current.right;
    }
  }
  frames.push(
    successor
      ? snap(s.root, mark(successor.id, C.done), `Successor of ${value} is ${successor.value}`, 3)
      : snap(s.root, mark(target.id, C.remove), `${value} is the largest value in the tree — it has no successor`, 3),
  );
  return frames;
}

/**
 * Validate. The trap this operation exists to show: checking only
 * `left.value < node.value < right.value` at each node is *not* enough — a node
 * deep in the left subtree can still be too large. The bounds have to be carried
 * down.
 */
export function bstValidateFrames(values: number[], ctx: LabContext): TreeFrame[] {
  const s = ensureTree(ctx, values);
  if (!s.root) return [emptyTreeFrame("The tree is empty — vacuously a valid BST")];

  const frames: TreeFrame[] = [
    snap(s.root, {}, "Validate by carrying a permitted range down the tree, not by comparing neighbours", 0),
  ];
  const good: NodeId[] = [];
  let failure: { node: BstNode; reason: string } | null = null;

  const check = (node: BstNode | null, low: number, high: number): boolean => {
    if (!node || failure) return true;
    const bounds = `${low === -Infinity ? "−∞" : low} < value < ${high === Infinity ? "+∞" : high}`;
    frames.push(
      snap(s.root, { ...markAll(good, C.done), [node.id]: C.inspect }, `${node.value} must satisfy ${bounds}`, 1, {
        badges: { [node.id]: bounds },
      }),
    );
    if (node.value <= low || node.value >= high) {
      failure = { node, reason: `${node.value} breaks the range ${bounds}` };
      return false;
    }
    good.push(node.id);
    return check(node.left, low, node.value) && check(node.right, node.value, high);
  };

  const valid = check(s.root, -Infinity, Infinity);
  const failed = failure as { node: BstNode; reason: string } | null;
  frames.push(
    valid || !failed
      ? snap(s.root, markAll(good, C.done), "Every node fell inside the range inherited from its ancestors — this is a valid BST", 2)
      : snap(s.root, { ...markAll(good, C.done), [failed.node.id]: C.remove }, `Not a valid BST: ${failed.reason}`, 3),
  );
  return frames;
}

/** Lowest common ancestor. In a BST the ordering alone tells you where to turn. */
export function bstLcaFrames(values: number[], a: number, b: number, ctx: LabContext): TreeFrame[] {
  const s = ensureTree(ctx, values);
  if (!s.root) return [emptyTreeFrame("The tree is empty")];
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  const frames: TreeFrame[] = [snap(s.root, {}, `Lowest common ancestor of ${low} and ${high}`, 0)];

  let current: BstNode | null = s.root;
  while (current) {
    if (high < current.value) {
      frames.push(snap(s.root, mark(current.id, C.inspect), `Both ${low} and ${high} are below ${current.value} — the answer is in the left subtree`, 1));
      current = current.left;
    } else if (low > current.value) {
      frames.push(snap(s.root, mark(current.id, C.inspect), `Both are above ${current.value} — go right`, 2));
      current = current.right;
    } else {
      frames.push(
        snap(s.root, mark(current.id, C.done), `${low} ≤ ${current.value} ≤ ${high}, so the paths to them split here — ${current.value} is the LCA`, 3),
      );
      return frames;
    }
  }
  frames.push(snap(s.root, {}, "The walk left the tree, so at least one of those values is not present", 4));
  return frames;
}

/** Height, and the reason an unbalanced BST degrades to a linked list. */
export function bstHeightFrames(values: number[], ctx: LabContext): TreeFrame[] {
  const s = ensureTree(ctx, values);
  if (!s.root) return [emptyTreeFrame("The tree is empty — height 0")];
  const frames: TreeFrame[] = [snap(s.root, {}, "Height is computed bottom-up: 1 + the taller of the two children", 0)];
  const badges: Record<NodeId, string> = {};
  const done: NodeId[] = [];

  const walk = (node: BstNode | null): number => {
    if (!node) return 0;
    const lh = walk(node.left);
    const rh = walk(node.right);
    const h = 1 + Math.max(lh, rh);
    badges[node.id] = `h=${h}`;
    done.push(node.id);
    frames.push(
      snap(s.root, { ...markAll(done.slice(0, -1), C.done), [node.id]: C.inspect }, `${node.value}: 1 + max(${lh}, ${rh}) = ${h}`, 1, { badges: { ...badges } }),
    );
    return h;
  };

  const h = walk(s.root);
  const n = inorderValues(s.root).length;
  const ideal = Math.ceil(Math.log2(n + 1));
  frames.push(
    snap(s.root, markAll(done, C.done), `Height ${h} for ${n} node(s). A perfectly balanced tree would be ${ideal} — every extra level is one more comparison on every search. That gap is what AVL trees exist to close.`, 2, {
      badges,
    }),
  );
  return frames;
}
