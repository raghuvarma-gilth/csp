/**
 * Queue operations.
 *
 * FRONT sits at index 0 and REAR at the end, so the drawing reads left to right
 * in the order things will be served.
 */

import { mark, pointer, snapshot } from "../frames";
import { C, type ArrayFrame, type ArrayPointer } from "../types";

const ends = (length: number): ArrayPointer[] => {
  if (!length) return [];
  if (length === 1) return [pointer(0, "FRONT / REAR", C.done)];
  return [pointer(0, "FRONT", C.done), pointer(length - 1, "REAR", C.remove)];
};

export function enqueueFrames(values: number[], value: number): ArrayFrame[] {
  const arr: Array<string | number> = values.slice();
  const frames = [snapshot(arr, {}, ends(arr.length), "Before enqueue", 0)];
  arr.push(value);
  frames.push(
    snapshot(arr, mark(arr.length - 1, C.done), ends(arr.length), `Enqueue ${value} — it joins at the rear`, 1),
  );
  return frames;
}

export function dequeueFrames(values: number[]): ArrayFrame[] {
  const arr: Array<string | number> = values.slice();
  if (!arr.length) return [snapshot(arr, {}, [], "Queue is empty — dequeue would underflow", 0)];
  const served = arr[0];
  const frames = [snapshot(arr, mark(0, C.remove), ends(arr.length), `Dequeue ${served} from the front`, 0)];
  arr.shift();
  frames.push(
    snapshot(
      arr,
      {},
      ends(arr.length),
      `After dequeue. Notice that every remaining element shifted down one index — which is exactly the cost a circular queue avoids.`,
      1,
    ),
  );
  return frames;
}

/**
 * The circular queue, drawn as a ring. This is what the `circular-queue` lesson
 * deep-links to, and the ring is the point: front and rear are indices that wrap
 * with `% capacity`, so nothing ever shifts and both ends stay O(1).
 */
export function circularQueueFrames(values: number[], capacity: number): ArrayFrame[] {
  const cap = Math.max(3, Math.min(Math.round(capacity) || 6, 12));
  const slots: Array<string | number> = new Array(cap).fill("");
  let front = 0;
  let rear = -1;
  let size = 0;

  const ring = (highlights: Record<number, string>, description: string, line: number): ArrayFrame => {
    const ptrs: ArrayPointer[] = [];
    if (size > 0) {
      ptrs.push(pointer(front, "FRONT", C.done));
      ptrs.push(pointer(rear, "REAR", C.remove));
    }
    const labels: Record<number, string> = {};
    for (let i = 0; i < cap; i += 1) labels[i] = String(i);
    return snapshot(slots, highlights, ptrs, description, line, null, "ring", { labels });
  };

  const frames = [ring({}, `An empty circular queue with capacity ${cap}. Indices wrap with % ${cap}.`, 0)];

  const toEnqueue = values.slice(0, cap);
  toEnqueue.forEach((v) => {
    rear = (rear + 1) % cap;
    slots[rear] = v;
    size += 1;
    frames.push(ring(mark(rear, C.done), `Enqueue ${v}: rear = (rear + 1) % ${cap} = ${rear}`, 1));
  });

  if (values.length > cap) {
    frames.push(ring({}, `The queue is full — the remaining ${values.length - cap} value(s) cannot be enqueued without overwriting live data.`, 2));
  }

  // Serve two, which frees the slots the next enqueue will wrap into.
  const toServe = Math.min(2, size);
  for (let k = 0; k < toServe; k += 1) {
    const served = slots[front];
    frames.push(ring(mark(front, C.remove), `Dequeue ${served} from index ${front}`, 3));
    slots[front] = "";
    front = (front + 1) % cap;
    size -= 1;
    frames.push(ring({}, `front = (front + 1) % ${cap} = ${front}. Nothing shifted — that is the whole gain.`, 3));
  }

  const extra = values.slice(cap, cap + toServe);
  extra.forEach((v) => {
    rear = (rear + 1) % cap;
    slots[rear] = v;
    size += 1;
    frames.push(
      ring(mark(rear, C.move), `Enqueue ${v}: rear wraps round to index ${rear}, reusing a slot that was freed`, 4),
    );
  });

  frames.push(ring({}, `${size} element(s) in the queue, occupying indices from ${front} round to ${rear}.`, 5));
  return frames;
}

/**
 * Sliding window maximum with a monotonic deque — the `monotonic-deque` lesson.
 * The deque holds indices whose values decrease from front to back, so the front
 * is always the answer for the current window.
 */
export function slidingWindowMaxFrames(values: number[], windowSize: number): ArrayFrame[] {
  const arr = values.slice();
  const n = arr.length;
  const k = Math.max(1, Math.min(Math.round(windowSize) || 3, Math.max(1, n)));
  const deque: number[] = [];
  const answers: number[] = [];
  const frames: ArrayFrame[] = [];

  const snap = (highlights: Record<number, string>, description: string, line: number, range: [number, number] | null) =>
    snapshot(arr, highlights, deque.length ? [pointer(deque[0], "MAX", C.done)] : [], description, line, range, "horizontal", {
      secondary: {
        label: "deque (front → back)",
        values: deque.map((i) => arr[i]),
        labels: Object.fromEntries(deque.map((i, slot) => [slot, `[${i}]`])),
      },
    });

  frames.push(snap({}, `Sliding window maximum, window size ${k}. The deque keeps indices in decreasing value order.`, 0, null));

  for (let i = 0; i < n; i += 1) {
    while (deque.length && deque[0] <= i - k) {
      const dropped = deque.shift() as number;
      frames.push(snap({}, `Index ${dropped} has fallen out of the window — drop it from the front`, 1, [Math.max(0, i - k + 1), i]));
    }
    while (deque.length && arr[deque[deque.length - 1]] <= arr[i]) {
      const popped = deque.pop() as number;
      frames.push(
        snap(
          mark(i, C.inspect),
          `arr[${i}] = ${arr[i]} is at least arr[${popped}] = ${arr[popped]}, so ${arr[popped]} can never be a maximum again — discard it`,
          2,
          [Math.max(0, i - k + 1), i],
        ),
      );
    }
    deque.push(i);
    frames.push(snap(mark(i, C.cursor), `Push index ${i} at the back`, 3, [Math.max(0, i - k + 1), i]));

    if (i >= k - 1) {
      answers.push(arr[deque[0]]);
      frames.push(
        snap(
          mark(deque[0], C.done),
          `Window [${i - k + 1}..${i}] — the front of the deque is the maximum: ${arr[deque[0]]}`,
          4,
          [i - k + 1, i],
        ),
      );
    }
  }

  frames.push(
    snapshot(arr, {}, [], `Maxima: [${answers.join(", ")}] — each index entered and left the deque once, so this is O(n).`, 5),
  );
  return frames;
}

/** A double-ended queue: pushes and pops at both ends, all O(1). */
export function dequeOpsFrames(values: number[], value: number): ArrayFrame[] {
  const arr: Array<string | number> = values.slice();
  const frames = [snapshot(arr, {}, ends(arr.length), "A deque allows insertion and removal at both ends", 0)];

  arr.unshift(value);
  frames.push(snapshot(arr, mark(0, C.done), ends(arr.length), `pushFront(${value})`, 1));

  arr.push(value);
  frames.push(snapshot(arr, mark(arr.length - 1, C.done), ends(arr.length), `pushBack(${value})`, 2));

  const frontVal = arr[0];
  frames.push(snapshot(arr, mark(0, C.remove), ends(arr.length), `popFront() → ${frontVal}`, 3));
  arr.shift();

  const backVal = arr[arr.length - 1];
  frames.push(snapshot(arr, mark(arr.length - 1, C.remove), ends(arr.length), `popBack() → ${backVal}`, 4));
  arr.pop();

  frames.push(snapshot(arr, {}, ends(arr.length), "Back to the original contents — all four operations were O(1)", 5));
  return frames;
}
