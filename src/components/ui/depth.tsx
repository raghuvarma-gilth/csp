import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The 3D depth primitives.
 *
 * Everything here is CSS transforms, not WebGL. A learning app is mostly text,
 * and a canvas behind prose costs frames for nothing — real 3D is reserved for
 * the three places where the extra dimension carries meaning (the landing
 * hero, the roadmap DAG, the achievement shelf).
 */

/**
 * Tracks the OS reduced-motion setting, and keeps tracking it: a student who
 * turns it on mid-session should not have to reload to be taken seriously.
 */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
};

interface TiltProps {
  children: ReactNode;
  className?: string;
  /** Maximum rotation on either axis, in degrees. Past ~10 it reads as a gimmick. */
  max?: number;
  /** How far the plate rises toward the viewer on hover, in px. */
  lift?: number;
  scale?: number;
  /** Extra classes for the rotating plate itself (radius, height, etc.). */
  plateClassName?: string;
}

/**
 * A surface that tilts toward the pointer.
 *
 * The rotation is written straight onto the element as CSS custom properties
 * in the pointermove handler — no `useState`, so a grid of twenty of these
 * re-renders exactly zero times while the mouse crosses it. The transform
 * itself lives in `.tilt-plate` (src/index.css) and reads those properties,
 * which means reduced-motion can neutralise it with a variable override and
 * nothing in JS needs to know.
 *
 * Mouse only: a pointermove from a finger is a scroll gesture, and tilting the
 * card the user is trying to drag past is not depth, it is noise.
 */
export const Tilt = ({
  children,
  className,
  max = 7,
  lift = 12,
  scale = 1.015,
  plateClassName,
}: TiltProps) => {
  const plate = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const handleMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse") return;
      const node = plate.current;
      if (!node) return;

      const box = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;

      // Y-pointer drives X-rotation: moving the mouse up should tip the top of
      // the card away from you, so the sign is inverted.
      node.style.setProperty("--tilt-x", `${(0.5 - y) * max * 2}deg`);
      node.style.setProperty("--tilt-y", `${(x - 0.5) * max * 2}deg`);
      node.style.setProperty("--tilt-z", `${lift}px`);
      node.style.setProperty("--tilt-scale", `${scale}`);
      node.style.setProperty("--pointer-x", `${x * 100}%`);
      node.style.setProperty("--pointer-y", `${y * 100}%`);
    },
    [max, lift, scale],
  );

  const handleLeave = useCallback(() => {
    const node = plate.current;
    if (!node) return;
    node.style.setProperty("--tilt-x", "0deg");
    node.style.setProperty("--tilt-y", "0deg");
    node.style.setProperty("--tilt-z", "0px");
    node.style.setProperty("--tilt-scale", "1");
  }, []);

  if (reduced) {
    return <div className={cn("tilt-scene", className)}>{children}</div>;
  }

  return (
    <div
      className={cn("tilt-scene", className)}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <div ref={plate} className={cn("tilt-plate h-full", plateClassName)}>
        {children}
      </div>
    </div>
  );
};

/**
 * A raised plate at a fixed elevation. Use when something should look lifted
 * but must not move — headers, panels, anything the eye rests on.
 */
export const Plate = ({
  level = 2,
  className,
  children,
}: {
  level?: 0 | 1 | 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "rounded-2xl bg-card",
      level === 0 && "depth-0",
      level === 1 && "depth-1",
      level === 2 && "depth-2",
      level === 3 && "depth-3",
      level === 4 && "depth-4",
      className,
    )}
  >
    {children}
  </div>
);

export default Tilt;
