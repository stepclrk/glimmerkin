/* ===== Drawing: creatures, tiles, items (canvas 2D, all procedural) ===== */
const D2R = Math.PI / 180;
const hsl = (h, s, l, a) => 'hsla(' + (((h % 360) + 360) % 360).toFixed(1) + ',' + clamp(s, 0, 100) + '%,' + clamp(l, 0, 100) + '%,' + (a === undefined ? 1 : a) + ')';

function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function starPath(c, x, y, R, r, n, rot) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r : R; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }
function glow(c, x, y, r, h, s, l, a) {
  if (r <= 0 || a <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hsl(h, s, l, a)); g.addColorStop(1, hsl(h, s, l, 0));
  const o = c.globalCompositeOperation; c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.globalCompositeOperation = o;
}
function bodyPath(c, cx, cy, w, h, top) {
  c.beginPath(); c.moveTo(cx - w, cy + h * 0.25);
  c.bezierCurveTo(cx - w, cy - h * 0.6, cx - w * top, cy - h, cx, cy - h);
  c.bezierCurveTo(cx + w * top, cy - h, cx + w, cy - h * 0.6, cx + w, cy + h * 0.25);
  c.bezierCurveTo(cx + w, cy + h * 0.85, cx + w * 0.6, cy + h, cx, cy + h);
  c.bezierCurveTo(cx - w * 0.6, cy + h, cx - w, cy + h * 0.85, cx - w, cy + h * 0.25);
  c.closePath();
}

/* ---------- looks ---------- */
const EAR_SETS = { ember: ['point', 'horn', 'point'], tide: ['fin', 'antenna', 'round'], stone: ['round', 'horn', 'round'], bloom: ['long', 'round', 'point'], gale: ['antenna', 'long', 'antenna'], glow: ['antenna', 'round', 'long'] };
function lookFor(kind, seed, kind2) {
  const r = RNG(seed), K = KINDS[kind];
  const L = {
    kind, hue: K.hue[0] + r.f() * (K.hue[1] - K.hue[0]), sat: kind === 'stone' ? 36 : kind === 'gale' ? 56 : 76,
    bw: 0.84 + r.f() * 0.3, bh: 0.8 + r.f() * 0.26, top: 0.5 + r.f() * 0.35,
    ears: r.pick(EAR_SETS[kind]), tail: r.pick(['puff', 'curl', 'none', 'puff']), pattern: r.pick(['spots', 'stripes', 'none', 'spots']),
    eyeS: 0.92 + r.f() * 0.3, cheek: r.chance(0.75), phase: r.f() * TAU,
    float: kind === 'gale' ? 0.26 : kind === 'glow' ? 0.13 : 0, feats: [kind]
  };
  if (kind2) { L.feats = [kind, kind2]; L.hue2 = (KINDS[kind2].hue[0] + KINDS[kind2].hue[1]) / 2; L.pattern = 'spots'; L.twin = true; L.float = Math.max(L.float, kind2 === 'gale' ? 0.26 : kind2 === 'glow' ? 0.13 : 0); }
  return L;
}
function petLook(pet) {
  const stage = stageOf(petLevel(pet.xp)), r = RNG(pet.seed), base = 285 + r.f() * 45;
  let sx = Math.cos(base * D2R) * 2.5, sy = Math.sin(base * D2R) * 2.5;
  const diet = Object.entries(pet.diet || {}).filter(e => e[1] > 0.05).sort((a, b) => b[1] - a[1]);
  for (const [el, v] of diet) { sx += Math.cos(EL_HUE[el] * D2R) * v; sy += Math.sin(EL_HUE[el] * D2R) * v; }
  const feats = diet.filter(e => e[1] >= 1.4).slice(0, stage >= 2 ? 2 : 1).map(e => e[0]);
  return {
    kind: 'kin', hue: (Math.atan2(sy, sx) / D2R + 360) % 360, sat: 72, bw: 1.0, bh: 0.92, top: 0.62,
    ears: ['round', 'point', 'point', 'long'][stage], tail: ['none', 'puff', 'curl', 'curl'][stage], pattern: stage >= 1 ? 'spots' : 'none',
    eyeS: 1.12, cheek: true, phase: 0.5, float: 0, feats, stage, gem: stage >= 2, antlers: stage >= 3, wings: stage >= 3, marks: pet.marks || [],
    ...(stage >= 3 && pet.form ? formLook(pet.form) : {})
  };
}
/* What each Mythic form changes about the shared Mythic look. The rest is drawn by mythic() below. */
function formLook(f) {
  const base = { form: f, antlers: false, wings: false };
  if (f === 'tide') base.ears = 'fin';
  if (f === 'stone') { base.ears = 'horn'; base.bw = 1.08; }
  if (f === 'gale') { base.ears = 'long'; base.float = 0.12; }
  if (f === 'glow') base.ears = 'antenna';
  return base;
}
function mythic(c, L, G, layer) {
  const { cx, cy, w, h, s, t, ph, lw, C, still } = G, f = L.form, sw = still ? 0 : Math.sin(t * 2 + ph);
  if (layer === 'back') {
    if (f === 'ember') { for (let i = -2; i <= 2; i++) flame(c, cx + i * w * 0.32, cy - h * (0.78 - Math.abs(i) * 0.12), s * (0.13 - Math.abs(i) * 0.015), t, i); }
    else if (f === 'tide') { c.fillStyle = hsl(195, 80, 70, 0.9); c.strokeStyle = C.line; c.lineWidth = lw; c.beginPath(); c.moveTo(cx - w * 0.9, cy - h * 0.2); c.bezierCurveTo(cx - w * 0.9, cy - h * 1.6, cx + w * 0.4, cy - h * 1.7, cx + w * 0.55, cy - h * 1.05 + sw * s * 0.02); c.bezierCurveTo(cx + w * 0.2, cy - h * 1.25, cx - w * 0.2, cy - h * 1.1, cx - w * 0.3, cy - h * 0.4); c.closePath(); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 3; i++) { const a = (still ? i : t * 0.8 + i * 2.1) + ph; c.beginPath(); c.arc(cx + Math.cos(a) * w * 1.2, cy - h * 0.3 + Math.sin(a * 1.3) * h * 0.6, s * 0.03, 0, TAU); c.fill(); } }
    else if (f === 'stone') { c.strokeStyle = C.line; c.lineWidth = lw; for (let i = -1; i <= 1; i++) { const bx = cx + i * w * 0.5, by = cy - h * (0.82 - Math.abs(i) * 0.15), hh = s * (0.32 - Math.abs(i) * 0.08); glow(c, bx, by - hh * 0.5, s * 0.16, 270, 90, 72, 0.4); c.fillStyle = hsl(270 + i * 20, 70, 74); c.beginPath(); c.moveTo(bx - s * 0.07, by); c.lineTo(bx + i * s * 0.04, by - hh); c.lineTo(bx + s * 0.07, by); c.closePath(); c.fill(); c.stroke(); } }
    else if (f === 'bloom') { for (const sd of [-1, 1]) { c.save(); c.translate(cx + sd * w * 0.6, cy - h * 0.2); c.rotate(sd * (0.9 + sw * 0.08)); c.fillStyle = hsl(115, 60, 55, 0.95); c.strokeStyle = hsl(140, 60, 22); c.lineWidth = lw; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sd * s * 0.3, -s * 0.25, 0, -s * 0.62); c.quadraticCurveTo(-sd * s * 0.12, -s * 0.28, 0, 0); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, 0); c.lineTo(sd * s * 0.04, -s * 0.5); c.stroke(); c.restore(); } }
    else if (f === 'gale') wings(c, Object.assign({}, G, { s: s * 1.45, cy: cy - h * 0.1 }), 175);
    else if (f === 'glow') { for (let i = 0; i < 3; i++) { const a = (still ? i * 2.1 : t * 1.2 + i * 2.1) + ph; if (Math.sin(a) > 0) continue; const ox = cx + Math.cos(a) * w * 1.35, oy = cy - h * 0.2 + Math.sin(a) * h * 0.5; glow(c, ox, oy, s * 0.16, 50, 100, 75, 0.8); c.fillStyle = '#fff6c4'; c.beginPath(); c.arc(ox, oy, s * 0.035, 0, TAU); c.fill(); } }
  } else {
    if (f === 'ember') { c.fillStyle = 'rgba(255,190,90,.9)'; starPath(c, cx, cy - h * 0.52, s * 0.06, s * 0.025, 4, t); c.fill(); }
    else if (f === 'tide') { c.fillStyle = C.light; c.strokeStyle = C.line; c.lineWidth = lw; c.beginPath(); c.moveTo(cx - s * 0.08, cy - h * 0.92); c.quadraticCurveTo(cx, cy - h - s * 0.3, cx + s * 0.12, cy - h - s * 0.12); c.quadraticCurveTo(cx + s * 0.06, cy - h * 0.98, cx + s * 0.08, cy - h * 0.9); c.closePath(); c.fill(); c.stroke(); }
    else if (f === 'stone') { c.fillStyle = hsl(270, 80, 80); glow(c, cx, cy - h * 0.5, s * 0.14, 270, 100, 75, 0.6); starPath(c, cx, cy - h * 0.5, s * 0.06, s * 0.03, 3, -Math.PI / 2); c.fill(); }
    else if (f === 'bloom') { for (let i = -2; i <= 2; i++) { const fx = cx + i * w * 0.24, fy = cy - h * (0.98 - Math.abs(i) * 0.06); c.fillStyle = hsl([330, 48, 290, 48, 330][i + 2], 85, 75); for (let p = 0; p < 5; p++) { const a = p * TAU / 5; c.beginPath(); c.arc(fx + Math.cos(a) * s * 0.03, fy + Math.sin(a) * s * 0.03, s * 0.024, 0, TAU); c.fill(); } c.fillStyle = '#fff3a0'; c.beginPath(); c.arc(fx, fy, s * 0.02, 0, TAU); c.fill(); } }
    else if (f === 'gale') { for (let i = -1; i <= 1; i++) { c.save(); c.translate(cx + i * w * 0.14, cy - h * 0.95); c.rotate(i * 0.35 + sw * 0.08); c.fillStyle = hsl(170 + i * 20, 70, 82); c.strokeStyle = C.line; c.lineWidth = lw * 0.8; c.beginPath(); c.ellipse(0, -s * 0.12, s * 0.035, s * 0.12, 0, 0, TAU); c.fill(); c.stroke(); c.restore(); } }
    else if (f === 'glow') { for (let i = 0; i < 3; i++) { const a = (still ? i * 2.1 : t * 1.2 + i * 2.1) + ph; if (Math.sin(a) <= 0) continue; const ox = cx + Math.cos(a) * w * 1.35, oy = cy - h * 0.2 + Math.sin(a) * h * 0.5; glow(c, ox, oy, s * 0.18, 50, 100, 75, 0.9); c.fillStyle = '#fff6c4'; c.beginPath(); c.arc(ox, oy, s * 0.04, 0, TAU); c.fill(); } }
  }
}

/* ---------- element features ---------- */
function flame(c, x, y, r, t, ph) {
  glow(c, x, y - r * 0.6, r * 3, 28, 100, 60, 0.45);
  for (const [k, colr] of [[1, '#ff6b2a'], [0.68, '#ffb23a'], [0.38, '#fff3b0']]) {
    const q = r * k, f = Math.sin(t * 9 + ph + k * 3) * q * 0.16;
    c.fillStyle = colr; c.beginPath(); c.moveTo(x + f, y - q * 2.2);
    c.bezierCurveTo(x + q * 1.15, y - q * 0.9, x + q * 0.95, y + q * 0.3, x, y + q * 0.35);
    c.bezierCurveTo(x - q * 0.95, y + q * 0.3, x - q * 1.15, y - q * 0.9, x + f, y - q * 2.2); c.fill();
  }
}
function wings(c, G, hue) {
  const flap = G.still ? 0.1 : Math.sin(G.t * 9 + G.ph) * 0.32, s = G.s;
  for (const sd of [-1, 1]) {
    c.save(); c.translate(G.cx + sd * G.w * 0.5, G.cy - G.h * 0.2); c.scale(sd, 1); c.rotate(-0.3 + flap);
    c.fillStyle = hsl(hue - 20, 75, 86, 0.82); c.strokeStyle = hsl(hue + 20, 45, 34, 0.9); c.lineWidth = G.lw * 0.8;
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(s * 0.12, -s * 0.6, s * 0.66, -s * 0.56, s * 0.56, -s * 0.12); c.bezierCurveTo(s * 0.46, s * 0.03, s * 0.15, s * 0.05, 0, 0); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, s * 0.02); c.bezierCurveTo(s * 0.3, s * 0.02, s * 0.46, s * 0.2, s * 0.3, s * 0.33); c.bezierCurveTo(s * 0.14, s * 0.37, s * 0.03, s * 0.2, 0, s * 0.02); c.fill(); c.stroke();
    c.fillStyle = hsl(hue + 150, 85, 72, 0.85); c.beginPath(); c.arc(s * 0.38, -s * 0.3, s * 0.065, 0, TAU); c.fill();
    c.fillStyle = hsl(hue + 60, 90, 80, 0.8); c.beginPath(); c.arc(s * 0.27, s * 0.2, s * 0.04, 0, TAU); c.fill();
    c.restore();
  }
}
function feat(c, el, layer, G, ox) {
  const { cx, cy, w, h, s, t, ph, lw } = G, top = cy - h, x = cx + ox;
  if (layer === 'back') {
    if (el === 'gale') wings(c, G, G.h0);
    if (el === 'glow') { const bx = cx + w * 0.95, by = cy + h * 0.35; c.strokeStyle = G.C.line; c.lineWidth = lw; c.beginPath(); c.moveTo(cx + w * 0.6, cy + h * 0.5); c.quadraticCurveTo(cx + w * 0.9, cy + h * 0.7, bx, by); c.stroke(); glow(c, bx, by, s * 0.3, 50, 100, 70, 0.7 + 0.3 * Math.sin(t * 3 + ph)); c.fillStyle = '#fff6c9'; c.beginPath(); c.arc(bx, by, s * 0.07, 0, TAU); c.fill(); }
    return;
  }
  if (el === 'ember') flame(c, x, top + s * 0.03, s * 0.11, t, ph);
  else if (el === 'tide') {
    c.fillStyle = hsl(195, 90, 80, 0.92); c.strokeStyle = hsl(210, 60, 35); c.lineWidth = lw * 0.8;
    c.beginPath(); c.moveTo(x, top - s * 0.26); c.bezierCurveTo(x + s * 0.13, top - s * 0.08, x + s * 0.1, top + s * 0.04, x, top + s * 0.04); c.bezierCurveTo(x - s * 0.1, top + s * 0.04, x - s * 0.13, top - s * 0.08, x, top - s * 0.26); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(x - s * 0.03, top - s * 0.07, s * 0.018, s * 0.04, 0.3, 0, TAU); c.fill();
    c.strokeStyle = hsl(190, 90, 85, 0.7); c.lineWidth = Math.max(1, lw * 0.6);
    for (let i = 0; i < 3; i++) { const a = t * 0.9 + ph + i * 2.1, rr = s * (0.62 + 0.08 * Math.sin(t + i)); c.beginPath(); c.arc(cx + Math.cos(a) * rr, cy - s * 0.1 + Math.sin(a * 1.3) * s * 0.3, s * (0.03 + i * 0.008), 0, TAU); c.stroke(); }
  } else if (el === 'stone') {
    for (let i = -1; i <= 1; i++) { const px = x + i * w * 0.42, py = top + Math.abs(i) * h * 0.2 + s * 0.02; c.fillStyle = hsl(250, 12, 46 + i * 5); c.strokeStyle = hsl(255, 20, 20); c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(px - s * 0.09, py + s * 0.04); c.lineTo(px - s * 0.05, py - s * 0.06); c.lineTo(px + s * 0.06, py - s * 0.07); c.lineTo(px + s * 0.1, py + s * 0.03); c.closePath(); c.fill(); c.stroke(); }
    glow(c, x, top - s * 0.12, s * 0.22, 40, 100, 65, 0.6); c.fillStyle = '#ffd98a'; c.strokeStyle = '#a8651c'; c.lineWidth = lw * 0.7; c.beginPath(); c.moveTo(x, top - s * 0.24); c.lineTo(x + s * 0.06, top - s * 0.1); c.lineTo(x, top - s * 0.02); c.lineTo(x - s * 0.06, top - s * 0.1); c.closePath(); c.fill(); c.stroke();
  } else if (el === 'bloom') {
    const sw = Math.sin(t * 2 + ph) * 0.12; c.strokeStyle = hsl(120, 50, 30); c.lineWidth = lw; c.beginPath(); c.moveTo(x, top + s * 0.03); c.quadraticCurveTo(x + s * 0.02, top - s * 0.1, x + sw * s * 0.2, top - s * 0.2); c.stroke();
    for (const sd of [-1, 1]) { c.save(); c.translate(x + sw * s * 0.2, top - s * 0.19); c.rotate(sd * (0.7 + sw)); c.fillStyle = hsl(105 + sd * 12, 70, 58); c.strokeStyle = hsl(125, 50, 26); c.lineWidth = lw * 0.7; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * 0.1, -s * 0.16, 0, -s * 0.24); c.quadraticCurveTo(-s * 0.1, -s * 0.16, 0, 0); c.fill(); c.stroke(); c.restore(); }
    const fx = cx - w * 0.7, fy = cy - h * 0.55; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + t * 0.4; c.fillStyle = '#ffc2dc'; c.beginPath(); c.arc(fx + Math.cos(a) * s * 0.045, fy + Math.sin(a) * s * 0.045, s * 0.035, 0, TAU); c.fill(); } c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(fx, fy, s * 0.03, 0, TAU); c.fill();
  } else if (el === 'glow') {
    const hy = top - s * 0.14 + Math.sin(t * 2 + ph) * s * 0.015; glow(c, x, hy, s * 0.4, 50, 100, 70, 0.4);
    c.strokeStyle = '#ffe9a0'; c.lineWidth = lw * 1.1; c.beginPath(); c.ellipse(x, hy, s * 0.2, s * 0.055, 0, 0, TAU); c.stroke();
    c.fillStyle = '#fffbe0'; starPath(c, x, hy - s * 0.14, s * 0.07, s * 0.028, 4, t * 1.2); c.fill();
  } else if (el === 'gale') {
    c.strokeStyle = hsl(G.h0 - 20, 80, 90, 0.9); c.lineWidth = lw * 0.9;
    for (const sd of [-1, 0, 1]) { c.beginPath(); c.moveTo(x + sd * s * 0.03, top + s * 0.02); c.quadraticCurveTo(x + sd * s * 0.12, top - s * 0.1, x + sd * s * 0.1 + Math.sin(t * 4 + ph + sd) * s * 0.03, top - s * 0.18); c.stroke(); }
  }
}

/* ---------- creature ---------- */
function drawCreature(c, L, x, y, s, t, o) {
  o = o || {}; const ph = L.phase || 0, mood = o.mood || 'idle', still = !!o.still;
  const h0 = L.hue, sat = L.sat || 70;
  const C = { base: hsl(h0, sat, 62), light: hsl(h0 - 14, sat + 14, 81), shade: hsl(h0 + 22, sat - 6, 41), line: hsl(h0 + 30, 42, 18), belly: hsl(h0 - 30, sat, 91), inner: hsl(h0 - 40, 85, 84) };
  const bob = still ? 0 : Math.sin(t * 2.2 + ph) * s * 0.03, br = still ? 1 : 1 + Math.sin(t * 2.2 + ph + 1.2) * 0.022, sq = o.squash || 0;
  const w = s * 0.5 * L.bw * (1 + sq) * br, h = s * 0.5 * L.bh * (1 - sq) / br;
  const fl = (L.float || 0) * s * (still ? 0.6 : 1 + 0.15 * Math.sin(t * 3 + ph)) + (o.lift || 0);
  const cx = x, cy = y - h - fl + bob, lw = Math.max(1.1, s * 0.034);
  const G = { cx, cy, w, h, s, t, ph, lw, C, h0, still };
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  if (!o.noShadow) { const k = clamp(1 - fl / (s * 0.9), 0.25, 1); c.fillStyle = 'rgba(8,4,20,' + (0.32 * k) + ')'; c.beginPath(); c.ellipse(x, y + s * 0.015, w * 0.85 * k, s * 0.065 * k, 0, 0, TAU); c.fill(); }
  const pulse = still ? 0.8 : 0.6 + 0.4 * Math.sin(t * 1.7 + ph);
  glow(c, cx, cy, s * (0.95 + 0.12 * pulse), h0, 95, 66, (o.glow === undefined ? 0.3 : o.glow) * (0.65 + 0.35 * pulse));
  const feats = L.feats || [], fox = i => feats.length > 1 ? (i ? 1 : -1) * w * 0.34 : 0;
  if (L.wings && !feats.includes('gale')) wings(c, G, h0);
  if (L.form) mythic(c, L, G, 'back');
  feats.forEach((f, i) => feat(c, f, 'back', G, fox(i)));
  // tail
  c.strokeStyle = C.line; c.lineWidth = lw;
  if (L.tail === 'puff') { c.fillStyle = C.light; c.beginPath(); c.arc(cx - w * 0.95, cy + h * 0.5, s * 0.12, 0, TAU); c.fill(); c.stroke(); }
  else if (L.tail === 'curl') {
    const wag = still ? 0 : Math.sin(t * 3 + ph) * s * 0.05, tx = cx - w * 1.4 + wag, ty = cy - h * 0.25;
    const tp = () => { c.beginPath(); c.moveTo(cx - w * 0.7, cy + h * 0.6); c.bezierCurveTo(cx - w * 1.5, cy + h * 0.9, cx - w * 1.75, cy + h * 0.1, tx, ty); };
    c.strokeStyle = C.line; c.lineWidth = s * 0.11 + lw * 2; tp(); c.stroke(); c.strokeStyle = C.base; c.lineWidth = s * 0.11; tp(); c.stroke();
    glow(c, tx, ty, s * 0.28, h0 - 40, 100, 75, 0.7); c.fillStyle = C.inner; c.beginPath(); c.arc(tx, ty, s * 0.07, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(tx - s * 0.02, ty - s * 0.02, s * 0.025, 0, TAU); c.fill();
  }
  // ears
  const sway = still ? 0 : Math.sin(t * 2.2 + ph) * 0.06, marks = L.marks || [];
  if (marks.includes('wingbuds') && !L.wings) wings(c, { cx, cy: cy + h * 0.1, w, h, s: s * 0.5, t, ph, lw, C, h0, still }, h0 + 40);
  if (marks.includes('crest')) for (let i = -1; i <= 1; i++) { c.save(); c.translate(cx + i * w * 0.15, cy - h * 0.94); c.rotate(i * 0.4 + sway); c.fillStyle = hsl(h0 + 120 + i * 55, 88, 68); c.strokeStyle = C.line; c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(0, s * 0.04); c.quadraticCurveTo(s * 0.075, -s * 0.12, 0, -s * 0.28); c.quadraticCurveTo(-s * 0.075, -s * 0.12, 0, s * 0.04); c.fill(); c.stroke(); c.restore(); }
  if (marks.includes('antennae')) for (const sd of [-1, 1]) { const ax = cx + sd * w * 0.22, ay = cy - h * 0.9, bx = ax + sd * s * 0.13, by = ay - s * 0.3 + (still ? 0 : Math.sin(t * 3 + sd) * s * 0.012); c.strokeStyle = C.line; c.lineWidth = lw; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(ax, by, bx, by); c.stroke(); glow(c, bx, by, s * 0.16, h0 + 180, 100, 78, 0.8); c.fillStyle = hsl(h0 + 180, 90, 84); c.beginPath(); c.arc(bx, by, s * 0.04, 0, TAU); c.fill(); }
  for (const sd of [-1, 1]) {
    c.save(); c.translate(cx + sd * w * 0.55, cy - h * 0.78); c.rotate(sd * (0.28 + sway) + (o.lean || 0) * 0.1);
    c.fillStyle = C.base; c.strokeStyle = C.line; c.lineWidth = lw;
    switch (L.ears) {
      case 'round': c.beginPath(); c.arc(0, -s * 0.03, s * 0.13, 0, TAU); c.fill(); c.stroke(); c.fillStyle = C.inner; c.beginPath(); c.arc(0, -s * 0.02, s * 0.07, 0, TAU); c.fill(); break;
      case 'point': c.beginPath(); c.moveTo(-s * 0.12, s * 0.04); c.quadraticCurveTo(-s * 0.08, -s * 0.2, 0, -s * 0.32); c.quadraticCurveTo(s * 0.1, -s * 0.18, s * 0.12, s * 0.04); c.closePath(); c.fill(); c.stroke(); c.fillStyle = C.inner; c.beginPath(); c.moveTo(-s * 0.055, 0); c.quadraticCurveTo(-s * 0.03, -s * 0.14, 0, -s * 0.22); c.quadraticCurveTo(s * 0.045, -s * 0.12, s * 0.055, 0); c.closePath(); c.fill(); break;
      case 'long': c.beginPath(); c.ellipse(0, -s * 0.2, s * 0.08, s * 0.26, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = C.inner; c.beginPath(); c.ellipse(0, -s * 0.2, s * 0.04, s * 0.18, 0, 0, TAU); c.fill(); break;
      case 'antenna': c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sd * s * 0.02, -s * 0.22, sd * s * 0.1, -s * 0.34); c.stroke(); glow(c, sd * s * 0.1, -s * 0.34, s * 0.2, h0 - 40, 100, 78, 0.8); c.fillStyle = C.inner; c.beginPath(); c.arc(sd * s * 0.1, -s * 0.34, s * 0.055, 0, TAU); c.fill(); c.stroke(); break;
      case 'horn': c.fillStyle = '#fff1d6'; c.beginPath(); c.moveTo(-s * 0.06, s * 0.03); c.quadraticCurveTo(-s * 0.02, -s * 0.16, sd * s * 0.07, -s * 0.25); c.quadraticCurveTo(s * 0.07, -s * 0.08, s * 0.06, s * 0.03); c.closePath(); c.fill(); c.stroke(); break;
      case 'fin': c.fillStyle = C.light; c.beginPath(); c.moveTo(-s * 0.06, s * 0.05); c.lineTo(sd * s * 0.04, -s * 0.24); c.lineTo(sd * s * 0.09, -s * 0.1); c.lineTo(sd * s * 0.2, -s * 0.14); c.lineTo(sd * s * 0.15, 0); c.lineTo(sd * s * 0.24, s * 0.05); c.lineTo(s * 0.02, s * 0.1); c.closePath(); c.fill(); c.stroke(); break;
    }
    c.restore();
  }
  if (L.antlers) {
    c.strokeStyle = '#fff3c4'; c.lineWidth = lw * 1.3;
    for (const sd of [-1, 1]) { const ax = cx + sd * w * 0.22, ay = cy - h * 0.92; glow(c, ax + sd * s * 0.1, ay - s * 0.2, s * 0.22, 48, 100, 75, 0.45); c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(ax + sd * s * 0.02, ay - s * 0.16, ax + sd * s * 0.14, ay - s * 0.28); c.moveTo(ax + sd * s * 0.04, ay - s * 0.14); c.lineTo(ax - sd * s * 0.04, ay - s * 0.24); c.moveTo(ax + sd * s * 0.09, ay - s * 0.21); c.lineTo(ax + sd * s * 0.2, ay - s * 0.2); c.stroke(); }
  }
  // feet
  if (!L.float) { c.fillStyle = C.shade; c.strokeStyle = C.line; c.lineWidth = lw; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(cx + sd * w * 0.42, cy + h * 0.96, s * 0.1, s * 0.055, 0, 0, TAU); c.fill(); c.stroke(); } }
  // body
  const g = c.createRadialGradient(cx - w * 0.35, cy - h * 0.45, s * 0.04, cx, cy, Math.max(w, h) * 1.3);
  g.addColorStop(0, C.light); g.addColorStop(0.45, C.base); g.addColorStop(1, C.shade);
  bodyPath(c, cx, cy, w, h, L.top); c.fillStyle = g; c.fill();
  c.save(); bodyPath(c, cx, cy, w, h, L.top); c.clip();
  c.fillStyle = C.belly; c.globalAlpha = 0.85; c.beginPath(); c.ellipse(cx, cy + h * 0.62, w * 0.62, h * 0.5, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
  if (L.pattern === 'spots') { c.fillStyle = L.hue2 !== undefined ? hsl(L.hue2, 85, 66, 0.82) : hsl(h0 - 40, 90, 86, 0.55); for (const [a, b, q] of [[-0.62, -0.5, 0.1], [0.55, -0.62, 0.075], [0.75, -0.2, 0.055], [-0.8, -0.05, 0.05]]) { c.beginPath(); c.arc(cx + a * w, cy + b * h, s * q, 0, TAU); c.fill(); } }
  else if (L.pattern === 'stripes') { c.strokeStyle = hsl(h0 + 30, sat, 36, 0.5); c.lineWidth = s * 0.05; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(cx, cy - h * (1.55 - i * 0.26), w * 1.0, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke(); } }
  c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.ellipse(cx - w * 0.42, cy - h * 0.55, w * 0.22, h * 0.14, -0.6, 0, TAU); c.fill();
  c.restore();
  bodyPath(c, cx, cy, w, h, L.top); c.strokeStyle = C.line; c.lineWidth = lw; c.stroke();
  // face
  const er = s * 0.088 * (L.eyeS || 1), exo = w * 0.42, ey = cy - h * 0.06, lk = o.look || { x: 0, y: 0 };
  const blink = !still && ((t + ph * 2) % (3.4 + (ph % 1.5))) < 0.13;
  if (L.cheek) { c.fillStyle = 'rgba(255,120,150,.38)'; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(cx + sd * w * 0.66, ey + er * 1.25, er * 0.62, er * 0.4, 0, 0, TAU); c.fill(); } }
  for (const sd of [-1, 1]) {
    const ex = cx + sd * exo; c.strokeStyle = '#1a1030'; c.lineWidth = lw * 1.15;
    if (mood === 'sleep') { c.beginPath(); c.arc(ex, ey - er * 0.3, er * 0.75, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
    else if (mood === 'happy' || mood === 'eat') { c.beginPath(); c.arc(ex, ey + er * 0.5, er * 0.8, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke(); }
    else if (blink) { c.beginPath(); c.moveTo(ex - er * 0.7, ey); c.lineTo(ex + er * 0.7, ey); c.stroke(); }
    else {
      const eg = c.createLinearGradient(0, ey - er, 0, ey + er * 1.1); eg.addColorStop(0, '#150c2b'); eg.addColorStop(0.55, '#231446'); eg.addColorStop(1, hsl(h0 + 150, 70, 52));
      c.fillStyle = eg; c.beginPath(); c.ellipse(ex + lk.x * er * 0.22, ey + lk.y * er * 0.2, er * 0.88, er * 1.08, 0, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - er * 0.28 + lk.x * er * 0.3, ey - er * 0.36 + lk.y * er * 0.25, er * 0.36, 0, TAU); c.fill();
      c.globalAlpha = 0.8; c.beginPath(); c.arc(ex + er * 0.3 + lk.x * er * 0.3, ey + er * 0.42 + lk.y * er * 0.25, er * 0.16, 0, TAU); c.fill(); c.globalAlpha = 1;
      if (mood === 'sad') { c.beginPath(); c.moveTo(ex - sd * er * 0.9, ey - er * 1.5); c.lineTo(ex + sd * er * 0.5, ey - er * 1.15); c.stroke(); }
    }
  }
  const my = ey + er * 1.35; c.strokeStyle = '#1a1030'; c.lineWidth = lw;
  if (mood === 'eat') { const op = 0.5 + 0.5 * Math.sin(t * 16); c.fillStyle = '#7a1f3d'; c.beginPath(); c.ellipse(cx, my + er * 0.2, er * 0.6, er * (0.25 + 0.5 * op), 0, 0, TAU); c.fill(); c.stroke(); }
  else if (mood === 'happy') { c.fillStyle = '#7a1f3d'; c.beginPath(); c.arc(cx, my - er * 0.1, er * 0.62, 0, Math.PI); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#ff8fb3'; c.beginPath(); c.arc(cx, my + er * 0.32, er * 0.3, 0, Math.PI); c.fill(); }
  else if (mood === 'sad') { c.beginPath(); c.arc(cx, my + er * 0.7, er * 0.45, 1.2 * Math.PI, 1.8 * Math.PI); c.stroke(); }
  else if (mood === 'sleep') { c.fillStyle = '#7a1f3d'; c.beginPath(); c.arc(cx, my + er * 0.1, er * 0.2, 0, TAU); c.fill(); }
  else { c.beginPath(); c.arc(cx - er * 0.32, my - er * 0.1, er * 0.32, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke(); c.beginPath(); c.arc(cx + er * 0.32, my - er * 0.1, er * 0.32, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke(); }
  if (marks.includes('bellystar')) { c.fillStyle = 'rgba(255,232,150,.95)'; starPath(c, cx, cy + h * 0.6, s * 0.09, s * 0.04, 5, -Math.PI / 2); c.fill(); }
  if (marks.includes('freckles')) { c.fillStyle = '#ffe58a'; for (const sd of [-1, 1]) for (const [fa, fb] of [[0.5, 2.0], [0.68, 1.75], [0.84, 2.05]]) { starPath(c, cx + sd * w * fa, ey + er * fb, s * 0.024, s * 0.01, 4, 0.4); c.fill(); } }
  if (marks.includes('halo')) { const hy = cy - h - s * 0.3 + (still ? 0 : Math.sin(t * 2) * s * 0.012); glow(c, cx, hy, s * 0.42, 50, 100, 72, 0.4); c.strokeStyle = '#ffe9a0'; c.lineWidth = lw * 1.2; c.beginPath(); c.ellipse(cx, hy, s * 0.24, s * 0.06, 0, 0, TAU); c.stroke(); }
  if (marks.includes('shimmer')) { const op = c.globalCompositeOperation; c.globalCompositeOperation = 'lighter'; bodyPath(c, cx, cy, w, h, L.top); c.strokeStyle = hsl((t * 70) % 360, 95, 68, 0.55); c.lineWidth = lw * 2.6; c.stroke(); c.globalCompositeOperation = op; }
  if (marks.includes('comet')) { const ca = (still ? 0.6 : t * 1.6) + ph; for (let i = 3; i >= 0; i--) { const a2 = ca - i * 0.22; glow(c, cx + Math.cos(a2) * w * 1.4, cy - h * 0.15 + Math.sin(a2) * h * 0.55, s * (0.13 - i * 0.025), 190 + i * 30, 100, 78, 0.9 - i * 0.2); } c.fillStyle = '#fff'; c.beginPath(); c.arc(cx + Math.cos(ca) * w * 1.4, cy - h * 0.15 + Math.sin(ca) * h * 0.55, s * 0.025, 0, TAU); c.fill(); }
  if (L.kind === 'kin' && !L.stage) { c.strokeStyle = C.line; c.lineWidth = lw * 2.2; const tp = () => { c.beginPath(); c.moveTo(cx, cy - h * 0.98); c.bezierCurveTo(cx - s * 0.02, cy - h - s * 0.16, cx + s * 0.14, cy - h - s * 0.14, cx + s * 0.08, cy - h - s * 0.05); }; tp(); c.stroke(); c.strokeStyle = C.light; c.lineWidth = lw * 1.1; tp(); c.stroke(); }
  if (L.gem) { const gy = cy - h * 0.52; glow(c, cx, gy, s * 0.2, h0 + 170, 100, 72, 0.7); c.fillStyle = hsl(h0 + 170, 90, 76); c.strokeStyle = C.line; c.lineWidth = lw * 0.8; starPath(c, cx, gy, s * 0.07, s * 0.04, 2, Math.PI / 2); c.fill(); c.stroke(); }
  feats.forEach((f, i) => feat(c, f, 'front', G, fox(i)));
  if (L.form) mythic(c, L, G, 'front');
  c.restore();
}

/* ---------- items & enemies ---------- */
function drawItem(c, it, x, y, s, t) { // x,y = centre
  const b = Math.sin(t * 3 + x * 0.05 + y * 0.07) * s * 0.04; y += b;
  c.save(); c.lineJoin = 'round';
  if (it.k === 'shard') {
    const h = it.bonus ? 190 : 46; glow(c, x, y, s * 0.42, h, 100, 68, 0.55 + 0.25 * Math.sin(t * 4 + x));
    c.fillStyle = it.bonus ? '#b9f3ff' : '#ffe58a'; c.strokeStyle = it.bonus ? '#2c7f9c' : '#b8791b'; c.lineWidth = Math.max(1, s * 0.03);
    starPath(c, x, y, s * 0.24, s * 0.09, 4, t * 0.6); c.fill(); c.stroke(); c.fillStyle = '#fff'; starPath(c, x, y, s * 0.1, s * 0.04, 4, t * 0.6); c.fill();
  } else if (it.k === 'berry') {
    const fr = it.el === 'frost', h = fr ? 196 : EL_HUE[it.el], n = it.n > 1 ? 2 : 1;
    for (let i = 0; i < n; i++) { const bx = x + (n > 1 ? (i ? 0.11 : -0.11) * s : 0), by = y + (i ? 0.03 : 0) * s, r = s * 0.15; glow(c, bx, by, r * 2.2, h, 100, 65, 0.3); c.fillStyle = fr ? hsl(h, 75, 82) : hsl(h, 80, 58); c.strokeStyle = hsl(h + 20, 55, 24); c.lineWidth = Math.max(1, s * 0.028); c.beginPath(); c.arc(bx, by, r, 0, TAU); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(bx - r * 0.35, by - r * 0.35, r * 0.25, 0, TAU); c.fill(); c.fillStyle = fr ? '#e8f6ff' : '#7fd47a'; c.beginPath(); c.ellipse(bx + r * 0.3, by - r * 1.0, r * 0.5, r * 0.22, -0.6, 0, TAU); c.fill(); c.stroke(); if (fr) { c.fillStyle = '#fff'; starPath(c, bx + r * 0.25, by + r * 0.2, r * 0.45, r * 0.15, 6, 0); c.fill(); } }
  } else if (it.k === 'dew') {
    glow(c, x, y, s * 0.4, 190, 100, 75, 0.5); c.fillStyle = '#9fefff'; c.strokeStyle = '#1f7f9a'; c.lineWidth = Math.max(1, s * 0.03);
    c.beginPath(); c.moveTo(x, y - s * 0.26); c.bezierCurveTo(x + s * 0.2, y - s * 0.02, x + s * 0.16, y + s * 0.2, x, y + s * 0.2); c.bezierCurveTo(x - s * 0.16, y + s * 0.2, x - s * 0.2, y - s * 0.02, x, y - s * 0.26); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x - s * 0.05, y + s * 0.03, s * 0.03, s * 0.06, 0.3, 0, TAU); c.fill();
  } else if (it.k === 'egg') {
    const h = it.hue || 300, wob = Math.sin(t * 5 + x) * 0.05 * (it.warm ? 1 + it.warm / 40 : 1);
    c.translate(x, y); c.rotate(wob); glow(c, 0, 0, s * 0.5, h, 100, 70, 0.4 + (it.warm || 0) / 250);
    const g = c.createRadialGradient(-s * 0.08, -s * 0.12, s * 0.02, 0, 0, s * 0.36); g.addColorStop(0, hsl(h, 80, 92)); g.addColorStop(1, hsl(h, 60, 66));
    c.fillStyle = g; c.strokeStyle = hsl(h + 20, 40, 26); c.lineWidth = Math.max(1, s * 0.03); c.beginPath(); c.ellipse(0, 0, s * 0.22, s * 0.29, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = hsl(h + 140, 75, 68); for (const [a, b2, q] of [[-0.08, -0.1, 0.035], [0.09, 0.02, 0.045], [-0.04, 0.14, 0.03], [0.06, -0.17, 0.025]]) { c.beginPath(); c.arc(a * s, b2 * s, q * s, 0, TAU); c.fill(); }
    if (it.twin) { c.fillStyle = hsl(h + 180, 85, 70, 0.92); c.beginPath(); c.ellipse(0, s * 0.02, s * 0.205, s * 0.065, -0.25, 0, TAU); c.fill(); c.fillStyle = '#fff'; starPath(c, -s * 0.02, -s * 0.14, s * 0.06, s * 0.024, 4, t * 2); c.fill(); starPath(c, s * 0.03, s * 0.17, s * 0.045, s * 0.018, 4, -t * 2); c.fill(); }
  } else if (it.k === 'gift') {
    glow(c, x, y, s * 0.5, 300, 100, 75, 0.3 + 0.2 * Math.sin(t * 4 + x)); drawThing(c, it.id, x, y, s * 0.84, t);
  } else if (it.k === 'chest') {
    glow(c, x, y, s * 0.42, 44, 100, 65, 0.3); c.strokeStyle = '#3d1f0f'; c.lineWidth = Math.max(1, s * 0.03);
    c.fillStyle = '#9a5a2c'; rrect(c, x - s * 0.24, y - s * 0.06, s * 0.48, s * 0.26, s * 0.04); c.fill(); c.stroke();
    c.fillStyle = '#b9743a'; c.beginPath(); c.moveTo(x - s * 0.25, y - s * 0.05); c.quadraticCurveTo(x - s * 0.25, y - s * 0.26, x, y - s * 0.26); c.quadraticCurveTo(x + s * 0.25, y - s * 0.26, x + s * 0.25, y - s * 0.05); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd766'; c.fillRect(x - s * 0.04, y - s * 0.25, s * 0.08, s * 0.44); c.beginPath(); c.arc(x, y - s * 0.03, s * 0.055, 0, TAU); c.fill(); c.stroke();
  }
  c.restore();
}
function drawGloom(c, e, x, y, s, t) { // x centre, y ground
  const g = GLOOMS[e.g], wob = Math.sin(t * 3 + x) * s * 0.03, w = s * 0.34; let top = y - s * 0.72 + wob;
  c.save(); c.lineJoin = 'round';
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y, w * 0.9, s * 0.07, 0, 0, TAU); c.fill();
  const gr = c.createRadialGradient(x, y - s * 0.4, 0, x, y - s * 0.4, s * 0.7); gr.addColorStop(0, hsl(g.hue, 60, 30, 0.55)); gr.addColorStop(1, hsl(g.hue, 60, 20, 0)); c.fillStyle = gr; c.beginPath(); c.arc(x, y - s * 0.4, s * 0.7, 0, TAU); c.fill();
  c.fillStyle = hsl(g.hue, 35, 13); c.strokeStyle = hsl(g.hue, 75, 58, 0.8); c.lineWidth = Math.max(1, s * 0.03);
  c.beginPath(); c.moveTo(x - w, y - s * 0.08);
  c.bezierCurveTo(x - w * 1.1, top + s * 0.1, x - w * 0.6, top, x, top); c.bezierCurveTo(x + w * 0.6, top, x + w * 1.1, top + s * 0.1, x + w, y - s * 0.08);
  for (let i = 0; i < 4; i++) { const x0 = x + w - (i + 0.5) * w * 0.5, x1 = x + w - (i + 1) * w * 0.5; c.quadraticCurveTo(x0, y + s * 0.06 * (i % 2 ? -1 : 1) + Math.sin(t * 5 + i) * s * 0.02, x1, y - s * 0.08); }
  c.closePath(); c.fill(); c.stroke();
  for (const sd of [-1, 1]) { c.fillStyle = hsl(g.hue, 35, 13); c.beginPath(); c.moveTo(x + sd * w * 0.35, top + s * 0.06); c.lineTo(x + sd * w * 0.75, top - s * 0.12); c.lineTo(x + sd * w * 0.75, top + s * 0.14); c.closePath(); c.fill(); c.stroke(); }
  const ey = top + s * 0.3; glow(c, x, ey, s * 0.4, g.hue, 100, 65, 0.35);
  c.fillStyle = hsl(g.hue, 100, 78); for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(x + sd * w * 0.16, ey + s * 0.03); c.lineTo(x + sd * w * 0.62, ey - s * 0.08); c.lineTo(x + sd * w * 0.58, ey + s * 0.07); c.closePath(); c.fill(); }
  c.strokeStyle = hsl(g.hue, 100, 78); c.beginPath(); c.moveTo(x - w * 0.3, ey + s * 0.2); c.lineTo(x - w * 0.1, ey + s * 0.16); c.lineTo(x + w * 0.1, ey + s * 0.2); c.lineTo(x + w * 0.3, ey + s * 0.16); c.stroke();
  if (e.boss) { c.fillStyle = '#ffd766'; c.strokeStyle = '#7a4a10'; c.lineWidth = Math.max(1, s * 0.025); c.beginPath(); c.moveTo(x - w * 0.42, top + s * 0.04); c.lineTo(x - w * 0.5, top - s * 0.16); c.lineTo(x - w * 0.2, top - s * 0.06); c.lineTo(x, top - s * 0.2); c.lineTo(x + w * 0.2, top - s * 0.06); c.lineTo(x + w * 0.5, top - s * 0.16); c.lineTo(x + w * 0.42, top + s * 0.04); c.closePath(); c.fill(); c.stroke(); top -= s * 0.14; }
  for (let i = 0; i < e.tough; i++) { c.fillStyle = '#ff7d9c'; c.strokeStyle = '#3a0d1f'; c.lineWidth = 1; c.beginPath(); c.arc(x + (i - (e.tough - 1) / 2) * s * 0.15, top - s * 0.16, s * 0.05, 0, TAU); c.fill(); c.stroke(); }
  c.restore();
}

/* ---------- tiles ---------- */
function drawFloor(c, x, y, s, B, seed) {
  const r = RNG(seed), [fh, fs, fl] = B.fl, l = fl + (r.f() * 6 - 3);
  rrect(c, x + 1, y + 1, s - 2, s - 2, s * 0.2); c.fillStyle = hsl(fh + r.f() * 10 - 5, fs, l); c.fill();
  c.strokeStyle = hsl(fh, fs, l + 9, 0.5); c.lineWidth = 1; c.stroke();
  for (let i = 0; i < 2; i++) { c.fillStyle = hsl(fh, fs, l + (r.chance(0.5) ? 9 : -8), 0.6); c.beginPath(); c.ellipse(x + s * (0.2 + r.f() * 0.6), y + s * (0.2 + r.f() * 0.6), s * 0.05, s * 0.03, r.f() * 3, 0, TAU); c.fill(); }
  if (r.chance(0.3)) { const [ah, as, al] = B.accent, ax = x + s * (0.2 + r.f() * 0.6), ay = y + s * (0.3 + r.f() * 0.5); c.strokeStyle = hsl(ah, as, al, 0.7); c.lineWidth = Math.max(1, s * 0.03); c.lineCap = 'round'; for (const d of [-1, 0, 1]) { c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + d * s * 0.06, ay - s * 0.1); c.stroke(); } }
}
function drawWall(c, x, y, s, B, seed) {
  const r = RNG(seed), [wh, ws, wl] = B.wc, [ah, as, al] = B.accent, cx = x + s / 2, cy = y + s / 2;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  switch (B.wall) {
    case 'tree':
      for (let i = 0; i < 4; i++) { const px = cx + (r.f() - 0.5) * s * 0.5, py = cy + (r.f() - 0.5) * s * 0.45, q = s * (0.22 + r.f() * 0.14); c.fillStyle = hsl(wh + r.f() * 20 - 10, ws, wl + i * 3); c.beginPath(); c.arc(px, py, q, 0, TAU); c.fill(); c.fillStyle = hsl(wh - 20, ws + 10, wl + 14, 0.5); c.beginPath(); c.arc(px - q * 0.3, py - q * 0.3, q * 0.4, 0, TAU); c.fill(); }
      if (r.chance(0.35)) { glow(c, cx, cy, s * 0.3, ah, as, al, 0.4); c.fillStyle = hsl(ah, as, al); c.beginPath(); c.arc(cx + (r.f() - 0.5) * s * 0.4, cy + (r.f() - 0.5) * s * 0.4, s * 0.035, 0, TAU); c.fill(); }
      break;
    case 'basalt': {
      c.fillStyle = hsl(wh, ws, wl); c.strokeStyle = hsl(wh, ws, wl + 10); c.lineWidth = 1; c.beginPath(); const n = 6; for (let i = 0; i < n; i++) { const a = i / n * TAU + r.f() * 0.4, q = s * (0.34 + r.f() * 0.13); c[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * q, cy + Math.sin(a) * q); } c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = hsl(ah, as, al, 0.85); c.lineWidth = Math.max(1, s * 0.035); c.beginPath(); let px = cx - s * 0.2, py = cy - s * 0.15 + r.f() * s * 0.2; c.moveTo(px, py); for (let i = 0; i < 3; i++) { px += s * 0.14; py += (r.f() - 0.5) * s * 0.25; c.lineTo(px, py); } c.stroke(); glow(c, cx, cy, s * 0.4, ah, as, al, 0.22);
      break;
    }
    case 'coral':
      for (let i = 0; i < 3; i++) { const bx = cx + (i - 1) * s * 0.2, h2 = s * (0.3 + r.f() * 0.25), lean = (r.f() - 0.5) * s * 0.2; c.strokeStyle = hsl(wh + r.f() * 40 - 20, ws, wl - 8 + i * 5); c.lineWidth = s * 0.12; c.beginPath(); c.moveTo(bx, cy + s * 0.32); c.quadraticCurveTo(bx, cy, bx + lean, cy + s * 0.32 - h2); c.stroke(); c.fillStyle = hsl(wh, ws + 10, wl + 18); c.beginPath(); c.arc(bx + lean, cy + s * 0.32 - h2, s * 0.05, 0, TAU); c.fill(); }
      c.strokeStyle = hsl(ah, as, al, 0.5); c.lineWidth = 1; c.beginPath(); c.arc(cx + s * 0.25, cy - s * 0.25, s * 0.04, 0, TAU); c.stroke();
      break;
    case 'cloud':
      for (let i = 0; i < 5; i++) { c.fillStyle = hsl(wh + r.f() * 30, ws, wl - r.f() * 14, 0.42 + r.f() * 0.25); c.beginPath(); c.arc(cx + (r.f() - 0.5) * s * 0.6, cy + (r.f() - 0.5) * s * 0.4, s * (0.2 + r.f() * 0.12), 0, TAU); c.fill(); }
      break;
    case 'crystal':
      glow(c, cx, cy, s * 0.5, wh, ws, wl, 0.3);
      for (let i = 0; i < 3; i++) { const bx = cx + (i - 1) * s * 0.2 + (r.f() - 0.5) * s * 0.1, h2 = s * (0.4 + r.f() * 0.3), w2 = s * (0.08 + r.f() * 0.05), by = cy + s * 0.32, lean = (i - 1) * s * 0.08; const g = c.createLinearGradient(bx, by - h2, bx, by); g.addColorStop(0, hsl(wh - 30 + i * 25, ws + 10, wl + 18)); g.addColorStop(1, hsl(wh, ws, wl - 30)); c.fillStyle = g; c.strokeStyle = hsl(wh, ws, wl + 25, 0.7); c.lineWidth = 1; c.beginPath(); c.moveTo(bx - w2, by); c.lineTo(bx - w2 + lean, by - h2 * 0.8); c.lineTo(bx + lean, by - h2); c.lineTo(bx + w2 + lean, by - h2 * 0.8); c.lineTo(bx + w2, by); c.closePath(); c.fill(); c.stroke(); }
      break;
    case 'menhir': {
      const h2 = s * (0.62 + r.f() * 0.2), w2 = s * (0.22 + r.f() * 0.08), by = cy + s * 0.36, g = c.createLinearGradient(cx - w2, 0, cx + w2, 0); g.addColorStop(0, hsl(wh, ws, wl + 8)); g.addColorStop(1, hsl(wh, ws + 4, wl - 14));
      c.fillStyle = g; c.strokeStyle = hsl(wh, ws, wl - 26); c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx - w2, by); c.quadraticCurveTo(cx - w2 * 1.1, by - h2, cx - w2 * 0.3, by - h2); c.quadraticCurveTo(cx + w2 * 1.2, by - h2 * 1.02, cx + w2, by); c.closePath(); c.fill(); c.stroke();
      glow(c, cx, by - h2 * 0.55, s * 0.22, ah, as, al, 0.35); c.strokeStyle = hsl(ah, as, al, 0.9); c.lineWidth = Math.max(1, s * 0.03); const k = r.int(0, 2); c.beginPath();
      if (k === 0) { c.arc(cx, by - h2 * 0.55, s * 0.06, 0, TAU); c.moveTo(cx, by - h2 * 0.4); c.lineTo(cx, by - h2 * 0.28); } else if (k === 1) { c.moveTo(cx - s * 0.06, by - h2 * 0.4); c.lineTo(cx, by - h2 * 0.68); c.lineTo(cx + s * 0.06, by - h2 * 0.4); } else { c.moveTo(cx - s * 0.06, by - h2 * 0.62); c.lineTo(cx + s * 0.06, by - h2 * 0.5); c.lineTo(cx - s * 0.06, by - h2 * 0.38); }
      c.stroke(); break;
    }
  }
  c.restore();
}
function drawOb(c, type, x, y, s, t, cleared, seed, B) {
  const r = RNG(seed), cx = x + s / 2, cy = y + s / 2;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  if (type !== 'water' && type !== 'chasm') drawFloor(c, x, y, s, B, seed);
  if (type === 'bramble') {
    if (cleared) { for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(30,20,20,.5)'; c.beginPath(); c.ellipse(x + s * (0.2 + r.f() * 0.6), y + s * (0.25 + r.f() * 0.5), s * 0.12, s * 0.06, r.f() * 3, 0, TAU); c.fill(); } for (let i = 0; i < 3; i++) { const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i * 2)); c.fillStyle = 'rgba(255,150,60,' + a + ')'; c.beginPath(); c.arc(x + s * (0.25 + r.f() * 0.5), y + s * (0.3 + r.f() * 0.4), s * 0.025, 0, TAU); c.fill(); } }
    else {
      for (let i = 0; i < 6; i++) { const a0 = r.f() * TAU, x0 = cx + Math.cos(a0) * s * 0.42, y0 = cy + Math.sin(a0) * s * 0.42, x1 = cx - Math.cos(a0 + r.f() - 0.5) * s * 0.42, y1 = cy - Math.sin(a0 + r.f() - 0.5) * s * 0.42, mx = cx + (r.f() - 0.5) * s * 0.5, my = cy + (r.f() - 0.5) * s * 0.5; c.strokeStyle = '#12261c'; c.lineWidth = s * 0.11; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, x1, y1); c.stroke(); c.strokeStyle = hsl(135 + i * 8, 40, 30); c.lineWidth = s * 0.06; c.stroke(); c.fillStyle = '#e8d9b0'; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + s * 0.07, my - s * 0.09); c.lineTo(mx + s * 0.06, my + s * 0.02); c.fill(); }
      for (let i = 0; i < 3; i++) { c.fillStyle = '#ff6f91'; c.beginPath(); c.arc(x + s * (0.25 + r.f() * 0.5), y + s * (0.25 + r.f() * 0.5), s * 0.045, 0, TAU); c.fill(); }
    }
  } else if (type === 'water') {
    rrect(c, x + 1, y + 1, s - 2, s - 2, s * 0.2);
    if (cleared) { const g = c.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, '#e6fbff'); g.addColorStop(1, '#9fd6ee'); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5; c.stroke(); c.strokeStyle = 'rgba(80,140,180,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + s * 0.3, y + s * 0.2); c.lineTo(x + s * 0.45, y + s * 0.5); c.lineTo(x + s * 0.35, y + s * 0.75); c.moveTo(x + s * 0.45, y + s * 0.5); c.lineTo(x + s * 0.7, y + s * 0.6); c.stroke(); c.fillStyle = '#fff'; starPath(c, x + s * 0.72, y + s * 0.28, s * 0.07, s * 0.025, 4, t); c.fill(); }
    else { const g = c.createLinearGradient(x, y, x, y + s); g.addColorStop(0, '#2f8fc4'); g.addColorStop(1, '#14457a'); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(190,240,255,.55)'; c.lineWidth = Math.max(1, s * 0.035); for (let i = 0; i < 3; i++) { const wy = y + s * (0.3 + i * 0.22), off = Math.sin(t * 1.6 + i * 1.7) * s * 0.08; c.beginPath(); c.moveTo(x + s * 0.2 + off, wy); c.quadraticCurveTo(x + s * 0.35 + off, wy - s * 0.07, x + s * 0.5 + off, wy); c.quadraticCurveTo(x + s * 0.65 + off, wy + s * 0.07, x + s * 0.8 + off, wy); c.stroke(); } }
  } else if (type === 'boulder') {
    if (cleared) { for (let i = 0; i < 5; i++) { c.fillStyle = hsl(260, 8, 40 + r.f() * 20); c.strokeStyle = '#1c1826'; c.lineWidth = 1; c.beginPath(); c.ellipse(x + s * (0.2 + r.f() * 0.6), y + s * (0.3 + r.f() * 0.5), s * (0.05 + r.f() * 0.05), s * 0.045, r.f() * 3, 0, TAU); c.fill(); c.stroke(); } }
    else { const g = c.createRadialGradient(cx - s * 0.12, cy - s * 0.18, s * 0.05, cx, cy, s * 0.5); g.addColorStop(0, '#b3abc4'); g.addColorStop(1, '#4b4560'); c.fillStyle = g; c.strokeStyle = '#1c1826'; c.lineWidth = Math.max(1.2, s * 0.035); c.beginPath(); const n = 8; for (let i = 0; i <= n; i++) { const a = i / n * TAU, q = s * (0.36 + (RNG(seed + (i % n)).f() - 0.5) * 0.1); const px = cx + Math.cos(a) * q, py = cy + Math.sin(a) * q * 0.9 + s * 0.03; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); c.fill(); c.stroke(); c.strokeStyle = 'rgba(28,24,38,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - s * 0.05, cy - s * 0.2); c.lineTo(cx + s * 0.04, cy); c.lineTo(cx - s * 0.02, cy + s * 0.18); c.stroke(); c.fillStyle = 'rgba(120,200,120,.75)'; c.beginPath(); c.ellipse(cx + s * 0.12, cy - s * 0.24, s * 0.12, s * 0.05, 0.3, 0, TAU); c.fill(); }
  } else if (type === 'chasm') {
    rrect(c, x + 1, y + 1, s - 2, s - 2, s * 0.2); const g = c.createRadialGradient(cx, cy, s * 0.05, cx, cy, s * 0.6); g.addColorStop(0, '#05030f'); g.addColorStop(1, '#1a1338'); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(150,130,220,.4)'; c.lineWidth = 1; c.stroke();
    for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(200,190,255,' + (0.3 + 0.5 * Math.abs(Math.sin(t * 1.5 + i * 1.3))) + ')'; c.beginPath(); c.arc(x + s * (0.2 + r.f() * 0.6), y + s * (0.2 + r.f() * 0.6), s * 0.015, 0, TAU); c.fill(); }
    if (cleared) { c.strokeStyle = '#2f6b33'; c.lineWidth = s * 0.07; for (const o2 of [0.3, 0.7]) { c.beginPath(); c.moveTo(x, y + s * o2); c.quadraticCurveTo(cx, y + s * (o2 + 0.06), x + s, y + s * o2); c.stroke(); c.beginPath(); c.moveTo(x + s * o2, y); c.quadraticCurveTo(x + s * (o2 + 0.06), cy, x + s * o2, y + s); c.stroke(); } c.fillStyle = '#6cc46a'; c.strokeStyle = '#1d4a22'; c.lineWidth = 1; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(x + s * (0.2 + i * 0.2), y + s * (0.2 + j * 0.2), s * 0.11, s * 0.06, (i + j) * 0.8, 0, TAU); c.fill(); c.stroke(); } c.fillStyle = '#ffc2dc'; c.beginPath(); c.arc(cx + s * 0.1, cy - s * 0.1, s * 0.04, 0, TAU); c.fill(); }
  } else if (type === 'storm') {
    if (cleared) { c.strokeStyle = 'rgba(220,240,255,.35)'; c.lineWidth = Math.max(1, s * 0.03); c.beginPath(); c.arc(cx, cy, s * 0.2, t % TAU, (t % TAU) + 4); c.stroke(); }
    else { const bobc = Math.sin(t * 1.5) * s * 0.03, fl = Math.sin(t * 7 + seed) > 0.86; for (let i = 0; i < 4; i++) { c.fillStyle = hsl(232, 22, fl ? 55 : 26 + i * 4); c.beginPath(); c.arc(cx + (i - 1.5) * s * 0.17, cy - s * 0.08 + bobc + (i % 2) * s * 0.05, s * 0.2, 0, TAU); c.fill(); } c.strokeStyle = 'rgba(150,190,255,.6)'; c.lineWidth = 1; for (let i = 0; i < 4; i++) { const rx = x + s * (0.25 + i * 0.17), ry = cy + s * 0.14 + ((t * 60 + i * 9) % (s * 0.25)); c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx - s * 0.03, ry + s * 0.08); c.stroke(); } if (fl) { glow(c, cx, cy, s * 0.6, 55, 100, 75, 0.5); c.strokeStyle = '#fff7a8'; c.lineWidth = Math.max(1.5, s * 0.045); c.beginPath(); c.moveTo(cx + s * 0.03, cy); c.lineTo(cx - s * 0.06, cy + s * 0.16); c.lineTo(cx + s * 0.04, cy + s * 0.16); c.lineTo(cx - s * 0.03, cy + s * 0.34); c.stroke(); } }
  } else if (type === 'shadow') {
    if (cleared) { for (let i = 0; i < 4; i++) { const a = t * 0.8 + i * 1.6; c.fillStyle = 'rgba(255,230,150,' + (0.4 + 0.4 * Math.sin(t * 2 + i)) + ')'; c.beginPath(); c.arc(cx + Math.cos(a) * s * 0.25, cy + Math.sin(a * 1.3) * s * 0.2, s * 0.02, 0, TAU); c.fill(); } }
    else { const g = c.createRadialGradient(cx, cy, s * 0.05, cx, cy, s * 0.62); g.addColorStop(0, 'rgba(8,2,20,.97)'); g.addColorStop(0.7, 'rgba(40,12,70,.92)'); g.addColorStop(1, 'rgba(60,20,100,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, s * 0.62, 0, TAU); c.fill(); c.strokeStyle = 'rgba(170,110,255,.5)'; c.lineWidth = Math.max(1, s * 0.03); for (let i = 0; i < 3; i++) { const a = t * (0.9 + i * 0.3) + i * 2; c.beginPath(); c.arc(cx, cy, s * (0.16 + i * 0.1), a, a + 2.2); c.stroke(); } if (Math.sin(t * 0.9 + seed) > -0.6) { c.fillStyle = '#d9b8ff'; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(cx + sd * s * 0.09, cy - s * 0.02, s * 0.03, s * 0.045, 0, 0, TAU); c.fill(); } } }
  } else if (type === 'fog') {
    if (cleared) { c.strokeStyle = 'rgba(220,240,255,.25)'; c.lineWidth = Math.max(1, s * 0.03); for (let i = 0; i < 2; i++) { c.beginPath(); c.moveTo(x + s * 0.2, cy + i * s * 0.15); c.quadraticCurveTo(cx, cy - s * 0.1 + i * s * 0.15 + Math.sin(t + i) * s * 0.04, x + s * 0.8, cy + i * s * 0.15); c.stroke(); } }
    else { for (let i = 0; i < 6; i++) { const px = cx + Math.sin(t * 0.6 + i * 1.7) * s * 0.18 + (i % 3 - 1) * s * 0.18, py = cy + (i < 3 ? -0.1 : 0.14) * s + Math.cos(t * 0.5 + i) * s * 0.03; c.fillStyle = 'rgba(214,232,248,' + (0.55 + 0.1 * Math.sin(t + i)) + ')'; c.beginPath(); c.arc(px, py, s * (0.17 + (i % 2) * 0.05), 0, TAU); c.fill(); } c.fillStyle = 'rgba(150,180,215,.35)'; rrect(c, x + s * 0.1, cy + s * 0.12, s * 0.8, s * 0.22, s * 0.1); c.fill(); }
  } else if (type === 'ruin') {
    if (cleared) { for (let i = 0; i < 5; i++) { c.fillStyle = hsl(250, 8, 38 + r.f() * 18); c.beginPath(); c.ellipse(x + s * (0.2 + r.f() * 0.6), y + s * (0.35 + r.f() * 0.45), s * 0.06, s * 0.04, r.f() * 3, 0, TAU); c.fill(); } c.fillStyle = '#5fbf6a'; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(x + s * (0.25 + r.f() * 0.5), y + s * (0.3 + r.f() * 0.5), s * 0.05, s * 0.025, r.f() * 3, 0, TAU); c.fill(); } }
    else {
      c.strokeStyle = '#1c1826'; c.lineWidth = Math.max(1.2, s * 0.03);
      for (const [ox, oy, w2, h2] of [[0.14, 0.5, 0.42, 0.32], [0.48, 0.46, 0.38, 0.36], [0.28, 0.16, 0.44, 0.34]]) { const g = c.createLinearGradient(x + s * ox, 0, x + s * (ox + w2), 0); g.addColorStop(0, '#a49cb6'); g.addColorStop(1, '#5d5672'); c.fillStyle = g; rrect(c, x + s * ox, y + s * oy, s * w2, s * h2, s * 0.06); c.fill(); c.stroke(); }
      c.strokeStyle = '#3f9a52'; c.lineWidth = Math.max(1.5, s * 0.05); for (let i = 0; i < 3; i++) { const sx2 = x + s * (0.2 + i * 0.3); c.beginPath(); c.moveTo(sx2, y + s * 0.92); c.bezierCurveTo(sx2 + s * 0.15, y + s * 0.6, sx2 - s * 0.15, y + s * 0.4, sx2 + s * 0.08, y + s * 0.14); c.stroke(); }
      c.fillStyle = '#7fd47a'; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(x + s * (0.2 + r.f() * 0.6), y + s * (0.2 + r.f() * 0.6), s * 0.05, s * 0.03, r.f() * 3, 0, TAU); c.fill(); }
    }
  } else if (type === 'crystal') {
    if (cleared) { for (let i = 0; i < 6; i++) { c.fillStyle = hsl(280, 80, 70 + r.f() * 15, 0.8); c.beginPath(); const px = x + s * (0.2 + r.f() * 0.6), py = y + s * (0.35 + r.f() * 0.45); c.moveTo(px, py - s * 0.05); c.lineTo(px + s * 0.03, py); c.lineTo(px, py + s * 0.03); c.lineTo(px - s * 0.03, py); c.closePath(); c.fill(); } }
    else {
      glow(c, cx, cy, s * 0.6, 280, 90, 70, 0.3 + 0.15 * Math.sin(t * 3 + seed)); c.strokeStyle = '#2a1840'; c.lineWidth = Math.max(1, s * 0.03);
      for (const [dx, h, w2] of [[-0.2, 0.6, 0.13], [0.02, 0.8, 0.16], [0.22, 0.55, 0.12]]) { const bx = cx + dx * s, by = y + s * 0.9, g = c.createLinearGradient(bx, by - h * s, bx, by); g.addColorStop(0, hsl(290, 90, 88)); g.addColorStop(1, hsl(270, 70, 50)); c.fillStyle = g; c.beginPath(); c.moveTo(bx - w2 * s, by); c.lineTo(bx - w2 * s * 0.8, by - h * s * 0.75); c.lineTo(bx, by - h * s); c.lineTo(bx + w2 * s * 0.8, by - h * s * 0.75); c.lineTo(bx + w2 * s, by); c.closePath(); c.fill(); c.stroke(); }
      c.strokeStyle = 'rgba(255,240,255,' + (0.3 + 0.3 * Math.sin(t * 6 + seed)) + ')'; c.lineWidth = 1; for (let i = 1; i <= 2; i++) { c.beginPath(); c.arc(cx, cy, s * (0.3 + i * 0.1 + (t % 1) * 0.05), -2.4, -0.7); c.stroke(); }
    }
  }
  c.restore();
}
function drawGate(c, x, y, s, t, open, B, seed) {
  drawFloor(c, x, y, s, B, seed); const cx = x + s / 2;
  c.save(); c.lineCap = 'round';
  if (!open) { glow(c, cx, y + s * 0.5, s * 0.55, 215, 90, 75, 0.35); c.strokeStyle = 'rgba(200,225,255,' + (0.7 + 0.2 * Math.sin(t * 3)) + ')'; c.lineWidth = Math.max(2, s * 0.06); for (let i = 0; i < 4; i++) { const bx = x + s * (0.26 + i * 0.16); c.beginPath(); c.moveTo(bx, y + s * 0.22); c.lineTo(bx, y + s * 0.85); c.stroke(); } }
  c.fillStyle = '#7d7594'; c.strokeStyle = '#1c1826'; c.lineWidth = Math.max(1, s * 0.03);
  for (const sd of [0.08, 0.76]) { rrect(c, x + s * sd, y + s * 0.12, s * 0.16, s * 0.78, s * 0.05); c.fill(); c.stroke(); }
  c.fillStyle = open ? '#9df2d2' : '#dfe9ff'; c.beginPath(); c.arc(cx, y + s * 0.14, s * 0.11, 0.5 * Math.PI, 1.5 * Math.PI); c.arc(cx + s * 0.05, y + s * 0.14, s * 0.085, 1.5 * Math.PI, 0.5 * Math.PI, true); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
function drawPlate(c, x, y, s, t, held) {
  const cx = x + s / 2, cy = y + s / 2; c.save();
  glow(c, cx, cy, s * 0.5, held ? 160 : 215, 90, 72, held ? 0.55 : 0.25 + 0.15 * Math.sin(t * 2.5));
  c.fillStyle = '#6f6788'; c.strokeStyle = '#1c1826'; c.lineWidth = Math.max(1, s * 0.03); c.beginPath(); c.ellipse(cx, cy + s * 0.05, s * 0.34, s * 0.26, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#8f87aa'; c.beginPath(); c.ellipse(cx, cy + s * 0.02, s * 0.28, s * 0.2, 0, 0, TAU); c.fill();
  c.fillStyle = held ? '#9df2d2' : '#dfe9ff'; c.beginPath(); c.arc(cx - s * 0.02, cy + s * 0.02, s * 0.1, 0.5 * Math.PI, 1.5 * Math.PI); c.arc(cx + s * 0.03, cy + s * 0.02, s * 0.08, 1.5 * Math.PI, 0.5 * Math.PI, true); c.closePath(); c.fill();
  c.restore();
}
function drawPortal(c, x, y, s, t, awake) {
  const cx = x + s / 2, cy = y + s / 2; c.save();
  glow(c, cx, cy, s * 0.75, awake ? 280 : 250, 90, 68, awake ? 0.7 : 0.25);
  for (let i = 0; i < 3; i++) { c.strokeStyle = awake ? hsl(46 + i * 110, 95, 72, 0.9) : 'rgba(170,160,210,.5)'; c.lineWidth = Math.max(1.5, s * 0.05); const a = t * (awake ? 1.6 : 0.4) * (i % 2 ? -1 : 1) + i * 2; c.beginPath(); c.ellipse(cx, cy, s * (0.36 - i * 0.08), s * (0.4 - i * 0.09), 0, a, a + 4.2); c.stroke(); }
  if (awake) { c.fillStyle = '#fff'; starPath(c, cx, cy, s * 0.11, s * 0.04, 4, t * 2); c.fill(); }
  c.restore();
}
function drawIslet(c, x, y, s, t, B) {
  const cx = x + s / 2, cy = y + s / 2 + Math.sin(t * 1.4 + x) * s * 0.03, [fh, fs, fl] = B.fl; c.save();
  c.fillStyle = hsl(fh + 20, fs * 0.6, fl - 14); c.beginPath(); c.moveTo(cx - s * 0.32, cy + s * 0.08); c.quadraticCurveTo(cx - s * 0.1, cy + s * 0.5, cx, cy + s * 0.46); c.quadraticCurveTo(cx + s * 0.14, cy + s * 0.42, cx + s * 0.32, cy + s * 0.08); c.closePath(); c.fill();
  c.fillStyle = hsl(fh, fs + 8, fl + 10); c.strokeStyle = hsl(fh, fs, fl + 24, 0.7); c.lineWidth = 1; c.beginPath(); c.ellipse(cx, cy + s * 0.08, s * 0.34, s * 0.14, 0, 0, TAU); c.fill(); c.stroke();
  c.restore(); return cy;
}
