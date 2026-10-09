/**
 * Graphs.
 *
 * The graph itself lives in the lab context, so every operation runs on the same
 * vertices and edges until the student regenerates. Edges carry weights, and each
 * operation decides whether to show them — weights are noise during BFS and the
 * whole story during Dijkstra.
 */

import { circleLayout, emptyGraphFrame, graphFrame, markAll } from "../frames";
import { C, type EdgeState, type GraphEdgeFrame, type GraphFrame, type GraphNodeFrame, type Hex, type LabContext } from "../types";

interface GraphEdge {
  from: number;
  to: number;
  weight: number;
}

interface GraphState {
  count: number;
  positions: Array<{ x: number; z: number }>;
  edges: GraphEdge[];
}

const clampCount = (value: number): number => Math.max(3, Math.min(Math.round(value) || 7, 12));

/**
 * A seeded generator, so a given vertex count always produces the same graph.
 *
 * `Math.random` was the obvious thing here and it was wrong twice over. The lab
 * builds a fresh `LabContext` for every run, so switching from BFS to Dijkstra
 * would have handed the student two *unrelated* random graphs at the exact
 * moment the point is to compare one algorithm against another on the same one.
 * And a graph that changes on every reload cannot be described in a lesson, or
 * checked by `scripts/verify-lab.ts` against an independently computed answer.
 *
 * mulberry32 — small, and no dependency for eight lines of arithmetic.
 */
const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const generate = (count: number, componentCount: number): GraphState => {
  const n = clampCount(count);
  const groups = Math.max(1, Math.min(Math.round(componentCount) || 1, Math.floor(n / 2)));
  const positions = circleLayout(n, 9);
  const edges: GraphEdge[] = [];
  const random = seededRandom(n * 1013 + groups * 7919);
  const weight = () => 1 + Math.floor(random() * 9);

  // Split the vertices into `groups` contiguous blocks, and connect each block
  // internally only — so the number of components is exactly `groups`.
  const size = Math.floor(n / groups);
  for (let g = 0; g < groups; g += 1) {
    const start = g * size;
    const end = g === groups - 1 ? n - 1 : start + size - 1;
    for (let i = start + 1; i <= end; i += 1) {
      const parent = start + Math.floor(random() * (i - start));
      edges.push({ from: parent, to: i, weight: weight() });
    }
    // A few extra edges inside the block, so there are cycles to find.
    const extra = Math.max(0, Math.floor((end - start + 1) / 2));
    for (let k = 0; k < extra; k += 1) {
      const a = start + Math.floor(random() * (end - start + 1));
      const b = start + Math.floor(random() * (end - start + 1));
      if (a === b) continue;
      const exists = edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
      if (!exists) edges.push({ from: Math.min(a, b), to: Math.max(a, b), weight: weight() });
    }
  }
  return { count: n, positions, edges };
};

const ensureGraph = (ctx: LabContext, count: number): GraphState => {
  if (!ctx.graph) ctx.graph = generate(count, 1);
  return ctx.graph as GraphState;
};

const nodesOf = (g: GraphState, badges?: Record<number, string>): GraphNodeFrame[] =>
  g.positions.slice(0, g.count).map((p, id) => ({ id, label: String(id), x: p.x, z: p.z, badge: badges?.[id] }));

interface EdgeOpts {
  weighted?: boolean;
  directed?: boolean;
  states?: Record<string, EdgeState>;
}

const edgeKey = (from: number, to: number): string => `${Math.min(from, to)}-${Math.max(from, to)}`;

const edgesOf = (g: GraphState, opts?: EdgeOpts): GraphEdgeFrame[] =>
  g.edges.map((e) => ({
    from: e.from,
    to: e.to,
    weight: opts?.weighted ? e.weight : undefined,
    state: opts?.states?.[edgeKey(e.from, e.to)] ?? "idle",
    directed: opts?.directed,
  }));

const adjacency = (g: GraphState): number[][] => {
  const adj: number[][] = Array.from({ length: g.count }, () => []);
  g.edges.forEach((e) => {
    adj[e.from].push(e.to);
    adj[e.to].push(e.from);
  });
  adj.forEach((list) => list.sort((a, b) => a - b));
  return adj;
};

const weightedAdjacency = (g: GraphState): Array<Array<{ to: number; weight: number }>> => {
  const adj: Array<Array<{ to: number; weight: number }>> = Array.from({ length: g.count }, () => []);
  g.edges.forEach((e) => {
    adj[e.from].push({ to: e.to, weight: e.weight });
    adj[e.to].push({ to: e.from, weight: e.weight });
  });
  return adj;
};

const clampVertex = (value: number, count: number): number =>
  Math.max(0, Math.min(Math.round(value) || 0, count - 1));

/* -------------------------------------------------------------------------- */
/* Operations                                                                  */
/* -------------------------------------------------------------------------- */

/** Build a fresh graph. Everything else runs on whatever this produced. */
export function graphGenerateFrames(count: number, components: number, ctx: LabContext): GraphFrame[] {
  const g = generate(count, components);
  ctx.graph = g;
  const groups = Math.max(1, Math.min(Math.round(components) || 1, Math.floor(g.count / 2)));
  return [
    graphFrame(
      nodesOf(g),
      edgesOf(g, { weighted: true }),
      {},
      `${g.count} vertices, ${g.edges.length} weighted edges, ${groups} component${groups === 1 ? "" : "s"}. Every other graph operation runs on this graph until you generate a new one.`,
      0,
    ),
  ];
}

/** Breadth-first search: a queue, and therefore shortest paths by edge count. */
export function graphBfsFrames(count: number, start: number, ctx: LabContext): GraphFrame[] {
  const g = ensureGraph(ctx, count);
  const s = clampVertex(start, g.count);
  const adj = adjacency(g);
  const visited = new Set<number>([s]);
  const queue: number[] = [s];
  const order: number[] = [];
  const depth: Record<number, string> = { [s]: "0" };
  const states: Record<string, EdgeState> = {};

  const snap = (highlights: Record<number, Hex>, description: string, line: number) =>
    graphFrame(nodesOf(g, depth), edgesOf(g, { states }), highlights, `${description}    queue: [${queue.join(", ")}]`, line);

  const frames = [snap({ [s]: C.inspect }, `BFS from vertex ${s}. The queue holds the frontier; badges are distance in edges.`, 0)];

  while (queue.length) {
    const v = queue.shift() as number;
    order.push(v);
    frames.push(snap({ ...markAll(order, C.done), [v]: C.inspect }, `Dequeue ${v} and look at its neighbours`, 1));
    adj[v].forEach((w) => {
      if (visited.has(w)) {
        frames.push(snap({ ...markAll(order, C.done), [v]: C.inspect, [w]: C.faded }, `${w} is already visited — skip it`, 3));
        return;
      }
      visited.add(w);
      depth[w] = String(Number(depth[v]) + 1);
      states[edgeKey(v, w)] = "chosen";
      queue.push(w);
      frames.push(
        snap({ ...markAll(order, C.done), [v]: C.inspect, [w]: C.cursor }, `Discover ${w} at distance ${depth[w]} — enqueue it`, 2),
      );
    });
  }

  frames.push(
    snap(markAll(order, C.done), `Visited ${order.length} of ${g.count} vertices in order ${order.join(" → ")}. The highlighted edges form the BFS tree, and each badge is a genuine shortest distance from ${s}.`, 4),
  );
  return frames;
}

/** Depth-first search: the same loop with a stack, and a very different shape. */
export function graphDfsFrames(count: number, start: number, ctx: LabContext): GraphFrame[] {
  const g = ensureGraph(ctx, count);
  const s = clampVertex(start, g.count);
  const adj = adjacency(g);
  const visited = new Set<number>();
  const order: number[] = [];
  const states: Record<string, EdgeState> = {};
  const frames: GraphFrame[] = [];

  const snap = (highlights: Record<number, Hex>, description: string, line: number) =>
    graphFrame(nodesOf(g), edgesOf(g, { states }), highlights, description, line);

  frames.push(snap({ [s]: C.inspect }, `DFS from vertex ${s}. Go as deep as possible before backtracking.`, 0));

  const walk = (v: number, from: number | null) => {
    visited.add(v);
    order.push(v);
    if (from !== null) states[edgeKey(from, v)] = "chosen";
    frames.push(snap({ ...markAll(order.slice(0, -1), C.done), [v]: C.inspect }, `Visit ${v} (depth ${order.length})`, 1));
    adj[v].forEach((w) => {
      if (visited.has(w)) {
        states[edgeKey(v, w)] = states[edgeKey(v, w)] === "chosen" ? "chosen" : "rejected";
        return;
      }
      walk(w, v);
      frames.push(snap({ ...markAll(order, C.done), [v]: C.inspect }, `Backtrack to ${v}`, 2));
    });
  };

  walk(s, null);
  frames.push(
    snap(markAll(order, C.done), `Visited ${order.length} vertices: ${order.join(" → ")}. Compare the shape of this tree with the BFS one — same graph, same start, different edges.`, 3),
  );
  return frames;
}

/** Dijkstra. The badge on each vertex is its best known distance. */
export function graphDijkstraFrames(count: number, start: number, ctx: LabContext): GraphFrame[] {
  const g = ensureGraph(ctx, count);
  const s = clampVertex(start, g.count);
  const adj = weightedAdjacency(g);
  const dist = new Array<number>(g.count).fill(Infinity);
  const settled = new Set<number>();
  const states: Record<string, EdgeState> = {};
  dist[s] = 0;

  const badges = (): Record<number, string> =>
    Object.fromEntries(dist.map((d, i) => [i, d === Infinity ? "∞" : String(d)]));

  const snap = (highlights: Record<number, Hex>, description: string, line: number) =>
    graphFrame(nodesOf(g, badges()), edgesOf(g, { weighted: true, states }), highlights, description, line);

  const frames = [
    snap({ [s]: C.inspect }, `Dijkstra from ${s}. Every distance starts at ∞ except the source, which is 0.`, 0),
  ];

  let guard = 0;
  while (settled.size < g.count && guard < 10000) {
    guard += 1;
    let best = -1;
    for (let i = 0; i < g.count; i += 1) {
      if (!settled.has(i) && dist[i] < Infinity && (best === -1 || dist[i] < dist[best])) best = i;
    }
    if (best === -1) {
      frames.push(
        snap(markAll(Array.from(settled), C.done), "Every remaining vertex is still at ∞, so it cannot be reached from the source. Stop.", 5),
      );
      break;
    }
    settled.add(best);
    frames.push(
      snap({ ...markAll(Array.from(settled), C.done), [best]: C.inspect }, `The closest unsettled vertex is ${best} at distance ${dist[best]}. Because every weight is non-negative, no later path can beat it — so ${dist[best]} is final.`, 1),
    );

    adj[best].forEach(({ to, weight }) => {
      if (settled.has(to)) return;
      const candidate = dist[best] + weight;
      if (candidate < dist[to]) {
        const old = dist[to];
        dist[to] = candidate;
        states[edgeKey(best, to)] = "chosen";
        frames.push(
          snap({ ...markAll(Array.from(settled), C.done), [best]: C.inspect, [to]: C.cursor }, `Relax ${best} → ${to}: ${dist[best]} + ${weight} = ${candidate}, better than ${old === Infinity ? "∞" : old}`, 2),
        );
      } else {
        states[edgeKey(best, to)] = states[edgeKey(best, to)] === "chosen" ? "chosen" : "rejected";
        frames.push(
          snap({ ...markAll(Array.from(settled), C.done), [best]: C.inspect, [to]: C.faded }, `${best} → ${to} costs ${dist[best]} + ${weight} = ${candidate}, which is no better than ${dist[to]} — leave it`, 3),
        );
      }
    });
  }

  const reachable = dist.filter((d) => d < Infinity).length;
  frames.push(
    snap(markAll(Array.from(settled), C.done), `Done. ${reachable} of ${g.count} vertices are reachable, and each badge is the true shortest distance from ${s}.`, 4),
  );
  return frames;
}

/** Kruskal: sort the edges, take each one that does not close a cycle. */
export function graphKruskalFrames(count: number, ctx: LabContext): GraphFrame[] {
  const g = ensureGraph(ctx, count);
  const sortedEdges = g.edges.slice().sort((a, b) => a.weight - b.weight);
  const parent = Array.from({ length: g.count }, (_, i) => i);
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    return root;
  };
  const states: Record<string, EdgeState> = {};
  let total = 0;
  let taken = 0;

  const snap = (highlights: Record<number, Hex>, description: string, line: number) =>
    graphFrame(nodesOf(g), edgesOf(g, { weighted: true, states }), highlights, description, line);

  const frames = [
    snap({}, `Kruskal. Consider the edges cheapest first: ${sortedEdges.map((e) => e.weight).join(", ")}.`, 0),
  ];

  sortedEdges.forEach((e) => {
    const key = edgeKey(e.from, e.to);
    states[key] = "active";
    frames.push(snap({ [e.from]: C.inspect, [e.to]: C.inspect }, `Edge ${e.from}–${e.to}, weight ${e.weight}`, 1));
    const ra = find(e.from);
    const rb = find(e.to);
    if (ra === rb) {
      states[key] = "rejected";
      frames.push(snap({ [e.from]: C.remove, [e.to]: C.remove }, `${e.from} and ${e.to} are already connected — taking this edge would make a cycle, so reject it`, 3));
      return;
    }
    parent[ra] = rb;
    states[key] = "chosen";
    total += e.weight;
    taken += 1;
    frames.push(snap({ [e.from]: C.done, [e.to]: C.done }, `Different components — take it. Running total ${total}.`, 2));
  });

  frames.push(
    snap({}, `${taken} edge(s) taken, total weight ${total}. A spanning tree of ${g.count} vertices needs exactly ${g.count - 1} edges${taken === g.count - 1 ? "" : `, and this graph only yielded ${taken} — it is not connected`}.`, 4),
  );
  return frames;
}

/** Prim: grow one tree outward, always taking the cheapest edge leaving it. */
export function graphPrimFrames(count: number, start: number, ctx: LabContext): GraphFrame[] {
  const g = ensureGraph(ctx, count);
  const s = clampVertex(start, g.count);
  const adj = weightedAdjacency(g);
  const inTree = new Set<number>([s]);
  const states: Record<string, EdgeState> = {};
  let total = 0;

  const snap = (highlights: Record<number, Hex>, description: string, line: number) =>
    graphFrame(nodesOf(g), edgesOf(g, { weighted: true, states }), highlights, description, line);

  const frames = [snap({ [s]: C.done }, `Prim from ${s}. The tree grows one vertex at a time.`, 0)];

  let guard = 0;
  while (inTree.size < g.count && guard < 10000) {
    guard += 1;
    let best: { from: number; to: number; weight: number } | null = null;
    inTree.forEach((v) => {
      adj[v].forEach(({ to, weight }) => {
        if (inTree.has(to)) return;
        if (!best || weight < best.weight) best = { from: v, to, weight };
      });
    });
    const chosen = best as { from: number; to: number; weight: number } | null;
    if (!chosen) {
      frames.push(
        snap(markAll(Array.from(inTree), C.done), `No edge leaves the tree, so the remaining ${g.count - inTree.size} vertex/vertices are in another component. Prim finds a spanning tree of one component only.`, 4),
      );
      break;
    }
    states[edgeKey(chosen.from, chosen.to)] = "chosen";
    inTree.add(chosen.to);
    total += chosen.weight;
    frames.push(
      snap({ ...markAll(Array.from(inTree), C.done), [chosen.to]: C.move }, `Cheapest edge leaving the tree is ${chosen.from}–${chosen.to} at ${chosen.weight}. Add ${chosen.to}; total ${total}.`, 1),
    );
  }

  frames.push(
    snap(markAll(Array.from(inTree), C.done), `${inTree.size} vertices in the tree, total weight ${total}. Kruskal on the same graph reaches the same total by a different route.`, 3),
  );
  return frames;
}

/**
 * Topological sort (Kahn). The undirected graph is oriented low-index → high-index
 * first, which is guaranteed acyclic — a topological order only exists for a DAG,
 * so that orientation is the honest way to have one to find.
 */
export function graphTopoSortFrames(count: number, ctx: LabContext): GraphFrame[] {
  const g = ensureGraph(ctx, count);
  const directed = g.edges.map((e) => ({ from: Math.min(e.from, e.to), to: Math.max(e.from, e.to) }));
  const indegree = new Array<number>(g.count).fill(0);
  directed.forEach((e) => {
    indegree[e.to] += 1;
  });
  const out: number[][] = Array.from({ length: g.count }, () => []);
  directed.forEach((e) => out[e.from].push(e.to));

  const states: Record<string, EdgeState> = {};
  const order: number[] = [];
  const badges = (): Record<number, string> => Object.fromEntries(indegree.map((d, i) => [i, `in=${d}`]));

  const snap = (highlights: Record<number, Hex>, description: string, line: number, queue: number[]) =>
    graphFrame(
      nodesOf(g, badges()),
      g.edges.map((e) => ({
        from: Math.min(e.from, e.to),
        to: Math.max(e.from, e.to),
        directed: true,
        state: states[edgeKey(e.from, e.to)] ?? "idle",
      })),
      highlights,
      `${description}    ready: [${queue.join(", ")}]`,
      line,
    );

  const queue = indegree.map((d, i) => (d === 0 ? i : -1)).filter((i) => i >= 0);
  const frames = [
    snap({}, "Every edge is oriented from the lower vertex number to the higher, which makes this a DAG. Badges are in-degree; anything at 0 has no prerequisites.", 0, queue),
  ];

  let guard = 0;
  while (queue.length && guard < 10000) {
    guard += 1;
    const v = queue.shift() as number;
    order.push(v);
    frames.push(snap({ ...markAll(order, C.done), [v]: C.inspect }, `${v} has no remaining prerequisites — emit it (position ${order.length})`, 1, queue));
    out[v].forEach((w) => {
      indegree[w] -= 1;
      states[edgeKey(v, w)] = "chosen";
      if (indegree[w] === 0) {
        queue.push(w);
        frames.push(snap({ ...markAll(order, C.done), [w]: C.cursor }, `${w}'s in-degree reached 0 — it is now ready`, 2, queue));
      } else {
        frames.push(snap({ ...markAll(order, C.done), [w]: C.faded }, `${w}'s in-degree drops to ${indegree[w]} — still waiting`, 3, queue));
      }
    });
  }

  frames.push(
    order.length === g.count
      ? snap(markAll(order, C.done), `Topological order: ${order.join(" → ")}. Every edge points forwards in that list.`, 4, [])
      : snap(markAll(order, C.done), `Only ${order.length} of ${g.count} vertices could be emitted, which means the remainder contains a cycle — Kahn's algorithm detecting a cycle is the same thing as it getting stuck.`, 5, []),
  );
  return frames;
}

/** Cycle detection on the undirected graph, by DFS with a parent check. */
export function graphCycleFrames(count: number, ctx: LabContext): GraphFrame[] {
  const g = ensureGraph(ctx, count);
  const adj = adjacency(g);
  const visited = new Set<number>();
  const states: Record<string, EdgeState> = {};
  const stack: number[] = [];
  const frames: GraphFrame[] = [];

  const snap = (highlights: Record<number, Hex>, description: string, line: number) =>
    graphFrame(nodesOf(g), edgesOf(g, { states }), highlights, description, line);

  frames.push(snap({}, "DFS, tracking each vertex's parent. An edge back to an already-visited vertex that is not the parent closes a cycle.", 0));

  let found: { from: number; to: number } | null = null;

  const walk = (v: number, parent: number | null): boolean => {
    visited.add(v);
    stack.push(v);
    frames.push(snap({ ...markAll(stack.slice(0, -1), C.cursor), [v]: C.inspect }, `Visit ${v}; path so far ${stack.join(" → ")}`, 1));
    for (const w of adj[v]) {
      if (w === parent) continue;
      if (visited.has(w)) {
        states[edgeKey(v, w)] = "rejected";
        found = { from: v, to: w };
        frames.push(
          snap({ ...markAll(stack, C.cursor), [v]: C.remove, [w]: C.remove }, `Edge ${v}–${w} reaches ${w}, already visited and not ${v}'s parent — that is a cycle`, 2),
        );
        return true;
      }
      states[edgeKey(v, w)] = "chosen";
      if (walk(w, v)) return true;
      frames.push(snap({ ...markAll(stack, C.cursor), [v]: C.inspect }, `Backtrack to ${v}`, 3));
    }
    stack.pop();
    return false;
  };

  for (let v = 0; v < g.count && !found; v += 1) {
    if (!visited.has(v)) walk(v, null);
  }

  frames.push(
    found
      ? snap({ [(found as { from: number; to: number }).from]: C.remove, [(found as { from: number; to: number }).to]: C.remove }, `This graph contains a cycle.`, 4)
      : snap(markAll(Array.from(visited), C.done), "No back-edge was ever found, so this graph is acyclic — a forest.", 5),
  );
  return frames;
}

/** Connected components, by repeated BFS from each unvisited vertex. */
export function graphComponentsFrames(count: number, ctx: LabContext): GraphFrame[] {
  const g = ensureGraph(ctx, count);
  const adj = adjacency(g);
  const componentOf = new Array<number>(g.count).fill(-1);
  const palette: Hex[] = [C.done, C.cursor, C.window, C.move, C.inspect, C.remove];
  let components = 0;

  const highlightsNow = (): Record<number, Hex> => {
    const out: Record<number, Hex> = {};
    componentOf.forEach((c, i) => {
      if (c >= 0) out[i] = palette[c % palette.length];
    });
    return out;
  };
  const badges = (): Record<number, string> =>
    Object.fromEntries(componentOf.map((c, i) => [i, c >= 0 ? `#${c + 1}` : "?"]));

  const snap = (extra: Record<number, Hex>, description: string, line: number) =>
    graphFrame(nodesOf(g, badges()), edgesOf(g), { ...highlightsNow(), ...extra }, description, line);

  const frames = [snap({}, "Start a BFS from each vertex that has not been reached yet. Each sweep is one component.", 0)];

  for (let v = 0; v < g.count; v += 1) {
    if (componentOf[v] >= 0) continue;
    const id = components;
    components += 1;
    const queue = [v];
    componentOf[v] = id;
    frames.push(snap({ [v]: C.inspect }, `${v} has not been reached — it opens component #${id + 1}`, 1));
    while (queue.length) {
      const u = queue.shift() as number;
      adj[u].forEach((w) => {
        if (componentOf[w] >= 0) return;
        componentOf[w] = id;
        queue.push(w);
        frames.push(snap({ [w]: C.inspect }, `${w} is reachable from ${u}, so it belongs to component #${id + 1}`, 2));
      });
    }
    frames.push(snap({}, `Component #${id + 1} is closed — nothing else is reachable from it`, 3));
  }

  const sizes = Array.from({ length: components }, (_, c) => componentOf.filter((x) => x === c).length);
  frames.push(
    snap({}, `${components} component${components === 1 ? "" : "s"}, of size${sizes.length === 1 ? "" : "s"} ${sizes.join(", ")}.${components === 1 ? " Generate the graph again with more components to see this split up." : ""}`, 4),
  );
  return frames;
}

/** Two-colouring. A graph is bipartite exactly when this never conflicts. */
export function graphBipartiteFrames(count: number, ctx: LabContext): GraphFrame[] {
  const g = ensureGraph(ctx, count);
  const adj = adjacency(g);
  const colour = new Array<number>(g.count).fill(-1);
  const states: Record<string, EdgeState> = {};
  const PALETTE: Hex[] = [C.cursor, C.move];

  const highlightsNow = (): Record<number, Hex> => {
    const out: Record<number, Hex> = {};
    colour.forEach((c, i) => {
      if (c >= 0) out[i] = PALETTE[c];
    });
    return out;
  };
  const badges = (): Record<number, string> =>
    Object.fromEntries(colour.map((c, i) => [i, c < 0 ? "?" : c === 0 ? "A" : "B"]));

  const snap = (extra: Record<number, Hex>, description: string, line: number) =>
    graphFrame(nodesOf(g, badges()), edgesOf(g, { states }), { ...highlightsNow(), ...extra }, description, line);

  const frames = [
    snap({}, "Colour the graph with two colours so no edge joins two vertices of the same colour. If that is possible, the graph is bipartite.", 0),
  ];

  let conflict: { from: number; to: number } | null = null;

  for (let start = 0; start < g.count && !conflict; start += 1) {
    if (colour[start] >= 0) continue;
    colour[start] = 0;
    const queue = [start];
    frames.push(snap({ [start]: C.inspect }, `Give ${start} colour A`, 1));
    while (queue.length && !conflict) {
      const v = queue.shift() as number;
      for (const w of adj[v]) {
        if (colour[w] === -1) {
          colour[w] = 1 - colour[v];
          states[edgeKey(v, w)] = "chosen";
          queue.push(w);
          frames.push(snap({ [w]: C.inspect }, `${w} is adjacent to ${v}, so it must take the other colour: ${colour[w] === 0 ? "A" : "B"}`, 2));
        } else if (colour[w] === colour[v]) {
          states[edgeKey(v, w)] = "rejected";
          conflict = { from: v, to: w };
          frames.push(
            snap({ [v]: C.remove, [w]: C.remove }, `Edge ${v}–${w} joins two vertices that both have colour ${colour[v] === 0 ? "A" : "B"} — no two-colouring exists`, 3),
          );
          break;
        }
      }
    }
  }

  frames.push(
    conflict
      ? snap({}, "Not bipartite. A graph fails this test exactly when it contains an odd-length cycle.", 4)
      : snap({}, "Every edge joins an A to a B, so the graph is bipartite — the two colours are the two sides.", 5),
  );
  return frames;
}

/** Shown when no graph has been generated yet. */
export const graphPlaceholder = (): GraphFrame[] => [
  emptyGraphFrame("Run 'Generate graph' first"),
];
