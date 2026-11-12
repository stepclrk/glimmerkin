// Checks the secret door and every bonus world's generator: each one built from a seed must be fair, as every
// generated world must be finishable.
const C = require('../src/core.js');
const kinds = Object.keys(C.KINDS), r = C.RNG(4242);
let fail = 0; const bad = (...a) => { fail++; if (fail < 12) console.log('FAIL', ...a); };
const randParty = () => { const n = r.int(1, 3), p = []; for (let i = 0; i < n; i++) { const kind = r.pick(kinds), kind2 = r.chance(0.2) ? r.pick(kinds.filter(k => k !== kind)) : undefined; p.push({ kind, kind2, max: 3 + (kind === 'stone' || kind2 === 'stone' ? 1 : 0) }); } return p; };

/* ---------- the secret door ---------- */
// A door is only ever on open floor the plan reaches, never on a fixed spot or under anything that must be found,
// and a world is the same with or without it apart from the berry it may take the place of.
let worlds = 0, doors = 0, forced = 0, deadEnds = 0;
for (let t = 0; t < 3000; t++) {
  const size = r.pick(['nook', 'vale', 'realm']), q = r.int(0, 14), party = randParty(), seed = r.int(1, 2 ** 31 - 1), biome = r.pick(C.BIOMES).id, rare = r.chance(0.1);
  const opts = s => ({ eggOk: true, rare, gifts: ['a', 'b'], twin: 0.2, fly: party.some(p => p.kind === 'gale'), secret: s });
  const plain = C.genWorld(seed, party, q, rare ? 'realm' : size, biome, opts(false)), w = C.genWorld(seed, party, q, rare ? 'realm' : size, biome, opts(true)), sure = C.genWorld(seed, party, q, rare ? 'realm' : size, biome, opts(1));
  worlds++; if (w.secret) doors++; if (sure.secret) forced++;
  if (rare && sure.secret) bad('a door in a rare world');
  for (const d of [w, sure]) {
    if (!d.secret) continue;
    const k = d.secret.y * d.W + d.secret.x, c = d.cells[k], fixed = [d.start, d.exit, d.plate].filter(Boolean).map(p => p.y * d.W + p.x);
    if (c.t !== 'floor' || c.item || c.enemy || c.slick || c.flat || c.lamp || c.pad !== undefined || fixed.includes(k) || (d.song && d.song.some(p => p.y * d.W + p.x === k))) bad('a door on a tile that is not quiet', seed);
    if (!C.planSolve(d).has(k)) bad('a door the plan cannot reach', seed);
    if (d === sure && C.DIRS.filter(([dx, dy]) => { const x = d.secret.x + dx, y = d.secret.y + dy; return x >= 0 && y >= 0 && x < d.W && y < d.H && d.cells[y * d.W + x].t !== 'wall' && d.cells[y * d.W + x].t !== 'islet' && d.cells[y * d.W + x].t !== 'thicket'; }).length === 1) deadEnds++;
    const a = JSON.parse(JSON.stringify(plain)), b = JSON.parse(JSON.stringify(d)); if (a.cells[k].item && a.cells[k].item.k !== 'berry') bad('a door took the place of something that matters', seed);
    a.cells[k].item = null; delete b.secret; if (JSON.stringify(a) !== JSON.stringify(b)) bad('the door changed the rest of the world', seed);
  }
}
if (doors < worlds * 0.17 || doors > worlds * 0.3) bad('doors in', doors, 'of', worlds, 'worlds: not about one in four');
console.log('secret doors', { worlds, doors, whenForced: forced, inDeadEnds: deadEnds });

/* ---------- Starfall ---------- */
// A perfect run exists: moving in a straight line from each mote or shard to the next never needs more than the
// cloud's assumed speed, and never comes within reach of a gloom as it lands.
let falls = 0, motes = 0, glooms = 0, minPay = 99, maxPay = 0;
for (let t = 0; t < 1500; t++) {
  const ks = [...new Set(randParty().flatMap(p => p.kind2 ? [p.kind, p.kind2] : [p.kind]))], f = C.genStarfall(r.int(1, 2 ** 31 - 1), ks), S = C.STARFALL; falls++;
  const good = f.drops.filter(d => d.k !== 'gloom'); let pts = 0, shards = 0;
  if (f.drops.some((d, i) => i && d.t < f.drops[i - 1].t)) bad('starfall drops out of order');
  if (f.drops.some(d => d.x < 0.05 || d.x > 0.95 || d.t < 1 || d.t > f.secs + 1.5)) bad('a drop outside the sky or the minute');
  good.forEach((d, i) => { if (d.k === 'shard') shards++; else pts += ks.includes(d.el) ? 2 : 1; if (i && Math.abs(d.x - good[i - 1].x) > S.speed * (d.t - good[i - 1].t) + 1e-9) bad('a mote out of reach of the one before'); });
  for (const g of f.drops.filter(d => d.k === 'gloom')) {
    glooms++; const i = good.findIndex(d => d.t > g.t), a = good[i - 1], b = good[i]; if (!a || !b) { bad('a gloom outside the run'); continue; }
    const at = a.x + (b.x - a.x) * (g.t - a.t) / (b.t - a.t); if (Math.abs(at - g.x) < S.clear - 1e-9) bad('a gloom on the way between two motes');
  }
  motes += good.length; const pay = C.starfallPay(pts, shards); minPay = Math.min(minPay, pay); maxPay = Math.max(maxPay, pay);
  if (good.length < 60) bad('too few motes', good.length);
}
if (C.starfallPay(0, 0) !== 10) bad('an empty run should still pay 10');
console.log('starfall', { falls, motesEach: Math.round(motes / falls), gloomsEach: +(glooms / falls).toFixed(1), perfectPay: [minPay, maxPay] });

/* ---------- Night garden ---------- */
// The stored answer opens every bud, no little stands on a bud or on another, every bud is of a kind some little
// has, and the count of answers is honest. Nearly every garden has exactly one answer.
let gardens = 0, single = 0, budsAll = 0, wildAll = 0, emptyOpens = 0;
for (let t = 0; t < 1500; t++) {
  const party = randParty().map(p => p.kind2 ? [p.kind, p.kind2] : [p.kind]), g = C.genGarden(r.int(1, 2 ** 31 - 1), party), N = C.GARDEN_N; gardens++;
  if (!g) { bad('no garden'); continue; }
  if (g.pieces.length !== 3 || party.some((ks, i) => ks.join() !== g.pieces[i].join())) bad('the party is not the garden\'s first littles');
  wildAll += 3 - party.length; budsAll += g.buds.length; if (g.ways === 1) single++;
  const spots = new Set(g.answer.map(a => a.y * N + a.x)), buds = new Set(g.buds.map(b => b.y * N + b.x));
  if (spots.size !== 3 || buds.size !== g.buds.length || [...spots].some(k => buds.has(k))) bad('littles or buds share a tile');
  if (g.buds.some(b => b.x < 0 || b.y < 0 || b.x >= N || b.y >= N || !g.pieces.some(ks => ks.includes(b.k)))) bad('a bud off the bed, or of a kind nobody has');
  if (!C.gardenOpen(g, g.answer).every(Boolean)) bad('the answer leaves a bud closed');
  if (C.gardenOpen(g, [null, null, null]).some(Boolean)) emptyOpens++;
  if (g.buds.length < 6 || g.ways < 1 || g.ways !== C.gardenWays(g, 4)) bad('too few buds, or a wrong count of answers', g.buds.length, g.ways);
  const pay = C.gardenPay(g); if (pay.dust !== 8 || Object.values(pay.berries).reduce((a, n) => a + n, 0) < 3) bad('a garden that pays too little');
}
if (emptyOpens) bad('buds open with nobody placed');
if (single < gardens * 0.93) bad('too few gardens with one answer', single, 'of', gardens);
console.log('night garden', { gardens, oneAnswer: single, budsEach: +(budsAll / gardens).toFixed(1), wildHelpersEach: +(wildAll / gardens).toFixed(2) });

/* ---------- Hide and seek ---------- */
// Five hide, the party first and wild littles making up the number, each behind a place of its own, each showing
// at least three tenths of itself, and every hiding place is inside the scene with room between it and the next.
let scenes = 0, wildAll2 = 0, pools = 0, minShow = 1, minGap = 9;
for (let t = 0; t < 1500; t++) {
  const party = randParty().map(p => p.kind2 ? [p.kind, p.kind2] : [p.kind]), g = C.genHide(r.int(1, 2 ** 31 - 1), party), H = C.HIDE; scenes++;
  if (g.props.length !== H.props || g.hiders.length !== H.hiders) bad('wrong number of hiding places or hiders');
  if (new Set(g.hiders.map(h => h.prop)).size !== H.hiders) bad('two littles behind one hiding place');
  g.hiders.forEach((h, i) => { if (h.wild !== (i >= party.length) || (!h.wild && h.kinds.join() !== party[i].join())) bad('the party does not hide first'); if (h.show < H.least) bad('a hider shows too little'); if (!h.kinds.every(k => kinds.includes(k))) bad('a hider of no kind'); if ((g.props[h.prop].t === 'pool') !== (h.peek === 'up' && g.props[h.prop].t === 'pool')) bad('a little beside a pool, not in it'); minShow = Math.min(minShow, h.show); });
  g.props.forEach((p, i) => { if (p.x < 0.12 || p.x > H.screens - 0.12) bad('a hiding place off the scene'); if (i) minGap = Math.min(minGap, p.x - g.props[i - 1].x); if (p.t === 'pool') pools++; });
  const wild = g.hiders.filter(h => h.wild); wildAll2 += wild.length;
  if (wild.length ? !wild.some(h => h.kinds[0] === g.egg) : g.egg !== null) bad('the egg is not a wild hider\'s kind');
}
if (minGap < 0.15) bad('hiding places too close together', minGap);
console.log('hide and seek', { scenes, wildEach: +(wildAll2 / scenes).toFixed(2), poolsEach: +(pools / scenes).toFixed(1), leastShown: +minShow.toFixed(2), leastGap: +minGap.toFixed(2) });

/* ---------- Starweave ---------- */
// Going round the outline, from any star and either way, is a thread that never stretches too far and never
// crosses itself; no two stars sit on top of each other; and the reach is short enough to rule some threads out.
let skies = 0, tooFar = 0, pairs = 0, closest = 9;
for (let t = 0; t < 1500; t++) {
  const shape = { bw: 0.84 + r.f() * 0.3, bh: 0.8 + r.f() * 0.26, top: 0.5 + r.f() * 0.35 }, g = C.weaveStars(r.int(1, 2 ** 31 - 1), shape), n = g.pts.length; skies++;
  if (n !== 14 || g.pts.filter(p => p.ear).length !== 2) bad('a sky without fourteen stars and two ears');
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = Math.hypot(g.pts[i].x - g.pts[j].x, g.pts[i].y - g.pts[j].y); closest = Math.min(closest, d); pairs++; if (d > g.reach) tooFar++; }
  for (const dir of [1, -1]) for (const from of [0, r.int(1, n - 1)]) {
    const path = []; for (let s = 0; s < n; s++) { const k = ((from + dir * s) % n + n) % n; if (!C.weaveCan(g, path, k)) { bad('the outline is not a thread that can be drawn', g.seed, s); break; } path.push(k); }
    if (path.length === n && C.threadsCross(g.pts[path[n - 1]], g.pts[path[0]], g.pts[path[3]], g.pts[path[4]])) bad('closing the outline crosses it');
  }
  if (C.weaveCan(g, [0, 1], 0) || C.weaveCan(g, [0, 1], 1)) bad('a star joined twice');
}
if (closest < 0.12) bad('two stars too close to tell apart', closest);
if (tooFar < pairs * 0.4) bad('the thread reaches nearly everywhere, so nothing is a puzzle');
console.log('starweave', { skies, closestStars: +closest.toFixed(2), pairsOutOfReach: Math.round(100 * tooFar / pairs) + '%' });

/* ---------- Skyglide ---------- */
// A flier that only holds when it is below the line a little way ahead takes at least 95 in 100 of the dewdrops,
// every wind ring, and never touches a cloud. Every cloud is clear of the line, and nothing lies outside the sky.
let glides = 0, dewAll = 0, gotAll = 0, worst = 1, cloudsAll = 0, chimes = 0;
for (let t = 0; t < 1500; t++) {
  const g = C.genGlide(r.int(1, 2 ** 31 - 1)), G = C.GLIDE, s = { y: 0.5, vy: 0 }, dt = 1 / 60; glides++; if (g.chime) chimes++;
  let got = 0, rings = 0, hit = 0, di = 0, ri = 0;
  for (let k = 1; k <= g.secs * 60; k++) {
    const now = k * dt; C.glideStep(s, s.y > C.glideLine(g, now + 0.12), dt);
    while (di < g.dew.length && g.dew[di].t <= now) { if (Math.abs(g.dew[di].y - s.y) <= G.reach) got++; di++; }
    while (ri < g.rings.length && g.rings[ri].t <= now) { if (Math.abs(g.rings[ri].y - s.y) <= G.reach) rings++; ri++; }
    if (g.clouds.some(c => Math.abs(c.t - now) <= G.cloudSecs && Math.abs(c.y - s.y) <= G.cloud + 0.04)) hit++;
  }
  if (hit) bad('the flier on the line touches a cloud', g.seed);
  if (rings !== g.rings.length || g.rings.length !== 4) bad('a wind ring off the line', g.seed);
  if (got < g.dew.length * 0.95) bad('dewdrops out of reach', got, 'of', g.dew.length);
  if (g.dew.length < 55) bad('too few dewdrops', g.dew.length);
  if ([...g.dew, ...g.rings, ...g.clouds].some(o => o.y < 0.08 || o.y > 0.92 || o.t < 2.5 || o.t > g.secs)) bad('something outside the sky or the flight');
  for (const c of g.clouds) if (Math.abs(C.glideLine(g, c.t) - c.y) < G.clear - 1e-9) bad('a cloud on the line');
  dewAll += g.dew.length; gotAll += got; worst = Math.min(worst, got / g.dew.length); cloudsAll += g.clouds.length;
}
if (C.glidePay(0) !== 5) bad('an empty glide should still pay 5');
console.log('skyglide', { glides, dewEach: Math.round(dewAll / glides), caught: Math.round(100 * gotAll / dewAll) + '%', worst: Math.round(100 * worst) + '%', cloudsEach: +(cloudsAll / glides).toFixed(1), chimeStones: Math.round(100 * chimes / glides) + '%' });

/* ---------- Wanderlings ---------- */
// The stored answer walks the wanderlings home, each little stands where it may, no two share a tile, and in
// nearly every puzzle nothing gets home with a little missing. The burrow and the nest are apart and on open ground.
let puzzles = 0, strict = 0, stepsAll = 0, wildAll3 = 0; const shapes = {};
for (let t = 0; t < 1500; t++) {
  const party = randParty().map(p => p.kind2 ? [p.kind, p.kind2] : [p.kind]), g = C.genWander(r.int(1, 2 ** 31 - 1), party), W = C.WANDER.W; puzzles++;
  if (!g) { bad('no puzzle', JSON.stringify(party)); continue; }
  if (g.pieces.length !== 3 || party.some((ks, i) => ks.join() !== g.pieces[i].join())) bad('the party is not the puzzle\'s first littles');
  wildAll3 += 3 - party.length; if (g.strict) strict++;
  const w = C.wanderWalk(g, g.answer); if (!w.home || w.path.length - 1 !== g.steps) bad('the answer does not bring them home', g.seed);
  if (g.answer.some((p, i) => !C.wanderCan(g, i, p.x, p.y)) || new Set(g.answer.map(p => p.y * W + p.x)).size !== 3) bad('a little where it may not stand', g.seed);
  if (g.strict && (C.wanderWalk(g, [null, null, null]).home || g.answer.some((_, i) => C.wanderWalk(g, g.answer.map((p, j) => j === i ? null : p)).home))) bad('home without every little', g.seed);
  if (g.cells[g.start.y * W + g.start.x] !== '.' || g.cells[g.home.y * W + g.home.x] !== '.' || (g.start.x === g.home.x && g.start.y === g.home.y)) bad('the burrow or the nest is not on open ground');
  if (g.steps < 8) bad('too short a walk', g.steps);
  for (const ch of g.cells) if (C.WANDER_OPENS[ch] && !g.pieces.some(ks => ks.includes(C.WANDER_OPENS[ch]))) bad('something in the way that nobody can open');
  stepsAll += g.steps; for (const ch of g.cells) shapes[ch] = (shapes[ch] || 0) + 1;
}
if (strict < puzzles * 0.97) bad('too many puzzles that do not need every little', puzzles - strict);
console.log('wanderlings', { puzzles, needEveryLittle: strict, stepsEach: +(stepsAll / puzzles).toFixed(1), rocksEach: +(shapes['#'] / puzzles).toFixed(1), wildHelpersEach: +(wildAll3 / puzzles).toFixed(2) });

console.log(fail ? 'FAILED: ' + fail : 'ALL CHECKS PASSED');
process.exit(fail ? 1 : 0);
