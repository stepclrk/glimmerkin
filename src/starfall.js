/* ===== Bonus world: Starfall. Ride a cloud and catch what falls ===== */
const STARFALL_DROP = 3;   // seconds a mote takes to fall from the top of the sky to the cloud
BONUS.starfall = {
  name: 'Starfall',
  line: 'Ride a cloud with your littles and catch the motes of light that fall from the sky.',
  hint: 'Drag to move the cloud. Motes in your littles\' colours, the ringed ones, count double.',
  text: 'Motes of light fall for a minute. Drag anywhere to move the cloud under them. A mote is worth one point, or two when it is the colour of a little riding with you: those have a ring round them. Star shards fill the jar. Bumping a gloom only wobbles the cloud and tosses three motes back up, to catch again. At the end every five points are worth a stardust, and each shard one more.',
  start(b) {
    b.kinds = [...new Set(b.lits.flatMap(f => f.kinds))]; b.fall = genStarfall(b.seed, b.kinds);
    b.drops = b.fall.drops.map(d => Object.assign({ st: 0 }, d)); b.cx = 0.5; b.tx = 0.5; b.clock = 0; b.points = 0; b.shards = 0; b.caught = 0; b.bumps = 0; b.wob = 0; b.go = false;
  },
  down(b, pt) { b.go = true; b.tx = clamp((pt.x - b.x) / b.w, 0.08, 0.92); },
  move(b, pt) { b.tx = clamp((pt.x - b.x) / b.w, 0.08, 0.92); },
  draw(b, c, dt) {
    const sp = bonusSpeed(), top = b.y - 30, yc = b.y + b.h * 0.8, sc = clamp(b.w / 330, 0.9, 1.5), X = u => b.x + u * b.w, n = b.lits.length;
    if (!b.go && b.t > 2.5) b.go = true;
    if (b.go) b.clock += dt * sp;
    b.cx += clamp(b.tx - b.cx, -1.6 * dt * sp, 1.6 * dt * sp); b.wob = Math.max(0, b.wob - dt * 2);
    // far stars and drifting cloud banks
    const rs = RNG(b.seed); for (let i = 0; i < (REDUCED ? 30 : 70); i++) { const x = rs.f() * VW, y = rs.f() * VH, a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(T * (1 + rs.f() * 2) + i)); c.fillStyle = 'rgba(255,248,225,' + a.toFixed(2) + ')'; c.fillRect(x, y, 1.6, 1.6); }
    for (let i = 0; i < 4; i++) { const x = ((i * 137 - T * 8) % (VW + 160) + VW + 160) % (VW + 160) - 80, y = b.y + b.h * (0.15 + i * 0.17); c.fillStyle = 'rgba(255,235,255,.06)'; for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(x + j * 24 * sc, y + (j % 2) * 6, 32 * sc, 14 * sc, 0, 0, TAU); c.fill(); } }
    // what falls
    for (const d of b.drops) {
      if (d.st === 0 && b.clock >= d.t) {
        const near = Math.abs(d.x - b.cx);
        if (d.k === 'gloom') { if (near <= STARFALL.reach) { d.st = 1; this.bump(b, X(d.x), yc); } else d.st = 2; }
        else if (near <= STARFALL.reach + 0.03) { d.st = 1; this.take(b, d, X(d.x), yc); }
        else d.st = 2;
      }
      if (d.st === 1) continue;
      let x = X(d.x), y;
      if (d.up !== undefined) { const u = clamp((b.clock - d.up) / (d.t - d.up), 0, 1.3); if (u >= 1.3) continue; y = u <= 1 ? yc - 20 * sc - Math.sin(u * Math.PI) * b.h * 0.34 : yc + (u - 1) * b.h; }
      else { const u = 1 - (d.t - b.clock) / STARFALL_DROP; if (u < 0 || u > 1.3) continue; y = lerp(top, yc, u); }
      if (d.k === 'mote') this.mote(c, x, y, d.el, sc, b.kinds.includes(d.el));
      else if (d.k === 'shard') drawItem(c, { k: 'shard' }, x, y, 36 * sc, T);
      else drawGloom(c, { g: d.g, tough: 0 }, x, y + 14 * sc, 32 * sc, T);
    }
    // the cloud and its riders
    const cx = X(b.cx) + Math.sin(T * 34) * 5 * b.wob, half = (n > 2 ? 78 : 62) * sc, mid = cx + (n > 2 ? 18 * sc : 0);
    glow(c, mid, yc + 8 * sc, half * 1.5, 285, 80, 82, 0.22); c.fillStyle = hsl(290, 50, 93);
    for (const [ox, oy, rr] of [[-0.72, 0.12, 0.3], [-0.34, 0.03, 0.4], [0.1, 0, 0.44], [0.52, 0.06, 0.36], [0.82, 0.16, 0.25], [0, 0.24, 0.5]]) { c.beginPath(); c.arc(mid + ox * half, yc + 6 * sc + oy * half, rr * half, 0, TAU); c.fill(); }
    c.fillStyle = hsl(280, 34, 78); c.beginPath(); c.ellipse(mid, yc + 6 * sc + half * 0.45, half * 0.92, half * 0.16, 0, 0, TAU); c.fill();
    const seats = [-44, 44, 84]; b.lits.forEach((f, i) => drawCreature(c, f.L, cx + seats[i % 3] * sc, yc + 2 * sc, 30 * sc, T, { noShadow: true, mood: b.cheer > T ? 'happy' : 'idle' }));
    drawCreature(c, b.look, cx, yc, 48 * sc * [0.82, 0.9, 1, 1.05][b.look.stage], T, { noShadow: true, mood: b.cheer > T ? 'happy' : 'idle', glow: 0.3 });
    // the shard jar
    const jx = b.x + b.w - 56 * sc, jy = b.y + 6, jw = 44 * sc, jh = 58 * sc; c.fillStyle = 'rgba(22,15,46,.7)'; rrect(c, jx, jy, jw, jh, 12); c.fill(); c.strokeStyle = 'rgba(255,207,107,.5)'; c.lineWidth = 1; c.stroke();
    drawItem(c, { k: 'shard' }, jx + jw / 2, jy + jh * 0.38, 28 * sc, T); c.font = '800 ' + Math.round(13 * sc) + 'px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffcf6b'; c.fillText('× ' + b.shards, jx + jw / 2, jy + jh - 8 * sc);
    if (!b.go) { c.fillStyle = 'rgba(239,234,252,.9)'; c.fillText('Drag to move the cloud', b.x + b.w / 2, b.y + b.h * 0.5); }
    const left = Math.max(0, Math.ceil(b.fall.secs - b.clock));
    bonusCount('✦ ' + b.points + (b.points === 1 ? ' point' : ' points') + ' · ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'));
    if (b.clock >= b.fall.secs + 1.2) bonusEnd(false);
  },
  mote(c, x, y, el, sc, ring) {
    const h = EL_HUE[el]; glow(c, x, y, 17 * sc, h, 100, 62, 0.75); c.fillStyle = hsl(h, 95, 78); starPath(c, x, y, 7.5 * sc, 3.2 * sc, 5, T * 1.5 + x); c.fill();
    if (ring) { c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, 12 * sc, 0, TAU); c.stroke(); }
  },
  take(b, d, x, y) {
    b.cheer = T + 0.5; b.caught++;
    if (d.k === 'shard') { b.shards++; burst(x, y - 20, 14, 46, { kind: 'star', v: 120, size: 5 }); floatText(x, y - 44, 'Star shard'); sfx('shard'); return; }
    const v = b.kinds.includes(d.el) ? 2 : 1; b.points += v; burst(x, y - 20, 6, EL_HUE[d.el], { v: 80 }); floatText(x, y - 44, '+' + v, hsl(EL_HUE[d.el], 90, 78)); sfx('pick');
  },
  /* A gloom only wobbles the cloud and tosses up to three motes back up, to be caught again where they land. */
  bump(b, x, y) {
    const lost = Math.min(3, b.points); b.points -= lost; b.bumps++; b.wob = 1; sfx('no'); burst(x, y - 20, 18, 300, { v: 150, size: 5, g: -40 }); floatText(x, y - 44, lost ? 'Bump! ' + lost + ' fly back up' : 'Bump!', '#ff8fb3');
    for (let i = 0; i < lost; i++) b.drops.push({ st: 0, k: 'mote', el: ELS[Math.floor(Math.random() * ELS.length)], x: clamp(b.cx + rnd(-0.16, 0.16), 0.08, 0.92), up: b.clock, t: b.clock + 1.5 + i * 0.4 });
  },
  end(b, early) {
    b.loot.dust = early ? Math.floor(b.points / 5) + b.shards : starfallPay(b.points, b.shards);
    return (early ? 'You head back early with ' : 'The sky goes quiet. Your catch came to ') + b.points + (b.points === 1 ? ' point' : ' points') + ' and ' + b.shards + (b.shards === 1 ? ' star shard.' : ' star shards.');
  }
};
