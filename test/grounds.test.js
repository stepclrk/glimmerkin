// Checks that every garden can be walked all over and every bed in it reached, and that a seed always gives the
// same garden, so what a player has planted stays where they planted it.
const C = require('../src/core.js');
const N = 4000; let fail = 0, plain = 0, ponds = 0, walk = 0, trees = 0; const shapes = new Set();
for (let n = 0; n < N; n++) {
  const seed = (n * 2654435761) >>> 0, g = C.genGrounds(seed), bad = C.groundsProblem(g);
  const again = C.genGrounds(seed), same = again.rows.join('\n') === g.rows.join('\n') && JSON.stringify(again.soils) === JSON.stringify(g.soils);
  const all = g.rows.join('');
  const why = bad || (!same ? 'not the same garden twice' : '')
    || (g.rows.length !== C.GROUNDS.H || g.rows.some(r => r.length !== C.GROUNDS.W) ? 'the wrong size' : '')
    || (g.rows[g.start.y][g.start.x] !== ',' ? 'the start is not on a path' : '')
    || (g.rows[g.gate.y][g.gate.x] !== 'G' || (all.match(/G/g) || []).length !== 1 ? 'not exactly one gate' : '')
    || ((all.match(/s/g) || []).length !== g.soils.length ? 'soil that is not a numbered bed' : '')
    || (g.rows[0].replace(/#/g, '') || g.rows.some(r => r[0] !== '#' || r[r.length - 1] !== '#') || g.rows[g.H - 1].replace(/[#G]/g, '') ? 'a gap in the outer hedge' : '')
    || (new Set(g.soils.map(s => s.x + ',' + s.y)).size !== g.soils.length ? 'two beds on one tile' : '');
  if (why) { fail++; if (fail < 6) console.log('seed', seed, why, '\n' + g.rows.join('\n')); }
  if (g.plain) plain++; if (all.includes('~')) ponds++; walk += (all.match(/[.,]/g) || []).length; trees += (all.match(/T/g) || []).length; shapes.add(g.rows.join(''));
}
if (plain > N / 50) { fail++; console.log('too many gardens fell back to the plain one:', plain); }
if (shapes.size < N * 0.99) { fail++; console.log('gardens repeat:', shapes.size, 'different of', N); }
console.log({ gardens: N, fail, plain, ponds, different: shapes.size, walkableTiles: Math.round(walk / N), trees: +(trees / N).toFixed(1) });
console.log(C.genGrounds(4242).rows.join('\n'));
process.exit(fail ? 1 : 0);
