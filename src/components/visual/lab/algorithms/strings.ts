/**
 * String algorithms.
 *
 * The naive substring search restarts from scratch on every mismatch. KMP and
 * Rabin–Karp are two different escapes from that, and they are worth seeing side
 * by side: KMP never re-reads a character because it precomputed what the pattern
 * knows about itself, while Rabin–Karp turns each window into a number so the
 * comparison is one arithmetic test instead of m of them.
 */

import { pointer, snapshot } from "../frames";
import { C, type ArrayFrame, type Hex } from "../types";

/** Text fields are for exploring — take what was typed, minus the outer spaces. */
export const parseText = (raw: string): string => String(raw ?? "").trim();

const chars = (s: string): string[] => s.split("");

const positionLabels = (n: number): Record<number, string> =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [i, String(i)]));

/** The pattern laid over the text at `offset`, so the alignment is visible. */
const alignedPattern = (textLength: number, pattern: string, offset: number, highlights?: Record<number, Hex>) => ({
  label: `pattern "${pattern}" aligned at ${offset}`,
  values: Array.from({ length: textLength }, (_, i) =>
    i >= offset && i < offset + pattern.length ? pattern[i - offset] : "",
  ) as Array<string | number>,
  highlights,
});

/* -------------------------------------------------------------------------- */
/* Knuth–Morris–Pratt                                                          */
/* -------------------------------------------------------------------------- */

const buildLps = (pattern: string): number[] => {
  const m = pattern.length;
  const lps = new Array<number>(m).fill(0);
  let len = 0;
  let i = 1;
  let guard = 0;
  while (i < m && guard < 10000) {
    guard += 1;
    if (pattern[i] === pattern[len]) {
      len += 1;
      lps[i] = len;
      i += 1;
    } else if (len > 0) {
      len = lps[len - 1];
    } else {
      lps[i] = 0;
      i += 1;
    }
  }
  return lps;
};

/**
 * KMP in two phases. The first phase is the one students skip and the one that
 * matters: `lps[i]` is the length of the longest proper prefix of the pattern
 * that is also a suffix of `pattern[0..i]`. That number is exactly how far the
 * pattern can slide without losing a possible match.
 */
export function kmpFrames(text: string, pattern: string): ArrayFrame[] {
  const t = parseText(text);
  const p = parseText(pattern);
  if (!p.length || !t.length) {
    return [snapshot(chars(t), {}, [], "Type both a text and a pattern to search for", 0)];
  }
  if (p.length > t.length) {
    return [
      snapshot(chars(t), {}, [], `The pattern is ${p.length} character(s) and the text is only ${t.length} — it cannot fit, so there is nothing to search.`, 0),
    ];
  }

  const m = p.length;
  const n = t.length;
  const frames: ArrayFrame[] = [];
  const lps = new Array<number>(m).fill(0);

  const lpsSnap = (highlights: Record<number, Hex>, description: string, codeLine: number): ArrayFrame =>
    snapshot(chars(p), highlights, [], description, codeLine, null, "horizontal", {
      labels: positionLabels(m),
      secondary: { label: "lps — longest prefix that is also a suffix", values: lps.slice(), labels: positionLabels(m) },
    });

  frames.push(lpsSnap({}, `Phase 1: build the lps table for "${p}". Nothing about the text is used yet — this is the pattern studying itself.`, 0));
  frames.push(lpsSnap({ 0: C.done }, "lps[0] is always 0: a single character has no *proper* prefix.", 1));

  let len = 0;
  let i = 1;
  let guard = 0;
  while (i < m && guard < 10000) {
    guard += 1;
    if (p[i] === p[len]) {
      len += 1;
      lps[i] = len;
      frames.push(
        lpsSnap({ [i]: C.done, [len - 1]: C.cursor }, `'${p[i]}' matches '${p[len - 1]}' at position ${len - 1}, so the prefix "${p.slice(0, len)}" is also a suffix here — lps[${i}] = ${len}`, 2),
      );
      i += 1;
    } else if (len > 0) {
      frames.push(
        lpsSnap({ [i]: C.remove, [len]: C.inspect }, `'${p[i]}' ≠ '${p[len]}' — fall back to lps[${len - 1}] = ${lps[len - 1]} rather than starting over`, 3),
      );
      len = lps[len - 1];
    } else {
      lps[i] = 0;
      frames.push(lpsSnap({ [i]: C.faded }, `'${p[i]}' does not extend any prefix — lps[${i}] = 0`, 4));
      i += 1;
    }
  }
  frames.push(lpsSnap({}, `Table built in O(m). Read it as: "if I fail at position i, I already know ${lps.filter((x) => x > 0).length} of these positions let me keep part of the match."`, 5));

  /* Phase 2 */
  const textLabels = positionLabels(n);
  const scanSnap = (
    offset: number,
    highlights: Record<number, Hex>,
    patternHighlights: Record<number, Hex>,
    description: string,
    codeLine: number,
    pointers: ReturnType<typeof pointer>[] = [],
  ): ArrayFrame =>
    snapshot(chars(t), highlights, pointers, description, codeLine, null, "horizontal", {
      labels: textLabels,
      secondary: alignedPattern(n, p, offset, patternHighlights),
    });

  const matches: number[] = [];
  const settled: Record<number, Hex> = {};
  let ti = 0;
  let pj = 0;
  let comparisons = 0;
  let rewinds = 0;
  guard = 0;

  frames.push(scanSnap(0, {}, {}, `Phase 2: scan the text. The text pointer only ever moves forward — that is the whole payoff.`, 6));

  while (ti < n && guard < 20000) {
    guard += 1;
    const offset = ti - pj;
    comparisons += 1;
    if (t[ti] === p[pj]) {
      frames.push(
        scanSnap(offset, { ...settled, [ti]: C.inspect }, { [ti]: C.done }, `'${t[ti]}' = '${p[pj]}' — ${pj + 1} of ${m} character(s) matched`, 7, [pointer(ti, "i", C.cursor)]),
      );
      ti += 1;
      pj += 1;
      if (pj === m) {
        const at = ti - m;
        matches.push(at);
        for (let k = at; k < at + m; k += 1) settled[k] = C.done;
        frames.push(
          scanSnap(at, settled, {}, `Match at index ${at}. Now slide by lps[${m - 1}] = ${lps[m - 1]} instead of restarting — overlapping matches are not missed.`, 8),
        );
        pj = lps[m - 1];
        rewinds += 1;
      }
    } else if (pj > 0) {
      frames.push(
        scanSnap(offset, { ...settled, [ti]: C.remove }, { [ti]: C.remove }, `'${t[ti]}' ≠ '${p[pj]}'. The naive search would send i back to ${offset + 1}; KMP keeps i at ${ti} and sets j to lps[${pj - 1}] = ${lps[pj - 1]}, because those ${lps[pj - 1]} character(s) are known to match already.`, 9, [pointer(ti, "i", C.cursor)]),
      );
      pj = lps[pj - 1];
      rewinds += 1;
    } else {
      frames.push(
        scanSnap(offset, { ...settled, [ti]: C.faded }, { [ti]: C.remove }, `'${t[ti]}' ≠ '${p[0]}' with nothing matched yet — step the text forward one`, 10, [pointer(ti, "i", C.cursor)]),
      );
      ti += 1;
    }
  }

  frames.push(
    snapshot(chars(t), settled, [], matches.length
      ? `${matches.length} match(es) at index ${matches.join(", ")}. ${comparisons} comparison(s) and ${rewinds} pattern rewind(s) for a ${n}-character text — and the text pointer never moved backwards once, which is why KMP is O(n + m).`
      : `"${p}" does not occur in "${t}". ${comparisons} comparison(s), and the text was read exactly once.`, 11, null, "horizontal", { labels: textLabels }),
  );
  return frames;
}

/* -------------------------------------------------------------------------- */
/* Rabin–Karp                                                                  */
/* -------------------------------------------------------------------------- */

const BASE = 256;
/** Deliberately tiny, so collisions actually happen and the verify step earns its place. */
const MOD = 101;

/**
 * Rabin–Karp. Each window becomes a number, and the next window's number is
 * derived from the current one in O(1). The modulus here is small on purpose:
 * collisions occur, and the frames show why a hash match still has to be checked
 * character by character.
 */
export function rabinKarpFrames(text: string, pattern: string): ArrayFrame[] {
  const t = parseText(text);
  const p = parseText(pattern);
  if (!p.length || !t.length) {
    return [snapshot(chars(t), {}, [], "Type both a text and a pattern", 0)];
  }
  if (p.length > t.length) {
    return [snapshot(chars(t), {}, [], `The pattern is longer than the text — no window to hash.`, 0)];
  }

  const n = t.length;
  const m = p.length;
  const labels = positionLabels(n);
  const norm = (x: number): number => ((x % MOD) + MOD) % MOD;

  let power = 1;
  for (let k = 0; k < m - 1; k += 1) power = norm(power * BASE);

  let patternHash = 0;
  let windowHash = 0;
  for (let k = 0; k < m; k += 1) {
    patternHash = norm(patternHash * BASE + p.charCodeAt(k));
    windowHash = norm(windowHash * BASE + t.charCodeAt(k));
  }

  const snap = (
    offset: number,
    highlights: Record<number, Hex>,
    description: string,
    codeLine: number,
  ): ArrayFrame =>
    snapshot(chars(t), highlights, [], description, codeLine, [offset, offset + m - 1], "horizontal", {
      labels,
      secondary: alignedPattern(n, p, offset),
    });

  const frames: ArrayFrame[] = [
    snap(0, {}, `Hash "${p}" once: ${patternHash} (base ${BASE}, mod ${MOD}). Now every ${m}-character window of the text gets a number too, and numbers compare in one step.`, 0),
  ];

  const settled: Record<number, Hex> = {};
  const matches: number[] = [];
  let collisions = 0;
  let verifications = 0;

  for (let start = 0; start + m <= n; start += 1) {
    if (start > 0) {
      const outgoing = t.charCodeAt(start - 1);
      const incoming = t.charCodeAt(start + m - 1);
      windowHash = norm(norm(windowHash - norm(outgoing * power)) * BASE + incoming);
      frames.push(
        snap(start, { ...settled, [start - 1]: C.faded, [start + m - 1]: C.inspect }, `Roll the window: drop '${t[start - 1]}', add '${t[start + m - 1]}'. The new hash ${windowHash} came from the old one in O(1) — no re-reading of the ${m - 1} characters in the middle.`, 1),
      );
    }

    if (windowHash !== patternHash) {
      frames.push(
        snap(start, { ...settled, ...Object.fromEntries(Array.from({ length: m }, (_, k) => [start + k, C.faded])) }, `Window "${t.slice(start, start + m)}" hashes to ${windowHash} ≠ ${patternHash} — different numbers mean different strings, guaranteed. Skip without comparing a single character.`, 2),
      );
      continue;
    }

    verifications += 1;
    const actual = t.slice(start, start + m);
    const same = actual === p;
    frames.push(
      snap(start, { ...settled, ...Object.fromEntries(Array.from({ length: m }, (_, k) => [start + k, C.inspect])) }, `Hashes agree (${windowHash}). Equal numbers do *not* prove equal strings, so check "${actual}" against "${p}" character by character.`, 3),
    );

    if (same) {
      matches.push(start);
      for (let k = 0; k < m; k += 1) settled[start + k] = C.done;
      frames.push(snap(start, settled, `Confirmed match at index ${start}`, 4));
    } else {
      collisions += 1;
      frames.push(
        snap(start, { ...settled, ...Object.fromEntries(Array.from({ length: m }, (_, k) => [start + k, C.remove])) }, `A collision: "${actual}" ≠ "${p}" but both hash to ${windowHash}. This is why the verification step is not optional — with mod ${MOD} there are only ${MOD} possible hashes, so clashes are common.`, 5),
      );
    }
  }

  frames.push(
    snapshot(chars(t), settled, [], matches.length
      ? `${matches.length} match(es) at index ${matches.join(", ")}. ${verifications} window(s) needed a character check, of which ${collisions} turned out to be collisions. A larger modulus makes collisions rarer but never impossible.`
      : `"${p}" does not occur in "${t}". ${verifications} window(s) hashed equal and all ${collisions} were collisions.`, 6, null, "horizontal", { labels }),
  );
  return frames;
}

/* -------------------------------------------------------------------------- */
/* Simple two-pointer string work                                              */
/* -------------------------------------------------------------------------- */

/** Palindrome check — the cheapest possible use of two converging pointers. */
export function palindromeFrames(text: string): ArrayFrame[] {
  const raw = parseText(text);
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleaned.length) return [snapshot([], {}, [], "Type something to check", 0)];

  const s = chars(cleaned);
  const labels = positionLabels(s.length);
  const snap = (h: Record<number, Hex>, ptrs: ReturnType<typeof pointer>[], d: string, line: number): ArrayFrame =>
    snapshot(s, h, ptrs, d, line, null, "horizontal", { labels });

  const frames: ArrayFrame[] = [
    snap({}, [], raw === cleaned
      ? `Check whether "${cleaned}" reads the same backwards. One pointer at each end, walking inwards.`
      : `"${raw}" reduces to "${cleaned}" — punctuation, spaces and case are dropped first, which is what "palindrome" usually means in practice.`, 0),
  ];

  let left = 0;
  let right = s.length - 1;
  const settled: Record<number, Hex> = {};

  while (left < right) {
    const ptrs = [pointer(left, "left", C.cursor), pointer(right, "right", C.window)];
    if (s[left] !== s[right]) {
      frames.push(snap({ ...settled, [left]: C.remove, [right]: C.remove }, ptrs, `'${s[left]}' ≠ '${s[right]}' — not a palindrome. One mismatch is enough; the remaining ${right - left - 1} character(s) need not be looked at.`, 3));
      return frames;
    }
    settled[left] = C.done;
    settled[right] = C.done;
    frames.push(snap({ ...settled, [left]: C.inspect, [right]: C.inspect }, ptrs, `'${s[left]}' = '${s[right]}' — move both inwards`, 1));
    left += 1;
    right -= 1;
  }

  frames.push(
    snap(settled, [], `The pointers met, so "${cleaned}" is a palindrome. ${Math.floor(s.length / 2)} comparison(s) for ${s.length} character(s) — half the work of building the reversed string and comparing.`, 2),
  );
  return frames;
}

/**
 * Anagram check by letter counts. Counting up for one string and down for the
 * other means a single table does the whole job, and a count going negative ends
 * it early.
 */
export function anagramFrames(first: string, second: string): ArrayFrame[] {
  const a = parseText(first).toLowerCase().replace(/[^a-z0-9]/g, "");
  const b = parseText(second).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!a.length || !b.length) return [snapshot([], {}, [], "Type two words to compare", 0)];

  const alphabet = Array.from(new Set([...a, ...b])).sort();
  const slot: Record<string, number> = Object.fromEntries(alphabet.map((ch, i) => [ch, i]));
  const counts = new Array<number>(alphabet.length).fill(0);
  const labels = Object.fromEntries(alphabet.map((ch, i) => [i, ch]));

  const snap = (h: Record<number, Hex>, d: string, line: number): ArrayFrame =>
    snapshot(counts.slice(), h, [], d, line, null, "horizontal", { labels });

  const frames: ArrayFrame[] = [
    snap({}, `One counter per distinct letter across both words (${alphabet.length} of them). Count "${a}" up, then count "${b}" down. If they are anagrams, everything ends at zero.`, 0),
  ];

  if (a.length !== b.length) {
    frames.push(
      snap({}, `"${a}" has ${a.length} character(s) and "${b}" has ${b.length} — different lengths cannot be anagrams, so this is already answered without counting anything.`, 4),
    );
    return frames;
  }

  for (const ch of a) {
    counts[slot[ch]] += 1;
    frames.push(snap({ [slot[ch]]: C.done }, `'${ch}' from "${a}" → count is ${counts[slot[ch]]}`, 1));
  }

  for (const ch of b) {
    counts[slot[ch]] -= 1;
    const i = slot[ch];
    if (counts[i] < 0) {
      frames.push(snap({ [i]: C.remove }, `'${ch}' from "${b}" drives its count to ${counts[i]}. Negative means "${b}" uses a '${ch}' that "${a}" does not have — not anagrams, and no need to look at the rest.`, 3));
      return frames;
    }
    frames.push(snap({ [i]: counts[i] === 0 ? C.done : C.inspect }, `'${ch}' from "${b}" → count is ${counts[i]}`, 2));
  }

  const leftover = counts.filter((c) => c !== 0).length;
  frames.push(
    snap(Object.fromEntries(counts.map((c, i) => [i, c === 0 ? C.done : C.remove])), leftover
      ? `${leftover} counter(s) did not reach zero — not anagrams.`
      : `Every counter is zero, so "${a}" and "${b}" are anagrams. O(n) with one pass each — sorting both strings would also work but costs O(n log n).`, 4),
  );
  return frames;
}

/** Reverse in place — the same two pointers, swapping rather than comparing. */
export function reverseStringFrames(text: string): ArrayFrame[] {
  const s = chars(parseText(text));
  if (!s.length) return [snapshot([], {}, [], "Type something to reverse", 0)];

  const labels = positionLabels(s.length);
  const snap = (h: Record<number, Hex>, ptrs: ReturnType<typeof pointer>[], d: string, line: number): ArrayFrame =>
    snapshot(s.slice(), h, ptrs, d, line, null, "horizontal", { labels });

  const frames: ArrayFrame[] = [snap({}, [], `Reverse "${s.join("")}" in place — swap the ends, then work inwards.`, 0)];
  let left = 0;
  let right = s.length - 1;
  const settled: Record<number, Hex> = {};
  let swaps = 0;

  while (left < right) {
    const ptrs = [pointer(left, "left", C.cursor), pointer(right, "right", C.window)];
    frames.push(snap({ ...settled, [left]: C.inspect, [right]: C.inspect }, ptrs, `Swap '${s[left]}' and '${s[right]}'`, 1));
    const tmp = s[left];
    s[left] = s[right];
    s[right] = tmp;
    swaps += 1;
    settled[left] = C.done;
    settled[right] = C.done;
    frames.push(snap(settled, ptrs, `Now "${s.join("")}"`, 2));
    left += 1;
    right -= 1;
  }

  if (left === right) {
    settled[left] = C.done;
    frames.push(snap(settled, [], `'${s[left]}' is the middle character of an odd-length string — it stays put`, 3));
  }

  frames.push(
    snap(settled, [], `"${s.join("")}". ${swaps} swap(s) for ${s.length} character(s), and no second array was allocated — O(1) extra space.`, 4),
  );
  return frames;
}
