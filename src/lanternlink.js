/* ===== Little game: Lantern Link, a Lanternbug's game. Drag a chain through lanterns of one colour ===== */
const LINK_HUE = [0, 48, 330, 190, 118, 275];   // by colour 1 to 5
function drawLanternAt(c, x, y, r, hue, lit) {
  if (lit) glow(c, x, y, r * 2.4, hue, 100, 70, 0.6);
  c.fillStyle = '#4a3a2a'; c.fillRect(x - r * 0.35, y - r * 1.05, r * 0.7, r * 0.2); c.fillRect(x - r * 0.35, y + r * 0.82, r * 0.7, r * 0.2);
  c.strokeStyle = '#4a3a2a'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y - r * 1.15, r * 0.18, Math.PI, 0); c.stroke();
  const g = c.createRadialGradient(x, y, r * 0.1, x, y, r); g.addColorStop(0, hsl(hue, 100, lit ? 92 : 72)); g.addColorStop(1, hsl(hue, 80, lit ? 62 : 38));
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r * 0.72, r * 0.88, 0, 0, TAU); c.fill(); c.strokeStyle = hsl(hue, 50, 22); c.stroke();
  c.strokeStyle = hsl(hue, 60, lit ? 70 : 30, 0.7); c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - r * 0.88); c.lineTo(x, y + r * 0.88); c.stroke(); c.beginPath(); c.ellipse(x, y, r * 0.36, r * 0.88, 0, 0, TAU); c.stroke();
}
GAMES.link = {
  name: 'Lantern Link', kind: 'glow', rule: 'Link',
  line: 'Drag a chain through lanterns of one colour to light them, and fill the moon with their light.',
  hint: 'Drag through lanterns of one colour that touch, corners too, and lift to light the chain. Three or more.',
  text: 'Lanterns in five colours hang in rows. Put a finger on one and drag through others of its colour that touch it, across, up and down or at the corners, without going back over one. Drag back to the one before to take a lantern off the chain. Lift your finger to light a chain of three or more: the lanterns float off as light, and new ones drop in from the top. A chain of five or more lights every lantern beside it as well, of any colour. You have 12 chains. Light 50 lanterns to fill the moon.',
  icon(c, x, y, r) { drawLanternAt(c, x - r * 0.45, y + r * 0.15, r * 0.36, 48, true); drawLanternAt(c, x + r * 0.45, y + r * 0.15, r * 0.36, 330); drawLanternAt(c, x, y - r * 0.2, r * 0.36, 48, true); },
  best: s => s + ' lanterns lit',
  start(b) {
    b.r = RNG(b.seed); b.g = linkFill(b.r); b.chain = []; b.left = LINK.chains; b.lit = 0; b.off = new Array(b.g.length).fill(0); b.pops = []; b.finger = null; b.done = 0; b.idle = 0;
    this.layout(b); bonusCount(this.leftText(b));
  },
  layout(b) { const top = b.y + 66, C = LINK.cols, R = LINK.rows, cell = Math.min(56, (b.w - 40) / C, (b.y + b.h - top - 8) / R); b.cell = cell; b.bx = b.x + (b.w - cell * C) / 2; b.by = top + 8; },
  leftText(b) { return b.left === 1 ? '1 chain left' : b.left + ' chains left'; },
  mid(b, k) { return { x: b.bx + (k % LINK.cols + 0.5) * b.cell, y: b.by + (Math.floor(k / LINK.cols) + 0.5) * b.cell }; },
  /* The lantern under the finger, only near its middle, so a diagonal drag does not catch the ones beside it. */
  at(b, pt, r) { const i = Math.floor((pt.x - b.bx) / b.cell), j = Math.floor((pt.y - b.by) / b.cell); if (i < 0 || j < 0 || i >= LINK.cols || j >= LINK.rows) return -1; const k = j * LINK.cols + i, m = this.mid(b, k); return Math.hypot(pt.x - m.x, pt.y - m.y) <= b.cell * (r || 0.42) ? k : -1; },
  down(b, pt) { if (b.done || b.busy) return; const k = this.at(b, pt, 0.5); b.finger = pt; b.chain = k >= 0 ? [k] : []; if (k >= 0) sfx('note', CHIME_NOTES[0]); },
  move(b, pt) {
    if (!b.chain.length) return; b.finger = pt; const k = this.at(b, pt), ch = b.chain; if (k < 0 || k === ch[ch.length - 1]) return;
    if (ch.length > 1 && k === ch[ch.length - 2]) { ch.pop(); sfx('step'); return; }
    if (linkCan(b.g, ch, k)) { ch.push(k); sfx('note', CHIME_NOTES[Math.min(CHIME_NOTES.length - 1, ch.length - 1)]); }
  },
  up(b) {
    const ch = b.chain; b.chain = []; b.finger = null; if (b.done || !ch.length) return;
    if (ch.length < 3) { if (ch.length > 1) { sfx('no'); bonusHint('A chain needs three or more lanterns. Keep dragging through ones of the same colour.'); } return; }
    this.light(b, ch);
  },
  light(b, ch) {
    const g = b.g, v = g[ch[0]], before = g.slice(), res = linkLight(g, ch, b.r); b.idle = 0;
    for (const k of res.lit) { const m = this.mid(b, k); b.pops.push({ x: m.x, y: m.y, v: before[k], t: 0 }); burst(m.x, m.y, 5, LINK_HUE[before[k]], { kind: 'star', v: 80, size: 3, g: -60 }); }
    for (let k = 0; k < g.length; k++) b.off[k] = -res.fall[k];
    b.lit += res.lit.length; b.left--; b.played = true; bonusCount(this.leftText(b));
    const m = this.mid(b, ch[ch.length - 1]); floatText(m.x, m.y - 14, res.lit.length > ch.length ? 'A chain of ' + ch.length + '! Its neighbours light too' : '+' + res.lit.length, '#ffe58a');
    sfx(ch.length >= LINK.big ? 'skill' : 'tinkle'); if (res.shuffled) bonusHint('No chain of three was left, so the lanterns swapped places.'); else bonusHint(GAMES.link.hint);
    if (b.left <= 0) { b.done = T; if (b.lit >= LINK.goal) sfx('win'); bonusHint(b.lit >= LINK.goal ? 'The moon is full of light!' : 'No chains left. ' + b.lit + ' lanterns lit.'); }
  },
  draw(b, c, dt) {
    const sp = bonusSpeed(), C = LINK.cols, R = LINK.rows, cell = b.cell, W = cell * C, H = cell * R;
    for (let k = 0; k < b.off.length; k++) if (b.off[k]) b.off[k] = Math.min(0, b.off[k] + dt * sp * 9);
    const bg = c.createLinearGradient(0, 0, 0, VH); bg.addColorStop(0, '#0b0a26'); bg.addColorStop(1, '#2b1c55'); c.fillStyle = bg; c.fillRect(0, 0, VW, VH);
    const rs = RNG(b.seed); for (let i = 0; i < (REDUCED ? 30 : 60); i++) { c.fillStyle = 'rgba(255,248,225,' + (0.2 + 0.4 * (0.5 + 0.5 * Math.sin(T * (1 + rs.f()) + i))).toFixed(2) + ')'; c.fillRect(rs.f() * VW, b.y + rs.f() * b.h, 1.6, 1.6); }
    // the moon, filling with light
    const py = b.y + 4; c.fillStyle = 'rgba(20,12,44,.55)'; rrect(c, b.x + 16, py, b.w - 32, 52, 14); c.fill();
    drawCreature(c, b.f.L, b.x + 46, py + 48, 38, T, { mood: b.pops.length ? 'happy' : null, look: { x: 0.6, y: 0.2 } });
    c.font = '800 13px Nunito, system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#fff1cf'; c.fillText(b.lit >= LINK.goal ? 'The moon is full!' : 'Light the moon: ' + b.lit + ' of ' + LINK.goal, b.x + 76, py + 17);
    const mw = b.w - 160, u = Math.min(1, b.lit / LINK.goal); c.fillStyle = 'rgba(255,255,255,.14)'; rrect(c, b.x + 76, py + 30, mw, 11, 6); c.fill(); c.fillStyle = hsl(48, 90, 62); rrect(c, b.x + 76, py + 30, Math.max(11, mw * u), 11, 6); c.fill();
    const mx = b.x + b.w - 46, my = py + 27; glow(c, mx, my, 22, 48, 100, 80, 0.2 + 0.5 * u); c.fillStyle = '#fff1b8'; c.beginPath(); c.arc(mx, my, 13, 0, TAU); c.fill();
    c.fillStyle = 'rgba(32,24,74,' + (1 - u).toFixed(2) + ')'; c.beginPath(); c.arc(mx + 7, my - 3, 11.5, 0, TAU); c.fill();
    // strings and lanterns
    c.save(); c.beginPath(); c.rect(b.bx - 10, b.by - 4, W + 20, H + 8); c.clip();
    c.strokeStyle = 'rgba(200,180,255,.16)'; c.lineWidth = 1; for (let i = 0; i < C; i++) { const x = b.bx + (i + 0.5) * cell; c.beginPath(); c.moveTo(x, b.by - 4); c.lineTo(x, b.by + H); c.stroke(); }
    const on = new Set(b.chain);
    for (let k = 0; k < b.g.length; k++) { const m = this.mid(b, k); drawLanternAt(c, m.x, m.y + b.off[k] * cell, cell * 0.34, LINK_HUE[b.g[k]], on.has(k)); }
    c.restore();
    if (b.chain.length) {
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = hsl(LINK_HUE[b.g[b.chain[0]]], 100, 80, 0.9); c.lineWidth = 5; c.shadowColor = hsl(LINK_HUE[b.g[b.chain[0]]], 100, 70); c.shadowBlur = 12;
      c.beginPath(); b.chain.forEach((k, i) => { const m = this.mid(b, k); i ? c.lineTo(m.x, m.y) : c.moveTo(m.x, m.y); }); if (b.finger) c.lineTo(b.finger.x, b.finger.y); c.stroke(); c.restore();
      if (b.chain.length >= LINK.big) { const m = this.mid(b, b.chain[b.chain.length - 1]); c.fillStyle = '#ffe58a'; c.font = '800 13px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('A chain of ' + b.chain.length + '!', m.x, m.y - cell * 0.62); }
    }
    b.pops = b.pops.filter(p => (p.t += dt * sp) < 0.4);
    for (const p of b.pops) { c.globalAlpha = 1 - p.t / 0.4; drawLanternAt(c, p.x, p.y - p.t * cell * 1.5, cell * 0.34, LINK_HUE[p.v], true); c.globalAlpha = 1; }
    if (!b.done && !b.chain.length && !b.pops.length) { b.idle += dt * sp; if (b.idle > 10) { const f = linkFind(b.g); if (f) for (const k of f) { const m = this.mid(b, k); c.strokeStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(T * 4)).toFixed(2) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(m.x, m.y, cell * 0.44, 0, TAU); c.stroke(); } } }
    if (b.done && !b.pops.length && T - b.done > 1.4 / sp) bonusEnd(false);
  },
  end(b) { const s = b.lit; return { score: s, goal: LINK.goal, label: s + (s === 1 ? ' lantern lit' : ' lanterns lit'), line: s >= LINK.goal ? 'The moon is full of light, and ' + b.l.name + ' glows with pride.' : s ? b.l.name + ' loved every lantern.' : 'The lanterns wait for next time.' }; }
};
