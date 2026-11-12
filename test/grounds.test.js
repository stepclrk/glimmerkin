// Every sixth garden is a first quarter and the rest are further quarters, made from the same seed and the quarter's number.
// Checks that every garden can be walked all over and every bed in it reached, that a seed always gives the same
// garden, and that the beds planted before the hidden places came are still where they were. Each garden's hidden
// places must be shut until opened, every one must have a way in that can be walked up to, and with all of them open
// every tile, bed and find must be in reach.
const C = require('../src/core.js');
const P = C.GROUNDS.PAD, W = C.GROUNDS.W + 2 * P, H = C.GROUNDS.H + P, FIRST = C.GROUNDS.BEDS.reduce((a, b) => a + b, 0);
// the first ten beds of three seeds, as they were when the garden first shipped, counted from the old outer hedge
const KEPT = { 4242: [[2, 1], [3, 1], [4, 1], [3, 9], [4, 9], [5, 9], [8, 15], [9, 15], [11, 18], [12, 18]], 1: [[3, 19], [4, 19], [5, 19], [6, 2], [7, 2], [8, 2], [1, 4], [2, 4], [7, 14], [8, 14]], 99: [[12, 19], [13, 19], [14, 19], [1, 20], [2, 20], [3, 20], [14, 10], [15, 10], [7, 2], [8, 2]] };
const N = 4000; let fail = 0, plain = 0, ponds = 0, walk = 0, trees = 0; const shapes = new Set(), kinds = {}, prizes = {};
const say = (seed, why, g) => { fail++; if (fail < 6) console.log('seed', seed, why, '\n' + g.rows.join('\n')); };
// one seed's first four hidden places as they first shipped: how each is hidden, what it holds, its way in, and what opens or fills it
const HID = '[["over","wild",20,22,"bramble","stone"],["vines","pod",20,11,"","glowglowstone"],["vines","rich",4,7,"",""],["lock","beds",4,12,"stone",""]]';
{ const g = C.genGrounds(4242); if (JSON.stringify(g.hides.slice(0, C.GROUNDS.HIDES).map(h => [h.kind, h.prize, h.door.x, h.door.y, h.ob || h.el || '', h.wild || (h.pod || []).join('')])) !== HID) say(4242, 'the hidden places have changed', g); }
// the flowers: six plain and fifteen crosses, each with a name of its own, and the rule for what two blooms make
{ const ids = C.FLOWER_IDS, names = new Set(ids.map(id => C.FLOWERS[id].name)), g = C.genGrounds(1);
  if (ids.length !== 21 || names.size !== 21) say(1, 'not 21 flowers with 21 names', g);
  for (const a of C.ELS) for (const b of C.ELS) { const id = C.crossOf(a, b); if (!C.FLOWERS[id] || id !== C.crossOf(b, a) || (a === b) !== (id === a)) say(1, 'two plain flowers that make no seed: ' + a + ' ' + b, g); }
  if (C.crossOf('ember+tide', 'ember') !== null || C.crossOf('ember+tide', 'ember+tide') !== 'ember+tide' || C.FLOWERS['ember+tide'].name !== 'Embercup') say(1, 'a cross that crosses wrongly', g);
  if ([0, 1, 2].map(st => C.flowerNeed('ember+tide', st)).join() !== 'ember,tide,ember' || C.flowerNeed('glow', 1) !== 'glow' || [0, 1, 2].map(st => C.flowerNeed('ember+glow', st)).join() !== 'ember,glow,glow' || !C.isLily('tide+glow') || C.isLily('tide')) say(1, 'a flower that needs the wrong little', g); }
for (const seed in KEPT) { const g = C.genGrounds(+seed); if (JSON.stringify(g.soils.slice(0, FIRST).map(s => [s.x - P, s.y - P])) !== JSON.stringify(KEPT[seed])) say(seed, 'the first beds have moved', g); }
for (let n = 0; n < N; n++) {
  const seed = C.quarterSeed((n * 2654435761) >>> 0, n % C.QUARTERS), g = C.genGrounds(seed), bad = C.groundsProblem(g);
  const again = C.genGrounds(seed), same = again.rows.join('\n') === g.rows.join('\n') && JSON.stringify(again.soils) === JSON.stringify(g.soils) && JSON.stringify(again.hides) === JSON.stringify(g.hides);
  const all = g.rows.join(''), hs = g.hides, h4 = hs.slice(0, C.GROUNDS.HIDES), count = ch => all.split(ch).length - 1;
  const why = bad || (!same ? 'not the same garden twice' : '')
    || (g.rows.length !== H || g.H !== H || g.W !== W || g.rows.some(r => r.length !== W) ? 'the wrong size' : '')
    || (g.rows[g.start.y][g.start.x] !== ',' ? 'the start is not on a path' : '')
    || (g.rows[g.gate.y][g.gate.x] !== 'G' || count('G') !== 1 ? 'not exactly one gate' : '')
    || (count('s') !== g.soils.length ? 'soil that is not a numbered bed' : '')
    || (g.rows[0].replace(/#/g, '') || g.rows.some(r => r[0] !== '#' || r[r.length - 1] !== '#') || g.rows[g.H - 1].replace(/[#G]/g, '') ? 'a gap in the outer hedge' : '')
    || (new Set(g.soils.map(s => s.x + ',' + s.y)).size !== g.soils.length ? 'two beds on one tile' : '')
    || (hs.length !== C.GROUNDS.HIDES + C.GROUNDS.MORE ? 'too few hidden places' : '')
    || (count('D') !== hs.length ? 'a way in that belongs to no hidden place' : '')
    || (new Set(h4.map(h => h.prize)).size !== h4.length || hs.some(h => !C.HIDE_PRIZES[h.prize]) ? 'two of the first four hidden places hold the same thing' : '')
    || (['over', 'vines', 'lock'].some(k => !h4.some(h => h.kind === k)) || hs[4].kind !== 'night' || hs[5].kind !== 'season' || hs.some(h => !C.HIDE_KINDS[h.kind]) ? 'a way of hiding is missing' : '')
    || (hs[4].beds.length !== 2 || !C.GARDEN_SEASONS.includes(hs[5].season) || !/\+/.test(hs[5].wild) ? 'a night or season place that holds the wrong thing' : '')
    || (hs.some(h => h.kind === 'over' && !C.OBST[h.ob]) || hs.some(h => h.kind === 'lock' && !C.FLOWERS[h.el]) ? 'a hidden place that nothing opens' : '')
    || (hs.some(h => h.prize === 'wild' && !C.FLOWERS[h.wild] || h.prize === 'pod' && (h.pod.length !== C.GROUNDS.POD || h.pod.some(el => !C.FLOWERS[el]))) ? 'a find with nothing in it' : '')
    || (hs.some(h => h.beds.some(i => i < FIRST || !(g.soils[i].x >= h.x0 && g.soils[i].x <= h.x1 && g.soils[i].y >= h.y0 && g.soils[i].y <= h.y1))) || g.soils.filter(s => s.rich).length !== 1 ? 'a hidden bed in the wrong place' : '')
    || (!g.far || g.rows[g.far.y][g.far.x] !== 'N' || count('N') !== 1 || g.far.y !== P || g.farAt.y !== P + 1 || !'.,'.includes(g.rows[g.farAt.y][g.farAt.x]) || hs.some(h => h.door.x === g.far.x && h.door.y === g.far.y) ? 'no far gate' : '')
    || (hs.some((h, i) => hs.some((o, j) => j > i && h.x0 <= o.x1 + 1 && o.x0 <= h.x1 + 1 && h.y0 <= o.y1 + 1 && o.y0 <= h.y1 + 1)) ? 'two hidden places touch' : '');
  if (why) say(seed, why, g);
  for (const h of hs) { kinds[h.kind] = (kinds[h.kind] || 0) + 1; prizes[h.prize] = (prizes[h.prize] || 0) + 1; }
  if (g.plain) plain++; if (all.includes('~')) ponds++; walk += (all.match(/[.,]/g) || []).length; trees += count('T'); shapes.add(all);
}
if (plain > N / 50) { fail++; console.log('too many gardens fell back to the plain one:', plain); }
if (shapes.size < N * 0.99) { fail++; console.log('gardens repeat:', shapes.size, 'different of', N); }
console.log({ gardens: N, fail, plain, ponds, different: shapes.size, walkableTiles: Math.round(walk / N), trees: +(trees / N).toFixed(1), kinds, prizes });
console.log(C.genGrounds(4242).rows.join('\n'));
process.exit(fail ? 1 : 0);
