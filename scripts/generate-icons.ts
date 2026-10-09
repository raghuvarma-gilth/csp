/**
 * Generates public/favicon.ico and public/apple-touch-icon.png from the
 * EduVerse mark. Run with `npm run icons` after changing public/favicon.svg.
 *
 * Why this exists rather than a dependency: the project has no rasteriser
 * installed (no sharp, canvas or resvg), and adding one to redraw four small
 * geometric shapes would pull a native binary into the install for a file that
 * changes roughly never. The mark is a rounded rectangle, a quadrilateral, a
 * half-ellipse and a circle — shapes whose coverage is cheaper to compute
 * directly than to delegate.
 *
 * The .ico is still needed even though browsers prefer the SVG. Safari before
 * 17 ignores `rel="icon"` with an SVG type, and crawlers, feed readers and RSS
 * clients request /favicon.ico by path regardless of what the HTML declares.
 *
 * Geometry is duplicated from public/favicon.svg. It is kept as literals in
 * both places on purpose: parsing SVG path data would mean implementing a
 * Bezier flattener, which is more code than the shapes themselves.
 */

import { writeFileSync } from "fs";
import { resolve } from "path";
import { deflateSync } from "zlib";

/** Side of the design-space square every coordinate below is expressed in. */
const DESIGN = 64;

/** `--gradient-primary` from src/index.css: 135deg, so top-left to bottom-right. */
const GRADIENT_FROM = [0x04, 0x74, 0x90];
const GRADIENT_TO = [0x0c, 0x60, 0xc0];

/** `rounded-xl` on the in-app tile, carried over proportionally. */
const TILE_RADIUS = 14;

/** Subsamples per axis. 4 gives 16 coverage levels, enough to hide stairsteps. */
const SUPERSAMPLE = 4;

type Point = readonly [number, number];

/** The mortarboard, as drawn in public/favicon.svg. */
const BOARD: readonly Point[] = [
  [7, 27],
  [32, 15],
  [57, 27],
  [32, 39],
];

const CROWN = { left: 22, right: 42, top: 33, waist: 39, radiusX: 10, radiusY: 6.5 };
const TASSEL_BAR = { left: 50.5, right: 54.5, top: 25, bottom: 42, radius: 2 };
const TASSEL_BALL = { x: 52.5, y: 45, radius: 4.5 };

/** Even-odd ray cast. The mark has no self-intersecting outlines, so this is exact. */
function inPolygon(x: number, y: number, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function inRoundedRect(
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
): boolean {
  if (x < left || x > right || y < top || y > bottom) return false;
  // Clamp to the rectangle inset by the radius; outside that inset the nearest
  // inner point is a corner centre, so the test reduces to one circle check.
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/** True inside the white cap: board, crown, tassel bar or tassel ball. */
function inGlyph(x: number, y: number): boolean {
  if (inPolygon(x, y, BOARD)) return true;
  if (x >= CROWN.left && x <= CROWN.right && y >= CROWN.top && y <= CROWN.waist) return true;
  if (y >= CROWN.waist && inEllipse(x, y, 32, CROWN.waist, CROWN.radiusX, CROWN.radiusY)) return true;
  if (
    inRoundedRect(x, y, TASSEL_BAR.left, TASSEL_BAR.top, TASSEL_BAR.right, TASSEL_BAR.bottom, TASSEL_BAR.radius)
  ) {
    return true;
  }
  return inEllipse(x, y, TASSEL_BALL.x, TASSEL_BALL.y, TASSEL_BALL.radius, TASSEL_BALL.radius);
}

/**
 * Renders the mark at `size` px as straight-alpha RGBA.
 *
 * `bleed` drops the rounded corners and fills the square edge to edge. iOS
 * applies its own corner mask to apple-touch-icon.png, so supplying rounded
 * corners there produces a tile with the background showing through a second,
 * smaller radius.
 */
export function render(size: number, bleed: boolean): Buffer {
  const out = Buffer.alloc(size * size * 4);
  const scale = DESIGN / size;
  const step = 1 / SUPERSAMPLE;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) * step) * scale;
          const y = (py + (sy + 0.5) * step) * scale;

          if (!bleed && !inRoundedRect(x, y, 0, 0, DESIGN, DESIGN, TILE_RADIUS)) continue;

          alpha += 1;
          if (inGlyph(x, y)) {
            red += 255;
            green += 255;
            blue += 255;
          } else {
            // Project onto the top-left/bottom-right diagonal for the 135deg ramp.
            const t = (x + y) / (2 * DESIGN);
            red += GRADIENT_FROM[0] + (GRADIENT_TO[0] - GRADIENT_FROM[0]) * t;
            green += GRADIENT_FROM[1] + (GRADIENT_TO[1] - GRADIENT_FROM[1]) * t;
            blue += GRADIENT_FROM[2] + (GRADIENT_TO[2] - GRADIENT_FROM[2]) * t;
          }
        }
      }

      const offset = (py * size + px) * 4;
      if (alpha === 0) continue;
      // Un-premultiply: the colour is the average over covered subsamples only,
      // so a partly covered edge pixel keeps its full-strength hue.
      out[offset] = Math.round(red / alpha);
      out[offset + 1] = Math.round(green / alpha);
      out[offset + 2] = Math.round(blue / alpha);
      out[offset + 3] = Math.round((alpha / samples) * 255);
    }
  }

  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const tagged = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tagged));
  return Buffer.concat([length, tagged, crc]);
}

export function encodePng(size: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // compression, filter and interlace all take their default 0.

  // One filter byte per scanline. Filter 0 (None) keeps the encoder trivial;
  // deflate still gets the flat background down to a few hundred bytes.
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Packs BMP-backed images into an .ico. Each entry carries a
 * BITMAPINFOHEADER whose height is doubled, because the format expects the
 * colour rows to be followed by a 1bpp AND mask. The mask is left zeroed:
 * 32bpp entries carry their own alpha and every renderer still in use honours
 * it, but the bytes have to be present or the directory offsets do not line up.
 */
function encodeIco(images: readonly { size: number; rgba: Buffer }[]): Buffer {
  const directory = Buffer.alloc(6 + 16 * images.length);
  directory.writeUInt16LE(0, 0); // reserved
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(images.length, 4);

  const bodies = images.map(({ size, rgba }) => {
    const header = Buffer.alloc(40);
    header.writeUInt32LE(40, 0);
    header.writeInt32LE(size, 4);
    header.writeInt32LE(size * 2, 8);
    header.writeUInt16LE(1, 12); // planes
    header.writeUInt16LE(32, 14); // bits per pixel

    // BMP rows run bottom-up and channels are ordered BGRA.
    const pixels = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      const source = (size - 1 - y) * size * 4;
      for (let x = 0; x < size; x++) {
        const from = source + x * 4;
        const to = (y * size + x) * 4;
        pixels[to] = rgba[from + 2];
        pixels[to + 1] = rgba[from + 1];
        pixels[to + 2] = rgba[from];
        pixels[to + 3] = rgba[from + 3];
      }
    }

    const maskStride = Math.ceil(size / 32) * 4;
    return Buffer.concat([header, pixels, Buffer.alloc(maskStride * size)]);
  });

  let offset = directory.length;
  bodies.forEach((body, index) => {
    const entry = 6 + index * 16;
    const { size } = images[index];
    directory[entry] = size >= 256 ? 0 : size; // 0 encodes 256
    directory[entry + 1] = size >= 256 ? 0 : size;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(body.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += body.length;
  });

  return Buffer.concat([directory, ...bodies]);
}

const publicDir = resolve(process.cwd(), "public");

// 16 for legacy tab bars, 32 for the common hidpi tab, 48 for Windows shortcuts.
const ICO_SIZES = [16, 32, 48];
const ico = encodeIco(ICO_SIZES.map((size) => ({ size, rgba: render(size, false) })));
writeFileSync(resolve(publicDir, "favicon.ico"), ico);

const APPLE_SIZE = 180;
const apple = encodePng(APPLE_SIZE, render(APPLE_SIZE, true));
writeFileSync(resolve(publicDir, "apple-touch-icon.png"), apple);

console.log(
  `[icons] favicon.ico (${ICO_SIZES.join("/")}px, ${ico.length} bytes), ` +
    `apple-touch-icon.png (${APPLE_SIZE}px, ${apple.length} bytes)`,
);
