import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { buildTrace, type Cell, type Frame } from "@/components/visual/traces";
import { cn } from "@/lib/utils";

/**
 * The player for a single algorithm trace.
 *
 * This component is loaded on demand — it is the only place the trace builders
 * are imported, so none of this reaches the initial bundle.
 *
 * The frames it draws come from `buildTrace`, which runs the algorithm. The
 * player itself does no algorithmic work: it is a scrubber over a recording,
 * which is why stepping backwards is exact rather than approximate.
 */

const CELL_STYLE: Record<Cell["state"], string> = {
  idle: "border-border/70 bg-card text-foreground",
  active: "border-primary bg-primary/15 text-foreground shadow-sm",
  compare: "border-accent bg-accent/15 text-foreground",
  done: "border-success/60 bg-success/10 text-foreground",
  removed: "border-destructive/50 bg-destructive/10 text-muted-foreground line-through",
  window: "border-primary/50 bg-primary/5 text-foreground",
  ghost: "border-dashed border-border/50 bg-muted/30 text-muted-foreground",
};

const POINTER_STYLE = {
  primary: "text-primary",
  accent: "text-accent",
  warning: "text-warning",
} as const;

const CellRow = ({ cells, pointers }: Pick<Frame, "cells" | "pointers">) => {
  const byIndex = new Map<number, Frame["pointers"]>();
  for (const pointer of pointers) {
    const existing = byIndex.get(pointer.index) ?? [];
    existing.push(pointer);
    byIndex.set(pointer.index, existing);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {cells.map((cell, index) => (
        <div key={index} className="flex w-[52px] flex-col items-center gap-1">
          <div className="flex h-4 items-end gap-1 text-[10px] font-semibold leading-none">
            {(byIndex.get(index) ?? []).map((pointer) => (
              <span key={pointer.label} className={POINTER_STYLE[pointer.tone]}>
                {pointer.label}↓
              </span>
            ))}
          </div>
          <div
            className={cn(
              "grid h-12 w-full place-items-center rounded-lg border font-mono text-sm font-semibold transition-colors duration-200",
              CELL_STYLE[cell.state],
            )}
          >
            {cell.value}
          </div>
          <span className="font-mono text-[10px] leading-none text-muted-foreground">
            {cell.label ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
};

const AuxRow = ({ aux }: { aux: NonNullable<Frame["aux"]> }) => (
  <div className="space-y-1.5">
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {aux.label}
    </p>
    {aux.items.length === 0 ? (
      <div className="grid h-12 place-items-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
        empty
      </div>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {aux.items.map((item, index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "grid h-10 min-w-[52px] place-items-center rounded-lg border px-2 font-mono text-xs font-semibold transition-colors duration-200",
                CELL_STYLE[item.state],
              )}
            >
              {item.value}
            </div>
            <span className="text-[10px] leading-none text-muted-foreground">{item.label ?? ""}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export const TracePlayer = ({ visualKey }: { visualKey: string }) => {
  const trace = useMemo(() => buildTrace(visualKey), [visualKey]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<number>();

  const lastStep = (trace?.frames.length ?? 1) - 1;

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [visualKey]);

  useEffect(() => {
    if (!playing) return;
    if (step >= lastStep) {
      setPlaying(false);
      return;
    }
    timer.current = window.setTimeout(() => setStep((current) => current + 1), 1600 / speed);
    return () => window.clearTimeout(timer.current);
  }, [playing, step, lastStep, speed]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowRight") setStep((current) => Math.min(current + 1, lastStep));
      if (event.key === "ArrowLeft") setStep((current) => Math.max(current - 1, 0));
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((current) => !current);
      }
    },
    [lastStep],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  if (!trace) {
    return (
      <Card className="surface-card">
        <CardContent className="p-6 text-sm text-muted-foreground">
          There is no visualisation built for <code className="font-mono">{visualKey}</code>. The
          concept page still has the written explanation.
        </CardContent>
      </Card>
    );
  }

  const frame = trace.frames[Math.min(step, lastStep)];

  return (
    <div className="space-y-4">
      <Card className="surface-card">
        <CardContent className="space-y-5 overflow-x-auto p-4 sm:p-6">
          {frame.cells.length > 0 ? <CellRow cells={frame.cells} pointers={frame.pointers} /> : null}
          {frame.aux ? <AuxRow aux={frame.aux} /> : null}

          {frame.readout && frame.readout.length > 0 ? (
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-3">
              {frame.readout.map((item) => (
                <div key={item.label}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="font-mono text-sm font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="surface-card border-primary/20">
        <CardContent className="p-4">
          <p className="text-sm leading-relaxed" aria-live="polite">
            {frame.note}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3 rounded-xl border border-border/60 bg-card/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0}
            aria-label="Previous step"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            size="icon"
            onClick={() => {
              if (step >= lastStep) setStep(0);
              setPlaying((current) => !current);
            }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setStep((current) => Math.min(current + 1, lastStep))}
            disabled={step >= lastStep}
            aria-label="Next step"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setStep(0);
              setPlaying(false);
            }}
            aria-label="Restart"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </Button>

          <span className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
            {step + 1} / {trace.frames.length}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Speed</span>
            <div className="w-24">
              <Slider
                value={[speed]}
                onValueChange={([value]) => setSpeed(value)}
                min={0.5}
                max={3}
                step={0.5}
                aria-label="Playback speed"
              />
            </div>
            <span className="w-8 font-mono text-xs tabular-nums text-muted-foreground">{speed}×</span>
          </div>
        </div>

        <Slider
          value={[step]}
          onValueChange={([value]) => {
            setPlaying(false);
            setStep(value);
          }}
          min={0}
          max={lastStep}
          step={1}
          aria-label="Step"
        />

        <p className="text-[11px] text-muted-foreground">
          Arrow keys step, space plays. <Badge variant="outline" className="ml-1 font-mono text-[10px]">{trace.complexity}</Badge>
        </p>
      </div>
    </div>
  );
};

export default TracePlayer;
