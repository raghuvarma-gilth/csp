import {
  ArrowDownUp,
  ArrowRightLeft,
  Binary,
  Braces,
  GitFork,
  Hash,
  Layers,
  Link2,
  type LucideIcon,
  Network,
  Repeat,
  Rows3,
  Search,
  Shapes,
  Sigma,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cover art and an icon for a module, derived from its slug.
 *
 * Nothing here is stored in the database, and that is the point. A module is a
 * row a faculty member can create at any time; if its artwork had to be
 * uploaded or configured, every new module would arrive looking broken until
 * somebody remembered to give it a picture. Deriving the art from the slug
 * means a module called `binary-search-trees` gets a tree icon and its own
 * pattern the moment it is published, with no extra column, no upload, and no
 * placeholder grey box.
 *
 * It is decoration, so it is allowed to be invented — unlike a number, which
 * is not. Two different modules always get different patterns; the same module
 * always gets the same one.
 */

/** FNV-1a. Small, stable across reloads, and good enough to spread slugs out. */
const hash = (value: string): number => {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

export type ModuleTone = "primary" | "accent" | "info" | "success" | "warning";

/**
 * Tone classes are written out in full rather than interpolated. Tailwind reads
 * the source as text, so a class built as `bg-${tone}/10` is never generated
 * and the element silently renders unstyled.
 */
const TONE_CLASS: Record<ModuleTone, { chip: string; wash: string; ring: string; ink: string; sweep: string }> = {
  primary: {
    chip: "bg-primary/12 text-primary",
    wash: "from-primary/20 via-primary/5 to-transparent",
    ring: "stroke-primary",
    ink: "text-primary",
    sweep: "fill-primary",
  },
  accent: {
    chip: "bg-accent/12 text-accent",
    wash: "from-accent/20 via-accent/5 to-transparent",
    ring: "stroke-accent",
    ink: "text-accent",
    sweep: "fill-accent",
  },
  info: {
    chip: "bg-info/12 text-info",
    wash: "from-info/20 via-info/5 to-transparent",
    ring: "stroke-info",
    ink: "text-info",
    sweep: "fill-info",
  },
  success: {
    chip: "bg-success/12 text-success",
    wash: "from-success/20 via-success/5 to-transparent",
    ring: "stroke-success",
    ink: "text-success",
    sweep: "fill-success",
  },
  warning: {
    chip: "bg-warning/15 text-warning",
    wash: "from-warning/20 via-warning/5 to-transparent",
    ring: "stroke-warning",
    ink: "text-warning",
    sweep: "fill-warning",
  },
};

const TONES: ModuleTone[] = ["primary", "accent", "info", "success", "warning"];

/**
 * Subject matter, guessed from words in the slug. The list is ordered because
 * `binary-search-trees` should read as a tree, not as a search.
 */
const KEYWORD_ICONS: Array<[RegExp, LucideIcon]> = [
  [/tree|bst|trie|heap/, Network],
  [/graph|traversal|bfs|dfs/, GitFork],
  [/sort/, ArrowDownUp],
  [/hash|map|dictionar/, Hash],
  [/search|binary/, Search],
  [/link|pointer/, Link2],
  [/recursi|backtrack|divide/, Repeat],
  [/dynamic|memo|greedy|complexity|analysis/, Sigma],
  [/string|text/, Type],
  [/array|list|vector/, Rows3],
  [/stack/, Layers],
  [/queue|deque/, ArrowRightLeft],
  [/bit|binary/, Binary],
  [/object|class|struct|syntax/, Braces],
];

export interface ModuleArt {
  icon: LucideIcon;
  tone: ModuleTone;
  /** Tailwind classes for the pieces that need the tone. */
  cls: (typeof TONE_CLASS)[ModuleTone];
}

export const moduleArt = (slug: string): ModuleArt => {
  const key = slug.toLowerCase();
  const matched = KEYWORD_ICONS.find(([pattern]) => pattern.test(key));
  const seed = hash(key);

  return {
    icon: matched?.[1] ?? Shapes,
    tone: TONES[seed % TONES.length],
    cls: TONE_CLASS[TONES[seed % TONES.length]],
  };
};

/**
 * The decorative band at the top of a module card: a grid of squares whose
 * pattern comes from the slug's hash, so each module is recognisable at a
 * glance without anyone choosing an image.
 */
export const ModuleCover = ({
  slug,
  className,
  rows = 5,
  cols = 20,
}: {
  slug: string;
  className?: string;
  rows?: number;
  cols?: number;
}) => {
  const art = moduleArt(slug);
  const seed = hash(slug);
  const cells: Array<{ x: number; y: number; strong: boolean }> = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const mix = (seed >>> (row * 3 + (col % 7))) ^ (col * 2654435761 + row * 40503);
      const bucket = Math.abs(mix) % 10;
      if (bucket > 4) continue;
      cells.push({ x: col * 12 + 4, y: row * 12 + 4, strong: bucket < 2 });
    }
  }

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none relative overflow-hidden bg-gradient-to-br", art.cls.wash, className)}
    >
      <svg viewBox={`0 0 ${cols * 12} ${rows * 12}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <g className={art.cls.sweep}>
          {cells.map((cell, index) => (
            <rect
              key={index}
              x={cell.x}
              y={cell.y}
              width={5}
              height={5}
              rx={1.4}
              opacity={cell.strong ? 0.5 : 0.22}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default moduleArt;
