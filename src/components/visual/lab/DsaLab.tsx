import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useReducedMotion } from "@/components/ui/depth";
import { EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

import { MODULES, SECTIONS, firstOpKey } from "./registry";
import { LabScene, webglAvailable } from "./scene";
import { createLabContext, type Frame, type OpDef, type ParamDef, type ParamValues } from "./types";
import { SPEED_MAX, SPEED_MIN, SPEED_STEP, useLabPlayer } from "./useLabPlayer";

/**
 * The 3-D algorithm lab.
 *
 * Two things about this component are load-bearing rather than stylistic.
 *
 * **The narration is DOM, not canvas.** The step description, the pseudocode and
 * the complexity table are real elements in an `aria-live` region. A `<canvas>`
 * is completely opaque to a screen reader, so if the explanation lived inside it
 * this screen would teach nothing to anyone using one. Keyboard control (arrows
 * step, space plays) comes from `useLabPlayer` for the same reason.
 *
 * **WebGL is checked, not assumed.** This is now the only visualiser in the app,
 * so a machine that cannot give us a context gets a real explanation and a link
 * to the written lesson — never a black rectangle, and never a fake animation
 * standing in for one.
 */

export interface DsaLabProps {
  /** Opening module key, e.g. `"array"`. Falls back to the first module. */
  moduleKey?: string;
  /** Opening operation key within that module. Falls back to the module's first. */
  opKey?: string;
  /** Opening contents of the values box. Falls back to the module's sample. */
  values?: string;
  /** Overrides for the operation's default parameters. */
  params?: ParamValues;
  /** Lesson embeds hide the module list and link out to the full lab instead. */
  showModulePicker?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Input parsing                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Read the values box.
 *
 * Commas, spaces and newlines all separate, because students paste from all
 * three. Anything that is not a finite number is dropped rather than becoming a
 * `NaN` that would then be drawn as a cell labelled "NaN".
 */
const parseValues = (text: string): number[] =>
  text
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map(Number)
    .filter((value) => Number.isFinite(value));

const defaultParams = (op: OpDef | null): ParamValues =>
  op ? Object.fromEntries(op.params.map((param) => [param.key, param.default])) : {};

/** Operations in declaration order, bucketed by their `group` label. */
const groupOps = (ops: Record<string, OpDef>): Array<{ label: string; entries: Array<[string, OpDef]> }> => {
  const buckets: Array<{ label: string; entries: Array<[string, OpDef]> }> = [];
  for (const entry of Object.entries(ops)) {
    const label = entry[1].group ?? "Operations";
    const bucket = buckets.find((candidate) => candidate.label === label);
    if (bucket) bucket.entries.push(entry);
    else buckets.push({ label, entries: [entry] });
  }
  return buckets;
};

/* -------------------------------------------------------------------------- */
/* Parameter field                                                            */
/* -------------------------------------------------------------------------- */

/**
 * One parameter input.
 *
 * Numbers commit as you change them; text commits on blur or Enter. That split
 * is deliberate — a text parameter like a pattern or a comma-separated profit
 * list is unusable if every keystroke re-runs the algorithm and throws the
 * playhead back to step 1.
 */
const ParamField = ({
  param,
  value,
  onCommit,
}: {
  param: ParamDef;
  value: number | string;
  onCommit: (next: number | string) => void;
}) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const id = `lab-param-${param.key}`;

  return (
    <div className="min-w-[7rem] flex-1">
      <Label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
        {param.label}
      </Label>
      <Input
        id={id}
        value={draft}
        type={param.type === "number" ? "number" : "text"}
        min={param.min}
        max={param.max}
        className="mt-1 h-9 font-mono text-sm"
        onChange={(event) => {
          setDraft(event.target.value);
          if (param.type === "number") {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onCommit(next);
          }
        }}
        onBlur={() => {
          if (param.type === "text") onCommit(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && param.type === "text") onCommit(draft);
        }}
      />
      {param.hint ? <p className="mt-1 text-[10px] text-muted-foreground">{param.hint}</p> : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* The lab                                                                    */
/* -------------------------------------------------------------------------- */

const DsaLab = ({
  moduleKey: initialModuleKey,
  opKey: initialOpKey,
  values: initialValues,
  params: initialParams,
  showModulePicker = true,
}: DsaLabProps) => {
  const reducedMotion = useReducedMotion();

  /* Probed once. `webglAvailable()` creates and immediately releases a context,
     so it must not run on every render. */
  const [webgl] = useState(() => webglAvailable());
  const [contextLost, setContextLost] = useState(false);

  const firstModule = Object.keys(MODULES)[0];
  const [moduleKey, setModuleKey] = useState(() =>
    initialModuleKey && MODULES[initialModuleKey] ? initialModuleKey : firstModule,
  );

  const module = MODULES[moduleKey] ?? MODULES[firstModule];

  const [opKey, setOpKey] = useState(() => {
    if (initialOpKey && module.ops[initialOpKey]) return initialOpKey;
    return firstOpKey(moduleKey) ?? Object.keys(module.ops)[0];
  });

  const op: OpDef | null = module.ops[opKey] ?? null;

  const [valuesText, setValuesText] = useState(() => initialValues ?? module.sample ?? "");
  const [valuesDraft, setValuesDraft] = useState(valuesText);
  const [params, setParams] = useState<ParamValues>(() => ({
    ...defaultParams(op),
    ...(initialParams ?? {}),
  }));

  /* Selecting a module resets the operation, the sample values and the params
     together: they are one coherent starting point, and carrying a stale param
     across a module change produced nonsense frames in the prototype. */
  const selectModule = useCallback((nextKey: string) => {
    const next = MODULES[nextKey];
    if (!next) return;
    const nextOpKey = firstOpKey(nextKey) ?? Object.keys(next.ops)[0];
    const sample = next.sample ?? "";
    setModuleKey(nextKey);
    setOpKey(nextOpKey);
    setValuesText(sample);
    setValuesDraft(sample);
    setParams(defaultParams(next.ops[nextOpKey] ?? null));
  }, []);

  const selectOp = useCallback(
    (nextOpKey: string) => {
      const next = module.ops[nextOpKey];
      if (!next) return;
      setOpKey(nextOpKey);
      setParams(defaultParams(next));
    },
    [module],
  );

  const commitValues = useCallback(() => setValuesText(valuesDraft), [valuesDraft]);

  /* -------------------------------------------------------------------- */
  /* Generation                                                           */
  /* -------------------------------------------------------------------- */

  /**
   * Run the algorithm.
   *
   * The context is rebuilt for every run, so the tree or heap a previous
   * operation left behind cannot leak into this one. Operations that legitimately
   * refuse their input return a frame saying why; a thrown error is a real bug,
   * and it is reported as one rather than swallowed into an empty canvas.
   */
  const { frames, generationError } = useMemo((): { frames: Frame[]; generationError: unknown } => {
    if (!op) return { frames: [], generationError: null };
    try {
      const values = module.usesValues ? parseValues(valuesText) : [];
      return { frames: op.generate(values, params, createLabContext()), generationError: null };
    } catch (error) {
      return { frames: [], generationError: error };
    }
  }, [module, op, params, valuesText]);

  const player = useLabPlayer(frames, reducedMotion);

  /* -------------------------------------------------------------------- */
  /* Scene lifecycle                                                      */
  /* -------------------------------------------------------------------- */

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<LabScene | null>(null);
  const [sceneError, setSceneError] = useState<unknown>(null);

  useEffect(() => {
    if (!webgl || !canvasRef.current) return;
    let scene: LabScene | null = null;
    try {
      scene = new LabScene(canvasRef.current, {
        reducedMotion,
        onContextLost: () => setContextLost(true),
      });
    } catch (error) {
      setSceneError(error);
      return;
    }
    sceneRef.current = scene;
    return () => {
      scene?.dispose();
      sceneRef.current = null;
    };
    /* Mount once. `reducedMotion` is forwarded through `setReducedMotion` below
       rather than by rebuilding the renderer, which would drop the student's
       camera position every time the OS setting changed. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl]);

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    sceneRef.current?.setFrame(player.frame);
  }, [player.frame]);

  /* -------------------------------------------------------------------- */
  /* Derived view data                                                    */
  /* -------------------------------------------------------------------- */

  const opGroups = useMemo(() => groupOps(module.ops), [module]);

  /* -------------------------------------------------------------------- */
  /* Unavailable / broken states                                          */
  /* -------------------------------------------------------------------- */

  /* Every hook above this line runs unconditionally. `sceneError` can flip from
     null to set after a failed construction, so an early return placed before a
     hook would change the hook count between renders. */
  if (!webgl || sceneError) {
    return (
      <ErrorState
        className="surface-card"
        error={
          "This visualiser needs WebGL, and this browser is not providing it. That usually means " +
          "hardware acceleration is switched off, or a managed device policy blocks it. The written " +
          "explanation and worked examples on the lesson page do not need WebGL."
        }
      />
    );
  }

  const pseudocode = op?.pseudocode ?? [];
  const codeLine = player.frame?.codeLine ?? -1;
  /* Guard rather than trust: an out-of-range `codeLine` highlights nothing
     instead of throwing in the middle of a lesson. */
  const activeLine = codeLine >= 0 && codeLine < pseudocode.length ? codeLine : -1;

  return (
    <div className={cn("grid gap-4", showModulePicker && "lg:grid-cols-[14rem_minmax(0,1fr)]")}>
      {showModulePicker ? (
        <aside className="rounded-xl border border-border/60 bg-card/40 p-2 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {SECTIONS.map((section) => (
            <div key={section.label} className="mb-3 last:mb-0">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
                {section.keys
                  .filter((key) => MODULES[key])
                  .map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectModule(key)}
                      aria-current={key === moduleKey}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        key === moduleKey
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <span aria-hidden className="text-sm leading-none">
                        {MODULES[key].icon}
                      </span>
                      <span className="truncate">{MODULES[key].label}</span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </aside>
      ) : null}

      <div className="min-w-0 space-y-4">
        {/* Operations */}
        <Card className="surface-card">
          <CardContent className="space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-sm font-semibold">
                <span aria-hidden className="mr-1.5">
                  {module.icon}
                </span>
                {module.label}
              </h2>
              <span className="text-xs text-muted-foreground">
                {Object.keys(module.ops).length} operations
              </span>
            </div>

            {opGroups.map((group) => (
              <div key={group.label}>
                <p className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.entries.map(([key, definition]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectOp(key)}
                      aria-current={key === opKey}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        key === opKey
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      {definition.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Input */}
        {module.usesValues || (op?.params.length ?? 0) > 0 ? (
          <Card className="surface-card">
            <CardContent className="flex flex-wrap items-end gap-3 p-3 sm:p-4">
              {module.usesValues ? (
                <div className="min-w-[14rem] flex-[2]">
                  <Label htmlFor="lab-values" className="text-[11px] font-medium text-muted-foreground">
                    Values
                  </Label>
                  <Input
                    id="lab-values"
                    value={valuesDraft}
                    onChange={(event) => setValuesDraft(event.target.value)}
                    onBlur={commitValues}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitValues();
                    }}
                    placeholder={module.sample ?? "5, 3, 8, 1"}
                    className="mt-1 h-9 font-mono text-sm"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Commas or spaces. Press Enter to run.
                  </p>
                </div>
              ) : null}

              {op?.params.map((param) => (
                <ParamField
                  key={param.key}
                  param={param}
                  value={params[param.key] ?? param.default}
                  onCommit={(next) => setParams((current) => ({ ...current, [param.key]: next }))}
                />
              ))}

              <Button variant="outline" size="sm" className="h-9" onClick={commitValues}>
                Run
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Canvas + narration */}
        <Card className="surface-card overflow-hidden">
          <CardContent className="p-0">
            <div className="relative h-[clamp(18rem,50vh,32rem)] w-full bg-[#020617]">
              <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />

              {contextLost ? (
                <div className="absolute inset-0 grid place-items-center bg-background/90 p-4">
                  <ErrorState
                    error="The browser took the 3-D context away — this usually happens when the GPU is under pressure or the tab was backgrounded for a long time. Reload the page to get it back."
                    onRetry={() => window.location.reload()}
                  />
                </div>
              ) : null}
            </div>

            {/* Controls */}
            <div className="space-y-3 border-t border-border/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={player.prev}
                  disabled={player.index === 0}
                  aria-label="Previous step"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <Button size="icon" onClick={player.toggle} aria-label={player.playing ? "Pause" : "Play"}>
                  {player.playing ? (
                    <Pause className="h-4 w-4" aria-hidden />
                  ) : (
                    <Play className="h-4 w-4" aria-hidden />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={player.next}
                  disabled={player.atEnd}
                  aria-label="Next step"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
                <Button size="icon" variant="ghost" onClick={player.restart} aria-label="Restart">
                  <RotateCcw className="h-4 w-4" aria-hidden />
                </Button>

                <span className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
                  {player.total ? player.index + 1 : 0} / {player.total}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => sceneRef.current?.resetView()}
                  >
                    Reset view
                  </Button>
                  <span className="hidden text-xs text-muted-foreground sm:inline">Delay</span>
                  <div className="w-20">
                    <Slider
                      value={[player.speedMs]}
                      onValueChange={([value]) => player.setSpeedMs(value)}
                      min={SPEED_MIN}
                      max={SPEED_MAX}
                      step={SPEED_STEP}
                      aria-label="Step delay in milliseconds"
                    />
                  </div>
                  <span className="w-12 font-mono text-xs tabular-nums text-muted-foreground">
                    {player.speedMs}ms
                  </span>
                </div>
              </div>

              <Slider
                value={[player.index]}
                onValueChange={([value]) => player.seek(value)}
                min={0}
                max={Math.max(0, player.total - 1)}
                step={1}
                aria-label="Step"
                disabled={player.total <= 1}
              />

              {/* The narration. Real text, announced on every step. */}
              <div
                aria-live="polite"
                className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm leading-relaxed"
              >
                {generationError ? (
                  <span className="text-destructive">
                    This operation failed to run: {String((generationError as Error)?.message ?? generationError)}
                  </span>
                ) : (
                  (player.frame?.description ?? "Choose an operation to begin.")
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Arrow keys step, space plays. Drag to orbit, scroll to zoom.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pseudocode + complexity */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card className="surface-card">
            <CardContent className="p-3 sm:p-4">
              <p className="pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pseudocode
              </p>
              {pseudocode.length ? (
                <ol className="space-y-0.5">
                  {pseudocode.map((line, lineIndex) => (
                    <li
                      key={lineIndex}
                      className={cn(
                        "whitespace-pre-wrap rounded px-2 py-0.5 font-mono text-xs leading-relaxed transition-colors",
                        lineIndex === activeLine
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {line}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-muted-foreground">No pseudocode for this operation.</p>
              )}
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardContent className="p-3 sm:p-4">
              <p className="pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Complexity
              </p>
              {op && Object.keys(op.complexity).length ? (
                <dl className="space-y-1.5">
                  {Object.entries(op.complexity).map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-3">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-right font-mono text-xs font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-xs text-muted-foreground">Not recorded for this operation.</p>
              )}

              {reducedMotion ? (
                <Badge variant="outline" className="mt-3 text-[10px]">
                  Reduced motion on — autoplay and orbit are off
                </Badge>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {!op ? (
          <EmptyState
            title="That operation is not registered"
            description={`The module "${module.label}" has no operation called "${opKey}". Pick one from the list above.`}
          />
        ) : null}
      </div>
    </div>
  );
};

export default DsaLab;
