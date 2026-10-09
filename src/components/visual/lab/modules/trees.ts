/**
 * Tree-shaped structures: binary tree, BST, AVL, trie, heap, segment tree, Fenwick.
 *
 * These are the modules the standalone prototype's README listed as missing, and
 * they are where the lab earns its keep — a rotation, a range decomposition or a
 * Fenwick hop is nearly impossible to follow from code alone and nearly obvious
 * once you watch it happen.
 */

import * as avl from "../algorithms/avl";
import * as binarytree from "../algorithms/binarytree";
import * as bst from "../algorithms/bst";
import * as heap from "../algorithms/heap";
import * as segment from "../algorithms/segment";
import * as trie from "../algorithms/trie";
import { numberParam, textParam, type ModuleDef, type ParamValues } from "../types";
import { LINEAR_SPACE, LOG, NO_PARAMS, num, op, txt } from "./shared";

/* -------------------------------------------------------------------------- */
/* Binary tree                                                                 */
/* -------------------------------------------------------------------------- */

export const binaryTreeModule: ModuleDef = {
  icon: "🌲",
  label: "Binary Tree",
  usesValues: true,
  sample: "1, 2, 3, 4, 5, 6, 7",
  ops: {
    build: op(
      "Build level by level",
      "Basics",
      NO_PARAMS,
      (values) => binarytree.binaryBuildFrames(values),
      [
        "// no ordering rule — a node just has up to two children. The first value is the root, at index 0.",
        "value i goes at index i → its parent is (i−1)/2, its children 2i+1 and 2i+2",
        "// a complete tree needs no pointers at all: the index arithmetic *is* the structure",
      ],
      LINEAR_SPACE,
    ),
    preorder: op(
      "Preorder traversal",
      "Traversal",
      NO_PARAMS,
      (values) => binarytree.binaryPreorderFrames(values),
      [
        "// pre-order: the node itself, then its left subtree, then its right",
        "  enter a node          // null → return at once, which is what ends the recursion",
        "  visit(node) first, before either subtree is touched",
        "// the root arrives before anything hanging off it — which is what lets you copy or serialise a tree",
      ],
      { Time: "O(n)", Space: "O(h) for the call stack" },
    ),
    inorder: op(
      "Inorder traversal",
      "Traversal",
      NO_PARAMS,
      (values) => binarytree.binaryInorderFrames(values),
      [
        "// in-order: the left subtree, then the node, then the right",
        "  enter a node          // and descend left immediately, visiting nothing yet",
        "  visit(node) only once its whole left subtree is finished",
        "// on a binary *search* tree this comes out sorted; on an unordered tree like this one it does not",
      ],
      { Time: "O(n)", Space: "O(h)" },
    ),
    postorder: op(
      "Postorder traversal",
      "Traversal",
      NO_PARAMS,
      (values) => binarytree.binaryPostorderFrames(values),
      [
        "// post-order: the left subtree, then the right, then the node",
        "  enter a node          // descend left, then right — the node itself waits",
        "  visit(node) last, with both subtrees already done",
        "// which is exactly what you need to free a tree, or to compute anything depending on its children",
      ],
      { Time: "O(n)", Space: "O(h)" },
    ),
    levelOrder: op(
      "Level-order traversal (BFS)",
      "Traversal",
      NO_PARAMS,
      (values) => binarytree.binaryLevelOrderFrames(values),
      [
        "queue = [root]          // the one traversal that needs a queue rather than recursion",
        "  a whole depth comes off the queue before any of its children are reached",
        "  dequeue a node, visit it, enqueue its children     // left before right",
        "// reading the output back rebuilds the tree exactly, which is why it is the format this lab builds from",
      ],
      { Time: "O(n)", Space: "O(width of the tree)" },
    ),
    diameter: op(
      "Diameter",
      "Properties",
      NO_PARAMS,
      (values) => binarytree.binaryDiameterFrames(values),
      [
        "// the longest path between any two nodes — it need not pass through the root",
        "  at each node: a path through it spans height(left) + height(right) edges, and the node returns 1 + max(left, right) upward",
        "// one post-order pass, so O(n) — recomputing height at every node would be O(n²)",
      ],
      { Time: "O(n)", Space: "O(h)" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Binary search tree                                                          */
/* -------------------------------------------------------------------------- */

export const bstModule: ModuleDef = {
  icon: "🔎",
  label: "Binary Search Tree",
  usesValues: true,
  sample: "50, 30, 70, 20, 40, 60, 80",
  ops: {
    build: op(
      "Build by repeated insertion",
      "Basics",
      NO_PARAMS,
      (values, _params, ctx) => bst.bstBuildFrames(values, ctx),
      [
        "the first value becomes the root       // and the insertion order decides the entire shape",
        "  compare v with the current node      // smaller → left, larger → right",
        "  the child on that side is missing → v becomes a new leaf there",
        "  v equals the node → a BST holds a set, so nothing is added",
        "// reading the finished tree in order gives the values sorted. Insert *already* sorted input and every node goes right: a linked list, and O(n) searches.",
      ],
      { Time: "O(n log n) balanced", Worst: "O(n²) on sorted input", Space: "O(n)" },
    ),
    insert: op(
      "Insert a value",
      "Basics",
      [num("value", "Value", 45)],
      (values, params, ctx) => bst.bstInsertFrames(values, numberParam(params, "value", 45), ctx),
      [
        "node = root                            // or: the tree was empty, so v becomes the root",
        "  v vs node.value — smaller goes left, larger goes right",
        "  that side is empty → attach v there as a leaf   // O(h) comparisons, and nothing was shifted",
        "  v is already present → nothing to do",
      ],
      { Time: "O(h) — O(log n) balanced", Space: "O(1) iterative" },
    ),
    search: op(
      "Search",
      "Basics",
      [num("target", "Target", 40)],
      (values, params, ctx) => bst.bstSearchFrames(values, numberParam(params, "target", 40), ctx),
      [
        "node = root                            // searching for target",
        "  compare target with node.value",
        "  equal → found it, after one comparison per level",
        "  target < node.value → the whole right subtree is ruled out; go left",
        "  target > node.value → the whole left subtree is ruled out; go right",
        "  node == null → the walk ran out of tree, so target is not present",
      ],
      { Time: "O(h)", Space: "O(1)" },
    ),
    delete: op(
      "Delete a value",
      "Basics",
      [num("value", "Value", 30)],
      (values, params, ctx) => bst.bstDeleteFrames(values, numberParam(params, "value", 30), ctx),
      [
        "delete v: start at the root",
        "  v vs node.value — go left or right to find it",
        "  found it. How many children does it have?",
        "  0 children → detach it, and the tree is still valid",
        "  1 child    → everything below is already on the correct side, so promote it",
        "  2 children → copy the inorder successor's value here, then delete the successor instead (it has at most one child)",
        "  // v absent → there is nothing to delete",
        "  // the inorder walk is still sorted afterwards: the invariant held",
      ],
      { Time: "O(h)", Space: "O(1)" },
    ),
    inorder: op(
      "Inorder walk (sorted output)",
      "Traversal",
      NO_PARAMS,
      (values, _params, ctx) => bst.bstInorderFrames(values, ctx),
      [
        "// in-order: the left subtree, then the node, then the right",
        "  descend into node.left first — all the way down before anything is visited",
        "  visit(node), then recurse right        // its left subtree is fully emitted by now",
        "// the sorted order is not stored anywhere: it falls out of the shape of the tree",
      ],
      { Time: "O(n)", Space: "O(h)" },
    ),
    minMax: op(
      "Minimum and maximum",
      "Queries",
      NO_PARAMS,
      (values, _params, ctx) => bst.bstMinMaxFrames(values, ctx),
      [
        "// the smallest value is the leftmost node, the largest the rightmost",
        "function min(root): walk left while left != null",
        "  the node with no left child is the minimum",
        "function max(root): walk right while right != null",
        "  the node with no right child is the maximum   // no comparisons at all, only direction — both cost O(h), not O(n)",
      ],
      LOG,
    ),
    successor: op(
      "Inorder successor",
      "Queries",
      [num("value", "Value", 40)],
      (values, params, ctx) => bst.bstSuccessorFrames(values, numberParam(params, "value", 40), ctx),
      [
        "function successor(root, v):           // descend to find v first",
        "  found v",
        "  if node has a right subtree: take the smallest value in it",
        "  that node is the successor           // or: v is the largest key, so it has none",
        "  otherwise: the lowest ancestor whose left subtree contains v",
        "  // if v is not in the tree there is no successor to find",
      ],
      { Time: "O(h)", Space: "O(1)" },
    ),
    validate: op(
      "Validate the BST property",
      "Queries",
      NO_PARAMS,
      (values, _params, ctx) => bst.bstValidateFrames(values, ctx),
      [
        "// carry a permitted range down the tree, rather than comparing neighbours",
        "  node.value must fall strictly inside the (low, high) inherited from its ancestors",
        "  recurse left with (low, node.value) and right with (node.value, high) — every node passed, so this is a valid BST",
        "  a value breaks its range → not a BST. Comparing each node only with its parent misses exactly this case.",
      ],
      { Time: "O(n)", Space: "O(h)" },
    ),
    lca: op(
      "Lowest common ancestor",
      "Queries",
      [num("a", "First value", 20), num("b", "Second value", 40)],
      (values, params, ctx) =>
        bst.bstLcaFrames(values, numberParam(params, "a", 20), numberParam(params, "b", 40), ctx),
      [
        "node = root        // the ordering alone says where to turn; no path has to be stored",
        "  both a and b < node.value → the answer is in the left subtree",
        "  both a and b > node.value → go right",
        "  otherwise the two paths split here, so node is the LCA",
        "  the walk left the tree → at least one of those values is not in it",
      ],
      { Time: "O(h)", Space: "O(1)" },
    ),
    height: op(
      "Height and balance",
      "Queries",
      NO_PARAMS,
      (values, _params, ctx) => bst.bstHeightFrames(values, ctx),
      [
        "// height is computed bottom-up, and a null child counts as 0",
        "  each node: 1 + max(height(left), height(right))    // both children finish before it does",
        "// compare the answer with ceil(log₂(n+1)) — that gap is exactly what AVL and red-black trees remove",
      ],
      { Time: "O(n)", Space: "O(h)" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* AVL                                                                         */
/* -------------------------------------------------------------------------- */

export const avlModule: ModuleDef = {
  icon: "⚖",
  label: "AVL Tree",
  usesValues: true,
  sample: "10, 20, 30, 40, 50, 25",
  ops: {
    build: op(
      "Build with rotations",
      "Basics",
      NO_PARAMS,
      (values, _params, ctx) => avl.avlBuildFrames(values, ctx),
      [
        "function insert(node, v):                  // an ordinary BST descent",
        "  attach v as a leaf                       // an AVL tree holds a set",
        "  walk back up, updating height(node)      // balance = h(left) − h(right)",
        "  if |balance| > 1: this subtree must rotate",
        "    left-right  → rotate the left child left, then the pivot right",
        "    left-left   → one right rotation at the pivot",
        "    right-left  → rotate the right child right, then the pivot left",
        "    right-right → one left rotation at the pivot",
        "  // try the sorted input 10,20,30,40,50 — a plain BST degenerates",
      ],
      { Time: "O(n log n)", Space: "O(n)", Height: "always ≤ 1.44 · log₂(n)" },
    ),
    insert: op(
      "Insert one value",
      "Basics",
      [num("value", "Value", 35)],
      (values, params, ctx) => avl.avlInsertFrames(values, numberParam(params, "value", 35), ctx),
      [
        "function insert(node, v):                  // an ordinary BST descent",
        "  attach v as a leaf",
        "  walk back up, updating height(node)      // balance = h(left) − h(right)",
        "  if |balance| > 1: this subtree must rotate",
        "    left-right  → rotate the left child left, then the pivot right",
        "    left-left   → one right rotation at the pivot",
        "    right-left  → rotate the right child right, then the pivot left",
        "    right-right → one left rotation at the pivot",
        "  // at most two rotations fix any single insertion",
      ],
      { Time: "O(log n)", Space: "O(log n)" },
    ),
    delete: op(
      "Delete one value",
      "Basics",
      [num("value", "Value", 30)],
      (values, params, ctx) => avl.avlDeleteFrames(values, numberParam(params, "value", 30), ctx),
      [
        "function delete(node, v):                  // descend to find v",
        "  remove it: two children → copy the successor up and delete that node",
        "  walk back up, updating height(node)      // balance = h(left) − h(right)",
        "  if |balance| > 1: this subtree must rotate",
        "    left-right  → rotate the left child left, then the pivot right",
        "    left-left   → one right rotation at the pivot",
        "    right-left  → rotate the right child right, then the pivot left",
        "    right-right → one left rotation at the pivot",
        "  // unlike an insert, a delete can rotate at every level up to the root",
      ],
      { Time: "O(log n)", Space: "O(log n)" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Trie                                                                        */
/* -------------------------------------------------------------------------- */

const TRIE_SEED = txt("seed", "Words already stored", "cat, car, card, care, dog, do");

export const trieModule: ModuleDef = {
  icon: "🔠",
  label: "Trie",
  usesValues: false,
  ops: {
    insert: op(
      "Insert a word",
      "Basics",
      [TRIE_SEED, txt("word", "Word to insert", "cart")],
      (_values, params, ctx) =>
        trie.trieInsertFrames(
          textParam(params, "seed", "cat, car, card, care, dog, do"),
          textParam(params, "word", "cart"),
          ctx,
        ),
      [
        "// insert one character at a time, starting at the root",
        "  the child for ch already exists → follow it; that part of the word costs nothing to store",
        "  no child for ch → create one, extending the trie by a single node",
        "  node.isWord = true        // without that ★ the word would only be a prefix",
        "// shared prefixes are stored exactly once, and the cost is the word's length — not how many words are stored",
      ],
      { Time: "O(length of the word)", Space: "O(total characters)", Note: "independent of how many words are stored" },
    ),
    search: op(
      "Search for a word",
      "Queries",
      [TRIE_SEED, txt("word", "Word to find", "car")],
      (_values, params, ctx) =>
        trie.trieSearchFrames(
          textParam(params, "seed", "cat, car, card, care, dog, do"),
          textParam(params, "word", "car"),
          ctx,
        ),
      [
        "function search(root, word):",
        "  walk one child per character",
        "  return node.isWord      // 'car' is a word, 'ca' is not",
        "  // a missing child: the word is absent, and so is every word below it",
        "  // the path exists but carries no ★: 'ca' is only a prefix",
      ],
      { Time: "O(length of the word)", Space: "O(1)" },
    ),
    prefix: op(
      "Prefix search (autocomplete)",
      "Queries",
      [TRIE_SEED, txt("prefix", "Prefix", "ca")],
      (_values, params, ctx) =>
        trie.triePrefixFrames(
          textParam(params, "seed", "cat, car, card, care, dog, do"),
          textParam(params, "prefix", "ca"),
          ctx,
        ),
      [
        "// find every word starting with the prefix — the operation a hash map cannot do at all",
        "  follow one edge per character to reach the prefix node",
        "  no such edge → nothing in the trie starts with this prefix, and one character was enough to know",
        "  everything in that node's subtree shares the prefix → collect it. Walking the prefix found them all.",
      ],
      { Time: "O(prefix + matches)", Space: "O(matches)" },
    ),
    delete: op(
      "Delete a word",
      "Basics",
      [TRIE_SEED, txt("word", "Word to delete", "card")],
      (_values, params, ctx) =>
        trie.trieDeleteFrames(
          textParam(params, "seed", "cat, car, card, care, dog, do"),
          textParam(params, "word", "card"),
          ctx,
        ),
      [
        "delete(word):                          // walk to the end node",
        "  follow one edge per character",
        "  clear isWord there                   // the word is no longer stored",
        "  walk back up removing every node with no children and no ★ of its own — and stop at the first node that has either",
        "  // a missing edge, or an end node carrying no ★: there is nothing to delete",
        "// which is why deleting 'card' cannot damage 'car' or 'care' — that stop condition is the whole trick",
      ],
      { Time: "O(length of the word)", Space: "O(length)" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Heap                                                                       */
/* -------------------------------------------------------------------------- */

const KIND_PARAM = txt("kind", "Heap kind", "max", "Type max or min");
const heapKind = (params: ParamValues): "max" | "min" =>
  textParam(params, "kind", "max").trim().toLowerCase() === "min" ? "min" : "max";

export const heapModule: ModuleDef = {
  icon: "⛰",
  label: "Heap",
  usesValues: true,
  sample: "4, 10, 3, 5, 1, 8, 7",
  ops: {
    build: op(
      "Heapify an array",
      "Basics",
      [KIND_PARAM],
      (values, params, ctx) => heap.heapBuildFrames(values, heapKind(params), ctx),
      [
        "// the values as typed, read as a tree — not a heap yet",
        "every index past n/2 − 1 is a leaf, and a leaf is already a valid heap → start at n/2 − 1",
        "  siftDown(i)          // compare with the better child, swap, and carry on from there",
        "// bottom-up is O(n), not O(n log n): most nodes are near the bottom and barely move",
      ],
      { Time: "O(n)", Space: "O(1)", Naive: "O(n log n) by inserting one at a time" },
    ),
    insert: op(
      "Insert (sift up)",
      "Basics",
      [KIND_PARAM, num("value", "Value", 15)],
      (values, params, ctx) =>
        heap.heapInsertFrames(values, numberParam(params, "value", 15), heapKind(params), ctx),
      [
        "arr[n] = v        // the first free slot, which is what keeps the tree complete",
        "  compare arr[i] with its parent at (i−1)/2",
        "  the child outranks the parent → swap them, and continue from the parent",
        "  the parent already outranks it → stop. At most one swap per level, so O(log n).",
      ],
      { Time: "O(log n)", Space: "O(1)" },
    ),
    extract: op(
      "Extract the root (sift down)",
      "Basics",
      [KIND_PARAM],
      (values, params, ctx) => heap.heapExtractFrames(values, heapKind(params), ctx),
      [
        "root = arr[0]                       // the value being extracted",
        "swap it with the last element       // which is what keeps the tree complete",
        "drop the last slot                  // that old last leaf now sits at the root, almost certainly wrong",
        "  compare it with its better child",
        "  the child outranks it → swap down and carry on",
        "// the heap property is restored, and only one root-to-leaf path moved: O(log n)",
      ],
      { Time: "O(log n)", Space: "O(1)" },
    ),
    peek: op(
      "Peek at the root",
      "Basics",
      [KIND_PARAM],
      (values, params, ctx) => heap.heapPeekFrames(values, heapKind(params), ctx),
      [
        "return arr[0]        // the extreme value is always at index 0 — the one thing a heap guarantees, and reading it is O(1)",
      ],
      { Time: "O(1)", Space: "O(1)" },
    ),
    search: op(
      "Search for a value",
      "Queries",
      [KIND_PARAM, num("target", "Target", 5)],
      (values, params, ctx) =>
        heap.heapSearchFrames(values, numberParam(params, "target", 5), heapKind(params), ctx),
      [
        "// a heap orders parents against children, not left against right — so no subtree can ever be ruled out",
        "  check arr[i]        // in index order; there is nothing smarter available",
        "  equal to target → found it",
        "  the array ran out → absent, and it took all n checks to know. Use a BST or a hash table if you need lookups.",
      ],
      { Time: "O(n)", Space: "O(1)", Contrast: "a BST would do this in O(log n)" },
    ),
    sort: op(
      "Heap sort (in the tree)",
      "Applications",
      [KIND_PARAM],
      (values, params, ctx) => heap.heapSortTreeFrames(values, heapKind(params), ctx),
      [
        "buildHeap(arr), then pull the root n times      // n extractions × O(log n) each = O(n log n)",
        "  the root is the next value in sorted order → append it to the output",
        "  move the last leaf up to the root and sift it down    // restoring a heap one element smaller",
      ],
      { Time: "O(n log n)", Space: "O(1)", Note: "in place, but not stable" },
    ),
    updateKey: op(
      "Update a key",
      "Applications",
      [KIND_PARAM, num("index", "Index", 3, 0), num("value", "New value", 20)],
      (values, params, ctx) =>
        heap.heapUpdateKeyFrames(
          values,
          numberParam(params, "index", 3),
          numberParam(params, "value", 20),
          heapKind(params),
          ctx,
        ),
      [
        "function updateKey(i, v):              // arr[i] = v",
        "  if v outranks the old value: siftUp(i)",
        "    compare with the parent, swapping while v keeps winning",
        "  else: siftDown(i)                    // compare with the better child",
        "  // either way one path moves, not the whole heap — O(log n)",
        "  // v equal to the old value: the heap property never broke",
      ],
      { Time: "O(log n)", Space: "O(1)" },
    ),
    kthLargest: op(
      "kth largest element",
      "Applications",
      [num("k", "k", 3, 1)],
      (values, params, ctx) => heap.heapKthLargestFrames(values, numberParam(params, "k", 3), ctx),
      [
        "// a min heap capped at k: the smallest of the best k sits at the root, ready to be evicted",
        "  the heap holds fewer than k → just add v",
        "  v beats the root → the root cannot be in the top k, so evict it and sift v down in its place",
        "  v does not beat the root → it is not in the top k either; discard it without touching the heap",
        "return heap.peek()        // the kth largest. The heap never held more than k, so O(n log k), not O(n log n).",
      ],
      { Time: "O(n log k)", Space: "O(k)" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Segment tree                                                                */
/* -------------------------------------------------------------------------- */

export const segmentModule: ModuleDef = {
  icon: "📐",
  label: "Segment Tree",
  usesValues: true,
  sample: "5, 3, 8, 1, 9, 2, 7, 4",
  ops: {
    build: op(
      "Build",
      "Basics",
      NO_PARAMS,
      (values, _params, ctx) => segment.segBuildFrames(values, ctx),
      [
        "// every node holds the sum of one range: the root covers the whole array, and each level halves it",
        "  l == r → this leaf simply holds arr[l]",
        "  otherwise tree[node] = tree[left] + tree[right]    // computed only once both children are",
        "// 2n−1 nodes for n values, each computed exactly once — so building is O(n)",
      ],
      { Time: "O(n)", Space: "O(n)" },
    ),
    query: op(
      "Range sum query",
      "Queries",
      [num("from", "From index", 1, 0), num("to", "To index", 5, 0)],
      (values, params, ctx) =>
        segment.segQueryFrames(values, numberParam(params, "from", 1), numberParam(params, "to", 5), ctx),
      [
        "// three cases at every node — compare its range with the query",
        "  partial overlap → split, and ask both children",
        "  the node sits entirely inside the query → take its stored sum, and never enter its subtree",
        "  no overlap at all → contribute 0 and stop descending",
        "// any range decomposes into at most O(log n) stored nodes, however wide it is",
      ],
      { Time: "O(log n)", Space: "O(log n)" },
    ),
    update: op(
      "Point update",
      "Updates",
      [num("index", "Index", 3, 0), num("value", "New value", 12)],
      (values, params, ctx) =>
        segment.segUpdateFrames(values, numberParam(params, "index", 3), numberParam(params, "value", 12), ctx),
      [
        "// only the nodes whose range contains i can change, and that is one path from the root",
        "  descend into whichever half contains i",
        "  l == r → this is the leaf; write v into it",
        "  on the way back up: tree[node] = tree[left] + tree[right]",
        "// exactly one root-to-leaf path is rewritten, so O(log n) — every other node is already correct",
      ],
      { Time: "O(log n)", Space: "O(log n)" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Fenwick tree                                                                */
/* -------------------------------------------------------------------------- */

export const fenwickModule: ModuleDef = {
  icon: "🧮",
  label: "Fenwick Tree (BIT)",
  usesValues: true,
  sample: "5, 3, 8, 1, 9, 2, 7, 4",
  ops: {
    build: op(
      "Build",
      "Basics",
      NO_PARAMS,
      (values, _params, ctx) => segment.fenwickBuildFrames(values, ctx),
      [
        "// one array. Slot i covers the (i & −i) values ending at i — the lowest set bit decides its range.",
        "  tree[i] += arr[i]           // i's lowest set bit is exactly how many elements slot i covers",
        "  parent = i + (i & −i); tree[parent] += tree[i]     // that slot covers i's whole range, so push the total up",
        "  parent > n → past the end, so there is nothing above slot i to update",
        "// n steps, O(n) — and the same n numbers now answer any prefix sum in O(log n), updates included",
      ],
      { Time: "O(n)", Space: "O(n)" },
    ),
    prefix: op(
      "Prefix sum",
      "Queries",
      [num("index", "Up to index (1-based)", 6, 1)],
      (values, params, ctx) => segment.fenwickPrefixFrames(values, numberParam(params, "index", 6), ctx),
      [
        "// start at slot i and keep removing the lowest set bit",
        "  total += tree[i]            // this slot's whole range lies inside the prefix",
        "  i −= i & −i                 // strip the lowest set bit to drop to the next slot; 0 means done",
        "// the number of hops is the popcount of i — not a coincidence, that *is* the running time",
      ],
      { Time: "O(log n)", Space: "O(1)" },
    ),
    update: op(
      "Point update",
      "Updates",
      [num("index", "Index (1-based)", 4, 1), num("delta", "Add", 5)],
      (values, params, ctx) =>
        segment.fenwickUpdateFrames(values, numberParam(params, "index", 4), numberParam(params, "delta", 5), ctx),
      [
        "// every slot whose range contains i must change — walk up by adding the lowest set bit",
        "  tree[i] += delta            // this slot's range contains the updated position",
        "  i += i & −i                 // the next slot up whose range also contains it",
        "// the same bit trick as the query, walking the other way. A plain prefix-sum array would rewrite its whole tail.",
      ],
      { Time: "O(log n)", Space: "O(1)" },
    ),
  },
};
