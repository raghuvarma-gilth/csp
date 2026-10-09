/**
 * The grid renderer — the one that unlocked the most operations.
 *
 * Matrix traversals, grid BFS, the N-Queens board and every 2-D DP table are all
 * "a value at (row, col) with a state", so they all draw here. Two details matter:
 *
 *   * **row 0 sits at the most negative z**, so from the default camera looking
 *     down and in, row 0 reads as the top row. A DP table whose first row is at
 *     the bottom is actively confusing to read against the pseudocode.
 *   * a `null` cell draws nothing at all. That is how a jagged board or a
 *     not-yet-considered region stays honestly empty rather than showing a zero
 *     the algorithm has not computed.
 */

import {
  BASE_COLOR,
  STRUCTURE_COLOR,
  createCursorRing,
  createLabel,
  createPlate,
  createTile,
  fitCameraToExtent,
  hexToInt,
  type RenderContext,
} from "../primitives";
import { C, type GridFrame } from "../types";

const SPACING = 2.8;
const TILE = 2.4;

export function renderGridFrame(frame: GridFrame, ctx: RenderContext): void {
  const rows = frame.cells?.length ?? 0;
  const cols = rows ? Math.max(...frame.cells.map((row) => row.length)) : 0;
  if (!rows || !cols) return;

  const originX = ((cols - 1) * SPACING) / 2;
  const originZ = ((rows - 1) * SPACING) / 2;
  const xOf = (col: number): number => col * SPACING - originX;
  const zOf = (row: number): number => row * SPACING - originZ;

  frame.cells.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return;
      const tile = createTile(cell.value, hexToInt(cell.color, BASE_COLOR), {
        size: TILE,
        raised: cell.raised,
      });
      tile.position.set(xOf(c), 0, zOf(r));
      ctx.group.add(tile);
    });
  });

  /* A faint slab under the whole board, so an empty cell still reads as part of
     the table rather than as a hole in space. */
  const plate = createPlate(cols * SPACING + 0.8, rows * SPACING + 0.8, STRUCTURE_COLOR, 0.14);
  plate.position.y = -0.14;
  ctx.group.add(plate);

  const headerOptions = {
    color: "#94a3b8",
    fontSize: 62,
    outlineColor: "#000000",
    outlineWidth: 10,
    width: 2.4,
    height: 0.9,
  };

  frame.rowHeaders?.slice(0, rows).forEach((text, r) => {
    if (!text) return;
    const label = createLabel(text, headerOptions);
    label.position.set(-originX - SPACING, 0.8, zOf(r));
    ctx.group.add(label);
  });

  frame.colHeaders?.slice(0, cols).forEach((text, c) => {
    if (!text) return;
    const label = createLabel(text, headerOptions);
    label.position.set(xOf(c), 0.8, -originZ - SPACING);
    ctx.group.add(label);
  });

  if (frame.cursor) {
    const { row, col } = frame.cursor;
    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      const ring = createCursorRing(hexToInt(C.cursor), TILE * 0.78);
      ring.position.set(xOf(col), 0.65, zOf(row));
      ctx.group.add(ring);
    }
  }

  const width = cols * SPACING;
  const depth = rows * SPACING;
  fitCameraToExtent(ctx.rig, Math.max(20, Math.max(width, depth) * 1.5));
}
