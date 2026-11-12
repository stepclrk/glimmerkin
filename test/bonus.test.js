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

console.log(fail ? 'FAILED: ' + fail : 'ALL CHECKS PASSED');
process.exit(fail ? 1 : 0);
