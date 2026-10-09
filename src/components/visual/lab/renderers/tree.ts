/**
 * The tree renderer.
 *
 * Positions arrive already computed — `layoutTree` and `layoutNaryTree` in
 * `frames.ts` do that work in the pure layer, so the verify script can check a
 * tree's shape without a GPU. All this file does is place spheres, join each one
 * to its parent, and draw the three annotations trees need: a badge (an AVL
 * balance factor, a Dijkstra distance), a sub-label (a segment tree's covered
 * range) and a ghost (a node not yet attached, or a call not yet made).
 */

import { Vector3 } from "three";

import {
  BASE_COLOR,
  STRUCTURE_COLOR,
  createEdgeLine,
  createSphereNode,
  fitCameraToExtent,
  hexToInt,
  type RenderContext,
} from "../primitives";
import type { TreeFrame } from "../types";

export function renderTreeFrame(frame: TreeFrame, ctx: RenderContext): void {
  const nodes = frame.nodes ?? [];
  const byId = new Map(nodes.map((node) => [String(node.id), node]));

  nodes.forEach((node) => {
    const group = createSphereNode(String(node.value), hexToInt(frame.highlights?.[node.id], BASE_COLOR), {
      badge: node.badge ?? null,
      subLabel: node.subLabel ?? null,
      ghost: node.ghost,
    });
    group.position.set(node.x, node.y, 0);
    ctx.group.add(group);

    if (node.parentId != null) {
      const parent = byId.get(String(node.parentId));
      if (parent) {
        ctx.group.add(
          createEdgeLine(
            new Vector3(parent.x, parent.y, 0),
            new Vector3(node.x, node.y, 0),
            STRUCTURE_COLOR,
          ),
        );
      }
    }
  });

  const extentX = nodes.length ? Math.max(...nodes.map((n) => Math.abs(n.x))) : 10;
  const extentY = nodes.length ? Math.max(...nodes.map((n) => Math.abs(n.y))) : 10;
  fitCameraToExtent(ctx.rig, Math.max(extentX, extentY) * 2.6);
}
