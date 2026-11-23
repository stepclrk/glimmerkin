/* ===== Little game: Pebble Pile, a Pebblit's game. Pebbles fall into a burrow in threes; a full row sings ===== */
const PILE_HUE = [0, 262, 14, 118, 200, 48, 170];   // by colour 1 to 6
function drawPebbleAt(c, x, y, r, hue, seed, lit, a) {
  if (a !== undefined) c.globalAlpha = a;
  if (lit) glow(c, x, y, r * 1.9, 50, 100, 75, 0.5);
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1); g.addColorStop(0, hsl(hue, 60, 80)); g.addColorStop(1, hsl(hue, 45, 46));
  c.fillStyle = g; c.strokeStyle = hsl(hue, 40, 22); c.lineWidth = Math.max(1, r * 0.1); c.beginPath();
  for (let i = 0; i <= 10; i++) { const an = i / 10 * TAU, q = r * (0.9 + 0.1 * Math.sin(an * 3 + seed)); c[i ? 'lineTo' : 'moveTo'](x + Math.cos(an) * q * 1.04, y + Math.sin(an) * q * 0.94); }
  c.closePath(); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.38, r * 0.25, r * 0.14, -0.6, 0, TAU); c.fill();
  if (lit) { c.fillStyle = '#fff6c8'; starPath(c, x, y, r * 0.42, r * 0.16, 4, 0.3); c.fill(); }
  if (a !== undefined) c.globalAlpha = 1;
}
GAMES.pile = {
  name: 'Pebble Pile', kind: 'stone', rule: 'Stack',
  line: 'Drop pebbles into the burrow three at a time, and fill a row to make it sing.',
  hint: 'Drag to move the pebbles, tap to turn them, swipe down to drop them. Fill a row from side to side to make it sing.',
  text: 'Pebbles fall into the burrow three at a time, in a line or a bend. Drag sideways to move them, tap to turn them, and swipe down to drop them straight to the bottom. A row filled from side to side sings and goes, and everything above drops down. A glowing pebble makes its row count twice. If the pile gets so high that the next pebbles cannot come in, the little hops on top and stamps it down: the top rows go, and the game goes on. It lasts a minute and a half.',
  icon(c, x, y, r) { drawPebbleAt(c, x - r * 0.42, y + r * 0.32, r * 0.38, 262, 1); drawPebbleAt(c, x + r * 0.42, y + r * 0.32, r * 0.38, 14, 2); drawPebbleAt(c, x, y - r * 0.38, r * 0.38, 118, 3, true); },
  best: s => s + (s === 1 ? ' row sung' : ' rows sung'),
  start(b) {
    b.well = pileWell(); b.bag = pileBag(b.seed); b.cur = pileSpawn(b.well, b.bag()); b.nxt = b.bag(); b.clock = 0; b.fallT = 0; b.score = 0; b.stamps = 0; b.go = false; b.done = 0;
    b.sing = []; b.stampT = 0; b.drag = null; b.land = 0; this.layout(b); bonusCount(this.left(b));
  },
  layout(b) {
    const C = PILE.cols, R = PILE.rows, cell = Math.min(46, (b.w - 150) / C, (b.h - 24) / R);
    b.cell = cell; b.wx = b.x + Math.max(16, (b.w - 130 - cell * C) / 2); b.wy = b.y + Math.max(8, (b.h - cell * R) / 2); b.px = b.wx + cell * C + 18;
  },
  left(b) { const s = Math.max(0, Math.ceil(PILE.secs - b.clock)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' left'; },
  shift(b, dx) { const q = Object.assign({}, b.cur, { x: b.cur.x + dx }); if (pileFits(b.well, q)) { b.cur = q; return true; } return false; },
  down(b, pt) { b.go = true; if (b.done || !b.cur) return; b.drag = { x: pt.x, y: pt.y, cx: b.cur.x, t: T, moved: false }; },
  move(b, pt) {
    const d = b.drag; if (!d || b.done || !b.cur) return; const dx = pt.x - d.x; if (Math.abs(dx) > 6 || Math.abs(pt.y - d.y) > 6) d.moved = true;
    const want = d.cx + Math.round(dx / b.cell); let moved = false; while (b.cur.x !== want && this.shift(b, Math.sign(want - b.cur.x))) moved = true; if (moved) sfx('step');
  },
  up(b, pt, tap) {
    const d = b.drag; b.drag = null; if (!d || b.done || !b.cur) return;
    const dy = pt.y - d.y, dx = pt.x - d.x;
    if (tap || !d.moved) { const q = pileTurn(b.well, b.cur); if (q) { b.cur = q; sfx('pick'); } else sfx('no'); b.played = true; return; }
    if (dy > b.cell * 1.5 && dy > Math.abs(dx) * 1.2) { b.cur = pileDrop(b.well, b.cur); b.played = true; this.settle(b); return; }
    if (b.cur.x !== d.cx) b.played = true;
  },
  /* The piece has come to rest: set it down, sing any full rows, and bring in the next. */
  settle(b) {
    const res = pileLand(b.well, b.cur), C = PILE.cols; b.land = T; sfx('step');
    if (res.rows.length) {
      b.score += res.count; b.sing.push(...res.rows.map(y => ({ y, t: 0 })));
      const my = b.wy + (res.rows[0] + 0.5) * b.cell, mx = b.wx + C * b.cell / 2;
      burst(mx, my, 24, 46, { kind: 'star', v: 160, size: 5 }); floatText(mx, my - 12, (res.rows.length > 1 ? res.rows.length + ' rows sing!' : 'The row sings!') + ' +' + res.count, '#ffe58a');
      sfx('note', CHIME_NOTES[Math.min(CHIME_NOTES.length - 1, b.score % CHIME_NOTES.length)]); bonusHint(b.score >= PILE.goal ? 'That is ' + b.score + ' rows sung. Keep going!' : GAMES.pile.hint);
    }
    b.cur = pileSpawn(b.well, b.nxt); b.nxt = b.bag(); b.fallT = 0;
    if (!b.cur) {
      const gone = pileStamp(b.well); b.stamps++; b.stampT = 1; sfx('hit');
      burst(b.wx + C * b.cell / 2, b.wy + b.cell * 2, 30, 30, { v: 200, size: 4, up: 40 }); bonusHint(b.l.name + ' hops on the pile and stamps it down. ' + gone + ' pebbles bounce away.');
      b.cur = pileSpawn(b.well, b.nxt); b.nxt = b.bag();
    }
  },
  tick(b, dt) {
    const sp = bonusSpeed(); b.stampT = Math.max(0, b.stampT - dt * 1.5);
    b.sing = b.sing.filter(s => (s.t += dt * sp) < 0.5);
    if (!b.go && b.t > 1.5) b.go = true;
    if (!b.go || b.done) return;
    b.clock += dt * sp; bonusCount(this.left(b));
    if (b.clock >= PILE.secs) { b.done = T; b.cur = null; bonusHint('Time! ' + this.best(b.score) + '.'); sfx('win'); return; }
    if (!b.cur) return;
    b.fallT += dt * sp; const step = pileStep(b.clock);
    if (b.fallT >= step) { b.fallT -= step; const q = Object.assign({}, b.cur, { y: b.cur.y + 1 }); if (pileFits(b.well, q)) b.cur = q; else this.settle(b); }
  },
  draw(b, c, dt) {
    this.tick(b, dt);
    const C = PILE.cols, R = PILE.rows, cell = b.cell, W = cell * C, H = cell * R, X = i => b.wx + (i + 0.5) * cell, Y = j => b.wy + (j + 0.5) * cell;
    const bg = c.createLinearGradient(0, 0, 0, VH); bg.addColorStop(0, '#2a1a3a'); bg.addColorStop(1, '#4a2f2a'); c.fillStyle = bg; c.fillRect(0, 0, VW, VH);
    const rs = RNG(b.seed); for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(255,220,180,' + (0.03 + rs.f() * 0.05).toFixed(3) + ')'; c.beginPath(); c.arc(rs.f() * VW, b.y + rs.f() * b.h, 3 + rs.f() * 9, 0, TAU); c.fill(); }
    // the burrow
    c.fillStyle = 'rgba(12,6,20,.62)'; rrect(c, b.wx - 8, b.wy - 8, W + 16, H + 16, 18); c.fill(); c.strokeStyle = '#7a5236'; c.lineWidth = 4; c.stroke();
    c.strokeStyle = 'rgba(120,180,90,.6)'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(b.wx - 8 + i * W / 3, b.wy - 8); c.quadraticCurveTo(b.wx + i * W / 3 + 6, b.wy + 10, b.wx + i * W / 3 - 4, b.wy + 22); c.stroke(); }
    const shake = b.stampT > 0 ? Math.sin(T * 60) * b.stampT * 3 : 0;
    for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) { const v = b.well[j * C + i]; if (v) drawPebbleAt(c, X(i) + shake, Y(j), cell * 0.44, PILE_HUE[v % 10], i * 3 + j, v > 10); }
    for (const s of b.sing) { const a = 1 - s.t / 0.5, g = c.createLinearGradient(b.wx, 0, b.wx + W, 0); g.addColorStop(0, 'rgba(255,215,120,0)'); g.addColorStop(0.5, 'rgba(255,235,170,' + (0.7 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,215,120,0)'); c.fillStyle = g; c.fillRect(b.wx, b.wy + s.y * cell, W, cell); }
    if (b.cur) {
      const land = pileDrop(b.well, b.cur); c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,240,200,.5)'; c.lineWidth = 1.5;
      for (const [i, j] of pileCells(land)) if (j >= 0) { c.beginPath(); c.arc(X(i), Y(j), cell * 0.4, 0, TAU); c.stroke(); } c.setLineDash([]);
      const fy = Math.min(1, b.fallT / pileStep(b.clock)) * 0.25;
      pileCells(b.cur).forEach(([i, j], k) => { if (j >= 0) drawPebbleAt(c, X(i), Y(j) + (pileFits(b.well, Object.assign({}, b.cur, { y: b.cur.y + 1 })) ? fy * cell : 0), cell * 0.44, PILE_HUE[b.cur.hues[k]], k + 5, b.cur.glow === k); });
    }
    // what comes next, the rows sung, and the little on its ledge
    const pw = Math.max(80, b.x + b.w - b.px - 16), px = b.px;
    c.fillStyle = 'rgba(20,12,44,.55)'; rrect(c, px, b.wy, pw, 96, 14); c.fill(); c.fillStyle = 'rgba(20,12,44,.55)'; rrect(c, px, b.wy + 108, pw, 64, 14); c.fill();
    c.font = '800 13px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff1cf'; c.fillText('Next', px + pw / 2, b.wy + 16);
    if (b.nxt && !b.done) { const cs = PILE_SHAPES[b.nxt.k][0], s = 22; cs.forEach(([dx, dy], k) => drawPebbleAt(c, px + pw / 2 + (dx - (b.nxt.k === 'line' ? 1 : 0.5)) * s, b.wy + 52 + (dy - (b.nxt.k === 'line' ? 0 : 0.5)) * s, 10, PILE_HUE[b.nxt.hues[k]], k, b.nxt.glow === k)); }
    c.fillStyle = '#d9c8ff'; c.font = '800 12px Nunito, system-ui, sans-serif'; c.fillText('Rows sung', px + pw / 2, b.wy + 128); c.fillStyle = '#ffe58a'; c.font = '800 22px Nunito, system-ui, sans-serif'; c.fillText(String(b.score), px + pw / 2, b.wy + 153);
    const ly = b.wy + H, hop = b.stampT > 0 ? -Math.sin(b.stampT * Math.PI) * 30 : 0;
    drawCreature(c, b.f.L, px + pw / 2, ly + hop, Math.min(64, pw * 0.8), T, { mood: b.sing.length || b.stampT ? 'happy' : null, look: { x: -0.8, y: 0.3 }, squash: b.land && T - b.land < 0.15 ? 0.08 : 0 });
    c.fillStyle = '#fff1cf'; c.font = '800 12px Nunito, system-ui, sans-serif'; c.fillText(b.l.name, px + pw / 2, ly - Math.min(64, pw * 0.8) * 1.2);
    if (!b.go) { c.fillStyle = 'rgba(239,234,252,.85)'; c.font = '800 13px Nunito, system-ui, sans-serif'; c.fillText('Touch to start', b.wx + W / 2, b.wy + H * 0.4); }
    if (b.done && T - b.done > 1.4 / bonusSpeed()) bonusEnd(false);
  },
  end(b) { const s = b.score; return { score: s, goal: PILE.goal, label: this.best(s), line: s >= PILE.goal ? b.l.name + ' bounces with joy at every row.' : s ? b.l.name + ' loved every row that sang.' : 'The burrow waits for next time.' }; }
};
