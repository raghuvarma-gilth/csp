import { Fragment, ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * A small markdown renderer.
 *
 * It builds React elements — there is no `dangerouslySetInnerHTML` anywhere in
 * this file. That matters because two of its inputs are untrusted: text a
 * language model produced, and text a faculty member pasted. Rendering either
 * as raw HTML would make a tutor reply an injection vector.
 *
 * It supports what course material and tutor replies actually use: headings,
 * fenced code, lists, blockquotes, tables of nothing fancier than a paragraph,
 * plus inline bold, italic, code and links. Anything else is shown as the plain
 * text it is, which is the honest failure mode.
 */

type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean; href?: string };

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\))/g;

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
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {part.text}
        </code>
      );
    }
    if (part.href) {
      // Only http(s) and in-app paths survive the tokenizer above, so no
      // javascript: URL can reach an anchor here.
      return (
        <a
          key={index}
          href={part.href}
          target={part.href.startsWith("/") ? undefined : "_blank"}
          rel="noreferrer noopener"
          className="font-medium text-primary underline underline-offset-2"
        >
          {part.text}
        </a>
      );
    }
    if (part.bold) return <strong key={index}>{part.text}</strong>;
    if (part.italic) return <em key={index}>{part.text}</em>;
    return <Fragment key={index}>{part.text}</Fragment>;
  });

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; language: string; code: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "rule" };

const parseBlocks = (source: string): Block[] => {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

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

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
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

    const bullet = /^\s*[-*+]\s+(.*)$/;
    const numbered = /^\s*\d+[.)]\s+(.*)$/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const pattern = ordered ? numbered : bullet;
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
      !bullet.test(lines[index]) &&
      !numbered.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
};

const HEADING_CLASS = [
  "text-2xl font-bold tracking-tight mt-6 mb-2",
  "text-xl font-bold tracking-tight mt-6 mb-2",
  "text-lg font-semibold mt-5 mb-2",
  "text-base font-semibold mt-4 mb-1.5",
  "text-sm font-semibold mt-4 mb-1.5",
  "text-sm font-semibold mt-3 mb-1 text-muted-foreground",
];

export const Markdown = ({ content, className }: { content: string; className?: string }) => {
  const blocks = useMemo(() => parseBlocks(content ?? ""), [content]);

  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "heading": {
            const Tag = `h${Math.min(block.level + 1, 6)}` as "h2";
            return (
              <Tag key={index} className={HEADING_CLASS[block.level - 1]}>
                {renderInline(block.text)}
              </Tag>
            );
          }
          case "code":
            return (
              <pre
                key={index}
                className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/60 p-3"
              >
                <code className="font-mono text-xs leading-relaxed" data-language={block.language}>
                  {block.code}
                </code>
              </pre>
            );
          case "list":
            return block.ordered ? (
              <ol key={index} className="my-2 ml-5 list-decimal space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ol>
            ) : (
              <ul key={index} className="my-2 ml-5 list-disc space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote
                key={index}
                className="my-3 border-l-2 border-primary/40 pl-3 italic text-muted-foreground"
              >
                {renderInline(block.text)}
              </blockquote>
            );
          case "rule":
            return <hr key={index} className="my-5 border-border" />;
          default:
            return (
              <p key={index} className="my-2">
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
};

export default Markdown;
