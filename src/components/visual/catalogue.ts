/**
 * The visualisation index.
 *
 * Deliberately tiny and free of logic: the gallery imports this, while the
 * trace builders and the player — which are far larger — load only when a
 * student opens one. Keeping the metadata here is also what stops the gallery
 * and the player disagreeing about what a visualisation is called.
 *
 * `key` matches `concepts.visual_key` in the database. A concept whose
 * visual_key has no entry here simply shows no visualiser link; it is never
 * linked to a screen that cannot draw it.
 */

export type VisualGroup = "Arrays" | "Stacks" | "Queues";

export interface VisualMeta {
  key: string;
  title: string;
  subtitle: string;
  complexity: string;
  group: VisualGroup;
}

export const VISUAL_CATALOGUE: VisualMeta[] = [
  {
    key: "array-memory",
    title: "Arrays in memory",
    subtitle: "Why indexing costs the same no matter how far in you reach",
    complexity: "Access O(1)",
    group: "Arrays",
  },
  {
    key: "array-shift",
    title: "Inserting into an array",
    subtitle: "The hidden cost of making room at the front",
    complexity: "Insert at front O(n)",
    group: "Arrays",
  },
  {
    key: "two-pointers",
    title: "Two pointers",
    subtitle: "Discarding a whole row or column with each comparison",
    complexity: "O(n) time, O(1) space",
    group: "Arrays",
  },
  {
    key: "sliding-window",
    title: "Sliding window",
    subtitle: "Reusing the previous window instead of recomputing it",
    complexity: "O(n) time, O(1) space",
    group: "Arrays",
  },
  {
    key: "prefix-sum",
    title: "Prefix sums",
    subtitle: "Turning every range query into one subtraction",
    complexity: "Build O(n), query O(1)",
    group: "Arrays",
  },
  {
    key: "stack",
    title: "Stack",
    subtitle: "Last in, first out — and why both operations are O(1)",
    complexity: "push/pop O(1)",
    group: "Stacks",
  },
  {
    key: "stack-brackets",
    title: "Balanced brackets",
    subtitle: "The stack remembers exactly what is still owed",
    complexity: "O(n) time, O(n) space",
    group: "Stacks",
  },
  {
    key: "monotonic-stack",
    title: "Monotonic stack",
    subtitle: "Next greater element, one pop per index",
    complexity: "O(n) — each index pushed and popped once",
    group: "Stacks",
  },
  {
    key: "queue",
    title: "Queue",
    subtitle: "First in, first out",
    complexity: "enqueue/dequeue O(1)",
    group: "Queues",
  },
  {
    key: "circular-queue",
    title: "Circular queue",
    subtitle: "Reusing the front of a fixed buffer instead of shifting",
    complexity: "enqueue/dequeue O(1)",
    group: "Queues",
  },
  {
    key: "monotonic-deque",
    title: "Monotonic deque",
    subtitle: "Sliding window maximum without rescanning the window",
    complexity: "O(n) — each index enters and leaves once",
    group: "Queues",
  },
];

export const VISUAL_GROUPS: VisualGroup[] = ["Arrays", "Stacks", "Queues"];

export const visualMeta = (key: string): VisualMeta | undefined =>
  VISUAL_CATALOGUE.find((entry) => entry.key === key);

export const hasVisual = (key: string | null | undefined): boolean =>
  Boolean(key && VISUAL_CATALOGUE.some((entry) => entry.key === key));
