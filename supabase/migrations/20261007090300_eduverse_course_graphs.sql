-- ============================================================================
-- EduVerse — Course 5: Graphs (CS205)
-- ----------------------------------------------------------------------------
-- Closes the Graphs group of the visual lab: seven visualisations that had no
-- lesson before this file.
--
-- The course is built on one claim made in CS203 and paid off here: BFS and DFS
-- are the same algorithm with a different container, and a graph is just a tree
-- that has stopped promising there is only one route to each node. Everything
-- new in this course is a consequence of that one loss — hence `visited`, hence
-- cycles, hence union-find.
--
-- Conventions as in the earlier seed migrations: no invented `diagram:` keys,
-- callouts parsed by Markdown.tsx, slug lookups scoped through chapters to a
-- named course, every statement idempotent.
--
-- Graphs are posed to the grader as adjacency lists in plain JSON — an array of
-- arrays, where entry i lists the neighbours of node i — so no graph type is
-- needed and the harness compares ordinary values.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Course
-- ---------------------------------------------------------------------------
INSERT INTO public.courses (slug, code, title, description, subject, status, position)
VALUES (
  'graphs-and-networks',
  'CS205',
  'Graphs & Networks',
  'What changes when a node can be reached by more than one route. Traversal that must remember where it has been, ordering work under dependencies, shortest paths when edges have weights, and the two ways to build a minimum spanning tree.',
  'Computer Science',
  'published',
  5
)
ON CONFLICT (slug) DO UPDATE
  SET code = EXCLUDED.code,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      position = EXCLUDED.position;

-- ---------------------------------------------------------------------------
-- 2. Chapters
-- ---------------------------------------------------------------------------
INSERT INTO public.chapters (course_id, slug, title, description, status, position)
SELECT c.id, v.slug, v.title, v.description, 'published'::public.content_status, v.position
FROM public.courses c
CROSS JOIN (VALUES
  ('graph-traversal', 'Traversal & Ordering',
   'The same two walks as a tree, plus the one thing a graph forces on you: a record of where you have already been.', 1),
  ('weighted-graphs', 'Weights & Connectivity',
   'When edges cost different amounts, a breadth-first wave is no longer shortest. Dijkstra, union-find, and the two minimum spanning tree algorithms.', 2)
) AS v(slug, title, description, position)
WHERE c.slug = 'graphs-and-networks'
ON CONFLICT (course_id, slug) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      position = EXCLUDED.position;

-- ---------------------------------------------------------------------------
-- 3. Concepts
-- ---------------------------------------------------------------------------
INSERT INTO public.concepts (chapter_id, slug, title, summary, content, difficulty, estimated_minutes, visual_key, status, position)
SELECT ch.id, v.slug, v.title, v.summary, v.content, v.difficulty, v.minutes, v.visual_key,
       'published'::public.content_status, v.position
FROM public.chapters ch
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'graphs-and-networks'
JOIN (VALUES

-- === Chapter 1: Traversal & Ordering ======================================
('graph-traversal', 'graph-breadth-first-search', 'Breadth-First Search on Graphs',
 'A tree traversal plus one set. The wave spreads level by level, which is why BFS finds shortest paths when every edge costs the same.',
 $md$## What a graph adds

A tree guarantees exactly one path from the root to any node. A graph makes no such promise: a node may be reachable by several routes, and a route may lead back where it started.

That single loss creates one new obligation. Without it, traversal revisits nodes forever:

```python
from collections import deque

def bfs(adj, start):
    seen = {start}                     # THE addition
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in adj[node]:
            if nxt not in seen:        # without this, infinite
                seen.add(nxt)
                queue.append(nxt)
    return order
```

Compare that with the tree version from CS203 and the only new lines are `seen`. Everything else — the queue, the drain loop, the append of neighbours — is unchanged.

:::key
`seen.add(nxt)` happens **when the node is enqueued**, not when it is dequeued. If you mark on dequeue, a node with three edges into it is enqueued three times before any of them is processed, so it is visited repeatedly and the queue can grow to O(E). Marking on enqueue guarantees each node enters the queue exactly once.

This is the single most common BFS bug and it does not crash — it just does extra work and can report wrong distances.
:::

## Representing a graph

| Representation | Space | "Are u and v adjacent?" | "List u's neighbours" |
|---|---|---|---|
| **Adjacency list** | O(V + E) | O(degree) | **O(degree)** |
| Adjacency matrix | O(V²) | **O(1)** | O(V) |

Traversal only ever asks the second question, so adjacency lists are the default: `adj[u]` is the list of nodes reachable from `u`. A matrix is worth it only for dense graphs or when you query specific pairs.

## Shortest paths, for free

BFS dequeues nodes in nondecreasing order of distance from the start. So the first time it reaches a node, it has arrived by a path with the fewest edges.

```python
def shortest_hops(adj, start):
    dist = {start: 0}
    queue = deque([start])
    while queue:
        node = queue.popleft()
        for nxt in adj[node]:
            if nxt not in dist:
                dist[nxt] = dist[node] + 1
                queue.append(nxt)
    return dist
```

`dist` doubles as the `seen` set — a node has a distance exactly when it has been reached.

:::example
```
0 — 1 — 3
|   |
2 — 4
```
BFS from 0: dequeue 0 (dist 0), enqueue 1 and 2 at dist 1. Dequeue 1, enqueue 3 and 4 at dist 2. Dequeue 2 — its neighbour 4 is already seen, so nothing happens. Dequeue 3, dequeue 4.

Distances: `{0:0, 1:1, 2:1, 3:2, 4:2}`. Node 4 is reachable via 1 or via 2, both two hops; BFS recorded whichever it met first and the distance is the same either way.
:::

## Where it stops working

:::pitfall
BFS finds the path with the fewest **edges**, not the cheapest path. The moment edges carry different weights, "fewest edges" and "lowest total cost" stop agreeing: a two-edge route costing 1 + 1 beats a one-edge route costing 10, and BFS returns the one-edge route.

This is exactly the gap Dijkstra's algorithm fills, by replacing the queue with a priority queue. BFS is the special case where every weight is 1.
:::

## Reconstructing the path

Distances alone do not tell you the route. Record each node's predecessor as you reach it, then walk back:

```python
parent = {start: None}
...
    if nxt not in parent:
        parent[nxt] = node
        queue.append(nxt)

def path_to(parent, target):
    out = []
    while target is not None:
        out.append(target)
        target = parent[target]
    return out[::-1]
```

## What BFS is the right tool for

- **Shortest path in an unweighted graph** — its defining use
- **Connected components** — BFS from every unvisited node; each run marks one component
- **Bipartiteness** — two-colour the graph by level; an edge within a level means it is not bipartite
- **Shortest path in a grid** — a grid is a graph whose neighbours are the four adjacent cells, which is why the maze and flood-fill visualisations are the same algorithm as this one
- **Multi-source BFS** — seed the queue with every source at distance 0, and one pass gives each node its distance to the *nearest* source

That last trick is worth remembering: "nearest of many starting points" needs no extra machinery, just a queue that begins with more than one node.$md$,
 3, 28, 'graph-bfs', 1),

('graph-traversal', 'graph-depth-first-search', 'Depth-First Search & Cycle Detection',
 'Swap the queue for a stack and the wave becomes a probe. The recursion state is what lets DFS detect cycles and decompose structure.',
 $md$## The same algorithm again

```python
def dfs(adj, start):
    seen = set()
    order = []
    def go(node):
        seen.add(node)
        order.append(node)
        for nxt in adj[node]:
            if nxt not in seen:
                go(nxt)
    go(start)
    return order
```

Or iteratively, with the queue from the previous lesson replaced by a stack:

```python
def dfs_iterative(adj, start):
    seen, stack, order = set(), [start], []
    while stack:
        node = stack.pop()              # pop() not popleft()
        if node in seen:
            continue                    # may have been queued twice
        seen.add(node)
        order.append(node)
        for nxt in reversed(adj[node]):
            if nxt not in seen:
                stack.append(nxt)
    return order
```

:::pitfall
The iterative version needs the `if node in seen: continue` guard that BFS does not. A node can be pushed onto the stack by two different neighbours before either pop happens, so duplicates on the stack are unavoidable and must be filtered on pop. Marking on push — the BFS discipline — breaks DFS ordering, because a node pushed early but popped late would be marked long before it is visited.
:::

## What DFS gives that BFS does not

BFS knows distances. DFS knows **structure**, because at any moment the recursion stack is exactly the path from the start to the current node. That standing path is what the rest of this lesson uses.

| | BFS | DFS |
|---|---|---|
| Container | queue | stack (or recursion) |
| Finds | shortest unweighted path | *a* path |
| Space | O(width) | O(depth) |
| Natural for | distances, levels | cycles, ordering, components |

## Cycle detection in a directed graph

A cycle exists when DFS finds an edge back to a node that is **currently on the recursion stack**. Three states are needed, and two are not enough:

```python
WHITE, GREY, BLACK = 0, 1, 2          # unseen, on the stack, finished

def has_cycle(adj, n):
    colour = [WHITE] * n
    def go(u):
        colour[u] = GREY
        for v in adj[u]:
            if colour[v] == GREY:      # back edge: u reaches an ancestor
                return True
            if colour[v] == WHITE and go(v):
                return True
        colour[u] = BLACK              # fully explored
        return False
    return any(colour[u] == WHITE and go(u) for u in range(n))
```

:::key
**Why `seen` alone is wrong.** A plain visited set cannot distinguish "I am still inside this node's exploration" from "I finished with it earlier". In the diamond `0→1, 0→2, 1→3, 2→3`, node 3 is reached twice and there is no cycle. A two-state check reports one; the GREY/BLACK split does not, because by the time 2 reaches 3 it is BLACK, not GREY.

GREY means *on the current path*. Only an edge into a GREY node is a cycle.
:::

:::example
`0→1, 1→2, 2→0`

`go(0)`: 0 GREY. `go(1)`: 1 GREY. `go(2)`: 2 GREY. Node 2's neighbour is 0, which is **GREY** — a cycle. The GREY nodes at that moment are {0,1,2}, which is the cycle itself.
:::

## Undirected graphs are different

In an undirected graph every edge is traversable both ways, so from `v` you can always step back to the parent you came from. That is not a cycle — it is the same edge. Track the parent and ignore it:

```python
def has_cycle_undirected(adj, n):
    seen = [False] * n
    def go(u, parent):
        seen[u] = True
        for v in adj[u]:
            if not seen[v]:
                if go(v, u): return True
            elif v != parent:          # a real second route to v
                return True
        return False
    return any(not seen[u] and go(u, -1) for u in range(n))
```

With parallel edges, comparing parent *nodes* is not enough — you must ignore the specific edge you arrived on.

## What DFS decomposes

- **Connected components** — one DFS per unvisited node
- **Topological order** — the next lesson; it is DFS post-order reversed
- **Bridges and articulation points** — edges or nodes whose removal disconnects the graph, found with one DFS tracking discovery times
- **Strongly connected components** — Tarjan's and Kosaraju's algorithms, both DFS

:::pitfall
Recursive DFS is O(depth) stack space, and a path graph of 10⁵ nodes has depth 10⁵ — well past Python's default recursion limit of 1000, and enough to overflow a typical native stack. Any DFS over large input should be iterative, which is the same argument made about recursive list reversal in CS202.
:::$md$,
 3, 28, 'graph-dfs', 2),

('graph-traversal', 'topological-sort', 'Topological Sort',
 'Order tasks so every dependency comes first. Two algorithms, and both double as cycle detectors.',
 $md$## The problem

Given tasks with dependencies — this before that — produce an order in which every task appears after everything it depends on. Build systems, course prerequisites, spreadsheet recalculation and package managers all solve exactly this.

The input is a **directed acyclic graph**: an edge `u → v` means u must come before v. A topological order exists **if and only if** the graph has no cycle, because a cycle is a set of tasks each waiting on the next.

:::key
This is the data structure behind the Roadmap page in this application. `concept_prerequisites` is a directed graph, and "which concepts can I start now" is a topological question — which is also why that table has a CHECK constraint preventing a concept from being its own prerequisite.
:::

## Kahn's algorithm (BFS-shaped)

Count how many unmet dependencies each node has. Repeatedly take a node with none left, output it, and decrement its successors.

```python
from collections import deque

def topo_kahn(adj, n):
    indeg = [0] * n
    for u in range(n):
        for v in adj[u]:
            indeg[v] += 1

    queue = deque(u for u in range(n) if indeg[u] == 0)
    order = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:          # last dependency just cleared
                queue.append(v)

    return order if len(order) == n else None      # None => cycle
```

**O(V + E)** — each node is enqueued once and each edge decremented once.

:::key
The final check is the cycle detector, and it is free. If the graph has a cycle, every node in it keeps a positive in-degree forever — nothing can ever clear the last dependency — so those nodes are never enqueued and `len(order) < n`. One comparison tells you whether a valid order exists.
:::

:::example
`0→1, 0→2, 1→3, 2→3`

In-degrees: `[0, 1, 1, 2]`. Queue starts `[0]`.

| step | output | decremented | queue |
|---|---|---|---|
| pop 0 | 0 | 1→0, 2→0 | 1, 2 |
| pop 1 | 0,1 | 3→1 | 2 |
| pop 2 | 0,1,2 | 3→0 | 3 |
| pop 3 | 0,1,2,3 | — | — |

Four of four nodes — no cycle. Note 3 was only enqueued when **both** its dependencies had cleared, which is the whole point of counting rather than just marking.
:::

## DFS post-order, reversed

The other algorithm: run DFS, and when a node is **finished** — all its descendants explored — push it onto a list. Reverse the list at the end.

```python
def topo_dfs(adj, n):
    colour = [0] * n                   # 0 white, 1 grey, 2 black
    out = []
    def go(u):
        colour[u] = 1
        for v in adj[u]:
            if colour[v] == 1: return False        # cycle
            if colour[v] == 0 and not go(v): return False
        colour[u] = 2
        out.append(u)                  # AFTER the children
        return True
    for u in range(n):
        if colour[u] == 0 and not go(u):
            return None
    return out[::-1]
```

**Why reversing works:** a node is appended only after everything reachable from it, so in `out` every node appears *before* its dependencies. Reversing puts dependencies first.

:::pitfall
`out.append(u)` must come after the loop over neighbours — this is post-order. Appending before the loop gives pre-order, which is not a topological order: a node would be emitted before the descendants it depends on, and the result looks plausible while being wrong on any non-trivial graph.
:::

## Choosing between them

| | Kahn | DFS |
|---|---|---|
| Shape | iterative BFS | recursion |
| Cycle report | `len(order) < n` | an edge to a GREY node |
| Names the cycle | no | **yes** — the GREY stack |
| Deep graphs | **safe** | risks stack overflow |
| Lexicographically smallest order | **yes**, with a heap | no |

Kahn's is usually the better default: iterative, and swapping its queue for a **min-heap** yields the alphabetically first valid order — which is what a build tool wants for reproducible output. DFS is preferable when you need to *report* the cycle, since the GREY nodes are the cycle itself, and that is what a package manager prints when it finds a circular dependency.

## Orders are not unique

`0→1, 0→2` admits both `0,1,2` and `0,2,1`. Any order respecting every edge is correct, so a grader must verify the constraints rather than compare against one expected answer. Uniqueness holds only when the graph contains a Hamiltonian path — a chain through every node.

## Beyond ordering

On a DAG, topological order makes other problems easy. Process nodes in that order and every predecessor is already finalised, so **longest path** — NP-hard in general graphs — becomes a single linear pass. The same trick gives shortest paths on a DAG even with negative edge weights, which Dijkstra cannot handle at all.$md$,
 4, 28, 'topological-sort', 3),

-- === Chapter 2: Weights & Connectivity ====================================
('weighted-graphs', 'dijkstra', 'Dijkstra''s Shortest Path',
 'BFS with a priority queue. Always expand the nearest unfinalised node — and that greedy choice is only safe because weights are non-negative.',
 $md$## Why BFS is not enough

BFS finds the path with the fewest edges. With weights, fewest edges and cheapest total stop agreeing:

```
0 --1--> 1 --1--> 2
 \                 ^
  \-------10-------/
```

BFS reaches node 2 in one hop via the weight-10 edge and reports that. The actual cheapest route is `0→1→2`, costing 2.

The fix is to stop expanding in order of *hop count* and start expanding in order of *accumulated cost* — which means replacing the queue with a priority queue.

## The algorithm

```python
import heapq

def dijkstra(adj, n, start):            # adj[u] = [(v, weight), ...]
    dist = [float('inf')] * n
    dist[start] = 0
    pq = [(0, start)]                   # (distance so far, node)

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue                    # stale entry; already improved
        for v, w in adj[u]:
            nd = d + w
            if nd < dist[v]:            # found a cheaper route to v
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return dist
```

**O((V + E) log V)** with a binary heap.

:::key
When a node is popped with `d == dist[u]`, its distance is **final**. The proof is short: everything still in the queue has distance ≥ d, and every edge weight is ≥ 0, so no future path can arrive at u for less than d. There is nothing cheaper left to find.

That argument is the entire algorithm, and it is also exactly where the non-negativity requirement enters.
:::

## The lazy-deletion detail

A binary heap cannot cheaply lower the priority of an element already inside it. So instead of updating, this version **pushes a second entry** and ignores the obsolete one when it surfaces — that is what `if d > dist[u]: continue` is for.

:::pitfall
Omitting that guard does not give wrong distances, because the `nd < dist[v]` test still filters improvements. It gives wrong *performance*: every stale entry is expanded again, and on a dense graph that is a large constant factor. The heap can hold O(E) entries, which is why the bound is log V per edge rather than log V per node.
:::

:::example
Edges `0→1 (1)`, `1→2 (1)`, `0→2 (10)`, from node 0.

| pop | d | updates | heap |
|---|---|---|---|
| (0,0) | 0 | dist[1]=1, dist[2]=10 | (1,1), (10,2) |
| (1,1) | 1 | dist[2]=2 (beats 10) | (2,2), (10,2) |
| (2,2) | 2 | none | (10,2) |
| (10,2) | 10 | **stale**: 10 > dist[2]=2 → skip | — |

Final: `[0, 1, 2]`. Node 2 was reached first at cost 10 and later improved to 2; the obsolete heap entry was discarded on arrival.
:::

## Negative weights break it

:::pitfall
```
0 --2--> 1 --(-5)--> 2
 \                    ^
  \---------1---------/
```

Dijkstra pops node 2 at distance 1 via the direct edge and **finalises** it. The route `0→1→2` costs 2 − 5 = −3, but node 2 is already settled and never reconsidered.

The failure is not a bug in the code — it is the correctness proof collapsing. "Nothing in the queue can beat d" assumed adding an edge never *reduces* the total. Use **Bellman–Ford** (O(VE)) for negative edges; it also detects negative cycles, where no shortest path exists because you can loop forever getting cheaper.
:::

## Variants worth knowing

- **Target early exit** — pop the destination and stop; no need to finalise the rest
- **Path reconstruction** — store a predecessor whenever `dist[v]` improves, then walk back
- **All weights equal** — Dijkstra degenerates into BFS; use BFS, it is cheaper
- **Weights 0 or 1 only** — use a deque, pushing 0-edges to the front and 1-edges to the back: **O(V + E)**, no heap
- **A\*** — add a lower-bound estimate of the remaining distance to the priority; identical structure, explores far less of the graph

The structural point is that BFS, 0–1 BFS, Dijkstra and A\* are one algorithm distinguished by the container and the priority: a queue, a deque, a heap keyed on cost, a heap keyed on cost plus a heuristic. That is the same observation made about BFS and DFS in CS203, applied once more.$md$,
 4, 32, 'dijkstra', 1),

('weighted-graphs', 'disjoint-set-union', 'Disjoint Set Union (Union-Find)',
 'Two tricks — union by rank and path compression — make "are these in the same group?" effectively constant time.',
 $md$## The problem

Maintain a collection of disjoint groups under two operations:

- `find(x)` — which group is x in?
- `union(x, y)` — merge the two groups containing x and y

Nothing here asks for the *members* of a group, only for identity. That restriction is what makes the structure so fast.

## The naive version, and why it is slow

Represent each group as a tree, where every node points at a parent and the root names the group:

```python
parent = list(range(n))                # each element its own group

def find(x):
    while parent[x] != x:
        x = parent[x]
    return x

def union(x, y):
    parent[find(x)] = find(y)
```

Correct, and **O(n)** per operation in the worst case: `union(0,1), union(1,2), union(2,3)…` builds a chain, and `find` walks it. This is the degenerate-tree problem from CS203 in a new costume.

## Trick 1 — union by size or rank

Always attach the **smaller** tree under the larger root. The shallower tree's nodes gain a level; the deeper tree's nodes do not move:

```python
def union(x, y):
    rx, ry = find(x), find(y)
    if rx == ry:
        return False                   # already together
    if size[rx] < size[ry]:
        rx, ry = ry, rx                # rx is the bigger root
    parent[ry] = rx
    size[rx] += size[ry]
    return True
```

A tree's depth can only grow when it is merged with one at least as large, so reaching depth d requires at least 2^d elements: **height O(log n)** by itself.

## Trick 2 — path compression

While finding a root, point every node on the path straight at it. The work was already being done; recording it is free:

```python
def find(x):
    root = x
    while parent[root] != root:
        root = parent[root]
    while parent[x] != root:           # second pass: re-point
        parent[x], x = root, parent[x]
    return root
```

Or recursively, which is the version usually written:

```python
def find(x):
    if parent[x] != x:
        parent[x] = find(parent[x])    # assign on the way back up
    return parent[x]
```

:::key
Together the two tricks give **O(α(n))** amortised per operation, where α is the inverse Ackermann function. For every n that fits in the universe, α(n) < 5 — so it is constant for all practical purposes, though not literally O(1).

Either trick alone gives O(log n). Both together give near-constant. This is one of the few places where two independent optimisations compose into a strictly better bound than either implies.
:::

:::pitfall
In the recursive `find`, the assignment `parent[x] = find(parent[x])` is the compression. Writing `return find(parent[x])` without storing the result is a correct `find` that compresses nothing, so the structure stays O(log n) and the reason is invisible — the function still returns the right answer.
:::

:::example
`parent = [0,0,1,2]` — a chain 3→2→1→0.

`find(3)` walks 3→2→1→0 and then re-points: `parent = [0,0,0,0]`. Every subsequent `find` on any of those nodes is a single step. The walk was going to happen anyway; compression just records what it learned.
:::

## What it is for

**Cycle detection while building.** If `union(u, v)` returns `False`, u and v were already connected, so the edge `(u,v)` closes a cycle. That one line is the whole of Kruskal's algorithm's correctness, which is the next lesson.

**Connected components, incrementally.** DFS computes components in O(V+E) but must be re-run when an edge is added. Union-find absorbs a new edge in near-constant time, so it is the right structure when edges arrive over time.

**Equivalence under constraints** — "are these accounts the same person", "do these cells belong to one region", percolation, and Kruskal.

:::pitfall
Union-find supports union, not **split**. There is no efficient way to remove an edge or separate a group, because path compression has destroyed the original structure. Problems that delete edges are usually solved by processing the edges in reverse and adding them instead — a standard "offline" trick.
:::

## Comparison

| | DFS/BFS | Union-find |
|---|---|---|
| Build components | O(V + E) | O(E·α) |
| Add an edge | re-run | **O(α)** |
| Query connectivity | O(1) after build | **O(α)** |
| Remove an edge | re-run | **not supported** |
| Lists a component's members | **yes** | no |

Union-find answers less and answers it faster. That is the same trade hash tables made against trees in CS202: give up a question you do not need, and the one you do need gets cheap.$md$,
 4, 28, 'disjoint-set', 2),

('weighted-graphs', 'kruskal-mst', 'Kruskal''s Minimum Spanning Tree',
 'Sort the edges and take every one that does not close a cycle. Union-find is what makes the cycle test fast.',
 $md$## The problem

A **spanning tree** connects every node using exactly V−1 edges and no cycle. A **minimum** spanning tree is one of least total weight — the cheapest way to wire a network so everything is reachable.

## The algorithm

Sort all edges by weight. Walk them cheapest first, keeping each edge unless it would close a cycle.

```python
def kruskal(n, edges):                  # edges = [(w, u, v), ...]
    edges.sort()
    parent, size = list(range(n)), [1] * n

    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    total, chosen = 0, []
    for w, u, v in edges:
        ru, rv = find(u), find(v)
        if ru == rv:
            continue                     # same component: cycle
        if size[ru] < size[rv]: ru, rv = rv, ru
        parent[rv] = ru
        size[ru] += size[rv]
        total += w
        chosen.append((u, v, w))
        if len(chosen) == n - 1:
            break                        # a spanning tree is complete
    return total, chosen
```

**O(E log E)** — dominated by the sort; the union-find work is O(E·α), effectively linear.

:::key
"Would this edge close a cycle?" is exactly "are its endpoints already in the same component?", which is one `find` comparison. Without union-find you would run a DFS per edge — O(VE) overall. The previous lesson is not a prerequisite by convention; Kruskal is impractical without it.
:::

:::example
Nodes 0–3, edges `(1,0,1) (2,1,2) (3,0,2) (4,2,3)`.

| edge | w | endpoints | same comp? | action | total |
|---|---|---|---|---|---|
| 0–1 | 1 | {0},{1} | no | take | 1 |
| 1–2 | 2 | {0,1},{2} | no | take | 3 |
| 0–2 | 3 | {0,1,2} | **yes** | skip | 3 |
| 2–3 | 4 | {0,1,2},{3} | no | take | 7 |

Three edges for four nodes — complete. Total 7. Edge 0–2 was skipped because 0 and 2 were already connected more cheaply.
:::

## Why greedy is correct here

Greedy algorithms are usually wrong, and it is worth knowing why this one is not.

:::key
**The cut property.** Take any partition of the nodes into two sides. The cheapest edge crossing that partition belongs to *some* MST.

Sketch: suppose an MST omits that cheapest crossing edge e. The tree still connects both sides, so it uses some other crossing edge f, with weight(f) ≥ weight(e). Swap f for e — still spanning, still a tree, and no heavier. So an MST containing e exists.

Every edge Kruskal accepts is the cheapest edge crossing the cut between the component it joins and everything else, so each choice is safe. The greedy choice never needs revisiting, which is why there is no backtracking.
:::

## Ties, and uniqueness

If all edge weights are distinct the MST is unique. With ties there may be several MSTs of equal total weight — all equally correct, so a grader must compare the **total**, not the edge set.

## Kruskal versus Prim

Both are greedy, both produce an MST, and they differ in what "cheapest next" means.

| | Kruskal | Prim |
|---|---|---|
| Grows | many fragments at once | **one** connected tree |
| Needs | sorted edges + union-find | priority queue |
| Cost | O(E log E) | O(E log V) |
| Best for | **sparse** graphs | **dense** graphs |
| Edge list vs matrix | edge list | adjacency list/matrix |

Kruskal considers edges globally and lets the forest coalesce; Prim keeps one tree and only ever looks at edges on its frontier. On a sparse graph E is small and sorting is cheap, so Kruskal wins. On a dense graph E approaches V², and Prim's frontier-only view wins.

## A useful variant

Stop Kruskal early, after V−k edges, and you have **k clusters** — each a connected group joined by cheap edges, with the k−1 most expensive "linking" edges omitted. That is single-linkage agglomerative clustering, and it is the same algorithm with a different stopping rule.$md$,
 4, 28, 'kruskal', 3),

('weighted-graphs', 'prim-mst', 'Prim''s Minimum Spanning Tree',
 'Grow one tree, always adding the cheapest edge leaving it. The same loop as Dijkstra with one line changed.',
 $md$## The algorithm

Start anywhere. Repeatedly add the cheapest edge connecting the tree to a node not yet in it, until every node is included.

```python
import heapq

def prim(adj, n, start=0):              # adj[u] = [(v, weight), ...]
    in_tree = [False] * n
    pq = [(0, start)]
    total, count = 0, 0

    while pq and count < n:
        w, u = heapq.heappop(pq)
        if in_tree[u]:
            continue                    # stale entry
        in_tree[u] = True
        total += w
        count += 1
        for v, wt in adj[u]:
            if not in_tree[v]:
                heapq.heappush(pq, (wt, v))

    return total if count == n else None     # None => disconnected
```

**O(E log V)**.

## The one line that separates it from Dijkstra

Put the two loops side by side:

```python
# Dijkstra           push (dist[u] + weight, v)      # cost from the START
# Prim               push (weight,            v)     # cost of THIS EDGE
```

:::key
Dijkstra's priority is the total distance from the source, so it finds cheapest **paths**. Prim's priority is the weight of a single edge, so it finds the cheapest **connection**. Same heap, same stale-entry guard, same structure — one expression differs, and the answer changes from shortest paths to a minimum spanning tree.

Noticing this is worth more than memorising either: the family BFS → 0–1 BFS → Dijkstra → Prim → A\* is one loop parameterised by what goes into the priority queue.
:::

:::example
Nodes 0–3. Edges `0–1 (1)`, `1–2 (2)`, `0–2 (3)`, `2–3 (4)`. Start at 0.

| pop | node | in tree | pushed | total |
|---|---|---|---|---|
| (0,0) | 0 | {0} | (1,1), (3,2) | 0 |
| (1,1) | 1 | {0,1} | (2,2) | 1 |
| (2,2) | 2 | {0,1,2} | (4,3) | 3 |
| (3,2) | — | stale, skip | — | 3 |
| (4,3) | 3 | all | — | **7** |

Total 7 — the same as Kruskal's on this graph, as it must be.
:::

:::pitfall
The stale guard `if in_tree[u]: continue` is required. A node can be pushed once per edge into it, so the heap holds O(E) entries and the same node surfaces several times at different weights. Without the guard a node is counted more than once and `total` is too large — and because the first pop of a node is always its cheapest entry, the extra pops are exactly the ones to discard.
:::

## Disconnected graphs

Prim grows one tree, so it can only reach one component. The `count == n` check detects this: fewer than n nodes means the graph is disconnected and no spanning tree exists. Kruskal has the same situation, visible as fewer than V−1 accepted edges, and in both cases what you have built is a **minimum spanning forest** — the cheapest tree of each component.

## Why this greedy choice is also safe

The same cut property from the previous lesson. At every step, the tree built so far is one side of a cut and everything else is the other. Prim adds the cheapest edge crossing that cut, which the cut property says belongs to some MST. The difference from Kruskal is only *which* cut is being considered — Prim always uses the frontier of its single tree, while Kruskal uses whichever cut the next cheap edge happens to cross.

## Choosing

| Graph | Use | Why |
|---|---|---|
| Sparse, edge list | **Kruskal** | sorting E edges is cheap |
| Dense, adjacency matrix | **Prim** | O(V²) version needs no heap at all |
| Edges arriving over time | Kruskal | union-find absorbs them incrementally |
| Need clusters, not a tree | Kruskal | stop early for k components |

On a dense graph, Prim can drop the heap entirely: keep an array of the cheapest known edge to each outside node, and scan it for the minimum each round. That is **O(V²)**, which beats O(E log V) when E ≈ V². It is the right implementation for a complete graph, such as a distance matrix between points.

## What an MST is not

:::pitfall
An MST does **not** contain shortest paths. In the example above the MST omits edge `0–2 (3)`, so the tree route from 0 to 2 costs 1 + 2 = 3 — equal here, but in general an MST path can be arbitrarily worse than the true shortest path.

MST minimises the **total weight of the whole tree**; Dijkstra minimises the distance **from one source to each node**. They answer different questions and usually produce different edge sets.
:::$md$,
 4, 28, 'prim', 4)

) AS v(chapter_slug, slug, title, summary, content, difficulty, minutes, visual_key, position)
  ON v.chapter_slug = ch.slug
ON CONFLICT (chapter_id, slug) DO UPDATE
  SET title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      content = EXCLUDED.content,
      difficulty = EXCLUDED.difficulty,
      estimated_minutes = EXCLUDED.estimated_minutes,
      visual_key = EXCLUDED.visual_key,
      status = EXCLUDED.status,
      position = EXCLUDED.position;

-- ---------------------------------------------------------------------------
-- 4. Prerequisite DAG
-- ---------------------------------------------------------------------------
INSERT INTO public.concept_prerequisites (concept_id, prerequisite_id)
SELECT c.id, p.id
FROM (VALUES
  ('graph-depth-first-search', 'graph-breadth-first-search', 'graphs-and-networks'),
  ('topological-sort',         'graph-depth-first-search',   'graphs-and-networks'),
  ('dijkstra',                 'graph-breadth-first-search', 'graphs-and-networks'),
  ('kruskal-mst',              'disjoint-set-union',         'graphs-and-networks'),
  ('prim-mst',                 'dijkstra',                   'graphs-and-networks'),
  ('prim-mst',                 'kruskal-mst',                'graphs-and-networks'),
  -- reaching back into CS201
  ('graph-breadth-first-search', 'queue-fundamentals',       'data-structures-fundamentals'),
  ('graph-depth-first-search',   'stack-fundamentals',       'data-structures-fundamentals'),
  -- reaching back into CS202 and CS203
  ('graph-breadth-first-search', 'hash-tables',              'linked-structures-and-hashing'),
  ('graph-breadth-first-search', 'breadth-first-traversal',  'trees-heaps-and-ordered-structures'),
  ('graph-depth-first-search',   'binary-tree-fundamentals', 'trees-heaps-and-ordered-structures'),
  ('dijkstra',                   'heap-operations',          'trees-heaps-and-ordered-structures'),
  ('disjoint-set-union',         'bst-invariant-and-search', 'trees-heaps-and-ordered-structures'),
  -- reaching back into CS204
  ('kruskal-mst',                'merge-sort',               'sorting-and-searching')
) AS v(concept_slug, prereq_slug, prereq_course)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters cch ON cch.id = c.chapter_id
JOIN public.courses cco ON cco.id = cch.course_id AND cco.slug = 'graphs-and-networks'
JOIN public.concepts p ON p.slug = v.prereq_slug
JOIN public.chapters pch ON pch.id = p.chapter_id
JOIN public.courses pco ON pco.id = pch.course_id AND pco.slug = v.prereq_course
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Learning objectives
-- ---------------------------------------------------------------------------
DELETE FROM public.learning_objectives lo
USING public.concepts c, public.chapters ch, public.courses co
WHERE lo.concept_id = c.id AND c.chapter_id = ch.id AND ch.course_id = co.id
  AND co.slug = 'graphs-and-networks';

INSERT INTO public.learning_objectives (concept_id, objective, position)
SELECT c.id, v.objective, v.position
FROM (VALUES
  ('graph-breadth-first-search', 'Explain why a graph traversal needs a visited set and a tree traversal does not', 1),
  ('graph-breadth-first-search', 'Explain why nodes are marked on enqueue rather than on dequeue', 2),
  ('graph-breadth-first-search', 'Compute shortest hop counts with BFS and reconstruct the path', 3),
  ('graph-breadth-first-search', 'Explain why BFS fails once edges carry different weights', 4),
  ('graph-depth-first-search', 'Implement DFS recursively and iteratively, and say why the iterative form filters on pop', 1),
  ('graph-depth-first-search', 'Detect a cycle in a directed graph using three colours', 2),
  ('graph-depth-first-search', 'Explain why a two-state visited check reports false cycles on a diamond', 3),
  ('graph-depth-first-search', 'Adapt cycle detection to an undirected graph by tracking the parent', 4),
  ('topological-sort', 'Produce a topological order with Kahn''s algorithm', 1),
  ('topological-sort', 'Explain why the final length check detects a cycle for free', 2),
  ('topological-sort', 'Derive a topological order from reversed DFS post-order', 3),
  ('topological-sort', 'Choose between Kahn and DFS given depth, cycle reporting and ordering needs', 4),
  ('dijkstra', 'Implement Dijkstra with a priority queue and lazy deletion', 1),
  ('dijkstra', 'State why a popped node''s distance is final, and where non-negativity is used', 2),
  ('dijkstra', 'Show a negative-weight graph where Dijkstra returns a wrong answer', 3),
  ('dijkstra', 'Name the right algorithm for unweighted, 0-1 weighted and negative-weight graphs', 4),
  ('disjoint-set-union', 'Implement find and union with union by size and path compression', 1),
  ('disjoint-set-union', 'Explain why either optimisation alone gives O(log n) and both give near-constant', 2),
  ('disjoint-set-union', 'Use union-find to test whether an edge closes a cycle', 3),
  ('disjoint-set-union', 'Explain why union-find cannot split a group', 4),
  ('kruskal-mst', 'Build an MST by sorting edges and rejecting those that close a cycle', 1),
  ('kruskal-mst', 'State the cut property and use it to justify the greedy choice', 2),
  ('kruskal-mst', 'Explain why union-find is what makes the cycle test affordable', 3),
  ('prim-mst', 'Build an MST by growing one tree from a priority queue', 1),
  ('prim-mst', 'Identify the single expression that distinguishes Prim from Dijkstra', 2),
  ('prim-mst', 'Choose between Prim and Kruskal from graph density and representation', 3),
  ('prim-mst', 'Explain why an MST does not contain shortest paths', 4)
) AS v(concept_slug, objective, position)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'graphs-and-networks';

-- ---------------------------------------------------------------------------
-- 6. Misconception catalogue
-- ---------------------------------------------------------------------------
INSERT INTO public.concept_misconceptions (concept_id, code, statement, correction, probe)
SELECT c.id, v.code, v.statement, v.correction, v.probe
FROM (VALUES
  ('graph-breadth-first-search', 'no-visited-needed',
   'A graph traversal works the same as a tree traversal, without tracking visited nodes.',
   'A tree has one path to each node; a graph may have several, and may have cycles. Without a visited set the traversal revisits nodes and never terminates on a cyclic graph.',
   'Run BFS on the triangle 0-1, 1-2, 2-0 with no visited set. Describe what the queue does.'),
  ('graph-breadth-first-search', 'mark-on-dequeue',
   'It does not matter whether you mark a node visited when enqueuing or when dequeuing.',
   'Marking on dequeue lets a node be enqueued once per incoming edge before it is processed, so it is visited repeatedly and the queue can grow to O(E). Marking on enqueue bounds it to one entry per node.',
   'A node has three incoming edges from nodes all at distance 1. How many times does it enter the queue under each policy?'),
  ('graph-breadth-first-search', 'bfs-shortest-weighted',
   'BFS finds the shortest path in any graph.',
   'BFS minimises the number of edges, not total weight. With weights a two-edge route costing 2 can beat a one-edge route costing 10, and BFS returns the single edge.',
   'For edges 0-1 (1), 1-2 (1), 0-2 (10), what does BFS report as the path to 2, and what is the actual cheapest cost?'),

  ('graph-depth-first-search', 'two-state-cycle-check',
   'A visited set is enough to detect a cycle with DFS.',
   'A visited set cannot distinguish "still exploring this node" from "finished earlier". In the diamond 0->1, 0->2, 1->3, 2->3 node 3 is reached twice with no cycle present, and a two-state check reports one.',
   'Run a two-state DFS cycle check on the diamond graph. Which edge is wrongly flagged, and what state should node 3 have been in?'),
  ('graph-depth-first-search', 'parent-edge-is-cycle',
   'In an undirected graph, finding an already-visited neighbour means there is a cycle.',
   'Every undirected edge is traversable both ways, so stepping back to the node you came from is the same edge, not a cycle. The parent must be excluded from the check.',
   'DFS from 0 on the single edge 0-1. At node 1, which neighbour is already visited, and why is that not a cycle?'),
  ('graph-depth-first-search', 'recursive-dfs-safe',
   'Recursive DFS is fine for any graph size.',
   'Its stack depth is the length of the longest path. A path graph of 100,000 nodes exceeds Python''s default recursion limit and can overflow a native stack, so large inputs need the iterative form.',
   'Give the recursion depth of DFS on a path of 100,000 nodes, and name the resource that runs out.'),

  ('topological-sort', 'topo-order-unique',
   'A graph has exactly one topological order.',
   'Any order respecting every edge is valid. The graph 0->1, 0->2 admits both 0,1,2 and 0,2,1. Uniqueness holds only when a Hamiltonian path exists.',
   'List every valid topological order of 0->1, 0->2. How should a grader check an answer?'),
  ('topological-sort', 'topo-needs-separate-cycle-check',
   'Detecting a cycle requires a separate pass before topological sorting.',
   'Both algorithms detect it as a by-product. In Kahn''s, nodes in a cycle never reach in-degree zero so fewer than n are output; in the DFS version, an edge into a grey node is a cycle.',
   'Run Kahn''s algorithm on 0->1, 1->2, 2->0. How many nodes are output, and what does that tell you?'),
  ('topological-sort', 'preorder-is-topological',
   'DFS pre-order gives a topological order.',
   'Pre-order emits a node before its descendants are explored, so a node can appear before something it depends on. The topological order is reversed POST-order, where a node is emitted only after everything reachable from it.',
   'For 0->1, 1->2, give DFS pre-order and reversed post-order. Which one respects the edges?'),

  ('dijkstra', 'dijkstra-negative-weights',
   'Dijkstra works on graphs with negative edge weights.',
   'Its correctness relies on a popped node being final, which assumes no future path can get cheaper. A negative edge breaks that, and the node is never reconsidered. Use Bellman-Ford.',
   'For edges 0->1 (2), 1->2 (-5), 0->2 (1), what does Dijkstra report for node 2, and what is the true shortest distance?'),
  ('dijkstra', 'stale-entries-wrong-answer',
   'Failing to skip stale heap entries makes Dijkstra return wrong distances.',
   'The nd < dist[v] test still filters improvements, so the distances stay correct. What degrades is performance: every obsolete entry is expanded again.',
   'Remove the "if d > dist[u]: continue" guard. Explain why the output is still correct and what gets worse.'),
  ('dijkstra', 'dijkstra-is-mst',
   'Dijkstra and Prim produce the same tree.',
   'Dijkstra prioritises total distance from the source and finds shortest paths; Prim prioritises a single edge weight and finds a minimum spanning tree. One expression differs and the answers differ.',
   'Write the value pushed onto the heap in each algorithm, and explain what each one minimises.'),

  ('disjoint-set-union', 'compression-without-assignment',
   'Returning find(parent[x]) performs path compression.',
   'Compression requires storing the result: parent[x] = find(parent[x]). Without the assignment the function is still correct but flattens nothing, so operations stay O(log n).',
   'Write both versions and explain which array entries change in each after a find on a chain of length 5.'),
  ('disjoint-set-union', 'dsu-can-split',
   'Union-find can also separate two elements that were merged.',
   'There is no efficient split. Path compression has already destroyed the original tree shape, so the information needed to undo a union is gone. Edge-deletion problems are usually processed in reverse instead.',
   'After union(0,1) and a find that compresses the path, what information remains about which unions happened?'),
  ('disjoint-set-union', 'dsu-lists-members',
   'Union-find can list the members of a group.',
   'It stores only parent pointers, so finding members requires scanning every element and calling find. It answers identity cheaply and membership expensively, which is the trade that makes it fast.',
   'Give the cost of listing one component''s members with union-find, and compare it with BFS.'),

  ('kruskal-mst', 'kruskal-without-dsu',
   'Kruskal''s algorithm does not need a special data structure.',
   'It must test whether each edge closes a cycle. Without union-find that is a DFS per edge, making the whole algorithm O(VE) instead of O(E log E).',
   'Give the total complexity of Kruskal using a DFS cycle test per edge, and with union-find.'),
  ('kruskal-mst', 'greedy-usually-wrong',
   'Taking the cheapest available edge cannot be optimal.',
   'Here it is, by the cut property: the cheapest edge crossing any partition belongs to some MST. Each accepted edge is the cheapest crossing its cut, so no choice ever needs revisiting.',
   'State the cut property and use the exchange argument to show the cheapest crossing edge is safe.'),
  ('kruskal-mst', 'mst-unique',
   'A graph has exactly one minimum spanning tree.',
   'It is unique only when all edge weights are distinct. With ties there may be several trees of equal total weight, all correct, so a grader should compare totals rather than edge sets.',
   'Construct a four-node graph with two different MSTs of equal weight.'),

  ('prim-mst', 'prim-gives-shortest-paths',
   'The MST contains the shortest path between every pair of nodes.',
   'An MST minimises the total weight of the whole tree, not any individual path. Removing a direct edge can make the tree route between its endpoints arbitrarily longer than the true shortest path.',
   'For edges 0-1 (1), 1-2 (1), 0-2 (1.9), give the MST and compare its 0-to-2 route with the direct edge.'),
  ('prim-mst', 'prim-no-stale-guard',
   'Prim does not need to skip entries for nodes already in the tree.',
   'A node is pushed once per edge into it, so it surfaces several times at different weights. Without the guard it is counted more than once and the total is too large.',
   'Run Prim on a triangle and count how many heap entries exist for the last node. Which should be used?'),
  ('prim-mst', 'prim-needs-heap',
   'Prim always requires a priority queue.',
   'On a dense graph the O(V^2) version - keep an array of the cheapest edge to each outside node and scan for the minimum - is faster than O(E log V), because E approaches V^2.',
   'For a complete graph on 1000 nodes, compare E log V with V^2 and say which implementation to use.')
) AS v(concept_slug, code, statement, correction, probe)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'graphs-and-networks'
ON CONFLICT (concept_id, code) DO UPDATE
  SET statement = EXCLUDED.statement,
      correction = EXCLUDED.correction,
      probe = EXCLUDED.probe;

-- ---------------------------------------------------------------------------
-- 7. Coding problems
--    Graphs arrive as adjacency lists: `adj[i]` is the list of neighbours of
--    node i. Weighted graphs use [neighbour, weight] pairs. Plain JSON, so the
--    grader needs no graph type.
-- ---------------------------------------------------------------------------
INSERT INTO public.coding_problems (concept_id, slug, title, prompt, difficulty, starter_code, test_cases, expected_complexity, hints, status)
SELECT c.id, v.slug, v.title, v.prompt, v.difficulty,
       v.starter_code::jsonb, v.test_cases::jsonb, v.complexity, v.hints::jsonb,
       'published'::public.content_status
FROM (VALUES

('graph-breadth-first-search', 'shortest-hops-bfs', 'Shortest Hop Counts',
 E'A graph is given as an adjacency list `adj`, where `adj[i]` lists the neighbours of node `i`. Starting from node `0`, return an array `dist` where `dist[i]` is the fewest edges from 0 to `i`, or `-1` if `i` is unreachable.\n\n`dist[0]` is `0`. Use BFS — a DFS does **not** give shortest hop counts, and one of the hidden tests will catch that.\n\nMark nodes as reached when you enqueue them, not when you dequeue them.',
 3,
 '{"python":"from collections import deque\n\ndef shortest_hops(adj):\n    # BFS from node 0. -1 for unreachable.\n    pass\n","javascript":"function shortestHops(adj) {\n  // BFS from node 0. -1 for unreachable.\n}\n"}',
 '[{"args":[[[1,2],[0,3,4],[0,4],[1],[1,2]]],"expected":[0,1,1,2,2],"hidden":false},{"args":[[[1],[0],[]]],"expected":[0,1,-1],"hidden":false},{"args":[[[]]],"expected":[0],"hidden":false},{"args":[[[1,2],[2],[3],[]]],"expected":[0,1,1,2],"hidden":true},{"args":[[[1],[2],[3],[0]]],"expected":[0,1,2,3],"hidden":true},{"args":[[[2],[2],[0,1]]],"expected":[0,2,1],"hidden":true}]',
 'O(V + E) time, O(V) space',
 '["Initialise every distance to -1 and set dist[0] = 0 before the loop.","A node has been reached exactly when its distance is no longer -1, so the distance array doubles as the visited set.","Set the neighbour''s distance at the moment you enqueue it — that is what guarantees each node is enqueued once."]',
 'published'),

('graph-depth-first-search', 'detect-directed-cycle', 'Detect a Cycle in a Directed Graph',
 E'A directed graph is given as an adjacency list `adj`, where `adj[i]` lists the nodes reachable in one step from `i`. Return `true` if the graph contains a cycle.\n\nA plain visited set is **not** sufficient — one of the visible tests is a diamond (`0→1, 0→2, 1→3, 2→3`) that has no cycle but reaches node 3 twice. You need three states: unvisited, currently on the recursion path, and fully explored.\n\nThe graph may be disconnected, so start a search from every unvisited node.',
 4,
 '{"python":"def has_cycle(adj):\n    # 0 = unvisited, 1 = on the current path, 2 = finished\n    pass\n","javascript":"function hasCycle(adj) {\n  // 0 = unvisited, 1 = on the current path, 2 = finished\n}\n"}',
 '[{"args":[[[1],[2],[0]]],"expected":true,"hidden":false},{"args":[[[1,2],[3],[3],[]]],"expected":false,"hidden":false},{"args":[[[]]],"expected":false,"hidden":false},{"args":[[[1],[2],[3],[1]]],"expected":true,"hidden":true},{"args":[[[1],[],[3],[2]]],"expected":true,"hidden":true},{"args":[[[1,2],[2],[]]],"expected":false,"hidden":true},{"args":[[[0]]],"expected":true,"hidden":true}]',
 'O(V + E) time, O(V) space',
 '["Mark a node as state 1 on entry and state 2 after exploring all its neighbours.","An edge to a state-1 node is a cycle. An edge to a state-2 node is not — that subtree is already finished.","The last hidden test is a self-loop: node 0 points at itself, which is a cycle of length one."]',
 'published'),

('topological-sort', 'topo-order-kahn', 'Topological Order',
 E'A directed graph is given as an adjacency list `adj`, where an edge `i → j` means `i` must come before `j`. Return any valid topological order as an array of node indices, or an empty array if the graph has a cycle.\n\nUse Kahn''s algorithm. To make the expected output unique for grading, break ties by **smallest node index first** — use a min-heap, or scan for the smallest available node, rather than a plain queue.',
 4,
 '{"python":"import heapq\n\ndef topo_order(adj):\n    # Kahn, breaking ties by smallest index. [] if cyclic.\n    pass\n","javascript":"function topoOrder(adj) {\n  // Kahn, breaking ties by smallest index. [] if cyclic.\n}\n"}',
 '[{"args":[[[1,2],[3],[3],[]]],"expected":[0,1,2,3],"hidden":false},{"args":[[[1],[2],[0]]],"expected":[],"hidden":false},{"args":[[[],[],[]]],"expected":[0,1,2],"hidden":false},{"args":[[[2],[2],[]]],"expected":[0,1,2],"hidden":true},{"args":[[[1],[],[1]]],"expected":[0,2,1],"hidden":true},{"args":[[[]]],"expected":[0],"hidden":true}]',
 'O((V + E) log V) time',
 '["Compute in-degrees by walking every adjacency list once.","Seed a min-heap with every node of in-degree zero, then repeatedly pop the smallest.","If the output has fewer than V nodes, a cycle kept some in-degree above zero — return an empty array."]',
 'published'),

('dijkstra', 'dijkstra-distances', 'Shortest Weighted Distances',
 E'A weighted directed graph is given as `adj`, where `adj[i]` is a list of `[neighbour, weight]` pairs. All weights are non-negative integers.\n\nFrom node `0`, return an array `dist` where `dist[i]` is the cheapest total weight from 0 to `i`, or `-1` if `i` is unreachable.\n\nBFS is **not** correct here — one visible test has a cheap two-edge route alongside an expensive single edge. Use a priority queue, and skip entries whose recorded distance has already been improved.',
 4,
 '{"python":"import heapq\n\ndef dijkstra(adj):\n    # adj[i] = [[neighbour, weight], ...]. -1 for unreachable.\n    pass\n","javascript":"function dijkstra(adj) {\n  // adj[i] = [[neighbour, weight], ...]. -1 for unreachable.\n}\n"}',
 '[{"args":[[[[1,1],[2,10]],[[2,1]],[]]],"expected":[0,1,2],"hidden":false},{"args":[[[[1,5]],[],[]]],"expected":[0,5,-1],"hidden":false},{"args":[[[]]],"expected":[0],"hidden":false},{"args":[[[[1,2],[2,4]],[[2,1]],[[3,7]],[]]],"expected":[0,2,3,10],"hidden":true},{"args":[[[[1,0]],[[2,0]],[]]],"expected":[0,0,0],"hidden":true},{"args":[[[[1,3]],[[0,3]],[]]],"expected":[0,3,-1],"hidden":true}]',
 'O((V + E) log V) time',
 '["Hold distances in an array initialised to infinity, with dist[0] = 0, and convert infinity to -1 at the end.","Push (distance, node) tuples so the heap orders by distance.","When you pop a node whose popped distance exceeds its recorded distance, skip it — that entry is obsolete."]',
 'published'),

('disjoint-set-union', 'count-components-dsu', 'Count Connected Components',
 E'You are given `n` nodes numbered `0 … n-1` and a list of undirected `edges`, each `[u, v]`. Return the number of connected components.\n\nUse union-find with **union by size** and **path compression**. Start with `n` components and decrement the count each time a union actually merges two different groups — an edge between nodes already in the same group changes nothing.',
 3,
 '{"python":"def count_components(n, edges):\n    # union-find with path compression and union by size\n    pass\n","javascript":"function countComponents(n, edges) {\n  // union-find with path compression and union by size\n}\n"}',
 '[{"args":[4,[[0,1],[2,3]]],"expected":2,"hidden":false},{"args":[4,[[0,1],[1,2],[2,3]]],"expected":1,"hidden":false},{"args":[3,[]],"expected":3,"hidden":false},{"args":[4,[[0,1],[0,1],[0,1]]],"expected":3,"hidden":true},{"args":[1,[]],"expected":1,"hidden":true},{"args":[5,[[0,1],[1,2],[3,4]]],"expected":2,"hidden":true}]',
 'O(E·alpha(n)) time, O(n) space',
 '["parent = list(range(n)) and size = [1]*n to begin; every node is its own component.","find should assign parent[x] = find(parent[x]) so the path is flattened.","Only decrement the component count when the two roots differ. The hidden duplicate-edge test depends on this."]',
 'published'),

('kruskal-mst', 'mst-total-weight', 'Minimum Spanning Tree Weight',
 E'Given `n` nodes and a list of weighted undirected `edges`, each `[u, v, w]`, return the total weight of a minimum spanning tree. Return `-1` if the graph is not connected.\n\nUse Kruskal: sort the edges by weight and accept each one unless its endpoints are already connected. Return the **total**, not the edge list — with tied weights there can be several equally minimal trees.',
 4,
 '{"python":"def mst_weight(n, edges):\n    # Kruskal with union-find. -1 if disconnected.\n    pass\n","javascript":"function mstWeight(n, edges) {\n  // Kruskal with union-find. -1 if disconnected.\n}\n"}',
 '[{"args":[4,[[0,1,1],[1,2,2],[0,2,3],[2,3,4]]],"expected":7,"hidden":false},{"args":[3,[[0,1,1]]],"expected":-1,"hidden":false},{"args":[1,[]],"expected":0,"hidden":false},{"args":[2,[[0,1,5],[0,1,2]]],"expected":2,"hidden":true},{"args":[4,[[0,1,1],[1,2,1],[2,3,1],[0,3,1]]],"expected":3,"hidden":true},{"args":[3,[[0,1,2],[1,2,2],[0,2,2]]],"expected":4,"hidden":true}]',
 'O(E log E) time',
 '["Sort the edges by weight ascending, then walk them once.","Accept an edge only when find(u) != find(v); otherwise it would close a cycle.","A spanning tree needs exactly n-1 edges. If you accepted fewer, the graph was disconnected — return -1. A single node needs 0 edges and totals 0."]',
 'published')

) AS v(concept_slug, slug, title, prompt, difficulty, starter_code, test_cases, complexity, hints, status)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'graphs-and-networks'
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      prompt = EXCLUDED.prompt,
      difficulty = EXCLUDED.difficulty,
      starter_code = EXCLUDED.starter_code,
      test_cases = EXCLUDED.test_cases,
      expected_complexity = EXCLUDED.expected_complexity,
      hints = EXCLUDED.hints,
      status = EXCLUDED.status;
