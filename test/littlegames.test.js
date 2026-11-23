// Checks the little games' rules (4.3.3): every bed, board or pool a little game builds from a seed is fair, and a
// player who simply looks for a good move can reach the goal most of the time.
const C = require('../src/core.js');
let fail = 0; const bad = (...a) => { fail++; if (fail < 12) console.log('FAIL', ...a); };

/* ---------- Berry Swap ---------- */
// A fresh bed has no line already made and at least one swap. After every swap is played out the bed is still like
// that (it shuffles when no swap is left). A player who looks for a swap that lines up its own berry fills the basket
// in most games, and every game pays between 5 and 15 stardust.
{
  const n = C.SWAP.n, T = 1500; let full = 0, stars = 0, shuffles = 0, min = 99, max = 0;
  for (let t = 0; t < T; t++) {
    const r = C.RNG(5000 + t), g = C.swapFill(r, n), own = t % 6, pr = C.RNG(9000 + t); let basket = 0;
    if (g.length !== n * n || g.some(v => v < 0 || v > 5)) bad('swap: a bed with something odd in it', t);
    if (C.swapRuns(g, n).length) bad('swap: a fresh bed with a line already made', t);
    if (!C.swapMoves(g, n).length) bad('swap: a fresh bed with no swap', t);
    if (C.swapPlay(g.slice(), n, C.RNG(1), 0, 2 * n)) bad('swap: two berries that are not side by side swapped');
    for (let s = 0; s < C.SWAP.swaps && basket < C.SWAP.goal; s++) {
      const ms = C.swapMoves(g, n); if (!ms.length) { bad('swap: stuck with no swap', t); break; }
      const mine = ms.filter(([a, b]) => { const h = g.slice(); [h[a], h[b]] = [h[b], h[a]]; return C.swapRuns(h, n).some(run => h[run[0]] === own) || h[a] === C.SWAP.star || h[b] === C.SWAP.star; });
      const [a, b] = mine.length ? pr.pick(mine) : pr.pick(ms), res = C.swapPlay(g, n, r, a, b);
      if (!res || !res.steps.length) { bad('swap: a swap that did nothing', t); break; }
      basket += res.counts[own] || 0; if (res.shuffled) shuffles++; stars += res.steps.reduce((m, st) => m + st.made.length, 0);
      if (C.swapRuns(g, n).length) bad('swap: a bed left with a line made', t);
      if (!C.swapMoves(g, n).length) bad('swap: a bed left with no swap', t);
      if (g.some(v => v < 0 || v > 6)) bad('swap: a bed with something odd in it after a swap', t);
    }
    if (basket >= C.SWAP.goal) full++;
    const pay = C.gamePay(basket, C.SWAP.goal); min = Math.min(min, pay); max = Math.max(max, pay);
  }
  if (full < T * 0.65 || full > T * 0.97) bad('swap: the basket filled in', full, 'of', T, 'games, not most of them');
  if (stars < T) bad('swap: hardly any starfruit', stars);
  if (min < 5 || max > 15) bad('swap: pay outside 5 to 15', min, max);
  console.log('berry swap', { games: T, basketFull: full, starfruit: stars, shuffles, pay: [min, max] });
}

/* ---------- Pebble Pile ---------- */
// Pieces come in a fair bag (never more than eight bends or four lines in a row), every turn and drop
// keeps a piece inside the burrow, and a pile too high to take the next piece is always stamped down to make room.
// A player who places each piece with some thought sings the goal's rows in 36 pieces (about what 90 seconds holds)
// in nearly every game; a player who drops pieces anywhere is stamped down, and the game never sticks.
{
  let T = 1500; const C0 = C; let reach = 0, stamps = 0, glows = 0, pieces = 0, rows = 0;
  const holes = w => { let h = 0, top = []; for (let x = 0; x < C.PILE.cols; x++) { let t = C.PILE.rows; for (let y = 0; y < C.PILE.rows; y++) if (w[y * C.PILE.cols + x]) { t = y; break; } top.push(t); for (let y = t + 1; y < C.PILE.rows; y++) if (!w[y * C.PILE.cols + x]) h++; } let bump = 0; for (let x = 1; x < top.length; x++) bump += Math.abs(top[x] - top[x - 1]); return -h * 4 - bump * 0.6 - (C.PILE.rows - Math.min(...top)) * 0.5; };
  for (let t = 0; t < T; t++) {
    for (const careful of [true, false]) {
      const next = C.pileBag(7000 + t), w = C.pileWell(), pr = C.RNG(t); let s = 0, run = 0, last = '';
      for (let k = 0; k < 36; k++) {
        const p = next(); pieces++; if (p.glow >= 0) glows++; run = p.k === last ? run + 1 : 1; last = p.k; if (run > (p.k === 'bend' ? 8 : 4)) bad('pile: too many of one kind in a row', t);
        let sp = C.pileSpawn(w, p); if (!sp) { stamps++; C.pileStamp(w); sp = C.pileSpawn(w, p); if (!sp) { bad('pile: no room even after a stamp', t); break; } }
        let best = null, bv = -1e9; const opts = [];
        for (let rot = 0; rot < C.PILE_SHAPES[sp.k].length; rot++) for (let x = -2; x < C.PILE.cols; x++) { const q = Object.assign({}, sp, { rot, x }); if (!C.pileFits(w, q)) continue; const d = C.pileDrop(w, q); opts.push(d); if (careful) { const w2 = w.slice(), r2 = C.pileLand(w2, d), v = r2.count * 10 + holes(w2); if (v > bv) { bv = v; best = d; } } }
        if (!opts.length) { bad('pile: a piece with nowhere to go', t); break; }
        const turned = C.pileTurn(w, sp); if (turned && !C.pileFits(w, turned)) bad('pile: a turn into something', t);
        const res = C.pileLand(w, careful ? best : pr.pick(opts)); s += res.count; rows += res.rows.length;
        if (w.length !== C.PILE.cols * C.PILE.rows) bad('pile: the burrow changed size', t);
      }
      if (careful && s >= C.PILE.goal) reach++;
    }
  }
  if (reach < T * 0.9) bad('pile: the goal sung in only', reach, 'of', T, 'careful games');
  if (glows < pieces * 0.1 || glows > pieces * 0.2) bad('pile: glowing pebbles in', glows, 'of', pieces, 'pieces');
  if (!stamps) bad('pile: a careless player was never stamped down');
  console.log('pebble pile', { games: T, goalReached: reach, rowsSung: rows, stamps, glows, pieces, pay: [C.gamePay(0, C.PILE.goal), C.gamePay(99, C.PILE.goal)] });
}

if (fail) { console.log(fail + ' FAILED'); process.exit(1); }
console.log('ALL CHECKS PASSED');
