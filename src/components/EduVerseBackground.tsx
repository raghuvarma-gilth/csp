import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The education-themed backdrop.
 *
 * Formulas, code fragments, array cells, a graph and a small network — the
 * things this app is actually about — drawn once as vectors behind everything
 * at --backdrop-opacity (4.5% light / 7% dark). Positions are fixed constants
 * rather than random so the page never reflows or shimmers between renders, and
 * the whole layer is aria-hidden and pointer-events-none: it is texture, not
 * content, and it must never cost readability.
 */

const FORMULAS = [
  { x: 6, y: 12, text: "O(n log n)", size: 22 },
  { x: 74, y: 8, text: "T(n) = 2T(n/2) + n", size: 18 },
  { x: 12, y: 74, text: "Σ i = n(n+1)/2", size: 20 },
  { x: 62, y: 62, text: "a[i] ⊕ a[j]", size: 18 },
  { x: 40, y: 92, text: "lim n→∞", size: 17 },
  { x: 86, y: 44, text: "∇f(x)", size: 20 },
];

const CODE = [
  { x: 24, y: 26, text: "while (lo < hi) {" },
  { x: 26, y: 30, text: "  mid = (lo + hi) >> 1;" },
  { x: 24, y: 34, text: "}" },
  { x: 66, y: 78, text: "def push(self, v):" },
  { x: 68, y: 82, text: "    self.top += 1" },
  { x: 4, y: 48, text: "stack.pop()" },
];

/** Undirected graph: node positions plus the edges between them. */
const GRAPH_NODES = [
  { x: 82, y: 20 },
  { x: 90, y: 28 },
  { x: 78, y: 32 },
  { x: 86, y: 38 },
  { x: 94, y: 18 },
];
const GRAPH_EDGES = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [0, 4],
];

/** A 3-4-2 feed-forward network, drawn as columns of nodes. */
const NETWORK_LAYERS = [3, 4, 2];

const ARRAY_CELLS = [3, 1, 4, 1, 5, 9, 2];

export const EduVerseBackground = ({ className }: { className?: string }) => {
  const id = useId().replace(/:/g, "");

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}
      style={{ opacity: "var(--backdrop-opacity)" }}
    >
      {/* Soft wash so the vectors do not sit on flat white. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 12% -5%, hsl(var(--primary)) 0%, transparent 60%), radial-gradient(900px 500px at 95% 8%, hsl(var(--accent)) 0%, transparent 55%)",
          opacity: 0.55,
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <pattern id={`${id}-dots`} width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="0.4" cy="0.4" r="0.18" fill="currentColor" />
          </pattern>
        </defs>

        <rect width="100" height="100" fill={`url(#${id}-dots)`} className="text-foreground" />

        {/* Array cells — the first data structure anyone meets. */}
        <g className="text-foreground" transform="translate(4 60)">
          {ARRAY_CELLS.map((value, i) => (
            <g key={i} transform={`translate(${i * 5} 0)`}>
              <rect
                width="4.6"
                height="4.6"
                rx="0.5"
                stroke="currentColor"
                strokeWidth="0.18"
                fill="none"
              />
              <text
                x="2.3"
                y="3.2"
                textAnchor="middle"
                fontSize="2.4"
                fill="currentColor"
                fontFamily="var(--font-mono)"
              >
                {value}
              </text>
            </g>
          ))}
        </g>

        {/* A binary tree, three levels. */}
        <g className="text-foreground" stroke="currentColor" strokeWidth="0.16" transform="translate(44 14)">
          <line x1="0" y1="0" x2="-6" y2="7" />
          <line x1="0" y1="0" x2="6" y2="7" />
          <line x1="-6" y1="7" x2="-9" y2="14" />
          <line x1="-6" y1="7" x2="-3" y2="14" />
          <line x1="6" y1="7" x2="9" y2="14" />
          {[
            [0, 0],
            [-6, 7],
            [6, 7],
            [-9, 14],
            [-3, 14],
            [9, 14],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.5" fill="hsl(var(--background))" />
          ))}
        </g>

        {/* Graph nodes and edges. */}
        <g className="text-foreground" stroke="currentColor" strokeWidth="0.16">
          {GRAPH_EDGES.map(([a, b], i) => (
            <line
              key={i}
              x1={GRAPH_NODES[a].x}
              y1={GRAPH_NODES[a].y}
              x2={GRAPH_NODES[b].x}
              y2={GRAPH_NODES[b].y}
            />
          ))}
          {GRAPH_NODES.map((node, i) => (
            <circle key={i} cx={node.x} cy={node.y} r="1.3" fill="hsl(var(--background))" />
          ))}
        </g>

        {/* Feed-forward network. */}
        <g className="text-foreground" stroke="currentColor" strokeWidth="0.1" transform="translate(8 84)">
          {NETWORK_LAYERS.slice(0, -1).flatMap((count, layer) =>
            Array.from({ length: count }).flatMap((_, from) =>
              Array.from({ length: NETWORK_LAYERS[layer + 1] }).map((__, to) => (
                <line
                  key={`${layer}-${from}-${to}`}
                  x1={layer * 7}
                  y1={from * 3.2 - (count - 1) * 1.6}
                  x2={(layer + 1) * 7}
                  y2={to * 3.2 - (NETWORK_LAYERS[layer + 1] - 1) * 1.6}
                />
              )),
            ),
          )}
          {NETWORK_LAYERS.flatMap((count, layer) =>
            Array.from({ length: count }).map((_, i) => (
              <circle
                key={`n-${layer}-${i}`}
                cx={layer * 7}
                cy={i * 3.2 - (count - 1) * 1.6}
                r="0.9"
                fill="currentColor"
              />
            )),
          )}
        </g>

        {/* Formulas. */}
        {FORMULAS.map((item, i) => (
          <text
            key={i}
            x={item.x}
            y={item.y}
            fontSize={item.size / 8}
            fill="currentColor"
            className="text-foreground"
            fontFamily="var(--font-serif)"
            fontStyle="italic"
          >
            {item.text}
          </text>
        ))}

        {/* Code fragments. */}
        {CODE.map((item, i) => (
          <text
            key={i}
            x={item.x}
            y={item.y}
            fontSize="1.9"
            fill="currentColor"
            className="text-foreground"
            fontFamily="var(--font-mono)"
          >
            {item.text}
          </text>
        ))}
      </svg>
    </div>
  );
};

export default EduVerseBackground;
