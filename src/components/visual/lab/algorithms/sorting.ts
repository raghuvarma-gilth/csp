/**
 * Sorting algorithms.
 *
 * Each one marks the region it has already settled, because the part students
 * miss is not the swapping — it is the invariant. Bubble sort's tail is sorted;
 * selection sort's head is sorted; insertion sort's head is sorted but not final.
 */

import { mark, rangeHighlight, snapshot } from "../frames";
import { C, type ArrayFrame, type Hex } from "../types";

export function bubbleSortFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  const n = arr.length;
  const frames = [snapshot(arr, {}, [], "Bubble sort: repeatedly walk the array, swapping neighbours out of order", 0)];
  for (let i = 0; i < n - 1; i += 1) {
    const settled = rangeHighlight(n - i, n - 1, C.done);
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j += 1) {
      frames.push(
        snapshot(arr, { ...settled, [j]: C.inspect, [j + 1]: C.inspect }, [], `Compare index ${j} and ${j + 1}`, 1),
      );
      if (arr[j] > arr[j + 1]) {
        const tmp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = tmp;
        swapped = true;
        frames.push(
          snapshot(arr, { ...settled, [j]: C.move, [j + 1]: C.move }, [], `${arr[j + 1]} > ${arr[j]} — swap`, 2),
        );
      }
    }
    frames.push(
      snapshot(
        arr,
        rangeHighlight(n - i - 1, n - 1, C.done),
        [],
        `Pass ${i + 1} done — the largest remaining value has bubbled to index ${n - i - 1}`,
        3,
      ),
    );
    if (!swapped) {
      frames.push(snapshot(arr, rangeHighlight(0, n - 1, C.done), [], "A pass with no swaps means the array is already sorted — stop early", 4));
      return frames;
    }
  }
  frames.push(snapshot(arr, rangeHighlight(0, Math.max(0, n - 1), C.done), [], "Sorted", 4));
  return frames;
}

export function selectionSortFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  const n = arr.length;
  const frames = [snapshot(arr, {}, [], "Selection sort: find the smallest remaining value, swap it into place", 0)];
  for (let i = 0; i < n - 1; i += 1) {
    const settled = i > 0 ? rangeHighlight(0, i - 1, C.done) : {};
    let minIdx = i;
    frames.push(snapshot(arr, { ...settled, [i]: C.cursor }, [], `Assume index ${i} holds the smallest remaining value`, 1));
    for (let j = i + 1; j < n; j += 1) {
      frames.push(
        snapshot(arr, { ...settled, [minIdx]: C.cursor, [j]: C.inspect }, [], `Compare ${arr[j]} with the current minimum ${arr[minIdx]}`, 2),
      );
      if (arr[j] < arr[minIdx]) {
        minIdx = j;
        frames.push(snapshot(arr, { ...settled, [minIdx]: C.cursor }, [], `New minimum ${arr[minIdx]} at index ${minIdx}`, 3));
      }
    }
    if (minIdx !== i) {
      const tmp = arr[i];
      arr[i] = arr[minIdx];
      arr[minIdx] = tmp;
      frames.push(snapshot(arr, { ...settled, [i]: C.done, [minIdx]: C.move }, [], `Swap index ${i} and ${minIdx}`, 4));
    }
    frames.push(snapshot(arr, rangeHighlight(0, i, C.done), [], `Index ${i} is final — selection sort never touches it again`, 5));
  }
  frames.push(snapshot(arr, rangeHighlight(0, Math.max(0, n - 1), C.done), [], "Sorted", 5));
  return frames;
}

export function insertionSortFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  const frames = [
    snapshot(arr, {}, [], "Insertion sort: grow a sorted prefix, sliding each new value back into it", 0),
  ];
  for (let i = 1; i < arr.length; i += 1) {
    const sortedPrefix = rangeHighlight(0, i - 1, C.window);
    frames.push(snapshot(arr, { ...sortedPrefix, [i]: C.inspect }, [], `Take ${arr[i]} at index ${i} and slide it left`, 1));
    let j = i;
    while (j > 0 && arr[j - 1] > arr[j]) {
      const tmp = arr[j - 1];
      arr[j - 1] = arr[j];
      arr[j] = tmp;
      frames.push(
        snapshot(arr, { ...rangeHighlight(0, i, C.window), [j - 1]: C.move, [j]: C.move }, [], `${arr[j]} > ${arr[j - 1]} — shift right`, 2),
      );
      j -= 1;
    }
    frames.push(snapshot(arr, rangeHighlight(0, i, C.window), [], `Prefix [0..${i}] is sorted (though not yet final)`, 3));
  }
  frames.push(snapshot(arr, rangeHighlight(0, Math.max(0, arr.length - 1), C.done), [], "Sorted", 4));
  return frames;
}

export function mergeSortFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  const frames = [snapshot(arr, {}, [], "Merge sort: split to single elements, then merge sorted runs back up", 0)];

  const merge = (l: number, m: number, r: number) => {
    const temp: number[] = [];
    let i = l;
    let j = m + 1;
    while (i <= m && j <= r) {
      frames.push(
        snapshot(arr, { ...rangeHighlight(l, r, C.window), [i]: C.inspect, [j]: C.inspect }, [], `Compare ${arr[i]} and ${arr[j]} — the smaller one is emitted`, 3),
      );
      if (arr[i] <= arr[j]) temp.push(arr[i++]);
      else temp.push(arr[j++]);
    }
    while (i <= m) temp.push(arr[i++]);
    while (j <= r) temp.push(arr[j++]);
    for (let k = 0; k < temp.length; k += 1) arr[l + k] = temp[k];
    frames.push(snapshot(arr, rangeHighlight(l, r, C.done), [], `Range [${l}..${r}] is now one sorted run`, 4));
  };

  const mergeSort = (l: number, r: number) => {
    if (l >= r) return;
    const m = Math.floor((l + r) / 2);
    frames.push(snapshot(arr, rangeHighlight(l, r, C.window), [], `Split [${l}..${r}] at ${m}`, 1));
    mergeSort(l, m);
    mergeSort(m + 1, r);
    merge(l, m, r);
  };

  mergeSort(0, arr.length - 1);
  frames.push(snapshot(arr, rangeHighlight(0, Math.max(0, arr.length - 1), C.done), [], "Sorted", 5));
  return frames;
}

export function quickSortFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  const frames = [snapshot(arr, {}, [], "Quick sort: partition around a pivot, then sort each side", 0)];

  const partition = (l: number, r: number): number => {
    const pivot = arr[r];
    frames.push(snapshot(arr, { ...rangeHighlight(l, r, C.window), [r]: C.window }, [], `Pivot = ${pivot} at index ${r}`, 1));
    let i = l - 1;
    for (let j = l; j < r; j += 1) {
      frames.push(
        snapshot(arr, { ...rangeHighlight(l, r, C.window), [j]: C.inspect, [r]: C.window }, [], `Compare ${arr[j]} with the pivot ${pivot}`, 2),
      );
      if (arr[j] < pivot) {
        i += 1;
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
        frames.push(
          snapshot(arr, { ...rangeHighlight(l, r, C.window), [i]: C.move, [j]: C.move, [r]: C.window }, [], `Smaller than the pivot — swap into the left region`, 3),
        );
      }
    }
    const tmp2 = arr[i + 1];
    arr[i + 1] = arr[r];
    arr[r] = tmp2;
    frames.push(snapshot(arr, mark(i + 1, C.done), [], `The pivot lands at index ${i + 1}, its final position`, 4));
    return i + 1;
  };

  const quickSort = (l: number, r: number) => {
    if (l >= r) return;
    const p = partition(l, r);
    quickSort(l, p - 1);
    quickSort(p + 1, r);
  };

  quickSort(0, arr.length - 1);
  frames.push(snapshot(arr, rangeHighlight(0, Math.max(0, arr.length - 1), C.done), [], "Sorted", 5));
  return frames;
}

/**
 * Heap sort, shown on the flat array rather than as a tree, so the index
 * arithmetic (`2i+1`, `2i+2`) is visible. The tree view of the same structure
 * lives in the Heap module.
 */
export function heapSortFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  const n = arr.length;
  const frames = [snapshot(arr, {}, [], "Heap sort: build a max heap in place, then repeatedly pull the root to the back", 0)];

  const siftDown = (start: number, end: number, settled: Record<number, Hex>) => {
    let root = start;
    let guard = 0;
    while (2 * root + 1 < end && guard < 10000) {
      guard += 1;
      let child = 2 * root + 1;
      if (child + 1 < end && arr[child] < arr[child + 1]) child += 1;
      frames.push(
        snapshot(arr, { ...settled, [root]: C.inspect, [child]: C.cursor }, [], `Compare arr[${root}] = ${arr[root]} with its larger child arr[${child}] = ${arr[child]}`, 2),
      );
      if (arr[root] < arr[child]) {
        const tmp = arr[root];
        arr[root] = arr[child];
        arr[child] = tmp;
        frames.push(snapshot(arr, { ...settled, [root]: C.move, [child]: C.move }, [], "Child is bigger — swap it up", 3));
        root = child;
      } else break;
    }
  };

  for (let start = Math.floor(n / 2) - 1; start >= 0; start -= 1) {
    frames.push(snapshot(arr, mark(start, C.inspect), [], `Heapify the subtree rooted at index ${start}`, 1));
    siftDown(start, n, {});
  }
  frames.push(snapshot(arr, {}, [], "Max heap built — the largest value is now at index 0", 4));

  for (let end = n - 1; end > 0; end -= 1) {
    const settled = rangeHighlight(end + 1, n - 1, C.done);
    const tmp = arr[0];
    arr[0] = arr[end];
    arr[end] = tmp;
    frames.push(
      snapshot(arr, { ...settled, [end]: C.done, 0: C.move }, [], `Swap the root ${arr[end]} to index ${end}, its final position`, 5),
    );
    siftDown(0, end, rangeHighlight(end, n - 1, C.done));
  }
  frames.push(snapshot(arr, rangeHighlight(0, Math.max(0, n - 1), C.done), [], "Sorted", 6));
  return frames;
}

/**
 * Counting sort, with the count table on the secondary row. This is where the
 * `secondary` frame field earns its keep: the whole algorithm is the relationship
 * between the two rows.
 */
export function countingSortFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  if (!arr.length) return [snapshot(arr, {}, [], "Array is empty", 0)];
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const span = max - min + 1;
  if (span > 60) {
    return [
      snapshot(
        arr,
        {},
        [],
        `Counting sort needs one bucket per distinct value, and this input spans ${span} of them. That is the algorithm's real limitation, not a display limit — try values closer together.`,
        0,
      ),
    ];
  }
  const counts = new Array<number>(span).fill(0);
  const labels: Record<number, string> = {};
  for (let v = 0; v < span; v += 1) labels[v] = String(min + v);

  const frames = [
    snapshot(arr, {}, [], `Counting sort: one bucket per value from ${min} to ${max} — no comparisons at all`, 0, null, "horizontal", {
      secondary: { label: "count", values: counts.slice(), labels },
    }),
  ];

  for (let i = 0; i < arr.length; i += 1) {
    counts[arr[i] - min] += 1;
    frames.push(
      snapshot(arr, mark(i, C.inspect), [], `${arr[i]} seen — bucket ${arr[i]} is now ${counts[arr[i] - min]}`, 1, null, "horizontal", {
        secondary: { label: "count", values: counts.slice(), highlights: mark(arr[i] - min, C.done), labels },
      }),
    );
  }

  const out: number[] = [];
  for (let v = 0; v < span; v += 1) {
    for (let k = 0; k < counts[v]; k += 1) {
      out.push(min + v);
      frames.push(
        snapshot(out, mark(out.length - 1, C.done), [], `Bucket ${min + v} holds ${counts[v]} — emit ${min + v}`, 2, null, "horizontal", {
          secondary: { label: "count", values: counts.slice(), highlights: mark(v, C.inspect), labels },
        }),
      );
    }
  }
  frames.push(snapshot(out, rangeHighlight(0, out.length - 1, C.done), [], "Sorted, in O(n + k) and without a single comparison", 3));
  return frames;
}

/** LSD radix sort. Negative values are rejected honestly rather than mangled. */
export function radixSortFrames(values: number[]): ArrayFrame[] {
  let arr = values.slice();
  if (!arr.length) return [snapshot(arr, {}, [], "Array is empty", 0)];
  if (arr.some((v) => v < 0 || !Number.isInteger(v))) {
    return [
      snapshot(
        arr,
        {},
        [],
        "This radix sort handles non-negative integers only. Digit extraction has no meaning for a negative or fractional value — handling them needs a separate pass, which is a real part of the algorithm rather than an oversight here.",
        0,
      ),
    ];
  }
  const max = Math.max(...arr);
  const frames = [snapshot(arr, {}, [], "Radix sort: stable-sort by the last digit, then the next, and so on", 0)];

  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    const buckets: number[][] = Array.from({ length: 10 }, () => []);
    for (let i = 0; i < arr.length; i += 1) {
      const digit = Math.floor(arr[i] / exp) % 10;
      buckets[digit].push(arr[i]);
      frames.push(
        snapshot(arr, mark(i, C.inspect), [], `Digit at the ${exp}s place of ${arr[i]} is ${digit}`, 1, null, "horizontal", {
          secondary: {
            label: `bucket sizes (${exp}s)`,
            values: buckets.map((b) => b.length),
            highlights: mark(digit, C.done),
            labels: Object.fromEntries(buckets.map((_, d) => [d, String(d)])),
          },
        }),
      );
    }
    arr = buckets.flat();
    frames.push(
      snapshot(arr, rangeHighlight(0, arr.length - 1, C.window), [], `Collected in bucket order — the array is now sorted by every digit up to the ${exp}s place`, 2),
    );
  }
  frames.push(snapshot(arr, rangeHighlight(0, arr.length - 1, C.done), [], "Sorted", 3));
  return frames;
}

/** Insertion sort with a shrinking gap. The gap sequence is n/2, n/4, …, 1. */
export function shellSortFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  const n = arr.length;
  const frames = [
    snapshot(arr, {}, [], "Shell sort: insertion sort over a wide gap first, so values travel far in one move", 0),
  ];
  for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
    frames.push(snapshot(arr, {}, [], `Gap = ${gap}`, 1));
    for (let i = gap; i < n; i += 1) {
      const temp = arr[i];
      let j = i;
      frames.push(
        snapshot(arr, { [i]: C.inspect, [i - gap]: C.cursor }, [], `Compare arr[${i}] = ${arr[i]} with arr[${i - gap}] = ${arr[i - gap]}, ${gap} slots back`, 2),
      );
      while (j >= gap && arr[j - gap] > temp) {
        arr[j] = arr[j - gap];
        frames.push(snapshot(arr, { [j]: C.move, [j - gap]: C.move }, [], `Move ${arr[j]} forward ${gap} slots`, 3));
        j -= gap;
      }
      arr[j] = temp;
      if (j !== i) frames.push(snapshot(arr, mark(j, C.done), [], `Place ${temp} at index ${j}`, 4));
    }
    frames.push(snapshot(arr, {}, [], `Array is now ${gap}-sorted`, 5));
  }
  frames.push(snapshot(arr, rangeHighlight(0, Math.max(0, n - 1), C.done), [], "Sorted", 6));
  return frames;
}
