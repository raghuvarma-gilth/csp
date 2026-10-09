/**
 * Patterns and algorithms: two pointers, sliding window, sorting, searching,
 * recursion/backtracking and dynamic programming.
 *
 * These are the modules that answer "why would I use that structure?", so the
 * complexity maps here carry more than Time/Space where a contrast is the actual
 * lesson — counting sort's O(n + k) against comparison sorting's O(n log n)
 * floor, or the two-pointer scan against the nested loop it replaces.
 */

import * as dp from "../algorithms/dp";
import * as pointers from "../algorithms/pointers";
import * as recursion from "../algorithms/recursion";
import * as searching from "../algorithms/searching";
import * as sorting from "../algorithms/sorting";
import * as window from "../algorithms/window";
import { numberParam, textParam, type ModuleDef } from "../types";
import { LINEAR, LOG, NO_PARAMS, num, op, txt } from "./shared";

/* -------------------------------------------------------------------------- */
/* Two pointers                                                                */
/* -------------------------------------------------------------------------- */

export const twoPointersModule: ModuleDef = {
  icon: "↔",
  label: "Two Pointers",
  usesValues: true,
  sample: "1, 3, 5, 7, 9, 11, 13",
  ops: {
    opposite: op(
      "Converge from both ends (reverse in place)",
      "Basics",
      NO_PARAMS,
      (values) => pointers.oppositeEndsFrames(values),
      [
        "left = 0; right = n - 1               // one pointer at each end",
        "while left < right:                   // arr[left] and arr[right] are the pair",
        "  swap(arr[left], arr[right]); left++; right--    // both step inward",
        "// the pointers meet after n/2 swaps — O(n), in place, and the array is reversed",
      ],
      LINEAR,
    ),
    pairSum: op(
      "Pair with a given sum (sorted)",
      "Basics",
      [num("target", "Target sum", 14)],
      (values, params) => pointers.pairSumFrames(values, numberParam(params, "target", 14)),
      [
        "left = 0; right = n - 1               // the array must be sorted first",
        "  sum = arr[left] + arr[right]",
        "  sum == target → found the pair",
        "  sum < target  → left++       // only a bigger left value can help",
        "  sum > target  → right--      // only a smaller right value can help",
        "// if the pointers meet without a hit, no pair exists — one pass, O(n) not O(n²)",
      ],
      { Time: "O(n)", Space: "O(1)", Naive: "O(n²) with a nested loop", Requires: "sorted input" },
    ),
    removeDuplicates: op(
      "Remove duplicates in place",
      "In-place rewriting",
      NO_PARAMS,
      (values) => pointers.removeDuplicatesFrames(values),
      [
        "write = 0                              // arr[0..write] is the unique prefix",
        "  for read from 1 to n-1: compare arr[read] with arr[write]",
        "    different → write++; arr[write] = arr[read]",
        "    equal     → a duplicate: skip it, and do NOT advance write",
        "return write + 1                       // the new length; the tail is left over",
      ],
      LINEAR,
    ),
    moveZeroes: op(
      "Move zeroes to the end",
      "In-place rewriting",
      NO_PARAMS,
      (values) => pointers.moveZeroesFrames(values),
      [
        "write = 0",
        "for read from 0 to n-1:                // look at arr[read]",
        "  if arr[read] != 0: swap(arr[write], arr[read]); write++",
        "  else: leave the 0 where it is and advance read only",
        "// the non-zero order is preserved — the swap is what keeps it",
      ],
      LINEAR,
    ),
    containerWater: op(
      "Container with most water",
      "Applications",
      NO_PARAMS,
      (values) => pointers.containerWaterFrames(values),
      [
        "left = 0; right = n - 1; best = 0",
        "  area = (right - left) * min(arr[left], arr[right])",
        "  best = max(best, area)",
        "  arr[left] < arr[right] → left++      // the left wall is the limit",
        "  otherwise              → right--     // the right wall is no taller",
        "// one pass: moving the TALLER wall can never help — width shrinks, height still capped",
      ],
      { Time: "O(n)", Space: "O(1)", Naive: "O(n²) over every pair" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Sliding window                                                              */
/* -------------------------------------------------------------------------- */

export const slidingWindowModule: ModuleDef = {
  icon: "🪟",
  label: "Sliding Window",
  usesValues: true,
  sample: "2, 1, 5, 1, 3, 2, 4, 1",
  ops: {
    fixed: op(
      "Fixed-size window sum",
      "Basics",
      [num("size", "Window size", 3, 1)],
      (values, params) => window.fixedWindowFrames(values, numberParam(params, "size", 3)),
      [
        "sum = sum of the first k values",
        "for i from k to n-1:",
        "  sum = sum + arr[i] - arr[i-k]     // add one, drop one",
        "  best = max(best, sum)",
        "// each value is added once and removed once",
      ],
      { Time: "O(n)", Space: "O(1)", Naive: "O(n·k) by re-summing each window" },
    ),
    variable: op(
      "Shortest window reaching a target",
      "Variable size",
      [num("target", "Target sum", 8)],
      (values, params) => window.variableWindowFrames(values, numberParam(params, "target", 8)),
      [
        "left = 0; sum = 0; best = ∞",
        "  for right from 0 to n-1: sum += arr[right]       // grow on the right",
        "    while sum >= target: best = min(best, right - left + 1)",
        "      sum -= arr[left]; left++                     // shrink from the left",
        "// left only ever moves forward, so the nested while is still O(n) overall",
      ],
      { Time: "O(n)", Space: "O(1)", Note: "requires non-negative values" },
    ),
    distinct: op(
      "Longest window of distinct values",
      "Variable size",
      NO_PARAMS,
      (values) => window.distinctWindowFrames(values),
      [
        "left = 0; lastSeen = {}                  // the window holds no repeats",
        "  arr[right] was last seen at j >= left  → that copy is inside the window",
        "    left = j + 1                         // jump past it; left never moves back",
        "  otherwise → arr[right] is new to the window, so extend it",
        "  best = max(best, right - left + 1)",
        "// each index is visited once by right and at most once by left: O(n)",
      ],
      { Time: "O(n)", Space: "O(size of the window)" },
    ),
    atMostKDistinct: op(
      "Window with at most k distinct values",
      "Variable size",
      [num("k", "k distinct", 2, 1)],
      (values, params) => window.atMostKDistinctFrames(values, numberParam(params, "k", 2)),
      [
        "left = 0; counts = {}                   // a map, not a set, so duplicates are allowed",
        "  for right from 0 to n-1: counts[arr[right]]++",
        "    while counts.size > k: counts[arr[left]]--; drop it at 0; left++",
        "  best = max(best, right - left + 1)",
        "// right and left each cross the array once, so O(n) with O(k) of memory",
      ],
      { Time: "O(n)", Space: "O(k)" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Sorting                                                                     */
/* -------------------------------------------------------------------------- */

export const sortingModule: ModuleDef = {
  icon: "📊",
  label: "Sorting",
  usesValues: true,
  sample: "5, 2, 9, 1, 7, 3, 8, 4",
  ops: {
    bubble: op(
      "Bubble sort",
      "Comparison sorts",
      NO_PARAMS,
      (values) => sorting.bubbleSortFrames(values),
      [
        "for pass from 1 to n-1:                  // the tail grows sorted from the right",
        "  compare arr[j] with arr[j+1]",
        "    arr[j] > arr[j+1] → swap them; swapped = true",
        "  // pass over: the largest remaining value has bubbled to the end",
        "// sorted — either the passes ran out, or a whole pass made no swaps and we stopped early",
      ],
      { Time: "O(n²)", Best: "O(n) on sorted input", Space: "O(1)", Stable: "yes" },
    ),
    selection: op(
      "Selection sort",
      "Comparison sorts",
      NO_PARAMS,
      (values) => sorting.selectionSortFrames(values),
      [
        "for i from 0 to n-2:                     // arr[0..i-1] is already final",
        "  min = i                                // assume the first unsorted slot wins",
        "  for j from i+1 to n-1: compare arr[j] with arr[min]",
        "    arr[j] < arr[min] → min = j          // a new smallest",
        "  swap(arr[i], arr[min])                 // exactly n-1 swaps, whatever the input",
        "// index i is now final — selection sort never touches it again",
      ],
      { Time: "O(n²)", Best: "O(n²) — no early exit", Space: "O(1)", Stable: "no" },
    ),
    insertion: op(
      "Insertion sort",
      "Comparison sorts",
      NO_PARAMS,
      (values) => sorting.insertionSortFrames(values),
      [
        "for i from 1 to n-1:                    // arr[0..i-1] is sorted, but not final",
        "  key = arr[i]; j = i - 1               // take it out and slide it left",
        "    while j >= 0 and arr[j] > key: arr[j+1] = arr[j]; j--   // shift right",
        "  arr[j+1] = key                        // the prefix [0..i] is sorted again",
        "// nearly sorted input never enters the while loop, which is why this becomes O(n)",
      ],
      { Time: "O(n²)", Best: "O(n) on nearly sorted input", Space: "O(1)", Stable: "yes" },
    ),
    merge: op(
      "Merge sort",
      "Divide and conquer",
      NO_PARAMS,
      (values) => sorting.mergeSortFrames(values),
      [
        "mergeSort(lo, hi):   // split to single elements, then merge sorted runs back up",
        "  mid = (lo + hi) / 2                           // split [lo..hi] here",
        "  mergeSort(lo, mid); mergeSort(mid+1, hi)      // recurse on both halves",
        "    merge: compare the two fronts, emit the smaller one into a buffer",
        "  copy the buffer back — [lo..hi] is now one sorted run",
        "// O(n log n) guaranteed, not average: the price is the O(n) buffer",
      ],
      { Time: "O(n log n) always", Space: "O(n)", Stable: "yes" },
    ),
    quick: op(
      "Quick sort",
      "Divide and conquer",
      NO_PARAMS,
      (values) => sorting.quickSortFrames(values),
      [
        "quickSort(lo, hi):   // partition around a pivot, then sort each side",
        "  pivot = arr[hi];  i = lo - 1",
        "    for j from lo to hi-1: compare arr[j] with the pivot",
        "      arr[j] < pivot → i++; swap(arr[i], arr[j])     // grow the left region",
        "  swap(arr[i+1], arr[hi]); recurse either side of i+1   // the pivot is FINAL",
        "// no merge step and no buffer — but a bad pivot on sorted input degrades it to O(n²)",
      ],
      { Time: "O(n log n) average", Worst: "O(n²)", Space: "O(log n) stack", Stable: "no" },
    ),
    heap: op(
      "Heap sort",
      "Divide and conquer",
      NO_PARAMS,
      (values) => sorting.heapSortFrames(values),
      [
        "// build a max heap in place, then pull the root to the back n-1 times",
        "buildHeap: siftDown each parent, starting with the last one   // O(n)",
        "  siftDown: compare the node with its larger child",
        "    child is bigger → swap it up and sink one level further",
        "  // the heap is built, so the largest value sits at index 0",
        "for end from n-1 down to 1: swap(arr[0], arr[end]); siftDown(0, end)",
        "// O(n log n) guaranteed AND in place — the price is cache misses and no stability",
      ],
      { Time: "O(n log n) always", Space: "O(1)", Stable: "no" },
    ),
    counting: op(
      "Counting sort",
      "Non-comparison sorts",
      NO_PARAMS,
      (values) => sorting.countingSortFrames(values),
      [
        "// one bucket per value from min to max — so it needs a small integer range",
        "  for each value v: count[v - min]++            // one pass over the input",
        "  walk the buckets in order, emitting value v exactly count[v] times",
        "// O(n + k) with no comparisons at all, so the O(n log n) lower bound does not apply",
      ],
      { Time: "O(n + k)", Space: "O(k)", Stable: "yes", Requires: "a small integer range" },
    ),
    radix: op(
      "Radix sort (LSD)",
      "Non-comparison sorts",
      NO_PARAMS,
      (values) => sorting.radixSortFrames(values),
      [
        "for exp = 1, 10, 100, ...   // least significant first; non-negative integers only",
        "  bucket each value by its digit at that place:  (v / exp) mod 10",
        "  collect the buckets in order — stably, so earlier digits' order survives",
        "// after the last digit the array is fully sorted, in O(d · (n + 10))",
      ],
      { Time: "O(d · (n + 10))", Space: "O(n)", Stable: "yes", Requires: "non-negative integers" },
    ),
    shell: op(
      "Shell sort",
      "Comparison sorts",
      NO_PARAMS,
      (values) => sorting.shellSortFrames(values),
      [
        "// insertion sort, but over a wide gap first, so values travel far in one move",
        "for gap = n/2, n/4, ... 1:",
        "  for i from gap to n-1: temp = arr[i]; compare it with arr[i-gap]",
        "    while j >= gap and arr[j-gap] > temp: arr[j] = arr[j-gap]; j -= gap",
        "    arr[j] = temp",
        "  // the array is now gap-sorted: every gap-th element is in order",
        "// so by the time gap == 1 the array is nearly sorted and that pass is O(n)",
      ],
      { Time: "O(n log² n) with this gap sequence", Space: "O(1)", Stable: "no" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Searching                                                                   */
/* -------------------------------------------------------------------------- */

export const searchingModule: ModuleDef = {
  icon: "🔍",
  label: "Searching",
  usesValues: true,
  sample: "1, 3, 5, 7, 9, 11, 13, 15",
  ops: {
    linear: op(
      "Linear search",
      "Basics",
      [num("target", "Target", 9)],
      (values, params) => searching.linearSearchFrames(values, numberParam(params, "target", 9)),
      [
        "for i from 0 to n-1:                   // no ordering required at all",
        "  check arr[i] against the target",
        "    equal → return i                   // found it",
        "return -1                              // the loop ran out: it is not here",
      ],
      LINEAR,
    ),
    binary: op(
      "Binary search",
      "Basics",
      [num("target", "Target", 11)],
      (values, params) => searching.binarySearchFrames(values, numberParam(params, "target", 11)),
      [
        "lo = 0; hi = n - 1                     // requires sorted input",
        "while lo <= hi:",
        "  mid = lo + (hi - lo) / 2             // written this way to avoid overflow",
        "  arr[mid] == target → return mid",
        "  arr[mid] < target  → lo = mid + 1    // the whole left half is too small",
        "  arr[mid] > target  → hi = mid - 1    // the whole right half is too big",
        "return -1    // the range closed with no hit. Halving 1,000,000 takes 20 steps.",
      ],
      { ...LOG, Requires: "sorted input" },
    ),
    ternary: op(
      "Ternary search",
      "Variants",
      [num("target", "Target", 13)],
      (values, params) => searching.ternarySearchFrames(values, numberParam(params, "target", 13)),
      [
        "lo = 0; hi = n - 1              // the array is sorted first",
        "m1 = lo + (hi-lo)/3; m2 = hi - (hi-lo)/3",
        "  if arr[m1] or arr[m2] == target: return it",
        "  if target < arr[m1]: hi = m1 - 1   // keep the first third",
        "  if target > arr[m2]: lo = m2 + 1   // keep the last third",
        "  else: lo = m1 + 1; hi = m2 - 1     // keep the middle third",
        "return -1    // two comparisons per step, so log₃n · 2 > log₂n · 1: slower than binary search",
      ],
      { Time: "O(log₃ n) steps, ~1.26× binary's comparisons", Space: "O(1)", Requires: "sorted input" },
    ),
    jump: op(
      "Jump search",
      "Variants",
      [num("target", "Target", 7)],
      (values, params) => searching.jumpSearchFrames(values, numberParam(params, "target", 7)),
      [
        "step = floor(sqrt(n))",
        "jump forward by step while arr[i] < target",
        "the answer must lie in the last block crossed",
        "  walk that block one index at a time",
        "    if arr[i] == target: return i",
        "return -1    // only ever moves forward in big strides — for storage where seeking back is costly",
      ],
      { Time: "O(√n)", Space: "O(1)", Requires: "sorted input" },
    ),
    exponential: op(
      "Exponential search",
      "Variants",
      [num("target", "Target", 5)],
      (values, params) => searching.exponentialSearchFrames(values, numberParam(params, "target", 5)),
      [
        "bound = 1",
        "if arr[0] == target: return 0",
        "while bound < n and arr[bound] <= target: bound = bound * 2",
        "binary search within [bound/2, min(bound, n-1)]",
        "  mid = (lo + hi) / 2",
        "    if arr[mid] == target: return mid",
        "return -1    // the range is found first, so this works on an unbounded or streamed sequence",
      ],
      { Time: "O(log i) where i is the answer's index", Space: "O(1)", Requires: "sorted input" },
    ),
    boundary: op(
      "First or last occurrence",
      "Variants",
      [num("target", "Target", 7), txt("which", "Which", "first", "Type first or last")],
      (values, params) =>
        searching.boundarySearchFrames(
          values,
          numberParam(params, "target", 7),
          textParam(params, "which", "first").trim().toLowerCase() === "last" ? "last" : "first",
        ),
      [
        "lo = 0; hi = n - 1; answer = -1        // duplicates in the input are the point",
        "  mid = lo + (hi - lo) / 2;  no match → narrow as in plain binary search",
        "    match, want FIRST → answer = mid; hi = mid - 1    // do NOT stop; go left",
        "    match, want LAST  → answer = mid; lo = mid + 1    // do NOT stop; go right",
        "return answer    // still O(log n): a match narrows the range instead of returning",
      ],
      { ...LOG, Requires: "sorted input", Note: "duplicates in the input are the point" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Recursion and backtracking                                                  */
/* -------------------------------------------------------------------------- */

export const recursionModule: ModuleDef = {
  icon: "🔁",
  label: "Recursion & Backtracking",
  usesValues: true,
  sample: "1, 2, 3",
  ops: {
    factorial: op(
      "Factorial call stack",
      "Call stack",
      [num("n", "n", 5, 0, 12)],
      (_values, params) => recursion.factorialStackFrames(numberParam(params, "n", 5)),
      [
        "fact(n):   // each call that cannot answer yet parks itself on the stack",
        "  n > 1 → push this frame and call fact(n - 1)   // nothing is computed going down",
        "  n <= 1 → return 1      // the base case: the only reason the recursion ever ends",
        "  the call returned x → compute n × x, then pop  // the arithmetic is all on the way up",
        "// n frames of memory for code shorter than the loop — and that trade is what overflows the stack",
      ],
      { Time: "O(n)", Space: "O(n) call stack", Depth: "n frames" },
    ),
    recursionTree: op(
      "Recursion tree (naive fibonacci)",
      "Call stack",
      [num("n", "n", 5, 0, 8)],
      (_values, params) => recursion.recursionTreeFrames(numberParam(params, "n", 5)),
      [
        "function fib(n):",
        "  if n <= 1: return n                 // a base case, answered immediately",
        "  left = fib(n-1); right = fib(n-2)   // it splits into two calls",
        "  return left + right                 // computed only on the way back up",
        "// the repeated subtrees are the waste: fib(2) is recomputed again and again, and removing exactly that is what memoisation does — see the DP module",
      ],
      { Time: "O(φⁿ) ≈ O(1.618ⁿ)", Space: "O(n)", Calls: "roughly 2·fib(n+1) − 1" },
    ),
    hanoi: op(
      "Tower of Hanoi",
      "Backtracking",
      [num("disks", "Disks", 3, 1, 6)],
      (_values, params) => recursion.hanoiFrames(numberParam(params, "disks", 3)),
      [
        "move(n, from, to, spare):   // n == 0 does nothing at all — that is the base case",
        "  move(n-1, from, spare, to)        // get the top n-1 disks out of the way",
        "  move disk n: from → to            // the one disk this call is responsible for",
        "  move(n-1, spare, to, from)        // bring those n-1 back on top of it",
        "// 2ⁿ − 1 moves, provably the minimum — each extra disk doubles the work",
      ],
      { Time: "O(2ⁿ)", Moves: "2ⁿ − 1", Space: "O(n)" },
    ),
    subsets: op(
      "All subsets (power set)",
      "Backtracking",
      NO_PARAMS,
      (values) => recursion.subsetsFrames(values),
      [
        "function build(i, chosen):",
        "  if i == n: record the subset; return",
        "  chosen[i] = true;  build(i+1, chosen)    // take arr[i] — this branch runs first",
        "  chosen[i] = false; build(i+1, chosen)    // ← the backtrack: undo it, then skip it",
        "// one binary choice per element → 2ⁿ subsets, each O(n) to write out",
      ],
      { Time: "O(n · 2ⁿ)", Space: "O(n) depth", Results: "2ⁿ subsets" },
    ),
    permutations: op(
      "All permutations",
      "Backtracking",
      NO_PARAMS,
      (values) => recursion.permutationsFrames(values),
      [
        "permute(k):   // positions 0..k-1 are already fixed",
        "  if k == n: record arr as one permutation; return",
        "  for i from k to n-1: swap(arr[k], arr[i]); permute(k+1)   // choose what sits at k",
        "    swap(arr[k], arr[i])          // ← the backtrack: put it back before the next i",
        "// one array reused: O(n) space instead of O(n · n!), paid for by undoing every swap",
      ],
      { Time: "O(n · n!)", Space: "O(n)", Results: "n! permutations" },
    ),
    nQueens: op(
      "N-Queens",
      "Backtracking",
      [num("size", "Board size", 4, 1, 8)],
      (_values, params) => recursion.nQueensFrames(numberParam(params, "size", 4)),
      [
        "place(row):   // one queen per row is forced, so only its column is a choice",
        "  for col in 0..n-1: (row, col) is safe → place a queen; place(row + 1)",
        "    attacked down a column or a diagonal → reject the square, prune the branch",
        "    every column of the next row failed → lift this queen, try the next column",
        "  row == n: every row holds a safe queen — a solution",
        "// n = 2 and n = 3 have no safe arrangement at all, and that is a real answer",
      ],
      { Time: "O(n!) worst case", Space: "O(n)", Note: "n = 2 and n = 3 have no solution at all" },
    ),
  },
};

/* -------------------------------------------------------------------------- */
/* Dynamic programming                                                         */
/* -------------------------------------------------------------------------- */

export const dpModule: ModuleDef = {
  icon: "🧩",
  label: "Dynamic Programming",
  usesValues: true,
  sample: "1, 2, 5",
  ops: {
    fibTable: op(
      "Fibonacci: tabulation",
      "1-D tables",
      [num("n", "n", 10, 0, 24)],
      (_values, params) => dp.fibTableFrames(numberParam(params, "n", 10)),
      [
        "table = one slot per value of fib, from 0 to n, filled left to right",
        "table[0] = 0; table[1] = 1             // the two base cases, written in directly",
        "for i from 2 to n: table[i] = table[i-1] + table[i-2]   // both inputs are already there",
        "// n additions instead of exponentially many calls — and only the last two slots are ever read, so O(1) space is possible",
      ],
      { Time: "O(n)", Space: "O(n)", Recursive: "O(1.618ⁿ) without memoisation" },
    ),
    coinChange: op(
      "Coin change (fewest coins)",
      "1-D tables",
      [num("amount", "Amount", 11, 0)],
      (values, params) => dp.coinChangeFrames(values, numberParam(params, "amount", 11)),
      [
        "// the values box holds the coins; slot a will hold the fewest coins making exactly a",
        "table[0] = 0;  every other entry = ∞      // ∞ means 'no way known yet'",
        "for a from 1 to amount:  for each coin c:  c > a → skip it, it cannot be used here",
        "    table[a - c] is ∞ → that route is dead, there is nothing to build on",
        "    otherwise candidate = table[a - c] + 1      // one coin more than the rest",
        "  table[a] = the smallest candidate, or ∞ if there was none",
        "// an amount that stays ∞ is genuinely unreachable — reported as such, not rounded",
        "// O(amount × coins). Taking the largest coin first does NOT always give this answer.",
      ],
      { Time: "O(amount · coins)", Space: "O(amount)" },
    ),
    lis: op(
      "Longest increasing subsequence",
      "1-D tables",
      NO_PARAMS,
      (values) => dp.lisFrames(values),
      [
        "table[i] = 1 for every i          // each element alone is already a run of length 1",
        "for i from 1 to n-1:  for j from 0 to i-1:   // which earlier element can arr[i] extend?",
        "    arr[j] < arr[i] and table[j] + 1 > table[i] → table[i] = table[j] + 1",
        "    arr[j] < arr[i] but table[j] + 1 is no better → leave table[i] as it is",
        "    arr[j] >= arr[i] → cannot be extended at all; the subsequence must increase",
        "answer = max(table)   // subsequence, not substring: the values need not be adjacent",
      ],
      { Time: "O(n²)", Space: "O(n)", Note: "O(n log n) is possible with binary search" },
    ),
    knapsack: op(
      "0/1 knapsack",
      "2-D tables",
      /* One profit per weight, and the module sample holds three weights — so
         three profits. A fourth was a silent trap: the operation opened on
         "there are 3 weight(s) but 4 profit(s)" instead of on a table. */
      [txt("profits", "Profits", "1, 6, 10"), num("capacity", "Capacity", 7, 0)],
      (values, params) =>
        dp.knapsackFrames(values, textParam(params, "profits", "1, 6, 10"), numberParam(params, "capacity", 7)),
      [
        "// weights come from the values box, profits from the field above; row r, column c = best profit from the first r item(s) with capacity c",
        "  weight[i] > c → it cannot fit: copy table[i-1][c] down from the row above",
        "  otherwise table[i][c] = max(table[i-1][c], profit[i] + table[i-1][c - weight[i]])   // skip it, or take it",
        "// '0/1' means whole or not at all. Reading back up, a cell that differs from the one above means that item was taken.",
      ],
      { Time: "O(items · capacity)", Space: "O(items · capacity)", Note: "needs one profit per weight" },
    ),
    lcs: op(
      "Longest common subsequence",
      "2-D tables",
      [txt("first", "First string", "ABCBDAB"), txt("second", "Second string", "BDCABA")],
      (_values, params) =>
        dp.lcsFrames(textParam(params, "first", "ABCBDAB"), textParam(params, "second", "BDCABA")),
      [
        "// cell (i, j) = the LCS length of a[0..i] and b[0..j]; the ε row and column are 0",
        "  a[i] == b[j] → table[i][j] = table[i-1][j-1] + 1    // the diagonal: extend the match",
        "  a[i] != b[j] → table[i][j] = max(table[i-1][j], table[i][j-1])   // drop one character, try again",
        "// the diagonal is what makes it a subsequence rather than a substring. Walk back from the corner to recover it.",
      ],
      { Time: "O(m · n)", Space: "O(m · n)" },
    ),
    editDistance: op(
      "Edit distance (Levenshtein)",
      "2-D tables",
      [txt("first", "From", "kitten"), txt("second", "To", "sitting")],
      (_values, params) =>
        dp.editDistanceFrames(textParam(params, "first", "kitten"), textParam(params, "second", "sitting")),
      [
        "table[i][0] = i; table[0][j] = j      // deleting or inserting everything: the free border",
        "  a[i] == b[j] → table[i][j] = table[i-1][j-1]    // nothing to do; the diagonal's cost",
        "  else table[i][j] = 1 + min(diagonal substitute, above delete, left insert)",
        "// each of the three neighbours is one named edit. The bottom-right cell is the answer, and the path back to the top-left is the sequence of edits.",
      ],
      { Time: "O(m · n)", Space: "O(m · n)" },
    ),
  },
};
