/**
 * The step player.
 *
 * Extracted from the prototype's player block (`frames` / `frameIndex` /
 * `playing` / `timer` / `speedMs`, which were module-level `let`s) so that two
 * mounts of the lab cannot share one playhead.
 *
 * It is deliberately a scrubber over a finished recording, not a live simulation:
 * `frames` is already the complete list of states the algorithm passed through,
 * so stepping backwards is exact rather than a re-run, and dragging the slider
 * cannot land on a state the algorithm never held.
 *
 * `speedMs` is a *delay*, carried over from the prototype: higher is slower.
 * The UI labels it as a delay for that reason rather than showing a "1×" that
 * would have to mean something.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Frame } from "./types";

export const SPEED_MIN = 250;
export const SPEED_MAX = 2000;
export const SPEED_STEP = 50;
export const SPEED_DEFAULT = 900;

export interface LabPlayer {
  /** The frame to draw. `null` only when there are no frames at all. */
  frame: Frame | null;
  index: number;
  total: number;
  playing: boolean;
  atEnd: boolean;
  speedMs: number;
  next: () => void;
  prev: () => void;
  toggle: () => void;
  pause: () => void;
  restart: () => void;
  seek: (index: number) => void;
  setSpeedMs: (ms: number) => void;
}

export function useLabPlayer(frames: Frame[], reducedMotion = false): LabPlayer {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(SPEED_DEFAULT);
  const timer = useRef<number>();

  const total = frames.length;
  const lastIndex = Math.max(0, total - 1);

  /* A new recording — different operation, different input, or a re-run — starts
     from the top and paused. Autoplaying here would move the picture before the
     student has read what they just changed. */
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [frames]);

  useEffect(() => {
    if (!playing) return;
    if (index >= lastIndex) {
      setPlaying(false);
      return;
    }
    timer.current = window.setTimeout(() => setIndex((current) => current + 1), speedMs);
    return () => window.clearTimeout(timer.current);
  }, [playing, index, lastIndex, speedMs]);

  /* Under `prefers-reduced-motion` playback is never started automatically, and
     an already-running playback stops if the preference changes mid-session. */
  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);

  const next = useCallback(() => setIndex((current) => Math.min(current + 1, lastIndex)), [lastIndex]);
  const prev = useCallback(() => setIndex((current) => Math.max(current - 1, 0)), []);
  const pause = useCallback(() => setPlaying(false), []);

  const restart = useCallback(() => {
    setIndex(0);
    setPlaying(false);
  }, []);

  const seek = useCallback(
    (value: number) => {
      /* Scrubbing is an explicit act of looking at one step, so it stops
         playback rather than fighting the timer for the playhead. */
      setPlaying(false);
      setIndex(Math.min(Math.max(0, Math.round(value)), lastIndex));
    },
    [lastIndex],
  );

  const toggle = useCallback(() => {
    setPlaying((current) => {
      if (current) return false;
      /* Pressing play at the end replays from the start, which is what every
         video player does and what the prototype did. */
      setIndex((at) => (at >= lastIndex ? 0 : at));
      return true;
    });
  }, [lastIndex]);

  /* Keyboard control, carried over from the 2-D player this replaces. The canvas
     is opaque to a screen reader, so keyboard parity is not a nicety here — it is
     the only way through the visualisation without a mouse. The guard keeps the
     shortcuts out of the way while someone is typing into the values box. */
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
      if (event.key === " ") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, prev, toggle]);

  const frame = useMemo(() => (total ? frames[Math.min(index, lastIndex)] : null), [frames, index, lastIndex, total]);

  return {
    frame,
    index: Math.min(index, lastIndex),
    total,
    playing,
    atEnd: index >= lastIndex,
    speedMs,
    next,
    prev,
    toggle,
    pause,
    restart,
    seek,
    setSpeedMs,
  };
}
