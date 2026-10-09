/**
 * The three.js building blocks every renderer draws with.
 *
 * This is the first file in the lab that imports three.js. Everything under
 * `algorithms/` deliberately does not, which is what lets `scripts/verify-lab.ts`
 * execute all of it in Node; the split is worth preserving.
 *
 * Ported from the standalone prototype's shared helpers, with three changes:
 *
 *   * `fitCameraToExtent` takes the camera and controls as an argument instead of
 *     closing over module-level globals, so two labs on one page cannot fight
 *     over one camera.
 *   * Text textures declare `SRGBColorSpace`. The prototype ran on r128 where the
 *     renderer's output was linear by default; from r152 `outputColorSpace` is
 *     sRGB, and an undeclared canvas texture renders visibly washed out.
 *   * Captions are passed in as strings rather than array indices, so the same
 *     cube can be labelled `[3]`, `'k'` or `r2c4` depending on what is being
 *     taught.
 */

import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera,
  SRGBColorSpace,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from "three";

import type { Hex } from "./types";

/** Default cube/node colour — matches `C.base`, as an int. */
export const BASE_COLOR = 0x2563eb;
/** Edges, grid lines, anything structural rather than semantic. */
export const STRUCTURE_COLOR = 0x475569;

export const hexToInt = (hex: Hex | number | undefined | null, fallback = BASE_COLOR): number => {
  if (typeof hex === "number") return hex;
  if (!hex) return fallback;
  const parsed = Number.parseInt(String(hex).replace("#", ""), 16);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const intToCss = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

const TEXTURE_SIZE = 512;

export interface LabelOptions {
  color?: string;
  fontSize?: number;
  outlineColor?: string | null;
  outlineWidth?: number;
  /** Sprite width in world units. */
  width?: number;
  /** Sprite height in world units. */
  height?: number;
  opacity?: number;
}

/**
 * Text is condensed to fit rather than clipped, so a long row label degrades to
 * something narrow and still legible instead of losing its last few characters.
 */
const FIT_WIDTH = TEXTURE_SIZE * 0.92;

/**
 * Text rasterised onto a canvas and handed over as a texture. The heavy black
 * outline is not decoration: labels are drawn with `depthTest: false` so they
 * stay readable through the geometry, and without an outline they vanish
 * against a same-coloured cube.
 */
export function makeTextTexture(text: string, opts: LabelOptions = {}): CanvasTexture {
  const { color = "#ffffff", fontSize = 100, outlineColor = null, outlineWidth = 0 } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    ctx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (outlineColor && outlineWidth > 0) {
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = outlineWidth;
      ctx.strokeText(text, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, FIT_WIDTH);
    }

    ctx.fillStyle = color;
    ctx.fillText(text, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, FIT_WIDTH);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** A floating text sprite that always faces the camera and is never occluded. */
export function createLabel(text: string, opts: LabelOptions = {}): Sprite {
  const sprite = new Sprite(
    new SpriteMaterial({
      map: makeTextTexture(text, opts),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      opacity: opts.opacity ?? 1,
    }),
  );
  sprite.scale.set(opts.width ?? 2.1, opts.height ?? 2.1, 1);
  sprite.renderOrder = 999;
  return sprite;
}

/* -------------------------------------------------------------------------- */
/* Cubes — the array element                                                   */
/* -------------------------------------------------------------------------- */

export interface CubeOptions {
  /** Text under the cube. `null` draws none. */
  caption?: string | null;
  size?: number;
  /** Translucent, for a secondary row or a node being detached. */
  dim?: boolean;
}

/**
 * One array slot. A box, its white wireframe so adjacent cubes of the same
 * colour stay distinguishable, the value on top, and the index underneath —
 * because "the third element" and "index 2" being the same thing is most of what
 * an array visualisation has to teach.
 */
export function createCube(value: string | number, colorInt: number, opts: CubeOptions = {}): Group {
  const { caption = null, size = 2.5, dim = false } = opts;
  const group = new Group();

  const geometry = new BoxGeometry(size, size, size);
  const material = new MeshStandardMaterial({
    color: colorInt,
    roughness: 0.3,
    metalness: 0.15,
    transparent: dim,
    opacity: dim ? 0.45 : 1,
  });
  const cube = new Mesh(geometry, material);
  cube.castShadow = !dim;
  cube.receiveShadow = true;
  group.add(cube);

  group.add(
    new LineSegments(
      new EdgesGeometry(geometry),
      new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: dim ? 0.3 : 0.7 }),
    ),
  );

  const text = String(value);
  if (text.length) {
    const scale = (size / 2.5) * 2.1;
    group.add(
      createLabel(text, {
        color: "#fde047",
        fontSize: text.length > 2 ? 100 : 150,
        outlineColor: "#000000",
        outlineWidth: 20,
        width: scale,
        height: scale,
        opacity: dim ? 0.75 : 1,
      }),
    );
  }

  if (caption !== null && caption !== "") {
    const sprite = createLabel(caption, {
      color: "#e2e8f0",
      fontSize: 60,
      outlineColor: "#000000",
      outlineWidth: 8,
      width: 1.6 * (size / 2.5),
      height: 0.6 * (size / 2.5),
    });
    sprite.position.y = -(size / 2.5) * 1.9;
    group.add(sprite);
  }

  return group;
}

/* -------------------------------------------------------------------------- */
/* Pointers                                                                    */
/* -------------------------------------------------------------------------- */

/** A labelled arrow that hangs above whatever it points at: `i`, `left`, `slow`. */
export function createPointer(colorInt: number, label: string): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({
    color: colorInt,
    emissive: colorInt,
    emissiveIntensity: 0.5,
  });

  const shaft = new Mesh(new CylinderGeometry(0.12, 0.12, 2.8, 20), material);
  shaft.position.y = 3.8;
  group.add(shaft);

  const head = new Mesh(new ConeGeometry(0.5, 1, 24), material);
  head.position.y = 2.2;
  head.rotation.x = Math.PI;
  group.add(head);

  const sprite = createLabel(label, { color: intToCss(colorInt), fontSize: 65, width: 2.6, height: 0.9 });
  sprite.position.y = 5.6;
  group.add(sprite);

  return group;
}

/* -------------------------------------------------------------------------- */
/* Spheres — list, tree and graph nodes                                        */
/* -------------------------------------------------------------------------- */

export interface SphereOptions {
  /** A chip to the upper right: an AVL balance factor, a Dijkstra distance. */
  badge?: string | null;
  /** A caption below: a segment tree's range, a trie's word marker. */
  subLabel?: string | null;
  /** Translucent — a position not yet filled, or a call not yet made. */
  ghost?: boolean;
  radius?: number;
}

export function createSphereNode(label: string, colorInt: number, opts: SphereOptions = {}): Group {
  const { badge = null, subLabel = null, ghost = false, radius = 1.15 } = opts;
  const group = new Group();

  const sphere = new Mesh(
    new SphereGeometry(radius, 24, 24),
    new MeshStandardMaterial({
      color: colorInt,
      roughness: 0.3,
      metalness: 0.15,
      transparent: ghost,
      opacity: ghost ? 0.28 : 1,
    }),
  );
  sphere.castShadow = !ghost;
  sphere.receiveShadow = true;
  group.add(sphere);

  const text = String(label);
  group.add(
    createLabel(text, {
      color: "#fde047",
      fontSize: text.length > 3 ? 80 : 110,
      outlineColor: "#000000",
      outlineWidth: 18,
      width: 1.8,
      height: 1.8,
      opacity: ghost ? 0.5 : 1,
    }),
  );

  if (badge) {
    const sprite = createLabel(badge, {
      color: "#38bdf8",
      fontSize: 62,
      outlineColor: "#000000",
      outlineWidth: 10,
      width: 2.2,
      height: 0.8,
      opacity: ghost ? 0.5 : 1,
    });
    sprite.position.set(radius + 0.9, radius + 0.5, 0);
    group.add(sprite);
  }

  if (subLabel) {
    const sprite = createLabel(subLabel, {
      color: "#94a3b8",
      fontSize: 54,
      outlineColor: "#000000",
      outlineWidth: 8,
      width: 2.6,
      height: 0.7,
      opacity: ghost ? 0.5 : 1,
    });
    sprite.position.y = -(radius + 0.75);
    group.add(sprite);
  }

  return group;
}

/* -------------------------------------------------------------------------- */
/* Edges                                                                       */
/* -------------------------------------------------------------------------- */

export function createEdgeLine(a: Vector3, b: Vector3, colorInt: number): Line {
  return new Line(
    new BufferGeometry().setFromPoints([a, b]),
    new LineBasicMaterial({ color: colorInt }),
  );
}

/**
 * A directed edge: a line stopping short of the target node plus a cone at the
 * end. `ArrowHelper` would do, but it disposes awkwardly and cannot be pulled
 * back off the node surface, which matters when nodes are 1.15 units across.
 */
export function createDirectedEdge(a: Vector3, b: Vector3, colorInt: number, gap = 1.35): Group {
  const group = new Group();
  const direction = new Vector3().subVectors(b, a);
  const length = direction.length();
  if (length < 1e-6) return group;
  direction.normalize();

  const tip = new Vector3().copy(b).addScaledVector(direction, -gap);
  group.add(createEdgeLine(a.clone(), tip, colorInt));

  const head = new Mesh(
    new ConeGeometry(0.28, 0.85, 16),
    new MeshStandardMaterial({ color: colorInt, emissive: colorInt, emissiveIntensity: 0.35 }),
  );
  head.position.copy(tip);
  head.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
  group.add(head);

  return group;
}

/** A weight sitting at the midpoint of an edge, nudged up so the line does not cut it. */
export function createEdgeLabel(a: Vector3, b: Vector3, text: string, colorInt: number): Sprite {
  const sprite = createLabel(text, {
    color: intToCss(colorInt),
    fontSize: 70,
    outlineColor: "#000000",
    outlineWidth: 12,
    width: 1.5,
    height: 1.5,
  });
  sprite.position.copy(a).add(b).multiplyScalar(0.5);
  sprite.position.y += 0.9;
  return sprite;
}

/* -------------------------------------------------------------------------- */
/* Grids, hash buckets and towers                                              */
/* -------------------------------------------------------------------------- */

export interface TileOptions {
  size?: number;
  /** Stands the tile up — a wall in a maze, a queen on a board. */
  raised?: boolean;
  label?: string | null;
}

/**
 * A flat cell for the grid renderer. Deliberately a slab rather than a cube:
 * a 2-D table read from above should look like a table, and a raised tile then
 * reads unambiguously as "different".
 */
export function createTile(value: string | number, colorInt: number, opts: TileOptions = {}): Group {
  const { size = 2.4, raised = false } = opts;
  const group = new Group();
  const height = raised ? size * 0.9 : 0.4;

  const geometry = new BoxGeometry(size, height, size);
  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({ color: colorInt, roughness: 0.35, metalness: 0.1 }),
  );
  mesh.position.y = height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const edges = new LineSegments(
    new EdgesGeometry(geometry),
    new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
  );
  edges.position.y = height / 2;
  group.add(edges);

  const text = String(value);
  if (text.length) {
    const sprite = createLabel(text, {
      color: "#fde047",
      fontSize: text.length > 2 ? 95 : 130,
      outlineColor: "#000000",
      outlineWidth: 18,
      width: size * 0.7,
      height: size * 0.7,
    });
    sprite.position.y = height + 0.35;
    group.add(sprite);
  }

  return group;
}

/** The ring drawn around the cell a DP table is currently writing. */
export function createCursorRing(colorInt: number, radius = 1.7): Mesh {
  const ring = new Mesh(
    new TorusGeometry(radius, 0.09, 10, 40),
    new MeshBasicMaterial({ color: colorInt, transparent: true, opacity: 0.9, side: DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

/** A translucent slab marking a row/column header or a bucket floor. */
export function createPlate(width: number, depth: number, colorInt: number, opacity = 0.12): Mesh {
  const plate = new Mesh(
    new BoxGeometry(width, 0.12, depth),
    new MeshBasicMaterial({ color: colorInt, transparent: true, opacity }),
  );
  return plate;
}

/** One Hanoi disk. Radius scales with disk size so "larger" is literally larger. */
export function createDisk(size: number, maxSize: number, colorInt: number): Group {
  const group = new Group();
  const radius = 0.9 + (size / Math.max(1, maxSize)) * 2.1;
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, 0.8, 40),
    new MeshStandardMaterial({ color: colorInt, roughness: 0.3, metalness: 0.2 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  group.add(
    createLabel(String(size), {
      color: "#0f172a",
      fontSize: 110,
      outlineColor: "#f8fafc",
      outlineWidth: 12,
      width: 1.3,
      height: 1.3,
    }),
  );
  return group;
}

/** A Hanoi peg: the post plus its base. */
export function createPeg(height: number, label: string): Group {
  const group = new Group();
  const post = new Mesh(
    new CylinderGeometry(0.22, 0.22, height, 18),
    new MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.4 }),
  );
  post.position.y = height / 2;
  post.castShadow = true;
  group.add(post);

  const base = new Mesh(
    new CylinderGeometry(3.4, 3.4, 0.4, 40),
    new MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.3 }),
  );
  base.position.y = 0.2;
  base.receiveShadow = true;
  group.add(base);

  const sprite = createLabel(label, {
    color: "#e2e8f0",
    fontSize: 90,
    outlineColor: "#000000",
    outlineWidth: 12,
    width: 1.6,
    height: 1.6,
  });
  sprite.position.y = height + 1.2;
  group.add(sprite);

  return group;
}

/* -------------------------------------------------------------------------- */
/* Camera                                                                      */
/* -------------------------------------------------------------------------- */

/** The subset of `OrbitControls` the fit helper touches. */
export interface OrbitLike {
  target: Vector3;
  maxDistance: number;
  update(): unknown;
}

export interface CameraRig {
  camera: PerspectiveCamera;
  controls: OrbitLike;
}

/**
 * What a renderer is handed. Everything added to `group` is disposed before the
 * next frame is drawn, so a renderer never has to clean up after itself.
 */
export interface RenderContext {
  group: Group;
  rig: CameraRig;
}

/**
 * Pull the camera back far enough to see `extent`, but never push it in — a
 * student who has zoomed into a subtree should not be yanked out again on the
 * next step.
 */
export function fitCameraToExtent(rig: CameraRig, extent: number): void {
  const needed = Math.max(20, extent);
  const offset = new Vector3().subVectors(rig.camera.position, rig.controls.target);
  const current = offset.length() || 1;
  if (current < needed) {
    offset.multiplyScalar(needed / current);
    rig.camera.position.copy(rig.controls.target).add(offset);
  }
  rig.controls.maxDistance = Math.max(150, needed * 2.5);
  rig.controls.update();
}

/* -------------------------------------------------------------------------- */
/* Disposal                                                                    */
/* -------------------------------------------------------------------------- */

interface Disposable {
  dispose?: () => void;
}

/**
 * Release the GPU memory an object owns. Meshes are rebuilt from scratch on
 * every frame, so skipping this leaks a few hundred buffers a minute — which is
 * exactly the kind of bug that only shows up after ten minutes of stepping.
 */
export function disposeObject(root: Object3D): void {
  root.traverse((obj) => {
    const withGeometry = obj as Object3D & { geometry?: Disposable };
    withGeometry.geometry?.dispose?.();

    const withMaterial = obj as Object3D & {
      material?: (Disposable & { map?: Disposable }) | Array<Disposable & { map?: Disposable }>;
    };
    const materials = Array.isArray(withMaterial.material)
      ? withMaterial.material
      : withMaterial.material
        ? [withMaterial.material]
        : [];
    materials.forEach((material) => {
      material.map?.dispose?.();
      material.dispose?.();
    });
  });
}
