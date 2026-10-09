-- ============================================================================
-- EduVerse — Course 6: Recursion & Dynamic Programming (CS206)
-- ----------------------------------------------------------------------------
-- Closes the last two uncovered groups of the visual lab: Recursion (5
-- visualisations) and Dynamic Programming (6). With this file applied, every
-- group in VISUAL_CATALOGUE has curriculum pointing at it.
--
-- The argument the course makes: recursion is a call stack you did not have to
-- declare, its cost is the size of its recursion tree, and dynamic programming
-- is what you do when that tree repeats itself. Every DP lesson here is
-- presented as a recursion plus a table, because that is the order in which the
-- answer is actually found.
--
-- Conventions as in the earlier seed migrations: no invented `diagram:` keys,
-- `:::key` / `:::pitfall` / `:::example` callouts parsed by Markdown.tsx, slug
-- lookups scoped through chapters to a named course, every statement
-- idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Course
-- ---------------------------------------------------------------------------
INSERT INTO public.courses (slug, code, title, description, subject, status, position)
VALUES (
  'recursion-and-dynamic-programming',
  'CS206',
  'Recursion & Dynamic Programming',
  'How a function that calls itself actually runs, how to read its cost off its recursion tree, and what to do when that tree solves the same subproblem a million times. Backtracking, memoisation, tabulation, and the six classic DP problems worth knowing by shape.',
  'Computer Science',
  'published',
  6
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
  ('recursion', 'Recursion & Backtracking',
   'The call stack made visible, the recursion tree as a cost model, and the search technique that undoes its own choices.', 1),
  ('dynamic-programming', 'Dynamic Programming',
   'When a recursion recomputes the same answer, store it. Six problems that between them cover almost every DP shape you will meet.', 2)
) AS v(slug, title, description, position)
WHERE c.slug = 'recursion-and-dynamic-programming'
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
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'recursion-and-dynamic-programming'
JOIN (VALUES

-- === Chapter 1: Recursion & Backtracking ==================================
('recursion', 'recursion-and-the-call-stack', 'Recursion & the Call Stack',
 'A recursive function is a stack you did not have to declare. Seeing the frames is what makes the base case and the space cost obvious.',
 $md$## Two requirements

A recursive function needs exactly two things, and almost every bug is one of them missing:

1. a **base case** that returns without recursing
2. a **recursive case** that makes the problem strictly smaller

```python
def factorial(n):
    if n <= 1:          # base case
        return 1
    return n * factorial(n - 1)      # strictly smaller
```

"Strictly smaller" has to be guaranteed on every path. `factorial(-1)` with the base case `if n == 1` never terminates, because −1 never reaches 1 by subtraction. Writing `n <= 1` fixes it, and noticing the difference is the habit worth forming.

## What actually happens: the stack

Each call allocates a **frame** holding its parameters, locals, and where to return to. The frames stack up, and nothing is computed until the base case is reached.

:::example
`factorial(4)`:

```
push factorial(4)   waiting on factorial(3)
push factorial(3)   waiting on factorial(2)
push factorial(2)   waiting on factorial(1)
push factorial(1)   returns 1          <- base case, first actual value
pop  -> 2 * 1  = 2
pop  -> 3 * 2  = 6
pop  -> 4 * 6  = 24
```

Four frames exist simultaneously at the deepest point. The multiplications all happen on the way **back up** — which is why the stack has to hold every pending frame.
:::

:::key
This is why recursion costs **O(depth) space** even when it allocates nothing on the heap. "I did not create any arrays, so it is O(1) space" is wrong: the frames are the space.

It is also why CS202's recursive list reversal overflows on a million nodes while the iterative version does not, and why CS205 warns against recursive DFS on large graphs. Same fact, three courses.
:::

## Recursion is a stack you did not declare

Any recursion can be rewritten with an explicit stack, and the rewrite makes the hidden cost visible:

```python
def factorial_iterative(n):
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result                     # O(1) space
```

Here the rewrite is trivial because `factorial` is **tail-recursive in spirit** — one recursive call, nothing to do after it but multiply. Tree-shaped recursion is harder to flatten, which is precisely why iterative tree traversal (CS203) needs an explicit stack and careful push ordering.

:::pitfall
Python does **not** optimise tail calls. `factorial(10000)` raises `RecursionError` at the default limit of 1000 frames, and raising the limit risks a real segmentation fault because the C stack is finite. Scheme and some functional languages do eliminate tail calls; Python, Java and JavaScript (outside strict-mode ES6 engines that never shipped it) do not.

So in these languages, deep recursion is a correctness problem, not a style preference.
:::

## Reading a recursive definition

Trust the recursive call. When writing `reverse(list)`, do not trace the whole unwinding — assume `reverse(rest)` already works, and ask only: given that, what do I do with the first element? This is the **recursive leap of faith**, and it is the difference between writing recursion and simulating it in your head.

```python
def total(a, i=0):
    if i == len(a):        # base: an empty remainder sums to 0
        return 0
    return a[i] + total(a, i + 1)   # trust it for the rest
```

## Where recursion is the right tool

| Problem shape | Why |
|---|---|
| Trees | a subtree is the same problem, smaller |
| Divide and conquer | merge sort, quicksort, binary search |
| Backtracking | the stack **is** the partial solution |
| Grammar and expression parsing | the grammar is recursive |

And where it is not: a simple loop over a sequence. `sum(a)` written recursively is slower, uses O(n) stack, and is harder to read than a `for` loop. Recursion earns its cost when the problem is genuinely self-similar.

## The cost is not obvious from the code

`factorial` makes one call per level, so n frames and O(n) time. But:

```python
def fib(n):
    if n <= 1: return n
    return fib(n - 1) + fib(n - 2)      # TWO calls
```

Two calls per level means the number of calls roughly doubles per level — **O(2ⁿ)**, exponential, from four lines that look no more complex than `factorial`. Counting frames is not enough; you have to count the whole tree of calls.

That is the next lesson, and it is the measurement that makes dynamic programming obviously necessary rather than merely clever.$md$,
 2, 26, 'recursion-stack', 1),

('recursion', 'recursion-trees-and-cost', 'Recursion Trees & the Cost of Recursion',
 'Draw the tree of calls and read the cost off it. Branching factor to the power of depth — which is why naive Fibonacci is exponential.',
 $md$## The cost model

The cost of a recursion is the total work across **every node of its call tree**. Two quantities decide it:

- **branching factor** b — how many recursive calls each level makes
- **depth** d — how many levels before the base case

With constant work per call, the total is roughly **O(bᵈ)**.

| Function | b | d | Cost |
|---|---|---|---|
| `factorial(n)` | 1 | n | O(n) |
| `binary_search` | 1 | log n | O(log n) |
| `fib(n)` naive | 2 | n | **O(2ⁿ)** |
| `merge_sort(n)` | 2 | log n | O(n log n) |
| `subsets(n)` | 2 | n | O(2ⁿ) |
| `hanoi(n)` | 2 | n | O(2ⁿ) |

:::key
Merge sort and naive Fibonacci both branch twice, and one is O(n log n) while the other is exponential. The difference is **depth**: merge sort halves the input, so d = log n and 2^(log n) = n. Fibonacci decrements, so d = n and 2ⁿ stays 2ⁿ.

Halving the input gives logarithmic depth. Decrementing gives linear depth. With a branching factor above 1, that distinction decides whether the algorithm is usable.
:::

## Drawing the tree for `fib(5)`

```
                fib(5)
            /            \
        fib(4)            fib(3)
       /      \          /      \
   fib(3)   fib(2)   fib(2)   fib(1)
   /    \    /   \    /   \
fib(2) fib(1) ...    ...
```

:::example
Count the calls for `fib(5)`: 15 calls in total to compute a number you could get in five additions.

Now look at what repeats: `fib(3)` is computed **twice**, `fib(2)` **three** times, `fib(1)` **five** times. The tree is not just large, it is largely redundant — and the number of distinct subproblems is only 6 (`fib(0)` through `fib(5)`).

15 calls, 6 distinct answers. For `fib(40)` it is about 331 million calls for 41 distinct answers.
:::

:::key
**That gap is the entire motivation for dynamic programming.** When a recursion tree has exponentially many nodes but only polynomially many *distinct* subproblems, storing each answer the first time collapses the tree into the set of distinct subproblems.

`fib` goes from O(2ⁿ) to O(n) by remembering 41 numbers. Nothing about the recurrence changes — only whether you recompute or look up. The second chapter of this course is that idea applied six times.
:::

## The Master Theorem, briefly

For divide-and-conquer recurrences of the form

```
T(n) = a · T(n/b) + f(n)
```

compare `f(n)` with `n^(log_b a)`:

| Case | Result | Example |
|---|---|---|
| f grows slower | O(n^(log_b a)) | binary search: T(n) = T(n/2) + O(1) → O(log n) |
| f grows the same | O(n^(log_b a) · log n) | merge sort: T(n) = 2T(n/2) + O(n) → O(n log n) |
| f grows faster | O(f(n)) | T(n) = 2T(n/2) + O(n²) → O(n²) |

The intuition: `n^(log_b a)` is the work at the **leaves**, `f(n)` is the work at the **root**, and whichever dominates sets the total. Merge sort is the balanced case — every level does O(n), and there are log n levels.

## Space, which is separate

Time is the whole tree. **Space is one root-to-leaf path**, because frames are popped as the recursion unwinds and only the current path is live.

| Function | Time | Space |
|---|---|---|
| `fib(n)` naive | O(2ⁿ) | **O(n)** |
| `merge_sort` | O(n log n) | O(log n) stack + O(n) buffer |
| `subsets(n)` | O(2ⁿ) | O(n) |

Naive Fibonacci is exponential in time and only linear in space — the tree is enormous but never more than n frames deep at once. Confusing the two is common, and it is why "exponential algorithm" does not imply "exponential memory".

:::pitfall
Exponential growth is not a theoretical concern. At roughly 10⁹ operations per second, `fib(40)` naive takes about a second, `fib(50)` about 20 minutes, and `fib(60)` about two weeks. Each +10 multiplies the time by about 100.

Memoising it makes `fib(1000)` instant. The difference is a dictionary.
:::$md$,
 3, 28, 'recursion-tree', 2),

('recursion', 'towers-of-hanoi', 'Towers of Hanoi',
 'The purest recursive decomposition: to move n discs, move n−1 out of the way, move one, move n−1 back.',
 $md$## The puzzle

Three pegs and n discs of different sizes, stacked largest-first on the source peg. Move the whole stack to the target peg, subject to two rules: one disc at a time, and never place a larger disc on a smaller one.

## The decomposition

The insight is to stop thinking about discs and think about the **largest** one. To move it from source to target, the other n−1 discs must be out of the way — all on the auxiliary peg. Then the largest moves in one step, and the n−1 stack moves on top of it.

```python
def hanoi(n, source, target, aux, moves):
    if n == 0:
        return
    hanoi(n - 1, source, aux, target, moves)    # 1. clear the way
    moves.append((source, target))              # 2. move the big one
    hanoi(n - 1, aux, target, source, moves)    # 3. bring them back
```

Three lines. There is no loop, no case analysis, and no cleverness beyond "the largest disc needs an empty target".

:::key
Note how the peg arguments rotate. In the first call the **target** becomes the scratch peg; in the second the **source** does. Getting this rotation wrong is the only real way to write this function incorrectly, and it is why the parameters are named rather than positional in most teaching versions.
:::

:::example
`hanoi(2, A, C, B)`:

1. `hanoi(1, A, B, C)` → move disc 1: **A→B**
2. move disc 2: **A→C**
3. `hanoi(1, B, C, A)` → move disc 1: **B→C**

Three moves. The small disc goes to the scratch peg, the large disc goes home, the small disc follows.
:::

## Why it takes 2ⁿ − 1 moves

The recurrence falls straight out of the three lines:

```
T(n) = 2·T(n-1) + 1,    T(0) = 0
```

Expanding: T(1)=1, T(2)=3, T(3)=7, T(4)=15 — so **T(n) = 2ⁿ − 1**.

Branching factor 2, depth n: the exponential case from the previous lesson. And unlike Fibonacci this cannot be improved, because **every move is distinct and necessary**. There are no repeated subproblems to memoise — the output itself has 2ⁿ − 1 moves, so no algorithm can be faster than that.

:::key
This is an important distinction. Naive Fibonacci is exponential **because it recomputes**; dynamic programming fixes it. Hanoi is exponential because the **answer** is exponentially long. No technique helps, and recognising which kind of exponential you are looking at tells you whether to optimise or stop.

The legend of 64 golden discs is the same arithmetic: 2⁶⁴ − 1 moves at one per second is about 585 billion years.
:::

## Space

The recursion is n deep at most — the two recursive calls are sequential, not simultaneous, so only one path is live. **O(n) space**, exponential time. The same shape as naive Fibonacci.

## The iterative solution, and why it is strange

A non-recursive solution exists: for an odd number of discs, repeatedly move the smallest disc one peg clockwise and then make the only other legal move; for even n, go anticlockwise.

It produces the identical move sequence, is O(1) space, and is essentially impossible to *derive* or to convince yourself of. The recursive version is three lines and self-evidently correct.

:::pitfall
This is worth remembering as a counterexample to "iterative is always better". The iterative Hanoi saves O(n) stack space and costs you the ability to see why it works. For n small enough to execute at all — under about 30 — the stack is 30 frames and the trade is not worth making.
:::

## Where this shape appears

The same "handle one element, recurse on the rest, recurse again" structure drives Gray code generation (each step flips one bit, as each Hanoi move shifts one disc), subset enumeration, and the general pattern of problems where the answer is built by deciding one item at a time — which is the next lesson.$md$,
 3, 24, 'hanoi', 3),

('recursion', 'subsets-and-combinations', 'Subsets, Permutations & Combinations',
 'Every element is in or out — so there are 2ⁿ subsets, and the recursion that enumerates them is the include/exclude choice written down.',
 $md$## The include/exclude recursion

For each element there are exactly two options: it is in the subset or it is not. Recurse on both.

```python
def subsets(nums):
    out = []
    def go(i, current):
        if i == len(nums):
            out.append(current[:])        # a copy! see below
            return
        current.append(nums[i])           # include nums[i]
        go(i + 1, current)
        current.pop()                     # undo
        go(i + 1, current)                # exclude nums[i]
    go(0, [])
    return out
```

Branching factor 2, depth n → **2ⁿ** subsets, which is exactly right: a set of n elements has 2ⁿ subsets, and the recursion tree *is* the set of all include/exclude decisions.

:::pitfall
`out.append(current[:])` must copy. `current` is one list mutated throughout the whole traversal, so appending it directly stores a reference — and every stored "subset" ends up being the same (empty) list once the recursion unwinds.

This is the single most common bug in every backtracking problem, and it fails in a confusing way: the right *number* of results, all with the wrong contents.
:::

## The append / recurse / pop pattern

Those three lines are the backtracking skeleton:

```
choose      current.append(x)
explore     go(i + 1, current)
un-choose   current.pop()
```

The `pop` restores the state so the next branch starts clean. Forgetting it means the second branch sees the first branch's leftovers.

:::key
`current` is the path from the root of the recursion tree to where you are now — so **the call stack and the partial solution are the same thing**. That identity is what makes recursion the natural tool for enumeration: you do not have to maintain the candidate separately, because the stack already is it.
:::

:::example
`nums = [1, 2]`

```
go(0, [])
├── include 1 → go(1, [1])
│   ├── include 2 → go(2, [1,2])  -> emit [1,2]
│   └── exclude 2 → go(2, [1])    -> emit [1]
└── exclude 1 → go(1, [])
    ├── include 2 → go(2, [2])    -> emit [2]
    └── exclude 2 → go(2, [])     -> emit []
```

Four subsets: `[1,2], [1], [2], []` — and 2² = 4.
:::

## Combinations: stop early

Subsets of a fixed size k need no separate algorithm — just a different base case and a loop over the remaining candidates:

```python
def combinations(nums, k):
    out = []
    def go(start, current):
        if len(current) == k:
            out.append(current[:])
            return
        for i in range(start, len(nums)):
            current.append(nums[i])
            go(i + 1, current)            # i+1: no reuse, no reordering
            current.pop()
    go(0, [])
    return out
```

`go(i + 1, ...)` is doing two jobs: it prevents reusing an element, and because the loop only ever moves forward, each combination is generated in exactly one order. That is what makes these combinations rather than permutations.

Change `i + 1` to `i` and elements may repeat — which is the standard "combination sum with unlimited reuse" variant.

## Permutations: order matters

```python
def permutations(nums):
    out = []
    used = [False] * len(nums)
    def go(current):
        if len(current) == len(nums):
            out.append(current[:])
            return
        for i in range(len(nums)):
            if used[i]: continue
            used[i] = True
            current.append(nums[i])
            go(current)
            current.pop()
            used[i] = False               # undo BOTH changes
    go([])
    return out
```

**n!** results. The loop restarts from 0 every time because order matters, so a `used` array is needed to avoid picking the same element twice.

Note that un-choosing now restores **two** pieces of state. Every mutation made on the way down must be undone on the way up, and missing one is the second most common backtracking bug.

| Enumeration | Count | n=20 |
|---|---|---|
| Subsets | 2ⁿ | ~1 million |
| Combinations C(n,k) | n!/(k!(n−k)!) | C(20,10) = 184,756 |
| Permutations | n! | 2.4 × 10¹⁸ |

:::key
These counts are the **output size**, so like Hanoi this is unavoidable exponential — you cannot enumerate 2ⁿ things in less than 2ⁿ time. The only way to go faster is to stop enumerating: prune branches that cannot lead to a valid answer, which is the subject of the next lesson, or compute an aggregate without listing the items, which is dynamic programming.
:::

## Handling duplicates

With `[1, 1, 2]` the plain algorithm emits `[1]` twice — once per copy. The fix is to sort first and skip a candidate equal to the previous one at the same level:

```python
nums.sort()
for i in range(start, len(nums)):
    if i > start and nums[i] == nums[i - 1]:
        continue                          # same value already tried here
```

`i > start` is essential: it skips the duplicate only when choosing a *sibling*, not when the value legitimately repeats deeper in the path.$md$,
 3, 28, 'subsets', 4),

('recursion', 'backtracking-n-queens', 'Backtracking & N-Queens',
 'Enumeration that gives up early. Pruning does not improve the worst case and routinely turns the impossible into the instant.',
 $md$## What backtracking adds

The previous lesson enumerated everything. Backtracking is the same recursion with one addition: **test partial solutions and abandon the branch as soon as it cannot work.**

```
for each candidate:
    if the candidate is legal so far:
        choose it
        recurse
        un-choose it
```

The `if` is the whole difference, and it is worth a great deal.

## N-Queens

Place n queens on an n×n board so no two share a row, column or diagonal.

The brute force is C(n², n) placements — for n=8 that is 4.4 billion. The first useful observation cuts it immediately: no two queens share a row, so there is **exactly one queen per row**, and the search becomes "which column in each row" — nⁿ, or 16 million for n=8. Still too many, and it is the pruning that finishes the job.

```python
def solve_n_queens(n):
    cols, diag, anti = set(), set(), set()
    placement, solutions = [], []

    def go(row):
        if row == n:
            solutions.append(placement[:])
            return
        for col in range(n):
            if col in cols or (row - col) in diag or (row + col) in anti:
                continue                       # prune: cannot work
            cols.add(col); diag.add(row - col); anti.add(row + col)
            placement.append(col)

            go(row + 1)

            placement.pop()                    # undo all four
            cols.remove(col); diag.remove(row - col); anti.remove(row + col)

    go(0)
    return solutions
```

:::key
**The two diagonal identities are the trick worth keeping.**

- cells on the same `↘` diagonal share `row - col`
- cells on the same `↗` diagonal share `row + col`

So a conflict check is three set lookups — **O(1)** — rather than scanning the board, which would be O(n) per candidate. Reducing the check from O(n) to O(1) is a bigger practical win than most algorithmic rewrites.
:::

:::example
n = 4, placing row by row.

Row 0, col 0 → ok. Row 1: col 0 blocked (same column), col 1 blocked (diagonal, `1-1 = 0-0`), col 2 ok. Row 2: cols 0, 1, 2, 3 all conflict with one of the two placed queens → **dead end**.

Backtrack to row 1 and try col 3. Row 2 → col 1 works. Row 3 → every column conflicts → dead end again. Backtrack all the way to row 0, try col 1, and the search finds `[1, 3, 0, 2]`.

The dead ends were abandoned after two or three placements instead of completing all four — that is the pruning doing its work.
:::

## What pruning is worth

| n | nⁿ (no pruning) | Nodes actually visited | Solutions |
|---|---|---|---|
| 4 | 256 | ~60 | 2 |
| 8 | 16.7 million | ~15,000 | 92 |
| 12 | 8.9 × 10¹² | ~1 million | 14,200 |

:::key
Pruning does **not** change the worst-case complexity — it is still exponential, and a problem with no prunable structure gains nothing. What it changes is the constant and the practical ceiling: n=12 goes from 8.9 trillion nodes to about a million, which is the difference between impossible and instantaneous.

This is the honest claim to make about backtracking. It does not beat exponential growth; it makes exponential growth affordable over the range you care about.
:::

:::pitfall
Every mutation on the way down must be undone on the way up — here that is **four** of them: the placement list and three sets. Missing one leaves phantom constraints that silently block legal positions, so the algorithm returns too few solutions and never errors.

Writing the undo block immediately after the recursive call, mirroring the choose block line for line, is the discipline that prevents this.
:::

## The general template

```python
def backtrack(state):
    if is_complete(state):
        record(state); return
    for choice in candidates(state):
        if not is_valid(state, choice):
            continue                  # prune
        apply(state, choice)
        backtrack(state)
        undo(state, choice)
```

Sudoku, graph colouring, word search, Hamiltonian paths, crossword filling and constraint puzzles in general are all this template with different `is_valid` functions.

## Making pruning stronger

- **Constraint propagation** — after each placement, narrow the remaining candidates. In Sudoku, fill any cell with one possibility left before guessing again.
- **Most-constrained-variable first** — choose the cell or row with the fewest legal options, so dead ends surface at shallow depth where they are cheap.
- **Symmetry breaking** — in N-Queens, restrict row 0 to the first half of the columns and mirror the results, halving the search.

## Backtracking versus dynamic programming

:::key
Both start from a recursion. They diverge on what the recursion looks like:

- **repeated subproblems, and you want an aggregate** (a count, a minimum, a best value) → dynamic programming: store each subproblem's answer
- **distinct branches, and you want the actual items** → backtracking: prune and enumerate

N-Queens cannot be memoised, because every partial board is a distinct state and the question asks for the placements themselves. Fibonacci cannot be pruned, because nothing is invalid. Recognising which you are holding is most of the work in deciding how to attack a problem.
:::$md$,
 5, 30, 'n-queens', 5),

-- === Chapter 2: Dynamic Programming =======================================
('dynamic-programming', 'memoisation-and-tabulation', 'Memoisation & Tabulation',
 'One dictionary turns exponential Fibonacci into linear. Top-down stores answers as it meets them; bottom-up fills a table in dependency order.',
 $md$## The problem, restated

From the recursion-tree lesson: `fib(5)` makes 15 calls for 6 distinct answers, and `fib(40)` makes about 331 million for 41. The tree is exponential; the set of distinct subproblems is linear.

Dynamic programming is the observation that you only need to solve each distinct subproblem **once**.

## Top-down: memoisation

Keep the recursion exactly as written and add a cache:

```python
def fib(n, memo={}):
    if n <= 1:
        return n
    if n in memo:
        return memo[n]                 # already solved
    memo[n] = fib(n - 1, memo) + fib(n - 2, memo)
    return memo[n]
```

Or, with no change to the function body at all:

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    return n if n <= 1 else fib(n - 1) + fib(n - 2)
```

**O(2ⁿ) → O(n).** Each of the n distinct values is computed once; every later request is a lookup.

:::pitfall
`def fib(n, memo={})` uses a **mutable default argument**, which in Python is created once and shared across every call to the function — including calls from unrelated code. Here it happens to be what you want (a persistent cache), but it is a notorious source of bugs when the default is meant to be fresh each time. Prefer `lru_cache`, or pass the dict explicitly.
:::

## Bottom-up: tabulation

Instead of recursing, fill a table in an order that guarantees every dependency is already present:

```python
def fib(n):
    if n <= 1:
        return n
    table = [0] * (n + 1)
    table[1] = 1
    for i in range(2, n + 1):
        table[i] = table[i - 1] + table[i - 2]
    return table[n]
```

**O(n) time, O(n) space**, and no recursion — so no stack limit.

## Space optimisation

`table[i]` depends only on the previous two entries, so the table is unnecessary:

```python
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a                            # O(1) space
```

:::key
This is a general move, not a Fibonacci trick. Whenever a DP transition only reaches back a fixed number of rows, you can keep just those rows and discard the rest. It reappears in knapsack (two rows, then one) and edit distance (two rows), and it is usually the difference between O(n·m) memory and O(min(n,m)).
:::

## Choosing between them

| | Top-down (memo) | Bottom-up (table) |
|---|---|---|
| Written as | the natural recursion | a loop |
| Computes | **only reachable** subproblems | all of them |
| Stack | O(depth), can overflow | none |
| Space optimisation | awkward | **natural** |
| Easier to write first | **yes** | no |

:::key
The practical advice: **write the recursion, add a cache, and only convert to a loop if you need the space optimisation or the stack depth is a risk.** Top-down follows directly from the problem statement; bottom-up requires knowing the right fill order up front, which is a second thing to get right.

Top-down also wins when most subproblems are unreachable — a sparse state space where the table would be mostly empty.
:::

## The two conditions

Dynamic programming applies when a problem has:

1. **Overlapping subproblems** — the same subproblem recurs. Without this, memoisation never hits and you have only added overhead. (Hanoi and merge sort have none.)
2. **Optimal substructure** — an optimal solution is built from optimal solutions to subproblems. Without this, caching sub-answers is caching the wrong thing.

:::pitfall
Optimal substructure is the condition people assume rather than check. "Longest **path** in a general graph" fails it: the longest path to a node is not built from longest paths to its predecessors, because reusing a node is forbidden and the sub-path may conflict. That is why longest path is NP-hard in general graphs but linear on a DAG, where topological order makes the substructure sound.
:::

## How to find the recurrence

Every DP problem is four questions, and answering them in order is the actual method:

1. **What is the state?** The minimal information identifying a subproblem.
2. **What is the transition?** How a state's answer is built from smaller states.
3. **What are the base cases?** The states that need no transition.
4. **What is the answer?** Which state — or aggregate of states — you return.

For Fibonacci: state is `n`; transition is `f(n) = f(n-1) + f(n-2)`; bases are `f(0)=0, f(1)=1`; the answer is `f(n)`. Every lesson in the rest of this chapter is worked in exactly these four steps.$md$,
 3, 30, 'fibonacci-dp', 1),

('dynamic-programming', 'coin-change', 'Coin Change',
 'The fewest coins making a total. The greedy answer is wrong, and seeing why is the point.',
 $md$## The problem

Given coin denominations and a target `amount`, return the fewest coins that sum to it, or −1 if it cannot be made. Coins may be reused without limit.

## Why greedy fails

Take the largest coin that fits, repeat. It works for ordinary currency — and ordinary currency is designed so that it does.

:::pitfall
Coins `[1, 3, 4]`, amount 6.

Greedy: take 4, remainder 2, take 1, take 1 → **three coins**.
Optimal: 3 + 3 → **two coins**.

Greedy committed to the 4 and could not reconsider. The optimal answer never uses the largest coin at all.

Greedy is correct only for **canonical** coin systems, a property that must be proved for each system rather than assumed. For arbitrary denominations, DP is required.
:::

## The four questions

1. **State** — `dp[a]` = fewest coins making amount `a`
2. **Transition** — for each coin `c ≤ a`: `dp[a] = min(dp[a], dp[a - c] + 1)`
3. **Base** — `dp[0] = 0`; making nothing takes no coins
4. **Answer** — `dp[amount]`, or −1 if still unreachable

```python
def coin_change(coins, amount):
    INF = float('inf')
    dp = [INF] * (amount + 1)
    dp[0] = 0
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a and dp[a - c] + 1 < dp[a]:
                dp[a] = dp[a - c] + 1
    return -1 if dp[amount] == INF else dp[amount]
```

**O(amount × len(coins)) time, O(amount) space.**

:::example
`coins = [1, 3, 4]`, amount 6.

| a | candidates | dp[a] |
|---|---|---|
| 0 | — | 0 |
| 1 | 1+dp[0]=1 | 1 |
| 2 | 1+dp[1]=2 | 2 |
| 3 | 1+dp[2]=3, 3+dp[0]=1 | **1** |
| 4 | 1+dp[3]=2, 3+dp[1]=2, 4+dp[0]=1 | **1** |
| 5 | 1+dp[4]=2, 3+dp[2]=3, 4+dp[1]=2 | 2 |
| 6 | 1+dp[5]=3, 3+dp[3]=**2**, 4+dp[2]=3 | **2** |

`dp[6] = 2` — the two 3s. The algorithm considered using the 4 and rejected it, which is exactly what greedy could not do.
:::

:::pitfall
The unreachable marker must be an infinity, not 0 or −1. With `dp[a] = 0` for unreached amounts, `dp[a-c] + 1` reads 0 and reports 1 coin for an impossible amount. With −1 the arithmetic produces 0. Use infinity, and check for it once at the end.

Also note `dp[a - c] + 1 < dp[a]` is only evaluated when `c <= a`. Reversing those conditions indexes negatively, which in Python silently reads from the end of the list — a wrong answer with no error.
:::

## Counting the ways instead

Change the question from "fewest coins" to "how many distinct combinations", and both the recurrence and the **loop order** change:

```python
def count_ways(coins, amount):
    dp = [0] * (amount + 1)
    dp[0] = 1
    for c in coins:                    # coins OUTSIDE
        for a in range(c, amount + 1):
            dp[a] += dp[a - c]
    return dp[amount]
```

:::key
**The loop order carries the meaning.** Coins outside, amounts inside counts **combinations** — each coin is considered once as a denomination, so `{1,3}` and `{3,1}` are the same. Swapping the loops counts **permutations**, because every amount reconsiders every coin and the orders are distinguished.

This is the single most error-prone detail in coin-change problems: the two versions differ only in which `for` is first, and both run without complaint.
:::

## The shape this belongs to

Coin change is **unbounded knapsack** — unlimited copies of each item, minimising count. The next-but-one lesson is 0/1 knapsack, where each item may be used once, and the only structural difference is the direction the inner loop runs. The two are worth learning as a pair.

| Variant | Items | Question |
|---|---|---|
| Coin change (min) | unlimited | fewest coins |
| Coin change (count) | unlimited | number of combinations |
| 0/1 knapsack | one each | maximum value within capacity |
| Bounded knapsack | k each | as above with limits |

## Reconstructing the coins

`dp` holds counts, not the coins themselves. Record a choice per amount:

```python
choice = [None] * (amount + 1)
# when dp[a] improves via coin c:
choice[a] = c

a, used = amount, []
while a > 0:
    used.append(choice[a])
    a -= choice[a]
```

This is the same predecessor-tracking idea as BFS path reconstruction in CS205: the table gives the optimum, and a parallel array gives the route to it.$md$,
 4, 28, 'coin-change', 2),

('dynamic-programming', 'longest-increasing-subsequence', 'Longest Increasing Subsequence',
 'The O(n²) DP is the one to understand; the O(n log n) version replaces the inner scan with a binary search and stops meaning what you think.',
 $md$## The problem

Find the length of the longest strictly increasing **subsequence** — elements in order, not necessarily adjacent.

`[10, 9, 2, 5, 3, 7, 101, 18]` → length **4** (`2, 3, 7, 101` or `2, 5, 7, 101`).

A subsequence may skip elements; a **substring** may not. Confusing the two makes the problem either trivial or impossible.

## The O(n²) DP

1. **State** — `dp[i]` = length of the longest increasing subsequence **ending exactly at** index i
2. **Transition** — `dp[i] = 1 + max(dp[j])` over all `j < i` with `a[j] < a[i]`
3. **Base** — `dp[i] = 1`; the element alone
4. **Answer** — `max(dp)`, **not** `dp[n-1]`

```python
def lis_length(a):
    if not a: return 0
    dp = [1] * len(a)
    for i in range(1, len(a)):
        for j in range(i):
            if a[j] < a[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)
```

:::pitfall
The answer is `max(dp)`, not `dp[-1]`. `dp[i]` is the best subsequence *ending at i*, and the overall best may end anywhere. For `[1, 2, 3, 0]`, `dp = [1,2,3,1]` and `dp[-1]` is 1 while the answer is 3.

Anchoring the state to "ending exactly here" is what makes the transition expressible; the price is that the answer is an aggregate over states rather than one state.
:::

:::example
`a = [3, 1, 4, 2]`

| i | a[i] | j with a[j] < a[i] | dp[i] |
|---|---|---|---|
| 0 | 3 | — | 1 |
| 1 | 1 | none (3 > 1) | 1 |
| 2 | 4 | j=0 (3), j=1 (1) | 1 + max(1,1) = **2** |
| 3 | 2 | j=1 (1) | 1 + 1 = **2** |

`max(dp) = 2` — e.g. `3,4` or `1,4` or `1,2`.
:::

## The O(n log n) version

Keep an array `tails`, where `tails[k]` is the **smallest possible tail value** of an increasing subsequence of length k+1. It is automatically sorted, so the position for each new element can be found by binary search:

```python
from bisect import bisect_left

def lis_length(a):
    tails = []
    for x in a:
        i = bisect_left(tails, x)       # first tail >= x
        if i == len(tails):
            tails.append(x)             # x extends the longest run
        else:
            tails[i] = x                # x gives length i+1 a smaller tail
    return len(tails)
```

**O(n log n)** — one binary search per element. `bisect_left` is the `lower_bound` from CS204, and using `bisect_right` instead gives the longest **non-decreasing** subsequence, which is a different problem.

:::key
**`tails` is not an increasing subsequence.** Its *length* is the answer, and its contents are usually not a valid answer.

For `[3, 1, 4, 2]`: after 3 → `[3]`; 1 replaces it → `[1]`; 4 extends → `[1,4]`; 2 replaces 4 → `[1,2]`. The answer 2 is correct, and `[1,2]` happens to be valid here — but run `[10, 9, 2, 5, 3, 7, 101, 18]` and `tails` ends as `[2, 3, 7, 18]`, which is not the subsequence the algorithm counted.

Keeping a smaller tail never hurts: it leaves more room for future elements to extend. That is why replacement is always safe, and why the array tracks *possibility* rather than any particular answer.
:::

## Reconstructing the actual subsequence

Because `tails` does not hold it, reconstruction needs extra bookkeeping: record, for each element, the length it achieved and the index of its predecessor, then walk back from the element that achieved the maximum. The O(n²) DP reconstructs more easily — store the `j` that produced each `dp[i]`.

If the problem asks for the subsequence rather than its length, the O(n²) version is often the better choice despite the worse bound.

## Variants

| Problem | Change |
|---|---|
| Non-decreasing | `bisect_right` instead of `bisect_left` |
| Longest **decreasing** | reverse the array, or negate the values |
| Number of LIS | second DP array counting ways |
| Minimum deletions to sort | `n − LIS(a)` |
| Russian doll envelopes | sort by width, LIS on height |

That last one is the pattern worth noticing: a 2-D problem becomes LIS by sorting on one dimension so only the other needs the DP. Box stacking and "maximum chain of pairs" are the same move.

## Patience sorting

The `tails` algorithm is literally the card game: deal each card onto the leftmost pile whose top is ≥ it, starting a new pile if none qualifies. The number of piles equals the LIS length — which is where the algorithm comes from, and a reminder that `tails` is a set of pile tops, not a sequence.$md$,
 4, 28, 'lis', 3),

('dynamic-programming', 'knapsack', '0/1 Knapsack',
 'Each item once: take it or leave it. The two-dimensional table, and why the space-optimised loop must run backwards.',
 $md$## The problem

`n` items, each with a weight and a value, and a bag of capacity `W`. Maximise total value without exceeding capacity. Each item may be taken **at most once** — that is the "0/1".

## Why greedy fails

Taking the best value-per-weight ratio first is optimal for **fractional** knapsack, where items can be cut. It is not optimal when they cannot.

:::pitfall
Capacity 4. Items: A (weight 3, value 5, ratio 1.67), B (weight 2, value 3, ratio 1.5), C (weight 2, value 3, ratio 1.5).

Greedy takes A, leaving capacity 1 — nothing else fits. Total **5**.
Optimal takes B and C, filling the bag exactly. Total **6**.

The indivisibility is the whole difficulty: a locally excellent choice can waste capacity that a worse-looking combination uses perfectly.
:::

## The four questions

1. **State** — `dp[i][w]` = best value using the first `i` items with capacity `w`
2. **Transition** — for item `i` (weight `wt`, value `val`):
   ```
   skip it:  dp[i-1][w]
   take it:  dp[i-1][w - wt] + val      (only if wt <= w)
   dp[i][w] = max of those
   ```
3. **Base** — `dp[0][w] = 0`; no items, no value
4. **Answer** — `dp[n][W]`

```python
def knapsack(weights, values, W):
    n = len(weights)
    dp = [[0] * (W + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        wt, val = weights[i - 1], values[i - 1]
        for w in range(W + 1):
            dp[i][w] = dp[i - 1][w]                    # skip
            if wt <= w:
                dp[i][w] = max(dp[i][w], dp[i - 1][w - wt] + val)
    return dp[n][W]
```

**O(n·W) time and space.**

:::example
`weights = [3,2,2]`, `values = [5,3,3]`, W = 4.

| i \ w | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 0 |
| 1 (3,5) | 0 | 0 | 0 | 5 | 5 |
| 2 (2,3) | 0 | 0 | 3 | 5 | 5 |
| 3 (2,3) | 0 | 0 | 3 | 5 | **6** |

`dp[3][4] = 6` — items 2 and 3. Row 1 shows the greedy trap: taking item 1 gives 5 at capacity 3 and still only 5 at capacity 4, because nothing else fits in the leftover 1.
:::

## One row, and the direction that matters

Each row depends only on the row above, so one array suffices:

```python
def knapsack(weights, values, W):
    dp = [0] * (W + 1)
    for wt, val in zip(weights, values):
        for w in range(W, wt - 1, -1):          # BACKWARDS
            dp[w] = max(dp[w], dp[w - wt] + val)
    return dp[W]
```

:::key
**The inner loop must run backwards, and this is the most important detail in the lesson.**

`dp[w - wt]` must still hold the value from the *previous* item — the row above. Going forwards, `dp[w - wt]` has already been updated for the current item, so the item gets used twice, and you have silently solved **unbounded** knapsack instead.

That is not a hypothetical: forwards is exactly the coin-change "count ways" loop from two lessons ago, where unlimited reuse is what you want. The two problems differ by the direction of one loop.

- **backwards** → each item at most once (0/1)
- **forwards** → unlimited copies (unbounded)
:::

## Pseudo-polynomial

O(n·W) looks polynomial and is not. `W` is a *value*, so writing it takes log W bits, and the runtime is exponential in the input's **size**. Knapsack is NP-complete; this DP is fast when W is small and useless when W is, say, 10¹⁸.

| W | n·W for n=100 |
|---|---|
| 1,000 | 10⁵ — instant |
| 10⁹ | 10¹¹ — hours |
| 10¹⁸ | impossible |

Large capacities need approximation, or a DP over **value** instead of weight when total value is the smaller quantity.

## Reconstructing the chosen items

Walk the full 2-D table backwards from `dp[n][W]`:

```python
chosen, w = [], W
for i in range(n, 0, -1):
    if dp[i][w] != dp[i - 1][w]:       # the value changed => item i was taken
        chosen.append(i - 1)
        w -= weights[i - 1]
```

The one-row version cannot do this — it has overwritten the history. When you need the items and not just the total, keep the full table.

## The family

| Variant | Difference |
|---|---|
| Unbounded knapsack | inner loop **forwards** |
| Bounded (k copies) | binary-split each item into powers of two |
| Subset sum | values = weights; ask whether `dp[W] == W` |
| Partition into equal halves | subset sum with target `total/2` |
| Fractional knapsack | **not** DP — greedy by ratio is optimal |

Subset-sum and equal-partition questions are knapsack in disguise often enough that recognising the shape is worth more than memorising the code.$md$,
 4, 30, 'knapsack', 4),

('dynamic-programming', 'longest-common-subsequence', 'Longest Common Subsequence',
 'The two-string grid. Characters match or they do not, and that single branch generates the whole table.',
 $md$## The problem

Given two strings, find the length of the longest subsequence present in both — characters in order, not necessarily adjacent.

`"ABCBDAB"` and `"BDCABA"` → **4** (`BCBA` or `BDAB`).

## The four questions

1. **State** — `dp[i][j]` = LCS length of the first `i` characters of `a` and the first `j` of `b`
2. **Transition** — look at the last characters:
   ```
   a[i-1] == b[j-1]   ->  dp[i][j] = dp[i-1][j-1] + 1
   otherwise          ->  dp[i][j] = max(dp[i-1][j], dp[i][j-1])
   ```
3. **Base** — `dp[0][j] = dp[i][0] = 0`; an empty string shares nothing
4. **Answer** — `dp[len(a)][len(b)]`

```python
def lcs_length(a, b):
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[n][m]
```

**O(n·m) time and space.**

:::key
The transition is a single yes/no question about the last pair of characters.

**If they match**, that character can end the LCS, and nothing is lost by using it — so add 1 to the answer for both strings with that character removed. (Taking the match is always at least as good as skipping it, which is what makes the greedy-looking step correct.)

**If they do not match**, at least one of the two characters cannot be in the LCS, so try dropping each and take the better. You never need to drop both, because that case is already covered inside each branch.
:::

:::example
`a = "AB"`, `b = "BA"`

| | ∅ | B | A |
|---|---|---|---|
| **∅** | 0 | 0 | 0 |
| **A** | 0 | 0 | **1** |
| **B** | 0 | **1** | 1 |

`dp[2][2] = 1`. The common subsequences are `"A"` and `"B"`, both length 1 — `"AB"` is not a subsequence of `"BA"` because the order is wrong.
:::

:::pitfall
The index offset is the usual source of bugs. `dp` has `n+1` rows so that row 0 can mean "empty prefix", which means `dp[i][j]` compares `a[i-1]` with `b[j-1]` — not `a[i]` with `b[j]`.

Dropping the +1 and indexing `a[i]` directly forces special cases at every boundary and loses the clean base row. The extra row and column are what make the base cases free.
:::

## Two rows suffice

`dp[i][j]` reads only row `i-1` and the current row, so the table collapses:

```python
def lcs_length(a, b):
    prev = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        for j in range(1, len(b) + 1):
            cur[j] = prev[j - 1] + 1 if a[i - 1] == b[j - 1] else max(prev[j], cur[j - 1])
        prev = cur
    return prev[len(b)]
```

**O(min(n,m)) space** if you also swap the strings so the shorter one drives the inner dimension. As with knapsack, the optimisation costs you the ability to reconstruct the subsequence.

## Reconstructing it

Walk back from `dp[n][m]`:

```python
i, j, out = n, m, []
while i > 0 and j > 0:
    if a[i - 1] == b[j - 1]:
        out.append(a[i - 1]); i -= 1; j -= 1
    elif dp[i - 1][j] >= dp[i][j - 1]:
        i -= 1
    else:
        j -= 1
return ''.join(reversed(out))
```

Diagonal moves are the matched characters. The tie-break on `>=` decides *which* LCS you get when several have equal length — all are correct, so a grader should compare lengths.

## What it is used for

- **`diff`** — the LCS of two files' lines is the unchanged part; everything else is an insertion or deletion. This is how version control shows changes.
- **Bioinformatics** — DNA and protein sequence alignment.
- **Similarity** — `LCS / max(n, m)` as a crude similarity ratio, and the basis of Python's `difflib`.

## The neighbours

| Problem | Difference |
|---|---|
| Longest common **substring** | contiguous: reset to 0 on mismatch, answer is `max` over the table |
| Shortest common supersequence | `n + m − LCS` |
| Minimum deletions to make equal | `(n − LCS) + (m − LCS)` |
| Edit distance | mismatches cost 1 instead of being skipped — the next lesson |
| Longest palindromic subsequence | LCS of the string with its own reverse |

That last one is worth remembering: a palindrome problem reduced to LCS by a single reversal, with no new algorithm.$md$,
 4, 28, 'lcs', 5),

('dynamic-programming', 'edit-distance', 'Edit Distance',
 'The fewest insertions, deletions and substitutions turning one string into another. Three predecessors per cell instead of two.',
 $md$## The problem

The **Levenshtein distance** between two strings: the minimum number of single-character insertions, deletions or substitutions needed to turn one into the other.

`"kitten"` → `"sitting"` is **3**: substitute k→s, substitute e→i, insert g.

## The four questions

1. **State** — `dp[i][j]` = distance between the first `i` characters of `a` and the first `j` of `b`
2. **Transition** —
   ```
   a[i-1] == b[j-1]   ->  dp[i][j] = dp[i-1][j-1]              (free)
   otherwise          ->  dp[i][j] = 1 + min(
                              dp[i-1][j],        delete a[i-1]
                              dp[i][j-1],        insert b[j-1]
                              dp[i-1][j-1])      substitute
   ```
3. **Base** — `dp[i][0] = i` (delete everything), `dp[0][j] = j` (insert everything)
4. **Answer** — `dp[n][m]`

```python
def edit_distance(a, b):
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1): dp[i][0] = i
    for j in range(m + 1): dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j],      # delete
                                   dp[i][j - 1],      # insert
                                   dp[i - 1][j - 1])  # substitute
    return dp[n][m]
```

**O(n·m) time and space.**

:::key
Compare this with LCS. Same grid, same indexing, same two-row optimisation — and two differences:

- the **base row is not zero**. Turning `"abc"` into `""` costs 3, not 0, so the bases are `i` and `j` rather than 0. Getting this wrong is the most common error here, and the table looks plausible while being wrong everywhere.
- a mismatch considers **three** predecessors, not two. LCS could only skip a character from one string or the other; edit distance can also pay 1 to replace, which is the diagonal move.
:::

:::example
`a = "ab"`, `b = "ba"`

| | ∅ | b | a |
|---|---|---|---|
| **∅** | 0 | 1 | 2 |
| **a** | 1 | **1** | **1** |
| **b** | 2 | **1** | **2** |

`dp[2][2] = 2`: substitute both characters. (Levenshtein does not allow transposition — the Damerau–Levenshtein variant adds it as a fourth operation and would give 1 here.)
:::

:::pitfall
The `1 +` applies to the whole `min`, not to one branch. Writing `min(dp[i-1][j] + 1, dp[i][j-1], dp[i-1][j-1])` charges for only one of the three operations and returns distances that are too small.

And the match case costs **0**, not 1 — `dp[i][j] = dp[i-1][j-1]` with no addition. Adding 1 there turns the function into something that counts character positions rather than edits.
:::

## Two rows

Only the previous row is read, so the same collapse as LCS applies:

```python
def edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i] + [0] * len(b)            # the base for this row
        for j in range(1, len(b) + 1):
            cur[j] = prev[j - 1] if a[i - 1] == b[j - 1] else \
                     1 + min(prev[j], cur[j - 1], prev[j - 1])
        prev = cur
    return prev[len(b)]
```

Note `cur[0] = i` — the base case must be re-established at the start of every row, and forgetting it is the characteristic bug of the space-optimised version.

## Weighted and restricted variants

| Variant | Change |
|---|---|
| Different operation costs | replace the `1 +` with per-operation weights |
| **LCS** | forbid substitution; count matches instead |
| Hamming distance | substitutions only, equal lengths |
| Damerau–Levenshtein | a fourth branch for transposition |
| One-edit-away check | O(n) with two pointers; no table needed |

Substitution costing 2 makes edit distance equivalent to LCS, since replacing then becomes exactly as expensive as a delete plus an insert. The two problems are the same grid with a different price list.

## Where it is used

Spell-checking and fuzzy search ("did you mean…"), DNA sequence alignment, OCR correction, plagiarism and near-duplicate detection, and `diff`-style change display.

:::key
In production, the O(n·m) table is usually too slow for long strings, so the usual approach is to filter candidates cheaply and compute the exact distance only on survivors — by length difference, by a shared n-gram index, or with the **Ukkonen band** optimisation, which computes only the diagonal band of width 2k+1 when you only care whether the distance is ≤ k, giving O(k·n).

This is the standard pattern for expensive similarity measures: an exact algorithm applied to a short list that a cheap approximation produced.
:::

## Closing the course

Edit distance is the last of the six DP problems here, and between them they cover the shapes you will meet again:

| Problem | Shape |
|---|---|
| Fibonacci | 1-D, fixed look-back |
| Coin change | 1-D over a target, unlimited reuse |
| LIS | 1-D, scan all smaller states |
| Knapsack | 2-D, item × capacity, each item once |
| LCS | 2-D grid over two sequences |
| Edit distance | 2-D grid with three predecessors |

New DP problems are usually one of these with the four questions answered differently — which is why the method, and not the six recurrences, is the thing to take away.$md$,
 5, 30, 'edit-distance', 6)

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
  -- within CS206
  ('recursion-trees-and-cost',        'recursion-and-the-call-stack', 'recursion-and-dynamic-programming'),
  ('towers-of-hanoi',                 'recursion-trees-and-cost',     'recursion-and-dynamic-programming'),
  ('subsets-and-combinations',        'recursion-trees-and-cost',     'recursion-and-dynamic-programming'),
  ('backtracking-n-queens',           'subsets-and-combinations',     'recursion-and-dynamic-programming'),
  ('memoisation-and-tabulation',      'recursion-trees-and-cost',     'recursion-and-dynamic-programming'),
  ('coin-change',                     'memoisation-and-tabulation',   'recursion-and-dynamic-programming'),
  ('longest-increasing-subsequence',  'memoisation-and-tabulation',   'recursion-and-dynamic-programming'),
  ('knapsack',                        'coin-change',                  'recursion-and-dynamic-programming'),
  ('longest-common-subsequence',      'memoisation-and-tabulation',   'recursion-and-dynamic-programming'),
  ('edit-distance',                   'longest-common-subsequence',   'recursion-and-dynamic-programming'),
  -- reaching back into CS201
  ('recursion-and-the-call-stack',    'stack-fundamentals',           'data-structures-fundamentals'),
  ('memoisation-and-tabulation',      'prefix-sums',                  'data-structures-fundamentals'),
  -- reaching back into CS202 and CS203
  ('memoisation-and-tabulation',      'hash-tables',                  'linked-structures-and-hashing'),
  ('recursion-trees-and-cost',        'binary-tree-fundamentals',     'trees-heaps-and-ordered-structures'),
  -- reaching back into CS204 and CS205
  ('recursion-trees-and-cost',        'merge-sort',                   'sorting-and-searching'),
  ('longest-increasing-subsequence',  'search-boundaries',            'sorting-and-searching'),
  ('backtracking-n-queens',           'graph-depth-first-search',     'graphs-and-networks'),
  ('memoisation-and-tabulation',      'topological-sort',             'graphs-and-networks')
) AS v(concept_slug, prereq_slug, prereq_course)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters cch ON cch.id = c.chapter_id
JOIN public.courses cco ON cco.id = cch.course_id AND cco.slug = 'recursion-and-dynamic-programming'
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
  AND co.slug = 'recursion-and-dynamic-programming';

INSERT INTO public.learning_objectives (concept_id, objective, position)
SELECT c.id, v.objective, v.position
FROM (VALUES
  ('recursion-and-the-call-stack', 'Identify the base case and the shrinking step in a recursive function', 1),
  ('recursion-and-the-call-stack', 'Trace the stack frames of a recursive call and say when each value is computed', 2),
  ('recursion-and-the-call-stack', 'Explain why recursion costs O(depth) space even with no heap allocation', 3),
  ('recursion-and-the-call-stack', 'Explain why Python does not eliminate tail calls and what that implies', 4),
  ('recursion-trees-and-cost', 'Derive a recursion''s cost from its branching factor and depth', 1),
  ('recursion-trees-and-cost', 'Explain why merge sort is O(n log n) and naive Fibonacci is exponential despite both branching twice', 2),
  ('recursion-trees-and-cost', 'Count repeated subproblems in a recursion tree and state the distinct-subproblem count', 3),
  ('recursion-trees-and-cost', 'Distinguish the time cost (whole tree) from the space cost (one path)', 4),
  ('towers-of-hanoi', 'Decompose Hanoi into the move-aside, move-one, move-back structure', 1),
  ('towers-of-hanoi', 'Derive T(n) = 2T(n-1) + 1 and solve it to 2^n - 1', 2),
  ('towers-of-hanoi', 'Explain why Hanoi cannot be improved by memoisation', 3),
  ('subsets-and-combinations', 'Enumerate all subsets with the include/exclude recursion', 1),
  ('subsets-and-combinations', 'Explain why the partial solution must be copied when recorded', 2),
  ('subsets-and-combinations', 'Apply the choose / explore / un-choose pattern and say what the stack represents', 3),
  ('subsets-and-combinations', 'Adapt the recursion for combinations, permutations and duplicate inputs', 4),
  ('backtracking-n-queens', 'Add pruning to an enumeration and state what it does and does not improve', 1),
  ('backtracking-n-queens', 'Use the row-col and row+col identities for O(1) diagonal checks', 2),
  ('backtracking-n-queens', 'Undo every mutation on the way back up and explain the failure if one is missed', 3),
  ('backtracking-n-queens', 'Decide whether a problem calls for backtracking or dynamic programming', 4),
  ('memoisation-and-tabulation', 'Convert an exponential recursion to linear time by memoising it', 1),
  ('memoisation-and-tabulation', 'Write the bottom-up equivalent and reduce its space to O(1) where possible', 2),
  ('memoisation-and-tabulation', 'State the two conditions a problem must satisfy for DP to apply', 3),
  ('memoisation-and-tabulation', 'Analyse a DP problem with the state, transition, base case and answer questions', 4),
  ('coin-change', 'Show a denomination set where the greedy choice is not optimal', 1),
  ('coin-change', 'Write the minimum-coins recurrence and explain the infinity sentinel', 2),
  ('coin-change', 'Explain why the loop order decides whether you count combinations or permutations', 3),
  ('longest-increasing-subsequence', 'Write the O(n^2) LIS recurrence and explain why the answer is max(dp)', 1),
  ('longest-increasing-subsequence', 'Explain what the tails array stores and why replacement is safe', 2),
  ('longest-increasing-subsequence', 'Explain why tails is not itself a valid increasing subsequence', 3),
  ('knapsack', 'Show why greedy by value-per-weight fails for indivisible items', 1),
  ('knapsack', 'Write the 2-D take-or-skip recurrence and its base case', 2),
  ('knapsack', 'Explain why the one-row inner loop must run backwards', 3),
  ('knapsack', 'Explain why O(nW) is pseudo-polynomial rather than polynomial', 4),
  ('longest-common-subsequence', 'Write the LCS recurrence for the match and mismatch cases', 1),
  ('longest-common-subsequence', 'Explain why taking a match is always safe', 2),
  ('longest-common-subsequence', 'Reconstruct the subsequence by walking the table back', 3),
  ('longest-common-subsequence', 'Reduce the longest palindromic subsequence to LCS', 4),
  ('edit-distance', 'Write the three-operation recurrence and its non-zero base cases', 1),
  ('edit-distance', 'Explain how edit distance differs from LCS in base case and predecessor count', 2),
  ('edit-distance', 'Re-establish the row base case correctly in the two-row version', 3),
  ('edit-distance', 'Explain why substitution costing 2 makes edit distance equivalent to LCS', 4)
) AS v(concept_slug, objective, position)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'recursion-and-dynamic-programming';

-- ---------------------------------------------------------------------------
-- 6. Misconception catalogue
-- ---------------------------------------------------------------------------
INSERT INTO public.concept_misconceptions (concept_id, code, statement, correction, probe)
SELECT c.id, v.code, v.statement, v.correction, v.probe
FROM (VALUES
  ('recursion-and-the-call-stack', 'recursion-no-space',
   'A recursive function that allocates nothing uses O(1) extra space.',
   'Each call occupies a stack frame holding its parameters, locals and return address. The frames are the space, so the cost is O(depth) even with no heap allocation.',
   'factorial(1000) allocates no arrays. State its space complexity and name what occupies it.'),
  ('recursion-and-the-call-stack', 'base-case-equality',
   'A base case of n == 1 is equivalent to n <= 1.',
   'Only if every path reaches exactly 1. factorial(-1) decrements past 1 forever under n == 1, so the guard must be an inequality to be safe on all inputs.',
   'Call factorial(-1) with the base case n == 1. Describe what happens and why n <= 1 fixes it.'),
  ('recursion-and-the-call-stack', 'tail-calls-optimised',
   'Tail-recursive functions do not grow the stack.',
   'That holds only in languages that eliminate tail calls. Python, Java and mainstream JavaScript engines do not, so a tail-recursive function still consumes one frame per call and raises at the recursion limit.',
   'Name one language that eliminates tail calls and one that does not, and say what happens to a 100,000-deep tail recursion in each.'),

  ('recursion-trees-and-cost', 'two-calls-means-exponential',
   'Any recursion making two recursive calls is exponential.',
   'It depends on the depth. Merge sort branches twice but halves the input, so depth is log n and 2^(log n) = n. Fibonacci branches twice and decrements, so depth is n and the cost stays 2^n.',
   'Both merge sort and naive fib branch twice. Give each one''s depth and resulting complexity, and explain the difference.'),
  ('recursion-trees-and-cost', 'exponential-time-exponential-space',
   'An exponential-time recursion also uses exponential space.',
   'Time counts every node of the call tree; space counts only the current root-to-leaf path, because frames are popped as the recursion unwinds. Naive fib is O(2^n) time and O(n) space.',
   'Give the time and space complexity of naive fib(n) and explain why they differ.'),
  ('recursion-trees-and-cost', 'memoise-anything',
   'Memoisation speeds up any recursion.',
   'It only helps when subproblems repeat. Hanoi and merge sort never solve the same subproblem twice, so a cache adds overhead and never hits.',
   'Explain why memoising hanoi(n) gains nothing, and contrast it with fib(n).'),

  ('towers-of-hanoi', 'hanoi-can-be-faster',
   'A cleverer algorithm could solve Hanoi in fewer than 2^n - 1 moves.',
   'The output itself has 2^n - 1 moves and every one is necessary, so no algorithm can be shorter. This is exponential output, not exponential recomputation, and no technique removes it.',
   'Distinguish Hanoi''s exponential cost from naive Fibonacci''s. Which one can be fixed, and why?'),
  ('towers-of-hanoi', 'hanoi-peg-order',
   'The peg arguments in the two recursive Hanoi calls are the same.',
   'They rotate. The first call uses the target as scratch; the second uses the source as scratch. Keeping them the same produces illegal moves.',
   'Write both recursive calls of hanoi(n, source, target, aux) and say which peg plays the scratch role in each.'),

  ('subsets-and-combinations', 'append-without-copy',
   'You can append the current partial solution directly to the results list.',
   'The partial solution is one list mutated throughout the recursion, so appending it stores a reference. Every recorded result ends up identical once the recursion unwinds. A copy is required.',
   'Collect subsets of [1,2] appending current rather than current[:]. How many results are there and what does each contain?'),
  ('subsets-and-combinations', 'forgot-to-undo',
   'The pop after the recursive call is optional tidying.',
   'It restores the state so the next branch starts from the correct prefix. Without it the sibling branch sees the previous branch''s choices and the enumeration is wrong.',
   'Remove the pop from the subsets recursion on [1,2]. List what gets emitted.'),
  ('subsets-and-combinations', 'combinations-vs-permutations',
   'Passing i instead of i+1 in the combinations recursion is a minor detail.',
   'i+1 prevents reusing an element and fixes a single generation order. Passing i allows unlimited reuse, which is the combination-sum variant, and restarting from 0 gives permutations instead.',
   'For [1,2] and k=2, give the output when recursing with i+1, with i, and with a loop from 0 plus a used array.'),

  ('backtracking-n-queens', 'pruning-changes-complexity',
   'Pruning makes backtracking polynomial.',
   'It is still exponential in the worst case. What pruning changes is the constant and the practical ceiling - n=12 drops from about 9 trillion nodes to about a million.',
   'State the worst-case complexity of N-Queens with pruning, and the practical node count for n=12.'),
  ('backtracking-n-queens', 'diagonal-scan-needed',
   'Checking diagonals requires scanning the board.',
   'Cells on one diagonal share row - col, and on the other share row + col. Three set lookups give an O(1) check instead of an O(n) scan.',
   'Give the two identities for the diagonals and the resulting complexity of a conflict test.'),
  ('backtracking-n-queens', 'partial-undo',
   'Undoing the placement is enough when backtracking.',
   'Every mutation made going down must be undone coming up - here the placement plus three sets. A missed one leaves phantom constraints that block legal positions and silently return too few solutions.',
   'List all four pieces of state changed per placement in the N-Queens solver, and say what happens if the anti-diagonal set is not restored.'),

  ('memoisation-and-tabulation', 'dp-is-always-faster',
   'Dynamic programming always beats plain recursion.',
   'It helps only when subproblems overlap. With no repetition the cache never hits and you have added memory and lookup cost for nothing.',
   'Name a recursion that gains nothing from memoisation and explain what is missing.'),
  ('memoisation-and-tabulation', 'optimal-substructure-assumed',
   'Any problem with overlapping subproblems can be solved by DP.',
   'Optimal substructure is also required - the optimum must be built from optima of subproblems. Longest path in a general graph fails it, which is why it is NP-hard there but linear on a DAG.',
   'Explain why longest path is solvable by DP on a DAG but not on a graph with cycles.'),
  ('memoisation-and-tabulation', 'mutable-default-memo',
   'def f(n, memo={}) is a safe way to add a cache.',
   'The default dict is created once and shared across every call to the function for the lifetime of the program. Here it happens to be the intended behaviour, but it is a well-known bug source. Prefer lru_cache or an explicit argument.',
   'Explain when the dict in def f(n, memo={}) is created, and why that surprises people.'),

  ('coin-change', 'greedy-coin-change',
   'Taking the largest coin that fits always gives the fewest coins.',
   'That is true only for canonical systems. With coins [1,3,4] and amount 6, greedy gives 4+1+1 = three coins while the optimum is 3+3 = two.',
   'Run greedy on coins [1,3,4] for amount 6, then give the optimal answer and say which coin greedy wrongly committed to.'),
  ('coin-change', 'zero-sentinel',
   'Unreachable amounts can be initialised to 0.',
   'Then dp[a-c] + 1 reads 0 and reports one coin for an impossible amount. The sentinel must be an infinity so it cannot win a min, with one check at the end.',
   'Initialise unreachable amounts to 0 with coins [5] and amount 3. What does the algorithm return?'),
  ('coin-change', 'loop-order-irrelevant',
   'The order of the coin and amount loops does not matter when counting ways.',
   'Coins outside counts combinations; amounts outside counts permutations. For coins [1,2] and amount 3 the two orders give 2 and 3.',
   'Count the ways to make 3 from [1,2] with each loop order. Give both numbers and say which counts ordered sequences.'),

  ('longest-increasing-subsequence', 'answer-is-last-dp',
   'The LIS length is dp[n-1].',
   'dp[i] is the best subsequence ending exactly at i, and the overall best may end anywhere. For [1,2,3,0] dp is [1,2,3,1] and the answer is max(dp) = 3, not 1.',
   'Compute dp for [1,2,3,0] and give both dp[-1] and max(dp).'),
  ('longest-increasing-subsequence', 'tails-is-the-answer',
   'The tails array in the O(n log n) solution holds the longest increasing subsequence.',
   'Only its length is meaningful. tails[k] is the smallest possible tail of a length-k+1 subsequence, and the contents are often not a valid subsequence of the input.',
   'Run the tails algorithm on [10,9,2,5,3,7,101,18]. Give the final tails array and check whether it is a subsequence of the input.'),
  ('longest-increasing-subsequence', 'subsequence-is-substring',
   'A subsequence must be contiguous.',
   'A subsequence keeps order but may skip elements; a substring must be contiguous. LIS of [3,1,4,2] is 2 as a subsequence and the problems differ substantially.',
   'Give the longest increasing subsequence and the longest increasing substring of [3,1,4,2].'),

  ('knapsack', 'greedy-ratio-optimal',
   'Taking items by best value-per-weight gives the optimal knapsack.',
   'That is optimal for fractional knapsack only. With capacity 4 and items (3,5), (2,3), (2,3), greedy takes the first for 5 while the optimum takes the other two for 6.',
   'Run ratio-greedy on capacity 4 with items (w3,v5), (w2,v3), (w2,v3). Give the greedy total and the optimum.'),
  ('knapsack', 'one-row-forwards',
   'The space-optimised knapsack loop can run forwards.',
   'Forwards, dp[w - wt] has already been updated for the current item, so the item is used more than once - that is unbounded knapsack. The 0/1 version must iterate capacity downwards.',
   'Run the one-row loop forwards with one item of weight 2 value 3 and capacity 6. How many times is the item used?'),
  ('knapsack', 'nw-is-polynomial',
   'O(nW) means knapsack is solvable in polynomial time.',
   'W is a numeric value, written in log W bits, so the runtime is exponential in the input size. Knapsack is NP-complete and this DP is only practical for small capacities.',
   'Explain why O(nW) is called pseudo-polynomial, and give the runtime for n=100 and W=10^18.'),

  ('longest-common-subsequence', 'lcs-indexing',
   'dp[i][j] should compare a[i] with b[j].',
   'The table has an extra row and column so that index 0 means the empty prefix, which makes dp[i][j] compare a[i-1] with b[j-1]. The offset is what makes the base cases free.',
   'State what dp[0][j] represents and which characters dp[1][1] compares.'),
  ('longest-common-subsequence', 'lcs-match-may-be-skipped',
   'When the last characters match you must also consider skipping one of them.',
   'Taking the match is always at least as good, so the branch is unnecessary. Both skip options are already covered inside the recursive call on the shorter prefixes.',
   'Explain why dp[i][j] = dp[i-1][j-1] + 1 needs no max against dp[i-1][j] when the characters match.'),

  ('edit-distance', 'zero-base-row',
   'The edit distance base row is all zeros, like LCS.',
   'Turning a string of length i into the empty string costs i deletions, so dp[i][0] = i and dp[0][j] = j. A zero base row produces a plausible-looking table that is wrong everywhere.',
   'Give dp[3][0] for a = "abc" and explain what that cell means.'),
  ('edit-distance', 'two-predecessors',
   'Edit distance considers the same two predecessors as LCS.',
   'A mismatch has three options - delete, insert and substitute - so it takes the min of three cells including the diagonal. LCS has no substitution and therefore only two.',
   'List the three cells a mismatching dp[i][j] depends on, and name the operation each represents.'),
  ('edit-distance', 'match-costs-one',
   'Every cell adds 1 to the previous value.',
   'A match costs nothing: dp[i][j] = dp[i-1][j-1] with no addition. Only a mismatch pays 1, and the 1 applies to the whole min rather than to a single branch.',
   'Compute the edit distance of "abc" and "abc" with a match costing 1. What do you get, and what is correct?')
) AS v(concept_slug, code, statement, correction, probe)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'recursion-and-dynamic-programming'
ON CONFLICT (concept_id, code) DO UPDATE
  SET statement = EXCLUDED.statement,
      correction = EXCLUDED.correction,
      probe = EXCLUDED.probe;

-- ---------------------------------------------------------------------------
-- 7. Coding problems
-- ---------------------------------------------------------------------------
INSERT INTO public.coding_problems (concept_id, slug, title, prompt, difficulty, starter_code, test_cases, expected_complexity, hints, status)
SELECT c.id, v.slug, v.title, v.prompt, v.difficulty,
       v.starter_code::jsonb, v.test_cases::jsonb, v.complexity, v.hints::jsonb,
       'published'::public.content_status
FROM (VALUES

('towers-of-hanoi', 'hanoi-move-list', 'Towers of Hanoi: the Moves',
 E'Return the list of moves that transfers `n` discs from peg `0` to peg `2`, using peg `1` as the spare. Each move is a two-element array `[from, to]`.\n\nThere are exactly 2^n − 1 moves and the order is determined, so the expected output is unique. `n = 0` returns an empty list.\n\nFollow the three-step decomposition from the lesson: move n−1 aside, move the largest, move n−1 back. Watch which peg plays the scratch role in each recursive call.',
 3,
 '{"python":"def hanoi_moves(n):\n    # moves from peg 0 to peg 2 using peg 1\n    pass\n","javascript":"function hanoiMoves(n) {\n  // moves from peg 0 to peg 2 using peg 1\n}\n"}',
 '[{"args":[1],"expected":[[0,2]],"hidden":false},{"args":[2],"expected":[[0,1],[0,2],[1,2]],"hidden":false},{"args":[0],"expected":[],"hidden":false},{"args":[3],"expected":[[0,2],[0,1],[2,1],[0,2],[1,0],[1,2],[0,2]],"hidden":true}]',
 'O(2^n) time, O(n) space',
 '["Write a helper taking (n, source, target, aux) and append to a shared list.","The first recursive call moves n-1 discs from source to AUX, using target as the spare.","The second moves them from aux to target, using source as the spare. Then check the count is 2^n - 1."]',
 'published'),

('subsets-and-combinations', 'all-subsets', 'All Subsets',
 E'Return every subset of `nums` (which contains no duplicates). Each subset is an array, and the collection is an array of arrays.\n\nTo make the expected output unique, generate them with the **include-first** recursion from the lesson: at each index, first recurse having taken the element, then recurse having skipped it. That produces subsets in the order shown by the visible tests.\n\nThere are 2^n subsets, including the empty one.',
 3,
 '{"python":"def subsets(nums):\n    # include first, then exclude. Remember to copy.\n    pass\n","javascript":"function subsets(nums) {\n  // include first, then exclude. Remember to copy.\n}\n"}',
 '[{"args":[[1,2]],"expected":[[1,2],[1],[2],[]],"hidden":false},{"args":[[1]],"expected":[[1],[]],"hidden":false},{"args":[[]],"expected":[[]],"hidden":false},{"args":[[1,2,3]],"expected":[[1,2,3],[1,2],[1,3],[1],[2,3],[2],[3],[]],"hidden":true}]',
 'O(2^n) time and output',
 '["Recurse on an index. At the base case (index == len), record a COPY of the current list.","Append nums[i] and recurse, then pop and recurse again. The pop is what makes the exclude branch correct.","Appending the list itself rather than a copy gives the right count of results with all the wrong contents."]',
 'published'),

('memoisation-and-tabulation', 'fib-linear', 'Fibonacci in Linear Time',
 E'Return the `n`-th Fibonacci number, where `fib(0) = 0` and `fib(1) = 1`.\n\nThe naive double recursion is O(2^n) and will not finish for the larger hidden tests. Use memoisation or a bottom-up loop so the result is O(n).\n\nOne hidden test asks for `fib(90)`, which exceeds 64-bit range — fine in Python, and in JavaScript you may return the number as computed (the grader compares the value produced by a correct O(n) loop).',
 3,
 '{"python":"def fib(n):\n    # O(n). A dict or two variables is enough.\n    pass\n","javascript":"function fib(n) {\n  // O(n). A dict or two variables is enough.\n}\n"}',
 '[{"args":[0],"expected":0,"hidden":false},{"args":[1],"expected":1,"hidden":false},{"args":[10],"expected":55,"hidden":false},{"args":[40],"expected":102334155,"hidden":true},{"args":[2],"expected":1,"hidden":true},{"args":[30],"expected":832040,"hidden":true}]',
 'O(n) time, O(1) space achievable',
 '["Bottom-up needs only the previous two values: a, b = b, a + b.","If you memoise instead, check the cache before recursing or the cache never helps.","fib(40) is about 10^8 — the naive version makes roughly 300 million calls and will time out."]',
 'published'),

('coin-change', 'fewest-coins', 'Fewest Coins',
 E'Given coin denominations `coins` (unlimited supply of each) and a target `amount`, return the fewest coins that sum exactly to `amount`, or `-1` if it is impossible. `amount = 0` needs 0 coins.\n\nGreedy is **wrong** — one visible test is `[1,3,4]` for 6, where greedy gives 3 coins and the answer is 2. Build a table over amounts.\n\nUse an infinity sentinel for unreachable amounts, not 0 or −1.',
 4,
 '{"python":"def coin_change(coins, amount):\n    # dp over amounts 0..amount. Infinity for unreachable.\n    pass\n","javascript":"function coinChange(coins, amount) {\n  // dp over amounts 0..amount. Infinity for unreachable.\n}\n"}',
 '[{"args":[[1,3,4],6],"expected":2,"hidden":false},{"args":[[2],3],"expected":-1,"hidden":false},{"args":[[1,2,5],11],"expected":3,"hidden":false},{"args":[[1],0],"expected":0,"hidden":true},{"args":[[5],5],"expected":1,"hidden":true},{"args":[[2,5],9],"expected":3,"hidden":true},{"args":[[7,3],11],"expected":3,"hidden":true}]',
 'O(amount × len(coins)) time',
 '["dp[0] = 0 and every other entry starts at infinity.","For each amount a, try every coin c <= a and take the best dp[a - c] + 1.","Convert a remaining infinity to -1 at the end. Using 0 as the sentinel reports 1 coin for impossible amounts."]',
 'published'),

('longest-increasing-subsequence', 'lis-length-problem', 'Longest Increasing Subsequence',
 E'Return the length of the longest **strictly increasing** subsequence of `nums`. Elements must keep their relative order but need not be adjacent.\n\nThe O(n^2) DP is sufficient for these tests. Remember that `dp[i]` is the best subsequence *ending at* `i`, so the answer is the maximum over the whole table and not the last entry.\n\nAn empty array has length 0.',
 4,
 '{"python":"def lis_length(nums):\n    # dp[i] = best LIS ending at i. Answer is max(dp).\n    pass\n","javascript":"function lisLength(nums) {\n  // dp[i] = best LIS ending at i. Answer is max(dp).\n}\n"}',
 '[{"args":[[10,9,2,5,3,7,101,18]],"expected":4,"hidden":false},{"args":[[1,2,3,0]],"expected":3,"hidden":false},{"args":[[]],"expected":0,"hidden":false},{"args":[[5,4,3,2,1]],"expected":1,"hidden":true},{"args":[[2,2,2]],"expected":1,"hidden":true},{"args":[[1]],"expected":1,"hidden":true},{"args":[[3,1,4,2]],"expected":2,"hidden":true}]',
 'O(n^2) time, O(n) space',
 '["Initialise every dp[i] to 1 — each element alone is a subsequence of length 1.","For each i, scan every j < i and extend dp[j] when nums[j] < nums[i].","Return max(dp), not dp[-1]. The [1,2,3,0] test is there to catch exactly that, and strict increase means equal values cannot extend."]',
 'published'),

('knapsack', 'knapsack-max-value', '0/1 Knapsack',
 E'Given item `weights`, item `values` and a bag `capacity`, return the greatest total value you can carry. Each item may be taken **at most once**.\n\nGreedy by value-per-weight is wrong — one visible test is exactly the counterexample from the lesson. Build the DP.\n\nIf you use the one-row space optimisation, the capacity loop must run **downwards**, or items get reused and you have solved unbounded knapsack instead.',
 4,
 '{"python":"def knapsack(weights, values, capacity):\n    # each item at most once\n    pass\n","javascript":"function knapsack(weights, values, capacity) {\n  // each item at most once\n}\n"}',
 '[{"args":[[3,2,2],[5,3,3],4],"expected":6,"hidden":false},{"args":[[1,2,3],[6,10,12],5],"expected":22,"hidden":false},{"args":[[],[],5],"expected":0,"hidden":false},{"args":[[5],[10],4],"expected":0,"hidden":true},{"args":[[2],[3],6],"expected":3,"hidden":true},{"args":[[1,1,1],[1,1,1],2],"expected":2,"hidden":true},{"args":[[4,5,6],[1,2,3],10],"expected":4,"hidden":true}]',
 'O(n × capacity) time',
 '["dp[w] = the best value achievable with capacity w, starting all zeros.","For each item, iterate w from capacity down to the item''s weight and take max(dp[w], dp[w - wt] + val).","The weight-5 item with capacity 4 must contribute 0 — guard the weight before indexing. The one-item test [2],[3],6 gives 3, not 9, because reuse is forbidden."]',
 'published'),

('longest-common-subsequence', 'lcs-length-problem', 'Longest Common Subsequence',
 E'Given strings `a` and `b`, return the length of their longest common subsequence — the longest sequence of characters appearing in both, in order, not necessarily adjacent.\n\nBuild the (n+1) × (m+1) table so row and column 0 represent the empty prefix. On a match add 1 to the diagonal; otherwise take the better of dropping one character from either string.\n\nAn empty string shares nothing, so the answer is 0.',
 4,
 '{"python":"def lcs_length(a, b):\n    # (n+1) x (m+1) table; dp[i][j] compares a[i-1] with b[j-1]\n    pass\n","javascript":"function lcsLength(a, b) {\n  // (n+1) x (m+1) table; dp[i][j] compares a[i-1] with b[j-1]\n}\n"}',
 '[{"args":["ABCBDAB","BDCABA"],"expected":4,"hidden":false},{"args":["AB","BA"],"expected":1,"hidden":false},{"args":["","abc"],"expected":0,"hidden":false},{"args":["abc","abc"],"expected":3,"hidden":true},{"args":["abc","def"],"expected":0,"hidden":true},{"args":["aaa","aa"],"expected":2,"hidden":true},{"args":["abcde","ace"],"expected":3,"hidden":true}]',
 'O(n·m) time and space',
 '["Allocate (len(a)+1) rows and (len(b)+1) columns, all zero. Row 0 and column 0 stay zero.","On a[i-1] == b[j-1] set dp[i][j] = dp[i-1][j-1] + 1 — no max is needed, because taking a match is always safe.","Otherwise dp[i][j] = max(dp[i-1][j], dp[i][j-1]). The AB/BA test returns 1 because order rules out both characters."]',
 'published'),

('edit-distance', 'levenshtein', 'Edit Distance',
 E'Return the minimum number of single-character insertions, deletions or substitutions needed to turn `a` into `b` (the Levenshtein distance).\n\nThe base cases are **not** zero: turning a string of length `i` into the empty string costs `i` deletions, so `dp[i][0] = i` and `dp[0][j] = j`.\n\nOn a mismatch take the minimum of three cells — delete, insert, substitute — and add 1 to the whole minimum. A match costs nothing.',
 5,
 '{"python":"def edit_distance(a, b):\n    # dp[i][0] = i, dp[0][j] = j. Three predecessors on a mismatch.\n    pass\n","javascript":"function editDistance(a, b) {\n  // dp[i][0] = i, dp[0][j] = j. Three predecessors on a mismatch.\n}\n"}',
 '[{"args":["kitten","sitting"],"expected":3,"hidden":false},{"args":["ab","ba"],"expected":2,"hidden":false},{"args":["","abc"],"expected":3,"hidden":false},{"args":["abc","abc"],"expected":0,"hidden":true},{"args":["abc",""],"expected":3,"hidden":true},{"args":["flaw","lawn"],"expected":2,"hidden":true},{"args":["a","b"],"expected":1,"hidden":true}]',
 'O(n·m) time and space',
 '["Fill the first row and column with 0,1,2,... before the main loops — those are the all-insert and all-delete costs.","On a match copy the diagonal unchanged. Adding 1 there is the classic error.","On a mismatch the 1 applies to the whole min of the three cells, not to one of them. ab/ba is 2 because Levenshtein has no transposition."]',
 'published')

) AS v(concept_slug, slug, title, prompt, difficulty, starter_code, test_cases, complexity, hints, status)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'recursion-and-dynamic-programming'
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      prompt = EXCLUDED.prompt,
      difficulty = EXCLUDED.difficulty,
      starter_code = EXCLUDED.starter_code,
      test_cases = EXCLUDED.test_cases,
      expected_complexity = EXCLUDED.expected_complexity,
      hints = EXCLUDED.hints,
      status = EXCLUDED.status;
