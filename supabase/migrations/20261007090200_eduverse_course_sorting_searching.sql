-- ============================================================================
-- EduVerse — Course 4: Sorting & Searching (CS204)
-- ----------------------------------------------------------------------------
-- Closes the Sorting (6 visualisations) and Searching (2) groups of the visual
-- lab, neither of which had a lesson before this file.
--
-- The argument the course makes: every comparison sort is bounded below by
-- O(n log n), the three O(n log n) sorts differ only in which resource they
-- spend, and the sorts that beat the bound do so by not comparing at all.
-- Searching is then the payoff — sorted data is what makes O(log n) lookup
-- possible, and the hard part is not the algorithm but its boundaries.
--
-- Conventions as in 20260916090300 / 20261007090000 / 20261007090100: no
-- invented `diagram:` keys, callouts parsed by Markdown.tsx, every slug lookup
-- scoped through chapters to a named course, every statement idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Course
-- ---------------------------------------------------------------------------
INSERT INTO public.courses (slug, code, title, description, subject, status, position)
VALUES (
  'sorting-and-searching',
  'CS204',
  'Sorting & Searching',
  'Why no comparison sort can beat O(n log n), how the three that reach it differ in what they spend, how counting and radix sort get under the bound by not comparing, and why binary search is harder to write correctly than it looks.',
  'Computer Science',
  'published',
  4
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
  ('sorting', 'Sorting',
   'From the quadratic sorts worth understanding to the O(n log n) sorts worth using — and the two that break the comparison bound by counting instead.', 1),
  ('searching', 'Searching',
   'Halving the search space, and the boundary conditions that make binary search famously easy to get subtly wrong.', 2)
) AS v(slug, title, description, position)
WHERE c.slug = 'sorting-and-searching'
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
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'sorting-and-searching'
JOIN (VALUES

-- === Chapter 1: Sorting ===================================================
('sorting', 'bubble-sort', 'Bubble Sort & the Comparison Bound',
 'The sort nobody should use, and the one worth tracing once — because it is where the O(n log n) lower bound becomes obvious.',
 $md$## The algorithm

Repeatedly walk the array, swapping any two adjacent elements that are out of order. Each pass carries the largest remaining element to its final position at the back, the way a bubble rises.

```python
def bubble_sort(a):
    n = len(a)
    for end in range(n - 1, 0, -1):          # shrinking unsorted region
        swapped = False
        for i in range(end):
            if a[i] > a[i + 1]:
                a[i], a[i + 1] = a[i + 1], a[i]
                swapped = True
        if not swapped:
            return                            # already sorted: stop early
```

:::example
`[3, 1, 2]`

Pass 1: compare 3 and 1 → swap → `[1, 3, 2]`. Compare 3 and 2 → swap → `[1, 2, 3]`. The largest element, 3, is now final.

Pass 2: compare 1 and 2 → in order. No swap occurred, so the array is sorted and the function returns.
:::

## Cost

| Case | Comparisons | Swaps | Total |
|---|---|---|---|
| Already sorted | n − 1 | 0 | **O(n)** |
| Reverse sorted | n(n−1)/2 | n(n−1)/2 | **O(n²)** |
| Average | ~n²/2 | ~n²/4 | O(n²) |

The `swapped` flag is what gives the O(n) best case. Without it, bubble sort does its full quadratic work even on already-sorted input.

It is **stable** — only adjacent elements are swapped, and only on a strict `>`, so equal elements never cross — and **in place**, O(1) extra space.

## Why it is a bad sort

Every swap moves an element exactly one position. If an element must travel k places, it takes k swaps. The total number of swaps therefore equals the number of **inversions** — pairs that are out of order relative to each other — and a random array has about n²/4 of them.

:::key
That observation is the whole lesson, because it generalises: **any sort that only swaps adjacent elements is Ω(n²).** Reverse-sorted input has n(n−1)/2 inversions and each adjacent swap removes exactly one.

So beating O(n²) requires moving elements *further than one place at a time*. Merge sort moves an element across half the array in one step; quicksort's partition can throw an element from one end to the other. That is not an optimisation of bubble sort — it is the only possible escape route.
:::

## The comparison lower bound

There is a second, deeper limit. A comparison sort learns about the input only by asking "is x < y", and each answer is one bit. With n elements there are n! possible orderings, and the algorithm must distinguish all of them, so it needs at least log₂(n!) answers:

```
log₂(n!) ≈ n log₂ n − 1.44n = Ω(n log n)
```

**No algorithm that sorts by comparing pairs can do better than O(n log n).** Merge sort and heapsort attain it, so they are asymptotically optimal and no cleverer comparison sort is waiting to be found.

Two lessons later, counting sort runs in O(n + k). It does not break this bound — it sidesteps it by never comparing two elements at all.

## When quadratic is the right answer

Bubble sort is genuinely the wrong choice essentially always; insertion sort dominates it on every input while being just as simple. But quadratic sorts in general are not useless:

- for **n below roughly 10–20**, their tiny constant beats merge sort's allocation and recursion, which is why real library sorts switch to insertion sort for small subarrays
- for **nearly sorted** data, insertion sort is O(n + inversions), effectively linear

Bubble sort's honest role is pedagogical: it makes the inversion argument visible, and that argument is why the next three lessons look the way they do.$md$,
 1, 22, 'bubble-sort', 1),

('sorting', 'insertion-sort', 'Insertion Sort',
 'Build the sorted region one element at a time. Adaptive, stable, and the sort real libraries fall back to for small inputs.',
 $md$## The algorithm

Treat the front of the array as a sorted region that grows by one each step. Take the next element and slide it left past everything larger, into its place — the way you sort a hand of cards.

```python
def insertion_sort(a):
    for i in range(1, len(a)):
        key = a[i]
        j = i - 1
        while j >= 0 and a[j] > key:
            a[j + 1] = a[j]        # shift right; do not swap
            j -= 1
        a[j + 1] = key             # drop the key into the gap
```

Note it **shifts** rather than swapping. A swap is three assignments; a shift is one. Since the key is held in a variable the whole time, the slot it vacated can be overwritten freely, and only one write per shifted element is needed.

:::example
`[5, 2, 4]`

- i=1, key=2. `a[0]`=5 > 2, shift 5 right → `[5, 5, 4]`, then place 2 → `[2, 5, 4]`
- i=2, key=4. `a[1]`=5 > 4, shift → `[2, 5, 5]`. `a[0]`=2 ≤ 4, stop. Place 4 → `[2, 4, 5]`

The duplicated value mid-trace is the vacated slot, not a lost element — `key` is holding the real one.
:::

## Cost: the adaptive sort

| Case | Cost |
|---|---|
| Already sorted | **O(n)** — the inner `while` never runs |
| Reverse sorted | O(n²) — each key slides the whole way |
| Nearly sorted | **O(n + inversions)** |

That last line is the important one. Insertion sort's work is proportional to the number of inversions, so on data that is *almost* in order it is effectively linear. No O(n log n) sort has that property — merge sort does its full n log n work on already-sorted input.

It is **stable** (the condition is `a[j] > key`, so equal elements never shift past each other) and **in place**, O(1) space.

:::pitfall
The guard must be `a[j] > key`, not `>=`. With `>=`, equal elements shift past one another and stability is lost — invisible on integers, and a real bug when sorting records by a secondary field.

The `j >= 0` test must also come first. In a language without short-circuit evaluation, testing `a[j] > key` when `j` is −1 reads out of bounds.
:::

## Why libraries still use it

Insertion sort beats merge sort and quicksort on small inputs, because asymptotics hide constants: no recursion, no allocation, no pivot selection, and a tight inner loop over consecutive memory.

So production sorts are hybrids. **Timsort** — Python's `sorted`, Java's `Arrays.sort` for objects — scans for runs already in order, extends short ones with **binary insertion sort**, and merges the runs. On nearly sorted real-world data it reaches O(n). **Introsort** — C++ `std::sort` — runs quicksort, switches to heapsort when recursion gets deep, and finishes with insertion sort on the small leftovers.

:::key
Every one of those hybrids uses insertion sort for the small-and-nearly-sorted case, because that is the case it is genuinely best at. "Never use a quadratic sort" is wrong advice; the correct version is "never use one on large unsorted input".
:::

## Selection sort, for contrast

The other classic quadratic sort finds the minimum of the unsorted region and swaps it into place:

| | Insertion | Selection |
|---|---|---|
| Best case | **O(n)** | O(n²) always |
| Writes | O(n²) | **O(n)** — one swap per position |
| Stable | **yes** | no |
| Adaptive | **yes** | no |

Selection sort always scans the full remaining region, so it cannot detect sorted input. Its one virtue is the minimal number of **writes** — n−1 swaps regardless of input — which matters on media where writing is far more expensive than reading, such as EEPROM.$md$,
 2, 24, 'insertion-sort', 2),

('sorting', 'merge-sort', 'Merge Sort',
 'Split, sort each half, merge. Guaranteed O(n log n) and stable — and the O(n) buffer is the price.',
 $md$## Divide and conquer

Three steps, and the third one does all the work:

1. split the array in half
2. sort each half recursively
3. **merge** the two sorted halves

```python
def merge_sort(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    left  = merge_sort(a[:mid])
    right = merge_sort(a[mid:])
    return merge(left, right)

def merge(x, y):
    out, i, j = [], 0, 0
    while i < len(x) and j < len(y):
        if x[i] <= y[j]:               # <= keeps it stable
            out.append(x[i]); i += 1
        else:
            out.append(y[j]); j += 1
    out.extend(x[i:])                  # one of these is empty
    out.extend(y[j:])
    return out
```

The merge is the two-pointer walk from CS202's "Merging Sorted Lists" — same algorithm, same `<=` for stability, same "attach the remainder in one step" ending.

## Why it is O(n log n), reliably

Halving stops after **log₂ n** levels. Each level merges every element exactly once, so each level is **O(n)**. Multiply:

```
levels × work per level = log n × n = O(n log n)
```

:::key
The bound is **guaranteed**, not average. The split is positional — the midpoint — so it does not depend on the data at all. There is no input that makes merge sort slow, which is the property quicksort lacks and the reason merge sort is chosen when worst-case latency matters.
:::

:::example
`[3, 1, 4, 2]`

```
        [3,1,4,2]
        /        \
    [3,1]        [4,2]
    /   \        /   \
  [3]   [1]    [4]   [2]
    \   /        \   /
    [1,3]        [2,4]
        \        /
        [1,2,3,4]
```

Two levels of splitting, two of merging. The final merge walks `[1,3]` and `[2,4]`: take 1, take 2, take 3, then `[4]` remains and is attached whole.
:::

## The cost: memory

The merge cannot be done in place without destroying elements it has not read yet, so it writes into a new array: **O(n) extra space**.

| Sort | Time | Space | Stable |
|---|---|---|---|
| Merge sort | O(n log n) **guaranteed** | **O(n)** | **yes** |
| Quicksort | O(n log n) avg, O(n²) worst | O(log n) | no |
| Heapsort | O(n log n) guaranteed | **O(1)** | no |

Merge sort is the only one of the three that is stable, and the only one needing linear extra memory. Those two facts are connected: stability requires preserving the relative order of equals during the merge, and doing that in place is what makes in-place merging so difficult.

:::pitfall
The recursion `merge_sort(a[:mid])` slices, and a slice is a copy. The version above therefore allocates at every level, making its real space use worse than O(n). Production implementations pass `(array, lo, hi)` indices and reuse **one** scratch buffer allocated once at the top.
:::

## Where it is the only choice

**Linked lists.** Quicksort needs random access to partition; a list charges O(n) per index. Merge sort needs only sequential access, and merging two lists is pure pointer rewriting — **O(1) extra space**, unlike the array case. Linked-list merge sort is O(n log n) time and O(log n) stack, with no data buffer at all, which is why it is the standard list sort.

**External sorting.** When the data does not fit in memory, merge sort is the algorithm: sort chunks that do fit, write them out as sorted runs, then merge the runs with a k-way merge reading a block from each. Quicksort cannot do this, because partitioning needs the whole array addressable.

**Stability requirements.** Sorting by one field and needing ties to keep their previous order — the standard "sort by date, then stably by author" pattern — requires a stable sort.

## Counting inversions, almost free

Instrument the merge: whenever an element is taken from the right half, every remaining element of the left half is greater than it and sits before it, so that is `len(x) - i` inversions at once.

```python
if x[i] <= y[j]:
    out.append(x[i]); i += 1
else:
    out.append(y[j]); j += 1
    inversions += len(x) - i          # the whole remaining left half
```

Counting inversions by brute force is O(n²). Merge sort gives it in **O(n log n)** as a side effect of sorting — the standard answer to "how far from sorted is this data", and a good illustration that divide and conquer computes more than it was asked for.$md$,
 3, 28, 'merge-sort', 3),

('sorting', 'quick-sort', 'Quicksort & Partitioning',
 'Partition around a pivot, recurse on both sides. Fastest in practice, O(n²) if you pick pivots badly — and sorted input is the trap.',
 $md$## The algorithm

Where merge sort splits positionally and works on the way back up, quicksort does the work on the way **down**:

1. choose a **pivot**
2. **partition** — rearrange so everything ≤ pivot is left of it and everything ≥ is right
3. recurse on each side

After partitioning, the pivot is already in its final position, and the two sides never need to be combined. There is no merge step and no buffer.

## Lomuto partition

```python
def partition(a, lo, hi):
    pivot = a[hi]                  # last element as pivot
    i = lo                         # boundary of the "<= pivot" region
    for j in range(lo, hi):
        if a[j] <= pivot:
            a[i], a[j] = a[j], a[i]
            i += 1
    a[i], a[hi] = a[hi], a[i]      # put the pivot at the boundary
    return i                       # its final index

def quicksort(a, lo, hi):
    if lo < hi:
        p = partition(a, lo, hi)
        quicksort(a, lo, p - 1)    # exclude the pivot: it is final
        quicksort(a, p + 1, hi)
```

The invariant: everything before `i` is ≤ pivot, everything from `i` to `j` is > pivot. One pass, O(n), in place.

:::example
`[3, 7, 1, 9, 2]`, pivot = 2 (last).

| j | a[j] | ≤ 2? | array | i |
|---|---|---|---|---|
| 0 | 3 | no | `[3,7,1,9,2]` | 0 |
| 1 | 7 | no | `[3,7,1,9,2]` | 0 |
| 2 | 1 | yes → swap a[0],a[2] | `[1,7,3,9,2]` | 1 |
| 3 | 9 | no | `[1,7,3,9,2]` | 1 |

Finally swap the pivot into index 1: `[1,2,3,9,7]`. The pivot 2 is final; recurse on `[1]` and `[9,7]`.
:::

## Cost, and the trap

| Pivot quality | Recursion depth | Total |
|---|---|---|
| Median every time | log n | **O(n log n)** |
| Random | O(log n) expected | O(n log n) expected |
| **Always the extreme** | **n** | **O(n²)** |

A pivot that is the smallest or largest element splits n into 0 and n−1, so the depth becomes n and the total becomes n²/2.

:::pitfall
Taking the **last element** as pivot makes **already-sorted input** the worst case. The last element of a sorted array is its maximum, so every partition is maximally unbalanced: O(n²), plus a recursion depth of n that overflows the call stack.

Sorted input is extremely common — and this is the same hazard that degenerated the BST in CS203. Naive quicksort on sorted data is the classic way to turn the fastest sort into the slowest.
:::

## Fixing pivot selection

- **Randomised pivot** — swap a random element to the end first. No *input* is the worst case any more; only unlucky random draws are, and the probability is negligible.
- **Median of three** — take the median of first, middle and last. Cheap, and it makes sorted and reverse-sorted input best cases rather than worst.
- **Introsort** — count recursion depth, and if it exceeds ~2 log n, finish with heapsort. This caps the worst case at O(n log n) while keeping quicksort's speed. It is what `std::sort` does.

## Duplicates and three-way partitioning

Lomuto handles many equal keys badly: with all elements equal, every comparison `a[j] <= pivot` is true, so the split is maximally unbalanced and the sort is O(n²) on an array of identical values.

**Three-way partitioning** (the Dutch national flag problem) splits into `< pivot`, `= pivot`, `> pivot` and recurses only on the outer two. An array of n equal elements then sorts in O(n). This is what makes real quicksorts robust against duplicate-heavy data.

## Why it wins in practice

| | Quicksort | Merge sort |
|---|---|---|
| Extra space | **O(log n)** stack | O(n) buffer |
| Memory access | **sequential scan** | sequential, plus buffer traffic |
| Constant factor | **smaller** | larger |
| Guarantee | none without introsort | O(n log n) always |
| Stable | no | **yes** |

Partitioning is a single forward scan with swaps — extremely cache-friendly, no allocation. Merge sort reads and writes a separate buffer at every level. Equal asymptotics, and quicksort typically wins by a factor of two or more on arrays.

:::key
The choice is not about speed, it is about what you can tolerate.

- **arrays, average case fine** → quicksort (randomised or introsort)
- **worst-case guarantee needed**, or **stability needed** → merge sort
- **linked list** → merge sort; quicksort needs random access
- **constant space and a guarantee** → heapsort

This is why no language ships one sort. Python and Java use Timsort for objects because stability is part of the contract; C++ `std::sort` uses introsort because it is not.
:::$md$,
 4, 30, 'quick-sort', 4),

('sorting', 'counting-sort', 'Counting Sort',
 'Do not compare — count. Linear time, by using the values themselves as array indices.',
 $md$## Getting under the bound

The previous lessons established that no comparison sort beats O(n log n). Counting sort runs in O(n + k) and does not contradict that, because **it never compares two elements.** It uses each value as an index, which is extra information the comparison model does not have.

## The algorithm

For integer keys in a known range `0 … k−1`:

```python
def counting_sort(a, k):
    count = [0] * k
    for v in a:
        count[v] += 1                      # 1. how many of each value

    for i in range(1, k):
        count[i] += count[i - 1]           # 2. prefix sums -> end positions

    out = [0] * len(a)
    for v in reversed(a):                  # 3. place, right to left
        count[v] -= 1
        out[count[v]] = v
    return out
```

Three passes, no comparisons.

:::example
`a = [2, 0, 2, 1]`, k = 3.

**Count:** `[1, 1, 2]` — one 0, one 1, two 2s.

**Prefix sums:** `[1, 2, 4]` — so values `< 1` occupy up to index 0, values `< 2` up to index 1, and so on. `count[v]` is now one past the last slot for `v`.

**Place**, walking the input backwards:

| v | count[v]−1 | out |
|---|---|---|
| 1 | 1 | `[_, 1, _, _]` |
| 2 | 3 | `[_, 1, _, 2]` |
| 0 | 0 | `[0, 1, _, 2]` |
| 2 | 2 | `[0, 1, 2, 2]` |
:::

## Why the last pass runs backwards

This is the detail that matters, and it is the reason the prefix-sum step exists at all.

:::key
Walking the input **backwards** while filling positions from the end of each value's block makes counting sort **stable** — equal elements keep their input order. Walk forwards and equal elements come out reversed.

Stability is not a nicety here. Radix sort, the next lesson, is built from repeated counting sorts on one digit at a time, and it is **only correct because each pass is stable**. Reverse this loop and radix sort silently returns wrong answers.
:::

## Cost

| | |
|---|---|
| Time | **O(n + k)** |
| Space | O(n + k) |
| Stable | yes (as written) |
| Comparisons | **zero** |

When k is O(n) this is **linear** — strictly better than any comparison sort. The catch is in the other direction: k is the size of the *value range*, not the input. Sorting four 32-bit integers allocates a counting array of four billion entries.

| Input | k | Verdict |
|---|---|---|
| 10⁶ exam scores, 0–100 | 101 | **ideal** |
| 10⁶ ages, 0–120 | 121 | **ideal** |
| 10³ arbitrary 32-bit ints | 2³² | **unusable** — use radix or a comparison sort |
| Floats, or strings | unbounded | not applicable |

:::pitfall
Counting sort requires keys that are small non-negative integers, or that map onto them. Negative values need an offset — index by `v - min_value` and size the array `max - min + 1`. Forgetting the offset indexes out of bounds, or silently wraps in languages that do not check.

It also cannot sort by a comparison function. There is no way to express "sort these records by a custom key ordering" without a mapping onto integers, which is why library sorts are comparison sorts even though counting sort is faster when it applies.
:::

## Sorting records, not just numbers

The three-pass version with prefix sums exists so that you can carry a **payload**. Sorting objects by a small integer key — priority, grade, bucket id — places whole records:

```python
for record in reversed(records):
    v = record.key
    count[v] -= 1
    out[count[v]] = record
```

A naive "count then write v that many times" version cannot do this: it reconstructs values from counts and throws the records away. That is why the prefix-sum step is not an optimisation but a requirement for anything other than bare integers.

Counting sort is also the bucket-distribution step inside radix sort, which is how it reaches arbitrary integer ranges — the subject of the next lesson.$md$,
 3, 24, 'counting-sort', 5),

('sorting', 'radix-sort', 'Radix Sort',
 'Counting sort applied one digit at a time, least significant first. Linear in the number of digits, and it only works because each pass is stable.',
 $md$## The problem with counting sort

Counting sort is O(n + k), which is unusable when the value range k is large — 2³² for a 32-bit integer. Radix sort fixes this by never looking at a whole value at once. It sorts by one **digit** at a time, so k becomes the size of a single digit's alphabet: 10 for decimal, 256 for a byte.

## LSD radix sort

Sort by the least significant digit first, then the next, up to the most significant. Each pass is a **stable** counting sort on that digit alone.

```python
def radix_sort(a):
    if not a: return a
    exp = 1
    while max(a) // exp > 0:
        a = counting_sort_by_digit(a, exp)    # stable, 10 buckets
        exp *= 10
    return a

def counting_sort_by_digit(a, exp):
    count = [0] * 10
    for v in a:
        count[(v // exp) % 10] += 1
    for i in range(1, 10):
        count[i] += count[i - 1]
    out = [0] * len(a)
    for v in reversed(a):                     # backwards => stable
        d = (v // exp) % 10
        count[d] -= 1
        out[count[d]] = v
    return out
```

:::example
`[170, 45, 75, 90, 802, 2, 66]`

| Pass | Digit | Result |
|---|---|---|
| 1 | ones | `[170, 90, 802, 2, 45, 75, 66]` |
| 2 | tens | `[802, 2, 45, 66, 170, 75, 90]` |
| 3 | hundreds | `[2, 45, 66, 75, 90, 170, 802]` |

Watch `802` and `2` after pass 2: both have tens digit 0, and they stay in the order pass 1 left them. That is stability doing the work.
:::

## Why stability is load-bearing

:::key
After sorting by the ones digit, the array is correctly ordered **by that digit**. The tens pass must not disturb that ordering among elements whose tens digits are equal — and "do not disturb the existing order of equal keys" is exactly the definition of a stable sort.

So each pass preserves all the work of every earlier pass, and after the final digit the array is fully sorted. Use an unstable sort for any pass and radix sort returns wrong answers with no error — which is why the backwards loop in counting sort is not a stylistic choice.
:::

## Cost

With d digits and radix b:

```
O(d · (n + b))
```

For fixed-width integers d and b are constants, so this is **O(n)** — genuinely linear, and it beats O(n log n) because, like counting sort, it never compares two elements.

| | Radix | Counting | Quicksort |
|---|---|---|---|
| Time | O(d(n + b)) | O(n + k) | O(n log n) avg |
| Space | O(n + b) | O(n + k) | O(log n) |
| Large value range | **fine** | unusable | fine |
| Comparison function | no | no | **yes** |
| Stable | yes | yes | no |

Choosing the radix is a trade: b = 256 means one pass per byte — four passes for a 32-bit integer — with 256 buckets. Larger b means fewer passes and more memory.

## MSD, and strings

Sorting from the **most** significant digit instead partitions into buckets and recurses within each. For strings this is the better order, because it can stop as soon as a bucket holds one item — so it does not read the rest of long keys that are already distinguished. MSD radix sort on strings is how `sort` handles large text files.

LSD on variable-length strings needs padding: shorter keys are treated as if padded on the right, or the comparison is wrong.

:::pitfall
Radix sort needs keys decomposable into digits with the property that comparing digit sequences lexicographically matches comparing the values. That fails for:

- **negative integers** — sign-magnitude ordering is not lexicographic; split by sign, sort the negatives by absolute value, and reverse them
- **IEEE floats** — the bit pattern does not order like the value for negatives; a known bit-flip transform fixes it
- anything ordered by a **custom comparator** — there is no digit decomposition at all

This is the real reason library sorts are comparison sorts. `std::sort` cannot assume the keys are integers; your code often can, and when it can, radix sort is several times faster.
:::

## Where it is used

Integer and fixed-width key sorting in databases and column stores, GPU sorting (radix sort parallelises well because bucket counting is a prefix-sum reduction, and comparison sorts branch unpredictably), and suffix-array construction, where repeated stable radix passes on rank pairs are the standard O(n log n) build.$md$,
 4, 26, 'radix-sort', 6),

-- === Chapter 2: Searching =================================================
('searching', 'binary-search', 'Binary Search',
 'Halve the range each step. Simple to state, famously easy to write wrong — and the bugs are in the boundaries, not the idea.',
 $md$## The idea

In a **sorted** array, compare the target with the middle element. If the target is smaller, everything from the middle rightward is irrelevant; if larger, everything leftward is. Each comparison discards half the remaining range.

```python
def binary_search(a, target):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if a[mid] == target:
            return mid
        if a[mid] < target:
            lo = mid + 1           # discard the left half AND mid
        else:
            hi = mid - 1           # discard the right half AND mid
    return -1
```

**O(log n)** — the range halves each iteration, so at most ⌈log₂ n⌉ comparisons. A million elements take 20; a billion take 30.

## Sortedness is the precondition

The discard step assumes everything to the right of `mid` is ≥ `a[mid]`. On unsorted input binary search does not error — it returns a **wrong answer**, having discarded the half containing the target.

:::pitfall
Searching `[3, 1, 4]` for 1: mid is index 1, `a[1]` is 1, found by luck. Searching `[5, 1, 4]` for 1: mid is 1, `a[1]` is 1 — again luck. Now search `[3, 1, 4]` for 3: mid is 1, `a[1]`=1 < 3, so `lo` becomes 2 and the 3 at index 0 is discarded. Returns −1 for a value that is present.

Sorting first costs O(n log n), which is more than a linear scan. Binary search pays off only when the data is **already** sorted, or when you search it many times.
:::

## Three bugs, in the three places they hide

**1. Overflow in the midpoint.**

```python
mid = (lo + hi) // 2             # can overflow in C/C++/Java
mid = lo + (hi - lo) // 2        # correct
```

With large `lo` and `hi`, their sum exceeds the integer range. This bug was present in Java's own `Arrays.binarySearch` for nine years. Python's integers are arbitrary precision so it cannot bite there, but the habit is worth keeping.

**2. The loop condition.**

`while lo <= hi` with `hi = len(a) - 1` is an **inclusive** range. If you instead set `hi = len(a)`, the condition must be `while lo < hi`. Mixing an inclusive bound with an exclusive condition either skips the final element or reads out of bounds.

:::key
Pick one convention and hold it for the whole function. **Inclusive** `[lo, hi]` pairs with `lo <= hi`, `hi = n-1`, and `hi = mid - 1`. **Half-open** `[lo, hi)` pairs with `lo < hi`, `hi = n`, and `hi = mid`. Almost every binary search bug is these two conventions crossed halfway through.
:::

**3. Failing to shrink the range.**

`lo = mid` instead of `lo = mid + 1` leaves the range unchanged when `mid == lo`, and the loop never terminates. Every branch must exclude `mid`, because `mid` has just been tested.

## The real lesson: searching an answer, not an array

Binary search applies to any **monotonic predicate** — a condition false up to some point and true after it. Find the boundary:

```python
def first_true(lo, hi, predicate):
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if predicate(mid):
            hi = mid            # mid might be the answer: keep it
        else:
            lo = mid + 1        # mid is not: discard it
    return lo
```

There is no array. The "space" is a range of candidate answers, and the predicate is a feasibility test you can evaluate.

:::example
"What is the smallest ship capacity that moves all packages within D days?"

Capacity is monotonic: if capacity c works, so does c+1. Binary-search capacity over `[max(weights), sum(weights)]`, where the predicate simulates the loading in O(n). Total: **O(n log(sum))** instead of trying every capacity.

The same shape answers "minimum time to finish", "maximum minimum distance", and "smallest divisor such that the sum is within a threshold". Whenever a question says *minimise the maximum* or *maximise the minimum*, this is usually the intended solution.
:::

## Where it already appeared

Binary search is the array version of a BST descent (CS203): both discard half the remaining candidates per comparison. A sorted array searches in O(log n) but inserts in O(n) because of shifting; a balanced BST does both in O(log n). That trade is the reason both structures exist.$md$,
 2, 26, 'binary-search', 1),

('searching', 'search-boundaries', 'Lower Bound, Upper Bound & Duplicates',
 'Plain binary search returns some match. When values repeat, you usually need the first or the last — and that is a different loop.',
 $md$## The problem

`[1, 2, 2, 2, 3]`, search for 2. Plain binary search checks index 2, finds a 2, and returns. That is *a* correct answer to "is 2 present" and the wrong answer to almost every real question:

- how many 2s are there?
- where does the run of 2s start?
- where would a 2 be inserted to keep the array sorted?

These need the **boundaries** of the matching run, and the fix is counter-intuitive: on finding a match, **do not return.**

## Lower bound — the first element ≥ target

```python
def lower_bound(a, target):
    lo, hi = 0, len(a)              # half-open: hi may be past the end
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if a[mid] < target:
            lo = mid + 1            # mid is too small: discard it
        else:
            hi = mid                # mid might be the answer: KEEP it
    return lo
```

Two things differ from plain binary search:

1. **There is no equality branch.** The comparison is only `<`, so a match falls into the `else` and narrows the range instead of returning.
2. **`hi = mid`, not `mid - 1`.** `mid` is still a candidate, so it must stay in the range.

The loop ends when `lo == hi`, and that index is the first position whose value is ≥ target — which is also exactly where the target should be **inserted**. If the target is absent, that is still the correct insertion point; if it is larger than everything, the answer is `len(a)`, which is why `hi` starts past the end.

## Upper bound — the first element > target

One character changes:

```python
if a[mid] <= target:                # <= instead of <
    lo = mid + 1
else:
    hi = mid
```

:::key
`lower_bound` uses `<` and lands on the **first** element ≥ target. `upper_bound` uses `<=` and lands on the **first** element > target. That single character is the entire difference, and from the two of them everything else follows:

| Question | Answer |
|---|---|
| First index of target | `lower_bound(a, t)` |
| Last index of target | `upper_bound(a, t) - 1` |
| Count of target | `upper_bound(a, t) - lower_bound(a, t)` |
| Is target present | `lower_bound(a,t) < len(a) and a[lower_bound(a,t)] == t` |
| Insertion point | `lower_bound(a, t)` |
:::

:::example
`a = [1, 2, 2, 2, 3]`, target 2.

`lower_bound` trace, range `[0,5)`:

| lo | hi | mid | a[mid] | a[mid] < 2? | action |
|---|---|---|---|---|---|
| 0 | 5 | 2 | 2 | no | hi = 2 |
| 0 | 2 | 1 | 2 | no | hi = 1 |
| 0 | 1 | 0 | 1 | yes | lo = 1 |
| 1 | 1 | — | — | — | stop |

Returns **1** — the first 2. `upper_bound` returns **4**, the first element greater than 2. Count is 4 − 1 = **3** ✓. Last index is 4 − 1 = **3** ✓.

Note the first iteration found a 2 at index 2 and deliberately kept searching left. Returning there would have been the plain-binary-search bug.
:::

## Why `hi = mid` does not loop forever

It looks dangerous — `hi = mid` keeps `mid` in the range. It terminates because `mid` is computed by flooring, so `mid < hi` whenever `lo < hi`. Assigning `hi = mid` therefore strictly decreases `hi`, and the range shrinks every iteration.

:::pitfall
The mirror of this does **not** hold. In a loop that assigns `lo = mid` (searching for a last-true rather than a first-true boundary), flooring makes `mid == lo` when `hi == lo + 1`, so the range stops shrinking and the loop hangs. That variant needs `mid = lo + (hi - lo + 1) // 2` — ceiling instead of floor.

The rule: **round the midpoint away from the bound you assign to `mid`.** Assigning to `hi`? Floor. Assigning to `lo`? Ceil.
:::

## In the standard libraries

You rarely need to write these, and you do need to know which one you are calling:

| Language | Lower bound | Upper bound |
|---|---|---|
| Python | `bisect.bisect_left` | `bisect.bisect_right` |
| C++ | `std::lower_bound` | `std::upper_bound` |
| Java | — (`Arrays.binarySearch` returns **any** match) | — |

Java's `Arrays.binarySearch` has the plain-binary-search behaviour: with duplicates it returns an unspecified matching index. Counting occurrences with it is a bug, and the boundary loops above are the fix.

`bisect_left` is also the standard way to maintain a sorted list under insertion: `bisect.insort` is `bisect_left` followed by an insert, which is O(log n) to locate and O(n) to shift — the trade that makes a balanced BST preferable when insertions are frequent.$md$,
 3, 26, 'first-last-occurrence', 2)

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
  ('insertion-sort',     'bubble-sort',      'sorting-and-searching'),
  ('merge-sort',         'insertion-sort',   'sorting-and-searching'),
  ('quick-sort',         'merge-sort',       'sorting-and-searching'),
  ('counting-sort',      'bubble-sort',      'sorting-and-searching'),
  ('radix-sort',         'counting-sort',    'sorting-and-searching'),
  ('search-boundaries',  'binary-search',    'sorting-and-searching'),
  ('binary-search',      'merge-sort',       'sorting-and-searching'),
  -- reaching back into CS201
  ('bubble-sort',        'array-operations', 'data-structures-fundamentals'),
  ('quick-sort',         'two-pointers',     'data-structures-fundamentals'),
  ('counting-sort',      'prefix-sums',      'data-structures-fundamentals'),
  -- reaching back into CS202 and CS203
  ('merge-sort',         'merging-sorted-lists', 'linked-structures-and-hashing'),
  ('binary-search',      'bst-invariant-and-search', 'trees-heaps-and-ordered-structures')
) AS v(concept_slug, prereq_slug, prereq_course)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters cch ON cch.id = c.chapter_id
JOIN public.courses cco ON cco.id = cch.course_id AND cco.slug = 'sorting-and-searching'
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
  AND co.slug = 'sorting-and-searching';

INSERT INTO public.learning_objectives (concept_id, objective, position)
SELECT c.id, v.objective, v.position
FROM (VALUES
  ('bubble-sort', 'Trace bubble sort and explain what the early-exit flag buys', 1),
  ('bubble-sort', 'Explain why any sort using only adjacent swaps is quadratic', 2),
  ('bubble-sort', 'State the comparison lower bound and the counting argument behind it', 3),
  ('insertion-sort', 'Implement insertion sort using shifts rather than swaps', 1),
  ('insertion-sort', 'Explain why its cost is proportional to the number of inversions', 2),
  ('insertion-sort', 'Explain why production sorts fall back to insertion sort on small inputs', 3),
  ('insertion-sort', 'Contrast insertion and selection sort on stability, adaptivity and write count', 4),
  ('merge-sort', 'Explain why merge sort is O(n log n) on every input', 1),
  ('merge-sort', 'Implement a stable merge and say which comparison makes it stable', 2),
  ('merge-sort', 'Explain why merge sort needs O(n) space and quicksort does not', 3),
  ('merge-sort', 'Name two settings where merge sort is the only workable choice', 4),
  ('quick-sort', 'Implement Lomuto partition and state its invariant', 1),
  ('quick-sort', 'Explain why a last-element pivot makes sorted input the worst case', 2),
  ('quick-sort', 'Describe two pivot strategies that remove the worst case', 3),
  ('quick-sort', 'Explain why three-way partitioning is needed for duplicate-heavy data', 4),
  ('counting-sort', 'Implement counting sort with prefix sums and explain each pass', 1),
  ('counting-sort', 'Explain why it does not contradict the comparison lower bound', 2),
  ('counting-sort', 'Explain why the placement pass runs backwards', 3),
  ('counting-sort', 'Decide from n and k whether counting sort is appropriate', 4),
  ('radix-sort', 'Explain why LSD radix sort requires a stable per-digit sort', 1),
  ('radix-sort', 'State the cost in terms of digit count and radix', 2),
  ('radix-sort', 'Explain why negative integers and floats need a transform first', 3),
  ('binary-search', 'Implement binary search with a non-overflowing midpoint', 1),
  ('binary-search', 'Explain why every branch must exclude mid', 2),
  ('binary-search', 'Match the loop condition to the inclusive or half-open convention', 3),
  ('binary-search', 'Binary-search an answer range using a monotonic predicate', 4),
  ('search-boundaries', 'Implement lower_bound and upper_bound and name the one-character difference', 1),
  ('search-boundaries', 'Derive first index, last index and count of a duplicated value', 2),
  ('search-boundaries', 'Explain why hi = mid terminates and lo = mid needs a ceiling midpoint', 3)
) AS v(concept_slug, objective, position)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'sorting-and-searching';

-- ---------------------------------------------------------------------------
-- 6. Misconception catalogue
-- ---------------------------------------------------------------------------
INSERT INTO public.concept_misconceptions (concept_id, code, statement, correction, probe)
SELECT c.id, v.code, v.statement, v.correction, v.probe
FROM (VALUES
  ('bubble-sort', 'adjacent-swap-can-be-fast',
   'Bubble sort could be made O(n log n) with a better swapping strategy.',
   'Each adjacent swap removes exactly one inversion, and reverse-sorted input has n(n-1)/2 of them. Any sort restricted to adjacent swaps is therefore quadratic, regardless of strategy.',
   'Reverse-sorted input of 1000 elements. How many inversions are there, and what does that imply for any adjacent-swap sort?'),
  ('bubble-sort', 'nlogn-is-arbitrary',
   'Someone may yet discover a comparison sort faster than O(n log n).',
   'Each comparison yields one bit and n! orderings must be distinguished, so at least log2(n!) = Omega(n log n) comparisons are required. The bound is a proof, not a current record.',
   'There are n! possible orderings. Explain why log2(n!) comparisons are necessary and what that rules out.'),
  ('bubble-sort', 'counting-sort-breaks-bound',
   'Counting sort disproves the O(n log n) lower bound.',
   'The bound applies to algorithms that only compare pairs of elements. Counting sort uses values as array indices, which is information outside the comparison model, so the bound does not apply to it.',
   'Name the single operation counting sort performs that a comparison sort cannot, and explain why that exempts it.'),

  ('insertion-sort', 'quadratic-always-bad',
   'Quadratic sorts should never be used.',
   'Insertion sort is O(n) on sorted data and O(n + inversions) on nearly sorted data, and beats O(n log n) sorts for small n because of its tiny constant. Timsort and introsort both use it deliberately.',
   'For n = 12 unsorted and for n = 10^6 nearly sorted, which is faster: insertion sort or merge sort? Justify both.'),
  ('insertion-sort', 'shift-vs-swap',
   'Shifting and swapping in insertion sort are equivalent.',
   'A swap is three assignments; a shift is one. Because the key is held in a variable, the vacated slot can be overwritten, so only one write per shifted element is needed.',
   'Count the assignments for sliding one element back five positions by swapping and by shifting.'),
  ('insertion-sort', 'ge-keeps-stability',
   'Using >= in the shift condition does not affect correctness.',
   'With >=, an equal element shifts past its equal, so their relative order reverses and the sort is no longer stable. The output is still sorted, which is why the bug is invisible on plain integers.',
   'Sort the pairs (1,a) and (1,b) by the first field using >=. What order do they end up in, and why does it matter?'),

  ('merge-sort', 'merge-sort-average-case',
   'Merge sort is O(n log n) on average and worse in the worst case.',
   'The split is positional, so it does not depend on the data at all. Every input produces the same log n levels of O(n) work, making the bound a guarantee.',
   'Name an input that makes merge sort slower than n log n. If you cannot, explain what about the split prevents it.'),
  ('merge-sort', 'in-place-merge-easy',
   'The merge step can trivially be done in place.',
   'Writing a merged element into the array would overwrite an element not yet read. In-place merging is possible but complex and slower; standard merge sort uses an O(n) buffer, which is also what allows it to be stable.',
   'Merge [1,3] and [2,4] in place in the same four slots. At which step do you overwrite an unread value?'),
  ('merge-sort', 'slicing-is-free',
   'Recursing with a[:mid] costs nothing extra.',
   'A slice copies, so the recursion allocates at every level and the real space use exceeds O(n). Production versions pass lo and hi indices and reuse one buffer allocated once.',
   'For n = 1024, how many arrays does the slicing version allocate in total, and how many does the index version allocate?'),

  ('quick-sort', 'quicksort-always-nlogn',
   'Quicksort is O(n log n).',
   'That is the average case. If the pivot is always the extreme, each partition splits n into 0 and n-1, giving O(n^2) and a recursion depth of n.',
   'Run quicksort with a last-element pivot on already-sorted input of length n. Give the recursion depth and the total comparisons.'),
  ('quick-sort', 'sorted-input-is-easy',
   'Sorted input is the easy case for quicksort.',
   'With a first- or last-element pivot it is the worst case, because that element is the extreme of the range. Sorted input is common, which makes naive quicksort dangerous rather than fast.',
   'Explain why the last element of a sorted array is the worst possible pivot, and name two fixes.'),
  ('quick-sort', 'duplicates-harmless',
   'Many equal elements do not affect quicksort.',
   'With Lomuto partitioning and all elements equal, every comparison is true and the split is maximally unbalanced: O(n^2). Three-way partitioning fixes it by isolating the equal block.',
   'Partition an array of 1000 identical values with Lomuto. Where does the pivot end up, and what is the resulting complexity?'),

  ('counting-sort', 'counting-sort-general',
   'Counting sort can replace a comparison sort in general.',
   'It needs keys that are small non-negative integers and allocates an array the size of the value range. For 32-bit integers that is 2^32 entries, and for floats, strings or custom comparators it does not apply at all.',
   'You must sort 1000 arbitrary 32-bit integers. State the counting array size and explain why this is the wrong algorithm.'),
  ('counting-sort', 'placement-direction-irrelevant',
   'The final placement pass can run forwards.',
   'Running forwards reverses the relative order of equal elements, so the sort is no longer stable. Radix sort is built from stable counting-sort passes and silently breaks without it.',
   'Place [2,0,2,1] forwards instead of backwards. Which two elements swap relative order, and what does that break downstream?'),
  ('counting-sort', 'no-prefix-sums-needed',
   'Counting sort can just write each value count times, so prefix sums are unnecessary.',
   'That works only for bare integers, because it reconstructs values from counts and discards any attached record. Prefix sums give each value a destination range, which is what lets whole records be placed.',
   'You are sorting student records by a 0-100 score. Explain why the count-and-rewrite version loses the student names.'),

  ('radix-sort', 'radix-any-stable-sort',
   'Any sort can be used for each digit pass of radix sort.',
   'Each pass must be stable, or it destroys the ordering established by the previous digits. An unstable per-digit sort produces wrong output with no error.',
   'Sort [802, 2] by tens digit with an unstable sort after the ones pass. What happens to their relative order and to the final result?'),
  ('radix-sort', 'radix-works-on-anything',
   'Radix sort works on any numeric data.',
   'It needs keys whose digit sequences compare lexicographically the same way the values compare. Negative integers and IEEE floats both fail that and need a transform first.',
   'Radix-sort [-5, 3] by magnitude digits. What order do you get, and why is it wrong?'),

  ('binary-search', 'binary-search-unsorted-ok',
   'Binary search returns -1 on unsorted input, so it is safe to call.',
   'It returns whatever its halving leads to. On unsorted data it can report a present value as absent, because it discarded the half containing it. There is no error.',
   'Search [3,1,4] for 3. Trace the indices and state the return value.'),
  ('binary-search', 'midpoint-overflow-theoretical',
   'The (lo + hi) / 2 overflow is a theoretical concern.',
   'It was a real defect in Java''s Arrays.binarySearch for nine years. lo + (hi - lo) / 2 is the same value without the intermediate sum.',
   'With 32-bit ints, lo = 2^30 and hi = 2^30 + 4. Compute lo + hi and explain what the midpoint becomes.'),
  ('binary-search', 'lo-equals-mid-ok',
   'Setting lo = mid is equivalent to lo = mid + 1.',
   'mid has already been tested, and when mid equals lo the range stops shrinking and the loop never terminates. Every branch must exclude mid.',
   'Run a search with lo = mid where lo = 0 and hi = 1. Give the sequence of lo and hi values.'),

  ('search-boundaries', 'return-on-match',
   'Binary search should return as soon as it finds the target.',
   'That returns an arbitrary match when values repeat. Finding the first or last occurrence requires continuing to narrow the range after a match, which is why the boundary loops have no equality branch.',
   'Search [1,2,2,2,3] for 2 with plain binary search. Which index is returned, and why can you not count occurrences from it?'),
  ('search-boundaries', 'lower-upper-same',
   'lower_bound and upper_bound are the same function.',
   'lower_bound uses < and returns the first element >= target; upper_bound uses <= and returns the first element > target. Their difference is the number of occurrences.',
   'For [1,2,2,2,3] and target 2, give both return values and derive the count and the last index.'),
  ('search-boundaries', 'hi-mid-infinite-loop',
   'Assigning hi = mid risks an infinite loop just as lo = mid does.',
   'Flooring guarantees mid < hi whenever lo < hi, so hi = mid strictly decreases hi. The mirror case lo = mid does hang, and needs a ceiling midpoint instead.',
   'With lo = 3 and hi = 4, compute the floored mid. Show that hi = mid shrinks the range but lo = mid does not.')
) AS v(concept_slug, code, statement, correction, probe)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'sorting-and-searching'
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

('insertion-sort', 'count-inversions-insertion', 'Count the Inversions',
 E'An **inversion** is a pair of indices `i < j` where `a[i] > a[j]` — a pair that is out of order relative to each other. Return the number of inversions in `a`.\n\nAn already-sorted array has 0; a reverse-sorted array of length n has n(n−1)/2.\n\nThe O(n^2) double loop is acceptable here and passes every test. The point is the quantity itself: it is exactly the number of adjacent swaps bubble sort performs, and exactly the work insertion sort does.',
 2,
 '{"python":"def count_inversions(a):\n    # pairs i < j with a[i] > a[j]\n    pass\n","javascript":"function countInversions(a) {\n  // pairs i < j with a[i] > a[j]\n}\n"}',
 '[{"args":[[1,2,3]],"expected":0,"hidden":false},{"args":[[3,2,1]],"expected":3,"hidden":false},{"args":[[2,1,3]],"expected":1,"hidden":false},{"args":[[]],"expected":0,"hidden":true},{"args":[[5,4,3,2,1]],"expected":10,"hidden":true},{"args":[[1,1,1]],"expected":0,"hidden":true},{"args":[[2,4,1,3,5]],"expected":3,"hidden":true}]',
 'O(n^2) time, O(1) space',
 '["For each i, count the later elements strictly smaller than a[i].","Equal elements are not an inversion — the condition is strictly greater.","Check your answer on [3,2,1]: the pairs are (3,2), (3,1) and (2,1), so 3."]',
 'published'),

('merge-sort', 'merge-sort-implement', 'Merge Sort',
 E'Sort `a` ascending and return a new array, using **merge sort**: split in half, sort each half recursively, then merge the two sorted halves with a single two-pointer pass.\n\nDo not call the language''s built-in sort. The merge must be **stable** — use `<=` when taking from the left half — and when one half is exhausted the remainder of the other must be appended in one step rather than element by element.',
 3,
 '{"python":"def merge_sort(a):\n    # split, recurse, merge\n    pass\n","javascript":"function mergeSort(a) {\n  // split, recurse, merge\n}\n"}',
 '[{"args":[[3,1,4,2]],"expected":[1,2,3,4],"hidden":false},{"args":[[1]],"expected":[1],"hidden":false},{"args":[[]],"expected":[],"hidden":false},{"args":[[5,4,3,2,1]],"expected":[1,2,3,4,5],"hidden":true},{"args":[[2,2,1,1]],"expected":[1,1,2,2],"hidden":true},{"args":[[-3,0,-7,9]],"expected":[-7,-3,0,9],"hidden":true},{"args":[[1,2,3,4,5]],"expected":[1,2,3,4,5],"hidden":true}]',
 'O(n log n) time, O(n) space',
 '["Base case: an array of length 0 or 1 is already sorted.","The merge walks two cursors and takes the smaller head. Use <= so equal elements take from the left half first.","When one cursor reaches its end, extend with the rest of the other array in one operation."]',
 'published'),

('quick-sort', 'lomuto-partition', 'Partition Around the Last Element',
 E'Perform one **Lomuto partition** pass on `a` using the last element as the pivot, and return the array after partitioning along with the pivot''s final index, as the two-element array `[partitioned, pivotIndex]`.\n\nAfter the pass, every element before the pivot index must be ≤ the pivot and every element after it must be ≥ the pivot. The relative order **within** each side is whatever the algorithm produces — do not sort.\n\nFollow the lesson''s loop exactly so your output matches: scan `j` from the start, and swap into a boundary `i` whenever `a[j] <= pivot`.',
 3,
 '{"python":"def lomuto_partition(a):\n    # return [partitioned_array, pivot_index]\n    pass\n","javascript":"function lomutoPartition(a) {\n  // return [partitionedArray, pivotIndex]\n}\n"}',
 '[{"args":[[3,7,1,9,2]],"expected":[[1,2,3,9,7],1],"hidden":false},{"args":[[1]],"expected":[[1],0],"hidden":false},{"args":[[2,1]],"expected":[[1,2],1],"hidden":false},{"args":[[1,2,3]],"expected":[[1,2,3],2],"hidden":true},{"args":[[3,2,1]],"expected":[[1,2,3],0],"hidden":true},{"args":[[5,5,5]],"expected":[[5,5,5],2],"hidden":true}]',
 'O(n) time, O(1) space',
 '["Keep a boundary i starting at lo. Everything before i is <= pivot.","Scan j from lo to hi-1. When a[j] <= pivot, swap a[i] with a[j] and advance i.","After the scan, swap the pivot at the end into position i. That i is its final index."]',
 'published'),

('counting-sort', 'counting-sort-bounded', 'Counting Sort with an Offset',
 E'Sort `a` ascending using **counting sort**. The values may be negative, so index by `v - min(a)` and size the counting array `max(a) - min(a) + 1`.\n\nDo not compare any two elements of `a` and do not call the built-in sort — the whole point is that this algorithm sorts without comparisons, which is why it can beat O(n log n) when the value range is small.\n\nReturn a new array. An empty input returns an empty array.',
 3,
 '{"python":"def counting_sort(a):\n    # index by v - min(a); no element comparisons\n    pass\n","javascript":"function countingSort(a) {\n  // index by v - min(a); no element comparisons\n}\n"}',
 '[{"args":[[2,0,2,1]],"expected":[0,1,2,2],"hidden":false},{"args":[[-2,3,-2,0]],"expected":[-2,-2,0,3],"hidden":false},{"args":[[]],"expected":[],"hidden":false},{"args":[[5]],"expected":[5],"hidden":true},{"args":[[3,3,3]],"expected":[3,3,3],"hidden":true},{"args":[[-1,-5,-3]],"expected":[-5,-3,-1],"hidden":true}]',
 'O(n + k) time, O(n + k) space',
 '["Find min and max first; the counting array has max - min + 1 slots.","Count occurrences at index v - min, then walk the counts in order emitting each value that many times.","Handle the empty array before calling min, which has no value to return."]',
 'published'),

('binary-search', 'binary-search-index', 'Binary Search',
 E'Given a **sorted** array `a` and a `target`, return the index of `target`, or `-1` if it is absent.\n\nYour solution must run in O(log n) — a linear scan passes the small tests and is not the exercise. Use a non-overflowing midpoint (`lo + (hi - lo) // 2`) and make sure every branch excludes `mid`, or the loop will not terminate.\n\nIf the target appears more than once, any matching index is accepted here. Finding the *first* one is the next problem.',
 2,
 '{"python":"def binary_search(a, target):\n    # O(log n). Every branch must exclude mid.\n    pass\n","javascript":"function binarySearch(a, target) {\n  // O(log n). Every branch must exclude mid.\n}\n"}',
 '[{"args":[[1,3,5,7,9],7],"expected":3,"hidden":false},{"args":[[1,3,5,7,9],4],"expected":-1,"hidden":false},{"args":[[],1],"expected":-1,"hidden":false},{"args":[[5],5],"expected":0,"hidden":true},{"args":[[1,2],2],"expected":1,"hidden":true},{"args":[[-9,-4,0,8],-4],"expected":1,"hidden":true},{"args":[[1,2,3,4,5,6,7,8,9,10],1],"expected":0,"hidden":true}]',
 'O(log n) time, O(1) space',
 '["Keep lo and hi as an inclusive range and loop while lo <= hi.","On a[mid] < target set lo = mid + 1; otherwise set hi = mid - 1. Both exclude mid.","Return -1 after the loop — if it exited, the range is empty and the target is absent."]',
 'published'),

('search-boundaries', 'count-occurrences', 'Count Occurrences in O(log n)',
 E'Given a **sorted** array `a` and a `target`, return how many times `target` appears.\n\nA linear scan is O(n) and passes the small tests; the exercise is O(log n). Compute it as `upper_bound - lower_bound`:\n\n- **lower_bound** — the first index whose value is ≥ target\n- **upper_bound** — the first index whose value is > target\n\nThe two differ by one character in the comparison. Neither may return early on a match.',
 3,
 '{"python":"def count_occurrences(a, target):\n    # upper_bound(target) - lower_bound(target)\n    pass\n","javascript":"function countOccurrences(a, target) {\n  // upperBound(target) - lowerBound(target)\n}\n"}',
 '[{"args":[[1,2,2,2,3],2],"expected":3,"hidden":false},{"args":[[1,2,3],4],"expected":0,"hidden":false},{"args":[[],1],"expected":0,"hidden":false},{"args":[[2,2,2],2],"expected":3,"hidden":true},{"args":[[1,2,3],1],"expected":1,"hidden":true},{"args":[[1,1,2,2,2,3,3],3],"expected":2,"hidden":true},{"args":[[5],4],"expected":0,"hidden":true}]',
 'O(log n) time, O(1) space',
 '["Use a half-open range: lo = 0, hi = len(a), loop while lo < hi.","lower_bound: if a[mid] < target then lo = mid + 1 else hi = mid. No equality branch, so a match keeps narrowing left.","upper_bound is the same loop with <= instead of <. Subtract the two results."]',
 'published')

) AS v(concept_slug, slug, title, prompt, difficulty, starter_code, test_cases, complexity, hints, status)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'sorting-and-searching'
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      prompt = EXCLUDED.prompt,
      difficulty = EXCLUDED.difficulty,
      starter_code = EXCLUDED.starter_code,
      test_cases = EXCLUDED.test_cases,
      expected_complexity = EXCLUDED.expected_complexity,
      hints = EXCLUDED.hints,
      status = EXCLUDED.status;
