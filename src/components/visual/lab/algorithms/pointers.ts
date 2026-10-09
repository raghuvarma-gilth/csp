/**
 * The two-pointer family.
 *
 * What ties these together is that a nested loop's O(n²) collapses to O(n)
 * because each pointer only ever moves forward. The frames make that visible: no
 * pointer in this file ever goes back.
 */

import { pointer, rangeHighlight, snapshot } from "../frames";
import { C, type ArrayFrame, type ArrayPointer, type Hex } from "../types";

const sortedCopy = (values: number[]): number[] => values.slice().sort((a, b) => a - b);

/**
 * Converging pointers — the shape the `two-pointers` lesson deep-links to. Shown
 * on a reversal, because that is the version with nothing else going on.
 */
export function oppositeEndsFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  let l = 0;
  let r = arr.length - 1;
  const ptrs = (): ArrayPointer[] =>
    l <= r ? [pointer(l, "LEFT", C.done), pointer(r, "RIGHT", C.remove)] : [];
  const frames = [
    snapshot(arr, {}, ptrs(), "One pointer at each end, walking towards each other", 0, [0, Math.max(0, arr.length - 1)]),
  ];
  while (l < r) {
    frames.push(
      snapshot(arr, { [l]: C.inspect, [r]: C.inspect }, ptrs(), `Swap index ${l} (${arr[l]}) with index ${r} (${arr[r]})`, 1, [l, r]),
    );
    const tmp = arr[l];
    arr[l] = arr[r];
    arr[r] = tmp;
    frames.push(snapshot(arr, { [l]: C.done, [r]: C.done }, ptrs(), "Swapped — now step both pointers inward", 2, [l, r]));
    l += 1;
    r -= 1;
  }
  frames.push(
    snapshot(arr, rangeHighlight(0, Math.max(0, arr.length - 1), C.done), [], "The pointers met, so every pair has been handled — n/2 swaps, O(n)", 3),
  );
  return frames;
}

/** Two-sum on a sorted array: the sum tells you which pointer to move. */
export function pairSumFrames(values: number[], target: number): ArrayFrame[] {
  const arr = sortedCopy(values);
  let l = 0;
  let r = arr.length - 1;
  const ptrs = (): ArrayPointer[] =>
    l <= r ? [pointer(l, "L", C.done), pointer(r, "R", C.remove)] : [];
  const frames = [
    snapshot(arr, {}, ptrs(), `Find a pair summing to ${target}. The array is sorted first — that is what makes the decision below possible.`, 0),
  ];
  while (l < r) {
    const sum = arr[l] + arr[r];
    frames.push(
      snapshot(arr, { [l]: C.inspect, [r]: C.inspect }, ptrs(), `${arr[l]} + ${arr[r]} = ${sum}`, 1, [l, r]),
    );
    if (sum === target) {
      frames.push(snapshot(arr, { [l]: C.done, [r]: C.done }, [], `Found: ${arr[l]} + ${arr[r]} = ${target}`, 2, [l, r]));
      return frames;
    }
    if (sum < target) {
      frames.push(snapshot(arr, {}, ptrs(), `${sum} < ${target} — only a bigger left value can help, so move L right`, 3, [l, r]));
      l += 1;
    } else {
      frames.push(snapshot(arr, {}, ptrs(), `${sum} > ${target} — only a smaller right value can help, so move R left`, 4, [l, r]));
      r -= 1;
    }
  }
  frames.push(snapshot(arr, {}, [], `No pair sums to ${target}`, 5));
  return frames;
}

/**
 * Remove duplicates in place. The two pointers have different jobs here: `read`
 * scans, `write` marks the end of the kept prefix.
 */
export function removeDuplicatesFrames(values: number[]): ArrayFrame[] {
  const arr = sortedCopy(values);
  if (!arr.length) return [snapshot(arr, {}, [], "Array is empty", 0)];
  let write = 0;
  const frames = [
    snapshot(arr, {}, [pointer(0, "write", C.done)], "Remove duplicates in place from a sorted array. 'write' keeps the end of the unique prefix.", 0),
  ];
  for (let read = 1; read < arr.length; read += 1) {
    const ptrs = [pointer(write, "write", C.done), pointer(read, "read", C.cursor)];
    frames.push(
      snapshot(arr, { ...rangeHighlight(0, write, C.done), [read]: C.inspect }, ptrs, `Compare arr[${read}] = ${arr[read]} with the last kept value ${arr[write]}`, 1),
    );
    if (arr[read] !== arr[write]) {
      write += 1;
      arr[write] = arr[read];
      frames.push(
        snapshot(arr, { ...rangeHighlight(0, write, C.done), [write]: C.move }, [pointer(write, "write", C.done), pointer(read, "read", C.cursor)], `New value — write it at index ${write}`, 2),
      );
    } else {
      frames.push(snapshot(arr, { ...rangeHighlight(0, write, C.done), [read]: C.faded }, ptrs, "Duplicate — skip it, and do not advance write", 3));
    }
  }
  frames.push(
    snapshot(arr.slice(0, write + 1), rangeHighlight(0, write, C.done), [], `${write + 1} unique value(s). Everything past index ${write} is left over and ignored.`, 4),
  );
  return frames;
}

/** Move every zero to the end while keeping the other values in order. */
export function moveZeroesFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  let write = 0;
  const frames = [
    snapshot(arr, {}, [pointer(0, "write", C.done)], "Push every 0 to the end, preserving the order of everything else", 0),
  ];
  for (let read = 0; read < arr.length; read += 1) {
    const ptrs = [pointer(write, "write", C.done), pointer(read, "read", C.cursor)];
    frames.push(snapshot(arr, { [read]: C.inspect }, ptrs, `arr[${read}] = ${arr[read]}`, 1));
    if (arr[read] !== 0) {
      if (write !== read) {
        const tmp = arr[write];
        arr[write] = arr[read];
        arr[read] = tmp;
        frames.push(
          snapshot(arr, { [write]: C.move, [read]: C.move }, ptrs, `Non-zero — swap it into index ${write}`, 2),
        );
      }
      write += 1;
    } else {
      frames.push(snapshot(arr, { [read]: C.faded }, ptrs, "Zero — leave it for a later swap and advance read only", 3));
    }
  }
  frames.push(
    snapshot(arr, { ...rangeHighlight(0, Math.max(0, write - 1), C.done), ...rangeHighlight(write, arr.length - 1, C.faded) }, [], `The first ${write} slot(s) hold the non-zero values in their original order`, 4),
  );
  return frames;
}

/**
 * Container With Most Water. This is the one where the pointer rule needs an
 * argument: moving the taller wall inward can never help, because width shrinks
 * and the height is still capped by the shorter wall.
 */
export function containerWaterFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  if (arr.length < 2) return [snapshot(arr, {}, [], "Need at least two walls", 0)];
  let l = 0;
  let r = arr.length - 1;
  let best = 0;
  let bestRange: [number, number] = [0, arr.length - 1];
  const ptrs = (): ArrayPointer[] => [pointer(l, "L", C.done), pointer(r, "R", C.remove)];
  const frames = [
    snapshot(arr, {}, ptrs(), "Treat each value as a wall height. Find the two walls holding the most water.", 0, [l, r]),
  ];
  while (l < r) {
    const height = Math.min(arr[l], arr[r]);
    const area = height * (r - l);
    const highlights: Record<number, Hex> = { [l]: C.inspect, [r]: C.inspect };
    frames.push(
      snapshot(arr, highlights, ptrs(), `Width ${r - l} × height min(${arr[l]}, ${arr[r]}) = ${height} → area ${area}`, 1, [l, r]),
    );
    if (area > best) {
      best = area;
      bestRange = [l, r];
      frames.push(snapshot(arr, { [l]: C.done, [r]: C.done }, ptrs(), `New best area: ${best}`, 2, [l, r]));
    }
    if (arr[l] < arr[r]) {
      frames.push(
        snapshot(arr, {}, ptrs(), `The left wall is shorter, so moving R inward could only lose width without gaining height — move L instead`, 3, [l, r]),
      );
      l += 1;
    } else {
      frames.push(
        snapshot(arr, {}, ptrs(), `The right wall is no taller, so move R inward`, 4, [l, r]),
      );
      r -= 1;
    }
  }
  frames.push(
    snapshot(arr, { [bestRange[0]]: C.done, [bestRange[1]]: C.done }, [], `Maximum area ${best}, between index ${bestRange[0]} and ${bestRange[1]} — found in one pass`, 5, bestRange),
  );
  return frames;
}
