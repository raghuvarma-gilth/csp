/**
 * The Towers of Hanoi renderer.
 *
 * Pegs bottom-to-top, disk radius scaling with disk size, so the rule of the
 * puzzle — never a larger disk on a smaller one — is something you can *see*
 * being obeyed rather than something you have to take on trust.
 *
 * `lifted` is drawn in the air at the centre rather than above its source peg.
 * That is not a shortcut: the algorithm has already popped the disk before the
 * frame is emitted, so the renderer genuinely does not know where it came from.
 * Showing it mid-air is the honest reading — "in transit" — and inventing a
 * source peg would be making something up.
 */

import {
  createDisk,
  createLabel,
  createPeg,
  fitCameraToExtent,
  type RenderContext,
} from "../primitives";
import type { TowersFrame } from "../types";

const PEG_GAP = 9;
const DISK_HEIGHT = 0.85;
const BASE_Y = 0.6;
const PEG_NAMES = ["A", "B", "C", "D", "E"];

/** Disk colour by size, so a disk keeps its identity as it moves between pegs. */
const DISK_COLORS = [0x38bdf8, 0x22c55e, 0xeab308, 0xf59e0b, 0xef4444, 0xa855f7];
const diskColor = (size: number): number => DISK_COLORS[(Math.max(1, size) - 1) % DISK_COLORS.length];

export function renderTowersFrame(frame: TowersFrame, ctx: RenderContext): void {
  const pegs = frame.pegs ?? [];
  const count = pegs.length;
  if (!count) return;

  const originX = ((count - 1) * PEG_GAP) / 2;
  const xOf = (i: number): number => i * PEG_GAP - originX;

  const onPegs = pegs.flat();
  const maxSize = Math.max(1, ...onPegs, frame.lifted ?? 1);
  const totalDisks = onPegs.length + (frame.lifted != null ? 1 : 0);
  const pegHeight = (Math.max(3, totalDisks) + 2) * DISK_HEIGHT;

  pegs.forEach((stack, i) => {
    const peg = createPeg(pegHeight, PEG_NAMES[i] ?? String(i + 1));
    peg.position.x = xOf(i);
    ctx.group.add(peg);

    stack.forEach((size, level) => {
      const disk = createDisk(size, maxSize, diskColor(size));
      disk.position.set(xOf(i), BASE_Y + level * DISK_HEIGHT, 0);
      ctx.group.add(disk);
    });
  });

  if (frame.lifted != null) {
    const disk = createDisk(frame.lifted, maxSize, diskColor(frame.lifted));
    disk.position.set(0, pegHeight + 2.4, 0);
    ctx.group.add(disk);

    const caption = createLabel("in transit", {
      color: "#f59e0b",
      fontSize: 54,
      outlineColor: "#000000",
      outlineWidth: 10,
      width: 3.4,
      height: 1,
    });
    caption.position.set(0, pegHeight + 4, 0);
    ctx.group.add(caption);
  }

  fitCameraToExtent(ctx.rig, Math.max(26, count * PEG_GAP * 1.5, pegHeight * 2.4));
}
