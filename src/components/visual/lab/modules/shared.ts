/**
 * Shared shorthand for the module definitions.
 *
 * The registry is ~140 operations. Without these helpers each one would be a
 * twelve-line object literal and the file would be unreadable, which matters
 * because the registry is the one place a reader can see the whole curriculum at
 * once.
 */

import type { OpDef, ParamDef } from "../types";

/** A numeric input. Bounds are advisory — every algorithm clamps its own input. */
export const num = (
  key: string,
  label: string,
  value: number,
  min?: number,
  max?: number,
  hint?: string,
): ParamDef => ({ key, label, type: "number", default: value, min, max, hint });

export const txt = (key: string, label: string, value: string, hint?: string): ParamDef => ({
  key,
  label,
  type: "text",
  default: value,
  hint,
});

export const NO_PARAMS: ParamDef[] = [];

export const op = (
  label: string,
  group: string,
  params: ParamDef[],
  generate: OpDef["generate"],
  pseudocode: string[],
  complexity: Record<string, string>,
): OpDef => ({ label, group, params, generate, pseudocode, complexity });

/* The complexity rows that repeat. Anything unusual is written out in place. */
export const CONSTANT = { Time: "O(1)", Space: "O(1)" };
export const LINEAR = { Time: "O(n)", Space: "O(1)" };
export const LINEAR_SPACE = { Time: "O(n)", Space: "O(n)" };
export const LOG = { Time: "O(log n)", Space: "O(1)" };
export const QUADRATIC = { Time: "O(n²)", Space: "O(1)" };
export const LINEARITHMIC = { Time: "O(n log n)", Space: "O(n)" };
