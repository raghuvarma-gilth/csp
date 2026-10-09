/**
 * The graph renderer.
 *
 * Nodes sit on the ground plane at their laid-out `(x, z)`; the camera looks down
 * on them, so a graph reads like a map rather than a diagram. Three additions
 * over the prototype earn their keep:
 *
 *   * edge `state`, so Kruskal can show an edge *rejected* and Prim can show one
 *     *chosen* — algorithms whose whole story is which edges they picked;
 *   * edge `weight`, without which Dijkstra is indistinguishable from BFS;
 *   * `directed`, because a topological sort of an undirected graph is nonsense.
 */

import { Vector3 } from "three";

import {
  BASE_COLOR,
  STRUCTURE_COLOR,
  createDirectedEdge,
  createEdgeLabel,
  createEdgeLine,
  createSphereNode,
  fitCameraToExtent,
  hexToInt,
  type RenderContext,
} from "../primitives";
import { C, type EdgeState, type GraphFrame } from "../types";

const EDGE_COLOR: Record<EdgeState, number> = {
  idle: STRUCTURE_COLOR,
  active: hexToInt(C.inspect),
  chosen: hexToInt(C.done),
  rejected: hexToInt(C.remove),
};

export function renderGraphFrame(frame: GraphFrame, ctx: RenderContext): void {
  const nodes = frame.nodes ?? [];
  const edges = frame.edges ?? [];
  const byId = new Map(nodes.map((node) => [node.id, node]));

  nodes.forEach((node) => {
    const group = createSphereNode(node.label ?? String(node.id), hexToInt(frame.highlights?.[node.id], BASE_COLOR), {
      badge: node.badge ?? null,
    });
    group.position.set(node.x, 0, node.z);
    ctx.group.add(group);
  });

  edges.forEach((edge) => {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (!a || !b) return;

    /* With no explicit state, fall back to the prototype's rule: an edge between
       two settled nodes is part of what has been traversed. */
    const bothDone = frame.highlights?.[edge.from] === C.done && frame.highlights?.[edge.to] === C.done;
    const color = edge.state ? EDGE_COLOR[edge.state] : bothDone ? hexToInt(C.done) : STRUCTURE_COLOR;

    const from = new Vector3(a.x, 0, a.z);
    const to = new Vector3(b.x, 0, b.z);
    ctx.group.add(edge.directed ? createDirectedEdge(from, to, color) : createEdgeLine(from, to, color));

    if (edge.weight != null) {
      ctx.group.add(createEdgeLabel(from, to, String(edge.weight), color));
    }
  });

  const extent = nodes.length
    ? Math.max(...nodes.map((n) => Math.max(Math.abs(n.x), Math.abs(n.z))))
    : 10;
  fitCameraToExtent(ctx.rig, Math.max(26, extent * 2.4));
}
