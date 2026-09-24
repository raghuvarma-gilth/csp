-- ===========================================================================
-- EduVerse — lesson enrichment: figures and worked examples
-- ---------------------------------------------------------------------------
-- Adds two things the seeded lessons were missing: a teaching figure at the
-- point in each lesson where it explains something, and a worked example that
-- traces a concrete input all the way through.
--
-- This is deliberately surgical rather than a rewrite. The prose written in
-- 20260916090300 is good, and replacing whole bodies would throw it away to
-- add a figure line. Every statement here inserts a figure immediately before
-- an existing `## heading` and appends one section at the end; nothing already
-- written is altered.
--
-- Idempotence: every statement is guarded by `content NOT LIKE '%diagram:%'`,
-- so a second run is a no-op. The guard is checked per concept, so a partial
-- application (one statement failed, the rest committed) can be re-run safely.
--
-- Ordering: migrations apply in filename order, so 20260916090300 always runs
-- before this file. That matters, because 090300 ends in `ON CONFLICT ... DO
-- UPDATE SET content = EXCLUDED.content` — re-running the seed by hand AFTER
-- this migration would overwrite these bodies and silently drop every figure.
-- If you ever need to re-seed, re-run this file afterwards.
--
-- Figure keys must exist in DIAGRAMS in src/components/learning/diagrams.tsx.
-- An unknown key renders a visible "figure missing" note rather than a gap, so
-- a typo here is loud rather than silent.
--
-- The `:::example` / `:::pitfall` blocks are rendered as callouts by
-- src/components/learning/Markdown.tsx. They are parsed, never injected as
-- HTML — this text ends up on a student's screen and is treated as untrusted.
-- ===========================================================================

-- Every statement repeats the same course-scoping subquery rather than sharing
-- a helper. That is deliberate: `concepts.slug` is only unique within a chapter
-- (UNIQUE (chapter_id, slug)), so an unscoped `WHERE slug = 'two-pointers'`
-- would also hit a faculty-authored concept in an unrelated course. Inlining it
-- keeps each UPDATE independently runnable — paste one into the Supabase SQL
-- editor on its own and it still does the right thing, which a pg_temp helper
-- would not survive across a pooled connection.


-- === Chapter 1: Arrays & Strings ===========================================

-- 1. Array Fundamentals ------------------------------------------------------
UPDATE public.concepts c
SET content =
  replace(
    replace(
      c.content,
      $old$## What it costs you$old$,
      $new$![An array is one contiguous block, so any index is reachable by arithmetic.](diagram:array-memory)

## What it costs you$new$
    ),
    $old$## Indexing is not searching$old$,
    $new$![Doubling the capacity makes resizes geometrically rarer — the meaning of amortised O(1).](diagram:array-growth)

## Indexing is not searching$new$
  )
  || $ex$

## Worked example

A 32-bit `int` array starts at address `0x1000`. Where does `a[6]` live?

:::example Finding a[6]
Each `int` is 4 bytes, so the machine computes:

```
address(6) = 0x1000 + 6 × 4
           = 0x1000 + 24
           = 0x1018
```

One multiply, one add, one read. The answer does not depend on whether the array holds 10 elements or 10 million — that is exactly what O(1) means here.
:::

Now the same array, and the question *"is the value 42 in it?"*

:::pitfall These are not the same operation
Knowing the **address** of `a[6]` tells you nothing about the **value** stored there, and nothing about where some other value lives. To find 42 you must look at elements one at a time until you find it — O(n) on unsorted data.

`a[6]` is arithmetic. "Where is 42?" is a search. Treating the second as though it were as cheap as the first is the most common array mistake there is.
:::
$ex$
WHERE c.slug = 'array-fundamentals'
  AND c.chapter_id IN (SELECT ch.id
                       FROM public.chapters ch
                       JOIN public.courses co ON co.id = ch.course_id
                       WHERE co.slug = 'data-structures-fundamentals')
  AND c.content NOT LIKE '%diagram:%';


-- 2. Array Operations & Their Costs -----------------------------------------
UPDATE public.concepts c
SET content =
  replace(
    c.content,
    $old$## Deletion has a trap$old$,
    $new$![Inserting into the middle moves every later element — the reason it costs O(n).](diagram:array-shift)

## Deletion has a trap$new$
  )
  || $ex$

## Worked example

Remove every `2` from `[3, 2, 2, 4, 2, 5]` in one pass, no extra array.

:::example Tracing the overwrite idiom
`read` inspects every slot; `write` marks where the next survivor goes.

| `read` | `a[read]` | keep? | `write` before | array after the step |
|---|---|---|---|---|
| 0 | 3 | yes | 0 | `[3, 2, 2, 4, 2, 5]` |
| 1 | 2 | no | 1 | `[3, 2, 2, 4, 2, 5]` |
| 2 | 2 | no | 1 | `[3, 2, 2, 4, 2, 5]` |
| 3 | 4 | yes | 1 | `[3, 4, 2, 4, 2, 5]` |
| 4 | 2 | no | 2 | `[3, 4, 2, 4, 2, 5]` |
| 5 | 5 | yes | 2 | `[3, 4, 5, 4, 2, 5]` |

`write` ends at 3, so the answer is `a[:3]` = `[3, 4, 5]`. The tail past `write` is leftover rubbish and is simply ignored — that is the price of doing it without a second array.

Six reads, three writes, no shifting. **O(n)**.
:::

Compare that with the obvious approach:

:::pitfall Deleting while iterating forwards
```python
for i in range(len(a)):
    if a[i] == target:
        del a[i]          # BUG
```

On `[3, 2, 2, 4, 2, 5]` this deletes the `2` at index 1, which slides the second `2` down into index 1 — but the loop has already moved on to index 2. **The second `2` is never examined** and survives into the result.

It is also O(n²): every `del` shifts the whole tail. The overwrite idiom above is both correct and faster.
:::
$ex$
WHERE c.slug = 'array-operations'
  AND c.chapter_id IN (SELECT ch.id
                       FROM public.chapters ch
                       JOIN public.courses co ON co.id = ch.course_id
                       WHERE co.slug = 'data-structures-fundamentals')
  AND c.content NOT LIKE '%diagram:%';


-- 3. Two Pointers ------------------------------------------------------------
UPDATE public.concepts c
SET content =
  replace(
    c.content,
    $old$## Form 2: same-direction pointers$old$,
    $new$![Each comparison eliminates a candidate, so one pass replaces a nested loop.](diagram:two-pointers)

## Form 2: same-direction pointers$new$
  )
  || $ex$

## Worked example

Find two values in the **sorted** array `[1, 3, 4, 6, 8, 11]` that sum to `10`.

:::example Converging on the pair
| `lo` | `hi` | `a[lo] + a[hi]` | vs target | What that rules out |
|---|---|---|---|---|
| 0 (`1`) | 5 (`11`) | 12 | too big | `11` is too large to pair with anything ≥ `1` → drop `hi` |
| 0 (`1`) | 4 (`8`) | 9 | too small | `1` is too small to pair with anything ≤ `8` → drop `lo` |
| 1 (`3`) | 4 (`8`) | 11 | too big | drop `hi` |
| 1 (`3`) | 3 (`6`) | 9 | too small | drop `lo` |
| 2 (`4`) | 3 (`6`) | **10** | found | answer is `(2, 3)` |

Five comparisons instead of the 15 pairs a nested loop would check. Each step permanently discards one index, so the loop can run at most n times: **O(n)**.
:::

:::pitfall The whole thing collapses on unsorted input
Run the same code on `[8, 1, 11, 3, 6, 4]` and the pruning becomes nonsense. When the sum is too small, moving `lo` right assumes the next value is **larger** — on unsorted data it might be smaller, and you have just discarded a valid answer for no reason.

The loop still terminates and still returns something. It is fast and wrong, which is much worse than slow and right. Before writing the loop, finish the sentence: *"everything left of `lo` has been ruled out because ___."* If sortedness is not what fills that blank, this is the wrong tool.
:::
$ex$
WHERE c.slug = 'two-pointers'
  AND c.chapter_id IN (SELECT ch.id
                       FROM public.chapters ch
                       JOIN public.courses co ON co.id = ch.course_id
                       WHERE co.slug = 'data-structures-fundamentals')
  AND c.content NOT LIKE '%diagram:%';


-- 4. Sliding Window ----------------------------------------------------------
UPDATE public.concepts c
SET content =
  replace(
    c.content,
    $old$## Variable-size window$old$,
    $new$![Reuse the previous window instead of recomputing it.](diagram:sliding-window)

## Variable-size window$new$
  )
  || $ex$

## Worked example

Largest sum of any 3 consecutive elements of `[2, 1, 5, 1, 3, 2]`.

:::example Rolling the window instead of recomputing it
Start by summing the first window outright: `2 + 1 + 5 = 8`.

After that, each move adds the entering element and subtracts the leaving one:

| Move | Window | Arithmetic | Sum |
|---|---|---|---|
| start | `[2, 1, 5]` | `2 + 1 + 5` | 8 |
| `i = 3` | `[1, 5, 1]` | `8 + 1 − 2` | 7 |
| `i = 4` | `[5, 1, 3]` | `7 + 3 − 1` | 9 |
| `i = 5` | `[1, 3, 2]` | `9 + 2 − 5` | 6 |

Best is **9**. Four windows, and after the first each cost one add and one subtract — not three additions. That is the difference between O(n) and O(n·k).
:::

:::pitfall A variable-size window needs a monotone condition
"Longest subarray with sum ≤ 10" looks like a window problem, and on `[2, 1, 5, 1, 3]` it is.

Put a negative number in — `[4, -6, 9]` — and it breaks. Sliding window assumes that once a window is invalid, extending it further keeps it invalid, so shrinking from the left is safe. With negatives, extending an invalid window can make it **valid again**, so the answer gets skipped. No error is raised; the result is just quietly wrong.

Range problems with negative numbers want prefix sums instead.
:::
$ex$
WHERE c.slug = 'sliding-window'
  AND c.chapter_id IN (SELECT ch.id
                       FROM public.chapters ch
                       JOIN public.courses co ON co.id = ch.course_id
                       WHERE co.slug = 'data-structures-fundamentals')
  AND c.content NOT LIKE '%diagram:%';


-- 5. Prefix Sums -------------------------------------------------------------
UPDATE public.concepts c
SET content =
  replace(
    c.content,
    $old$## The query$old$,
    $new$![One pass to build, one subtraction per range query afterwards.](diagram:prefix-sum)

## The query$new$
  )
  || $ex$

## Worked example

Take `a = [1, 2, 3, -3, 3]` and count the subarrays summing to `k = 3`.

:::example Counting with a prefix map
`seen` starts as `{0: 1}` — the empty prefix, which is what lets a subarray starting at index 0 be counted.

| `x` | `running` | `running − k` | `seen[running − k]` | `count` | `seen` after |
|---|---|---|---|---|---|
| 1 | 1 | −2 | 0 | 0 | `{0:1, 1:1}` |
| 2 | 3 | 0 | **1** | 1 | `{0:1, 1:1, 3:1}` |
| 3 | 6 | 3 | **1** | 2 | `{…, 6:1}` |
| −3 | 3 | 0 | **1** | 3 | `{0:1, 1:1, 3:2, 6:1}` |
| 3 | 6 | 3 | **2** | 5 | `{…, 3:2, 6:2}` |

**5 subarrays**, and they check out by hand: `[1,2]`, `[3]`, `[3,-3,3]`, `[3]` (the last one), and `[1,2,3,-3]`.

One pass, one dictionary. **O(n)**.
:::

:::pitfall The off-by-one, and the operations this does not work for
Two separate traps.

**The `+1`.** `range_sum = prefix[r+1] - prefix[l]`. Sanity-check it on a one-element range every single time: with `a = [3,1,4,1,5]` and `prefix = [0,3,4,8,9,14]`, the sum of `a[2..2]` should be `4`, and `prefix[3] - prefix[2] = 8 - 4 = 4`. Correct. Getting this wrong is the single most common prefix-sum bug.

**Minimum and maximum are not invertible.** Knowing the minimum of the first 7 elements and the minimum of the first 3 tells you nothing about the minimum of elements 3–6 — you cannot subtract a minimum back out the way you can a sum. Range minimum queries need a sparse table or a segment tree, not this.
:::

Notice this worked with **negative numbers**, where the sliding window silently fails. That is the practical reason to know both techniques rather than just one.$ex$
WHERE c.slug = 'prefix-sums'
  AND c.chapter_id IN (SELECT ch.id
                       FROM public.chapters ch
                       JOIN public.courses co ON co.id = ch.course_id
                       WHERE co.slug = 'data-structures-fundamentals')
  AND c.content NOT LIKE '%diagram:%';


-- === Chapter 2: Stacks =====================================================

-- 6. Stack Fundamentals ------------------------------------------------------
UPDATE public.concepts c
SET content =
  replace(
    c.content,
    $old$## Implementation with a dynamic array$old$,
    $new$![Both push and pop touch only the top, so neither depends on how deep the stack is.](diagram:stack-lifo)

## Implementation with a dynamic array$new$
  )
  || $ex$

## Worked example

Run a sequence of operations and watch the top.

:::example Eight operations on one stack
| Operation | Stack after (bottom → top) | Returns |
|---|---|---|
| `push(3)` | `[3]` | — |
| `push(7)` | `[3, 7]` | — |
| `pop()` | `[3]` | `7` |
| `push(5)` | `[3, 5]` | — |
| `peek()` | `[3, 5]` | `5` |
| `pop()` | `[3]` | `5` |
| `pop()` | `[]` | `3` |
| `pop()` | `[]` | **underflow** |

Note `3` came out last even though it went in first, and that `peek()` changed nothing. Every one of these touched only the top, which is why every one is O(1) regardless of depth.
:::

:::pitfall Underflow is not an edge case, it is the common case
That last `pop()` is where real stack code breaks. Python raises `IndexError`; C gives you undefined behaviour and may hand back whatever was in that memory.

In bracket matching it is not hypothetical at all — the input `")"` hits it on the very first character. That is why the check is `if not stack or stack.pop() != pairs[ch]` and not just the comparison: the guard has to come **first**, and `or` short-circuits so the `pop()` never runs on an empty stack.
:::
$ex$
WHERE c.slug = 'stack-fundamentals'
  AND c.chapter_id IN (SELECT ch.id
                       FROM public.chapters ch
                       JOIN public.courses co ON co.id = ch.course_id
                       WHERE co.slug = 'data-structures-fundamentals')
  AND c.content NOT LIKE '%diagram:%';


-- 7. Stack Applications ------------------------------------------------------
UPDATE public.concepts c
SET content =
  replace(
    c.content,
    $old$## Why a stack is structurally correct here$old$,
    $new$![The stack holds exactly the brackets that are still unclosed.](diagram:bracket-matching)

## Why a stack is structurally correct here$new$
  )
  || $ex$

## Worked example

Two strings that contain exactly the same brackets, with opposite answers.

:::example Balanced: `{[()]}`
| Char | Action | Stack after |
|---|---|---|
| `{` | opener → push | `{` |
| `[` | opener → push | `{ [` |
| `(` | opener → push | `{ [ (` |
| `)` | pop `(`, matches | `{ [` |
| `]` | pop `[`, matches | `{` |
| `}` | pop `{`, matches | *(empty)* |

Stack is empty at the end, so nothing was left unclosed. **Balanced.**
:::

:::example Unbalanced: `([)]`
| Char | Action | Stack after |
|---|---|---|
| `(` | opener → push | `(` |
| `[` | opener → push | `( [` |
| `)` | pop `[` — expected `(` | — |

Mismatch on the third character; return `False` immediately. **Not balanced**, even though the string contains one of each bracket.
:::

:::pitfall This is why counters do not work
`([)]` has one `(`, one `)`, one `[` and one `]`. Every count balances perfectly, and a solution built on counters says it is fine.

It is not fine — the brackets **interleave** instead of nesting. Counting tells you *how many* are open; only a stack tells you *which one* is innermost, and "does this closer match the most recent unclosed opener" is the actual question. A counter cannot answer it, no matter how many counters you add.
:::
$ex$
WHERE c.slug = 'stack-applications'
  AND c.chapter_id IN (SELECT ch.id
                       FROM public.chapters ch
                       JOIN public.courses co ON co.id = ch.course_id
                       WHERE co.slug = 'data-structures-fundamentals')
  AND c.content NOT LIKE '%diagram:%';


-- 8. Monotonic Stack ---------------------------------------------------------
UPDATE public.concepts c
SET content =
  replace(
    c.content,
    $old$## Next greater element$old$,
    $new$![A value is popped exactly when its answer arrives, so one pass resolves every element.](diagram:monotonic-stack)

## Next greater element$new$
  )
  || $ex$

## Worked example

Next greater element for `a = [2, 1, 5, 6, 2, 3]`, tracing the stack of indices.

:::example Every index pushed once, popped once
| `i` | `x` | Popped (and their answer) | Stack after (indices) |
|---|---|---|---|
| 0 | 2 | — | `[0]` |
| 1 | 1 | — (1 < 2, so nothing is resolved) | `[0, 1]` |
| 2 | 5 | `1`→5, then `0`→5 | `[2]` |
| 3 | 6 | `2`→6 | `[3]` |
| 4 | 2 | — (2 < 6) | `[3, 4]` |
| 5 | 3 | `4`→3 | `[3, 5]` |

Indices `3` and `5` are still on the stack at the end — values `6` and `3` — and nothing greater ever arrived for them, so they keep `-1`.

Result: `[5, 5, 6, -1, 3, -1]`.

Six outer iterations and four pops: **10 operations for n = 6**, not 36.
:::

:::pitfall Two traps, one subtle and one fatal
**"The inner `while` makes it O(n²)."** It does not, and counting the worst single iteration is what leads you astray. At `i = 2` the `while` ran twice — but only because indices 0 and 1 were pushed earlier and will now never be touched again. Each index is pushed once and popped at most once across the *entire* run, so the total is at most 2n. Count total work, not the worst iteration.

**Storing values instead of indices.** `stack.append(x)` instead of `stack.append(i)` compiles and runs, and gives right-looking answers on arrays with no duplicates. Then you need to write the answer into `res[...]` and there is no index to write to — and on `[2, 2, 5]` you cannot tell the two `2`s apart. Push indices; `a[stack[-1]]` recovers the value whenever you need it.
:::
$ex$
WHERE c.slug = 'monotonic-stack'
  AND c.chapter_id IN (SELECT ch.id
                       FROM public.chapters ch
                       JOIN public.courses co ON co.id = ch.course_id
                       WHERE co.slug = 'data-structures-fundamentals')
  AND c.content NOT LIKE '%diagram:%';


-- === Chapter 3: Queues =====================================================

-- 9. Queue Fundamentals ------------------------------------------------------
UPDATE public.concepts c
SET content =
  replace(
    c.content,
    $old$## The naive implementation is quadratic$old$,
    $new$![Arrivals at the rear, departures from the front.](diagram:queue-fifo)

## The naive implementation is quadratic$new$
  )
  || $ex$

## Worked example

Five print jobs arrive as `A B C D E`. Process the whole queue with `q.pop(0)`.

:::example Counting the shifting
Each `pop(0)` removes the front and slides everything behind it down one slot:

| `dequeue()` | Returns | Queue after | Elements shifted |
|---|---|---|---|
| 1st | `A` | `B C D E` | 4 |
| 2nd | `B` | `C D E` | 3 |
| 3rd | `C` | `D E` | 2 |
| 4th | `D` | `E` | 1 |
| 5th | `E` | *(empty)* | 0 |

**10 shifts to process 5 jobs.** In general `n(n−1)/2`, which is O(n²) — so 1,000 jobs cost **499,500** element moves, and 10,000 jobs cost nearly 50 million.

Swap `q = []`/`q.pop(0)` for `deque()`/`q.popleft()` and the same five dequeues cost 0 shifts.
:::

:::pitfall Small tests will not catch this
With 5 jobs the naive version does 10 extra moves — invisible. With 100 it does 4,950, still fast enough to pass. The cost only becomes obvious in production, under load, which is precisely where you do not want to discover it.

The tell is `pop(0)` or `list.remove(0)` or `arr.shift()` anywhere near a loop. There is no situation where removing from the front of an array is the right call — `collections.deque` is one import away.
:::
$ex$
WHERE c.slug = 'queue-fundamentals'
  AND c.chapter_id IN (SELECT ch.id
                       FROM public.chapters ch
                       JOIN public.courses co ON co.id = ch.course_id
                       WHERE co.slug = 'data-structures-fundamentals')
  AND c.content NOT LIKE '%diagram:%';


-- 10. Circular Queue ---------------------------------------------------------
UPDATE public.concepts c
SET content =
  replace(
    c.content,
    $old$## The full-vs-empty ambiguity$old$,
    $new$![Modular arithmetic lets the rear wrap around instead of forcing a shift.](diagram:circular-queue)

## The full-vs-empty ambiguity$new$
  )
  || $ex$

## Worked example

Capacity 4. Watch the rear run off the end and come back round.

:::example Seven operations on a ring of 4
`rear` is always `(front + size) % capacity`, so it is never stored.

| Operation | `front` | `size` | `data[0..3]` | Note |
|---|---|---|---|---|
| `enqueue(A)` | 0 | 1 | `[A, _, _, _]` | |
| `enqueue(B)` | 0 | 2 | `[A, B, _, _]` | |
| `enqueue(C)` | 0 | 3 | `[A, B, C, _]` | |
| `dequeue()` → `A` | 1 | 2 | `[_, B, C, _]` | slot 0 is now free |
| `dequeue()` → `B` | 2 | 1 | `[_, _, C, _]` | slot 1 is now free |
| `enqueue(D)` | 2 | 2 | `[_, _, C, D]` | rear = `(2+1) % 4` = 3 |
| `enqueue(E)` | 2 | 3 | `[E, _, C, D]` | rear = `(2+2) % 4` = **0** ← wrapped |

`E` lands in the slot `A` vacated. A non-circular queue would have reported "full" here with two slots standing empty. Nothing was ever shifted, and both ends stayed O(1).
:::

:::pitfall Forgetting `% capacity`, and the state you cannot distinguish
**The missing modulo** turns the ring back into a plain array: the index walks off the end and you get an `IndexError`, or in C, memory you do not own.

**The ambiguity is nastier.** If you track only `front` and `rear` and drop the `size` counter, then `front == rear` means *both* empty and full — the two states look identical, and the queue silently drops writes or hands back stale entries under load. Pick a resolution deliberately: keep a `size` (used above, and it uses the whole array), leave one slot permanently unused, or keep a flag. Picking none of them is the bug.
:::
$ex$
WHERE c.slug = 'circular-queue'
  AND c.chapter_id IN (SELECT ch.id
                       FROM public.chapters ch
                       JOIN public.courses co ON co.id = ch.course_id
                       WHERE co.slug = 'data-structures-fundamentals')
  AND c.content NOT LIKE '%diagram:%';


-- 11. Deques & Monotonic Queues ---------------------------------------------
UPDATE public.concepts c
SET content =
  replace(
    c.content,
    $old$## The idea$old$,
    $new$![Discard anything that can never win again; the front is then always the answer.](diagram:monotonic-deque)

## The idea$new$
  )
  || $ex$

## Worked example

Sliding-window maximum of `a = [1, 3, -1, -3, 5, 3]` with `k = 3`.

:::example Both ends doing different jobs
The deque holds indices, and `a[dq]` always decreases from front to rear.

| `i` | `x` | Expired from front | Dominated, dropped from rear | Deque after | Output |
|---|---|---|---|---|---|
| 0 | 1 | — | — | `[0]` | — |
| 1 | 3 | — | `0` (value 1 ≤ 3) | `[1]` | — |
| 2 | −1 | — | — | `[1, 2]` | `a[1]` = **3** |
| 3 | −3 | — | — | `[1, 2, 3]` | `a[1]` = **3** |
| 4 | 5 | `1` (aged out) | `3`, then `2` | `[4]` | `a[4]` = **5** |
| 5 | 3 | — | — | `[4, 5]` | `a[4]` = **5** |

Result: `[3, 3, 5, 5]` — which matches checking the four windows by hand: `[1,3,-1]`, `[3,-1,-3]`, `[-1,-3,5]`, `[-3,5,3]`.

Look at row `i = 4`. The front was dropped because its **index** was too old, and two entries were dropped from the rear because their **values** were too small. Six indices, six appends, six removals: **O(n)**.
:::

:::pitfall Why a stack genuinely cannot do this
It is tempting to reach for the monotonic stack from the previous chapter, since the "discard anything dominated" half is identical. It does not work, and row `i = 4` shows exactly why.

Two different removals happen there, for two unrelated reasons:

- the **front** went because its index aged out of the window — a question about *time*
- the **rear** went because a bigger value arrived — a question about *value*

A stack has one end, so it can do the second but never the first. A plain queue can do the first but never the second. The problem needs both at once, which is the whole reason a double-ended queue exists.
:::
$ex$
WHERE c.slug = 'deque-and-monotonic-queue'
  AND c.chapter_id IN (SELECT ch.id
                       FROM public.chapters ch
                       JOIN public.courses co ON co.id = ch.course_id
                       WHERE co.slug = 'data-structures-fundamentals')
  AND c.content NOT LIKE '%diagram:%';


-- ===========================================================================
-- Verification. Should report 11 enriched concepts, 0 missed.
--
--   SELECT count(*) FILTER (WHERE content LIKE '%diagram:%')   AS with_figure,
--          count(*) FILTER (WHERE content LIKE '%## Worked example%') AS with_example,
--          count(*) AS total
--   FROM public.concepts c
--   WHERE c.chapter_id IN (
--     SELECT ch.id FROM public.chapters ch
--     JOIN public.courses co ON co.id = ch.course_id
--     WHERE co.slug = 'data-structures-fundamentals');
--
-- A concept with a worked example but no figure means a `replace()` anchor
-- stopped matching because the lesson prose was edited — the append still
-- ran, the insertion silently did nothing. Re-check that concept's headings.
-- ===========================================================================
