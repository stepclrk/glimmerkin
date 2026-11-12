/* ===== Bonus world: Hide and seek. Look around a wide scene and tap the littles hiding in it ===== */
const HIDE_DUST = 3, HIDE_FULL = 12;   // stardust for each find, and in place of the egg when the nest is full
BONUS.hide = {
  name: 'Hide and seek',
  line: 'Your littles have run off to hide, and some wild ones with them. Find all five.',
  hint: 'Five littles are hiding. Drag to look around, and tap one when you spot it.',
  text: 'The scene is three screens wide. Drag left and right to look around it. Five littles are hiding in it, your own and some wild ones. Each shows a part of itself: ears over the top, or half a face round the side. Tap a little to find it. There is no clock. If you have not found one for a while, its hiding place rustles. When all five are found, one of the wild littles leaves an egg of its own kind.',
  start(b) {
    const g = b.g = genHide(b.seed, b.lits.map(f => f.kinds));
    b.hid = g.hiders.map((h, i) => { const f = h.wild ? null : b.lits[i]; return { h, L: f ? f.L : lookFor(h.kinds[0], h.seed, h.kinds[1]), name: f ? f.l.name : 'A wild ' + KINDS[h.kinds[0]].species, found: 0 }; });
    b.cam = b.w; b.idle = 0; b.rustle = null; b.won = 0; b.drag = null; b.taps = 0;
  },
  layout(b) { b.u = clamp(Math.min(b.w, 470) / 390, 0.8, 1.2); b.gy = b.y + b.h * 0.62; b.cam = clamp(b.cam === undefined ? b.w : b.cam, 0, b.w * (HIDE.screens - 1)); },
  /* Where a hider stands, where its cover is, and the middle of the part of it that shows. All in scene x. */
  place(b, k) {
    const hd = b.hid[k], h = hd.h, p = b.g.props[h.prop], u = b.u, ps = 100 * u * p.s, cs = 46 * u, px = p.x * b.w, top = b.gy - ps * 0.6, half = ps * (p.t === 'clump' ? 0.5 : 0.3);
    if (p.t === 'pool') { const water = b.gy + 8 * u; return { x: px, y: water + (1 - h.show) * cs, cs, mx: px, my: water - h.show * cs * 0.5, clip: water }; }
    if (h.peek === 'up') return { x: px, y: top + (1 - h.show) * cs, cs, mx: px, my: top - h.show * cs * 0.5 };
    const sd = h.peek === 'left' ? -1 : 1, x = px + sd * (half + (h.show - 0.5) * cs * 0.9); return { x, y: b.gy, cs, mx: x + sd * cs * 0.2, my: b.gy - cs * 0.5 };
  },
  prop(c, b, p, shake) {
    const u = b.u, ps = 100 * u * p.s, x = p.x * b.w + shake, gy = b.gy;
    if (p.t === 'pool') { const g = c.createLinearGradient(0, gy, 0, gy + 34 * u); g.addColorStop(0, '#2f8fc4'); g.addColorStop(1, '#14457a'); c.fillStyle = g; c.beginPath(); c.ellipse(x, gy + 16 * u, ps * 0.62, 17 * u, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(190,240,255,.5)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x + Math.sin(T * 1.3 + p.seed) * 6, gy + 16 * u, ps * 0.3, 5 * u, 0, 0, TAU); c.stroke(); return; }
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, gy + 2, ps * (p.t === 'clump' ? 0.62 : 0.4), 7 * u, 0, 0, TAU); c.fill();
    if (p.t === 'clump') { drawWall(c, x - ps * 0.82, gy - ps * 0.68, ps * 0.8, b.B, p.seed + 1); drawWall(c, x + ps * 0.02, gy - ps * 0.68, ps * 0.8, b.B, p.seed + 2); }
    drawWall(c, x - ps / 2, gy - ps * 0.86, ps, b.B, p.seed);
  },
  down(b, pt) { b.drag = { x: pt.x }; },
  move(b, pt) { if (!b.drag) return; b.cam = clamp(b.cam - (pt.x - b.drag.x), 0, b.w * (HIDE.screens - 1)); b.drag.x = pt.x; },
  up(b, pt, tap) {
    b.drag = null; if (!tap || b.won) return; b.taps++;
    const sx = pt.x - b.x + b.cam; let best = -1, bd = 1e9;
    b.hid.forEach((hd, k) => { if (hd.found) return; const pl = this.place(b, k), d = Math.hypot(sx - pl.mx, pt.y - pl.my); if (d < pl.cs * 0.85 && d < bd) { bd = d; best = k; } });
    if (best < 0) { burst(pt.x, pt.y, 4, b.B.accent[0], { v: 50, size: 3 }); return; }
    const hd = b.hid[best]; hd.found = T; b.idle = 0; b.rustle = null; burst(pt.x, pt.y, 14, 340, { kind: 'heart', v: 110, size: 5, life: 0.9 }); floatText(pt.x, pt.y - 30, hd.h.wild ? hd.name + '!' : 'Found ' + hd.name + '!', '#ffc2dc'); sfx('chirp');
    const n = b.hid.filter(z => z.found).length; bonusHint(n >= b.hid.length ? 'You found everyone.' : BONUS.hide.hint);
    if (n >= b.hid.length) { b.won = T; sfx('grow'); }
  },
  draw(b, c, dt) {
    const g = b.g, u = b.u, gy = b.gy, WW = b.w * HIDE.screens, B = b.B, [fh, fs, fl] = B.fl, [wh, ws, wl] = B.wc;
    // far shapes, drifting more slowly than the scene
    c.save(); c.beginPath(); c.rect(b.x, 0, b.w, VH); c.clip();
    const rs = RNG(b.seed + 5); for (let i = 0; i < 50; i++) { const x = rs.f() * VW, y = rs.f() * gy, a = 0.2 + 0.45 * (0.5 + 0.5 * Math.sin(T * (1 + rs.f() * 2) + i)); c.fillStyle = 'rgba(255,248,225,' + a.toFixed(2) + ')'; c.fillRect(x, y, 1.6, 1.6); }
    glow(c, b.x + b.w * 0.78 - b.cam * 0.05, b.y + b.h * 0.14, 60 * u, 48, 90, 80, 0.35); c.fillStyle = '#fff3d0'; c.beginPath(); c.arc(b.x + b.w * 0.78 - b.cam * 0.05, b.y + b.h * 0.14, 15 * u, 0, TAU); c.fill();
    c.save(); c.translate(b.x - b.cam * 0.35, 0); c.fillStyle = hsl(wh, ws * 0.5, Math.max(8, wl * 0.3), 0.55); for (let i = 0; i < 9; i++) { const rr = RNG(b.seed + i * 5); c.beginPath(); c.ellipse(i * b.w * 0.3, gy - 6, b.w * (0.16 + rr.f() * 0.12), b.h * (0.16 + rr.f() * 0.26), 0, Math.PI, 0); c.fill(); } c.restore();
    c.save(); c.translate(b.x - b.cam * 0.65, 0); c.globalAlpha = 0.5; for (let i = 0; i < 12; i++) { const rr = RNG(b.seed + i * 11), s = (50 + rr.f() * 30) * u; drawWall(c, i * b.w * 0.22 + rr.f() * 30, gy - s * 0.95, s, B, b.seed + i * 3); } c.restore();
    // the ground
    c.fillStyle = hsl(fh, fs, fl - 6); c.fillRect(b.x, gy - 16 * u, b.w, VH); c.save(); c.translate(b.x - b.cam, 0);
    c.fillStyle = hsl(fh, fs, fl + 2); c.beginPath(); c.moveTo(0, gy); for (let x = 0; x <= WW; x += 24) c.lineTo(x, gy - 16 * u + Math.sin(x * 0.05 + b.seed) * 3 * u); c.lineTo(WW, gy); c.fill();
    const rg = RNG(b.seed + 77); for (let i = 0; i < 60; i++) { const x = rg.f() * WW, y = gy + rg.f() * (b.y + b.h - gy); c.fillStyle = hsl(fh, fs, fl + (rg.chance(0.5) ? 7 : -12), 0.6); c.beginPath(); c.ellipse(x, y, 7 * u, 3 * u, 0, 0, TAU); c.fill(); }
    // a hiding place that has kept its secret for a while rustles
    if (!b.won) { b.idle += dt * bonusSpeed(); if (b.idle > 20 && !b.rustle) { const mid = b.cam + b.w / 2, left = b.hid.map((hd, k) => ({ hd, k })).filter(z => !z.hd.found).sort((a, z) => Math.abs(g.props[a.hd.h.prop].x * b.w - mid) - Math.abs(g.props[z.hd.h.prop].x * b.w - mid))[0]; if (left) { const px = g.props[left.hd.h.prop].x * b.w; b.rustle = { k: left.k, t: T }; bonusHint(px < b.cam ? 'Something rustles, away to the left.' : px > b.cam + b.w ? 'Something rustles, away to the right.' : 'Something rustles close by.'); sfx('slide'); } } }
    if (b.rustle && T - b.rustle.t > 3.5) { b.rustle = null; b.idle = 8; }
    // hiders behind their places, then the places, then the found ones out in front
    const order = g.props.map((p, i) => i).sort((a, z) => g.props[a].s - g.props[z].s);
    for (const i of order) {
      const p = g.props[i], k = b.hid.findIndex(hd => hd.h.prop === i), shake = b.rustle && b.rustle.k === k ? Math.sin(T * 30) * 3 * u : 0;
      if (p.t === 'pool') this.prop(c, b, p, 0);
      if (k >= 0 && !b.hid[k].found) { const pl = this.place(b, k); c.save(); if (pl.clip) { c.beginPath(); c.rect(pl.x - pl.cs, 0, pl.cs * 2, pl.clip); c.clip(); } drawCreature(c, b.hid[k].L, pl.x + shake * 0.5, pl.y, pl.cs, T, { noShadow: true }); c.restore(); if (pl.clip) { c.strokeStyle = 'rgba(190,240,255,.7)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(pl.x, pl.clip + 2, pl.cs * 0.42, 4 * u, 0, 0, TAU); c.stroke(); } }
      if (p.t !== 'pool') this.prop(c, b, p, shake);
      if (shake && !REDUCED && Math.random() < 0.3) burst(p.x * b.w - b.cam + b.x, gy - 50 * u, 1, B.accent[0], { v: 60, size: 3 });
    }
    c.font = '800 ' + Math.round(11 * u) + 'px Nunito, system-ui, sans-serif'; c.textAlign = 'center';
    b.hid.forEach((hd, k) => {
      if (!hd.found) return; const pl = this.place(b, k), p = g.props[hd.h.prop], e = clamp((T - hd.found) * 2.5, 0, 1), tx = p.x * b.w + (k % 2 ? 22 : -22) * u, ty = gy + 34 * u, x = lerp(pl.x, tx, e), y = lerp(pl.y, ty, e);
      c.strokeStyle = 'rgba(134,232,200,' + 0.85 * e + ')'; c.lineWidth = 2; c.beginPath(); c.ellipse(tx, ty, 26 * u, 7 * u, 0, 0, TAU); c.stroke();
      drawCreature(c, hd.L, x, y, pl.cs, T, { lift: Math.sin(e * Math.PI) * 30 * u, mood: 'happy' });
      if (e >= 1) { const w = c.measureText(hd.name).width + 12; c.fillStyle = 'rgba(22,15,46,.85)'; rrect(c, tx - w / 2, ty + 9 * u, w, 17 * u, 8); c.fill(); c.fillStyle = '#efeafc'; c.fillText(hd.name, tx, ty + 21 * u); }
    });
    c.restore(); c.restore();
    // which way there is more to see
    const a = 0.45 + 0.3 * Math.sin(T * 3); c.fillStyle = 'rgba(239,234,252,' + a + ')'; c.font = '800 ' + Math.round(26 * u) + 'px Nunito, system-ui, sans-serif';
    if (b.cam > 4) c.fillText('‹', b.x + 14, b.y + b.h * 0.3); if (b.cam < b.w * (HIDE.screens - 1) - 4) c.fillText('›', b.x + b.w - 14, b.y + b.h * 0.3);
    bonusCount('Found ' + b.hid.filter(z => z.found).length + ' of ' + b.hid.length);
    if (b.won && T - b.won > 1.8 / bonusSpeed()) bonusEnd(false);
  },
  end(b, early) {
    const n = b.hid.filter(z => z.found).length; b.loot.dust = n * HIDE_DUST;
    if (early || n < b.hid.length) return 'You head back having found ' + n + ' of ' + b.hid.length + '. The rest come out when you call.';
    const k = b.g.egg; if (!k) return 'You found all five.';
    if (S.littles.length + S.eggs.length + b.q.loot.eggs.length < 8) { b.loot.eggs.push({ hue: Math.round((KINDS[k].hue[0] + KINDS[k].hue[1]) / 2), twin: false, kinds: [k] }); return 'You found all five. A wild ' + KINDS[k].species + ' leaves you an egg of its own kind.'; }
    b.loot.dust += HIDE_FULL; return 'You found all five. The nest is full, so the wild littles leave ' + HIDE_FULL + ' stardust instead of an egg.';
  }
};
