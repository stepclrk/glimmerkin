import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import type { FastifyInstance } from 'fastify';

/**
 * What lets a phone keep the game on its home screen: a web app manifest and its icons. The icons are drawn
 * here in code, like everything else in Glimmerkin, and encoded as PNG once, the first time they are asked for.
 */

const INK = '#120d22';

export const MANIFEST = {
  name: 'Glimmerkin',
  short_name: 'Glimmerkin',
  description: 'Look after a small creature, then take it through worlds that are never the same twice.',
  id: '/play',
  start_url: '/play',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: INK,
  theme_color: INK,
  lang: 'en-GB',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

/** The tags that point a page at the manifest and icons. Added to the game's page when the server sends it. */
export const HEAD_TAGS = [
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  `<meta name="theme-color" content="${INK}">`,
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Glimmerkin">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black">',
].join('\n');

/** Names one build of the game page, so a copy left open on a phone can tell when a newer one is out. */
export function buildId(page: Buffer): string {
  return createHash('sha256').update(page).digest('hex').slice(0, 16);
}

/** Puts HEAD_TAGS, and the build the page is, just before the page's </head>. A page without one is left as it is. */
export function withHeadTags(page: Buffer, build?: string): Buffer {
  const html = page.toString('utf8');
  const at = html.indexOf('</head>');
  if (at < 0) return page;
  const tags = HEAD_TAGS + (build ? `\n<meta name="glimmerkin-build" content="${build}">` : '');
  return Buffer.from(html.slice(0, at) + tags + '\n' + html.slice(at), 'utf8');
}

/* ---------- drawing ---------- */

type RGB = [number, number, number];

function hsl(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// The creature's colours, worked out the way the game works out a Glimmerkin's (drawCreature in src/draw.js).
const HUE = 285, SAT = 72;
const C = {
  base: hsl(HUE, SAT, 62), light: hsl(HUE - 14, SAT + 14, 81), shade: hsl(HUE + 22, SAT - 6, 41),
  line: hsl(HUE + 30, 42, 18), belly: hsl(HUE - 30, SAT, 91), inner: hsl(HUE - 40, 85, 84),
  eye: hex('#1a1030'), sky: hex('#2b1f5c'), ink: hex(INK), lantern: hex('#ffcf6b'), cheek: hex('#ff7896'),
};

/** Distance from p to an ellipse's edge, roughly, in the same units: negative inside. Good enough for shapes this round. */
function ellipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  const dx = (x - cx) / rx, dy = (y - cy) / ry;
  return (Math.hypot(dx, dy) - 1) * Math.min(rx, ry);
}

/** Signed distance to a polygon: negative inside. */
function polygon(x: number, y: number, pts: Array<[number, number]>): number {
  let d = Infinity, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j] as [number, number], [bx, by] = pts[i] as [number, number];
    const ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
    const t = clamp01((wx * ex + wy * ey) / (ex * ex + ey * ey));
    d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
    if ((ay > y) !== (by > y) && x < ax + ((y - ay) * ex) / ey) inside = !inside;
  }
  return inside ? -d : d;
}

/** Distance to an arc of a circle, from angle a0 to a1 (radians, clockwise on screen). */
function arc(x: number, y: number, cx: number, cy: number, r: number, a0: number, a1: number): number {
  const a = Math.atan2(y - cy, x - cx);
  if (a >= a0 && a <= a1) return Math.abs(Math.hypot(x - cx, y - cy) - r);
  const end = (t: number) => Math.hypot(x - cx - Math.cos(t) * r, y - cy - Math.sin(t) * r);
  return Math.min(end(a0), end(a1));
}

/** A four-pointed sparkle, as the game draws its stars. */
function sparkle(x: number, y: number, cx: number, cy: number, R: number): number {
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  return Math.pow(dx / R, 0.5) + Math.pow(dy / R, 0.5) - 1;
}

const BODY = { cx: 0.5, cy: 0.585, rx: 0.255, ry: 0.215 };
const LW = 0.016;   // outline width, as a share of the icon's side
const EARS: Array<Array<[number, number]>> = [-1, 1].map((sd) => {
  const bx = 0.5 + sd * 0.15, by = 0.43, rot = sd * 0.32;
  const at = (u: number, v: number): [number, number] => [bx + u * Math.cos(rot) - v * Math.sin(rot), by + u * Math.sin(rot) + v * Math.cos(rot)];
  return [at(-0.085, 0.05), at(-0.03, -0.12), at(0, -0.17), at(0.03, -0.12), at(0.085, 0.05)];
});
const EARS_INNER = EARS.map((pts) => {
  const [cx, cy] = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length + 0.01];
  return pts.map(([x, y]): [number, number] => [cx + (x - cx) * 0.5, cy + (y - cy) * 0.55]);
});
const STARS: Array<[number, number, number]> = [[0.2, 0.22, 0.045], [0.81, 0.27, 0.032], [0.76, 0.12, 0.02], [0.27, 0.86, 0.022], [0.85, 0.78, 0.026]];

/** The colour at one point of the icon, with x and y from 0 to 1 across it. */
function colourAt(x: number, y: number): RGB {
  // Twilight, lighter behind the creature.
  let c = mix(C.sky, C.ink, clamp01(y * 1.05));
  const halo = Math.hypot(x - BODY.cx, y - BODY.cy + 0.04);
  c = mix(c, C.base, 0.42 * clamp01(1 - halo / 0.46) ** 2);
  for (const [sx, sy, r] of STARS) {
    const glowAmt = 0.35 * clamp01(1 - Math.hypot(x - sx, y - sy) / (r * 1.6)) ** 2;
    c = mix(c, C.lantern, glowAmt);
    if (sparkle(x, y, sx, sy, r) < 0) c = mix(C.lantern, [255, 246, 214], 0.5);
  }
  // Shadow on the ground.
  if (ellipse(x, y, BODY.cx, BODY.cy + BODY.ry + 0.03, 0.2, 0.035) < 0) c = mix(c, [8, 4, 20], 0.45);
  // Ears, behind the body.
  for (let i = 0; i < EARS.length; i++) {
    const d = polygon(x, y, EARS[i] as Array<[number, number]>);
    if (d < LW) c = d < 0 ? (polygon(x, y, EARS_INNER[i] as Array<[number, number]>) < 0 ? C.inner : C.base) : C.line;
  }
  // Feet.
  for (const sd of [-1, 1]) {
    const d = ellipse(x, y, BODY.cx + sd * 0.11, BODY.cy + BODY.ry * 0.94, 0.055, 0.032);
    if (d < LW) c = d < 0 ? C.shade : C.line;
  }
  // Body: lit from the top left, with a pale belly.
  const db = ellipse(x, y, BODY.cx, BODY.cy, BODY.rx, BODY.ry);
  if (db < LW) {
    if (db >= 0) c = C.line;
    else {
      const t = clamp01(Math.hypot(x - (BODY.cx - BODY.rx * 0.35), y - (BODY.cy - BODY.ry * 0.45)) / (BODY.rx * 1.6));
      c = t < 0.45 ? mix(C.light, C.base, t / 0.45) : mix(C.base, C.shade, (t - 0.45) / 0.55);
      if (ellipse(x, y, BODY.cx, BODY.cy + BODY.ry * 0.62, BODY.rx * 0.62, BODY.ry * 0.5) < 0) c = mix(c, C.belly, 0.85);
      if (ellipse(x, y, BODY.cx - BODY.rx * 0.42, BODY.cy - BODY.ry * 0.55, BODY.rx * 0.2, BODY.ry * 0.12) < 0) c = mix(c, [255, 255, 255], 0.22);
      // Face.
      const er = 0.052, ey = BODY.cy - BODY.ry * 0.06;
      for (const sd of [-1, 1]) {
        const ex = BODY.cx + sd * BODY.rx * 0.42;
        if (ellipse(x, y, ex + sd * BODY.rx * 0.24, ey + er * 1.3, er * 0.62, er * 0.4) < 0) c = mix(c, C.cheek, 0.38);
        if (ellipse(x, y, ex, ey, er * 0.88, er * 1.08) < 0) {
          c = mix(C.eye, hsl(HUE + 150, 70, 52), clamp01((y - ey) / (er * 1.1)) ** 2);
          if (Math.hypot(x - (ex - er * 0.28), y - (ey - er * 0.36)) < er * 0.36) c = [255, 255, 255];
          if (Math.hypot(x - (ex + er * 0.3), y - (ey + er * 0.42)) < er * 0.16) c = mix(c, [255, 255, 255], 0.8);
        }
      }
      const my = ey + er * 1.35;
      for (const sd of [-1, 1]) if (arc(x, y, BODY.cx + sd * er * 0.32, my - er * 0.1, er * 0.32, 0.1 * Math.PI, 0.9 * Math.PI) < LW * 0.45) c = C.eye;
    }
  }
  return c;
}

/**
 * Paints the icon at size by size pixels, as RGB rows. Each pixel's corners are sampled first; where they agree the
 * pixel is their average, and where an edge runs through it the pixel is sampled four by four.
 */
function paint(size: number): Buffer {
  const out = Buffer.alloc(size * size * 3), n = 4, w = size + 1;
  const corners: RGB[] = new Array(w * w);
  for (let y = 0; y <= size; y++) for (let x = 0; x <= size; x++) corners[y * w + x] = colourAt(x / size, y / size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const k = [corners[py * w + px], corners[py * w + px + 1], corners[(py + 1) * w + px], corners[(py + 1) * w + px + 1]] as RGB[];
      let spread = 0;
      for (let ch = 0; ch < 3; ch++) {
        const vals = k.map((c) => c[ch] as number);
        spread = Math.max(spread, Math.max(...vals) - Math.min(...vals));
      }
      let r = 0, g = 0, b = 0, count = 0;
      if (spread < 6) for (const c of k) { r += c[0]; g += c[1]; b += c[2]; count++; }
      else for (let sy = 0; sy < n; sy++) for (let sx = 0; sx < n; sx++) {
        const [cr, cg, cb] = colourAt((px + (sx + 0.5) / n) / size, (py + (sy + 0.5) / n) / size);
        r += cr; g += cg; b += cb; count++;
      }
      const o = (py * size + px) * 3;
      out[o] = Math.round(r / count); out[o + 1] = Math.round(g / count); out[o + 2] = Math.round(b / count);
    }
  }
  return out;
}

/* ---------- PNG ---------- */

const CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0); head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** The icon as a PNG, size pixels square, opaque, with no transparency for a phone to fill in black. */
export function iconPng(size: number): Buffer {
  const rgb = paint(size), row = size * 3;
  const raw = Buffer.alloc((row + 1) * size);
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (row + 1) + 1, y * row, (y + 1) * row);   // filter byte 0: none
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- routes ---------- */

const ICONS: Record<string, number> = { '/icons/icon-192.png': 192, '/icons/icon-512.png': 512, '/apple-touch-icon.png': 180 };

/** build is the game page's buildId, answered at /build.json so the game can ask whether it is out of date. */
export function installRoutes(app: FastifyInstance, build: string): void {
  app.get('/build.json', async (_request, reply) => reply.header('Cache-Control', 'no-store').send({ build }));

  const manifest = JSON.stringify(MANIFEST);
  app.get('/manifest.webmanifest', async (_request, reply) =>
    reply.header('Cache-Control', 'public, max-age=3600').type('application/manifest+json; charset=utf-8').send(manifest));

  const made = new Map<number, Buffer>();
  for (const [path, size] of Object.entries(ICONS)) {
    app.get(path, async (_request, reply) => {
      let png = made.get(size);
      if (!png) { png = iconPng(size); made.set(size, png); }
      return reply.header('Cache-Control', 'public, max-age=86400').type('image/png').send(png);
    });
  }
}
