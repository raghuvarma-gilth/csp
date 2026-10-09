/**
 * Recursion and backtracking.
 *
 * Recursion is hard to learn because the interesting state — the call stack — is
 * invisible. Every operation here makes it visible: as an actual stack of frames,
 * as a call tree, as disks in the air, or as a board being filled and unfilled.
 *
 * Backtracking is just recursion that undoes its move on the way out, and the
 * undo is drawn as its own frame so it cannot be missed.
 */

import { gridFrame, layoutNaryTree, snapshot, towersFrame, treeFrame, type NaryTreeNode } from "../frames";
import { C, type ArrayFrame, type GridCell, type GridFrame, type Hex, type NodeId, type TowersFrame, type TreeFrame } from "../types";

const clamp = (value: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(Math.round(value) || lo, hi));

/* -------------------------------------------------------------------------- */
/* The call stack, literally                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Factorial, drawn as the stack it actually is. The two halves are the thing to
 * notice: nothing is *computed* on the way down — every frame is just parked,
 * waiting — and all the arithmetic happens on the way back up.
 */
export function factorialStackFrames(n: number): ArrayFrame[] {
  const target = clamp(n, 0, 12);
  const stack: string[] = [];
  const labels: Record<number, string> = {};

  const snap = (highlights: Record<number, Hex>, description: string, codeLine: number): ArrayFrame =>
    snapshot(stack.slice(), highlights, [], description, codeLine, null, "vertical", { labels: { ...labels } });

  const frames: ArrayFrame[] = [
    snap({}, `fact(${target}). Each call that cannot answer immediately parks itself on the stack and calls a smaller version of itself.`, 0),
  ];

  for (let k = target; k >= 1; k -= 1) {
    stack.push(`fact(${k})`);
    labels[stack.length - 1] = "waiting";
    frames.push(
      snap({ [stack.length - 1]: C.inspect }, `fact(${k}) cannot answer yet — it needs fact(${k - 1}) first. Push it and recurse. Stack depth ${stack.length}.`, 1),
    );
  }

  stack.push("fact(0)");
  labels[stack.length - 1] = "= 1";
  frames.push(
    snap({ [stack.length - 1]: C.done }, `fact(0) is the base case — it returns 1 without recursing. Without this the stack would grow until it overflowed; the base case is the only reason recursion ever ends.`, 2),
  );

  let acc = 1;
  for (let k = 1; k <= target; k += 1) {
    stack.pop();
    delete labels[stack.length];
    const top = stack.length - 1;
    acc *= k;
    labels[top] = `= ${acc}`;
    frames.push(
      snap({ [top]: C.done }, `fact(${k - 1}) returned ${k === 1 ? 1 : acc / k}, so fact(${k}) finally computes ${k} × ${k === 1 ? 1 : acc / k} = ${acc} and pops. Stack depth ${stack.length}.`, 3),
    );
  }

  frames.push(
    snap({ 0: C.done }, `fact(${target}) = ${acc}. The stack reached depth ${target + 1} — recursion trades memory for the code being ${target + 1} lines shorter than the loop, and on a large input that trade is what causes a stack overflow.`, 4),
  );
  return frames;
}

/**
 * The naive Fibonacci call tree. The whole reason this operation exists is that
 * the repeated subtrees are visible: the same call is recomputed over and over,
 * which is the exact waste memoisation removes.
 */
export function recursionTreeFrames(n: number): TreeFrame[] {
  const target = clamp(n, 1, 8);
  let nextId = 0;
  const callCounts = new Map<number, number>();

  interface Call {
    id: NodeId;
    value: number;
    result: number;
    children: Call[];
  }

  const build = (k: number): Call => {
    const id = nextId;
    nextId += 1;
    callCounts.set(k, (callCounts.get(k) ?? 0) + 1);
    if (k <= 1) return { id, value: k, result: k, children: [] };
    const left = build(k - 1);
    const right = build(k - 2);
    return { id, value: k, result: left.result + right.result, children: [left, right] };
  };

  const root = build(target);

  const decorate = (call: Call, revealed: ReadonlySet<NodeId>, resolved: ReadonlySet<NodeId>): NaryTreeNode => ({
    id: call.id,
    value: `fib(${call.value})`,
    children: call.children.map((c) => decorate(c, revealed, resolved)),
    badge: resolved.has(call.id) ? `= ${call.result}` : undefined,
    ghost: !revealed.has(call.id),
  });

  const revealed = new Set<NodeId>();
  const resolved = new Set<NodeId>();
  const frames: TreeFrame[] = [];
  const snap = (highlights: Record<NodeId, Hex>, description: string, codeLine: number): TreeFrame =>
    treeFrame(layoutNaryTree(decorate(root, revealed, resolved)), highlights, description, codeLine);

  frames.push(snap({}, `fib(${target}) with no memoisation. Every node is one function call; the ghosted ones have not happened yet.`, 0));

  const walk = (call: Call): void => {
    revealed.add(call.id);
    if (!call.children.length) {
      resolved.add(call.id);
      frames.push(snap({ [call.id]: C.done }, `fib(${call.value}) is a base case — returns ${call.result} immediately`, 1));
      return;
    }
    frames.push(snap({ [call.id]: C.inspect }, `fib(${call.value}) needs fib(${call.value - 1}) and fib(${call.value - 2}) — it splits into two calls`, 2));
    walk(call.children[0]);
    walk(call.children[1]);
    resolved.add(call.id);
    frames.push(
      snap({ [call.id]: C.done }, `fib(${call.value}) = ${call.children[0].result} + ${call.children[1].result} = ${call.result}`, 3),
    );
  };

  walk(root);

  const totalCalls = nextId;
  const repeated = Array.from(callCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);
  const worst = repeated[0];

  frames.push(
    snap({}, repeated.length
      ? `fib(${target}) = ${root.result} after ${totalCalls} call(s) for ${callCounts.size} distinct value(s). fib(${worst[0]}) alone was computed ${worst[1]} separate times. Storing each result the first time — memoisation — collapses this to ${callCounts.size} calls, and that is the entire difference between O(2ⁿ) and O(n).`
      : `fib(${target}) = ${root.result} after ${totalCalls} call(s). Increase n and watch the duplicated subtrees appear.`, 4),
  );
  return frames;
}

/* -------------------------------------------------------------------------- */
/* Tower of Hanoi                                                              */
/* -------------------------------------------------------------------------- */

const PEG_NAMES = ["A", "B", "C"];

/**
 * Tower of Hanoi. The recursion is three lines and the reasoning is one sentence:
 * to move n disks, move n−1 out of the way, move the biggest, then move the n−1
 * back on top. The frames follow that sentence exactly.
 */
export function hanoiFrames(disks: number): TowersFrame[] {
  const n = clamp(disks, 1, 6);
  const pegs: number[][] = [Array.from({ length: n }, (_, i) => n - i), [], []];
  const frames: TowersFrame[] = [
    towersFrame(pegs, `${n} disk(s) on peg A, largest at the bottom. Move them all to peg C — never putting a larger disk on a smaller one.`, 0),
  ];

  let moves = 0;

  const move = (count: number, from: number, to: number, via: number): void => {
    if (count === 0) return;
    if (count > 1) {
      frames.push(
        towersFrame(pegs, `To move ${count} disk(s) from ${PEG_NAMES[from]} to ${PEG_NAMES[to]}, first get the top ${count - 1} out of the way onto ${PEG_NAMES[via]}`, 1),
      );
    }
    move(count - 1, from, via, to);

    const disk = pegs[from].pop() as number;
    frames.push(towersFrame(pegs, `Lift disk ${disk} off ${PEG_NAMES[from]}`, 2, disk));
    pegs[to].push(disk);
    moves += 1;
    frames.push(towersFrame(pegs, `Move ${moves}: disk ${disk} → ${PEG_NAMES[to]}`, 2));

    if (count > 1) {
      frames.push(
        towersFrame(pegs, `Disk ${disk} is placed. Now bring the ${count - 1} disk(s) back from ${PEG_NAMES[via]} onto ${PEG_NAMES[to]}.`, 3),
      );
    }
    move(count - 1, via, to, from);
  };

  move(n, 0, 2, 1);

  frames.push(
    towersFrame(pegs, `Done in ${moves} move(s) — exactly 2^${n} − 1, which is the minimum and cannot be beaten. Each extra disk doubles the work: 20 disks would take over a million moves.`, 4),
  );
  return frames;
}

/* -------------------------------------------------------------------------- */
/* Backtracking                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Subsets by include/exclude. Each element is a binary decision, so the recursion
 * tree has 2ⁿ leaves and every leaf is one subset — that is why the count is 2ⁿ
 * rather than something that needs deriving.
 */
export function subsetsFrames(values: number[]): ArrayFrame[] {
  if (!values.length) return [snapshot([], {}, [], "Type some values to enumerate the subsets of", 0)];
  if (values.length > 6) {
    return [
      snapshot(values, {}, [], `${values.length} values means 2^${values.length} = ${2 ** values.length} subsets, which is too many to step through usefully. Use 6 values or fewer — the point is the branching, not the volume.`, 0),
    ];
  }

  const n = values.length;
  const chosen = new Array<boolean>(n).fill(false);
  const found: string[] = [];

  const labelsNow = (depth: number): Record<number, string> =>
    Object.fromEntries(values.map((_, i) => [i, i < depth ? (chosen[i] ? "in" : "out") : "?"]));

  const coloursNow = (depth: number, active?: number, activeColour?: Hex): Record<number, Hex> => {
    const out: Record<number, Hex> = {};
    values.forEach((_, i) => {
      if (i < depth) out[i] = chosen[i] ? C.done : C.faded;
    });
    if (active !== undefined) out[active] = activeColour ?? C.inspect;
    return out;
  };

  const current = (): string => `{${values.filter((_, i) => chosen[i]).join(", ") || "∅"}}`;

  const snap = (depth: number, description: string, codeLine: number, active?: number, colour?: Hex): ArrayFrame =>
    snapshot(values, coloursNow(depth, active, colour), [], description, codeLine, null, "horizontal", { labels: labelsNow(depth) });

  const frames: ArrayFrame[] = [
    snap(0, `Every element is one yes/no decision, so there are 2^${n} = ${2 ** n} subsets. Walk the decision tree depth-first.`, 0),
  ];

  const recurse = (i: number): void => {
    if (i === n) {
      found.push(current());
      frames.push(snap(n, `All ${n} decision(s) made → subset ${current()}. That is ${found.length} of ${2 ** n}.`, 1));
      return;
    }

    chosen[i] = true;
    frames.push(snap(i + 1, `Include ${values[i]} → building ${current()}`, 2, i, C.done));
    recurse(i + 1);

    chosen[i] = false;
    frames.push(snap(i + 1, `Backtrack: undo the choice for ${values[i]} and exclude it instead. Undoing the move is the whole difference between backtracking and a plain loop.`, 3, i, C.remove));
    recurse(i + 1);
  };

  recurse(0);

  frames.push(
    snapshot(values, {}, [], `${found.length} subset(s): ${found.join(", ")}. Each one costs O(n) to write out, so enumerating them all is O(n · 2ⁿ) — unavoidable, because the output itself is that large.`, 4),
  );
  return frames;
}

/**
 * Permutations by swapping. Instead of building a new array per permutation, one
 * array is reused: swap a candidate into position k, recurse, then swap it back.
 */
export function permutationsFrames(values: number[]): ArrayFrame[] {
  if (!values.length) return [snapshot([], {}, [], "Type some values to permute", 0)];
  if (values.length > 5) {
    const factorial = values.reduce((acc, _, i) => acc * (i + 1), 1);
    return [
      snapshot(values, {}, [], `${values.length} values means ${values.length}! = ${factorial} permutations — too many to step through. Use 5 values or fewer.`, 0),
    ];
  }

  const arr = values.slice();
  const n = arr.length;
  const found: string[] = [];
  const frames: ArrayFrame[] = [];

  const snap = (fixed: number, highlights: Record<number, Hex>, description: string, codeLine: number): ArrayFrame =>
    snapshot(arr.slice(), { ...Object.fromEntries(Array.from({ length: fixed }, (_, i) => [i, C.done])), ...highlights }, [], description, codeLine, fixed > 0 ? [0, fixed - 1] : null);

  const total = Array.from({ length: n }, (_, i) => i + 1).reduce((a, b) => a * b, 1);
  frames.push(snap(0, {}, `${n} values have ${n}! = ${total} permutations. Position 0 is decided first: each value in turn is swapped into it.`, 0));

  const recurse = (k: number): void => {
    if (k === n) {
      found.push(`[${arr.join(", ")}]`);
      frames.push(snap(n, {}, `Every position is fixed → permutation [${arr.join(", ")}]. ${found.length} of ${total}.`, 1));
      return;
    }
    for (let i = k; i < n; i += 1) {
      if (i === k) {
        frames.push(snap(k, { [k]: C.inspect }, `Position ${k}: try keeping ${arr[k]} where it is`, 2));
      } else {
        frames.push(snap(k, { [k]: C.move, [i]: C.move }, `Position ${k}: swap ${arr[i]} in from position ${i}`, 2));
        const tmp = arr[k];
        arr[k] = arr[i];
        arr[i] = tmp;
      }
      recurse(k + 1);
      if (i !== k) {
        const tmp = arr[k];
        arr[k] = arr[i];
        arr[i] = tmp;
        frames.push(snap(k, { [k]: C.remove, [i]: C.remove }, `Backtrack: swap ${arr[i]} back to position ${i} so the next branch starts from the original order. Skip this undo and every later branch is corrupted.`, 3));
      }
    }
  };

  recurse(0);

  frames.push(
    snapshot(values, {}, [], `${found.length} permutation(s): ${found.join(", ")}. Reusing one array means O(n) extra space instead of O(n · n!), at the cost of having to undo every swap.`, 4),
  );
  return frames;
}

/**
 * N-Queens. Pure backtracking: place one queen per row, reject immediately when
 * a placement is attacked, and undo on the way out. The animation stops at the
 * first solution — the total count is computed without animating, and reported.
 */
export function nQueensFrames(size: number): GridFrame[] {
  /* The op offers boards from 1 upward, and n = 2 and n = 3 are the interesting
     small cases: they have no solution at all. Clamping them up to 4 would have
     shown a 4×4 board without saying so, and the "no arrangement exists" frame
     would never have been reachable. */
  const n = clamp(size, 1, 8);
  const cols = new Array<number>(n).fill(-1);

  const headers = {
    rowHeaders: Array.from({ length: n }, (_, r) => `r${r}`),
    colHeaders: Array.from({ length: n }, (_, c) => `c${c}`),
  };

  const board = (placedRows: number, marks: Record<string, Hex>): GridCell[][] =>
    Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => {
        const isQueen = r < placedRows && cols[r] === c;
        return {
          value: isQueen ? "♛" : "·",
          color: marks[`${r},${c}`] ?? (isQueen ? C.done : undefined),
          raised: isQueen,
        };
      }),
    );

  const frames: GridFrame[] = [];
  const snap = (
    placedRows: number,
    description: string,
    codeLine: number,
    marks: Record<string, Hex> = {},
    cursor?: { row: number; col: number } | null,
  ): void => {
    frames.push(gridFrame(board(placedRows, marks), description, codeLine, { ...headers, cursor: cursor ?? null }));
  };

  /** Only rows above `row` are placed, so a column or diagonal clash is enough. */
  const conflict = (row: number, col: number): { row: number; why: string } | null => {
    for (let r = 0; r < row; r += 1) {
      if (cols[r] === col) return { row: r, why: `the queen on row ${r} shares column ${col}` };
      if (Math.abs(cols[r] - col) === row - r) return { row: r, why: `the queen on row ${r} is on the same diagonal` };
    }
    return null;
  };

  snap(0, `${n}×${n} board, ${n} queens, no two attacking. One queen per row is forced — two in a row would attack each other — so the only question is which column each row uses.`, 0);

  let placements = 0;
  let rejections = 0;
  let backtracks = 0;

  const search = (row: number): boolean => {
    if (row === n) return true;
    for (let col = 0; col < n; col += 1) {
      const clash = conflict(row, col);
      if (clash) {
        rejections += 1;
        snap(row, `Row ${row}, column ${col} is attacked — ${clash.why}. Reject it without going any deeper: that pruning is what keeps this far below ${n}^${n} attempts.`, 2, { [`${row},${col}`]: C.remove, [`${clash.row},${cols[clash.row]}`]: C.inspect }, { row, col });
        continue;
      }
      cols[row] = col;
      placements += 1;
      snap(row + 1, `Place a queen at row ${row}, column ${col}. ${row + 1} of ${n} placed.`, 1, {}, { row, col });
      if (search(row + 1)) return true;
      cols[row] = -1;
      backtracks += 1;
      snap(row, `Every column in row ${row + 1} failed, so the queen at (${row}, ${col}) was the wrong choice — lift it and try the next column. This undo is the "backtrack".`, 3, { [`${row},${col}`]: C.remove }, { row, col });
    }
    return false;
  };

  const solved = search(0);

  if (!solved) {
    snap(0, `No arrangement exists for n = ${n}. (This only happens for n = 2 and n = 3; every larger board has at least one solution.)`, 5);
    return frames;
  }

  /* Count the rest silently — animating thousands of further steps would teach nothing. */
  const counterCols = new Array<number>(n).fill(-1);
  let solutions = 0;
  const countAll = (row: number): void => {
    if (row === n) {
      solutions += 1;
      return;
    }
    for (let col = 0; col < n; col += 1) {
      let ok = true;
      for (let r = 0; r < row; r += 1) {
        if (counterCols[r] === col || Math.abs(counterCols[r] - col) === row - r) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      counterCols[row] = col;
      countAll(row + 1);
      counterCols[row] = -1;
    }
  };
  countAll(0);

  snap(n, `Solution found: columns [${cols.join(", ")}]. It took ${placements} placement(s), ${rejections} rejected square(s) and ${backtracks} backtrack(s). There are ${solutions} solution(s) in total for n = ${n} — the rest were counted without animating, since watching them adds nothing the first one did not already show.`, 4);
  return frames;
}
