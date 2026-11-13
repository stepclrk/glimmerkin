// Checks that every generated world can be finished with the party's base sparks, playing by the real rules.
const C = require('../src/core.js');
const kinds = Object.keys(C.KINDS);
const rules = {}; let pairs = 0, twinPairs = 0, fireSpreads = 0, songs = 0, gusted = 0, gustNeeded = 0, n = 0, fail = 0, gates = 0, moons = 0, foes = 0, fallback = 0, rares = 0, giftsAsked = 0, giftsPlaced = 0, bosses = 0, held = 0;
const r = C.RNG(42);
const keyOf = (w, p) => p ? p.y * w.W + p.x : -1;
// Checks of each world type's rule that the play-through below does not cover on its own.
function ruleProblem(w) {
  const fixed = [keyOf(w, w.start), keyOf(w, w.exit), keyOf(w, w.plate)];
  if (w.rule === 'tidehollow') {
    // flats exist, never under the start, the portal or the moon plate; the play-through below runs at low tide,
    // which always comes round again
    if (!w.cells.some(c => c.flat)) return 'no flats';
    if (fixed.some(k => k >= 0 && w.cells[k].flat)) return 'a flat under a fixed spot';
  }
  if (w.rule === 'gloamglass') {
    // lamps stand on open floor; and in the dark, walking only to tiles already seen (the creature lights the
    // tiles next to it, with no Glow little) still reaches every tile of the planned route and sees the portal
    if (!w.cells.some(c => c.lamp)) return 'no lamps';
    if (fixed.some(k => k >= 0 && w.cells[k].lamp) || w.cells.some(c => c.lamp && c.t !== 'floor')) return 'a lamp on a fixed spot';
    const region = C.planSolve(w), seen = new Set(), been = new Set(), look = k => { const x = k % w.W, y = (k - x) / w.W; seen.add(k); for (const [dx, dy] of C.DIRS) if (x + dx >= 0 && y + dy >= 0 && x + dx < w.W && y + dy < w.H) seen.add((y + dy) * w.W + x + dx); };
    const s0 = keyOf(w, w.start); been.add(s0); look(s0);
    for (let more = true; more;) { more = false; for (const k of region.keys()) if (!been.has(k) && seen.has(k)) { been.add(k); look(k); more = true; } }
    if ([...region.keys()].some(k => !been.has(k))) return 'part of the route stays dark';
    if (!seen.has(keyOf(w, w.exit))) return 'the portal is never seen';
  }
  if (w.rule === 'cloudspire') {
    // wind pads come in twin pairs on open floor, away from the start, the portal and the moon plate
    const pads = w.cells.map((c, k) => [c, k]).filter(([c]) => c.pad !== undefined);
    if (!pads.length) return 'no wind pads';
    if (pads.some(([c, k]) => w.cells[c.pad].pad !== k || c.t !== 'floor' || fixed.includes(k))) return 'a wind pad without a twin, or on a fixed spot';
    if (w.cut) { gusted++; const st = { gateOpen: true, songOpen: true }, keep = w.cells.map(c => c.pad); w.cells.forEach(c => { delete c.pad; });
      // with every blocker gone but no gusts, count how often the gust is the only way through
      const saved = w.cells.map(c => c.t === 'ob' ? c.cleared : null), foes = w.cells.map(c => c.enemy); w.cells.forEach(c => { if (c.t === 'ob') c.cleared = true; c.enemy = null; });
      if (!C.flood(w, w.start.x, w.start.y, st).has(keyOf(w, w.exit))) gustNeeded++;
      w.cells.forEach((c, k) => { if (keep[k] !== undefined) c.pad = keep[k]; if (c.t === 'ob') c.cleared = saved[k]; c.enemy = foes[k]; }); }
  }
  if (w.rule === 'emberfall') {
    // thickets stand only on the pillars between paths; fire only ever opens ground, so after the planned route,
    // burning every bramble (and whatever the fire spreads to) must still leave the portal reachable
    if (w.cells.some((c, k) => c.t === 'thicket' && ((k % w.W) % 2 === 0 || Math.floor(k / w.W) % 2 === 0))) return 'a thicket off the pillars';
    const before = w.cells.map(c => [c.t, c.cleared]), planned = C.planSolve(w).size;
    w.cells.forEach((c, k) => { if (c.t === 'ob' && c.ob === 'bramble' && !c.cleared) for (const wave of C.fireFrom(w, k)) for (const a of wave) { const d = w.cells[a]; if (d.t === 'thicket') d.t = 'floor'; else d.cleared = true; } });
    const ok = C.planSolve(w).size >= planned;
    w.cells.forEach((c, k) => { c.t = before[k][0]; c.cleared = before[k][1]; });
    if (!ok) return 'fire closed a way';
    if (w.cells.some((c, k) => c.t === 'ob' && c.ob === 'bramble' && C.fireFrom(w, k).length > 1)) fireSpreads++;
  }
  if (w.rule === 'mossroot') {
    // slick moss on open floor only, never beside anything that can change, and nothing to pick up where you cannot stop
    const live = c => c.t === 'ob' || c.t === 'gate' || c.t === 'door' || !!c.enemy, region = C.planSolve(w);
    if (!w.cells.some(c => c.slick)) return 'no slick moss';
    for (let k = 0; k < w.cells.length; k++) { const c = w.cells[k]; if (!c.slick) continue; const x = k % w.W, y = Math.floor(k / w.W);
      if (c.t !== 'floor' || fixed.includes(k)) return 'slick moss on a fixed spot';
      if (C.DIRS.some(([dx, dy]) => { const a = x + dx, b = y + dy; return a >= 0 && b >= 0 && a < w.W && b < w.H && live(w.cells[b * w.W + a]); })) return 'slick moss beside a blocker';
      if (c.item && !region.has(k)) return 'loot where you can only slide past: ' + c.item.k; }
  }
  if (w.rule === 'stonesong') {
    if (!w.door || !w.song || w.song.length < 2) return 'no song door';
    if (w.cells[keyOf(w, w.door)].t !== 'door') return 'the door is not on the map';
    if (w.song.some(p => fixed.includes(keyOf(w, p)) || w.cells[keyOf(w, p)].t !== 'floor')) return 'a song stone on a fixed spot';
  }
  return null;
}
// 6,000 worlds as a first generation sees them, then 3,000 deeper ones for later generations (DEEP in core.js), whose
// littles have grown and carry more sparks.
const deepStats = C.DEEP.map(() => ({ n: 0, crit: 0, foes: 0, hearts: 0, bosses: 0, most: 0 }));
for (let t = 0; t < 9000; t++) {
  const deep = t < 6000 ? 0 : 1 + (t % 2);
  const size = r.pick(['nook', 'vale', 'realm']), q = deep ? r.int(15, 40) : r.int(0, 14), ps = r.int(1, 3);
  const party = []; for (let i = 0; i < ps; i++) { const kind = r.pick(kinds), kind2 = r.chance(0.2) ? r.pick(kinds.filter(k => k !== kind)) : undefined; party.push({ kind, kind2, max: 3 + (kind === 'stone' || kind2 === 'stone' ? 1 : 0), sp: 0 }); }
  if (deep) party.forEach(p => { p.max += r.int(0, 2); });   // grown-up littles
  const rare = r.chance(0.2), gifts = ['a', 'b', 'c'].slice(0, r.int(0, 3)), noRule = r.chance(0.15), noPair = r.chance(0.15);   // a gentle start holds rules and pairs back
  const w = C.genWorld(r.int(1, 2 ** 31 - 1), party, q, rare ? 'realm' : size, r.pick(C.BIOMES).id, { eggOk: true, rare, gifts, twin: 0.2, fly: party.some(p => p.kind === 'gale'), noRule, noPair, deep });
  if (w && noRule && w.rule) { fail++; console.log('a rule in a world that holds rules back'); }
  if (w && noPair && w.cells.some(c => c.t === 'ob' && C.PAIRS[c.ob])) { fail++; console.log('a pair blocker in a world that holds pairs back'); }
  if (w && (noRule || noPair)) held++;
  if (w) { rares += rare ? 1 : 0; giftsAsked += gifts.length; giftsPlaced += w.gifts || 0; if (rare && !w.cells.some(c => c.enemy && c.enemy.boss)) { fail++; console.log('rare world without boss'); } }
  n++;
  if (!w) { fail++; console.log('no world', size, q, party.map(p => p.kind)); continue; }
  { const d = deepStats[deep], crit = w.cells.filter(c => c.crit && c.t === 'ob').length, boss = w.cells.find(c => c.enemy && c.enemy.boss); d.n++; d.crit += crit; d.most = Math.max(d.most, crit); d.foes += w.cells.some(c => c.crit && c.enemy && !c.enemy.boss) ? 1 : 0; if (boss) { d.bosses++; d.hearts = Math.max(d.hearts, boss.enemy.tough); }
    if (crit > C.DEEP[deep].gates || (boss && boss.enemy.tough > C.DEEP[deep].hearts)) { fail++; console.log('deeper than its depth allows', deep, crit, boss && boss.enemy.tough); } }
  if (w.rule) { rules[w.rule] = (rules[w.rule] || 0) + 1; const bad = ruleProblem(w); if (bad) { fail++; if (fail < 6) console.log('RULE', w.rule, bad); continue; } }
  party.forEach(p => p.sp = p.max);
  const st = { gateOpen: false }; let shards = 0, won = false;
  for (let guard = 0; guard < 80 && !won; guard++) {
    const prev = C.flood(w, w.start.x, w.start.y, st); let ch = false;
    for (const k of prev.keys()) { const c = w.cells[k]; if (c.item) { if (c.item.k === 'shard' && !c.item.bonus) shards++; if (c.item.k === 'dew') party.forEach(p => p.sp = Math.min(p.max, p.sp + 1)); c.item = null; } }
    if (w.rule === 'mossroot') {   // slides are one-way: from every tile reached so far, the start must still be reachable
      const s0 = keyOf(w, w.start); if ([...prev.keys()].some(k => !C.flood(w, k % w.W, Math.floor(k / w.W), st).has(s0))) { console.log('STRANDED'); break; }
    }
    if (prev.has(w.exit.y * w.W + w.exit.x) && shards >= w.need) { won = true; break; }
    if (w.plate && !st.gateOpen && prev.has(w.plate.y * w.W + w.plate.x)) { st.gateOpen = true; ch = true; }
    if (w.song && !st.songOpen && w.song.every(p => prev.has(keyOf(w, p)))) {
      // the stones must be rung in their order: each one reachable from the last without stepping on another
      const ks = w.song.map(p => keyOf(w, p)); let ok = true;
      for (let i = 0; i + 1 < ks.length && ok; i++) ok = C.flood(w, ks[i] % w.W, Math.floor(ks[i] / w.W), st, new Set(ks.filter((_, j) => j !== i && j !== i + 1))).has(ks[i + 1]);
      if (ok) { st.songOpen = true; ch = true; songs++; } else { console.log('SONG ORDER'); break; }
    }
    w.cells.forEach((c, k) => {
      if (!c.crit || ch) return; const x = k % w.W, y = (k - x) / w.W;
      if (C.nearIn(w, prev, x, y) < 0) return;
      if (c.t === 'ob' && !c.cleared && C.PAIRS[c.ob]) {
        // two littles of the pair's main kinds pay a spark each, or a twin with both kinds pays two
        const [A, B] = C.PAIRS[c.ob].pair, a = party.filter(p => p.kind === A && p.sp >= 1).sort((x, y) => y.sp - x.sp)[0], b = party.filter(p => p.kind === B && p.sp >= 1).sort((x, y) => y.sp - x.sp)[0];
        const t = party.find(p => p.kind2 && [A, B].every(k => k === p.kind || k === p.kind2) && p.sp >= 2);
        if (a && b) { a.sp--; b.sp--; c.cleared = true; ch = true; pairs++; } else if (t) { t.sp -= 2; c.cleared = true; ch = true; pairs++; twinPairs++; }
      }
      else if (c.t === 'ob' && !c.cleared) { const p = party.filter(p => C.KINDS[p.kind].clears === c.ob && p.sp >= 1).sort((a, b) => a.sp - b.sp)[0]; if (p) { p.sp--; c.cleared = true; ch = true; gates++; } }
      else if (c.enemy && c.enemy.boss) { let ok = true; while (c.enemy.tough > 0) { const p = party.slice().sort((a, b) => b.sp - a.sp)[0]; if (p.sp < 1) { ok = false; break; } p.sp--; c.enemy.tough -= C.GLOOMS[c.enemy.g].weak === p.kind ? 2 : 1; } if (ok) { c.enemy = null; ch = true; bosses++; } }
      else if (c.enemy) { const p = party.filter(p => p.kind === c.planKind).sort((a, b) => b.sp - a.sp).find(p => p.sp >= C.fightCost(c.enemy, p.kind)); if (p) { p.sp -= C.fightCost(c.enemy, p.kind); c.enemy = null; ch = true; foes++; } }
    });
    if (!ch) break;
  }
  if (w.gate) moons++;
  if (!won) { fail++; if (fail < 6) console.log('UNSOLVED', size, q, party.map(p => p.kind + p.sp), 'shards', shards, '/', w.need); }
}
console.log('pair blockers cleared', pairs, 'of them by a twin alone', twinPairs);
console.log('rules', rules, 'song doors opened', songs, 'gust worlds with a cut', gusted, 'where only a gust gets through', gustNeeded, 'fire worlds where a fire can spread', fireSpreads);
console.log('by depth', deepStats.map((d, i) => ({ depth: i, worlds: d.n, blockersOnTheWay: +(d.crit / d.n).toFixed(2), most: d.most, withGloom: +(d.foes / d.n).toFixed(2), mostHearts: d.hearts })));
if (!(deepStats[1].crit / deepStats[1].n > deepStats[0].crit / deepStats[0].n && deepStats[2].most > deepStats[0].most && deepStats[2].hearts > deepStats[0].hearts)) { fail++; console.log('deeper worlds are not deeper'); }
console.log({ worlds: n, fail, gates, moons, foes, rares, bosses, giftsAsked, giftsPlaced, held });
process.exit(fail ? 1 : 0);
