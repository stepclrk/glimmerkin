// Checks that every generated world can be finished with the party's base sparks, playing by the real rules.
const C = require('../src/core.js');
const kinds = Object.keys(C.KINDS);
let n = 0, fail = 0, gates = 0, moons = 0, foes = 0, fallback = 0, rares = 0, giftsAsked = 0, giftsPlaced = 0, bosses = 0;
const r = C.RNG(42);
for (let t = 0; t < 6000; t++) {
  const size = r.pick(['nook', 'vale', 'realm']), q = r.int(0, 14), ps = r.int(1, 3);
  const party = []; for (let i = 0; i < ps; i++) { const kind = r.pick(kinds); party.push({ kind, max: 3 + (kind === 'stone' ? 1 : 0), sp: 0 }); }
  const rare = r.chance(0.2), gifts = ['a', 'b', 'c'].slice(0, r.int(0, 3));
  const w = C.genWorld(r.int(1, 2 ** 31 - 1), party, q, rare ? 'realm' : size, r.pick(C.BIOMES).id, { eggOk: true, rare, gifts, twin: 0.2, fly: party.some(p => p.kind === 'gale') });
  if (w) { rares += rare ? 1 : 0; giftsAsked += gifts.length; giftsPlaced += w.gifts || 0; if (rare && !w.cells.some(c => c.enemy && c.enemy.boss)) { fail++; console.log('rare world without boss'); } }
  n++;
  if (!w) { fail++; console.log('no world', size, q, party.map(p => p.kind)); continue; }
  party.forEach(p => p.sp = p.max);
  const st = { gateOpen: false }; let shards = 0, won = false;
  for (let guard = 0; guard < 80 && !won; guard++) {
    const prev = C.flood(w, w.start.x, w.start.y, st); let ch = false;
    for (const k of prev.keys()) { const c = w.cells[k]; if (c.item) { if (c.item.k === 'shard' && !c.item.bonus) shards++; if (c.item.k === 'dew') party.forEach(p => p.sp = Math.min(p.max, p.sp + 1)); c.item = null; } }
    if (prev.has(w.exit.y * w.W + w.exit.x) && shards >= w.need) { won = true; break; }
    if (w.plate && !st.gateOpen && prev.has(w.plate.y * w.W + w.plate.x)) { st.gateOpen = true; ch = true; }
    w.cells.forEach((c, k) => {
      if (!c.crit || ch) return; const x = k % w.W, y = (k - x) / w.W;
      if (C.nearIn(w, prev, x, y) < 0) return;
      if (c.t === 'ob' && !c.cleared) { const p = party.filter(p => C.KINDS[p.kind].clears === c.ob && p.sp >= 1).sort((a, b) => a.sp - b.sp)[0]; if (p) { p.sp--; c.cleared = true; ch = true; gates++; } }
      else if (c.enemy && c.enemy.boss) { let ok = true; while (c.enemy.tough > 0) { const p = party.slice().sort((a, b) => b.sp - a.sp)[0]; if (p.sp < 1) { ok = false; break; } p.sp--; c.enemy.tough -= C.GLOOMS[c.enemy.g].weak === p.kind ? 2 : 1; } if (ok) { c.enemy = null; ch = true; bosses++; } }
      else if (c.enemy) { const p = party.filter(p => p.kind === c.planKind).sort((a, b) => b.sp - a.sp).find(p => p.sp >= C.fightCost(c.enemy, p.kind)); if (p) { p.sp -= C.fightCost(c.enemy, p.kind); c.enemy = null; ch = true; foes++; } }
    });
    if (!ch) break;
  }
  if (w.gate) moons++;
  if (!won) { fail++; if (fail < 6) console.log('UNSOLVED', size, q, party.map(p => p.kind + p.sp), 'shards', shards, '/', w.need); }
}
console.log({ worlds: n, fail, gates, moons, foes, rares, bosses, giftsAsked, giftsPlaced });
process.exit(fail ? 1 : 0);
