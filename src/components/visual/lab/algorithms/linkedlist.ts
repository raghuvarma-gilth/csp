/**
 * Linked list operations.
 *
 * The contrast with the array module is the lesson: here inserting at the front
 * is O(1) and reaching index k is O(k), which is exactly the other way round.
 */

import { listFrame, listNodes, mark, markAll } from "../frames";
import { C, type LinkedListFrame, type ListNodeFrame, type ListPointer, type NodeId } from "../types";

const nodesOf = (values: number[]): ListNodeFrame[] => listNodes(values);

export function traverseListFrames(values: number[]): LinkedListFrame[] {
  const nodes = nodesOf(values);
  if (!nodes.length) return [listFrame([], {}, "The list is empty", 0)];
  const frames = [
    listFrame(nodes, {}, "Traversal starts at head. There is no index arithmetic — only 'next'.", 0),
  ];
  const visited: NodeId[] = [];
  nodes.forEach((node, i) => {
    visited.push(node.id);
    frames.push(
      listFrame(
        nodes,
        { ...markAll(visited.slice(0, -1), C.faded), [node.id]: C.inspect },
        `Node ${i}: value ${node.value} — follow next to continue`,
        1,
      ),
    );
  });
  frames.push(listFrame(nodes, markAll(visited, C.done), `Reached the end after ${nodes.length} hops — O(n)`, 2));
  return frames;
}

export function insertAtBeginFrames(values: number[], value: number): LinkedListFrame[] {
  const nodes = nodesOf(values);
  const frames = [listFrame(nodes, {}, "Insert at the head", 0)];
  const newNode: ListNodeFrame = { id: "new", value };
  frames.push(
    listFrame(
      [newNode, ...nodes],
      mark("new" as NodeId, C.done),
      `Point the new node at the old head, then move head. O(1) — nothing else moved, unlike an array.`,
      1,
    ),
  );
  return frames;
}

export function insertAtEndListFrames(values: number[], value: number): LinkedListFrame[] {
  const nodes = nodesOf(values);
  const frames = [listFrame(nodes, {}, "Insert at the tail — but first we have to walk there", 0)];
  nodes.forEach((node, i) => {
    frames.push(listFrame(nodes, mark(node.id, C.inspect), `Walk to node ${i}`, 1));
  });
  const newNode: ListNodeFrame = { id: "new", value };
  frames.push(
    listFrame([...nodes, newNode], mark("new" as NodeId, C.done), `Attach ${value} to the last node. The walk made this O(n).`, 2),
  );
  return frames;
}

export function insertAtListFrames(values: number[], index: number, value: number): LinkedListFrame[] {
  const nodes = nodesOf(values);
  const at = Math.max(0, Math.min(Math.round(index), nodes.length));
  const frames = [listFrame(nodes, {}, `Insert ${value} at position ${at}`, 0)];
  for (let i = 0; i < at && i < nodes.length; i += 1) {
    frames.push(listFrame(nodes, mark(nodes[i].id, C.inspect), `Walk to node ${i}`, 1));
  }
  const withNew = nodes.slice();
  withNew.splice(at, 0, { id: "new", value });
  frames.push(
    listFrame(withNew, mark("new" as NodeId, C.done), `Relink: previous.next = new, new.next = old node at ${at}`, 2),
  );
  return frames;
}

export function deleteAtListFrames(values: number[], index: number): LinkedListFrame[] {
  const nodes = nodesOf(values);
  if (!nodes.length) return [listFrame([], {}, "The list is empty", 0)];
  const at = Math.max(0, Math.min(Math.round(index), nodes.length - 1));
  const frames = [listFrame(nodes, {}, `Delete the node at position ${at}`, 0)];
  for (let i = 0; i < at; i += 1) {
    frames.push(listFrame(nodes, mark(nodes[i].id, C.inspect), `Walk to node ${i}`, 1));
  }
  frames.push(listFrame(nodes, mark(nodes[at].id, C.remove), `Found it: value ${nodes[at].value}`, 2));
  const remaining = nodes.filter((_, i) => i !== at);
  frames.push(
    listFrame(remaining, {}, "Link the previous node past it. No shifting — only one pointer changed.", 3),
  );
  return frames;
}

export function deleteValueListFrames(values: number[], value: number): LinkedListFrame[] {
  const nodes = nodesOf(values);
  if (!nodes.length) return [listFrame([], {}, "The list is empty", 0)];
  const frames = [listFrame(nodes, {}, `Delete the first node holding ${value}`, 0)];
  for (let i = 0; i < nodes.length; i += 1) {
    frames.push(listFrame(nodes, mark(nodes[i].id, C.inspect), `Is node ${i} (${nodes[i].value}) equal to ${value}?`, 1));
    if (Number(nodes[i].value) === value) {
      frames.push(listFrame(nodes, mark(nodes[i].id, C.remove), `Yes — unlink it`, 2));
      frames.push(listFrame(nodes.filter((_, j) => j !== i), {}, "Deleted", 3));
      return frames;
    }
  }
  frames.push(listFrame(nodes, {}, `${value} is not in the list`, 4));
  return frames;
}

export function searchListFrames(values: number[], target: number): LinkedListFrame[] {
  const nodes = nodesOf(values);
  const frames = [listFrame(nodes, {}, `Search for ${target}. A list cannot binary search — it has no indices.`, 0)];
  for (let i = 0; i < nodes.length; i += 1) {
    frames.push(listFrame(nodes, mark(nodes[i].id, C.inspect), `Check node ${i}: ${nodes[i].value}`, 1));
    if (Number(nodes[i].value) === target) {
      frames.push(listFrame(nodes, mark(nodes[i].id, C.done), `Found ${target} at position ${i}`, 2));
      return frames;
    }
  }
  frames.push(listFrame(nodes, {}, `${target} is not in the list`, 3));
  return frames;
}

export function reverseListFrames(values: number[]): LinkedListFrame[] {
  const remaining = nodesOf(values);
  const reversedPart: ListNodeFrame[] = [];
  const frames = [
    listFrame(remaining, {}, "Reverse by moving one node at a time from the front of the old list to the front of a new one", 0),
  ];
  while (remaining.length) {
    const node = remaining.shift() as ListNodeFrame;
    reversedPart.unshift(node);
    frames.push(
      listFrame(
        reversedPart.concat(remaining),
        mark(node.id, C.move),
        `Detach ${node.value} and push it onto the front of the reversed part`,
        1,
      ),
    );
  }
  frames.push(listFrame(reversedPart, markAll(reversedPart.map((n) => n.id), C.done), "Reversed, in one pass and O(1) extra space", 2));
  return frames;
}

/**
 * Slow and fast pointers. The fast pointer moves two nodes per step, so when it
 * reaches the end the slow one is exactly halfway.
 */
export function middleNodeFrames(values: number[]): LinkedListFrame[] {
  const nodes = nodesOf(values);
  if (!nodes.length) return [listFrame([], {}, "The list is empty", 0)];
  let slow = 0;
  let fast = 0;
  const ptrs = (): ListPointer[] => [
    { nodeId: nodes[slow].id, label: "slow", color: C.cursor },
    { nodeId: nodes[Math.min(fast, nodes.length - 1)].id, label: "fast", color: C.move },
  ];
  const frames = [
    listFrame(nodes, {}, "Find the middle in one pass: slow moves 1, fast moves 2", 0, { pointers: ptrs() }),
  ];
  while (fast + 1 < nodes.length) {
    slow += 1;
    fast += 2;
    frames.push(
      listFrame(
        nodes,
        { [nodes[slow].id]: C.cursor },
        `slow at ${slow}, fast at ${Math.min(fast, nodes.length - 1)}`,
        1,
        { pointers: ptrs() },
      ),
    );
  }
  frames.push(
    listFrame(nodes, mark(nodes[slow].id, C.done), `Fast has run out, so slow is the middle: node ${slow} (${nodes[slow].value})`, 2, {
      pointers: ptrs(),
    }),
  );
  return frames;
}

/**
 * Floyd's cycle detection. `cycleAt` splices the tail back to that index so there
 * genuinely is a loop to find — the renderer draws the back-edge.
 */
export function detectCycleFrames(values: number[], cycleAt: number): LinkedListFrame[] {
  const nodes = nodesOf(values);
  const n = nodes.length;
  if (!n) return [listFrame([], {}, "The list is empty", 0)];
  const target = Math.round(cycleAt);
  const hasCycle = target >= 0 && target < n;
  const cycleTo = hasCycle ? target : null;

  const next = (i: number): number => {
    if (i + 1 < n) return i + 1;
    return hasCycle ? target : -1;
  };

  let slow = 0;
  let fast = 0;
  const ptrs = (s: number, f: number): ListPointer[] => {
    const out: ListPointer[] = [{ nodeId: nodes[s].id, label: "slow", color: C.cursor }];
    if (f >= 0) out.push({ nodeId: nodes[f].id, label: "fast", color: C.move });
    return out;
  };
  const frames = [
    listFrame(
      nodes,
      {},
      hasCycle
        ? `The tail links back to node ${target}, so the list has a cycle. Floyd's algorithm finds it with two pointers and no extra memory.`
        : "The list has no cycle. Floyd's algorithm will simply run off the end.",
      0,
      { cycleTo, pointers: ptrs(0, 0) },
    ),
  ];

  let guard = 0;
  while (guard < 10000) {
    guard += 1;
    const s1 = next(slow);
    const f1 = next(fast);
    const f2 = f1 >= 0 ? next(f1) : -1;
    if (s1 < 0 || f2 < 0) {
      frames.push(
        listFrame(nodes, {}, "A pointer reached the end — there is no cycle", 3, { cycleTo, pointers: ptrs(Math.max(slow, 0), fast) }),
      );
      return frames;
    }
    slow = s1;
    fast = f2;
    frames.push(
      listFrame(nodes, { [nodes[slow].id]: C.cursor, [nodes[fast].id]: C.move }, `slow → node ${slow}, fast → node ${fast}`, 1, {
        cycleTo,
        pointers: ptrs(slow, fast),
      }),
    );
    if (slow === fast) {
      frames.push(
        listFrame(nodes, mark(nodes[slow].id, C.done), `They met at node ${slow}. Two pointers moving at different speeds inside a loop must eventually meet — that is the proof.`, 2, {
          cycleTo,
          pointers: ptrs(slow, fast),
        }),
      );
      return frames;
    }
  }
  return frames;
}

/** Merge two sorted lists by repeatedly taking the smaller head. */
export function mergeSortedListsFrames(values: number[], splitAt: number): LinkedListFrame[] {
  const all = values.slice();
  const cut = Math.max(1, Math.min(Math.round(splitAt) || Math.ceil(all.length / 2), Math.max(1, all.length - 1)));
  const a = all.slice(0, cut).sort((x, y) => x - y);
  const b = all.slice(cut).sort((x, y) => x - y);

  const aNodes: ListNodeFrame[] = a.map((v, i) => ({ id: `a${i}`, value: v }));
  const bNodes: ListNodeFrame[] = b.map((v, i) => ({ id: `b${i}`, value: v }));
  const merged: ListNodeFrame[] = [];
  let i = 0;
  let j = 0;

  const view = (): ListNodeFrame[] => merged.concat(aNodes.slice(i), bNodes.slice(j));
  const colours = (): Record<NodeId, string> => ({
    ...markAll(merged.map((m) => m.id), C.done),
    ...markAll(aNodes.slice(i).map((m) => m.id), C.base),
    ...markAll(bNodes.slice(j).map((m) => m.id), C.cursor),
  });

  const frames = [
    listFrame(view(), colours(), `List A = [${a.join(", ")}], list B = [${b.join(", ")}] — both sorted. Blue is A, cyan is B.`, 0),
  ];

  while (i < aNodes.length && j < bNodes.length) {
    const takeA = Number(aNodes[i].value) <= Number(bNodes[j].value);
    const chosen = takeA ? aNodes[i] : bNodes[j];
    frames.push(
      listFrame(view(), { ...colours(), [chosen.id]: C.inspect }, `Compare ${aNodes[i].value} and ${bNodes[j].value} — take ${chosen.value}`, 1),
    );
    merged.push(chosen);
    if (takeA) i += 1;
    else j += 1;
    frames.push(listFrame(view(), colours(), `Appended ${chosen.value} to the merged list`, 2));
  }
  while (i < aNodes.length) {
    merged.push(aNodes[i]);
    i += 1;
    frames.push(listFrame(view(), colours(), "List B is exhausted — attach the rest of A unchanged", 3));
  }
  while (j < bNodes.length) {
    merged.push(bNodes[j]);
    j += 1;
    frames.push(listFrame(view(), colours(), "List A is exhausted — attach the rest of B unchanged", 3));
  }
  frames.push(
    listFrame(merged, markAll(merged.map((m) => m.id), C.done), "Merged in O(n + m), relinking nodes rather than copying values", 4),
  );
  return frames;
}

/** Remove the nth node from the end using a gap of n between two pointers. */
export function removeNthFromEndFrames(values: number[], n: number): LinkedListFrame[] {
  const nodes = nodesOf(values);
  const len = nodes.length;
  const nth = Math.round(n);
  if (!len) return [listFrame([], {}, "The list is empty", 0)];
  if (nth < 1 || nth > len) {
    return [listFrame(nodes, {}, `n must be between 1 and ${len} — this list has ${len} node(s)`, 0)];
  }

  let lead = 0;
  let trail = 0;
  const ptrs = (): ListPointer[] => [
    { nodeId: nodes[Math.min(trail, len - 1)].id, label: "trail", color: C.cursor },
    { nodeId: nodes[Math.min(lead, len - 1)].id, label: "lead", color: C.move },
  ];
  const frames = [
    listFrame(nodes, {}, `Remove the ${nth}th node from the end, in one pass: open a gap of ${nth} between two pointers`, 0, {
      pointers: ptrs(),
    }),
  ];
  for (let k = 0; k < nth; k += 1) {
    lead += 1;
    frames.push(listFrame(nodes, {}, `Advance lead — the gap is now ${lead}`, 1, { pointers: ptrs() }));
  }
  while (lead < len) {
    lead += 1;
    trail += 1;
    frames.push(
      listFrame(nodes, {}, `Move both. When lead falls off the end, trail is one before the target.`, 2, { pointers: ptrs() }),
    );
  }
  const removeIdx = trail;
  frames.push(listFrame(nodes, mark(nodes[removeIdx].id, C.remove), `Target is node ${removeIdx} (value ${nodes[removeIdx].value})`, 3, { pointers: ptrs() }));
  frames.push(listFrame(nodes.filter((_, k) => k !== removeIdx), {}, "Unlinked — one pass, no length count needed", 4));
  return frames;
}

/** A doubly linked list: every node also points backwards. */
export function doublyListFrames(values: number[]): LinkedListFrame[] {
  const nodes = nodesOf(values);
  if (!nodes.length) return [listFrame([], {}, "The list is empty", 0, { doubly: true })];
  const frames = [
    listFrame(nodes, {}, "A doubly linked list stores prev as well as next — one extra pointer per node", 0, { doubly: true }),
  ];
  for (let i = 0; i < nodes.length; i += 1) {
    frames.push(listFrame(nodes, mark(nodes[i].id, C.inspect), `Forward: node ${i} = ${nodes[i].value}`, 1, { doubly: true }));
  }
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    frames.push(
      listFrame(nodes, mark(nodes[i].id, C.move), `Backward: node ${i} = ${nodes[i].value} — impossible in a singly linked list without another pass`, 2, {
        doubly: true,
      }),
    );
  }
  frames.push(listFrame(nodes, markAll(nodes.map((nd) => nd.id), C.done), "Traversable in both directions, at the cost of one pointer per node", 3, { doubly: true }));
  return frames;
}

/** A circular list: the tail points back at the head. */
export function circularListFrames(values: number[]): LinkedListFrame[] {
  const nodes = nodesOf(values);
  if (!nodes.length) return [listFrame([], {}, "The list is empty", 0, { circular: true })];
  const frames = [
    listFrame(nodes, {}, "In a circular list the tail's next is the head, so there is no null to stop at", 0, {
      circular: true,
      cycleTo: 0,
    }),
  ];
  const laps = 2;
  for (let step = 0; step < nodes.length * laps; step += 1) {
    const i = step % nodes.length;
    frames.push(
      listFrame(nodes, mark(nodes[i].id, C.inspect), `Step ${step + 1}: node ${i} = ${nodes[i].value}${step >= nodes.length ? " (second lap — it never ends on its own)" : ""}`, 1, {
        circular: true,
        cycleTo: 0,
      }),
    );
  }
  frames.push(
    listFrame(nodes, markAll(nodes.map((nd) => nd.id), C.done), "Traversal has to count, or remember the head, to know when to stop", 2, {
      circular: true,
      cycleTo: 0,
    }),
  );
  return frames;
}
