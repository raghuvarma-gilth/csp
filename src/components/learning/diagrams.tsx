import { memo, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Teaching figures for lesson text.
 *
 * These are drawn, not fetched. The reasons are worth stating, because the
 * obvious alternative — dropping stock photographs into the course — is worse
 * in every way that matters here.
 *
 * A stock photo of "a person at a laptop" next to a paragraph about amortised
 * append teaches nobody anything; it is decoration pretending to be a figure.
 * A real diagram of the memory layout teaches the thing the paragraph is about.
 * Drawn figures also cannot 404, cost no network round-trip, need no CDN or
 * licence, scale to any width without blurring, and follow the theme — the
 * same figure is legible in light and dark mode because every colour here is a
 * semantic token rather than a baked-in pixel.
 *
 * A lesson references one by writing `![[diagram:array-memory]]` in its body,
 * so the database stays the single source of truth for which figure belongs
 * where. An unknown key renders a visible "figure missing" note rather than an
 * empty gap — a lesson that silently loses a figure is a lesson that quietly
 * stops making sense.
 *
 * Coordinates are in a 640-wide viewBox throughout, so every figure scales as
 * one system and captions line up at the same size.
 */

type Tone = "default" | "primary" | "accent" | "warning" | "success" | "info" | "muted" | "ghost";

const TONE: Record<Tone, { box: string; text: string }> = {
  default: { box: "fill-card stroke-border", text: "fill-foreground" },
  primary: { box: "fill-primary/15 stroke-primary", text: "fill-primary" },
  accent: { box: "fill-accent/15 stroke-accent", text: "fill-accent" },
  warning: { box: "fill-warning/15 stroke-warning", text: "fill-warning" },
  success: { box: "fill-success/15 stroke-success", text: "fill-success" },
  info: { box: "fill-info/15 stroke-info", text: "fill-info" },
  muted: { box: "fill-muted stroke-border", text: "fill-muted-foreground" },
  ghost: { box: "fill-transparent stroke-border", text: "fill-muted-foreground" },
};

/** A boxed slot — an array element, a stack frame, a queue position. */
const Cell = ({
  x,
  y,
  w = 72,
  h = 52,
  label,
  tone = "default",
  dashed = false,
  radius = 6,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label?: ReactNode;
  tone?: Tone;
  dashed?: boolean;
  radius?: number;
}) => {
  const style = TONE[tone];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={radius}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "5 4" : undefined}
        className={style.box}
      />
      {label !== undefined && label !== null ? (
        <text
          x={x + w / 2}
          y={y + h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className={cn("font-mono text-[15px] font-medium", style.text)}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
};

/** Small caption text: indices, addresses, pointer names. */
const Note = ({
  x,
  y,
  children,
  anchor = "middle",
  className,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  className?: string;
}) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    dominantBaseline="central"
    className={cn("fill-muted-foreground font-sans text-[11px]", className)}
  >
    {children}
  </text>
);

/**
 * A line with an arrowhead, drawn as geometry rather than an SVG `<marker>`.
 * Markers need document-unique ids, and several figures can be on one page —
 * computing the triangle here sidesteps the collision entirely.
 */
const Arrow = ({
  x1,
  y1,
  x2,
  y2,
  className = "stroke-primary fill-primary",
  head = 7,
  dashed = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  className?: string;
  head?: number;
  dashed?: boolean;
}) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const bx = x2 - Math.cos(angle) * head;
  const by = y2 - Math.sin(angle) * head;
  const spread = head * 0.6;
  const lx = bx + Math.cos(angle + Math.PI / 2) * spread;
  const ly = by + Math.sin(angle + Math.PI / 2) * spread;
  const rx = bx + Math.cos(angle - Math.PI / 2) * spread;
  const ry = by + Math.sin(angle - Math.PI / 2) * spread;

  return (
    <g className={className}>
      <line
        x1={x1}
        y1={y1}
        x2={bx}
        y2={by}
        fill="none"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeDasharray={dashed ? "4 4" : undefined}
      />
      <polygon points={`${x2},${y2} ${lx},${ly} ${rx},${ry}`} stroke="none" />
    </g>
  );
};

/** A horizontal span marker, for "this range" annotations. */
const Span = ({
  x1,
  x2,
  y,
  label,
  className = "stroke-accent",
  labelClassName = "fill-accent",
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
  className?: string;
  labelClassName?: string;
}) => (
  <g>
    <path
      d={`M ${x1} ${y - 6} L ${x1} ${y} L ${x2} ${y} L ${x2} ${y - 6}`}
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
    />
    <text
      x={(x1 + x2) / 2}
      y={y + 14}
      textAnchor="middle"
      dominantBaseline="central"
      className={cn("font-sans text-[11px] font-medium", labelClassName)}
    >
      {label}
    </text>
  </g>
);

/** Lays out a row of equal cells and returns each one's x. */
const rowX = (start: number, index: number, w: number, gap = 4) => start + index * (w + gap);

/* ===========================================================================
   Arrays
   =========================================================================== */

const ArrayMemory = () => {
  const values = [12, 7, 45, 3, 28, 9];
  const w = 72;
  const start = 70;
  const y = 56;

  return (
    <svg viewBox="0 0 640 200" className="h-auto w-full" role="img" aria-label="Array memory layout">
      <title>An array as one contiguous block of memory</title>
      <desc>
        Six equal-sized cells side by side. Each cell&apos;s address is the base address plus its index times the
        element size, so reaching any index costs one multiply and one add.
      </desc>

      <Note x={58} y={y + 26} anchor="end" className="font-mono">
        base →
      </Note>

      {values.map((value, index) => (
        <g key={index}>
          <Cell x={rowX(start, index, w)} y={y} w={w} label={value} tone={index === 3 ? "primary" : "default"} />
          <Note x={rowX(start, index, w) + w / 2} y={y - 16} className="font-mono">
            {index}
          </Note>
          <Note x={rowX(start, index, w) + w / 2} y={y + 70} className="font-mono text-[10px]">
            {`0x${(0x40 + index * 4).toString(16).toUpperCase()}`}
          </Note>
        </g>
      ))}

      <Note x={start - 12} y={y - 16} anchor="end">
        index
      </Note>
      <Note x={start - 12} y={y + 70} anchor="end">
        address
      </Note>

      <Arrow x1={rowX(start, 3, w) + w / 2} y1={150} x2={rowX(start, 3, w) + w / 2} y2={y + 60} />
      <text
        x={320}
        y={168}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-primary font-mono text-[12px] font-medium"
      >
        address(3) = 0x40 + 3 × 4 = 0x4C
      </text>
      <Note x={320} y={188}>
        One multiply, one add — the same work whether the array holds 6 elements or 6 million.
      </Note>
    </svg>
  );
};

const ArrayShift = () => {
  const w = 56;
  const start = 168;
  const rows = [
    { y: 34, label: "before", cells: ["3", "1", "4", "1", "5", null] as (string | null)[] },
    { y: 112, label: "shift right", cells: ["3", null, "1", "4", "1", "5"] as (string | null)[] },
    { y: 190, label: "after", cells: ["3", "9", "1", "4", "1", "5"] as (string | null)[] },
  ];

  return (
    <svg viewBox="0 0 640 268" className="h-auto w-full" role="img" aria-label="Inserting into the middle of an array">
      <title>Inserting 9 at index 1 shifts every later element right</title>
      <desc>
        Three snapshots of the same array. Making room at index 1 moves five elements one slot to the right, working
        from the back so nothing is overwritten. That movement is what makes a middle insertion cost O(n).
      </desc>

      {rows.map((row) => (
        <g key={row.label}>
          <Note x={150} y={row.y + 24} anchor="end">
            {row.label}
          </Note>
          {row.cells.map((value, index) => (
            <Cell
              key={index}
              x={rowX(start, index, w)}
              y={row.y}
              w={w}
              h={48}
              label={value}
              dashed={value === null}
              tone={value === null ? "ghost" : row.label === "after" && index === 1 ? "success" : "default"}
            />
          ))}
        </g>
      ))}

      {[4, 3, 2, 1].map((from, order) => (
        <Arrow
          key={from}
          x1={rowX(start, from, w) + w / 2}
          y1={88}
          x2={rowX(start, from + 1, w) + w / 2}
          y2={108}
          className="stroke-warning fill-warning"
          dashed={order > 0}
        />
      ))}

      <Note x={start + 3 * (w + 4)} y={78} className="fill-warning">
        back to front
      </Note>

      <Arrow
        x1={rowX(start, 1, w) + w / 2}
        y1={166}
        x2={rowX(start, 1, w) + w / 2}
        y2={186}
        className="stroke-success fill-success"
      />
      <Note x={rowX(start, 1, w) + w / 2 + 62} y={172} className="fill-success">
        write 9 into the gap
      </Note>

      <Note x={320} y={256}>
        Five elements moved to insert one. Inserting at the front moves all of them.
      </Note>
    </svg>
  );
};

const TwoPointers = () => {
  const values = [2, 7, 11, 15, 19, 24];
  const w = 72;
  const start = 70;
  const y = 66;

  return (
    <svg viewBox="0 0 640 210" className="h-auto w-full" role="img" aria-label="The two-pointer technique">
      <title>Two pointers converging on a sorted array</title>
      <desc>
        A left pointer at the smallest value and a right pointer at the largest. Comparing their sum against the
        target tells you which pointer to move, so each comparison discards a whole candidate range.
      </desc>

      {values.map((value, index) => (
        <Cell
          key={index}
          x={rowX(start, index, w)}
          y={y}
          w={w}
          label={value}
          tone={index === 0 ? "primary" : index === 5 ? "accent" : "default"}
        />
      ))}

      <Arrow x1={rowX(start, 0, w) + w / 2} y1={36} x2={rowX(start, 0, w) + w / 2} y2={60} />
      <Note x={rowX(start, 0, w) + w / 2} y={24} className="fill-primary font-medium">
        left
      </Note>

      <Arrow
        x1={rowX(start, 5, w) + w / 2}
        y1={36}
        x2={rowX(start, 5, w) + w / 2}
        y2={60}
        className="stroke-accent fill-accent"
      />
      <Note x={rowX(start, 5, w) + w / 2} y={24} className="fill-accent font-medium">
        right
      </Note>

      <Arrow
        x1={rowX(start, 5, w) + w / 2}
        y1={136}
        x2={rowX(start, 4, w) + w / 2}
        y2={136}
        className="stroke-accent fill-accent"
        dashed
      />

      <text
        x={320}
        y={166}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground font-mono text-[12px]"
      >
        2 + 24 = 26 &gt; target 21 → move right inward
      </text>
      <Note x={320} y={190}>
        Too big? The largest value cannot be part of the answer. One comparison, one candidate eliminated.
      </Note>
    </svg>
  );
};

const SlidingWindow = () => {
  const values = [4, 2, 9, 7, 1, 8, 3];
  const w = 66;
  const start = 78;
  const y = 74;
  const windowStart = rowX(start, 1, w) - 5;
  const windowEnd = rowX(start, 3, w) + w + 5;

  return (
    <svg viewBox="0 0 640 220" className="h-auto w-full" role="img" aria-label="The sliding-window technique">
      <title>A fixed-size window sliding across an array</title>
      <desc>
        A window of three elements moves one position to the right. Instead of re-adding all three values, the
        window subtracts the element that left and adds the element that entered.
      </desc>

      <rect
        x={windowStart}
        y={y - 10}
        width={windowEnd - windowStart}
        height={72}
        rx={10}
        strokeWidth={1.5}
        className="fill-primary/10 stroke-primary"
      />

      {values.map((value, index) => (
        <Cell
          key={index}
          x={rowX(start, index, w)}
          y={y}
          w={w}
          h={52}
          label={value}
          tone={index >= 1 && index <= 3 ? "primary" : "default"}
        />
      ))}

      <Note x={(windowStart + windowEnd) / 2} y={y - 24} className="fill-primary font-medium">
        window sum = 18
      </Note>

      <Arrow
        x1={rowX(start, 1, w) + w / 2}
        y1={y + 74}
        x2={rowX(start, 1, w) + w / 2}
        y2={y + 100}
        className="stroke-destructive fill-destructive"
      />
      <Note x={rowX(start, 1, w) + w / 2 - 6} y={y + 114} className="fill-destructive">
        − 2 leaves
      </Note>

      <Arrow
        x1={rowX(start, 4, w) + w / 2}
        y1={y + 100}
        x2={rowX(start, 4, w) + w / 2}
        y2={y + 74}
        className="stroke-success fill-success"
      />
      <Note x={rowX(start, 4, w) + w / 2 + 6} y={y + 114} className="fill-success">
        + 1 enters
      </Note>

      <Note x={320} y={208}>
        Two arithmetic operations per step instead of re-summing the window — O(n) overall, not O(n·k).
      </Note>
    </svg>
  );
};

const PrefixSum = () => {
  const values = [3, 1, 4, 1, 5, 9];
  const prefix = [0, 3, 4, 8, 9, 14, 23];
  const w = 66;
  const start = 100;

  return (
    <svg viewBox="0 0 640 250" className="h-auto w-full" role="img" aria-label="Prefix sums">
      <title>Prefix sums turn a range query into one subtraction</title>
      <desc>
        Below the original array sits a prefix array where entry i holds the sum of everything before index i. The
        sum of any range is then the difference of two prefix entries.
      </desc>

      <Note x={92} y={52} anchor="end">
        values
      </Note>
      {values.map((value, index) => (
        <g key={index}>
          <Cell
            x={rowX(start, index, w)}
            y={30}
            w={w}
            h={44}
            label={value}
            tone={index >= 1 && index <= 3 ? "accent" : "default"}
          />
          <Note x={rowX(start, index, w) + w / 2} y={16} className="font-mono text-[10px]">
            {index}
          </Note>
        </g>
      ))}

      <Note x={92} y={140} anchor="end">
        prefix
      </Note>
      {prefix.map((value, index) => (
        <g key={index}>
          <Cell
            x={rowX(start - 33, index, w)}
            y={118}
            w={w}
            h={44}
            label={value}
            tone={index === 1 || index === 4 ? "primary" : "muted"}
          />
          <Note x={rowX(start - 33, index, w) + w / 2} y={176} className="font-mono text-[10px]">
            {index}
          </Note>
        </g>
      ))}

      <Span x1={rowX(start, 1, w)} x2={rowX(start, 3, w) + w} y={88} label="sum of values[1..3]" />

      <text
        x={320}
        y={212}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-primary font-mono text-[12px] font-medium"
      >
        prefix[4] − prefix[1] = 9 − 3 = 6
      </text>
      <Note x={320} y={236}>
        Build once in O(n). Every range query afterwards is a single subtraction, no matter how wide the range.
      </Note>
    </svg>
  );
};

const AmortisedGrowth = () => {
  const stages = [
    { cap: 1, used: 1, x: 40 },
    { cap: 2, used: 2, x: 140 },
    { cap: 4, used: 3, x: 260 },
    { cap: 8, used: 5, x: 420 },
  ];
  const unit = 22;

  return (
    <svg viewBox="0 0 640 210" className="h-auto w-full" role="img" aria-label="Dynamic array capacity doubling">
      <title>Why an occasional O(n) copy still averages out to O(1) per append</title>
      <desc>
        Each time the backing block fills, a block twice as large is allocated and everything is copied over.
        Because capacity doubles, those copies get geometrically rarer.
      </desc>

      {stages.map((stage, index) => (
        <g key={stage.cap}>
          {Array.from({ length: stage.cap }, (_, slot) => (
            <Cell
              key={slot}
              x={stage.x + slot * unit}
              y={64}
              w={unit - 3}
              h={40}
              radius={3}
              tone={slot < stage.used ? "primary" : "ghost"}
              dashed={slot >= stage.used}
            />
          ))}
          <Note x={stage.x + (stage.cap * unit) / 2 - 2} y={48} className="font-mono">
            capacity {stage.cap}
          </Note>
          {index > 0 ? (
            <Note x={stage.x + (stage.cap * unit) / 2 - 2} y={122} className="fill-warning">
              copy {stages[index - 1].cap}
            </Note>
          ) : null}
        </g>
      ))}

      {stages.slice(0, -1).map((stage, index) => (
        <Arrow
          key={stage.cap}
          x1={stage.x + stage.cap * unit + 4}
          y1={84}
          x2={stages[index + 1].x - 8}
          y2={84}
          className="stroke-warning fill-warning"
        />
      ))}

      <Note x={320} y={160}>
        Resizes happen at append 1, 2, 3, 5, 9, 17… — the gaps double every time.
      </Note>
      <text
        x={320}
        y={186}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-accent font-mono text-[12px] font-medium"
      >
        n appends cost ≈ 2n copies total → O(1) amortised, not O(1) guaranteed
      </text>
    </svg>
  );
};

/* ===========================================================================
   Stacks
   =========================================================================== */

const StackLifo = () => {
  const items = ["A", "B", "C"];
  const w = 120;
  const h = 44;
  const x = 260;
  const baseY = 150;

  return (
    <svg viewBox="0 0 640 230" className="h-auto w-full" role="img" aria-label="Stack push and pop">
      <title>A stack: both ends of the work happen at the top</title>
      <desc>
        Items enter and leave at the same end. Nothing below the top ever moves, which is why push and pop are both
        constant time.
      </desc>

      {items.map((item, index) => (
        <Cell
          key={item}
          x={x}
          y={baseY - index * (h + 4)}
          w={w}
          h={h}
          label={item}
          tone={index === items.length - 1 ? "primary" : "default"}
        />
      ))}

      <line x1={x - 10} y1={baseY + h + 6} x2={x + w + 10} y2={baseY + h + 6} strokeWidth={2.5} className="stroke-border" />
      <Note x={x + w / 2} y={baseY + h + 24}>
        bottom — untouched
      </Note>

      <Note x={x + w + 22} y={baseY - 2 * (h + 4) + h / 2} anchor="start" className="fill-primary font-medium">
        top
      </Note>

      <Arrow x1={x - 80} y1={30} x2={x - 10} y2={baseY - 2 * (h + 4) + 14} className="stroke-success fill-success" />
      <Note x={x - 96} y={26} anchor="end" className="fill-success font-medium">
        push O(1)
      </Note>

      <Arrow
        x1={x + w + 10}
        y1={baseY - 2 * (h + 4) + 30}
        x2={x + w + 80}
        y2={30}
        className="stroke-warning fill-warning"
      />
      <Note x={x + w + 96} y={26} anchor="start" className="fill-warning font-medium">
        pop O(1)
      </Note>

      <Note x={320} y={218}>
        Last in, first out. There is no cheap way to reach anything that is not on top — that is the trade.
      </Note>
    </svg>
  );
};

const BracketMatching = () => {
  const input = "( [ { } ] )";
  const steps = [
    { char: "(", stack: ["("] },
    { char: "[", stack: ["(", "["] },
    { char: "{", stack: ["(", "[", "{"] },
    { char: "}", stack: ["(", "["] },
    { char: "]", stack: ["("] },
    { char: ")", stack: [] },
  ];
  const w = 62;
  const start = 96;
  const cell = 26;

  return (
    <svg viewBox="0 0 640 250" className="h-auto w-full" role="img" aria-label="Bracket matching with a stack">
      <title>The stack holds exactly what is still unclosed</title>
      <desc>
        Reading the string left to right, every opening bracket is pushed and every closing bracket must match the
        top. The string is balanced when the stack is empty at the end.
      </desc>

      <Note x={88} y={34} anchor="end">
        read
      </Note>
      {steps.map((step, index) => (
        <Cell
          key={index}
          x={rowX(start, index, w)}
          y={14}
          w={w}
          h={40}
          label={step.char}
          tone={index >= 3 ? "accent" : "primary"}
        />
      ))}

      <Note x={88} y={130} anchor="end">
        stack
      </Note>
      {steps.map((step, index) => (
        <g key={index}>
          {step.stack.length === 0 ? (
            <Cell x={rowX(start, index, w) + 8} y={148} w={w - 16} h={cell} radius={3} tone="ghost" dashed label="∅" />
          ) : (
            step.stack.map((entry, depth) => (
              <Cell
                key={depth}
                x={rowX(start, index, w) + 8}
                y={148 - depth * (cell + 3)}
                w={w - 16}
                h={cell}
                radius={3}
                label={entry}
                tone={depth === step.stack.length - 1 ? "primary" : "muted"}
              />
            ))
          )}
        </g>
      ))}

      <line x1={start - 6} y1={182} x2={rowX(start, 5, w) + w + 6} y2={182} strokeWidth={2} className="stroke-border" />

      <Note x={rowX(start, 5, w) + w / 2} y={200} className="fill-success font-medium">
        empty ✓
      </Note>
      <Note x={320} y={228}>
        Balanced means every close matched the most recent open, and nothing was left owing.
      </Note>
    </svg>
  );
};

const MonotonicStack = () => {
  const values = [2, 1, 5, 6, 2, 3];
  const w = 66;
  const start = 122;
  /** The moment drawn: 5 has just arrived and is about to clear the stack. */
  const arriving = 2;
  const arrivingX = rowX(start, arriving, w) + w / 2;

  return (
    <svg
      viewBox="0 0 640 270"
      className="h-auto w-full"
      role="img"
      aria-label="Monotonic stack resolving next greater element"
    >
      <title>A decreasing stack answers &ldquo;next greater element&rdquo; in one pass</title>
      <desc>
        The stack holds only the values still waiting for an answer, largest at the bottom. When 5 arrives it is bigger
        than both the 1 and the 2 sitting above it, so both are popped and both are answered with 5. A value that has
        been answered is never looked at again, which is why one pass is enough.
      </desc>

      <Note x={114} y={44} anchor="end">
        input
      </Note>
      {values.map((value, index) => (
        <Cell
          key={index}
          x={rowX(start, index, w)}
          y={22}
          w={w}
          h={44}
          label={value}
          tone={index === arriving ? "primary" : index < arriving ? "warning" : "default"}
        />
      ))}
      <Note x={arrivingX} y={82} className="fill-primary font-medium">
        5 arrives
      </Note>
      <Arrow x1={arrivingX} y1={96} x2={282} y2={124} />

      <Note x={114} y={152} anchor="end">
        stack
      </Note>
      <Note x={130} y={118} anchor="start">
        bottom
      </Note>
      <Note x={416} y={118} anchor="end">
        top
      </Note>

      <Cell x={130} y={130} w={90} h={44} label="2" tone="warning" />
      <Cell x={228} y={130} w={90} h={44} label="1" tone="warning" />
      <Cell x={326} y={130} w={90} h={44} label="5" tone="accent" />

      <line
        x1={136}
        y1={170}
        x2={312}
        y2={134}
        strokeWidth={1.6}
        className="stroke-destructive"
        strokeLinecap="round"
      />

      <Span
        x1={130}
        x2={318}
        y={192}
        label="popped — both answered by 5"
        className="stroke-success"
        labelClassName="fill-success"
      />
      <Note x={371} y={206} className="fill-accent font-medium">
        5 pushed
      </Note>

      <Note x={320} y={240}>
        Values on the stack always decrease upwards, so the first one that survives the comparison stops the popping.
      </Note>
      <text
        x={320}
        y={258}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-accent font-mono text-[12px] font-medium"
      >
        each index pushed once, popped once → O(n)
      </text>
    </svg>
  );
};

/* ===========================================================================
   Queues
   =========================================================================== */

const QueueFifo = () => {
  const values = ["A", "B", "C", "D"];
  const w = 72;
  const start = 140;
  const y = 74;

  return (
    <svg viewBox="0 0 640 200" className="h-auto w-full" role="img" aria-label="Queue front and rear">
      <title>A queue: one end for arrivals, the other for departures</title>
      <desc>
        Items are added at the rear and removed from the front, so the order they arrived in is the order they
        leave in.
      </desc>

      {values.map((value, index) => (
        <Cell
          key={value}
          x={rowX(start, index, w)}
          y={y}
          w={w}
          label={value}
          tone={index === 0 ? "accent" : index === values.length - 1 ? "primary" : "default"}
        />
      ))}

      <Arrow x1={start - 84} y1={y + 26} x2={start - 14} y2={y + 26} className="stroke-accent fill-accent" />
      <Note x={start - 98} y={y + 26} anchor="end" className="fill-accent font-medium">
        dequeue
      </Note>
      <Note x={rowX(start, 0, w) + w / 2} y={y - 16} className="fill-accent font-medium">
        front
      </Note>

      <Arrow
        x1={rowX(start, 3, w) + w + 84}
        y1={y + 26}
        x2={rowX(start, 3, w) + w + 14}
        y2={y + 26}
        className="stroke-primary fill-primary"
      />
      <Note x={rowX(start, 3, w) + w + 98} y={y + 26} anchor="start" className="fill-primary font-medium">
        enqueue
      </Note>
      <Note x={rowX(start, 3, w) + w / 2} y={y - 16} className="fill-primary font-medium">
        rear
      </Note>

      <Note x={320} y={172}>
        First in, first out — A arrived first, so A leaves first.
      </Note>
      <Note x={320} y={190} className="fill-warning">
        Naïvely shifting everything left on each dequeue would make it O(n). The next figure is the fix.
      </Note>
    </svg>
  );
};

const CircularQueue = () => {
  const cx = 320;
  const cy = 112;
  const r = 74;
  const slots = ["—", "—", "C", "D", "E", "—", "A", "B"];
  const filled = [2, 3, 4, 6, 7];

  return (
    <svg viewBox="0 0 640 238" className="h-auto w-full" role="img" aria-label="Circular queue wraparound">
      <title>A circular buffer reuses the space a dequeue frees</title>
      <desc>
        The front and rear indices advance with modular arithmetic, so when the rear reaches the end of the block it
        wraps around to the start rather than forcing everything to shift.
      </desc>

      <circle cx={cx} cy={cy} r={r + 26} fill="none" strokeWidth={1.5} strokeDasharray="4 5" className="stroke-border" />

      {slots.map((value, index) => {
        const angle = (index / slots.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * r - 22;
        const y = cy + Math.sin(angle) * r - 16;
        const isFilled = filled.includes(index);
        return (
          <g key={index}>
            <Cell
              x={x}
              y={y}
              w={44}
              h={32}
              radius={4}
              label={value}
              tone={index === 6 ? "accent" : index === 4 ? "primary" : isFilled ? "default" : "ghost"}
              dashed={!isFilled}
            />
            <Note
              x={cx + Math.cos(angle) * (r + 40)}
              y={cy + Math.sin(angle) * (r + 40)}
              className="font-mono text-[10px]"
            >
              {index}
            </Note>
          </g>
        );
      })}

      <Note x={cx} y={cy - 10} className="fill-accent font-medium">
        front = 6
      </Note>
      <Note x={cx} y={cy + 10} className="fill-primary font-medium">
        rear = 4
      </Note>

      <text
        x={320}
        y={206}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground font-mono text-[12px]"
      >
        rear = (rear + 1) % capacity
      </text>
      <Note x={320} y={228}>
        Index 7 is followed by index 0. Nothing moves; only the two indices change.
      </Note>
    </svg>
  );
};

const MonotonicDeque = () => {
  const values = [1, 3, -1, -3, 5, 3];
  const w = 66;
  const start = 122;

  return (
    <svg viewBox="0 0 640 252" className="h-auto w-full" role="img" aria-label="Monotonic deque for sliding-window maximum">
      <title>A deque that keeps only the values that could still win</title>
      <desc>
        Before a value is added at the back, every smaller value already there is discarded — a smaller value that
        arrived earlier can never be the maximum again. The front of the deque is therefore always the answer.
      </desc>

      <Note x={114} y={44} anchor="end">
        window
      </Note>
      {values.map((value, index) => (
        <Cell
          key={index}
          x={rowX(start, index, w)}
          y={22}
          w={w}
          h={44}
          label={value}
          tone={index >= 2 && index <= 4 ? "primary" : "default"}
        />
      ))}
      <Span x1={rowX(start, 2, w)} x2={rowX(start, 4, w) + w} y={82} label="current window" />

      <Note x={114} y={150} anchor="end">
        deque
      </Note>
      <Cell x={start + 8} y={128} w={90} h={44} label="5" tone="accent" />
      <Cell x={start + 106} y={128} w={90} h={44} label="3" tone="muted" />
      <Cell x={start + 204} y={128} w={90} h={44} dashed tone="ghost" label="−1" />

      <line
        x1={start + 212}
        y1={130}
        x2={start + 286}
        y2={170}
        strokeWidth={1.6}
        className="stroke-destructive"
        strokeLinecap="round"
      />
      <Note x={start + 312} y={150} anchor="start" className="fill-destructive">
        evicted: smaller and older
      </Note>

      <Note x={start + 53} y={190} className="fill-accent font-medium">
        front = window maximum
      </Note>

      <Note x={320} y={228}>
        Every element is pushed once and popped once across the whole scan.
      </Note>
      <text
        x={320}
        y={246}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-accent font-mono text-[12px] font-medium"
      >
        O(n) total, not O(n·k)
      </text>
    </svg>
  );
};

/* ===========================================================================
   General
   =========================================================================== */

const BigOGrowth = () => {
  const x0 = 70;
  const y0 = 180;
  const x1 = 560;
  const y1 = 30;
  const width = x1 - x0;
  const height = y0 - y1;

  /** Samples a growth function over n ∈ (0, 1] and clamps it to the plot box. */
  const curve = (fn: (t: number) => number, scale: number) => {
    const points: string[] = [];
    for (let step = 1; step <= 60; step += 1) {
      const t = step / 60;
      const value = Math.min(fn(t) / scale, 1);
      points.push(`${x0 + t * width},${y0 - value * height}`);
    }
    return points.join(" ");
  };

  const series = [
    { label: "O(1)", points: `${x0},${y0 - 6} ${x1},${y0 - 6}`, className: "stroke-success" },
    { label: "O(log n)", points: curve((t) => Math.log2(1 + t * 63), 6.5), className: "stroke-info" },
    { label: "O(n)", points: curve((t) => t, 1), className: "stroke-primary" },
    { label: "O(n log n)", points: curve((t) => t * Math.log2(1 + t * 63), 6), className: "stroke-warning" },
    { label: "O(n²)", points: curve((t) => t * t, 0.6), className: "stroke-destructive" },
  ];

  return (
    <svg viewBox="0 0 640 230" className="h-auto w-full" role="img" aria-label="Growth rates compared">
      <title>How the common complexity classes diverge as input grows</title>
      <desc>
        Constant and logarithmic time stay flat. Linear rises steadily. Quadratic runs off the top of the chart
        long before the others do — which is why removing one nested loop matters more than any micro-optimisation.
      </desc>

      <line x1={x0} y1={y0} x2={x1} y2={y0} strokeWidth={1.5} className="stroke-border" />
      <line x1={x0} y1={y0} x2={x0} y2={y1} strokeWidth={1.5} className="stroke-border" />
      <Note x={x0 + width / 2} y={y0 + 20}>
        input size n →
      </Note>
      <g transform={`translate(${x0 - 26}, ${y1 + height / 2}) rotate(-90)`}>
        <Note x={0} y={0}>
          work done →
        </Note>
      </g>

      {series.map((item) => (
        <polyline
          key={item.label}
          points={item.points}
          fill="none"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={item.className}
        />
      ))}

      {series.map((item, index) => (
        <g key={item.label}>
          <line
            x1={x1 + 12}
            y1={44 + index * 20}
            x2={x1 + 30}
            y2={44 + index * 20}
            strokeWidth={2.2}
            strokeLinecap="round"
            className={item.className}
          />
          <text
            x={x1 + 36}
            y={44 + index * 20}
            dominantBaseline="central"
            className={cn("font-mono text-[10px]", item.className.replace("stroke-", "fill-"))}
          >
            {item.label}
          </text>
        </g>
      ))}

      <Note x={x0 + width / 2} y={218}>
        Constants and hardware shift these lines a little. The order of the lines never changes.
      </Note>
    </svg>
  );
};

/* ===========================================================================
   Registry
   =========================================================================== */

export interface DiagramMeta {
  /** Default caption, used when the lesson does not supply one. */
  caption: string;
  render: () => ReactNode;
}

export const DIAGRAMS: Record<string, DiagramMeta> = {
  "array-memory": {
    caption: "An array is one contiguous block, so any index is reachable by arithmetic.",
    render: () => <ArrayMemory />,
  },
  "array-shift": {
    caption: "Inserting into the middle moves every later element — the reason it costs O(n).",
    render: () => <ArrayShift />,
  },
  "array-growth": {
    caption: "Doubling the capacity makes resizes geometrically rarer, which is what 'amortised' means.",
    render: () => <AmortisedGrowth />,
  },
  "two-pointers": {
    caption: "Each comparison eliminates a candidate, so one pass replaces a nested loop.",
    render: () => <TwoPointers />,
  },
  "sliding-window": {
    caption: "Reuse the previous window instead of recomputing it.",
    render: () => <SlidingWindow />,
  },
  "prefix-sum": {
    caption: "One pass to build, one subtraction per range query afterwards.",
    render: () => <PrefixSum />,
  },
  "stack-lifo": {
    caption: "Both push and pop touch only the top, so neither depends on how deep the stack is.",
    render: () => <StackLifo />,
  },
  "bracket-matching": {
    caption: "The stack holds exactly the brackets that are still unclosed.",
    render: () => <BracketMatching />,
  },
  "monotonic-stack": {
    caption: "A value is popped exactly when its answer arrives, so one pass resolves every element.",
    render: () => <MonotonicStack />,
  },
  "queue-fifo": {
    caption: "Arrivals at the rear, departures from the front.",
    render: () => <QueueFifo />,
  },
  "circular-queue": {
    caption: "Modular arithmetic lets the rear wrap around instead of forcing a shift.",
    render: () => <CircularQueue />,
  },
  "monotonic-deque": {
    caption: "Discard anything that can never win again; the front is then always the answer.",
    render: () => <MonotonicDeque />,
  },
  "big-o-growth": {
    caption: "How the common complexity classes diverge as the input grows.",
    render: () => <BigOGrowth />,
  },
};

export const hasDiagram = (key: string): boolean => key in DIAGRAMS;

export const diagramKeys = (): string[] => Object.keys(DIAGRAMS);

/**
 * Renders one figure with its caption.
 *
 * An unknown key is reported rather than swallowed. A lesson that references a
 * figure which no longer exists has a real editorial problem, and hiding it
 * would leave the surrounding paragraphs referring to something invisible.
 */
export const Diagram = memo(
  ({ diagramKey, caption, className }: { diagramKey: string; caption?: string; className?: string }) => {
    const entry = DIAGRAMS[diagramKey];

    if (!entry) {
      return (
        <div
          role="note"
          className={cn(
            "my-5 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-muted-foreground",
            className,
          )}
        >
          This lesson refers to a figure called <code className="font-mono text-foreground">{diagramKey}</code>, which
          this build does not have. The surrounding text may read as though something is missing, because it is.
        </div>
      );
    }

    return (
      <figure className={cn("my-6", className)}>
        <div className="overflow-hidden rounded-xl border border-border bg-muted/30 p-4 sm:p-5">{entry.render()}</div>
        <figcaption className="mt-2.5 text-center font-sans text-xs leading-relaxed text-muted-foreground">
          {caption ?? entry.caption}
        </figcaption>
      </figure>
    );
  },
);

Diagram.displayName = "Diagram";

export default Diagram;
