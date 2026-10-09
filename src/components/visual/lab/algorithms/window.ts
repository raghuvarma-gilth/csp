/**
 * Sliding window.
 *
 * The idea every one of these shares: when the window moves, do not recompute it
 * — adjust it. One value enters, one value leaves, and the answer updates in O(1).
 */

import { pointer, rangeHighlight, snapshot } from "../frames";
import { C, type ArrayFrame } from "../types";

/** Fixed-size window. This is what the `sliding-window` lesson deep-links to. */
export function fixedWindowFrames(values: number[], size: number): ArrayFrame[] {
  const arr = values.slice();
  const n = arr.length;
  const k = Math.max(1, Math.min(Math.round(size) || 3, Math.max(1, n)));
  if (n < k) return [snapshot(arr, {}, [], `The window is ${k} wide but the array only has ${n} element(s)`, 0)];

  let sum = 0;
  for (let i = 0; i < k; i += 1) sum += arr[i];
  let best = sum;
  let bestStart = 0;

  const frames = [
    snapshot(arr, rangeHighlight(0, k - 1, C.window), [], `Sum the first window of ${k}: ${sum}`, 0, [0, k - 1]),
  ];

  for (let end = k; end < n; end += 1) {
    const start = end - k;
    frames.push(
      snapshot(
        arr,
        { ...rangeHighlight(start, end - 1, C.window), [start]: C.remove, [end]: C.done },
        [pointer(start, "out", C.remove), pointer(end, "in", C.done)],
        `Slide: ${arr[start]} leaves, ${arr[end]} enters`,
        1,
        [start, end - 1],
      ),
    );
    sum = sum - arr[start] + arr[end];
    frames.push(
      snapshot(arr, rangeHighlight(start + 1, end, C.window), [], `sum = ${sum} — two arithmetic operations, not ${k}`, 2, [start + 1, end]),
    );
    if (sum > best) {
      best = sum;
      bestStart = start + 1;
      frames.push(snapshot(arr, rangeHighlight(bestStart, bestStart + k - 1, C.done), [], `New best window sum: ${best}`, 3, [bestStart, bestStart + k - 1]));
    }
  }

  frames.push(
    snapshot(arr, rangeHighlight(bestStart, bestStart + k - 1, C.done), [], `Best sum ${best} at window [${bestStart}..${bestStart + k - 1}] — O(n) instead of O(n·k)`, 4, [
      bestStart,
      bestStart + k - 1,
    ]),
  );
  return frames;
}

/**
 * Variable window: the shortest run whose sum reaches the target. The window
 * grows on the right and shrinks on the left, and neither end ever goes back.
 */
export function variableWindowFrames(values: number[], target: number): ArrayFrame[] {
  const arr = values.slice();
  const n = arr.length;
  let start = 0;
  let sum = 0;
  let bestLen = Infinity;
  let bestRange: [number, number] | null = null;

  const frames = [
    snapshot(arr, {}, [], `Find the shortest run of values summing to at least ${target}`, 0),
  ];

  for (let end = 0; end < n; end += 1) {
    sum += arr[end];
    frames.push(
      snapshot(arr, { ...rangeHighlight(start, end, C.window), [end]: C.done }, [pointer(end, "end", C.done)], `Grow right: add ${arr[end]}, sum = ${sum}`, 1, [start, end]),
    );
    while (sum >= target && start <= end) {
      const len = end - start + 1;
      if (len < bestLen) {
        bestLen = len;
        bestRange = [start, end];
        frames.push(
          snapshot(arr, rangeHighlight(start, end, C.done), [], `sum ${sum} ≥ ${target} with only ${len} element(s) — a new shortest window`, 2, [start, end]),
        );
      }
      frames.push(
        snapshot(arr, { ...rangeHighlight(start, end, C.window), [start]: C.remove }, [pointer(start, "start", C.remove)], `Shrink from the left: drop ${arr[start]}`, 3, [start, end]),
      );
      sum -= arr[start];
      start += 1;
    }
  }

  frames.push(
    bestRange
      ? snapshot(arr, rangeHighlight(bestRange[0], bestRange[1], C.done), [], `Shortest window is [${bestRange[0]}..${bestRange[1]}], length ${bestLen}. Each pointer crossed the array once, so O(n).`, 4, bestRange)
      : snapshot(arr, {}, [], `No run of values reaches ${target}`, 4),
  );
  return frames;
}

/** Longest run with no repeated value. The window shrinks past the earlier copy. */
export function distinctWindowFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  const lastSeen = new Map<number, number>();
  let start = 0;
  let bestLen = 0;
  let bestRange: [number, number] | null = null;

  const frames = [snapshot(arr, {}, [], "Longest run containing no repeated value", 0)];

  for (let end = 0; end < arr.length; end += 1) {
    const seenAt = lastSeen.get(arr[end]);
    if (seenAt !== undefined && seenAt >= start) {
      frames.push(
        snapshot(arr, { ...rangeHighlight(start, end, C.window), [seenAt]: C.remove, [end]: C.inspect }, [], `${arr[end]} already appears at index ${seenAt} — the window must start after it`, 1, [start, end]),
      );
      start = seenAt + 1;
      frames.push(snapshot(arr, rangeHighlight(start, end, C.window), [], `Window jumps to start at ${start}. It never moves backwards.`, 2, [start, end]));
    } else {
      frames.push(
        snapshot(arr, { ...rangeHighlight(start, end, C.window), [end]: C.done }, [], `${arr[end]} is new to the window — extend it`, 3, [start, end]),
      );
    }
    lastSeen.set(arr[end], end);
    if (end - start + 1 > bestLen) {
      bestLen = end - start + 1;
      bestRange = [start, end];
      frames.push(snapshot(arr, rangeHighlight(start, end, C.done), [], `New longest distinct run: ${bestLen}`, 4, [start, end]));
    }
  }

  frames.push(
    bestRange
      ? snapshot(arr, rangeHighlight(bestRange[0], bestRange[1], C.done), [], `Longest is [${bestRange[0]}..${bestRange[1]}], length ${bestLen}`, 5, bestRange)
      : snapshot(arr, {}, [], "Array is empty", 5),
  );
  return frames;
}

/** Longest run holding at most k distinct values — a counted window. */
export function atMostKDistinctFrames(values: number[], k: number): ArrayFrame[] {
  const arr = values.slice();
  const limit = Math.max(1, Math.round(k) || 2);
  const counts = new Map<number, number>();
  let start = 0;
  let bestLen = 0;
  let bestRange: [number, number] | null = null;

  const tally = () => Array.from(counts.entries()).filter(([, c]) => c > 0);
  const snap = (highlights: Record<number, string>, description: string, line: number, range: [number, number] | null) => {
    const entries = tally();
    return snapshot(arr, highlights, [], description, line, range, "horizontal", {
      secondary: {
        label: `distinct in window (${entries.length}/${limit})`,
        values: entries.map(([, c]) => c),
        labels: Object.fromEntries(entries.map(([v], i) => [i, String(v)])),
      },
    });
  };

  const frames = [snap({}, `Longest run holding at most ${limit} distinct value(s)`, 0, null)];

  for (let end = 0; end < arr.length; end += 1) {
    counts.set(arr[end], (counts.get(arr[end]) ?? 0) + 1);
    frames.push(snap({ ...rangeHighlight(start, end, C.window), [end]: C.done }, `Add ${arr[end]} to the window`, 1, [start, end]));

    let guard = 0;
    while (tally().length > limit && start <= end && guard < 10000) {
      guard += 1;
      frames.push(
        snap({ ...rangeHighlight(start, end, C.window), [start]: C.remove }, `${tally().length} distinct values is too many — drop ${arr[start]} from the left`, 2, [start, end]),
      );
      const remaining = (counts.get(arr[start]) ?? 1) - 1;
      if (remaining <= 0) counts.delete(arr[start]);
      else counts.set(arr[start], remaining);
      start += 1;
    }

    if (end - start + 1 > bestLen) {
      bestLen = end - start + 1;
      bestRange = [start, end];
      frames.push(snap(rangeHighlight(start, end, C.done), `New longest valid window: ${bestLen}`, 3, [start, end]));
    }
  }

  frames.push(
    bestRange
      ? snapshot(arr, rangeHighlight(bestRange[0], bestRange[1], C.done), [], `Longest is [${bestRange[0]}..${bestRange[1]}], length ${bestLen}`, 4, bestRange)
      : snapshot(arr, {}, [], "Array is empty", 4),
  );
  return frames;
}
