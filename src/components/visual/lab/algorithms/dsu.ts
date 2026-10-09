/**
 * Disjoint set union (union-find).
 *
 * Drawn as the parent forest it actually is: an arrow points from each element to
 * its parent, and the elements with no arrow are the roots. Two elements are in
 * the same set exactly when they reach the same root.
 *
 * Both optimisations are visible here. Union *by rank* decides which root gets
 * hung under the other, and path compression rewrites the arrows so the next
 * `find` is a single hop.
 */

import { graphFrame } from "../frames";
import { C, type EdgeState, type GraphEdgeFrame, type GraphFrame, type GraphNodeFrame, type Hex, type LabContext } from "../types";

interface DsuState {
  parent: number[];
  rank: number[];
  count: number;
}

const clampCount = (value: number): number => Math.max(2, Math.min(Math.round(value) || 8, 16));

const fresh = (count: number): DsuState => {
  const n = clampCount(count);
  return { parent: Array.from({ length: n }, (_, i) => i), rank: new Array<number>(n).fill(0), count: n };
};

const dsuState = (ctx: LabContext, count: number): DsuState => {
  const existing = ctx.dsu as DsuState | null;
  if (!existing || existing.count !== clampCount(count)) {
    const created = fresh(count);
    ctx.dsu = created;
    return created;
  }
  return existing;
};

const rootOf = (s: DsuState, x: number): number => {
  let r = x;
  let guard = 0;
  while (s.parent[r] !== r && guard < 10000) {
    r = s.parent[r];
    guard += 1;
  }
  return r;
};

const childrenOf = (s: DsuState): number[][] => {
  const kids: number[][] = Array.from({ length: s.count }, () => []);
  for (let i = 0; i < s.count; i += 1) {
    if (s.parent[i] !== i) kids[s.parent[i]].push(i);
  }
  return kids;
};

/**
 * Lay the forest out by hand: each tree gets its own block of columns, depth runs
 * into the screen. Doing it here rather than through `layoutTree` is what lets
 * several roots sit side by side.
 */
const layoutForest = (s: DsuState): GraphNodeFrame[] => {
  const kids = childrenOf(s);
  const pos: Array<{ x: number; z: number } | null> = new Array(s.count).fill(null);
  let column = 0;

  const place = (node: number, depth: number): number => {
    if (!kids[node].length) {
      const x = column;
      column += 1;
      pos[node] = { x, z: depth };
      return x;
    }
    const centres = kids[node].map((c) => place(c, depth + 1));
    const x = (centres[0] + centres[centres.length - 1]) / 2;
    pos[node] = { x, z: depth };
    return x;
  };

  for (let i = 0; i < s.count; i += 1) {
    if (s.parent[i] === i) {
      place(i, 0);
      column += 0.6; // a gap between separate trees
    }
  }

  const maxX = Math.max(0, ...pos.map((p) => p?.x ?? 0));
  return pos.map((p, id) => ({
    id,
    label: String(id),
    x: ((p?.x ?? 0) - maxX / 2) * 3.4,
    z: (p?.z ?? 0) * 3.6 - 3,
    badge: s.parent[id] === id ? `root r=${s.rank[id]}` : undefined,
  }));
};

const forestEdges = (s: DsuState, states?: Record<number, EdgeState>): GraphEdgeFrame[] => {
  const edges: GraphEdgeFrame[] = [];
  for (let i = 0; i < s.count; i += 1) {
    if (s.parent[i] !== i) {
      edges.push({ from: i, to: s.parent[i], directed: true, state: states?.[i] ?? "idle" });
    }
  }
  return edges;
};

const snap = (
  s: DsuState,
  highlights: Record<number, Hex>,
  description: string,
  codeLine: number,
  edgeStates?: Record<number, EdgeState>,
): GraphFrame => graphFrame(layoutForest(s), forestEdges(s, edgeStates), highlights, description, codeLine);

const setsOf = (s: DsuState): Map<number, number[]> => {
  const groups = new Map<number, number[]>();
  for (let i = 0; i < s.count; i += 1) {
    const r = rootOf(s, i);
    const list = groups.get(r) ?? [];
    list.push(i);
    groups.set(r, list);
  }
  return groups;
};

const clampElement = (value: number, count: number): number =>
  Math.max(0, Math.min(Math.round(value) || 0, count - 1));

/* -------------------------------------------------------------------------- */
/* Operations                                                                  */
/* -------------------------------------------------------------------------- */

/** Start over with n singletons. */
export function dsuResetFrames(count: number, ctx: LabContext): GraphFrame[] {
  const s = fresh(count);
  ctx.dsu = s;
  return [
    snap(s, {}, `${s.count} elements, each its own set. Every element is its own root and has rank 0 — ${s.count} separate sets.`, 0),
  ];
}

/**
 * Union by rank. Rank is an upper bound on a tree's height; hanging the shorter
 * tree under the taller one is what keeps the forest flat.
 */
export function dsuUnionFrames(count: number, a: number, b: number, ctx: LabContext): GraphFrame[] {
  const s = dsuState(ctx, count);
  const x = clampElement(a, s.count);
  const y = clampElement(b, s.count);
  const frames: GraphFrame[] = [snap(s, { [x]: C.inspect, [y]: C.inspect }, `Union ${x} and ${y}. First find each one's root.`, 0)];

  const rx = rootOf(s, x);
  const ry = rootOf(s, y);
  frames.push(snap(s, { [x]: C.inspect, [rx]: C.cursor, [y]: C.inspect, [ry]: C.window }, `${x} belongs to the set rooted at ${rx} (rank ${s.rank[rx]}); ${y} belongs to the set rooted at ${ry} (rank ${s.rank[ry]})`, 1));

  if (rx === ry) {
    frames.push(snap(s, { [rx]: C.done }, `Same root — ${x} and ${y} are already in the same set, so there is nothing to join.`, 2));
    return frames;
  }

  if (s.rank[rx] < s.rank[ry]) {
    s.parent[rx] = ry;
    frames.push(snap(s, { [rx]: C.move, [ry]: C.done }, `Rank ${s.rank[rx]} < ${s.rank[ry]}, so hang ${rx} under ${ry}. Attaching the shorter tree to the taller one leaves the height unchanged.`, 3, { [rx]: "chosen" }));
  } else if (s.rank[ry] < s.rank[rx]) {
    s.parent[ry] = rx;
    frames.push(snap(s, { [ry]: C.move, [rx]: C.done }, `Rank ${s.rank[ry]} < ${s.rank[rx]}, so hang ${ry} under ${rx} — again, no new height.`, 3, { [ry]: "chosen" }));
  } else {
    s.parent[ry] = rx;
    s.rank[rx] += 1;
    frames.push(snap(s, { [ry]: C.move, [rx]: C.done }, `Equal ranks (${s.rank[rx] - 1}), so the choice is arbitrary — hang ${ry} under ${rx}. This is the only case where the height can grow, so ${rx}'s rank goes up to ${s.rank[rx]}.`, 4, { [ry]: "chosen" }));
  }

  const groups = setsOf(s);
  frames.push(snap(s, {}, `${groups.size} set(s) now. Ranks only ever increase on a tie, so the tallest tree after n unions has height at most log₂(n).`, 5));
  return frames;
}

/**
 * Find, with path compression. The first walk is the answer; the second walk is
 * the optimisation, and the frames make clear it is a rewrite, not a search.
 */
export function dsuFindFrames(count: number, element: number, ctx: LabContext): GraphFrame[] {
  const s = dsuState(ctx, count);
  const x = clampElement(element, s.count);
  const frames: GraphFrame[] = [snap(s, { [x]: C.inspect }, `Find the root of ${x} — that root *is* the set's identity.`, 0)];

  const path: number[] = [];
  let cur = x;
  let guard = 0;
  while (s.parent[cur] !== cur && guard < 10000) {
    guard += 1;
    path.push(cur);
    const next = s.parent[cur];
    frames.push(
      snap(s, { ...Object.fromEntries(path.map((p) => [p, C.faded])), [next]: C.inspect }, `${cur}'s parent is ${next} — keep climbing`, 1, Object.fromEntries(path.map((p) => [p, "active" as EdgeState]))),
    );
    cur = next;
  }
  const root = cur;
  frames.push(snap(s, { [root]: C.done, ...Object.fromEntries(path.map((p) => [p, C.faded])) }, `${root} is its own parent, so it is the root. ${path.length} hop(s).`, 2));

  if (!path.length) {
    frames.push(snap(s, { [root]: C.done }, `${x} was already a root — nothing to compress.`, 4));
    return frames;
  }

  const alreadyDirect = path.every((p) => s.parent[p] === root);
  if (alreadyDirect) {
    frames.push(snap(s, { [x]: C.done, [root]: C.done }, `Every node on the path already pointed straight at ${root} — the compression from an earlier find is still paying off.`, 4));
    return frames;
  }

  frames.push(snap(s, Object.fromEntries(path.map((p) => [p, C.move])), "Now walk the same path again and point every node straight at the root. This costs nothing extra asymptotically and makes every later find on these nodes a single hop.", 3));
  path.forEach((p) => {
    if (s.parent[p] === root) return;
    s.parent[p] = root;
    frames.push(snap(s, { [p]: C.done, [root]: C.done }, `${p} now points directly at ${root}`, 3, { [p]: "chosen" }));
  });

  frames.push(
    snap(s, { [x]: C.done, [root]: C.done }, `The path collapsed. With union by rank *and* path compression, m operations on n elements cost O(m · α(n)) — and α(n) is below 5 for any n you will ever type.`, 4),
  );
  return frames;
}

/** Report the sets as they currently stand. */
export function dsuComponentsFrames(count: number, ctx: LabContext): GraphFrame[] {
  const s = dsuState(ctx, count);
  const groups = setsOf(s);
  const palette: Hex[] = [C.done, C.cursor, C.window, C.move, C.inspect, C.remove];
  const frames: GraphFrame[] = [snap(s, {}, "Group the elements by root. Elements with the same root are in the same set.", 0)];

  const painted: Record<number, Hex> = {};
  let index = 0;
  groups.forEach((members, root) => {
    const colour = palette[index % palette.length];
    index += 1;
    members.forEach((m) => {
      painted[m] = colour;
    });
    frames.push(
      graphFrame(layoutForest(s), forestEdges(s), { ...painted, [root]: colour }, `Set rooted at ${root}: {${members.join(", ")}} — ${members.length} element(s)`, 1),
    );
  });

  const sizes = Array.from(groups.values()).map((m) => m.length).sort((a, b) => b - a);
  frames.push(
    graphFrame(layoutForest(s), forestEdges(s), painted, `${groups.size} set(s) over ${s.count} elements, sizes ${sizes.join(", ")}. Answering "are these two connected?" is now two finds and a comparison.`, 2),
  );
  return frames;
}
