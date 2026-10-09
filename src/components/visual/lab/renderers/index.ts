/**
 * Frame → renderer dispatch.
 *
 * The switch is exhaustive over the `Frame` union, and the `never` in the default
 * branch is what enforces that: add a frame type to `types.ts` without writing a
 * renderer for it and this file stops compiling. That is the check that matters,
 * because a missing renderer would otherwise surface as a silently empty canvas
 * in front of a student.
 */

import { disposeObject, type RenderContext } from "../primitives";
import type { Frame } from "../types";

import { renderArrayFrame } from "./array";
import { renderGraphFrame } from "./graph";
import { renderGridFrame } from "./grid";
import { renderHashFrame } from "./hash";
import { renderLinkedListFrame } from "./linkedlist";
import { renderTowersFrame } from "./towers";
import { renderTreeFrame } from "./tree";

export function renderFrame(frame: Frame | null | undefined, ctx: RenderContext): void {
  /* Every frame is drawn from scratch. Interpolating between frames would be
     prettier, but it would also mean showing a state the algorithm never held. */
  for (let i = ctx.group.children.length - 1; i >= 0; i -= 1) {
    const child = ctx.group.children[i];
    ctx.group.remove(child);
    disposeObject(child);
  }

  if (!frame) return;

  switch (frame.type) {
    case "array":
      renderArrayFrame(frame, ctx);
      return;
    case "linkedlist":
      renderLinkedListFrame(frame, ctx);
      return;
    case "tree":
      renderTreeFrame(frame, ctx);
      return;
    case "graph":
      renderGraphFrame(frame, ctx);
      return;
    case "grid":
      renderGridFrame(frame, ctx);
      return;
    case "hash":
      renderHashFrame(frame, ctx);
      return;
    case "towers":
      renderTowersFrame(frame, ctx);
      return;
    default: {
      const exhaustive: never = frame;
      throw new Error(`No renderer for frame type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export {
  renderArrayFrame,
  renderGraphFrame,
  renderGridFrame,
  renderHashFrame,
  renderLinkedListFrame,
  renderTowersFrame,
  renderTreeFrame,
};
