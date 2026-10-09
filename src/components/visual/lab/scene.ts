/**
 * `LabScene` — the three.js scene that every lab visual is drawn into.
 *
 * Ported from the prototype's top-level scene block, with the module-level
 * globals it used (`scene`, `camera`, `renderer`, `controls`, `contentGroup`)
 * moved onto an instance. That is not tidying for its own sake: they were shared
 * mutable state, so two mounts of the lab on one page — a lesson and the free
 * explore page in a split view — would have fought over one camera.
 *
 * Four deliberate changes from the r128 prototype:
 *
 *   * `OrbitControls` is imported as an ES module. The r128 build attached it to
 *     the `THREE` global; that entry point no longer exists.
 *   * The two accent point lights are retuned. `WebGLRenderer.useLegacyLights`
 *     flipped to `false` in r155, so point-light intensity is now physical
 *     (candela) rather than an arbitrary multiplier — the old 1.1 and 0.9 would
 *     render as near-black. Scaling by 4π reproduces the prototype's look.
 *   * The canvas sizes to its **parent element** via `ResizeObserver`, not to
 *     `window`. The lab lives in a panel next to a narration column, so window
 *     dimensions were never the right answer.
 *   * The directional light gets an explicit shadow frustum. The default ±5
 *     orthographic box silently clipped shadows off everything wider than four
 *     array cells, which is most of the curriculum.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { disposeObject, type CameraRig } from "./primitives";
import { renderFrame } from "./renderers";
import type { Frame } from "./types";

/** The r155 lighting change: point-light intensity became physical. */
const PHYSICAL_LIGHT_SCALE = 4 * Math.PI;

const HOME_POSITION = new Vector3(0, 12, 28);
const HOME_TARGET = new Vector3(0, 0, 0);
const GROUND_Y = -4;

/**
 * Whether this browser can give us a WebGL context at all.
 *
 * Checked before mounting, because the lab is now the only visualiser — there is
 * no 2-D fallback to fall back to — and a student on a locked-down machine
 * deserves a real explanation instead of a black rectangle. The probe context is
 * released immediately; browsers cap the number of live contexts per page.
 */
export function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) return false;
    const lose = (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export interface LabSceneOptions {
  /** Called when the GPU takes the context away, so the UI can explain itself. */
  onContextLost?: () => void;
  /** `prefers-reduced-motion` — suppresses auto-rotation. */
  reducedMotion?: boolean;
}

export class LabScene {
  readonly rig: CameraRig;

  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly contentGroup: Group;
  private readonly canvas: HTMLCanvasElement;
  private readonly resizeObserver: ResizeObserver | null = null;
  private readonly onContextLostBound: (event: Event) => void;

  private frameHandle = 0;
  private disposed = false;
  private reducedMotion: boolean;

  constructor(canvas: HTMLCanvasElement, options: LabSceneOptions = {}) {
    this.canvas = canvas;
    this.reducedMotion = options.reducedMotion ?? false;

    this.scene = new Scene();
    this.scene.background = new Color(0x020617);

    this.camera = new PerspectiveCamera(45, 1, 0.1, 2000);
    this.camera.position.copy(HOME_POSITION);

    /* Throws if no context can be created — the caller probes first with
       `webglAvailable()` and shows a real error card instead. */
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 200;
    this.controls.target.copy(HOME_TARGET);

    this.rig = { camera: this.camera, controls: this.controls };

    this.scene.add(new AmbientLight(0xffffff, 1.2));

    const keyLight = new DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(6, 16, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -60;
    keyLight.shadow.camera.right = 60;
    keyLight.shadow.camera.top = 60;
    keyLight.shadow.camera.bottom = -60;
    keyLight.shadow.camera.far = 120;
    this.scene.add(keyLight);

    const frontLight = new PointLight(0x38bdf8, 1.1 * PHYSICAL_LIGHT_SCALE, 60);
    frontLight.position.set(0, 8, 16);
    this.scene.add(frontLight);

    const sideLight = new PointLight(0xa855f7, 0.9 * PHYSICAL_LIGHT_SCALE, 60);
    sideLight.position.set(16, 6, -10);
    this.scene.add(sideLight);

    const ground = new Mesh(
      new PlaneGeometry(300, 300),
      new MeshStandardMaterial({ color: 0x07111f, roughness: 0.7, metalness: 0.2 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = GROUND_Y;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new GridHelper(300, 60, 0x2563eb, 0x1e293b);
    grid.position.y = GROUND_Y + 0.02;
    this.scene.add(grid);

    this.contentGroup = new Group();
    this.scene.add(this.contentGroup);

    this.onContextLostBound = (event: Event) => {
      /* Prevent the default so the browser will attempt a restore, stop the loop
         so we are not drawing into a dead context, and tell the UI. */
      event.preventDefault();
      this.stopLoop();
      options.onContextLost?.();
    };
    canvas.addEventListener("webglcontextlost", this.onContextLostBound, false);

    const parent = canvas.parentElement;
    if (parent && typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(parent);
    }

    this.resize();
    this.startLoop();
  }

  /** Draw a frame. The previous frame's geometry is disposed, not reused. */
  setFrame(frame: Frame | null): void {
    if (this.disposed) return;
    renderFrame(frame, { group: this.contentGroup, rig: this.rig });
  }

  /** Slow orbit for the idle/"look at the shape" state. Off under reduced motion. */
  setAutoRotate(enabled: boolean): void {
    this.controls.autoRotate = enabled && !this.reducedMotion;
    this.controls.autoRotateSpeed = 0.6;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) this.controls.autoRotate = false;
  }

  /** Back to the opening camera. The next `setFrame` re-fits from there. */
  resetView(): void {
    this.camera.position.copy(HOME_POSITION);
    this.controls.target.copy(HOME_TARGET);
    this.controls.maxDistance = 200;
    this.controls.update();
  }

  resize(): void {
    if (this.disposed) return;
    const parent = this.canvas.parentElement;
    const width = Math.max(1, Math.floor(parent?.clientWidth ?? this.canvas.clientWidth));
    const height = Math.max(1, Math.floor(parent?.clientHeight ?? this.canvas.clientHeight));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      this.frameHandle = requestAnimationFrame(tick);
      /* Damping and auto-rotate both need `update()` every frame to advance. */
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.frameHandle = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
  }

  /**
   * Tear everything down. Without this, navigating between two lessons leaves a
   * renderer and a rAF loop running per visit — which is the failure mode that
   * only shows up after a student has read five pages.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.stopLoop();
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.onContextLostBound);

    renderFrame(null, { group: this.contentGroup, rig: this.rig });
    disposeObject(this.scene);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
