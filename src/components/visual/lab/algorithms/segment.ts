/**
 * Segment tree and Fenwick tree (BIT).
 *
 * Both answer the same question — "what is the sum of this range?" — in O(log n)
 * while still allowing updates. They are in one file because the interesting
 * thing is the comparison: a segment tree is an explicit tree you can see, and a
 * Fenwick tree is the same idea folded into a single array by arithmetic on the
 * lowest set bit.
 */

import { emptyTreeFrame, layoutTree, snapshot, treeFrame, type LayoutTreeNode } from "../frames";
import { C, type ArrayFrame, type Hex, type LabContext, type NodeId, type TreeFrame } from "../types";

/* -------------------------------------------------------------------------- */
/* Segment tree                                                                */
/* -------------------------------------------------------------------------- */

interface SegNode {
  id: number;
  lo: number;
  hi: number;
  sum: number;
  left: SegNode | null;
  right: SegNode | null;
}

interface SegState {
  root: SegNode | null;
  values: number[];
}

const buildSeg = (values: readonly number[], lo: number, hi: number, counter: { n: number }): SegNode => {
  const id = counter.n;
  counter.n += 1;
  if (lo === hi) return { id, lo, hi, sum: values[lo], left: null, right: null };
  const mid = Math.floor((lo + hi) / 2);
  const left = buildSeg(values, lo, mid, counter);
  const right = buildSeg(values, mid + 1, hi, counter);
  return { id, lo, hi, sum: left.sum + right.sum, left, right };
};

const segState = (ctx: LabContext, values: number[]): SegState => {
  const existing = ctx.segment as SegState | null;
  const same =
    existing && existing.values.length === values.length && existing.values.every((v, i) => v === values[i]);
  if (!same) {
    const fresh: SegState = {
      values: values.slice(),
      root: values.length ? buildSeg(values, 0, values.length - 1, { n: 0 }) : null,
    };
    ctx.segment = fresh;
    return fresh;
  }
  return existing as SegState;
};

const segDecorate = (
  node: SegNode | null,
  ghosts?: ReadonlySet<NodeId>,
): LayoutTreeNode | null =>
  node
    ? {
        id: node.id,
        value: node.sum,
        left: segDecorate(node.left, ghosts),
        right: segDecorate(node.right, ghosts),
        subLabel: node.lo === node.hi ? `[${node.lo}]` : `[${node.lo}..${node.hi}]`,
        ghost: ghosts?.has(node.id),
      }
    : null;

const segSnap = (
  root: SegNode | null,
  highlights: Record<NodeId, Hex>,
  description: string,
  codeLine: number,
  ghosts?: ReadonlySet<NodeId>,
): TreeFrame => treeFrame(layoutTree(segDecorate(root, ghosts)), highlights, description, codeLine);

const bruteSum = (values: readonly number[], from: number, to: number): number => {
  let sum = 0;
  for (let i = from; i <= to; i += 1) sum += values[i];
  return sum;
};

const clampRange = (values: readonly number[], a: number, b: number): [number, number] => {
  const n = values.length;
  const x = Math.max(0, Math.min(Math.round(a) || 0, n - 1));
  const y = Math.max(0, Math.min(Math.round(b) || 0, n - 1));
  return x <= y ? [x, y] : [y, x];
};

/** Build bottom-up, so each parent visibly becomes the sum of its two children. */
export function segBuildFrames(values: number[], ctx: LabContext): TreeFrame[] {
  if (!values.length) return [emptyTreeFrame("Type some values to build a segment tree over")];
  const s = segState(ctx, values);
  const root = s.root as SegNode;

  const frames: TreeFrame[] = [];
  const built = new Set<NodeId>();
  const ghostsOf = (): Set<NodeId> => {
    const all = new Set<NodeId>();
    const walk = (n: SegNode | null) => {
      if (!n) return;
      if (!built.has(n.id)) all.add(n.id);
      walk(n.left);
      walk(n.right);
    };
    walk(root);
    return all;
  };

  frames.push(
    segSnap(root, {}, `Each node will hold the sum of one range. The root covers [0..${values.length - 1}]; every level splits its range in half.`, 0, ghostsOf()),
  );

  const walk = (node: SegNode) => {
    if (node.left) walk(node.left);
    if (node.right) walk(node.right);
    built.add(node.id);
    frames.push(
      segSnap(
        root,
        { [node.id]: node.lo === node.hi ? C.done : C.move },
        node.lo === node.hi
          ? `Leaf [${node.lo}] holds the single value ${node.sum}`
          : `[${node.lo}..${node.hi}] = ${(node.left as SegNode).sum} + ${(node.right as SegNode).sum} = ${node.sum}`,
        node.lo === node.hi ? 1 : 2,
        ghostsOf(),
      ),
    );
  };

  walk(root);
  const nodeCount = (function count(n: SegNode | null): number {
    return n ? 1 + count(n.left) + count(n.right) : 0;
  })(root);
  frames.push(
    segSnap(root, {}, `${nodeCount} node(s) for ${values.length} value(s), height ${Math.ceil(Math.log2(values.length)) + 1}. Building is O(n) — each node is computed once.`, 3),
  );
  return frames;
}

/**
 * Range query. Three cases at every node, and the middle one is the whole trick:
 * a node whose range sits entirely inside the query contributes its stored sum
 * and its subtree is never entered.
 */
export function segQueryFrames(values: number[], from: number, to: number, ctx: LabContext): TreeFrame[] {
  if (!values.length) return [emptyTreeFrame("Type some values first")];
  const s = segState(ctx, values);
  const root = s.root as SegNode;
  const [lo, hi] = clampRange(values, from, to);

  const frames: TreeFrame[] = [
    segSnap(root, {}, `Sum of [${lo}..${hi}]. At each node, compare its range with the query.`, 0),
  ];
  const used: NodeId[] = [];
  const skipped: NodeId[] = [];
  let total = 0;
  let visits = 0;

  const paint = (): Record<NodeId, Hex> => ({
    ...Object.fromEntries(skipped.map((id) => [id, C.faded])),
    ...Object.fromEntries(used.map((id) => [id, C.done])),
  });

  const query = (node: SegNode | null) => {
    if (!node) return;
    visits += 1;
    if (node.hi < lo || node.lo > hi) {
      skipped.push(node.id);
      frames.push(segSnap(root, { ...paint(), [node.id]: C.remove }, `[${node.lo}..${node.hi}] does not overlap [${lo}..${hi}] at all — return 0 and stop descending`, 3));
      return;
    }
    if (node.lo >= lo && node.hi <= hi) {
      used.push(node.id);
      total += node.sum;
      frames.push(segSnap(root, paint(), `[${node.lo}..${node.hi}] sits entirely inside the query — take its stored sum ${node.sum} without looking at a single child. Running total ${total}.`, 2));
      return;
    }
    frames.push(segSnap(root, { ...paint(), [node.id]: C.inspect }, `[${node.lo}..${node.hi}] overlaps only partly — split and ask both children`, 1));
    query(node.left);
    query(node.right);
  };

  query(root);
  const check = bruteSum(values, lo, hi);
  frames.push(
    segSnap(root, paint(), `Sum of [${lo}..${hi}] is ${total}${total === check ? "" : ` (brute force says ${check} — mismatch)`}. ${visits} node(s) visited out of ${values.length * 2 - 1}, and adding the values one by one would have taken ${hi - lo + 1} step(s).`, 4),
  );
  return frames;
}

/** Point update: one leaf changes, and only its ancestors need recomputing. */
export function segUpdateFrames(values: number[], index: number, value: number, ctx: LabContext): TreeFrame[] {
  if (!values.length) return [emptyTreeFrame("Type some values first")];
  const s = segState(ctx, values);
  const root = s.root as SegNode;
  const i = Math.max(0, Math.min(Math.round(index) || 0, values.length - 1));

  const frames: TreeFrame[] = [
    segSnap(root, {}, `Set index ${i} to ${value}. Only the nodes whose range contains ${i} can change — that is one path from the root.`, 0),
  ];
  const path: SegNode[] = [];
  let node: SegNode | null = root;
  while (node) {
    path.push(node);
    frames.push(
      segSnap(root, { [node.id]: C.inspect }, `[${node.lo}..${node.hi}] contains ${i} — descend`, 1),
    );
    if (node.lo === node.hi) break;
    const mid = Math.floor((node.lo + node.hi) / 2);
    node = i <= mid ? node.left : node.right;
  }

  const leaf = path[path.length - 1];
  const delta = value - leaf.sum;
  leaf.sum = value;
  s.values[i] = value;
  frames.push(segSnap(root, { [leaf.id]: C.move }, `Leaf [${i}] becomes ${value}, a change of ${delta >= 0 ? "+" : ""}${delta}`, 2));

  for (let k = path.length - 2; k >= 0; k -= 1) {
    const parent = path[k];
    parent.sum = (parent.left as SegNode).sum + (parent.right as SegNode).sum;
    frames.push(
      segSnap(root, { [parent.id]: C.done }, `[${parent.lo}..${parent.hi}] recomputes to ${parent.sum}`, 3),
    );
  }

  frames.push(
    segSnap(root, {}, `${path.length} node(s) touched — the height of the tree, so O(log n). Every other node still holds a correct sum, untouched.`, 4),
  );
  return frames;
}

/* -------------------------------------------------------------------------- */
/* Fenwick tree (binary indexed tree)                                          */
/* -------------------------------------------------------------------------- */

const lowbit = (i: number): number => i & -i;

interface FenwickState {
  values: number[];
  tree: number[];
}

const buildFenwick = (values: readonly number[]): number[] => {
  const n = values.length;
  const tree = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i += 1) {
    tree[i] += values[i - 1];
    const j = i + lowbit(i);
    if (j <= n) tree[j] += tree[i];
  }
  return tree;
};

const fenwickState = (ctx: LabContext, values: number[]): FenwickState => {
  const existing = ctx.fenwick as FenwickState | null;
  const same =
    existing && existing.values.length === values.length && existing.values.every((v, i) => v === values[i]);
  if (!same) {
    const fresh: FenwickState = { values: values.slice(), tree: buildFenwick(values) };
    ctx.fenwick = fresh;
    return fresh;
  }
  return existing as FenwickState;
};

/** Slot i covers the range (i − lowbit(i), i], which is what the labels say. */
const coverLabels = (n: number): Record<number, string> =>
  Object.fromEntries(
    Array.from({ length: n }, (_, k) => {
      const i = k + 1;
      const start = i - lowbit(i) + 1;
      return [k, start === i ? `${i}` : `${start}..${i}`];
    }),
  );

const fenwickSnap = (
  st: FenwickState,
  highlights: Record<number, Hex>,
  description: string,
  codeLine: number,
): ArrayFrame =>
  snapshot(st.tree.slice(1), highlights, [], description, codeLine, null, "horizontal", {
    labels: coverLabels(st.values.length),
    secondary: {
      label: "original values (1-indexed)",
      values: st.values.slice(),
      labels: Object.fromEntries(st.values.map((_, k) => [k, String(k + 1)])),
    },
  });

/**
 * Build. Each slot pushes its total into the slot that covers it, which is the
 * whole structure in one line: `j = i + lowbit(i)`.
 */
export function fenwickBuildFrames(values: number[], ctx: LabContext): ArrayFrame[] {
  if (!values.length) return [snapshot([], {}, [], "Type some values to build a Fenwick tree over", 0)];
  const n = values.length;
  const st: FenwickState = { values: values.slice(), tree: new Array<number>(n + 1).fill(0) };
  ctx.fenwick = st;

  const frames: ArrayFrame[] = [
    fenwickSnap(st, {}, `A Fenwick tree is one array. Slot i stores the sum of the ${n === 1 ? "range" : "range"} labelled under it — that range is decided by the lowest set bit of i.`, 0),
  ];

  for (let i = 1; i <= n; i += 1) {
    st.tree[i] += values[i - 1];
    frames.push(
      fenwickSnap(st, { [i - 1]: C.inspect }, `Slot ${i} takes value ${values[i - 1]}. In binary ${i} is ${i.toString(2)}, its lowest set bit is ${lowbit(i)}, so it covers ${lowbit(i)} element(s): ${coverLabels(n)[i - 1]}.`, 1),
    );
    const j = i + lowbit(i);
    if (j <= n) {
      st.tree[j] += st.tree[i];
      frames.push(
        fenwickSnap(st, { [i - 1]: C.done, [j - 1]: C.move }, `Slot ${j} covers slot ${i}'s whole range, so push ${st.tree[i]} up into it: ${i} + lowbit(${i}) = ${j}`, 2),
      );
    } else {
      frames.push(
        fenwickSnap(st, { [i - 1]: C.done }, `${i} + lowbit(${i}) = ${j}, past the end — nothing above slot ${i} to update`, 3),
      );
    }
  }

  frames.push(
    fenwickSnap(st, {}, `Built in ${n} step(s) — O(n). The same ${n} numbers now answer any prefix sum in O(log n), and still allow updates.`, 4),
  );
  return frames;
}

/** Prefix sum: walk down by clearing the lowest set bit each time. */
export function fenwickPrefixFrames(values: number[], index: number, ctx: LabContext): ArrayFrame[] {
  if (!values.length) return [snapshot([], {}, [], "Type some values first", 0)];
  const st = fenwickState(ctx, values);
  const n = values.length;
  const target = Math.max(1, Math.min(Math.round(index) || n, n));

  const frames: ArrayFrame[] = [
    fenwickSnap(st, {}, `Sum of the first ${target} value(s). Start at slot ${target} and keep removing the lowest set bit.`, 0),
  ];
  const used: number[] = [];
  let total = 0;
  let i = target;

  while (i > 0) {
    total += st.tree[i];
    used.push(i - 1);
    frames.push(
      fenwickSnap(
        st,
        { ...Object.fromEntries(used.map((k) => [k, C.done])), [i - 1]: C.inspect },
        `Add slot ${i} (${st.tree[i]}), which covers ${coverLabels(n)[i - 1]}. Running total ${total}.`,
        1,
      ),
    );
    const next = i - lowbit(i);
    frames.push(
      fenwickSnap(st, Object.fromEntries(used.map((k) => [k, C.done])), `${i} − lowbit(${i}) = ${i} − ${lowbit(i)} = ${next}${next === 0 ? " — done" : `, so jump to slot ${next}`}`, 2),
    );
    i = next;
  }

  const check = bruteSum(values, 0, target - 1);
  frames.push(
    fenwickSnap(st, Object.fromEntries(used.map((k) => [k, C.done])), `Prefix sum = ${total}${total === check ? "" : ` (brute force says ${check} — mismatch)`} from ${used.length} slot(s). ${target} in binary is ${target.toString(2)}, and it has exactly ${used.length} set bit(s) — that is not a coincidence, it is the running time.`, 3),
  );
  return frames;
}

/** Point update: walk *up* by adding the lowest set bit. */
export function fenwickUpdateFrames(values: number[], index: number, delta: number, ctx: LabContext): ArrayFrame[] {
  if (!values.length) return [snapshot([], {}, [], "Type some values first", 0)];
  const st = fenwickState(ctx, values);
  const n = values.length;
  const target = Math.max(1, Math.min(Math.round(index) || 1, n));
  const change = Math.round(delta) || 0;

  st.values[target - 1] += change;
  const frames: ArrayFrame[] = [
    fenwickSnap(st, {}, `Add ${change >= 0 ? "+" : ""}${change} to value ${target}. Every slot whose range contains ${target} must change — walk up by adding the lowest set bit.`, 0),
  ];

  const touched: number[] = [];
  let i = target;
  while (i <= n) {
    st.tree[i] += change;
    touched.push(i - 1);
    frames.push(
      fenwickSnap(
        st,
        { ...Object.fromEntries(touched.map((k) => [k, C.done])), [i - 1]: C.move },
        `Slot ${i} covers ${coverLabels(n)[i - 1]}, which contains ${target} — it becomes ${st.tree[i]}`,
        1,
      ),
    );
    const next = i + lowbit(i);
    if (next <= n) {
      frames.push(
        fenwickSnap(st, Object.fromEntries(touched.map((k) => [k, C.done])), `${i} + lowbit(${i}) = ${next} — the next slot up that contains ${target}`, 2),
      );
    }
    i = next;
  }

  frames.push(
    fenwickSnap(st, Object.fromEntries(touched.map((k) => [k, C.done])), `${touched.length} slot(s) changed out of ${n}. A plain prefix-sum array would have needed ${n - target + 1} — that is the trade a Fenwick tree makes.`, 3),
  );
  return frames;
}
