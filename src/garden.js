/* ===== Bonus world: Night garden. Place three littles so that every bud is reached by its own kind ===== */
const GARDEN_SAY = { ember: 'the four tiles beside it', glow: 'the four tiles at its corners', stone: 'the four tiles two steps away in a straight line', bloom: 'the three tiles above it', tide: 'its whole row', gale: 'its whole column' };
BONUS.garden = {
  name: 'Night garden',
  line: 'Place three littles in a sleeping garden so that every bud opens.',
  hint: 'Each bud opens for a little of its colour. Drag a little onto a tile, or tap it and then a tile.',
  text: 'Every bud is ringed in the colour of the kind of little it needs, and opens when one reaches it. A Cinderkit reaches the four tiles beside it. A Lanternbug reaches the four tiles at its corners. A Pebblit reaches the four tiles two steps away in a straight line. A Sproutling reaches the three tiles above it. A Puddlefin reaches its whole row, and a Zephyrmoth its whole column. Drag a little onto a tile, or tap it and then tap a tile. Littles cannot stand on buds, and can be moved as often as you like. If you are stuck for a while, a tile glimmers to help.',
  start(b) {
    const g = b.g = genGarden(b.seed, b.lits.map(f => f.kinds)), r = RNG(b.seed);
    b.pieces = g.pieces.map((ks, i) => { const f = b.lits[i]; return f ? { kinds: ks, L: f.L, name: f.l.name, at: null } : { kinds: ks, L: lookFor(ks[0], r.int(1, 2147483646)), name: 'a wild ' + KINDS[ks[0]].species, wild: true, at: null }; });
    b.open = g.buds.map(() => false); b.openT = g.buds.map(() => 0); b.sel = null; b.hold = null; b.idle = 0; b.hintFor = -1; b.won = 0; b.moves = 0;
    const wild = b.pieces.filter(p => p.wild); if (wild.length) setTimeout(() => { if (BW === b && !b.over) toast((wild.length > 1 ? 'Two wild littles have' : wild[0].name[0].toUpperCase() + wild[0].name.slice(1) + ' has') + ' wandered in to help.', 3600); }, 700);
  },
  layout(b) {
    const N = GARDEN_N; b.trayH = clamp(b.h * 0.24, 96, 130); b.ts = Math.floor(Math.min((b.w - 36) / N, (b.h - b.trayH - 34) / N, 78));
    b.ox = Math.round(b.x + (b.w - b.ts * N) / 2); b.oy = Math.round(b.y + 14 + Math.max(0, (b.h - b.trayH - 34 - b.ts * N) / 2)); b.ty = b.y + b.h - b.trayH;
  },
  slot(b, i) { return { x: b.x + b.w * (0.2 + i * 0.3), y: b.ty + b.trayH * 0.5 }; },
  cellAt(b, pt) { const x = Math.floor((pt.x - b.ox) / b.ts), y = Math.floor((pt.y - b.oy) / b.ts); return x >= 0 && y >= 0 && x < GARDEN_N && y < GARDEN_N ? { x, y } : null; },
  spot(b, i) { const p = b.pieces[i]; return p.at ? { x: b.ox + (p.at.x + 0.5) * b.ts, y: b.oy + (p.at.y + 0.86) * b.ts } : this.slot(b, i); },
  pieceAt(b, pt) { for (let i = 0; i < b.pieces.length; i++) { const s = this.spot(b, i); if (Math.abs(pt.x - s.x) < b.ts * 0.5 && pt.y > s.y - b.ts * 0.95 && pt.y < s.y + b.ts * 0.2) return i; } return -1; },
  canStand(b, i, cell) { return !b.g.buds.some(d => d.x === cell.x && d.y === cell.y) && !b.pieces.some((p, j) => j !== i && p.at && p.at.x === cell.x && p.at.y === cell.y); },
  /* Put piece i on a tile, or back in the tray with cell null, and open whatever buds that reaches. */
  place(b, i, cell) {
    const p = b.pieces[i];
    if (cell && !this.canStand(b, i, cell)) { toast(b.g.buds.some(d => d.x === cell.x && d.y === cell.y) ? 'A little cannot stand on a bud.' : 'Somebody is already standing there.'); sfx('no'); return false; }
    p.at = cell; b.sel = null; b.moves++; if (cell) { p.drop = T; sfx('step'); }
    const now = gardenOpen(b.g, b.pieces.map(q => q.at)); let fresh = 0;
    now.forEach((o, k) => { if (o && !b.open[k]) { fresh++; b.openT[k] = T; const d = b.g.buds[k]; burst(b.ox + (d.x + 0.5) * b.ts, b.oy + (d.y + 0.5) * b.ts, 10, EL_HUE[d.k], { kind: 'star', v: 90, size: 4 }); } });
    b.open = now; if (fresh) { sfx('skill'); b.idle = 0; b.hintFor = -1; }
    if (now.every(Boolean) && !b.won) { b.won = T; sfx('grow'); bonusHint('Every bud is open. The garden blooms.'); }
    return true;
  },
  down(b, pt) { if (b.won) return; const i = this.pieceAt(b, pt); if (i >= 0) { b.hold = { i, x: pt.x, y: pt.y, far: 0 }; return; } b.hold = null; },
  move(b, pt) { const h = b.hold; if (!h) return; h.far += Math.hypot(pt.x - h.x, pt.y - h.y); h.x = pt.x; h.y = pt.y; },
  up(b, pt, tap) {
    if (b.won) return; const h = b.hold, cell = this.cellAt(b, pt); b.hold = null;
    if (h && h.far >= 14) { if (cell) { if (!this.place(b, h.i, cell)) b.sel = h.i; } else this.place(b, h.i, null); return; }   // a drag: onto a tile, or back to the tray
    if (h) { b.sel = b.sel === h.i ? null : h.i; sfx('pick'); if (b.sel !== null) { const p = b.pieces[h.i], nm = p.name[0].toUpperCase() + p.name.slice(1); bonusHint(nm + ' reaches ' + p.kinds.map(k => GARDEN_SAY[k]).join(', and ') + '. Tap a tile to put it there.'); } return; }                                                         // a tap on a little picks it
    if (b.sel !== null && tap) { if (cell) this.place(b, b.sel, cell); else if (pt.y > b.ty) this.place(b, b.sel, null); }
  },
  bud(c, x, y, el, open, s) {
    const h = EL_HUE[el]; c.strokeStyle = '#3f9a52'; c.lineWidth = Math.max(2, s * 0.05); c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y + s * 0.32); c.quadraticCurveTo(x - s * 0.08, y + s * 0.12, x, y - s * 0.04); c.stroke();
    c.fillStyle = '#5fbf6a'; c.beginPath(); c.ellipse(x + s * 0.12, y + s * 0.18, s * 0.12, s * 0.06, -0.5, 0, TAU); c.fill();
    if (open > 0) { glow(c, x, y - s * 0.08, s * 0.5 * open, h, 100, 70, 0.5 * open); for (let p = 0; p < 6; p++) { const a = p * TAU / 6 + T * 0.2; c.fillStyle = hsl(h, 85, 74); c.beginPath(); c.ellipse(x + Math.cos(a) * s * 0.14 * open, y - s * 0.08 + Math.sin(a) * s * 0.14 * open, s * 0.12 * open, s * 0.08 * open, a, 0, TAU); c.fill(); } c.fillStyle = '#fff3a0'; c.beginPath(); c.arc(x, y - s * 0.08, s * 0.07, 0, TAU); c.fill(); }
    else { c.fillStyle = hsl(h, 50, 44); c.beginPath(); c.ellipse(x, y - s * 0.1, s * 0.1, s * 0.15, 0, 0, TAU); c.fill(); c.strokeStyle = hsl(h, 95, 68, 0.75 + 0.25 * Math.sin(T * 3 + x)); c.lineWidth = Math.max(1.5, s * 0.04); c.beginPath(); c.arc(x, y - s * 0.08, s * 0.27, 0, TAU); c.stroke(); }
  },
  /* A small picture of where a kind reaches, for the tray. */
  pattern(c, ks, x, y, q) {
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const k = ks.find(z => gardenReach(z, 0, 0, i, j)); c.fillStyle = !i && !j ? '#efeafc' : k ? hsl(EL_HUE[k], 90, 65) : 'rgba(255,255,255,.12)'; c.fillRect(x + i * (q + 1) - q / 2, y + j * (q + 1) - q / 2, q, q); }
  },
  draw(b, c, dt) {
    const g = b.g, N = GARDEN_N, ts = b.ts, ox = b.ox, oy = b.oy;
    const rs = RNG(b.seed); for (let i = 0; i < 40; i++) { const x = rs.f() * VW, y = rs.f() * VH, a = 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(T * (1 + rs.f() * 2) + i)); c.fillStyle = 'rgba(255,248,225,' + a.toFixed(2) + ')'; c.fillRect(x, y, 1.6, 1.6); }
    c.fillStyle = 'rgba(30,18,10,.55)'; rrect(c, ox - 8, oy - 8, ts * N + 16, ts * N + 16, 18); c.fill();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { drawFloor(c, ox + x * ts, oy + y * ts, ts, b.B, b.seed + x * 13 + y * 5); c.fillStyle = 'rgba(10,6,20,.28)'; rrect(c, ox + x * ts + 1, oy + y * ts + 1, ts - 2, ts - 2, ts * 0.2); c.fill(); }
    // where each standing little reaches, and where the held or picked one would
    const tint = (ks, at, a) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = ks.find(z => gardenReach(z, at.x, at.y, x, y)); if (k) { c.fillStyle = hsl(EL_HUE[k], 90, 62, a); rrect(c, ox + x * ts + 3, oy + y * ts + 3, ts - 6, ts - 6, ts * 0.2); c.fill(); } } };
    b.pieces.forEach((p, i) => { if (p.at && !(b.hold && b.hold.i === i && b.hold.far >= 14)) tint(p.kinds, p.at, 0.15 + 0.05 * Math.sin(T * 3 + i)); });
    const over = b.hold && b.hold.far >= 14 ? this.cellAt(b, b.hold) : null; if (over && this.canStand(b, b.hold.i, over)) { tint(b.pieces[b.hold.i].kinds, over, 0.3); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; rrect(c, ox + over.x * ts + 2, oy + over.y * ts + 2, ts - 4, ts - 4, ts * 0.2); c.stroke(); }
    // a helping glimmer after a while without progress
    if (!b.won) { b.idle += dt * bonusSpeed(); if (b.idle > 30 && b.hintFor < 0) { b.hintFor = b.pieces.findIndex((p, i) => !p.at || p.at.x !== g.answer[i].x || p.at.y !== g.answer[i].y); if (b.hintFor >= 0) bonusHint('Stuck? A tile is glimmering for ' + b.pieces[b.hintFor].name + '.'); } }
    if (b.hintFor >= 0 && !b.won) { const a = g.answer[b.hintFor], u = 0.5 + 0.5 * Math.sin(T * 5); c.strokeStyle = 'rgba(255,233,160,' + (0.5 + 0.5 * u) + ')'; c.lineWidth = 3; rrect(c, ox + a.x * ts + 4 - u * 2, oy + a.y * ts + 4 - u * 2, ts - 8 + u * 4, ts - 8 + u * 4, ts * 0.2); c.stroke(); glow(c, ox + (a.x + 0.5) * ts, oy + (a.y + 0.5) * ts, ts * 0.6, 46, 100, 70, 0.3 * u); }
    g.buds.forEach((d, k) => this.bud(c, ox + (d.x + 0.5) * ts, oy + (d.y + 0.55) * ts, d.k, b.open[k] ? clamp((T - b.openT[k]) * 3, 0.05, 1) : 0, ts));
    // the tray
    c.fillStyle = 'rgba(22,15,46,.82)'; rrect(c, b.x + 10, b.ty, b.w - 20, b.trayH - 4, 18); c.fill(); c.strokeStyle = 'rgba(196,178,255,.24)'; c.lineWidth = 1; c.stroke();
    c.font = '800 11px Nunito, system-ui, sans-serif'; c.textAlign = 'center';
    const ents = [];
    b.pieces.forEach((p, i) => {
      const s = this.slot(b, i), held = b.hold && b.hold.i === i && b.hold.far >= 14, sp = held ? { x: b.hold.x, y: b.hold.y + ts * 0.3 } : this.spot(b, i), size = p.at || held ? ts * 0.7 : Math.min(ts * 0.62, b.trayH * 0.44);
      this.pattern(c, p.kinds, s.x + b.w * 0.09, s.y - 4, Math.max(3, Math.round(b.trayH * 0.035))); c.fillStyle = p.at ? '#b9aedb' : '#efeafc'; c.fillText(p.at && !held ? 'Placed' : p.kinds.map(k => KINDS[k].label).join(' and '), s.x, b.ty + b.trayH - 14);
      if (b.sel === i && !held) { c.strokeStyle = 'rgba(134,232,200,.9)'; c.lineWidth = 2; c.beginPath(); c.ellipse(sp.x, sp.y, size * 0.5, size * 0.16, 0, 0, TAU); c.stroke(); }
      const lift = held ? ts * 0.25 : p.drop ? (1 - clamp((T - p.drop) * 4, 0, 1)) * ts * 0.5 : 0;
      ents.push({ y: sp.y + (held ? 1e4 : 0), draw: () => drawCreature(c, p.L, sp.x - (p.at || held ? 0 : b.w * 0.04), p.at || held ? sp.y : s.y + size * 0.3, size, T, { lift, mood: b.won || held ? 'happy' : 'idle', noShadow: !p.at && !held, glow: 0.2 }) });
    });
    ents.sort((a, z) => a.y - z.y).forEach(e => e.draw());
    const n = b.open.filter(Boolean).length; bonusCount('Blooming ' + n + ' of ' + g.buds.length);
    if (b.won) {
      const a = clamp((T - b.won) * 2, 0, 1); c.globalAlpha = a; for (let i = 0; i < 12; i++) { const r2 = RNG(i + 3), d = g.buds[i % g.buds.length], x = ox + r2.f() * ts * N, y = oy + ts * N - (((T - b.won) * 60 + r2.f() * 300) % (ts * N)); drawItem(c, { k: 'berry', el: d.k }, x, y, ts * 0.42, T); } c.globalAlpha = 1;
      if (T - b.won > 2.2 / bonusSpeed()) bonusEnd(false);
    }
  },
  end(b, early) {
    if (early) { b.loot.dust = b.open.filter(Boolean).length; return 'You head back with the garden half asleep: ' + b.loot.dust + ' of ' + b.g.buds.length + ' buds open.'; }
    const pay = gardenPay(b.g); b.loot.dust = pay.dust; b.loot.berries = pay.berries;
    return 'Every bud is open, and the garden gives you a basket of berries.';
  }
};
