/**
 * The linked-list renderer.
 *
 * The forward arrows are the point: an array's order is implied by its
 * addresses, a list's order is *stored*, and that is why an insertion is cheap
 * and an index lookup is not. The extras — backward arrows, the circular wrap,
 * and a tail that loops back into the middle — are what make doubly-linked
 * lists and Floyd's cycle detection legible.
 */

import { ConeGeometry, Mesh, MeshStandardMaterial, Vector3 } from "three";

import {
  BASE_COLOR,
  createEdgeLine,
  createPointer,
  createSphereNode,
  fitCameraToExtent,
  hexToInt,
  type RenderContext,
} from "../primitives";
import { C, type LinkedListFrame } from "../types";

const SPACING = 3.8;
const NODE_RADIUS = 1.15;
const FORWARD_COLOR = hexToInt(C.cursor);
const BACKWARD_COLOR = 0x94a3b8;

/** A straight arrow between two nodes, stopping at the node surface. */
const arrow = (from: Vector3, to: Vector3, colorInt: number, ctx: RenderContext): void => {
  const direction = new Vector3().subVectors(to, from);
  const length = direction.length();
  if (length <= NODE_RADIUS * 2) return;
  direction.normalize();

  const start = new Vector3().copy(from).addScaledVector(direction, NODE_RADIUS + 0.25);
  const tip = new Vector3().copy(to).addScaledVector(direction, -(NODE_RADIUS + 0.25));
  ctx.group.add(createEdgeLine(start, tip, colorInt));

  const head = new Mesh(
    new ConeGeometry(0.26, 0.8, 16),
    new MeshStandardMaterial({ color: colorInt, emissive: colorInt, emissiveIntensity: 0.4 }),
  );
  head.position.copy(tip);
  head.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
  ctx.group.add(head);
};

/**
 * A link that cannot be drawn straight without cutting through every node in
 * between — the circular wrap, or the tail of a cycle. Routed underneath as
 * three segments so it is obviously a *link* and obviously not part of the row.
 */
const routeUnder = (fromX: number, toX: number, colorInt: number, depth: number, ctx: RenderContext): void => {
  const drop = new Vector3(fromX, -depth, 0);
  const rise = new Vector3(toX, -depth, 0);
  ctx.group.add(createEdgeLine(new Vector3(fromX, -NODE_RADIUS - 0.2, 0), drop, colorInt));
  ctx.group.add(createEdgeLine(drop, rise, colorInt));
  arrow(rise, new Vector3(toX, -NODE_RADIUS - 0.2, 0), colorInt, ctx);
};

export function renderLinkedListFrame(frame: LinkedListFrame, ctx: RenderContext): void {
  const nodes = frame.nodes ?? [];
  const n = nodes.length;
  const total = (n - 1) * SPACING;
  const positionOf = new Map<string, Vector3>();

  nodes.forEach((node, i) => {
    const position = new Vector3(i * SPACING - total / 2, 0, 0);
    positionOf.set(String(node.id), position);
    const group = createSphereNode(String(node.value), hexToInt(frame.highlights?.[node.id], BASE_COLOR));
    group.position.copy(position);
    ctx.group.add(group);
  });

  for (let i = 0; i < n - 1; i += 1) {
    const from = positionOf.get(String(nodes[i].id));
    const to = positionOf.get(String(nodes[i + 1].id));
    if (!from || !to) continue;
    arrow(from, to, FORWARD_COLOR, ctx);
    if (frame.doubly) {
      const back = new Vector3(0, 0, -1.6);
      arrow(new Vector3().copy(to).add(back), new Vector3().copy(from).add(back), BACKWARD_COLOR, ctx);
    }
  }

  if (frame.circular && n > 1) {
    routeUnder(total / 2, -total / 2, FORWARD_COLOR, 3.4, ctx);
  }

  /* A cycle: the tail points back into the middle of the list, not off the end. */
  if (frame.cycleTo != null && frame.cycleTo >= 0 && frame.cycleTo < n && n > 1) {
    const target = positionOf.get(String(nodes[frame.cycleTo].id));
    if (target) routeUnder(total / 2, target.x, hexToInt(C.remove), 4.2, ctx);
  }

  /* Two pointers on one node — Floyd's fast and slow meeting — must not stack
     exactly on top of each other, or the second one is invisible. */
  const seen = new Map<string, number>();
  (frame.pointers ?? []).forEach((p) => {
    const position = positionOf.get(String(p.nodeId));
    if (!position) return;
    const key = String(p.nodeId);
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    const pointer = createPointer(hexToInt(p.color, hexToInt(C.cursor)), p.label);
    pointer.position.copy(position);
    pointer.position.z += occurrence * 1.3;
    ctx.group.add(pointer);
  });

  fitCameraToExtent(ctx.rig, Math.max(20, total * 1.3));
}
