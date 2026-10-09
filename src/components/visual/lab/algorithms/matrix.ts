/**
 * Matrices and grids.
 *
 * A 2-D array is still one flat block of memory — `values` is reshaped into rows
 * by a `cols` parameter, exactly as `grid[r][c]` really resolves to
 * `flat[r * cols + c]`. Seeing the same numbers rearrange when `cols` changes is
 * the point of the reshape being a parameter rather than a fixed layout.
 *
 * Flood fill and the shortest-path walk read a `0` as a wall, so the student
 * draws their own maze by typing it.
 */

import { gridFrame } from "../frames";
import { C, type GridCell, type GridFrame, type Hex } from "../types";

interface Grid {
  rows: number;
  cols: number;
  cells: number[][];
}

const key = (row: number, col: number): string => `${row},${col}`;

const toGrid = (values: number[], colsParam: number): Grid => {
  const safe = values.length ? values : [0];
  const cols = Math.max(1, Math.min(Math.round(colsParam) || 4, safe.length));
  const rows = Math.ceil(safe.length / cols);
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => safe[r * cols + c] ?? 0),
  );
  return { rows, cols, cells };
};

const headers = (g: Grid) => ({
  rowHeaders: Array.from({ length: g.rows }, (_, r) => `r${r}`),
  colHeaders: Array.from({ length: g.cols }, (_, c) => `c${c}`),
});

interface PaintOptions {
  colours?: Record<string, Hex>;
  raised?: ReadonlySet<string>;
  values?: Record<string, string | number>;
  cursor?: { row: number; col: number } | null;
}

const snap = (g: Grid, description: string, codeLine: number, opts?: PaintOptions): GridFrame => {
  const cells: GridCell[][] = g.cells.map((row, r) =>
    row.map((value, c) => ({
      value: opts?.values?.[key(r, c)] ?? value,
      color: opts?.colours?.[key(r, c)],
      raised: opts?.raised?.has(key(r, c)),
    })),
  );
  return gridFrame(cells, description, codeLine, { ...headers(g), cursor: opts?.cursor ?? null });
};

const clampRow = (value: number, g: Grid): number => Math.max(0, Math.min(Math.round(value) || 0, g.rows - 1));
const clampCol = (value: number, g: Grid): number => Math.max(0, Math.min(Math.round(value) || 0, g.cols - 1));

const DIRS: Array<[number, number, string]> = [
  [-1, 0, "up"],
  [0, 1, "right"],
  [1, 0, "down"],
  [0, -1, "left"],
];

/* -------------------------------------------------------------------------- */
/* Traversal and rearrangement                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Spiral traversal. Four boundaries that close in on each other — the bug every
 * first attempt has is forgetting to re-check them before the third and fourth
 * passes, which is why those two checks are called out in their own frames.
 */
export function spiralFrames(values: number[], cols: number): GridFrame[] {
  const g = toGrid(values, cols);
  const frames: GridFrame[] = [
    snap(g, `${g.rows}×${g.cols} grid. Walk the outer ring, then shrink the boundaries and walk the next ring in.`, 0),
  ];

  let top = 0;
  let bottom = g.rows - 1;
  let left = 0;
  let right = g.cols - 1;
  const visited: Record<string, Hex> = {};
  const order: number[] = [];
  let guard = 0;

  while (top <= bottom && left <= right && guard < 10000) {
    guard += 1;

    for (let c = left; c <= right; c += 1) {
      visited[key(top, c)] = C.done;
      order.push(g.cells[top][c]);
      frames.push(snap(g, `→ row ${top}, column ${c}: ${g.cells[top][c]}`, 1, { colours: { ...visited, [key(top, c)]: C.inspect }, cursor: { row: top, col: c } }));
    }
    top += 1;

    for (let r = top; r <= bottom; r += 1) {
      visited[key(r, right)] = C.done;
      order.push(g.cells[r][right]);
      frames.push(snap(g, `↓ row ${r}, column ${right}: ${g.cells[r][right]}`, 2, { colours: { ...visited, [key(r, right)]: C.inspect }, cursor: { row: r, col: right } }));
    }
    right -= 1;

    if (top > bottom) {
      frames.push(snap(g, `top (${top}) has passed bottom (${bottom}) — the bottom row was already consumed, so skip it. Forgetting this check is the classic spiral bug: it re-emits a row.`, 3, { colours: visited }));
      break;
    }
    for (let c = right; c >= left; c -= 1) {
      visited[key(bottom, c)] = C.done;
      order.push(g.cells[bottom][c]);
      frames.push(snap(g, `← row ${bottom}, column ${c}: ${g.cells[bottom][c]}`, 3, { colours: { ...visited, [key(bottom, c)]: C.inspect }, cursor: { row: bottom, col: c } }));
    }
    bottom -= 1;

    if (left > right) {
      frames.push(snap(g, `left (${left}) has passed right (${right}) — the left column was already consumed, so skip it`, 4, { colours: visited }));
      break;
    }
    for (let r = bottom; r >= top; r -= 1) {
      visited[key(r, left)] = C.done;
      order.push(g.cells[r][left]);
      frames.push(snap(g, `↑ row ${r}, column ${left}: ${g.cells[r][left]}`, 4, { colours: { ...visited, [key(r, left)]: C.inspect }, cursor: { row: r, col: left } }));
    }
    left += 1;
  }

  frames.push(
    snap(g, `Spiral order: ${order.join(", ")}. ${order.length} cell(s) out of ${g.rows * g.cols} — every cell exactly once, so O(rows × cols).`, 5, { colours: visited }),
  );
  return frames;
}

/**
 * In-place transpose. Only the cells above the diagonal are swapped: going over
 * the whole matrix would swap every pair twice and hand back what you started
 * with, which is a mistake worth seeing stated.
 */
export function transposeFrames(values: number[], cols: number): GridFrame[] {
  const g = toGrid(values, cols);
  if (g.rows !== g.cols) {
    return [
      snap(g, `This grid is ${g.rows}×${g.cols}, and an in-place transpose needs a square one — cell (r, c) swaps with (c, r), and (c, r) does not exist unless rows = cols. Type ${g.cols * g.cols} value(s) with cols = ${g.cols}, or change cols to ${g.rows}.`, 0),
    ];
  }

  const n = g.rows;
  const frames: GridFrame[] = [
    snap(g, `Transpose a ${n}×${n} matrix: every cell (r, c) trades places with (c, r), so rows become columns.`, 0),
  ];
  const settled: Record<string, Hex> = {};
  let swaps = 0;

  for (let r = 0; r < n; r += 1) {
    settled[key(r, r)] = C.done;
    frames.push(snap(g, `(${r}, ${r}) is on the diagonal — it swaps with itself, so leave it alone`, 1, { colours: { ...settled, [key(r, r)]: C.cursor } }));
    for (let c = r + 1; c < n; c += 1) {
      frames.push(
        snap(g, `Swap (${r}, ${c}) = ${g.cells[r][c]} with (${c}, ${r}) = ${g.cells[c][r]}`, 2, {
          colours: { ...settled, [key(r, c)]: C.inspect, [key(c, r)]: C.move },
          cursor: { row: r, col: c },
        }),
      );
      const tmp = g.cells[r][c];
      g.cells[r][c] = g.cells[c][r];
      g.cells[c][r] = tmp;
      swaps += 1;
      settled[key(r, c)] = C.done;
      settled[key(c, r)] = C.done;
      frames.push(snap(g, `Swapped. ${swaps} swap(s) so far.`, 2, { colours: settled }));
    }
  }

  frames.push(
    snap(g, `Transposed in ${swaps} swap(s) — only the ${swaps} cell(s) above the diagonal were visited. Looping over all ${n * n} cells would swap every pair twice and undo the work.`, 3, { colours: settled }),
  );
  return frames;
}

/**
 * Rotate 90° clockwise, the two-step way: transpose, then reverse each row. It
 * is the standard interview answer because both halves are in place — no second
 * matrix is ever allocated.
 */
export function rotateFrames(values: number[], cols: number): GridFrame[] {
  const g = toGrid(values, cols);
  if (g.rows !== g.cols) {
    return [
      snap(g, `This grid is ${g.rows}×${g.cols}. An in-place 90° rotation needs a square matrix — a ${g.rows}×${g.cols} rotated is ${g.cols}×${g.rows}, a different shape, so it cannot be written back over itself. Type ${g.cols * g.cols} value(s), or change cols to ${g.rows}.`, 0),
    ];
  }

  const n = g.rows;
  const frames: GridFrame[] = [
    snap(g, `Rotate ${n}×${n} clockwise, in place, in two passes: transpose first, then reverse every row. Watch where the top-left value ${g.cells[0][0]} ends up.`, 0),
  ];

  for (let r = 0; r < n; r += 1) {
    for (let c = r + 1; c < n; c += 1) {
      const tmp = g.cells[r][c];
      g.cells[r][c] = g.cells[c][r];
      g.cells[c][r] = tmp;
      frames.push(
        snap(g, `Pass 1 (transpose): (${r}, ${c}) ↔ (${c}, ${r})`, 1, { colours: { [key(r, c)]: C.move, [key(c, r)]: C.move } }),
      );
    }
  }
  frames.push(snap(g, "Transposed. This alone is a reflection across the diagonal, not a rotation — the second pass is what turns it into one.", 2));

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < Math.floor(n / 2); c += 1) {
      const mirror = n - 1 - c;
      const tmp = g.cells[r][c];
      g.cells[r][c] = g.cells[r][mirror];
      g.cells[r][mirror] = tmp;
      frames.push(
        snap(g, `Pass 2 (reverse row ${r}): column ${c} ↔ column ${mirror}`, 3, { colours: { [key(r, c)]: C.inspect, [key(r, mirror)]: C.inspect }, cursor: { row: r, col: c } }),
      );
    }
    frames.push(snap(g, `Row ${r} reversed`, 3, { colours: Object.fromEntries(Array.from({ length: n }, (_, c) => [key(r, c), C.done])) }));
  }

  frames.push(
    snap(g, `Rotated 90° clockwise with no second matrix — O(1) extra space. For anti-clockwise, reverse the columns instead of the rows.`, 4),
  );
  return frames;
}

/* -------------------------------------------------------------------------- */
/* Search on a grid                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Flood fill — the paint-bucket tool. It is a depth-first search where the grid
 * itself is the graph: a cell's neighbours are whatever is next to it.
 */
export function floodFillFrames(values: number[], cols: number, row: number, col: number): GridFrame[] {
  const g = toGrid(values, cols);
  const r0 = clampRow(row, g);
  const c0 = clampCol(col, g);
  const target = g.cells[r0][c0];

  const frames: GridFrame[] = [
    snap(g, `Flood fill from (${r0}, ${c0}), which holds ${target}. Every cell reachable from there through cells that also hold ${target} gets filled — the region is defined by connectivity, not by position.`, 0, {
      colours: { [key(r0, c0)]: C.cursor },
      cursor: { row: r0, col: c0 },
    }),
  ];

  const filled: Record<string, Hex> = {};
  const seen = new Set<string>([key(r0, c0)]);
  const stack: Array<[number, number]> = [[r0, c0]];
  let guard = 0;
  let rejected = 0;

  while (stack.length && guard < 10000) {
    guard += 1;
    const [r, c] = stack.pop() as [number, number];
    filled[key(r, c)] = C.done;
    frames.push(
      snap(g, `Fill (${r}, ${c}). Stack holds ${stack.length} cell(s) still to expand.`, 1, {
        colours: { ...filled, [key(r, c)]: C.move },
        cursor: { row: r, col: c },
      }),
    );

    for (const [dr, dc, name] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= g.rows || nc < 0 || nc >= g.cols) continue;
      if (seen.has(key(nr, nc))) continue;
      if (g.cells[nr][nc] !== target) {
        rejected += 1;
        frames.push(
          snap(g, `${name} of (${r}, ${c}) is (${nr}, ${nc}) = ${g.cells[nr][nc]} ≠ ${target} — a boundary, so the fill stops here`, 2, {
            colours: { ...filled, [key(nr, nc)]: C.remove },
            cursor: { row: nr, col: nc },
          }),
        );
        continue;
      }
      seen.add(key(nr, nc));
      stack.push([nr, nc]);
      frames.push(
        snap(g, `${name} of (${r}, ${c}) is (${nr}, ${nc}) = ${target} — same region, push it`, 3, {
          colours: { ...filled, [key(nr, nc)]: C.inspect },
          cursor: { row: nr, col: nc },
        }),
      );
    }
  }

  const count = Object.keys(filled).length;
  frames.push(
    snap(g, `Filled ${count} cell(s) of ${g.rows * g.cols}, and hit ${rejected} boundary edge(s). Marking a cell *when it is pushed* rather than when it is popped is what stops it entering the stack four times.`, 4, { colours: filled }),
  );
  return frames;
}

/**
 * Shortest path on a grid, by BFS. Breadth-first is what makes it shortest: the
 * frontier expands one full ring at a time, so the first time a cell is reached
 * is necessarily by a shortest route.
 */
export function gridShortestPathFrames(values: number[], cols: number): GridFrame[] {
  const g = toGrid(values, cols);
  const WALL = 0;
  const walls = new Set<string>();
  for (let r = 0; r < g.rows; r += 1) {
    for (let c = 0; c < g.cols; c += 1) {
      if (g.cells[r][c] === WALL) walls.add(key(r, c));
    }
  }

  const display: Record<string, string | number> = {};
  walls.forEach((k) => {
    display[k] = "█";
  });
  for (let r = 0; r < g.rows; r += 1) {
    for (let c = 0; c < g.cols; c += 1) {
      if (!walls.has(key(r, c))) display[key(r, c)] = "·";
    }
  }

  const startKey = key(0, 0);
  const goalR = g.rows - 1;
  const goalC = g.cols - 1;
  const goalKey = key(goalR, goalC);

  const base: PaintOptions = { values: display, raised: walls };
  const frames: GridFrame[] = [
    snap(g, `Any cell you typed as 0 is a wall (█). Find the shortest path from (0, 0) to (${goalR}, ${goalC}), moving up/down/left/right only. Each cell will show its distance from the start.`, 0, {
      ...base,
      colours: { [startKey]: C.cursor, [goalKey]: C.window },
    }),
  ];

  if (walls.has(startKey) || walls.has(goalKey)) {
    frames.push(
      snap(g, `${walls.has(startKey) ? "The start" : "The goal"} is a wall, so there is nothing to search. Change that 0 to any other number.`, 5, { ...base, colours: { [startKey]: C.remove, [goalKey]: C.remove } }),
    );
    return frames;
  }

  const dist: Record<string, number> = { [startKey]: 0 };
  const from: Record<string, string> = {};
  const colours: Record<string, Hex> = { [startKey]: C.done };
  let queue: Array<[number, number]> = [[0, 0]];
  display[startKey] = 0;
  let found = false;
  let ring = 0;
  let guard = 0;

  while (queue.length && !found && guard < 10000) {
    guard += 1;
    const next: Array<[number, number]> = [];
    ring += 1;

    for (const [r, c] of queue) {
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        const nk = key(nr, nc);
        if (nr < 0 || nr >= g.rows || nc < 0 || nc >= g.cols) continue;
        if (walls.has(nk) || nk in dist) continue;
        dist[nk] = ring;
        from[nk] = key(r, c);
        display[nk] = ring;
        colours[nk] = C.done;
        next.push([nr, nc]);
        if (nk === goalKey) {
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!next.length) break;
    frames.push(
      snap(g, found
        ? `Ring ${ring} reached the goal. Because the frontier grows one ring at a time, the first arrival is a shortest one — no later path can be shorter.`
        : `Ring ${ring}: ${next.length} new cell(s) are exactly ${ring} step(s) from the start`, 1, {
        ...base,
        colours: { ...colours, ...Object.fromEntries(next.map(([r, c]) => [key(r, c), found && key(r, c) === goalKey ? C.window : C.inspect])) },
      }),
    );
    queue = next;
  }

  if (!found) {
    const reached = Object.keys(dist).length;
    const open = g.rows * g.cols - walls.size;
    frames.push(
      snap(g, `The frontier ran out after reaching ${reached} of ${open} open cell(s) — the walls cut the goal off completely, so no path exists. That is a real answer, not a failure.`, 4, { ...base, colours: { ...colours, [goalKey]: C.remove } }),
    );
    return frames;
  }

  const path: string[] = [];
  let cur = goalKey;
  let back = 0;
  while (cur !== startKey && back < 10000) {
    back += 1;
    path.push(cur);
    cur = from[cur];
  }
  path.push(startKey);
  path.reverse();

  const pathColours: Record<string, Hex> = { ...colours };
  path.forEach((k) => {
    pathColours[k] = C.window;
    frames.push(snap(g, `Path so far: ${path.slice(0, path.indexOf(k) + 1).join(" → ")}`, 2, { ...base, colours: { ...pathColours } }));
  });

  frames.push(
    snap(g, `Shortest path is ${dist[goalKey]} step(s) through ${path.length} cell(s). BFS visited ${Object.keys(dist).length} cell(s) to prove it — and note it never needed edge weights, because on a grid every move costs the same. Weighted moves would need Dijkstra instead.`, 3, { ...base, colours: pathColours }),
  );
  return frames;
}
