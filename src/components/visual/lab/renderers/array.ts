/**
 * The array renderer — and, by extension, most of the lab.
 *
 * One renderer covers the linear row, the vertical stack, the ring (a circular
 * queue's whole point), pointers, the translucent window box, and the optional
 * second row that KMP's lps table, counting sort's buckets and every 1-D DP
 * table are drawn with. Adding a second row here removed the need for three
 * near-identical renderers, which is why `ArraySecondary` exists at all.
 */

import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from "three";

import {
  BASE_COLOR,
  createCube,
  createLabel,
  createPointer,
  fitCameraToExtent,
  hexToInt,
  type RenderContext,
} from "../primitives";
import { C, type ArrayFrame } from "../types";

const SPACING = 3.2;
const SECONDARY_Z = -4.6;
const SECONDARY_SIZE = 2;

/** Long row labels are cut for the sprite; the full text stays in the DOM panel. */
const shortLabel = (label: string): string => (label.length > 26 ? `${label.slice(0, 25)}…` : label);

const positionsFor = (frame: ArrayFrame, count: number): Vector3[] => {
  const total = (count - 1) * SPACING;

  if (frame.orientation === "vertical") {
    return Array.from({ length: count }, (_, i) => new Vector3(0, i * SPACING - total / 2, 0));
  }

  if (frame.orientation === "ring") {
    const radius = Math.max(6, (count * SPACING) / (2 * Math.PI));
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
      return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    });
  }

  return Array.from({ length: count }, (_, i) => new Vector3(i * SPACING - total / 2, 0, 0));
};

export function renderArrayFrame(frame: ArrayFrame, ctx: RenderContext): void {
  const values = frame.values ?? [];
  const n = values.length;
  const positions = positionsFor(frame, n);
  const total = (n - 1) * SPACING;

  values.forEach((value, i) => {
    const cube = createCube(value, hexToInt(frame.highlights?.[i], BASE_COLOR), {
      caption: frame.labels?.[i] ?? `[${i}]`,
    });
    cube.position.copy(positions[i]);
    ctx.group.add(cube);
  });

  /* Two pointers can land on one index — `left` and `right` meeting is the whole
     ending of a two-pointer scan — so repeats are offset rather than hidden. */
  const seen = new Map<number, number>();
  (frame.pointers ?? []).forEach((p) => {
    if (p.index == null || p.index < 0 || p.index >= n) return;
    const occurrence = seen.get(p.index) ?? 0;
    seen.set(p.index, occurrence + 1);
    const pointer = createPointer(hexToInt(p.color, hexToInt(C.cursor)), p.label);
    pointer.position.copy(positions[p.index]);
    if (frame.orientation === "vertical") {
      pointer.position.x += 3.6 + occurrence * 1.4;
    } else {
      pointer.position.z += occurrence * 1.4;
    }
    ctx.group.add(pointer);
  });

  /* The window box: one translucent volume spanning the active subrange. */
  if (frame.windowRange && frame.orientation !== "ring") {
    const [l, r] = frame.windowRange;
    if (l != null && r != null && l <= r && l >= 0 && r < n) {
      const span = (r - l + 1) * SPACING;
      const vertical = frame.orientation === "vertical";
      const box = new Mesh(
        new BoxGeometry(vertical ? 3.4 : span, vertical ? span : 3.4, 3.4),
        new MeshBasicMaterial({ color: hexToInt(C.window), transparent: true, opacity: 0.18 }),
      );
      box.position.copy(positions[l]).add(positions[r]).multiplyScalar(0.5);
      ctx.group.add(box);
    }
  }

  /* The second row, set back so it reads as supporting rather than parallel data. */
  const secondary = frame.secondary;
  if (secondary && secondary.values.length) {
    const count = secondary.values.length;
    const secondaryTotal = (count - 1) * SPACING;

    secondary.values.forEach((value, i) => {
      const text = String(value ?? "");
      if (!text.length) return;
      const cube = createCube(value, hexToInt(secondary.highlights?.[i], hexToInt(C.cursor)), {
        caption: secondary.labels?.[i] ?? null,
        size: SECONDARY_SIZE,
        dim: true,
      });
      cube.position.set(i * SPACING - secondaryTotal / 2, frame.orientation === "vertical" ? 0 : -0.25, SECONDARY_Z);
      if (frame.orientation === "vertical") cube.position.set(-4.6, i * SPACING - secondaryTotal / 2, 0);
      ctx.group.add(cube);
    });

    const caption = createLabel(shortLabel(secondary.label), {
      color: "#94a3b8",
      fontSize: 52,
      outlineColor: "#000000",
      outlineWidth: 8,
      width: 7.5,
      height: 1,
    });
    caption.position.set(0, frame.orientation === "vertical" ? -secondaryTotal / 2 - 2.6 : 2.6, SECONDARY_Z);
    ctx.group.add(caption);
  }

  if (frame.orientation === "ring") {
    const radius = Math.max(6, (n * SPACING) / (2 * Math.PI));
    fitCameraToExtent(ctx.rig, Math.max(20, radius * 3));
  } else if (frame.orientation === "vertical") {
    fitCameraToExtent(ctx.rig, Math.max(20, total * 1.6));
  } else {
    fitCameraToExtent(ctx.rig, Math.max(20, total * 1.3));
  }
}
