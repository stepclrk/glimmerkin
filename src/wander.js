/* ===== Bonus world: Wanderlings. Place three littles to steer five wanderers from their burrow to their nest ===== */
const WANDER_DUST = 15, WANDER_FULL = 12, WANDER_STEP = 0.24, WANDER_GAP = 0.55;   // stardust for bringing them home, and instead of the egg; seconds a step, and between wanderlings
const WANDER_SAY = { ember: 'burns away brambles it stands in', tide: 'freezes a pool it stands in', bloom: 'grows a bridge over a gap it stands in', stone: 'blocks the way like a rock', gale: 'blows them the way it faces: tap it to turn it', glow: 'draws them to its light along a clear row or column' };
const WANDER_SHORT = { ember: 'Burns brambles', tide: 'Freezes pools', bloom: 'Bridges gaps', stone: 'Blocks the way', gale: 'Blows them on', glow: 'Draws them in' };
const WANDER_NEEDS = { e: 'Only a Cinderkit can stand in brambles.', t: 'Only a Puddlefin can stand in a pool.', b: 'Only a Sproutling can stand over a gap.' };
BONUS.wander = {
  name: 'Wanderlings',
  line: 'Five wanderlings have lost their way. Place your littles to steer them home.',
  hint: 'Wanderlings walk straight and turn right when they cannot go on. Place your littles, then press Go.',
  text: 'Five wanderlings leave the burrow and walk in a straight line. One that cannot go on turns right, or left if right is shut too. Place your three littles to steer them to their nest: drag a little onto a tile, or tap it and then a tile. A Cinderkit burns away brambles it stands in, a Puddlefin freezes a pool, and a Sproutling grows a bridge over a gap. A Pebblit blocks the way like a rock. A Zephyrmoth blows them the way it faces: tap it to turn it. A Lanternbug draws them to its light along a clear row or column, once each. The dotted line shows where they would walk now. Press Go to send them. If they do not get home, move your littles and try again as often as you like.',
  bar: '<button class="go" data-b="go">Go</button>',
  start(b) {
    const g = b.g = genWander(b.seed, b.lits.map(f => f.kinds)), r = RNG(b.seed);
    b.pieces = g.pieces.map((ks, i) => { const f = b.lits[i]; return f ? { kinds: ks, L: f.L, name: f.l.name, at: null, d: 0 } : { kinds: ks, L: lookFor(ks[0], r.int(1, 2147483646)), name: 'a wild ' + KINDS[ks[0]].species, wild: true, at: null, d: 0 }; });
    b.kind = ELS[b.seed % ELS.length]; b.looks = [0, 1, 2, 3, 4].map(() => lookFor(b.kind, r.int(1, 2147483646)));
    b.sel = null; b.hold = null; b.run = null; b.tries = 0; b.won = 0; b.idle = 0; b.hintFor = -1; b.moves = 0; this.plan(b); this.layout(b);
    const wild = b.pieces.filter(p => p.wild); if (wild.length) setTimeout(() => { if (BW === b && !b.over) toast((wild.length > 1 ? 'Two wild littles have' : wild[0].name[0].toUpperCase() + wild[0].name.slice(1) + ' has') + ' wandered in to help.', 3600); }, 900);
  },
  layout(b) {
    if (!b.g) return; const W = WANDER.W, H = WANDER.H; b.trayH = clamp(b.h * 0.2, 84, 112); b.ts = Math.floor(Math.min((b.w - 28) / W, (b.h - b.trayH - 26) / H, 74));
    b.ox = Math.round(b.x + (b.w - b.ts * W) / 2); b.oy = Math.round(b.y + 10 + Math.max(0, (b.h - b.trayH - 26 - b.ts * H) / 2)); b.ty = b.y + b.h - b.trayH;
  },
  put(b) { return b.pieces.map(p => p.at ? { x: p.at.x, y: p.at.y, d: p.d } : null); },
  plan(b) { b.walk = wanderWalk(b.g, this.put(b)); },
  mid(b, x, y) { return { x: b.ox + (x + 0.5) * b.ts, y: b.oy + (y + 0.5) * b.ts }; },
  slot(b, i) { return { x: b.x + b.w * (0.2 + i * 0.3), y: b.ty + b.trayH * 0.5 }; },
  cellAt(b, pt) { const x = Math.floor((pt.x - b.ox) / b.ts), y = Math.floor((pt.y - b.oy) / b.ts); return x >= 0 && y >= 0 && x < WANDER.W && y < WANDER.H ? { x, y } : null; },
  spot(b, i) { const p = b.pieces[i]; return p.at ? { x: b.ox + (p.at.x + 0.5) * b.ts, y: b.oy + (p.at.y + 0.84) * b.ts } : this.slot(b, i); },
  pieceAt(b, pt) { for (let i = 0; i < b.pieces.length; i++) { const s = this.spot(b, i); if (Math.abs(pt.x - s.x) < b.ts * 0.5 && pt.y > s.y - b.ts * 0.9 && pt.y < s.y + b.ts * 0.2) return i; } return -1; },
  turns(p) { return p.kinds.includes('gale') && !p.kinds.includes('stone'); },
  /* Put piece i on a tile, or back in the tray with cell null. */
  place(b, i, cell) {
    const p = b.pieces[i], g = b.g;
    if (cell) {
      const c = g.cells[cell.y * WANDER.W + cell.x], why = b.pieces.some((q, j) => j !== i && q.at && q.at.x === cell.x && q.at.y === cell.y) ? 'Somebody is already standing there.' : wanderCan(g, i, cell.x, cell.y) ? '' : c === '#' ? 'Nobody can stand on a rock.' : WANDER_NEEDS[c] || 'The burrow and the nest are kept clear.';
      if (why) { toast(why); sfx('no'); return false; }
    }
    p.at = cell; b.sel = null; b.moves++; b.idle = 0; if (cell) { p.drop = T; sfx('step'); } this.plan(b); bonusHint(BONUS.wander.hint); return true;
  },
  down(b, pt) { if (b.won || b.run) return; const i = this.pieceAt(b, pt); b.hold = i >= 0 ? { i, x: pt.x, y: pt.y, far: 0 } : null; },
  move(b, pt) { const h = b.hold; if (!h) return; h.far += Math.hypot(pt.x - h.x, pt.y - h.y); h.x = pt.x; h.y = pt.y; },
  up(b, pt, tap) {
    if (b.won || b.run) { b.hold = null; return; } const h = b.hold, cell = this.cellAt(b, pt); b.hold = null;
    if (h && h.far >= 14) { if (cell) { if (!this.place(b, h.i, cell)) b.sel = h.i; } else this.place(b, h.i, null); return; }   // a drag: onto a tile, or back to the tray
    if (h) {
      const p = b.pieces[h.i], nm = p.name[0].toUpperCase() + p.name.slice(1);
      if (p.at && this.turns(p)) { p.d = (p.d + 1) % 4; b.sel = null; b.moves++; b.idle = 0; sfx('pick'); this.plan(b); bonusHint(nm + ' now blows ' + ['east', 'south', 'west', 'north'][p.d] + '. Drag it to move it.'); return; }
      b.sel = b.sel === h.i ? null : h.i; sfx('pick'); if (b.sel !== null) bonusHint(nm + ' ' + p.kinds.map(k => WANDER_SAY[k]).join(', and ') + '. Tap a tile to put it there.'); else bonusHint(BONUS.wander.hint); return;
    }
    if (b.sel !== null && tap) { if (cell) this.place(b, b.sel, cell); else if (pt.y > b.ty) this.place(b, b.sel, null); }
  },
  press(b, what) {
    if (what !== 'go' || b.run || b.won) return; b.sel = null; b.hold = null; b.hintFor = -1; this.plan(b);
    const shown = b.walk.home ? b.walk.path : b.walk.path.slice(0, 37); b.run = { t: 0, path: shown, home: b.walk.home, why: b.walk.why, in: 0 }; sfx('gate'); bonusHint('Off they go.');
  },
  /* Where wanderling j is, t seconds into a run: a point between two tiles of the path, and whether it has stopped. */
  walker(b, j) {
    const R = b.run, f = clamp((R.t - j * WANDER_GAP) / WANDER_STEP, 0, R.path.length - 1), i = Math.floor(f), u = f - i, p = R.path[i], q = R.path[Math.min(i + 1, R.path.length - 1)], a = this.mid(b, p.x, p.y), z = this.mid(b, q.x, q.y);
    return { x: lerp(a.x, z.x, u), y: lerp(a.y, z.y, u), out: R.t >= j * WANDER_GAP, done: f >= R.path.length - 1, hop: Math.abs(Math.sin(f * Math.PI)) };
  },
  tile(c, ch, x, y, s, open, seed) {
    const cx = x + s / 2, cy = y + s / 2, hue = EL_HUE[WANDER_OPENS[ch]], ring = () => { c.strokeStyle = hsl(hue, 95, 68, 0.6 + 0.3 * Math.sin(T * 3 + x)); c.lineWidth = Math.max(1.5, s * 0.04); c.setLineDash([s * 0.1, s * 0.08]); rrect(c, x + 3, y + 3, s - 6, s - 6, s * 0.2); c.stroke(); c.setLineDash([]); };
    const r = RNG(seed);
    if (ch === 'e') {
      if (open) { for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? 'rgba(40,24,20,.8)' : hsl(24, 100, 60, 0.5 + 0.4 * Math.sin(T * 6 + i)); c.beginPath(); c.arc(x + s * (0.15 + r.f() * 0.7), y + s * (0.2 + r.f() * 0.65), s * 0.035, 0, TAU); c.fill(); } return; }
      c.strokeStyle = '#2f5a2c'; c.lineWidth = Math.max(2, s * 0.07); c.lineCap = 'round'; for (let i = 0; i < 5; i++) { const a = r.f() * TAU, x0 = cx + Math.cos(a) * s * 0.36, y0 = cy + Math.sin(a) * s * 0.36; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx + (r.f() - 0.5) * s * 0.5, cy + (r.f() - 0.5) * s * 0.5, cx - Math.cos(a) * s * 0.36, cy - Math.sin(a) * s * 0.36); c.stroke(); }
      c.fillStyle = '#7a2d3a'; for (let i = 0; i < 6; i++) { const px = x + s * (0.2 + r.f() * 0.6), py = y + s * (0.2 + r.f() * 0.6); c.beginPath(); c.moveTo(px, py - s * 0.07); c.lineTo(px + s * 0.04, py + s * 0.03); c.lineTo(px - s * 0.04, py + s * 0.03); c.fill(); }
    } else if (ch === 't') {
      c.fillStyle = open ? '#cfefff' : '#1c5f8a'; c.beginPath(); c.ellipse(cx, cy, s * 0.42, s * 0.36, 0, 0, TAU); c.fill();
      if (open) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - s * 0.2, cy - s * 0.1); c.lineTo(cx - s * 0.02, cy + s * 0.04); c.lineTo(cx + s * 0.16, cy - s * 0.12); c.stroke(); return; }
      c.strokeStyle = 'rgba(190,235,255,.6)'; c.lineWidth = 1.3; for (let i = 0; i < 2; i++) { const u = (T * 0.5 + i * 0.5) % 1; c.globalAlpha = 1 - u; c.beginPath(); c.ellipse(cx, cy, s * 0.36 * u, s * 0.3 * u, 0, 0, TAU); c.stroke(); } c.globalAlpha = 1;
    } else {
      c.fillStyle = '#07040f'; rrect(c, x + s * 0.06, y + s * 0.14, s * 0.88, s * 0.72, s * 0.18); c.fill();
      if (open) { c.fillStyle = '#4d9a4a'; for (let i = 0; i < 4; i++) { rrect(c, x + s * (0.1 + i * 0.21), y + s * 0.2, s * 0.17, s * 0.6, s * 0.05); c.fill(); } c.strokeStyle = '#7fd37a'; c.lineWidth = Math.max(1.5, s * 0.04); c.beginPath(); c.moveTo(x + s * 0.04, y + s * 0.3); c.quadraticCurveTo(cx, y + s * 0.42, x + s * 0.96, y + s * 0.3); c.stroke(); return; }
      c.strokeStyle = 'rgba(120,100,170,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + s * 0.2, y + s * 0.3); c.lineTo(x + s * 0.34, y + s * 0.5); c.lineTo(x + s * 0.24, y + s * 0.7); c.stroke();
    }
    ring();
  },
  arrow(c, x, y, d, s, col) { c.save(); c.translate(x, y); c.rotate(d * Math.PI / 2); c.fillStyle = col; c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * 0.5, -s * 0.75); c.lineTo(-s * 0.15, 0); c.lineTo(-s * 0.5, s * 0.75); c.closePath(); c.fill(); c.restore(); },
  draw(b, c, dt) {
    const g = b.g, W = WANDER.W, H = WANDER.H, ts = b.ts, ox = b.ox, oy = b.oy, sp = bonusSpeed(), put = this.put(b);
    const rs = RNG(b.seed); for (let i = 0; i < 40; i++) { const x = rs.f() * VW, y = rs.f() * VH; c.fillStyle = 'rgba(255,248,225,' + (0.2 + 0.4 * rs.f()).toFixed(2) + ')'; c.fillRect(x, y, 1.6, 1.6); }
    c.fillStyle = 'rgba(30,18,10,.55)'; rrect(c, ox - 6, oy - 6, ts * W + 12, ts * H + 12, 16); c.fill();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = g.cells[y * W + x], X = ox + x * ts, Y = oy + y * ts; drawFloor(c, X, Y, ts, b.B, b.seed + x * 13 + y * 5);
      if (ch === '#') drawWall(c, X, Y, ts, b.B, b.seed + x * 7 + y * 3);
      else if (ch !== '.') this.tile(c, ch, X, Y, ts, b.pieces.some(p => p.at && p.at.x === x && p.at.y === y && p.kinds.includes(WANDER_OPENS[ch]) && !p.kinds.includes('stone')), b.seed + x * 31 + y * 17);
    }
    // the burrow they leave and the nest they are looking for
    const s0 = this.mid(b, g.start.x, g.start.y), h0 = this.mid(b, g.home.x, g.home.y);
    c.fillStyle = '#5a3d2a'; c.beginPath(); c.ellipse(s0.x, s0.y + ts * 0.1, ts * 0.4, ts * 0.3, 0, Math.PI, 0); c.lineTo(s0.x + ts * 0.4, s0.y + ts * 0.3); c.lineTo(s0.x - ts * 0.4, s0.y + ts * 0.3); c.fill(); c.fillStyle = '#120a1c'; c.beginPath(); c.ellipse(s0.x, s0.y + ts * 0.16, ts * 0.2, ts * 0.17, 0, 0, TAU); c.fill();
    glow(c, h0.x, h0.y, ts * 0.7, 46, 100, 70, 0.35 + 0.15 * Math.sin(T * 3)); c.strokeStyle = '#c99a55'; c.lineWidth = ts * 0.12; c.beginPath(); c.ellipse(h0.x, h0.y + ts * 0.1, ts * 0.32, ts * 0.18, 0, 0, TAU); c.stroke(); c.strokeStyle = '#8a6535'; c.lineWidth = ts * 0.04; c.beginPath(); c.ellipse(h0.x, h0.y + ts * 0.1, ts * 0.32, ts * 0.18, 0, 0, TAU); c.stroke(); c.fillStyle = '#fff3c4'; starPath(c, h0.x, h0.y - ts * 0.22, ts * 0.12, ts * 0.05, 5, T); c.fill();
    // the way they would walk now, as a dotted line
    if (!b.run && !b.won) {
      const P = b.walk.path.slice(0, 37), col = b.walk.home ? 'rgba(134,232,200,' : 'rgba(255,233,160,';
      P.forEach((p, i) => { if (!i) return; const a = this.mid(b, P[i - 1].x, P[i - 1].y), z = this.mid(b, p.x, p.y); for (let k = 1; k <= 3; k++) { const u = k / 3, ph = ((T * 1.2 - (i + u) * 0.18) % 1 + 1) % 1; c.fillStyle = col + (0.35 + 0.45 * (ph < 0.25 ? 1 : 0)) + ')'; c.beginPath(); c.arc(lerp(a.x, z.x, u), lerp(a.y, z.y, u), ts * 0.045, 0, TAU); c.fill(); } });
      this.arrow(c, s0.x + WDIRS[g.start.d][0] * ts * 0.36, s0.y + WDIRS[g.start.d][1] * ts * 0.36, g.start.d, ts * 0.11, '#ffe9a0');
      if (!b.walk.home) { const e = P[P.length - 1], m = this.mid(b, e.x, e.y), q = ts * 0.13; c.strokeStyle = '#ff8fb3'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(m.x - q, m.y - q); c.lineTo(m.x + q, m.y + q); c.moveTo(m.x + q, m.y - q); c.lineTo(m.x - q, m.y + q); c.stroke(); }
    }
    // a helping glimmer after two tries that fail, or a long while
    if (!b.won && !b.run) { b.idle += dt * sp; if ((b.tries >= 2 || b.idle > 40) && b.hintFor < 0 && !b.walk.home) { b.hintFor = b.pieces.findIndex((p, i) => !p.at || p.at.x !== g.answer[i].x || p.at.y !== g.answer[i].y || (this.turns(p) && p.d !== g.answer[i].d)); if (b.hintFor >= 0) { const p = b.pieces[b.hintFor]; bonusHint('Stuck? A tile glimmers for ' + p.name + (this.turns(p) ? ', with the way it should face.' : '.')); } b.idle = 0; b.tries = 0; } }
    if (b.hintFor >= 0 && !b.won && !b.run) { const a = g.answer[b.hintFor], p = b.pieces[b.hintFor], u = 0.5 + 0.5 * Math.sin(T * 5); if (p.at && p.at.x === a.x && p.at.y === a.y && (!this.turns(p) || p.d === a.d)) b.hintFor = -1; else { c.strokeStyle = 'rgba(255,233,160,' + (0.5 + 0.5 * u) + ')'; c.lineWidth = 3; rrect(c, ox + a.x * ts + 3, oy + a.y * ts + 3, ts - 6, ts - 6, ts * 0.2); c.stroke(); if (this.turns(p)) this.arrow(c, ox + (a.x + 0.5) * ts, oy + (a.y + 0.5) * ts, a.d, ts * 0.16, 'rgba(255,233,160,' + (0.5 + 0.5 * u) + ')'); } }
    const over = b.hold && b.hold.far >= 14 ? this.cellAt(b, b.hold) : null; if (over && wanderCan(g, b.hold.i, over.x, over.y)) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; rrect(c, ox + over.x * ts + 2, oy + over.y * ts + 2, ts - 4, ts - 4, ts * 0.2); c.stroke(); }
    if (b.sel !== null) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (wanderCan(g, b.sel, x, y) && !b.pieces.some(p => p.at && p.at.x === x && p.at.y === y)) { c.fillStyle = 'rgba(134,232,200,.12)'; rrect(c, ox + x * ts + 4, oy + y * ts + 4, ts - 8, ts - 8, ts * 0.2); c.fill(); }
    // the tray
    c.fillStyle = 'rgba(22,15,46,.82)'; rrect(c, b.x + 10, b.ty, b.w - 20, b.trayH - 4, 18); c.fill(); c.strokeStyle = 'rgba(196,178,255,.24)'; c.lineWidth = 1; c.stroke();
    c.font = '800 11px Nunito, system-ui, sans-serif'; c.textAlign = 'center';
    const ents = [];
    b.pieces.forEach((p, i) => {
      const s = this.slot(b, i), held = b.hold && b.hold.i === i && b.hold.far >= 14, at = held ? { x: b.hold.x, y: b.hold.y + ts * 0.3 } : this.spot(b, i), size = p.at || held ? ts * 0.66 : Math.min(ts * 0.8, b.trayH * 0.56);
      c.fillStyle = p.at ? '#b9aedb' : '#efeafc'; c.fillText(p.at && !held ? 'Placed' : p.kinds.includes('stone') ? WANDER_SHORT.stone : p.kinds.map(k => WANDER_SHORT[k]).join(' · '), s.x, b.ty + b.trayH - 14);
      if (p.at && !held) { c.globalAlpha = 0.25; drawCreature(c, p.L, s.x, s.y + size * 0.2, size * 0.8, 0, { noShadow: true, still: true }); c.globalAlpha = 1; }
      if (b.sel === i && !held) { c.strokeStyle = 'rgba(134,232,200,.9)'; c.lineWidth = 2; c.beginPath(); c.ellipse(at.x, at.y, size * 0.5, size * 0.16, 0, 0, TAU); c.stroke(); }
      if (p.at && !held && this.turns(p)) ents.push({ y: -1, draw: () => this.arrow(c, ox + (p.at.x + 0.5 + WDIRS[p.d][0] * 0.36) * ts, oy + (p.at.y + 0.5 + WDIRS[p.d][1] * 0.36) * ts, p.d, ts * 0.13, '#bff3ff') });
      if (p.at && !held && p.kinds.includes('glow') && !p.kinds.includes('stone')) ents.push({ y: -2, draw: () => glow(c, at.x, at.y - ts * 0.3, ts * 0.8, 52, 100, 72, 0.3 + 0.12 * Math.sin(T * 4)) });
      const lift = held ? ts * 0.25 : p.drop ? (1 - clamp((T - p.drop) * 4, 0, 1)) * ts * 0.5 : 0;
      ents.push({ y: at.y + (held ? 1e4 : 0), draw: () => drawCreature(c, p.L, at.x, p.at || held ? at.y : s.y + size * 0.3, size, T, { lift, mood: b.won || held ? 'happy' : 'idle', noShadow: !p.at && !held }) });
    });
    // the wanderlings: waiting in the burrow, walking, or home
    let home = 0;
    if (b.run) {
      const R = b.run; R.t += dt * sp;
      for (let j = 0; j < WANDER.n; j++) {
        const w = this.walker(b, j); if (!w.out) continue; if (w.done && R.home) { home++; continue; }
        ents.push({ y: w.y + ts * 0.3, draw: () => { drawCreature(c, b.looks[j], w.x, w.y + ts * 0.3 - (w.done ? 0 : w.hop * ts * 0.1), ts * 0.42, T + j, { mood: w.done ? 'sad' : 'happy' }); if (w.done) { c.fillStyle = '#ffe9a0'; c.font = '800 ' + Math.round(ts * 0.3) + 'px Nunito, system-ui, sans-serif'; c.fillText('?', w.x + ts * 0.24, w.y - ts * 0.12); } } });
      }
      if (home > R.in) { R.in = home; burst(h0.x, h0.y, 12, 46, { kind: 'star', v: 110, size: 5 }); sfx('note', CHIME_NOTES[home - 1]); }
      if (R.t >= (WANDER.n - 1) * WANDER_GAP + (R.path.length - 1) * WANDER_STEP + (R.home ? 0.3 : 1.4)) {
        if (R.home) { b.won = T; b.run = null; sfx('grow'); bonusHint('All five are home.'); }
        else { b.run = null; b.tries++; b.idle = 0; sfx('no'); bonusHint(R.why === 'stuck' ? 'They got stuck with no way on. Move your littles and try again.' : 'They went round in circles. Move your littles and try again.'); }
      }
    } else if (b.won) home = WANDER.n;
    else for (let j = 0; j < 2; j++) ents.push({ y: s0.y, draw: () => drawCreature(c, b.looks[j], s0.x + (j ? ts * 0.16 : -ts * 0.14), s0.y + ts * 0.36, ts * 0.3, T + j, { noShadow: true }) });
    ents.sort((a, z) => a.y - z.y).forEach(e => e.draw());
    if (b.won) for (let j = 0; j < WANDER.n; j++) drawCreature(c, b.looks[j], h0.x + (j - 2) * ts * 0.17, h0.y + ts * 0.26 - Math.abs(Math.sin(T * 5 + j)) * ts * 0.12, ts * 0.3, T + j, { noShadow: true, mood: 'happy' });
    const go = ui.barBonus.querySelector('[data-b="go"]'); if (go && go.disabled !== !!(b.run || b.won)) go.disabled = !!(b.run || b.won);
    bonusCount('Home ' + home + ' of ' + WANDER.n);
    if (b.won && T - b.won > 2.2 / sp) bonusEnd(false);
  },
  end(b, early) {
    if (early || !b.won) return 'You head back with the wanderlings still looking for their nest.';
    b.loot.dust = WANDER_DUST; const k = b.kind;
    if (eggRoom(b.q.loot.eggs.length) > 0) { b.loot.eggs.push({ hue: Math.round((KINDS[k].hue[0] + KINDS[k].hue[1]) / 2), twin: false, kinds: [k] }); return 'All five wanderlings are home. They leave you an egg from their nest.'; }
    b.loot.dust += WANDER_FULL; return 'All five wanderlings are home. The nest is full, so they leave ' + WANDER_FULL + ' stardust instead of an egg.';
  }
};
