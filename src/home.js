/* ===== Home: the nest on the floating isle ===== */
const home = { pa: { squash: 0, hopY: 0, hopV: 0, mood: null, moodT: 0 }, lits: [], eggs: [], rubAcc: 0, strokes: 0, proj: [], stars: [], shrooms: [], far: [], look: null, petS: 120, baseS: 120, cx: 0, gy: 0, rx: 0, ry: 0, sky: ['#0a0820', '#261c50'], night: 1, skyAt: 0, zT: 0, flies: [],
  ball: { x: 0.45, vx: 0, hopY: 0, hopV: 0, spin: 0 }, boxT: 0, playT: 0, stoneLit: [0, 0, 0, 0, 0, 0, 0, 0], stonePos: [], tuneT: 2, tuneI: 0, kick: [0, 0, 0, 0, 0, 0], chimePos: [], trader: null, traderAt: 0 };
const SKY = [[0, [10, 8, 32], [38, 28, 80]], [5, [24, 18, 60], [92, 54, 108]], [7, [56, 60, 138], [232, 150, 152]], [10, [50, 82, 158], [146, 208, 204]], [16, [56, 70, 150], [196, 196, 186]], [18.5, [44, 30, 96], [238, 140, 112]], [20.5, [20, 14, 56], [112, 52, 112]], [24, [10, 8, 32], [38, 28, 80]]];
function skyAt(h) { let i = 0; while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i++; const a = SKY[i], b = SKY[i + 1], u = (h - a[0]) / (b[0] - a[0]), mix = (p, q) => 'rgb(' + p.map((v, k) => Math.round(lerp(v, q[k], u))).join(',') + ')'; return [mix(a[1], b[1]), mix(a[2], b[2])]; }
function nightAt(h) { return h < 5 || h >= 21 ? 1 : h < 7 ? (7 - h) / 2 : h > 19 ? (h - 19) / 2 : 0; }

function rebuildHome() {
  const H = home; H.look = petLook(S.pet);
  const old = new Map(H.lits.map(f => [f.l.id, f]));
  H.lits = S.littles.map((l, i) => { const o = old.get(l.id) || {}; return { l, L: lookOf(l), i, x: o.x, y: o.y, tx: 0, ty: 0, wt: 0, hop: 0 }; });
  const day = Math.floor(Date.now() / 86400000), r = RNG(day * 31 + S.pet.seed);
  H.shrooms = []; for (let i = 0; i < 7; i++) H.shrooms.push({ a: r.f() * TAU, hue: r.pick([48, 170, 300, 200, 330]), s: 0.6 + r.f() * 0.7, kind: r.chance(0.3) ? 'flower' : 'shroom', ph: r.f() * TAU });
  H.far = []; for (let i = 0; i < 3; i++) H.far.push({ x: 0.3 + i * 0.3 + r.f() * 0.08, y: 0.2 + r.f() * 0.25, s: 0.5 + r.f() * 0.6, ph: r.f() * TAU });
  if (!H.stars.length) { const rs = RNG(77); for (let i = 0; i < 70; i++) H.stars.push({ x: rs.f(), y: rs.f() * 0.72, r: 0.5 + rs.f() * 1.3, sp: 0.5 + rs.f() * 2, ph: rs.f() * TAU }); for (let i = 0; i < (REDUCED ? 5 : 14); i++) H.flies.push({ ax: rs.f() * TAU, ay: rs.f() * TAU, sx: 0.2 + rs.f() * 0.5, sy: 0.3 + rs.f() * 0.5, h: rs.pick([50, 160, 300]) }); }
  H.traderAt = 0; H.idleAt = T; layoutHome();
}
function layoutHome() {
  const H = home; if (!H.look) return;
  const top = topIn + 8, bot = VH - botIn - 8, ah = bot - top;
  H.cx = VW / 2; H.gy = top + ah * 0.64; H.baseS = clamp(Math.min(VW * 0.36, ah * 0.29), 70, 190); H.petS = H.baseS * [0.74, 0.87, 1, 1.08][H.look.stage];
  H.rx = Math.min(VW * 0.47, 250); H.ry = H.rx * 0.2;
  // the party stands on the nest; resting littles sit on floating perches, one each, then two to a perch
  const rest = H.lits.filter(f => !S.party.includes(f.l.id)), bs = H.baseS, yU = H.gy + H.ry + bs * 0.42, yL = Math.max(yU + bs * 0.34, Math.min(H.gy + H.ry + bs * 0.92, bot - bs * 0.1));
  H.perches = [[-0.7, yU], [0.7, yU], [-0.5, yL], [0.5, yL]].map(([dx, y], p) => ({ x: H.cx + dx * H.rx, y, n: rest.filter((_, k) => PERCH_FILL[k % 8] === p).length }));
  H.cradle = { x: H.cx, y: yU }; const seats = seatResting(rest);
  H.lits.forEach(f => {
    const pi = S.party.indexOf(f.l.id);
    if (pi >= 0) { const a = PARTY_ANG[pi % 3] * D2R; f.perch = -1; f.roam = 16; f.hx = H.cx + Math.cos(a) * H.rx * 0.84; f.hy = H.gy + Math.sin(a) * H.ry * 0.86; }
    else { const st = seats.get(f), P = H.perches[st.q]; f.perch = st.q; f.roam = 2.5; f.hx = P.x + st.side * bs * 0.17; f.hy = P.y; }
    if (f.x === undefined) { f.x = f.hx; f.y = f.hy; } f.tx = f.hx; f.ty = f.hy;
  });
}
/* Which perch each resting little takes, and which side of it: friends share a perch when two must. */
function seatResting(rest) {
  const fill = PERCH_FILL.slice(0, Math.min(rest.length, 8)), count = [0, 0, 0, 0]; fill.forEach(q => count[q]++);
  const left = rest.slice(), seats = new Map(), take = (f, q, side) => { left.splice(left.indexOf(f), 1); seats.set(f, { q, side }); };
  for (const q of fill.filter((q, i) => count[q] === 2 && fill.indexOf(q) === i)) {
    let pair = null; for (let a = 0; a < left.length && !pair; a++) for (let b = a + 1; b < left.length; b++) if (areFriends(left[a].l.id, left[b].l.id)) { pair = [left[a], left[b]]; break; }
    (pair || left.slice(0, 2)).forEach((f, j) => take(f, q, j ? 1 : -1));
  }
  for (const q of fill.filter(q => count[q] === 1)) if (left.length) take(left[0], q, 0);
  left.slice().forEach((f, j) => take(f, j % 4, 0));   // more than eight: they share
  return seats;
}
const PARTY_ANG = [200, 340, 55];   // back left, back right, and front right of the Glimmerkin: the music box has the front left
const PERCH_FILL = [0, 1, 2, 3, 2, 3, 0, 1];   // one little to each perch first; the lower, nearer perches take a second one first
/* A floating stone with a mossy top, for littles who are resting. */
function drawPerch(c, x, y, w, t, ph) {
  const bob = Math.sin(t * 1.1 + ph) * 1.5; y += bob;
  let g = c.createLinearGradient(0, y, 0, y + w * 0.9); g.addColorStop(0, '#4a3872'); g.addColorStop(1, '#1d1438'); c.fillStyle = g;
  c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 0.5, y + w * 0.5, x - w * 0.08, y + w * 0.9); c.quadraticCurveTo(x + w * 0.45, y + w * 0.55, x + w, y); c.closePath(); c.fill();
  glow(c, x - w * 0.05, y + w * 0.82, w * 0.4, 170, 100, 70, 0.25 + 0.1 * Math.sin(t * 1.5 + ph));
  g = c.createRadialGradient(x, y - w * 0.08, w * 0.1, x, y, w); g.addColorStop(0, '#58a886'); g.addColorStop(1, '#25615a'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, w, w * 0.24, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(160,240,200,.45)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, w, w * 0.24, 0, Math.PI, TAU); c.stroke();
  return bob;
}
/* The egg cradle hangs from the front of the nest, so eggs no longer stand in front of the littles. */
function drawCradle(c, H, t) {
  const bs = H.baseS, { x, y } = H.cradle, n = S.eggs.length, w = bs * 0.42, sway = Math.sin(t * 0.9) * 0.025;
  c.save(); c.translate(x, H.gy + H.ry * 0.9); c.rotate(sway); const dy = y - (H.gy + H.ry * 0.9);
  c.strokeStyle = '#3d2a1c'; c.lineWidth = 2; c.beginPath(); c.moveTo(-w * 0.55, 0); c.lineTo(-w * 0.9, dy); c.moveTo(w * 0.55, 0); c.lineTo(w * 0.9, dy); c.stroke();
  c.fillStyle = '#6e4326'; c.beginPath(); c.ellipse(0, dy, w, w * 0.32, 0, Math.PI, TAU); c.fill();
  H.eggs = S.eggs.map((e, i) => { const row = i < 3 ? 0 : 1, inRow = row ? n - 3 : Math.min(3, n), j = row ? i - 3 : i, ex = (j - (inRow - 1) / 2) * bs * 0.24 + (row ? bs * 0.06 : 0), ey = dy - bs * (row ? 0.2 : 0.1); return { e, i, lx: ex, ly: ey }; });
  for (const eg of H.eggs.slice().reverse()) drawItem(c, { k: 'egg', hue: eg.e.hue, warm: eg.e.warm, twin: eg.e.twin, fr: !!eg.e.kinds }, eg.lx, eg.ly, bs * 0.4, t);
  c.fillStyle = '#9a6038'; c.beginPath(); c.ellipse(0, dy, w, w * 0.32, 0, 0, Math.PI); c.fill();
  c.strokeStyle = '#5a321a'; c.lineWidth = 1.2; for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(k * w * 0.27, dy + 2); c.lineTo(k * w * 0.22, dy + w * 0.28); c.stroke(); }
  c.strokeStyle = '#c08850'; c.lineWidth = 3.5; c.beginPath(); c.ellipse(0, dy, w, w * 0.1, 0, 0, TAU); c.stroke();
  c.restore();
  for (const eg of H.eggs) { eg.x = x + eg.lx; eg.y = H.gy + H.ry * 0.9 + eg.ly; }
}
function petMouth() { const H = home; return { x: H.cx, y: H.gy - H.petS * 0.38 }; }
const owns = id => S.decor.includes(id);

/* The nest plays itself: each chime stone adds one note the tune may wander to. */
function nestMusic(dt) {
  const H = home; for (let i = 0; i < 8; i++) H.stoneLit[i] = Math.max(0, H.stoneLit[i] - dt * 1.4);
  if (S.chimes < 2) return; H.tuneT -= dt; if (H.tuneT > 0) return;   // one stone alone would only ping: the tune waits for two
  H.tuneT = (S.pet.asleep ? 1.7 : 0.85) * (Math.random() < 0.3 ? 2 : 1);
  if (!S.sound || !AC || AC.state !== 'running' || document.hidden || Math.random() < 0.18) return;
  H.tuneI = clamp(H.tuneI + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)], 0, S.chimes - 1);
  sfx('note', CHIME_NOTES[H.tuneI]); H.stoneLit[H.tuneI] = 1;
  if (!S.j.chimeTold && scene === 'home') { S.j.chimeTold = true; toast('Chime stones sing. Find more and the nest\'s tune grows.', 4200); save(); }
}

const VASE_ANG = 0.74 * Math.PI;   // the vase stands on the front rim of the nest, to the left
function drawHome(dt) {
  const c = ctx, H = home, p = S.pet, pa = H.pa;
  if (T - H.skyAt > 20 || !H.skyAt) { const d = new Date(), h = d.getHours() + d.getMinutes() / 60; H.sky = skyAt(h); H.night = nightAt(h); H.skyAt = T || 0.01; }
  if (T - H.traderAt > 30 || !H.traderAt) { H.trader = traderToday(); ensureWish(); ensureLittleWish(); H.traderAt = T || 0.01; }
  nestMusic(dt); nestLife(dt);
  const nf = H.night, g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, H.sky[0]); g.addColorStop(1, H.sky[1]); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  if (nf > 0.02) for (const s of H.stars) { c.fillStyle = 'rgba(255,250,235,' + (nf * (0.3 + 0.7 * Math.abs(Math.sin(T * s.sp + s.ph)))).toFixed(3) + ')'; c.beginPath(); c.arc(s.x * VW, s.y * VH, s.r, 0, TAU); c.fill(); }
  if (nf > 0.02 && S.sky.length) drawSkyKept(c, nf);
  for (let k = 0; k < 2; k++) { // aurora ribbons
    const base = topIn + 40 + k * 46, amp = 22, hgt = 90, hue = k ? 285 : 160, al = 0.1 + 0.16 * nf;
    const gr = c.createLinearGradient(0, base - amp, 0, base + hgt + amp); gr.addColorStop(0, hsl(hue, 90, 65, 0)); gr.addColorStop(0.35, hsl(hue, 90, 65, al)); gr.addColorStop(1, hsl(hue + 40, 90, 60, 0));
    c.globalCompositeOperation = 'lighter'; c.fillStyle = gr; c.beginPath();
    for (let x = 0; x <= VW + 12; x += 12) { const y = base + Math.sin(x * 0.011 + T * 0.25 + k * 2) * amp + Math.sin(x * 0.027 - T * 0.18) * amp * 0.4; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    for (let x = VW + 12; x >= 0; x -= 12) c.lineTo(x, base + hgt + Math.sin(x * 0.014 + T * 0.2 + k) * amp);
    c.closePath(); c.fill(); c.globalCompositeOperation = 'source-over';
  }
  const mx = VW * 0.8, my = topIn + 56;
  if (nf > 0.5) { glow(c, mx, my, 70, 220, 80, 80, 0.35); c.fillStyle = '#f2f0ff'; c.beginPath(); c.arc(mx, my, 20, 0, TAU); c.fill(); c.fillStyle = H.sky[0]; c.globalAlpha = 0.92; c.beginPath(); c.arc(mx + 9, my - 4, 17, 0, TAU); c.fill(); c.globalAlpha = 1; }
  else { glow(c, mx, my, 90, 40, 100, 75, 0.5); c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.arc(mx, my, 16, 0, TAU); c.fill(); }
  for (const f of H.far) { const x = f.x * VW, y = topIn + 30 + f.y * (H.gy - topIn) + Math.sin(T * 0.5 + f.ph) * 4, s = 26 * f.s; c.fillStyle = 'rgba(20,14,50,.45)'; c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x, y + s * 1.5, x + s, y); c.closePath(); c.fill(); c.fillStyle = 'rgba(90,140,130,.5)'; c.beginPath(); c.ellipse(x, y, s, s * 0.22, 0, 0, TAU); c.fill(); }
  const { cx, gy, rx, ry } = H, bs = H.baseS;
  drawGift(c, H, T);   // December's gifts float in the sky, clear of the crowded nest
  // the trader's balloon drifts in the sky
  if (H.trader) { H.balloon = { x: VW * 0.17, y: topIn + 62, s: clamp(bs * 0.5, 56, 78) }; drawBalloon(c, H.balloon.x, H.balloon.y, H.balloon.s, T); } else H.balloon = null;
  // chime stones circle overhead
  const oy = gy - bs * 1.62; H.stonePos.length = 0;
  if (S.chimes > 0) for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 8; i++) { const a = T * 0.22 + i * TAU / 8, back = Math.sin(a) < 0; if (back !== (pass === 0)) continue; const sx = cx + Math.cos(a) * rx * 0.62, sy = oy + Math.sin(a) * 13, r = 9 + Math.sin(a) * 2; if (i < S.chimes) { drawStone(c, sx, sy, r, i, H.stoneLit[i], T); H.stonePos[i] = { x: sx, y: sy }; } else { c.strokeStyle = 'rgba(220,210,255,.22)'; c.lineWidth = 1; c.setLineDash([2, 3]); c.beginPath(); c.arc(sx, sy, r * 0.7, 0, TAU); c.stroke(); c.setLineDash([]); } }
  drawCrest(c, H);
  // island
  let ig = c.createLinearGradient(0, gy, 0, gy + rx * 0.95); ig.addColorStop(0, '#54407a'); ig.addColorStop(1, '#1a1232'); c.fillStyle = ig;
  c.beginPath(); c.moveTo(cx - rx, gy); c.bezierCurveTo(cx - rx * 0.8, gy + rx * 0.5, cx - rx * 0.25, gy + rx * 0.5, cx - rx * 0.06, gy + rx * 0.92); c.bezierCurveTo(cx + rx * 0.1, gy + rx * 0.6, cx + rx * 0.75, gy + rx * 0.5, cx + rx, gy); c.closePath(); c.fill();
  for (const [dx, len, hue] of [[-0.55, 0.22, 170], [-0.2, 0.3, 285], [0.3, 0.26, 48], [0.62, 0.16, 170]]) { const x = cx + dx * rx, y0 = gy + rx * (0.36 - Math.abs(dx) * 0.2), y1 = y0 + len * rx; glow(c, x, y1 - 6, 22, hue, 100, 70, 0.4 + 0.2 * Math.sin(T * 1.5 + dx * 9)); c.fillStyle = hsl(hue, 80, 74, 0.9); c.beginPath(); c.moveTo(x - 6, y0); c.lineTo(x + 6, y0); c.lineTo(x, y1); c.closePath(); c.fill(); }
  ig = c.createRadialGradient(cx, gy - ry * 0.3, rx * 0.1, cx, gy, rx); ig.addColorStop(0, '#58a886'); ig.addColorStop(1, '#215552'); c.fillStyle = ig; c.beginPath(); c.ellipse(cx, gy, rx, ry, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(160,240,200,.45)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(cx, gy, rx, ry, 0, Math.PI, TAU); c.stroke();
  drawSnowIsle(c, H);
  // bunting: one flag for every banner found
  if (BIOMES.some(b => owns('decor:banner:' + b.id))) {
    const x0 = cx - rx * 0.74, x1 = cx + rx * 0.74, yb = gy - ry * 0.55, yt = gy - bs * 1.34, sag = bs * 0.26;
    c.lineCap = 'round'; c.strokeStyle = '#3d2a1c'; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, yb); c.lineTo(x0, yt); c.moveTo(x1, yb); c.lineTo(x1, yt); c.stroke();
    c.fillStyle = '#ffd766'; c.beginPath(); c.arc(x0, yt, 4, 0, TAU); c.arc(x1, yt, 4, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(240,230,255,.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0, yt); c.quadraticCurveTo(cx, yt + sag * 2, x1, yt); c.stroke();
    BIOMES.forEach((b, i) => { if (!owns('decor:banner:' + b.id)) return; const u = (i + 1) / 7, x = lerp(x0, x1, u), y = yt + sag * 2 * 2 * u * (1 - u); flagShape(c, x, y, bs * 0.15, b, Math.sin(T * 2 + i) * 0.1); });
  }
  const LANT = [208, 252, 288, 332, 152, 28];
  const lantern = i => { const b = BIOMES[i]; if (!owns('decor:lantern:' + b.id)) return; const a = LANT[i] * D2R, x = cx + Math.cos(a) * rx * 0.95, y = gy + Math.sin(a) * ry * 0.92, hgt = bs * 0.5, dir = Math.cos(a) < 0 ? 1 : -1; c.lineCap = 'round'; c.strokeStyle = '#3d2a1c'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - hgt); c.quadraticCurveTo(x, y - hgt - 8, x + dir * bs * 0.1, y - hgt - 6); c.stroke(); lanternShape(c, x + dir * bs * 0.1, y - hgt - 4 + Math.sin(T * 1.6 + i) * 1.2, bs * 0.13, b, T); };
  const shroom = s => { const x = cx + Math.cos(s.a) * rx * 0.9, y = gy + Math.sin(s.a) * ry * 0.86, z = 13 * s.s; glow(c, x, y - z, z * 2.4, s.hue, 100, 68, 0.35 + 0.2 * Math.sin(T * 2 + s.ph)); if (s.kind === 'flower') { c.strokeStyle = '#2f6b4a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - z * 1.3); c.stroke(); for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + T * 0.3; c.fillStyle = hsl(s.hue, 90, 78); c.beginPath(); c.arc(x + Math.cos(a) * z * 0.35, y - z * 1.3 + Math.sin(a) * z * 0.35, z * 0.26, 0, TAU); c.fill(); } c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(x, y - z * 1.3, z * 0.2, 0, TAU); c.fill(); } else { c.fillStyle = '#efe6d2'; c.fillRect(x - z * 0.14, y - z * 0.9, z * 0.28, z * 0.9); c.fillStyle = hsl(s.hue, 80, 66); c.beginPath(); c.arc(x, y - z * 0.85, z * 0.6, Math.PI, TAU); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(x - z * 0.2, y - z * 1.1, z * 0.1, 0, TAU); c.arc(x + z * 0.22, y - z * 1.0, z * 0.07, 0, TAU); c.fill(); } };
  for (const s of H.shrooms) if (Math.sin(s.a) < 0) shroom(s);
  for (let i = 0; i < 6; i++) if (Math.sin(LANT[i] * D2R) < 0) lantern(i);
  // nest (back half)
  const ps = H.petS, nrx = bs * (0.72 + 0.025 * S.reg.built.length), nry = bs * 0.2, ny = gy + ry * 0.12;
  const nest = (a0, a1) => { c.lineCap = 'round'; c.strokeStyle = '#3d2a1c'; c.lineWidth = bs * 0.13; c.beginPath(); c.ellipse(cx, ny, nrx, nry, 0, a0, a1); c.stroke(); c.strokeStyle = '#7b5637'; c.lineWidth = bs * 0.085; c.beginPath(); c.ellipse(cx, ny, nrx, nry, 0, a0, a1); c.stroke(); c.strokeStyle = '#b08455'; c.lineWidth = 1.5; for (let a = a0 + 0.1; a < a1; a += 0.22) { const x = cx + Math.cos(a) * nrx, y = ny + Math.sin(a) * nry; c.beginPath(); c.moveTo(x - 5, y - 3); c.lineTo(x + 5, y + 3); c.stroke(); } };
  nest(Math.PI, TAU); drawNestPieces(c, cx, ny, nrx, nry, bs, false, T); drawSnowRim(c, H, ny, nrx, nry); drawKeeps(c, H, cx, ny, nrx, nry, bs);
  // pet animation
  pa.hopY += pa.hopV * dt; pa.hopV -= 900 * dt; if (pa.hopY <= 0) { if (pa.hopV < -60) pa.squash = 0.14; pa.hopY = 0; pa.hopV = 0; }
  pa.squash *= Math.pow(0.002, dt); pa.tilt = (pa.tilt || 0) * Math.pow(0.04, dt); pa.wiggle = Math.max(0, (pa.wiggle || 0) - dt); pa.moodT -= dt; H.chaseT = Math.max(0, (H.chaseT || 0) - dt); H.playT -= dt; H.boxT = Math.max(0, H.boxT - dt);
  const baseMood = p.asleep ? 'sleep' : (p.belly < 22 || p.joy < 22) ? 'sad' : 'idle', mood = pa.moodT > 0 && pa.mood ? pa.mood : baseMood;
  const ptr = H.ptr, look = H.toss ? { x: clamp((H.toss.x - cx) / 120, -1, 1), y: clamp((H.toss.y - (gy - ps * 0.5)) / 120, -1, 1) } : ptr ? { x: clamp((ptr.x - cx) / 120, -1, 1), y: clamp((ptr.y - (gy - ps * 0.5)) / 120, -1, 1) } : { x: Math.sin(T * 0.5) * 0.6, y: Math.sin(T * 0.37) * 0.3 };
  const ents = [], perched = [], lifted = [];
  if (ptr && !H.carry && ptr.hit && ptr.hit.k === 'lit' && ptr.moved < 8 && T - ptr.t0 > HOLD_TIME) startCarry(ptr.hit.id);
  if (H.carry) drawPartyRings(c, H, bs);
  for (const f of H.lits) {
    if (H.carry && H.carry.id === f.l.id && ptr) { f.x = lerp(f.x, ptr.x, Math.min(1, dt * 18)); f.y = lerp(f.y, ptr.y + bs * 0.3, Math.min(1, dt * 18)); f.tx = f.x; f.ty = f.y; f.hop = bs * 0.1; f.moodT = 0.3; lifted.push({ y: f.y, draw: () => drawLittle(c, f, bs * 0.41, 'happy', clamp((cx - f.x) / 100, -1, 1)) }); continue; }
    if (!p.asleep) { lifeWith(f, H, bs, dt); welcomeWith(f, H, bs, dt); playWith(f, H, bs); offerWith(f, H, bs); } else bedWith(f, H, bs); towerWith(f, H, bs, dt);
    f.wt -= dt; if (f.wt <= 0) { f.wt = rnd(2, 6); f.tx = f.hx + rnd(-f.roam, f.roam); f.ty = f.hy + rnd(-f.roam, f.roam) * 0.3; }
    const dx = f.tx - f.x, dy = f.ty - f.y, far = Math.hypot(dx, dy), mv = far > 1.5; f.x += dx * Math.min(1, dt * 1.6); f.y += dy * Math.min(1, dt * 1.6);
    f.hop = far > 30 ? Math.min(40, far * 0.35) : mv && !p.asleep ? Math.abs(Math.sin(T * 9 + f.i)) * 5 : f.hop * 0.8;   // a long way, from a perch to the nest, is a leap
    if (H.boxT > 0 && !p.asleep) f.hop = Math.abs(Math.sin(T * 7 + f.i * 0.8)) * bs * (f.perch < 0 ? 0.09 : 0.05);   // dancing to the music box
    f.moodT = Math.max(0, (f.moodT || 0) - dt); f.squash = (f.squash || 0) * Math.pow(0.002, dt); if (f.trick && (f.trick.t += dt) >= TRICK_TIME) f.trick = null;
    f.eatT = Math.max(0, (f.eatT || 0) - dt);
    const e = { y: f.zy !== undefined ? f.zy : f.y, draw: () => drawLittle(c, f, bs * 0.37, f.eatT > 0 ? 'eat' : p.asleep || f.napT > 0 ? 'sleep' : H.boxT > 0 || f.moodT > 0 ? 'happy' : 'idle', clamp((cx - f.x) / 100, -1, 1)) };
    (f.perch >= 0 && far < 30 ? perched : ents).push(e);
  }
  const pose = petPose(dt);
  ents.push({ y: ny, draw: () => { const tilt = pa.tilt + pose.tilt + (pa.wiggle > 0 ? Math.sin(T * 26) * 0.07 * pa.wiggle : 0); c.save(); if (tilt || pose.sx !== 1) { c.translate(cx, ny); c.rotate(tilt); c.scale(pose.sx, 1); c.translate(-cx, -ny); } drawCreature(c, H.look, cx, ny + ps * 0.02, ps, T, { mood: pose.mood || mood, look, squash: pa.squash + pose.squash, lift: pa.hopY, glow: 0.42 }); c.restore(); } });
  const ee = elderEnt(c, H, dt), he = heirEnt(c, H); if (ee) ents.push(ee); if (he) ents.push(he);
  // toys
  if (S.toys.ball) { const b = H.ball; b.x += b.vx * dt; if (b.x < 0.14) { b.x = 0.14; b.vx = Math.abs(b.vx); } if (b.x > 0.8) { b.x = 0.8; b.vx = -Math.abs(b.vx); } b.spin += b.vx * dt * 14; b.vx *= Math.pow(0.35, dt); b.hopY += b.hopV * dt; b.hopV -= 700 * dt; if (b.hopY <= 0) { b.hopY = 0; b.hopV = b.hopV < -90 ? -b.hopV * 0.5 : 0; } b.px = cx + b.x * rx; b.py = gy + ry * 0.84 * Math.sqrt(1 - b.x * b.x); ents.push({ y: b.py, draw: () => { c.fillStyle = 'rgba(8,4,20,.3)'; c.beginPath(); c.ellipse(b.px, b.py + 1, bs * 0.08, bs * 0.025, 0, 0, TAU); c.fill(); drawBall(c, b.px, b.py - bs * 0.085 - b.hopY, bs * 0.085, b.spin); } }); }
  if (S.toys.musicbox) { H.box = { x: cx - rx * 0.62, y: gy + ry * 0.5 }; ents.push({ y: H.box.y, draw: () => drawMusicBox(c, H.box.x, H.box.y, bs * 0.22, Math.min(1, H.boxT * 2), T) }); }
  ents.sort((a, b) => a.y - b.y);
  let nestDone = false;
  for (const e of ents) { if (!nestDone && e.y > ny) { nest(0, Math.PI); drawNestPieces(c, cx, ny, nrx, nry, bs, true, T); drawPieceStars(c, cx, ny, nrx, nry, bs); drawVase(c, H, cx + Math.cos(VASE_ANG) * nrx, ny + Math.sin(VASE_ANG) * nry + bs * 0.03, bs * 0.2); nestDone = true; } e.draw(); }
  if (!nestDone) { nest(0, Math.PI); drawNestPieces(c, cx, ny, nrx, nry, bs, true, T); drawPieceStars(c, cx, ny, nrx, nry, bs); drawVase(c, H, cx + Math.cos(VASE_ANG) * nrx, ny + Math.sin(VASE_ANG) * nry + bs * 0.03, bs * 0.2); }
  for (const s of H.shrooms) if (Math.sin(s.a) >= 0) shroom(s);
  for (let i = 0; i < 6; i++) if (Math.sin(LANT[i] * D2R) >= 0) lantern(i);
  // wind chimes hang from the front rim
  H.chimePos.length = 0;
  BIOMES.forEach((b, i) => { H.kick[i] = Math.max(0, H.kick[i] - dt * 0.7); if (!owns('decor:chime:' + b.id)) return; const dx = [-0.86, -0.52, -0.3, 0.3, 0.52, 0.86][i], x = cx + dx * rx, y = gy + ry * Math.sqrt(1 - dx * dx) + 2; chimeShape(c, x, y, bs * 0.17, b, Math.sin(T * 1.7 + i * 1.3) * 0.07 + H.kick[i] * Math.sin(T * 13) * 0.3); H.chimePos[i] = { x, y: y + bs * 0.14 }; });
  // perches and the egg cradle float in front of the isle
  H.perches.forEach((P, k) => { if (!P.n) return; const bob = drawPerch(c, P.x, P.y, bs * (P.n > 1 ? 0.36 : 0.24), T, k * 1.7); for (const f of H.lits) if (f.perch === k) f.bob = bob; });
  if (S.eggs.length) drawCradle(c, H, T); else H.eggs = [];
  perched.sort((a, b) => a.y - b.y).forEach(e => e.draw()); drawFriendHearts(c, H, bs); drawCopy(c, H, bs, dt); drawOffer(c, H, bs); drawLittleWish(c, H, bs); drawAdventureAsk(c, H, bs); lifted.forEach(e => e.draw());
  if (H.treat && H.treat.on) { const tr = H.treat, f = litAt(tr); if (f && tr.el !== 'frost') glow(c, f.x, f.y - bs * 0.2, bs * 0.34, EL_HUE[tr.el], 100, 72, 0.5); drawItem(c, { k: 'berry', el: tr.el }, tr.x, tr.y - 18, 64, 0); }
  if (H.boxT > 0 && Math.random() < dt * 3) parts.push({ x: H.box.x + rnd(-8, 8), y: H.box.y - bs * 0.2, vx: rnd(-14, 14), vy: -34, g: 0, life: 0, max: 1.3, kind: 'text', text: '♪', color: hsl(rnd(0, 360), 90, 80), size: 16 });
  for (const f of H.flies) { const x = cx + Math.sin(T * f.sx + f.ax) * rx * 1.05, y = gy - ps * 0.5 + Math.sin(T * f.sy + f.ay) * ps * 0.9; glow(c, x, y, 9, f.h, 100, 75, 0.5 + 0.4 * Math.sin(T * 3 + f.ax)); }
  drawWeather(c, H, dt);
  // wants
  H.bubble = null;
  if (!p.asleep && pa.moodT <= 0) {
    const need = p.belly < 35 ? 'berry' : p.joy < 35 ? 'heart' : p.rest < 25 ? 'zz' : null, wish = need ? null : wishLive(), want = need || (wish ? 'wish' : null);
    if (want) { const bx = cx + ps * 0.62, by = gy - ps * 1.02 + Math.sin(T * 2) * 3; H.bubble = { x: bx, y: by }; if (wish) glow(c, bx, by, 40, 48, 100, 75, 0.25 + 0.12 * Math.sin(T * 3)); c.fillStyle = 'rgba(245,240,255,.95)'; c.beginPath(); c.arc(bx, by, 22, 0, TAU); c.fill(); c.beginPath(); c.arc(bx - 20, by + 22, 6, 0, TAU); c.fill(); c.beginPath(); c.arc(bx - 29, by + 33, 3.5, 0, TAU); c.fill(); if (wish) drawWishIcon(c, wish, bx, by); else if (want === 'berry') drawItem(c, { k: 'berry', el: 'ember' }, bx, by + 2, 62, 0); else if (want === 'heart') { c.fillStyle = '#ff6f9c'; const s = 7; c.beginPath(); c.moveTo(bx, by + s * 1.3); c.bezierCurveTo(bx - s * 2, by, bx - s * 0.8, by - s * 1.5, bx, by - s * 0.4); c.bezierCurveTo(bx + s * 0.8, by - s * 1.5, bx + s * 2, by, bx, by + s * 1.3); c.fill(); } else { c.fillStyle = '#5a6fc0'; c.font = '400 22px "Mystery Quest", fantasy'; c.textAlign = 'center'; c.fillText('zz', bx, by + 7); } }
  }
  drawToss(c, H, dt); drawGesture(c, H);
  // thrown food
  for (let i = H.proj.length - 1; i >= 0; i--) { const f = H.proj[i]; f.t += dt / 0.45; const u = Math.min(1, f.t), m = petMouth(), x = lerp(f.x, m.x, u), y = lerp(f.y, m.y, u) - Math.sin(u * Math.PI) * 70; if (f.el === 'star') drawThing(c, 'star', x, y, 52, T); else drawItem(c, { k: 'berry', el: f.el }, x, y, 70, 0); if (u >= 1) { H.proj.splice(i, 1); eat(f.el); } }
  snapFrame(c, H, dt);
  if (p.asleep) { c.fillStyle = 'rgba(8,5,26,.42)'; c.fillRect(0, 0, VW, VH); H.zT -= dt; if (H.zT <= 0) { H.zT = 0.9; parts.push({ x: cx + ps * 0.35, y: gy - ps * 0.85, vx: 12, vy: -26, g: 0, life: 0, max: 2, kind: 'z', size: 18 }); } }
  drawDream(c, H);
}

/* ---------- littles in the nest: strokes and tricks ---------- */
const TRICK_TIME = 1.4;
const TRICKS = { ember: 'puffs a flame', tide: 'blows a bubble', stone: 'stamps the ground', bloom: 'bursts into flowers', gale: 'loops the loop', glow: 'lights up' };
function drawLittle(c, f, s, mood, lookX) {
  let x = f.x, y = f.y + (f.perch >= 0 ? f.bob || 0 : 0), lift = f.hop || 0; const tr = f.trick, u = tr ? tr.t / TRICK_TIME : 0, k = tr && tr.k;
  if (tr) {
    if (k === 'gale') { const a = u * TAU; x += Math.sin(a) * s * 0.6; lift += (1 - Math.cos(a)) * s * 0.6; }
    else if (k === 'stone') { lift += Math.sin(Math.min(1, u * 2.2) * Math.PI) * s * 0.9; if (u > 0.45 && !tr.boom) { tr.boom = true; f.squash = 0.2; burst(x, y, 14, 30, { v: 110, size: 3.5, up: 20 }); } }
    else lift += Math.sin(Math.min(1, u * 3) * Math.PI) * s * 0.2;
    if (k === 'glow') glow(c, x, y - s * 0.5 - lift, s * 2.2 * Math.sin(u * Math.PI), 50, 100, 75, 0.75);
  }
  drawCreature(c, f.L, x, y, s, T, { lift, mood: tr ? 'happy' : mood, squash: f.squash || 0, look: { x: lookX, y: 0 } });
  if (f.l.muck) drawMuck(c, f, x, y, s, lift);
  if (!tr) return;
  const mx = x + lookX * s * 0.2, my = y - lift - s * 0.42, a = Math.sin(Math.min(1, u * 1.3) * Math.PI);
  if (k === 'ember') flame(c, mx + lookX * s * 0.2, my - s * 0.05, s * 0.2 * a, T, 0);
  else if (k === 'tide') { const r = s * 0.06 + s * 0.3 * Math.min(1, u * 1.4), by = my - s * 0.1 - u * s * 0.8; c.save(); c.globalAlpha = u < 0.85 ? 0.85 : (1 - u) * 5.6; c.fillStyle = 'rgba(160,230,255,.28)'; c.strokeStyle = 'rgba(210,245,255,.9)'; c.lineWidth = 1.5; c.beginPath(); c.arc(mx, by, r, 0, TAU); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(mx - r * 0.35, by - r * 0.35, r * 0.18, 0, TAU); c.fill(); c.restore(); if (u > 0.85 && !tr.pop) { tr.pop = true; burst(mx, by, 10, 195, { v: 70, size: 2.5, g: 0 }); } }
  else if (k === 'bloom' && !tr.pop) { tr.pop = true; burst(x, y - s * 0.6, 16, 110, { kind: 'star', v: 120, size: 5, life: 1 }); burst(x, y - s * 0.6, 10, 330, { kind: 'heart', v: 90, size: 4, life: 1 }); }
}
function litOf(id) { return home.lits.find(f => f.l.id === id); }
function strokeLittle(id) {
  const f = litOf(id), H = home; if (!f) return; f.moodT = 0.9; f.squash = 0.08; if (f.l.muck) rubClean(f);
  parts.push({ x: H.ptr ? H.ptr.x : f.x, y: (H.ptr ? H.ptr.y : f.y - H.baseS * 0.4) - 12, vx: rnd(-16, 16), vy: -55, g: 0, life: 0, max: 0.8, kind: 'heart', h: 340, size: 5 });
  if (H.strokes++ % 4 === 0) sfx('purr');
}
/* Two quick taps: the little shows off the trick of its kind. A twin takes turns with its two. */
function littleTrick(id) {
  const f = litOf(id); if (!f || f.trick) return; const ks = kindsOf(f.l); f.tricks = (f.tricks || 0) + 1;
  const k = ks[(f.tricks - 1) % ks.length]; f.trick = { k, t: 0 }; sfx(k === 'stone' ? 'pick' : 'chirp');
  toast(f.l.name + ' ' + TRICKS[k] + '!', 1800);
}

/* Press and hold a little to pick it up. Put it down on the nest to take it on quests, anywhere else to rest. */
const HOLD_TIME = 0.45;
function partySpot(H, i) { const a = PARTY_ANG[i] * D2R; return { x: H.cx + Math.cos(a) * H.rx * 0.84, y: H.gy + Math.sin(a) * H.ry * 0.86 }; }
function startCarry(id) { const f = litOf(id); if (!f) return; home.carry = { id }; f.trick = null; sfx('pick'); toast('Put ' + f.l.name + ' on the nest to take it along, or on a perch to rest.', 2600); }
function drawPartyRings(c, H, bs) {
  for (let i = 0; i < 3; i++) { const { x, y } = partySpot(H, i), on = i < S.party.length; glow(c, x, y, bs * 0.32, 48, 100, 70, 0.3 + 0.15 * Math.sin(T * 4 + i)); c.strokeStyle = on ? 'rgba(255,207,107,.9)' : 'rgba(255,207,107,.6)'; c.lineWidth = 2; c.setLineDash(on ? [] : [4, 4]); c.beginPath(); c.ellipse(x, y, bs * 0.2, bs * 0.06, 0, 0, TAU); c.stroke(); c.setLineDash([]); }
}
function onNest(H, pt) { const u = (pt.x - H.cx) / (H.rx * 1.02), v = (pt.y - H.gy - H.ry * 0.2) / (H.ry * 2.6); return u * u + v * v < 1; }
function dropLittle(q) {
  const H = home, id = H.carry.id, f = litOf(id), l = petById(id); H.carry = null; if (!f || !l) return;
  const pt = { x: q.x, y: q.y + H.baseS * 0.3 }, inP = S.party.includes(id);
  if (stackOn(f, q)) return;   // dropped on another little: it climbs on top
  if (Math.abs(q.x - H.cx) < H.petS * 0.5 && q.y > H.gy - H.petS * 1.2 && q.y < H.gy) {   // dropped on the Glimmerkin: a cuddle
    setMood('happy', 1.2); H.pa.hopV = 260; f.moodT = 1.2; burst(H.cx, H.gy - H.petS * 0.7, 12, 330, { kind: 'heart', v: 110, size: 5, life: 1 }); sfx('purr'); toast(l.name + ' and ' + S.pet.name + ' have a cuddle.'); layoutHome(); return;
  }
  if (onNest(H, pt)) {
    if (inP) { layoutHome(); return; }
    let msg = l.name + ' joins the party.';
    if (S.party.length >= 3) {   // the party is full: the nearest of the three goes to rest
      let best = 0, bd = 1e9; S.party.forEach((pid, i) => { const s = partySpot(H, i), d = Math.hypot(pt.x - s.x, pt.y - s.y); if (d < bd) { bd = d; best = i; } });
      const out = petById(S.party[best]); S.party[best] = id; msg = l.name + ' joins the party, and ' + (out ? out.name : 'one') + ' rests.';
    } else S.party.push(id);
    sfx('chirp'); burst(pt.x, pt.y - 20, 12, 48, { kind: 'star', v: 120, size: 5 }); toast(msg); layoutHome(); save(); return;
  }
  if (inP) { if (S.party.length <= 1) { toast('Someone has to come along.'); layoutHome(); return; } S.party.splice(S.party.indexOf(id), 1); toast(l.name + ' rests on a perch.'); save(); }
  layoutHome();
}

/* Toys: the party chases the bouncy ball and bumps it on, and everyone sways to the music box. */
function playWith(f, H, bs) {
  if (H.boxT > 0) { f.tx = f.hx + Math.sin(T * 3.5 + f.i) * bs * (f.perch < 0 ? 0.1 : 0.03); f.ty = f.hy; f.wt = 0.3; return; }
  if (!(H.chaseT > 0) || f.perch >= 0 || !S.toys.ball || H.ball.px === undefined) return;
  const b = H.ball, side = f.x < b.px ? -1 : 1; f.tx = b.px + side * bs * 0.16; f.ty = b.py - bs * 0.02; f.wt = 0.3; f.moodT = 0.4;
  if (Math.hypot(f.x - b.px, f.y - b.py) < bs * 0.24 && T - (f.kickAt || 0) > 1.1 && b.hopY <= 0 && H.kicks < 8) {
    f.kickAt = T; H.kicks++; b.vx = -side * rnd(0.35, 0.65); b.hopV = 170; H.chaseT = Math.max(H.chaseT, 1.6); sfx('pick');
  }
}

/* ---------- pet care ---------- */
function setMood(m, t) { home.pa.mood = m; home.pa.moodT = t; }
function gainXp(n) {
  const p = S.pet, before = petLevel(p.xp); p.xp += n; const after = petLevel(p.xp);
  if (after > before) {
    const s0 = stageOf(before), s1 = stageOf(after); if (s1 >= 3 && !p.form) p.form = formFor(p, formVisits()); home.look = petLook(p); layoutHome(); sfx('grow');
    burst(home.cx, home.gy - home.petS * 0.5, 30, 48, { kind: 'star', v: 170, size: 7, life: 1 });
    const grew = s1 >= 3 ? 'a Mythic ' + FORMS[p.form].name + ', with ' + FORMS[p.form].text : 'a ' + STAGES[s1];
    toast(s1 > s0 ? p.name + ' grew into ' + grew + '!' : p.name + ' reached bond level ' + after + '.', s1 >= 3 && s1 > s0 ? 5200 : 3600);
    if (s1 >= 3) checkHeir(true);
    return s1 > s0 ? p.name + ' grew into ' + grew + '.' : p.name + ' reached bond level ' + after + '.';
  }
  return null;
}
function play(joy) { const p = S.pet, H = home; if (p.asleep) return; setMood('happy', 1); if (H.playT <= 0) { H.playT = 25; p.joy = clamp(p.joy + joy, 0, 100); updateHud(); } }
function strokePet() {
  const p = S.pet, H = home; if (p.asleep) return;
  if (p.joy < 100) gainXp(0.12); p.joy = clamp(p.joy + 1.3, 0, 100); setMood('happy', 0.9); H.strokes++;
  parts.push({ x: H.ptr ? H.ptr.x : H.cx, y: (H.ptr ? H.ptr.y : H.gy - H.petS) - 14, vx: rnd(-20, 20), vy: -60, g: 0, life: 0, max: 0.9, kind: 'heart', h: 340, size: 6 });
  const fav = spotStroke(H.ptr ? spotAt(H.ptr) : 'head');
  praiseTrick(); if (H.strokes % 4 === 0) sfx('purr'); touched = true; wishEvent('cuddle'); if (fav) wishEvent('cuddle'); updateHud();   // the favourite spot counts double
}
function strokeEgg(i) {
  const e = S.eggs[i]; if (!e) return; e.warm = (e.warm || 0) + 8; const eg = home.eggs[i];
  if (eg) burst(eg.x, eg.y - 10, 3, e.hue, { v: 50, size: 3 }); if (home.strokes++ % 3 === 0) sfx('pick');
  if (e.warm >= 100) hatch(i);
}
function hatch(i) {
  const e = S.eggs.splice(i, 1)[0], r = RNG(e.seed || 1), all = Object.keys(KINDS), have = new Set(S.littles.map(l => l.kind)), unseen = all.filter(k => !have.has(k));
  const kind = e.kinds ? e.kinds[0] : unseen.length ? r.pick(unseen) : r.pick(all), kind2 = e.kinds ? e.kinds[1] || null : e.twin ? r.pick(all.filter(k => k !== kind)) : null;   // a friends' egg hatches their kinds
  const l = newLittle(kind, r, kind2); S.littles.push(l); if (S.party.length < 3) S.party.push(l.id);
  kindsOf(l).forEach(k => { S.j.kinds[k] = true; }); if (kind2) S.j.twins = (S.j.twins || 0) + 1;
  const eg = home.eggs[i]; if (eg) burst(eg.x, eg.y - 20, e.twin ? 60 : 36, e.hue, { kind: 'star', v: 190, size: 7, life: 1 });
  sfx('grow'); rebuildHome(); gainXp(e.twin ? 12 : 5); save(); updateHud();
  openSheet('<h2>' + (kind2 ? 'A twin hatched' : 'The egg hatched') + '</h2><div class="card"><canvas data-ic="little:' + l.id + '" data-size="84"></canvas><div class="tx"><strong>' + esc(l.name) + '</strong><small>' + esc(kindLabel(l)) + (kind2 ? ' little, with both skills' : ' little') + '</small><small>' + esc(skillLine(l)) + '</small></div></div>' + (e.from ? '<p>Born to friends ' + esc(e.from.join(' and ')) + '.</p>' : '') + '<p class="dim">' + (S.party.includes(l.id) ? esc(l.name) + ' has joined your party.' : 'Your party is full. Swap ' + esc(l.name) + ' in from Littles.') + '</p><div class="btns"><button class="btn main" data-do="ok">Welcome, ' + esc(l.name) + '</button></div>', { ok: closeSheet });
}
function eat(elm) {
  const p = S.pet, m = petMouth();
  if (elm === 'star') {
    p.belly = clamp(p.belly + 25, 0, 100); p.joy = clamp(p.joy + 10, 0, 100); S.j.star = (S.j.star || 0) + 1;
    const left = Object.keys(MARKS).filter(k => !p.marks.includes(k));
    for (let i = 0; i < 6; i++) burst(m.x, m.y - 10, 10, i * 60, { kind: 'star', v: 200, size: 6, life: 1.2 });
    if (left.length) { const k = left[Math.floor(Math.random() * left.length)]; p.marks.push(k); toast(p.name + ' shivers, glows, and now has ' + MARKS[k] + '.', 4600); } else toast(p.name + ' glows from nose to tail.', 3600);
    sfx('grow'); setMood('happy', 1.6); home.pa.hopV = 320; home.look = petLook(p); gainXp(left.length ? 4 : 15);
  } else if (elm === 'frost') {   // a winter berry: no change of colour, and no part in the Mythic form
    p.belly = clamp(p.belly + 15, 0, 100); p.joy = clamp(p.joy + 8, 0, 100); S.j.frost = (S.j.frost || 0) + 1;
    burst(m.x, m.y - 10, 18, 200, { kind: 'star', v: 140, size: 5, life: 1 }); sfx('tinkle'); setMood('happy', 1.2); home.pa.squash = 0.12; gainXp(1);
    toast(p.name + ' shivers happily. Frosty!', 2600);
  } else {
    p.belly = clamp(p.belly + 18, 0, 100); p.joy = clamp(p.joy + 3, 0, 100);
    for (const k in p.diet) p.diet[k] *= 0.88; p.diet[elm] = (p.diet[elm] || 0) + 1; p.ate[elm] = (p.ate[elm] || 0) + 1;
    burst(m.x, m.y, 10, EL_HUE[elm], { v: 80, size: 3.5 }); sfx('chomp'); setMood('eat', 0.7);
    const was = home.look.feats.join(); home.look = petLook(p); gainXp(1); wishEvent('eat', elm);
    if (home.look.feats.join() !== was && home.look.feats.length) toast(p.name + ' is taking on a ' + KINDS[home.look.feats[0]].label + ' glow.');
  }
  save(); updateHud(); if (!ui.tray.hidden) buildTray();
}
function feed(elm, btn) {
  const p = S.pet; if (p.asleep) { toast(p.name + ' is asleep. Wake it first.'); return; }
  if (!(S.pantry[elm] > 0)) return;
  if (p.belly >= 97 && elm !== 'star') { toast(p.name + ' is full.'); sfx('no'); return; }
  S.pantry[elm]--; const a = app.getBoundingClientRect(), b = btn.getBoundingClientRect();
  home.proj.push({ x: b.left - a.left + b.width / 2, y: b.top - a.top, el: elm, t: 0 }); buildTray();
}
function buildTray() {
  const foods = ELS.concat(S.pantry.star > 0 ? ['star'] : [], S.pantry.frost > 0 ? ['frost'] : []), total = foods.reduce((n, k) => n + (S.pantry[k] || 0), 0);
  ui.tray.innerHTML = '<p>' + (total ? 'Tap a berry to feed ' + esc(S.pet.name) + '. What it eats changes its colours.' + (unlocked('treats') ? ' Drag one to a little for a treat.' : '') + ' Flick one upwards for a game of catch.' : 'The pantry is empty. Berries grow in every world you visit.') + '</p><div class="foods">' + foods.map(k => '<button class="food" data-food="' + k + '" aria-label="' + (k === 'star' ? 'Starfruit' : k === 'frost' ? FROST.name : BERRY[k]) + ', ' + (S.pantry[k] || 0) + ' left"' + (S.pantry[k] > 0 ? '' : ' disabled') + '><canvas data-ic="' + (k === 'star' ? 'thing:star' : 'berry:' + k) + '" data-size="30"></canvas>' + (S.pantry[k] || 0) + '</button>').join('') + '</div>';
  paintIcons(ui.tray);
}
ui.tray.addEventListener('click', e => { const b = e.target.closest('[data-food]'); if (Date.now() - (home.treatAt || 0) < 500) return;   // the end of a drag, not a tap
  if (b && !b.disabled) { unlockAudio(); feed(b.dataset.food, b); } });
/* Treats: a berry dragged from the pantry onto a little. Its own kind's berry is its favourite. */
const TREATS_A_DAY = 3;
function litAt(pt) { for (const f of home.lits) if (Math.hypot(pt.x - f.x, pt.y - (f.y - home.baseS * 0.2)) < home.baseS * 0.3) return f; return null; }
ui.tray.addEventListener('pointerdown', e => { const b = e.target.closest('[data-food]'); if (!b || b.disabled || b.dataset.food === 'star') return; const r = cv.getBoundingClientRect(); home.treat = { el: b.dataset.food, btn: b, x0: e.clientX, y0: e.clientY, x: e.clientX - r.left, y: e.clientY - r.top, on: false, id: e.pointerId, hist: [] }; });
document.addEventListener('pointermove', e => { const tr = home.treat; if (!tr || e.pointerId !== tr.id) return; const r = cv.getBoundingClientRect(); tr.x = e.clientX - r.left; tr.y = e.clientY - r.top; tr.hist.push({ x: tr.x, y: tr.y, t: e.timeStamp }); if (tr.hist.length > 6) tr.hist.shift(); if (!tr.on && Math.hypot(e.clientX - tr.x0, e.clientY - tr.y0) > 12) tr.on = true; });
const treatUp = e => {
  const tr = home.treat; if (!tr || e.pointerId !== tr.id) return; home.treat = null; if (!tr.on) return; home.treatAt = Date.now();
  if (e.type !== 'pointerup') return;
  // Let go on a little: a treat, however fast the drag. Otherwise a flick upwards is a game of catch, and a berry let go on the Glimmerkin is eaten.
  const f = unlocked('treats') && tr.el !== 'frost' && litAt(tr); if (f) { giveTreat(f.l.id, tr.el); return; }
  const fl = flickOf(tr, e.timeStamp); if (fl) { tossBerry(tr.el, tr.x, tr.y, fl.vx, fl.vy); return; }
  if (Math.abs(tr.x - home.cx) < home.petS * 0.58 && tr.y > home.gy - home.petS * 1.25 && tr.y < home.gy + home.petS * 0.12) feed(tr.el, tr.btn);
};
document.addEventListener('pointerup', treatUp); document.addEventListener('pointercancel', treatUp);
function giveTreat(id, el) {
  const l = petById(id), f = litOf(id), day = localDay(); if (!l || !(S.pantry[el] > 0)) return;
  if (l.treats && l.treats.day === day && l.treats.n >= TREATS_A_DAY) { toast(l.name + ' has had ' + TREATS_A_DAY + ' treats today. More tomorrow.'); sfx('no'); return; }
  S.pantry[el]--; l.treats = { day, n: (l.treats && l.treats.day === day ? l.treats.n : 0) + 1 };
  const fav = kindsOf(l).includes(el), xp = fav ? 3 : 1, b = littleLevel(l.xp || 0), m0 = maxSparks(l); l.xp = (l.xp || 0) + xp; const a = littleLevel(l.xp);
  if (f) { f.eatT = 0.7; f.moodT = 1.6; f.squash = 0.1; burst(f.x, f.y - home.baseS * 0.25, fav ? 18 : 8, EL_HUE[el], { kind: fav ? 'star' : 'dot', v: 100, size: 4 }); }
  sfx('chomp'); setTimeout(() => sfx('chirp'), 300);
  if (a >= GROWN_AT && b < GROWN_AT && f) { f.L = lookOf(l); burst(f.x, f.y - home.baseS * 0.3, 30, 48, { kind: 'star', v: 170, size: 6, life: 1 }); sfx('grow'); }
  toast(a > b ? l.name + ' reached level ' + a + (maxSparks(l) > m0 ? ' and now carries one more spark.' : '.') + grownLine(l, b, a) : fav ? (/^[AEIOU]/.test(BERRY[el]) ? 'An ' : 'A ') + BERRY[el] + ', ' + l.name + '\'s favourite! It gains ' + xp + ' experience.' : l.name + ' munches the ' + BERRY[el] + ' and gains ' + xp + ' experience.', 3200);
  const m = littleWishEvent('treat', [id], el); if (m) setTimeout(() => toast(m, 3600), 1600);
  save(); if (!ui.tray.hidden) buildTray();
}
/* A small heart floats between friends who sit together. */
function drawFriendHearts(c, H, bs) {
  const L = H.lits; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j]; if (!areFriends(a.l.id, b.l.id) || Math.hypot(a.x - b.x, a.y - b.y) > bs * 0.5) continue;
    const x = (a.x + b.x) / 2, y = Math.min(a.y, b.y) - bs * 0.48 + Math.sin(T * 2 + i) * 2, s = bs * 0.04; c.fillStyle = '#ff8fb3'; c.globalAlpha = 0.9;
    c.beginPath(); c.moveTo(x, y + s * 1.3); c.bezierCurveTo(x - s * 2, y, x - s * 0.8, y - s * 1.5, x, y - s * 0.4); c.bezierCurveTo(x + s * 0.8, y - s * 1.5, x + s * 2, y, x, y + s * 1.3); c.fill(); c.globalAlpha = 1;
  }
}

/* ---------- HUD + bar ---------- */
function updateHud() {
  const p = S.pet, L = petLevel(p.xp), lo = L > 1 ? petNeed(L - 1) : 0, hi = petNeed(L);
  $('#petname').textContent = p.name; $('#stage-tag').textContent = (S.gen > 1 ? 'Gen ' + S.gen + ' · ' : '') + (stageOf(L) >= 3 && p.form ? FORMS[p.form].name : STAGES[stageOf(L)]) + ' · Lv ' + L; $('#wallet').textContent = '✦ ' + S.dust;
  $('#bond b').style.width = clamp((p.xp - lo) / (hi - lo) * 100, 0, 100) + '%';
  for (const m of ['belly', 'joy', 'rest']) { const k = document.querySelector('.meter[data-m="' + m + '"]'), v = Math.round(p[m]); k.querySelector('b').style.width = v + '%'; k.querySelector('em').textContent = v; k.classList.toggle('low', v < 30); }
  $('#sleep-label').textContent = p.asleep ? 'Wake' : 'Sleep'; document.querySelector('[data-act="sleep"]').classList.toggle('on', p.asleep);
  $('#btn-sound').setAttribute('aria-pressed', S.sound ? 'true' : 'false');
}
function setSceneUI() {
  const b = scene === 'bonus', g = scene === 'garden', q = scene === 'quest' || b || g; ui.hudHome.hidden = q; ui.hudQuest.hidden = !q; ui.barHome.hidden = q; ui.barQuest.hidden = !q || b || g; ui.barBonus.hidden = !b; ui.barGarden.hidden = !g; ui.tray.hidden = true;
  parts.length = 0; measure();
}
ui.barHome.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; unlockAudio(); const a = b.dataset.act, p = S.pet;
  if (a === 'feed') { if (ui.tray.hidden) { buildTray(); ui.tray.hidden = false; } else ui.tray.hidden = true; }
  else if (a === 'sleep') { p.asleep = !p.asleep; ui.tray.hidden = true; sfx(p.asleep ? 'purr' : 'chirp'); toast(p.asleep ? p.name + ' curls up. Rest returns fast while it sleeps.' : p.name + ' is awake.'); save(); updateHud(); }
  else if (a === 'littles') { ui.tray.hidden = true; openLittles(); }
  else if (a === 'quest') { ui.tray.hidden = true; openQuestSheet(); }
});
$('#btn-sound').addEventListener('click', () => { S.sound = !S.sound; if (S.sound) { unlockAudio(); setTimeout(() => sfx('chirp'), 60); } save(); updateHud(); });
$('#btn-journal').addEventListener('click', () => { unlockAudio(); ui.tray.hidden = true; openJournal(); });
$('#guest').addEventListener('click', () => { unlockAudio(); ui.tray.hidden = true; openGuest(); });
$('#btn-help').addEventListener('click', () => openSheet('<h2>How it works</h2><ul class="plain"><li><b>Care.</b> Stroke your Glimmerkin with a finger to raise Joy. Its head, cheeks and tummy each feel different, and one of them is its favourite spot each day. Feed it berries for Belly, or flick one up from Feed for it to catch. Let it sleep for Rest.</li><li><b>It changes.</b> What it eats shifts its colours and features, and it grows through four forms as your bond deepens. The berries it eats and the worlds it visits decide which of six Mythic forms it becomes. A starfruit leaves a mark for good.</li><li><b>Quest.</b> Portals lead to worlds that are never the same twice. Find the star shards, wake the far portal, step through. Sparks your littles have not spent shine on as stardust when you go through.</li><li><b>Tricks.</b> Draw a circle, a zigzag, or a swipe up or down on the sky near your Glimmerkin and it tries a trick. Stroke it straight after to praise it. Five praised tries and it knows that trick for good.</li><li><b>Littles.</b> Tap anything in your way and send a little. Each has a skill and a few sparks to spend. Tap loot to send one to fetch it. Each gloom fears one kind of little and scares another: a little who is scared will not go near it. A boss swipes back at the little it eyes, who sits out the next strike. In the nest, press and hold a little to carry it: onto the nest to take it along, onto a perch to rest, onto another little\'s head to build a tower.</li><li><b>World rules.</b> From your third quest on, each world type has a rule of its own, like the tides of Tidehollow. Tap the rule\'s name at the top of a quest to read it.</li><li><b>Together.</b> Some blockers need two littles at once: Ember and Tide make steam, Stone and Bloom uproot, Gale and Glow shatter. A twin with both kinds can do it alone.</li><li><b>Tools.</b> Bridge seeds, moon keys and scare-bells appear as a choice when you tap the thing they work on. Tap a little during a quest to use a spark lantern.</li><li><b>Charms.</b> Open Littles and tap one to give it a charm.</li><li><b>Wishes.</b> A glowing thought bubble shows what your Glimmerkin wishes for. Tap it to see. Granting a wish deepens your bond. One little a day has a small wish of its own too. Littles who finish five quests together become friends.</li><li><b>Mood matters.</b> Joy of 60 or more gives every little an extra spark. Belly of 60 or more lets you Rally once per quest.</li><li><b>The nest.</b> Eggs hatch when rubbed warm. Decorations, toys and chime stones you find appear here. Three map pieces open a rare portal.</li><li><b>The journey.</b> Six regions open one after another, starting in Mossroot, then in an order your Glimmerkin\'s journey has all to itself. In each, three errands in its world type open its heart: find a lost little, gather berries, wake sleeping flowers or carry a keepsake home, in an order all your own. Beat the boss there to open the next region. Each region beaten lets you build a new piece of the nest with stardust. Open it from Where to?</li><li><b>The garden.</b> After seven quests a garden of your own opens in Where to? Plant seeds in its soil and tend each flower with a little of its kind. Flowers grow while you are away, and nothing ever wilts. Two different flowers in bloom side by side cross and make a new seed: there are 21 flowers for the flower book. Lilies, the flowers with Glow in them, open only after dark. A flower you pick stands in the vase on the rim of the nest for a day. The trader sometimes carries a bench, a lantern post, a bird bath or stepping stones to set down in the garden. Six hidden places wait to be found behind brambles, vines, a stone door and more, and the Map shows where to look. A gate at the far end leads on to a new quarter of the garden for each region of the journey, once that region\'s heart is beaten.</li><li><b>Dressing up.</b> After two quests a wardrobe opens, with a knitted scarf to start. Open the journal and press Wardrobe to dress your Glimmerkin, or the elder: one thing on the head, one at the neck and one on the face. The trader sometimes carries more, and each season brings its own: a bobble hat in winter, a sou\'wester in spring, a sun hat and star sunglasses in summer, an acorn cap in autumn. The last December gift holds a paper crown, and a ghost sheet turns up in Halloween week. Dressing up changes nothing else.</li><li><b>Pictures.</b> Open the journal and press Take a picture: everyone poses. Your pictures are kept in the journal, with the pictures littles send from their adventures. To keep one on your phone, press Save to Photos and then Save Image on an iPhone, or Save picture elsewhere, which puts it in Downloads.</li><li><b>The trader.</b> On some days a balloon drifts by. Tap it to spend stardust.</li></ul><p class="dim">' + saveNote() + '</p>' + (canHomescreen() ? '<button class="card" data-do="home" style="margin-top:12px"><canvas data-ic="phone" data-size="44"></canvas><span class="tx"><strong>Add to home screen</strong><small>Open Glimmerkin with one tap, full screen.</small></span></button>' : '') + '<div class="btns"><button class="btn main" data-do="ok">Got it</button><button class="btn" data-do="news">What\'s new</button><button class="btn" data-do="copy">Keep a copy</button></div>', { ok: closeSheet, copy: openExport, news: () => openNews(true), home: openHomescreen }));
$('#petname').addEventListener('click', () => openSheet('<h2>Name your Glimmerkin</h2><form class="field" id="rename-form"><input id="rename-input" maxlength="14" autocomplete="off" aria-label="Name" value="' + esc(S.pet.name) + '"><button class="btn main" style="flex:none;padding:0 18px" type="submit">Save</button></form>', {}, null));
ui.sheet.addEventListener('submit', e => { e.preventDefault(); const v = ($('#rename-input') || {}).value; if (v && v.trim()) { S.pet.name = v.trim().slice(0, 14); save(); updateHud(); } closeSheet(); });

function openLittles() {
  const party = new Set(S.party);
  openSheet('<h2>Your littles</h2><p class="dim">Up to three travel with you. Tap one to change its place or give it a charm.</p>' + (S.burrow && S.burrow.littles.length ? '<p class="dim">' + S.burrow.littles.length + (S.burrow.littles.length > 1 ? ' more live' : ' more lives') + ' in the burrow in the garden.</p>' : '') + '<div class="list">' + S.littles.map(l => { const L = littleLevel(l.xp || 0), mx = maxSparks(l); return '<button class="card" data-do="open" data-id="' + l.id + '"><canvas data-ic="little:' + l.id + '" data-size="60"></canvas><span class="tx"><strong>' + esc(l.name) + '</strong><small>' + esc(kindLabel(l)) + ' · Lv ' + L + (L >= GROWN_AT ? ', grown up' : '') + ' · ' + mx + ' sparks</small><small>' + esc(skillLine(l)) + '</small></span><span class="tag ' + (party.has(l.id) ? 'yes' : '') + '">' + (party.has(l.id) ? 'In party' : 'Resting') + '</span></button>'; }).join('') + '</div>' + (S.eggs.length ? '<p class="dim" style="margin-top:12px">' + S.eggs.length + (S.eggs.length > 1 ? ' eggs wait' : ' egg waits') + ' in the nest. Rub to warm.</p>' : '') + '<div class="btns"><button class="btn" data-do="ok">Done</button><button class="btn main" data-do="copy"' + (S.party.length < 2 ? ' disabled' : '') + '>Play copy me</button></div>' + (S.party.length < 2 ? '<p class="dim" style="margin-top:8px">Copy me needs two littles on the nest.</p>' : ''), { ok: closeSheet, open: d => openLittle(d.id), copy: () => { closeSheet(); startCopy(); } });
}
function openLittle(id) {
  const l = petById(id); if (!l) return; const inP = S.party.includes(id), L = littleLevel(l.xp || 0);
  const pick = (k, label, n) => '<button class="pick ' + ((l.charm || '') === k ? 'in' : '') + '" data-do="charm" data-k="' + k + '"' + (k && !n && l.charm !== k ? ' disabled style="opacity:.35"' : '') + '>' + (k ? '<canvas data-ic="thing:charm:' + k + '" data-size="40"></canvas>' : '<span style="height:40px;display:grid;place-items:center;font-size:20px">–</span>') + label + (k ? ' ×' + n : '') + '</button>';
  const any = Object.keys(CHARMS).some(k => S.charms[k] > 0) || l.charm;
  openSheet('<div class="card"><canvas data-ic="little:' + l.id + '" data-size="84"></canvas><div class="tx"><strong>' + esc(l.name) + '</strong><small>' + esc(kindLabel(l)) + ' · Lv ' + L + (L >= GROWN_AT ? ', grown up' : '') + ' · ' + maxSparks(l) + ' sparks</small><small>' + esc(skillLine(l)) + '</small></div></div>' + (friendsOf(id).length ? '<p class="dim">Friends with ' + esc(friendsOf(id).map(f => f.name).join(' and ')) + '.</p>' : '') + (littleWishLive() && S.lwish.id === id ? '<p class="dim">Wishes for ' + esc(littleWishText(S.lwish)) + '.</p>' : '') + '<h3>Charm</h3>' + (any ? '<div class="party">' + pick('', 'None', 0) + Object.keys(CHARMS).map(k => pick(k, CHARMS[k].name, S.charms[k] || 0)).join('') + '</div>' + (l.charm ? '<p class="dim" style="margin-top:8px">' + esc(CHARMS[l.charm].text) + '</p>' : '') : '<p class="dim">No charms yet. They turn up in far corners of worlds and in the trader\'s basket.</p>') + (S.burrow && burrowRoom() > 0 && S.littles.length > 1 || canGo(l) ? '<div class="btns">' + (S.burrow && burrowRoom() > 0 && S.littles.length > 1 ? '<button class="btn" data-do="burrow">Move to the burrow</button>' : '') + (canGo(l) ? '<button class="btn" data-do="adv">Go on an adventure</button>' : '') + '</div>' : '') + '<div class="btns"><button class="btn" data-do="back">Back</button><button class="btn main" data-do="party">' + (inP ? 'Rest at the nest' : 'Add to party') + '</button></div>', {
    back: openLittles, party: () => { toggleParty(id); openLittle(id); }, burrow: () => sendToBurrow(id), adv: () => openLetGo(id),
    charm: d => { const k = d.k || null; if (l.charm === k) return; if (k && !(S.charms[k] > 0)) return; if (l.charm) S.charms[l.charm] = (S.charms[l.charm] || 0) + 1; if (k) S.charms[k]--; l.charm = k; if (!k) delete l.charm; sfx('pick'); save(); openLittle(id); }
  });
}
function toggleParty(id) {
  const i = S.party.indexOf(id);
  if (i >= 0) { if (S.party.length <= 1) { toast('Someone has to come along.'); return; } S.party.splice(i, 1); }
  else { if (S.party.length >= 3) { toast('Three at most. Rest one first.'); return; } S.party.push(id); }
  layoutHome(); save();
}
function rollPortals(force) {
  const now = Date.now(); if (!force && S.portals && S.portals.list && S.portals.list.length === 3 && now - S.portals.at < 3 * 3600e3) return;
  const r = RNG((now % 2147483647) | 0), bs = r.shuffle(BIOMES.slice()).slice(0, 3), ww = wishLive(), sizes = r.shuffle(S.quests < 1 ? ['nook', 'nook', 'vale'] : S.quests < 4 ? ['nook', 'vale', 'realm'] : ['vale', 'realm', 'realm']);
  const rb = unlocked('journey') ? regionBiome(S.reg.i) : null; if (rb && !bs.includes(rb)) bs[1] = rb;   // the journey's region is always on offer
  if (ww && ww.k === 'visit' && !bs.some(b => b.id === ww.a)) bs[2] = BIOMES.find(b => b.id === ww.a) || bs[2];   // a wished-for world stays on offer
  const lw = littleWishLive(), keep = [rb && rb.id, ww && ww.k === 'visit' && ww.a], free = [0, 1, 2].find(i => !keep.includes(bs[i].id));
  if (lw && lw.k === 'visit' && !bs.some(b => b.id === lw.a) && free !== undefined) bs[free] = BIOMES.find(b => b.id === lw.a) || bs[free];   // so is a little's
  S.portals = { at: now, list: bs.map((b, i) => ({ seed: r.int(1, 2147483646), biome: b.id, size: sizes[i], name: worldName(r, b) })), rare: { seed: r.int(1, 2147483646), biome: r.pick(BIOMES).id, size: 'realm', rare: true, name: 'The ' + r.pick(['Hollow', 'Garden', 'Stair', 'Harbour']) + ' Behind the Stars' }, boss: regionPortal(r) };
}
/* Which pair skills the party can use, so choosing three littles is a real choice. */
function togetherLine() {
  const ls = partyLittles(), kinds = new Set(); ls.forEach(l => kindsOf(l).forEach(k => kinds.add(k)));
  const can = PAIR_OBS.filter(o => PAIRS[o].pair.every(k => kinds.has(k)));
  if (can.length) return 'Together they can ' + can.map(o => PAIRS[o].skill.toLowerCase() + ' (' + PAIRS[o].pair.map(k => KINDS[k].label).join(' and ') + ')').join(', ') + '.';
  return 'No two of them work together. Ember and Tide make steam, Stone and Bloom uproot, Gale and Glow shatter.';
}
function openQuestSheet() {
  const p = S.pet; rollPortals(); partyLittles(); const rb = regionBiome(S.reg.i); if (!S.portals.rare || (rb && (!S.portals.boss || S.portals.boss.biome !== rb.id))) rollPortals(true);
  if (p.asleep) { toast(p.name + ' is asleep. Wake it first.'); return; }
  const tired = p.rest < 25, party = new Set(S.party), rare = S.maps >= 3;
  const card = (o, i) => { const B = BIOMES.find(b => b.id === o.biome), Z = SIZES[o.size], er = journeyErrand(o); return '<button class="card' + (tired ? ' off' : '') + '" data-do="go" data-i="' + i + '"' + (tired ? ' disabled' : '') + (o.rare ? ' style="border-color:var(--lantern);background:rgba(255,207,107,.1)"' : '') + '><canvas data-ic="' + (o.rare ? 'thing:map' : 'biome:' + B.id) + '" data-size="60"></canvas><span class="tx"><strong>' + esc(o.name) + '</strong><small>' + (o.region ? 'Journey · ' + B.name + ' · a boss gloom guards the way out' : o.rare ? 'Rare portal · ' + B.name + ' · a boss gloom guards the way out' : B.name + ' · ' + Z.label + ' · ' + (er ? 'a journey errand' : Z.need + ' star shards wake the way out')) + '</small><small>' + (o.region ? 'Beat it to open the next region of the journey.' : o.rare ? 'Uses your three map pieces. A twin egg waits inside' + (eggRoom() <= 0 ? ', but ' + fullLine().replace(/^The/, 'the') + ', so it will turn into stardust.' : nestRoom() <= 0 ? '. The nest is full, so it will go to the burrow.' : '.') : er ? 'Errand: ' + errandTitle(er) + '.' : BERRY[B.el] + ' grows here' + (rb && rb.id === B.id ? ' · counts towards the journey' : '')) + '</small></span><span class="tag cost">Go</span></button>'; };
  openSheet('<h2>Where to?</h2><p class="dim">Portals drift to new worlds every few hours, and after every quest.</p><h3>Party</h3><div class="party">' + S.littles.map(l => '<button class="pick ' + (party.has(l.id) ? 'in' : '') + '" data-do="toggle" data-id="' + l.id + '" aria-pressed="' + party.has(l.id) + '"><canvas data-ic="little:' + l.id + '" data-size="44"></canvas>' + esc(l.name) + '</button>').join('') + '</div><p class="dim" style="margin-top:10px">' + (p.joy >= 60 ? 'Joy is high: every little starts with an extra spark.' : 'Joy is under 60, so no extra spark. A good stroke fixes that.') + ' ' + (p.belly >= 60 ? 'Belly is full enough to Rally once.' : 'Belly is under 60, so no Rally.') + '</p>' + (unlocked('together') ? '<p class="dim" style="margin-top:6px">' + togetherLine() + '</p>' : '') + '<h3>Portals</h3>' + (unlocked('journey') ? '<button class="card" data-do="journey"><canvas data-ic="thing:map" data-size="44"></canvas><span class="tx"><strong>The journey</strong><small>' + esc(journeyLine()) + '</small></span><span class="tag">Open</span></button>' : '') + (tired ? '<p>' + esc(p.name) + ' is too tired to travel. A short sleep will do it.</p>' : '') + (unlocked('garden') ? '<div style="height:8px"></div>' + gardenCard() : '') + '<div class="list">' + (unlocked('today') ? todayCard() : '') + (heartOpen() && S.portals.boss ? card(S.portals.boss, 'boss') : '') + (rare ? card(S.portals.rare, 'rare') : '') + S.portals.list.map(card).join('') + '</div>' + (!rare && S.maps > 0 ? '<p class="dim" style="margin-top:12px">Map pieces: ' + S.maps + ' of 3. A full map reveals a rare portal.</p>' : ''), { toggle: d => { toggleParty(d.id); openQuestSheet(); }, journey: () => openJourney(openQuestSheet), garden: enterGarden, go: d => { closeSheet(); if (d.i === 'today' && (todayDone() || !unlocked('today'))) return; startQuest(d.i === 'today' ? todayPortal() : d.i === 'rare' ? S.portals.rare : d.i === 'boss' ? S.portals.boss : S.portals.list[+d.i]); } });
}

/* ---------- home input ---------- */
function homeHit(pt) {
  const H = home, near = (o, r) => o && Math.hypot(pt.x - o.x, pt.y - o.y) < r;
  for (const eg of H.eggs) if (Math.hypot(pt.x - eg.x, pt.y - eg.y) < Math.max(22, H.baseS * 0.14)) return { k: 'egg', i: eg.i };
  if (S.heir && near({ x: H.heirPos && H.heirPos.x, y: H.heirPos && H.heirPos.y - H.baseS * 0.13 }, Math.max(24, H.baseS * 0.16))) return { k: 'heir' };
  if (S.toys.ball && near({ x: H.ball.px, y: H.ball.py - H.baseS * 0.08 }, 26)) return { k: 'ball' };
  if (S.toys.musicbox && near({ x: H.box && H.box.x, y: H.box && H.box.y - H.baseS * 0.08 }, 28)) return { k: 'box' };
  if (near(H.gift, Math.max(24, H.baseS * 0.2))) return { k: 'gift' };
  if (near(H.bubble, 30)) return { k: 'wish' };
  const ab = adventureHit(pt); if (ab) return { k: 'adv', id: ab };
  if (near(H.lbubble, 22)) return { k: 'lwish' };
  const of = S.offer && litOf(S.offer.id); if (of && Math.hypot(pt.x - of.x, pt.y - (of.y - H.baseS * 0.25)) < H.baseS * 0.3) return { k: 'lit', id: of.l.id };   // the little holding up a keepsake
  if (near(H.vasePos, 22)) return { k: 'vase' };
  if (elderAt(H, pt) && !(Math.abs(pt.x - H.cx) < H.petS * 0.4)) return { k: 'elder' };
  if (Math.abs(pt.x - H.cx) < H.petS * 0.58 && pt.y > H.gy - H.petS * 1.25 && pt.y < H.gy + H.petS * 0.12) return { k: 'pet' };
  if (H.balloon && Math.abs(pt.x - H.balloon.x) < H.balloon.s * 0.7 && Math.abs(pt.y - H.balloon.y - H.balloon.s * 0.1) < H.balloon.s * 0.95) return { k: 'trader' };
  for (let i = 0; i < 8; i++) if (near(H.stonePos[i], 30)) return { k: 'stone', i };   // a moving target: a little more room
  for (let i = 0; i < 6; i++) if (near(H.chimePos[i], 22)) return { k: 'chime', i };   // before the littles: perched littles sit between the chimes
  for (const f of H.lits) if (Math.hypot(pt.x - f.x, pt.y - (f.y - H.baseS * 0.2)) < H.baseS * 0.26) return { k: 'lit', id: f.l.id };
  if (H.keepPos) for (let i = 0; i < H.keepPos.length; i++) if (near(H.keepPos[i], 16)) return { k: 'keep', i };   // behind the littles
  return null;
}
function homeDown(pt) { const H = home; H.idleAt = T; H.ptr = { x: pt.x, y: pt.y, moved: 0, hit: homeHit(pt), t0: T, path: [{ x: pt.x, y: pt.y }] }; H.rubAcc = 0; H.carry = null; }
function homeMove(pt) {
  const H = home, q = H.ptr; if (!q) return; const d = Math.hypot(pt.x - q.x, pt.y - q.y); q.moved += d; q.x = pt.x; q.y = pt.y; if (!q.hit && q.path.length < 400) q.path.push({ x: pt.x, y: pt.y });
  if (H.carry || !q.hit || !['pet', 'egg', 'lit', 'heir', 'elder'].includes(q.hit.k)) return; H.rubAcc += d;
  while (H.rubAcc > 34) { H.rubAcc -= 34; if (q.hit.k === 'pet') strokePet(); else if (q.hit.k === 'lit') strokeLittle(q.hit.id); else if (q.hit.k === 'heir') strokeHeir(); else if (q.hit.k === 'elder') strokeElder(); else strokeEgg(q.hit.i); }
}
function homeUp() {
  const H = home, q = H.ptr; H.ptr = null; if (!q) return;
  if (H.carry) { dropLittle(q); return; }
  if (q.moved > 12) { if (q.hit && touched) save(); else if (!q.hit) gestureDone(q.path); return; }
  if (!q.hit) { ui.tray.hidden = true; return; }
  const p = S.pet, k = q.hit.k;
  if (k === 'pet') { if (p.asleep) { p.asleep = false; toast(p.name + ' is awake.'); save(); updateHud(); } H.pa.hopV = 300; setMood('happy', 0.7); sfx('chirp'); }
  else if (k === 'egg') { toast('Rub the egg to warm it.'); strokeEgg(q.hit.i); }
  else if (k === 'heir') { if (S.heir.warm >= 100) askHatch(); else { toast('Rub the starlit egg to warm it.'); strokeHeir(); } }
  else if (k === 'elder') elderTap();
  else if (k === 'lit' && H.copy) copyTap(q.hit.id);
  else if (k === 'lit' && p.asleep) snuggle(q.hit.id);
  else if (k === 'keep') keepStory(q.hit.i);
  else if (k === 'vase') openVase();
  else if (k === 'lit' && S.offer && S.offer.id === q.hit.id) acceptKeep();
  else if (k === 'lit' && H.tower && H.tower.ids.includes(q.hit.id)) topple();
  else if (k === 'lit') { const l = petById(q.hit.id), tap = H.litTap; H.litTap = { id: q.hit.id, t: T }; if (!l) return; if (tap && tap.id === l.id && T - tap.t < 0.45) { H.litTap = null; littleTrick(l.id); } else { sfx('pick'); toast(l.name + ', ' + kindLabel(l).toLowerCase() + '. ' + kindsOf(l).map(z => KINDS[z].does).join('. ') + '. Tap twice for a trick.', 3400); } }
  else if (k === 'ball') { const b = H.ball; b.vx = (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 0.9); b.hopV = 230; H.chaseT = 3; H.kicks = 0; sfx('pick'); play(2); wishEvent('play', 'ball'); }
  else if (k === 'box') { H.boxT = 4.2; sfx('box'); play(3); wishEvent('play', 'musicbox'); }
  else if (k === 'stone') { H.stoneLit[q.hit.i] = 1; sfx('note', CHIME_NOTES[q.hit.i]); toast('Chime stone ' + (q.hit.i + 1) + ' of 8. ' + (S.chimes < 2 ? 'Find one more and the nest starts to play a tune.' : 'Each one adds a note to the tune the nest plays.'), 3200); }
  else if (k === 'chime') { H.kick[q.hit.i] = 1; sfx('tinkle'); }
  else if (k === 'trader') { sfx('chirp'); openShop(); }
  else if (k === 'wish') { sfx('chirp'); openWish(); }
  else if (k === 'lwish') { sfx('chirp'); openLittleWish(); }
  else if (k === 'adv') { sfx('chirp'); openLetGo(q.hit.id); }
  else if (k === 'gift') openGift();
}
