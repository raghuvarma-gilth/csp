/**
 * Linear structures: array, string, matrix, stack, queue, linked list, hash table.
 *
 * Every `generate` here is a thin adapter — read the parameters, call the pure
 * algorithm. Nothing in this file computes anything itself, which is deliberate:
 * the logic lives under `algorithms/` where `scripts/verify-lab.ts` can execute
 * it in Node without a browser.
 */

import * as arrays from "../algorithms/arrays";
import * as hashing from "../algorithms/hashing";
import * as linked from "../algorithms/linkedlist";
import * as matrix from "../algorithms/matrix";
import * as queue from "../algorithms/queue";
import * as stack from "../algorithms/stack";
import * as strings from "../algorithms/strings";
import { numberParam, textParam, type ModuleDef } from "../types";
import { CONSTANT, LINEAR, LINEAR_SPACE, NO_PARAMS, num, op, txt } from "./shared";

/* -------------------------------------------------------------------------- */
/* Array                                                                       */
/* -------------------------------------------------------------------------- */

export const arrayModule: ModuleDef = {
  icon: "▦",
  label: "Array",
  usesValues: true,
  sample: "5, 3, 8, 1, 9, 2, 7",
  ops: {
    access: op(
      "Access by index",
      "Basics",
      [num("index", "Index", 3, 0)],
      (values, params) => arrays.accessFrames(values, numberParam(params, "index", 0)),
      [
        "// one step, whatever the index: the address is computed, not searched for",
        "address = base + i * elementSize",
        "return memory[address]",
      ],
      { Time: "O(1)", Space: "O(1)", Why: "the address is computed, not searched for" },
    ),
    update: op(
      "Update in place",
      "Basics",
      [num("index", "Index", 2, 0), num("value", "New value", 42)],
      (values, params) =>
        arrays.updateFrames(values, numberParam(params, "index", 0), numberParam(params, "value", 0)),
      [
        "// before: arr[i] already exists — the slot is there, only its contents change",
        "arr[i] = v    // one write, and nothing else moves, whatever n is",
      ],
      CONSTANT,
    ),
    insertAtBegin: op(
      "Insert at the front",
      "Insert & delete",
      [num("value", "Value", 42)],
      (values, params) => arrays.insertAtFrames(values, 0, numberParam(params, "value", 0)),
      [
        "function insertFront(arr, v):          // the array grows by one slot",
        "  for i from n-1 down to 0: arr[i+1] = arr[i]   // every element shifts right",
        "  arr[0] = v;  n = n + 1                 // only now is there a hole to write into",
      ],
      { Time: "O(n)", Space: "O(1)", Why: "every existing element has to move one slot right" },
    ),
    insertAt: op(
      "Insert at an index",
      "Insert & delete",
      [num("index", "Index", 2, 0), num("value", "Value", 42)],
      (values, params) =>
        arrays.insertAtFrames(values, numberParam(params, "index", 0), numberParam(params, "value", 0)),
      [
        "function insertAt(arr, i, v):          // the array grows by one slot",
        "  for j from n-1 down to i: arr[j+1] = arr[j]   // make room",
        "  arr[i] = v;  n = n + 1                 // write into the hole",
      ],
      { Time: "O(n)", Space: "O(1)", Best: "O(1) when inserting at the end" },
    ),
    insertAtEnd: op(
      "Append",
      "Insert & delete",
      [num("value", "Value", 42)],
      (values, params) => arrays.insertAtEndFrames(values, numberParam(params, "value", 0)),
      [
        "// before: n elements, with a free slot already sitting at index n",
        "arr[n] = v;  n = n + 1    // nothing has to move — this is the cheap one",
      ],
      { Time: "O(1) amortised", Space: "O(1)", Note: "O(n) on the resize that doubles capacity" },
    ),
    deleteAt: op(
      "Delete at an index",
      "Insert & delete",
      [num("index", "Index", 2, 0)],
      (values, params) => arrays.deleteAtFrames(values, numberParam(params, "index", 0)),
      [
        "deleteAt(arr, i):                      // arr[i] is about to be overwritten",
        "  for j from i to n-2: arr[j] = arr[j+1]     // every later element shifts left to close the hole",
        "  n = n - 1    // O(n): deleting the first element means moving all the rest",
      ],
      LINEAR,
    ),
    deleteAtEnd: op(
      "Delete the last element",
      "Insert & delete",
      NO_PARAMS,
      (values) => arrays.deleteAtEndFrames(values),
      [
        "// the last element is the only one with nothing after it to close up",
        "n = n - 1    // no shifting required at all, so O(1)",
      ],
      CONSTANT,
    ),
    reverse: op(
      "Reverse",
      "Transform",
      NO_PARAMS,
      (values) => arrays.reverseArrayFrames(values),
      [
        "l = 0; r = n - 1                  // one index at each end",
        "while l < r:                      // arr[l] and arr[r] are the pair to exchange",
        "  swap(arr[l], arr[r]);  l++;  r--      // both indices step inward by one",
        "// they meet after n/2 swaps — O(n), and in place: no second array is needed",
      ],
      LINEAR,
    ),
    rotateLeft: op(
      "Rotate left by k",
      "Transform",
      [num("k", "k", 2, 0)],
      (values, params) => arrays.rotateFrames(values, numberParam(params, "k", 1), "left"),
      [
        "k = k mod n                       // rotating by n leaves the array unchanged",
        "repeat k times: move the front element to the back     // one position each time",
        "// shown as k single rotations, which is O(n·k). Three reversals do it in O(n): reverse [0..k-1], reverse [k..n-1], then reverse the whole array.",
      ],
      { Time: "O(n·k) as shown", Space: "O(1)", Faster: "O(n) with three reversals" },
    ),
    rotateRight: op(
      "Rotate right by k",
      "Transform",
      [num("k", "k", 2, 0)],
      (values, params) => arrays.rotateFrames(values, numberParam(params, "k", 1), "right"),
      [
        "k = k mod n                       // rotating by n leaves the array unchanged",
        "repeat k times: move the back element to the front     // one position each time",
        "// shown as k single rotations, which is O(n·k). Three reversals do it in O(n): reverse the whole array, then [0..k-1], then [k..n-1].",
      ],
      { Time: "O(n·k) as shown", Space: "O(1)", Faster: "O(n) with three reversals" },
    ),
    prefixSum: op(
      "Prefix sums",
      "Patterns",
      NO_PARAMS,
      (values) => arrays.prefixSumFrames(values),
      [
        "// prefix[i] holds the sum of everything up to i, so prefix[0] = arr[0]",
        "  for i from 1 to n-1: prefix[i] = prefix[i-1] + arr[i]",
        "// one pass built it, and now any range sum is a single subtraction",
      ],
      LINEAR_SPACE,
    ),
    rangeSum: op(
      "Range sum query",
      "Patterns",
      [num("from", "From index", 1, 0), num("to", "To index", 4, 0)],
      (values, params) =>
        arrays.rangeSumFrames(values, numberParam(params, "from", 0), numberParam(params, "to", 0)),
      [
        "// first, one O(n) pass builds prefix[i] = the sum of arr[0..i]",
        "rangeSum(l, r):                   // every query after that is answered without a loop",
        "  return l == 0 ? prefix[r] : prefix[r] - prefix[l-1]     // one subtraction, O(1)",
      ],
      { Time: "O(1) per query", Space: "O(n)", Build: "O(n) once" },
    ),
    kadane: op(
      "Maximum subarray (Kadane)",
      "Patterns",
      NO_PARAMS,
      (values) => arrays.kadaneFrames(values),
      [
        "best = current = arr[0]           // the answer is never the empty subarray",
        "  current < 0 → current = arr[i]   // a negative running sum can only hurt: restart here",
        "  otherwise   → current = current + arr[i]       // extend the run",
        "  best = max(best, current)       // record it the moment it improves",
        "return best    // one pass, O(n) — instead of testing all O(n²) subarrays",
      ],
      LINEAR,
    ),
    dutchFlag: op(
      "Dutch national flag (3-way partition)",
      "Patterns",
      NO_PARAMS,
      (values) => arrays.dutchFlagFrames(values),
      [
        "low = 0; mid = 0; high = n - 1         // three bands, one pass",
        "while mid <= high:                     // look at arr[mid]",
        "  arr[mid] == 0 → swap(low, mid); low++; mid++",
        "  arr[mid] == 1 → mid++                // already in the middle band",
        "  otherwise     → swap(mid, high); high--   // MID stays: that value is unseen",
        "// no two elements are ever compared with each other, so this is O(n)",
      ],
      LINEAR,
    ),
    cyclicSort: op(
      "Cyclic sort",
      "Patterns",
      NO_PARAMS,
      (values) => arrays.cyclicSortFrames(values),
      [
        "// only works on a permutation of 1..n: every value's home is index value-1",
        "  target = arr[i] - 1;  arr[i] != arr[target] → swap them",
        "    i does not advance — the value that just landed at i is unseen",
        "  arr[i] == arr[target] → already home, or a duplicate, so i++",
        "// each value is moved at most once, so O(n) with no comparisons at all",
      ],
      LINEAR,
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* String                                                                      */
/* -------------------------------------------------------------------------- */

export const stringModule: ModuleDef = {
  icon: "🔤",
  label: "String",
  usesValues: false,
  ops: {
    kmp: op(
      "KMP pattern search",
      "Matching",
      [
        txt("text", "Text", "ababcabcabababd"),
        txt("pattern", "Pattern", "ababd", "Watch the lps table build first"),
      ],
      (_values, params) =>
        strings.kmpFrames(
          strings.parseText(textParam(params, "text", "ababcabcabababd")),
          strings.parseText(textParam(params, "pattern", "ababd")),
        ),
      [
        "// phase 1 — the pattern studies itself",
        "lps[0] = 0                               // one character has no proper prefix",
        "  if pattern[i] == pattern[len]: len++; lps[i] = len; i++",
        "  else if len > 0: len = lps[len-1]      // fall back, do not restart",
        "  else: lps[i] = 0; i++",
        "// lps is built in O(m), from the pattern alone",
        "// phase 2 — scan the text, never moving i backwards",
        "  if text[i] == pattern[j]: i++; j++",
        "    if j == m: match at i-m; j = lps[m-1]",
        "  else if j > 0: j = lps[j-1]            // reuse what we know",
        "  else: i++",
        "// O(n + m) overall — every character of the text is read once",
      ],
      { Time: "O(n + m)", Space: "O(m)", Why: "the text pointer never moves backwards" },
    ),
    rabinKarp: op(
      "Rabin–Karp rolling hash",
      "Matching",
      [txt("text", "Text", "abracadabra"), txt("pattern", "Pattern", "abra")],
      (_values, params) =>
        strings.rabinKarpFrames(
          strings.parseText(textParam(params, "text", "abracadabra")),
          strings.parseText(textParam(params, "pattern", "abra")),
        ),
      [
        "target = hash(pattern)                   // hashed once",
        "window = hash of the next m characters   // rolled in O(1), not recomputed",
        "  if window != target: skip — different numbers mean different strings",
        "  if window == target: verify character by character",
        "    equal     → a real match",
        "    not equal → a collision, which is why the check is not optional",
        "// O(n + m) expected; O(n·m) if every window happens to collide",
      ],
      { Time: "O(n + m) expected", Worst: "O(n·m) when every hash collides", Space: "O(1)" },
    ),
    palindrome: op(
      "Palindrome check",
      "Properties",
      [txt("text", "Text", "racecar")],
      (_values, params) => strings.palindromeFrames(strings.parseText(textParam(params, "text", "racecar"))),
      [
        "s = lowercase, letters and digits only;  l = 0;  r = len(s) - 1",
        "  s[l] == s[r] → l++; r--            // this pair agrees, so step both inwards",
        "  l >= r → every pair matched: it is a palindrome",
        "  s[l] != s[r] → not a palindrome    // one mismatch settles it; the middle is never read",
      ],
      { Time: "O(n)", Space: "O(1) for the walk, O(n) for the cleaned copy" },
    ),
    anagram: op(
      "Anagram check",
      "Properties",
      [txt("first", "First", "listen"), txt("second", "Second", "silent")],
      (_values, params) =>
        strings.anagramFrames(
          strings.parseText(textParam(params, "first", "listen")),
          strings.parseText(textParam(params, "second", "silent")),
        ),
      [
        "// one counter per distinct letter across both words",
        "for each character of a: count[ch] += 1        // count the first word up",
        "for each character of b: count[ch] -= 1        // and the second one back down",
        "  a counter drops below zero → b uses a letter a does not have: not anagrams, stop",
        "anagrams exactly when every counter is zero    // different lengths never can be, so check that first",
      ],
      { Time: "O(n)", Space: "O(k) for k distinct characters", Versus: "sorting both strings is O(n log n)" },
    ),
    reverse: op(
      "Reverse a string",
      "Properties",
      [txt("text", "Text", "algorithm")],
      (_values, params) => strings.reverseStringFrames(strings.parseText(textParam(params, "text", "algorithm"))),
      [
        "l = 0; r = len(s) - 1                   // one index at each end",
        "  swap(s[l], s[r])                      // the pair trades places",
        "  l++; r--                              // both step inwards",
        "  l == r → an odd-length string has a middle character, and it stays where it is",
        "// ⌊n/2⌋ swaps, in place — no second string is allocated",
      ],
      LINEAR,
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Matrix / grid                                                               */
/* -------------------------------------------------------------------------- */

export const matrixModule: ModuleDef = {
  icon: "▩",
  label: "Matrix / Grid",
  usesValues: true,
  sample: "1, 2, 3, 4, 5, 6, 7, 8, 9",
  ops: {
    spiral: op(
      "Spiral traversal",
      "Traversal",
      [num("cols", "Columns", 3, 1, 12, "The values are filled in row by row")],
      (values, params) => matrix.spiralFrames(values, numberParam(params, "cols", 3)),
      [
        "// four boundaries — top, bottom, left, right — close in on each other",
        "  walk right along the top row, then top++",
        "  walk down the right column, then right--",
        "  top <= bottom still? walk left along the bottom row, then bottom--   // skip this check and a row is emitted twice",
        "  left <= right still? walk up the left column, then left++",
        "// every cell exactly once: O(rows × cols), with only those four numbers as state",
      ],
      { Time: "O(rows · cols)", Space: "O(1)" },
    ),
    transpose: op(
      "Transpose",
      "Transform",
      [num("cols", "Columns", 3, 1, 12, "Must be square — rows and columns swap roles")],
      (values, params) => matrix.transposeFrames(values, numberParam(params, "cols", 3)),
      [
        "// square matrices only: (r, c) trades places with (c, r), so rows become columns",
        "  (r, r) sits on the diagonal — it would swap with itself, so skip it",
        "  for c from r+1 to n-1: swap(grid[r][c], grid[c][r])    // the upper triangle only",
        "// visiting all n² cells would swap every pair twice and hand back the original",
      ],
      { Time: "O(n²)", Space: "O(1)" },
    ),
    rotate: op(
      "Rotate 90° clockwise",
      "Transform",
      [num("cols", "Columns", 3, 1, 12, "Must be square")],
      (values, params) => matrix.rotateFrames(values, numberParam(params, "cols", 3)),
      [
        "function rotate90(grid):               // square matrices only, in place",
        "  pass 1: transpose — swap (r, c) with (c, r)",
        "  // that alone is a reflection across the diagonal, not a rotation",
        "  pass 2: reverse each row",
        "  // two simple passes instead of index arithmetic, O(1) extra space",
      ],
      { Time: "O(n²)", Space: "O(1)" },
    ),
    floodFill: op(
      "Flood fill",
      "Search",
      [
        num("cols", "Columns", 4, 1, 12),
        num("row", "Start row", 0, 0),
        num("col", "Start column", 0, 0),
      ],
      (values, params) =>
        matrix.floodFillFrames(
          values,
          numberParam(params, "cols", 4),
          numberParam(params, "row", 0),
          numberParam(params, "col", 0),
        ),
      [
        "// the grid is the graph: a cell's neighbours are the four cells next to it",
        "stack = [start];  pop a cell and fill it      // depth-first, with the stack written out",
        "  a neighbour holding a different value → a boundary; the region stops there",
        "  a neighbour holding the same value, not seen yet → mark it and push it",
        "// marking on push rather than on pop is what stops one cell entering the stack four times",
      ],
      { Time: "O(rows · cols)", Space: "O(rows · cols) for the stack" },
    ),
    shortestPath: op(
      "Shortest path on a grid (BFS)",
      "Search",
      [num("cols", "Columns", 5, 1, 12, "A cell typed as 0 is a wall; every other value is open")],
      (values, params) => matrix.gridShortestPathFrames(values, numberParam(params, "cols", 5)),
      [
        "// a cell typed as 0 is a wall; start at (0, 0), goal is the far corner",
        "expand the whole frontier one ring at a time — every new cell is `ring` steps out",
        "walk the parent links back from the goal to recover the route",
        "// the first arrival at a cell is a shortest one, because the rings grow evenly. Weighted steps would need Dijkstra.",
        "the frontier ran out with the goal unreached → the walls cut it off, so no path exists",
        "the start or the goal is itself a wall → there is nothing to search",
      ],
      { Time: "O(rows · cols)", Space: "O(rows · cols)" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Stack                                                                       */
/* -------------------------------------------------------------------------- */

export const stackModule: ModuleDef = {
  icon: "🗃",
  label: "Stack",
  usesValues: true,
  sample: "5, 3, 8, 1, 9",
  ops: {
    push: op(
      "Push",
      "Basics",
      [num("value", "Value", 42)],
      (values, params) => stack.pushFrames(values, numberParam(params, "value", 0)),
      [
        "function push(stack, v):               // before: TOP is the last filled slot",
        "  top = top + 1;  stack[top] = v       // it lands on top, in O(1)",
      ],
      CONSTANT,
    ),
    pop: op(
      "Pop",
      "Basics",
      NO_PARAMS,
      (values) => stack.popFrames(values),
      [
        "function pop(stack):                   // top < 0 would underflow",
        "  v = stack[top];  top = top - 1       // TOP moves down; nothing is shifted",
      ],
      CONSTANT,
    ),
    peek: op(
      "Peek",
      "Basics",
      NO_PARAMS,
      (values) => stack.peekFrames(values),
      [
        "return stack[top]                      // read, not removed — and O(1)",
        "// when top < 0 the stack is empty, so there is nothing to read",
      ],
      CONSTANT,
    ),
    nextGreater: op(
      "Next greater element (monotonic stack)",
      "Patterns",
      NO_PARAMS,
      (values) => stack.nextGreaterFrames(values),
      [
        "stack = []                             // indices whose answer is still unknown",
        "for i from 0 to n-1:                   // arr[i] is the candidate answer",
        "  while stack not empty and arr[stack.top] < arr[i]:  answer[stack.pop()] = arr[i]",
        "  stack.push(i)                        // arr[i] now waits for its own answer",
        "// anything still on the stack has nothing greater to its right, so its answer is -1",
      ],
      { Time: "O(n)", Space: "O(n)", Why: "each index enters and leaves the stack once" },
    ),
    minStack: op(
      "Min stack",
      "Patterns",
      NO_PARAMS,
      (values) => stack.minStackFrames(values),
      [
        "// a second stack holds the minimum of everything at or below each level",
        "push(v):  main.push(v);  mins.push(min(v, mins.top))   // one extra O(1) write",
        "getMin(): return mins.top    // O(1) — a read, never a scan of the whole stack",
      ],
      { Time: "O(1) per operation", Space: "O(n)" },
    ),
    balancedBrackets: op(
      "Balanced brackets",
      "Applications",
      [txt("expression", "Expression", "{[()()]}")],
      (_values, params) => stack.balancedBracketsFrames(textParam(params, "expression", "{[()()]}")),
      [
        "stack = [];  scan the expression left to right",
        "  ch is an opener → stack.push(ch)        // it has to be closed later",
        "  ch is a closer  → it must match stack.top, so pop that opener",
        "  stack empty, or the top is the wrong opener → not balanced",
        "// balanced exactly when every bracket matched AND the stack ends empty",
      ],
      LINEAR_SPACE,
    ),
    infixToPostfix: op(
      "Infix → postfix",
      "Applications",
      [txt("expression", "Expression", "a+b*c-(d/e)")],
      (_values, params) => stack.infixToPostfixFrames(textParam(params, "expression", "a+b*c-(d/e)")),
      [
        "toPostfix(s):   // the shunting-yard algorithm, one token at a time",
        "  operand  → append it straight to the output",
        "  '('      → push it as a barrier",
        "  ')'      → pop operators to the output until that barrier, then discard it",
        "  operator → first pop every operator binding at least as tightly as this one",
        "             then push this operator",
        "  input exhausted → drain whatever is left on the stack to the output",
        "// the result needs no parentheses at all: precedence is baked into the order",
      ],
      LINEAR_SPACE,
    ),
    queueViaStacks: op(
      "Queue from two stacks",
      "Applications",
      NO_PARAMS,
      (values) => stack.queueViaStacksFrames(values),
      [
        "// IN takes pushes, OUT serves pops — two stacks, one queue",
        "enqueue(v): in.push(v)                        // always O(1)",
        "dequeue():  OUT is empty → everything has to move across first",
        "  while IN is not empty: out.push(in.pop())   // the order flips exactly once",
        "  return out.pop()    // the value enqueued first. Each element moves at most twice: O(1) amortised.",
      ],
      { Time: "O(1) amortised", Space: "O(n)", Why: "each element is moved between stacks at most once" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Queue                                                                       */
/* -------------------------------------------------------------------------- */

export const queueModule: ModuleDef = {
  icon: "🚋",
  label: "Queue",
  usesValues: true,
  sample: "5, 3, 8, 1, 9",
  ops: {
    enqueue: op(
      "Enqueue",
      "Basics",
      [num("value", "Value", 42)],
      (values, params) => queue.enqueueFrames(values, numberParam(params, "value", 0)),
      [
        "function enqueue(q, v):                // before: REAR is the last filled slot",
        "  rear = rear + 1;  q[rear] = v        // it joins at the rear, in O(1)",
      ],
      CONSTANT,
    ),
    dequeue: op(
      "Dequeue",
      "Basics",
      NO_PARAMS,
      (values) => queue.dequeueFrames(values),
      [
        "function dequeue(q):                   // front > rear would underflow",
        "  v = q[front];  front = front + 1     // a naive array shifts every element instead: O(n)",
      ],
      { Time: "O(1) with a moving front", Space: "O(1)", Note: "O(n) if the array is shifted down" },
    ),
    circular: op(
      "Circular queue",
      "Basics",
      [num("capacity", "Capacity", 6, 1, 24)],
      (values, params) => queue.circularQueueFrames(values, numberParam(params, "capacity", 6)),
      [
        "indices wrap with % capacity",
        "enqueue(v): rear = (rear + 1) % capacity; q[rear] = v",
        "  if size == capacity: full — refuse rather than overwrite live data",
        "dequeue():  front = (front + 1) % capacity",
        "  a slot freed by dequeue is reused once rear wraps round to it",
        "// nothing is ever shifted — that is the whole gain over a plain array",
      ],
      { Time: "O(1)", Space: "O(capacity)" },
    ),
    slidingWindowMax: op(
      "Sliding window maximum (monotonic deque)",
      "Patterns",
      [num("windowSize", "Window size", 3, 1)],
      (values, params) => queue.slidingWindowMaxFrames(values, numberParam(params, "windowSize", 3)),
      [
        "deque = []                          // indices, values decreasing front → back",
        "  front index <= i - k  → popFront()        // it has left the window",
        "  arr[deque.back] <= arr[i] → popBack()     // it can never be a maximum again",
        "  deque.pushBack(i)",
        "  if i >= k-1: answer.append(arr[deque.front])   // the front IS the window maximum",
        "// each index enters and leaves the deque once, so O(n) rather than O(n·k)",
      ],
      { Time: "O(n)", Space: "O(k)", Naive: "O(n·k) if each window is rescanned" },
    ),
    deque: op(
      "Deque operations",
      "Patterns",
      [num("value", "Value", 42)],
      (values, params) => queue.dequeOpsFrames(values, numberParam(params, "value", 0)),
      [
        "// a double-ended queue: both ends are O(1)",
        "pushFront(v)",
        "pushBack(v)",
        "popFront()",
        "popBack()",
        "// which is why it can serve as a stack or a queue",
      ],
      CONSTANT,
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Linked list                                                                 */
/* -------------------------------------------------------------------------- */

export const linkedListModule: ModuleDef = {
  icon: "⛓",
  label: "Linked List",
  usesValues: true,
  sample: "5, 3, 8, 1, 9, 2",
  ops: {
    traverse: op(
      "Traverse",
      "Basics",
      NO_PARAMS,
      (values) => linked.traverseListFrames(values),
      [
        "node = head           // the only way in — there is no arr[0] to jump to",
        "  visit(node.value);  node = node.next     // one hop at a time; no index arithmetic exists",
        "  node == null → the end. Reaching position k cost k hops, which is the array's strength exactly inverted.",
      ],
      LINEAR,
    ),
    insertAtBegin: op(
      "Insert at the head",
      "Insert & delete",
      [num("value", "Value", 42)],
      (values, params) => linked.insertAtBeginFrames(values, numberParam(params, "value", 0)),
      [
        "// before: head points at the first node",
        "node = new Node(v);  node.next = head;  head = node    // O(1), and nothing else moved — the array's weak point",
      ],
      { Time: "O(1)", Space: "O(1)", Contrast: "an array needs O(n) here" },
    ),
    insertAtEnd: op(
      "Insert at the tail",
      "Insert & delete",
      [num("value", "Value", 42)],
      (values, params) => linked.insertAtEndListFrames(values, numberParam(params, "value", 0)),
      [
        "// the tail is n hops away, and there is no way to reach it but to walk",
        "node = head;  while node.next != null: node = node.next     // the walk is the whole cost",
        "node.next = new Node(v)    // O(n) because of the walk; O(1) if a tail pointer is kept",
      ],
      LINEAR,
    ),
    insertAt: op(
      "Insert at a position",
      "Insert & delete",
      [num("index", "Index", 2, 0), num("value", "Value", 42)],
      (values, params) =>
        linked.insertAtListFrames(values, numberParam(params, "index", 0), numberParam(params, "value", 0)),
      [
        "// splicing into the middle rewrites two pointers and moves nothing",
        "walk to the node before position i        // O(i) hops — this is the expensive half",
        "node = new Node(v);  node.next = previous.next;  previous.next = node    // the relink itself is O(1)",
      ],
      { Time: "O(n) to walk, O(1) to relink", Space: "O(1)" },
    ),
    deleteAt: op(
      "Delete at a position",
      "Insert & delete",
      [num("index", "Index", 2, 0)],
      (values, params) => linked.deleteAtListFrames(values, numberParam(params, "index", 0)),
      [
        "// nothing shifts: one pointer changes and the node becomes unreachable",
        "walk to the node before position i         // O(i) hops",
        "the target is previous.next — read its value before unlinking it",
        "previous.next = previous.next.next    // unlinked. It is still in memory, just unreachable.",
      ],
      LINEAR,
    ),
    deleteValue: op(
      "Delete by value",
      "Insert & delete",
      [num("value", "Value", 8)],
      (values, params) => linked.deleteValueListFrames(values, numberParam(params, "value", 0)),
      [
        "// only the first match goes, and the list has to be searched to find it",
        "  node.value == v?        // compare, hop, compare — O(n) in the worst case",
        "  yes → unlink it: previous.next = node.next",
        "  deleted, and exactly one pointer changed",
        "  the end was reached with no match → v is not in the list, and that is a real answer",
      ],
      LINEAR,
    ),
    search: op(
      "Search",
      "Basics",
      [num("target", "Target", 8)],
      (values, params) => linked.searchListFrames(values, numberParam(params, "target", 0)),
      [
        "// a list has no indices, so binary search is impossible — every search is linear",
        "  node.value == target?     // check, then hop to node.next",
        "  match → return the position",
        "  node == null → not in the list. Even a *sorted* list cannot be halved: there is no way to jump to the middle.",
      ],
      LINEAR,
    ),
    reverse: op(
      "Reverse",
      "Transform",
      NO_PARAMS,
      (values) => linked.reverseListFrames(values),
      [
        "previous = null;  node = head        // the reversed part starts out empty",
        "  next = node.next;  node.next = previous;  previous = node;  node = next",
        "return previous    // one pass, O(1) extra space. Saving `next` first is what stops the rest of the list being lost.",
      ],
      LINEAR,
    ),
    middle: op(
      "Find the middle (fast & slow)",
      "Two pointers",
      NO_PARAMS,
      (values) => linked.middleNodeFrames(values),
      [
        "slow = head;  fast = head          // both start at the front",
        "  slow = slow.next;  fast = fast.next.next     // fast covers twice the ground",
        "fast ran out → slow is exactly halfway. One pass, and the length was never counted.",
      ],
      LINEAR,
    ),
    detectCycle: op(
      "Detect a cycle (Floyd)",
      "Two pointers",
      [num("cycleAt", "Tail links back to index", 2, 0, undefined, "Use -1 for no cycle")],
      (values, params) => linked.detectCycleFrames(values, numberParam(params, "cycleAt", 2)),
      [
        "slow = head;  fast = head          // no visited set, no extra memory at all",
        "  slow = slow.next;  fast = fast.next.next      // one hop against two",
        "  slow == fast → there is a cycle. Inside a loop the faster runner must lap the slower one.",
        "  fast ran off the end → no cycle, and reaching null is the thing that proves it",
      ],
      { Time: "O(n)", Space: "O(1)", Why: "a faster runner must lap a slower one on a closed track" },
    ),
    mergeSorted: op(
      "Merge two sorted lists",
      "Transform",
      [num("splitAt", "Split the input at index", 3, 1)],
      (values, params) => linked.mergeSortedListsFrames(values, numberParam(params, "splitAt", 3)),
      [
        "// both inputs are already sorted, which is the only reason one pass is enough",
        "  compare the two heads and pick the smaller one",
        "  append it to the merged tail, and advance that list only",
        "  one list is exhausted → attach the whole remainder unchanged; it is already in order",
        "// O(n + m), and nothing was copied: only `next` pointers were rewritten",
      ],
      { Time: "O(n + m)", Space: "O(1) — only pointers are rewritten" },
    ),
    removeNthFromEnd: op(
      "Remove the nth node from the end",
      "Two pointers",
      [num("n", "n", 2, 1)],
      (values, params) => linked.removeNthFromEndFrames(values, numberParam(params, "n", 2)),
      [
        "// a fixed gap of n between two pointers, so the length is never counted",
        "  advance lead one step, n times          // opening the gap",
        "  then move both together, one step each, until lead falls off the end",
        "  trail is now on the nth node from the end — that is exactly what the gap guarantees",
        "unlink it by pointing the node before it past it     // one pass, O(1) memory",
      ],
      LINEAR,
    ),
    doubly: op(
      "Doubly linked list",
      "Variants",
      NO_PARAMS,
      (values) => linked.doublyListFrames(values),
      [
        "// every node keeps both links",
        "node.next → the successor",
        "node.prev → the predecessor",
        "// traversable in both directions, and deleting a node you already hold is O(1) — paid for with one extra pointer per node",
      ],
      { Time: "O(1) deletion given the node", Space: "O(n) with 2 pointers each" },
    ),
    circular: op(
      "Circular linked list",
      "Variants",
      NO_PARAMS,
      (values) => linked.circularListFrames(values),
      [
        "tail.next = head        // the list closes on itself; there is no null anywhere in it",
        "  node = node.next      // this never terminates on its own — watch it start a second lap",
        "// so traversal has to count, or compare against the starting node, to know when to stop",
      ],
      { Time: "O(n) to traverse", Space: "O(1)" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Hash table                                                                  */
/* -------------------------------------------------------------------------- */

const HASH_PARAMS = [num("key", "Key", 12), num("size", "Table size", 7, 1, 24)];

export const hashModule: ModuleDef = {
  icon: "#️⃣",
  label: "Hash Table",
  usesValues: true,
  sample: "12, 19, 5, 26, 33, 40",
  ops: {
    chainInsert: op(
      "Insert (separate chaining)",
      "Chaining",
      HASH_PARAMS,
      (values, params, ctx) =>
        hashing.hashChainInsertFrames(
          values,
          numberParam(params, "key", 12),
          numberParam(params, "size", 7),
          ctx,
        ),
      [
        "function insert(key):                  // i = key mod size",
        "  look at bucket[i]                    // every other bucket is skipped",
        "    empty    → key goes straight in",
        "    occupied → a collision: append key to the chain",
        "  // if key is already in the chain, a hash set keeps one copy",
        "  // collisions grow a chain rather than displacing anything — but lookups cost O(1 + chain length), so watch the load factor",
      ],
      { Time: "O(1) average", Worst: "O(n) when every key collides", Space: "O(n)" },
    ),
    chainSearch: op(
      "Search (separate chaining)",
      "Chaining",
      HASH_PARAMS,
      (values, params, ctx) =>
        hashing.hashChainSearchFrames(
          values,
          numberParam(params, "key", 12),
          numberParam(params, "size", 7),
          ctx,
        ),
      [
        "function search(key):                  // i = key mod size",
        "  scan bucket[i]                       // no other bucket can hold key",
        "    if it matches: found",
        "    otherwise: keep walking the chain",
        "  // the chain running out proves key is absent from the whole table — and the scan length is the load factor, not the table size",
      ],
      { Time: "O(1 + α) where α is the load factor", Space: "O(1)" },
    ),
    linearInsert: op(
      "Insert (linear probing)",
      "Open addressing",
      HASH_PARAMS,
      (values, params, ctx) =>
        hashing.hashLinearInsertFrames(
          values,
          numberParam(params, "key", 12),
          numberParam(params, "size", 7),
          ctx,
        ),
      [
        "function insert(key):                  // home = key mod size",
        "  if the home slot is free: table[home] = key",
        "  while slot i is taken: i = (i + 1) mod size      // a collision; forward one slot — cache-friendly, but it builds clusters",
        "  table[i] = key                       // first free slot, or a tombstone",
        "  // the key may already be stored: a hash set keeps one copy",
        "  // watch the load factor — probing degrades sharply as it nears 1",
        "  // every slot probed and still no room → a real table would have resized and rehashed long before this",
      ],
      { Time: "O(1) average", Worst: "O(n) as the table fills", Space: "O(size)" },
    ),
    quadraticInsert: op(
      "Insert (quadratic probing)",
      "Open addressing",
      HASH_PARAMS,
      (values, params, ctx) =>
        hashing.hashQuadraticInsertFrames(
          values,
          numberParam(params, "key", 12),
          numberParam(params, "size", 7),
          ctx,
        ),
      [
        "function insert(key):                  // home = key mod size, step = 0",
        "  if the home slot is free: table[home] = key",
        "  slot taken → step++; i = (home + step²) mod size    // 1, 4, 9, … so the probes spread out and clusters do not form",
        "  table[i] = key                       // the first free slot, or a reusable tombstone",
        "  // the key may already be stored: a hash set keeps one copy",
        "  // watch the load factor — probing degrades sharply as it nears 1",
        "  // every slot probed and still no room: squared jumps can miss free slots entirely above 50% load",
      ],
      { Time: "O(1) average", Note: "may fail to find a slot above 50% load", Space: "O(size)" },
    ),
    delete: op(
      "Delete (with tombstones)",
      "Open addressing",
      HASH_PARAMS,
      (values, params, ctx) =>
        hashing.hashDeleteFrames(values, numberParam(params, "key", 12), numberParam(params, "size", 7), ctx),
      [
        "function delete(key):                  // walk the same probe sequence",
        "  a tombstone does not end the walk — keep probing",
        "  if found: mark the slot DELETED, not EMPTY",
        "  // an EMPTY slot would stop a later probe early and hide keys placed past this one",
        "  an EMPTY slot ends the walk → key is not in the table   // exactly why delete must not leave one behind",
        "  // tombstones still cost probe time: delete-heavy tables get rebuilt",
      ],
      { Time: "O(1) average", Space: "O(1)", Why: "tombstones keep probe chains intact" },
    ),
  },
};
