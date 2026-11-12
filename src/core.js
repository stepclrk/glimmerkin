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

/* Skyglide: a flight of 45 seconds. Heights run from 0 at the top of the sky to 1 at the bottom, and everything on
   the way is placed by the second it is reached. Holding rises and letting go sinks; glideStep is the whole of the
   flying, shared by the game and the test. The dewdrops and wind rings lie on one line through the sky that never
   climbs or falls faster than half of what the flier can do, and storm clouds keep well clear of it. */
const GLIDE = { secs: 45, rise: 0.52, sink: 0.44, ease: 7, reach: 0.075, slope: 0.21, cloud: 0.085, cloudSecs: 0.3, clear: 0.27, ring: 3, top: 0.07, bottom: 0.93 };
function glideStep(s, hold, dt) {
  s.vy += ((hold ? -GLIDE.rise : GLIDE.sink) - s.vy) * Math.min(1, GLIDE.ease * dt); s.y += s.vy * dt;
  if (s.y < GLIDE.top) { s.y = GLIDE.top; s.vy = Math.max(0, s.vy); } if (s.y > GLIDE.bottom) { s.y = GLIDE.bottom; s.vy = Math.min(0, s.vy); }
  return s;
}
function genGlide(seed) {
  const r = RNG(seed), G = GLIDE, knots = [{ t: 0, y: 0.5 }, { t: 2.5, y: 0.5 }];
  while (knots[knots.length - 1].t < G.secs) {
    const a = knots[knots.length - 1], dt = 2 + r.f() * 1.6, most = G.slope * dt / 1.5;   // the eased curve between two knots is 1.5 times as steep at its middle
    let y = a.y + (r.f() * 2 - 1) * most; if (y < 0.2) y = a.y + r.f() * most; if (y > 0.8) y = a.y - r.f() * most;
    knots.push({ t: a.t + dt, y: clamp(y, 0.2, 0.8) });
  }
  const g = { seed, secs: G.secs, knots, dew: [], rings: [], clouds: [], chime: r.chance(0.35) };
  const ringAt = [0.22, 0.42, 0.62, 0.82].map(u => +(u * G.secs + (r.f() - 0.5) * 2).toFixed(2));
  for (let t = 3, run = 0; t < G.secs - 1.2; t += 0.4) {
    if (run <= 0) { if (r.chance(0.5)) { t += 0.5 + r.f() * 0.6; } run = r.int(5, 9); }
    run--; if (ringAt.some(x => Math.abs(x - t) < 0.35)) continue; g.dew.push({ t: +t.toFixed(2), y: glideLine(g, t) });
  }
  for (const t of ringAt) g.rings.push({ t, y: glideLine(g, t) });
  for (let t = 5; t < G.secs - 2; t += 2.2 + r.f() * 2.2) {
    const y0 = glideLine(g, t), up = y0 - G.clear - r.f() * 0.12, down = y0 + G.clear + r.f() * 0.12, ok = [up, down].filter(y => y > 0.1 && y < 0.9); if (!ok.length) continue;
    const y = r.pick(ok), near = [-0.6, -0.3, 0, 0.3, 0.6].every(d => Math.abs(glideLine(g, t + d) - y) >= G.clear); if (near) g.clouds.push({ t: +t.toFixed(2), y, seed: r.int(1, 1e6) });
  }
  return g;
}
/* The height of the line of dewdrops at second t. */
function glideLine(g, t) {
  const K = g.knots; if (t <= 0) return K[0].y; let i = 1; while (i < K.length - 1 && K[i].t < t) i++;
  const a = K[i - 1], b = K[i], u = clamp((t - a.t) / (b.t - a.t), 0, 1); return a.y + (b.y - a.y) * u * u * (3 - 2 * u);
}
const glidePay = dew => Math.floor(dew / 4) + 5;

/* Wanderlings: five small creatures leave a burrow and walk in a straight line. One that cannot go on turns right
   (or left, or back, whichever is open first). Three littles are placed to steer them to their nest. Tiles are
   '.' open ground, '#' rock, and 'e' brambles, 't' a pool and 'b' a gap, each of which only opens while a little
   of its kind stands in it. A Pebblit blocks its tile like a rock. A Zephyrmoth's tile sends them the way it
   faces. A Lanternbug draws any wanderling that can see it along a clear row or column, once.
   Directions are 0 east, 1 south, 2 west, 3 north, so a right turn is one more. */
const WANDER = { W: 6, H: 7, n: 5, steps: 120 };
const WDIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]], WANDER_OPENS = { e: 'ember', t: 'tide', b: 'bloom' };
/* Where the wanderlings walk with the littles placed as put: [{x, y, d} or null] by piece. */
function wanderWalk(g, put) {
  const W = WANDER.W, H = WANDER.H, at = (x, y) => put.findIndex(p => p && p.x === x && p.y === y), has = (i, k) => i >= 0 && g.pieces[i].includes(k);
  const shut = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return true; const c = g.cells[y * W + x], i = at(x, y); return c === '#' || has(i, 'stone') || (c !== '.' && !has(i, WANDER_OPENS[c])); };
  let x = g.start.x, y = g.start.y, d = g.start.d, seen = 0; const path = [{ x, y, d }], been = new Set();
  for (let n = 0; n < WANDER.steps; n++) {
    if (x === g.home.x && y === g.home.y) return { home: true, path, why: 'home' };
    const here = at(x, y); if (has(here, 'glow')) seen |= 1 << here;
    put.forEach((p, i) => {
      if (!p || !has(i, 'glow') || has(i, 'stone') || seen & (1 << i) || (p.x !== x && p.y !== y) || (p.x === x && p.y === y)) return;
      const dx = Math.sign(p.x - x), dy = Math.sign(p.y - y); let cx = x + dx, cy = y + dy; while ((cx !== p.x || cy !== p.y) && !shut(cx, cy)) { cx += dx; cy += dy; }
      if (cx === p.x && cy === p.y && !shut(cx, cy)) d = WDIRS.findIndex(v => v[0] === dx && v[1] === dy);
    });
    if (has(here, 'gale')) d = put[here].d || 0;
    const go = [d, (d + 1) % 4, (d + 3) % 4, (d + 2) % 4].find(k => !shut(x + WDIRS[k][0], y + WDIRS[k][1]));
    if (go === undefined) return { home: false, path, why: 'stuck' };
    const key = x + ',' + y + ',' + go + ',' + seen; if (been.has(key)) return { home: false, path, why: 'loop' }; been.add(key);
    d = go; x += WDIRS[d][0]; y += WDIRS[d][1]; path.push({ x, y, d });
  }
  return { home: false, path, why: 'loop' };
}
/* May piece i stand on this tile? Never on the burrow, the nest or a rock, and in brambles, a pool or a gap only
   when it is of the kind that opens them. */
function wanderCan(g, i, x, y) {
  if (x < 0 || y < 0 || x >= WANDER.W || y >= WANDER.H || (x === g.start.x && y === g.start.y) || (x === g.home.x && y === g.home.y)) return false;
  const c = g.cells[y * WANDER.W + x]; return c === '.' || (c !== '#' && g.pieces[i].includes(WANDER_OPENS[c]));
}
function genWander(seed, party) {
  const W = WANDER.W, H = WANDER.H, pieces = fillParty(seed, party), inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H; let spare = null;
  for (let a = 0; a < 900; a++) {
    const r = RNG((seed + a * 7919) >>> 0), roles = pieces.map(ks => ks.includes('stone') ? 'stone' : r.pick(ks)), free = roles.filter(k => k === 'gale' || k === 'glow').length;
    // a way through: straight runs joined by corners, never over its own tiles
    const start = { x: r.int(0, W - 1), y: r.int(0, H - 1), d: r.int(0, 3) }, used = new Set([start.y * W + start.x]), route = [{ x: start.x, y: start.y }], corners = []; let x = start.x, y = start.y, d = start.d, lefts = 0, ok = true;
    const want = r.int(3, 5);
    for (let s = 0; s <= want && ok; s++) {
      const len = r.int(s === want ? 1 : 2, 4); let made = 0;
      for (let k = 0; k < len; k++) { const nx = x + WDIRS[d][0], ny = y + WDIRS[d][1]; if (!inside(nx, ny) || used.has(ny * W + nx)) break; x = nx; y = ny; used.add(y * W + x); route.push({ x, y, seg: s }); made++; }
      if (!made) { ok = false; break; }
      if (s < want) { const left = lefts < free && r.chance(0.4); if (left) lefts++; corners.push({ x, y, d, to: (d + (left ? 3 : 1)) % 4, left, i: route.length - 1 }); d = (d + (left ? 3 : 1)) % 4; }
    }
    if (!ok || route.length < 9) continue;
    const home = { x, y }, cells = Array(W * H).fill('.'), answer = [null, null, null], ahead = c => ({ x: c.x + WDIRS[c.d][0], y: c.y + WDIRS[c.d][1] }), openAhead = c => { const p = ahead(c); return inside(p.x, p.y) && !used.has(p.y * W + p.x); };
    const taken = new Set(), mids = r.shuffle(route.map((p, i) => i).filter(i => i > 0 && i < route.length - 1 && !corners.some(c => c.i === i)));
    // the littles that steer take corners first, left turns before right ones
    for (const [i, role] of roles.entries()) {
      if (role !== 'gale' && role !== 'glow') continue;
      const c = corners.find(c => !c.by && c.left) || r.shuffle(corners.filter(c => !c.by && openAhead(c)))[0] || r.shuffle(corners.filter(c => !c.by))[0]; if (!c) { ok = false; break; }
      c.by = role;
      if (role === 'gale') answer[i] = { x: c.x, y: c.y, d: c.to };
      else { const run = []; for (let k = c.i + 1; k < route.length - 1 && route[k].seg === route[c.i + 1].seg; k++) run.push(route[k]); if (!run.length) { ok = false; break; } const p = r.pick(run); answer[i] = { x: p.x, y: p.y, d: 0 }; }
      if (taken.has(answer[i].y * W + answer[i].x)) { ok = false; break; } taken.add(answer[i].y * W + answer[i].x);
    }
    for (const [i, role] of roles.entries()) {
      if (!ok || role !== 'stone') continue; const c = r.shuffle(corners.filter(c => !c.by && !c.left && openAhead(c) && !taken.has(ahead(c).y * W + ahead(c).x)))[0]; if (!c) { ok = false; break; }
      c.by = 'stone'; const p = ahead(c); answer[i] = { x: p.x, y: p.y, d: 0 }; taken.add(p.y * W + p.x);
    }
    for (const [i, role] of roles.entries()) {
      if (!ok || answer[i]) continue; const m = mids.find(k => !taken.has(route[k].y * W + route[k].x)); if (m === undefined) { ok = false; break; }
      const p = route[m]; cells[p.y * W + p.x] = { ember: 'e', tide: 't', bloom: 'b' }[role]; answer[i] = { x: p.x, y: p.y, d: 0 }; taken.add(p.y * W + p.x);
    }
    // every other corner is a right turn in front of a rock, or the edge
    for (const c of corners) { if (!ok || c.by) continue; const p = ahead(c); if (c.left || (inside(p.x, p.y) && (used.has(p.y * W + p.x) || taken.has(p.y * W + p.x)))) { ok = false; break; } if (inside(p.x, p.y)) cells[p.y * W + p.x] = '#'; }
    if (!ok) continue;
    for (let k = r.int(3, 6), t = 0; k > 0 && t < 60; t++) { const q = r.int(0, W * H - 1); if (used.has(q) || taken.has(q) || cells[q] !== '.') continue; cells[q] = '#'; k--; }
    const g = { seed, pieces, cells: cells.join(''), start, home, answer, strict: true };
    const way = wanderWalk(g, answer); if (!way.home || way.path.length < 9) continue;
    if (!spare) spare = Object.assign({}, g, { strict: false });
    if (wanderWalk(g, [null, null, null]).home || answer.some((_, i) => wanderWalk(g, answer.map((p, j) => j === i ? null : p)).home)) continue;   // every little must be needed
    g.steps = wanderWalk(g, answer).path.length - 1; return g;
  }
  if (spare) spare.steps = wanderWalk(spare, spare.answer).path.length - 1;
  return spare;
}

/* ---------- the garden: a place of the player's own, grown from its creature's seed ---------- */
/* Six plain flowers, one per kind, and below them the fifteen crosses of two kinds: 21 in all. A plain flower needs
   its own kind of little at every step; a cross needs its two kinds in turn. `pre` and `suf` make the names. */
const FLOWERS = {
  ember: { name: 'Emberflare', pre: 'Ember', suf: 'flare', shape: 'flame', hue: 14, n: 6, job: 'warms the soil' },
  tide: { name: 'Dewcup', pre: 'Dew', suf: 'cup', shape: 'cup', hue: 198, n: 5, job: 'waters it' },
  stone: { name: 'Quartzrose', pre: 'Quartz', suf: 'rose', shape: 'facet', hue: 266, n: 6, job: 'loosens the soil' },
  bloom: { name: 'Fernstar', pre: 'Fern', suf: 'star', shape: 'round', hue: 330, n: 7, job: 'coaxes it along' },
  gale: { name: 'Breezebell', pre: 'Breeze', suf: 'bell', shape: 'frill', hue: 168, n: 6, job: 'fans it with a breeze' },
  glow: { name: 'Lanternlily', pre: 'Lantern', suf: 'lily', shape: 'star', hue: 48, n: 6, job: 'shines on it' }
};
/* A flower is named by its kind, or by its two kinds in the order of ELS joined with a plus: 'ember+tide'. */
const flowerId = (x, y) => x === y ? x : ELS.indexOf(x) < ELS.indexOf(y) ? x + '+' + y : y + '+' + x;
for (const el of ELS) { FLOWERS[el].a = FLOWERS[el].b = el; }
ELS.forEach((a, i) => ELS.slice(i + 1).forEach(b => { FLOWERS[a + '+' + b] = { name: FLOWERS[a].pre + FLOWERS[b].suf, a, b, shape: FLOWERS[a].shape, hue: FLOWERS[a].hue, n: FLOWERS[a].n }; }));
const FLOWER_IDS = Object.keys(FLOWERS);
/* The seed two blooms side by side make: their own kind if they are alike, a cross if both are plain, or none. A
   cross only ever mixes two kinds, so a crossed flower crosses with nothing but its own kind. */
const crossOf = (x, y) => x === y ? x : FLOWERS[x].a === FLOWERS[x].b && FLOWERS[y].a === FLOWERS[y].b ? flowerId(x, y) : null;
/* The kind of little a flower needs before the step from stage st: a cross's two kinds take turns. A lily, which is
   any flower with Glow in it, needs a Glow little's light for its last step, and its bud opens only after dark. */
const isLily = id => FLOWERS[id].a === 'glow' || FLOWERS[id].b === 'glow';
const flowerNeed = (id, st) => st === 2 && isLily(id) ? 'glow' : st % 2 ? FLOWERS[id].b : FLOWERS[id].a;
const FLOWER_STAGES = ['seed', 'sprout', 'bud', 'bloom'];
/* W and H in tiles: a grid of COLS by ROWS glades, each CELL tiles across, inside a hedge. GROW is how long a tended
   flower takes to reach its next stage; after HELP of waiting, a little of the right kind tends it unasked. Two
   blooms side by side make a seed after CROSS if the player has a Gale little to carry the pollen, or after BREEZE.
   Round that garden, PAD tiles of hedge to the left, right and top hold HIDES hidden places. A wild flower has a
   seed to spare every WILD_DAYS days, and a seed pod holds POD seeds. MORE hidden places came later: one that opens
   only at night and one that opens only in its season. Night in the garden runs from DUSK to DAWN by the local clock. */
const GROUNDS = { W: 17, H: 22, CELL: 5, COLS: 3, ROWS: 4, BEDS: [3, 3, 2, 2], GROW: 40 * 60000, HELP: 60 * 60000, CROSS: 60 * 60000, BREEZE: 24 * 60 * 60000, PAD: 4, HIDES: 4, MORE: 2, WILD_DAYS: 3, POD: 3, DUSK: 20, DAWN: 6 };
/* The three ways a hidden place is shut, and the four things one can hold. */
const HIDE_KINDS = {
  over: { name: 'Overgrown' },      // brambles or a boulder: a little of the right kind in the party clears it
  vines: { name: 'Walk-through' },  // it only looks solid: fireflies give it away
  lock: { name: 'Flower lock' },    // a stone door that opens while a certain flower is in bloom in the garden
  night: { name: 'Night only' },    // moonflowers across the way in, which open after dark
  season: { name: 'Season only' }   // an arch of twigs that comes to life in one season of the year
};
const GARDEN_SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const isNightHour = h => h >= GROUNDS.DUSK || h < GROUNDS.DAWN;
/* The first moment at or after ts that is night by the local clock: ts itself, or dusk that day. */
function nightFrom(ts) { const d = new Date(ts); if (isNightHour(d.getHours())) return ts; d.setHours(GROUNDS.DUSK, 0, 0, 0); return d.getTime(); }
const HIDE_PRIZES = { beds: 'Two more patches of soil.', rich: 'A patch of rich soil: whatever grows in it opens glimmering.', wild: 'A wild flower grows here, with a seed to spare now and then.', pod: 'A seed pod, full of seeds.' };
const groundsWalk = (g, x, y) => x >= 0 && y >= 0 && x < g.W && y < g.H && '.,G'.includes(g.rows[y][x]);
/* Every tile that can be walked to from (sx, sy), each with the tile it was reached from. */
function groundsFlood(g, sx, sy) {
  const prev = new Map(), k0 = sy * g.W + sx, q = [k0]; prev.set(k0, -1);
  for (let i = 0; i < q.length; i++) { const k = q[i], x = k % g.W, y = (k - x) / g.W; for (const [dx, dy] of DIRS) { const nk = (y + dy) * g.W + x + dx; if (!prev.has(nk) && groundsWalk(g, x + dx, y + dy)) { prev.set(nk, k); q.push(nk); } } }
  return prev;
}
/* Opens hidden place i for good: its way in becomes path. */
function groundsOpen(g, i) { const d = g.hides[i].door; g.rows[d.y] = g.rows[d.y].slice(0, d.x) + ',' + g.rows[d.y].slice(d.x + 1); return g; }
const inHide = (h, x, y) => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1;
/* What is wrong with a garden, or '' when all of it can be walked and every bed can be reached. With its hidden
   places shut, none of them can be reached and nothing else is cut off; with them open, all of it can be walked. */
function groundsProblem(g) {
  const hides = g.hides || [], shut = groundsFlood(g, g.start.x, g.start.y);
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) { const hid = hides.some(h => inHide(h, x, y)); if (groundsWalk(g, x, y) && !hid && !shut.has(y * g.W + x)) return 'a tile that cannot be walked to'; if (hid && shut.has(y * g.W + x)) return 'a hidden place that is not shut'; }
  const o = { W: g.W, H: g.H, rows: g.rows.slice(), hides }; hides.forEach((h, i) => groundsOpen(o, i));
  const seen = groundsFlood(o, g.start.x, g.start.y), near = p => DIRS.some(([dx, dy]) => seen.has((p.y + dy) * g.W + p.x + dx)); let walk = 0;
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) if (groundsWalk(o, x, y)) { walk++; if (!seen.has(y * g.W + x)) return 'a tile that cannot be walked to'; }
  if (g.soils.length !== GROUNDS.BEDS.reduce((a, b) => a + b, 0) + hides.reduce((a, h) => a + h.beds.length, 0)) return 'too few beds';
  for (const s of g.soils) { if (g.rows[s.y][s.x] !== 's') return 'a bed that is not soil'; if (!near(s)) return 'a bed that cannot be reached'; }
  for (const h of hides) { if (g.rows[h.door.y][h.door.x] !== 'D') return 'a hidden place with no way in'; if (!shut.has(h.at.y * g.W + h.at.x)) return 'a way in that cannot be walked up to'; if (h.thing && !near(h.thing)) return 'a find that cannot be reached'; }
  if (!seen.has(g.gate.y * g.W + g.gate.x)) return 'no way to the gate';
  return walk < 90 ? 'too little room' : '';
}
/* The same seed always gives the same garden, and a bed keeps its number, so what is planted stays put. */
function genGrounds(seed) {
  for (let a = 0; a < 60; a++) { const g = tryGrounds((seed + a * 7919) >>> 0); if (g) return hideGrounds(g, seed >>> 0); }
  return hideGrounds(tryGrounds(seed >>> 0, true), seed >>> 0);
}
/* Sets the garden that tryGrounds made inside a wider hedge and hides places in it: rooms of three tiles by three
   behind the left, right and top of the old outer hedge, each with one way in. It rolls its own numbers and adds
   its beds after the others, so the garden inside, and every bed's number, stay as they were. */
function hideGrounds(b, seed) {
  const P = GROUNDS.PAD, W = b.W + 2 * P, H = b.H + P, r = RNG((seed ^ 0x5ec2e7) >>> 0), t = [], mv = p => ({ x: p.x + P, y: p.y + P });
  for (let y = 0; y < H; y++) { t.push(new Array(W).fill('#')); if (y >= P) for (let x = 0; x < b.W; x++) t[y][x + P] = b.rows[y - P][x]; }
  const soils = b.soils.map(mv), open = ch => ch === '.' || ch === ',', cands = [];
  const cand = (side, x, y, dx, dy, along) => { const a = t[y + dy][x + dx]; if (open(a) || a === '#' && open(t[y + 2 * dy][x + 2 * dx])) cands.push({ side, x, y, dx, dy, along }); };
  for (let y = P + 2; y <= P + b.H - 3; y++) { cand(0, P, y, 1, 0, y); cand(1, P + b.W - 1, y, -1, 0, y); }
  for (let x = P + 2; x <= P + b.W - 3; x++) cand(2, x, P, 0, 1, x);
  r.shuffle(cands); const picked = [];
  for (const c of cands) { if (picked.length >= GROUNDS.HIDES) break; if (picked.every(p => p.side !== c.side || Math.abs(p.along - c.along) >= 5)) picked.push(c); }
  const kinds = r.shuffle(['over', 'vines', 'lock', r.chance(0.5) ? 'over' : 'vines']), prizes = r.shuffle(Object.keys(HIDE_PRIZES));
  const room = (c, kind, prize, r) => {
    const cx = c.x - 2 * c.dx, cy = c.y - 2 * c.dy, at = { x: c.x + c.dx, y: c.y + c.dy };
    const h = { kind, prize, door: { x: c.x, y: c.y }, at, x0: cx - 1, y0: cy - 1, x1: cx + 1, y1: cy + 1, beds: [] };
    for (let y = h.y0; y <= h.y1; y++) for (let x = h.x0; x <= h.x1; x++) t[y][x] = '.';
    t[c.y][c.x] = 'D'; if (t[at.y][at.x] === '#') t[at.y][at.x] = ',';
    if (kind === 'over') h.ob = r.chance(0.5) ? 'bramble' : 'boulder';   // cleared by an Ember or a Stone little, as in a quest
    if (kind === 'lock') h.el = r.pick(ELS);                              // the flower that opens it
    if (prize === 'beds' || prize === 'rich') for (let k = prize === 'beds' ? -1 : 0; k <= 0; k++) { t[cy - 1][cx + k] = 's'; h.beds.push(soils.length); soils.push(prize === 'rich' ? { x: cx + k, y: cy - 1, rich: true } : { x: cx + k, y: cy - 1 }); }
    else { h.thing = { x: cx, y: cy - 1 }; t[cy - 1][cx] = prize === 'wild' ? 'W' : 'P'; if (prize === 'wild') h.wild = r.pick(ELS); else { h.pod = []; for (let k = 0; k < GROUNDS.POD; k++) h.pod.push(r.pick(ELS)); } }
    return h;
  };
  const hides = picked.map((c, i) => room(c, kinds[i], prizes[i], r));
  // two more, added later: they roll numbers of their own and come after the first four, which stay as they were
  const r2 = RNG((seed ^ 0x77a1c3) >>> 0), more = [];
  for (const c of cands) { if (more.length >= GROUNDS.MORE) break; if (!picked.includes(c) && picked.concat(more).every(p => p.side !== c.side || Math.abs(p.along - c.along) >= 5)) more.push(c); }
  more.forEach((c, i) => { const h = room(c, i ? 'season' : 'night', i ? 'wild' : 'beds', r2); if (i) { h.season = r2.pick(GARDEN_SEASONS); h.wild = r2.pick(FLOWER_IDS.filter(id => FLOWERS[id].a !== FLOWERS[id].b)); } hides.push(h); });
  return { W, H, rows: t.map(row => row.join('')), start: mv(b.start), gate: mv(b.gate), soils, hides, plain: b.plain, seed };
}
function tryGrounds(seed, plain) {
  const r = RNG(seed), { W, H, CELL, COLS, ROWS } = GROUNDS, t = []; for (let y = 0; y < H; y++) t.push(new Array(W).fill('#'));
  const mid = (i, j) => ({ x: 1 + CELL * i + 2, y: 1 + CELL * j + 2 }), glades = [];
  // glades: each fills its part of the grid, less a hedge on any side. Two glades with no hedge between them make one lawn
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const x0 = 1 + CELL * i, y0 = 1 + CELL * j, in1 = () => plain || !r.chance(0.35) ? 0 : 1, l = in1(), rt = in1(), u = in1(), d = in1();
    const G = { i, j, x0: x0 + l, x1: x0 + CELL - 1 - rt, y0: y0 + u, y1: y0 + CELL - 1 - d, used: 0 }; glades.push(G);
    for (let y = G.y0; y <= G.y1; y++) for (let x = G.x0; x <= G.x1; x++) t[y][x] = '.';
  }
  // paths: a way from the gate's glade to every other, and two more so that the paths loop
  const id = (i, j) => j * COLS + i, home = { i: 1, j: ROWS - 1 }, seen = new Set([id(home.i, home.j)]), live = [home], links = [], linked = new Set();
  const link = (a, b) => { const k = Math.min(id(a.i, a.j), id(b.i, b.j)) + ':' + Math.max(id(a.i, a.j), id(b.i, b.j)); if (linked.has(k)) return; linked.add(k); links.push([a, b]); };
  while (live.length) {
    const cur = live[live.length - 1], o = r.shuffle(DIRS.slice()).map(([dx, dy]) => ({ i: cur.i + dx, j: cur.j + dy })).filter(n => n.i >= 0 && n.j >= 0 && n.i < COLS && n.j < ROWS && !seen.has(id(n.i, n.j)));
    if (!o.length) { live.pop(); continue; }
    seen.add(id(o[0].i, o[0].j)); link(cur, o[0]); live.push(o[0]);
  }
  for (let k = 0; k < 2; k++) { const a = { i: r.int(0, COLS - 1), j: r.int(0, ROWS - 1) }, [dx, dy] = r.pick(DIRS), b = { i: a.i + dx, j: a.j + dy }; if (b.i >= 0 && b.j >= 0 && b.i < COLS && b.j < ROWS) link(a, b); }
  for (const [a, b] of links) { const p = mid(a.i, a.j), q = mid(b.i, b.j); for (let x = Math.min(p.x, q.x); x <= Math.max(p.x, q.x); x++) for (let y = Math.min(p.y, q.y); y <= Math.max(p.y, q.y); y++) t[y][x] = ','; }
  const hm = mid(home.i, home.j), gate = { x: hm.x, y: H - 1 }, start = { x: hm.x, y: H - 2 };
  for (let y = hm.y; y < H - 1; y++) t[y][hm.x] = ','; t[gate.y][gate.x] = 'G';
  const gladeOf = (x, y) => glades.find(G => x >= G.x0 && x <= G.x1 && y >= G.y0 && y <= G.y1);
  if (!plain) {
    // a pond in one glade away from the gate, and a few lone trees
    const ponds = r.shuffle(glades.filter(G => G.j < ROWS - 1)); let made = false;
    for (const G of ponds) {
      const spots = []; for (let y = G.y0; y < G.y1; y++) for (let x = G.x0; x < G.x1; x++) if ([[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => t[y + dy][x + dx] === '.')) spots.push({ x, y });
      if (!spots.length) continue; const s = r.pick(spots), wide = r.chance(0.5) && s.x + 2 <= G.x1 && t[s.y][s.x + 2] === '.' && t[s.y + 1][s.x + 2] === '.';
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < (wide ? 3 : 2); dx++) t[s.y + dy][s.x + dx] = '~'; G.used += 2; made = true; break;
    }
    if (!made) return null;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (t[y][x] === '.' && r.chance(0.05)) t[y][x] = 'T';
  }
  // beds: rows of two or three patches of soil side by side, each row in a glade of its own where there is room
  const soils = [];
  for (const n of GROUNDS.BEDS) {
    const runs = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x + n < W; x++) {
      let ok = true; for (let k = 0; k < n && ok; k++) ok = t[y][x + k] === '.' && DIRS.every(([dx, dy]) => t[y + dy][x + k + dx] !== 's');
      if (ok) runs.push({ x, y, G: gladeOf(x, y) });
    }
    if (!runs.length) return null;
    r.shuffle(runs); runs.sort((a, b) => (a.G ? a.G.used : 9) - (b.G ? b.G.used : 9)); const s = runs[0]; if (s.G) s.G.used += 1;
    for (let k = 0; k < n; k++) { t[s.y][s.x + k] = 's'; soils.push({ x: s.x + k, y: s.y }); }
  }
  const g = { W, H, rows: t.map(row => row.join('')), start, gate, soils, plain: !!plain };
  return groundsProblem(g) ? null : g;
}
if (typeof module !== 'undefined') module.exports = { FLOWERS, FLOWER_IDS, flowerId, crossOf, flowerNeed, isLily, isNightHour, nightFrom, GARDEN_SEASONS, FLOWER_STAGES, GROUNDS, HIDE_KINDS, HIDE_PRIZES, groundsWalk, groundsFlood, groundsOpen, groundsProblem, genGrounds, WANDER, WDIRS, WANDER_OPENS, wanderWalk, wanderCan, genWander, GLIDE, glideStep, genGlide, glideLine, glidePay, WEAVE, weaveStars, threadsCross, weaveCan, HIDE, genHide, fillParty, GARDEN_N, GARDEN_REACH, gardenReach, gardenOpen, gardenWays, genGarden, gardenPay, SECRET_RATE, STARFALL, genStarfall, starfallPay, FORMS, formFor, formScores, PAIRS, canClear, fireFrom, RULES, songOrder, RNG, KINDS, OBST, GLOOMS, BIOMES, SIZES, ELS, genWorld, planSolve, flood, nearIn, pathFrom, passable, fightCost, maxSparks, kindsOf, petLevel, littleLevel, makeName, DIRS };
