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

if (fail) { console.log(fail + ' FAILED'); process.exit(1); }
console.log('ALL CHECKS PASSED');
