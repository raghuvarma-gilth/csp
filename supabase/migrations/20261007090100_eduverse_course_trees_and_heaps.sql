-- ============================================================================
-- EduVerse — Course 3: Trees, Heaps & Ordered Structures (CS203)
-- ----------------------------------------------------------------------------
-- The largest curriculum gap in the project. The visual lab renders ten tree
-- visualisations and three heap ones; before this file none of them had a
-- lesson. Thirteen concepts, thirteen visual keys, each used exactly once.
--
-- The through-line is deliberate: a hash table bought O(1) lookup by throwing
-- order away (CS202). Trees keep order and pay O(log n) for it, and everything
-- in this course is a consequence of that trade — which is why the ordered
-- operations a hash table cannot do are named in almost every lesson.
--
-- Conventions follow 20260916090300 and 20261007090000:
--   · no `diagram:` keys (only 13 exist, all for CS201); lessons rely on prose,
--     cost tables, code and the interactive `visual_key` animation
--   · `:::key` / `:::pitfall` / `:::example` are parsed as callouts by
--     src/components/learning/Markdown.tsx, never injected as HTML
--   · every slug lookup is scoped through chapters to a named course, because
--     concepts.slug is only UNIQUE (chapter_id, slug)
--   · every statement is ON CONFLICT DO UPDATE / DO NOTHING, so re-applying is
--     safe. Re-running overwrites `content`, so re-run any later enrichment.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Course
-- ---------------------------------------------------------------------------
INSERT INTO public.courses (slug, code, title, description, subject, status, position)
VALUES (
  'trees-heaps-and-ordered-structures',
  'CS203',
  'Trees, Heaps & Ordered Structures',
  'What you get back when you stop scattering keys. Binary search trees keep data ordered at O(log n), heaps keep only the extreme cheap, and tries and segment trees specialise the idea — prefix queries and range queries that no hash table can answer.',
  'Computer Science',
  'published',
  3
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
  ('binary-trees', 'Binary Trees & Traversal',
   'Branching instead of sequence. Height, shape, and the four orders in which you can visit every node.', 1),
  ('binary-search-trees', 'Binary Search Trees',
   'One invariant turns a tree into a searchable structure — and the same invariant makes deletion the hardest operation in the course.', 2),
  ('heaps', 'Heaps & Priority Queues',
   'A weaker promise than sorted: only the extreme is cheap. That is enough for scheduling, top-k, and an O(n log n) sort with no extra memory.', 3),
  ('specialised-trees', 'Tries & Range Trees',
   'Trees shaped around a specific question — prefixes, and range aggregates that update as fast as they query.', 4)
) AS v(slug, title, description, position)
WHERE c.slug = 'trees-heaps-and-ordered-structures'
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
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'trees-heaps-and-ordered-structures'
JOIN (VALUES

-- === Chapter 1: Binary Trees & Traversal ==================================
('binary-trees', 'binary-tree-fundamentals', 'Binary Trees & Depth-First Order',
 'Each node points to two children instead of one successor. Height decides every cost, and the three depth-first orders differ only in when you read the node.',
 $md$## The structure

A linked list node points at one successor. A binary tree node points at two:

```python
class Node:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None
```

That single change — one `next` becoming `left` and `right` — turns a line into a branching structure, and turns linear cost into logarithmic cost when the branching is balanced.

## Vocabulary, stated once

| Term | Meaning |
|---|---|
| **root** | the one node with no parent |
| **leaf** | a node with no children |
| **depth** of a node | edges from the root down to it (root has depth 0) |
| **height** of a tree | the longest root-to-leaf path |
| **subtree** | any node, taken together with all its descendants |

Depth is measured downward from the root; height is measured upward from the deepest leaf. Mixing them up is the most common source of off-by-one errors in tree code.

## Height is the only cost that matters

Every search, insert and delete in this course walks one root-to-leaf path. So every cost is O(height), and the interesting question is what the height *is*.

| Shape | Height of n nodes |
|---|---|
| Perfectly balanced | ⌊log₂ n⌋ |
| Reasonably balanced | O(log n) |
| **Degenerate** (every node has one child) | **n − 1** |

A degenerate tree is a linked list wearing two pointers. It is still a valid binary tree, and every operation on it is O(n).

:::key
"Trees are O(log n)" is a claim about **shape**, not about trees. A tree built by inserting already-sorted data degenerates into a list and every promise in this course evaporates. That single risk is why self-balancing trees exist — the last lesson of the next chapter.
:::

## The array layout

A tree that is *complete* — every level full except possibly the last, which fills left to right — can be stored in a flat array with no pointers at all:

```
index i        -> node
left child     -> 2i + 1
right child    -> 2i + 2
parent         -> (i - 1) // 2
```

No allocation per node, perfect cache locality, and the same address arithmetic that makes arrays fast. This only works because completeness means there are no gaps to represent. Remember it — the heaps chapter is built entirely on it.

## Depth-first traversal: three orders, one walk

Visiting every node requires recursing into both children. The only freedom is *when* you read the current node relative to the two recursive calls:

```python
def preorder(node):               # node, left, right
    if node is None: return
    visit(node)
    preorder(node.left)
    preorder(node.right)

def inorder(node):                # left, node, right
    if node is None: return
    inorder(node.left)
    visit(node)
    inorder(node.right)

def postorder(node):              # left, right, node
    if node is None: return
    postorder(node.left)
    postorder(node.right)
    visit(node)
```

Three identical functions; the `visit` line has moved. That is the entire difference.

:::example
```
      1
     / \
    2   3
   / \
  4   5
```

| Order | Sequence |
|---|---|
| Pre | 1, 2, 4, 5, 3 |
| In | 4, 2, 5, 1, 3 |
| Post | 4, 5, 2, 3, 1 |

Pre-order sees a node before its children — it is how you **copy** or serialise a tree, because the parent exists before anything needs to attach to it. Post-order sees children before the node — it is how you **free** or evaluate a tree, because a node's value depends on results from below. In-order, on a binary search tree, emits the values in sorted order, which is the next chapter's central fact.
:::

## Doing it without recursion

Recursion uses the call stack, which is O(height) space and overflows on a degenerate tree. Making the stack explicit removes the limit:

```python
def preorder_iterative(root):
    if root is None: return
    stack = [root]
    while stack:
        node = stack.pop()
        visit(node)
        if node.right: stack.append(node.right)   # right first…
        if node.left:  stack.append(node.left)    # …so left pops first
```

:::pitfall
The children are pushed **right before left**. A stack reverses what you put in, so pushing left first would visit the right subtree first and silently produce a mirrored traversal. This asymmetry is the whole reason iterative traversal is harder to write than it looks.
:::

Recursion is not magic here — it is a stack you did not have to declare. Making it explicit is what the recursion course calls "the call stack is a data structure", and it is why that course sits next to this one.$md$,
 2, 28, 'tree-traversals', 1),

('binary-trees', 'breadth-first-traversal', 'Breadth-First & Level Order',
 'Swap the stack for a queue and depth-first becomes breadth-first. One line of difference, and it is how you find shortest paths.',
 $md$## The same walk, a different container

Here is iterative depth-first traversal again, and beside it breadth-first:

```python
def dfs(root):                      def bfs(root):
    stack = [root]                      queue = deque([root])
    while stack:                        while queue:
        node = stack.pop()                  node = queue.popleft()
        visit(node)                         visit(node)
        push children                       append children
```

**`pop()` became `popleft()`.** Nothing else changed. A stack returns the most recently added node, so the walk dives; a queue returns the least recently added, so the walk spreads.

:::key
Depth-first and breadth-first are not two algorithms. They are one algorithm parameterised by the container, and the container decides the order. This is the single most transferable idea in the course — it reappears unchanged on graphs, where the only new problem is remembering which nodes you have already seen.
:::

## Level order, one level at a time

Plain BFS gives a flat sequence. Usually you want the nodes grouped by depth, which means knowing where each level ends. The trick is to record the queue's length *before* draining it — at that moment the queue holds exactly one complete level:

```python
def level_order(root):
    if root is None: return []
    levels, queue = [], deque([root])
    while queue:
        n = len(queue)              # the size of THIS level, fixed now
        level = []
        for _ in range(n):          # drain exactly n, not until empty
            node = queue.popleft()
            level.append(node.value)
            if node.left:  queue.append(node.left)
            if node.right: queue.append(node.right)
        levels.append(level)
    return levels
```

:::pitfall
`n = len(queue)` must be read **before** the inner loop, and the loop must run exactly `n` times. Re-reading the length inside the loop sees the children you have just appended, so the level boundary dissolves and you get one flat list back — a bug that produces a plausible-looking result and no error.
:::

:::example
```
      1
     / \
    2   3
   / \
  4   5
```

| Round | n | drained | queue after |
|---|---|---|---|
| 1 | 1 | 1 | 2, 3 |
| 2 | 2 | 2, 3 | 4, 5 |
| 3 | 2 | 4, 5 | empty |

Result: `[[1], [2, 3], [4, 5]]`. The level sizes 1, 2, 2 were each known before the round began.
:::

## What the level-size trick buys

Once you can see level boundaries, a family of questions becomes one loop:

- **Height** — the number of rounds
- **Right-hand view** — the last node drained in each round
- **Level averages or maxima** — an aggregate per round
- **Zig-zag order** — reverse alternate levels
- **Minimum depth** — the first round containing a leaf; you can return immediately

That last one matters. BFS reaches nodes in nondecreasing order of depth, so **the first time it sees a leaf, that is the shallowest leaf.** DFS would have to explore every branch before it could be sure.

## Cost

| | Time | Space |
|---|---|---|
| DFS (recursive) | O(n) | O(height) — the call stack |
| BFS (level order) | O(n) | O(width) — the widest level |

Both visit every node once. They differ in what they hold: DFS holds one path, BFS holds one level. On a balanced tree the last level holds about half the nodes, so BFS is O(n) space while DFS is O(log n). On a degenerate tree it is the exact opposite — BFS holds one node per level and DFS holds all n.

:::key
Choosing between them is therefore not about speed. Ask what the question is: shallowest-anything and level-anything want BFS; path-anything and subtree-aggregate-anything want DFS. Then check which one's space bound your tree shape can afford.
:::$md$,
 2, 24, 'tree-level-order', 2),

-- === Chapter 2: Binary Search Trees =======================================
('binary-search-trees', 'bst-invariant-and-search', 'The BST Invariant & Search',
 'One ordering rule per node, applied to whole subtrees, lets you discard half the tree at every step.',
 $md$## The invariant

A binary tree is a **binary search tree** when, for every node:

> every value in its **left** subtree is less than it, and every value in its **right** subtree is greater than it.

Read that twice, because the strength is in the words *every* and *subtree*. The rule is not about the two children — it constrains all descendants.

## Why it makes search cheap

At a node, comparing your target with the node's value tells you which side it must be on, so the other side is eliminated whole:

```python
def search(node, target):
    while node is not None:
        if target == node.value:
            return node
        node = node.left if target < node.value else node.right
    return None
```

One comparison, one step down, no backtracking. The loop runs at most *height* times.

| Tree shape | Search cost |
|---|---|
| Balanced | O(log n) |
| Degenerate | O(n) |

:::key
This is the same discard-half argument as binary search on a sorted array — the tree is simply a version you can insert into cheaply. A sorted array searches in O(log n) but inserts in O(n) because of shifting; a balanced BST does both in O(log n). That is the entire reason to build one.
:::

## In-order traversal yields sorted output

Take in-order traversal from the previous chapter — left, node, right — and apply the invariant: everything left of a node is smaller, everything right is larger. So visiting left, then the node, then right emits values in increasing order.

```python
def sorted_values(node, out):
    if node is None: return
    sorted_values(node.left, out)
    out.append(node.value)
    sorted_values(node.right, out)
```

**O(n), already sorted, no comparisons performed.** The ordering was paid for at insertion time.

## The operations a hash table cannot do

This is where the course's through-line pays off. A hash table scattered its keys deliberately, so it can answer "is this key present" and nothing else about order. A BST can answer:

| Question | How |
|---|---|
| Smallest key | walk `left` until `None` |
| Largest key | walk `right` until `None` |
| All keys in `[lo, hi]` | in-order walk, pruning subtrees out of range |
| Next key above x | the successor — see below |
| Keys in sorted order | one in-order traversal |

All of them are O(log n) or output-sensitive. None of them is possible on a hash table without examining every entry.

## Successor and predecessor

The **successor** of a node is the next-largest value in the tree. Two cases:

- the node has a right subtree → the successor is the **leftmost node of that subtree**
- it does not → the successor is the nearest ancestor from which you came up on the left

```python
def leftmost(node):
    while node.left is not None:
        node = node.left
    return node
```

:::example
```
        8
       / \
      3   10
     / \    \
    1   6    14
       / \   /
      4   7 13
```

Successor of `8`: it has a right subtree, so take its leftmost node — `10`. Successor of `7`: no right child, so climb — `7` is the right child of `6`, keep climbing; `6` is the right child of `3`, keep climbing; `3` is the **left** child of `8`, so `8` is the successor. In-order output confirms both: 1, 3, 4, 6, 7, 8, 10, 13, 14.
:::

Successor looks like a detail. It is not — it is the operation that makes BST deletion possible, which is the lesson after next.

## The catch, again

Everything above says O(log n) and means O(height). Insert `1, 2, 3, 4, 5` in that order and you get a right-leaning chain: a valid BST of height 4 where search is a linear scan. Sorted input is the worst case for a plain BST, and sorted input is extremely common.$md$,
 2, 26, 'bst-search', 1),

('binary-search-trees', 'bst-insertion', 'BST Insertion',
 'Search until you fall off the tree, then attach where you fell. Every new node is a leaf — which is exactly why insertion order decides the shape.',
 $md$## The algorithm

Insertion is a search that did not find anything. Walk down comparing, and when you reach a missing child, that gap is where the value belongs:

```python
def insert(root, value):
    if root is None:
        return Node(value)                 # the tree was empty
    node = root
    while True:
        if value < node.value:
            if node.left is None:
                node.left = Node(value)
                return root
            node = node.left
        elif value > node.value:
            if node.right is None:
                node.right = Node(value)
                return root
            node = node.right
        else:
            return root                    # already present; do nothing
    ```

O(height): one root-to-leaf walk and one assignment.

## Two facts worth stating explicitly

**Every insertion creates a leaf.** Nothing already in the tree is moved or re-parented. The position is forced by the invariant — there is exactly one gap where the value can legally go.

**The duplicate case is a policy decision, not an oversight.** The code above ignores duplicates. A multiset would instead keep a count on the node, which is better than inserting an equal value to one side: putting equals on the right means "every value in the right subtree is *greater*" is no longer true, and later code that relies on strict ordering — validation, deletion, range queries — starts returning wrong answers.

:::pitfall
Handle equality explicitly. If your comparison is only `if value < node.value: ... else: ...`, equal values silently go right and the strict invariant is broken. Nothing errors; `validate` later reports the tree as invalid and the cause is three functions away.
:::

## Insertion order *is* the shape

The same set of values, inserted in different orders, builds different trees:

:::example
Insert `4, 2, 6, 1, 3, 5, 7`:

```
        4
       / \
      2   6
     / \ / \
    1  3 5  7
```
Height 2. Every search is at most 3 comparisons.

Now insert `1, 2, 3, 4, 5, 6, 7` — the same values, sorted:

```
    1
     \
      2
       \
        3
         \
          4  (… and so on)
```
Height 6. A linked list. Every search is a linear scan.
:::

| Insertion order | Height of n nodes | Search |
|---|---|---|
| Random | O(log n) expected | fast |
| Sorted (or reverse) | **n − 1** | O(n) |

:::key
This is the central weakness of the plain BST, and the input that triggers it — already-sorted data — is one of the most common inputs in practice. Loading records from an indexed database, replaying a sorted log, inserting timestamps as they arrive: all of them degenerate the tree.

Two answers exist. Insert in randomised order, which you usually cannot control. Or **rebalance as you go**, which is what AVL and red-black trees do, and is the subject of the last lesson in this chapter.
:::

## Building a balanced tree from sorted data

If you already hold the sorted values, do not insert them in order. Recurse on the middle:

```python
def build(values, lo, hi):
    if lo > hi: return None
    mid = (lo + hi) // 2
    node = Node(values[mid])
    node.left  = build(values, lo, mid - 1)
    node.right = build(values, mid + 1, hi)
    return node
```

The middle element becomes the root, so each subtree gets half the values and the height is ⌊log₂ n⌋ by construction. **O(n)** to build, against O(n²) for inserting sorted data one at a time into a degenerating tree.$md$,
 2, 24, 'bst-insert', 2),

('binary-search-trees', 'bst-deletion', 'BST Deletion & the Successor',
 'Three cases, and the third is the only hard operation in the course: replace the node with its in-order successor.',
 $md$## Why deletion is harder than insertion

Insertion always creates a leaf, so nothing existing is disturbed. Deletion removes a node that may sit in the middle of the structure, with two subtrees that still have to hang off something — and whatever you attach them to must keep the invariant.

There are exactly three cases, by the number of children.

## Case 1 — a leaf

Detach it. Nothing depended on it.

```
    5          5
   / \   ->   /
  3   8      3        (delete 8)
```

## Case 2 — one child

Promote the child into the node's place. The whole subtree moves up one level, and the invariant survives because the subtree's values were already on the correct side of the removed node's parent.

```
    5            5
   / \          / \
  3   8   ->   3   9      (delete 8)
       \
        9
```

## Case 3 — two children

You cannot promote either child: whichever you pick, the other subtree has nowhere legal to go. So **do not remove the node** — overwrite its value with one that may legally sit there, then delete *that* node instead.

Exactly two values qualify:

- the **in-order successor** — the smallest value in the right subtree
- the **in-order predecessor** — the largest value in the left subtree

Either one preserves the invariant, because it is the only value with nothing between it and the node being replaced. Convention takes the successor.

```python
def delete(node, value):
    if node is None:
        return None
    if value < node.value:
        node.left = delete(node.left, value)
    elif value > node.value:
        node.right = delete(node.right, value)
    else:
        if node.left is None:  return node.right      # cases 1 and 2
        if node.right is None: return node.left       # cases 1 and 2
        succ = node.right                             # case 3
        while succ.left is not None:
            succ = succ.left
        node.value = succ.value                       # copy the value up
        node.right = delete(node.right, succ.value)   # delete the successor
    return node
```

Cases 1 and 2 collapse into two lines: if either child is missing, return the other one — which is `None` for a leaf. That is the whole of cases 1 and 2.

:::key
The successor is **guaranteed to have no left child.** It was found by walking left until you could not, so it is either a leaf or has only a right child — case 1 or case 2. The recursive delete of the successor therefore never recurses into case 3, and the whole operation is one pass down and bounded work: **O(height).**
:::

:::example
Delete `3` from:

```
        8
       / \
      3   10
     / \    \
    1   6    14
       / \
      4   7
```

`3` has two children. Its successor is the leftmost node of its right subtree: from `6`, go left to `4`, which has no left child — so the successor is `4`.

Copy `4` into the node, then delete `4` from the right subtree. `4` is a leaf, so it is simply detached:

```
        8
       / \
      4   10
     / \    \
    1   6    14
         \
          7
```

In-order output is 1, 4, 6, 7, 8, 10, 14 — still sorted, so the invariant held.
:::

:::pitfall
Two errors are near-universal here.

**Deleting the successor node object instead of recursing.** After copying the value up, the successor still exists in the right subtree. You must actually remove it, and the clean way is a recursive `delete` on the subtree — which also handles the successor's own right child correctly. Unlinking it by hand drops that child.

**Recursing on the whole tree instead of the right subtree.** `delete(node, succ.value)` searches from the current node, whose value is now the successor's — so it matches immediately and deletes the node you just fixed, looping forever or corrupting the tree. It must be `delete(node.right, succ.value)`.
:::

## Cost, and the shape problem returning

**O(height)** — one walk down to the node, one walk down to the successor, both bounded by the height. O(log n) balanced, O(n) degenerate.

Deletion also makes shape *worse* over time. Always taking the successor removes nodes from the right subtree, so a long-lived tree under repeated delete-insert drifts left-heavy and the height creeps up even if it started balanced. Alternating between successor and predecessor is a cheap mitigation; the real fix is rebalancing, which is next.$md$,
 4, 30, 'bst-delete', 3),

('binary-search-trees', 'validating-a-bst', 'Validating a BST',
 'Checking each node against its own two children is the classic wrong answer. The invariant is about subtrees, so the check must carry a range.',
 $md$## The tempting wrong answer

```python
def is_bst_WRONG(node):
    if node is None: return True
    if node.left  and node.left.value  >= node.value: return False
    if node.right and node.right.value <= node.value: return False
    return is_bst_WRONG(node.left) and is_bst_WRONG(node.right)
```

Every node is checked against its children, and it returns `True` for trees that are not binary search trees.

:::pitfall
```
      10
     /  \
    5    15
        /  \
       6    20
```

Check every parent-child pair: `5 < 10` ✓, `15 > 10` ✓, `6 < 15` ✓, `20 > 15` ✓. Every local check passes.

But `6` is in the **right** subtree of `10`, and `6 < 10`. The invariant says *every* value in the right subtree exceeds 10. Search for `6`: at `10` it goes right, at `15` it goes left, and finds it — by luck. Search for `6` in a tree where it sits one level deeper and the search goes the wrong way entirely.

The local check cannot see this, because `6`'s constraint comes from `10` — its **grandparent** — and the function never compares them.
:::

## The correct check carries a range

Every node is constrained by all of its ancestors at once, and that accumulated constraint is an interval. Pass it down:

```python
def is_bst(node, lo=float('-inf'), hi=float('inf')):
    if node is None:
        return True
    if not (lo < node.value < hi):
        return False
    return (is_bst(node.left,  lo, node.value) and
            is_bst(node.right, node.value, hi))
```

Going left tightens the **upper** bound to the current value; going right tightens the **lower** bound. The root starts unbounded.

:::example
The broken tree above:

| Node | allowed range | ok? |
|---|---|---|
| 10 | (−∞, ∞) | ✓ |
| 5 | (−∞, 10) | ✓ |
| 15 | (10, ∞) | ✓ |
| **6** | **(10, 15)** | **✗** |

`6` is rejected, because descending right from `10` set the lower bound to 10 and it never loosened. The grandparent's constraint arrived as part of the range.
:::

## The other correct check: in-order must ascend

A BST's in-order traversal is sorted, so verifying that it ascends verifies the tree. You do not need to materialise the list — just keep the previous value:

```python
def is_bst_inorder(root):
    prev = None
    stack, node = [], root
    while stack or node:
        while node:                      # walk left, remembering the path
            stack.append(node)
            node = node.left
        node = stack.pop()
        if prev is not None and node.value <= prev:
            return False
        prev = node.value
        node = node.right
    return True
```

Both approaches are O(n) time. The range version uses O(height) for the call stack; the in-order version uses O(height) for its explicit stack and returns at the first descent, so it often stops early.

:::key
The lesson generalises past validation. Whenever a tree property depends on ancestors rather than just children, the information has to be **threaded down the recursion as a parameter**. Range-passing is that pattern, and it reappears in segment trees at the end of this course — where each node is responsible for a range it was told about on the way down.
:::

## One detail that bites

Using `-inf` and `inf` is clean in Python. In a language with fixed-width integers, initialising the bounds to `INT_MIN` and `INT_MAX` breaks on a tree that actually contains `INT_MIN` or `INT_MAX`, because `lo < value` is then false for a legitimate node. Pass nullable bounds and skip the comparison when a bound is absent, or use a wider type.

Equality is also a decision you must make deliberately: `lo < value < hi` rejects duplicates anywhere. If your insert keeps counts on nodes, that is correct. If your insert puts equal values to one side, this validator will reject your own trees — which is the right outcome, because the previous lesson explained that such a tree breaks range queries.$md$,
 3, 24, 'bst-validate', 4),

('binary-search-trees', 'self-balancing-avl', 'Self-Balancing Trees & AVL Rotations',
 'Four rotations keep the height logarithmic, so sorted input can no longer degenerate the tree.',
 $md$## The problem being solved

Every cost in this chapter is O(height), and height collapses to O(n) on sorted input. A **self-balancing** tree fixes the shape as it is built, so the height is O(log n) no matter what order the data arrives in.

## The AVL condition

For every node, the heights of its two subtrees differ by at most 1.

```
balance(node) = height(node.left) − height(node.right)       ∈ {−1, 0, +1}
```

A tree satisfying this everywhere has height at most about 1.44 log₂ n — within a constant factor of perfect. Each node stores its own height so the condition is checkable in O(1):

```python
def height(node):
    return 0 if node is None else node.height

def update(node):
    node.height = 1 + max(height(node.left), height(node.right))
```

## Rotation: the one primitive

A rotation re-parents a node and its child while preserving the in-order sequence. That last clause is the point — the BST invariant survives untouched.

```
    y                x
   / \     right    / \
  x   C    ---->   A   y
 / \       <----      / \
A   B      left      B   C
```

In-order both sides: `A x B y C`. Identical. Only the shape changed.

```python
def rotate_right(y):
    x, B = y.left, y.left.right
    x.right = y
    y.left  = B
    update(y); update(x)      # y first — it is now the lower node
    return x                  # the new subtree root
```

:::pitfall
`update(y)` must run before `update(x)`. Heights are computed from the children up, and after the rotation `y` is below `x`. Updating `x` first reads a stale height for `y` and silently stores a wrong value — after which the balance factors are wrong and the tree stops rebalancing correctly, with no error anywhere.
:::

## Four cases

After inserting, walk back up. At the first node whose balance factor reaches ±2, one of four shapes applies — named for the direction of the two steps from that node toward the new value:

| Case | Shape | Fix |
|---|---|---|
| **LL** | left child, left grandchild | one right rotation |
| **RR** | right child, right grandchild | one left rotation |
| **LR** | left child, **right** grandchild | left on the child, then right |
| **RL** | right child, **left** grandchild | right on the child, then left |

```python
def rebalance(node):
    update(node)
    b = height(node.left) - height(node.right)
    if b > 1:                                     # left-heavy
        if height(node.left.left) < height(node.left.right):
            node.left = rotate_left(node.left)    # LR -> LL
        return rotate_right(node)
    if b < -1:                                    # right-heavy
        if height(node.right.right) < height(node.right.left):
            node.right = rotate_right(node.right) # RL -> RR
        return rotate_left(node)
    return node
```

:::key
LL and RR are single rotations. LR and RL are **not** — a single rotation on a zig-zag shape produces a mirror-image zig-zag and the tree is no better balanced. The inner rotation straightens the zig-zag into a straight line first, turning LR into LL, and only then does the outer rotation work. Trying to fix LR with one rotation is the classic AVL mistake.
:::

:::example
Insert `1, 2, 3` into an empty AVL tree.

After `1, 2` the tree is `1 → 2` to the right, balance at `1` is −1 — still legal.

Insert `3`: now `1` has a right subtree of height 2 and no left subtree, so balance is −2. The two steps from `1` toward `3` are right, then right — the **RR** case. One left rotation about `1`:

```
  1                 2
   \               / \
    2      ->     1   3
     \
      3
```

Height 1 instead of 2. The sorted insertion that destroyed the plain BST produces a perfectly balanced tree here.
:::

## Cost

| Operation | Cost |
|---|---|
| Search | O(log n) — guaranteed, not expected |
| Insert | O(log n), at most **2** rotations |
| Delete | O(log n), up to **O(log n)** rotations |

Insertion needs at most one single-or-double rotation: fixing the lowest unbalanced node restores every ancestor's height. Deletion can shorten a subtree and cascade, so it may rotate at every level on the way up.

## AVL versus red-black

Both guarantee O(log n). They differ in how hard they work:

| | AVL | Red-black |
|---|---|---|
| Balance | strict (±1) | looser |
| Height | ≤ 1.44 log n | ≤ 2 log n |
| Lookups | **faster** | slightly slower |
| Insert/delete | more rotations | **fewer** |
| Used by | in-memory indexes | `std::map`, `TreeMap`, Linux schedulers |

Read-heavy workloads prefer AVL's shorter trees; write-heavy workloads prefer red-black's cheaper maintenance. Both exist for the same reason: without rebalancing, one sorted insert sequence turns every O(log n) promise in this chapter into O(n).$md$,
 5, 32, 'avl-rotations', 5),

-- === Chapter 3: Heaps & Priority Queues ===================================
('heaps', 'heap-property-and-heapify', 'The Heap Property & Building a Heap',
 'A weaker promise than a BST: only the root is known. That buys O(1) access to the extreme and an O(n) build.',
 $md$## A deliberately weaker invariant

A BST orders every node against every descendant, which is what lets it answer range and successor queries. A **heap** promises far less:

> every node is ≤ (min-heap) or ≥ (max-heap) **both of its children**.

That is all. There is no relation between siblings, and no relation between a node and its cousins. A heap is **not** sorted, and an in-order walk of a heap produces nothing useful.

What the weaker promise buys: the extreme value is at the root, reachable in O(1), and the structure is cheap to repair.

:::key
Choose by the question you need answered. "What is the smallest?" — heap, O(1). "Is 42 present?" — hash table, O(1) average; a heap needs O(n), because with no sibling ordering there is no side to discard. "What keys lie between 10 and 20?" — BST. Each structure gave something up to make one question cheap, and a heap gave up the most.
:::

## Always a complete tree, therefore always an array

A heap is kept **complete** — every level full except the last, which fills left to right. Completeness is what allows the pointer-free array layout from the first chapter:

```
parent(i) = (i - 1) // 2
left(i)   = 2i + 1
right(i)  = 2i + 2
```

No node objects, no allocation, perfect locality. `heap = [1, 3, 6, 5, 9, 8]` is a complete min-heap, and you can verify the property by index arithmetic alone.

:::example
```
        1
      /   \
     3     6
    / \   /
   5   9 8
```
Flattened level by level: `[1, 3, 6, 5, 9, 8]`.

Check index 1 (value 3): children are at 3 and 4 → 5 and 9. Both ≥ 3 ✓. Index 2 (value 6): child at 5 → 8 ≥ 6 ✓.

Note `6 < 9` even though 6 sits to the right of 9's parent. A heap does not care. Only the parent-child relation is constrained.
:::

## Repairing the property: sift down

If one node is too large for its position, push it down by repeatedly swapping it with its smaller child:

```python
def sift_down(heap, i, n):
    while True:
        smallest, l, r = i, 2*i + 1, 2*i + 2
        if l < n and heap[l] < heap[smallest]: smallest = l
        if r < n and heap[r] < heap[smallest]: smallest = r
        if smallest == i:
            return                      # both children are larger: done
        heap[i], heap[smallest] = heap[smallest], heap[i]
        i = smallest
```

O(log n) — one swap per level at worst.

:::pitfall
The swap must be with the **smaller of the two children**, not the first child that happens to be smaller than the parent. Swapping with the larger child can leave it above its own smaller sibling, so the property is still broken one level down and the loop has already moved past it. Compute `smallest` across both children before swapping.
:::

## Building a heap in O(n), not O(n log n)

The obvious build inserts n elements one at a time, each sifting up O(log n): **O(n log n)**.

The better build takes the unsorted array as a complete tree and sifts down from the last internal node backwards:

```python
def build_heap(a):
    for i in range(len(a) // 2 - 1, -1, -1):
        sift_down(a, i, len(a))
```

The leaves — the second half of the array — are already valid one-element heaps, so they are skipped entirely. Each remaining node is fixed only after both its subtrees are already heaps, which is why sifting down once is enough.

:::key
**Why this is O(n).** Sift-down's cost is the node's *height*, not the tree's. A heap has about n/2 nodes of height 0, n/4 of height 1, n/8 of height 2, and so on. The total is

```
Σ (n / 2^(h+1)) · h  =  n · Σ h/2^(h+1)  →  n · 1  =  O(n)
```

The sum converges to a constant, so the whole build is linear. The naive version is O(n log n) because sifting **up** costs the node's *depth*, and most nodes are deep — exactly the opposite distribution. Same tree, same n, different direction: one is linear, the other is not.
:::

## Cost summary

| Operation | Cost |
|---|---|
| Peek the extreme | **O(1)** |
| Insert | O(log n) |
| Extract the extreme | O(log n) |
| Build from an array | **O(n)** |
| Search for an arbitrary value | O(n) |
| Sorted output | O(n log n) |$md$,
 3, 28, 'heapify', 1),

('heaps', 'heap-operations', 'Insert, Extract & Heapsort',
 'Both mutations keep the tree complete by touching the last slot, then repair one path. Repeat the extraction and you have sorted in place.',
 $md$## Insert: add at the end, sift up

The structure must stay complete, so there is exactly one legal place for a new element — the next free slot at the end of the array. That may violate the heap property upward, so walk it up:

```python
def push(heap, value):
    heap.append(value)
    i = len(heap) - 1
    while i > 0:
        parent = (i - 1) // 2
        if heap[parent] <= heap[i]:
            return                                    # property restored
        heap[i], heap[parent] = heap[parent], heap[i]
        i = parent
```

**O(log n)** — at most one swap per level. Sifting up is simpler than sifting down because a node has one parent and no choice to make; there is no "pick the smaller child" step.

## Extract: swap the ends, shrink, sift down

Removing the root leaves a hole, and nothing may be left in the middle of a complete tree. So move the **last** element into the root, drop the last slot, and sift the new root down:

```python
def pop(heap):
    top = heap[0]
    last = heap.pop()                 # remove the final slot
    if heap:
        heap[0] = last                # fill the hole
        sift_down(heap, 0, len(heap))
    return top
```

**O(log n).**

:::pitfall
The hole is filled from the **end**, not by promoting the smaller child. Promoting a child moves the hole one level down and leaves it there, so after enough extractions the array has gaps, the index arithmetic no longer identifies children, and the structure is silently no longer a heap. Completeness is what makes the array layout legal — it cannot be broken even temporarily.
:::

:::example
Extract from `[1, 3, 6, 5, 9, 8]`.

Save `1`. Move the last element `8` to the root and drop the slot: `[8, 3, 6, 5, 9]`.

Sift `8` down: children are `3` and `6`; the smaller is `3`, and `3 < 8`, so swap → `[3, 8, 6, 5, 9]`. Now `8` is at index 1 with children `5` and `9`; the smaller is `5 < 8`, so swap → `[3, 5, 6, 8, 9]`. Index 3 has no children. Done.

Root is `3` — correctly the next smallest.
:::

## Heapsort: extract n times, in place

Build a **max**-heap, then repeatedly swap the root with the last unsorted slot and shrink the heap by one. The extracted maxima accumulate at the back, in increasing order:

```python
def heapsort(a):
    n = len(a)
    for i in range(n // 2 - 1, -1, -1):      # build: O(n)
        sift_down_max(a, i, n)
    for end in range(n - 1, 0, -1):          # extract n-1 times
        a[0], a[end] = a[end], a[0]
        sift_down_max(a, 0, end)             # heap is now one shorter
```

**O(n log n) time, O(1) extra space** — the sorted output is built in the same array, which is why a max-heap is used for ascending order.

| Sort | Time | Space | Stable |
|---|---|---|---|
| Heapsort | O(n log n) **guaranteed** | **O(1)** | no |
| Quicksort | O(n log n) average, O(n²) worst | O(log n) | no |
| Merge sort | O(n log n) guaranteed | O(n) | yes |

Heapsort is the only one of the three with both a guaranteed bound and constant space. In practice quicksort usually wins on wall-clock despite the worse bound, because its inner loop is a sequential scan while heapsort's sift-down jumps between indices `i`, `2i+1`, `2i+2` — scattered memory, poor locality. The same cache argument that favoured arrays over linked lists works against heapsort here.

:::key
This is why library sorts are hybrids. Introsort — used by C++ `std::sort` — runs quicksort for speed, and switches to heapsort once recursion gets too deep. That caps the worst case at O(n log n) while keeping quicksort's fast common case, using heapsort precisely for its guarantee.
:::

## The priority queue

A heap is the standard implementation of a priority queue: insert with a priority, remove the most urgent.

```python
import heapq
q = []
heapq.heappush(q, (2, 'write tests'))
heapq.heappush(q, (1, 'fix the build'))
heapq.heappop(q)        # (1, 'fix the build')
```

Python's `heapq` is a min-heap, so for highest-priority-first you push negated priorities. Tuples compare element by element, which gives ties a tiebreaker — and if the second element is not comparable, a tie raises. Push `(priority, counter, item)` with an incrementing counter to make the order total and deterministic.

Priority queues are the engine behind Dijkstra's algorithm and Prim's, both in the graphs course: "visit the nearest unvisited node next" is exactly one `pop` from a heap.$md$,
 3, 26, 'heap-extract', 2),

('heaps', 'top-k-with-heaps', 'Top-k Without Sorting',
 'A heap of size k, not n. The counter-intuitive part is that finding the k largest needs a MIN-heap.',
 $md$## The problem

Return the k largest values from a stream of n values, where k is small and n is large — possibly too large to hold in memory at all.

## Why sorting is the wrong tool

Sorting everything costs **O(n log n)** and requires all n values in memory. It also computes far more than you asked for: the exact order of the n − k values you are going to discard.

## A heap of size k

Keep a heap holding only the k best values seen so far. For each new value, compare it against the **worst** of those k and replace if it is better.

For the k *largest*, the "worst of the best" is the **smallest** of them — so the heap must be a **min**-heap:

```python
import heapq

def k_largest(stream, k):
    heap = []                                 # min-heap of the k largest
    for value in stream:
        if len(heap) < k:
            heapq.heappush(heap, value)
        elif value > heap[0]:                 # beats the weakest survivor
            heapq.heapreplace(heap, value)    # pop + push, one sift
    return heap
```

:::key
**k largest → min-heap. k smallest → max-heap.** This inversion is the single most-missed detail in the pattern.

The reason: the only element you ever need to look at is the one most at risk of being evicted — the weakest of your current k. A heap gives O(1) access to its root, so the root must *be* that weakest element. Among the k largest, the weakest is the smallest. Hence a min-heap.

Use a max-heap and `heap[0]` is the strongest of your k, which tells you nothing about whether the new value deserves a place.
:::

## Cost

| Approach | Time | Space |
|---|---|---|
| Sort everything | O(n log n) | O(n) |
| **Heap of size k** | **O(n log k)** | **O(k)** |
| Quickselect | O(n) average, O(n²) worst | O(1) |

Each of n values does at most one O(log k) heap operation. When k is small — "top 10 of a billion" — log k is tiny and effectively constant, and the space is O(k) regardless of n.

:::example
`[5, 1, 9, 3, 7]`, k = 2, min-heap.

| value | heap before | action | heap after |
|---|---|---|---|
| 5 | `[]` | fill | `[5]` |
| 1 | `[5]` | fill | `[1, 5]` |
| 9 | `[1, 5]` | 9 > 1 → replace | `[5, 9]` |
| 3 | `[5, 9]` | 3 < 5 → skip | `[5, 9]` |
| 7 | `[5, 9]` | 7 > 5 → replace | `[7, 9]` |

Result `{7, 9}` — correct. Note the heap contents are **not sorted**; they are the right *set*. Sorted output costs an extra O(k log k), and the question did not ask for it.
:::

## Why this is the streaming answer

The heap never holds more than k elements, so n can exceed memory. This is how "trending topics", "top queries this hour" and "slowest requests" are computed over feeds that are never fully stored. The alternatives both require the whole dataset in hand: sorting obviously, quickselect because it partitions the array in place.

:::pitfall
`heapreplace` pops then pushes in a single sift. Calling `heappush` followed by `heappop` is not equivalent — the heap briefly holds k+1 elements, and the element you just pushed may be the one popped straight back out, which wastes a sift and can make the logic harder to reason about. Use `heapreplace` when you have already established the new value beats the root.
:::

## When quickselect is better

If the whole array is in memory and you only need the k largest **as a set**, quickselect partitions around a pivot and recurses into one side only — **O(n) average**, no extra space, and it does not sort either side. Its worst case is O(n²) on adversarial pivots, which median-of-medians fixes at the cost of a large constant.

The decision:

- **stream, or k ≪ n, or n does not fit in memory** → heap of size k
- **array in memory, k comparable to n, average case acceptable** → quickselect
- **you need the k values in order** → either, then sort the k results$md$,
 4, 26, 'kth-largest', 3),

-- === Chapter 4: Tries & Range Trees =======================================
('specialised-trees', 'tries', 'Tries (Prefix Trees)',
 'Branch on characters instead of comparisons. Lookup costs the length of the key and is independent of how many keys are stored.',
 $md$## The idea

A BST stores whole keys and compares them. A **trie** stores keys one character at a time: each edge is a character, and a key is the path from the root to a marked node.

```python
class TrieNode:
    def __init__(self):
        self.children = {}          # character -> TrieNode
        self.is_word = False        # does a key END here?
```

Keys sharing a prefix share a path, so the prefix is stored once no matter how many keys start with it.

```
        (root)
        /    \
      c       d
      |       |
      a       o
     / \      |
    r   t     g*
    |   |
    s*  *            car, cat, cats, dog
```

## The two operations

```python
def insert(root, word):
    node = root
    for ch in word:
        node = node.children.setdefault(ch, TrieNode())
        node.is_word = node.is_word          # unchanged; shown for clarity
    node.is_word = True

def search(root, word):
    node = root
    for ch in word:
        if ch not in node.children:
            return False
        node = node.children[ch]
    return node.is_word                      # NOT just "we arrived"
```

:::pitfall
`search` must return `node.is_word`, not `True`. Arriving at a node only proves the string is a **prefix** of something stored. With `car` and `cats` inserted, walking `ca` lands on a real node — but `ca` was never inserted. Returning `True` there makes every prefix a false positive, and that is why the `is_word` flag exists at all.
:::

## The cost, and what is absent from it

| Operation | Trie | Hash table | Balanced BST |
|---|---|---|---|
| Insert / search | **O(L)** | O(L) average | O(L log n) |
| Keys with a prefix | **O(L + output)** | O(n) | O(L log n + output) |
| Sorted iteration | O(total chars) | impossible | O(n) |
| Worst case | **O(L) guaranteed** | O(n) on collisions | O(L log n) |

L is the key's length. **n does not appear.** Searching a trie holding ten keys and one holding ten million costs the same, because the walk is driven by the key, not by the collection.

The BST row is O(L log n) because each of its log n comparisons compares whole strings, costing O(L) each. People often quote BST lookup as O(log n) and forget the key comparison is not free for strings.

:::key
The trie's real advantage is the **prefix query**. "Every key starting with `ca`" is: walk L steps to the `ca` node, then collect everything below it. A hash table scattered its keys deliberately and must examine all n. This is why autocomplete, routing tables and spell-checkers are tries and not hash maps.
:::

## Prefix collection

```python
def with_prefix(root, prefix):
    node = root
    for ch in prefix:
        if ch not in node.children:
            return []
        node = node.children[ch]

    out = []
    def collect(node, path):
        if node.is_word:
            out.append(prefix + ''.join(path))
        for ch, child in sorted(node.children.items()):
            path.append(ch); collect(child, path); path.pop()
    collect(node, [])
    return out
```

Iterating `sorted(children)` makes the output alphabetical for free — ordered output a hash table cannot produce at all.

## The cost nobody mentions: memory

Each node carries a container of child pointers. A dict per node is flexible but has real overhead; a fixed array of 26 pointers is faster to index and wastes most of its slots, since few nodes have many children. A trie over long, non-overlapping keys can easily use more memory than storing the strings in a hash set.

Two standard mitigations:

- **Compressed trie (radix tree)** — collapse any chain of single-child nodes into one edge labelled with the whole substring. `dog` becomes a single edge rather than three nodes.
- **Child maps sized to reality** — a dict for sparse nodes, an array only near the root where branching is wide.

:::example
Insert `cat`, then `cats`.

`cat` creates three nodes; the one for `t` gets `is_word = True`.

`cats` walks the **existing** `c → a → t` path — no new nodes — and adds one node for `s`, marked `is_word`. Four nodes hold both keys, and the shared prefix `cat` is stored once.

Now `search("ca")` walks to a node that exists and returns `is_word`, which is `False`. `with_prefix("ca")` returns `["cat", "cats"]`.
:::

## Where they appear

Autocomplete and search suggestions, IP routing (longest-prefix match on address bits), dictionary and spell-check lookups, and word-search puzzles where a trie lets a DFS abandon a branch the instant the current path stops being a prefix of any word — pruning that no hash set can offer.$md$,
 3, 28, 'trie-prefix', 1),

('specialised-trees', 'segment-trees', 'Segment Trees',
 'Each node owns a range and stores its aggregate. Range queries and point updates both become O(log n).',
 $md$## The problem prefix sums cannot solve

Prefix sums (CS201) answer "sum of `a[l..r]`" in O(1) after an O(n) build. Their weakness is **updates**: changing one element invalidates every later prefix, so an update is O(n).

| | Plain array | Prefix sums | **Segment tree** |
|---|---|---|---|
| Range sum | O(n) | **O(1)** | O(log n) |
| Point update | **O(1)** | O(n) | O(log n) |

Prefix sums win when data is static. A segment tree is the answer when queries and updates are **interleaved**, which is the common case in practice.

## The structure

A binary tree in which every node owns a contiguous range and stores the aggregate of it. The root owns `[0, n-1]`; each internal node splits its range in half between its children; leaves own single elements.

```
                  [0..3] sum=10
                 /            \
         [0..1] sum=3      [2..3] sum=7
          /     \            /     \
    [0]=1     [1]=2     [2]=3     [3]=4
```

Stored in a flat array with the same index arithmetic as a heap — children of `i` at `2i+1` and `2i+2`. Allocate `4n` to be safe; the tree is not necessarily complete when n is not a power of two, and `4n` always suffices.

```python
def build(a, tree, node, lo, hi):
    if lo == hi:
        tree[node] = a[lo]
        return
    mid = (lo + hi) // 2
    build(a, tree, 2*node+1, lo, mid)
    build(a, tree, 2*node+2, mid+1, hi)
    tree[node] = tree[2*node+1] + tree[2*node+2]
```

O(n) — each node is computed once from its children.

## Query: three cases

The range you are asked about is compared with the range the node owns:

```python
def query(tree, node, lo, hi, l, r):
    if r < lo or hi < l:            # 1. disjoint — contributes nothing
        return 0
    if l <= lo and hi <= r:         # 2. fully inside — use the stored total
        return tree[node]
    mid = (lo + hi) // 2            # 3. partial — ask both children
    return (query(tree, 2*node+1, lo, mid, l, r) +
            query(tree, 2*node+2, mid+1, hi, l, r))
```

Case 2 is where the speed comes from: a node fully inside the query range is answered from one stored value, and its whole subtree is skipped.

:::key
**Why it is O(log n).** The query range's two endpoints each cut through at most one node per level, so at most four nodes per level are ever in the "partial" case. Everything else is answered or discarded immediately. With log n levels that is O(log n) nodes visited — not O(n) despite the recursion branching two ways.
:::

:::example
Sum of `a[1..2]` in the tree above (`a = [1,2,3,4]`).

| node | owns | vs [1,2] | result |
|---|---|---|---|
| root | [0..3] | partial | recurse |
| left | [0..1] | partial | recurse |
| [0] | [0] | disjoint | 0 |
| [1] | [1] | inside | **2** |
| right | [2..3] | partial | recurse |
| [2] | [2] | inside | **3** |
| [3] | [3] | disjoint | 0 |

Total 5, and `a[1] + a[2] = 2 + 3 = 5` ✓.
:::

## Update: fix one path

Change a leaf, then recompute every ancestor on the way back up. Exactly one path from root to leaf is touched:

```python
def update(a, tree, node, lo, hi, i, value):
    if lo == hi:
        tree[node] = value
        return
    mid = (lo + hi) // 2
    if i <= mid: update(a, tree, 2*node+1, lo, mid, i, value)
    else:        update(a, tree, 2*node+2, mid+1, hi, i, value)
    tree[node] = tree[2*node+1] + tree[2*node+2]
```

O(log n) — one node per level.

:::pitfall
The parent recombination `tree[node] = ...` must come **after** the recursive call. Writing it before means the parent is rebuilt from a child that has not changed yet, so the new value never propagates upward: the leaf is correct, every ancestor is stale, and queries silently return old sums.
:::

## It is not only sums

Nothing in the structure mentions addition. Any **associative** operation works — you only ever combine two adjacent sub-results:

| Combine | Answers |
|---|---|
| `+` | range sum |
| `min` / `max` | range minimum / maximum |
| `gcd` | range gcd |
| `and` / `or` / `xor` | range bitwise aggregate |

Swap the combine function and the identity returned in the disjoint case — `0` for sum, `+∞` for min — and the rest is unchanged. Associativity is required because the tree fixes the grouping; it does not need commutativity, which is why non-commutative merges like matrix products also work.

## Beyond this lesson

**Lazy propagation** extends updates from one element to a whole range in O(log n), by storing a "pending change" on a node and pushing it down only when a query needs to look inside. That is the standard competitive-programming tool, and it is what makes range-add-range-sum possible at the same cost.

The next lesson covers the Fenwick tree, which does prefix sums specifically with far less code and memory — and explains what it gives up to get there.$md$,
 5, 32, 'segment-tree', 2),

('specialised-trees', 'fenwick-trees', 'Fenwick Trees (Binary Indexed Trees)',
 'The same O(log n) prefix sums in one array and four lines, by letting each index own a range decided by its lowest set bit.',
 $md$## What it is for

A Fenwick tree — or binary indexed tree — answers **prefix sum** with **point update**, both in O(log n). A segment tree already does that, so why does this exist?

| | Segment tree | Fenwick tree |
|---|---|---|
| Memory | 4n | **n** |
| Code | ~40 lines | **~8 lines** |
| Constant factor | higher | **lower** |
| Arbitrary range `[l,r]` | direct | `prefix(r) − prefix(l−1)` |
| min / max | yes | **no** |

It is smaller, shorter and faster, and it handles strictly less. When you need prefix sums with updates, it is the right tool; when you need range minimum, it cannot help at all.

## The idea: the lowest set bit

Index `i` (1-based) is responsible for a range of length equal to its **lowest set bit**, ending at `i`.

```
lsb(i) = i & -i
```

| i | binary | lsb | covers |
|---|---|---|---|
| 1 | 0001 | 1 | `[1,1]` |
| 2 | 0010 | 2 | `[1,2]` |
| 3 | 0011 | 1 | `[3,3]` |
| 4 | 0100 | 4 | `[1,4]` |
| 6 | 0110 | 2 | `[5,6]` |
| 8 | 1000 | 8 | `[1,8]` |

`i & -i` isolates the lowest set bit because two's-complement negation flips every bit above it and leaves that bit set — a one-instruction operation doing the work a segment tree needs a recursion for.

## The two operations

```python
class Fenwick:
    def __init__(self, n):
        self.n = n
        self.t = [0] * (n + 1)              # 1-based; index 0 unused

    def add(self, i, delta):                # a[i] += delta
        while i <= self.n:
            self.t[i] += delta
            i += i & -i                     # next index that covers i

    def prefix(self, i):                    # a[1] + … + a[i]
        total = 0
        while i > 0:
            total += self.t[i]
            i -= i & -i                     # strip the lowest set bit
        return total

    def range_sum(self, l, r):
        return self.prefix(r) - self.prefix(l - 1)
```

Four lines of logic. `add` walks **up** by adding the lowest set bit — visiting every range that contains `i`. `prefix` walks **down** by stripping it — collecting disjoint ranges that exactly tile `[1, i]`.

Each loop runs once per set bit, so both are **O(log n)**.

:::key
`prefix` works because stripping the lowest set bit repeatedly decomposes `i` into its binary parts, and the range each visited index owns starts exactly where the next one ends. For `i = 7 = 0111`: index 7 covers `[7,7]`, index 6 covers `[5,6]`, index 4 covers `[1,4]`. Together `[1,4] + [5,6] + [7,7] = [1,7]` — no gap and no overlap. The binary representation of `i` *is* the partition.
:::

:::example
`a = [3, 2, 5, 1]` (1-based), so the tree holds:

| i | covers | value |
|---|---|---|
| 1 | `[1,1]` | 3 |
| 2 | `[1,2]` | 5 |
| 3 | `[3,3]` | 5 |
| 4 | `[1,4]` | 11 |

`prefix(3)`: start at 3 → add `t[3]`=5, `3 − 1 = 2` → add `t[2]`=5, `2 − 2 = 0` stop. Total **10**, and `3+2+5 = 10` ✓.

`add(1, +4)`: i=1 → `t[1]` becomes 7, `1+1=2` → `t[2]` becomes 9, `2+2=4` → `t[4]` becomes 15, `4+4=8 > 4` stop. Three updates, the three ranges containing index 1.

Now `prefix(3)` = `t[3]` + `t[2]` = 5 + 9 = **14**, and `7+2+5 = 14` ✓.
:::

:::pitfall
Fenwick trees are **1-based**, and this is not a style choice. `i & -i` is 0 when `i` is 0, so `add` at index 0 loops forever and `prefix(0)` correctly returns 0 as the empty prefix. Converting a 0-based array means adding 1 on the way in; forgetting it produces an infinite loop on the first update to the first element.
:::

## Why min and max do not work

`range_sum` is computed as `prefix(r) − prefix(l−1)` — it **subtracts** away the part it does not want. Subtraction requires an invertible operation. Sum and xor are invertible; min and max are not. Knowing the minimum of `[1,7]` and of `[1,3]` tells you nothing about the minimum of `[4,7]`.

This is the whole of what the Fenwick tree traded away for its size and simplicity, and it is why a segment tree remains necessary for range minimum.

## Choosing between them

- **Prefix or range sums, point updates** → Fenwick. Less memory, less code, smaller constant.
- **Range min/max/gcd**, or **range updates** with lazy propagation, or a non-invertible merge → segment tree.
- **No updates at all** → plain prefix sums: O(n) build, O(1) query, and nothing beats it.

:::key
All three are the same idea at different points on one trade-off. Prefix sums precompute everything and cannot be changed. A Fenwick tree precomputes overlapping partial sums so one element touches only log n of them. A segment tree stores every range explicitly, which costs more and buys operations that cannot be undone by subtraction. Pick the least powerful structure that answers your question — it will be the fastest.
:::$md$,
 5, 30, 'fenwick-tree', 3)

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
  -- within CS203
  ('breadth-first-traversal',   'binary-tree-fundamentals', 'trees-heaps-and-ordered-structures'),
  ('bst-invariant-and-search',  'binary-tree-fundamentals', 'trees-heaps-and-ordered-structures'),
  ('bst-insertion',             'bst-invariant-and-search', 'trees-heaps-and-ordered-structures'),
  ('bst-deletion',              'bst-insertion',            'trees-heaps-and-ordered-structures'),
  ('validating-a-bst',          'bst-invariant-and-search', 'trees-heaps-and-ordered-structures'),
  ('self-balancing-avl',        'bst-deletion',             'trees-heaps-and-ordered-structures'),
  ('self-balancing-avl',        'validating-a-bst',         'trees-heaps-and-ordered-structures'),
  ('heap-property-and-heapify', 'binary-tree-fundamentals', 'trees-heaps-and-ordered-structures'),
  ('heap-operations',           'heap-property-and-heapify','trees-heaps-and-ordered-structures'),
  ('top-k-with-heaps',          'heap-operations',          'trees-heaps-and-ordered-structures'),
  ('tries',                     'binary-tree-fundamentals', 'trees-heaps-and-ordered-structures'),
  ('segment-trees',             'binary-tree-fundamentals', 'trees-heaps-and-ordered-structures'),
  ('fenwick-trees',             'segment-trees',            'trees-heaps-and-ordered-structures'),
  -- reaching back into CS201
  ('binary-tree-fundamentals',  'array-fundamentals',       'data-structures-fundamentals'),
  ('breadth-first-traversal',   'queue-fundamentals',       'data-structures-fundamentals'),
  ('segment-trees',             'prefix-sums',              'data-structures-fundamentals'),
  -- reaching back into CS202
  ('binary-tree-fundamentals',  'linked-list-fundamentals', 'linked-structures-and-hashing'),
  ('tries',                     'hash-tables',              'linked-structures-and-hashing'),
  ('bst-invariant-and-search',  'hash-tables',              'linked-structures-and-hashing')
) AS v(concept_slug, prereq_slug, prereq_course)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters cch ON cch.id = c.chapter_id
JOIN public.courses cco ON cco.id = cch.course_id AND cco.slug = 'trees-heaps-and-ordered-structures'
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
  AND co.slug = 'trees-heaps-and-ordered-structures';

INSERT INTO public.learning_objectives (concept_id, objective, position)
SELECT c.id, v.objective, v.position
FROM (VALUES
  ('binary-tree-fundamentals', 'Distinguish depth from height and compute both for a given tree', 1),
  ('binary-tree-fundamentals', 'Explain why every tree operation costs O(height) and what makes height O(n)', 2),
  ('binary-tree-fundamentals', 'Produce pre-, in- and post-order output for a tree and say what each is used for', 3),
  ('binary-tree-fundamentals', 'Explain why iterative pre-order pushes the right child before the left', 4),
  ('breadth-first-traversal', 'Convert a depth-first traversal into breadth-first by changing the container', 1),
  ('breadth-first-traversal', 'Use the queue length to group a traversal by level', 2),
  ('breadth-first-traversal', 'Choose between DFS and BFS from the question asked and the space available', 3),
  ('bst-invariant-and-search', 'State the BST invariant in terms of subtrees rather than children', 1),
  ('bst-invariant-and-search', 'Explain why in-order traversal of a BST is sorted', 2),
  ('bst-invariant-and-search', 'Name three ordered queries a BST answers and a hash table cannot', 3),
  ('bst-invariant-and-search', 'Find the in-order successor in both the right-subtree and ancestor cases', 4),
  ('bst-insertion', 'Insert into a BST and explain why every new node is a leaf', 1),
  ('bst-insertion', 'Show how sorted insertion order degenerates a BST into a list', 2),
  ('bst-insertion', 'Build a height-balanced BST from sorted input in O(n)', 3),
  ('bst-deletion', 'Handle the leaf and one-child deletion cases', 1),
  ('bst-deletion', 'Delete a two-child node using the in-order successor', 2),
  ('bst-deletion', 'Explain why the successor has no left child and why that bounds the cost', 3),
  ('validating-a-bst', 'Explain why checking each node against its children is insufficient', 1),
  ('validating-a-bst', 'Validate a BST by passing a narrowing range down the recursion', 2),
  ('validating-a-bst', 'Validate a BST by checking that in-order output strictly ascends', 3),
  ('self-balancing-avl', 'State the AVL balance condition and compute a balance factor', 1),
  ('self-balancing-avl', 'Explain why a rotation preserves the in-order sequence', 2),
  ('self-balancing-avl', 'Identify the LL, RR, LR and RL cases and apply the right rotations', 3),
  ('self-balancing-avl', 'Explain why LR and RL need two rotations rather than one', 4),
  ('heap-property-and-heapify', 'State the heap property and explain why a heap is not sorted', 1),
  ('heap-property-and-heapify', 'Map a complete tree onto an array using index arithmetic', 2),
  ('heap-property-and-heapify', 'Implement sift-down and explain why it swaps with the smaller child', 3),
  ('heap-property-and-heapify', 'Explain why bottom-up heap construction is O(n) and insertion-based is O(n log n)', 4),
  ('heap-operations', 'Implement push with sift-up and pop with sift-down', 1),
  ('heap-operations', 'Explain why the root hole is filled from the last slot', 2),
  ('heap-operations', 'Implement heapsort in place and state its space advantage', 3),
  ('heap-operations', 'Explain why quicksort often beats heapsort despite the worse bound', 4),
  ('top-k-with-heaps', 'Find the k largest values with a size-k heap in O(n log k)', 1),
  ('top-k-with-heaps', 'Explain why the k largest requires a min-heap rather than a max-heap', 2),
  ('top-k-with-heaps', 'Choose between a size-k heap and quickselect from the constraints', 3),
  ('tries', 'Insert and search a trie, and explain the role of the is_word flag', 1),
  ('tries', 'Explain why trie lookup is independent of the number of stored keys', 2),
  ('tries', 'Implement prefix collection and say why a hash table cannot do it', 3),
  ('tries', 'Describe the memory cost of a trie and how a radix tree reduces it', 4),
  ('segment-trees', 'Explain why prefix sums fail under updates and a segment tree does not', 1),
  ('segment-trees', 'Implement range query using the disjoint, contained and partial cases', 2),
  ('segment-trees', 'Explain why the query visits only O(log n) nodes', 3),
  ('segment-trees', 'Adapt a sum segment tree to min or gcd and state what the merge must satisfy', 4),
  ('fenwick-trees', 'Compute the lowest set bit and state which range an index owns', 1),
  ('fenwick-trees', 'Implement add and prefix, explaining why one walks up and the other down', 2),
  ('fenwick-trees', 'Explain why a Fenwick tree cannot answer range minimum', 3),
  ('fenwick-trees', 'Choose between prefix sums, a Fenwick tree and a segment tree for a workload', 4)
) AS v(concept_slug, objective, position)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'trees-heaps-and-ordered-structures';

-- ---------------------------------------------------------------------------
-- 6. Misconception catalogue
-- ---------------------------------------------------------------------------
INSERT INTO public.concept_misconceptions (concept_id, code, statement, correction, probe)
SELECT c.id, v.code, v.statement, v.correction, v.probe
FROM (VALUES
  ('binary-tree-fundamentals', 'trees-are-log-n',
   'Operations on a binary tree are O(log n).',
   'They are O(height). Height is log n only when the tree is balanced; a tree where every node has one child has height n-1 and every operation is O(n).',
   'Insert 1,2,3,4,5 in that order into a plain binary search tree. Draw it, give its height, and state the cost of searching for 5.'),
  ('binary-tree-fundamentals', 'depth-equals-height',
   'Depth and height are the same measurement.',
   'Depth is counted downward from the root to a node; height is the longest path from a node down to a leaf. The root has depth 0 and height equal to the tree height.',
   'For a 3-level perfect tree, give the depth and the height of the root, and of any leaf.'),
  ('binary-tree-fundamentals', 'push-left-first',
   'Iterative pre-order should push the left child first, since left is visited first.',
   'A stack returns the last item pushed. To pop left first you must push it last, so the right child is pushed first. Pushing left first produces a mirrored traversal.',
   'Push left then right for the tree 1 with children 2 and 3. Write the visit order and compare it with recursive pre-order.'),

  ('breadth-first-traversal', 'level-size-inside-loop',
   'You can read the queue length inside the draining loop to find the level boundary.',
   'Children appended during the round change the length. The size must be captured before the round starts and the loop must drain exactly that many nodes.',
   'Run level order on a 3-level tree, re-reading len(queue) each iteration. What shape does the output have, and why is there no error?'),
  ('breadth-first-traversal', 'bfs-always-less-space',
   'BFS uses less memory than DFS.',
   'DFS holds one root-to-leaf path: O(height). BFS holds one level: O(width). On a balanced tree the widest level is about n/2, so BFS is O(n) and DFS is O(log n). On a degenerate tree it reverses.',
   'For a perfect tree of 1023 nodes, state the peak memory of DFS and of BFS in node counts.'),

  ('bst-invariant-and-search', 'invariant-is-about-children',
   'A BST only requires each node to be larger than its left child and smaller than its right child.',
   'The rule covers entire subtrees, not immediate children. A node deep in the right subtree must still exceed the root, which a child-only check cannot detect.',
   'Build a tree where every parent-child pair is ordered correctly but the tree is not a BST. Name the node that violates the invariant and the ancestor it violates.'),
  ('bst-invariant-and-search', 'bst-beats-hash',
   'A balanced BST and a hash table are interchangeable.',
   'A hash table is faster for presence tests, averaging O(1) against O(log n). A BST answers ordered questions - minimum, successor, range - that a hash table cannot answer without scanning everything.',
   'Which structure answers "all keys between 10 and 20" efficiently, and what is the other one''s cost for the same question?'),

  ('bst-insertion', 'insertion-order-irrelevant',
   'The same values always produce the same BST.',
   'The shape is determined entirely by insertion order. 4,2,6,1,3,5,7 gives height 2; the same seven values inserted in sorted order give height 6.',
   'Insert 1..7 in sorted order and then in the order 4,2,6,1,3,5,7. Give both heights.'),
  ('bst-insertion', 'duplicates-go-right',
   'Equal values can be inserted to the right like any larger value.',
   'That breaks the strict invariant that the right subtree holds only greater values, so validation and range queries then disagree with the tree. Keep a count on the node instead.',
   'Insert 5 twice, sending the duplicate right. Run the range-based validator. What does it report, and is it wrong?'),
  ('bst-insertion', 'sorted-build-by-insert',
   'The fastest way to build a BST from sorted data is to insert each element.',
   'That degenerates the tree and costs O(n^2). Recursing on the middle element gives a height-balanced tree in O(n).',
   'You hold 1,000,000 sorted values. Give the cost of building by repeated insertion and of building by recursing on the midpoint.'),

  ('bst-deletion', 'promote-a-child',
   'To delete a node with two children, promote one of its children.',
   'The other subtree then has no legal place to attach. Instead copy the in-order successor''s value into the node and delete the successor, which has at most one child.',
   'Delete the root of a tree where it has two full subtrees by promoting the left child. Which values are now in the wrong position?'),
  ('bst-deletion', 'delete-from-whole-tree',
   'After copying the successor value up, delete that value starting from the current node.',
   'The current node now holds the successor value, so the search matches it immediately and deletes the node you just repaired. The recursive delete must start at the right child.',
   'Trace delete(node, succ.value) from the node itself after the copy. Which node is removed, and what happens to the tree?'),
  ('bst-deletion', 'successor-may-have-two-children',
   'The in-order successor could have two children, so deleting it is also hard.',
   'The successor was found by walking left until there was no left child, so it has no left child by construction. It is always the leaf or one-child case.',
   'Explain, from how the successor is located, why it cannot have a left child.'),

  ('validating-a-bst', 'local-check-sufficient',
   'A BST is valid if every node is between its left and right child.',
   'Constraints come from all ancestors, not just the parent. A value can satisfy its parent and still violate its grandparent, so the check must carry a narrowing range.',
   'For the tree 10 with left 5 and right 15, where 15 has left child 6: list the allowed range at each node and name the first rejection.'),
  ('validating-a-bst', 'int-bounds-safe',
   'Initialising the range to INT_MIN and INT_MAX is safe.',
   'A tree containing INT_MIN fails the strict comparison against its own initial bound. Use nullable bounds and skip absent comparisons, or a wider type.',
   'A valid single-node tree holds INT_MIN. What does a validator initialised with INT_MIN bounds return, and why?'),

  ('self-balancing-avl', 'rotation-breaks-invariant',
   'Rotating a subtree can break the BST ordering.',
   'A rotation is chosen precisely so the in-order sequence is unchanged. Only the shape changes, which is why it is safe to apply for balance.',
   'Write the in-order sequence before and after a right rotation of y over x with subtrees A, B, C. Compare them.'),
  ('self-balancing-avl', 'single-rotation-fixes-lr',
   'Any AVL imbalance is fixed by one rotation.',
   'LL and RR need one. LR and RL are zig-zags: one rotation produces a mirrored zig-zag of the same height. An inner rotation straightens it first, then the outer one rebalances.',
   'Insert 3, 1, 2 into an AVL tree. Identify the case, apply a single right rotation, and give the resulting height.'),
  ('self-balancing-avl', 'update-order',
   'After a rotation the heights can be recomputed in any order.',
   'Heights depend on children. The node that moved down must be updated first, or the node above it reads a stale height and stores a wrong one, with no error raised.',
   'In rotate_right(y) returning x, state which of x and y must be updated first and what goes wrong otherwise.'),

  ('heap-property-and-heapify', 'heap-is-sorted',
   'A heap stores its elements in sorted order.',
   'Only the parent-child relation is constrained. Siblings and cousins are unordered, so the array is not sorted and an in-order walk means nothing. Sorted output costs O(n log n).',
   'Give a valid min-heap array whose elements are not in ascending order, and name two elements with no ordering relation.'),
  ('heap-property-and-heapify', 'heap-search-log-n',
   'Searching a heap for an arbitrary value is O(log n).',
   'Searching needs a side to discard, which requires sibling ordering. A heap has none, so search is O(n). Only the extreme is cheap.',
   'Look for the value 7 in a min-heap whose root is 1. Which subtrees can you rule out, and what is the resulting complexity?'),
  ('heap-property-and-heapify', 'heapify-is-n-log-n',
   'Building a heap from an array costs O(n log n).',
   'Bottom-up sift-down is O(n), because sift-down costs a node''s height and most nodes are near the leaves. Inserting one at a time is O(n log n), because sift-up costs depth and most nodes are deep.',
   'For n = 8, sum the sift-down work over all internal nodes and compare it with 8 log 8.'),
  ('heap-property-and-heapify', 'swap-any-smaller-child',
   'Sift-down can swap with whichever child is smaller than the parent.',
   'It must swap with the smaller of the two children. Swapping with the larger one leaves it above its smaller sibling, so the property is still violated below the point you have passed.',
   'Sift down a parent 9 with children 5 and 3 by swapping with 5. Check the heap property at the new position of 9.'),

  ('heap-operations', 'fill-hole-from-child',
   'After removing the root, fill the hole by promoting the smaller child.',
   'That moves the hole down and leaves a gap, breaking completeness - and the array layout depends on completeness for its index arithmetic. The hole is filled from the last slot.',
   'Pop from [1,3,6,5,9,8] by promoting children. Write the resulting array and explain why index 2''s children can no longer be computed.'),
  ('heap-operations', 'heapsort-min-heap-ascending',
   'Ascending heapsort uses a min-heap.',
   'In-place heapsort swaps the root to the end of the unsorted region, so the extracted extreme lands at the back. Ascending order therefore needs the largest first: a max-heap.',
   'Run in-place heapsort with a min-heap. What order does the array end up in, and why?'),

  ('top-k-with-heaps', 'k-largest-max-heap',
   'To find the k largest values, keep a max-heap of size k.',
   'The only element you need to inspect is the weakest of the current k, since that is the one a new value must beat. Among the k largest the weakest is the smallest, so the heap must be a min-heap.',
   'Keep a max-heap of size 2 over 5,1,9,3,7. What does heap[0] tell you when 7 arrives, and which element should have been evicted?'),
  ('top-k-with-heaps', 'must-sort-for-top-k',
   'Finding the top k requires sorting the data.',
   'Sorting is O(n log n) and computes the order of the n-k values you discard. A size-k heap is O(n log k) and O(k) space, and works on a stream that never fits in memory.',
   'For n = 10^9 and k = 10, give the time and space of sorting versus a size-k heap.'),

  ('tries', 'arrived-means-found',
   'If the walk reaches a node, the key is in the trie.',
   'Reaching a node only proves the string is a prefix of some stored key. Membership requires the is_word flag, which is why the flag exists.',
   'Insert only "cats". Search for "cat". Which node do you reach, and what should the function return?'),
  ('tries', 'trie-depends-on-n',
   'Trie lookup gets slower as more keys are inserted.',
   'The walk is driven by the key''s characters, so it is O(L) regardless of how many keys are stored. n does not appear in the cost.',
   'Compare lookup cost for a trie holding 10 keys and one holding 10 million, for the same 8-character key.'),
  ('tries', 'trie-always-smaller',
   'A trie saves memory because it shares prefixes.',
   'It shares prefixes but stores a child container per node. For long keys with little overlap a trie can use far more memory than a hash set of the same strings; radix compression is the mitigation.',
   'You store 1000 random 20-character keys with almost no shared prefixes. Compare node count with storing the strings in a hash set.'),

  ('segment-trees', 'prefix-sums-enough',
   'Prefix sums handle range sums, so a segment tree is unnecessary.',
   'Prefix sums are O(1) to query but O(n) to update, because one change invalidates every later prefix. A segment tree is O(log n) for both, which wins when queries and updates interleave.',
   'You perform 10^5 updates interleaved with 10^5 range queries. Give the total cost for prefix sums and for a segment tree.'),
  ('segment-trees', 'query-is-linear',
   'A segment tree query can visit every node, so it is O(n).',
   'A node fully inside the range is answered from its stored value and its subtree is skipped. Only nodes straddling an endpoint recurse, and there are at most a constant number per level: O(log n).',
   'Query [1,2] on a 4-leaf tree. List the nodes visited and classify each as disjoint, contained or partial.'),
  ('segment-trees', 'recombine-before-recurse',
   'The parent total can be recomputed before recursing into the child.',
   'The child has not changed yet, so the parent is rebuilt from a stale value and the update never propagates. Recombination must follow the recursive call.',
   'Update a leaf with the recombination placed before the recursion. Which values are correct afterwards and which are stale?'),

  ('fenwick-trees', 'fenwick-does-min',
   'A Fenwick tree can answer range minimum like a segment tree.',
   'Range queries are computed as prefix(r) minus prefix(l-1), which requires an invertible operation. Min has no inverse, so the subtraction is meaningless. Use a segment tree.',
   'You know min over [1,7] and min over [1,3]. Can you deduce min over [4,7]? Explain what sum has that min lacks.'),
  ('fenwick-trees', 'zero-based-fine',
   'A Fenwick tree works with 0-based indexing.',
   'i & -i is 0 when i is 0, so the update loop never advances and spins forever, and prefix(0) must mean the empty prefix. The structure is 1-based and callers must convert.',
   'Call add(0, 5) on a 0-based Fenwick tree. Trace the loop and state what happens.')
) AS v(concept_slug, code, statement, correction, probe)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'trees-heaps-and-ordered-structures'
ON CONFLICT (concept_id, code) DO UPDATE
  SET statement = EXCLUDED.statement,
      correction = EXCLUDED.correction,
      probe = EXCLUDED.probe;

-- ---------------------------------------------------------------------------
-- 7. Coding problems
--    Trees are posed as level-order arrays with null for a missing child, so
--    the grader compares plain JSON and needs no node type. That is the same
--    convention LeetCode uses, so the representation is already familiar.
-- ---------------------------------------------------------------------------
INSERT INTO public.coding_problems (concept_id, slug, title, prompt, difficulty, starter_code, test_cases, expected_complexity, hints, status)
SELECT c.id, v.slug, v.title, v.prompt, v.difficulty,
       v.starter_code::jsonb, v.test_cases::jsonb, v.complexity, v.hints::jsonb,
       'published'::public.content_status
FROM (VALUES

('binary-tree-fundamentals', 'tree-height-from-level-array', 'Height of a Tree',
 E'A binary tree is given as a level-order array `nodes`, where `nodes[i]` is the value at index `i` or `null` if that position is empty. The children of index `i` are at `2i+1` and `2i+2`.\n\nReturn the **height** of the tree — the number of edges on the longest root-to-leaf path. An empty tree has height `-1`; a single root has height `0`.\n\nNote the array may be longer than the tree is deep, with trailing nulls.',
 2,
 '{"python":"def tree_height(nodes):\n    # children of i are at 2i+1 and 2i+2; null means absent\n    pass\n","javascript":"function treeHeight(nodes) {\n  // children of i are at 2i+1 and 2i+2; null means absent\n}\n"}',
 '[{"args":[[1,2,3,4,5]],"expected":2,"hidden":false},{"args":[[1]],"expected":0,"hidden":false},{"args":[[]],"expected":-1,"hidden":false},{"args":[[1,2,null,3]],"expected":2,"hidden":true},{"args":[[1,null,2,null,null,null,3]],"expected":2,"hidden":true},{"args":[[1,2,3]],"expected":1,"hidden":true}]',
 'O(n) time',
 '["Recurse: the height of a node is 1 + the larger of its children''s heights.","Return -1 for an absent node, so a leaf computes 1 + max(-1, -1) = 0.","Guard the index against the array length as well as checking for null — a child index can run past the end."]',
 'published'),

('breadth-first-traversal', 'level-order-groups', 'Group a Tree by Level',
 E'A binary tree is given as a level-order array `nodes` (`null` marks an absent position; children of `i` are at `2i+1` and `2i+2`).\n\nReturn an array of arrays: the values at depth 0, then depth 1, and so on. Absent positions contribute nothing, and a level with no present nodes must not appear.\n\nUse the queue-length technique from the lesson rather than computing depths with logarithms.',
 3,
 '{"python":"from collections import deque\n\ndef level_groups(nodes):\n    # Capture the level size before draining it.\n    pass\n","javascript":"function levelGroups(nodes) {\n  // Capture the level size before draining it.\n}\n"}',
 '[{"args":[[1,2,3,4,5]],"expected":[[1],[2,3],[4,5]],"hidden":false},{"args":[[1]],"expected":[[1]],"hidden":false},{"args":[[]],"expected":[],"hidden":false},{"args":[[1,2,null,3]],"expected":[[1],[2],[3]],"hidden":true},{"args":[[1,null,2]],"expected":[[1],[2]],"hidden":true}]',
 'O(n) time, O(width) space',
 '["Push index 0, then loop while the queue is non-empty.","Read the queue length once at the top of each round and drain exactly that many.","Only enqueue a child index if it is within bounds and not null, so empty levels never form."]',
 'published'),

('bst-invariant-and-search', 'bst-contains', 'Search a BST',
 E'A binary search tree is given as a level-order array `nodes` (`null` for absent; children of `i` at `2i+1`, `2i+2`). Given a `target`, return `true` if it is present.\n\nDo **not** scan the array. Start at index 0 and use the BST invariant to choose a side at each step, so the number of nodes you examine is the height of the tree and not its size.',
 2,
 '{"python":"def bst_contains(nodes, target):\n    # Walk down from index 0. One comparison per level.\n    pass\n","javascript":"function bstContains(nodes, target) {\n  // Walk down from index 0. One comparison per level.\n}\n"}',
 '[{"args":[[8,3,10,1,6,null,14],6],"expected":true,"hidden":false},{"args":[[8,3,10,1,6,null,14],7],"expected":false,"hidden":false},{"args":[[],1],"expected":false,"hidden":false},{"args":[[8,3,10,1,6,null,14],14],"expected":true,"hidden":true},{"args":[[8,3,10,1,6,null,14],1],"expected":true,"hidden":true},{"args":[[5],5],"expected":true,"hidden":true}]',
 'O(height) time, O(1) space',
 '["If target is less than the current value, move to 2i+1; if greater, move to 2i+2.","Stop when the index is out of bounds or the slot is null — that means the value is absent.","A while loop needs no recursion here, so the space is O(1)."]',
 'published'),

('validating-a-bst', 'validate-bst-array', 'Is It a Valid BST?',
 E'A binary tree is given as a level-order array `nodes` (`null` for absent; children of `i` at `2i+1`, `2i+2`). Return `true` if it satisfies the binary search tree invariant: every value in a node''s left subtree is strictly less than it, and every value in its right subtree is strictly greater.\n\nChecking each node against its immediate children is **not** sufficient — one of the tests below is exactly that trap. Carry a permitted range down the recursion.',
 3,
 '{"python":"def is_valid_bst(nodes):\n    # Pass a (low, high) range down. Going left tightens high; right tightens low.\n    pass\n","javascript":"function isValidBst(nodes) {\n  // Pass a (low, high) range down. Going left tightens high; right tightens low.\n}\n"}',
 '[{"args":[[8,3,10,1,6,null,14]],"expected":true,"hidden":false},{"args":[[10,5,15,null,null,6,20]],"expected":false,"hidden":false},{"args":[[]],"expected":true,"hidden":false},{"args":[[5]],"expected":true,"hidden":true},{"args":[[2,1,3]],"expected":true,"hidden":true},{"args":[[5,1,4,null,null,3,6]],"expected":false,"hidden":true},{"args":[[5,5,null]],"expected":false,"hidden":true}]',
 'O(n) time, O(height) space',
 '["Recurse with (low, high). A node is legal only if low < value < high.","Going left, the new high is the current value. Going right, the new low is the current value.","The second visible test is the classic failure: 6 sits in 10''s right subtree, so its range is (10, 15) and 6 is rejected."]',
 'published'),

('heap-property-and-heapify', 'is-valid-min-heap', 'Is It a Min-Heap?',
 E'Given an array `a` representing a complete binary tree in level order, return `true` if it satisfies the **min-heap** property: every node is less than or equal to both of its children.\n\nChildren of index `i` are at `2i+1` and `2i+2`. An empty array and a single element are both valid heaps.\n\nYou do not need to check whether the array is sorted — a heap is not sorted, and one of the tests depends on you knowing that.',
 2,
 '{"python":"def is_min_heap(a):\n    # Check each parent against the children that exist.\n    pass\n","javascript":"function isMinHeap(a) {\n  // Check each parent against the children that exist.\n}\n"}',
 '[{"args":[[1,3,6,5,9,8]],"expected":true,"hidden":false},{"args":[[1,3,6,5,9,2]],"expected":false,"hidden":false},{"args":[[]],"expected":true,"hidden":false},{"args":[[5]],"expected":true,"hidden":true},{"args":[[1,2,3,17,19,36,7]],"expected":false,"hidden":true},{"args":[[2,2,2]],"expected":true,"hidden":true}]',
 'O(n) time, O(1) space',
 '["Loop i over the internal nodes only — those with index below len(a)//2.","Guard each child index against the array length before comparing.","Equal values are allowed: the property is <=, not <. The last hidden test relies on it."]',
 'published'),

('top-k-with-heaps', 'k-largest-values', 'The k Largest Values',
 E'Given an array `values` and an integer `k`, return the `k` largest values in **descending** order.\n\nAim for O(n log k) using a heap of size k rather than sorting all of `values`. If `k` is greater than or equal to the length of the array, return everything in descending order.\n\nRemember which kind of heap the k largest requires — it is not the obvious one.',
 3,
 '{"python":"import heapq\n\ndef k_largest(values, k):\n    # Keep a heap of size k. Think about which extreme must be at the root.\n    pass\n","javascript":"function kLargest(values, k) {\n  // Keep the k best seen so far. Think about which extreme you must inspect.\n}\n"}',
 '[{"args":[[5,1,9,3,7],2],"expected":[9,7],"hidden":false},{"args":[[1,2,3],5],"expected":[3,2,1],"hidden":false},{"args":[[4],1],"expected":[4],"hidden":false},{"args":[[],3],"expected":[],"hidden":true},{"args":[[2,2,2,1],2],"expected":[2,2],"hidden":true},{"args":[[-5,-1,-9],2],"expected":[-1,-5],"hidden":true}]',
 'O(n log k) time, O(k) space',
 '["Use a MIN-heap of size k. Its root is the weakest of your current best k, which is the only one a new value must beat.","Fill the heap to k first, then for each later value compare it against the root and replace if it is larger.","The heap contents are the right set but not sorted — sort the k results descending before returning."]',
 'published'),

('fenwick-trees', 'lowest-set-bit', 'Lowest Set Bit',
 E'Return the value of the **lowest set bit** of a positive integer `n` — that is, the largest power of two that divides `n`.\n\nFor example `lsb(12) = 4`, because 12 is `1100` and the lowest set bit is in the 4s place. `lsb(8) = 8`, `lsb(7) = 1`.\n\nThis is the one operation a Fenwick tree is built from. The two-line bit trick is the point; a loop dividing by two also works but misses the idea.',
 2,
 '{"python":"def lowest_set_bit(n):\n    # One expression is enough.\n    pass\n","javascript":"function lowestSetBit(n) {\n  // One expression is enough.\n}\n"}',
 '[{"args":[12],"expected":4,"hidden":false},{"args":[8],"expected":8,"hidden":false},{"args":[7],"expected":1,"hidden":false},{"args":[1],"expected":1,"hidden":true},{"args":[48],"expected":16,"hidden":true},{"args":[1024],"expected":1024,"hidden":true},{"args":[6],"expected":2,"hidden":true}]',
 'O(1) time',
 '["n & -n isolates the lowest set bit, because negation in two''s complement flips every bit above it and leaves that one set.","In JavaScript the bitwise operators work on 32-bit integers, which is fine for every input here.","Check it by hand on 12 = 1100: -12 is ...10100, and the AND leaves 0100 = 4."]',
 'published')

) AS v(concept_slug, slug, title, prompt, difficulty, starter_code, test_cases, complexity, hints, status)
JOIN public.concepts c ON c.slug = v.concept_slug
JOIN public.chapters ch ON ch.id = c.chapter_id
JOIN public.courses co ON co.id = ch.course_id AND co.slug = 'trees-heaps-and-ordered-structures'
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      prompt = EXCLUDED.prompt,
      difficulty = EXCLUDED.difficulty,
      starter_code = EXCLUDED.starter_code,
      test_cases = EXCLUDED.test_cases,
      expected_complexity = EXCLUDED.expected_complexity,
      hints = EXCLUDED.hints,
      status = EXCLUDED.status;
