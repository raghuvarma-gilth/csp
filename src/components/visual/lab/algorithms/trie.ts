/**
 * Trie (prefix tree).
 *
 * Every edge is one character, so a path from the root spells a prefix. The thing
 * to watch is that shared prefixes are stored exactly once — "car", "card" and
 * "care" occupy seven nodes between them, not eleven characters.
 *
 * Nodes are marked with ★ when a word ends there. That mark is the whole reason
 * `search` and `startsWith` are different operations.
 */

import { layoutNaryTree, mark, treeFrame, type NaryTreeNode } from "../frames";
import { C, type Hex, type LabContext, type NodeId, type TreeFrame } from "../types";

interface TrieNode {
  id: number;
  char: string;
  children: Map<string, TrieNode>;
  terminal: boolean;
}

interface TrieState {
  root: TrieNode;
  nextId: number;
}

const makeNode = (s: TrieState, char: string): TrieNode => {
  const node: TrieNode = { id: s.nextId, char, children: new Map(), terminal: false };
  s.nextId += 1;
  return node;
};

const state = (ctx: LabContext): TrieState => {
  if (!ctx.trie) {
    const s: TrieState = { root: { id: 0, char: "·", children: new Map(), terminal: false }, nextId: 1 };
    ctx.trie = s;
  }
  return ctx.trie as TrieState;
};

/** Words come from a text field, so accept any separator a student might type. */
export const parseWords = (raw: string): string[] =>
  raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter(Boolean);

const rawInsert = (s: TrieState, word: string): void => {
  let node = s.root;
  for (const ch of word) {
    let next = node.children.get(ch);
    if (!next) {
      next = makeNode(s, ch);
      node.children.set(ch, next);
    }
    node = next;
  }
  node.terminal = true;
};

const ensureTrie = (ctx: LabContext, words: string[]): TrieState => {
  const s = state(ctx);
  if (!s.root.children.size && words.length) words.forEach((w) => rawInsert(s, w));
  return s;
};

interface Decoration {
  ghosts?: ReadonlySet<NodeId>;
  subLabels?: Record<NodeId, string>;
}

const sortedChildren = (node: TrieNode): TrieNode[] =>
  Array.from(node.children.values()).sort((a, b) => a.char.localeCompare(b.char));

const decorate = (node: TrieNode, d?: Decoration): NaryTreeNode => ({
  id: node.id,
  value: node.char,
  children: sortedChildren(node).map((c) => decorate(c, d)),
  badge: node.terminal ? "★" : undefined,
  subLabel: d?.subLabels?.[node.id],
  ghost: d?.ghosts?.has(node.id),
});

const snap = (
  s: TrieState,
  highlights: Record<NodeId, Hex>,
  description: string,
  codeLine: number,
  d?: Decoration,
): TreeFrame => treeFrame(layoutNaryTree(decorate(s.root, d)), highlights, description, codeLine);

const wordsIn = (node: TrieNode, prefix = "", out: string[] = []): string[] => {
  const here = prefix + (node.char === "·" ? "" : node.char);
  if (node.terminal) out.push(here);
  sortedChildren(node).forEach((c) => wordsIn(c, here, out));
  return out;
};

const countNodes = (node: TrieNode): number =>
  1 + sortedChildren(node).reduce((sum, c) => sum + countNodes(c), 0);

const subtreeIds = (node: TrieNode, out: NodeId[] = []): NodeId[] => {
  out.push(node.id);
  sortedChildren(node).forEach((c) => subtreeIds(c, out));
  return out;
};

/** Everything already walked past, dimmed, so the current node stands out. */
const markPath = (ids: readonly NodeId[]): Record<NodeId, Hex> =>
  Object.fromEntries(ids.map((id) => [id, C.faded]));

/* -------------------------------------------------------------------------- */
/* Operations                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Insert. If the seed list is already in the trie, the new word usually shares a
 * prefix with it — and the frames make clear that the shared part costs nothing.
 */
export function trieInsertFrames(seed: string, word: string, ctx: LabContext): TreeFrame[] {
  const s = ensureTrie(ctx, parseWords(seed));
  const target = parseWords(word)[0] ?? "";
  if (!target) {
    return [snap(s, {}, "Type a word to insert. Letters and digits only.", 0)];
  }

  const frames: TreeFrame[] = [snap(s, {}, `Insert "${target}" one character at a time, starting at the root`, 0)];
  let node = s.root;
  const path: NodeId[] = [s.root.id];
  let reused = 0;
  let created = 0;

  for (let i = 0; i < target.length; i += 1) {
    const ch = target[i];
    const existing = node.children.get(ch);
    if (existing) {
      reused += 1;
      node = existing;
      path.push(node.id);
      frames.push(
        snap(s, { ...markPath(path.slice(0, -1)), [node.id]: C.done }, `'${ch}' already hangs off this node — follow it. "${target.slice(0, i + 1)}" was already stored as part of another word.`, 1),
      );
    } else {
      const fresh = makeNode(s, ch);
      node.children.set(ch, fresh);
      created += 1;
      node = fresh;
      path.push(node.id);
      frames.push(
        snap(s, { ...markPath(path.slice(0, -1)), [node.id]: C.move }, `No '${ch}' here — create a node. The trie now spells "${target.slice(0, i + 1)}".`, 2),
      );
    }
  }

  const wasTerminal = node.terminal;
  node.terminal = true;
  frames.push(
    snap(s, { [node.id]: C.done }, wasTerminal
      ? `"${target}" was already in the trie — the ★ was already there, so nothing changed.`
      : `Mark the last node ★ to say a word ends here. Without that mark, "${target}" would only be a prefix.`, 3),
  );
  frames.push(
    snap(s, {}, `Reused ${reused} existing node(s) and created ${created}. The trie now holds ${wordsIn(s.root).length} word(s) in ${countNodes(s.root) - 1} node(s) — shared prefixes are stored once.`, 4),
  );
  return frames;
}

/** Search: walking the word is not enough — the last node must carry the ★. */
export function trieSearchFrames(seed: string, word: string, ctx: LabContext): TreeFrame[] {
  const s = ensureTrie(ctx, parseWords(seed));
  const target = parseWords(word)[0] ?? "";
  if (!target) return [snap(s, {}, "Type a word to search for", 0)];

  const frames: TreeFrame[] = [snap(s, {}, `Search for "${target}". Follow one edge per character.`, 0)];
  let node = s.root;
  const path: NodeId[] = [s.root.id];

  for (let i = 0; i < target.length; i += 1) {
    const ch = target[i];
    const next = node.children.get(ch);
    if (!next) {
      frames.push(
        snap(s, { ...markPath(path.slice(0, -1)), [node.id]: C.remove }, `No edge labelled '${ch}' — "${target}" is not in the trie, and neither is any word starting with "${target.slice(0, i + 1)}". ${i + 1} character(s) was all it took to know.`, 3),
      );
      return frames;
    }
    node = next;
    path.push(node.id);
    frames.push(
      snap(s, { ...markPath(path.slice(0, -1)), [node.id]: C.inspect }, `'${ch}' → now at "${target.slice(0, i + 1)}"`, 1),
    );
  }

  frames.push(
    node.terminal
      ? snap(s, { ...markPath(path.slice(0, -1)), [node.id]: C.done }, `The node carries ★, so "${target}" is a stored word. ${target.length} step(s) — the cost depends on the word's length, not on how many words the trie holds.`, 2)
      : snap(s, { ...markPath(path.slice(0, -1)), [node.id]: C.remove }, `The path exists but the node has no ★, so "${target}" is only a *prefix* of ${wordsIn(node, target.slice(0, -1)).length} stored word(s) — not a word itself. This is exactly the difference between search and startsWith.`, 4),
  );
  return frames;
}

/** startsWith — the operation a trie exists for. */
export function triePrefixFrames(seed: string, prefix: string, ctx: LabContext): TreeFrame[] {
  const s = ensureTrie(ctx, parseWords(seed));
  const target = parseWords(prefix)[0] ?? "";
  if (!target) return [snap(s, {}, "Type a prefix to look up", 0)];

  const frames: TreeFrame[] = [
    snap(s, {}, `Find every word starting with "${target}". A hash table cannot do this at all — it would have to check every key.`, 0),
  ];
  let node = s.root;
  const path: NodeId[] = [s.root.id];

  for (let i = 0; i < target.length; i += 1) {
    const ch = target[i];
    const next = node.children.get(ch);
    if (!next) {
      frames.push(
        snap(s, { ...markPath(path.slice(0, -1)), [node.id]: C.remove }, `No '${ch}' edge — nothing in the trie starts with "${target}"`, 2),
      );
      return frames;
    }
    node = next;
    path.push(node.id);
    frames.push(snap(s, { ...markPath(path.slice(0, -1)), [node.id]: C.inspect }, `'${ch}' → "${target.slice(0, i + 1)}"`, 1));
  }

  const matches = wordsIn(node, target.slice(0, -1));
  const ids = subtreeIds(node);
  frames.push(
    snap(s, Object.fromEntries(ids.map((id) => [id, C.done])), `Everything below this node shares the prefix. ${matches.length} match(es): ${matches.join(", ") || "none — the prefix exists but no word ends below it"}. Walking ${target.length} edges found them all.`, 3),
  );
  return frames;
}

/**
 * Delete. The subtle part: you cannot simply cut the branch. A node is only safe
 * to remove when it has no children *and* no ★ of its own.
 */
export function trieDeleteFrames(seed: string, word: string, ctx: LabContext): TreeFrame[] {
  const s = ensureTrie(ctx, parseWords(seed));
  const target = parseWords(word)[0] ?? "";
  if (!target) return [snap(s, {}, "Type a word to delete", 0)];

  const frames: TreeFrame[] = [snap(s, {}, `Delete "${target}"`, 0)];
  const chain: TrieNode[] = [s.root];
  let node = s.root;

  for (const ch of target) {
    const next = node.children.get(ch);
    if (!next) {
      frames.push(snap(s, mark(node.id, C.remove), `No '${ch}' edge — "${target}" is not in the trie, so there is nothing to delete`, 4));
      return frames;
    }
    node = next;
    chain.push(node);
    frames.push(snap(s, mark(node.id, C.inspect), `Follow '${ch}'`, 1));
  }

  if (!node.terminal) {
    frames.push(
      snap(s, mark(node.id, C.remove), `The path exists, but this node has no ★ — "${target}" is a prefix of other words, not a stored word. Nothing is deleted.`, 4),
    );
    return frames;
  }

  node.terminal = false;
  frames.push(snap(s, mark(node.id, C.move), `Remove the ★. "${target}" is no longer a word — but its nodes may still be holding up other words.`, 2));

  let removed = 0;
  for (let i = chain.length - 1; i > 0; i -= 1) {
    const current = chain[i];
    const parent = chain[i - 1];
    if (current.children.size > 0) {
      frames.push(
        snap(s, mark(current.id, C.done), `'${current.char}' still has ${current.children.size} child(ren), so other words run through it — stop here. Removed ${removed} node(s).`, 3),
      );
      break;
    }
    if (current.terminal) {
      frames.push(
        snap(s, mark(current.id, C.done), `'${current.char}' carries its own ★ — a shorter word ends here, so it stays. Removed ${removed} node(s).`, 3),
      );
      break;
    }
    parent.children.delete(current.char);
    removed += 1;
    frames.push(snap(s, mark(parent.id, C.inspect), `'${current.char}' has no children and no ★ — safe to remove. Now check its parent.`, 3),);
  }

  frames.push(
    snap(s, {}, `Done. ${wordsIn(s.root).length} word(s) left in ${countNodes(s.root) - 1} node(s): ${wordsIn(s.root).join(", ") || "none"}.`, 5),
  );
  return frames;
}
