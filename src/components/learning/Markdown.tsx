import { Fragment, ReactNode, useMemo, useState } from "react";
import { Check, Copy, ImageOff, Info, Lightbulb, ListOrdered, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import { Diagram } from "@/components/learning/diagrams";
import { cn } from "@/lib/utils";

/**
 * The markdown renderer for everything a human or a model wrote.
 *
 * It builds React elements — there is no `dangerouslySetInnerHTML` anywhere in
 * this file. That matters because every input is untrusted: text a language
 * model produced, and text a faculty member pasted. Rendering either as raw
 * HTML would make a tutor reply an injection vector.
 *
 * What it understands, beyond the obvious headings/lists/code:
 *
 *   | a | b |     Tables. The seeded lessons have used these since day one and
 *   |---|---|     the previous version had no table rule at all, so every cost
 *   | 1 | 2 |     table in the curriculum rendered as one mangled paragraph of
 *                 pipe characters. That was the single worst thing on the page.
 *
 *   ![Caption](diagram:array-memory)
 *                 A built-in figure from components/learning/diagrams.tsx.
 *                 Reusing image syntax keeps one mental model for faculty:
 *                 "a picture whose source is a figure this app can draw".
 *
 *   ![Alt](https://…/photo.png)
 *                 A real image, lazily loaded, in a figure with its caption.
 *                 Only https and root-relative sources are accepted; `data:`
 *                 is refused because an SVG data URL can carry script.
 *
 *   :::example Reversing a string in place
 *   …
 *   :::           Callouts. `example`, `note`, `tip`, `warning`, `pitfall` and
 *                 `key`. A worked example needs to look different from the
 *                 prose around it or nobody reads it as one.
 *
 * Anything it does not understand renders as the plain text it is, which is
 * the honest failure mode.
 */

/* ---------------------------------------------------------------------------
   Inline
   --------------------------------------------------------------------------- */

type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean; href?: string };

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\((?:https?:\/\/|\/|mailto:)[^)\s]+\))/g;

const parseInline = (line: string): Inline[] => {
  const parts: Inline[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push({ text: line.slice(lastIndex, index) });

    const token = match[0];
    if (token.startsWith("`")) {
      parts.push({ text: token.slice(1, -1), code: true });
    } else if (token.startsWith("**")) {
      parts.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith("[")) {
      const split = token.indexOf("](");
      parts.push({ text: token.slice(1, split), href: token.slice(split + 2, -1) });
    } else {
      parts.push({ text: token.slice(1, -1), italic: true });
    }
    lastIndex = index + token.length;
  }

  if (lastIndex < line.length) parts.push({ text: line.slice(lastIndex) });
  return parts;
};

const renderInline = (line: string): ReactNode =>
  parseInline(line).map((part, index) => {
    if (part.code) {
      return (
        <code
          key={index}
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-foreground"
        >
          {part.text}
        </code>
      );
    }
    if (part.href) {
      // Only http(s), mailto and in-app paths survive the tokenizer above, so
      // no javascript: URL can reach an anchor here.
      const external = !part.href.startsWith("/");
      return (
        <a
          key={index}
          href={part.href}
          target={external ? "_blank" : undefined}
          rel="noreferrer noopener"
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {part.text}
        </a>
      );
    }
    if (part.bold) return <strong key={index}>{part.text}</strong>;
    if (part.italic) return <em key={index}>{part.text}</em>;
    return <Fragment key={index}>{part.text}</Fragment>;
  });

/* ---------------------------------------------------------------------------
   Blocks
   --------------------------------------------------------------------------- */

type Align = "left" | "center" | "right";

export type CalloutVariant = "example" | "note" | "tip" | "warning" | "pitfall" | "key";

const CALLOUT_VARIANTS = new Set<string>(["example", "note", "tip", "warning", "pitfall", "key"]);

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; language: string; code: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "rule" }
  | { kind: "table"; head: string[]; align: Align[]; rows: string[][] }
  | { kind: "image"; src: string; alt: string }
  | { kind: "diagram"; diagramKey: string; caption?: string }
  | { kind: "callout"; variant: CalloutVariant; title?: string; blocks: Block[] };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Splits `| a | b |` into `["a", "b"]`. */
const splitRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

const readAlign = (cell: string): Align => {
  const trimmed = cell.trim();
  if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
  if (trimmed.endsWith(":")) return "right";
  return "left";
};

const parseBlocks = (source: string, allowCallouts = true): Block[] => {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    /* Callout — `:::variant Optional title` … `:::` */
    const callout = allowCallouts ? line.match(/^:::\s*([a-z]+)\s*(.*)$/i) : null;
    if (callout && CALLOUT_VARIANTS.has(callout[1].toLowerCase())) {
      const variant = callout[1].toLowerCase() as CalloutVariant;
      const title = callout[2].trim() || undefined;
      const body: string[] = [];
      index += 1;
      let depth = 1;
      while (index < lines.length) {
        const current = lines[index];
        if (/^:::\s*$/.test(current)) {
          depth -= 1;
          index += 1;
          if (depth === 0) break;
          body.push(current);
          continue;
        }
        if (/^:::\s*[a-z]+/i.test(current)) depth += 1;
        body.push(current);
        index += 1;
      }
      // Nested callouts are not a thing we want, so the body is parsed with
      // callout handling off: a stray `:::` inside shows as text rather than
      // silently swallowing the rest of the lesson.
      blocks.push({ kind: "callout", variant, title, blocks: parseBlocks(body.join("\n"), false) });
      continue;
    }

    /* Fenced code */
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const language = fence[1] || "text";
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1; // closing fence (or end of input, which is fine)
      blocks.push({ kind: "code", language, code: body.join("\n") });
      continue;
    }

    /* Standalone image or built-in figure */
    const image = line.match(IMAGE_LINE);
    if (image) {
      const alt = image[1];
      const src = image[2];
      const diagram = src.match(/^diagram:([a-z0-9-]+)$/i);
      if (diagram) {
        blocks.push({ kind: "diagram", diagramKey: diagram[1].toLowerCase(), caption: alt || undefined });
      } else {
        blocks.push({ kind: "image", src, alt });
      }
      index += 1;
      continue;
    }

    /* Table — a pipe row immediately followed by a divider row */
    if (line.trim().startsWith("|") && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1])) {
      const head = splitRow(line);
      const align = splitRow(lines[index + 1]).map(readAlign);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push({ kind: "table", head, align, rows });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        body.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ kind: "quote", text: body.join(" ") });
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const pattern = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (index < lines.length && pattern.test(lines[index])) {
        items.push(lines[index].match(pattern)![1]);
        index += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith("```") &&
      !/^#{1,6}\s/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !/^:::/.test(lines[index]) &&
      !IMAGE_LINE.test(lines[index]) &&
      !lines[index].trim().startsWith("|") &&
      !BULLET.test(lines[index]) &&
      !NUMBERED.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    } else {
      // A line that every rule above declined to claim. Show it rather than
      // spinning forever on it.
      blocks.push({ kind: "paragraph", text: lines[index] });
      index += 1;
    }
  }

  return blocks;
};

/* ---------------------------------------------------------------------------
   Pieces
   --------------------------------------------------------------------------- */

const LANGUAGE_LABEL: Record<string, string> = {
  py: "Python",
  python: "Python",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  java: "Java",
  c: "C",
  cpp: "C++",
  cs: "C#",
  sql: "SQL",
  sh: "Shell",
  bash: "Shell",
  json: "JSON",
  text: "",
};

const CodeBlock = ({ language, code }: { language: string; code: string }) => {
  const [copied, setCopied] = useState(false);
  const label = LANGUAGE_LABEL[language.toLowerCase()] ?? language;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused (insecure context, permission policy).
      // The code is already selectable, so there is nothing to recover from
      // and nothing worth interrupting the reader about.
    }
  };

  return (
    <div className="group relative my-5 overflow-hidden rounded-xl border border-border bg-[hsl(226_36%_9%)]">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-white/45">
          {label || "code"}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-sans text-[11px] font-medium text-white/55 transition-colors hover:bg-white/10 hover:text-white/90 focus-visible:ring-offset-0"
          aria-label={copied ? "Code copied" : "Copy code"}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" aria-hidden />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-[0.8125rem] leading-relaxed text-[hsl(220_20%_92%)]" data-language={language}>
          {code}
        </code>
      </pre>
    </div>
  );
};

/**
 * A real image from the course material.
 *
 * `https:` and root-relative sources only. `data:` is refused on purpose — an
 * SVG data URL is a script-execution vector, and the whole point of this file
 * is that pasted content cannot run anything.
 */
const Figure = ({ src, alt }: { src: string; alt: string }) => {
  const [failed, setFailed] = useState(false);
  const safe = /^(https:\/\/|\/)/i.test(src);

  if (!safe || failed) {
    return (
      <figure className="my-5">
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          <ImageOff className="h-5 w-5 shrink-0" aria-hidden />
          <span>
            {safe ? "This image could not be loaded." : "This image was blocked because its address is not https."}
            {alt ? (
              <>
                {" "}
                It was described as <span className="text-foreground">“{alt}”</span>.
              </>
            ) : null}
          </span>
        </div>
      </figure>
    );
  }

  return (
    <figure className="my-6">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="mx-auto max-h-[28rem] w-full rounded-xl border border-border bg-muted/30 object-contain"
      />
      {alt ? (
        <figcaption className="mt-2.5 text-center font-sans text-xs leading-relaxed text-muted-foreground">
          {alt}
        </figcaption>
      ) : null}
    </figure>
  );
};

const CALLOUT_STYLE: Record<
  CalloutVariant,
  { icon: typeof Info; label: string; frame: string; chip: string; title: string }
> = {
  example: {
    icon: ListOrdered,
    label: "Worked example",
    frame: "border-primary/30 bg-primary/[0.06]",
    chip: "bg-primary/12 text-primary",
    title: "text-primary",
  },
  key: {
    icon: Sparkles,
    label: "Key idea",
    frame: "border-accent/35 bg-accent/[0.07]",
    chip: "bg-accent/12 text-accent",
    title: "text-accent",
  },
  note: {
    icon: Info,
    label: "Note",
    frame: "border-info/30 bg-info/[0.06]",
    chip: "bg-info/12 text-info",
    title: "text-info",
  },
  tip: {
    icon: Lightbulb,
    label: "Tip",
    frame: "border-success/30 bg-success/[0.06]",
    chip: "bg-success/12 text-success",
    title: "text-success",
  },
  warning: {
    icon: TriangleAlert,
    label: "Careful",
    frame: "border-warning/35 bg-warning/[0.07]",
    chip: "bg-warning/15 text-warning",
    title: "text-warning",
  },
  pitfall: {
    icon: ShieldAlert,
    label: "Common mistake",
    frame: "border-destructive/30 bg-destructive/[0.05]",
    chip: "bg-destructive/12 text-destructive",
    title: "text-destructive",
  },
};

/* ---------------------------------------------------------------------------
   Renderer
   --------------------------------------------------------------------------- */

export type MarkdownVariant = "lesson" | "compact";

const HEADING_CLASS: Record<MarkdownVariant, string[]> = {
  lesson: [
    "mb-3 mt-9 scroll-mt-24 font-sans text-[1.6rem] font-bold tracking-tight text-foreground",
    "mb-3 mt-9 scroll-mt-24 font-sans text-[1.3rem] font-semibold tracking-tight text-foreground",
    "mb-2 mt-7 scroll-mt-24 font-sans text-[1.1rem] font-semibold text-foreground",
    "mb-2 mt-6 font-sans text-base font-semibold text-foreground",
    "mb-1.5 mt-5 font-sans text-sm font-semibold text-foreground",
    "mb-1.5 mt-5 font-sans text-sm font-semibold uppercase tracking-wide text-muted-foreground",
  ],
  compact: [
    "mb-2 mt-5 text-lg font-bold tracking-tight",
    "mb-2 mt-5 text-base font-semibold tracking-tight",
    "mb-1.5 mt-4 text-sm font-semibold",
    "mb-1 mt-3 text-sm font-semibold",
    "mb-1 mt-3 text-sm font-semibold",
    "mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
  ],
};

/** Stable, readable anchor for a heading, so a contents list can link to it. */
export const headingId = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);

/** The headings a lesson contains, for building a table of contents. */
export const extractHeadings = (content: string): Array<{ id: string; text: string; level: number }> =>
  parseBlocks(content ?? "")
    .filter((block): block is Extract<Block, { kind: "heading" }> => block.kind === "heading")
    .filter((block) => block.level <= 3)
    .map((block) => ({ id: headingId(block.text), text: block.text, level: block.level }));

const renderBlocks = (blocks: Block[], variant: MarkdownVariant, keyPrefix = "b"): ReactNode[] =>
  blocks.map((block, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (block.kind) {
      case "heading": {
        const Tag = `h${Math.min(block.level + 1, 6)}` as "h2";
        return (
          <Tag key={key} id={headingId(block.text)} className={HEADING_CLASS[variant][block.level - 1]}>
            {renderInline(block.text)}
          </Tag>
        );
      }

      case "code":
        return <CodeBlock key={key} language={block.language} code={block.code} />;

      case "image":
        return <Figure key={key} src={block.src} alt={block.alt} />;

      case "diagram":
        return <Diagram key={key} diagramKey={block.diagramKey} caption={block.caption} />;

      case "table":
        return (
          <div key={key} className="my-5 -mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[22rem] border-collapse overflow-hidden rounded-xl border border-border font-sans text-sm">
              <thead>
                <tr className="bg-muted/70">
                  {block.head.map((cell, cellIndex) => (
                    <th
                      key={cellIndex}
                      scope="col"
                      className={cn(
                        "border-b border-border px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                        block.align[cellIndex] === "center" && "text-center",
                        block.align[cellIndex] === "right" && "text-right",
                        (block.align[cellIndex] ?? "left") === "left" && "text-left",
                      )}
                    >
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="even:bg-muted/25">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={cn(
                          "border-b border-border/60 px-3 py-2.5 align-top text-foreground/90",
                          block.align[cellIndex] === "center" && "text-center",
                          block.align[cellIndex] === "right" && "text-right",
                        )}
                      >
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "callout": {
        const style = CALLOUT_STYLE[block.variant];
        const Icon = style.icon;
        return (
          <aside key={key} className={cn("my-6 rounded-xl border px-4 py-4 sm:px-5", style.frame)}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-wider",
                  style.chip,
                )}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {style.label}
              </span>
              {block.title ? (
                <span className={cn("font-sans text-sm font-semibold", style.title)}>{block.title}</span>
              ) : null}
            </div>
            <div className={cn("[&>*:first-child]:mt-0 [&>*:last-child]:mb-0", variant === "lesson" && "text-[0.95em]")}>
              {renderBlocks(block.blocks, variant, key)}
            </div>
          </aside>
        );
      }

      case "list":
        return block.ordered ? (
          <ol
            key={key}
            className={cn(
              "list-decimal space-y-1.5",
              variant === "lesson" ? "my-4 ml-6 marker:font-sans marker:text-sm marker:text-muted-foreground" : "my-2 ml-5",
            )}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-1">
                {renderInline(item)}
              </li>
            ))}
          </ol>
        ) : (
          <ul
            key={key}
            className={cn(
              "list-disc space-y-1.5",
              variant === "lesson" ? "my-4 ml-6 marker:text-primary/60" : "my-2 ml-5",
            )}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-1">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        );

      case "quote":
        return (
          <blockquote
            key={key}
            className={cn(
              "border-l-[3px] border-primary/40 bg-primary/[0.04] py-2.5 pl-4 pr-3 text-foreground/80",
              variant === "lesson" ? "my-5 rounded-r-lg" : "my-3 rounded-r-md italic",
            )}
          >
            {renderInline(block.text)}
          </blockquote>
        );

      case "rule":
        return <hr key={key} className={variant === "lesson" ? "my-9 border-border" : "my-5 border-border"} />;

      default:
        return (
          <p key={key} className={variant === "lesson" ? "mb-5" : "my-2"}>
            {renderInline(block.text)}
          </p>
        );
    }
  });

export const Markdown = ({
  content,
  className,
  variant = "compact",
}: {
  content: string;
  className?: string;
  /** `lesson` is the long-form reading style: serif, wider leading, bigger figures. */
  variant?: MarkdownVariant;
}) => {
  const blocks = useMemo(() => parseBlocks(content ?? ""), [content]);

  return (
    <div
      className={cn(
        variant === "lesson"
          ? "font-serif text-[1.0625rem] leading-[1.75] text-foreground/90 [&>*:first-child]:mt-0"
          : "text-sm leading-relaxed",
        className,
      )}
    >
      {renderBlocks(blocks, variant)}
    </div>
  );
};

export default Markdown;
