/**
 * Binary heap.
 *
 * Drawn as a tree, but the badge on each node is its **array index** — because a
 * heap is an array, and the tree is only a way of reading it. Once `[i]`, `[2i+1]`
 * and `[2i+2]` are on screen, sift-up and sift-down stop being arbitrary.
 */

import { emptyTreeFrame, layoutTree, mark, markAll, treeFrame, type LayoutTreeNode } from "../frames";
import { C, type Hex, type LabContext, type NodeId, type TreeFrame } from "../types";

export type HeapKind = "max" | "min";

interface HeapView {
  arr: number[];
  kind: HeapKind;
}

const heapState = (ctx: LabContext, kind: HeapKind): HeapView => {
  ctx.heapKind = kind;
  return { arr: ctx.heap, kind };
};

/** Seed the heap from the values field when the student has not built one yet. */
const ensureHeap = (ctx: LabContext, values: number[], kind: HeapKind): HeapView => {
  const view = heapState(ctx, kind);
  if (!view.arr.length && values.length) {
    ctx.heap = values.slice();
    rawHeapify(ctx.heap, kind);
    view.arr = ctx.heap;
  }
  return view;
};

/** `true` when `a` should sit above `b`. */
const above = (kind: HeapKind, a: number, b: number): boolean => (kind === "max" ? a > b : a < b);

const rawHeapify = (arr: number[], kind: HeapKind): void => {
  for (let start = Math.floor(arr.length / 2) - 1; start >= 0; start -= 1) {
    let root = start;
    for (;;) {
      let child = 2 * root + 1;
      if (child >= arr.length) break;
      if (child + 1 < arr.length && above(kind, arr[child + 1], arr[child])) child += 1;
      if (!above(kind, arr[child], arr[root])) break;
      const tmp = arr[root];
      arr[root] = arr[child];
      arr[child] = tmp;
      root = child;
    }
  }
};

const asTree = (arr: readonly number[], ghosts?: ReadonlySet<number>): LayoutTreeNode | null => {
  const build = (i: number): LayoutTreeNode | null => {
    if (i >= arr.length) return null;
    return {
      id: i,
      value: arr[i],
      left: build(2 * i + 1),
      right: build(2 * i + 2),
      badge: `[${i}]`,
      ghost: ghosts?.has(i),
    };
  };
  return arr.length ? build(0) : null;
};

const snap = (
  arr: readonly number[],
  highlights: Record<NodeId, Hex>,
  description: string,
  codeLine: number,
  ghosts?: ReadonlySet<number>,
): TreeFrame => treeFrame(layoutTree(asTree(arr, ghosts)), highlights, description, codeLine);

const parentOf = (i: number): number => Math.floor((i - 1) / 2);

/* -------------------------------------------------------------------------- */
/* Operations                                                                  */
/* -------------------------------------------------------------------------- */

/** Bottom-up heapify. Building this way is O(n), not O(n log n). */
export function heapBuildFrames(values: number[], kind: HeapKind, ctx: LabContext): TreeFrame[] {
  if (!values.length) return [emptyTreeFrame("Type some values to build a heap from")];
  ctx.heap = values.slice();
  ctx.heapKind = kind;
  const arr = ctx.heap;
  const frames: TreeFrame[] = [
    snap(arr, {}, `The values as they were typed, read as a tree. This is not a ${kind} heap yet.`, 0),
  ];

  const lastParent = Math.floor(arr.length / 2) - 1;
  if (lastParent < 0) {
    frames.push(snap(arr, mark(0, C.done), "A single node is already a heap", 3));
    return frames;
  }
  frames.push(
    snap(arr, markAll(Array.from({ length: arr.length - lastParent - 1 }, (_, k) => lastParent + 1 + k), C.done), `Every node from index ${lastParent + 1} on is a leaf, and a leaf is already a valid heap. Start at index ${lastParent}.`, 1),
  );

  for (let start = lastParent; start >= 0; start -= 1) {
    frames.push(snap(arr, mark(start, C.inspect), `Sift down from index ${start} (value ${arr[start]})`, 2));
    let root = start;
    let guard = 0;
    while (guard < 10000) {
      guard += 1;
      let child = 2 * root + 1;
      if (child >= arr.length) break;
      if (child + 1 < arr.length && above(kind, arr[child + 1], arr[child])) child += 1;
      frames.push(
        snap(arr, { [root]: C.inspect, [child]: C.cursor }, `Compare [${root}] = ${arr[root]} with its ${kind === "max" ? "larger" : "smaller"} child [${child}] = ${arr[child]}`, 2),
      );
      if (!above(kind, arr[child], arr[root])) {
        frames.push(snap(arr, mark(root, C.done), `${arr[root]} already belongs above ${arr[child]} — stop`, 2));
        break;
      }
      const tmp = arr[root];
      arr[root] = arr[child];
      arr[child] = tmp;
      frames.push(snap(arr, { [root]: C.move, [child]: C.move }, `Swap them — the child belongs higher`, 2));
      root = child;
    }
  }

  frames.push(
    snap(arr, mark(0, C.done), `A valid ${kind} heap. Each parent ${kind === "max" ? "≥" : "≤"} both children, and the ${kind === "max" ? "largest" : "smallest"} value is at index 0. Building bottom-up is O(n).`, 3),
  );
  return frames;
}

/** Insert at the end, then sift up. */
export function heapInsertFrames(values: number[], value: number, kind: HeapKind, ctx: LabContext): TreeFrame[] {
  const view = ensureHeap(ctx, values, kind);
  const arr = view.arr;
  arr.push(value);
  let i = arr.length - 1;
  const frames: TreeFrame[] = [
    snap(arr, mark(i, C.inspect), `Insert ${value} at the first free slot, index ${i} — that keeps the tree complete`, 0),
  ];
  let guard = 0;
  while (i > 0 && guard < 10000) {
    guard += 1;
    const p = parentOf(i);
    frames.push(snap(arr, { [i]: C.inspect, [p]: C.cursor }, `Compare with the parent at [${p}] = ${arr[p]}`, 1));
    if (!above(kind, arr[i], arr[p])) {
      frames.push(snap(arr, mark(i, C.done), `${arr[i]} belongs below ${arr[p]} — the heap property holds, stop here`, 3));
      return frames;
    }
    const tmp = arr[i];
    arr[i] = arr[p];
    arr[p] = tmp;
    frames.push(snap(arr, { [i]: C.move, [p]: C.move }, `${arr[p]} belongs above ${arr[i]} — swap`, 2));
    i = p;
  }
  frames.push(snap(arr, mark(0, C.done), `${value} rose to the root. At most log₂(n) swaps, because the tree is complete.`, 3));
  return frames;
}

/** Extract the root: swap it with the last element, shrink, then sift down. */
export function heapExtractFrames(values: number[], kind: HeapKind, ctx: LabContext): TreeFrame[] {
  const view = ensureHeap(ctx, values, kind);
  const arr = view.arr;
  if (!arr.length) return [emptyTreeFrame("The heap is empty")];
  const root = arr[0];
  const frames: TreeFrame[] = [
    snap(arr, mark(0, C.remove), `Extract the root: ${root}, the ${kind === "max" ? "largest" : "smallest"} value`, 0),
  ];
  if (arr.length === 1) {
    arr.pop();
    frames.push(emptyTreeFrame(`Removed ${root} — the heap is now empty`));
    return frames;
  }
  const last = arr.length - 1;
  frames.push(snap(arr, { 0: C.remove, [last]: C.move }, `Swap it with the last element, ${arr[last]}, so the tree stays complete`, 1));
  arr[0] = arr[last];
  arr.pop();
  frames.push(snap(arr, mark(0, C.inspect), `Drop the last slot. ${arr[0]} is now at the root, almost certainly in the wrong place.`, 2));

  let i = 0;
  let guard = 0;
  while (guard < 10000) {
    guard += 1;
    let child = 2 * i + 1;
    if (child >= arr.length) break;
    if (child + 1 < arr.length && above(kind, arr[child + 1], arr[child])) child += 1;
    frames.push(snap(arr, { [i]: C.inspect, [child]: C.cursor }, `Compare [${i}] = ${arr[i]} with [${child}] = ${arr[child]}`, 3));
    if (!above(kind, arr[child], arr[i])) break;
    const tmp = arr[i];
    arr[i] = arr[child];
    arr[child] = tmp;
    frames.push(snap(arr, { [i]: C.move, [child]: C.move }, "Swap it down", 4));
    i = child;
  }
  frames.push(snap(arr, mark(0, C.done), `Heap restored. ${arr[0]} is the new ${kind === "max" ? "maximum" : "minimum"}. Extraction is O(log n).`, 5));
  return frames;
}

export function heapPeekFrames(values: number[], kind: HeapKind, ctx: LabContext): TreeFrame[] {
  const view = ensureHeap(ctx, values, kind);
  if (!view.arr.length) return [emptyTreeFrame("The heap is empty")];
  return [
    snap(view.arr, mark(0, C.done), `The ${kind === "max" ? "maximum" : "minimum"} is always at index 0: ${view.arr[0]}. Reading it is O(1) — no search needed.`, 0),
  ];
}

/**
 * Search. Included precisely because it is *bad*: a heap orders parents against
 * children, not left against right, so there is no subtree to discard and the
 * search is O(n). This is the difference between a heap and a BST.
 */
export function heapSearchFrames(values: number[], target: number, kind: HeapKind, ctx: LabContext): TreeFrame[] {
  const view = ensureHeap(ctx, values, kind);
  const arr = view.arr;
  if (!arr.length) return [emptyTreeFrame("The heap is empty")];
  const frames: TreeFrame[] = [
    snap(arr, {}, `Search for ${target}. A heap has no left/right ordering, so no subtree can be ruled out — every node may have to be checked.`, 0),
  ];
  const seen: NodeId[] = [];
  for (let i = 0; i < arr.length; i += 1) {
    seen.push(i);
    frames.push(snap(arr, { ...markAll(seen.slice(0, -1), C.faded), [i]: C.inspect }, `Check [${i}] = ${arr[i]}`, 1));
    if (arr[i] === target) {
      frames.push(snap(arr, mark(i, C.done), `Found ${target} at index ${i} after ${i + 1} check(s)`, 2));
      return frames;
    }
  }
  frames.push(snap(arr, {}, `${target} is not in the heap — and it took all ${arr.length} checks to know that. Use a BST or a hash table if you need to search.`, 3));
  return frames;
}

/** Repeated extraction, which is heap sort seen from the tree side. */
export function heapSortTreeFrames(values: number[], kind: HeapKind, ctx: LabContext): TreeFrame[] {
  if (!values.length) return [emptyTreeFrame("Type some values to sort")];
  ctx.heap = values.slice();
  ctx.heapKind = kind;
  const arr = ctx.heap;
  rawHeapify(arr, kind);
  const output: number[] = [];
  const frames: TreeFrame[] = [
    snap(arr, {}, `Heapified. Now pull the root ${arr.length} times — each pull gives the next value in order.`, 0),
  ];

  let guard = 0;
  while (arr.length && guard < 10000) {
    guard += 1;
    output.push(arr[0]);
    frames.push(snap(arr, mark(0, C.remove), `Pull ${arr[0]} → output: [${output.join(", ")}]`, 1));
    const last = arr.pop() as number;
    if (arr.length) {
      arr[0] = last;
      let i = 0;
      let inner = 0;
      while (inner < 10000) {
        inner += 1;
        let child = 2 * i + 1;
        if (child >= arr.length) break;
        if (child + 1 < arr.length && above(kind, arr[child + 1], arr[child])) child += 1;
        if (!above(kind, arr[child], arr[i])) break;
        const tmp = arr[i];
        arr[i] = arr[child];
        arr[child] = tmp;
        i = child;
      }
      frames.push(snap(arr, mark(0, C.done), `Sift down — the next ${kind === "max" ? "largest" : "smallest"} value, ${arr[0]}, rises to the root`, 2));
    }
  }
  frames.push(
    emptyTreeFrame(`Heap empty. Output: ${output.join(", ")} — ${kind === "max" ? "descending" : "ascending"}. n extractions × O(log n) each = O(n log n).`),
  );
  return frames;
}

/**
 * Change the value at one index and repair the heap. Worth its own operation
 * because the repair direction is not fixed: making a value more important sifts
 * it *up*, making it less important sifts it *down*. This is the decrease-key
 * that a priority queue exposes, and the reason Dijkstra can be O((n+m) log n).
 */
export function heapUpdateKeyFrames(values: number[], index: number, value: number, kind: HeapKind, ctx: LabContext): TreeFrame[] {
  const view = ensureHeap(ctx, values, kind);
  const arr = view.arr;
  if (!arr.length) return [emptyTreeFrame("The heap is empty")];
  const i0 = Math.max(0, Math.min(Math.round(index) || 0, arr.length - 1));
  const old = arr[i0];
  const frames: TreeFrame[] = [
    snap(arr, mark(i0, C.inspect), `Change [${i0}] from ${old} to ${value}`, 0),
  ];
  arr[i0] = value;

  if (old === value) {
    frames.push(snap(arr, mark(i0, C.done), "Same value — nothing to repair", 5));
    return frames;
  }

  if (above(kind, value, old)) {
    frames.push(
      snap(arr, mark(i0, C.move), `${value} outranks ${old} in a ${kind} heap, so it may now belong above its parent — sift up`, 1),
    );
    let i = i0;
    let guard = 0;
    while (i > 0 && guard < 10000) {
      guard += 1;
      const p = parentOf(i);
      frames.push(snap(arr, { [i]: C.inspect, [p]: C.cursor }, `Compare with the parent [${p}] = ${arr[p]}`, 2));
      if (!above(kind, arr[i], arr[p])) break;
      const tmp = arr[i];
      arr[i] = arr[p];
      arr[p] = tmp;
      frames.push(snap(arr, { [i]: C.move, [p]: C.move }, "Swap upward", 2));
      i = p;
    }
    frames.push(snap(arr, mark(i, C.done), `Settled at index ${i}. Only the path to the root was touched — O(log n).`, 4));
    return frames;
  }

  frames.push(
    snap(arr, mark(i0, C.move), `${value} ranks below ${old}, so it may now belong under one of its children — sift down`, 3),
  );
  let i = i0;
  let guard = 0;
  while (guard < 10000) {
    guard += 1;
    let child = 2 * i + 1;
    if (child >= arr.length) break;
    if (child + 1 < arr.length && above(kind, arr[child + 1], arr[child])) child += 1;
    frames.push(snap(arr, { [i]: C.inspect, [child]: C.cursor }, `Compare with the ${kind === "max" ? "larger" : "smaller"} child [${child}] = ${arr[child]}`, 3));
    if (!above(kind, arr[child], arr[i])) break;
    const tmp = arr[i];
    arr[i] = arr[child];
    arr[child] = tmp;
    frames.push(snap(arr, { [i]: C.move, [child]: C.move }, "Swap downward", 3));
    i = child;
  }
  frames.push(snap(arr, mark(i, C.done), `Settled at index ${i}. Only one root-to-leaf path was touched — O(log n).`, 4));
  return frames;
}

/**
 * k-th largest with a size-k min heap. The reason to teach this: you never need
 * to sort the whole input, and the heap never grows past k.
 */
export function heapKthLargestFrames(values: number[], k: number, ctx: LabContext): TreeFrame[] {
  const kk = Math.max(1, Math.min(Math.round(k) || 1, Math.max(1, values.length)));
  ctx.heap = [];
  ctx.heapKind = "min";
  const arr = ctx.heap;
  const frames: TreeFrame[] = [
    emptyTreeFrame(`Find the ${kk}th largest value with a min heap capped at ${kk} elements — the smallest of the best ${kk} sits at the root, ready to be evicted.`),
  ];

  const siftUp = (from: number) => {
    let i = from;
    while (i > 0) {
      const p = parentOf(i);
      if (!above("min", arr[i], arr[p])) break;
      const tmp = arr[i];
      arr[i] = arr[p];
      arr[p] = tmp;
      i = p;
    }
  };
  const siftDown = () => {
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= arr.length) break;
      if (child + 1 < arr.length && above("min", arr[child + 1], arr[child])) child += 1;
      if (!above("min", arr[child], arr[i])) break;
      const tmp = arr[i];
      arr[i] = arr[child];
      arr[child] = tmp;
      i = child;
    }
  };

  values.forEach((v) => {
    if (arr.length < kk) {
      arr.push(v);
      siftUp(arr.length - 1);
      frames.push(snap(arr, mark(0, C.done), `The heap holds fewer than ${kk} — add ${v}. Root is now ${arr[0]}.`, 1));
    } else if (v > arr[0]) {
      const evicted = arr[0];
      frames.push(snap(arr, mark(0, C.remove), `${v} beats the root ${evicted}, so ${evicted} cannot be in the top ${kk} — evict it`, 2));
      arr[0] = v;
      siftDown();
      frames.push(snap(arr, mark(0, C.done), `${v} replaces it and sifts down. Root is now ${arr[0]}.`, 2));
    } else {
      frames.push(
        snap(arr, mark(0, C.faded), `${v} does not beat the root ${arr[0]}, so it is not in the top ${kk} — discard it without touching the heap`, 3),
      );
    }
  });

  frames.push(
    arr.length
      ? snap(arr, mark(0, C.done), `The root is the ${kk}th largest value: ${arr[0]}. The heap never held more than ${kk} elements, so this was O(n log k), not O(n log n).`, 4)
      : emptyTreeFrame("No values were supplied"),
  );
  return frames;
}
