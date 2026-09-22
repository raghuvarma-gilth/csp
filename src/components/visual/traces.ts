/**
 * Algorithm traces for the visual learning screens.
 *
 * Every frame in this file is produced by *running the algorithm* and recording
 * what it did — not by hand-writing an animation that looks plausible. Change
 * the input array at the top of a builder and the frames change with it,
 * because they are the algorithm's own steps.
 *
 * That distinction matters: a student watching a sliding window move is
 * watching the real window, so what they learn transfers to the code they will
 * write. A hand-drawn animation would eventually disagree with the algorithm,
 * and they would have no way to tell which one was lying.
 */

import { visualMeta } from "@/components/visual/catalogue";

export type CellState = "idle" | "active" | "compare" | "done" | "removed" | "window" | "ghost";

export interface Cell {
  value: string | number;
  state: CellState;
  /** Small caption under the cell — an index, an address, a count. */
  label?: string;
}

export interface Pointer {
  label: string;
  index: number;
  tone: "primary" | "accent" | "warning";
}

export interface Aux {
  label: string;
  items: Cell[];
  orientation?: "horizontal" | "vertical";
}

export interface Frame {
  cells: Cell[];
  pointers: Pointer[];
  note: string;
  aux?: Aux;
  readout?: Array<{ label: string; value: string }>;
}

export interface Trace {
  key: string;
  title: string;
  subtitle: string;
  input: string;
  complexity: string;
  frames: Frame[];
}

const plain = (values: Array<string | number>, state: CellState = "idle"): Cell[] =>
  values.map((value) => ({ value, state }));

/**
 * Title, subtitle and complexity come from the catalogue rather than being
 * repeated here, so the gallery card and the player header can never drift
 * apart. A key missing from the catalogue is a programming error, not a runtime
 * condition — every builder below is registered in both files.
 */
const meta = (key: string) => {
  const entry = visualMeta(key);
  if (!entry) throw new Error(`No catalogue entry for visualisation "${key}"`);
  return { key: entry.key, title: entry.title, subtitle: entry.subtitle, complexity: entry.complexity };
};

const withIndexLabels = (cells: Cell[]): Cell[] =>
  cells.map((cell, index) => ({ ...cell, label: cell.label ?? String(index) }));

/* -------------------------------------------------------------------------- */
/* Arrays                                                                     */
/* -------------------------------------------------------------------------- */

const arrayMemory = (): Trace => {
  const values = [12, 7, 45, 3, 28, 19];
  const base = 1000;
  const size = 4;
  const frames: Frame[] = [];

  frames.push({
    cells: values.map((value, index) => ({
      value,
      state: "idle",
      label: `${base + index * size}`,
    })),
    pointers: [],
    note: `An array of ${values.length} 4-byte integers laid out end to end from address ${base}. Nothing is stored about where element i lives — it is computed.`,
    readout: [{ label: "formula", value: `address(i) = ${base} + i × ${size}` }],
  });

  for (const index of [0, 3, 5]) {
    frames.push({
      cells: values.map((value, position) => ({
        value,
        state: position === index ? "active" : "idle",
        label: `${base + position * size}`,
      })),
      pointers: [{ label: "i", index, tone: "primary" }],
      note: `Reading a[${index}]. One multiply, one add, one memory read — the same cost whether i is 0 or ${values.length - 1}. This is why array indexing is O(1).`,
      readout: [
        { label: "address", value: `${base} + ${index} × ${size} = ${base + index * size}` },
        { label: "value", value: String(values[index]) },
      ],
    });
  }

  return {
    ...meta("array-memory"),
    input: `[${values.join(", ")}]`,
    frames,
  };
};

const arrayShift = (): Trace => {
  const start = [5, 8, 13, 21, 34];
  const frames: Frame[] = [];
  const working = [...start];

  frames.push({
    cells: withIndexLabels(plain(working)),
    pointers: [],
    note: "Insert 1 at the front. There is no gap to put it in, so every element has to move one slot right first.",
  });

  working.push(0);
  for (let index = working.length - 1; index >= 1; index -= 1) {
    working[index] = working[index - 1];
    frames.push({
      cells: withIndexLabels(
        working.map((value, position) => ({
          value: position === 0 ? "?" : value,
          state: position === index ? "active" : position < index ? "idle" : "done",
        })),
      ),
      pointers: [{ label: "copy", index, tone: "warning" }],
      note: `Copy a[${index - 1}] into a[${index}]. ${working.length - index} of ${start.length} elements moved.`,
    });
  }

  working[0] = 1;
  frames.push({
    cells: withIndexLabels(
      working.map((value, position) => ({ value, state: position === 0 ? "active" : "done" })),
    ),
    pointers: [{ label: "new", index: 0, tone: "primary" }],
    note: `Only now can 1 be written. Inserting at the front touched all ${start.length} existing elements — that is O(n), and it is the cost a linked list exists to avoid.`,
    readout: [{ label: "elements moved", value: String(start.length) }],
  });

  return {
    ...meta("array-shift"),
    input: `[${start.join(", ")}] ← insert 1 at index 0`,
    frames,
  };
};

const twoPointers = (): Trace => {
  const values = [2, 4, 7, 11, 15, 20];
  const target = 22;
  const frames: Frame[] = [];

  let left = 0;
  let right = values.length - 1;

  frames.push({
    cells: withIndexLabels(plain(values)),
    pointers: [
      { label: "L", index: left, tone: "primary" },
      { label: "R", index: right, tone: "accent" },
    ],
    note: `Find two values summing to ${target}. The array is sorted, which is the whole reason this works.`,
    readout: [{ label: "target", value: String(target) }],
  });

  while (left < right) {
    const sum = values[left] + values[right];
    const state: Frame = {
      cells: withIndexLabels(
        values.map((value, index) => ({
          value,
          state: index === left || index === right ? "compare" : index < left || index > right ? "removed" : "idle",
        })),
      ),
      pointers: [
        { label: "L", index: left, tone: "primary" },
        { label: "R", index: right, tone: "accent" },
      ],
      note: "",
      readout: [{ label: "sum", value: `${values[left]} + ${values[right]} = ${sum}` }],
    };

    if (sum === target) {
      state.note = `${sum} is the target. Found at indices ${left} and ${right} after ${frames.length} comparisons — a nested loop would have taken up to ${(values.length * (values.length - 1)) / 2}.`;
      state.cells = state.cells.map((cell, index) => ({
        ...cell,
        state: index === left || index === right ? "done" : cell.state,
      }));
      frames.push(state);
      break;
    }

    if (sum < target) {
      state.note = `${sum} is below ${target}. Every pair using a[${left}] is now too small, so the whole left column can be discarded. Move L right.`;
      frames.push(state);
      left += 1;
    } else {
      state.note = `${sum} is above ${target}. Every pair using a[${right}] is now too big, so that column goes. Move R left.`;
      frames.push(state);
      right -= 1;
    }
  }

  return {
    ...meta("two-pointers"),
    input: `[${values.join(", ")}], target ${target}`,
    frames,
  };
};

const slidingWindow = (): Trace => {
  const values = [3, 1, 4, 1, 5, 9, 2, 6];
  const k = 3;
  const frames: Frame[] = [];

  let sum = 0;
  let best = -Infinity;
  let bestStart = 0;

  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];

    if (index < k - 1) {
      frames.push({
        cells: withIndexLabels(
          values.map((value, position) => ({
            value,
            state: position <= index ? "window" : "idle",
          })),
        ),
        pointers: [{ label: "end", index, tone: "primary" }],
        note: `Filling the first window. ${index + 1} of ${k} elements in.`,
        readout: [{ label: "window sum", value: String(sum) }],
      });
      continue;
    }

    const start = index - k + 1;
    if (sum > best) {
      best = sum;
      bestStart = start;
    }

    frames.push({
      cells: withIndexLabels(
        values.map((value, position) => ({
          value,
          state: position >= start && position <= index ? "window" : "idle",
        })),
      ),
      pointers: [
        { label: "start", index: start, tone: "primary" },
        { label: "end", index, tone: "accent" },
      ],
      note:
        start === 0
          ? `First full window. Its sum is ${sum}.`
          : `Slide one step: subtract a[${start - 1}] = ${values[start - 1]}, add a[${index}] = ${values[index]}. Two operations, not ${k} — that is the trick.`,
      readout: [
        { label: "window sum", value: String(sum) },
        { label: "best so far", value: `${best} at index ${bestStart}` },
      ],
    });

    sum -= values[start];
  }

  frames.push({
    cells: withIndexLabels(
      values.map((value, position) => ({
        value,
        state: position >= bestStart && position < bestStart + k ? "done" : "idle",
      })),
    ),
    pointers: [{ label: "best", index: bestStart, tone: "primary" }],
    note: `The best window of ${k} starts at index ${bestStart} and sums to ${best}. Every element was added once and removed once.`,
    readout: [{ label: "answer", value: String(best) }],
  });

  return {
    ...meta("sliding-window"),
    input: `[${values.join(", ")}], k = ${k}`,
    frames,
  };
};

const prefixSum = (): Trace => {
  const values = [4, 2, 7, 1, 9, 3];
  const frames: Frame[] = [];
  const prefix: number[] = [0];

  frames.push({
    cells: withIndexLabels(plain(values)),
    pointers: [],
    note: "Many range-sum queries are coming. Answering each by looping costs O(n) every time — so pay O(n) once instead.",
    aux: { label: "prefix", items: plain([0]) },
  });

  for (let index = 0; index < values.length; index += 1) {
    prefix.push(prefix[index] + values[index]);
    frames.push({
      cells: withIndexLabels(
        values.map((value, position) => ({ value, state: position === index ? "active" : position < index ? "done" : "idle" })),
      ),
      pointers: [{ label: "i", index, tone: "primary" }],
      note: `prefix[${index + 1}] = prefix[${index}] + a[${index}] = ${prefix[index]} + ${values[index]} = ${prefix[index + 1]}`,
      aux: {
        label: "prefix",
        items: prefix.map((value, position) => ({
          value,
          state: position === index + 1 ? "active" : "done",
          label: String(position),
        })),
      },
    });
  }

  const from = 1;
  const to = 4;
  frames.push({
    cells: withIndexLabels(
      values.map((value, position) => ({
        value,
        state: position >= from && position <= to ? "window" : "idle",
      })),
    ),
    pointers: [
      { label: "l", index: from, tone: "primary" },
      { label: "r", index: to, tone: "accent" },
    ],
    note: `Now any range is two lookups and a subtraction. sum(${from}..${to}) = prefix[${to + 1}] − prefix[${from}] = ${prefix[to + 1]} − ${prefix[from]} = ${prefix[to + 1] - prefix[from]}. No loop.`,
    aux: {
      label: "prefix",
      items: prefix.map((value, position) => ({
        value,
        state: position === to + 1 || position === from ? "compare" : "idle",
        label: String(position),
      })),
    },
    readout: [{ label: "answer", value: String(prefix[to + 1] - prefix[from]) }],
  });

  return {
    ...meta("prefix-sum"),
    input: `[${values.join(", ")}]`,
    frames,
  };
};

/* -------------------------------------------------------------------------- */
/* Stacks                                                                     */
/* -------------------------------------------------------------------------- */

const stackBasics = (): Trace => {
  const operations: Array<["push", number] | ["pop"]> = [
    ["push", 3],
    ["push", 8],
    ["push", 5],
    ["pop"],
    ["push", 12],
    ["pop"],
    ["pop"],
  ];
  const frames: Frame[] = [];
  const stack: number[] = [];

  frames.push({
    cells: [],
    pointers: [],
    note: "A stack only ever touches one end. Both push and pop are O(1) because nothing else has to move.",
    aux: { label: "stack (top at the right)", items: [], orientation: "horizontal" },
  });

  for (const operation of operations) {
    let note: string;
    if (operation[0] === "push") {
      stack.push(operation[1]);
      note = `push(${operation[1]}) — it goes on top. Everything underneath is untouched.`;
    } else {
      const removed = stack.pop();
      note = `pop() returns ${removed}, the most recent push. Last in, first out.`;
    }

    frames.push({
      cells: [],
      pointers: [],
      note,
      aux: {
        label: "stack (top at the right)",
        items: stack.map((value, index) => ({
          value,
          state: index === stack.length - 1 ? "active" : "idle",
          label: index === stack.length - 1 ? "top" : undefined,
        })),
        orientation: "horizontal",
      },
      readout: [{ label: "size", value: String(stack.length) }],
    });
  }

  return {
    ...meta("stack"),
    input: operations.map((op) => (op[0] === "push" ? `push(${op[1]})` : "pop()")).join(" · "),
    frames,
  };
};

const stackBrackets = (): Trace => {
  const input = "{[()]}()[}";
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const frames: Frame[] = [];
  const stack: string[] = [];
  let failed = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    let note: string;
    let state: CellState = "active";

    if (character === "(" || character === "[" || character === "{") {
      stack.push(character);
      note = `'${character}' opens. Push it and remember we owe a '${Object.entries(pairs).find(([, open]) => open === character)?.[0]}'.`;
    } else if (stack.length === 0) {
      note = `'${character}' closes nothing — the stack is empty. Unbalanced.`;
      state = "removed";
      failed = true;
    } else if (stack[stack.length - 1] === pairs[character]) {
      stack.pop();
      note = `'${character}' matches the '${pairs[character]}' on top. Pop it; that debt is settled.`;
      state = "done";
    } else {
      note = `'${character}' does not match the '${stack[stack.length - 1]}' on top. Unbalanced — and we know immediately, without scanning ahead.`;
      state = "removed";
      failed = true;
    }

    frames.push({
      cells: input.split("").map((value, position) => ({
        value,
        state: position === index ? state : position < index ? "done" : "idle",
      })),
      pointers: [{ label: "i", index, tone: "primary" }],
      note,
      aux: {
        label: "stack",
        items: stack.map((value, position) => ({
          value,
          state: position === stack.length - 1 ? "active" : "idle",
        })),
        orientation: "horizontal",
      },
    });

    if (failed) break;
  }

  return {
    ...meta("stack-brackets"),
    input,
    frames,
  };
};

const monotonicStack = (): Trace => {
  const values = [2, 1, 2, 4, 3, 1];
  const frames: Frame[] = [];
  const stack: number[] = [];
  const answer: Array<number | string> = values.map(() => "—");

  for (let index = 0; index < values.length; index += 1) {
    while (stack.length > 0 && values[stack[stack.length - 1]] < values[index]) {
      const resolved = stack.pop()!;
      answer[resolved] = values[index];
      frames.push({
        cells: withIndexLabels(
          values.map((value, position) => ({
            value,
            state: position === index ? "compare" : position === resolved ? "done" : "idle",
          })),
        ),
        pointers: [{ label: "i", index, tone: "primary" }],
        note: `a[${index}] = ${values[index]} is greater than the ${values[resolved]} waiting at index ${resolved}. That index has its answer now — pop it. Each index is popped at most once, which is why the nested loop is still O(n) overall.`,
        aux: {
          label: "stack (indices, values decreasing)",
          items: stack.map((position) => ({ value: `${values[position]}@${position}`, state: "idle" as CellState })),
          orientation: "horizontal",
        },
        readout: [{ label: "answers", value: answer.join(", ") }],
      });
    }

    stack.push(index);
    frames.push({
      cells: withIndexLabels(
        values.map((value, position) => ({
          value,
          state: position === index ? "active" : answer[position] !== "—" ? "done" : "idle",
        })),
      ),
      pointers: [{ label: "i", index, tone: "primary" }],
      note: `Nothing on the stack is smaller than ${values[index]}, so index ${index} waits here for its own next-greater element.`,
      aux: {
        label: "stack (indices, values decreasing)",
        items: stack.map((position) => ({
          value: `${values[position]}@${position}`,
          state: position === index ? ("active" as CellState) : ("idle" as CellState),
        })),
        orientation: "horizontal",
      },
      readout: [{ label: "answers", value: answer.join(", ") }],
    });
  }

  frames.push({
    cells: withIndexLabels(values.map((value) => ({ value, state: "done" as CellState }))),
    pointers: [],
    note: `Anything left on the stack has no greater element to its right. Those stay "—" — which is an answer, not a missing value.`,
    aux: {
      label: "stack (never resolved)",
      items: stack.map((position) => ({ value: `${values[position]}@${position}`, state: "removed" as CellState })),
      orientation: "horizontal",
    },
    readout: [{ label: "next greater", value: answer.join(", ") }],
  });

  return {
    ...meta("monotonic-stack"),
    input: `[${values.join(", ")}]`,
    frames,
  };
};

/* -------------------------------------------------------------------------- */
/* Queues                                                                     */
/* -------------------------------------------------------------------------- */

const queueBasics = (): Trace => {
  const operations: Array<["enqueue", string] | ["dequeue"]> = [
    ["enqueue", "A"],
    ["enqueue", "B"],
    ["dequeue"],
    ["enqueue", "C"],
    ["enqueue", "D"],
    ["dequeue"],
    ["dequeue"],
  ];
  const frames: Frame[] = [];
  const queue: string[] = [];

  frames.push({
    cells: [],
    pointers: [],
    note: "A queue adds at one end and removes at the other. First in, first out — the order a print spooler or a BFS frontier needs.",
    aux: { label: "queue (front at the left)", items: [], orientation: "horizontal" },
  });

  for (const operation of operations) {
    let note: string;
    if (operation[0] === "enqueue") {
      queue.push(operation[1]);
      note = `enqueue(${operation[1]}) — joins the back of the line.`;
    } else {
      const removed = queue.shift();
      note = `dequeue() returns ${removed}, which had waited longest.`;
    }

    frames.push({
      cells: [],
      pointers: [],
      note,
      aux: {
        label: "queue (front at the left)",
        items: queue.map((value, index) => ({
          value,
          state: index === 0 ? "active" : "idle",
          label: index === 0 ? "front" : index === queue.length - 1 ? "back" : undefined,
        })),
        orientation: "horizontal",
      },
      readout: [{ label: "size", value: String(queue.length) }],
    });
  }

  return {
    ...meta("queue"),
    input: operations.map((op) => (op[0] === "enqueue" ? `enqueue(${op[1]})` : "dequeue()")).join(" · "),
    frames,
  };
};

const circularQueue = (): Trace => {
  const capacity = 5;
  const buffer: Array<string | number> = Array(capacity).fill("·");
  const frames: Frame[] = [];
  let head = 0;
  let tail = 0;
  let count = 0;

  const snapshot = (note: string, active: number | null) => {
    frames.push({
      cells: buffer.map((value, index) => ({
        value,
        state:
          index === active
            ? "active"
            : count > 0 && (index - head + capacity) % capacity < count
              ? "window"
              : "ghost",
        label: String(index),
      })),
      pointers: [
        { label: "head", index: head, tone: "primary" },
        { label: "tail", index: tail % capacity, tone: "accent" },
      ],
      note,
      readout: [
        { label: "count", value: `${count} / ${capacity}` },
        { label: "wrap", value: `(index + 1) % ${capacity}` },
      ],
    });
  };

  snapshot(
    `A fixed buffer of ${capacity} slots. head and tail move forward and wrap with modulo — nothing is ever shifted, so dequeue stays O(1).`,
    null,
  );

  const script: Array<["push", number] | ["pop"]> = [
    ["push", 10],
    ["push", 20],
    ["push", 30],
    ["pop"],
    ["pop"],
    ["push", 40],
    ["push", 50],
    ["push", 60],
    ["push", 70],
  ];

  for (const step of script) {
    if (step[0] === "push") {
      if (count === capacity) {
        snapshot(`enqueue(${step[1]}) is refused — the buffer is full. A circular queue does not grow; that is the deal it makes for O(1) and no allocation.`, null);
        continue;
      }
      const slot = tail % capacity;
      buffer[slot] = step[1];
      tail = (tail + 1) % capacity;
      count += 1;
      snapshot(
        `enqueue(${step[1]}) writes slot ${slot}, then tail wraps to ${tail}.${slot < head ? " Notice it reused a slot the head has already passed — that space is genuinely free." : ""}`,
        slot,
      );
    } else {
      const slot = head;
      const value = buffer[slot];
      buffer[slot] = "·";
      head = (head + 1) % capacity;
      count -= 1;
      snapshot(`dequeue() returns ${value} from slot ${slot}. head moves to ${head}. No element moved.`, slot);
    }
  }

  return {
    ...meta("circular-queue"),
    input: `capacity ${capacity}`,
    frames,
  };
};

const monotonicDeque = (): Trace => {
  const values = [1, 3, -1, -3, 5, 3, 6, 7];
  const k = 3;
  const frames: Frame[] = [];
  const deque: number[] = [];
  const answers: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    if (deque.length > 0 && deque[0] <= index - k) {
      const dropped = deque.shift()!;
      frames.push({
        cells: withIndexLabels(
          values.map((value, position) => ({
            value,
            state: position > index - k && position <= index ? "window" : "idle",
          })),
        ),
        pointers: [{ label: "i", index, tone: "primary" }],
        note: `Index ${dropped} has fallen out of the window. Drop it from the front — it can never be the maximum again.`,
        aux: {
          label: "deque (indices, values decreasing)",
          items: deque.map((position) => ({ value: `${values[position]}@${position}`, state: "idle" as CellState })),
          orientation: "horizontal",
        },
      });
    }

    while (deque.length > 0 && values[deque[deque.length - 1]] <= values[index]) {
      const dropped = deque.pop()!;
      frames.push({
        cells: withIndexLabels(
          values.map((value, position) => ({
            value,
            state: position === index ? "compare" : position > index - k && position < index ? "window" : "idle",
          })),
        ),
        pointers: [{ label: "i", index, tone: "primary" }],
        note: `a[${index}] = ${values[index]} is at least ${values[dropped]}, and it arrived later. Index ${dropped} is useless from now on — pop it from the back.`,
        aux: {
          label: "deque (indices, values decreasing)",
          items: deque.map((position) => ({ value: `${values[position]}@${position}`, state: "idle" as CellState })),
          orientation: "horizontal",
        },
      });
    }

    deque.push(index);
    const complete = index >= k - 1;
    if (complete) answers.push(values[deque[0]]);

    frames.push({
      cells: withIndexLabels(
        values.map((value, position) => ({
          value,
          state:
            complete && position === deque[0]
              ? "done"
              : position > index - k && position <= index
                ? "window"
                : "idle",
        })),
      ),
      pointers: [{ label: "i", index, tone: "primary" }],
      note: complete
        ? `Window [${Math.max(0, index - k + 1)}..${index}] is full. Its maximum is whatever sits at the front of the deque: ${values[deque[0]]}. Reading it is O(1).`
        : `Filling the first window — ${index + 1} of ${k}.`,
      aux: {
        label: "deque (indices, values decreasing)",
        items: deque.map((position) => ({
          value: `${values[position]}@${position}`,
          state: position === deque[0] ? ("active" as CellState) : ("idle" as CellState),
        })),
        orientation: "horizontal",
      },
      readout: answers.length > 0 ? [{ label: "maxima", value: answers.join(", ") }] : undefined,
    });
  }

  return {
    ...meta("monotonic-deque"),
    input: `[${values.join(", ")}], k = ${k}`,
    frames,
  };
};

/* -------------------------------------------------------------------------- */

const BUILDERS: Record<string, () => Trace> = {
  "array-memory": arrayMemory,
  "array-shift": arrayShift,
  "two-pointers": twoPointers,
  "sliding-window": slidingWindow,
  "prefix-sum": prefixSum,
  stack: stackBasics,
  "stack-brackets": stackBrackets,
  "monotonic-stack": monotonicStack,
  queue: queueBasics,
  "circular-queue": circularQueue,
  "monotonic-deque": monotonicDeque,
};

/** Every visualisation this app can actually draw. */
export const VISUAL_KEYS = Object.keys(BUILDERS);

/** Builds a trace, or null when nothing is implemented for that key. */
export const buildTrace = (key: string): Trace | null => BUILDERS[key]?.() ?? null;
