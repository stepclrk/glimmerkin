'use strict';
/* ===== Core: RNG, data tables, world generator, pathing (no DOM) ===== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function RNG(seed) {
  const f = mulberry(seed >>> 0);
  return {
    f,
    int: (a, b) => a + Math.floor(f() * (b - a + 1)),
    pick: arr => arr[Math.floor(f() * arr.length)],
    chance: p => f() < p,
    shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  };
}

const EL_HUE = { ember: 14, tide: 200, stone: 262, bloom: 118, gale: 170, glow: 48 };
const ELS = Object.keys(EL_HUE);
const BERRY = { ember: 'Emberberry', tide: 'Tideplum', stone: 'Pebblenut', bloom: 'Mossfig', gale: 'Cloudpuff', glow: 'Glowdrop' };

const KINDS = {
  ember: { does: 'Burns bramble walls', label: 'Ember', species: 'Cinderkit', hue: [6, 30], clears: 'bramble', verb: 'Burn', perk: 'Fierce', perkText: 'Fights cost 1 spark less.' },
  tide: { does: 'Freezes deep pools', label: 'Tide', species: 'Puddlefin', hue: [186, 214], clears: 'water', verb: 'Freeze', perk: 'Dewbringer', perkText: 'Dewdrops restore 2 sparks instead of 1.' },
  stone: { does: 'Smashes boulders', label: 'Stone', species: 'Pebblit', hue: [248, 278], clears: 'boulder', verb: 'Smash', perk: 'Sturdy', perkText: 'Carries one extra spark.' },
  bloom: { does: 'Bridges chasms', label: 'Bloom', species: 'Sproutling', hue: [96, 140], clears: 'chasm', verb: 'Bridge', perk: 'Forager', perkText: 'Every berry it travels with counts double.' },
  gale: { does: 'Scatters storm clouds', label: 'Gale', species: 'Zephyrmoth', hue: [158, 180], clears: 'storm', verb: 'Scatter', perk: 'Flier', perkText: 'Fetches anything in sight, even from islets.' },
  glow: { does: 'Dispels shadow veils', label: 'Glow', species: 'Lanternbug', hue: [40, 56], clears: 'shadow', verb: 'Dispel', perk: 'Seer', perkText: 'Marks what stands between you and the portal.' }
};
const OBST = {
  bramble: { name: 'Bramble wall', by: 'ember', text: 'Thorns as thick as your tail. Fire would clear them.' },
  water: { name: 'Deep pool', by: 'tide', text: 'Too deep to wade. Frozen, it would hold.' },
  boulder: { name: 'Boulder', by: 'stone', text: 'It has not moved in a thousand years. Yet.' },
  chasm: { name: 'Chasm', by: 'bloom', text: 'A long way down. A vine bridge would cross it.' },
  storm: { name: 'Storm cloud', by: 'gale', text: 'A sulking thunderhead. A stiff breeze would shift it.' },
  shadow: { name: 'Shadow veil', by: 'glow', text: 'Darkness you could cut with a spoon. Light dissolves it.' }
};
const OB_TYPES = Object.keys(OBST);
/* Blockers that take two littles working together: one of each kind, or one twin with both kinds. */
const PAIRS = {
  fog: { name: 'Fog bank', pair: ['ember', 'tide'], skill: 'Steam', text: 'Cold fog that will not shift. Ember and Tide together make steam that lifts it.', home: ['tidehollow', 'emberfall'] },
  ruin: { name: 'Root-bound stones', pair: ['stone', 'bloom'], skill: 'Uproot', text: 'Old stones knotted with roots. Bloom loosens the roots while Stone heaves the stones aside.', home: ['mossroot', 'stonesong'] },
  crystal: { name: 'Singing crystal', pair: ['gale', 'glow'], skill: 'Shatter', text: 'A crystal wall that hums. Glow makes it ring and a Gale gust shatters it.', home: ['gloamglass', 'cloudspire'] }
};
const PAIR_OBS = Object.keys(PAIRS);
for (const k of PAIR_OBS) OBST[k] = Object.assign({ by: null }, PAIRS[k]);
const canClear = (ob, kinds) => OBST[ob].pair ? OBST[ob].pair.every(k => kinds.has(k)) : kinds.has(OBST[ob].by);
const GLOOMS = [
  { name: 'Cinder Gloom', weak: 'tide', hue: 12 },
  { name: 'Bog Gloom', weak: 'ember', hue: 150 },
  { name: 'Gust Gloom', weak: 'stone', hue: 185 },
  { name: 'Rock Gloom', weak: 'bloom', hue: 268 },
  { name: 'Thorn Gloom', weak: 'gale', hue: 95 },
  { name: 'Shade Gloom', weak: 'glow', hue: 300 }
];
const BIOMES = [
  { id: 'mossroot', name: 'Mossroot', el: 'bloom', bg: ['#0b211d', '#17392c'], fl: [128, 26, 33], wall: 'tree', wc: [150, 42, 24], accent: [78, 80, 62], nouns: ['Thicket', 'Glade', 'Burrow', 'Fernway'] },
  { id: 'emberfall', name: 'Emberfall', el: 'ember', bg: ['#241012', '#4a1d14'], fl: [20, 24, 31], wall: 'basalt', wc: [8, 16, 17], accent: [24, 100, 58], nouns: ['Cinderpath', 'Kiln', 'Ashfields', 'Forge-garden'] },
  { id: 'tidehollow', name: 'Tidehollow', el: 'tide', bg: ['#061f2c', '#0e3d4b'], fl: [176, 28, 37], wall: 'coral', wc: [342, 52, 56], accent: [172, 80, 64], nouns: ['Lagoon', 'Shallows', 'Reef', 'Grotto'] },
  { id: 'cloudspire', name: 'Cloudspire', el: 'gale', bg: ['#2a2352', '#74466f'], fl: [252, 30, 66], wall: 'cloud', wc: [285, 45, 90], accent: [44, 95, 74], nouns: ['Stairs', 'Roost', 'Skyfields', 'Belfry'] },
  { id: 'gloamglass', name: 'Gloamglass', el: 'glow', bg: ['#0d0a26', '#241b4c'], fl: [246, 28, 27], wall: 'crystal', wc: [268, 70, 62], accent: [48, 100, 70], nouns: ['Caverns', 'Mirror-maze', 'Geode', 'Vault'] },
  { id: 'stonesong', name: 'Stonesong', el: 'stone', bg: ['#1b1820', '#393240'], fl: [34, 13, 39], wall: 'menhir', wc: [255, 10, 46], accent: [36, 95, 62], nouns: ['Barrows', 'Circle', 'Cairns', 'Causeway'] }
];
const ADJ = ['Whispering', 'Humming', 'Drowsy', 'Hidden', 'Tumbling', 'Gilded', 'Upside-down', 'Lantern-lit', 'Hiccuping', 'Sleepwalking', 'Thrice-folded', 'Wandering', 'Half-remembered', 'Singing'];
const SIZES = {
  nook: { W: 5, H: 7, label: 'Nook', need: 2 },
  vale: { W: 7, H: 7, label: 'Vale', need: 3 },
  realm: { W: 7, H: 9, label: 'Realm', need: 3 }
};

/* World rules: each world type has one, from the second quest on. */
const RULES = {
  emberfall: { name: 'Wildfire', short: 'Fire', text: 'Fire spreads. Burning a bramble wall sets alight every bramble and dry thicket touching it, even at the corners. A burnt thicket leaves open ground, a new way through, and any gloom beside the blaze runs from it.', intro: 'Emberfall burns. Fire spreads from bramble to bramble and through dry thickets.' },
  mossroot: { name: 'Slick moss', short: 'Moss', text: 'Dewy moss is slippery. Step onto it and you slide until something stops you, picking up anything on the way. You cannot stop halfway across, so think about where you will end up. Littles slide too.', intro: 'Mossroot has slick moss. Step on it and you slide until something stops you.' },
  cloudspire: { name: 'Gusts', short: 'Gusts', text: 'Wind pads come in pairs of the same colour. Step on one and a gust carries you, and any little, to its twin, over walls and gaps. Some ways to the portal can only be crossed by gust.', intro: 'Cloudspire has gusts. Wind pads carry you to their twin.' },
  stonesong: { name: 'Song stones', short: 'Song', text: 'A song door bars the way. Step on its song stones in order, from one dot to three, and it opens for good. Stepping on the wrong stone starts the song again, so pick your route with care.', intro: 'Stonesong has a song door. Step on its stones in order to open it.' },
  gloamglass: { name: 'Darkness', short: 'Dark', text: 'It is dark. Your Glimmerkin lights the tiles around it, and every Glow little in the party lights one tile further. Crystal lamps catch the light as you pass and stay lit.', intro: 'Gloamglass is dark. Only the tiles near you are lit.' },
  tidehollow: { name: 'Tides', short: 'Tide', text: 'The tide comes in and goes out. Sandy flats can be crossed only while it is out. A Tide little can freeze a flat to cross it at any time.', intro: 'Tidehollow has tides. Sandy flats flood while the tide is in.' }
};
const TIDE_OUT = 10, TIDE_IN = 7;   // seconds the tide stays out, then in

function makeName(r) {
  const a = ['Pip', 'Mo', 'Lu', 'Zu', 'Ki', 'No', 'Bri', 'Fen', 'Ta', 'Wob', 'Nim', 'Ol', 'Dab', 'Tiz', 'Um', 'Puk', 'Ro', 'Vee', 'Yum', 'Sno', 'Qui', 'Bo', 'Em', 'Fi'];
  const b = ['bo', 'mi', 'lu', 'zu', 'ki', 'no', 'ble', 'fen', 'ta', 'wick', 'nim', 'lo', 'dab', 'tiz', 'puk', 'ro', 'vee', 'kin', 'pet', 'sy', 'dle', 'ra', 'bit', 'moss'];
  return r.pick(a) + r.pick(b);
}
function worldName(r, biome) { return 'The ' + r.pick(ADJ) + ' ' + r.pick(biome.nouns); }

function littleLevel(xp) { let L = 1; while (xp >= 3 * L * (L + 1)) L++; return L; }      // 6, 18, 36, 60…
function kindsOf(l) { return l.kind2 ? [l.kind, l.kind2] : [l.kind]; }
function maxSparks(l) { const L = littleLevel(l.xp || 0); return 3 + (kindsOf(l).includes('stone') ? 1 : 0) + (L >= 3 ? 1 : 0) + (L >= 6 ? 1 : 0); }
function petLevel(xp) { let L = 1; while (xp >= 7.5 * L * (L + 1) + 5 * L) L++; return L; } // 20, 55, 105, 170…
function petNeed(L) { return 7.5 * L * (L + 1) + 5 * L; }
function stageOf(L) { return L >= 10 ? 3 : L >= 6 ? 2 : L >= 3 ? 1 : 0; }
const STAGES = ['Hatchling', 'Fledgling', 'Wanderer', 'Mythic'];
/* Mythic forms: which one a Glimmerkin becomes depends on what it ate and where it travelled. */
const FORMS = {
  ember: { name: 'Sunflare', text: 'a mane of living flame' },
  tide: { name: 'Tidecaller', text: 'fins and a cresting wave' },
  stone: { name: 'Cairnheart', text: 'stone horns and crystal plates' },
  bloom: { name: 'Wildcrown', text: 'a crown of flowers and leaf wings' },
  gale: { name: 'Skydancer', text: 'great wings that keep it aloft' },
  glow: { name: 'Starlantern', text: 'orbiting lights and glowing antennae' }
};
/* The pull towards each form: every berry of that element eaten counts 1, recent meals 3 more each, and every
   visit to that element's world type 2. Ties go to the element the creature's seed favours. */
function formScores(pet, visits) {
  const out = {}; for (const el of ELS) out[el] = ((pet.ate || {})[el] || 0) + 3 * ((pet.diet || {})[el] || 0) + 2 * ((visits || {})[(BIOMES.find(b => b.el === el) || {}).id] || 0);
  return out;
}
function formFor(pet, visits) {
  const sc = formScores(pet, visits), lean = ELS[(pet.seed >>> 0) % ELS.length];
  return ELS.slice().sort((a, b) => (sc[b] - sc[a]) || ((b === lean) - (a === lean)))[0];
}

/* ---------- pathing ---------- */
function passable(w, x, y, st) {
  if (x < 0 || y < 0 || x >= w.W || y >= w.H) return false;
  const c = w.cells[y * w.W + x];
  if (c.t === 'floor') return !c.enemy && !(c.flat && st && st.tide && !c.frozen);
  if (c.t === 'ob') return !!c.cleared;
  if (c.t === 'gate') return !!(st && st.gateOpen);
  if (c.t === 'door') return !!(st && st.songOpen);
  return false;
}
/* Where a step onto (x,y), heading (dx,dy), ends: a wind pad carries you on to its twin, and slick moss slides
   you on until the next tile would stop you or you reach ground that is not slick. */
function landing(w, x, y, dx, dy, st) {
  let c = w.cells[y * w.W + x]; if (c.pad !== undefined) return c.pad;
  while (c.slick && passable(w, x + dx, y + dy, st)) { x += dx; y += dy; c = w.cells[y * w.W + x]; }
  return y * w.W + x;
}
/* Slides make some moves one-way. A slick world is kept only if, from anywhere the plan can reach, the way back to
   the start stays open, so no slide can strand you. */
function returnsHome(w, prev, st) { const s = w.start.y * w.W + w.start.x; for (const k of prev.keys()) if (!flood(w, k % w.W, (k - k % w.W) / w.W, st).has(s)) return false; return true; }
function flood(w, sx, sy, st, avoid) {
  const prev = new Map(); const k0 = sy * w.W + sx; prev.set(k0, -1); const q = [k0];
  for (let qi = 0; qi < q.length; qi++) {
    const k = q[qi], x = k % w.W, y = (k - x) / w.W;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!passable(w, nx, ny, st)) continue;
      const nk = landing(w, nx, ny, dx, dy, st); if (prev.has(nk) || (avoid && avoid.has(nk))) continue;
      prev.set(nk, k); q.push(nk);
    }
  }
  return prev;
}
function pathFrom(prev, k) { const p = []; while (k !== -1 && k !== undefined) { p.push(k); k = prev.get(k); } return p.reverse(); }
function nearIn(w, prev, x, y) { // shortest-route region cell next to (x,y), or -1
  let best = -1, bl = 1e9;
  for (const [dx, dy] of DIRS) {
    const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w.W || ny >= w.H) continue;
    const k = ny * w.W + nx; if (!prev.has(k)) continue;
    const l = pathFrom(prev, k).length; if (l < bl) { bl = l; best = k; }
  }
  return best;
}

/* Wildfire: the brambles and thickets a fire started at k burns, wave by wave (corners count as touching). */
function fireFrom(w, k) {
  const waves = [[k]], seen = new Set([k]), burns = c => (c.t === 'ob' && c.ob === 'bramble' && !c.cleared) || c.t === 'thicket';
  for (;;) {
    const next = [];
    for (const a of waves[waves.length - 1]) { const x = a % w.W, y = (a - x) / w.W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, nk = ny * w.W + nx; if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w.W && ny < w.H && !seen.has(nk) && burns(w.cells[nk])) { seen.add(nk); next.push(nk); } } }
    if (!next.length) return waves; waves.push(next);
  }
}
/* Song stones: an order in which each stone can be walked to from the one before without stepping on another. */
function songOrder(w, st) {
  const ks = w.song.map(p => p.y * w.W + p.x), n = ks.length, perms = [];
  const permute = (a, rest) => { if (!rest.length) perms.push(a); rest.forEach((x, i) => permute(a.concat(x), rest.filter((_, j) => j !== i))); };
  permute([], ks.map((_, i) => i));
  for (const P of perms) {
    let ok = true;
    for (let i = 0; i + 1 < n && ok; i++) { const a = ks[P[i]], b = ks[P[i + 1]], avoid = new Set(ks.filter(k => k !== a && k !== b)); ok = flood(w, a % w.W, (a - a % w.W) / w.W, st, avoid).has(b); }
    if (ok) return P;
  }
  return null;
}
/* The intended route: clear only the critical blockers, in whatever order they come into reach. */
function planSolve(w) {
  const done = []; const st = { gateOpen: false, songOpen: false }; let prev, bad = null;
  for (let guard = 0; guard < 60; guard++) {
    prev = flood(w, w.start.x, w.start.y, st); let ch = false;
    if (w.plate && !st.gateOpen && prev.has(w.plate.y * w.W + w.plate.x)) { st.gateOpen = true; ch = true; }
    if (w.slick && !bad && !returnsHome(w, prev, st)) bad = 'slide';
    if (w.song && !st.songOpen && !bad && w.song.every(p => prev.has(p.y * w.W + p.x))) { const P = songOrder(w, st); if (P) { w.song = P.map(i => w.song[i]); st.songOpen = true; ch = true; } else bad = 'song'; }
    w.cells.forEach((c, k) => {
      if (!c.crit || c._done) return;
      const x = k % w.W, y = (k - x) / w.W;
      if (nearIn(w, prev, x, y) < 0) return;
      c._done = true; done.push(c); ch = true;
      if (c.t === 'ob') c.cleared = true; else if (c.enemy) { c._e = c.enemy; c.enemy = null; }
    });
    if (!ch) break;
  }
  for (const c of done) { delete c._done; if (c.t === 'ob') c.cleared = false; if (c._e) { c.enemy = c._e; delete c._e; } }
  if (bad) prev.bad = bad;
  return prev;
}

/* ---------- world generator ---------- */
function genWorld(seed, party, q, sizeKey, biomeId, opts) {
  opts = opts || {};
  for (let a = 0; a < 80; a++) {
    const w = tryGen((seed + a * 7919) >>> 0, party, q, sizeKey, biomeId, opts);
    if (w) return w;
  }
  return tryGen(seed >>> 0, party, 0, 'vale', biomeId, { plain: true, eggOk: opts.eggOk, rare: opts.rare, gifts: opts.gifts, can: opts.can, fly: opts.fly }) || tryGen(1, party, 0, 'vale', biomeId, { plain: true });
}
function tryGen(seed, party, q, sizeKey, biomeId, opts) {
  const r = RNG(seed), S = SIZES[sizeKey], W = S.W, H = S.H;
  const biome = BIOMES.find(b => b.id === biomeId) || BIOMES[0];
  const cells = []; for (let i = 0; i < W * H; i++) cells.push({ t: 'wall' });
  const at = (x, y) => cells[y * W + x];
  const nx = (W + 1) / 2, ny = (H + 1) / 2, nid = (i, j) => j * nx + i;
  // growing-tree maze over the even-coordinate lattice
  const start = { i: r.int(0, nx - 1), j: ny - 1 };
  const parent = new Map(), depth = new Map(), deg = new Map(), carved = new Set();
  parent.set(nid(start.i, start.j), null); depth.set(nid(start.i, start.j), 0);
  at(start.i * 2, start.j * 2).t = 'floor';
  const live = [start];
  while (live.length) {
    const idx = r.chance(0.6) ? live.length - 1 : r.int(0, live.length - 1), cur = live[idx];
    const o = r.shuffle(DIRS.slice()).filter(([dx, dy]) => { const i = cur.i + dx, j = cur.j + dy; return i >= 0 && j >= 0 && i < nx && j < ny && !parent.has(nid(i, j)); });
    if (!o.length) { live.splice(idx, 1); continue; }
    const [dx, dy] = o[0], n = { i: cur.i + dx, j: cur.j + dy };
    parent.set(nid(n.i, n.j), cur); depth.set(nid(n.i, n.j), depth.get(nid(cur.i, cur.j)) + 1);
    deg.set(nid(n.i, n.j), (deg.get(nid(n.i, n.j)) || 0) + 1); deg.set(nid(cur.i, cur.j), (deg.get(nid(cur.i, cur.j)) || 0) + 1);
    at(n.i * 2, n.j * 2).t = 'floor'; at(cur.i * 2 + dx, cur.j * 2 + dy).t = 'floor';
    carved.add((cur.i * 2 + dx) + ',' + (cur.j * 2 + dy)); live.push(n);
  }
  // exit: deep and high
  let exit = null, best = -1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const s = depth.get(nid(i, j)) + (ny - 1 - j) * 0.75 + r.f() * 0.5; if (s > best && (i !== start.i || j !== start.j)) { best = s; exit = { i, j }; } }
  const path = []; for (let n = exit; n; n = parent.get(nid(n.i, n.j))) path.push(n); path.reverse();
  if (path.length < 4) return null;
  const pathKeys = new Set(path.map(n => nid(n.i, n.j)));
  const pe = []; for (let k = 0; k < path.length - 1; k++) pe.push({ x: path[k].i + path[k + 1].i, y: path[k].j + path[k + 1].j });
  const peKeys = new Set(pe.map(e => e.x + ',' + e.y));

  // critical blockers along the path
  const bossIdx = opts.rare ? pe.length - 1 : -1;
  let cand = r.shuffle(pe.map((_, k) => k).filter(k => k >= 1 && k !== bossIdx));
  let moonIdx = -1, foeIdx = -1, doorIdx = -1;
  if (!opts.plain && q >= 1 && cand.length >= 3 && r.chance(0.6)) { const m = cand.filter(k => k >= 2); if (m.length) { moonIdx = m[0]; cand = cand.filter(k => k !== moonIdx); } }
  const ruleId = !opts.plain && !opts.noRule && (q >= 1 || opts.rare) && RULES[biome.id] ? biome.id : null;
  if (ruleId === 'stonesong' && cand.length >= 2) { doorIdx = Math.max(...cand); cand = cand.filter(k => k !== doorIdx); }
  const budget = {}; for (const p of party) budget[p.kind] = (budget[p.kind] || 0) + p.max - 1;
  // a pair blocker is paid one spark each by two littles of different main kinds, or two sparks by a twin with
  // both kinds when no other little shares its main kind (so those sparks are surely its own)
  const payPair = (A, B, dry) => {
    if (budget[A] >= 1 && budget[B] >= 1) { if (!dry) { budget[A]--; budget[B]--; } return 'two'; }
    for (const t of party) if (t.kind2 && [A, B].every(k => k === t.kind || k === t.kind2) && party.filter(p => p.kind === t.kind).length === 1 && budget[t.kind] >= 2) { if (!dry) budget[t.kind] -= 2; return 'twin'; }
    return null;
  };
  const takeKind = need => { const ks = r.shuffle(Object.keys(budget)).sort((a, b) => budget[b] - budget[a]); if (!ks.length || budget[ks[0]] < need) return null; budget[ks[0]] -= need; return ks[0]; };
  let hearts = 0; // a boss is worn down one spark at a time, by anyone
  if (opts.rare) { const total = Object.values(budget).reduce((a, b) => a + b, 0), want = clamp(total - 1, 2, 4); while (hearts < want && takeKind(1)) hearts++; if (hearts < 1) return null; }
  let foeKind = null;
  if (!opts.plain && !opts.rare && q >= 2 && cand.length >= 3 && r.chance(0.45)) { foeKind = takeKind(2); if (foeKind) foeIdx = cand.pop(); }
  let pairOb = null, pairIdx = -1;
  if (!opts.plain && !opts.noPair && q >= 1 && cand.length >= 2 && r.chance(0.55)) {
    const ok = r.shuffle(PAIR_OBS.slice()).sort((a, b) => PAIRS[b].home.includes(biome.id) - PAIRS[a].home.includes(biome.id)).filter(o => payPair(...PAIRS[o].pair, true));
    if (ok.length) { pairOb = ok[0]; payPair(...PAIRS[pairOb].pair); pairIdx = cand.shift(); }
  }
  const target = clamp(2 + Math.floor(q / 3), 2, 5) - (pairOb ? 1 : 0);
  const world = { seed, W, H, cells, start: { x: start.i * 2, y: start.j * 2 }, exit: { x: exit.i * 2, y: exit.j * 2 }, need: S.need, plate: null, gate: null, biome: biome.id, name: worldName(r, biome), size: sizeKey };
  let gates = 0;
  if (pairIdx >= 0) { const c = at(pe[pairIdx].x, pe[pairIdx].y); c.t = 'ob'; c.ob = pairOb; c.crit = true; gates++; }
  for (const k of cand) { if (gates >= target) break; const kind = takeKind(1); if (!kind) break; const c = at(pe[k].x, pe[k].y); c.t = 'ob'; c.ob = KINDS[kind].clears; c.crit = true; gates++; }
  if (gates < 1 && !opts.rare) return null;
  if (bossIdx >= 0) { const c = at(pe[bossIdx].x, pe[bossIdx].y); c.enemy = { g: r.int(0, GLOOMS.length - 1), tough: hearts, boss: true }; c.crit = true; }
  if (foeIdx >= 0) { const c = at(pe[foeIdx].x, pe[foeIdx].y); const wk = r.pick(party).kind; const gi = r.chance(0.55) ? GLOOMS.findIndex(g => g.weak === wk) : r.int(0, GLOOMS.length - 1); c.enemy = { g: gi, tough: 2 }; c.crit = true; c.planKind = foeKind; }

  // moon gate + plate
  const protect = new Set();
  if (moonIdx >= 0) {
    const beyond = path[moonIdx + 1], bKey = nid(beyond.i, beyond.j);
    const before = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (i === start.i && j === start.j) continue;
      let ok = true; for (let n = { i, j }; n; n = parent.get(nid(n.i, n.j))) if (nid(n.i, n.j) === bKey) { ok = false; break; }
      if (ok) before.push({ i, j });
    }
    const off = before.filter(n => !pathKeys.has(nid(n.i, n.j)));
    const pool = off.length && r.chance(0.7) ? off : before;
    if (pool.length) {
      const pn = r.pick(pool);
      world.plate = { x: pn.i * 2, y: pn.j * 2 }; world.gate = { x: pe[moonIdx].x, y: pe[moonIdx].y };
      at(world.gate.x, world.gate.y).t = 'gate';
      for (let n = pn; n; n = parent.get(nid(n.i, n.j))) { const p = parent.get(nid(n.i, n.j)); if (!p) break; protect.add((n.i + p.i) + ',' + (n.j + p.j)); if (pathKeys.has(nid(p.i, p.j))) break; }
    }
  }

  // a song door on the way to the portal, with its stones somewhere before it
  if (doorIdx >= 0) {
    const bKey = nid(path[doorIdx + 1].i, path[doorIdx + 1].j), before = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if ((i === start.i && j === start.j) || (world.plate && world.plate.x === i * 2 && world.plate.y === j * 2)) continue;
      let ok = true; for (let n = { i, j }; n; n = parent.get(nid(n.i, n.j))) if (nid(n.i, n.j) === bKey) { ok = false; break; }
      if (ok) before.push({ i, j });
    }
    const want = sizeKey === 'nook' ? 2 : 3; if (before.length < want) return null;
    const off = r.shuffle(before.filter(n => !pathKeys.has(nid(n.i, n.j)))), on = r.shuffle(before.filter(n => pathKeys.has(nid(n.i, n.j))));
    const picks = (r.chance(0.7) ? off.concat(on) : on.concat(off)).slice(0, want);
    world.song = picks.map(n => ({ x: n.i * 2, y: n.j * 2 })); world.door = { x: pe[doorIdx].x, y: pe[doorIdx].y }; at(world.door.x, world.door.y).t = 'door';
    for (const pn of picks) for (let n = pn; n; n = parent.get(nid(n.i, n.j))) { const p = parent.get(nid(n.i, n.j)); if (!p) break; protect.add((n.i + p.i) + ',' + (n.j + p.j)); if (pathKeys.has(nid(p.i, p.j))) break; }
  }

  // gusts: one step of the route becomes a wall, and a pair of wind pads carries you over it
  const nodeOk = n => !(n.i === start.i && n.j === start.j) && !(n.i === exit.i && n.j === exit.j) && !(world.plate && world.plate.x === n.i * 2 && world.plate.y === n.j * 2) && !(world.song && world.song.some(p => p.x === n.i * 2 && p.y === n.j * 2));
  if (ruleId === 'cloudspire') {
    const free = r.shuffle(pe.map((e, k) => k).filter(k => k >= 1 && k !== bossIdx && at(pe[k].x, pe[k].y).t === 'floor' && !at(pe[k].x, pe[k].y).enemy));
    const pads = [], near = n => pads.some(p => Math.abs(p.i - n.i) + Math.abs(p.j - n.j) <= 1);
    const pair = (A, B) => { const a = at(A.i * 2, A.j * 2), b = at(B.i * 2, B.j * 2); a.pad = B.j * 2 * W + B.i * 2; b.pad = A.j * 2 * W + A.i * 2; a.padHue = b.padHue = pads.length / 2; pads.push(A, B); };
    if (free.length) {
      const cut = free[0], bKey = nid(path[cut + 1].i, path[cut + 1].j), side = [[], []];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let after = false; for (let n = { i, j }; n; n = parent.get(nid(n.i, n.j))) if (nid(n.i, n.j) === bKey) { after = true; break; } if (nodeOk({ i, j })) side[after ? 1 : 0].push({ i, j }); }
      if (!side[0].length || !side[1].length) return null;
      at(pe[cut].x, pe[cut].y).t = 'wall'; world.cut = { x: pe[cut].x, y: pe[cut].y };
      const A = r.pick(side[0]), B = r.pick(side[1].filter(n => Math.abs(n.i - A.i) + Math.abs(n.j - A.j) > 1).concat(side[1]).slice(0, side[1].length)); pair(A, B);
    }
    if (sizeKey !== 'nook') { const all = r.shuffle([]); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (nodeOk({ i, j }) && !near({ i, j })) all.push({ i, j }); r.shuffle(all); const A = all[0], B = A && all.find(n => !near(n) && Math.abs(n.i - A.i) + Math.abs(n.j - A.j) > 2); if (A && B) pair(A, B); }
    world.pads = pads.length / 2; if (!world.pads) return null;
  }

  // optional blockers on side branches
  const pOpt = opts.plain ? 0 : q === 0 ? 0.25 : 0.42;
  const pk = party.map(p => p.kind);
  for (const key of carved) {
    if (peKeys.has(key) || protect.has(key) || !r.chance(pOpt)) continue;
    const [x, y] = key.split(',').map(Number), c = at(x, y);
    if (r.chance(0.3)) c.enemy = { g: r.int(0, GLOOMS.length - 1), tough: q < 2 ? 2 : r.int(2, 3) };
    else if (!opts.plain && !opts.noPair && q >= 1 && r.chance(0.14)) { c.t = 'ob'; c.ob = r.pick(PAIR_OBS); }
    else { c.t = 'ob'; c.ob = ruleId === 'emberfall' && r.chance(0.5) ? 'bramble' : r.chance(0.65) ? KINDS[r.pick(pk)].clears : r.pick(OB_TYPES); }
  }
  // shortcuts through uncarved edges
  if (!opts.plain) {
    const unc = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (i + 1 < nx && !carved.has((i * 2 + 1) + ',' + (j * 2))) unc.push([i * 2 + 1, j * 2]);
      if (j + 1 < ny && !carved.has((i * 2) + ',' + (j * 2 + 1))) unc.push([i * 2, j * 2 + 1]);
    }
    r.shuffle(unc); const n = Math.min(unc.length, r.int(1, sizeKey === 'nook' ? 2 : 3));
    for (let k = 0; k < n; k++) { const c = at(unc[k][0], unc[k][1]); c.t = 'ob'; c.ob = ruleId === 'emberfall' && r.chance(0.5) ? 'bramble' : r.pick(OB_TYPES); }
  }
  // islets on pillar cells
  const islets = [];
  if (!opts.plain) {
    const pil = []; for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) pil.push([x, y]);
    r.shuffle(pil); const n = r.int(1, 2);
    for (let k = 0; k < n && k < pil.length; k++) { const c = at(pil[k][0], pil[k][1]); c.t = 'islet'; islets.push(c); }
  }

  // the world type's own rule
  world.rule = ruleId;
  const spot = k => !(at(k % W, (k - k % W) / W).t !== 'floor' || k === world.start.y * W + world.start.x || k === world.exit.y * W + world.exit.x || (world.plate && k === world.plate.y * W + world.plate.x));
  if (world.rule === 'tidehollow') {
    // sandy flats, some of them on the way to the portal: crossable only while the tide is out
    const onPath = r.shuffle(pe.map(e => e.y * W + e.x).concat(path.map(n => n.j * 2 * W + n.i * 2)).filter(spot));
    const off = r.shuffle(cells.map((_, k) => k).filter(k => spot(k) && !onPath.includes(k)));
    const want = { nook: 3, vale: 4, realm: 5 }[sizeKey], picks = onPath.slice(0, Math.min(2, onPath.length)).concat(off).slice(0, want);
    for (const k of picks) cells[k].flat = true;
    world.flats = picks.length;
  } else if (world.rule === 'gloamglass') {
    // crystal lamps, mostly in dead ends and side passages, that stay lit once passed
    const ends = r.shuffle(cells.map((_, k) => k).filter(k => spot(k) && (k % W) % 2 === 0 && ((k - k % W) / W) % 2 === 0)).sort((a, b) => ((deg.get(nid((a % W) / 2, (a - a % W) / W / 2)) || 0) - (deg.get(nid((b % W) / 2, (b - b % W) / W / 2)) || 0)));
    const n = { nook: 2, vale: 3, realm: 3 }[sizeKey]; for (const k of ends.slice(0, n)) cells[k].lamp = true;
    world.lamps = Math.min(n, ends.length);
  }

  if (world.rule === 'emberfall') {
    // dry thickets on the pillars between paths: walls that burn away to open ground when fire reaches them
    let n = 0; for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) { const c = at(x, y); if (c.t === 'wall' && r.chance(0.6)) { c.t = 'thicket'; n++; } }
    world.thickets = n;
  }
  if (world.rule === 'mossroot') {
    // slick moss on open floor, never beside anything that can change (a blocker, a gate, a door or a gloom), so a
    // slide always ends in the same place whatever has been cleared
    const live = c => c.t === 'ob' || c.t === 'gate' || c.t === 'door' || !!c.enemy;
    const calm = k => { const x = k % W, y = (k - x) / W; return DIRS.every(([dx, dy]) => { const a = x + dx, b = y + dy; return a < 0 || b < 0 || a >= W || b >= H || !live(at(a, b)); }); };
    let n = 0; for (let k = 0; k < cells.length; k++) if (spot(k) && !cells[k].enemy && calm(k) && r.chance(0.5)) { cells[k].slick = true; n++; }
    if (n < 3) return null;
    world.slick = n;
    // with everything cleared and opened, no slide may strand you either
    const st = { gateOpen: true, songOpen: true }, keep = cells.map(c => [c.cleared, c.enemy]); cells.forEach(c => { if (c.t === 'ob') c.cleared = true; c.enemy = null; });
    const all = flood(world, world.start.x, world.start.y, st), ok = returnsHome(world, all, st);
    cells.forEach((c, k) => { if (c.t === 'ob') c.cleared = keep[k][0]; c.enemy = keep[k][1]; });
    if (!ok) return null;
  }

  // loot
  const region = planSolve(world);
  if (region.bad || !region.has(world.exit.y * W + world.exit.x)) return null;
  const nodes = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = i * 2, y = j * 2;
    if ((x === world.start.x && y === world.start.y) || (x === world.exit.x && y === world.exit.y)) continue;
    if (world.plate && world.plate.x === x && world.plate.y === y) continue;
    if (at(x, y).lamp || at(x, y).pad !== undefined || (world.song && world.song.some(p => p.x === x && p.y === y))) continue;
    nodes.push({ x, y, c: at(x, y), inPlan: region.has(y * W + x), dead: (deg.get(nid(i, j)) || 0) <= 1, d: depth.get(nid(i, j)) });
  }
  const inPlan = r.shuffle(nodes.filter(n => n.inPlan)).sort((a, b) => (b.dead - a.dead) || (b.d - a.d));
  if (inPlan.length < world.need) return null;
  for (let k = 0; k < world.need; k++) inPlan[k].c.item = { k: 'shard' };
  const rest = r.shuffle(inPlan.slice(world.need));
  const berry = n => ({ k: 'berry', el: r.chance(0.6) ? biome.el : r.pick(ELS), n: n || 1 });
  let eggs = 0;
  const egg = tw => { eggs++; return { k: 'egg', hue: r.int(0, 359), twin: !!tw || r.chance(opts.twin || 0) }; };
  const chest = (a, b) => ({ k: 'chest', dust: r.int(a, b), tool: r.chance(0.45) ? r.pick(['seed', 'lantern', 'key', 'bell']) : null });
  if (rest.length && opts.eggOk && (q === 0 || opts.rare)) { const n = rest.shift(); n.c.item = egg(opts.rare); n.c.item.keep = true; }
  if (rest.length) rest.shift().c.item = { k: 'dew', keep: true };
  for (const n of rest) if (r.chance(0.55)) n.c.item = berry();
  for (const n of nodes) {
    if (n.inPlan || n.c.item || n.c.slick) continue;     // nothing waits where you can only slide past
    const v = r.f();
    n.c.item = v < 0.35 ? chest(10, 18) : v < 0.55 && opts.eggOk && eggs < 1 ? egg() : v < 0.7 ? { k: 'shard', bonus: true } : v < 0.8 ? { k: 'dew' } : berry(2);
  }
  for (const c of islets) { const v = r.f(); c.item = v < 0.45 ? chest(8, 14) : v < 0.55 && opts.eggOk && eggs < 1 ? egg() : berry(2); }
  for (const key of carved) { const [x, y] = key.split(',').map(Number), c = at(x, y); if (c.t === 'floor' && !c.enemy && !c.item && !c.slick && r.chance(0.12)) c.item = berry(); }
  // special finds go only where this party could actually get to
  if (opts.gifts && opts.gifts.length) {
    // everything this party could clear, cleared, every gloom gone and every gate and door open
    const can = new Set(opts.can || party.map(p => p.kind)), keep = cells.map(c => [c.cleared, c.enemy]);
    cells.forEach(c => { if (c.t === 'ob' && canClear(c.ob, can)) c.cleared = true; c.enemy = null; });
    const seen = flood(world, world.start.x, world.start.y, { gateOpen: true, songOpen: true });
    cells.forEach((c, k) => { c.cleared = keep[k][0]; c.enemy = keep[k][1]; });
    const free = n => !n.c.item || !(n.c.item.keep || (n.c.item.k === 'shard' && !n.c.item.bonus));
    const far = r.shuffle(nodes.filter(n => !n.inPlan && !n.c.slick && seen.has(n.y * W + n.x) && free(n))).map(n => n.c);
    const near = r.shuffle(nodes.filter(n => n.inPlan && free(n))).map(n => n.c);
    const spots = far.concat(opts.fly ? r.shuffle(islets.slice()) : [], near);
    world.gifts = 0; opts.gifts.forEach((id, i) => { if (spots[i]) { spots[i].item = { k: 'gift', id }; world.gifts++; } });
  }
  // a secret door to a bonus world: on a quiet tile the plan reaches, in a dead end off the route where there is one.
  // It is rolled from its own numbers, so the rest of the world is the same with or without it.
  if (opts.secret && !opts.plain && !opts.rare) {
    const rs = RNG((seed ^ 0x5ec4e7) >>> 0);
    if (rs.chance(opts.secret === true ? SECRET_RATE : opts.secret)) {
      const off = n => pathKeys.has(nid(n.x / 2, n.y / 2)) ? 0 : 1;
      const ok = rs.shuffle(nodes.filter(n => n.inPlan && !n.c.slick && !n.c.flat && (!n.c.item || n.c.item.k === 'berry'))).sort((a, b) => (b.dead - a.dead) || (off(b) - off(a)));
      if (ok.length) { ok[0].c.item = null; world.secret = { x: ok[0].x, y: ok[0].y }; }
    }
  }
  return world;
}
function fightCost(enemy, kinds, ring) {
  if (typeof kinds === 'string') kinds = [kinds];
  let c = enemy.tough;
  if (kinds.includes(GLOOMS[enemy.g].weak)) c--;
  if (kinds.includes('ember')) c--;
  if (ring) c--;
  return Math.max(1, c);
}

/* ---------- bonus worlds: each is built from a seed and checked to be fair, like every world ---------- */
const SECRET_RATE = 0.25;   // how many worlds hide a secret door
/* Starfall: what falls, when it reaches the cloud (t, in seconds) and where (x, from 0 to 1 across the sky).
   Each mote or shard can be reached from the one before at the cloud's assumed speed, and a gloom is never on the
   straight line between two of them, so a perfect run always exists. */
const STARFALL = { secs: 60, speed: 0.8, reach: 0.13, clear: 0.3 };
function genStarfall(seed, kinds) {
  const r = RNG(seed), drops = []; let t = 1.6, x = 0.5, n = 0; kinds = kinds || [];
  while (t < STARFALL.secs) {
    const gap = 0.45 + r.f() * 0.5, nx = clamp(x + (r.f() * 2 - 1) * STARFALL.speed * gap, 0.1, 0.9);
    if (n > 4 && r.chance(0.11)) { const mid = (x + nx) / 2, gx = mid + (mid > 0.5 ? -1 : 1) * (STARFALL.clear + r.f() * 0.15); if (gx >= 0.06 && gx <= 0.94) drops.push({ t: t + gap / 2, x: gx, k: 'gloom', g: r.int(0, GLOOMS.length - 1) }); }
    t += gap; x = nx; n++;
    drops.push(r.chance(0.08) ? { t, x, k: 'shard' } : { t, x, k: 'mote', el: kinds.length && r.chance(0.4) ? r.pick(kinds) : r.pick(ELS) });
  }
  return { seed, drops, secs: STARFALL.secs };
}
/* What a run is worth: a stardust for every five points, one more for each shard, never fewer than 10. */
function starfallPay(points, shards) { return clamp(Math.floor(points / 5) + shards, 10, 30); }

/* A bonus world that needs three littles borrows wild ones when the party is smaller: of kinds the party lacks. */
function fillParty(seed, party) {
  const r = RNG((seed ^ 0x77a11) >>> 0), out = party.slice(0, 3).map(k => k.slice()), have = new Set(out.flat());
  const spare = r.shuffle(ELS.filter(k => !have.has(k)).concat(r.shuffle(ELS.slice())));
  while (out.length < 3) out.push([spare[out.length]]);
  return out;
}
/* Night garden: three littles stand on a 5 by 5 bed so that every bud is reached by a little of the bud's kind.
   Each kind reaches in its own pattern. The littles are placed first and buds set only on tiles they reach, so an
   answer always exists; every other way of placing them is then counted, and a garden with just one answer kept. */
const GARDEN_N = 5;
const GARDEN_REACH = { ember: [[1, 0], [-1, 0], [0, 1], [0, -1]], glow: [[1, 1], [-1, 1], [1, -1], [-1, -1]], stone: [[2, 0], [-2, 0], [0, 2], [0, -2]], bloom: [[-1, -1], [0, -1], [1, -1]], tide: 'row', gale: 'col' };
function gardenReach(kind, x, y, tx, ty) { const R = GARDEN_REACH[kind]; return R === 'row' ? ty === y && tx !== x : R === 'col' ? tx === x && ty !== y : R.some(([dx, dy]) => x + dx === tx && y + dy === ty); }
/* Which buds are open with the pieces where they stand. at[i] is { x, y }, or null for a piece not yet placed. */
function gardenOpen(g, at) { return g.buds.map(b => g.pieces.some((ks, i) => at[i] && ks.includes(b.k) && gardenReach(b.k, at[i].x, at[i].y, b.x, b.y))); }
/* How many different answers a garden has, counting up to limit. Littles with the same kinds are interchangeable. */
function gardenWays(g, limit) {
  const N = GARDEN_N, bud = new Set(g.buds.map(b => b.y * N + b.x)), free = []; for (let k = 0; k < N * N; k++) if (!bud.has(k)) free.push({ x: k % N, y: (k - k % N) / N });
  const same = {}; g.pieces.forEach(ks => { const id = ks.slice().sort().join(); same[id] = (same[id] || 0) + 1; });
  const sym = Object.values(same).reduce((m, n) => m * [1, 1, 2, 6][n], 1); let n = 0;
  // for each little, the buds it would open from each free tile, as bits
  const m = g.pieces.map(ks => free.map(f => g.buds.reduce((v, d, j) => v | (ks.includes(d.k) && gardenReach(d.k, f.x, f.y, d.x, d.y) ? 1 << j : 0), 0))), full = (1 << g.buds.length) - 1, F = free.length;
  for (let a = 0; a < F; a++) for (let b = 0; b < F; b++) { if (a === b) continue; const ab = m[0][a] | m[1][b]; for (let c = 0; c < F; c++) if (c !== a && c !== b && (ab | m[2][c]) === full && ++n >= limit * sym) return limit; }
  return n / sym;
}
function genGarden(seed, party) {
  const N = GARDEN_N, pieces = fillParty(seed, party); let best = null;
  for (let a = 0; a < 240; a++) {
    const r = RNG((seed + a * 7919) >>> 0), cells = r.shuffle([...Array(N * N).keys()]), at = cells.slice(0, 3).map(k => ({ x: k % N, y: (k - k % N) / N }));
    const taken = new Set(cells.slice(0, 3)), buds = []; let ok = true;
    pieces.forEach((ks, i) => {
      const reach = []; for (let k = 0; k < N * N; k++) { if (taken.has(k)) continue; const x = k % N, y = (k - x) / N, kk = ks.filter(z => gardenReach(z, at[i].x, at[i].y, x, y)); if (kk.length) reach.push({ x, y, k: r.pick(kk) }); }
      const mine = r.shuffle(reach).slice(0, r.int(2, 3)); if (mine.length < 2) ok = false; mine.forEach(b => { taken.add(b.y * N + b.x); buds.push(b); });
    });
    if (!ok) continue;
    const g = { seed, N, pieces, buds, answer: at }; g.ways = gardenWays(g, 4);
    if (!best || g.ways < best.ways) best = g; if (g.ways === 1) break;
  }
  return best;
}
/* What a garden gives: a berry for every two buds of a kind, rounded up, and 8 stardust. */
function gardenPay(g) { const berries = {}, n = {}; g.buds.forEach(b => { n[b.k] = (n[b.k] || 0) + 1; }); for (const k in n) berries[k] = Math.ceil(n[k] / 2); return { dust: 8, berries }; }

/* Hide and seek: a scene three screens wide with nine hiding places along it. Five littles hide, each behind a
   place of its own: the party, and wild littles to make up the five. Each shows at least three tenths of itself,
   over the top or round one side, so it can always be spotted. */
const HIDE = { screens: 3, hiders: 5, props: 9, least: 0.3 };
function genHide(seed, party) {
  const r = RNG(seed), n = HIDE.props, props = [];
  for (let i = 0; i < n; i++) props.push({ x: 0.22 + i * (HIDE.screens - 0.44) / (n - 1) + (r.f() - 0.5) * 0.14, t: r.pick(['one', 'one', 'clump', 'clump', 'pool']), s: 0.9 + r.f() * 0.3, seed: r.int(1, 2147483646) });
  const hiders = r.shuffle(props.map((_, i) => i)).slice(0, HIDE.hiders).map((p, i) => {
    const mine = party[i]; return { prop: p, kinds: mine ? mine.slice() : [r.pick(ELS)], wild: !mine, seed: r.int(1, 2147483646), peek: props[p].t === 'pool' ? 'up' : r.pick(['up', 'up', 'left', 'right']), show: HIDE.least + r.f() * 0.2 };
  });
  const wild = hiders.filter(h => h.wild);
  return { seed, props, hiders, egg: wild.length ? r.pick(wild).kinds[0] : null };
}

/* Starweave: fourteen stars on the outline of a little, ears included, taken in order round it. A thread joins
   them in one line, may only stretch so far from star to star, and may not cross itself. Going round the outline
   is always such a line, whichever star it starts from. Sizes are in units of the little's own size. */
const WEAVE = { stretch: 1.3 };
const cubicAt = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };
function weaveStars(seed, shape) {
  const r = RNG(seed), w = 0.5 * shape.bw, h = 0.5 * shape.bh, t = shape.top, P = [-w, 0.25 * h], pts = [];
  const segs = [[P, [-w, -0.6 * h], [-w * t, -h], [0, -h]], [[0, -h], [w * t, -h], [w, -0.6 * h], [w, 0.25 * h]], [[w, 0.25 * h], [w, 0.85 * h], [0.6 * w, h], [0, h]], [[0, h], [-0.6 * w, h], [-w, 0.85 * h], P]];
  segs.forEach((s, i) => [1 / 3, 2 / 3, 1].forEach((u0, j) => {
    const u = j < 2 ? u0 + (r.f() - 0.5) * 0.12 : 1; pts.push({ x: cubicAt(s[0][0], s[1][0], s[2][0], s[3][0], u), y: cubicAt(s[0][1], s[1][1], s[2][1], s[3][1], u) });
    if (i < 2 && j === 0) pts.push({ x: (i ? 0.62 : -0.62) * w, y: -1.55 * h, ear: true });   // the tip of an ear
  }));
  let far = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; far = Math.max(far, Math.hypot(p.x - q.x, p.y - q.y)); });
  return { seed, pts, reach: far * WEAVE.stretch };
}
/* Do the threads a to b and c to d cross? Threads that only meet at a star they share do not. */
function threadsCross(a, b, c, d) {
  if (a === c || a === d || b === c || b === d) return false;
  const o = (p, q, s) => Math.sign((q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
/* Can the thread, which has visited the stars in path (by index), go on to star k? */
function weaveCan(g, path, k) {
  if (path.includes(k)) return false; if (!path.length) return true;
  const P = g.pts, a = P[path[path.length - 1]], b = P[k]; if (Math.hypot(a.x - b.x, a.y - b.y) > g.reach + 1e-9) return false;
  for (let i = 0; i + 1 < path.length; i++) if (threadsCross(a, b, P[path[i]], P[path[i + 1]])) return false;
  return true;
}

if (typeof module !== 'undefined') module.exports = { WEAVE, weaveStars, threadsCross, weaveCan, HIDE, genHide, fillParty, GARDEN_N, GARDEN_REACH, gardenReach, gardenOpen, gardenWays, genGarden, gardenPay, SECRET_RATE, STARFALL, genStarfall, starfallPay, FORMS, formFor, formScores, PAIRS, canClear, fireFrom, RULES, songOrder, RNG, KINDS, OBST, GLOOMS, BIOMES, SIZES, ELS, genWorld, planSolve, flood, nearIn, pathFrom, passable, fightCost, maxSparks, kindsOf, petLevel, littleLevel, makeName, DIRS };
