/**
 * The visualisation index.
 *
 * Deliberately free of logic and free of any three.js import: the gallery and
 * the faculty authoring form both read this file, and neither of them should pay
 * for the renderer. The lab itself — `components/visual/lab/` — loads only when a
 * student actually opens a visualisation.
 *
 * `key` matches `concepts.visual_key` in the database. A concept whose
 * visual_key has no entry here simply shows no visualiser link; it is never
 * linked to a screen that cannot draw it. **The first eleven keys below are live
 * database values — renaming one breaks every lesson that points at it.**
 *
 * `module` and `op` resolve into `lab/registry.ts`. `scripts/verify-lab.ts`
 * asserts that every pair here exists, which is what stops a lesson deep-linking
 * to an operation that was renamed or removed.
 */

export const VISUAL_GROUPS = [
  "Arrays",
  "Strings",
  "Matrices",
  "Stacks",
  "Queues",
  "Linked Lists",
  "Hashing",
  "Trees",
  "Heaps",
  "Graphs",
  "Sorting",
  "Searching",
  "Recursion",
  "Dynamic Programming",
] as const;

export type VisualGroup = (typeof VISUAL_GROUPS)[number];

export interface VisualMeta {
  key: string;
  title: string;
  subtitle: string;
  complexity: string;
  group: VisualGroup;
  /** Module key in `lab/registry.ts`. */
  module: string;
  /** Operation key within that module. */
  op: string;
  /** Opening contents of the values box. Falls back to the module's sample. */
  values?: string;
  /** Overrides for the operation's default parameters. */
  params?: Record<string, number | string>;
}

export const VISUAL_CATALOGUE: VisualMeta[] = [
  /* ---------------------------------------------------------------- */
  /* The original eleven. These keys are in the database — do not edit. */
  /* ---------------------------------------------------------------- */
  {
    key: "array-memory",
    title: "Arrays in memory",
    subtitle: "Why indexing costs the same no matter how far in you reach",
    complexity: "Access O(1)",
    group: "Arrays",
    module: "array",
    op: "access",
    params: { index: 4 },
  },
  {
    key: "array-shift",
    title: "Inserting into an array",
    subtitle: "The hidden cost of making room at the front",
    complexity: "Insert at front O(n)",
    group: "Arrays",
    module: "array",
    op: "insertAtBegin",
    params: { value: 42 },
  },
  {
    key: "two-pointers",
    title: "Two pointers",
    subtitle: "Discarding a whole row or column with each comparison",
    complexity: "O(n) time, O(1) space",
    group: "Arrays",
    module: "twopointers",
    op: "opposite",
  },
  {
    key: "sliding-window",
    title: "Sliding window",
    subtitle: "Reusing the previous window instead of recomputing it",
    complexity: "O(n) time, O(1) space",
    group: "Arrays",
    module: "slidingwindow",
    op: "fixed",
    params: { size: 3 },
  },
  {
    key: "prefix-sum",
    title: "Prefix sums",
    subtitle: "Turning every range query into one subtraction",
    complexity: "Build O(n), query O(1)",
    group: "Arrays",
    module: "array",
    op: "prefixSum",
  },
  {
    key: "stack",
    title: "Stack",
    subtitle: "Last in, first out — and why both operations are O(1)",
    complexity: "push/pop O(1)",
    group: "Stacks",
    module: "stack",
    op: "push",
  },
  {
    key: "stack-brackets",
    title: "Balanced brackets",
    subtitle: "The stack remembers exactly what is still owed",
    complexity: "O(n) time, O(n) space",
    group: "Stacks",
    module: "stack",
    op: "balancedBrackets",
  },
  {
    key: "monotonic-stack",
    title: "Monotonic stack",
    subtitle: "Next greater element, one pop per index",
    complexity: "O(n) — each index pushed and popped once",
    group: "Stacks",
    module: "stack",
    op: "nextGreater",
  },
  {
    key: "queue",
    title: "Queue",
    subtitle: "First in, first out",
    complexity: "enqueue/dequeue O(1)",
    group: "Queues",
    module: "queue",
    op: "enqueue",
  },
  {
    key: "circular-queue",
    title: "Circular queue",
    subtitle: "Reusing the front of a fixed buffer instead of shifting",
    complexity: "enqueue/dequeue O(1)",
    group: "Queues",
    module: "queue",
    op: "circular",
  },
  {
    key: "monotonic-deque",
    title: "Monotonic deque",
    subtitle: "Sliding window maximum without rescanning the window",
    complexity: "O(n) — each index enters and leaves once",
    group: "Queues",
    module: "queue",
    op: "slidingWindowMax",
  },

  /* ---------------------------------------------------------------- */
  /* Arrays                                                          */
  /* ---------------------------------------------------------------- */
  {
    key: "array-reverse",
    title: "Reversing in place",
    subtitle: "Two indices walking towards each other, no second array",
    complexity: "O(n) time, O(1) space",
    group: "Arrays",
    module: "array",
    op: "reverse",
  },
  {
    key: "array-rotate",
    title: "Rotating an array",
    subtitle: "Where each element lands, and why the modulo is the whole trick",
    complexity: "O(n) time",
    group: "Arrays",
    module: "array",
    op: "rotateLeft",
    params: { k: 2 },
  },
  {
    key: "kadane",
    title: "Maximum subarray (Kadane)",
    subtitle: "One pass, one decision per element: extend or restart",
    complexity: "O(n) time, O(1) space",
    group: "Arrays",
    module: "array",
    op: "kadane",
    values: "-2, 1, -3, 4, -1, 2, 1, -5, 4",
  },
  {
    key: "dutch-flag",
    title: "Dutch national flag",
    subtitle: "Sorting three values in a single pass with three pointers",
    complexity: "O(n) time, O(1) space",
    group: "Arrays",
    module: "array",
    op: "dutchFlag",
    values: "2, 0, 2, 1, 1, 0, 1, 2, 0",
  },
  {
    key: "pair-sum",
    title: "Pair with a given sum",
    subtitle: "What sortedness buys you over the nested loop",
    complexity: "O(n) after sorting",
    group: "Arrays",
    module: "twopointers",
    op: "pairSum",
    params: { target: 14 },
  },
  {
    key: "container-water",
    title: "Container with most water",
    subtitle: "Why moving the taller wall can never help",
    complexity: "O(n) time, O(1) space",
    group: "Arrays",
    module: "twopointers",
    op: "containerWater",
    values: "1, 8, 6, 2, 5, 4, 8, 3, 7",
  },
  {
    key: "window-distinct",
    title: "Longest window of distinct values",
    subtitle: "A window that grows and shrinks, still one pass",
    complexity: "O(n) time",
    group: "Arrays",
    module: "slidingwindow",
    op: "distinct",
    values: "1, 2, 1, 3, 4, 3, 5",
  },

  /* ---------------------------------------------------------------- */
  /* Strings                                                         */
  /* ---------------------------------------------------------------- */
  {
    key: "kmp",
    title: "KMP pattern matching",
    subtitle: "The prefix table means the text pointer never goes backwards",
    complexity: "O(n + m) time",
    group: "Strings",
    module: "string",
    op: "kmp",
  },
  {
    key: "rabin-karp",
    title: "Rabin–Karp",
    subtitle: "A rolling hash, and the verification step it still needs",
    complexity: "O(n + m) average",
    group: "Strings",
    module: "string",
    op: "rabinKarp",
  },
  {
    key: "palindrome",
    title: "Palindrome check",
    subtitle: "Two pointers on characters instead of numbers",
    complexity: "O(n) time, O(1) space",
    group: "Strings",
    module: "string",
    op: "palindrome",
  },
  {
    key: "anagram",
    title: "Anagram check",
    subtitle: "Counting characters beats sorting both strings",
    complexity: "O(n) time",
    group: "Strings",
    module: "string",
    op: "anagram",
  },

  /* ---------------------------------------------------------------- */
  /* Matrices                                                        */
  /* ---------------------------------------------------------------- */
  {
    key: "matrix-spiral",
    title: "Spiral traversal",
    subtitle: "Four shrinking boundaries instead of four special cases",
    complexity: "O(rows × cols)",
    group: "Matrices",
    module: "matrix",
    op: "spiral",
    values: "1, 2, 3, 4, 5, 6, 7, 8, 9",
  },
  {
    key: "matrix-rotate",
    title: "Rotate 90° in place",
    subtitle: "Transpose, then reverse each row",
    complexity: "O(n²) time, O(1) space",
    group: "Matrices",
    module: "matrix",
    op: "rotate",
    values: "1, 2, 3, 4, 5, 6, 7, 8, 9",
  },
  {
    key: "flood-fill",
    title: "Flood fill",
    subtitle: "The same graph traversal, drawn on a grid",
    complexity: "O(cells)",
    group: "Matrices",
    module: "matrix",
    op: "floodFill",
    /* A region worth filling: the 1s at the top-left are connected, the rest are not. */
    values: "1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1",
  },
  {
    key: "grid-shortest-path",
    title: "Shortest path on a grid",
    subtitle: "BFS finds it; DFS does not, and this shows why",
    complexity: "O(cells)",
    group: "Matrices",
    module: "matrix",
    op: "shortestPath",
    /* 0 is open, anything else is a wall — a maze that does have a way through. */
    values: "0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0",
  },

  /* ---------------------------------------------------------------- */
  /* Stacks and queues                                               */
  /* ---------------------------------------------------------------- */
  {
    key: "min-stack",
    title: "Minimum stack",
    subtitle: "O(1) minimum by storing the minimum alongside each push",
    complexity: "All operations O(1)",
    group: "Stacks",
    module: "stack",
    op: "minStack",
  },
  {
    key: "infix-postfix",
    title: "Infix to postfix",
    subtitle: "Precedence handled by a stack rather than by parentheses",
    complexity: "O(n) time",
    group: "Stacks",
    module: "stack",
    op: "infixToPostfix",
  },
  {
    key: "queue-via-stacks",
    title: "Queue from two stacks",
    subtitle: "Amortised O(1): each element moves across exactly once",
    complexity: "Amortised O(1)",
    group: "Stacks",
    module: "stack",
    op: "queueViaStacks",
  },
  {
    key: "deque",
    title: "Deque operations",
    subtitle: "Both ends open, and what that costs",
    complexity: "All operations O(1)",
    group: "Queues",
    module: "queue",
    op: "deque",
  },

  /* ---------------------------------------------------------------- */
  /* Linked lists                                                    */
  /* ---------------------------------------------------------------- */
  {
    key: "linked-list-traverse",
    title: "Walking a linked list",
    subtitle: "No index arithmetic — only 'what does this node point at?'",
    complexity: "O(n) time",
    group: "Linked Lists",
    module: "linkedlist",
    op: "traverse",
  },
  {
    key: "linked-list-insert",
    title: "Inserting at the front",
    subtitle: "O(1) here, against O(n) for the same thing in an array",
    complexity: "O(1) time",
    group: "Linked Lists",
    module: "linkedlist",
    op: "insertAtBegin",
    params: { value: 42 },
  },
  {
    key: "linked-list-reverse",
    title: "Reversing a linked list",
    subtitle: "Three pointers, and why you need all three",
    complexity: "O(n) time, O(1) space",
    group: "Linked Lists",
    module: "linkedlist",
    op: "reverse",
  },
  {
    key: "floyd-cycle",
    title: "Floyd's cycle detection",
    subtitle: "Fast and slow pointers: a cycle is a collision",
    complexity: "O(n) time, O(1) space",
    group: "Linked Lists",
    module: "linkedlist",
    op: "detectCycle",
  },
  {
    key: "linked-list-middle",
    title: "Finding the middle",
    subtitle: "One pass, no length count, two pointers at different speeds",
    complexity: "O(n) time, O(1) space",
    group: "Linked Lists",
    module: "linkedlist",
    op: "middle",
  },
  {
    key: "merge-sorted-lists",
    title: "Merging two sorted lists",
    subtitle: "Relinking rather than copying — the merge step of merge sort",
    complexity: "O(n + m) time",
    group: "Linked Lists",
    module: "linkedlist",
    op: "mergeSorted",
  },
  {
    key: "doubly-linked-list",
    title: "Doubly linked list",
    subtitle: "What the backward pointer actually buys",
    complexity: "O(1) insert and delete given the node",
    group: "Linked Lists",
    module: "linkedlist",
    op: "doubly",
  },

  /* ---------------------------------------------------------------- */
  /* Hashing                                                         */
  /* ---------------------------------------------------------------- */
  {
    key: "hash-chaining",
    title: "Hash table: separate chaining",
    subtitle: "Collisions grow sideways off the bucket",
    complexity: "O(1) average, O(n) worst",
    group: "Hashing",
    module: "hash",
    op: "chainInsert",
  },
  {
    key: "hash-linear-probing",
    title: "Hash table: linear probing",
    subtitle: "Staying in the array, and the clustering it causes",
    complexity: "O(1) average",
    group: "Hashing",
    module: "hash",
    op: "linearInsert",
  },
  {
    key: "hash-quadratic-probing",
    title: "Hash table: quadratic probing",
    subtitle: "Spreading the probe sequence to break up clusters",
    complexity: "O(1) average",
    group: "Hashing",
    module: "hash",
    op: "quadraticInsert",
  },

  /* ---------------------------------------------------------------- */
  /* Trees                                                           */
  /* ---------------------------------------------------------------- */
  {
    key: "tree-traversals",
    title: "Tree traversals",
    subtitle: "Preorder, inorder, postorder — one line of code apart",
    complexity: "O(n) time, O(h) space",
    group: "Trees",
    module: "binarytree",
    op: "inorder",
  },
  {
    key: "tree-level-order",
    title: "Level-order traversal",
    subtitle: "The only traversal that needs a queue instead of a stack",
    complexity: "O(n) time",
    group: "Trees",
    module: "binarytree",
    op: "levelOrder",
  },
  {
    key: "bst-search",
    title: "Binary search tree: search",
    subtitle: "Each comparison discards an entire subtree",
    complexity: "O(h) — O(log n) balanced",
    group: "Trees",
    module: "bst",
    op: "search",
    params: { target: 40 },
  },
  {
    key: "bst-insert",
    title: "Binary search tree: insert",
    subtitle: "Where a value lands, and why sorted input ruins the shape",
    complexity: "O(h) time",
    group: "Trees",
    module: "bst",
    op: "insert",
    params: { value: 45 },
  },
  {
    key: "bst-delete",
    title: "Binary search tree: delete",
    subtitle: "Three cases, and why two children needs the successor",
    complexity: "O(h) time",
    group: "Trees",
    module: "bst",
    op: "delete",
    params: { value: 30 },
  },
  {
    key: "bst-validate",
    title: "Validating a BST",
    subtitle: "Why comparing with the parent is not enough",
    complexity: "O(n) time",
    group: "Trees",
    module: "bst",
    op: "validate",
  },
  {
    key: "avl-rotations",
    title: "AVL rotations",
    subtitle: "Sorted input that would degenerate a BST stays log-height here",
    complexity: "O(log n) guaranteed",
    group: "Trees",
    module: "avl",
    op: "build",
    values: "10, 20, 30, 40, 50, 25",
  },
  {
    key: "trie-prefix",
    title: "Trie: prefix search",
    subtitle: "The operation a hash map cannot do at all",
    complexity: "O(prefix + matches)",
    group: "Trees",
    module: "trie",
    op: "prefix",
  },
  {
    key: "segment-tree",
    title: "Segment tree range query",
    subtitle: "Any range decomposes into O(log n) stored nodes",
    complexity: "Build O(n), query O(log n)",
    group: "Trees",
    module: "segment",
    op: "query",
  },
  {
    key: "fenwick-tree",
    title: "Fenwick tree (BIT)",
    subtitle: "The same range sums, in a fraction of the code, via one bit trick",
    complexity: "Query and update O(log n)",
    group: "Trees",
    module: "fenwick",
    op: "prefix",
  },

  /* ---------------------------------------------------------------- */
  /* Heaps                                                           */
  /* ---------------------------------------------------------------- */
  {
    key: "heapify",
    title: "Heapify an array",
    subtitle: "Bottom-up build is O(n), not O(n log n) — here is why",
    complexity: "O(n) time",
    group: "Heaps",
    module: "heap",
    op: "build",
  },
  {
    key: "heap-extract",
    title: "Extracting from a heap",
    subtitle: "The last leaf goes to the top, then sinks",
    complexity: "O(log n) time",
    group: "Heaps",
    module: "heap",
    op: "extract",
  },
  {
    key: "kth-largest",
    title: "kth largest element",
    subtitle: "A heap of size k, not a sort of size n",
    complexity: "O(n log k) time, O(k) space",
    group: "Heaps",
    module: "heap",
    op: "kthLargest",
    params: { k: 3 },
  },

  /* ---------------------------------------------------------------- */
  /* Graphs                                                          */
  /* ---------------------------------------------------------------- */
  {
    key: "graph-bfs",
    title: "Breadth-first search",
    subtitle: "Visiting in order of distance from the start",
    complexity: "O(n + m) time",
    group: "Graphs",
    module: "graph",
    op: "bfs",
  },
  {
    key: "graph-dfs",
    title: "Depth-first search",
    subtitle: "The same code with a stack, and a completely different shape",
    complexity: "O(n + m) time",
    group: "Graphs",
    module: "graph",
    op: "dfs",
  },
  {
    key: "dijkstra",
    title: "Dijkstra's shortest paths",
    subtitle: "Settle the nearest unsettled vertex, then relax its edges",
    complexity: "O(m log n) with a heap",
    group: "Graphs",
    module: "graph",
    op: "dijkstra",
  },
  {
    key: "topological-sort",
    title: "Topological sort",
    subtitle: "Ordering dependencies — and detecting the cycle when you cannot",
    complexity: "O(n + m) time",
    group: "Graphs",
    module: "graph",
    op: "topoSort",
  },
  {
    key: "kruskal",
    title: "Kruskal's minimum spanning tree",
    subtitle: "Edge-driven, with a disjoint set answering 'already connected?'",
    complexity: "O(m log m) time",
    group: "Graphs",
    module: "graph",
    op: "kruskal",
  },
  {
    key: "prim",
    title: "Prim's minimum spanning tree",
    subtitle: "Vertex-driven: the same total weight, a different order",
    complexity: "O(m log n) with a heap",
    group: "Graphs",
    module: "graph",
    op: "prim",
  },
  {
    key: "disjoint-set",
    title: "Disjoint set (union–find)",
    subtitle: "Union by rank and path compression, and what each one fixes",
    complexity: "Near-constant amortised",
    group: "Graphs",
    module: "dsu",
    op: "union",
  },

  /* ---------------------------------------------------------------- */
  /* Sorting and searching                                           */
  /* ---------------------------------------------------------------- */
  {
    key: "bubble-sort",
    title: "Bubble sort",
    subtitle: "Slow, but the clearest picture of what sorting is",
    complexity: "O(n²), O(n) on sorted input",
    group: "Sorting",
    module: "sorting",
    op: "bubble",
  },
  {
    key: "insertion-sort",
    title: "Insertion sort",
    subtitle: "Why real libraries switch to it for small subarrays",
    complexity: "O(n²), O(n) nearly sorted",
    group: "Sorting",
    module: "sorting",
    op: "insertion",
  },
  {
    key: "merge-sort",
    title: "Merge sort",
    subtitle: "O(n log n) guaranteed, paid for with an O(n) buffer",
    complexity: "O(n log n) time, O(n) space",
    group: "Sorting",
    module: "sorting",
    op: "merge",
  },
  {
    key: "quick-sort",
    title: "Quick sort",
    subtitle: "Partitioning in place, and the pivot that ruins it",
    complexity: "O(n log n) average, O(n²) worst",
    group: "Sorting",
    module: "sorting",
    op: "quick",
  },
  {
    key: "counting-sort",
    title: "Counting sort",
    subtitle: "No comparisons at all, so the O(n log n) bound does not apply",
    complexity: "O(n + k) time, O(k) space",
    group: "Sorting",
    module: "sorting",
    op: "counting",
    values: "4, 2, 2, 8, 3, 3, 1",
  },
  {
    key: "radix-sort",
    title: "Radix sort",
    subtitle: "Digit by digit, and why the inner sort must be stable",
    complexity: "O(d × (n + 10))",
    group: "Sorting",
    module: "sorting",
    op: "radix",
    values: "170, 45, 75, 90, 2, 802, 24, 66",
  },
  {
    key: "binary-search",
    title: "Binary search",
    subtitle: "Twenty steps through a million elements",
    complexity: "O(log n) time",
    group: "Searching",
    module: "searching",
    op: "binary",
    params: { target: 11 },
  },
  {
    key: "first-last-occurrence",
    title: "First and last occurrence",
    subtitle: "Finding the match and then refusing to stop",
    complexity: "O(log n) time",
    group: "Searching",
    module: "searching",
    op: "boundary",
    values: "1, 3, 7, 7, 7, 9, 11",
    params: { target: 7, which: "first" },
  },

  /* ---------------------------------------------------------------- */
  /* Recursion and dynamic programming                               */
  /* ---------------------------------------------------------------- */
  {
    key: "recursion-stack",
    title: "The call stack",
    subtitle: "Watch it grow to depth n and then unwind",
    complexity: "O(n) time, O(n) stack",
    group: "Recursion",
    module: "recursion",
    op: "factorial",
    params: { n: 5 },
  },
  {
    key: "recursion-tree",
    title: "Recursion tree",
    subtitle: "Count the repeated subtrees — this is the case for memoisation",
    complexity: "O(1.618ⁿ) time",
    group: "Recursion",
    module: "recursion",
    op: "recursionTree",
    params: { n: 5 },
  },
  {
    key: "hanoi",
    title: "Tower of Hanoi",
    subtitle: "2ⁿ − 1 moves, and that is provably the minimum",
    complexity: "O(2ⁿ) time",
    group: "Recursion",
    module: "recursion",
    op: "hanoi",
    params: { disks: 3 },
  },
  {
    key: "subsets",
    title: "All subsets",
    subtitle: "One binary choice per element",
    complexity: "O(n × 2ⁿ) time",
    group: "Recursion",
    module: "recursion",
    op: "subsets",
    values: "1, 2, 3",
  },
  {
    key: "n-queens",
    title: "N-Queens",
    subtitle: "Backtracking, where pruning is what makes it finish",
    complexity: "O(n!) worst case",
    group: "Recursion",
    module: "recursion",
    op: "nQueens",
    params: { size: 4 },
  },
  {
    key: "fibonacci-dp",
    title: "Fibonacci: tabulation",
    subtitle: "n additions instead of exponentially many calls",
    complexity: "O(n) time, O(n) space",
    group: "Dynamic Programming",
    module: "dp",
    op: "fibTable",
    params: { n: 10 },
  },
  {
    key: "coin-change",
    title: "Coin change",
    subtitle: "An amount that stays unreachable is reported, not rounded",
    complexity: "O(amount × coins)",
    group: "Dynamic Programming",
    module: "dp",
    op: "coinChange",
    values: "1, 2, 5",
    params: { amount: 11 },
  },
  {
    key: "lis",
    title: "Longest increasing subsequence",
    subtitle: "Subsequence, not substring — the values need not be adjacent",
    complexity: "O(n²) time",
    group: "Dynamic Programming",
    module: "dp",
    op: "lis",
    values: "10, 9, 2, 5, 3, 7, 101, 18",
  },
  {
    key: "knapsack",
    title: "0/1 knapsack",
    subtitle: "Take it whole or leave it — one row per item",
    complexity: "O(items × capacity)",
    group: "Dynamic Programming",
    module: "dp",
    op: "knapsack",
    values: "1, 2, 3, 5",
    params: { profits: "1, 6, 10, 16", capacity: 7 },
  },
  {
    key: "lcs",
    title: "Longest common subsequence",
    subtitle: "The diagonal is the match; the other two are 'drop and retry'",
    complexity: "O(m × n) time",
    group: "Dynamic Programming",
    module: "dp",
    op: "lcs",
  },
  {
    key: "edit-distance",
    title: "Edit distance",
    subtitle: "Three neighbours, three named edits",
    complexity: "O(m × n) time",
    group: "Dynamic Programming",
    module: "dp",
    op: "editDistance",
  },
];

export const visualMeta = (key: string): VisualMeta | undefined =>
  VISUAL_CATALOGUE.find((entry) => entry.key === key);

/** Groups that actually have entries, in `VISUAL_GROUPS` order. */
export const populatedVisualGroups = (): VisualGroup[] =>
  VISUAL_GROUPS.filter((group) => VISUAL_CATALOGUE.some((entry) => entry.group === group));

export const visualsInGroup = (group: VisualGroup): VisualMeta[] =>
  VISUAL_CATALOGUE.filter((entry) => entry.group === group);
