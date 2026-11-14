/* ===== Adventures: a grown-up little sets off to see the world, and sends pictures home ===== */
/* Only a little that is all grown up (GROWN_AT) can go, and only by the player's choice, from its own sheet. When the
   nest is full (and the burrow, once dug), one grown-up little a day asks, with a bubble on the nest saying "I'm going
   on an adventure!". Letting it go shows it setting off down a winding path and gives a parting gift. It is then kept
   in S.away (how it looked, when it left, its gift and its pictures), not in S.littles. Every PIC_GAP it sends a
   picture of itself, up to AWAY_PICS: a selfie drawn from a seed, in one of PLACES at one of four times of day, with
   a made-up name and now and then a garden visitor in it too. A picture is a seed and a time, a few bytes. */
const PIC_GAP = 10 * 86400000, AWAY_PICS = 10;
const PARTING = [['tool:key', 2], ['tool:seed', 2], ['tool:lantern', 2]];
const PLACES = [
  { id: 'peak', nouns: ['Peaks', 'Summit', 'Heights'] }, { id: 'beach', nouns: ['Shore', 'Sands', 'Bay'] },
  { id: 'falls', nouns: ['Falls', 'Cascade'] }, { id: 'mush', nouns: ['Toadstool Wood', 'Mushroom Glade'] },
  { id: 'dunes', nouns: ['Dunes', 'Moonsands'] }, { id: 'balloon', nouns: ['Skies', 'Clouds'] },
  { id: 'castle', nouns: ['Cloud Castle', 'Sky Keep'] }, { id: 'ice', nouns: ['Icefields', 'Glacier'] }
];
const PIC_TIMES = { dawn: ['#f7b7a3', '#ffe6c2'], day: ['#7cc3ff', '#d8f0ff'], dusk: ['#5a3c8a', '#ff9a76'], night: ['#0d0a2a', '#2b2560'] };
const awayLook = a => { const L = lookFor(a.kind, a.seed, a.kind2); L.grown = true; return L; };
const canGo = l => littleLevel(l.xp || 0) >= GROWN_AT && S.littles.length > 1;

/* ---------- pictures ---------- */
function picScene(seed) {
  const r = RNG(seed), P = r.pick(PLACES), time = r.pick(Object.keys(PIC_TIMES)), name = 'the ' + r.pick(ADJ) + ' ' + r.pick(P.nouns);
  return { seed, place: P.id, time, name, side: r.chance(0.5) ? 1 : -1, tilt: (r.f() - 0.5) * 0.12, friend: r.chance(0.45) ? r.int(0, VISITORS.length - 1) : -1 };
}
function picSky(c, w, h, a, b) { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, w, h); }
function picStars(c, r, n, w, h, a) { for (let i = 0; i < n; i++) { c.fillStyle = 'rgba(255,250,235,' + (a * (0.3 + r.f() * 0.7)) + ')'; c.beginPath(); c.arc(r.f() * w, r.f() * h, r.f() * 1.2 + 0.3, 0, TAU); c.fill(); } }
function picHills(c, w, y, amp, col, r, k) { const ph = r.f() * 6; c.fillStyle = col; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= w; x += 4) c.lineTo(x, y - amp * (0.5 + 0.5 * Math.sin(x / w * Math.PI * k + ph))); c.lineTo(w, y + 9999); c.lineTo(0, y + 9999); c.closePath(); c.fill(); }
function drawPlace(c, w, h, sc) {
  const r = RNG(sc.seed * 7 + 1), tm = PIC_TIMES[sc.time], night = sc.time === 'night', dim = night ? 0.45 : sc.time === 'dusk' ? 0.75 : 1;
  const sh = (hh, s, l) => hsl(hh, s, Math.round(l * dim));
  picSky(c, w, h, tm[0], tm[1]); if (night || sc.time === 'dusk') picStars(c, r, night ? 50 : 14, w, h * 0.6, night ? 1 : 0.6);
  const sx = w * (0.2 + r.f() * 0.6), sy = h * (0.14 + r.f() * 0.14);
  if (night) { glow(c, sx, sy, h * 0.25, 48, 100, 80, 0.35); c.fillStyle = '#fff3c8'; c.beginPath(); c.arc(sx, sy, h * 0.07, 0, TAU); c.fill(); c.fillStyle = tm[0]; c.beginPath(); c.arc(sx + h * 0.03, sy - h * 0.02, h * 0.06, 0, TAU); c.fill(); }
  else { glow(c, sx, sy, h * 0.3, 44, 100, 75, 0.5); c.fillStyle = sc.time === 'day' ? '#fff7d0' : '#ffe2a0'; c.beginPath(); c.arc(sx, sy, h * 0.075, 0, TAU); c.fill(); }
  const cloud = (cx, cy, n, rr, a) => { c.fillStyle = 'rgba(255,255,255,' + a + ')'; for (let j = 0; j < n; j++) { c.beginPath(); c.arc(cx + j * rr * 1.1 - n * rr * 0.5, cy + Math.sin(j * 2) * rr * 0.3, rr * (0.9 + r.f() * 0.5), 0, TAU); c.fill(); } };
  if (sc.place === 'peak') {
    for (const [base, amp, l] of [[0.62, 0.38, 62], [0.78, 0.3, 48]]) { c.fillStyle = sh(235, 22, l); c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * base); let x = 0; while (x < w) { const pw = w * (0.18 + r.f() * 0.2), ph = h * amp * (0.5 + r.f() * 0.5); c.lineTo(x + pw / 2, h * base - ph); c.lineTo(x + pw, h * base); x += pw; } c.lineTo(w, h); c.closePath(); c.fill(); }
    const px = w * 0.62, py = h * 0.22; c.fillStyle = sh(220, 20, 40); c.beginPath(); c.moveTo(px - w * 0.3, h); c.lineTo(px, py); c.lineTo(px + w * 0.32, h); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.moveTo(px, py); c.lineTo(px - w * 0.06, py + h * 0.12); c.lineTo(px - w * 0.02, py + h * 0.1); c.lineTo(px + w * 0.01, py + h * 0.13); c.lineTo(px + w * 0.065, py + h * 0.12); c.closePath(); c.fill();
    c.strokeStyle = '#3a2a30'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - h * 0.1); c.stroke(); c.fillStyle = '#ff6b8a'; c.beginPath(); c.moveTo(px, py - h * 0.1); c.lineTo(px + w * 0.06, py - h * 0.08); c.lineTo(px, py - h * 0.06); c.fill();
    for (let i = 0; i < 4; i++) cloud(r.f() * w, h * (0.6 + r.f() * 0.15), 4, h * 0.05, 0.8);
    c.fillStyle = sh(210, 15, 85); c.fillRect(0, h * 0.86, w, h);
  } else if (sc.place === 'beach') {
    c.fillStyle = sh(200, 70, 45); c.fillRect(0, h * 0.55, w, h); c.fillStyle = 'rgba(255,240,200,.5)'; for (let i = 0; i < 8; i++) c.fillRect(sx - w * 0.1 + r.f() * w * 0.2 - i * 3, h * (0.57 + i * 0.03), w * 0.13 - i * 3, 2);
    c.fillStyle = sh(42, 70, 78); c.beginPath(); c.moveTo(0, h * 0.78); c.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.8); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    const lx = w * (sc.side > 0 ? 0.18 : 0.82), ly = h * 0.56; c.fillStyle = '#fff'; c.strokeStyle = '#2a1830'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(lx - w * 0.026, ly); c.lineTo(lx - w * 0.016, ly - h * 0.26); c.lineTo(lx + w * 0.016, ly - h * 0.26); c.lineTo(lx + w * 0.026, ly); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e8506a'; for (let i = 0; i < 3; i++) c.fillRect(lx - w * 0.022, ly - h * (0.06 + i * 0.07), w * 0.044, h * 0.035); c.fillStyle = '#ffe08a'; c.fillRect(lx - w * 0.016, ly - h * 0.3, w * 0.032, h * 0.04); glow(c, lx, ly - h * 0.28, h * 0.12, 48, 100, 70, 0.5);
    const tx = w * (sc.side > 0 ? 0.08 : 0.92); c.strokeStyle = '#7a5230'; c.lineWidth = w * 0.016; c.beginPath(); c.moveTo(tx, h); c.quadraticCurveTo(tx + w * 0.03 * sc.side, h * 0.7, tx + w * 0.013 * sc.side, h * 0.42); c.stroke();
    c.fillStyle = sh(130, 50, 38); for (let i = 0; i < 6; i++) { c.save(); c.translate(tx + w * 0.013 * sc.side, h * 0.42); c.rotate(i / 6 * TAU); c.beginPath(); c.ellipse(w * 0.06, 0, w * 0.065, h * 0.017, 0, 0, TAU); c.fill(); c.restore(); }
  } else if (sc.place === 'falls') {
    c.fillStyle = sh(140, 35, 30); c.fillRect(0, h * 0.3, w * 0.36, h); c.fillRect(w * 0.64, h * 0.26, w, h);
    const fg = c.createLinearGradient(0, h * 0.28, 0, h); fg.addColorStop(0, '#d6f2ff'); fg.addColorStop(1, '#7ec8f0'); c.fillStyle = fg; c.fillRect(w * 0.36, h * 0.28, w * 0.28, h);
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; for (let i = 0; i < 12; i++) { const x = w * 0.37 + r.f() * w * 0.26; c.beginPath(); c.moveTo(x, h * 0.3 + r.f() * h * 0.2); c.lineTo(x, h * 0.5 + r.f() * h * 0.4); c.stroke(); }
    if (!night) { c.lineWidth = Math.max(2, w * 0.012); ['#ff6b6b', '#ffb36b', '#ffe56b', '#7be07b', '#6bb8ff', '#b07bff'].forEach((col, i) => { c.strokeStyle = col; c.globalAlpha = 0.55; c.beginPath(); c.arc(w * 0.5, h * 0.95, w * 0.32 - i * c.lineWidth, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }); c.globalAlpha = 1; }
    for (let i = 0; i < 3; i++) cloud(w * (0.4 + i * 0.1), h * 0.95, 3, h * 0.05, 0.75);
  } else if (sc.place === 'mush') {
    c.fillStyle = sh(150, 30, 22); c.fillRect(0, h * 0.8, w, h);
    for (let i = 0; i < 5; i++) { const x = r.f() * w, sw = w * (0.12 + r.f() * 0.16), top = h * (0.25 + r.f() * 0.35), hue = r.pick([330, 280, 20, 190]); c.fillStyle = sh(40, 30, 85); c.fillRect(x - sw * 0.14, top, sw * 0.28, h - top); glow(c, x, top, sw * 0.9, hue, 90, 65, night ? 0.6 : 0.25); c.fillStyle = hsl(hue, 70, night ? 62 : 58); c.beginPath(); c.ellipse(x, top, sw * 0.6, sw * 0.38, 0, Math.PI, 0); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(x - sw * 0.4 + j * sw * 0.26, top - sw * (0.12 + 0.1 * (j % 2)), sw * 0.05, 0, TAU); c.fill(); } }
    c.fillStyle = 'rgba(255,240,140,.9)'; for (let i = 0; i < 16; i++) { const x = r.f() * w, y = r.f() * h * 0.8; glow(c, x, y, h * 0.03, 52, 100, 70, 0.6); c.beginPath(); c.arc(x, y, 1.4, 0, TAU); c.fill(); }
  } else if (sc.place === 'dunes') {
    for (const [y, l] of [[0.6, 70], [0.72, 62], [0.86, 55]]) { c.fillStyle = sh(36, 60, l); c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * y); for (let x = 0; x <= w; x += 6) c.lineTo(x, h * y - Math.sin(x / w * 5 + y * 9) * h * 0.04); c.lineTo(w, h); c.fill(); }
    const kx = w * (sc.side > 0 ? 0.15 : 0.85), ky = h * 0.74, u = w * 0.01; c.fillStyle = sh(120, 40, 38); rrect(c, kx - 2 * u, ky - h * 0.22, 4 * u, h * 0.24, 2 * u); c.fill(); rrect(c, kx - 6.5 * u, ky - h * 0.16, 3 * u, h * 0.1, 1.5 * u); c.fill(); rrect(c, kx - 6.5 * u, ky - h * 0.08, 6 * u, 2.5 * u, 1.2 * u); c.fill(); c.fillStyle = '#ff7ab0'; c.beginPath(); c.arc(kx, ky - h * 0.225, 1.5 * u, 0, TAU); c.fill();
  } else if (sc.place === 'balloon') {
    for (let i = 0; i < 7; i++) cloud(r.f() * w, h * (0.55 + r.f() * 0.4), 5, h * 0.06, night ? 0.35 : 0.9);
    const bx = w * (sc.side > 0 ? 0.82 : 0.18), by = h * 0.3, u = h * 0.01; ['#ff8fb3', '#ffd36b', '#8fc8ff'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.ellipse(bx, by, (7 - i * 2.2) * u, 8 * u, 0, 0, TAU); c.fill(); });
    c.strokeStyle = '#3a2a30'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx - 4.5 * u, by + 6 * u); c.lineTo(bx - 2 * u, by + 12 * u); c.moveTo(bx + 4.5 * u, by + 6 * u); c.lineTo(bx + 2 * u, by + 12 * u); c.stroke(); c.fillStyle = '#9a6a3a'; c.fillRect(bx - 2.2 * u, by + 12 * u, 4.4 * u, 3 * u);
    c.fillStyle = '#b5743a'; c.fillRect(0, h * 0.9, w, h); c.strokeStyle = '#7a4a22'; c.lineWidth = 2; for (let x = 0; x < w; x += w * 0.03) { c.beginPath(); c.moveTo(x, h * 0.9); c.lineTo(x + w * 0.015, h); c.stroke(); } c.fillStyle = '#7a4a22'; c.fillRect(0, h * 0.9, w, h * 0.015);
  } else if (sc.place === 'castle') {
    cloud(w * 0.55, h * 0.6, 9, h * 0.07, night ? 0.4 : 0.92);
    const cx = w * 0.55, cy = h * 0.58; c.strokeStyle = '#3a2a50'; c.lineWidth = 1.2;
    for (const [dx, tw, th] of [[-0.16, 0.08, 0.3], [0, 0.12, 0.42], [0.16, 0.08, 0.3]]) { c.fillStyle = sh(285, 40, 86); c.fillRect(cx + (dx - tw / 2) * w, cy - th * h, tw * w, th * h); c.strokeRect(cx + (dx - tw / 2) * w, cy - th * h, tw * w, th * h); c.fillStyle = sh(330, 60, 70); c.beginPath(); c.moveTo(cx + (dx - tw / 2 - 0.01) * w, cy - th * h); c.lineTo(cx + dx * w, cy - th * h - h * 0.1); c.lineTo(cx + (dx + tw / 2 + 0.01) * w, cy - th * h); c.fill(); c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(cx + dx * w, cy - th * h * 0.6, h * 0.01, 0, TAU); c.fill(); }
    for (let i = 0; i < 6; i++) cloud(r.f() * w, h * (0.88 + r.f() * 0.08), 3, h * 0.1, night ? 0.45 : 0.95);
  } else {
    if (night || sc.time === 'dusk') for (let i = 0; i < 3; i++) { const g = c.createLinearGradient(0, h * 0.1, 0, h * 0.5); g.addColorStop(0, 'rgba(120,255,190,0)'); g.addColorStop(0.5, 'rgba(120,255,190,' + (0.35 - i * 0.08) + ')'); g.addColorStop(1, 'rgba(120,160,255,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, h * (0.2 + i * 0.05)); for (let x = 0; x <= w; x += 8) c.lineTo(x, h * (0.2 + i * 0.05) + Math.sin(x / (w * 0.1) + i) * h * 0.03); c.lineTo(w, h * 0.55); c.lineTo(0, h * 0.55); c.fill(); }
    c.fillStyle = sh(205, 60, 40); c.fillRect(0, h * 0.62, w, h);
    for (let i = 0; i < 4; i++) { const x = r.f() * w, bw = w * (0.1 + r.f() * 0.14), bh = h * (0.08 + r.f() * 0.14); c.fillStyle = sh(195, 60, 88); c.beginPath(); c.moveTo(x - bw, h * 0.63); c.lineTo(x - bw * 0.4, h * 0.63 - bh); c.lineTo(x + bw * 0.3, h * 0.63 - bh * 0.8); c.lineTo(x + bw, h * 0.63); c.fill(); }
    c.fillStyle = sh(200, 40, 94); c.beginPath(); c.moveTo(0, h * 0.82); c.quadraticCurveTo(w * 0.5, h * 0.76, w, h * 0.84); c.lineTo(w, h); c.lineTo(0, h); c.fill();
  }
  if (night) { c.fillStyle = 'rgba(10,8,40,.18)'; c.fillRect(0, 0, w, h); }
}
function picArm(c, L, x0, y0, x1, y1, s) {
  const h0 = L.hue, sat = L.sat || 70; c.save(); c.lineCap = 'round';
  c.strokeStyle = hsl(h0 + 30, 42, 18); c.lineWidth = s * 0.24; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = hsl(h0, sat, 62); c.lineWidth = s * 0.24 - Math.max(2.4, s * 0.05); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.restore();
}
/* A selfie: the place behind, a visitor now and then, and the little up close with one arm out to the camera. */
function drawSelfie(c, w, h, a, seed) {
  const sc = picScene(seed); c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  c.translate(w / 2, h / 2); c.rotate(sc.tilt); c.scale(1.08, 1.08); c.translate(-w / 2, -h / 2);
  drawPlace(c, w, h, sc);
  if (sc.friend >= 0) drawVisitor(c, VISITORS[sc.friend], w * (0.5 + sc.side * 0.3), h * 0.66, h * 0.18, 0.5, sc.time === 'night', true);
  const L = awayLook(a), side = sc.side, s = h * 0.6, x = w * (0.5 - side * 0.14), y = h * 1.06;
  picArm(c, L, x + side * s * 0.3, y - s * 0.32, x + side * s * 1.05, y + s * 0.05, s);
  drawCreature(c, L, x, y, s, 0.7, { still: true, mood: 'happy', noShadow: true, look: { x: side * 0.25, y: -0.35 } });
  c.restore(); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, 0, w, h);
}
/* Setting off: a winding path over the hills at sunrise, a signpost, and the little with its pack, waving. */
function drawSendOff(c, w, h, a) {
  picSky(c, w, h, '#f3a77a', '#ffe0a6'); glow(c, w * 0.72, h * 0.46, h * 0.6, 40, 100, 80, 0.6); c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(w * 0.72, h * 0.46, h * 0.13, 0, TAU); c.fill();
  const r = RNG(a.seed); picHills(c, w, h * 0.55, h * 0.12, '#9a86b8', r, 2); picHills(c, w, h * 0.66, h * 0.1, '#7aa07a', r, 3); picHills(c, w, h * 0.8, h * 0.1, '#4f8a4c', r, 2);
  c.fillStyle = '#e9d3a0'; c.beginPath(); c.moveTo(w * 0.28, h); c.bezierCurveTo(w * 0.42, h * 0.84, w * 0.78, h * 0.8, w * 0.56, h * 0.7); c.bezierCurveTo(w * 0.46, h * 0.64, w * 0.6, h * 0.6, w * 0.66, h * 0.57); c.lineTo(w * 0.67, h * 0.575); c.bezierCurveTo(w * 0.63, h * 0.61, w * 0.52, h * 0.65, w * 0.62, h * 0.71); c.bezierCurveTo(w * 0.86, h * 0.82, w * 0.62, h * 0.88, w * 0.62, h); c.closePath(); c.fill();
  c.strokeStyle = '#6b4424'; c.lineWidth = Math.max(2, w * 0.01); c.beginPath(); c.moveTo(w * 0.83, h * 0.92); c.lineTo(w * 0.83, h * 0.66); c.stroke();
  c.fillStyle = '#c99a62'; c.strokeStyle = '#2a1830'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(w * 0.76, h * 0.66); c.lineTo(w * 0.94, h * 0.66); c.lineTo(w * 0.97, h * 0.7); c.lineTo(w * 0.94, h * 0.74); c.lineTo(w * 0.76, h * 0.74); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#5a4a6a'; c.lineWidth = 1.4; for (const [bx, by] of [[0.2, 0.2], [0.26, 0.15], [0.32, 0.22]]) { c.beginPath(); c.moveTo(w * bx - 5, h * by); c.quadraticCurveTo(w * bx - 2, h * by - 4, w * bx, h * by); c.quadraticCurveTo(w * bx + 2, h * by - 4, w * bx + 5, h * by); c.stroke(); }
  const L = awayLook(a), s = h * 0.36, x = w * 0.47, y = h * 0.92;
  c.save(); c.translate(x + s * 0.34, y - s * 0.4); c.lineWidth = Math.max(1.2, s * 0.03); c.strokeStyle = '#2a1830'; c.fillStyle = '#c0703a'; rrect(c, -s * 0.16, -s * 0.2, s * 0.28, s * 0.32, s * 0.07); c.fill(); c.stroke(); c.fillStyle = '#6e8fd8'; rrect(c, -s * 0.19, -s * 0.31, s * 0.34, s * 0.11, s * 0.055); c.fill(); c.stroke(); c.restore();
  drawCreature(c, L, x, y, s, 0.7, { still: true, mood: 'happy', look: { x: -0.8, y: -0.1 } });
  picArm(c, L, x - s * 0.3, y - s * 0.42, x - s * 0.52, y - s * 0.78, s * 0.7);
  c.strokeStyle = 'rgba(42,24,48,.6)'; c.lineWidth = 1.4; for (const k of [0, 0.5]) { c.beginPath(); c.arc(x - s * 0.52, y - s * 0.78, s * (0.16 + k * 0.1), -2.6, -1.6); c.stroke(); }
}

/* ---------- asking, letting go, setting off ---------- */
/* When the nest is full, one grown-up little a day asks to go, unless the player said "stay" today. */
function adventureAsker() {
  if (eggRoom() > 0 || S.pet.asleep || S.awayNo === localDay()) return null;
  const ls = S.littles.filter(canGo); if (!ls.length) return null;
  return RNG((localDay() * 613 + S.pet.seed) >>> 0).pick(ls);
}
function drawAdventureAsk(c, H, bs) {
  H.abubble = null; const l = adventureAsker(), f = l && litOf(l.id); if (!f || H.carry && H.carry.id === f.l.id) return;
  const fs = Math.max(12, Math.round(bs * 0.085)); c.save(); c.font = '800 ' + fs + 'px ' + getComputedStyle(document.body).fontFamily;
  const lines = ['I\'m going on', 'an adventure!'], w = Math.max(...lines.map(s => c.measureText(s).width)) + fs * 1.4, h = lines.length * fs * 1.25 + fs * 0.8;
  const x = clamp(f.x, w / 2 + 6, VW - w / 2 - 6), y = f.y - bs * 0.62 - h / 2 + Math.sin(T * 2) * 2;
  c.fillStyle = '#fffaf0'; c.strokeStyle = '#2a1830'; c.lineWidth = 2; rrect(c, x - w / 2, y - h / 2, w, h, fs * 0.9); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(f.x - fs * 0.5, y + h / 2 - 1); c.lineTo(f.x, y + h / 2 + fs * 0.7); c.lineTo(f.x + fs * 0.5, y + h / 2 - 1); c.closePath(); c.fill(); c.stroke(); c.fillRect(f.x - fs * 0.45, y + h / 2 - 3, fs * 0.9, 4);
  c.fillStyle = '#2a1830'; c.textAlign = 'center'; c.textBaseline = 'middle'; lines.forEach((s, i) => c.fillText(s, x, y - h / 2 + fs * 0.4 + fs * 1.25 * (i + 0.5))); c.restore();
  H.abubble = { x, y, w, h, id: l.id };
}
const adventureHit = pt => { const b = home.abubble; return b && Math.abs(pt.x - b.x) < b.w / 2 && Math.abs(pt.y - b.y) < b.h / 2 ? b.id : null; };
function openLetGo(id) {
  const l = petById(id); if (!l || !canGo(l)) return;
  openSheet('<h2>' + esc(l.name) + '</h2><div class="card"><canvas data-ic="little:' + l.id + '" data-size="60"></canvas><div class="tx"><strong>' + esc(l.name) + '</strong><small>' + esc(kindLabel(l)) + ' · Lv ' + littleLevel(l.xp || 0) + ', grown up</small></div></div><p style="margin-top:12px">' + esc(l.name) + ' is all grown up and has been looking at the sky a lot. It would love to go on an adventure of its own.</p><p class="dim">If you let it go, it leaves you a parting gift and sends a picture from its travels every 10 days. It will not come back to the nest, but you can look at its pictures in the journal any time.</p><div class="btns"><button class="btn" data-do="stay">Stay a while longer</button><button class="btn main" data-do="go">Let ' + esc(l.name) + ' go</button></div>', {
    stay: () => { S.awayNo = localDay(); save(); closeSheet(); toast(l.name + ' snuggles back down. Maybe another day.'); },
    go: () => setOff(id)
  });
}
function setOff(id) {
  const l = petById(id); if (!l || !canGo(l)) return;
  const gift = PARTING[RNG(l.seed).int(0, PARTING.length - 1)];
  const a = Object.assign({ id: l.id, name: l.name, kind: l.kind, seed: l.seed, left: Date.now(), gift: gift[0], n: gift[1], pics: [] }, l.kind2 ? { kind2: l.kind2 } : {});
  if (l.charm) { S.charms[l.charm] = (S.charms[l.charm] || 0) + 1; }
  S.littles.splice(S.littles.indexOf(l), 1); S.party = S.party.filter(x => x !== id); partyLittles(); if (S.lwish && S.lwish.id === id) S.lwish = null; if (S.offer && S.offer.id === id) S.offer = null;
  for (let k = 0; k < gift[1]; k++) giveThing(gift[0]);
  S.away.push(a); S.j.away = (S.j.away || 0) + 1; sfx('tinkle'); save(); rebuildHome(); updateHud(); openSendOff(S.away.length - 1);
}
function openSendOff(i) {
  const a = S.away[i]; if (!a) return;
  openSheet('<h2>' + esc(a.name) + ' is off on an adventure</h2><p style="margin:0 0 8px"><b>"I\'m going on an adventure!"</b></p><canvas data-ic="away:' + i + ':go" data-size="190" data-w="300" style="border-radius:14px;max-width:100%;display:block;margin:0 auto"></canvas><p style="margin-top:12px">' + esc(a.name) + ' will send you a picture from its travels every 10 days. You will find them in the journal.</p><div class="card"><canvas data-ic="thing:' + a.gift + '" data-size="52"></canvas><span class="tx"><strong>A parting gift</strong><small>' + esc(a.name) + ' leaves you ' + giftWords(a) + ' to remember it by.</small></span></div><p class="dim" style="margin-top:10px">Its place in the nest is free now.</p><div class="btns"><button class="btn main" data-do="ok">Wave goodbye</button></div>', { ok: closeSheet });
}
const giftWords = a => (a.n > 1 ? ['two', 'three'][a.n - 2] + ' ' : 'a ') + thingName(a.gift).toLowerCase() + (a.n > 1 ? 's' : '');

/* ---------- pictures arriving ---------- */
/* Adds every picture that is due (one each PIC_GAP after leaving, up to AWAY_PICS), and at the nest, with nothing else
   open, shows the oldest one not yet seen. */
function adventureMail() {
  if (!S.away || !S.away.length) return; const now = Date.now(); let added = false;
  for (const a of S.away) { const due = Math.min(AWAY_PICS, Math.floor((now - a.left) / PIC_GAP)); while (a.pics.length < due) { const n = a.pics.length; a.pics.push({ at: a.left + (n + 1) * PIC_GAP, s: ((a.seed * 31 + (n + 1) * 977) >>> 0) % 2147483646, nu: 1 }); added = true; } }
  if (added) save();
  if (scene !== 'home' || !ui.sheet.hidden || home.carry || home.snap) return;
  for (let i = 0; i < S.away.length; i++) { const n = S.away[i].pics.findIndex(p => p.nu); if (n >= 0) { openArrived(i, n); return; } }
}
function openArrived(i, n) {
  const a = S.away[i], p = a.pics[n]; delete p.nu; save(); sfx('tinkle');
  openSheet('<h2>A picture from ' + esc(a.name) + '</h2>' + selfieBody(i, n) + '<p class="dim">It went into the journal, under Away on adventures.</p><div class="btns">' + KEEP_BTN + '<button class="btn main" data-do="ok">Lovely</button></div>', { ok: () => { closeSheet(); adventureMail(); }, keep: () => keepSelfie(i, n) });
}
/* Saves a selfie to the phone (src/keep.js), as large as it shows on its sheet times four. */
function keepSelfie(i, n) { const a = S.away[i], p = a && a.pics[n]; if (p) keepPicture((c, w, h) => drawSelfie(c, w, h, a, p.s), 300, 300, a.name, p.at); }
function selfieBody(i, n) {
  const a = S.away[i], sc = picScene(a.pics[n].s), day = (n + 1) * PIC_GAP / 86400000;
  return '<canvas data-ic="away:' + i + ':' + n + '" data-size="300" data-w="300" style="border-radius:14px;max-width:100%;display:block;margin:0 auto"></canvas><p style="margin-top:12px"><b>' + esc(a.name) + '</b> at ' + esc(sc.name) + ', on day ' + day + ' of its adventure.' + (sc.friend >= 0 ? ' A ' + esc(VISITORS[sc.friend].name.toLowerCase()) + ' wanted to be in it too.' : '') + (n === AWAY_PICS - 1 ? ' ' + esc(a.name) + ' has found somewhere lovely to stay, and this is its last picture.' : '') + '</p>';
}
function openSelfie(i, n) {
  if (!S.away[i] || !S.away[i].pics[n]) return; delete S.away[i].pics[n].nu;
  openSheet('<h2>' + esc(S.away[i].name) + '\'s adventure</h2>' + selfieBody(i, n) + '<div class="btns">' + KEEP_BTN + '<button class="btn main" data-do="back">Back to the journal</button></div>', { back: openJournal, keep: () => keepSelfie(i, n) });
}
function awayJournal() {
  if (!S.away || !S.away.length) return '';
  const days = t => Math.floor((Date.now() - t) / 86400000);
  return '<h3>Away on adventures · ' + S.away.length + '</h3><p class="dim">Littles who set off to see the world. A picture comes from each every 10 days.</p>' + S.away.map((a, i) => {
    const d = days(a.left), np = a.pics.length;
    return '<div class="card"><canvas data-ic="away:' + i + ':face" data-size="60"></canvas><span class="tx"><strong>' + esc(a.name) + '</strong><small>' + esc(KINDS[a.kind].label) + ' · set off ' + (d < 1 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago') + '</small><small>' + (np ? np + (np > 1 ? ' pictures' : ' picture') + (np >= AWAY_PICS ? '. It has found somewhere lovely to stay.' : ' so far.') : 'No pictures yet. The first comes on day 10.') + ' Left you ' + giftWords(a) + '.</small></span></div>' +
      (np ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin:8px 0 12px">' + a.pics.map((p, n) => '<button class="card" data-do="selfie" data-i="' + i + '" data-n="' + n + '" style="display:grid;gap:4px;padding:6px;justify-items:center" aria-label="' + esc(a.name) + '\'s picture from day ' + (n + 1) * 10 + '"><canvas data-ic="away:' + i + ':' + n + '" data-size="84" data-w="84" style="border-radius:8px"></canvas><small>Day ' + (n + 1) * 10 + '</small></button>').join('') + '</div>' : '');
  }).join('');
}
function paintAway(c, i, what, w, h) {
  const a = S.away && S.away[+i]; if (!a) return;
  if (what === 'go') drawSendOff(c, w, h, a);
  else if (what === 'face') drawCreature(c, awayLook(a), w / 2, h * 0.93, h * 0.48, 0, { still: true, noShadow: true, glow: 0.2 });
  else if (a.pics[+what]) drawSelfie(c, w, h, a, a.pics[+what].s);
}
