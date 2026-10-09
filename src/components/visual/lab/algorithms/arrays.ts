/**
 * Array operations and the array-shaped patterns.
 *
 * Pure: no three.js, no DOM. Every function returns the frames for one run.
 */

import { mark, pointer, rangeHighlight, snapshot } from "../frames";
import { C, type ArrayFrame, type ArrayPointer } from "../types";

/* -------------------------------------------------------------------------- */
/* Basic operations                                                            */
/* -------------------------------------------------------------------------- */

export function accessFrames(values: number[], index: number): ArrayFrame[] {
  if (!values.length) return [snapshot(values, {}, [], "Array is empty", 0)];
  return [
    snapshot(
      values,
      mark(index, C.inspect),
      [pointer(index, "i", C.inspect)],
      `arr[${index}] = ${values[index]} — reached in one step, whatever the index, because the address is computed rather than searched for`,
      0,
    ),
  ];
}

export function updateFrames(values: number[], index: number, value: number): ArrayFrame[] {
  const before = values.slice();
  const frames = [
    snapshot(before, mark(index, C.inspect), [], `Before update: arr[${index}] = ${before[index]}`, 0),
  ];
  const after = values.slice();
  after[index] = value;
  frames.push(snapshot(after, mark(index, C.done), [], `After update: arr[${index}] = ${value}`, 1));
  return frames;
}

/**
 * The operation the `array-shift` lesson is about: an array is contiguous, so
 * making room in the middle means physically moving everything after it.
 */
export function insertAtFrames(values: number[], index: number, value: number): ArrayFrame[] {
  const arr = values.slice();
  const at = Math.max(0, Math.min(index, arr.length));
  arr.push(arr.length ? arr[arr.length - 1] : value);
  const frames = [
    snapshot(arr, {}, [], `Insert ${value} at index ${at}: the array grows by one slot`, 0),
  ];
  for (let i = arr.length - 1; i > at; i -= 1) {
    arr[i] = arr[i - 1];
    frames.push(snapshot(arr, mark(i, C.move), [], `Shift the value at index ${i - 1} to index ${i}`, 1));
  }
  arr[at] = value;
  frames.push(snapshot(arr, mark(at, C.done), [], `Write ${value} into the hole at index ${at}`, 2));
  return frames;
}

export function deleteAtFrames(values: number[], index: number): ArrayFrame[] {
  const arr = values.slice();
  if (!arr.length) return [snapshot(arr, {}, [], "Array is empty", 0)];
  const at = Math.max(0, Math.min(index, arr.length - 1));
  const frames = [
    snapshot(arr, mark(at, C.remove), [], `Delete the value ${arr[at]} at index ${at}`, 0),
  ];
  for (let i = at; i < arr.length - 1; i += 1) {
    arr[i] = arr[i + 1];
    frames.push(snapshot(arr, mark(i, C.move), [], `Shift the value at index ${i + 1} to index ${i}`, 1));
  }
  arr.pop();
  frames.push(snapshot(arr, {}, [], "The array shrinks by one", 2));
  return frames;
}

export function insertAtEndFrames(values: number[], value: number): ArrayFrame[] {
  return [
    snapshot(values, {}, [], "Before insert", 0),
    snapshot(
      values.concat([value]),
      mark(values.length, C.done),
      [],
      `Insert ${value} at the end — nothing has to move, so this is the cheap one`,
      1,
    ),
  ];
}

export function deleteAtEndFrames(values: number[]): ArrayFrame[] {
  if (!values.length) return [snapshot(values, {}, [], "Array is empty", 0)];
  return [
    snapshot(values, mark(values.length - 1, C.remove), [], "Remove the last element", 0),
    snapshot(values.slice(0, -1), {}, [], "After delete — again, nothing had to move", 1),
  ];
}

export function reverseArrayFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  let l = 0;
  let r = arr.length - 1;
  const frames = [snapshot(arr, {}, [], "Reverse the array by swapping inward from both ends", 0)];
  while (l < r) {
    frames.push(
      snapshot(arr, { [l]: C.inspect, [r]: C.inspect }, [], `Look at index ${l} and index ${r}`, 1),
    );
    const tmp = arr[l];
    arr[l] = arr[r];
    arr[r] = tmp;
    frames.push(snapshot(arr, { [l]: C.done, [r]: C.done }, [], `Swap index ${l} and index ${r}`, 2));
    l += 1;
    r -= 1;
  }
  frames.push(snapshot(arr, {}, [], "Reversed", 3));
  return frames;
}

export function rotateFrames(values: number[], k: number, direction: "left" | "right"): ArrayFrame[] {
  const arr = values.slice();
  const n = arr.length;
  if (n === 0) return [snapshot(arr, {}, [], "Array is empty", 0)];
  const by = ((Math.round(k) % n) + n) % n;
  const frames = [snapshot(arr, {}, [], `Rotate ${direction} by ${by}`, 0)];
  for (let step = 0; step < by; step += 1) {
    if (direction === "left") {
      const first = arr.shift() as number;
      arr.push(first);
      frames.push(snapshot(arr, mark(n - 1, C.done), [], `Move the front element ${first} to the back`, 1));
    } else {
      const last = arr.pop() as number;
      arr.unshift(last);
      frames.push(snapshot(arr, mark(0, C.done), [], `Move the back element ${last} to the front`, 1));
    }
  }
  frames.push(snapshot(arr, {}, [], "Rotation complete", 2));
  return frames;
}

/* -------------------------------------------------------------------------- */
/* Patterns                                                                    */
/* -------------------------------------------------------------------------- */

export function prefixSumFrames(values: number[]): ArrayFrame[] {
  const original = values.slice();
  const arr = values.slice();
  const frames = [snapshot(arr, {}, [], "Original array", 0)];
  for (let i = 1; i < arr.length; i += 1) {
    const previous = arr[i - 1];
    arr[i] = arr[i] + previous;
    frames.push(
      snapshot(
        arr,
        { [i]: C.done, [i - 1]: C.cursor },
        [],
        `prefix[${i}] = prefix[${i - 1}] + original[${i}] = ${previous} + ${original[i]} = ${arr[i]}`,
        1,
      ),
    );
  }
  frames.push(
    snapshot(
      arr,
      {},
      [],
      "Prefix sum complete — any range sum is now one subtraction away",
      2,
    ),
  );
  return frames;
}

export function kadaneFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  if (!arr.length) return [snapshot(arr, {}, [], "Array is empty", 0)];
  let currentSum = arr[0];
  let maxSum = arr[0];
  let start = 0;
  let bestStart = 0;
  let bestEnd = 0;
  const frames = [
    snapshot(arr, mark(0, C.window), [], `Start: currentSum = maxSum = ${arr[0]}`, 0, [0, 0]),
  ];
  for (let i = 1; i < arr.length; i += 1) {
    if (currentSum < 0) {
      currentSum = arr[i];
      start = i;
      frames.push(
        snapshot(
          arr,
          mark(i, C.inspect),
          [],
          `currentSum was negative, so carrying it forward can only hurt — restart the window at index ${i}`,
          1,
          [start, i],
        ),
      );
    } else {
      currentSum += arr[i];
      frames.push(
        snapshot(arr, mark(i, C.cursor), [], `Extend the window: currentSum = ${currentSum}`, 2, [start, i]),
      );
    }
    if (currentSum > maxSum) {
      maxSum = currentSum;
      bestStart = start;
      bestEnd = i;
      frames.push(snapshot(arr, {}, [], `New best: max subarray sum = ${maxSum}`, 3, [bestStart, bestEnd]));
    }
  }
  frames.push(
    snapshot(arr, {}, [], `Max subarray sum = ${maxSum}, range [${bestStart}..${bestEnd}]`, 4, [
      bestStart,
      bestEnd,
    ]),
  );
  return frames;
}

export function dutchFlagFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  let low = 0;
  let mid = 0;
  let high = arr.length - 1;
  const ptrs = (): ArrayPointer[] => [
    pointer(low, "LOW", C.done),
    pointer(mid, "MID", C.inspect),
    pointer(high, "HIGH", C.remove),
  ];
  const frames = [
    snapshot(arr, {}, ptrs(), "Sort an array of 0s, 1s and 2s in one pass (Dutch National Flag)", 0),
  ];
  let guard = 0;
  while (mid <= high && guard < 10000) {
    guard += 1;
    frames.push(snapshot(arr, mark(mid, C.inspect), ptrs(), `arr[mid] = ${arr[mid]}`, 1));
    if (arr[mid] === 0) {
      const tmp = arr[low];
      arr[low] = arr[mid];
      arr[mid] = tmp;
      low += 1;
      mid += 1;
      frames.push(snapshot(arr, {}, ptrs(), "0 found — swap with LOW, then advance LOW and MID", 2));
    } else if (arr[mid] === 1) {
      mid += 1;
      frames.push(snapshot(arr, {}, ptrs(), "1 found — it is already in the middle band, advance MID only", 3));
    } else {
      const tmp = arr[mid];
      arr[mid] = arr[high];
      arr[high] = tmp;
      high -= 1;
      frames.push(
        snapshot(
          arr,
          {},
          ptrs(),
          "2 found (or a value outside 0-2) — swap with HIGH and pull HIGH back; MID stays, because the value just swapped in has not been examined",
          4,
        ),
      );
    }
  }
  /* The loop above treats every value that is neither 0 nor 1 as "greater", so it
     runs on any input — but it only *sorts* a genuine 0/1/2 array, and saying
     otherwise over a visibly unsorted row would be a lie. */
  const wasThreeValued = values.every((v) => v === 0 || v === 1 || v === 2);
  frames.push(
    snapshot(
      arr,
      {},
      [],
      wasThreeValued
        ? "Sorted — three bands in a single pass, without ever comparing two elements to each other"
        : "Partitioned into three bands: every 0, then every 1, then everything else in no particular order. Values outside 0-2 all count as greater, so this input is grouped but not sorted — enter 2, 0, 2, 1, 1, 0 to see the real thing.",
      5,
    ),
  );
  return frames;
}

export function cyclicSortFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  const n = arr.length;
  let i = 0;
  const frames = [
    snapshot(arr, {}, [pointer(0, "i", C.cursor)], "Cyclic Sort: every value belongs at index value − 1", 0),
  ];
  let guard = 0;
  while (i < n && guard < 10000) {
    guard += 1;
    const correctIdx = arr[i] - 1;
    if (correctIdx >= 0 && correctIdx < n && arr[i] !== arr[correctIdx]) {
      frames.push(
        snapshot(
          arr,
          { [i]: C.inspect, [correctIdx]: C.inspect },
          [pointer(i, "i", C.cursor)],
          `${arr[i]} belongs at index ${correctIdx} — swap it there`,
          1,
        ),
      );
      const tmp = arr[i];
      arr[i] = arr[correctIdx];
      arr[correctIdx] = tmp;
      frames.push(
        snapshot(
          arr,
          { [i]: C.done, [correctIdx]: C.done },
          [pointer(i, "i", C.cursor)],
          "Swapped — i does not advance, because a new value just landed here",
          2,
        ),
      );
    } else {
      frames.push(
        snapshot(
          arr,
          mark(i, C.done),
          [pointer(i, "i", C.cursor)],
          `${arr[i]} is in place (or a duplicate, or out of range) — move on`,
          3,
        ),
      );
      i += 1;
    }
  }
  /* Out-of-range values and duplicates are skipped rather than placed, so the
     result is only sorted when the input really was a permutation of 1..n. */
  const isSorted = arr.every((v, idx) => idx === 0 || arr[idx - 1] <= v);
  frames.push(
    snapshot(
      arr,
      {},
      [],
      isSorted
        ? "Sorted by cyclic placement — every value was moved at most once, and nothing was ever compared"
        : "Cyclic sort only works on a permutation of 1..n. This input holds values outside that range, or duplicates, and those were skipped — so the result is not sorted. Enter 3, 1, 5, 4, 2 to see the real thing.",
      4,
    ),
  );
  return frames;
}

/**
 * Range sum with a prefix array, which is the pay-off the prefix-sum lesson
 * builds towards: one subtraction instead of a loop.
 */
export function rangeSumFrames(values: number[], from: number, to: number): ArrayFrame[] {
  const arr = values.slice();
  if (!arr.length) return [snapshot(arr, {}, [], "Array is empty", 0)];
  const l = Math.max(0, Math.min(from, arr.length - 1));
  const r = Math.max(l, Math.min(to, arr.length - 1));

  const prefix: number[] = [];
  let running = 0;
  const frames: ArrayFrame[] = [];
  for (let i = 0; i < arr.length; i += 1) {
    running += arr[i];
    prefix.push(running);
    frames.push(
      snapshot(arr, mark(i, C.cursor), [], `Build the prefix table: prefix[${i}] = ${running}`, 0, null, "horizontal", {
        secondary: { label: "prefix", values: prefix.slice(), highlights: mark(i, C.done) },
      }),
    );
  }

  frames.push(
    snapshot(arr, rangeHighlight(l, r, C.window), [], `Query the sum of [${l}..${r}]`, 1, [l, r], "horizontal", {
      secondary: { label: "prefix", values: prefix.slice() },
    }),
  );

  const total = prefix[r] - (l > 0 ? prefix[l - 1] : 0);
  const explanation =
    l > 0
      ? `sum = prefix[${r}] − prefix[${l - 1}] = ${prefix[r]} − ${prefix[l - 1]} = ${total}`
      : `sum = prefix[${r}] = ${total}`;
  frames.push(
    snapshot(arr, rangeHighlight(l, r, C.done), [], `${explanation} — one subtraction, no loop`, 2, [l, r], "horizontal", {
      secondary: {
        label: "prefix",
        values: prefix.slice(),
        highlights: l > 0 ? { [r]: C.done, [l - 1]: C.remove } : mark(r, C.done),
      },
    }),
  );
  return frames;
}
