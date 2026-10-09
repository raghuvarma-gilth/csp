/**
 * Search algorithms. Shared by the Array module's Search group and the
 * standalone Searching module.
 *
 * Every one of these except linear search needs sorted input, so they sort a
 * copy first and say so in the first frame — a student who types unsorted values
 * should see why the array they get back is not the array they typed.
 */

import { mark, pointer, rangeHighlight, snapshot } from "../frames";
import { C, type ArrayFrame } from "../types";

const sorted = (values: number[]): number[] => values.slice().sort((a, b) => a - b);

export function linearSearchFrames(values: number[], target: number): ArrayFrame[] {
  const frames = [snapshot(values, {}, [], `Search for ${target} by checking every slot in turn`, 0)];
  for (let i = 0; i < values.length; i += 1) {
    frames.push(
      snapshot(values, mark(i, C.inspect), [pointer(i, "i", C.cursor)], `Check index ${i}: value ${values[i]}`, 1),
    );
    if (values[i] === target) {
      frames.push(snapshot(values, mark(i, C.done), [], `Found ${target} at index ${i}`, 2));
      return frames;
    }
  }
  frames.push(snapshot(values, {}, [], `${target} is not in the array`, 3));
  return frames;
}

export function binarySearchFrames(values: number[], target: number): ArrayFrame[] {
  const arr = sorted(values);
  let l = 0;
  let r = arr.length - 1;
  const frames = [
    snapshot(arr, {}, [], `Binary search for ${target}. The array is sorted first — without that, halving is meaningless`, 0),
  ];
  while (l <= r) {
    const mid = Math.floor((l + r) / 2);
    frames.push(
      snapshot(
        arr,
        { ...rangeHighlight(l, r, C.window), [mid]: C.inspect },
        [pointer(l, "L", C.done), pointer(mid, "M", C.inspect), pointer(r, "R", C.remove)],
        `mid = ${mid}, arr[mid] = ${arr[mid]}`,
        2,
      ),
    );
    if (arr[mid] === target) {
      frames.push(snapshot(arr, mark(mid, C.done), [], `Found ${target} at index ${mid}`, 3));
      return frames;
    }
    if (arr[mid] < target) {
      frames.push(
        snapshot(arr, {}, [], `${arr[mid]} < ${target} — everything left of mid is too small, discard it`, 4),
      );
      l = mid + 1;
    } else {
      frames.push(
        snapshot(arr, {}, [], `${arr[mid]} > ${target} — everything right of mid is too big, discard it`, 5),
      );
      r = mid - 1;
    }
  }
  frames.push(snapshot(arr, {}, [], `${target} is not in the array`, 6));
  return frames;
}

/** Splits into thirds instead of halves. Fewer iterations, more comparisons. */
export function ternarySearchFrames(values: number[], target: number): ArrayFrame[] {
  const arr = sorted(values);
  let l = 0;
  let r = arr.length - 1;
  const frames = [snapshot(arr, {}, [], `Ternary search for ${target} (array sorted first)`, 0)];
  while (l <= r) {
    const third = Math.floor((r - l) / 3) || 1;
    const m1 = l + third;
    const m2 = Math.min(r, r - third);
    frames.push(
      snapshot(
        arr,
        { ...rangeHighlight(l, r, C.window), [m1]: C.inspect, [m2]: C.inspect },
        [pointer(m1, "M1", C.inspect), pointer(m2, "M2", C.inspect)],
        `Two cut points: arr[${m1}] = ${arr[m1]}, arr[${m2}] = ${arr[m2]}`,
        1,
      ),
    );
    if (arr[m1] === target) {
      frames.push(snapshot(arr, mark(m1, C.done), [], `Found ${target} at index ${m1}`, 2));
      return frames;
    }
    if (arr[m2] === target) {
      frames.push(snapshot(arr, mark(m2, C.done), [], `Found ${target} at index ${m2}`, 2));
      return frames;
    }
    if (target < arr[m1]) {
      frames.push(snapshot(arr, {}, [], `${target} < ${arr[m1]} — keep the first third`, 3));
      r = m1 - 1;
    } else if (target > arr[m2]) {
      frames.push(snapshot(arr, {}, [], `${target} > ${arr[m2]} — keep the last third`, 4));
      l = m2 + 1;
    } else {
      frames.push(snapshot(arr, {}, [], "Target lies between the cut points — keep the middle third", 5));
      l = m1 + 1;
      r = m2 - 1;
    }
  }
  frames.push(snapshot(arr, {}, [], `${target} is not in the array`, 6));
  return frames;
}

/** Steps forward by √n, then walks back linearly through one block. */
export function jumpSearchFrames(values: number[], target: number): ArrayFrame[] {
  const arr = sorted(values);
  const n = arr.length;
  if (!n) return [snapshot(arr, {}, [], "Array is empty", 0)];
  const step = Math.max(1, Math.floor(Math.sqrt(n)));
  const frames = [
    snapshot(arr, {}, [], `Jump search for ${target}: hop ${step} slots at a time (√${n} ≈ ${step})`, 0),
  ];
  let prev = 0;
  let curr = 0;
  while (curr < n && arr[Math.min(curr, n - 1)] < target) {
    frames.push(
      snapshot(
        arr,
        mark(Math.min(curr, n - 1), C.inspect),
        [pointer(Math.min(curr, n - 1), "jump", C.cursor)],
        `arr[${Math.min(curr, n - 1)}] = ${arr[Math.min(curr, n - 1)]} < ${target} — jump on`,
        1,
      ),
    );
    prev = curr;
    curr += step;
  }
  const end = Math.min(curr, n - 1);
  frames.push(
    snapshot(arr, rangeHighlight(prev, end, C.window), [], `Target must be in the block [${prev}..${end}] — walk it`, 2),
  );
  for (let i = prev; i <= end; i += 1) {
    frames.push(snapshot(arr, mark(i, C.inspect), [pointer(i, "i", C.cursor)], `Check index ${i}: ${arr[i]}`, 3));
    if (arr[i] === target) {
      frames.push(snapshot(arr, mark(i, C.done), [], `Found ${target} at index ${i}`, 4));
      return frames;
    }
  }
  frames.push(snapshot(arr, {}, [], `${target} is not in the array`, 5));
  return frames;
}

/** Doubles the bound until it overshoots, then binary searches that range. */
export function exponentialSearchFrames(values: number[], target: number): ArrayFrame[] {
  const arr = sorted(values);
  const n = arr.length;
  if (!n) return [snapshot(arr, {}, [], "Array is empty", 0)];
  const frames = [snapshot(arr, {}, [], `Exponential search for ${target}: double the bound until it overshoots`, 0)];
  if (arr[0] === target) {
    frames.push(snapshot(arr, mark(0, C.done), [], `Found ${target} at index 0`, 1));
    return frames;
  }
  let bound = 1;
  while (bound < n && arr[bound] <= target) {
    frames.push(
      snapshot(arr, mark(bound, C.inspect), [pointer(bound, "bound", C.cursor)], `arr[${bound}] = ${arr[bound]} ≤ ${target} — double the bound`, 2),
    );
    bound *= 2;
  }
  const l0 = Math.floor(bound / 2);
  const r0 = Math.min(bound, n - 1);
  frames.push(snapshot(arr, rangeHighlight(l0, r0, C.window), [], `Binary search within [${l0}..${r0}]`, 3));
  let l = l0;
  let r = r0;
  while (l <= r) {
    const mid = Math.floor((l + r) / 2);
    frames.push(
      snapshot(arr, { ...rangeHighlight(l, r, C.window), [mid]: C.inspect }, [pointer(mid, "M", C.inspect)], `arr[${mid}] = ${arr[mid]}`, 4),
    );
    if (arr[mid] === target) {
      frames.push(snapshot(arr, mark(mid, C.done), [], `Found ${target} at index ${mid}`, 5));
      return frames;
    }
    if (arr[mid] < target) l = mid + 1;
    else r = mid - 1;
  }
  frames.push(snapshot(arr, {}, [], `${target} is not in the array`, 6));
  return frames;
}

/**
 * Binary search that does not stop at the first hit. This is the variant that
 * actually turns up in interviews, and the thing to notice is that finding a
 * match narrows the range instead of returning.
 */
export function boundarySearchFrames(
  values: number[],
  target: number,
  which: "first" | "last",
): ArrayFrame[] {
  const arr = sorted(values);
  let l = 0;
  let r = arr.length - 1;
  let answer = -1;
  const frames = [
    snapshot(arr, {}, [], `Find the ${which} index holding ${target} — keep searching after a match`, 0),
  ];
  while (l <= r) {
    const mid = Math.floor((l + r) / 2);
    const highlights: Record<number, string> = { ...rangeHighlight(l, r, C.window), [mid]: C.inspect };
    if (answer >= 0) highlights[answer] = C.done;
    frames.push(
      snapshot(arr, highlights, [pointer(mid, "M", C.inspect)], `arr[${mid}] = ${arr[mid]}`, 1),
    );
    if (arr[mid] === target) {
      answer = mid;
      if (which === "first") {
        frames.push(
          snapshot(arr, { ...highlights, [mid]: C.done }, [], `Match at ${mid}, but an earlier one may exist — keep going left`, 2),
        );
        r = mid - 1;
      } else {
        frames.push(
          snapshot(arr, { ...highlights, [mid]: C.done }, [], `Match at ${mid}, but a later one may exist — keep going right`, 3),
        );
        l = mid + 1;
      }
    } else if (arr[mid] < target) {
      l = mid + 1;
    } else {
      r = mid - 1;
    }
  }
  frames.push(
    answer >= 0
      ? snapshot(arr, mark(answer, C.done), [], `${which === "first" ? "First" : "Last"} occurrence of ${target} is index ${answer}`, 4)
      : snapshot(arr, {}, [], `${target} is not in the array`, 4),
  );
  return frames;
}
