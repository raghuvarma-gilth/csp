/**
 * The frame contract for the 3D DSA lab.
 *
 * This file is the seam the whole lab is built around, inherited from the
 * standalone prototype and made explicit here: an algorithm is a *pure*
 * function `(values, params, ctx) => Frame[]`, and a renderer knows how to draw
 * a frame and nothing else. No algorithm imports three.js; no renderer knows
 * what a heap is.
 *
 * Two things fall out of that, and both matter:
 *
 *   * The algorithms run in Node with no browser and no GPU, so
 *     `scripts/verify-lab.ts` can execute all of them and check the answers are
 *     actually right — not merely that nothing threw.
 *   * What a student watches is a recording of the algorithm running on their
 *     input. Change the input and the animation changes, because the animation
 *     was never separate from the code. Nothing here is hand-drawn to look
 *     convincing.
 *
 * Colours are hex strings rather than numbers because they are written by the
 * algorithms, where readability wins; the renderers convert once at the
 * boundary.
 */

/** A `#rrggbb` string. */
export type Hex = string;

/* -------------------------------------------------------------------------- */
/* Palette                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One palette for every algorithm, so a yellow cube means the same thing in
 * quicksort as it does in a trie. Kept as hex strings for the reason above.
 */
export const C = {
  /** Untouched. */
  base: "#2563eb",
  /** Being looked at right now. */
  inspect: "#eab308",
  /** Settled — sorted, visited, found. */
  done: "#22c55e",
  /** Being removed, or rejected. */
  remove: "#ef4444",
  /** Moving — a shift, a rotation, a rehash. */
  move: "#f59e0b",
  /** Pointers, cursors, and the secondary row. */
  cursor: "#38bdf8",
  /** The active window or subrange. */
  window: "#a855f7",
  /** Out of play — pruned, out of range, already emitted. */
  faded: "#475569",
} as const;

/* -------------------------------------------------------------------------- */
/* Array frames                                                                */
/* -------------------------------------------------------------------------- */

export interface ArrayPointer {
  index: number;
  label: string;
  color?: Hex;
}

/**
 * A second row drawn behind the main one. This is what lets a single renderer
 * cover KMP (pattern above, LPS table behind), counting sort (values above,
 * buckets behind), and 1-D dynamic programming (input above, table behind)
 * without three near-identical renderers.
 */
export interface ArraySecondary {
  label: string;
  values: Array<string | number>;
  highlights?: Record<number, Hex>;
  /** Replaces the `[i]` caption under a cell. */
  labels?: Record<number, string>;
}

export interface ArrayFrame {
  type: "array";
  values: Array<string | number>;
  highlights: Record<number, Hex>;
  pointers: ArrayPointer[];
  description: string;
  codeLine: number;
  /** Inclusive `[left, right]`, drawn as a translucent box. */
  windowRange: [number, number] | null;
  /** `ring` closes the row into a circle — the circular queue's whole point. */
  orientation: "horizontal" | "vertical" | "ring";
  secondary?: ArraySecondary | null;
  /** Replaces the `[i]` caption — a character, a key, a distance. */
  labels?: Record<number, string>;
}

/* -------------------------------------------------------------------------- */
/* Linked list frames                                                          */
/* -------------------------------------------------------------------------- */

export type NodeId = string | number;

export interface ListNodeFrame {
  id: NodeId;
  value: string | number;
}

export interface ListPointer {
  nodeId: NodeId;
  label: string;
  color?: Hex;
}

export interface LinkedListFrame {
  type: "linkedlist";
  nodes: ListNodeFrame[];
  highlights: Record<NodeId, Hex>;
  description: string;
  codeLine: number;
  /** Draws the backward arrows too. */
  doubly?: boolean;
  /** Closes the last node back to the first. */
  circular?: boolean;
  /** Where the tail points, for Floyd's cycle detection. `null` means nowhere. */
  cycleTo?: number | null;
  pointers?: ListPointer[];
}

/* -------------------------------------------------------------------------- */
/* Tree frames                                                                 */
/* -------------------------------------------------------------------------- */

export interface TreeNodeFrame {
  id: NodeId;
  value: string | number;
  /** Laid out by the caller — see `layoutTree` in `frames.ts`. */
  x: number;
  y: number;
  parentId?: NodeId | null;
  /** A small chip beside the node: an AVL balance factor, a distance. */
  badge?: string;
  /** A caption under the node: a segment tree's `[0..3]`, a trie's word marker. */
  subLabel?: string;
  /** Drawn translucent — a node being detached, or a position not yet filled. */
  ghost?: boolean;
}

export interface TreeFrame {
  type: "tree";
  nodes: TreeNodeFrame[];
  highlights: Record<NodeId, Hex>;
  description: string;
  codeLine: number;
}

/* -------------------------------------------------------------------------- */
/* Graph frames                                                                */
/* -------------------------------------------------------------------------- */

export interface GraphNodeFrame {
  id: number;
  label?: string;
  x: number;
  z: number;
  /** A distance in Dijkstra, an in-degree in Kahn's algorithm. */
  badge?: string;
}

export type EdgeState = "idle" | "active" | "chosen" | "rejected";

export interface GraphEdgeFrame {
  from: number;
  to: number;
  weight?: number;
  state?: EdgeState;
  directed?: boolean;
}

export interface GraphFrame {
  type: "graph";
  nodes: GraphNodeFrame[];
  edges: GraphEdgeFrame[];
  highlights: Record<number, Hex>;
  description: string;
  codeLine: number;
}

/* -------------------------------------------------------------------------- */
/* Grid frames                                                                 */
/* -------------------------------------------------------------------------- */

export interface GridCell {
  value: string | number;
  color?: Hex;
  /** Raises the cell — a wall in a maze, a filled DP entry. */
  raised?: boolean;
}

/**
 * A 2-D board. One renderer serves matrix traversals, grid BFS, N-Queens and
 * every 2-D dynamic programming table, which is why it carries headers.
 */
export interface GridFrame {
  type: "grid";
  cells: Array<Array<GridCell | null>>;
  description: string;
  codeLine: number;
  rowHeaders?: string[];
  colHeaders?: string[];
  /** Drawn as a ring around the cell being written. */
  cursor?: { row: number; col: number } | null;
}

/* -------------------------------------------------------------------------- */
/* Hash table frames                                                           */
/* -------------------------------------------------------------------------- */

export interface HashEntry {
  key: string | number;
  value?: string | number;
  color?: Hex;
}

export interface HashBucket {
  index: number;
  entries: HashEntry[];
  color?: Hex;
}

export interface HashFrame {
  type: "hash";
  buckets: HashBucket[];
  description: string;
  codeLine: number;
  /** The probe sequence walked so far, drawn as a trail. */
  probe?: number[];
}

/* -------------------------------------------------------------------------- */
/* Towers of Hanoi frames                                                      */
/* -------------------------------------------------------------------------- */

export interface TowersFrame {
  type: "towers";
  /** Three pegs, each bottom-to-top; the number is the disk size. */
  pegs: number[][];
  description: string;
  codeLine: number;
  /** The disk currently in the air. */
  lifted?: number | null;
}

/* -------------------------------------------------------------------------- */
/* The union                                                                   */
/* -------------------------------------------------------------------------- */

export type Frame =
  | ArrayFrame
  | LinkedListFrame
  | TreeFrame
  | GraphFrame
  | GridFrame
  | HashFrame
  | TowersFrame;

export type FrameType = Frame["type"];

/* -------------------------------------------------------------------------- */
/* Module registry                                                             */
/* -------------------------------------------------------------------------- */

export interface ParamDef {
  key: string;
  label: string;
  type: "number" | "text";
  default: number | string;
  min?: number;
  max?: number;
  /** Shown under the input when the value needs explaining. */
  hint?: string;
}

export type ParamValues = Record<string, number | string>;

/**
 * State that outlives a single run.
 *
 * The prototype kept `treeRoot`, `heapArr` and `currentGraph` as module-level
 * `let`s, which is why two copies of it on one page would have fought over the
 * same tree. Here it is an object created per mount and threaded through
 * `generate`, so "build a tree, then search it" still works and two labs on one
 * page stay independent.
 */
export interface LabContext {
  bst: unknown;
  avl: unknown;
  trie: unknown;
  heap: number[];
  heapKind: "max" | "min";
  graph: unknown;
  dsu: unknown;
  segment: unknown;
  fenwick: unknown;
  hash: unknown;
}

export const createLabContext = (): LabContext => ({
  bst: null,
  avl: null,
  trie: null,
  heap: [],
  heapKind: "max",
  graph: null,
  dsu: null,
  segment: null,
  fenwick: null,
  hash: null,
});

export interface OpDef {
  label: string;
  /** Groups the operation inside the operation dropdown. */
  group?: string;
  params: ParamDef[];
  generate: (values: number[], params: ParamValues, ctx: LabContext) => Frame[];
  pseudocode: string[];
  /** Free-form rows — `Time`, `Space`, and sometimes `Best` or `Worst`. */
  complexity: Record<string, string>;
}

export interface ModuleDef {
  icon: string;
  label: string;
  /** False for modules that make their own data, like the graph generator. */
  usesValues: boolean;
  /** Sensible starting input, used when the module is opened. */
  sample?: string;
  ops: Record<string, OpDef>;
}

export interface SidebarSection {
  label: string;
  keys: string[];
}

/* -------------------------------------------------------------------------- */
/* Small shared helpers                                                        */
/* -------------------------------------------------------------------------- */

export const numberParam = (params: ParamValues, key: string, fallback: number): number => {
  const raw = Number(params[key]);
  return Number.isFinite(raw) ? raw : fallback;
};

export const textParam = (params: ParamValues, key: string, fallback: string): string => {
  const raw = params[key];
  return typeof raw === "string" && raw.length > 0 ? raw : fallback;
};
