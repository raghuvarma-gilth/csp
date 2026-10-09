-- ============================================================================
-- EduVerse — Course 2: Linked Structures & Hashing (CS202)
-- ----------------------------------------------------------------------------
-- WHY THIS EXISTS
--
-- The visual lab in src/components/visual/lab/ ships 79 working
-- visualisations across 14 groups. Before this migration the database held
-- curriculum for 11 concepts — arrays, stacks and queues — so seven whole
-- groups (linked lists, hashing, trees, heaps, graphs, sorting, recursion, DP)
-- rendered in the lab with no lesson pointing at them. A student could watch a
-- hash table resolve a collision but could not read anything about why.
--
-- This file closes two of those groups: Linked Lists (7 visualisations) and
-- Hashing (3). Every concept here sets `visual_key` to a key that actually
-- exists in VISUAL_CATALOGUE (src/components/visual/catalogue.ts), so the
-- lesson and the animation are the same topic.
--
-- WHAT IS DELIBERATELY ABSENT
--
-- No `diagram:` figures. The static figure set in
-- src/components/learning/diagrams.tsx has 13 keys, all for the arrays /
-- stacks / queues lessons, and an unknown key renders a visible "figure
-- missing" note. Rather than invent keys that would render as holes, these
-- lessons lean on prose, cost tables, code and the interactive visualisation
-- the `visual_key` points at — which is richer than a static SVG anyway.
-- `big-o-growth` is the one generic existing key and is reused where a lesson
-- actually argues about growth rates.
--
-- The `:::pitfall` / `:::example` / `:::key` blocks are parsed as callouts by
-- src/components/learning/Markdown.tsx. They are never injected as HTML.
--
-- IDEMPOTENCE
--
-- Every statement is ON CONFLICT DO UPDATE or DO NOTHING, so this file can be
-- re-applied safely. Note the same warning that applies to 20260916090300:
-- re-running it overwrites `content`, so if a later migration enriches these
-- bodies, re-run that enrichment afterwards.
--
-- SCOPING
--
-- `concepts.slug` is only UNIQUE (chapter_id, slug), so every join that looks
-- a concept up by slug is scoped through chapters to a named course. An
-- unscoped `WHERE slug = '...'` would eventually collide with a
-- faculty-authored concept in an unrelated course.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Course
-- ---------------------------------------------------------------------------
INSERT INTO public.courses (slug, code, title, description, subject, status, position)
VALUES (
  'linked-structures-and-hashing',
  'CS202',
  'Linked Structures & Hashing',
  'What you gain when you give up contiguous memory, and what you gain when you give up order entirely. Linked lists, the pointer techniques that make them tractable, and the hash table — the structure that buys O(1) lookup with arithmetic instead of comparison.',
  'Computer Science',
  'published',
  2
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
  ('linked-lists', 'Linked Lists',
   'Nodes joined by references rather than adjacency: O(1) splicing where you already stand, and no indexing at all.', 1),
  ('list-techniques', 'Pointer Techniques',
   'Two pointers moving at different speeds over a structure you cannot index — how to find the middle, detect a cycle, and merge in place.', 2),
  ('hashing', 'Hash Tables',
   'Turning a key into an address. Average O(1) lookup, the collision problem that makes it interesting, and the load factor that decides whether it holds.', 3)
) AS v(slug, title, description, position)
WHERE c.slug = 'linked-structures-and-hashing'
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
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'linked-structures-and-hashing'
JOIN (VALUES

-- === Chapter 1: Linked Lists ==============================================
('linked-lists', 'linked-list-fundamentals', 'Linked List Fundamentals',
 'A linked list trades address arithmetic for pointer chasing: no indexing, but insertion anywhere you already stand is O(1).',
 $md$## The one idea

An array knows where element `i` is because the elements are adjacent — the address is arithmetic. A linked list gives that up. Each element is its own allocation, called a **node**, and each node stores the address of the next one.

```python
class Node:
    def __init__(self, value):
        self.value = value
        self.next = None       # address of the next node, or None at the end
```

The list itself is just a reference to the first node, conventionally called `head`. There is no block, no capacity, and no element size to multiply by.

## What you lose

Indexing. There is no formula for "where is element 7", so the only way to reach it is to start at `head` and follow `next` seven times.

| Operation | Array | Linked list |
|---|---|---|
| Read `a[i]` | O(1) | **O(n)** |
| Insert at front | O(n) | **O(1)** |
| Insert after a node you hold | O(n) | **O(1)** |
| Insert at back | O(1) amortised | O(n), or O(1) with a tail pointer |
| Memory per element | the value | the value **plus** a pointer |

## What you gain

Splicing. If you already hold a reference to a node, inserting after it is three assignments and no shifting, however long the list is:

```python
new.next = node.next
node.next = new
```

Compare that with an array, where inserting in the middle moves every later element. The array's contiguity — the thing that buys O(1) indexing — is exactly the thing that makes insertion expensive.

:::key
A linked list is not "a slower array". It is a different trade: **position-based access is expensive, structural change at a position you already hold is free.** Choose it when you traverse and splice, not when you index.
:::

## Traversal is the only primitive

Almost every linked-list algorithm is a loop of this shape:

```python
node = head
while node is not None:
    visit(node.value)
    node = node.next
```

Note `while node is not None`, not `while node.next is not None`. The second form silently skips the last element — a mistake common enough that it is worth writing out once and remembering.

## The cost nobody mentions

Each node is a separate allocation, so nodes land wherever the allocator put them. A scan over a linked list jumps around memory; a scan over an array walks straight through it, and the CPU's cache has already fetched what comes next. Both are O(n). In practice the array is often several times faster. Big-O is silent about this, and it is the main reason real code uses `vector`/`ArrayList` far more than linked lists.$md$,
 1, 22, 'linked-list-traverse', 1),

('linked-lists', 'linked-list-insertion', 'Insertion, Deletion & the Dummy Head',
 'Every list mutation is a pointer rewrite. The special case is the head, and the dummy node makes it disappear.',
 $md$## Insertion needs the node *before*

To insert `new` between `prev` and `prev.next`, you rewrite two pointers — and the order matters:

```python
new.next = prev.next      # 1. new points at the rest of the list
prev.next = new           # 2. prev points at new
```

Do those in the opposite order and `prev.next` is overwritten before you ever read it, so the tail of the list is lost. This is the same back-to-front discipline as shifting an array, for the same reason: never destroy a reference you still need.

## Deletion needs the node before, too

```python
prev.next = prev.next.next     # the removed node is now unreachable
```

That is the whole operation — O(1), no shifting. The removed node is garbage once nothing references it.

:::pitfall
Both operations need `prev`, and a singly linked list gives you no way to walk backwards. If you are handed only the node to delete, you cannot delete it in the ordinary sense. The trick is to copy the *next* node's value into the node you hold and delete the next one instead — which fails on the last node, because there is no next to copy.
:::

## The head is a special case

Inserting at the front has no `prev`:

```python
def push_front(head, value):
    new = Node(value)
    new.next = head
    return new            # the caller MUST reassign head
```

Deleting the first node has the same problem. So most list functions end up shaped like:

```python
if head is None:          # empty
    ...
elif <target is head>:    # special case
    head = head.next
else:                     # general case
    ...walk and splice...
```

Three branches, two of which exist only because the head has no predecessor.

## The dummy head removes the special case

Allocate one throwaway node that sits before the real first element. Now **every** real node has a predecessor, and the special case is gone:

```python
def remove_all(head, target):
    dummy = Node(None)
    dummy.next = head
    prev = dummy
    while prev.next is not None:
        if prev.next.value == target:
            prev.next = prev.next.next      # delete; do not advance
        else:
            prev = prev.next                # keep; advance
    return dummy.next                       # the possibly-new head
```

:::example
Remove every `2` from `1 → 2 → 2 → 3`.

`prev` starts on the dummy. `prev.next` is `1`, keep, advance. `prev.next` is the first `2`, delete — `prev` stays on `1`, which now points at the second `2`. Delete that too. `prev.next` is `3`, keep. Done: `1 → 3`.

The "do not advance after a delete" line is what makes consecutive matches work. Advancing anyway is the linked-list version of the array bug where a forward delete loop skips elements.
:::

## Why this pattern is worth keeping

One throwaway allocation buys you a function with no head special-case and no `if head is None` guard, because an empty list is just `dummy.next is None`. Nearly every production list routine is written this way.$md$,
 2, 26, 'linked-list-insert', 2),

('linked-lists', 'linked-list-reversal', 'Reversing a Linked List',
 'Three pointers, one pass, O(1) space — and the one line everybody forgets is saving the next node before overwriting it.',
 $md$## The problem

Turn `1 → 2 → 3 → None` into `3 → 2 → 1 → None`, in place, without allocating a second list.

## Why it is not obvious

To make node `2` point back at node `1`, you overwrite `2.next`. But `2.next` is how you reach `3`. Overwrite it and the rest of the list is unreachable — you have reversed one link and lost everything after it.

So the loop must save the next node *before* rewriting the current one. That is the whole algorithm.

## Three pointers

```python
def reverse(head):
    prev = None
    node = head
    while node is not None:
        nxt = node.next      # 1. save, because step 2 destroys it
        node.next = prev     # 2. flip this link backwards
        prev = node          # 3. prev advances
        node = nxt           # 4. node advances
    return prev              # node is None; prev is the new head
```

Four lines in a fixed order. `nxt` exists only to survive line 2.

:::example
Trace `1 → 2 → 3`:

| Step | prev | node | list so far |
|---|---|---|---|
| start | None | 1 | `1 → 2 → 3` |
| after 1st | 1 | 2 | `1 → None`, rest `2 → 3` |
| after 2nd | 2 | 3 | `2 → 1 → None`, rest `3` |
| after 3rd | 3 | None | `3 → 2 → 1 → None` |

The loop exits when `node` is `None`, and `prev` is sitting on the last node visited — which is the new head. Returning `node` instead of `prev` returns `None`, and is the second most common bug here.
:::

## Cost

One pass, constant extra space: **O(n) time, O(1) space.** Nothing is allocated; only existing `next` fields are rewritten.

## The recursive version, and why it is worse

```python
def reverse(head):
    if head is None or head.next is None:
        return head
    rest = reverse(head.next)
    head.next.next = head
    head.next = None
    return rest
```

Correct, shorter, and O(n) **space** — one stack frame per node. On a million-node list it overflows the call stack. The iterative version has no such limit, which is why it is the one to know.

:::pitfall
`head.next = None` is not decoration. Without it the original first node still points forward, and the result has a cycle: the list's new tail points back into the middle. Reversal must explicitly terminate the new tail.
:::

## Where it shows up

Reversal is a building block, not usually a goal: it is how you compare a list against its reverse to test for a palindrome, how you add numbers stored most-significant-digit-first, and half of "reverse in groups of k".$md$,
 3, 26, 'linked-list-reverse', 3),

('linked-lists', 'doubly-linked-lists', 'Doubly Linked Lists',
 'A second pointer per node buys O(1) deletion given only the node — which is what makes an LRU cache possible.',
 $md$## The addition

Each node stores a reference backwards as well as forwards:

```python
class Node:
    def __init__(self, value):
        self.value = value
        self.next = None
        self.prev = None
```

The cost is one extra pointer per node and two extra assignments per mutation. What it buys is worth more than it sounds.

## What the back pointer buys

In a singly linked list, deleting a node requires its predecessor, which you can only get by walking from the head — so "delete this node" is O(n) even though the splice itself is O(1). With `prev`, the predecessor is already in hand:

```python
def unlink(node):
    if node.prev is not None:
        node.prev.next = node.next
    if node.next is not None:
        node.next.prev = node.prev
```

**O(1) deletion given only the node.** That single property is the reason doubly linked lists exist.

| Operation | Singly | Doubly |
|---|---|---|
| Delete given only the node | O(n) | **O(1)** |
| Insert before a known node | O(n) | **O(1)** |
| Traverse backwards | impossible | O(n) |
| Memory per node | 1 pointer | 2 pointers |

## Sentinels remove every edge case

The `if` guards above exist only for the ends. Use two permanent sentinel nodes — a `head` and a `tail` that hold no data — and every real node is guaranteed to have both neighbours:

```python
head.next = tail
tail.prev = head          # the empty list

def unlink(node):          # no guards needed, ever
    node.prev.next = node.next
    node.next.prev = node.prev
```

This is the dummy-head idea from the previous lesson, applied at both ends.

## The payoff: an LRU cache

An LRU cache needs three operations in O(1): look a key up, mark it as most recently used, and evict the least recently used. No single structure does all three.

The standard answer is two structures:

- a **hash map** from key to the node holding it — O(1) lookup
- a **doubly linked list** in recency order, most recent at the front — O(1) reorder

:::key
On a hit, the map finds the node in O(1) and the back pointer unlinks it in O(1), then it is pushed to the front. Eviction is the node before the tail sentinel. Every operation is O(1) because the map gives you the node *without walking*, and `prev` lets you remove it *without searching*.

Neither structure can do this alone. The hash map has no order; the list has no lookup. This pairing is the single most common "combine two structures" answer in interviews, and it is built on the back pointer.
:::

## When not to bother

If you only ever traverse forwards and insert at the ends, the second pointer is memory you are not using. Python's `deque` and Java's `LinkedList` are doubly linked precisely because they promise O(1) work at *both* ends.$md$,
 3, 24, 'doubly-linked-list', 4),

-- === Chapter 2: Pointer Techniques ========================================
('list-techniques', 'fast-and-slow-pointers', 'Fast & Slow Pointers',
 'Two pointers at different speeds let you find a position defined by a fraction of a length you never measured.',
 $md$## The problem with "the middle"

Find the middle node of a linked list. The obvious way is two passes: count the nodes, then walk half of them.

```python
n = 0
node = head
while node: n += 1; node = node.next     # pass 1
node = head
for _ in range(n // 2): node = node.next # pass 2
```

Correct, O(n), and it needs the length before it can start. On a stream — or anywhere you only get one pass — it does not work at all.

## One pass, two speeds

Walk one pointer one node at a time and another two nodes at a time. When the fast one reaches the end, the slow one is at the middle, because it has travelled exactly half as far.

```python
def middle(head):
    slow = fast = head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
    return slow
```

No length, no second pass, O(1) space.

:::example
`1 → 2 → 3 → 4 → 5`

| | slow | fast |
|---|---|---|
| start | 1 | 1 |
| step 1 | 2 | 3 |
| step 2 | 3 | 5 |

`fast.next` is `None`, so the loop stops and `slow` is on `3` — the middle. With an even count, `1 → 2 → 3 → 4`, slow lands on `3`: the *second* of the two middles. Which one you want is a specification question, and the answer is the loop condition.
:::

## The loop condition is the whole specification

- `while fast and fast.next` — slow ends on the **second** middle of an even list
- `while fast.next and fast.next.next` — slow ends on the **first** middle, i.e. the node *before* the second middle, which is what you need when you are about to split the list

:::pitfall
Both halves of `fast is not None and fast.next is not None` are required, and in that order. Checking only `fast.next` crashes with a null dereference the moment `fast` itself is `None`; checking them in the other order crashes for the same reason. This is the single most common bug in fast/slow code.
:::

## The general form

The technique is not about halves. Two pointers separated by a fixed gap, or moving at a fixed ratio, locate a position defined relative to a length you never computed:

- **ratio 2:1** — the middle
- **gap of k, same speed** — the k-th node from the end, in one pass
- **ratio 2:1 on a cyclic structure** — cycle detection, which is the next lesson

```python
def kth_from_end(head, k):
    lead = head
    for _ in range(k):
        lead = lead.next        # open a gap of k
    trail = head
    while lead is not None:     # close it at the same speed
        lead, trail = lead.next, trail.next
    return trail
```

When `lead` falls off the end, `trail` is exactly k behind it. The length is never mentioned.

:::key
Fast and slow pointers are the linked-list answer to a question arrays answer with arithmetic. You cannot compute `n // 2` without `n`, so instead you arrange for two pointers whose *relative* positions encode the answer.
:::$md$,
 3, 24, 'linked-list-middle', 1),

('list-techniques', 'cycle-detection', 'Cycle Detection (Floyd''s Algorithm)',
 'If a fast pointer laps a slow one, there is a cycle. The surprise is that the meeting point also tells you where the cycle starts.',
 $md$## The problem

A linked list may have been corrupted so that some node points back to an earlier one. There is then no `None` to stop at, and the obvious traversal loops forever. Detect it in O(1) space.

## Why a hash set is not the answer

Recording every visited node and checking membership works and is O(n) — but it is O(n) **space**. Floyd's algorithm gets the same answer in O(1).

## The tortoise and the hare

Move `slow` one step and `fast` two. If the list ends, `fast` falls off and there is no cycle. If there is a cycle, both pointers enter it and `fast` gains one node per step on `slow`, so it must eventually land on it.

```python
def has_cycle(head):
    slow = fast = head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False
```

## Why they must meet, and not step over each other

Once both are inside a cycle of length `L`, consider the gap from `fast` to `slow` measured forward around the cycle. Every step, `fast` advances 2 and `slow` advances 1, so that gap **shrinks by exactly 1** per step. A quantity that decreases by exactly one each step and lives in `0 … L-1` must hit 0. It cannot skip past zero, because it never changes by more than 1.

:::key
This is why the speeds are 1 and 2 and not, say, 1 and 3. With a difference of 2 the gap shrinks by 2 each step and could step over zero from 1 to -1 — it would still work out modulo L, but the one-step-at-a-time argument is what makes the proof immediate. A difference of exactly 1 is the reason the algorithm is obviously correct.
:::

## Finding where the cycle begins

This is the part that looks like a trick. After the meeting, move one pointer back to the head and advance **both** one step at a time. They meet at the cycle's entry point.

```python
def cycle_start(head):
    slow = fast = head
    while fast is not None and fast.next is not None:
        slow, fast = slow.next, fast.next.next
        if slow is fast:
            p = head
            while p is not slow:
                p, slow = p.next, slow.next
            return p
    return None
```

**Why it works.** Let `m` be the distance from the head to the cycle entry, `L` the cycle length, and `k` the distance from the entry to the meeting point. When they meet, slow has walked `m + k` and fast has walked `2(m + k)`. Fast's extra distance is a whole number of laps:

```
2(m + k) - (m + k) = m + k = multiple of L
```

So `m + k` is a multiple of `L`, which means walking `m` more steps from the meeting point lands exactly on the entry — and walking `m` steps from the head lands there too, by definition. Two pointers, same speed, both arrive together.

:::pitfall
The second phase advances both pointers **one** step at a time. Keeping fast at double speed is the usual error, and it meets somewhere arbitrary inside the cycle rather than at the entry.
:::

## Cost and reach

**O(n) time, O(1) space.** The same machinery answers "is this list circular", "where does the loop start", and — applied to the sequence `i → nums[i]` — "find the duplicate in an array of n+1 values from 1..n", which is a cycle problem wearing an array costume.$md$,
 4, 28, 'floyd-cycle', 2),

('list-techniques', 'merging-sorted-lists', 'Merging Sorted Lists',
 'The merge step of merge sort, where linked lists beat arrays: splicing needs no second buffer.',
 $md$## The problem

Given two lists already in sorted order, produce one sorted list containing all the nodes. Reuse the existing nodes rather than allocating new ones.

## The algorithm

Walk both lists at once. Repeatedly take whichever head is smaller and append it to the result.

```python
def merge(a, b):
    dummy = Node(None)
    tail = dummy
    while a is not None and b is not None:
        if a.value <= b.value:
            tail.next, a = a, a.next
        else:
            tail.next, b = b, b.next
        tail = tail.next
    tail.next = a if a is not None else b   # one list is empty; attach the rest
    return dummy.next
```

Two details carry the weight:

- The **dummy head** again. Without it the first append is a special case, because `tail` does not exist yet.
- The final line. When one list runs out the other is already sorted, so it is attached whole — not looped over. Forgetting this line silently truncates the result.

:::example
Merge `1 → 4` and `2 → 3`.

| tail | a | b | result |
|---|---|---|---|
| dummy | 1 | 2 | — |
| 1 | 4 | 2 | `1` |
| 2 | 4 | 3 | `1 → 2` |
| 3 | 4 | None | `1 → 2 → 3` |

`b` is now empty, so the remaining `4` is attached in one assignment: `1 → 2 → 3 → 4`.
:::

## Why `<=` and not `<`

With equal values, `<=` takes from `a` first. That makes the merge **stable** — equal elements keep their original relative order, with `a`'s before `b`'s. Flip it to `<` and stability is lost. It makes no difference to integers and a great deal of difference when you are sorting records by one field and expect ties to stay as they were.

## Where linked lists genuinely win

Merging two sorted *arrays* in place is hard, because there is nowhere to put the next element without shifting — so the standard merge allocates an O(n) buffer. Merging two sorted *lists* is pure pointer rewriting: **O(1) extra space.**

:::key
This is why merge sort is the natural sort for linked lists and quicksort is not. Merge sort needs sequential access and a cheap merge, which lists give you; quicksort needs random access for partitioning, which lists charge O(n) for. Linked-list merge sort runs in O(n log n) time and O(log n) stack space, with no data buffer at all.
:::

## Scaling to k lists

Merging k lists pairwise, one at a time, is O(k·n) — the accumulated result is re-walked on every merge. Two better routes:

- **Divide and conquer:** merge pairs, then pairs of pairs. log k rounds, O(n) per round → **O(n log k)**.
- **Min-heap of the k current heads:** pop the smallest, push its successor → also **O(n log k)**.

Both appear again in the sorting and heaps courses; the two-list merge here is the primitive they are built from.$md$,
 3, 24, 'merge-sorted-lists', 3),

-- === Chapter 3: Hash Tables ===============================================
('hashing', 'hash-tables', 'Hash Tables & the Hash Function',
 'Compute where a key belongs instead of searching for it. Average O(1) lookup, bought with arithmetic rather than comparison.',
 $md$## The one idea

Every structure so far finds things by **comparing**: scan an array, walk a list, compare your way down a tree. A hash table does not compare. It **computes** the address from the key itself.

```
index = hash(key) mod capacity
```

One function call, one modulo, one array read. The size of the table does not enter into it.

## The two jobs of a hash function

1. **Determinism.** The same key must always produce the same index, or you could never find anything again.
2. **Spread.** Different keys should scatter across the whole table. A function returning `0` for everything is deterministic and useless.

```python
def index_of(key, capacity):
    return hash(key) % capacity
```

:::pitfall
Determinism must hold for as long as the entry lives in the table. This is why **mutable objects make dangerous keys**: mutate a key after insertion and its hash changes, so the lookup computes a different bucket and the entry becomes unreachable while still occupying space. It is also why Python refuses to hash a `list` and accepts a `tuple`.
:::

## Collisions are not an edge case

Two distinct keys will map to the same index. This is not bad luck or a bad hash function — it is arithmetic. With `n` keys and `m` buckets and `n > m` it is forced, and well before that it is overwhelmingly likely: among 23 people, two share a birthday more often than not, with 365 buckets and 23 keys. A hash table is therefore **defined** by how it handles collisions, not by whether it has them.

Two families of answer:

- **Chaining** — each bucket holds a small collection of all entries that landed there. Covered below.
- **Open addressing** — one entry per bucket; on a clash, probe elsewhere in the table. The next two lessons.

## Chaining

Each bucket holds a linked list (hence this chapter's position after linked lists).

```python
def put(table, key, value):
    bucket = table[index_of(key, len(table))]
    for entry in bucket:
        if entry.key == key:
            entry.value = value      # update, not duplicate
            return
    bucket.append(Entry(key, value))
```

Lookup hashes to the bucket and then **compares keys within it** — the hash narrows the search to one bucket; equality finishes the job. This is why a key type needs both `__hash__` and `__eq__`, and why they must agree: equal keys must hash equally, or an entry will be looked for in the wrong bucket.

## The load factor decides everything

```
load factor α = entries / buckets
```

With a good hash the average bucket holds α entries, so an average lookup is `O(1 + α)`. While α is bounded by a constant, that **is** O(1).

| α | average bucket | behaviour |
|---|---|---|
| 0.5 | 0.5 | fast, memory to spare |
| 0.75 | 0.75 | the usual resize trigger |
| 5 | 5 | every lookup scans ~5 entries |
| n/1 | n | degenerates to a linear scan |

So implementations **resize**: when α crosses a threshold, allocate a bigger table and reinsert everything. Every key must be rehashed, because the index depends on capacity — the old index is meaningless in the new table. A resize is O(n), and amortises to O(1) per insertion exactly as a dynamic array's growth does.

:::key
"Hash tables are O(1)" is an **average-case** claim that assumes a hash spreading keys evenly and a bounded load factor. The worst case — every key colliding — is O(n). This is a real attack: feed a server keys you know collide and its O(1) lookups become O(n). Production hash functions are randomly seeded per process to make that impossible to arrange in advance.
:::

## What you give up

Order. An array and a sorted tree can answer "the smallest key", "keys between 10 and 20", "the next key after this one". A hash table can answer none of them — it scattered the keys deliberately, and a bucket index carries no ordering information. Needing ordered operations is the main reason to choose a balanced tree over a hash table despite the slower lookup.$md$,
 2, 28, 'hash-chaining', 1),

('hashing', 'open-addressing', 'Open Addressing & Linear Probing',
 'One entry per slot, and on a clash you walk to the next free one. Fast, cache-friendly, and it makes deletion surprisingly hard.',
 $md$## The alternative to chaining

Chaining stores collided entries outside the table, in a list per bucket. **Open addressing** keeps everything in the array itself: one entry per slot. On a collision, you probe for another slot.

The simplest rule is **linear probing** — try the next slot, and the next, wrapping around:

```python
def find_slot(table, key):
    i = hash(key) % len(table)
    while table[i] is not None and table[i].key != key:
        i = (i + 1) % len(table)       # wrap with modulo
    return i
```

Insertion and lookup both use this: lookup stops at a matching key, insertion stops at an empty slot.

## Why anyone prefers it

No per-entry allocation and no pointer chasing. The probe sequence walks **consecutive memory**, so the slots you try next are already in cache. For small keys this makes open addressing measurably faster than chaining even though it does more comparisons — the same cache-locality argument that made arrays beat linked lists.

| | Chaining | Linear probing |
|---|---|---|
| Memory per entry | entry + pointer | entry |
| Cache behaviour | jumps per node | consecutive |
| Load factor limit | can exceed 1 | **must stay < 1** |
| Deletion | remove from list | needs care (below) |

## Clustering is the cost

Occupied slots clump. Once a run of consecutive slots is full, every key hashing anywhere into that run must probe past all of it — and whichever slot it lands in extends the run, making it more likely to catch the next key. Runs grow by attracting growth. This is **primary clustering**.

The effect is sharp near a full table. Average probes for a successful lookup under linear probing is roughly:

```
½ (1 + 1/(1-α)²)
```

| α | ≈ probes |
|---|---|
| 0.5 | 2.5 |
| 0.75 | 8.5 |
| 0.9 | 50 |

At α = 0.9 a lookup averages fifty probes. Open-addressed tables therefore resize **earlier** than chained ones, typically around α = 0.7, and α can never reach 1 because there would be no free slot to stop at — an insertion into a full table loops forever.

## Deletion breaks the probe sequence

This is the real difficulty, and it is not obvious.

:::pitfall
You cannot delete by writing `None` into the slot. Lookup stops at the first empty slot, so emptying a slot in the middle of a probe run makes every entry *after* it unreachable.

Insert `A`, `B`, `C` all hashing to index 3: they occupy 3, 4, 5. Now delete `B` by clearing slot 4. Looking up `C` starts at 3, finds `A`, moves to 4, sees empty — and concludes `C` is not in the table. It is sitting in slot 5.
:::

The standard fix is a **tombstone**: a third slot state meaning "was occupied, keep probing".

```python
EMPTY, TOMBSTONE = object(), object()

# lookup:    treat TOMBSTONE as occupied — keep going
# insertion: treat TOMBSTONE as free — reuse it
```

Tombstones accumulate: they slow lookups down without holding data, so a table with heavy churn must eventually rehash to clear them out. A delete-heavy workload is a genuine reason to choose chaining instead.

:::key
Chaining and open addressing make the same O(1) average promise and fail differently. Chaining degrades gently as α rises and handles deletion trivially. Open addressing is faster while sparse and degrades sharply as it fills, with deletion needing tombstones. Neither is better; they answer different questions about your workload.
:::$md$,
 3, 26, 'hash-linear-probing', 2),

('hashing', 'probe-sequences', 'Quadratic Probing & Double Hashing',
 'Clustering comes from every key walking the same path. Fix it by making the step size depend on the attempt, or on the key.',
 $md$## What we are fixing

Linear probing's weakness is that the probe sequence from slot `i` is always `i, i+1, i+2, …`. Two keys that collide anywhere then follow **identical paths** for the rest of the table, so runs of occupied slots merge and grow. The cure is to make probe sequences diverge.

## Quadratic probing

Make the step grow with the attempt number:

```python
def find_slot(table, key):
    h = hash(key) % len(table)
    for k in range(len(table)):
        i = (h + k * k) % len(table)        # +0, +1, +4, +9, +16, …
        if table[i] is None or table[i].key == key:
            return i
    raise TableFull
```

Keys hashing to *different* home slots now diverge immediately instead of merging into one run — **primary clustering is gone**.

:::pitfall
Keys hashing to the **same** home slot still follow the same sequence, because the offsets `k²` depend only on `k`. That residual effect is called **secondary clustering**. Quadratic probing reduces clustering; it does not eliminate it.
:::

## Quadratic probing can fail to find a free slot

The jumps skip around, so the sequence may never visit some slots — an insertion can fail into a table that is not full.

The guarantee worth remembering: **if the capacity is prime and α < 0.5, quadratic probing always finds a free slot.** That is why open-addressed tables so often have prime capacities and resize at half full. (With a power-of-two capacity, the offsets `k(k+1)/2` reach every slot — a variant some libraries use instead.)

## Double hashing

Make the step depend on the **key** rather than the attempt:

```python
def find_slot(table, key):
    m = len(table)
    h1 = hash(key) % m
    h2 = 1 + (hash2(key) % (m - 1))          # never 0
    for k in range(m):
        i = (h1 + k * h2) % m
        ...
```

Now two keys with the same home slot still take different strides, so even secondary clustering goes. Double hashing has the best measured behaviour of the three.

Two requirements, both easy to get wrong:

- `h2` must **never be 0** — a stride of zero probes one slot forever. Hence the `1 +`.
- `h2` must be **coprime with the capacity**, or the stride cycles through a subset of slots and misses the rest. A prime capacity makes every stride in `1 … m-1` coprime automatically, which is the second reason prime capacities are conventional.

## Choosing

| Scheme | Clustering | Probes at α=0.75 | Notes |
|---|---|---|---|
| Linear | primary + secondary | ~8.5 | best cache locality |
| Quadratic | secondary only | ~2.0 | prime capacity, α < 0.5 |
| Double hashing | essentially none | ~1.8 | two hashes per lookup |

Linear probing's awful table entry is not the whole story: it walks consecutive memory, so its probes are nearly free compared with double hashing's scattered reads. For small tables of small keys, linear probing frequently wins in wall-clock time despite losing on probe count.

:::key
All three are the same algorithm with a different offset function: `i = (h(key) + f(k)) mod m`, where `f(k) = k`, `k²`, or `k·h₂(key)`. Everything that differs between them — clustering, the guarantee of finding a slot, the coprimality requirement — follows from that one choice.
:::

## What actually ships

Real libraries mix these ideas. Python's `dict` uses open addressing with a probe sequence perturbed by the unused high bits of the hash. Java's `HashMap` chains, then converts a bucket to a red-black tree once it exceeds eight entries, so the worst case is O(log n) rather than O(n). Both resize on a load-factor threshold, and both seed the hash randomly per process so collisions cannot be arranged by an attacker.$md$,
 4, 24, 'hash-quadratic-probing', 3)

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
--    Both sides are course-scoped. The prerequisite's course is a column
--    because some edges reach back into CS201 — a linked list is only
--    interesting once you know what contiguous memory bought you.
-- ---------------------------------------------------------------------------
INSERT INTO public.concept_prerequisites (concept_id, prerequisite_id)
SELECT c.id, p.id
FROM (VALUES
  -- within CS202
  ('linked-list-insertion',    'linked-list-fundamentals', 'linked-structures-and-hashing'),
  ('linked-list-reversal',     'linked-list-insertion',    'linked-structures-and-hashing'),
  ('doubly-linked-lists',      'linked-list-insertion',    'linked-structures-and-hashing'),
  ('fast-and-slow-pointers',   'linked-list-fundamentals', 'linked-structures-and-hashing'),
  ('cycle-detection',          'fast-and-slow-pointers',   'linked-structures-and-hashing'),
  ('merging-sorted-lists',     'linked-list-insertion',    'linked-structures-and-hashing'),
  ('hash-tables',              'linked-list-fundamentals', 'linked-structures-and-hashing'),
  ('open-addressing',          'hash-tables',              'linked-structures-and-hashing'),
  ('probe-sequences',          'open-addressing',          'linked-structures-and-hashing'),
  -- reaching back into CS201
  ('linked-list-fundamentals', 'array-fundamentals',       'data-structures-fundamentals'),
  ('fast-and-slow-pointers',   'two-pointers',             'data-structures-fundamentals'),
  ('hash-tables',              'prefix-sums',              'data-structures-fundamentals'),
  ('doubly-linked-lists',      'queue-fundamentals',       'data-structures-fundamentals')
) AS v(concept_slug, prereq_slug, prereq_course)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters cch ON cch.id = c.chapter_id
JOIN public.courses cco ON cco.id = cch.course_id AND cco.slug = 'linked-structures-and-hashing'
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
  AND co.slug = 'linked-structures-and-hashing';

INSERT INTO public.learning_objectives (concept_id, objective, position)
SELECT c.id, v.objective, v.position
FROM (VALUES
  ('linked-list-fundamentals', 'State the cost of indexing, front insertion and splicing for a linked list and justify each', 1),
  ('linked-list-fundamentals', 'Explain why a linked list has no O(1) indexing despite being O(1) to splice', 2),
  ('linked-list-fundamentals', 'Explain why an array scan outruns a list scan even though both are O(n)', 3),
  ('linked-list-insertion', 'Write the two pointer assignments for insertion in the order that preserves the tail', 1),
  ('linked-list-insertion', 'Explain why deletion needs the predecessor node', 2),
  ('linked-list-insertion', 'Use a dummy head to remove the head special case from a list mutation', 3),
  ('linked-list-reversal', 'Reverse a list iteratively in O(1) space using three pointers', 1),
  ('linked-list-reversal', 'Explain why the next node must be saved before the current link is rewritten', 2),
  ('linked-list-reversal', 'Explain why the recursive reversal is O(n) space and when that matters', 3),
  ('doubly-linked-lists', 'Explain why a back pointer makes deletion O(1) given only the node', 1),
  ('doubly-linked-lists', 'Use head and tail sentinels to remove every end-of-list guard', 2),
  ('doubly-linked-lists', 'Describe how a hash map and a doubly linked list combine into an O(1) LRU cache', 3),
  ('fast-and-slow-pointers', 'Find the middle of a list in one pass without computing its length', 1),
  ('fast-and-slow-pointers', 'Choose the loop condition that selects the first rather than the second middle', 2),
  ('fast-and-slow-pointers', 'Explain why both halves of the null check are required, in order', 3),
  ('cycle-detection', 'Detect a cycle in O(1) space with two pointers at speeds 1 and 2', 1),
  ('cycle-detection', 'Prove the pointers must meet using the shrinking-gap argument', 2),
  ('cycle-detection', 'Locate the cycle entry point and justify it from m + k being a multiple of L', 3),
  ('merging-sorted-lists', 'Merge two sorted lists in O(1) extra space using a dummy head', 1),
  ('merging-sorted-lists', 'Explain why the leftover list is attached rather than traversed', 2),
  ('merging-sorted-lists', 'Explain why <= rather than < makes the merge stable', 3),
  ('hash-tables', 'Compute a bucket index and explain why lookup still needs key equality', 1),
  ('hash-tables', 'Explain why collisions are inevitable rather than unlucky', 2),
  ('hash-tables', 'Relate the load factor to average lookup cost and justify resizing', 3),
  ('hash-tables', 'Explain why the O(1) claim is average-case and how the worst case is reached', 4),
  ('open-addressing', 'Implement linear probing with wraparound for insertion and lookup', 1),
  ('open-addressing', 'Explain primary clustering and why it is self-reinforcing', 2),
  ('open-addressing', 'Explain why clearing a slot breaks lookups, and what a tombstone fixes', 3),
  ('probe-sequences', 'Contrast linear, quadratic and double hashing by offset function', 1),
  ('probe-sequences', 'State the prime-capacity and load-factor conditions each scheme needs', 2),
  ('probe-sequences', 'Explain why the secondary hash must never be zero and must be coprime with the capacity', 3)
) AS v(concept_slug, objective, position)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'linked-structures-and-hashing';

-- ---------------------------------------------------------------------------
-- 6. Misconception catalogue
--    Each row is a belief a student actually holds, the correction, and a
--    probe that re-tests the belief. The tutor classifies wrong answers
--    against these codes rather than inventing a diagnosis.
-- ---------------------------------------------------------------------------
INSERT INTO public.concept_misconceptions (concept_id, code, statement, correction, probe)
SELECT c.id, v.code, v.statement, v.correction, v.probe
FROM (VALUES
  ('linked-list-fundamentals', 'list-indexing-o1',
   'You can read the i-th element of a linked list in O(1), like an array.',
   'There is no address formula for a node, because nodes are separate allocations. Reaching index i means following next i times: O(i), so O(n) in the worst case.',
   'A 1000-node list and a 1000-element array both hold the same values. How many memory reads does each need to reach element 900?'),
  ('linked-list-fundamentals', 'list-always-better-insert',
   'Insertion into a linked list is always O(1).',
   'The splice is O(1) once you hold the preceding node. Finding that node is O(n). "Insert at position 500" is O(n); "insert after this node I already have" is O(1).',
   'You want to insert after the 500th node of a list and hold only the head. What is the total cost, and which part dominates?'),
  ('linked-list-fundamentals', 'bigo-means-faster',
   'Two O(n) traversals take about the same time.',
   'Big-O hides constants and memory behaviour. An array scan reads consecutive addresses that the cache has already fetched; a list scan jumps to wherever each node was allocated. Same O(n), often several times the wall-clock.',
   'Both are O(n). Name the hardware mechanism that makes the array version faster, and say why big-O cannot express it.'),

  ('linked-list-insertion', 'insert-order-irrelevant',
   'The two pointer assignments for insertion can be done in either order.',
   'Setting prev.next = new first overwrites the only reference to the rest of the list, which is then unreachable. new.next = prev.next must come first.',
   'Insert new between 1 and 2 in 1 -> 2 -> 3, doing prev.next = new first. Write down exactly which nodes are still reachable from head.'),
  ('linked-list-insertion', 'delete-without-prev',
   'Given a node, you can delete it from a singly linked list.',
   'Deletion rewrites the predecessor, which you cannot reach from the node itself. The workaround copies the next node''s value in and deletes the next node, and it fails on the last node because there is no next.',
   'You hold a reference to the final node of a list and must delete it. Explain why the copy-the-next-value trick cannot work here.'),
  ('linked-list-insertion', 'advance-after-delete',
   'After deleting prev.next you should advance prev, as in any loop.',
   'Deleting makes prev.next point at what was two nodes ahead. Advancing as well skips that node without testing it, so consecutive matches survive. Advance only when you keep a node.',
   'Remove every 2 from 1 -> 2 -> 2 -> 3 while advancing after each delete. What is the result, and which node was never examined?'),

  ('linked-list-reversal', 'reverse-without-saving',
   'Reversal just needs to set node.next = prev as you walk.',
   'That assignment destroys the only reference to the remainder of the list. The next node must be saved first, which is why the loop needs three pointers and not two.',
   'Run the loop without the nxt variable on 1 -> 2 -> 3. After the first iteration, which nodes can you still reach?'),
  ('linked-list-reversal', 'return-node-not-prev',
   'After the reversal loop, return node as the new head.',
   'The loop exits precisely when node is None. The last node actually visited is prev, and that is the new head.',
   'The loop has just exited. State the values of prev and node for input 1 -> 2 -> 3, and say which one the caller needs.'),
  ('linked-list-reversal', 'recursive-is-o1-space',
   'The recursive reversal uses O(1) extra space because it allocates nothing.',
   'Each call consumes a stack frame and the recursion is n deep, so it is O(n) space. Allocating nothing on the heap is not the same as using no space.',
   'You reverse a 1,000,000-node list recursively and the program crashes. Name the resource that ran out and give the space complexity.'),

  ('doubly-linked-lists', 'doubly-faster-traversal',
   'A doubly linked list is faster to traverse than a singly linked one.',
   'Forward traversal is identical O(n) work; the extra pointer makes each node larger, so it is marginally worse for cache. What it buys is O(1) deletion given only the node, and backward traversal.',
   'You only ever walk forwards and append. What does the second pointer cost you, and what does it buy in that workload?'),
  ('doubly-linked-lists', 'lru-one-structure',
   'An LRU cache can be built from a hash map alone.',
   'A hash map has no order, so it cannot say which entry is least recently used without scanning. The list supplies order and O(1) reordering; the map supplies O(1) lookup. Both are required.',
   'Using only a hash map, how would you find the least recently used entry, and what is that operation''s cost?'),

  ('fast-and-slow-pointers', 'null-check-order',
   'Checking fast.next is not None is enough to guard the loop.',
   'If fast is already None, reading fast.next raises before the comparison. Both conditions are needed and fast must be tested first, because && short-circuits left to right.',
   'Run the loop on an even-length list with only the fast.next check. At which iteration does it crash, and on which expression?'),
  ('fast-and-slow-pointers', 'middle-is-unambiguous',
   'The middle of a list is a single well-defined node.',
   'An even-length list has two. Which one you get is decided entirely by the loop condition, so the specification has to say which you want.',
   'For 1 -> 2 -> 3 -> 4, which node does while fast and fast.next land on, and which condition returns the other middle?'),

  ('cycle-detection', 'needs-hash-set',
   'Detecting a cycle requires remembering visited nodes.',
   'A hash set works but costs O(n) space. Two pointers at speeds 1 and 2 decide it in O(1) space, because a faster pointer inside a cycle must eventually land on a slower one.',
   'State the space complexity of each approach, and explain what the two-pointer version uses instead of memory.'),
  ('cycle-detection', 'phase-two-keeps-speed',
   'To find the cycle entry, keep advancing the fast pointer two at a time.',
   'The second phase moves both pointers one step at a time from the head and the meeting point. At double speed they meet at an arbitrary node inside the cycle, not at the entry.',
   'Why does the proof require equal speeds in phase two? Refer to m + k being a multiple of the cycle length.'),
  ('cycle-detection', 'meeting-point-is-entry',
   'The node where the two pointers meet is where the cycle begins.',
   'They meet somewhere inside the cycle, determined by how far the start is from the entry. Reaching the entry needs the second phase.',
   'Construct a list with a 3-node tail into a 4-node cycle. Where do the pointers first meet, and is that the entry?'),

  ('merging-sorted-lists', 'merge-needs-buffer',
   'Merging two sorted lists needs a new list to write into.',
   'Merging arrays needs a buffer because there is nowhere to put an element without shifting. Lists are merged by rewriting next pointers on the existing nodes: O(1) extra space.',
   'Compare the extra space for merging two sorted arrays with merging two sorted lists, and explain what causes the difference.'),
  ('merging-sorted-lists', 'forgot-the-remainder',
   'When one list is exhausted the merge is finished.',
   'The other list still holds elements, and they are already sorted. They are attached with one pointer assignment. Omitting that line truncates the result.',
   'Merge 1 -> 4 with 2 -> 3 but stop when either list empties. What does the result contain, and what is missing?'),

  ('hash-tables', 'hashing-eliminates-comparison',
   'A hash table finds a key without comparing anything.',
   'The hash narrows the search to one bucket; equality then confirms the key, because different keys can share a bucket. This is why a key type needs both a hash and an equality test, and why they must agree.',
   'Two distinct keys hash to bucket 5. Describe every step of looking one of them up, and name the operation the hash cannot replace.'),
  ('hash-tables', 'good-hash-no-collisions',
   'A sufficiently good hash function eliminates collisions.',
   'With more keys than buckets collisions are forced, and they are likely long before that — 23 keys in 365 buckets collide more often than not. A good hash spreads keys; it cannot avoid collisions.',
   'You have 1000 buckets and insert 100 keys with a perfect uniform hash. Roughly what is the chance of at least one collision, and why is it not near zero?'),
  ('hash-tables', 'o1-always',
   'Hash table lookup is O(1).',
   'It is O(1) on average, assuming a hash that spreads keys and a bounded load factor. If every key collides, lookup degrades to O(n) — which is a real denial-of-service vector, and why hashes are randomly seeded per process.',
   'Describe an input that makes a chained hash table perform like a linked list, and state the resulting complexity.'),
  ('hash-tables', 'mutable-keys-fine',
   'Any object can be used as a hash table key.',
   'The key''s hash must not change while it is stored. Mutating a key moves its computed bucket, so the entry becomes unreachable while still occupying space. This is why Python allows a tuple key and refuses a list.',
   'You insert a value under a list key, then append to that list and look it up. Explain why the lookup fails even though the key object is unchanged by identity.'),

  ('open-addressing', 'delete-by-clearing',
   'To delete from an open-addressed table, set the slot to empty.',
   'Lookup stops at the first empty slot, so an emptied slot in the middle of a probe run hides everything after it. A tombstone marks the slot as "was occupied, keep probing".',
   'A, B and C all hash to index 3 and occupy slots 3, 4 and 5. Clear slot 4, then look up C. Where does the search stop, and what does it conclude?'),
  ('open-addressing', 'load-factor-above-one',
   'Open addressing works at any load factor, like chaining.',
   'It stores one entry per slot, so entries can never exceed capacity. Performance also collapses well before full — about 50 probes per lookup at 0.9 — so these tables resize around 0.7.',
   'What happens to an insertion when every slot is occupied, and why can chaining exceed a load factor of 1 while probing cannot?'),
  ('open-addressing', 'clustering-is-random',
   'Clusters of occupied slots form by chance and even out over time.',
   'Clustering is self-reinforcing: a long run catches every key hashing into it, and each such key extends the run. Runs grow by attracting growth rather than evening out.',
   'A run occupies slots 10-19. A new key hashes to 14. Where does it land, and what has happened to the run length?'),

  ('probe-sequences', 'quadratic-removes-clustering',
   'Quadratic probing removes clustering entirely.',
   'It removes primary clustering, because keys with different home slots now diverge. Keys with the same home slot still share a sequence — secondary clustering. Double hashing is what removes that.',
   'Two keys both hash to slot 7 under quadratic probing. Write out both probe sequences. What do you notice?'),
  ('probe-sequences', 'quadratic-always-finds-slot',
   'Quadratic probing will find a free slot whenever one exists.',
   'Its jumps can miss slots, so insertion can fail into a table that is not full. The guarantee needs a prime capacity and a load factor below 0.5.',
   'Name the two conditions under which quadratic probing is guaranteed to find a free slot, and explain what can happen without them.'),
  ('probe-sequences', 'second-hash-any-value',
   'The secondary hash in double hashing can return any integer.',
   'Zero gives a stride of zero, which probes one slot forever. A stride sharing a factor with the capacity cycles through a subset and never reaches the rest. Hence 1 + (h mod (m-1)) and a prime capacity.',
   'Your secondary hash returns 0 for some key. Trace the probe sequence. Then explain what a stride of 4 does in a table of capacity 8.')
) AS v(concept_slug, code, statement, correction, probe)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'linked-structures-and-hashing'
ON CONFLICT (concept_id, code) DO UPDATE
  SET statement = EXCLUDED.statement,
      correction = EXCLUDED.correction,
      probe = EXCLUDED.probe;

-- ---------------------------------------------------------------------------
-- 7. Coding problems
--    test_cases store `args` (the argument list) and `expected`, matching the
--    grader contract established in 20260916090300. Linked-list problems are
--    posed over plain arrays so the grader needs no node type: the student
--    returns an array, which keeps the harness honest about what it compares.
-- ---------------------------------------------------------------------------
INSERT INTO public.coding_problems (concept_id, slug, title, prompt, difficulty, starter_code, test_cases, expected_complexity, hints, status)
SELECT c.id, v.slug, v.title, v.prompt, v.difficulty,
       v.starter_code::jsonb, v.test_cases::jsonb, v.complexity, v.hints::jsonb,
       'published'::public.content_status
FROM (VALUES

('linked-list-reversal', 'reverse-sequence-in-place', 'Reverse a Sequence In Place',
 E'A linked list is given to you as an array `values` in list order. Return a new array holding the values in reversed order.\n\nSolve it with the **three-pointer discipline** from the lesson rather than a library call: walk forward once, building the result by prepending. The point is the one-pass, no-lookahead shape, which is what transfers to real nodes.\n\nO(n) time.',
 2,
 '{"python":"def reverse_sequence(values):\n    # Walk forward once. Build the reversal as you go.\n    pass\n","javascript":"function reverseSequence(values) {\n  // Walk forward once. Build the reversal as you go.\n}\n"}',
 '[{"args":[[1,2,3]],"expected":[3,2,1],"hidden":false},{"args":[[1]],"expected":[1],"hidden":false},{"args":[[]],"expected":[],"hidden":false},{"args":[[1,2,3,4,5,6]],"expected":[6,5,4,3,2,1],"hidden":true},{"args":[[7,7,8]],"expected":[8,7,7],"hidden":true}]',
 'O(n) time, O(n) output',
 '["Keep a result you prepend to. The first value you read ends up last.","With real nodes you would hold prev, node and nxt. The array version is the same walk without the allocation.","Do not reach backwards into the input. The whole point is that a linked list cannot be read right to left."]',
 'published'),

('fast-and-slow-pointers', 'middle-of-sequence', 'Middle of a Sequence, One Pass',
 E'Given a linked list as an array `values` in list order, return the value at the middle position **without using the array length**.\n\nUse the fast/slow technique: advance one index by 1 and another by 2 until the fast one runs off the end. For an even number of elements, return the **second** of the two middles.\n\nTreat `len(values)` as unavailable — the exercise is the two-pointer walk, which is the only option when there is no length to read.',
 3,
 '{"python":"def middle_value(values):\n    # Do not use len(values). Walk two cursors at different speeds.\n    pass\n","javascript":"function middleValue(values) {\n  // Do not use values.length. Walk two cursors at different speeds.\n}\n"}',
 '[{"args":[[1,2,3,4,5]],"expected":3,"hidden":false},{"args":[[1,2,3,4]],"expected":3,"hidden":false},{"args":[[1]],"expected":1,"hidden":false},{"args":[[1,2]],"expected":2,"hidden":true},{"args":[[9,8,7,6,5,4,3]],"expected":6,"hidden":true}]',
 'O(n) time, O(1) space',
 '["Advance slow by 1 and fast by 2 in the same loop.","Stop when fast is past the last element or on it — the exact condition decides which middle you get for even input.","Returning the second middle for even input means looping while fast is a valid index and fast + 1 is too."]',
 'published'),

('merging-sorted-lists', 'merge-two-sorted-sequences', 'Merge Two Sorted Sequences',
 E'Given two arrays `a` and `b`, each already sorted ascending, return one sorted array containing every element of both.\n\nDo it in a **single pass** with one cursor per input — do not concatenate and sort. When one input is exhausted, append the remainder of the other in one step rather than element by element.\n\nTies must keep elements of `a` before elements of `b`, so the merge is stable.',
 2,
 '{"python":"def merge_sorted(a, b):\n    # One pass, one cursor each. Do not concatenate and sort.\n    pass\n","javascript":"function mergeSorted(a, b) {\n  // One pass, one cursor each. Do not concatenate and sort.\n}\n"}',
 '[{"args":[[1,4],[2,3]],"expected":[1,2,3,4],"hidden":false},{"args":[[],[1,2]],"expected":[1,2],"hidden":false},{"args":[[1,2],[]],"expected":[1,2],"hidden":false},{"args":[[1,1,1],[1,1]],"expected":[1,1,1,1,1],"hidden":true},{"args":[[-5,0,3],[-9,-1,10]],"expected":[-9,-5,-1,0,3,10],"hidden":true},{"args":[[5],[1,2,3,4]],"expected":[1,2,3,4,5],"hidden":true}]',
 'O(n + m) time',
 '["Compare the two current heads and take the smaller one.","Use <= rather than < so equal elements take from a first. That is what makes it stable.","When one cursor reaches its end, the rest of the other array is already sorted — append it whole."]',
 'published'),

('hash-tables', 'first-duplicate-value', 'First Duplicated Value',
 E'Given an array `values`, return the first value that appears more than once, scanning left to right. "First" means the one whose **second** occurrence comes earliest. Return `null` (Python: `None`) if every value is unique.\n\nThe O(n^2) double loop passes the small cases and times out on the large ones. Use a hash set so each lookup is average O(1).',
 2,
 '{"python":"def first_duplicate(values):\n    # One pass. Remember what you have already seen.\n    pass\n","javascript":"function firstDuplicate(values) {\n  // One pass. Remember what you have already seen.\n}\n"}',
 '[{"args":[[2,1,3,5,3,2]],"expected":3,"hidden":false},{"args":[[1,2,3,4]],"expected":null,"hidden":false},{"args":[[5,5]],"expected":5,"hidden":false},{"args":[[]],"expected":null,"hidden":true},{"args":[[9,1,9,1]],"expected":9,"hidden":true},{"args":[[-3,0,-3]],"expected":-3,"hidden":true}]',
 'O(n) time, O(n) space',
 '["Walk once, keeping a set of values already seen.","Return as soon as the current value is already in the set — that is the earliest second occurrence.","Checking membership in a set is average O(1); checking membership in a list is O(n), which is the quadratic trap."]',
 'published'),

('open-addressing', 'linear-probe-insert', 'Linear Probing: Where Does It Land?',
 E'Simulate insertion into an open-addressed table that resolves collisions by **linear probing**.\n\nYou are given `capacity` and a list of integer `keys` to insert in order. The home slot of a key is `key % capacity`; if that slot is taken, try the next, wrapping around with modulo.\n\nReturn an array of length `capacity` holding the key in each slot, with `null` (Python: `None`) for empty slots. Assume the keys always fit.',
 3,
 '{"python":"def linear_probe_table(capacity, keys):\n    # table[i] is None when slot i is free.\n    pass\n","javascript":"function linearProbeTable(capacity, keys) {\n  // table[i] is null when slot i is free.\n}\n"}',
 '[{"args":[5,[1,6,11]],"expected":[null,1,6,11,null],"hidden":false},{"args":[4,[4,8,12,1]],"expected":[4,8,12,1],"hidden":false},{"args":[3,[]],"expected":[null,null,null],"hidden":false},{"args":[5,[4,9]],"expected":[9,null,null,null,4],"hidden":true},{"args":[7,[7,14,21,3]],"expected":[7,14,21,3,null,null,null],"hidden":true}]',
 'O(n) average, O(n^2) worst case',
 '["Start at key % capacity and step forward one slot at a time.","Wrap with (i + 1) % capacity, which is why a key hashing to the last slot can land at index 0.","The third test is the clustering lesson in miniature: 4, 8 and 12 all share a home slot and form a run."]',
 'published')

) AS v(concept_slug, slug, title, prompt, difficulty, starter_code, test_cases, complexity, hints, status)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'linked-structures-and-hashing'
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      prompt = EXCLUDED.prompt,
      difficulty = EXCLUDED.difficulty,
      starter_code = EXCLUDED.starter_code,
      test_cases = EXCLUDED.test_cases,
      expected_complexity = EXCLUDED.expected_complexity,
      hints = EXCLUDED.hints,
      status = EXCLUDED.status;
