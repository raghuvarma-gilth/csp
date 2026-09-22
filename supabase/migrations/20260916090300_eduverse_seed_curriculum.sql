-- ============================================================================
-- EduVerse — Seed curriculum: Data Structures Fundamentals
-- ----------------------------------------------------------------------------
-- The prototype carried its curriculum as hard-coded objects in three separate
-- React components (ChapterView.tsx, ConceptLearning.tsx, LearnFlow.tsx), all
-- disagreeing with each other. This is the single source of truth.
--
-- Eleven concepts across three chapters, wired into a real prerequisite DAG so
-- the roadmap has something to compute over. Every lesson here is actual
-- teaching material; nothing is a placeholder.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Course + chapters
-- ---------------------------------------------------------------------------
INSERT INTO public.courses (slug, code, title, description, subject, status, position)
VALUES (
  'data-structures-fundamentals',
  'CS201',
  'Data Structures Fundamentals',
  'Linear data structures and the patterns built on them — arrays, stacks and queues — from memory layout through the interview-grade techniques that depend on them.',
  'Computer Science',
  'published',
  1
)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status;

INSERT INTO public.chapters (course_id, slug, title, description, status, position)
SELECT c.id, v.slug, v.title, v.description, 'published'::public.content_status, v.position
FROM public.courses c
CROSS JOIN (VALUES
  ('arrays-and-strings', 'Arrays & Strings',
   'Contiguous memory, the cost of every operation, and the three patterns that turn quadratic array code into linear code.', 1),
  ('stacks', 'Stacks',
   'Last-in-first-out, and why so many problems — bracket matching, expression evaluation, undo, recursion itself — are secretly stack problems.', 2),
  ('queues', 'Queues',
   'First-in-first-out, the wraparound trick that makes it efficient, and the double-ended variant that solves sliding-window maximum in linear time.', 3)
) AS v(slug, title, description, position)
WHERE c.slug = 'data-structures-fundamentals'
ON CONFLICT (course_id, slug) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      position = EXCLUDED.position;

-- ---------------------------------------------------------------------------
-- 2. Concepts
-- ---------------------------------------------------------------------------
INSERT INTO public.concepts (chapter_id, slug, title, summary, content, difficulty, estimated_minutes, visual_key, status, position)
SELECT ch.id, v.slug, v.title, v.summary, v.content, v.difficulty, v.minutes, v.visual_key,
       'published'::public.content_status, v.position
FROM public.chapters ch
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'data-structures-fundamentals'
JOIN (VALUES

-- === Chapter 1: Arrays & Strings ==========================================
('arrays-and-strings', 'array-fundamentals', 'Array Fundamentals',
 'Why indexing is O(1): arrays are one contiguous block, so the address of any element is arithmetic, not search.',
 $md$## The one idea

An array is a single contiguous block of memory holding elements of equal size. That is the whole definition, and every property of arrays falls out of it.

Because the elements are equal-sized and adjacent, the machine can compute where element `i` lives:

```
address(i) = base_address + i × element_size
```

That is one multiply and one add — constant time, regardless of whether the array holds 10 elements or 10 million. This is **random access**, and it is the thing arrays are for.

## What it costs you

Contiguity is not free. To guarantee the block stays contiguous, the array must reserve its space up front. In C or Java, `int[] a = new int[100]` reserves exactly 100 slots, and you cannot grow it.

## Static vs dynamic arrays

Python's `list`, Java's `ArrayList`, C++'s `std::vector` and JavaScript's `Array` are **dynamic arrays**. They wrap a fixed block and, when it fills, allocate a larger one (typically 2×) and copy everything over.

```python
a = [3, 1, 4]     # dynamic array, capacity may be > 3
a.append(1)       # usually O(1); occasionally O(n) when it must resize
```

The copy makes an occasional append O(n), but because capacity doubles, those copies get rarer geometrically. Averaged over many appends, each one costs O(1) — this is **amortised** constant time, and it is not the same claim as "append is always fast".

## Indexing is not searching

`a[7]` is O(1). "Where is the value 7?" is O(n) in an unsorted array, because you must look. Confusing these two is the most common array mistake.

## Memory locality

A sequential scan over an array is dramatically faster than the same scan over a linked list with the same number of elements, even though both are O(n). The CPU loads memory in cache lines; contiguous data means the next elements you need are already loaded. Big-O hides this, but it is often a 10× difference in practice.$md$,
 1, 20, 'array-memory', 1),

('arrays-and-strings', 'array-operations', 'Array Operations & Their Costs',
 'Insertion and deletion in the middle are O(n) because of shifting — this single fact drives most array algorithm design.',
 $md$## The cost table

| Operation | Cost | Why |
|---|---|---|
| Read/write `a[i]` | O(1) | address arithmetic |
| Append at end | O(1) amortised | no shifting; occasional resize |
| Insert at index `i` | O(n) | everything from `i` onward shifts right |
| Delete at index `i` | O(n) | everything after `i` shifts left |
| Search (unsorted) | O(n) | must inspect each element |
| Search (sorted) | O(log n) | binary search |

## Why insertion shifts

To insert `9` at index 1 of `[3, 1, 4, 1, 5]`, the slot must be vacated:

```
[3, 1, 4, 1, 5, _]
[3, _, 1, 4, 1, 5]   ← shift right, from the back
[3, 9, 1, 4, 1, 5]
```

Shifting must run **back to front**. Going front to back overwrites the value you were about to move.

Inserting at the front is the worst case: every element moves. n insertions at the front cost O(n²).

## Deletion has a trap

```python
for i in range(len(a)):
    if a[i] == target:
        del a[i]          # BUG: indices after i just shifted left
```

Deleting element `i` slides `i+1` into position `i`, but the loop then moves to `i+1` and skips it. Iterate backwards, or build a new list, or use the two-pointer overwrite.

## The overwrite idiom

When you need to remove all copies of a value in O(n) with no extra memory, do not delete. Write the survivors forward:

```python
write = 0
for read in range(len(a)):
    if a[read] != target:
        a[write] = a[read]
        write += 1
# a[:write] is the result
```

Each element is read once and written at most once. This is the seed of the two-pointer pattern.

## Binary search needs sorted data

```python
lo, hi = 0, len(a) - 1
while lo <= hi:
    mid = (lo + hi) // 2
    if a[mid] == target: return mid
    if a[mid] < target:  lo = mid + 1
    else:                hi = mid - 1
return -1
```

O(log n) — but sorting first costs O(n log n). For a single lookup on unsorted data, a linear scan wins.$md$,
 2, 25, 'array-shift', 2),

('arrays-and-strings', 'two-pointers', 'Two Pointers',
 'Replace a nested loop with two indices moving under an invariant — O(n²) becomes O(n).',
 $md$## The problem it solves

Checking every pair in an array is O(n²):

```python
for i in range(n):
    for j in range(i + 1, n):
        ...
```

If the array has structure — usually **sortedness** — you can often decide, from one comparison, that an entire range of pairs is hopeless. Two pointers exploits that.

## Form 1: converging pointers

Find two values in a **sorted** array summing to a target:

```python
lo, hi = 0, len(a) - 1
while lo < hi:
    s = a[lo] + a[hi]
    if s == target: return (lo, hi)
    if s < target:  lo += 1     # need more; only the left can grow
    else:           hi -= 1     # need less; only the right can shrink
return None
```

The correctness argument matters more than the code. When `s < target`, `a[lo]` paired with anything at or below `hi` is even smaller — so `lo` can never be part of a solution, and discarding it discards nothing valid. Each step removes one index, so the loop runs at most n times: **O(n)**.

This is why sortedness is mandatory. On unsorted input, "too small" tells you nothing about the other pairs, and the pruning is invalid.

## Form 2: same-direction pointers

One pointer reads, one writes:

```python
write = 1
for read in range(1, len(a)):
    if a[read] != a[write - 1]:
        a[write] = a[read]
        write += 1
return write        # length of the deduplicated prefix
```

`read` always leads; `write` marks the boundary of the finished region.

## Recognising it

Reach for two pointers when you see: sorted input, a pair/triplet target, palindrome checks, in-place filtering, or merging two sorted sequences. Triplet problems are usually "fix one element, two-pointer the rest" — O(n²) rather than O(n³).

## The invariant is the whole technique

Before writing the loop, finish this sentence: *"everything left of `lo` and right of `hi` has been ruled out because ___."* If you cannot, two pointers is the wrong tool and you will produce a loop that is fast and wrong.$md$,
 3, 30, 'two-pointers', 3),

('arrays-and-strings', 'sliding-window', 'Sliding Window',
 'A contiguous range that grows on the right and shrinks on the left; each index enters and leaves once, so the scan is O(n).',
 $md$## Fixed-size window

Sum of every window of size k, without recomputing:

```python
s = sum(a[:k])
best = s
for i in range(k, len(a)):
    s += a[i] - a[i - k]     # add entering, remove leaving
    best = max(best, s)
```

The naive version re-adds k elements per position: O(n·k). This is O(n), because moving the window changes exactly two elements.

## Variable-size window

"Longest substring with no repeated character" — the window grows greedily and shrinks only when the invariant breaks:

```python
last = {}          # char -> most recent index
left = 0
best = 0
for right, ch in enumerate(s):
    if ch in last and last[ch] >= left:
        left = last[ch] + 1     # shrink past the previous copy
    last[ch] = right
    best = max(best, right - left + 1)
```

## Why it is O(n), not O(n²)

There is a nested loop in most variable-window code, which looks quadratic. It is not: `left` only ever increases, and it can increase at most n times in total across the whole run. Every index enters the window once and leaves at most once — **2n operations**.

This is amortised analysis. Counting the inner loop's worst single iteration gives the wrong answer; counting total work across the run gives the right one.

## The three questions

Every sliding-window problem is the same three decisions:

1. **What makes the window valid?** (no repeats, sum ≤ target, at most k distinct…)
2. **When do I shrink?** — while the window is invalid, move `left`.
3. **When do I record the answer?** — for *longest*, after shrinking (window is valid). For *shortest*, inside the shrink loop.

Getting 3 wrong is the usual bug: recording a maximum while the window is still invalid.

## Where it does not apply

The window must be **contiguous**, and the validity condition must be **monotone** — extending an invalid window must not make it valid again. "Subarray sum ≤ target" with negative numbers breaks this, and sliding window silently returns wrong answers. Use prefix sums there instead.$md$,
 3, 30, 'sliding-window', 4),

('arrays-and-strings', 'prefix-sums', 'Prefix Sums',
 'Precompute cumulative totals once in O(n); answer any range-sum query afterwards in O(1).',
 $md$## Construction

`prefix[i]` = sum of the first `i` elements. The leading zero is what makes the query formula clean:

```python
prefix = [0] * (len(a) + 1)
for i, x in enumerate(a):
    prefix[i + 1] = prefix[i] + x
```

For `a = [3, 1, 4, 1, 5]` → `prefix = [0, 3, 4, 8, 9, 14]`.

## The query

Sum of `a[l..r]` inclusive:

```python
range_sum = prefix[r + 1] - prefix[l]
```

`prefix[r+1]` counts everything up to and including `r`; `prefix[l]` counts everything strictly before `l`. Subtracting cancels the shared head.

Build once: O(n). Each query afterwards: O(1). For q queries, O(n + q) instead of O(n·q).

## Off-by-one

Almost every prefix-sum bug is the `+1`. Check with a one-element range: sum of `a[2..2]` should be `a[2]`. With the formula: `prefix[3] - prefix[2]` = `8 - 4` = `4` = `a[2]`. Correct.

## Subarray sum equals k

The real payoff. Count subarrays summing to `k` in O(n), using the identity `prefix[j] - prefix[i] == k` ⟺ `prefix[i] == prefix[j] - k`:

```python
from collections import defaultdict
seen = defaultdict(int)
seen[0] = 1          # empty prefix, so subarrays starting at index 0 count
running = 0
count = 0
for x in a:
    running += x
    count += seen[running - k]   # how many earlier prefixes complete a sum of k
    seen[running] += 1
```

Note this works with **negative numbers**, where sliding window does not. That is the practical reason to know both.

## Beyond sums

The same trick works for any invertible operation: prefix XOR (range XOR), prefix products (careful with zeros), and 2-D prefix sums for rectangle queries via inclusion–exclusion:

```
rect = P[r2+1][c2+1] - P[r1][c2+1] - P[r2+1][c1] + P[r1][c1]
```

Min and max are **not** invertible — you cannot subtract them out. Those need a sparse table or a segment tree.$md$,
 3, 25, 'prefix-sum', 5),

-- === Chapter 2: Stacks =====================================================
('stacks', 'stack-fundamentals', 'Stack Fundamentals',
 'Last in, first out. Every operation touches only the top, so every operation is O(1).',
 $md$## The contract

A stack restricts access to one end, called the **top**:

| Operation | Meaning | Cost |
|---|---|---|
| `push(x)` | add on top | O(1) |
| `pop()` | remove and return top | O(1) |
| `peek()` / `top()` | look at top, do not remove | O(1) |
| `isEmpty()` | any elements? | O(1) |

There is deliberately **no** way to read the middle. That restriction is the feature: it is what makes every operation constant time, and what makes stack code easy to reason about.

## Implementation with a dynamic array

```python
stack = []
stack.append(x)      # push
top = stack[-1]      # peek
val = stack.pop()    # pop
```

Push and pop act at the **end** of the array, which is exactly where arrays are cheap — no shifting. Using the front instead would make every operation O(n).

## Implementation with a linked list

Insert and remove at the head:

```
top -> [c] -> [b] -> [a] -> null
```

Also O(1), no resizing pauses, but each node costs a pointer and the nodes are scattered in memory — worse cache behaviour. Array-backed is the usual default.

## Underflow and overflow

Popping an empty stack is **underflow** — Python raises `IndexError`, C gives you undefined behaviour. Always guard:

```python
if not stack:
    raise ValueError("pop from empty stack")
```

Overflow only applies to fixed-capacity implementations. The famous case is the **call stack**: infinite recursion exhausts it and raises `RecursionError` / segfaults.

## The call stack is a stack

Every function call pushes a frame holding parameters, locals and the return address. Returning pops it. This is why recursion unwinds in exactly reverse order of calling, and why any recursive algorithm can be rewritten iteratively with an explicit stack.

## When a stack is the answer

Whenever the problem says *"most recent unmatched…"*, *"undo"*, *"reverse"*, *"innermost"*, or *"backtrack"*. All of those mean: the thing you need next is the thing you saw most recently.$md$,
 2, 20, 'stack', 1),

('stacks', 'stack-applications', 'Stack Applications',
 'Bracket matching, expression evaluation and undo are the same algorithm: defer the unresolved, resolve most-recent-first.',
 $md$## Balanced brackets

```python
pairs = {')': '(', ']': '[', '}': '{'}
stack = []
for ch in s:
    if ch in '([{':
        stack.append(ch)
    elif ch in pairs:
        if not stack or stack.pop() != pairs[ch]:
            return False        # wrong type, or nothing open
return not stack                # anything left open means unbalanced
```

Three separate failure modes, and each needs its own check:

- `"(]"` — mismatched type → the `!=` catches it
- `"())"` — closer with nothing open → the `not stack` catches it
- `"(()"` — leftovers at the end → the final `not stack` catches it

A counter instead of a stack works only for a single bracket type. With three types a counter accepts `"([)]"`, which is wrong. The stack remembers *which* bracket, not just how many.

## Why a stack is structurally correct here

Brackets nest. The next closer must match the **most recently opened** unclosed bracket — that is the definition of LIFO. The data structure mirrors the grammar.

## Postfix evaluation

`"3 4 + 2 *"` → 14. Operands wait; an operator consumes the two most recent:

```python
for token in tokens:
    if token.isdigit():
        stack.append(int(token))
    else:
        b = stack.pop()
        a = stack.pop()          # order matters: a op b, not b op a
        stack.append(apply(token, a, b))
return stack.pop()
```

Popping in the wrong order silently breaks `-` and `/` while leaving `+` and `*` correct — so it passes careless tests.

## Infix to postfix (shunting-yard)

Operators wait on the stack until an operator of equal-or-higher precedence arrives, then pop. This is how a calculator turns `3 + 4 * 2` into `3 4 2 * +` without parentheses.

## Undo/redo

Two stacks. Each action pushes onto undo. Undo pops from undo and pushes onto redo. A **new** action clears redo — which is why you cannot redo after typing something new, in every editor you have used.

## Depth-first search

Explicit stack replaces recursion:

```python
stack = [start]
while stack:
    node = stack.pop()
    ...
```

Change `pop()` to `popleft()` on a deque and the identical code becomes breadth-first. The data structure, not the loop, decides the traversal order.$md$,
 3, 30, 'stack-brackets', 2),

('stacks', 'monotonic-stack', 'Monotonic Stack',
 'Keep the stack sorted as you scan. Each element is pushed once and popped once, so "next greater element" costs O(n), not O(n²).',
 $md$## The problem

For each element, find the next element to its right that is larger. Brute force scans right from every position: O(n²).

## The insight

If `a[j] > a[i]` and `j > i`, then `a[i]` can never be the answer for anything after `j` — `a[j]` is closer and bigger, so it wins every time. So `a[i]` is dead and can be discarded permanently.

Keeping only the still-possible candidates leaves a stack in **decreasing** order. Maintaining that order *is* the algorithm.

## Next greater element

```python
res = [-1] * len(a)
stack = []                       # holds indices; values strictly decreasing
for i, x in enumerate(a):
    while stack and a[stack[-1]] < x:
        res[stack.pop()] = x     # x is the next greater for that index
    stack.append(i)
return res
```

Store **indices**, not values — you almost always need the position, and you can always recover the value.

## Why O(n) despite the inner while

Count total work, not worst-case per iteration. Each index is pushed exactly once and popped at most once, so the `while` body runs at most n times across the entire outer loop: 2n operations. The nested loop is a shape, not a complexity.

## The four variants

The comparison and direction select which question you answer:

| Want | Scan | Pop while |
|---|---|---|
| next greater | left → right | `stack top < current` |
| next smaller | left → right | `stack top > current` |
| previous greater | right → left | `stack top < current` |
| previous smaller | right → left | `stack top > current` |

Whether you use `<` or `<=` decides how ties are treated — get it wrong and duplicates break the result.

## Largest rectangle in a histogram

The classic payoff. For each bar, the rectangle using it as the height extends until a shorter bar appears on either side — which is exactly "previous smaller" and "next smaller". One monotonic increasing stack computes both in a single O(n) pass, replacing an O(n²) scan.

## Recognising it

The trigger phrase is *"for each element, find the nearest element to the left/right that is bigger/smaller"*. Also: daily temperatures, stock span, trapping rain water, and histogram problems.$md$,
 4, 30, 'monotonic-stack', 3),

-- === Chapter 3: Queues =====================================================
('queues', 'queue-fundamentals', 'Queue Fundamentals',
 'First in, first out — and the naive array implementation has an O(n) dequeue that a circular buffer fixes.',
 $md$## The contract

A queue opens at both ends: add at the **rear**, remove from the **front**.

| Operation | Meaning |
|---|---|
| `enqueue(x)` | add at rear |
| `dequeue()` | remove and return front |
| `peek()` | inspect front |
| `isEmpty()` | any elements? |

Fairness is the point: the element that has waited longest is served next. Print spoolers, task schedulers, request handlers and BFS frontiers are all queues.

## The naive implementation is quadratic

```python
q = []
q.append(x)        # enqueue — O(1)
q.pop(0)           # dequeue — O(n)  ← every remaining element shifts left
```

`pop(0)` removes from the front of an array, so all n−1 survivors move down one slot. Processing n items costs O(n²). This is the single most common queue mistake, and it does not show up in small tests.

## Correct implementations

**`collections.deque`** — a doubly linked list of blocks, O(1) at both ends:

```python
from collections import deque
q = deque()
q.append(x)        # enqueue — O(1)
q.popleft()        # dequeue — O(1)
```

**Two stacks** — an interview favourite. Push onto `inbox`; when `outbox` is empty, pour the whole `inbox` into it, which reverses the order. Each element moves between stacks at most once, so dequeue is O(1) *amortised* even though one particular call can be O(n).

**Circular buffer** — fixed array with wraparound indices. Covered in the next concept.

## Stack vs queue

Same operations, opposite ends. In DFS a stack drives you as deep as possible before backtracking; in BFS a queue explores everything at distance 1, then distance 2. That is why BFS finds shortest paths in unweighted graphs and DFS does not.

## Priority queue is not a queue

A priority queue serves by *rank*, not arrival order, and is normally a heap with O(log n) operations. The name is misleading — it does not obey FIFO.$md$,
 2, 20, 'queue', 1),

('queues', 'circular-queue', 'Circular Queue',
 'Wrap the indices with modulo and a fixed array gives O(1) at both ends, with no shifting and no wasted space.',
 $md$## The problem being solved

A plain array queue with moving `front` and `rear` indices avoids shifting, but the space before `front` is abandoned. After enough operations the queue reports "full" while most of the array sits empty.

## The fix

Treat the array as a ring. When an index runs off the end, wrap it:

```python
rear = (rear + 1) % capacity
```

The reclaimed space is reused, and both ends stay O(1).

## Implementation

Tracking an explicit `size` avoids the classic ambiguity (see below):

```python
class CircularQueue:
    def __init__(self, capacity):
        self.data = [None] * capacity
        self.capacity = capacity
        self.front = 0
        self.size = 0

    def enqueue(self, x):
        if self.size == self.capacity:
            raise OverflowError("queue is full")
        rear = (self.front + self.size) % self.capacity
        self.data[rear] = x
        self.size += 1

    def dequeue(self):
        if self.size == 0:
            raise IndexError("queue is empty")
        x = self.data[self.front]
        self.data[self.front] = None            # release the reference
        self.front = (self.front + 1) % self.capacity
        self.size -= 1
        return x
```

## The full-vs-empty ambiguity

If you track only `front` and `rear`, then `front == rear` means **both** empty and full — the two states are indistinguishable. Three standard resolutions:

1. **Keep a `size` counter** (used above) — simplest, uses the whole array.
2. **Leave one slot unused** — full is `(rear + 1) % capacity == front`. Costs one slot.
3. **Keep a boolean flag** for the last operation.

Picking none of these is the bug that makes a circular queue silently drop or duplicate elements under load.

## Where you meet it

Ring buffers in audio and video pipelines, keyboard and network interrupt buffers, fixed-size logs, and producer–consumer channels. The appeal is a hard memory bound: the structure can never grow, so it can never exhaust memory — it drops or blocks instead, which is usually the behaviour you want in a driver.$md$,
 3, 25, 'circular-queue', 2),

('queues', 'deque-and-monotonic-queue', 'Deques & Monotonic Queues',
 'A double-ended queue that keeps its contents sorted solves sliding-window maximum in O(n) — the last technique in this course, and it uses all the others.',
 $md$## Deque

A **d**ouble-**e**nded **que**ue allows O(1) insertion and removal at *both* ends. It generalises stack (one end) and queue (opposite ends), which is why `collections.deque` is the recommended implementation of both in Python.

```python
from collections import deque
d = deque()
d.append(x); d.appendleft(x)     # both O(1)
d.pop();     d.popleft()         # both O(1)
```

## Sliding-window maximum

Given an array and window size k, report the maximum of every window.

- Recomputing per window: O(n·k).
- A max-heap: O(n log k), plus bookkeeping for stale entries.
- A monotonic deque: **O(n)**.

## The idea

Two observations, and the algorithm follows:

1. If `a[j] > a[i]` and `j > i`, then `a[i]` is useless — any window containing `i` also contains `j`, and `j` survives longer. Discard it.
2. Anything whose index has fallen out of the window is useless regardless of value.

Keep only the candidates that survive both tests. They are automatically in decreasing order, and the front is always the current window maximum.

```python
from collections import deque

def max_sliding_window(a, k):
    dq = deque()                 # indices; a[dq] strictly decreasing
    out = []
    for i, x in enumerate(a):
        if dq and dq[0] <= i - k:
            dq.popleft()                  # front expired out of the window
        while dq and a[dq[-1]] <= x:
            dq.pop()                      # dominated by x — discard from the rear
        dq.append(i)
        if i >= k - 1:
            out.append(a[dq[0]])          # front is the maximum
    return out
```

## Both ends, for different reasons

This is the part worth understanding. The deque is needed because **expiry and domination happen at opposite ends**:

- the **front** is popped by *time* — its index aged out of the window
- the **rear** is popped by *value* — a larger element arrived and dominated it

A stack cannot expire from the front. A queue cannot discard from the rear. Only a deque does both, which is precisely why the problem needs one.

## Complexity

Each index is appended once and removed once, from one end or the other: O(n) total, O(k) space. This is the same amortised argument as the monotonic stack — because it is the same technique, with an expiry rule bolted on.

## What you now have

Flip `<=` to `>=` and you get sliding-window minimum. Combine with prefix sums and you can solve "maximum subarray sum of length at most k" in linear time. This concept sits at the convergence of the sliding window, the monotonic stack and the circular queue — which is exactly why it is last.$md$,
 4, 30, 'monotonic-deque', 3)

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
-- 3. Prerequisite DAG
--    Scoped to this course so the slug joins cannot pick up a future course's
--    concept with a colliding slug.
-- ---------------------------------------------------------------------------
INSERT INTO public.concept_prerequisites (concept_id, prerequisite_id)
SELECT c.id, p.id
FROM (VALUES
  ('array-operations',          'array-fundamentals'),
  ('two-pointers',              'array-operations'),
  ('sliding-window',            'two-pointers'),
  ('prefix-sums',               'array-operations'),
  ('stack-fundamentals',        'array-fundamentals'),
  ('stack-applications',        'stack-fundamentals'),
  ('monotonic-stack',           'stack-applications'),
  ('queue-fundamentals',        'array-fundamentals'),
  ('circular-queue',            'queue-fundamentals'),
  ('deque-and-monotonic-queue', 'circular-queue'),
  ('deque-and-monotonic-queue', 'sliding-window'),
  ('deque-and-monotonic-queue', 'monotonic-stack')
) AS v(concept_slug, prereq_slug)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters cch ON cch.id = c.chapter_id
JOIN public.courses cco ON cco.id = cch.course_id AND cco.slug = 'data-structures-fundamentals'
JOIN public.concepts p ON p.slug = v.prereq_slug
JOIN public.chapters pch ON pch.id = p.chapter_id
JOIN public.courses pco ON pco.id = pch.course_id AND pco.slug = 'data-structures-fundamentals'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Learning objectives
-- ---------------------------------------------------------------------------
DELETE FROM public.learning_objectives lo
USING public.concepts c, public.chapters ch, public.courses co
WHERE lo.concept_id = c.id AND c.chapter_id = ch.id AND ch.course_id = co.id
  AND co.slug = 'data-structures-fundamentals';

INSERT INTO public.learning_objectives (concept_id, objective, position)
SELECT c.id, v.objective, v.position
FROM (VALUES
  ('array-fundamentals', 'Explain why array indexing is O(1) using the address formula', 1),
  ('array-fundamentals', 'Distinguish a static array from a dynamic array and describe the resize cost', 2),
  ('array-fundamentals', 'Explain what "amortised O(1)" means for append', 3),
  ('array-operations', 'State the cost of insert, delete, and search and justify each', 1),
  ('array-operations', 'Explain why insertion must shift from the back to the front', 2),
  ('array-operations', 'Apply the read/write overwrite idiom to filter in place', 3),
  ('two-pointers', 'Explain why converging two pointers requires sorted input', 1),
  ('two-pointers', 'State the invariant that justifies discarding a pointer position', 2),
  ('two-pointers', 'Convert an O(n^2) pair search into an O(n) two-pointer scan', 3),
  ('sliding-window', 'Distinguish fixed-size from variable-size windows', 1),
  ('sliding-window', 'Prove the O(n) bound using the amortised entry/exit argument', 2),
  ('sliding-window', 'Identify when the monotonicity requirement fails (e.g. negative numbers)', 3),
  ('prefix-sums', 'Derive the range-sum formula and verify it on a single-element range', 1),
  ('prefix-sums', 'Use a hash map of prefix sums to count subarrays summing to k', 2),
  ('prefix-sums', 'Explain why min and max cannot use the prefix technique', 3),
  ('stack-fundamentals', 'State the four stack operations and their costs', 1),
  ('stack-fundamentals', 'Explain why push/pop act at the end of the backing array', 2),
  ('stack-fundamentals', 'Relate the call stack to recursion and stack overflow', 3),
  ('stack-applications', 'Implement bracket matching handling all three failure modes', 1),
  ('stack-applications', 'Evaluate a postfix expression with correct operand order', 2),
  ('stack-applications', 'Explain why a counter is insufficient for multiple bracket types', 3),
  ('monotonic-stack', 'Explain why a dominated element can be discarded permanently', 1),
  ('monotonic-stack', 'Prove the O(n) bound despite the nested while loop', 2),
  ('monotonic-stack', 'Choose scan direction and comparison for each of the four variants', 3),
  ('queue-fundamentals', 'Explain why list.pop(0) makes a queue quadratic', 1),
  ('queue-fundamentals', 'Implement a queue with two stacks and analyse the amortised cost', 2),
  ('queue-fundamentals', 'Contrast BFS with DFS in terms of the structure driving them', 3),
  ('circular-queue', 'Compute wrapped indices with modulo arithmetic', 1),
  ('circular-queue', 'Resolve the full-vs-empty ambiguity by at least two methods', 2),
  ('deque-and-monotonic-queue', 'Explain why the problem needs both ends of a deque', 1),
  ('deque-and-monotonic-queue', 'Implement sliding-window maximum in O(n)', 2),
  ('deque-and-monotonic-queue', 'Adapt the technique to sliding-window minimum', 3)
) AS v(concept_slug, objective, position)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'data-structures-fundamentals';

-- ---------------------------------------------------------------------------
-- 5. Misconception catalogue
--    This is what makes "you got it wrong" into "you believe X; actually Y".
--    The AI classifies a wrong answer against these codes rather than inventing
--    a diagnosis.
-- ---------------------------------------------------------------------------
INSERT INTO public.concept_misconceptions (concept_id, code, statement, correction, probe)
SELECT c.id, v.code, v.statement, v.correction, v.probe
FROM (VALUES
  ('array-fundamentals', 'index-is-search',
   'Finding a value in an array is O(1), the same as reading a[i].',
   'a[i] is O(1) because the address is computed arithmetically. Finding *where* a value lives requires inspecting elements: O(n) unsorted, O(log n) with binary search on sorted data.',
   'An unsorted array has 1,000,000 elements. How many must you inspect in the worst case to determine whether the value 42 is present?'),
  ('array-fundamentals', 'append-always-o1',
   'Appending to a dynamic array is always O(1).',
   'It is O(1) *amortised*. When capacity is exhausted the array reallocates and copies every element, so that individual append is O(n). Averaged over many appends it is constant.',
   'A dynamic array holds 8 items in a block of capacity 8. What happens, step by step, on the 9th append?'),
  ('array-fundamentals', 'array-list-same',
   'Arrays and linked lists have the same performance since both store n items.',
   'They differ where it matters: arrays give O(1) indexing and strong cache locality; linked lists give O(1) insertion at a known node but O(n) indexing and poor locality.',
   'You must read the 500th element. Which structure is faster, and by what factor in big-O terms?'),

  ('array-operations', 'delete-in-forward-loop',
   'You can delete elements while iterating forward with an index.',
   'Deleting index i shifts every later element left, so the next iteration skips one. Iterate backwards, build a new list, or use the read/write overwrite idiom.',
   'You run a forward loop deleting every 2 from [1,2,2,3]. What is the actual result, and why is one 2 left?'),
  ('array-operations', 'shift-direction',
   'When inserting at index i, shift elements left-to-right starting at i.',
   'That overwrites the value you are about to move. Shifting must go back to front: copy a[n-1] to a[n], then a[n-2] to a[n-1], and so on down to i.',
   'Insert 9 at index 1 of [3,1,4]. Write the array after each individual element move.'),
  ('array-operations', 'binary-search-unsorted',
   'Binary search works on any array.',
   'Binary search requires sorted input — it discards half the range based on an ordering assumption. On unsorted data it returns wrong answers without erroring.',
   'You binary-search for 1 in [3,1,4]. Trace the comparisons. What does it return, and is that correct?'),

  ('two-pointers', 'works-unsorted',
   'The converging two-pointer technique works on unsorted arrays.',
   'The pruning step ("sum too small, so move lo right") is only valid if larger values lie to the right. Without sortedness the discarded pairs may contain the answer.',
   'Run converging two-pointers for target 6 on [5,1,4,2]. Which valid pair does it miss, and at which step was it discarded?'),
  ('two-pointers', 'pointer-can-move-back',
   'A pointer may move backwards if the current step fails.',
   'Both pointers move monotonically; that is what bounds the loop at n steps. If backtracking is needed, the invariant is wrong and the technique does not apply.',
   'If lo were allowed to move back, what happens to the worst-case running time?'),

  ('sliding-window', 'nested-loop-quadratic',
   'A sliding window with an inner while loop is O(n^2).',
   'It is O(n). The left pointer only advances and can advance at most n times across the entire run, so total inner-loop work is bounded by n — not n per outer iteration.',
   'Across a full run on n elements, how many times in total can `left` be incremented?'),
  ('sliding-window', 'record-before-shrink',
   'For a longest-valid-window problem, record the answer as soon as the window grows.',
   'At that moment the window may be invalid. For "longest", record after shrinking restores validity; for "shortest", record inside the shrink loop.',
   'For longest-substring-without-repeats on "abba", what wrong answer do you get by recording before shrinking?'),
  ('sliding-window', 'works-with-negatives',
   'Sliding window solves "subarray sum at most k" even with negative numbers.',
   'Sliding window needs monotonicity: extending the window must not reduce the sum. Negative values break that, so the shrink condition becomes invalid. Use prefix sums with a hash map instead.',
   'Try the window approach on [2,-1,2] with k=2. Where does the shrink decision go wrong?'),

  ('prefix-sums', 'off-by-one-range',
   'The sum of a[l..r] is prefix[r] - prefix[l].',
   'With a leading zero, it is prefix[r+1] - prefix[l]. prefix[r] excludes a[r]. Verify with a single-element range: sum of a[2..2] must equal a[2].',
   'For a=[3,1,4], prefix=[0,3,4,8]. Compute the sum of a[1..2] with both formulas. Which matches 1+4=5?'),
  ('prefix-sums', 'min-max-prefix',
   'Prefix arrays work for min and max just like sums.',
   'The technique needs an invertible operation so the shared head can be cancelled by subtraction. Min and max cannot be undone. Range min/max needs a sparse table or segment tree.',
   'Given prefix_min=[inf,3,1,1] for [3,1,4], how would you recover the minimum of a[2..2]? Why is it impossible?'),

  ('stack-fundamentals', 'can-read-middle',
   'You can read the middle of a stack when needed.',
   'The stack ADT exposes only the top. A concrete array-backed implementation happens to allow it, but relying on that abandons the abstraction and the O(1) guarantees that come with it.',
   'If the middle were readable in O(1), which stack property would be lost, and which structure would you actually be describing?'),
  ('stack-fundamentals', 'push-at-front',
   'It does not matter which end of the backing array is used for push and pop.',
   'It matters entirely. Operating at the end is O(1) — nothing shifts. Operating at index 0 shifts every element on each call, making push and pop O(n).',
   'Implement push as insert-at-index-0. What is the cost of n pushes?'),

  ('stack-applications', 'counter-instead-of-stack',
   'A counter of open brackets is enough to validate brackets.',
   'A counter works for one bracket type only. With multiple types it accepts "([)]" because it tracks how many are open, not which. The stack records the type and order.',
   'Trace a counter on "([)]". What count does it end on, and why is the string still invalid?'),
  ('stack-applications', 'postfix-operand-order',
   'When evaluating postfix, the first value popped is the left operand.',
   'The first pop is the RIGHT operand — it was pushed most recently. Pop b first, then a, and compute a op b. The error is invisible for + and * and wrong for - and /.',
   'Evaluate "5 3 -" popping in the wrong order. What do you get instead of 2?'),

  ('monotonic-stack', 'inner-while-quadratic',
   'The while loop inside the for loop makes a monotonic stack O(n^2).',
   'Each index is pushed exactly once and popped at most once, so the while body executes at most n times in total across the whole outer loop: O(n).',
   'Across a full run on n elements, what is the maximum total number of pop operations?'),
  ('monotonic-stack', 'store-values',
   'Store values on the stack rather than indices.',
   'Storing indices lets you recover the value with a[i] and also compute distances and widths. Values alone lose position, which most monotonic-stack problems need.',
   'For "days until a warmer temperature", why is a value-only stack insufficient?'),

  ('queue-fundamentals', 'pop-zero-is-cheap',
   'list.pop(0) is a fine way to dequeue.',
   'pop(0) shifts every remaining element left: O(n) per dequeue, O(n^2) for n items. Use collections.deque, two stacks, or a circular buffer.',
   'Processing 100,000 queued items with pop(0), roughly how many element moves occur in total?'),
  ('queue-fundamentals', 'priority-queue-is-fifo',
   'A priority queue is a queue that serves in arrival order.',
   'A priority queue serves by rank, not arrival order, and is usually a heap with O(log n) operations. Despite the name it is not FIFO.',
   'Enqueue (task A, priority 5) then (task B, priority 1) into a min-priority queue. Which is served first?'),

  ('circular-queue', 'full-empty-ambiguity',
   'front == rear reliably means the circular queue is empty.',
   'It means empty OR full — the two are indistinguishable from the indices alone. Resolve it with an explicit size counter, by leaving one slot unused, or with a flag.',
   'A capacity-4 ring has 4 elements. What are front and rear? Now dequeue all four. What are they now?'),
  ('circular-queue', 'forgot-modulo',
   'Incrementing rear is enough; the wraparound happens automatically.',
   'Nothing wraps on its own. Without % capacity the index runs past the end of the array and raises IndexError or corrupts memory.',
   'capacity is 5 and rear is 4. What is rear after one more enqueue, with and without the modulo?'),

  ('deque-and-monotonic-queue', 'stack-suffices',
   'Sliding-window maximum can be solved with a monotonic stack instead of a deque.',
   'A stack cannot remove the expired front element. Expiry happens at the front (by index age) and domination at the rear (by value) — two ends, so a deque is required.',
   'Which specific removal in the sliding-window-maximum loop is impossible with a stack?'),
  ('deque-and-monotonic-queue', 'store-values-deque',
   'Store the values in the deque, since you only need the maximum.',
   'Indices are needed to detect expiry — you must know whether the front has aged out of the window. A value alone carries no position.',
   'The deque front holds the value 9. How do you decide whether it is still inside the current window?')
) AS v(concept_slug, code, statement, correction, probe)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'data-structures-fundamentals'
ON CONFLICT (concept_id, code) DO UPDATE
  SET statement = EXCLUDED.statement,
      correction = EXCLUDED.correction,
      probe = EXCLUDED.probe;

-- ---------------------------------------------------------------------------
-- 6. Achievement definitions
--    Every metric here is computed from measured activity by
--    evaluate_achievements(). None can be granted by the client.
-- ---------------------------------------------------------------------------
INSERT INTO public.achievements (code, title, description, icon, metric, threshold, points, position)
VALUES
  ('first-concept',     'First Steps',        'Master your first concept.',                                  'sparkles',    'concepts_mastered', 1,   10, 1),
  ('five-concepts',     'Building Momentum',  'Master five concepts.',                                       'layers',      'concepts_mastered', 5,   25, 2),
  ('course-complete',   'Course Complete',    'Master every concept in Data Structures Fundamentals.',        'graduation-cap','concepts_mastered', 11, 100, 3),
  ('first-solve',       'First Solve',        'Solve your first coding problem.',                            'code',        'problems_solved',   1,   10, 4),
  ('five-solves',       'Problem Solver',     'Solve five coding problems.',                                 'terminal',    'problems_solved',   5,   30, 5),
  ('unaided-three',     'No Hints Needed',    'Solve three problems without using a single hint.',           'target',      'problems_debugged', 3,   40, 6),
  ('comeback',          'Comeback',           'Resolve a misconception and go on to master that concept.',   'refresh-cw',  'concepts_recovered',1,   30, 7),
  ('streak-three',      'Three in a Row',     'Study on three consecutive days.',                            'flame',       'streak_days',       3,   15, 8),
  ('streak-seven',      'Week Strong',        'Study on seven consecutive days.',                            'flame',       'streak_days',       7,   35, 9),
  ('streak-thirty',     'Unbroken',           'Study on thirty consecutive days.',                           'flame',       'streak_days',       30, 120, 10),
  ('quiz-five',         'Quiz Ace',           'Pass five quizzes with 70% or higher.',                       'award',       'quizzes_passed',    5,   25, 11),
  ('deep-work',         'Deep Work',          'Accumulate five hours of measured study time.',               'clock',       'study_minutes',     300, 50, 12)
ON CONFLICT (code) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      metric = EXCLUDED.metric,
      threshold = EXCLUDED.threshold,
      points = EXCLUDED.points,
      position = EXCLUDED.position;

-- ---------------------------------------------------------------------------
-- 7. Coding problems
--    test_cases store `args` (the argument list) and `expected`. Hidden cases
--    are withheld from the student until after submission.
-- ---------------------------------------------------------------------------
INSERT INTO public.coding_problems (concept_id, slug, title, prompt, difficulty, starter_code, test_cases, expected_complexity, hints, status)
SELECT c.id, v.slug, v.title, v.prompt, v.difficulty,
       v.starter_code::jsonb, v.test_cases::jsonb, v.complexity, v.hints::jsonb,
       'published'::public.content_status
FROM (VALUES

('array-operations', 'remove-value-in-place', 'Remove All Occurrences In Place',
 E'Given an array `nums` and a value `val`, remove every occurrence of `val` **in place** and return the number of elements remaining. The first k elements of `nums` must hold the survivors, in their original relative order. Elements beyond k do not matter.\n\nUse O(1) extra space — no new array.',
 2,
 '{"python":"def remove_value(nums, val):\n    # return k; nums[:k] holds the survivors\n    pass\n","javascript":"function removeValue(nums, val) {\n  // return k; nums.slice(0, k) holds the survivors\n}\n"}',
 '[{"args":[[3,2,2,3],3],"expected":2,"hidden":false},{"args":[[0,1,2,2,3,0,4,2],2],"expected":5,"hidden":false},{"args":[[],1],"expected":0,"hidden":true},{"args":[[1,1,1],1],"expected":0,"hidden":true},{"args":[[4,5],9],"expected":2,"hidden":true}]',
 'O(n) time, O(1) space',
 '["You do not need to delete anything. Think about writing the survivors forward over the top of the array.","Keep two indices: `read` scans every element, `write` marks where the next survivor belongs.","When nums[read] != val, copy it to nums[write] and advance write. Return write."]',
 'published'),

('two-pointers', 'two-sum-sorted', 'Two Sum on a Sorted Array',
 E'Given a **sorted** array `numbers` and a `target`, return the 0-based indices `[i, j]` with `i < j` such that `numbers[i] + numbers[j] == target`. Exactly one solution exists. Return `null` if there is none.\n\nSolve it in O(n) time and O(1) space — a hash map is O(n) space and does not count here.',
 3,
 '{"python":"def two_sum_sorted(numbers, target):\n    pass\n","javascript":"function twoSumSorted(numbers, target) {\n}\n"}',
 '[{"args":[[2,7,11,15],9],"expected":[0,1],"hidden":false},{"args":[[2,3,4],6],"expected":[0,2],"hidden":false},{"args":[[-3,-1,0,2,5],2],"expected":[1,3],"hidden":true},{"args":[[1,2],7],"expected":null,"hidden":true},{"args":[[0,0,3,4],0],"expected":[0,1],"hidden":true}]',
 'O(n) time, O(1) space',
 '["Start one pointer at each end. What does the sum tell you about which pointer to move?","If the sum is too small, the only way to increase it is to move the left pointer right — the right pointer is already at the largest value.","Each step eliminates one index permanently, so the loop runs at most n times. Stop when lo >= hi."]',
 'published'),

('prefix-sums', 'subarray-sum-equals-k', 'Count Subarrays Summing to K',
 E'Given an integer array `nums` (which may contain negative numbers) and an integer `k`, return the number of **contiguous** subarrays whose sum equals `k`.\n\nO(n²) will time out on the hidden cases. Aim for O(n).',
 4,
 '{"python":"def subarray_sum(nums, k):\n    pass\n","javascript":"function subarraySum(nums, k) {\n}\n"}',
 '[{"args":[[1,1,1],2],"expected":2,"hidden":false},{"args":[[1,2,3],3],"expected":2,"hidden":false},{"args":[[1,-1,0],0],"expected":3,"hidden":true},{"args":[[3,4,7,2,-3,1,4,2],7],"expected":4,"hidden":true},{"args":[[1],0],"expected":0,"hidden":true}]',
 'O(n) time, O(n) space',
 '["A subarray sum is a difference of two prefix sums: sum(i..j) = prefix[j+1] - prefix[i].","So you need prefix[j+1] - prefix[i] == k, i.e. prefix[i] == prefix[j+1] - k. Count how many earlier prefixes had that value.","Use a hash map from prefix value to count, and seed it with {0: 1} so subarrays starting at index 0 are counted."]',
 'published'),

('stack-applications', 'valid-parentheses', 'Valid Parentheses',
 E'Given a string `s` containing only the characters `()[]{}`, decide whether it is valid.\n\nA string is valid when every opening bracket is closed by the **same type** in the **correct order**, and nothing is left open at the end.',
 3,
 '{"python":"def is_valid(s):\n    pass\n","javascript":"function isValid(s) {\n}\n"}',
 '[{"args":["()"],"expected":true,"hidden":false},{"args":["()[]{}"],"expected":true,"hidden":false},{"args":["(]"],"expected":false,"hidden":false},{"args":["([)]"],"expected":false,"hidden":true},{"args":["(("],"expected":false,"hidden":true},{"args":[""],"expected":true,"hidden":true},{"args":["]"],"expected":false,"hidden":true}]',
 'O(n) time, O(n) space',
 '["A counter is not enough — it accepts \"([)]\". You must remember which bracket was opened, and in what order.","Push every opening bracket. On a closing bracket, the top of the stack must be its matching opener.","Three ways to fail: wrong type on top, closing with an empty stack, and a non-empty stack at the end. Check all three."]',
 'published'),

('monotonic-stack', 'next-greater-element', 'Next Greater Element',
 E'Given an array `nums`, return an array `res` where `res[i]` is the first element to the right of `i` that is strictly greater than `nums[i]`, or `-1` if no such element exists.\n\nO(n²) is rejected by the hidden cases. Aim for O(n).',
 4,
 '{"python":"def next_greater(nums):\n    pass\n","javascript":"function nextGreater(nums) {\n}\n"}',
 '[{"args":[[2,1,2,4,3]],"expected":[4,2,4,-1,-1],"hidden":false},{"args":[[1,2,3]],"expected":[2,3,-1],"hidden":false},{"args":[[3,2,1]],"expected":[-1,-1,-1],"hidden":true},{"args":[[]],"expected":[],"hidden":true},{"args":[[5,5,5]],"expected":[-1,-1,-1],"hidden":true}]',
 'O(n) time, O(n) space',
 '["If a bigger element appears later, every earlier smaller element can be answered and then discarded forever.","Keep a stack of indices whose answers are still unknown. Its values stay in decreasing order.","For each new value, pop every index whose value is smaller and record the new value as its answer. Then push the current index. Note [5,5,5] expects -1 — the comparison is strict."]',
 'published'),

('deque-and-monotonic-queue', 'sliding-window-maximum', 'Sliding Window Maximum',
 E'Given an array `nums` and a window size `k`, return an array containing the maximum of each contiguous window of size `k`, left to right.\n\nO(n·k) times out. Aim for O(n) using a double-ended queue.',
 5,
 '{"python":"from collections import deque\n\ndef max_sliding_window(nums, k):\n    pass\n","javascript":"function maxSlidingWindow(nums, k) {\n}\n"}',
 '[{"args":[[1,3,-1,-3,5,3,6,7],3],"expected":[3,3,5,5,6,7],"hidden":false},{"args":[[1],1],"expected":[1],"hidden":false},{"args":[[9,8,7,6],2],"expected":[9,8,7],"hidden":true},{"args":[[1,2,3,4],4],"expected":[4],"hidden":true},{"args":[[-7,-8,-9],1],"expected":[-7,-8,-9],"hidden":true}]',
 'O(n) time, O(k) space',
 '["Two reasons to discard a candidate: its index has aged out of the window, or a larger value arrived after it.","Those two removals happen at opposite ends — expiry at the front, domination at the rear. That is why you need a deque and not a stack.","Store indices, not values, so you can test expiry with dq[0] <= i - k. The front is always the current maximum."]',
 'published')

) AS v(concept_slug, slug, title, prompt, difficulty, starter_code, test_cases, complexity, hints, status)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'data-structures-fundamentals'
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      prompt = EXCLUDED.prompt,
      difficulty = EXCLUDED.difficulty,
      starter_code = EXCLUDED.starter_code,
      test_cases = EXCLUDED.test_cases,
      expected_complexity = EXCLUDED.expected_complexity,
      hints = EXCLUDED.hints,
      status = EXCLUDED.status;
