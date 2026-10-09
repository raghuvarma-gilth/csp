/**
 * Disjoint sets and graphs.
 *
 * Both modules are `usesValues: false`: a graph is not a list of numbers, so the
 * "values" box would be meaningless here. They take a vertex **count** instead
 * and generate a layout, which is why `generate` is called with a node count and
 * why the graph lives on `ctx` — every operation in the module reads the same
 * generated graph, so running BFS and then Dijkstra compares two algorithms on
 * one graph rather than on two unrelated random ones.
 */

import * as dsu from "../algorithms/dsu";
import * as graph from "../algorithms/graph";
import { numberParam, type ModuleDef } from "../types";
import { num, op } from "./shared";

/* -------------------------------------------------------------------------- */
/* Disjoint set union                                                          */
/* -------------------------------------------------------------------------- */

const COUNT = num("count", "Elements", 8, 2, 16);

export const dsuModule: ModuleDef = {
  icon: "🔗",
  label: "Disjoint Set (DSU)",
  usesValues: false,
  ops: {
    reset: op(
      "Reset to singletons",
      "Basics",
      [COUNT],
      (_values, params, ctx) => dsu.dsuResetFrames(numberParam(params, "count", 8), ctx),
      [
        "parent[i] = i, rank[i] = 0 for every i        // n separate sets, each element its own root, and no work done yet",
      ],
      { Time: "O(n)", Space: "O(n)" },
    ),
    union: op(
      "Union by rank",
      "Basics",
      [COUNT, num("a", "First element", 1, 0), num("b", "Second element", 5, 0)],
      (_values, params, ctx) =>
        dsu.dsuUnionFrames(
          numberParam(params, "count", 8),
          numberParam(params, "a", 1),
          numberParam(params, "b", 5),
          ctx,
        ),
      [
        "function union(a, b):",
        "  ra = find(a); rb = find(b)",
        "  if ra == rb: return       // already together",
        "  attach the shorter tree under the taller one",
        "  if the ranks were equal: rank[new root] += 1",
        "// ranks only ever increase on a tie, so the tallest tree stays within log₂(n) — hanging the taller tree under the shorter one is what makes a naive DSU degenerate to O(n)",
      ],
      { Time: "O(α(n)) — effectively constant", Space: "O(n)" },
    ),
    find: op(
      "Find with path compression",
      "Basics",
      [COUNT, num("element", "Element", 3, 0)],
      (_values, params, ctx) =>
        dsu.dsuFindFrames(numberParam(params, "count", 8), numberParam(params, "element", 3), ctx),
      [
        "function find(x):                     // the root *is* the set's identity",
        "  parent[x] != x → climb to the parent",
        "  parent[x] == x → that is the root, and the hops taken were the path length",
        "  now walk the same path again, pointing every node straight at the root    // path compression",
        "// the query flattens the path it walked, so a later find on these nodes is a single hop: O(m · α(n)), and α(n) is below 5 for any n you will type",
      ],
      { Time: "O(α(n)) amortised", Space: "O(depth)" },
    ),
    components: op(
      "Count components",
      "Queries",
      [COUNT],
      (_values, params, ctx) => dsu.dsuComponentsFrames(numberParam(params, "count", 8), ctx),
      [
        "// group the elements by root: the same root means the same set",
        "for i in 0..n-1: roots.add(find(i))        // one set per distinct root",
        "return roots.size        // and 'are these two connected?' is now two finds and a comparison",
      ],
      { Time: "O(n · α(n))", Space: "O(n)" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Graph                                                                       */
/* -------------------------------------------------------------------------- */

const NODES = num("count", "Vertices", 8, 3, 14);
const START = num("start", "Start vertex", 0, 0);

export const graphModule: ModuleDef = {
  icon: "🕸",
  label: "Graph",
  usesValues: false,
  ops: {
    generate: op(
      "Generate a graph",
      "Basics",
      [NODES, num("components", "Components", 1, 1, 4, "Split the graph into this many pieces")],
      (_values, params, ctx) =>
        graph.graphGenerateFrames(
          numberParam(params, "count", 8),
          numberParam(params, "components", 1),
          ctx,
        ),
      [
        "// vertices on a circle, then weighted edges — and every other operation in this module runs on this same graph, so you compare two algorithms rather than two random graphs (set components > 1 for the disconnected cases)",
      ],
      { Vertices: "n", Edges: "roughly 1.5n", Space: "O(n + m)" },
    ),
    bfs: op(
      "Breadth-first search",
      "Traversal",
      [NODES, START],
      (_values, params, ctx) =>
        graph.graphBfsFrames(numberParam(params, "count", 8), numberParam(params, "start", 0), ctx),
      [
        "queue = [start]; seen = {start}        // the queue is the frontier; badges are distance in edges",
        "  v = queue.dequeue(); visit(v)        // then look at each of its neighbours",
        "  neighbour u not in seen → seen.add(u); queue.enqueue(u), one edge further out",
        "  u already in seen → skip it; it was already reached by an equal or shorter path",
        "// vertices come out in order of edge count from the start, which is why BFS finds shortest paths on an unweighted graph",
      ],
      { Time: "O(n + m)", Space: "O(n)" },
    ),
    dfs: op(
      "Depth-first search",
      "Traversal",
      [NODES, START],
      (_values, params, ctx) =>
        graph.graphDfsFrames(numberParam(params, "count", 8), numberParam(params, "start", 0), ctx),
      [
        "// go as deep as possible before backtracking — here the recursion *is* the stack",
        "  seen.add(v); visit(v), then recurse into the first neighbour not yet seen",
        "  that call returned → backtrack to v and try its next neighbour",
        "// the same loop as BFS with a stack instead of a queue, and a completely different shape of exploration",
      ],
      { Time: "O(n + m)", Space: "O(n)" },
    ),
    dijkstra: op(
      "Dijkstra's shortest paths",
      "Shortest paths",
      [NODES, START],
      (_values, params, ctx) =>
        graph.graphDijkstraFrames(numberParam(params, "count", 8), numberParam(params, "start", 0), ctx),
      [
        "dist[start] = 0; all others = ∞",
        "  settle the unsettled vertex with the smallest dist    // non-negative weights mean no later path can beat it, so that distance is final",
        "  relax each edge (v, u, w): dist[v] + w < dist[u] → dist[u] = dist[v] + w",
        "  otherwise the route already known to u is as good or better — leave it alone",
        "// settling the smallest first is the whole proof, and it is exactly what breaks on negative weights",
        "  every unsettled vertex still at ∞ → nothing left is reachable from the source, so stop",
      ],
      { Time: "O(n² ) here, O(m log n) with a heap", Space: "O(n)", Note: "requires non-negative weights" },
    ),
    kruskal: op(
      "Kruskal's MST",
      "Spanning trees",
      [NODES],
      (_values, params, ctx) => graph.graphKruskalFrames(numberParam(params, "count", 8), ctx),
      [
        "sort every edge by weight",
        "for each edge (a, b, w) in that order:",
        "  find(a) != find(b) → take the edge, and union(a, b)",
        "  find(a) == find(b) → they are already connected, so this edge would close a cycle; skip it",
        "// edge-driven, and it needs a DSU to answer 'are these already connected?' quickly. A spanning tree of n vertices has exactly n−1 edges.",
      ],
      { Time: "O(m log m)", Space: "O(n)", Needs: "a disjoint-set structure" },
    ),
    prim: op(
      "Prim's MST",
      "Spanning trees",
      [NODES, START],
      (_values, params, ctx) =>
        graph.graphPrimFrames(numberParam(params, "count", 8), numberParam(params, "start", 0), ctx),
      [
        "tree = {start}",
        "  pick the lightest edge with exactly one end in the tree, and add it along with its far vertex",
        "  // ties are broken arbitrarily — any of them still yields a minimum spanning tree",
        "// vertex-driven: the tree grows outward from one point. Same total weight as Kruskal, a different order of discovery.",
        "  no edge leaves the tree → the rest of the graph is a separate component, and Prim spans only this one",
      ],
      { Time: "O(n²) here, O(m log n) with a heap", Space: "O(n)" },
    ),
    topoSort: op(
      "Topological sort (Kahn)",
      "Ordering",
      [NODES],
      (_values, params, ctx) => graph.graphTopoSortFrames(numberParam(params, "count", 8), ctx),
      [
        "compute indegree[v] for every vertex; the ready queue is everything sitting at 0",
        "  dequeue v and append it to the order        // nothing is waiting on it any more",
        "  for each edge (v, u): --indegree[u], and at 0 it joins the ready queue",
        "  still above 0 → u keeps waiting on its other prerequisites",
        "// every edge points forwards in the finished order, which is what makes it a valid schedule",
        "if the order is shorter than n: the graph has a cycle      // the failure case is the useful one — this is how you detect a circular dependency",
      ],
      { Time: "O(n + m)", Space: "O(n)", Requires: "a directed acyclic graph" },
    ),
    cycle: op(
      "Cycle detection",
      "Queries",
      [NODES],
      (_values, params, ctx) => graph.graphCycleFrames(numberParam(params, "count", 8), ctx),
      [
        "// DFS tracking each vertex's parent — that parent check is the entire difference between 'undirected cycle' and 'every single edge'",
        "  seen.add(v), then try each neighbour u that is not the edge we came in on",
        "  u is already in seen → that edge closes a cycle",
        "  u is unseen → recurse into it, and backtrack here when that call returns",
        "// a back-edge was found: this graph is not a forest",
        "// no back-edge was ever found, so every component is a tree — the graph is acyclic",
      ],
      { Time: "O(n + m)", Space: "O(n)" },
    ),
    components: op(
      "Connected components",
      "Queries",
      [NODES],
      (_values, params, ctx) => graph.graphComponentsFrames(numberParam(params, "count", 8), ctx),
      [
        "// start a BFS from each vertex not yet reached; each sweep is exactly one component",
        "  v was never reached → count a new component and start flooding from there",
        "  every vertex the flood reaches belongs to that same component",
        "  the queue ran dry → the component is closed, and nothing outside it is reachable",
        "// generate the graph with components > 1 to watch this find them",
      ],
      { Time: "O(n + m)", Space: "O(n)" },
    ),
    bipartite: op(
      "Bipartite check (2-colouring)",
      "Queries",
      [NODES],
      (_values, params, ctx) => graph.graphBipartiteFrames(numberParam(params, "count", 8), ctx),
      [
        "// two colours, and no edge may join two vertices of the same colour",
        "colour[start] = A, then BFS outward from it",
        "  neighbour u unset  → colour[u] = 1 - colour[v], enqueue u",
        "  colour[u] == colour[v] → that edge breaks the colouring",
        "  // so there is no two-colouring: the graph holds an odd-length cycle",
        "// every edge joining an A to a B is exactly what bipartite means",
      ],
      { Time: "O(n + m)", Space: "O(n)" },
    ),
  },
};
