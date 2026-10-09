/**
 * Dynamic programming.
 *
 * Every operation here is the same move made six times: find the subproblems,
 * put them in a table, and fill the table in an order where each cell's inputs
 * are already sitting next to it. The tables are drawn as grids precisely so the
 * *dependencies* are visible — each frame lights up the cells the current one is
 * reading from, which is the part a formula on a page hides.
 *
 * Compare `recursion / call tree` with `fibonacci table` below: same problem,
 * same arithmetic, and the difference between O(2ⁿ) and O(n) is only that the
 * table refuses to compute anything twice.
 */

import { gridFrame, parseValues, snapshot } from "../frames";
import { C, type ArrayFrame, type GridCell, type GridFrame, type Hex } from "../types";

const clamp = (value: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(Math.round(value) || lo, hi));

const cellKey = (row: number, col: number): string => `${row},${col}`;

interface TableOptions {
  colours?: Record<string, Hex>;
  cursor?: { row: number; col: number } | null;
  filled?: (row: number, col: number) => boolean;
}

/** One grid frame from a 2-D table, blanking the cells not yet computed. */
const tableFrame = (
  table: number[][],
  rowHeaders: string[],
  colHeaders: string[],
  description: string,
  codeLine: number,
  opts?: TableOptions,
): GridFrame => {
  const cells: GridCell[][] = table.map((row, r) =>
    row.map((value, c) => ({
      value: opts?.filled && !opts.filled(r, c) ? "·" : value,
      color: opts?.colours?.[cellKey(r, c)],
    })),
  );
  return gridFrame(cells, description, codeLine, { rowHeaders, colHeaders, cursor: opts?.cursor ?? null });
};

/* -------------------------------------------------------------------------- */
/* 1-D tables                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Fibonacci, tabulated. Run `recursion / call tree` on the same n first: that
 * one makes thousands of calls, this one makes n additions, and the only change
 * is that an answer once computed is kept.
 */
export function fibTableFrames(n: number): ArrayFrame[] {
  const target = clamp(n, 1, 25);
  const dp = new Array<number>(target + 1).fill(0);
  const labels = Object.fromEntries(Array.from({ length: target + 1 }, (_, i) => [i, `fib(${i})`]));
  const known = new Set<number>();

  const snap = (highlights: Record<number, Hex>, description: string, codeLine: number): ArrayFrame =>
    snapshot(
      dp.map((v, i) => (known.has(i) ? v : "·")),
      highlights,
      [],
      description,
      codeLine,
      null,
      "horizontal",
      { labels },
    );

  const frames: ArrayFrame[] = [
    snap({}, `One slot per value of fib, from 0 to ${target}. Fill left to right, so both inputs of every cell are already computed by the time it is reached.`, 0),
  ];

  dp[0] = 0;
  known.add(0);
  frames.push(snap({ 0: C.done }, "fib(0) = 0 — a base case, written in directly", 1));
  if (target >= 1) {
    dp[1] = 1;
    known.add(1);
    frames.push(snap({ 1: C.done }, "fib(1) = 1 — the other base case", 1));
  }

  for (let i = 2; i <= target; i += 1) {
    dp[i] = dp[i - 1] + dp[i - 2];
    known.add(i);
    frames.push(
      snap({ [i]: C.inspect, [i - 1]: C.cursor, [i - 2]: C.window }, `fib(${i}) = fib(${i - 1}) + fib(${i - 2}) = ${dp[i - 1]} + ${dp[i - 2]} = ${dp[i]}. Both inputs were already in the table — nothing is recomputed.`, 2),
    );
  }

  frames.push(
    snap(Object.fromEntries(dp.map((_, i) => [i, C.done])), `fib(${target}) = ${dp[target]} after ${Math.max(0, target - 1)} addition(s). The naive recursion would have made roughly ${dp[target] * 2} call(s) for the same answer. Only the last two slots are ever read, so this can also be done in O(1) space.`, 3),
  );
  return frames;
}

/**
 * Coin change — fewest coins making the amount. The table is indexed by *amount*,
 * not by coin, which is the reorientation students usually need: each cell asks
 * "if I already know the best answer for every smaller amount, what is the best
 * answer for this one?"
 */
export function coinChangeFrames(values: number[], amount: number): ArrayFrame[] {
  const coins = Array.from(new Set(values.filter((v) => v > 0 && Number.isInteger(v)))).sort((a, b) => a - b);
  if (!coins.length) {
    return [snapshot([], {}, [], "Type some positive whole-number coin denominations, for example 1, 3, 4", 0)];
  }
  const target = clamp(amount, 1, 30);

  const INF = Infinity;
  const dp = new Array<number>(target + 1).fill(INF);
  const pick = new Array<number>(target + 1).fill(-1);
  const labels = Object.fromEntries(Array.from({ length: target + 1 }, (_, i) => [i, String(i)]));

  const display = (): Array<string | number> => dp.map((v) => (v === INF ? "∞" : v));
  const snap = (highlights: Record<number, Hex>, description: string, codeLine: number): ArrayFrame =>
    snapshot(display(), highlights, [], description, codeLine, null, "horizontal", { labels });

  const frames: ArrayFrame[] = [
    snap({}, `Coins ${coins.join(", ")}. Slot i will hold the fewest coins that make exactly i. Everything starts at ∞ — "no way known yet".`, 0),
  ];

  dp[0] = 0;
  frames.push(snap({ 0: C.done }, "Amount 0 needs 0 coins. That base case is what every other cell eventually stands on.", 1));

  for (let value = 1; value <= target; value += 1) {
    let best = INF;
    let bestCoin = -1;
    for (const coin of coins) {
      if (coin > value) {
        frames.push(snap({ [value]: C.inspect }, `Coin ${coin} is larger than ${value} — cannot be used here`, 2));
        continue;
      }
      const sub = dp[value - coin];
      if (sub === INF) {
        frames.push(snap({ [value]: C.inspect, [value - coin]: C.remove }, `Using coin ${coin} leaves ${value - coin}, which has no solution — this route is dead`, 3));
        continue;
      }
      const candidate = sub + 1;
      frames.push(
        snap({ [value]: C.inspect, [value - coin]: C.cursor }, `Using coin ${coin} leaves ${value - coin}, which takes ${sub} coin(s) — so ${value} would take ${candidate}${candidate < best ? ", better than anything so far" : `, no better than ${best}`}`, 4),
      );
      if (candidate < best) {
        best = candidate;
        bestCoin = coin;
      }
    }
    dp[value] = best;
    pick[value] = bestCoin;
    frames.push(
      snap({ [value]: best === INF ? C.remove : C.done }, best === INF
        ? `Amount ${value} cannot be made from ${coins.join(", ")} at all`
        : `Best for ${value} is ${best} coin(s), starting with a ${bestCoin}`, 5),
    );
  }

  if (dp[target] === INF) {
    frames.push(
      snap({ [target]: C.remove }, `${target} cannot be made from ${coins.join(", ")}. That is a real answer — with coins ${coins.join(", ")} some amounts are simply unreachable.`, 6),
    );
    return frames;
  }

  const used: number[] = [];
  let rest = target;
  const path: Record<number, Hex> = {};
  while (rest > 0) {
    path[rest] = C.window;
    used.push(pick[rest]);
    rest -= pick[rest];
  }
  path[0] = C.window;
  frames.push(
    snap(path, `${target} takes ${dp[target]} coin(s): ${used.join(" + ")}. The table was filled in ${target} step(s) of ${coins.length} check(s) each — O(amount × coins). Note that greedily taking the largest coin first does not always give this answer.`, 7),
  );
  return frames;
}

/**
 * Longest increasing subsequence, the O(n²) way. The dp row beneath the values
 * is the whole algorithm: `dp[i]` is the best subsequence ending exactly at i,
 * and every cell looks back over all the smaller values before it.
 */
export function lisFrames(values: number[]): ArrayFrame[] {
  if (!values.length) return [snapshot([], {}, [], "Type some values to find the longest increasing subsequence of", 0)];
  const n = values.length;
  const dp = new Array<number>(n).fill(1);
  const prev = new Array<number>(n).fill(-1);

  const snap = (highlights: Record<number, Hex>, description: string, codeLine: number): ArrayFrame =>
    snapshot(values, highlights, [], description, codeLine, null, "horizontal", {
      secondary: { label: "dp — longest increasing subsequence ending here", values: dp.slice() },
    });

  const frames: ArrayFrame[] = [
    snap({}, "Every element on its own is an increasing subsequence of length 1, so the dp row starts at all 1s.", 0),
  ];

  for (let i = 1; i < n; i += 1) {
    frames.push(snap({ [i]: C.inspect }, `Consider ${values[i]} at index ${i}. Which earlier element can it extend?`, 1));
    for (let j = 0; j < i; j += 1) {
      if (values[j] < values[i]) {
        const candidate = dp[j] + 1;
        if (candidate > dp[i]) {
          dp[i] = candidate;
          prev[i] = j;
          frames.push(snap({ [i]: C.done, [j]: C.cursor }, `${values[j]} < ${values[i]}, and the best run ending at ${values[j]} is ${dp[j]} — so ${values[i]} can extend it to ${dp[i]}`, 2));
        } else {
          frames.push(snap({ [i]: C.inspect, [j]: C.faded }, `${values[j]} < ${values[i]}, but extending it gives only ${candidate}, which is no better than ${dp[i]}`, 3));
        }
      } else {
        frames.push(snap({ [i]: C.inspect, [j]: C.remove }, `${values[j]} ≥ ${values[i]} — cannot be extended, the subsequence must increase`, 4));
      }
    }
  }

  let bestIndex = 0;
  dp.forEach((v, i) => {
    if (v > dp[bestIndex]) bestIndex = i;
  });

  const chain: number[] = [];
  let k = bestIndex;
  while (k !== -1) {
    chain.push(k);
    k = prev[k];
  }
  chain.reverse();

  frames.push(
    snap(Object.fromEntries(chain.map((i) => [i, C.window])), `Longest increasing subsequence has length ${dp[bestIndex]}: ${chain.map((i) => values[i]).join(", ")}. Two nested loops means O(n²); a patience-sorting variant does it in O(n log n), but this version is the one that shows why the answer is what it is.`, 5),
  );
  return frames;
}

/* -------------------------------------------------------------------------- */
/* 2-D tables                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 0/1 knapsack. "0/1" means each item is taken whole or not at all, which is
 * exactly why a greedy value-per-weight rule fails and a table is needed.
 * Weights come from the values field; profits from the text parameter.
 */
export function knapsackFrames(values: number[], profitsRaw: string, capacityRaw: number): GridFrame[] {
  const weights = values.filter((w) => w > 0 && Number.isInteger(w)).slice(0, 6);
  const profits = parseValues(profitsRaw).slice(0, 6);
  const capacity = clamp(capacityRaw, 1, 14);

  const blank = (description: string): GridFrame =>
    gridFrame([[{ value: "·" }]], description, 0, { rowHeaders: [""], colHeaders: [""] });

  if (!weights.length) return [blank("Type some positive whole-number item weights in the values field")];
  if (profits.length !== weights.length) {
    return [
      blank(`There are ${weights.length} weight(s) but ${profits.length} profit(s). Each item needs both — type ${weights.length} comma-separated profit(s) to match.`),
    ];
  }

  const n = weights.length;
  const table = Array.from({ length: n + 1 }, () => new Array<number>(capacity + 1).fill(0));
  const rowHeaders = ["no items", ...weights.map((w, i) => `w${w} p${profits[i]}`)];
  const colHeaders = Array.from({ length: capacity + 1 }, (_, c) => String(c));
  const computed = new Set<string>();
  const filled = (r: number, c: number): boolean => computed.has(cellKey(r, c));

  const snap = (description: string, codeLine: number, opts?: TableOptions): GridFrame =>
    tableFrame(table, rowHeaders, colHeaders, description, codeLine, { ...opts, filled });

  const frames: GridFrame[] = [];
  for (let c = 0; c <= capacity; c += 1) computed.add(cellKey(0, c));
  frames.push(
    snap(`Row r, column c holds the best profit using only the first r item(s) with a bag of capacity c. The top row is all 0 — with no items there is nothing to carry, whatever the capacity.`, 0, {
      colours: Object.fromEntries(Array.from({ length: capacity + 1 }, (_, c) => [cellKey(0, c), C.faded])),
    }),
  );

  for (let i = 1; i <= n; i += 1) {
    const w = weights[i - 1];
    const p = profits[i - 1];
    for (let c = 0; c <= capacity; c += 1) {
      const skip = table[i - 1][c];
      if (w > c) {
        table[i][c] = skip;
        computed.add(cellKey(i, c));
        frames.push(
          snap(`Item ${i} weighs ${w}, more than the capacity ${c} — it cannot fit, so copy the answer from the row above: ${skip}`, 1, {
            colours: { [cellKey(i, c)]: C.faded, [cellKey(i - 1, c)]: C.cursor },
            cursor: { row: i, col: c },
          }),
        );
        continue;
      }
      const take = table[i - 1][c - w] + p;
      table[i][c] = Math.max(skip, take);
      computed.add(cellKey(i, c));
      frames.push(
        snap(`Capacity ${c}, item ${i} (weight ${w}, profit ${p}). Skip it → ${skip}. Take it → ${p} + best of capacity ${c - w} with the earlier items (${table[i - 1][c - w]}) = ${take}. ${take > skip ? `Taking wins: ${take}.` : take === skip ? `A tie — either choice gives ${skip}.` : `Skipping wins: ${skip}.`}`, 2, {
          colours: {
            [cellKey(i, c)]: take > skip ? C.done : C.inspect,
            [cellKey(i - 1, c)]: C.cursor,
            [cellKey(i - 1, c - w)]: C.window,
          },
          cursor: { row: i, col: c },
        }),
      );
    }
  }

  const chosen: number[] = [];
  const path: Record<string, Hex> = {};
  let c = capacity;
  for (let i = n; i > 0; i -= 1) {
    path[cellKey(i, c)] = C.window;
    if (table[i][c] !== table[i - 1][c]) {
      chosen.push(i);
      c -= weights[i - 1];
    }
  }
  chosen.reverse();

  const totalWeight = chosen.reduce((sum, i) => sum + weights[i - 1], 0);
  frames.push(
    snap(`Best profit ${table[n][capacity]}, taking item(s) ${chosen.join(", ") || "none"} for a total weight of ${totalWeight}/${capacity}. Reading back up the table shows which items were taken — a cell that differs from the one above it means that item was used. ${(n + 1) * (capacity + 1)} cells, each O(1), so O(items × capacity).`, 3, { colours: path, filled }),
  );
  return frames;
}

/**
 * Longest common subsequence. The single rule to take away: characters equal →
 * step diagonally and add one; characters different → take the better of the two
 * neighbours. The diagonal is what makes it a *subsequence* rather than a
 * substring.
 */
export function lcsFrames(firstRaw: string, secondRaw: string): GridFrame[] {
  const a = String(firstRaw ?? "").trim().slice(0, 9);
  const b = String(secondRaw ?? "").trim().slice(0, 9);
  const blank = (description: string): GridFrame =>
    gridFrame([[{ value: "·" }]], description, 0, { rowHeaders: [""], colHeaders: [""] });
  if (!a.length || !b.length) return [blank("Type two strings to compare")];

  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const rowHeaders = ["ε", ...a.split("")];
  const colHeaders = ["ε", ...b.split("")];
  const computed = new Set<string>();
  const filled = (r: number, c: number): boolean => computed.has(cellKey(r, c));

  const snap = (description: string, codeLine: number, opts?: TableOptions): GridFrame =>
    tableFrame(table, rowHeaders, colHeaders, description, codeLine, { ...opts, filled });

  for (let c = 0; c <= m; c += 1) computed.add(cellKey(0, c));
  for (let r = 0; r <= n; r += 1) computed.add(cellKey(r, 0));

  const frames: GridFrame[] = [
    snap(`Cell (r, c) will hold the length of the longest common subsequence of the first r character(s) of "${a}" and the first c of "${b}". The ε row and column are 0 — an empty string shares nothing with anything.`, 0, {
      colours: {
        ...Object.fromEntries(Array.from({ length: m + 1 }, (_, c) => [cellKey(0, c), C.faded])),
        ...Object.fromEntries(Array.from({ length: n + 1 }, (_, r) => [cellKey(r, 0), C.faded])),
      },
    }),
  ];

  for (let r = 1; r <= n; r += 1) {
    for (let c = 1; c <= m; c += 1) {
      computed.add(cellKey(r, c));
      if (a[r - 1] === b[c - 1]) {
        table[r][c] = table[r - 1][c - 1] + 1;
        frames.push(
          snap(`'${a[r - 1]}' = '${b[c - 1]}' — both strings can use this character, so take the diagonal (${table[r - 1][c - 1]}) and add one: ${table[r][c]}`, 1, {
            colours: { [cellKey(r, c)]: C.done, [cellKey(r - 1, c - 1)]: C.window },
            cursor: { row: r, col: c },
          }),
        );
      } else {
        const up = table[r - 1][c];
        const left = table[r][c - 1];
        table[r][c] = Math.max(up, left);
        frames.push(
          snap(`'${a[r - 1]}' ≠ '${b[c - 1]}' — one of them has to be dropped. Dropping '${a[r - 1]}' gives ${up}, dropping '${b[c - 1]}' gives ${left}; keep the better: ${table[r][c]}.`, 2, {
            colours: { [cellKey(r, c)]: C.inspect, [cellKey(r - 1, c)]: C.cursor, [cellKey(r, c - 1)]: C.cursor },
            cursor: { row: r, col: c },
          }),
        );
      }
    }
  }

  const path: Record<string, Hex> = {};
  const letters: string[] = [];
  let r = n;
  let c = m;
  let guard = 0;
  while (r > 0 && c > 0 && guard < 10000) {
    guard += 1;
    path[cellKey(r, c)] = C.window;
    if (a[r - 1] === b[c - 1]) {
      letters.push(a[r - 1]);
      r -= 1;
      c -= 1;
    } else if (table[r - 1][c] >= table[r][c - 1]) {
      r -= 1;
    } else {
      c -= 1;
    }
  }
  letters.reverse();

  frames.push(
    snap(`The longest common subsequence of "${a}" and "${b}" has length ${table[n][m]}: "${letters.join("")}". Walking back from the bottom-right recovers it — a diagonal step means that character was kept. ${(n + 1) * (m + 1)} cells in total, so O(n × m).`, 3, { colours: path, filled }),
  );
  return frames;
}

/**
 * Edit distance (Levenshtein). Same table shape as LCS, but every cell is a
 * minimum over three edits rather than a maximum over two — and the three
 * neighbours it reads from are exactly insert, delete and substitute.
 */
export function editDistanceFrames(firstRaw: string, secondRaw: string): GridFrame[] {
  const a = String(firstRaw ?? "").trim().slice(0, 9);
  const b = String(secondRaw ?? "").trim().slice(0, 9);
  const blank = (description: string): GridFrame =>
    gridFrame([[{ value: "·" }]], description, 0, { rowHeaders: [""], colHeaders: [""] });
  if (!a.length || !b.length) return [blank("Type two strings to compare")];

  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const rowHeaders = ["ε", ...a.split("")];
  const colHeaders = ["ε", ...b.split("")];
  const computed = new Set<string>();
  const filled = (r: number, c: number): boolean => computed.has(cellKey(r, c));

  const snap = (description: string, codeLine: number, opts?: TableOptions): GridFrame =>
    tableFrame(table, rowHeaders, colHeaders, description, codeLine, { ...opts, filled });

  const frames: GridFrame[] = [];
  for (let c = 0; c <= m; c += 1) {
    table[0][c] = c;
    computed.add(cellKey(0, c));
  }
  for (let r = 0; r <= n; r += 1) {
    table[r][0] = r;
    computed.add(cellKey(r, 0));
  }
  frames.push(
    snap(`Turn "${a}" into "${b}" with the fewest insert, delete or substitute operations. The borders are free: turning "${a}" into an empty string takes ${n} deletion(s), and building "${b}" from nothing takes ${m} insertion(s).`, 0, {
      colours: {
        ...Object.fromEntries(Array.from({ length: m + 1 }, (_, c) => [cellKey(0, c), C.faded])),
        ...Object.fromEntries(Array.from({ length: n + 1 }, (_, r) => [cellKey(r, 0), C.faded])),
      },
    }),
  );

  for (let r = 1; r <= n; r += 1) {
    for (let c = 1; c <= m; c += 1) {
      computed.add(cellKey(r, c));
      if (a[r - 1] === b[c - 1]) {
        table[r][c] = table[r - 1][c - 1];
        frames.push(
          snap(`'${a[r - 1]}' = '${b[c - 1]}' — nothing to do, so this cell costs the same as the diagonal: ${table[r][c]}`, 1, {
            colours: { [cellKey(r, c)]: C.done, [cellKey(r - 1, c - 1)]: C.window },
            cursor: { row: r, col: c },
          }),
        );
        continue;
      }
      const substitute = table[r - 1][c - 1] + 1;
      const remove = table[r - 1][c] + 1;
      const insert = table[r][c - 1] + 1;
      table[r][c] = Math.min(substitute, remove, insert);
      const winner =
        table[r][c] === substitute ? `substitute '${a[r - 1]}' → '${b[c - 1]}'` : table[r][c] === remove ? `delete '${a[r - 1]}'` : `insert '${b[c - 1]}'`;
      frames.push(
        snap(`'${a[r - 1]}' ≠ '${b[c - 1]}'. Substitute → ${substitute} (diagonal), delete → ${remove} (above), insert → ${insert} (left). Cheapest is ${table[r][c]}: ${winner}.`, 2, {
          colours: {
            [cellKey(r, c)]: C.inspect,
            [cellKey(r - 1, c - 1)]: C.window,
            [cellKey(r - 1, c)]: C.cursor,
            [cellKey(r, c - 1)]: C.cursor,
          },
          cursor: { row: r, col: c },
        }),
      );
    }
  }

  const path: Record<string, Hex> = {};
  const steps: string[] = [];
  let r = n;
  let c = m;
  let guard = 0;
  while ((r > 0 || c > 0) && guard < 10000) {
    guard += 1;
    path[cellKey(r, c)] = C.window;
    if (r > 0 && c > 0 && a[r - 1] === b[c - 1]) {
      r -= 1;
      c -= 1;
    } else if (r > 0 && c > 0 && table[r][c] === table[r - 1][c - 1] + 1) {
      steps.push(`substitute '${a[r - 1]}' → '${b[c - 1]}'`);
      r -= 1;
      c -= 1;
    } else if (r > 0 && table[r][c] === table[r - 1][c] + 1) {
      steps.push(`delete '${a[r - 1]}'`);
      r -= 1;
    } else {
      steps.push(`insert '${b[c - 1]}'`);
      c -= 1;
    }
  }
  path[cellKey(0, 0)] = C.window;
  steps.reverse();

  frames.push(
    snap(`Edit distance is ${table[n][m]}: ${steps.join(", ") || "the strings are already equal"}. The bottom-right cell is the answer, and the path back to the top-left is the actual sequence of edits.`, 3, { colours: path, filled }),
  );
  return frames;
}
