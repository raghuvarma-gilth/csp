/**
 * The module registry — the whole curriculum in one place.
 *
 * This is the only file that imports every `algorithms/*` module (transitively,
 * through `modules/*`), and that is deliberate: it means the pure algorithm
 * layer has exactly one consumer, so `scripts/verify-lab.ts` can import this
 * file in plain Node and exercise all 140 operations without ever touching
 * three.js.
 *
 * Module keys are part of the public surface — `VISUAL_CATALOGUE` stores them,
 * and `concepts.visual_key` rows in the database resolve through the catalogue to
 * a key here. Renaming one breaks a lesson deep link, so don't.
 */

import { dsuModule, graphModule } from "./modules/graphs";
import {
  arrayModule,
  hashModule,
  linkedListModule,
  matrixModule,
  queueModule,
  stackModule,
  stringModule,
} from "./modules/linear";
import {
  dpModule,
  recursionModule,
  searchingModule,
  slidingWindowModule,
  sortingModule,
  twoPointersModule,
} from "./modules/patterns";
import {
  avlModule,
  binaryTreeModule,
  bstModule,
  fenwickModule,
  heapModule,
  segmentModule,
  trieModule,
} from "./modules/trees";
import type { ModuleDef, OpDef, SidebarSection } from "./types";

export const MODULES: Record<string, ModuleDef> = {
  /* Linear structures */
  array: arrayModule,
  string: stringModule,
  matrix: matrixModule,
  stack: stackModule,
  queue: queueModule,
  linkedlist: linkedListModule,
  hash: hashModule,

  /* Hierarchical structures */
  binarytree: binaryTreeModule,
  bst: bstModule,
  avl: avlModule,
  trie: trieModule,
  heap: heapModule,
  segment: segmentModule,
  fenwick: fenwickModule,

  /* Sets and graphs */
  dsu: dsuModule,
  graph: graphModule,

  /* Patterns and algorithms */
  twopointers: twoPointersModule,
  slidingwindow: slidingWindowModule,
  sorting: sortingModule,
  searching: searchingModule,
  recursion: recursionModule,
  dp: dpModule,
};

/**
 * Sidebar grouping. The order inside each section is pedagogical rather than
 * alphabetical: a student meeting these for the first time should hit arrays
 * before trees and trees before graphs, and should see Fenwick immediately after
 * the segment tree it is the cheaper cousin of.
 */
export const SECTIONS: SidebarSection[] = [
  {
    label: "Data Structures",
    keys: [
      "array",
      "string",
      "matrix",
      "stack",
      "queue",
      "linkedlist",
      "hash",
      "binarytree",
      "bst",
      "avl",
      "trie",
      "heap",
      "segment",
      "fenwick",
      "dsu",
      "graph",
    ],
  },
  {
    label: "Patterns & Algorithms",
    keys: ["twopointers", "slidingwindow", "sorting", "searching", "recursion", "dp"],
  },
];

/** What the free-explore page opens on. */
export const DEFAULT_MODULE = "array";
export const DEFAULT_OP = "access";

export const moduleDef = (moduleKey: string): ModuleDef | null => MODULES[moduleKey] ?? null;

export const opDef = (moduleKey: string, opKey: string): OpDef | null =>
  MODULES[moduleKey]?.ops[opKey] ?? null;

/** First operation of a module, for when only a module key is known. */
export const firstOpKey = (moduleKey: string): string | null => {
  const mod = MODULES[moduleKey];
  if (!mod) return null;
  const keys = Object.keys(mod.ops);
  return keys.length ? keys[0] : null;
};

/** Every (module, op) pair. Used by the sidebar search and by the verify script. */
export const allOperations = (): Array<{ moduleKey: string; opKey: string; module: ModuleDef; op: OpDef }> =>
  Object.entries(MODULES).flatMap(([moduleKey, module]) =>
    Object.entries(module.ops).map(([opKey, op]) => ({ moduleKey, opKey, module, op })),
  );

/**
 * Sanity check on the section lists, run once at import time in development.
 *
 * A key present in `MODULES` but missing from `SECTIONS` would simply never
 * appear in the sidebar — an entire topic silently unreachable, with nothing in
 * the console to say so. Cheap to catch here; expensive to notice in a lesson.
 */
if (import.meta.env?.DEV) {
  const listed = new Set(SECTIONS.flatMap((section) => section.keys));
  const registered = new Set(Object.keys(MODULES));

  const unlisted = [...registered].filter((key) => !listed.has(key));
  const unknown = [...listed].filter((key) => !registered.has(key));

  if (unlisted.length) {
    console.warn(`[lab] modules registered but not in any sidebar section: ${unlisted.join(", ")}`);
  }
  if (unknown.length) {
    console.warn(`[lab] sidebar sections reference unknown modules: ${unknown.join(", ")}`);
  }
}
