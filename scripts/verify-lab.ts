/**
 * Runs the whole visual lab in Node — no browser, no three.js, no WebGL.
 *
 * This is possible because of one architectural rule the lab keeps: an algorithm
 * is a pure `(values, params, ctx) => Frame[]`, and nothing under
 * `lab/algorithms/`, `lab/modules/`, `lab/frames.ts` or `lab/types.ts` imports
 * three.js. `registry.ts` is the single consumer of all of them, so importing it
 * here reaches every one of the ~144 operations.
 *
 * What it is for: the lab has no unit tests and its output is a 3-D canvas, so a
 * wrong answer looks exactly like a right one. A student watching Dijkstra has no
 * way to know the distances are wrong. These checks are the substitute for that
 * judgement — they run the operations and compare them against independently
 * computed answers.
 *
 * Deliberately **not** typechecked by `npm run typecheck`: `tsconfig.app.json`
 * includes only `src`, and `tsconfig.node.json` only `vite.config.ts`. That is
 * fine — this is a runtime assertion script, and its value is in running it.
 * Imports are relative for the same reason: `tsx` is not guaranteed to resolve
 * the `@/*` path alias, and `scripts/generate-seo.ts` sets the precedent.
 *
 *     npm run verify:lab
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { VISUAL_CATALOGUE } from "../src/components/visual/catalogue";
import { MODULES, SECTIONS, allOperations, moduleDef, opDef } from "../src/components/visual/lab/registry";
import {
  createLabContext,
  type ArrayFrame,
  type Frame,
  type FrameType,
  type GraphFrame,
  type OpDef,
  type ParamValues,
  type TreeFrame,
} from "../src/components/visual/lab/types";

/* -------------------------------------------------------------------------- */
/* Harness                                                                     */
/* -------------------------------------------------------------------------- */

let checks = 0;
let failures = 0;
const failed: string[] = [];

const expect = (label: string, condition: boolean, detail = ""): boolean => {
  checks += 1;
  if (!condition) {
    failures += 1;
    failed.push(label);
    console.error(`  FAIL  ${label}${detail ? `\n          ${detail}` : ""}`);
  }
  return condition;
};

const section = (title: string) => {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
};

/* -------------------------------------------------------------------------- */
/* Running an operation                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The same split as `DsaLab.tsx` uses on the values box — commas, spaces and
 * semicolons all separate, because students paste from all three. Duplicated
 * rather than imported so this script depends only on the pure layer.
 */
const parseValues = (text: string): number[] =>
  text
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map(Number)
    .filter((value) => Number.isFinite(value));

const defaultParams = (op: OpDef): ParamValues =>
  Object.fromEntries(op.params.map((param) => [param.key, param.default]));

const paramDefault = (op: OpDef, key: string): number | string | undefined =>
  op.params.find((param) => param.key === key)?.default;

/** One run, with a fresh context — exactly what the component does per render. */
const run = (
  moduleKey: string,
  opKey: string,
  overrides: ParamValues = {},
  valuesText?: string,
): Frame[] => {
  const module = MODULES[moduleKey];
  const op = module.ops[opKey];
  const values = module.usesValues ? parseValues(valuesText ?? module.sample ?? "") : [];
  return op.generate(values, { ...defaultParams(op), ...overrides }, createLabContext());
};

const lastFrame = (frames: Frame[]): Frame | null => frames[frames.length - 1] ?? null;

const lastOfType = <T extends FrameType>(frames: Frame[], type: T): Extract<Frame, { type: T }> | null => {
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    if (frames[i].type === type) return frames[i] as Extract<Frame, { type: T }>;
  }
  return null;
};

/* -------------------------------------------------------------------------- */
/* Frame shape contracts                                                       */
/* -------------------------------------------------------------------------- */

const HEX = /^#[0-9a-f]{3,8}$/i;

const isScalar = (value: unknown): boolean => typeof value === "string" || typeof value === "number";

const hexMapProblem = (map: unknown, what: string): string | null => {
  if (map === null || map === undefined) return null;
  if (typeof map !== "object") return `${what} is not an object`;
  for (const [key, colour] of Object.entries(map as Record<string, unknown>)) {
    if (typeof colour !== "string" || !HEX.test(colour)) {
      return `${what}[${key}] is ${JSON.stringify(colour)}, not a hex colour`;
    }
  }
  return null;
};

/**
 * One validator per frame type, keyed by `FrameType` so the union and this table
 * cannot drift apart. Each returns a problem string, or null when the frame
 * satisfies what its renderer assumes about it.
 */
const SHAPE: Record<FrameType, (frame: Frame) => string | null> = {
  array: (raw) => {
    const frame = raw as ArrayFrame;
    if (!Array.isArray(frame.values)) return "values is not an array";
    if (!frame.values.every(isScalar)) return "values contains something that is neither a string nor a number";
    const highlights = hexMapProblem(frame.highlights, "highlights");
    if (highlights) return highlights;
    if (!Array.isArray(frame.pointers)) return "pointers is not an array";
    for (const p of frame.pointers) {
      if (!Number.isInteger(p.index)) return `pointer "${p.label}" has a non-integer index`;
      if (typeof p.label !== "string") return "a pointer has no label";
    }
    if (!["horizontal", "vertical", "ring"].includes(frame.orientation)) {
      return `orientation "${frame.orientation}" is not one the renderer knows`;
    }
    if (frame.windowRange && frame.windowRange.length !== 2) return "windowRange is not a pair";
    if (frame.secondary) {
      if (typeof frame.secondary.label !== "string") return "secondary row has no label";
      if (!Array.isArray(frame.secondary.values)) return "secondary row has no values";
    }
    return null;
  },

  linkedlist: (raw) => {
    const frame = raw as Extract<Frame, { type: "linkedlist" }>;
    if (!Array.isArray(frame.nodes)) return "nodes is not an array";
    const ids = new Set<string>();
    for (const node of frame.nodes) {
      if (!isScalar(node.id)) return "a node has no usable id";
      if (!isScalar(node.value)) return `node ${String(node.id)} has a non-scalar value`;
      if (ids.has(String(node.id))) return `duplicate node id ${String(node.id)}`;
      ids.add(String(node.id));
    }
    /* A cycle arrow pointing past the end of the list would be drawn into
       nothing, which reads as "the cycle vanished" rather than as a bug. */
    if (frame.cycleTo !== null && frame.cycleTo !== undefined) {
      if (frame.cycleTo < 0 || frame.cycleTo >= frame.nodes.length) {
        return `cycleTo ${frame.cycleTo} is outside the ${frame.nodes.length} nodes`;
      }
    }
    for (const p of frame.pointers ?? []) {
      if (!ids.has(String(p.nodeId))) return `pointer "${p.label}" points at missing node ${String(p.nodeId)}`;
    }
    return hexMapProblem(frame.highlights, "highlights");
  },

  tree: (raw) => {
    const frame = raw as TreeFrame;
    if (!Array.isArray(frame.nodes)) return "nodes is not an array";
    const ids = new Set(frame.nodes.map((node) => String(node.id)));
    if (ids.size !== frame.nodes.length) return "two nodes share an id";
    for (const node of frame.nodes) {
      if (!isScalar(node.value)) return `node ${String(node.id)} has a non-scalar value`;
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
        return `node ${String(node.id)} is at a non-finite position`;
      }
      /* The renderer draws an edge from each node to its parent. A parent id
         with no node behind it draws a line into empty space. */
      if (node.parentId !== null && node.parentId !== undefined && !ids.has(String(node.parentId))) {
        return `node ${String(node.id)} claims parent ${String(node.parentId)}, which is not in the frame`;
      }
    }
    return hexMapProblem(frame.highlights, "highlights");
  },

  graph: (raw) => {
    const frame = raw as GraphFrame;
    if (!Array.isArray(frame.nodes)) return "nodes is not an array";
    const ids = new Set(frame.nodes.map((node) => node.id));
    for (const node of frame.nodes) {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.z)) return `vertex ${node.id} is at a non-finite position`;
    }
    for (const edge of frame.edges) {
      if (!ids.has(edge.from)) return `edge from missing vertex ${edge.from}`;
      if (!ids.has(edge.to)) return `edge to missing vertex ${edge.to}`;
      if (edge.weight !== undefined && !Number.isFinite(edge.weight)) {
        return `edge ${edge.from}–${edge.to} has a non-finite weight`;
      }
      if (edge.state !== undefined && !["idle", "active", "chosen", "rejected"].includes(edge.state)) {
        return `edge ${edge.from}–${edge.to} has unknown state "${edge.state}"`;
      }
    }
    return hexMapProblem(frame.highlights, "highlights");
  },

  grid: (raw) => {
    const frame = raw as Extract<Frame, { type: "grid" }>;
    if (!Array.isArray(frame.cells)) return "cells is not an array";
    const width = frame.cells[0]?.length ?? 0;
    for (const [r, row] of frame.cells.entries()) {
      if (!Array.isArray(row)) return `row ${r} is not an array`;
      /* Ragged rows would make the board a staircase. */
      if (row.length !== width) return `row ${r} has ${row.length} cells, but row 0 has ${width}`;
      for (const [c, cell] of row.entries()) {
        if (cell === null) continue;
        if (!isScalar(cell.value)) return `cell (${r}, ${c}) has a non-scalar value`;
        if (cell.color !== undefined && !HEX.test(cell.color)) return `cell (${r}, ${c}) has a bad colour`;
      }
    }
    if (frame.rowHeaders && frame.rowHeaders.length !== frame.cells.length) {
      return `${frame.rowHeaders.length} row headers for ${frame.cells.length} rows`;
    }
    if (frame.colHeaders && width > 0 && frame.colHeaders.length !== width) {
      return `${frame.colHeaders.length} column headers for ${width} columns`;
    }
    if (frame.cursor) {
      const { row, col } = frame.cursor;
      if (row < 0 || row >= frame.cells.length || col < 0 || col >= width) {
        return `cursor (${row}, ${col}) is off the board`;
      }
    }
    return null;
  },

  hash: (raw) => {
    const frame = raw as Extract<Frame, { type: "hash" }>;
    if (!Array.isArray(frame.buckets)) return "buckets is not an array";
    for (const bucket of frame.buckets) {
      if (!Number.isInteger(bucket.index)) return "a bucket has a non-integer index";
      if (!Array.isArray(bucket.entries)) return `bucket ${bucket.index} has no entries array`;
      for (const entry of bucket.entries) {
        if (!isScalar(entry.key)) return `bucket ${bucket.index} holds an entry with no key`;
      }
    }
    for (const index of frame.probe ?? []) {
      if (index < 0 || index >= frame.buckets.length) return `probe visits bucket ${index}, which does not exist`;
    }
    return null;
  },

  towers: (raw) => {
    const frame = raw as Extract<Frame, { type: "towers" }>;
    if (!Array.isArray(frame.pegs) || frame.pegs.length !== 3) return "there are not exactly three pegs";
    const seen = new Set<number>();
    for (const [p, peg] of frame.pegs.entries()) {
      for (let i = 0; i < peg.length; i += 1) {
        if (!Number.isInteger(peg[i]) || peg[i] <= 0) return `peg ${p} holds a disk of size ${peg[i]}`;
        if (seen.has(peg[i])) return `disk ${peg[i]} is on two pegs at once`;
        seen.add(peg[i]);
        /* The one rule of the puzzle. If a frame breaks it, the animation is
           showing a state the algorithm could never have reached. */
        if (i > 0 && peg[i] >= peg[i - 1]) {
          return `on peg ${p}, disk ${peg[i]} sits on top of the smaller disk ${peg[i - 1]}`;
        }
      }
    }
    if (frame.lifted !== null && frame.lifted !== undefined && seen.has(frame.lifted)) {
      return `disk ${frame.lifted} is lifted and also on a peg`;
    }
    return null;
  },
};

/* -------------------------------------------------------------------------- */
/* Small reference implementations                                             */
/* -------------------------------------------------------------------------- */

interface RefEdge {
  from: number;
  to: number;
  weight: number;
}

/** Rebuilds the graph from what the frame actually shows, not from lab internals. */
const edgesOfFrame = (frame: GraphFrame): RefEdge[] =>
  frame.edges.map((edge) => ({ from: edge.from, to: edge.to, weight: edge.weight ?? 1 }));

const referenceDijkstra = (count: number, edges: RefEdge[], source: number): number[] => {
  const adj: Array<Array<{ to: number; weight: number }>> = Array.from({ length: count }, () => []);
  for (const e of edges) {
    adj[e.from].push({ to: e.to, weight: e.weight });
    adj[e.to].push({ to: e.from, weight: e.weight });
  }
  const dist = new Array<number>(count).fill(Infinity);
  const settled = new Set<number>();
  dist[source] = 0;
  for (let step = 0; step < count; step += 1) {
    let best = -1;
    for (let i = 0; i < count; i += 1) {
      if (!settled.has(i) && dist[i] < Infinity && (best === -1 || dist[i] < dist[best])) best = i;
    }
    if (best === -1) break;
    settled.add(best);
    for (const { to, weight } of adj[best]) {
      if (dist[best] + weight < dist[to]) dist[to] = dist[best] + weight;
    }
  }
  return dist;
};

/** Minimum spanning forest weight, by Kruskal with a plain union-find. */
const referenceMstWeight = (count: number, edges: RefEdge[]): number => {
  const parent = Array.from({ length: count }, (_, i) => i);
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    return root;
  };
  let total = 0;
  for (const e of edges.slice().sort((a, b) => a.weight - b.weight)) {
    const ra = find(e.from);
    const rb = find(e.to);
    if (ra === rb) continue;
    parent[ra] = rb;
    total += e.weight;
  }
  return total;
};

/**
 * Children lists from the `parentId` links a tree frame carries.
 *
 * Ghost nodes are left out: they are drawn translucent to show a node being
 * detached or a slot not yet filled, and counting them would make a correct
 * tree look unbalanced.
 */
const childrenOf = (frame: TreeFrame): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  const real = frame.nodes.filter((node) => !node.ghost);
  for (const node of real) map.set(String(node.id), []);
  for (const node of real) {
    if (node.parentId === null || node.parentId === undefined) continue;
    map.get(String(node.parentId))?.push(String(node.id));
  }
  return map;
};

const rootOf = (frame: TreeFrame) =>
  frame.nodes.find((node) => node.parentId === null || node.parentId === undefined) ?? null;

const subtreeHeight = (id: string, children: Map<string, string[]>): number => {
  const kids = children.get(id) ?? [];
  if (kids.length === 0) return 1;
  return 1 + Math.max(...kids.map((kid) => subtreeHeight(kid, children)));
};

/**
 * `layoutTree` places nodes at x = their in-order position, so reading a tree
 * frame left to right *is* an in-order traversal. That is what lets the BST
 * ordering property be checked from the drawing alone.
 */
const inOrderValues = (frame: TreeFrame): number[] =>
  frame.nodes
    .filter((node) => !node.ghost)
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((node) => Number(node.value));

const isAscending = (values: number[]): boolean =>
  values.every((value, i) => i === 0 || values[i - 1] < value);

/**
 * Is `value` written in `text` as a number in its own right?
 *
 * `22` should match "total 22" and "at index 22.", but not "122", not "2.22"
 * and not "22.5". Hence a digit-or-dot exclusion before, and a lookahead after
 * that rejects another digit or a decimal fraction — but allows a full stop,
 * which is how most of these sentences end.
 */
const mentions = (text: string, value: number): boolean =>
  new RegExp(`(^|[^\\d.])${value}(?!\\d|\\.\\d)`).test(text);

/**
 * Did the run arrive at `expected`?
 *
 * Operations present their answer in whichever place suits them — in the closing
 * narration, in the last cell of a DP table, at the end of a 1-D table. Checking
 * all three keeps the assertion about *the answer* rather than about where the
 * answer was printed.
 */
const answerAppears = (frames: Frame[], expected: number): boolean => {
  const last = lastFrame(frames);
  if (!last) return false;
  if (mentions(last.description, expected)) return true;
  if (last.type === "grid") {
    const row = last.cells[last.cells.length - 1];
    const cell = row?.[row.length - 1];
    if (cell && Number(cell.value) === expected) return true;
  }
  if (last.type === "array") {
    if (Number(last.values[last.values.length - 1]) === expected) return true;
    const secondary = last.secondary?.values;
    if (secondary && Number(secondary[secondary.length - 1]) === expected) return true;
  }
  return false;
};

/** The three ways an operation can say "this cell". */
const identifiesIndex = (frame: Frame, index: number): boolean => {
  if (frame.type === "array") {
    if (Object.prototype.hasOwnProperty.call(frame.highlights, String(index))) return true;
    if (frame.pointers.some((p) => p.index === index)) return true;
  }
  return mentions(frame.description, index);
};

const sum = (values: number[]): number => values.reduce((acc, value) => acc + value, 0);

/* -------------------------------------------------------------------------- */
/* 1. The registry itself                                                      */
/* -------------------------------------------------------------------------- */

section("Registry");

{
  const listed = new Set(SECTIONS.flatMap((s) => s.keys));
  const registered = new Set(Object.keys(MODULES));

  const unlisted = [...registered].filter((key) => !listed.has(key));
  const unknown = [...listed].filter((key) => !registered.has(key));

  /* A module missing from every section is an entire topic with no way to reach
     it in the sidebar — invisible rather than broken, which is worse. */
  expect("every module appears in a sidebar section", unlisted.length === 0, unlisted.join(", "));
  expect("every sidebar key names a real module", unknown.length === 0, unknown.join(", "));

  const duplicates = SECTIONS.flatMap((s) => s.keys).filter((key, i, all) => all.indexOf(key) !== i);
  expect("no module is listed in two sections", duplicates.length === 0, duplicates.join(", "));

  for (const [key, module] of Object.entries(MODULES)) {
    expect(`${key}: has at least one operation`, Object.keys(module.ops).length > 0);
    expect(`${key}: has a label`, module.label.trim().length > 0);
    if (module.usesValues) {
      expect(`${key}: usesValues modules ship a sample input`, (module.sample ?? "").trim().length > 0);
    }
  }

  const ops = allOperations();
  console.log(`  ${Object.keys(MODULES).length} modules, ${ops.length} operations`);
}

/* -------------------------------------------------------------------------- */
/* 2. Every operation runs, and every frame is drawable                        */
/* -------------------------------------------------------------------------- */

section("Every operation runs and produces drawable frames");

const rendererSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../src/components/visual/lab/renderers/index.ts"),
  "utf8",
);

const seenTypes = new Set<FrameType>();

for (const { moduleKey, opKey, op } of allOperations()) {
  const id = `${moduleKey}/${opKey}`;

  expect(`${id}: has pseudocode`, op.pseudocode.length > 0);
  expect(`${id}: has a complexity table`, Object.keys(op.complexity).length > 0);
  expect(`${id}: has a label`, op.label.trim().length > 0);

  let frames: Frame[];
  try {
    frames = run(moduleKey, opKey);
  } catch (error) {
    expect(`${id}: runs with its default parameters`, false, String(error));
    continue;
  }

  /* An operation that legitimately refuses its input still says so in a frame.
     Zero frames is a blank canvas with no explanation. */
  if (!expect(`${id}: produces at least one frame`, frames.length > 0)) continue;

  /* Exactly one frame is how every operation in the lab says "I cannot work
     with this input" — the empty-values notice, knapsack's mismatched-profits
     notice. Reached with the operation's *own shipped defaults*, that means a
     student who clicks it is shown an error rather than a demonstration. This
     is what caught the knapsack profits default. */
  expect(
    `${id}: its own defaults demonstrate the operation`,
    frames.length > 1,
    `only one frame, which said: ${frames[0].description}`,
  );

  let shapeProblem: string | null = null;
  let lineProblem: string | null = null;

  for (const [i, frame] of frames.entries()) {
    seenTypes.add(frame.type);

    const validate = SHAPE[frame.type];
    if (!validate) {
      shapeProblem ??= `frame ${i} has type "${frame.type}", which has no contract in this script`;
      continue;
    }
    shapeProblem ??= (() => {
      const problem = validate(frame);
      return problem ? `frame ${i}: ${problem}` : null;
    })();

    if (typeof frame.description !== "string" || frame.description.trim().length === 0) {
      shapeProblem ??= `frame ${i} has no description — the narration panel would be blank`;
    }

    /* `codeLine` indexes the pseudocode block. Out of range highlights nothing,
       so the student reads the wrong line, or no line, with no sign of it. */
    if (!Number.isInteger(frame.codeLine) || frame.codeLine < -1 || frame.codeLine >= op.pseudocode.length) {
      lineProblem ??= `frame ${i} highlights line ${frame.codeLine} of ${op.pseudocode.length}`;
    }
  }

  expect(`${id}: every frame matches its renderer's contract`, shapeProblem === null, shapeProblem ?? "");
  expect(`${id}: every codeLine is inside the pseudocode`, lineProblem === null, lineProblem ?? "");
}

for (const type of Object.keys(SHAPE) as FrameType[]) {
  /* Ties this script to the real dispatch table rather than to a copy of it:
     `renderers/index.ts` is read as text so three.js never loads. */
  expect(
    `renderers/index.ts handles "${type}" frames`,
    rendererSource.includes(`case "${type}":`),
    "the switch in renderers/index.ts has no case for it",
  );
}

console.log(`  frame types actually produced: ${[...seenTypes].sort().join(", ")}`);

/* -------------------------------------------------------------------------- */
/* 3. Determinism                                                              */
/* -------------------------------------------------------------------------- */

section("Determinism");

/*
 * Same inputs, same animation — every time, on every machine.
 *
 * This is the check that catches a stray `Math.random()` or state leaking
 * between runs through a module-level variable. It matters pedagogically as well
 * as technically: a lesson cannot describe what the student is about to see if
 * the picture is different on every reload, and two operations cannot be
 * compared on "the same graph" unless the graph really is the same.
 */
for (const { moduleKey, opKey } of allOperations()) {
  const id = `${moduleKey}/${opKey}`;
  let first: string;
  let second: string;
  try {
    first = JSON.stringify(run(moduleKey, opKey));
    second = JSON.stringify(run(moduleKey, opKey));
  } catch {
    continue; /* already reported above */
  }
  expect(
    `${id}: two runs of the same input produce identical frames`,
    first === second,
    first === second ? "" : "something in this operation is random or holds state between runs",
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Semantics — sorting and searching                                        */
/* -------------------------------------------------------------------------- */

section("Sorting and searching");

{
  const sample = parseValues(MODULES.sorting.sample ?? "");
  const expected = sample.slice().sort((a, b) => a - b);

  for (const opKey of Object.keys(MODULES.sorting.ops)) {
    const frames = run("sorting", opKey);
    const final = lastOfType(frames, "array");
    if (!expect(`sorting/${opKey}: ends on an array frame`, final !== null)) continue;
    const produced = final!.values.map(Number);
    expect(
      `sorting/${opKey}: the final array is sorted`,
      JSON.stringify(produced) === JSON.stringify(expected),
      `got [${produced.join(", ")}], expected [${expected.join(", ")}]`,
    );
  }
}

{
  const sample = parseValues(MODULES.searching.sample ?? "");

  for (const [opKey, op] of Object.entries(MODULES.searching.ops)) {
    const target = Number(paramDefault(op, "target"));
    if (!Number.isFinite(target)) continue;
    const index = sample.indexOf(target);
    if (index < 0) continue; /* an op whose default target is deliberately absent */

    const frames = run("searching", opKey);
    const final = lastFrame(frames);
    if (!final) continue;
    expect(
      `searching/${opKey}: finishes pointing at index ${index}, where ${target} actually is`,
      identifiesIndex(final, index),
      `closing frame said: ${final.description}`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 5. Semantics — trees                                                        */
/* -------------------------------------------------------------------------- */

section("Trees");

/** Every node's value is greater than everything to its left. */
const checkBstOrdering = (label: string, frames: Frame[]) => {
  const final = lastOfType(frames, "tree");
  if (!expect(`${label}: ends on a tree frame`, final !== null)) return;
  const values = inOrderValues(final!);
  expect(
    `${label}: reading the tree left to right gives ascending values`,
    isAscending(values),
    `in-order was [${values.join(", ")}]`,
  );
};

checkBstOrdering("bst/build", run("bst", "build"));
checkBstOrdering("bst/insert", run("bst", "insert"));
checkBstOrdering("bst/delete", run("bst", "delete"));

/** No subtree is more than one level taller than its sibling. */
const checkAvlBalance = (label: string, frames: Frame[]) => {
  const final = lastOfType(frames, "tree");
  if (!expect(`${label}: ends on a tree frame`, final !== null)) return;

  const frame = final!;
  const children = childrenOf(frame);
  let worst: string | null = null;

  for (const node of frame.nodes) {
    if (node.ghost) continue;
    const kids = children.get(String(node.id)) ?? [];
    if (kids.length > 2) {
      worst ??= `node ${String(node.value)} has ${kids.length} children`;
      continue;
    }
    /* A missing child is a subtree of height 0. Which side each child is on
       does not matter: the balance factor is checked as |left − right|, and
       that is symmetric. */
    const heights = kids.map((kid) => subtreeHeight(kid, children));
    while (heights.length < 2) heights.push(0);
    if (Math.abs(heights[0] - heights[1]) > 1) {
      worst ??= `node ${String(node.value)} has subtree heights ${heights[0]} and ${heights[1]}`;
    }
  }

  expect(`${label}: every node is height-balanced`, worst === null, worst ?? "");
  const values = inOrderValues(frame);
  expect(`${label}: still a search tree after rebalancing`, isAscending(values), `in-order was [${values.join(", ")}]`);
};

checkAvlBalance("avl/build", run("avl", "build"));
checkAvlBalance("avl/insert", run("avl", "insert"));
checkAvlBalance("avl/delete", run("avl", "delete"));

/** A parent dominates its children — the whole of the heap property. */
{
  for (const opKey of ["build", "extract"]) {
    const op = MODULES.heap.ops[opKey];
    const kind = String(paramDefault(op, "kind") ?? "max").toLowerCase().startsWith("min") ? "min" : "max";
    const frames = run("heap", opKey);
    const final = lastFrame(frames);
    let problem: string | null = null;

    if (final?.type === "tree") {
      for (const node of final.nodes) {
        if (node.ghost || node.parentId === null || node.parentId === undefined) continue;
        const parent = final.nodes.find((n) => String(n.id) === String(node.parentId));
        if (!parent || parent.ghost) continue;
        const child = Number(node.value);
        const above = Number(parent.value);
        const bad = kind === "max" ? child > above : child < above;
        if (bad) problem ??= `${child} sits under ${above} in a ${kind}-heap`;
      }
    } else if (final?.type === "array") {
      const values = final.values.map(Number);
      for (let i = 1; i < values.length; i += 1) {
        const above = values[Math.floor((i - 1) / 2)];
        const bad = kind === "max" ? values[i] > above : values[i] < above;
        if (bad) problem ??= `index ${i} (${values[i]}) beats its parent ${above} in a ${kind}-heap`;
      }
    } else {
      problem = `ends on a ${final?.type ?? "missing"} frame, which carries no heap to check`;
    }

    expect(`heap/${opKey}: the ${kind}-heap property holds at the end`, problem === null, problem ?? "");
  }
}

/* Segment tree: the root of a sum tree is the sum of everything under it. */
{
  const values = parseValues(MODULES.segment.sample ?? "");
  const frames = run("segment", "build");
  const final = lastOfType(frames, "tree");
  if (expect("segment/build: ends on a tree frame", final !== null)) {
    const root = rootOf(final!);
    expect(
      "segment/build: the root holds the total of the input",
      root !== null && Number(root.value) === sum(values),
      `root is ${String(root?.value)}, the input totals ${sum(values)}`,
    );
  }

  const op = MODULES.segment.ops.query;
  const from = Number(paramDefault(op, "from"));
  const to = Number(paramDefault(op, "to"));
  const expected = sum(values.slice(from, to + 1));
  expect(
    `segment/query: [${from}, ${to}] sums to ${expected}`,
    answerAppears(run("segment", "query"), expected),
    `closing frame said: ${lastFrame(run("segment", "query"))?.description ?? ""}`,
  );
}

/* Fenwick: the prefix parameter is 1-based, so index 6 means the first six. */
{
  const values = parseValues(MODULES.fenwick.sample ?? "");
  const index = Number(paramDefault(MODULES.fenwick.ops.prefix, "index"));
  const expected = sum(values.slice(0, index));
  const frames = run("fenwick", "prefix");
  expect(
    `fenwick/prefix: the first ${index} values total ${expected}`,
    answerAppears(frames, expected),
    `closing frame said: ${lastFrame(frames)?.description ?? ""}`,
  );
}

/*
 * Trie: a differential check rather than a comparison against a Set.
 *
 * Whether a word was found is stated in prose, and asserting on the exact
 * wording would test the sentence rather than the algorithm. What can be said
 * without that coupling is that a stored word and a word that was never inserted
 * must not end the same way — a search that always reports the same thing is the
 * failure worth catching.
 */
{
  const op = MODULES.trie.ops.search;
  const stored = String(paramDefault(op, "word") ?? "car");
  const absent = "zzqqxx";
  const found = lastFrame(run("trie", "search", { word: stored }));
  const missing = lastFrame(run("trie", "search", { word: absent }));
  expect(
    "trie/search: a stored word and an absent one end differently",
    found !== null && missing !== null && found.description !== missing.description,
    `both runs ended with: ${found?.description ?? ""}`,
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Semantics — graphs                                                       */
/* -------------------------------------------------------------------------- */

section("Graphs");

{
  const dijkstra = run("graph", "dijkstra");
  const start = Number(paramDefault(MODULES.graph.ops.dijkstra, "start") ?? 0);
  const openingFrame = dijkstra[0] as GraphFrame | undefined;
  const finalFrame = lastOfType(dijkstra, "graph");

  if (expect("graph/dijkstra: produced graph frames", !!openingFrame && !!finalFrame)) {
    const edges = edgesOfFrame(openingFrame!);
    const count = openingFrame!.nodes.length;
    const reference = referenceDijkstra(count, edges, start);
    const shown = finalFrame!.nodes.map((node) => (node.badge === "∞" ? Infinity : Number(node.badge)));

    const wrong = reference
      .map((d, i) => (d === shown[i] ? null : `vertex ${i}: lab says ${shown[i]}, should be ${d}`))
      .filter(Boolean);

    /* Computed here from the edges the frame itself draws, so this compares the
       lab against an independent answer rather than against itself. */
    expect(
      `graph/dijkstra: every distance from ${start} is the true shortest`,
      wrong.length === 0,
      wrong.join("; "),
    );
  }

  const kruskal = lastOfType(run("graph", "kruskal"), "graph");
  const prim = lastOfType(run("graph", "prim"), "graph");

  if (expect("graph/kruskal and graph/prim both produced graph frames", !!kruskal && !!prim)) {
    const chosenWeight = (frame: GraphFrame) =>
      sum(frame.edges.filter((e) => e.state === "chosen").map((e) => e.weight ?? 0));

    const reference = referenceMstWeight(kruskal!.nodes.length, edgesOfFrame(kruskal!));
    const kruskalWeight = chosenWeight(kruskal!);
    const primWeight = chosenWeight(prim!);

    expect(
      "graph/kruskal: the chosen edges weigh what a minimum spanning tree should",
      kruskalWeight === reference,
      `chose ${kruskalWeight}, minimum is ${reference}`,
    );
    /* The two algorithms pick edges in completely different orders; the totals
       agreeing is the fact worth teaching, and the fact worth checking. */
    expect(
      "graph/prim: reaches the same total as Kruskal",
      primWeight === kruskalWeight,
      `Prim ${primWeight}, Kruskal ${kruskalWeight}`,
    );
  }

  const topo = lastOfType(run("graph", "topoSort"), "graph");
  if (expect("graph/topoSort: produced graph frames", !!topo)) {
    const match = /Topological order:\s*([^.]*)\./.exec(topo!.description);
    if (expect("graph/topoSort: the closing frame states the order", match !== null, topo!.description)) {
      const order = match![1]
        .split("→")
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isFinite(value));

      expect(
        "graph/topoSort: the order lists every vertex exactly once",
        order.length === topo!.nodes.length && new Set(order).size === order.length,
        `${order.length} entries for ${topo!.nodes.length} vertices`,
      );

      const position = new Map(order.map((vertex, i) => [vertex, i]));
      const violations = topo!.edges.filter((edge) => {
        const from = position.get(edge.from);
        const to = position.get(edge.to);
        return from === undefined || to === undefined || from >= to;
      });
      expect(
        "graph/topoSort: every edge points forwards in that order",
        violations.length === 0,
        violations.map((e) => `${e.from}→${e.to}`).join(", "),
      );
    }
  }

  /* A fresh context means nothing has been unioned yet, so every element is
     still its own set. */
  const count = Number(paramDefault(MODULES.dsu.ops.components, "count") ?? 8);
  expect(
    `dsu/components: ${count} untouched elements are ${count} separate sets`,
    answerAppears(run("dsu", "components"), count),
    `closing frame said: ${lastFrame(run("dsu", "components"))?.description ?? ""}`,
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Semantics — strings, recursion and dynamic programming                   */
/* -------------------------------------------------------------------------- */

section("Strings, recursion and dynamic programming");

{
  const op = MODULES.string.ops.kmp;
  const text = String(paramDefault(op, "text") ?? "");
  const pattern = String(paramDefault(op, "pattern") ?? "");
  const index = text.indexOf(pattern);
  if (index >= 0) {
    expect(
      `string/kmp: finds "${pattern}" at index ${index}, where indexOf finds it`,
      answerAppears(run("string", "kmp"), index),
      `closing frame said: ${lastFrame(run("string", "kmp"))?.description ?? ""}`,
    );
  }
}

/* Hanoi: 2^n - 1 moves, and everything ends stacked on one peg. */
{
  const disks = Number(paramDefault(MODULES.recursion.ops.hanoi, "disks") ?? 3);
  const frames = run("recursion", "hanoi");
  const final = lastFrame(frames);
  if (expect("recursion/hanoi: ends on a towers frame", final?.type === "towers")) {
    const pegs = (final as Extract<Frame, { type: "towers" }>).pegs;
    const finished = pegs.filter((peg) => peg.length === disks);
    expect(
      `recursion/hanoi: all ${disks} disks end on one peg`,
      finished.length === 1 && pegs.filter((peg) => peg.length > 0).length === 1,
      `pegs held ${pegs.map((p) => p.length).join(", ")} disks`,
    );
    /* The shape checker already enforced "never a big disk on a small one" on
       every frame, so reaching this state means it was reached legally. */
  }
}

{
  const values = parseValues(MODULES.recursion.sample ?? "");
  expect(
    `recursion/subsets: ${values.length} values have ${2 ** values.length} subsets`,
    answerAppears(run("recursion", "subsets"), 2 ** values.length),
    `closing frame said: ${lastFrame(run("recursion", "subsets"))?.description ?? ""}`,
  );

  const size = Number(paramDefault(MODULES.recursion.ops.nQueens, "size") ?? 4);
  const solutions: Record<number, number> = { 1: 1, 2: 0, 3: 0, 4: 2, 5: 10, 6: 4, 7: 40, 8: 92 };
  if (solutions[size] !== undefined) {
    expect(
      `recursion/nQueens: ${size} queens have ${solutions[size]} solutions`,
      answerAppears(run("recursion", "nQueens"), solutions[size]),
      `closing frame said: ${lastFrame(run("recursion", "nQueens"))?.description ?? ""}`,
    );
  }
}

/*
 * Dynamic programming, against textbook answers.
 *
 * Each case passes its own input rather than relying on the module sample, so
 * the expected number is one that can be checked by hand against the classic
 * statement of the problem.
 */
{
  const cases: Array<{
    opKey: string;
    label: string;
    values?: string;
    params?: ParamValues;
    expected: number;
  }> = [
    { opKey: "fibTable", label: "F(10) = 55", params: { n: 10 }, expected: 55 },
    {
      opKey: "coinChange",
      label: "11 from coins 1, 2, 5 needs 3 coins",
      values: "1, 2, 5",
      params: { amount: 11 },
      expected: 3,
    },
    {
      opKey: "lis",
      label: "the longest increasing subsequence of 10 9 2 5 3 7 101 18 is 4 long",
      values: "10, 9, 2, 5, 3, 7, 101, 18",
      expected: 4,
    },
    {
      opKey: "knapsack",
      label: "weights 1 2 3 5 with profits 1 6 10 16 and capacity 7 is worth 22",
      values: "1, 2, 3, 5",
      params: { profits: "1, 6, 10, 16", capacity: 7 },
      expected: 22,
    },
    {
      opKey: "lcs",
      label: "ABCBDAB and BDCABA share a subsequence of 4",
      params: { first: "ABCBDAB", second: "BDCABA" },
      expected: 4,
    },
    {
      opKey: "editDistance",
      label: "kitten to sitting takes 3 edits",
      params: { first: "kitten", second: "sitting" },
      expected: 3,
    },
  ];

  for (const test of cases) {
    if (!MODULES.dp.ops[test.opKey]) {
      expect(`dp/${test.opKey}: exists`, false, "no such operation in the dp module");
      continue;
    }
    const frames = run("dp", test.opKey, test.params ?? {}, test.values);
    expect(
      `dp/${test.opKey}: ${test.label}`,
      answerAppears(frames, test.expected),
      `closing frame said: ${lastFrame(frames)?.description ?? ""}`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 8. The catalogue resolves                                                   */
/* -------------------------------------------------------------------------- */

section("Catalogue");

/*
 * These eleven strings are stored in `concepts.visual_key` in the database.
 * Renaming one does not break a build — it silently turns every lesson that
 * points at it into "No visualisation for that key". So they are pinned here.
 */
const DATABASE_KEYS = [
  "array-memory",
  "array-shift",
  "two-pointers",
  "sliding-window",
  "prefix-sum",
  "stack",
  "stack-brackets",
  "monotonic-stack",
  "queue",
  "circular-queue",
  "monotonic-deque",
];

{
  const keys = VISUAL_CATALOGUE.map((entry) => entry.key);
  const duplicates = keys.filter((key, i) => keys.indexOf(key) !== i);
  expect("no catalogue key is used twice", duplicates.length === 0, duplicates.join(", "));

  for (const key of DATABASE_KEYS) {
    expect(`the live database key "${key}" is still in the catalogue`, keys.includes(key));
  }

  for (const entry of VISUAL_CATALOGUE) {
    const module = moduleDef(entry.module);
    if (!expect(`${entry.key}: module "${entry.module}" exists`, module !== null)) continue;

    const op = opDef(entry.module, entry.op);
    if (!expect(`${entry.key}: operation "${entry.module}/${entry.op}" exists`, op !== null)) continue;

    /* A parameter key that does not exist is the nastiest failure here: nothing
       throws, the override is ignored, and the lesson quietly demonstrates the
       operation's default instead of the thing the lesson is about. */
    for (const paramKey of Object.keys(entry.params ?? {})) {
      expect(
        `${entry.key}: parameter "${paramKey}" exists on ${entry.module}/${entry.op}`,
        op!.params.some((param) => param.key === paramKey),
        `that operation takes: ${op!.params.map((p) => p.key).join(", ") || "no parameters"}`,
      );
    }

    if (entry.values !== undefined) {
      expect(
        `${entry.key}: supplies values to a module that reads them`,
        module!.usesValues,
        `${entry.module} ignores the values box, so this string does nothing`,
      );
    }

    try {
      const frames = run(entry.module, entry.op, entry.params ?? {}, entry.values);
      expect(`${entry.key}: opens on at least one frame`, frames.length > 0);
    } catch (error) {
      expect(`${entry.key}: opens without throwing`, false, String(error));
    }
  }

  console.log(`  ${VISUAL_CATALOGUE.length} catalogue entries`);
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                     */
/* -------------------------------------------------------------------------- */

console.log("");
if (failures === 0) {
  console.log(`All ${checks} checks passed.`);
} else {
  console.error(`${failures} of ${checks} checks FAILED:`);
  for (const label of failed) console.error(`  - ${label}`);
  process.exitCode = 1;
}
