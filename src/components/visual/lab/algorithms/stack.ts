/**
 * Stack operations and the patterns that are really "a stack in disguise".
 *
 * Stacks render vertically, so the top of the drawing is the top of the stack.
 */

import { mark, pointer, stackSnapshot } from "../frames";
import { C, type ArrayFrame, type ArrayPointer } from "../types";

const topPointer = (length: number): ArrayPointer[] =>
  length ? [pointer(length - 1, "TOP", C.cursor)] : [];

export function pushFrames(values: number[], value: number): ArrayFrame[] {
  const arr: Array<string | number> = values.slice();
  const frames = [stackSnapshot(arr, {}, topPointer(arr.length), "Before push", 0)];
  arr.push(value);
  frames.push(
    stackSnapshot(arr, mark(arr.length - 1, C.done), topPointer(arr.length), `Push ${value} — it lands on top, in O(1)`, 1),
  );
  return frames;
}

export function popFrames(values: number[]): ArrayFrame[] {
  const arr: Array<string | number> = values.slice();
  if (!arr.length) return [stackSnapshot(arr, {}, [], "Stack is empty — pop would underflow", 0)];
  const removed = arr[arr.length - 1];
  const frames = [
    stackSnapshot(arr, mark(arr.length - 1, C.remove), topPointer(arr.length), `Pop ${removed} from the top`, 0),
  ];
  arr.pop();
  frames.push(stackSnapshot(arr, {}, topPointer(arr.length), `After pop — TOP moves down to ${arr.length - 1}`, 1));
  return frames;
}

export function peekFrames(values: number[]): ArrayFrame[] {
  const arr: Array<string | number> = values.slice();
  if (!arr.length) return [stackSnapshot(arr, {}, [], "Stack is empty — there is nothing to peek at", 0)];
  return [
    stackSnapshot(
      arr,
      mark(arr.length - 1, C.inspect),
      topPointer(arr.length),
      `Top element = ${arr[arr.length - 1]} — read, not removed`,
      0,
    ),
  ];
}

/**
 * The monotonic stack. The stack holds indices whose answer is still unknown,
 * and every value is pushed once and popped once — which is why a doubly nested
 * loop still runs in O(n).
 */
export function nextGreaterFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  const n = arr.length;
  const result = new Array<number>(n).fill(-1);
  const stack: number[] = [];
  const stackValues = () => stack.map((j) => arr[j]);
  const frames = [
    stackSnapshot([], {}, [], "Next Greater Element: the stack holds values still waiting for an answer", 0),
  ];
  for (let i = 0; i < n; i += 1) {
    while (stack.length && arr[stack[stack.length - 1]] < arr[i]) {
      const idx = stack.pop() as number;
      result[idx] = arr[i];
      frames.push(
        stackSnapshot(
          stackValues(),
          {},
          topPointer(stack.length),
          `arr[${i}] = ${arr[i]} beats the waiting ${arr[idx]} — pop it, its answer is ${arr[i]}`,
          2,
        ),
      );
    }
    stack.push(i);
    frames.push(
      stackSnapshot(
        stackValues(),
        mark(stack.length - 1, C.done),
        topPointer(stack.length),
        `Nothing left to resolve — push arr[${i}] = ${arr[i]} and wait`,
        3,
      ),
    );
  }
  frames.push(
    stackSnapshot(
      stackValues(),
      {},
      [],
      `Done. Anything still on the stack has no greater element to its right. Result: [${result.join(", ")}]`,
      4,
    ),
  );
  return frames;
}

export function minStackFrames(values: number[]): ArrayFrame[] {
  const arr = values.slice();
  const stack: Array<string | number> = [];
  const minStack: number[] = [];
  const frames = [
    stackSnapshot([], {}, [], "Min Stack: push the running minimum alongside each value, so min() is O(1)", 0),
  ];
  arr.forEach((v) => {
    stack.push(v);
    const currentMin = minStack.length ? Math.min(minStack[minStack.length - 1], v) : v;
    minStack.push(currentMin);
    frames.push(
      stackSnapshot(
        stack.slice(),
        mark(stack.length - 1, C.done),
        topPointer(stack.length),
        `Push ${v} — the minimum of everything below it is ${currentMin}`,
        1,
      ),
    );
  });
  frames.push(
    stackSnapshot(
      stack,
      {},
      topPointer(stack.length),
      stack.length
        ? `Top = ${stack[stack.length - 1]}, minimum = ${minStack[minStack.length - 1]} — both read without scanning`
        : "Stack is empty",
      2,
    ),
  );
  return frames;
}

const PAIRS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
const OPENERS = new Set(["(", "[", "{"]);

/**
 * Bracket matching. The `stack-brackets` lesson deep-links here, and it is the
 * clearest argument for why a stack exists: the most recently opened bracket is
 * the one that must close first, which is exactly last-in-first-out.
 */
export function balancedBracketsFrames(expression: string): ArrayFrame[] {
  const text = expression.trim();
  if (!text) {
    return [stackSnapshot([], {}, [], "Type an expression containing brackets, for example ( a [ b ] { c } )", 0)];
  }
  const stack: string[] = [];
  const frames = [stackSnapshot([], {}, [], `Scan "${text}" left to right`, 0)];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (OPENERS.has(ch)) {
      stack.push(ch);
      frames.push(
        stackSnapshot(stack.slice(), mark(stack.length - 1, C.done), topPointer(stack.length), `"${ch}" opens — push it`, 1),
      );
    } else if (ch in PAIRS) {
      const expected = PAIRS[ch];
      if (!stack.length) {
        frames.push(
          stackSnapshot([], {}, [], `"${ch}" closes, but the stack is empty — there is nothing it can match. Not balanced.`, 3),
        );
        return frames;
      }
      const top = stack[stack.length - 1];
      frames.push(
        stackSnapshot(
          stack.slice(),
          mark(stack.length - 1, top === expected ? C.inspect : C.remove),
          topPointer(stack.length),
          `"${ch}" closes — the top of the stack must be "${expected}", and it is "${top}"`,
          2,
        ),
      );
      if (top !== expected) {
        frames.push(stackSnapshot(stack.slice(), mark(stack.length - 1, C.remove), [], `Mismatch. Not balanced.`, 3));
        return frames;
      }
      stack.pop();
      frames.push(stackSnapshot(stack.slice(), {}, topPointer(stack.length), `Matched pair "${expected}${ch}" — pop`, 2));
    }
  }
  frames.push(
    stack.length
      ? stackSnapshot(stack.slice(), mark(stack.length - 1, C.remove), [], `${stack.length} bracket(s) never closed. Not balanced.`, 4)
      : stackSnapshot([], {}, [], "Stack is empty at the end — every bracket was matched. Balanced.", 4),
  );
  return frames;
}

const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };

/** The shunting-yard algorithm: infix in, postfix out, with a stack in between. */
export function infixToPostfixFrames(expression: string): ArrayFrame[] {
  const text = expression.replace(/\s+/g, "");
  if (!text) {
    return [stackSnapshot([], {}, [], "Type an infix expression, for example a+b*(c-d)", 0)];
  }
  const stack: string[] = [];
  const output: string[] = [];
  const snap = (highlights: Record<number, string>, description: string, line: number) =>
    stackSnapshot(stack.slice(), highlights, topPointer(stack.length), `${description}    output: ${output.join(" ") || "—"}`, line);

  const frames = [snap({}, `Convert "${text}" to postfix`, 0)];
  for (const ch of text) {
    if (/[A-Za-z0-9]/.test(ch)) {
      output.push(ch);
      frames.push(snap({}, `"${ch}" is an operand — send it straight to the output`, 1));
    } else if (ch === "(") {
      stack.push(ch);
      frames.push(snap(mark(stack.length - 1, C.done), `"(" — push it as a barrier`, 2));
    } else if (ch === ")") {
      while (stack.length && stack[stack.length - 1] !== "(") {
        output.push(stack.pop() as string);
        frames.push(snap({}, `Pop operators until "(" — emitted "${output[output.length - 1]}"`, 3));
      }
      stack.pop();
      frames.push(snap({}, `Discard the matching "("`, 3));
    } else if (ch in PRECEDENCE) {
      while (
        stack.length &&
        stack[stack.length - 1] !== "(" &&
        PRECEDENCE[stack[stack.length - 1]] >= PRECEDENCE[ch]
      ) {
        output.push(stack.pop() as string);
        frames.push(snap({}, `"${output[output.length - 1]}" binds at least as tightly as "${ch}" — emit it first`, 4));
      }
      stack.push(ch);
      frames.push(snap(mark(stack.length - 1, C.done), `Push the operator "${ch}"`, 5));
    }
  }
  while (stack.length) {
    output.push(stack.pop() as string);
    frames.push(snap({}, `Drain the stack — emitted "${output[output.length - 1]}"`, 6));
  }
  frames.push(stackSnapshot([], {}, [], `Postfix: ${output.join(" ")}`, 7));
  return frames;
}

/**
 * A queue built from two stacks. Pushing is cheap; popping empties one stack
 * into the other, reversing the order, and that reversal is the whole trick.
 */
export function queueViaStacksFrames(values: number[]): ArrayFrame[] {
  const inbox: Array<string | number> = [];
  const outbox: Array<string | number> = [];
  const frames: ArrayFrame[] = [
    stackSnapshot([], {}, [], "A queue from two stacks. IN takes pushes; OUT serves pops.", 0),
  ];
  const snap = (description: string, line: number, highlights: Record<number, string> = {}) =>
    stackSnapshot(inbox.slice(), highlights, topPointer(inbox.length), `${description}    OUT (top first): ${outbox.slice().reverse().join(", ") || "—"}`, line);

  values.forEach((v) => {
    inbox.push(v);
    frames.push(snap(`Enqueue ${v} — push onto IN, O(1)`, 1, mark(inbox.length - 1, C.done)));
  });

  frames.push(snap("Now dequeue. OUT is empty, so everything moves across.", 2));
  while (inbox.length) {
    const moved = inbox.pop() as string | number;
    outbox.push(moved);
    frames.push(snap(`Pop ${moved} from IN, push it to OUT — the order flips`, 3, {}));
  }
  const served = outbox.pop();
  frames.push(
    snap(
      `Pop from OUT gives ${served} — the value enqueued first. Each element moves at most twice, so this averages O(1).`,
      4,
    ),
  );
  return frames;
}
