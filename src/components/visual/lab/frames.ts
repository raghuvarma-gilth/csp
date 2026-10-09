/**
 * Pure frame builders.
 *
 * Nothing in here imports three.js, and nothing in here touches the DOM. These
 * are the functions the algorithm files call to describe a step, and they are
 * the reason `scripts/verify-lab.ts` can execute the whole lab in Node.
 *
 * Ported from the standalone prototype's `snapshot`, `rangeHighlight`,
 * `makeObj`, `pathHighlight`, `layoutTree`, `clampIndex` and `parseValues`, with
 * the opaque names replaced by ones that say what they do.
 */

import type {
  ArrayFrame,
  ArrayPointer,
  GraphEdgeFrame,
  GraphFrame,
  GraphNodeFrame,
  GridCell,
  GridFrame,
  HashBucket,
  HashFrame,
  Hex,
  LinkedListFrame,
  ListNodeFrame,
  NodeId,
  TowersFrame,
  TreeFrame,
  TreeNodeFrame,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Highlight maps                                                              */
/* -------------------------------------------------------------------------- */

/** One highlighted key. The prototype called this `makeObj`. */
export const mark = <K extends NodeId>(key: K, color: Hex): Record<K, Hex> =>
  ({ [key]: color } as Record<K, Hex>);

/** Many keys, one colour. The prototype called this `pathHighlight`. */
export const markAll = (keys: readonly NodeId[], color: Hex): Record<NodeId, Hex> => {
  const out: Record<NodeId, Hex> = {};
  keys.forEach((key) => {
    out[key] = color;
  });
  return out;
};

/** Every index in the inclusive range `[l, r]`. */
export const rangeHighlight = (l: number, r: number, color: Hex): Record<number, Hex> => {
  const out: Record<number, Hex> = {};
  for (let i = l; i <= r; i += 1) out[i] = color;
  return out;
};

/* -------------------------------------------------------------------------- */
/* Input parsing                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Turns the values field into numbers, dropping anything that is not one. A
 * student typing `5, 3, , x, 8` gets `[5, 3, 8]` rather than an error or a `NaN`
 * cube — the input box is for exploring, not for validating.
 */
export const parseValues = (raw: string): number[] =>
  String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(Number)
    .filter((value) => !Number.isNaN(value));

/** Rounds, defaults to 0, then clamps into `[0, max]`. */
export const clampIndex = (value: number | string, max: number): number => {
  let i = Math.round(Number(value));
  if (Number.isNaN(i)) i = 0;
  return Math.max(0, Math.min(i, Math.max(0, max)));
};

/* -------------------------------------------------------------------------- */
/* Array frames                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The workhorse. Positional on purpose: it is called several hundred times
 * across the algorithm files and `snapshot(arr, {}, [], "Sorted!", 3)` stays
 * readable in a way an options object would not. The eighth argument carries the
 * rarely-needed extras so the common call stays short.
 */
export function snapshot(
  values: ReadonlyArray<string | number>,
  highlights?: Record<number, Hex> | null,
  pointers?: readonly ArrayPointer[] | null,
  description?: string,
  codeLine?: number,
  windowRange?: [number, number] | null,
  orientation?: ArrayFrame["orientation"],
  extra?: Partial<Pick<ArrayFrame, "secondary" | "labels">>,
): ArrayFrame {
  return {
    type: "array",
    values: values.slice(),
    highlights: highlights ?? {},
    pointers: pointers ? pointers.slice() : [],
    description: description ?? "",
    codeLine: codeLine ?? 0,
    windowRange: windowRange ?? null,
    orientation: orientation ?? "horizontal",
    secondary: extra?.secondary ?? null,
    labels: extra?.labels,
  };
}

/** `snapshot` with the stack's vertical orientation baked in. */
export const stackSnapshot = (
  values: ReadonlyArray<string | number>,
  highlights?: Record<number, Hex> | null,
  pointers?: readonly ArrayPointer[] | null,
  description?: string,
  codeLine?: number,
): ArrayFrame => snapshot(values, highlights, pointers, description, codeLine, null, "vertical");

export const pointer = (index: number, label: string, color: Hex): ArrayPointer => ({
  index,
  label,
  color,
});

/* -------------------------------------------------------------------------- */
/* Linked list frames                                                          */
/* -------------------------------------------------------------------------- */

/** `[5, 3]` becomes `[{ id: "n0", value: 5 }, { id: "n1", value: 3 }]`. */
export const listNodes = (values: ReadonlyArray<string | number>): ListNodeFrame[] =>
  values.map((value, i) => ({ id: `n${i}`, value }));

export function listFrame(
  nodes: readonly ListNodeFrame[],
  highlights?: Record<NodeId, Hex> | null,
  description?: string,
  codeLine?: number,
  extra?: Partial<Pick<LinkedListFrame, "doubly" | "circular" | "cycleTo" | "pointers">>,
): LinkedListFrame {
  return {
    type: "linkedlist",
    nodes: nodes.slice(),
    highlights: highlights ?? {},
    description: description ?? "",
    codeLine: codeLine ?? 0,
    ...extra,
  };
}

/* -------------------------------------------------------------------------- */
/* Tree frames                                                                 */
/* -------------------------------------------------------------------------- */

/** The shape `layoutTree` walks. Every tree structure in the lab uses it. */
export interface LayoutTreeNode {
  id: NodeId;
  value: string | number;
  left?: LayoutTreeNode | null;
  right?: LayoutTreeNode | null;
  /** Copied through to the frame — a balance factor, a distance. */
  badge?: string;
  /** Copied through to the frame — a segment range, an end-of-word marker. */
  subLabel?: string;
  ghost?: boolean;
}

const NODE_GAP_X = 3.4;
const NODE_GAP_Y = 3.2;

/**
 * In-order x-placement: each node sits one slot right of the previous node in
 * in-order sequence, and `y` is minus its depth. That is the classic layout and
 * it guarantees no two nodes overlap, which a naive `x = parent.x ± width/2^d`
 * does not. Finally the whole tree is shifted so it straddles the origin.
 *
 * Ported from the prototype unchanged, apart from being generic over the node
 * shape and carrying `badge` / `subLabel` / `ghost` through.
 */
export function layoutTree(root: LayoutTreeNode | null | undefined): TreeNodeFrame[] {
  if (!root) return [];
  const nodes: TreeNodeFrame[] = [];
  let column = 0;

  const assign = (node: LayoutTreeNode | null | undefined, depth: number, parentId: NodeId | null) => {
    if (!node) return;
    assign(node.left, depth + 1, node.id);
    const x = column * NODE_GAP_X;
    column += 1;
    nodes.push({
      id: node.id,
      value: node.value,
      x,
      y: -depth * NODE_GAP_Y,
      parentId,
      badge: node.badge,
      subLabel: node.subLabel,
      ghost: node.ghost,
    });
    assign(node.right, depth + 1, node.id);
  };

  assign(root, 0, null);
  const maxX = nodes.reduce((acc, node) => Math.max(acc, node.x), 0);
  nodes.forEach((node) => {
    node.x -= maxX / 2;
  });
  return nodes;
}

/**
 * The same job for trees whose nodes have any number of children — a trie, or a
 * recursion tree. Leaves are placed left to right; a parent is centred over its
 * children, which is what makes a 26-way trie readable where the binary layout
 * would not be.
 */
export interface NaryTreeNode {
  id: NodeId;
  value: string | number;
  children?: NaryTreeNode[];
  badge?: string;
  subLabel?: string;
  ghost?: boolean;
}

export function layoutNaryTree(root: NaryTreeNode | null | undefined): TreeNodeFrame[] {
  if (!root) return [];
  const nodes: TreeNodeFrame[] = [];
  let leafColumn = 0;

  const assign = (node: NaryTreeNode, depth: number, parentId: NodeId | null): number => {
    const children = node.children ?? [];
    let x: number;
    if (children.length === 0) {
      x = leafColumn * NODE_GAP_X;
      leafColumn += 1;
    } else {
      const childXs = children.map((child) => assign(child, depth + 1, node.id));
      x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    }
    nodes.push({
      id: node.id,
      value: node.value,
      x,
      y: -depth * NODE_GAP_Y,
      parentId,
      badge: node.badge,
      subLabel: node.subLabel,
      ghost: node.ghost,
    });
    return x;
  };

  assign(root, 0, null);
  const maxX = nodes.reduce((acc, node) => Math.max(acc, node.x), 0);
  const minX = nodes.reduce((acc, node) => Math.min(acc, node.x), 0);
  const centre = (maxX + minX) / 2;
  nodes.forEach((node) => {
    node.x -= centre;
  });
  return nodes;
}

export function treeFrame(
  nodes: readonly TreeNodeFrame[],
  highlights?: Record<NodeId, Hex> | null,
  description?: string,
  codeLine?: number,
): TreeFrame {
  return {
    type: "tree",
    nodes: nodes.slice(),
    highlights: highlights ?? {},
    description: description ?? "",
    codeLine: codeLine ?? 0,
  };
}

/** The "you have not built one yet" frame, shared by every stateful module. */
export const emptyTreeFrame = (description: string): TreeFrame =>
  treeFrame([], {}, description, 0);

/* -------------------------------------------------------------------------- */
/* Graph frames                                                                */
/* -------------------------------------------------------------------------- */

/** Vertices evenly spaced on a circle of the given radius, in the xz-plane. */
export const circleLayout = (count: number, radius = 9): Array<{ x: number; z: number }> =>
  Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
  });

export function graphFrame(
  nodes: readonly GraphNodeFrame[],
  edges: readonly GraphEdgeFrame[],
  highlights?: Record<number, Hex> | null,
  description?: string,
  codeLine?: number,
): GraphFrame {
  return {
    type: "graph",
    nodes: nodes.slice(),
    edges: edges.map((edge) => ({ ...edge })),
    highlights: highlights ?? {},
    description: description ?? "",
    codeLine: codeLine ?? 0,
  };
}

export const emptyGraphFrame = (description: string): GraphFrame =>
  graphFrame([], [], {}, description, 0);

/* -------------------------------------------------------------------------- */
/* Grid, hash and towers frames                                                */
/* -------------------------------------------------------------------------- */

export function gridFrame(
  cells: ReadonlyArray<ReadonlyArray<GridCell | null>>,
  description?: string,
  codeLine?: number,
  extra?: Partial<Pick<GridFrame, "rowHeaders" | "colHeaders" | "cursor">>,
): GridFrame {
  return {
    type: "grid",
    cells: cells.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    description: description ?? "",
    codeLine: codeLine ?? 0,
    ...extra,
  };
}

export function hashFrame(
  buckets: readonly HashBucket[],
  description?: string,
  codeLine?: number,
  probe?: number[],
): HashFrame {
  return {
    type: "hash",
    buckets: buckets.map((bucket) => ({
      ...bucket,
      entries: bucket.entries.map((entry) => ({ ...entry })),
    })),
    description: description ?? "",
    codeLine: codeLine ?? 0,
    probe,
  };
}

export function towersFrame(
  pegs: ReadonlyArray<readonly number[]>,
  description?: string,
  codeLine?: number,
  lifted?: number | null,
): TowersFrame {
  return {
    type: "towers",
    pegs: pegs.map((peg) => peg.slice()),
    description: description ?? "",
    codeLine: codeLine ?? 0,
    lifted: lifted ?? null,
  };
}
