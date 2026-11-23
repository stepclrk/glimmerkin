/* ===== Little game: Bubble Pop, a Puddlefin's game. Tap touching bubbles of one colour; the rest float up ===== */
const POP_HUE = [0, 200, 330, 160, 48];   // by colour 1 to 4
function drawBubbleAt(c, x, y, r, hue, hi) {
  if (hi) glow(c, x, y, r * 1.9, hue, 100, 75, 0.55);
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, hsl(hue, 90, 92, 0.9)); g.addColorStop(0.7, hsl(hue, 80, 66, 0.6)); g.addColorStop(1, hsl(hue, 80, 50, 0.85));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = hi ? '#fff' : hsl(hue, 90, 88, 0.9); c.lineWidth = hi ? 2.2 : 1.2; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.4, r * 0.2, r * 0.12, -0.7, 0, TAU); c.fill();
}
function drawPearlAt(c, x, y, r) { glow(c, x, y, r * 2.2, 200, 30, 95, 0.5); c.fillStyle = '#f4f0ff'; c.strokeStyle = '#b8b0d8'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, TAU); c.fill(); }
GAMES.pop = {
  name: 'Bubble Pop', kind: 'tide', rule: 'Pop',
  line: 'Pop bubbles of one colour that touch, and watch the rest float up into the gaps.',
  hint: 'Tap two or more bubbles of one colour that touch. The bubbles below float up to fill the gap.',
  text: 'The pool is full of bubbles in four colours. Tap a bubble that touches another of its colour, across or up and down, and the whole group pops. Bubbles float, so the ones below rise into the gap, and when a column is empty the columns to its right move along. Six or more at once leave a pearl. The game ends when no two touching bubbles match. Pop 50 to reach the goal, and every one of them to clear the pool.',
  icon(c, x, y, r) { drawBubbleAt(c, x - r * 0.42, y + r * 0.3, r * 0.4, 200); drawBubbleAt(c, x + r * 0.42, y + r * 0.3, r * 0.4, 330); drawBubbleAt(c, x, y - r * 0.4, r * 0.4, 160); },
  best: s => s + ' bubbles popped',
  start(b) {
    const p = genPop(b.seed) || genPop(b.seed + 1); b.g = p.g; b.total = b.g.length; b.popped = 0; b.pearls = 0; b.oy = new Array(b.total).fill(0); b.ox = new Array(b.total).fill(0);
    b.pops = []; b.hi = null; b.done = 0; b.idle = 0; this.layout(b); bonusCount(this.left(b));
  },
  layout(b) { const top = b.y + 66, C = POP.cols, R = POP.rows, cell = Math.min(52, (b.w - 40) / C, (b.y + b.h - top - 54) / R); b.cell = cell; b.bx = b.x + (b.w - cell * C) / 2; b.by = top + 6; },
  left(b) { const n = b.total - b.popped; return n === 1 ? '1 bubble left' : n + ' bubbles left'; },
  at(b, pt) { const i = Math.floor((pt.x - b.bx) / b.cell), j = Math.floor((pt.y - b.by) / b.cell); return i >= 0 && j >= 0 && i < POP.cols && j < POP.rows ? j * POP.cols + i : -1; },
  mid(b, k) { return { x: b.bx + (k % POP.cols + 0.5) * b.cell, y: b.by + (Math.floor(k / POP.cols) + 0.5) * b.cell }; },
  down(b, pt) { if (b.done) return; const k = this.at(b, pt); b.hi = k >= 0 && b.g[k] ? popGroup(b.g, k) : null; },
  up(b, pt, tap) {
    const hi = b.hi; b.hi = null; if (!tap || b.done || !hi) return; b.idle = 0;
    if (hi.length < 2) { sfx('no'); bonusHint('That bubble has nobody of its colour beside it. Look for two or more that touch.'); return; }
    const v = b.g[hi[0]], mids = hi.map(k => this.mid(b, k));
    for (const m of mids) { b.pops.push({ x: m.x, y: m.y, v, t: 0 }); burst(m.x, m.y, 4, POP_HUE[v], { v: 70, size: 2.5, g: -20 }); }
    const from = popApply(b.g, hi), C = POP.cols;
    for (let k = 0; k < b.g.length; k++) if (b.g[k] && from[k] >= 0) { b.oy[k] = Math.floor(from[k] / C) - Math.floor(k / C); b.ox[k] = from[k] % C - k % C; }
    b.popped += hi.length; b.played = true; sfx(hi.length >= POP.pearl ? 'skill' : 'pick'); bonusCount(this.left(b));
    const cx = mids.reduce((s, m) => s + m.x, 0) / mids.length, cy = mids.reduce((s, m) => s + m.y, 0) / mids.length;
    if (hi.length >= POP.pearl) { b.pearls++; floatText(cx, cy, 'A pearl!', '#e8f6ff'); burst(cx, cy, 16, 200, { kind: 'star', v: 120, size: 4 }); }
    else floatText(cx, cy, '+' + hi.length, '#cdf3ff');
    if (!popGroups(b.g).length) { b.done = T; const clear = b.popped >= b.total; if (clear) { sfx('win'); bonusHint('The pool is clear!'); } else bonusHint('No two touching bubbles match now. ' + b.popped + ' popped.'); }
  },
  draw(b, c, dt) {
    const sp = bonusSpeed(), C = POP.cols, R = POP.rows, cell = b.cell, W = cell * C, H = cell * R;
    for (let k = 0; k < b.oy.length; k++) { if (b.oy[k] > 0) b.oy[k] = Math.max(0, b.oy[k] - dt * sp * 7); if (b.ox[k] > 0) b.ox[k] = Math.max(0, b.ox[k] - dt * sp * 6); }
    const bg = c.createLinearGradient(0, 0, 0, VH); bg.addColorStop(0, '#0e3a5a'); bg.addColorStop(1, '#06203a'); c.fillStyle = bg; c.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 7; i++) { c.strokeStyle = 'rgba(180,240,255,.05)'; c.lineWidth = 18; c.beginPath(); c.moveTo(i * 70 - 40 + Math.sin(T * 0.4 + i) * 10, b.y); c.lineTo(i * 70 + 60, VH); c.stroke(); }
    // the meter and the pearls
    const py = b.y + 4; c.fillStyle = 'rgba(20,12,44,.55)'; rrect(c, b.x + 16, py, b.w - 32, 52, 14); c.fill();
    c.font = '800 13px Nunito, system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#fff1cf'; c.fillText(b.popped >= b.total ? 'The pool is clear!' : 'Pop ' + POP.goal + ' bubbles', b.x + 34, py + 17);
    const mw = b.w - 140, u = Math.min(1, b.popped / POP.goal); c.fillStyle = 'rgba(255,255,255,.14)'; rrect(c, b.x + 34, py + 30, mw, 11, 6); c.fill(); c.fillStyle = hsl(200, 85, 62); rrect(c, b.x + 34, py + 30, Math.max(11, mw * u), 11, 6); c.fill();
    drawPearlAt(c, b.x + b.w - 84, py + 30, 7); c.fillStyle = '#e8f6ff'; c.fillText(String(b.pearls), b.x + b.w - 72, py + 31);
    // the pool
    c.fillStyle = 'rgba(160,230,255,.08)'; rrect(c, b.bx - 8, b.by - 8, W + 16, H + 16, 18); c.fill(); c.strokeStyle = 'rgba(180,240,255,.35)'; c.lineWidth = 2; c.stroke();
    const hi = b.hi && b.hi.length >= 2 ? new Set(b.hi) : null;
    for (let k = 0; k < b.g.length; k++) { const v = b.g[k]; if (!v) continue; const m = this.mid(b, k), wob = Math.sin(T * 2 + k) * cell * 0.02; drawBubbleAt(c, m.x + b.ox[k] * cell, m.y + b.oy[k] * cell + wob, cell * 0.44, POP_HUE[v], hi && hi.has(k)); }
    b.pops = b.pops.filter(p => (p.t += dt * sp) < 0.25);
    for (const p of b.pops) { c.globalAlpha = 1 - p.t / 0.25; c.strokeStyle = hsl(POP_HUE[p.v], 90, 85); c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, cell * 0.44 * (1 + p.t * 3), 0, TAU); c.stroke(); c.globalAlpha = 1; }
    // the Puddlefin, swimming along the bottom of the pool
    const fx = b.bx + W * (0.5 + 0.38 * Math.sin(T * 0.5)), fy = b.by + H + 46;
    drawCreature(c, b.f.L, fx, fy, Math.min(40, cell), T, { mood: b.pops.length ? 'happy' : null, look: { x: Math.cos(T * 0.5) > 0 ? 0.6 : -0.6, y: -0.6 } });
    if (!b.done && !b.pops.length) { b.idle += dt * sp; if (b.idle > 10) { const g = popGroups(b.g)[0]; if (g) for (const k of g) { const m = this.mid(b, k); c.strokeStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(T * 4)).toFixed(2) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(m.x, m.y, cell * 0.48, 0, TAU); c.stroke(); } } }
    if (b.done && T - b.done > 1.4 / sp) bonusEnd(false);
  },
  end(b) { const s = b.popped, clear = s >= b.total; return { score: s, goal: POP.goal, label: s + (s === 1 ? ' bubble popped' : ' bubbles popped') + (b.pearls ? ', ' + b.pearls + (b.pearls === 1 ? ' pearl' : ' pearls') : ''), line: clear ? 'The pool is clear, every last bubble.' : s >= POP.goal ? b.l.name + ' blows a bubble of its own to say thank you.' : s ? b.l.name + ' loved every pop.' : 'The pool waits for next time.' }; }
};
