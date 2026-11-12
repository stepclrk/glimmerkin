/* ===== Bonus world: Skyglide. Hold to rise, let go to sink, and follow the dewdrops across the sky ===== */
BONUS.skyglide = {
  name: 'Skyglide',
  line: 'Glide across the sky to a far island, gathering dewdrops on the way.',
  hint: 'Hold to rise, let go to sink. Follow the dewdrops and fly through the wind rings.',
  text: 'Your Glimmerkin glides across the sky for 45 seconds. Hold a finger anywhere to rise, and let go to sink. The dewdrops lie along one line through the sky: stay on it to gather them. A wind ring is worth three dewdrops. Brushing a storm cloud only bounces you away and shakes one dewdrop loose. At the island every four dewdrops are worth a stardust, on top of five for the flight. Now and then a chime stone waits on the island. A Gale little in the party tows you; without one you ride a balloon.',
  start(b) {
    b.g = genGlide(b.seed); b.s = { y: 0.5, vy: 0 }; b.clock = 0; b.go = false; b.hold = false; b.dew = 0; b.caught = 0; b.rings = 0; b.bumps = 0; b.wob = 0; b.acc = 0; b.trail = [];
    b.items = [...b.g.dew.map(d => ({ k: 'dew', t: d.t, y: d.y, st: 0 })), ...b.g.rings.map(d => ({ k: 'ring', t: d.t, y: d.y, st: 0 }))].sort((p, q) => p.t - q.t);
    b.clouds = b.g.clouds.map(c => Object.assign({ hit: 0 }, c)); b.tow = b.lits.find(f => f.kinds.includes('gale')) || null;
  },
  down(b) { b.hold = true; b.go = true; },
  up(b) { b.hold = false; },
  /* One sixtieth of a second of flying: the same step the generator's test flies with. */
  tick(b, dt) {
    const G = GLIDE, s = b.s; b.clock += dt;
    if (b.clock >= b.g.secs) { s.vy += (0 - s.vy) * Math.min(1, 6 * dt); s.y += (0.5 - s.y) * Math.min(1, 2.5 * dt); return; }   // gliding in to land
    glideStep(s, b.hold, dt);
    for (const d of b.items) { if (d.st || d.t > b.clock) continue; if (Math.abs(d.y - s.y) <= G.reach) { d.st = 1; this.take(b, d); } else d.st = 2; }
    for (const c of b.clouds) if (!c.hit && Math.abs(c.t - b.clock) <= G.cloudSecs && Math.abs(c.y - s.y) <= G.cloud) { c.hit = T; this.bump(b, c); }
  },
  take(b, d) {
    const x = b.px, y = b.y + d.y * b.h; b.cheer = T + 0.4;
    if (d.k === 'ring') { b.rings++; b.dew += GLIDE.ring; burst(x, y, 16, 190, { kind: 'star', v: 160, size: 5 }); floatText(x, y - 26, 'Wind ring +' + GLIDE.ring, '#bff3ff'); sfx('skill'); }
    else { b.caught++; b.dew++; burst(x, y, 4, 195, { v: 60, size: 3 }); sfx('pick'); }
  },
  bump(b, c) {
    const lost = Math.min(1, b.dew); b.dew -= lost; b.bumps++; b.wob = 1; b.s.vy = (b.s.y < c.y ? -1 : 1) * 0.5; sfx('no');
    burst(b.px, b.y + b.s.y * b.h, 14, 250, { v: 140, size: 4 }); floatText(b.px, b.y + b.s.y * b.h - 30, lost ? 'Bump! A dewdrop shakes loose' : 'Bump!', '#ff8fb3');
  },
  draw(b, c, dt) {
    const G = GLIDE, g = b.g, s = b.s, sp = bonusSpeed(), sc = clamp(b.w / 330, 0.9, 1.5), pps = b.w * 0.42, px = b.px = b.x + b.w * 0.28, X = t => px + (t - b.clock) * pps, Y = y => b.y + y * b.h;
    if (!b.go && b.t > 2.5) b.go = true;
    if (b.go) { b.acc += dt * sp; while (b.acc >= 1 / 60) { b.acc -= 1 / 60; this.tick(b, 1 / 60); } }
    b.wob = Math.max(0, b.wob - dt * 2); b.trail.unshift(s.y); if (b.trail.length > 60) b.trail.length = 60;
    // far stars, far islands and banks of cloud, each drifting at its own pace
    const rs = RNG(b.seed); for (let i = 0; i < (REDUCED ? 24 : 60); i++) { const x = ((rs.f() * VW - b.clock * 6) % VW + VW) % VW, y = rs.f() * VH * 0.8; c.fillStyle = 'rgba(255,248,225,' + (0.2 + 0.4 * rs.f()).toFixed(2) + ')'; c.fillRect(x, y, 1.5, 1.5); }
    for (let i = 0; i < 4; i++) { const span = VW + 240, x = ((i * 190 + rs.f() * 80 - b.clock * 16) % span + span) % span - 120, y = b.y + b.h * (0.3 + rs.f() * 0.6), w = (50 + rs.f() * 40) * sc; c.fillStyle = hsl(b.B.wc[0], 30, 22, 0.55); c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y - w * 0.28, x + w, y); c.quadraticCurveTo(x + w * 0.2, y + w * 0.75, x, y + w * 0.9); c.quadraticCurveTo(x - w * 0.3, y + w * 0.6, x - w, y); c.fill(); }
    for (let i = 0; i < 5; i++) { const span = VW + 200, x = ((i * 150 - b.clock * 34) % span + span) % span - 100, y = b.y + b.h * (0.1 + i * 0.2); c.fillStyle = 'rgba(255,240,255,.06)'; for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(x + j * 26 * sc, y + (j % 2) * 7, 34 * sc, 14 * sc, 0, 0, TAU); c.fill(); } }
    // the island at the end of the flight
    const ix = X(g.secs + 1.25), iy = Y(0.5) + 34 * sc;
    if (ix < VW + 200) {
      const w = 120 * sc; c.fillStyle = hsl(b.B.wc[0], 30, 26); c.beginPath(); c.moveTo(ix - w, iy); c.quadraticCurveTo(ix - w * 0.5, iy + w * 0.9, ix, iy + w * 1.1); c.quadraticCurveTo(ix + w * 0.6, iy + w * 0.8, ix + w, iy); c.closePath(); c.fill();
      c.fillStyle = hsl(140, 45, 46); c.beginPath(); c.ellipse(ix, iy, w, w * 0.16, 0, 0, TAU); c.fill(); c.fillStyle = hsl(140, 50, 58); c.beginPath(); c.ellipse(ix, iy - w * 0.03, w * 0.9, w * 0.11, 0, 0, TAU); c.fill();
      if (g.chime && S.chimes < 8) { const kx = ix + w * 0.45, ky = iy - 16 * sc; glow(c, kx, ky, 26 * sc, 46, 100, 70, 0.5 + 0.2 * Math.sin(T * 3)); c.fillStyle = '#cfd6ff'; c.strokeStyle = '#2a2350'; c.lineWidth = 1.5; rrect(c, kx - 9 * sc, ky - 13 * sc, 18 * sc, 26 * sc, 8 * sc); c.fill(); c.stroke(); c.fillStyle = '#ffcf6b'; c.font = '800 ' + Math.round(13 * sc) + 'px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('♪', kx, ky + 5 * sc); }
    }
    // storm clouds
    for (const cl of b.clouds) {
      const x = X(cl.t); if (x < -120 || x > VW + 120) continue; const y = Y(cl.y), rw = G.cloudSecs * pps, rh = G.cloud * b.h, shake = cl.hit && T - cl.hit < 0.5 ? Math.sin(T * 50) * 4 : 0, rr = RNG(cl.seed);
      c.fillStyle = hsl(255, 26, 30, 0.95); for (let j = 0; j < 6; j++) { const ox = (j / 5 - 0.5) * 1.5 * rw, oy = (rr.f() - 0.5) * rh * 0.6; c.beginPath(); c.ellipse(x + ox + shake, y + oy, rw * 0.5, rh * (0.6 + rr.f() * 0.3), 0, 0, TAU); c.fill(); }
      c.fillStyle = hsl(255, 30, 20, 0.9); c.beginPath(); c.ellipse(x + shake, y + rh * 0.5, rw * 0.95, rh * 0.38, 0, 0, TAU); c.fill();
      if (Math.sin(T * 3 + cl.seed) > 0.8) { c.strokeStyle = 'rgba(255,233,160,.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 4, y + rh * 0.7); c.lineTo(x + 3, y + rh * 1.05); c.lineTo(x - 2, y + rh * 1.05); c.lineTo(x + 4, y + rh * 1.45); c.stroke(); }
    }
    // dewdrops and wind rings
    for (const d of b.items) {
      if (d.st === 1) continue; const x = X(d.t); if (x < -30 || x > VW + 30) continue; const y = Y(d.y);
      if (d.k === 'ring') { const a = 0.6 + 0.3 * Math.sin(T * 5); c.strokeStyle = 'rgba(191,243,255,' + a + ')'; c.lineWidth = 3.5 * sc; c.beginPath(); c.ellipse(x, y, 10 * sc, G.reach * b.h, 0, 0, TAU); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, 5 * sc, G.reach * b.h * 0.62, 0, 0, TAU); c.stroke(); }
      else { const bobY = y + Math.sin(T * 3 + d.t * 4) * 2; glow(c, x, bobY, 11 * sc, 195, 100, 72, 0.6); c.fillStyle = '#c9f4ff'; c.beginPath(); c.moveTo(x, bobY - 7 * sc); c.quadraticCurveTo(x + 6 * sc, bobY + 1 * sc, x, bobY + 6 * sc); c.quadraticCurveTo(x - 6 * sc, bobY + 1 * sc, x, bobY - 7 * sc); c.fill(); c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(x - 1.5 * sc, bobY + 1 * sc, 1.5 * sc, 0, TAU); c.fill(); }
    }
    // the fliers: the party trails behind, the Glimmerkin under its balloon or behind the Gale little that tows it
    const py = Y(s.y) + Math.sin(T * 30) * 5 * b.wob, tilt = clamp(s.vy * 0.5, -0.3, 0.3), ps = 46 * sc * [0.82, 0.9, 1, 1.05][b.look.stage], mood = b.cheer > T ? 'happy' : 'idle';
    b.lits.filter(f => f !== b.tow).forEach((f, i) => { const yy = Y(b.trail[Math.min(b.trail.length - 1, 12 + i * 10)] || s.y); drawCreature(c, f.L, px - (40 + i * 30) * sc, yy + 14 * sc, 26 * sc, T, { noShadow: true, mood }); });
    if (b.tow) {
      const tx = px + 56 * sc, ty = py - 22 * sc + Math.sin(T * 4) * 3; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(px + 10 * sc, py - 6 * sc); c.quadraticCurveTo((px + tx) / 2, py + 6 * sc, tx - 8 * sc, ty); c.stroke();
      drawCreature(c, b.tow.L, tx, ty + 14 * sc, 30 * sc, T, { noShadow: true, mood });
      c.fillStyle = hsl(290, 50, 93, 0.9); for (const [ox, rr] of [[-16, 10], [0, 13], [16, 10]]) { c.beginPath(); c.arc(px + ox * sc, py + 22 * sc, rr * sc, 0, TAU); c.fill(); }
    } else {
      const bx = px, by = py - 52 * sc, br = 20 * sc; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(bx + sd * br * 0.6, by + br * 0.8); c.lineTo(px + sd * 9 * sc, py - 12 * sc); c.stroke(); }
      for (let i = 0; i < 4; i++) { c.fillStyle = hsl([350, 46, 190, 280][i], 80, 72); c.beginPath(); c.ellipse(bx, by, br * (1 - i * 0.25), br * 1.1, 0, 0, TAU); c.fill(); }
      c.strokeStyle = '#2a2350'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(bx, by, br, br * 1.1, 0, 0, TAU); c.stroke();
    }
    c.save(); c.translate(px, py); c.rotate(tilt); drawCreature(c, b.look, 0, 22 * sc, ps, T, { noShadow: true, mood, glow: 0.3 }); c.restore();
    if (!b.go) { c.font = '800 ' + Math.round(13 * sc) + 'px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(239,234,252,.9)'; c.fillText('Hold to rise, let go to sink', b.x + b.w / 2, b.y + b.h * 0.86); }
    const left = Math.max(0, Math.ceil(g.secs - b.clock));
    bonusCount('Dewdrops ' + b.dew + ' · 0:' + String(left).padStart(2, '0'));
    if (b.clock >= g.secs + 1.6) bonusEnd(false);
  },
  end(b, early) {
    const n = b.dew + (b.dew === 1 ? ' dewdrop' : ' dewdrops');
    if (early) { b.loot.dust = Math.floor(b.dew / 4); return 'You turn back before the island, with ' + n + '.'; }
    b.loot.dust = glidePay(b.dew);
    if (b.g.chime && S.chimes < 8) { S.chimes++; return 'You land on the island with ' + n + ', and find a chime stone there. It adds a note to the tune the nest plays.'; }
    return 'You land on the island with ' + n + '.';
  }
};
