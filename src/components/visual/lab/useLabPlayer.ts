/**
 * The step player.
 *
 * Extracted from the prototype's player block (`frames` / `frameIndex`, which
 * were module-level `let`s) so that two mounts of the lab cannot share one
 * playhead.
 *
 * It is deliberately a scrubber over a finished recording, not a live
 * simulation: `frames` is already the complete list of states the algorithm
 * passed through, so stepping backwards is exact rather than a re-run, and
 * dragging the slider cannot land on a state the algorithm never held.
 *
 * There is no autoplay and no delay control. Stepping is the whole interface:
 * a student reads the narration for a step, then asks for the next one. A
 * timer competes with that reading, and the delay slider existed only to tune
 * how badly — so both are gone. Removing them also removed the player's only
 * reason to know about `prefers-reduced-motion`, which is now purely the
 * renderer's concern.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Frame } from "./types";

export interface LabPlayer {
  /** The frame to draw. `null` only when there are no frames at all. */
  frame: Frame | null;
  index: number;
  total: number;
  atEnd: boolean;
  next: () => void;
  prev: () => void;
  seek: (index: number) => void;
}

export function useLabPlayer(frames: Frame[]): LabPlayer {
  const [index, setIndex] = useState(0);

  const total = frames.length;
  const lastIndex = Math.max(0, total - 1);

  /* A new recording — different operation, different input, or a re-run —
     starts from the top rather than stranding the playhead at an index that
     meant something in the previous recording. */
  useEffect(() => {
    setIndex(0);
  }, [frames]);

  const next = useCallback(() => setIndex((current) => Math.min(current + 1, lastIndex)), [lastIndex]);
  const prev = useCallback(() => setIndex((current) => Math.max(current - 1, 0)), []);

  const seek = useCallback(
    (value: number) => setIndex(Math.min(Math.max(0, Math.round(value)), lastIndex)),
    [lastIndex],
  );

  /* Keyboard control. The canvas is opaque to a screen reader, so keyboard
     parity is not a nicety here — it is the only way through the visualisation
     without a mouse. The guard keeps the arrows out of the way while someone is
     typing into the values box. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, prev]);

  const frame = useMemo(
    () => (total ? frames[Math.min(index, lastIndex)] : null),
    [frames, index, lastIndex, total],
  );

  return {
    frame,
    index: Math.min(index, lastIndex),
    total,
    atEnd: index >= lastIndex,
    next,
    prev,
    seek,
  };
}
