/* ===== Little game: Berry Swap, a Sproutling's game. Swap two berries side by side to line up three ===== */
const berryPlural = el => BERRY[el].endsWith('y') ? BERRY[el].slice(0, -1) + 'ies' : BERRY[el] + 's';
function drawBerryAt(c, el, x, y, r) {
  const h = EL_HUE[el]; glow(c, x, y, r * 2, h, 100, 65, 0.22);
  c.fillStyle = hsl(h, 80, 58); c.strokeStyle = hsl(h + 20, 55, 24); c.lineWidth = Math.max(1, r * 0.18); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); c.fill();
  c.fillStyle = '#7fd47a'; c.beginPath(); c.ellipse(x + r * 0.3, y - r, r * 0.5, r * 0.22, -0.6, 0, TAU); c.fill(); c.stroke();
}
function drawStarfruitAt(c, x, y, r, t) {
  glow(c, x, y, r * 2.1, 48, 100, 70, 0.45 + 0.15 * Math.sin(t * 4)); c.fillStyle = '#ffd24a'; c.strokeStyle = '#a2621a'; c.lineWidth = Math.max(1, r * 0.12);
  starPath(c, x, y, r * 1.1, r * 0.5, 5, -Math.PI / 2 + Math.sin(t * 2) * 0.08); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.3, r * 0.18, 0, TAU); c.fill();
}
GAMES.swap = {
  name: 'Berry Swap', kind: 'bloom', rule: 'Swap',
  line: 'Swap berries side by side to line up three, and fill a basket with its favourite berries.',
  hint: 'Swap two berries side by side to line up three. Drag one onto its neighbour, or tap one and then the other.',
  text: 'The bed holds the six berries. Swap two that sit side by side, across or up and down, so that three or more of one berry line up: they go, and the berries above drop down. A swap that lines nothing up swaps back and costs nothing. Four or more in a line leave a starfruit: swap it with anything beside it and it clears its whole row and column. Every berry of the little\'s own kind that goes lands in its basket. Fill the basket, or play until the swaps run out.',
  icon(c, x, y, r) { drawBerryAt(c, 'bloom', x - r * 0.42, y + r * 0.2, r * 0.36); drawBerryAt(c, 'ember', x + r * 0.42, y + r * 0.2, r * 0.36); drawBerryAt(c, 'tide', x, y - r * 0.42, r * 0.36); },
  best: s => s + ' in a basket',
  start(b) {
    const n = SWAP.n; b.n = n; b.r = RNG(b.seed); b.grid = swapFill(b.r, n); b.own = Math.max(0, ELS.indexOf(b.l.kind)); b.left = SWAP.swaps; b.basket = 0; b.goal = SWAP.goal;
    b.off = new Array(n * n).fill(0); b.sel = -1; b.drag = null; b.ph = null; b.pops = []; b.idle = 0; b.hintMove = null; b.done = 0; this.layout(b); bonusCount(b.left + ' swaps left');
  },
  layout(b) {
    if (!b.n) return; const top = b.y + 66, cell = Math.min(58, (b.w - 28) / b.n, (b.y + b.h - top - 8) / b.n);
    b.cell = cell; b.bx = b.x + (b.w - cell * b.n) / 2; b.by = top + Math.max(0, (b.y + b.h - top - cell * b.n) / 2 - 10);
  },
  cellAt(b, pt) { const i = Math.floor((pt.x - b.bx) / b.cell), j = Math.floor((pt.y - b.by) / b.cell); return i >= 0 && j >= 0 && i < b.n && j < b.n ? j * b.n + i : -1; },
  mid(b, k) { return { x: b.bx + (k % b.n + 0.5) * b.cell, y: b.by + (Math.floor(k / b.n) + 0.5) * b.cell }; },
  down(b, pt) { if (b.ph || b.done) return; const k = this.cellAt(b, pt); b.drag = k >= 0 ? { k, x: pt.x, y: pt.y } : null; },
  move(b, pt) {
    const d = b.drag; if (!d || b.ph) return; const dx = pt.x - d.x, dy = pt.y - d.y; if (Math.hypot(dx, dy) < b.cell * 0.4) return;
    const n = b.n, x = d.k % n, k2 = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (x < n - 1 ? d.k + 1 : -1) : (x > 0 ? d.k - 1 : -1)) : (dy > 0 ? d.k + n : d.k - n);
    b.drag = null; b.sel = -1; if (k2 >= 0 && k2 < n * n) this.trySwap(b, d.k, k2);
  },
  up(b, pt, tap) {
    const d = b.drag; b.drag = null; if (!d || !tap || b.ph || b.done) return;
    if (b.sel >= 0 && swapNext(b.sel, d.k, b.n)) { const a = b.sel; b.sel = -1; this.trySwap(b, a, d.k); }
    else { b.sel = b.sel === d.k ? -1 : d.k; sfx('pick'); }
  },
  trySwap(b, a, k) {
    b.idle = 0; b.hintMove = null;
    if (!swapCan(b.grid, b.n, a, k)) { b.ph = { k: 'nope', a, b: k, t: 0 }; sfx('no'); return; }
    b.ph = { k: 'swap', a, b: k, t: 0 }; b.left--; b.played = true; sfx('step'); bonusCount(b.left + ' swaps left');
  },
  /* One step of clearing, with its pops and the fall that follows. */
  step(b, first) {
    const g = b.grid, before = g.slice(), ph = b.ph, st = swapStep(g, b.n, b.r, first ? [ph.a, ph.b] : [], first ? ph.blast : null);
    if (!st) {
      if (!swapMoves(g, b.n).length) { const h = swapShuffle(g, b.n, b.r); h.forEach((v, i) => { g[i] = v; }); b.off.fill(-0.4); bonusHint('No swap was left on the bed, so the berries shuffled.'); sfx('tinkle'); }
      b.ph = null; this.settle(b); return;
    }
    for (const i of st.clear) { const m = this.mid(b, i), v = before[i]; b.pops.push({ x: m.x, y: m.y, v, t: 0 }); if (v === b.own) b.basket++; burst(m.x, m.y, v === SWAP.star ? 10 : 5, v === SWAP.star ? 48 : EL_HUE[ELS[v]] || 48, { v: 90, size: 3 }); }
    for (const i of st.made) { const m = this.mid(b, i); burst(m.x, m.y, 16, 48, { kind: 'star', v: 130, size: 5 }); floatText(m.x, m.y - 16, 'A starfruit!', '#ffe58a'); }
    const ownGone = st.counts[b.own] || 0; if (ownGone) { const m = this.mid(b, st.clear.find(i => before[i] === b.own)); floatText(m.x, m.y, '+' + ownGone + ' for the basket', '#d9ffcf'); }
    sfx(st.made.length || ph.blast && ph.blast.length && first ? 'skill' : 'pick');
    for (let i = 0; i < g.length; i++) b.off[i] = -st.fall[i];
    b.ph = { k: 'fall', t: 0, a: ph.a, b: ph.b };
  },
  settle(b) {
    if (b.basket >= b.goal && !b.done) { b.done = T; b.won = true; sfx('win'); bonusHint(b.l.name + '\'s basket is full!'); }
    else if (b.left <= 0 && !b.done) { b.done = T; bonusHint('No swaps left. Let\'s see the basket.'); }
  },
  tick(b, dt) {
    const ph = b.ph, sp = bonusSpeed();
    for (let i = 0; i < b.off.length; i++) if (b.off[i]) { b.off[i] = Math.min(0, b.off[i] + dt * sp * 9); }
    if (!ph) { if (!b.done) { b.idle += dt * sp; if (b.idle > 9 && !b.hintMove) { const m = swapMoves(b.grid, b.n); b.hintMove = m.length ? m[0] : null; } } return; }
    ph.t += dt * sp;
    if (ph.k === 'nope' && ph.t >= 0.3) b.ph = null;
    else if (ph.k === 'swap' && ph.t >= 0.16) { const g = b.grid; ph.blast = [ph.a, ph.b].filter(i => g[i] === SWAP.star).map(i => i === ph.a ? ph.b : ph.a); [g[ph.a], g[ph.b]] = [g[ph.b], g[ph.a]]; this.step(b, true); }
    else if (ph.k === 'fall' && ph.t >= 0.12 && b.off.every(v => v === 0)) this.step(b, false);
  },
  draw(b, c, dt) {
    this.tick(b, dt);
    const n = b.n, cell = b.cell, W = cell * n, bg = c.createLinearGradient(0, 0, 0, VH); bg.addColorStop(0, '#16352a'); bg.addColorStop(1, '#2f4a24'); c.fillStyle = bg; c.fillRect(0, 0, VW, VH);
    // the basket
    const py = b.y + 4; c.fillStyle = 'rgba(20,12,44,.55)'; rrect(c, b.x + 16, py, b.w - 32, 52, 14); c.fill();
    drawCreature(c, b.f.L, b.x + 46, py + 48, 38, T, { mood: b.won ? 'happy' : b.pops.length ? 'happy' : null, look: { x: 0.6, y: 0.2 } });
    const own = ELS[b.own], mw = b.w - 170, u = Math.min(1, b.basket / b.goal);
    c.font = '800 13px Nunito, system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#fff1cf'; c.fillText(b.l.name + '\'s basket of ' + berryPlural(own), b.x + 76, py + 17);
    c.fillStyle = 'rgba(255,255,255,.14)'; rrect(c, b.x + 76, py + 30, mw, 11, 6); c.fill(); c.fillStyle = hsl(EL_HUE[own], 85, 60); rrect(c, b.x + 76, py + 30, Math.max(11, mw * u), 11, 6); c.fill();
    drawBerryAt(c, own, b.x + b.w - 78, py + 31, 7); c.fillStyle = '#e8ffe0'; c.textAlign = 'left'; c.fillText(Math.min(b.basket, 99) + '/' + b.goal, b.x + b.w - 66, py + 32);
    // the bed
    c.fillStyle = '#5a3a24'; rrect(c, b.bx - 8, b.by - 8, W + 16, W + 16, 16); c.fill(); c.fillStyle = '#3a2a1a'; rrect(c, b.bx - 2, b.by - 2, W + 4, W + 4, 12); c.fill();
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { c.fillStyle = (i + j) % 2 ? 'rgba(120,90,60,.35)' : 'rgba(90,64,40,.35)'; c.fillRect(b.bx + i * cell, b.by + j * cell, cell, cell); }
    c.save(); c.beginPath(); c.rect(b.bx - 2, b.by - 2, W + 4, W + 4); c.clip();
    const ph = b.ph, sw = ph && (ph.k === 'swap' || ph.k === 'nope') ? ph : null;
    for (let k = 0; k < n * n; k++) {
      let { x, y } = this.mid(b, k); y += b.off[k] * cell;
      if (sw && (k === sw.a || k === sw.b)) { const o = this.mid(b, k === sw.a ? sw.b : sw.a), u2 = sw.k === 'swap' ? ease(Math.min(1, sw.t / 0.16)) : Math.sin(Math.min(1, sw.t / 0.3) * Math.PI) * 0.45; x += (o.x - x) * u2; y += (o.y - y) * u2; }
      const v = b.grid[k]; if (v === SWAP.star) drawStarfruitAt(c, x, y, cell * 0.3, T); else drawBerryAt(c, ELS[v], x, y + cell * 0.05, cell * 0.3);
    }
    b.pops = b.pops.filter(p => (p.t += dt * bonusSpeed()) < 0.3);
    for (const p of b.pops) { const s = 1 + p.t * 2; c.globalAlpha = 1 - p.t / 0.3; if (p.v === SWAP.star) drawStarfruitAt(c, p.x, p.y, cell * 0.3 * s, T); else drawBerryAt(c, ELS[p.v], p.x, p.y, cell * 0.3 * s); c.globalAlpha = 1; }
    c.restore();
    const ring = (k, col) => { if (k < 0) return; const m = this.mid(b, k); c.strokeStyle = col; c.lineWidth = 3; rrect(c, m.x - cell / 2 + 3, m.y - cell / 2 + 3, cell - 6, cell - 6, 9); c.stroke(); };
    ring(b.sel, '#fff3c4'); if (b.drag && !ph) ring(b.drag.k, 'rgba(255,243,196,.7)');
    if (b.hintMove && !ph && !b.done) { const a = 0.35 + 0.35 * Math.sin(T * 4); ring(b.hintMove[0], 'rgba(160,255,140,' + a + ')'); ring(b.hintMove[1], 'rgba(160,255,140,' + a + ')'); }
    if (b.done && T - b.done > 1.4 / bonusSpeed() && !ph) bonusEnd(false);
  },
  end(b) {
    const own = ELS[b.own], s = b.basket, word = s === 1 ? BERRY[own] : berryPlural(own);
    return { score: s, goal: b.goal, label: s + ' ' + word + ' in the basket', line: s >= b.goal ? b.l.name + '\'s basket is full to the brim.' : s ? b.l.name + ' is pleased with every one.' : 'The basket waits for next time.' };
  }
};
