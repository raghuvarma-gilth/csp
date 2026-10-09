/**
 * The hash table renderer.
 *
 * Buckets run as a column along z — index 0 farthest from the camera — with each
 * bucket's chain extending to the right. That layout is chosen so the two
 * collision strategies look as different as they actually are: separate chaining
 * grows *sideways* off one bucket, while linear and quadratic probing stay one
 * cell wide and walk *down* the column. The probe trail makes that walk explicit,
 * numbered in the order the slots were tried, because "how many slots did that
 * lookup touch?" is the entire cost model of a hash table.
 */

import { Vector3 } from "three";

import {
  BASE_COLOR,
  STRUCTURE_COLOR,
  createCube,
  createEdgeLine,
  createLabel,
  createPlate,
  fitCameraToExtent,
  hexToInt,
  type RenderContext,
} from "../primitives";
import { C, type HashEntry, type HashFrame } from "../types";

const BUCKET_GAP = 3.4;
const SLOT_GAP = 3.2;
const FIRST_SLOT_X = 0;
const INDEX_X = -3.4;
const PROBE_Y = 3.6;

/** `key: value` when there is a value, otherwise just the key. */
const entryText = (entry: HashEntry): string =>
  entry.value === undefined || entry.value === "" ? String(entry.key) : `${entry.key}:${entry.value}`;

export function renderHashFrame(frame: HashFrame, ctx: RenderContext): void {
  const buckets = frame.buckets ?? [];
  const count = buckets.length;
  if (!count) return;

  const originZ = ((count - 1) * BUCKET_GAP) / 2;
  const zOf = (i: number): number => i * BUCKET_GAP - originZ;
  const widest = Math.max(1, ...buckets.map((bucket) => bucket.entries.length));

  buckets.forEach((bucket, i) => {
    const z = zOf(i);
    const slots = Math.max(1, bucket.entries.length);

    /* The bucket floor. It extends only as far as the chain, so a long chain is
       visibly a long chain — that is what a bad hash function looks like. */
    const plate = createPlate(
      slots * SLOT_GAP + 0.6,
      2.8,
      hexToInt(bucket.color, STRUCTURE_COLOR),
      bucket.color ? 0.3 : 0.12,
    );
    plate.position.set(FIRST_SLOT_X + ((slots - 1) * SLOT_GAP) / 2, -0.2, z);
    ctx.group.add(plate);

    const index = createLabel(`[${bucket.index}]`, {
      color: "#94a3b8",
      fontSize: 64,
      outlineColor: "#000000",
      outlineWidth: 10,
      width: 2.2,
      height: 0.9,
    });
    index.position.set(INDEX_X, 0.4, z);
    ctx.group.add(index);

    if (!bucket.entries.length) {
      const empty = createLabel("empty", {
        color: "#475569",
        fontSize: 52,
        outlineColor: "#000000",
        outlineWidth: 8,
        width: 2.4,
        height: 0.8,
      });
      empty.position.set(FIRST_SLOT_X, 0.4, z);
      ctx.group.add(empty);
      return;
    }

    bucket.entries.forEach((entry, j) => {
      const cube = createCube(entryText(entry), hexToInt(entry.color, BASE_COLOR), { size: 2.2 });
      cube.position.set(FIRST_SLOT_X + j * SLOT_GAP, 1.1, z);
      ctx.group.add(cube);

      /* Chain links, so a chain reads as a linked list rather than as a row. */
      if (j > 0) {
        ctx.group.add(
          createEdgeLine(
            new Vector3(FIRST_SLOT_X + (j - 1) * SLOT_GAP + 1.1, 1.1, z),
            new Vector3(FIRST_SLOT_X + j * SLOT_GAP - 1.1, 1.1, z),
            hexToInt(C.cursor),
          ),
        );
      }
    });
  });

  /* The probe sequence: every slot this operation has tried, in order. */
  const probe = frame.probe ?? [];
  probe.forEach((bucketIndex, step) => {
    const position = buckets.findIndex((bucket) => bucket.index === bucketIndex);
    if (position < 0) return;
    const z = zOf(position);

    const marker = createLabel(String(step + 1), {
      color: "#f59e0b",
      fontSize: 72,
      outlineColor: "#000000",
      outlineWidth: 12,
      width: 1.2,
      height: 1.2,
    });
    marker.position.set(INDEX_X - 1.8, PROBE_Y, z);
    ctx.group.add(marker);

    if (step > 0) {
      const previous = buckets.findIndex((bucket) => bucket.index === probe[step - 1]);
      if (previous >= 0) {
        ctx.group.add(
          createEdgeLine(
            new Vector3(INDEX_X - 1.8, PROBE_Y, zOf(previous)),
            new Vector3(INDEX_X - 1.8, PROBE_Y, z),
            hexToInt(C.move),
          ),
        );
      }
    }
  });

  const depth = count * BUCKET_GAP;
  const width = widest * SLOT_GAP + 8;
  fitCameraToExtent(ctx.rig, Math.max(22, Math.max(depth, width) * 1.45));
}
