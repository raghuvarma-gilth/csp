/**
 * Hash tables.
 *
 * `index = key mod size` is the whole idea, and everything else in this module is
 * a way of coping with the fact that two keys can land on the same index.
 *
 * Three strategies are shown side by side: separate chaining (hang a list off the
 * bucket), linear probing (walk forward to the next free slot) and quadratic
 * probing (jump 1, 4, 9, … instead, to avoid the clusters linear probing builds).
 */

import { hashFrame } from "../frames";
import { C, type HashBucket, type HashFrame, type LabContext } from "../types";

type Mode = "chaining" | "linear" | "quadratic";

/** `null` is an empty slot; `"tomb"` is a slot a delete emptied. */
type Slot = number | null | "tomb";

interface HashState {
  size: number;
  mode: Mode;
  chains: number[][];
  slots: Slot[];
}

const clampSize = (value: number): number => Math.max(3, Math.min(Math.round(value) || 7, 13));

const freshState = (size: number, mode: Mode): HashState => {
  const n = clampSize(size);
  return {
    size: n,
    mode,
    chains: Array.from({ length: n }, () => []),
    slots: new Array<Slot>(n).fill(null),
  };
};

const hashOf = (key: number, size: number): number => ((key % size) + size) % size;

const rawChainInsert = (s: HashState, key: number): void => {
  const i = hashOf(key, s.size);
  if (!s.chains[i].includes(key)) s.chains[i].push(key);
};

const rawProbeInsert = (s: HashState, key: number): void => {
  const home = hashOf(key, s.size);
  for (let step = 0; step < s.size; step += 1) {
    const offset = s.mode === "quadratic" ? step * step : step;
    const i = (home + offset) % s.size;
    if (s.slots[i] === key) return;
    if (s.slots[i] === null || s.slots[i] === "tomb") {
      s.slots[i] = key;
      return;
    }
  }
};

/**
 * The table is rebuilt whenever the size, the strategy or the seed values change,
 * so switching strategy shows the same keys laid out the other way rather than a
 * stale table.
 */
const hashState = (ctx: LabContext, values: number[], size: number, mode: Mode): HashState => {
  const existing = ctx.hash as (HashState & { seed?: number[] }) | null;
  const n = clampSize(size);
  const sameSeed =
    existing?.seed && existing.seed.length === values.length && existing.seed.every((v, i) => v === values[i]);
  if (existing && existing.size === n && existing.mode === mode && sameSeed) return existing;

  const s = freshState(n, mode) as HashState & { seed?: number[] };
  s.seed = values.slice();
  values.forEach((v) => (mode === "chaining" ? rawChainInsert(s, v) : rawProbeInsert(s, v)));
  ctx.hash = s;
  return s;
};

const SLOT_LABEL: Record<string, string> = { tomb: "⌫" };

const buckets = (
  s: HashState,
  colours?: Record<number, string>,
  entryColours?: Record<string, string>,
): HashBucket[] => {
  if (s.mode === "chaining") {
    return s.chains.map((chain, index) => ({
      index,
      color: colours?.[index],
      entries: chain.map((key) => ({ key, color: entryColours?.[`${index}:${key}`] })),
    }));
  }
  return s.slots.map((slot, index) => ({
    index,
    color: colours?.[index],
    entries:
      slot === null
        ? []
        : [{ key: slot === "tomb" ? SLOT_LABEL.tomb : slot, color: entryColours?.[`${index}:${String(slot)}`] }],
  }));
};

const snap = (
  s: HashState,
  colours: Record<number, string>,
  description: string,
  codeLine: number,
  probe?: number[],
  entryColours?: Record<string, string>,
): HashFrame => hashFrame(buckets(s, colours, entryColours), description, codeLine, probe);

const loadFactor = (s: HashState): string => {
  const used =
    s.mode === "chaining"
      ? s.chains.reduce((sum, c) => sum + c.length, 0)
      : s.slots.filter((x) => x !== null && x !== "tomb").length;
  return `${used}/${s.size} = ${(used / s.size).toFixed(2)}`;
};

/* -------------------------------------------------------------------------- */
/* Separate chaining                                                           */
/* -------------------------------------------------------------------------- */

/** Insert with separate chaining: a collision just makes the list longer. */
export function hashChainInsertFrames(values: number[], key: number, size: number, ctx: LabContext): HashFrame[] {
  const s = hashState(ctx, values, size, "chaining");
  const k = Math.round(key) || 0;
  const i = hashOf(k, s.size);

  const frames: HashFrame[] = [
    snap(s, {}, `Insert ${k}. The bucket is decided by arithmetic, not by searching: ${k} mod ${s.size} = ${i}.`, 0),
  ];
  frames.push(snap(s, { [i]: C.inspect }, `Bucket ${i} currently holds ${s.chains[i].length} key(s)`, 1, [i]));

  if (s.chains[i].includes(k)) {
    frames.push(snap(s, { [i]: C.remove }, `${k} is already in bucket ${i} — a hash *set* stores it once`, 4, [i], { [`${i}:${k}`]: C.remove }));
    return frames;
  }

  const collided = s.chains[i].length > 0;
  s.chains[i].push(k);
  frames.push(
    snap(
      s,
      { [i]: collided ? C.move : C.done },
      collided
        ? `Bucket ${i} was already occupied by ${s.chains[i].slice(0, -1).join(", ")} — that is a collision. With chaining it costs nothing dramatic: ${k} is appended to the list.`
        : `Bucket ${i} was empty — ${k} goes straight in. One arithmetic step, no comparisons.`,
      collided ? 3 : 2,
      [i],
      { [`${i}:${k}`]: C.done },
    ),
  );

  const longest = Math.max(...s.chains.map((c) => c.length));
  frames.push(
    snap(s, {}, `Load factor ${loadFactor(s)}; longest chain ${longest}. Lookups cost O(1 + chain length), so this stays fast only while the chains stay short.`, 5),
  );
  return frames;
}

/** Search a chained table: hash once, then walk one short list. */
export function hashChainSearchFrames(values: number[], key: number, size: number, ctx: LabContext): HashFrame[] {
  const s = hashState(ctx, values, size, "chaining");
  const k = Math.round(key) || 0;
  const i = hashOf(k, s.size);

  const frames: HashFrame[] = [
    snap(s, {}, `Search for ${k}. If it is anywhere, it is in bucket ${k} mod ${s.size} = ${i} — no other bucket needs looking at.`, 0),
  ];
  frames.push(
    snap(s, { [i]: C.inspect }, `Bucket ${i} holds ${s.chains[i].length ? s.chains[i].join(", ") : "nothing"}. ${s.size - 1} other bucket(s) were skipped entirely.`, 1, [i]),
  );

  for (let step = 0; step < s.chains[i].length; step += 1) {
    const candidate = s.chains[i][step];
    if (candidate === k) {
      frames.push(
        snap(s, { [i]: C.done }, `Found ${k} after ${step + 1} comparison(s) in the chain`, 2, [i], { [`${i}:${k}`]: C.done }),
      );
      return frames;
    }
    frames.push(
      snap(s, { [i]: C.inspect }, `${candidate} ≠ ${k} — keep walking the chain`, 3, [i], { [`${i}:${candidate}`]: C.faded }),
    );
  }

  frames.push(
    snap(s, { [i]: C.remove }, `The chain ran out, so ${k} is not in the table. Note what that proves: the key cannot be in any other bucket, because the hash would have sent it here.`, 4, [i]),
  );
  return frames;
}

/* -------------------------------------------------------------------------- */
/* Open addressing                                                             */
/* -------------------------------------------------------------------------- */

const probeInsert = (s: HashState, k: number, label: string): HashFrame[] => {
  const home = hashOf(k, s.size);
  const trail: number[] = [];
  const frames: HashFrame[] = [
    snap(s, {}, `Insert ${k} with ${label}. Everything lives in the array itself — there are no lists. Home slot: ${k} mod ${s.size} = ${home}.`, 0),
  ];

  for (let step = 0; step < s.size; step += 1) {
    const offset = s.mode === "quadratic" ? step * step : step;
    const i = (home + offset) % s.size;
    trail.push(i);
    const occupant = s.slots[i];

    if (occupant === k) {
      frames.push(snap(s, { [i]: C.remove }, `${k} is already stored at slot ${i}`, 4, trail.slice()));
      return frames;
    }
    if (occupant === null || occupant === "tomb") {
      s.slots[i] = k;
      frames.push(
        snap(
          s,
          { [i]: C.done },
          step === 0
            ? `Slot ${home} was free — ${k} goes straight in, no probing needed`
            : `Slot ${i} is ${occupant === "tomb" ? "a tombstone, which is reusable" : "free"} — ${k} lands here after ${step} probe(s)`,
          step === 0 ? 1 : 3,
          trail.slice(),
        ),
      );
      const used = s.slots.filter((x) => x !== null && x !== "tomb").length;
      frames.push(
        snap(s, {}, `Load factor ${loadFactor(s)}. Open addressing degrades sharply as that approaches 1 — with ${s.size - used} slot(s) left, a probe can end up walking most of the table.`, 5),
      );
      return frames;
    }

    frames.push(
      snap(
        s,
        { [i]: C.remove },
        step === 0
          ? `Slot ${home} is taken by ${occupant} — a collision. With open addressing there is nowhere to hang a list, so probe onwards.`
          : `Slot ${i} is taken by ${occupant} too — ${s.mode === "quadratic" ? `next offset is ${(step + 1) ** 2}` : "step forward one more"}`,
        2,
        trail.slice(),
      ),
    );
  }

  frames.push(
    snap(s, {}, `Probed all ${s.size} slot(s) without finding room — ${k} cannot be stored. A real table would have resized and rehashed long before this point.`, 6, trail),
  );
  return frames;
};

/** Linear probing — simple, and it builds clusters. */
export function hashLinearInsertFrames(values: number[], key: number, size: number, ctx: LabContext): HashFrame[] {
  const s = hashState(ctx, values, size, "linear");
  return probeInsert(s, Math.round(key) || 0, "linear probing (i, i+1, i+2, …)");
}

/** Quadratic probing — the jumps get longer, so clusters do not form the same way. */
export function hashQuadraticInsertFrames(values: number[], key: number, size: number, ctx: LabContext): HashFrame[] {
  const s = hashState(ctx, values, size, "quadratic");
  return probeInsert(s, Math.round(key) || 0, "quadratic probing (i, i+1, i+4, i+9, …)");
}

/**
 * Delete from an open-addressed table — and the trap that makes this worth its
 * own operation. Emptying the slot outright would break every key that probed
 * *past* it, so the slot is marked with a tombstone instead.
 */
export function hashDeleteFrames(values: number[], key: number, size: number, ctx: LabContext): HashFrame[] {
  const s = hashState(ctx, values, size, "linear");
  const k = Math.round(key) || 0;
  const home = hashOf(k, s.size);
  const trail: number[] = [];

  const frames: HashFrame[] = [
    snap(s, {}, `Delete ${k}. Find it first, by walking the same probe sequence an insert would have used from slot ${home}.`, 0),
  ];

  for (let step = 0; step < s.size; step += 1) {
    const i = (home + step) % s.size;
    trail.push(i);
    const occupant = s.slots[i];

    if (occupant === null) {
      frames.push(
        snap(s, { [i]: C.remove }, `Slot ${i} is empty, so the probe sequence stops here — ${k} is not in the table. An empty slot ends a search; a tombstone does not.`, 4, trail.slice()),
      );
      return frames;
    }
    if (occupant === k) {
      const laterKeysExist = s.slots.some((slot, j) => typeof slot === "number" && j !== i && hashOf(slot, s.size) !== j);
      s.slots[i] = "tomb";
      frames.push(
        snap(s, { [i]: C.move }, `Found ${k} at slot ${i}. Mark it with a tombstone rather than emptying it.`, 2, trail.slice()),
      );
      frames.push(
        snap(
          s,
          {},
          laterKeysExist
            ? `Why not just empty it? Because other keys in this table probed *past* slot ${i} to reach their own slot. An empty slot would end their search early and lose them. The tombstone keeps searches going while still being reusable by an insert.`
            : `Nothing in this table probed past slot ${i}, so emptying it would have been safe here — but the algorithm cannot know that cheaply, so it tombstones every time.`,
          3,
          trail.slice(),
        ),
      );
      const tombs = s.slots.filter((x) => x === "tomb").length;
      frames.push(
        snap(s, {}, `Load factor ${loadFactor(s)}, plus ${tombs} tombstone(s). Tombstones still cost probe time, which is why tables that delete a lot have to be rebuilt periodically.`, 5),
      );
      return frames;
    }

    frames.push(
      snap(s, { [i]: C.inspect }, occupant === "tomb" ? `Slot ${i} is a tombstone — keep going, it does not end the search` : `Slot ${i} holds ${occupant}, not ${k} — probe on`, 1, trail.slice()),
    );
  }

  frames.push(snap(s, {}, `Walked all ${s.size} slot(s) — ${k} is not in the table`, 4, trail));
  return frames;
}
