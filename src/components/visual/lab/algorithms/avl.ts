/**
 * AVL tree — a BST that refuses to get tall.
 *
 * The point of this module is the badge on every node: its **balance factor**,
 * `height(left) − height(right)`. As long as every badge stays in {−1, 0, +1} the
 * height is O(log n) and search stays fast. The moment one reaches ±2, a rotation
 * puts it back. Parent pointers are kept so the tree is coherent at every single
 * frame, mid-rotation included.
 */

import { emptyTreeFrame, layoutTree, mark, markAll, treeFrame, type LayoutTreeNode } from "../frames";
import { C, type Hex, type LabContext, type NodeId, type TreeFrame } from "../types";

interface AvlNode {
  id: number;
  value: number;
  left: AvlNode | null;
  right: AvlNode | null;
  parent: AvlNode | null;
  height: number;
}

interface AvlState {
  root: AvlNode | null;
  nextId: number;
}

const state = (ctx: LabContext): AvlState => {
  if (!ctx.avl) ctx.avl = { root: null, nextId: 0 } satisfies AvlState;
  return ctx.avl as AvlState;
};

const h = (node: AvlNode | null): number => (node ? node.height : 0);
const balance = (node: AvlNode | null): number => (node ? h(node.left) - h(node.right) : 0);
const updateHeight = (node: AvlNode): void => {
  node.height = 1 + Math.max(h(node.left), h(node.right));
};

const setLeft = (parent: AvlNode, child: AvlNode | null): void => {
  parent.left = child;
  if (child) child.parent = parent;
};
const setRight = (parent: AvlNode, child: AvlNode | null): void => {
  parent.right = child;
  if (child) child.parent = parent;
};

/** Put `next` where `prev` used to hang off `parent` (or at the root). */
const attach = (s: AvlState, parent: AvlNode | null, prev: AvlNode, next: AvlNode | null): void => {
  if (!parent) {
    s.root = next;
    if (next) next.parent = null;
    return;
  }
  if (parent.left === prev) setLeft(parent, next);
  else setRight(parent, next);
};

const rotateRight = (s: AvlState, y: AvlNode): AvlNode => {
  const x = y.left as AvlNode;
  const p = y.parent;
  setLeft(y, x.right);
  setRight(x, y);
  attach(s, p, y, x);
  updateHeight(y);
  updateHeight(x);
  return x;
};

const rotateLeft = (s: AvlState, x: AvlNode): AvlNode => {
  const y = x.right as AvlNode;
  const p = x.parent;
  setRight(x, y.left);
  setLeft(y, x);
  attach(s, p, x, y);
  updateHeight(x);
  updateHeight(y);
  return y;
};

const allNodes = (node: AvlNode | null, out: AvlNode[] = []): AvlNode[] => {
  if (!node) return out;
  allNodes(node.left, out);
  out.push(node);
  allNodes(node.right, out);
  return out;
};

const factorBadges = (root: AvlNode | null): Record<NodeId, string> => {
  const out: Record<NodeId, string> = {};
  allNodes(root).forEach((n) => {
    const bf = balance(n);
    out[n.id] = bf > 0 ? `+${bf}` : String(bf);
  });
  return out;
};

/**
 * One frame, with every node's balance factor shown as a badge.
 *
 * `codeLine` indexes a pseudocode block that `modules/trees.ts` supplies, and
 * all three AVL operations share one numbering — because they all delegate the
 * repair to `rebalanceUp`, which can only emit one set of line numbers:
 *
 * | line | meaning                                                  |
 * |------|----------------------------------------------------------|
 * |  0   | the ordinary BST descent (and "v is not in the tree")    |
 * |  1   | the BST write itself: attach the leaf, or remove the node |
 * |  2   | walking back up, balance factor still in {−1, 0, +1}     |
 * |  3   | balance factor left the range — this subtree must rotate |
 * |  4   | left-right case                                          |
 * |  5   | left-left case / the right rotation                      |
 * |  6   | right-left case                                          |
 * |  7   | right-right case / the left rotation                     |
 * |  8   | the closing summary                                      |
 *
 * Keep the three pseudocode blocks nine lines long and in this order, or a step
 * will narrate a rotation while highlighting the wrong line — or no line at all.
 */
const snap = (
  s: AvlState,
  highlights: Record<NodeId, Hex>,
  description: string,
  codeLine: number,
): TreeFrame => {
  const badges = factorBadges(s.root);
  const decorate = (node: AvlNode | null): LayoutTreeNode | null =>
    node
      ? { id: node.id, value: node.value, left: decorate(node.left), right: decorate(node.right), badge: badges[node.id] }
      : null;
  return treeFrame(layoutTree(decorate(s.root)), highlights, description, codeLine);
};

/** The node whose balance factor first left {−1, 0, +1}, walking up from `from`. */
const rebalanceUp = (
  s: AvlState,
  from: AvlNode | null,
  frames: TreeFrame[],
  narrate: boolean,
): number => {
  let rotations = 0;
  let cur: AvlNode | null = from;
  let guard = 0;
  while (cur && guard < 10000) {
    guard += 1;
    updateHeight(cur);
    const bf = balance(cur);
    let next: AvlNode | null = cur.parent;

    if (bf > 1 || bf < -1) {
      const pivot = cur;
      if (narrate) {
        frames.push(snap(s, mark(pivot.id, C.remove), `${pivot.value} has balance factor ${bf > 0 ? `+${bf}` : bf} — outside {−1, 0, +1}, so this subtree must be rotated`, 3));
      }
      if (bf > 1) {
        const child = pivot.left as AvlNode;
        if (balance(child) < 0) {
          if (narrate) {
            frames.push(snap(s, { [pivot.id]: C.remove, [child.id]: C.inspect }, `Left-Right case: the heavy side is the left child's *right* subtree. A single rotation cannot fix that, so first rotate ${child.value} left.`, 4));
          }
          rotateLeft(s, child);
          rotations += 1;
          if (narrate) frames.push(snap(s, mark(pivot.id, C.remove), "Now the imbalance is a straight left-left line, which one rotation does fix", 4));
        } else if (narrate) {
          frames.push(snap(s, { [pivot.id]: C.remove, [child.id]: C.inspect }, `Left-Left case: a straight line down the left. One right rotation at ${pivot.value}.`, 5));
        }
        const newRoot = rotateRight(s, pivot);
        rotations += 1;
        next = newRoot.parent;
        if (narrate) frames.push(snap(s, mark(newRoot.id, C.done), `Rotated right: ${newRoot.value} is now the subtree root, ${pivot.value} became its right child`, 5));
      } else {
        const child = pivot.right as AvlNode;
        if (balance(child) > 0) {
          if (narrate) {
            frames.push(snap(s, { [pivot.id]: C.remove, [child.id]: C.inspect }, `Right-Left case: the heavy side is the right child's *left* subtree. Rotate ${child.value} right first.`, 6));
          }
          rotateRight(s, child);
          rotations += 1;
          if (narrate) frames.push(snap(s, mark(pivot.id, C.remove), "Now it is a straight right-right line", 6));
        } else if (narrate) {
          frames.push(snap(s, { [pivot.id]: C.remove, [child.id]: C.inspect }, `Right-Right case: a straight line down the right. One left rotation at ${pivot.value}.`, 7));
        }
        const newRoot = rotateLeft(s, pivot);
        rotations += 1;
        next = newRoot.parent;
        if (narrate) frames.push(snap(s, mark(newRoot.id, C.done), `Rotated left: ${newRoot.value} is now the subtree root`, 7));
      }
    } else if (narrate) {
      frames.push(snap(s, mark(cur.id, C.cursor), `${cur.value} has balance factor ${bf > 0 ? `+${bf}` : bf} — still fine, keep walking up`, 2));
    }
    cur = next;
  }
  return rotations;
};

/** Insert without frames; used by build and by the seeder. */
const rawInsert = (s: AvlState, value: number): AvlNode | null => {
  const node: AvlNode = { id: s.nextId, value, left: null, right: null, parent: null, height: 1 };
  s.nextId += 1;
  if (!s.root) {
    s.root = node;
    return node;
  }
  let cur = s.root;
  for (;;) {
    if (value < cur.value) {
      if (!cur.left) {
        setLeft(cur, node);
        return node;
      }
      cur = cur.left;
    } else if (value > cur.value) {
      if (!cur.right) {
        setRight(cur, node);
        return node;
      }
      cur = cur.right;
    } else {
      s.nextId -= 1;
      return null;
    }
  }
};

const ensureTree = (ctx: LabContext, values: number[]): AvlState => {
  const s = state(ctx);
  if (!s.root && values.length) {
    values.forEach((v) => {
      const node = rawInsert(s, v);
      if (node) rebalanceUp(s, node.parent, [], false);
    });
  }
  return s;
};

const idealHeight = (n: number): number => Math.ceil(Math.log2(n + 1));

/* -------------------------------------------------------------------------- */
/* Operations                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Build from the values. Worth running with an already-sorted input: a plain BST
 * would degrade into a linked list, and this one does not.
 */
export function avlBuildFrames(values: number[], ctx: LabContext): TreeFrame[] {
  const s = state(ctx);
  s.root = null;
  s.nextId = 0;
  if (!values.length) return [emptyTreeFrame("Type some values to build an AVL tree from")];

  const sortedInput = values.every((v, i) => i === 0 || values[i - 1] <= v);
  const frames: TreeFrame[] = [
    emptyTreeFrame(
      sortedInput
        ? "The input is already sorted — the worst possible case for a plain BST, which would build a straight line. Watch what the rotations do instead."
        : "Insert each value as in a BST, then rotate whenever a balance factor leaves {−1, 0, +1}.",
    ),
  ];
  let rotations = 0;

  values.forEach((value) => {
    const node = rawInsert(s, value);
    if (!node) {
      frames.push(snap(s, {}, `${value} is already present — an AVL tree holds a set`, 1));
      return;
    }
    frames.push(snap(s, mark(node.id, C.done), `Insert ${value} as a leaf`, 1));
    const before = rotations;
    rotations += rebalanceUp(s, node.parent, frames, true);
    if (rotations > before) {
      frames.push(snap(s, {}, `Height is back to ${h(s.root)} after ${rotations - before} rotation(s)`, 8));
    }
  });

  const n = allNodes(s.root).length;
  frames.push(
    snap(s, {}, `${n} node(s), height ${h(s.root)}, ${rotations} rotation(s) in total. A perfectly balanced tree of ${n} nodes has height ${idealHeight(n)} — AVL guarantees you stay within about 1.44× of that, forever.`, 8),
  );
  return frames;
}

/** A single insert, with the imbalance and its rotation spelled out. */
export function avlInsertFrames(values: number[], value: number, ctx: LabContext): TreeFrame[] {
  const s = ensureTree(ctx, values);
  if (!s.root) {
    const node = rawInsert(s, value);
    return node ? [snap(s, mark(node.id, C.done), `The tree was empty — ${value} becomes the root`, 1)] : [emptyTreeFrame("Nothing to insert")];
  }

  const frames: TreeFrame[] = [snap(s, {}, `Insert ${value}. Step one is an ordinary BST insert; step two is the repair.`, 0)];
  const path: NodeId[] = [];
  let cur: AvlNode | null = s.root;
  while (cur) {
    path.push(cur.id);
    frames.push(snap(s, { ...markAll(path.slice(0, -1), C.faded), [cur.id]: C.inspect }, `${value} vs ${cur.value} — go ${value < cur.value ? "left" : value > cur.value ? "right" : "nowhere"}`, 0));
    if (value === cur.value) {
      frames.push(snap(s, mark(cur.id, C.remove), `${value} is already present — nothing to do`, 0));
      return frames;
    }
    cur = value < cur.value ? cur.left : cur.right;
  }

  const node = rawInsert(s, value) as AvlNode;
  frames.push(snap(s, mark(node.id, C.done), `${value} is a new leaf. Now walk back up to the root, re-checking every balance factor on the way.`, 1));
  const rotations = rebalanceUp(s, node.parent, frames, true);
  frames.push(
    snap(s, {}, rotations ? `${rotations} rotation(s), height ${h(s.root)}. An insert never needs more than two.` : `No balance factor left {−1, 0, +1}, so no rotation was needed. Height ${h(s.root)}.`, 8),
  );
  return frames;
}

/**
 * Delete. Harder than insert for one reason worth seeing: a single insert needs
 * at most one rotation, but a delete can need one at every level on the way up.
 */
export function avlDeleteFrames(values: number[], value: number, ctx: LabContext): TreeFrame[] {
  const s = ensureTree(ctx, values);
  if (!s.root) return [emptyTreeFrame("The tree is empty")];
  const frames: TreeFrame[] = [snap(s, {}, `Delete ${value}`, 0)];

  let target: AvlNode | null = s.root;
  while (target && target.value !== value) {
    frames.push(snap(s, mark(target.id, C.inspect), `${value} vs ${target.value} — go ${value < target.value ? "left" : "right"}`, 0));
    target = value < target.value ? target.left : target.right;
  }
  if (!target) {
    frames.push(snap(s, {}, `${value} is not in the tree`, 0));
    return frames;
  }
  frames.push(snap(s, mark(target.id, C.remove), `Found ${value}`, 1));

  // Two children: copy the in-order successor's value up, then delete that node
  // instead — it has at most one child by construction.
  let doomed = target;
  if (doomed.left && doomed.right) {
    let succ = doomed.right;
    while (succ.left) succ = succ.left;
    frames.push(snap(s, { [doomed.id]: C.remove, [succ.id]: C.done }, `Two children, so take the in-order successor ${succ.value} — the smallest value in the right subtree`, 1));
    doomed.value = succ.value;
    doomed = succ;
    frames.push(snap(s, mark(doomed.id, C.remove), `${succ.value} moved up; now remove the node it came from, which has at most one child`, 1));
  }

  const child = doomed.left ?? doomed.right;
  const parent = doomed.parent;
  attach(s, parent, doomed, child);
  frames.push(
    snap(s, child ? mark(child.id, C.move) : {}, child ? `Promote ${child.value} into the gap` : "Detach the leaf", 1),
  );

  const rotations = rebalanceUp(s, parent, frames, true);
  const n = allNodes(s.root).length;
  frames.push(
    snap(s, {}, rotations
      ? `${rotations} rotation(s) after one delete. Unlike an insert, a delete can shorten a subtree and force a rotation at every level up to the root. ${n} node(s) left, height ${h(s.root)}.`
      : `No rotation was needed. ${n} node(s) left, height ${h(s.root)}.`, 8),
  );
  return frames;
}
