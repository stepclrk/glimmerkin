/* ===== Nest play: more ways to be with the Glimmerkin and the littles. None of it changes quests or balance. ===== */

// Nest play rolls its own dice, so that it never moves the game's shared random numbers (and the worlds they make).
const playR = RNG((Date.now() % 2147483646) + 1), prnd = (a, b) => a + playR.f() * (b - a);

/* ---------- its favourite spot ---------- */
// Where a finger strokes the Glimmerkin decides how it reacts. One spot a day is its favourite.
const SPOTS = { head: 'the top of its head', left: 'the cheek on the left', right: 'the cheek on the right', tummy: 'its tummy' };
function spotAt(pt) {
  const H = home, ps = H.petS, ny = H.gy + H.ry * 0.12, u = (pt.x - H.cx) / ps, v = (ny - pt.y) / ps;
  if (v > 0.66 || (v > 0.4 && Math.abs(u) < 0.16)) return 'head';
  if (v > 0.3) return u < 0 ? 'left' : 'right';   // the player's left, as they look at it
  return 'tummy';
}
function favSpot() { const r = RNG(localDay() * 7 + 13 + (S.pet.seed % 100000)); return r.pick(Object.keys(SPOTS)); }
/* How the Glimmerkin answers a stroke on a spot: eyes closed for the head, a lean into the finger for a cheek,
   a happy wiggle for the tummy. The favourite spot gets a bigger purr and sparkles, and counts double for a cuddle. */
function spotStroke(spot) {
  const H = home, pa = H.pa, fav = spot === favSpot();
  if (spot === 'head') { pa.squash = Math.max(pa.squash, 0.06); setMood('happy', 1.1); }
  else if (spot === 'tummy') { pa.wiggle = 0.7; setMood('happy', 1); }
  else pa.tilt = (spot === 'left' ? -1 : 1) * 0.12;
  if (!fav) return false;
  const pt = H.ptr || { x: H.cx, y: H.gy - H.petS * 0.6 };
  burst(pt.x, pt.y - 6, 4, 48, { kind: 'star', v: 70, size: 4, g: 0, up: 30 });
  if (H.strokes % 2 === 0) sfx('purr');
  const day = localDay(); if (!S.spot || S.spot.day !== day) S.spot = { day, found: false };
  if (!S.spot.found) { S.spot.found = true; S.j.spots = (S.j.spots || 0) + 1; S.j.spotKinds = S.j.spotKinds || {}; S.j.spotKinds[spot] = (S.j.spotKinds[spot] || 0) + 1; sfx('tinkle'); toast('That\'s the spot! ' + S.pet.name + ' loves a stroke on ' + SPOTS[spot] + ' today.', 3600); save(); }
  return true;
}

/* ---------- catch! ---------- */
// A berry flicked upwards from the pantry flies in an arc. The Glimmerkin watches it and leaps to catch it, which
// feeds it exactly as a tap does. A berry it misses lands on the nest, and the nearest little scrambles for it.
const TOSS_G = 1100;
function flickOf(tr, at) {
  const h = tr.hist || [], b = h[h.length - 1]; if (!b || (at || performance.now()) - b.t > 150) return null;   // still moving when let go
  const a = h.find(q => b.t - q.t < 200) || b, dt = (b.t - a.t) / 1000; if (dt <= 0) return null;
  const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt; return vy < -500 && -vy > Math.abs(vx) * 0.8 ? { vx, vy } : null;
}
function tossBerry(el, x, y, vx, vy) {
  const p = S.pet, H = home; if (H.toss) return;
  if (p.asleep) { toast(p.name + ' is asleep. Wake it first.'); return; }
  if (!(S.pantry[el] > 0)) return;
  if (p.belly >= 97) { toast(p.name + ' is full.'); sfx('no'); return; }
  S.pantry[el]--; if (!ui.tray.hidden) buildTray();
  // Up and over towards the Glimmerkin: the flick sets the height and the lean, and the arc is kept within its reach.
  vy = clamp(vy * 0.9, -1250, -720); const up = -vy / TOSS_G, peak = y - vy * vy / (2 * TOSS_G), down = Math.sqrt(Math.max(0, 2 * (H.gy - H.petS * 0.9 - peak) / TOSS_G));
  const aim = (H.cx - x) / (up + down), lean = clamp(vx * 0.15, -H.petS * 1.2, H.petS * 1.2) / (up + down);
  H.toss = { el, x, y, vx: aim + lean, vy, t: 0 }; sfx('pick');
}
function drawToss(c, H, dt) {
  const b = H.toss; if (!b) return; const pa = H.pa, ps = H.petS;
  if (b.land) {   // missed: it lies on the nest until a little gets to it
    b.t += dt; drawItem(c, { k: 'berry', el: b.el }, b.x, b.y - 10, 56, 0);
    const f = b.by && litOf(b.by); if (f) { f.tx = b.x + (f.x < b.x ? -1 : 1) * H.baseS * 0.14; f.ty = b.y; f.wt = 0.3; f.moodT = 0.4; }
    if (!f || Math.hypot(f.x - b.x, f.y - b.y) < H.baseS * 0.25 || b.t > 2.2) landed(b, f);
    return;
  }
  b.t += dt; b.vy += TOSS_G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
  drawItem(c, { k: 'berry', el: b.el }, b.x, b.y, 64, 0);
  const mouthY = H.gy - ps * 0.5, reach = ps * 0.62;
  if (b.vy > 0 && b.y > mouthY - ps * 0.95 && Math.abs(b.x - H.cx) < reach && !S.pet.asleep) {   // a leap and a snap
    H.toss = null; pa.hopV = 300; setMood('eat', 0.8); H.catchRun = (H.catchRun || 0) + 1;
    burst(b.x, b.y, 12, 48, { kind: 'star', v: 120, size: 4 }); eat(b.el);
    if (H.catchRun > 1) floatText(H.cx, H.gy - ps * 1.4, H.catchRun + ' in a row!');
    if (H.catchRun > (S.j.catchBest || 0)) { S.j.catchBest = H.catchRun; if (H.catchRun === 10) toast('Ten catches in a row! ' + S.pet.name + ' is a champion catcher.', 3600); save(); }
    return;
  }
  const nestY = H.gy + H.ry * 0.4;
  if (b.vy > 0 && b.y > nestY) {   // it fell past
    H.catchRun = 0; const onIsle = Math.abs(b.x - H.cx) < H.rx * 0.9;
    if (!onIsle) { H.toss = null; S.pantry[b.el] = (S.pantry[b.el] || 0) + 1; save(); toast('Missed! The berry floats back to the pantry.'); if (!ui.tray.hidden) buildTray(); return; }
    b.land = true; b.t = 0; b.y = clamp(b.y, H.gy - H.ry * 0.3, H.gy + H.ry * 0.6); sfx('step');
    let best = null, bd = 1e9; for (const f of H.lits) { if (f.perch >= 0) continue; const d = Math.hypot(f.x - b.x, f.y - b.y); if (d < bd) { bd = d; best = f; } }
    b.by = best ? best.l.id : null; if (best) toast('It bounced! The littles scramble for it.', 2000);
  }
}
/* A little reached the dropped berry: it is a treat if it can be one, otherwise it goes back to the pantry. */
function landed(b, f) {
  home.toss = null; S.pantry[b.el] = (S.pantry[b.el] || 0) + 1;
  const l = f && f.l, day = localDay(), full = l && l.treats && l.treats.day === day && l.treats.n >= TREATS_A_DAY;
  if (l && unlocked('treats') && b.el !== 'frost' && !full) giveTreat(l.id, b.el);
  else { save(); toast((l ? l.name + ' carries the berry back' : 'The berry rolls back') + ' to the pantry.'); if (!ui.tray.hidden) buildTray(); }
}

/* ---------- teach it a trick ---------- */
// A shape drawn on the sky near the Glimmerkin asks for a trick. It tries; a stroke straight after is praise.
// Five praised tries and it knows the trick for good: then it does it neatly, the party joins in, and now and
// then it shows it off by itself when it is happy.
const PET_TRICKS = {
  spin: { name: 'spin', does: 'spins round', tries: 'tries to spin', shape: 'a circle' },
  wiggle: { name: 'wiggle', does: 'wiggles', tries: 'tries to wiggle', shape: 'a zigzag' },
  leap: { name: 'leap', does: 'leaps high', tries: 'tries to leap', shape: 'a swipe up' },
  bow: { name: 'bow', does: 'takes a bow', tries: 'tries to bow', shape: 'a swipe down' }
};
const LEARN_AT = 5, PET_TRICK_TIME = 1.3;
/* What shape a finger drew: a circle, a zigzag, a swipe up or a swipe down, or nothing clear. */
function shapeOf(path) {
  if (!path || path.length < 4) return null;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, len = 0, turn = 0, flips = 0, dir = 0, ext = path[0].x;
  for (let i = 0; i < path.length; i++) {
    const p = path[i]; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    if (!i) continue; const q = path[i - 1]; len += Math.hypot(p.x - q.x, p.y - q.y);
    if (i > 1) { const o = path[i - 2], a1 = Math.atan2(q.y - o.y, q.x - o.x), a2 = Math.atan2(p.y - q.y, p.x - q.x); let da = a2 - a1; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; if (Math.hypot(p.x - q.x, p.y - q.y) > 1 && Math.hypot(q.x - o.x, q.y - o.y) > 1) turn += da; }
    if (!dir) { if (Math.abs(p.x - ext) > 14) { dir = Math.sign(p.x - ext); ext = p.x; } }   // turns in x, ignoring small jitters
    else if ((p.x - ext) * dir > 0) ext = p.x; else if (Math.abs(p.x - ext) > 14) { flips++; dir = -dir; ext = p.x; }
  }
  const w = x1 - x0, h = y1 - y0, a = path[0], b = path[path.length - 1], ddx = b.x - a.x, ddy = b.y - a.y;
  if (Math.abs(turn) > Math.PI * 1.5 && w > 40 && h > 40 && Math.hypot(ddx, ddy) < Math.max(w, h) * 0.6) return 'spin';
  if (flips >= 3 && w > 50) return 'wiggle';
  if (Math.abs(ddy) > 70 && Math.abs(ddx) < Math.abs(ddy) * 0.6 && len < Math.abs(ddy) * 1.6) return ddy < 0 ? 'leap' : 'bow';
  return null;
}
function knows(k) { return (S.pet.tricks && S.pet.tricks[k] || 0) >= learnAt(k); }
function gestureDone(path) {
  const k = shapeOf(path), p = S.pet; if (!k || p.asleep || home.toss) return;
  petTrick(k, false);
}
function petTrick(k, self) {
  const H = home, p = S.pet, good = knows(k), T0 = PET_TRICKS[k]; if (H.pa.trick) return;
  H.pa.trick = { k, t: 0, good };
  if (k === 'leap') H.pa.hopV = good ? 520 : 260;
  sfx(good ? 'chirp' : 'pick');
  if (good) { for (const f of H.lits) if (f.perch < 0 && !f.trick) { const ks = kindsOf(f.l); f.trick = { k: ks[0], t: 0 }; } if (!self) toast(p.name + ' ' + T0.does + '!', 1800); else floatText(H.cx, H.gy - H.petS * 1.3, T0.does[0].toUpperCase() + T0.does.slice(1) + '!'); return; }
  H.praise = { k, until: T + PET_TRICK_TIME + 4, done: false };
  const n = p.tricks && p.tricks[k] || 0;
  toast(p.name + ' ' + T0.tries + '. Stroke it to praise it' + (n ? ' (' + n + ' of ' + learnAt(k) + ')' : '') + '.', 3000);
}
/* A stroke soon after a try is praise: it counts once per try. */
function praiseTrick() {
  const H = home, pr = H.praise, p = S.pet; if (!pr || pr.done || T > pr.until) return;
  pr.done = true; p.tricks = p.tricks || {}; const need = learnAt(pr.k), n = p.tricks[pr.k] = Math.min(need, (p.tricks[pr.k] || 0) + 1);
  floatText(H.cx, H.gy - H.petS * 1.3, n >= need ? 'Learned!' : n + ' of ' + need);
  if (n >= need) { sfx('grow'); burst(H.cx, H.gy - H.petS * 0.6, 26, 48, { kind: 'star', v: 160, size: 6, life: 1 }); toast(p.name + ' has learned to ' + PET_TRICKS[pr.k].name + '! Draw ' + PET_TRICKS[pr.k].shape + ' and it will.', 4200); H.praise = null; }
  save();
}
/* The shape being drawn shows as a fading gold line. */
function drawGesture(c, H) {
  const q = H.ptr; if (!q || q.hit || q.moved < 12 || q.path.length < 2) return;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = 'rgba(255,207,107,.75)'; c.lineWidth = 4; c.beginPath(); q.path.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke(); c.restore();
}
/* How the Glimmerkin is posed this frame: a trick turns, tilts or squashes it. Learned tricks sometimes happen
   by themselves when it is happy. */
function petPose(dt) {
  const H = home, pa = H.pa, p = S.pet, o = { sx: 1, tilt: 0, squash: 0, mood: null };
  if (!pa.trick && !p.asleep && !H.ptr && p.joy >= 60 && scene === 'home') {
    H.selfT = (H.selfT === undefined ? prnd(30, 60) : H.selfT) - dt;
    if (H.selfT <= 0) { H.selfT = prnd(40, 80); const ks = Object.keys(PET_TRICKS).filter(knows); if (ks.length && ui.sheet.hidden) petTrick(ks[Math.floor(playR.f() * ks.length)], true); }
  }
  const tr = pa.trick; if (!tr) return o;
  tr.t += dt; const u = Math.min(1, tr.t / PET_TRICK_TIME), g = tr.good;
  if (tr.k === 'spin') o.sx = g ? Math.cos(u * TAU) : Math.cos(Math.sin(u * Math.PI) * Math.PI * 0.4);   // a clumsy try only half turns
  else if (tr.k === 'wiggle') o.tilt = Math.sin(u * Math.PI * (g ? 8 : 4)) * (g ? 0.16 : 0.09) * Math.sin(u * Math.PI);
  else if (tr.k === 'bow') { const b = Math.sin(Math.min(1, u * 1.4) * Math.PI); o.squash = b * (g ? 0.2 : 0.1); o.tilt = b * (g ? 0.06 : 0.12); }
  else if (tr.k === 'leap' && !g && u > 0.4 && u < 0.6) o.tilt = Math.sin(u * 40) * 0.06;
  if (Math.abs(o.sx) < 0.08) o.sx = o.sx < 0 ? -0.08 : 0.08;   // never vanish edge-on
  o.mood = 'happy'; if (u >= 1) pa.trick = null;
  return o;
}

/* ---------- home with bits of the world on them ---------- */
// The party comes home from a quest carrying a little of the world on them. Stroking a little rubs the bits off,
// and a clean little gives a happy shake. Nothing else depends on it.
const MUCK = {
  emberfall: { what: 'soot', hue: 270, sat: 12, lit: 18, shape: 'dot' },
  tidehollow: { what: 'seaweed', hue: 150, sat: 55, lit: 42, shape: 'strand' },
  mossroot: { what: 'leaves', hue: 34, sat: 62, lit: 48, shape: 'leaf' },
  cloudspire: { what: 'fluff', hue: 220, sat: 30, lit: 94, shape: 'puff' },
  gloamglass: { what: 'glitter', hue: 280, sat: 90, lit: 78, shape: 'glint' },
  stonesong: { what: 'grit', hue: 30, sat: 10, lit: 55, shape: 'dot' }
}, MUCK_BITS = 7;
function muckAfter(q) {
  const m = MUCK[q.B.id]; if (!m) return [];
  q.lits.forEach(f => { f.l.muck = { b: q.B.id, n: MUCK_BITS }; }); layoutHome();
  return [(q.lits.length > 1 ? 'Your littles' : q.lits[0].l.name) + ' came home with ' + m.what + ' from ' + q.B.name + ' on them. Stroke them clean.'];
}
function muckBit(c, m, x, y, r, a) {
  c.fillStyle = hsl(m.hue, m.sat, m.lit); c.strokeStyle = hsl(m.hue, m.sat, m.lit);
  if (m.shape === 'dot') { c.beginPath(); c.arc(x, y, r * 0.55, 0, TAU); c.fill(); }
  else if (m.shape === 'strand') { c.lineWidth = r * 0.45; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x + r * 0.9, y, x - r * 0.2, y + r * 1.2); c.stroke(); }
  else if (m.shape === 'leaf') { c.beginPath(); c.ellipse(x, y, r * 1.1, r * 0.55, a, 0, TAU); c.fill(); }
  else if (m.shape === 'puff') { c.beginPath(); c.arc(x, y, r * 0.7, 0, TAU); c.arc(x + r * 0.6, y + r * 0.2, r * 0.5, 0, TAU); c.fill(); }
  else { starPath(c, x, y, r * 0.9, r * 0.32, 4, a); c.fill(); }
}
function drawMuck(c, f, x, y, s, lift) {
  const mk = f.l.muck, m = MUCK[mk.b]; if (!m) return; const r = RNG(f.l.seed % 100000 + 7), cy = y - lift - s * 0.32;
  for (let i = 0; i < MUCK_BITS; i++) { const a = r.f() * TAU, d = Math.sqrt(r.f()) * s * 0.3, rot = r.f() * 3; if (i >= mk.n) continue; muckBit(c, m, x + Math.cos(a) * d * 1.1, cy + Math.sin(a) * d * 0.8, s * 0.075, rot); }
}
function rubClean(f) {
  const l = f.l, m = MUCK[l.muck.b]; l.muck.n--;
  if (m) for (let i = 0; i < 3; i++) parts.push({ x: f.x + prnd(-14, 14), y: f.y - home.baseS * 0.3, vx: prnd(-90, 90), vy: prnd(-120, -40), g: 300, life: 0, max: 0.7, kind: 'dot', h: m.hue, size: 3 });
  if (l.muck.n > 0) return;
  delete l.muck; f.squash = 0.18; f.moodT = 1.6; sfx('chirp'); burst(f.x, f.y - home.baseS * 0.3, 14, 190, { kind: 'star', v: 120, size: 4 });
  toast(l.name + ' is clean again, and gives a happy shake.', 2400); save();
}

/* ---------- keepsakes ---------- */
// Now and then a little brings home something small it found. It waits beside the Glimmerkin holding it up; a tap
// on the little takes it, and the keepsake sits on the nest's back rim with its story: what, where, who and when.
const KEEPS = {
  mossroot: [['Oak leaf', 'leaf', 96], ['Mossy pebble', 'pebble', 120], ['Seed pod', 'pebble', 36]],
  emberfall: [['Ember stone', 'ember', 18], ['Ash feather', 'feather', 260], ['Fire opal', 'gem', 14]],
  tidehollow: [['Sea shell', 'shell', 18], ['Sea glass', 'gem', 180], ['Pearl', 'pearl', 300]],
  cloudspire: [['Cloud feather', 'feather', 205], ['Sky glass', 'gem', 205], ['Wind-smoothed pebble', 'pebble', 220]],
  gloamglass: [['Glow crystal', 'gem', 275], ['Moth wing', 'leaf', 290], ['Lamp bead', 'pearl', 48]],
  stonesong: [['Singing pebble', 'pebble', 28], ['Fossil shell', 'shell', 38], ['Quartz chip', 'gem', 320]]
}, KEEP_MAX = 8, KEEP_CHANCE = 0.35;
const keepOf = k => { const e = (KEEPS[k.b] || KEEPS.mossroot)[k.i] || KEEPS.mossroot[0]; return { name: e[0], shape: e[1], hue: e[2] }; };
function keepAfter(q) {
  if (S.offer || S.keeps.length >= KEEP_MAX || !KEEPS[q.B.id] || playR.f() >= KEEP_CHANCE) return [];
  const f = q.lits[Math.floor(playR.f() * q.lits.length)], have = S.keeps.filter(k => k.b === q.B.id).map(k => k.i), opts = [0, 1, 2].filter(i => !have.includes(i));
  const i = opts.length ? opts[Math.floor(playR.f() * opts.length)] : Math.floor(playR.f() * 3);
  S.offer = { id: f.l.id, b: q.B.id, i };
  return [f.l.name + ' found something in ' + q.B.name + ' and wants to give it to ' + S.pet.name + '.'];
}
function drawKeep(c, k, x, y, s, t) {
  const K = keepOf(k), h = K.hue; c.save(); c.lineJoin = 'round';
  if (K.shape === 'shell') { c.fillStyle = hsl(h, 70, 84); c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x, y - s * 1.9, x + s, y); c.closePath(); c.fill(); c.strokeStyle = hsl(h, 40, 58); c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + i * s * 0.4, y - s * 0.95); c.stroke(); } }
  else if (K.shape === 'feather') { c.fillStyle = hsl(h, 50, 82); c.beginPath(); c.ellipse(x, y - s * 0.6, s * 0.42, s * 1.1, 0.5, 0, TAU); c.fill(); c.strokeStyle = hsl(h, 30, 45); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - s * 0.5, y + s * 0.3); c.lineTo(x + s * 0.5, y - s * 1.5); c.stroke(); }
  else if (K.shape === 'gem') { glow(c, x, y - s * 0.5, s * 1.8, h, 90, 70, 0.35 + 0.15 * Math.sin(t * 2.5)); c.fillStyle = hsl(h, 80, 66); c.beginPath(); c.moveTo(x, y - s * 1.3); c.lineTo(x + s * 0.65, y - s * 0.5); c.lineTo(x, y + s * 0.1); c.lineTo(x - s * 0.65, y - s * 0.5); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(x, y - s * 1.3); c.lineTo(x - s * 0.3, y - s * 0.6); c.lineTo(x, y - s * 0.5); c.closePath(); c.fill(); }
  else if (K.shape === 'pearl') { glow(c, x, y - s * 0.5, s * 1.5, h, 60, 85, 0.3); c.fillStyle = hsl(h, 40, 90); c.beginPath(); c.arc(x, y - s * 0.5, s * 0.55, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(x - s * 0.18, y - s * 0.68, s * 0.16, 0, TAU); c.fill(); }
  else if (K.shape === 'ember') { glow(c, x, y - s * 0.4, s * 1.8, 20, 100, 60, 0.4 + 0.2 * Math.sin(t * 4)); c.fillStyle = '#3a2420'; c.beginPath(); c.ellipse(x, y - s * 0.4, s * 0.75, s * 0.5, 0, 0, TAU); c.fill(); c.fillStyle = hsl(h + Math.sin(t * 5) * 10, 100, 58); c.beginPath(); c.ellipse(x + s * 0.1, y - s * 0.45, s * 0.35, s * 0.2, 0.3, 0, TAU); c.fill(); }
  else if (K.shape === 'leaf') { c.fillStyle = hsl(h, 55, 52); c.beginPath(); c.ellipse(x, y - s * 0.55, s * 0.95, s * 0.45, -0.5, 0, TAU); c.fill(); c.strokeStyle = hsl(h, 50, 32); c.lineWidth = 1; c.beginPath(); c.moveTo(x - s * 0.8, y - s * 0.1); c.lineTo(x + s * 0.8, y - s * 1); c.stroke(); }
  else { c.fillStyle = hsl(h, 30, 55); c.beginPath(); c.ellipse(x, y - s * 0.4, s * 0.7, s * 0.48, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(x - s * 0.2, y - s * 0.55, s * 0.25, s * 0.14, 0, 0, TAU); c.fill(); }
  c.restore();
}
const KEEP_ANG = [1.25, 1.75, 1.18, 1.82, 1.11, 1.89, 1.04, 1.96];   // along the back rim, out from behind the Glimmerkin first
function drawKeeps(c, H, cx, ny, nrx, nry, bs) {
  H.keepPos = S.keeps.map((k, i) => { const a = KEEP_ANG[i] * Math.PI, x = cx + Math.cos(a) * nrx, y = ny + Math.sin(a) * nry - bs * 0.03; drawKeep(c, k, x, y, bs * 0.085, T); return { x, y: y - bs * 0.04 }; });
}
function keepStory(i) {
  const k = S.keeps[i]; if (!k) return; const d = new Date(k.at * 86400000), B = BIOMES.find(b => b.id === k.b);
  sfx('pick'); toast(keepOf(k).name + ' from ' + (B ? B.name : 'far away') + ', found by ' + k.by + ' on ' + d.getUTCDate() + ' ' + d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' }) + '.', 3800);
}
/* The little with something to give waits beside the Glimmerkin. */
function offerWith(f, H, bs) {
  if (!S.offer || S.offer.id !== f.l.id || H.carry) return;
  const side = f.hx < H.cx ? -1 : 1; f.tx = H.cx + side * H.petS * 0.42; f.ty = H.gy + H.ry * 0.95; f.wt = 0.5;   // in front of the Glimmerkin, holding it up
}
function drawOffer(c, H, bs) {
  const o = S.offer, f = o && litOf(o.id); if (!f) return; const y = f.y - bs * 0.47 + Math.sin(T * 3) * 2;
  glow(c, f.x, y - bs * 0.04, bs * 0.18, 48, 100, 75, 0.3 + 0.12 * Math.sin(T * 4)); drawKeep(c, o, f.x, y, bs * 0.12, T);
}
function acceptKeep() {
  const o = S.offer, l = petById(o.id), f = litOf(o.id), H = home; S.offer = null; if (!l) { save(); return; }
  S.keeps.push({ b: o.b, i: o.i, by: l.name, at: localDay() }); H.pa.hopV = 260; setMood('happy', 1.4); if (f) { f.moodT = 1.5; burst(f.x, f.y - H.baseS * 0.6, 14, 48, { kind: 'star', v: 110, size: 4 }); }
  sfx('tinkle'); toast(S.pet.name + ' loves the ' + keepOf(o).name.toLowerCase() + ' from ' + l.name + '. It goes on the rim of the nest.', 3600); layoutHome(); save();
}

/* ---------- little tower ---------- */
// A little carried onto another climbs on top. Two stand a while; three wobble and soon topple into a giggling
// heap. Friends stack steadier, and a Pebblit at the bottom never wobbles. A tap on the tower brings it down.
const TOWER_MAX = 3;
function stackOn(f, q) {
  const H = home; if (S.pet.asleep) return false;
  // only when its feet land on the other's head: feet on the ground beside it still mean "take it along" or "rest"
  const bs = H.baseS, feet = q.y + bs * 0.3; let base = null;
  for (const g of H.lits) if (g !== f && Math.abs(q.x - g.x) < bs * 0.22 && Math.abs(feet - (g.y - bs * 0.33)) < bs * 0.14) { base = g; break; }
  if (!base) return false;
  let tw = H.tower && H.tower.ids.includes(base.l.id) ? H.tower : null;
  if (!tw) { if (H.tower) topple(true); tw = H.tower = { ids: [base.l.id], t: 0 }; }
  if (tw.ids.length >= TOWER_MAX) { toast('Three is as high as they go.'); return true; }
  if (tw.ids.length > 1 && base.l.id !== tw.ids[tw.ids.length - 1]) return false;   // only onto the top one
  tw.ids.push(f.l.id); tw.t = 0; const n = tw.ids.length, ls = tw.ids.map(petById), friendly = ls.every((l, i) => !i || areFriends(ls[i - 1].id, l.id)), rock = kindsOf(ls[0]).includes('stone');
  tw.life = rock ? 12 : n >= 3 ? (friendly ? 7 : 4.5) : 9; tw.wob = rock ? 0 : n >= 3 ? (friendly ? 0.5 : 1) : 0.3;
  S.j.tower = Math.max(S.j.tower || 0, n);
  sfx('pick'); f.squash = 0.15; toast(n >= 3 ? 'Three high! ' + (rock ? 'Steady as a rock.' : 'It wobbles…') : f.l.name + ' climbs onto ' + base.l.name + '.', 2000);
  return true;
}
function towerWith(f, H, bs, dt) {
  const tw = H.tower; if (!tw) { if (f.zy !== undefined) { delete f.zy; delete f.tier; } return; }
  const i = tw.ids.indexOf(f.l.id); if (i < 0) return;
  if (i === 0) { tw.t += dt; if (tw.t > tw.life || S.pet.asleep) { topple(); return; } f.wt = 1; f.tx = f.x; f.ty = f.y; return; }   // the bottom one stays put
  const b = litOf(tw.ids[0]); if (!b) { topple(true); return; }
  const grow = Math.min(1, tw.t / tw.life), amp = tw.wob * (0.3 + grow) * bs * 0.05 * i;
  f.x = b.x + Math.sin(T * 5 + i) * amp; f.y = b.y - bs * 0.3 * i + (b.perch >= 0 ? b.bob || 0 : 0) - (f.perch >= 0 ? f.bob || 0 : 0); f.tx = f.x; f.ty = f.y; f.wt = 1; f.hop = 0;
  f.zy = b.y + i * 0.01; f.tier = i; f.moodT = 0.3;
}
function topple(quiet) {
  const H = home, tw = H.tower; if (!tw) return; H.tower = null;
  tw.ids.forEach((id, i) => { const f = litOf(id); if (!f) return; delete f.zy; delete f.tier; f.moodT = 1.6; f.squash = 0.15; f.wt = 0; if (i) { f.x += (i % 2 ? -1 : 1) * H.baseS * 0.25; burst(f.x, f.y - H.baseS * 0.2, 6, 330, { kind: 'heart', v: 80, size: 4 }); } });
  if (quiet) return; [0, 140, 280].forEach(ms => setTimeout(() => sfx('chirp'), ms)); toast('Down they go! Giggles all round.', 2000);
}

/* ---------- bedtime pile ---------- */
// When the Glimmerkin sleeps, every little leaves its place and curls up against it, friends side by side, and a
// dream bubble shows the last world it visited. A tap on a sleeping little makes it shuffle closer.
function pileOrder() {
  const ls = S.littles.slice(), out = []; if (!ls.length) return out; out.push(ls.shift());
  while (ls.length) { const last = out[out.length - 1]; let i = ls.findIndex(l => areFriends(l.id, last.id)); if (i < 0) i = 0; out.push(ls.splice(i, 1)[0]); }
  return out;
}
function bedWith(f, H, bs) {
  if (H.carry && H.carry.id === f.l.id) return;
  if (!H.pile || H.pileAt !== S.littles.length) { H.pile = pileOrder().map(l => l.id); H.pileAt = S.littles.length; }
  const n = H.pile.length, i = H.pile.indexOf(f.l.id); if (i < 0) return;
  // round the front of the Glimmerkin from left to right, leaving its face clear
  const u = n > 1 ? i / (n - 1) : 0, deg = u < 0.5 || n < 2 ? lerp(178, 112, Math.min(1, u * 2)) : lerp(68, 2, (u - 0.5) * 2), a = (n === 1 ? 150 : deg) * D2R, snug = 1 - Math.min(0.2, (f.snug || 0) * 0.05);
  const row = n > 6 && i % 2 ? 1 : 0;
  f.tx = H.cx + Math.cos(a) * H.petS * (0.72 + row * 0.18) * snug; f.ty = H.gy + H.ry * (0.25 + 0.6 * Math.sin(a) + row * 0.35); f.wt = 0.5;
}
function snuggle(id) {
  const f = litOf(id); if (!f) return; f.snug = (f.snug || 0) + 1; f.squash = 0.1; sfx('purr');
  toast(f.l.name + ' snuggles closer without waking.', 1800);
}
function dreamAfter(q) { if (q.B && BIOMES.includes(q.B)) S.dream = q.B.id; return []; }
function drawDream(c, H) {
  const B = S.pet.asleep && BIOMES.find(b => b.id === S.dream); if (!B) return;
  const ps = H.petS, bx = H.cx - ps * 0.95, by = H.gy - ps * 1.5, rx = ps * 0.52, ry = ps * 0.38, a = 0.75 + 0.15 * Math.sin(T * 0.8);
  c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(240,235,255,.16)'; c.strokeStyle = 'rgba(240,235,255,.6)'; c.lineWidth = 1.5;
  [[H.cx - ps * 0.32, H.gy - ps * 0.95, ps * 0.04], [H.cx - ps * 0.5, H.gy - ps * 1.08, ps * 0.06]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke(); });
  c.beginPath(); c.ellipse(bx, by, rx, ry, 0, 0, TAU); c.fill(); c.stroke(); c.clip();
  const s = ps * 0.2, r = RNG(S.pet.seed % 1000 + B.el.length); for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) { const x = bx - s * 3 + i * s, y = by - s * 2 + j * s; if (r.f() < 0.28 && !(i === 4 && j === 2)) drawWall(c, x, y, s, B, i * 9 + j); else drawFloor(c, x, y, s, B, i * 7 + j * 13); }
  drawPortal(c, bx + s, by, s, T, true); c.restore();
}

/* ---------- nest life ---------- */
// While nothing else is going on and nobody has touched the nest for 12 seconds, the littles get on with their own lives every 10 to 18 seconds: two chase each
// other round the nest, one dozes off, one tidies a friend, or one shows its trick to the Glimmerkin.
const LIFE = ['chase', 'nap', 'groom', 'show'], LIFE_IDLE = 12;
function lifeBusy() {
  const H = home; return T - (H.idleAt || 0) < LIFE_IDLE || !ui.sheet.hidden || S.pet.asleep || scene !== 'home' || document.hidden || H.ptr || H.carry || H.tower || H.toss || H.boxT > 0 || H.chaseT > 0 || H.pa.trick || H.copy || H.welcome;
}
function nestLife(dt) {
  const H = home, L = H.life;
  if (L) { L.t += dt; if (L.t >= L.dur || S.pet.asleep || H.carry || H.tower) endLife(); return; }
  H.lifeT = (H.lifeT === undefined ? prnd(8, 14) : H.lifeT) - dt; if (H.lifeT > 0) return;
  H.lifeT = prnd(10, 18); if (!lifeBusy()) startLife(LIFE[Math.floor(playR.f() * LIFE.length)]);
}
/* Pick who takes part. Friends are picked together when there are any. */
function startLife(k) {
  const H = home, off = S.offer && S.offer.id, free = H.lits.filter(f => f.l.id !== off && !f.trick), onNest = free.filter(f => f.perch < 0);
  const pairOf = pool => { for (const a of pool) for (const b of pool) if (a !== b && areFriends(a.l.id, b.l.id)) return [a, b]; return pool.length > 1 ? playR.f() < 0.5 ? [pool[0], pool[1]] : [pool[1], pool[0]] : null; };
  let ids = null, dur = 5;
  if (k === 'chase') { const p = pairOf(onNest); if (!p) return false; ids = p; dur = 5; }
  else if (k === 'groom') { const p = pairOf(free); if (!p) return false; ids = p; dur = 4; }
  else if (k === 'nap') { if (!free.length) return false; ids = [free[Math.floor(playR.f() * free.length)]]; dur = 6; }
  else { if (!free.length) return false; ids = [free[Math.floor(playR.f() * free.length)]]; dur = 2.4; }
  H.life = { k, ids: ids.map(f => f.l.id), t: 0, dur, a: playR.f() * TAU, hearts: 0 };
  if (k === 'show') { const f = ids[0], ks = kindsOf(f.l); f.trick = { k: ks[Math.floor(playR.f() * ks.length)], t: 0 }; setTimeout(() => { if (scene === 'home' && !S.pet.asleep) setMood('happy', 1); }, 700); }
  if (k === 'nap') ids[0].napT = dur;
  return true;
}
function endLife() { const H = home, L = H.life; H.life = null; if (!L) return; L.ids.forEach(id => { const f = litOf(id); if (f) { f.wt = 0; f.napT = 0; } }); }
function lifeWith(f, H, bs, dt) {
  f.napT = Math.max(0, (f.napT || 0) - dt); const L = H.life; if (!L) return; const i = L.ids.indexOf(f.l.id); if (i < 0) return;
  if (L.k === 'chase') { const a = L.a + L.t * 1.7 - i * 0.7; f.tx = H.cx + Math.cos(a) * H.rx * 0.7; f.ty = H.gy + Math.sin(a) * H.ry * 0.7; f.wt = 0.3; f.moodT = 0.4; }
  else if (L.k === 'groom' && i === 0) { const o = litOf(L.ids[1]); if (!o) return; const side = f.x < o.x ? -1 : 1; f.tx = o.x + side * bs * 0.24; f.ty = o.y; f.wt = 0.3;
    if (Math.hypot(f.x - f.tx, f.y - f.ty) < 8 && L.t > L.hearts * 0.8 + 0.6 && L.hearts < 4) { L.hearts++; f.squash = 0.08; o.moodT = 1; f.moodT = 1; parts.push({ x: (f.x + o.x) / 2, y: o.y - bs * 0.45, vx: prnd(-10, 10), vy: -40, g: 0, life: 0, max: 0.9, kind: 'heart', h: 340, size: 4 }); } }
  else if (L.k === 'nap') { f.tx = f.x; f.ty = f.y; f.wt = 0.3; if (playR.f() < dt * 0.9) parts.push({ x: f.x + bs * 0.12, y: f.y - bs * 0.4, vx: 8, vy: -20, g: 0, life: 0, max: 1.4, kind: 'z', size: 12 }); }
}

/* ---------- copy me ---------- */
// The Glimmerkin points at the littles on the nest one after another, and each does its trick. Tap them in the same
// order. Every round adds one more. A wrong tap ends the game, and the best round is kept.
const COPY_STEP = 0.85;
function startCopy() {
  const H = home; if (S.pet.asleep) { toast(S.pet.name + ' is asleep. Wake it first.'); return; }
  const ids = S.party.filter(id => litOf(id)); if (ids.length < 2) { toast('Copy me needs two littles on the nest.'); return; }
  if (H.tower) topple(true); endLife();
  H.copy = { ids, seq: [], round: 0, phase: 'wait', t: 0, at: 0 }; nextCopyRound(); toast('Watch who ' + S.pet.name + ' points at.', 2200);
}
function nextCopyRound() {
  const cp = home.copy, ids = cp.ids; if (!cp.seq.length) cp.seq.push(ids[Math.floor(playR.f() * ids.length)]);
  let n; do { n = ids[Math.floor(playR.f() * ids.length)]; } while (n === cp.seq[cp.seq.length - 1] && playR.f() < 0.6);   // fewer repeats in a row
  cp.seq.push(n); cp.round++; cp.phase = 'show'; cp.t = -0.6; cp.at = 0; cp.lit = null;
}
function copyNote(id) { const i = home.copy.ids.indexOf(id); sfx('note', CHIME_NOTES[[0, 2, 4][i] || 0]); }
function copyTrick(id) { const f = litOf(id); if (!f) return; const ks = kindsOf(f.l); f.trick = { k: ks[0], t: 0 }; f.moodT = 0.8; copyNote(id); }
function drawCopy(c, H, bs, dt) {
  const cp = H.copy; if (!cp) return;
  if (S.pet.asleep || H.carry || scene !== 'home') { H.copy = null; return; }
  cp.t += dt;
  if (cp.phase === 'show') {
    const i = Math.floor(cp.t / COPY_STEP);
    if (cp.t >= 0 && i < cp.seq.length && i >= cp.at) { cp.at = i + 1; cp.lit = cp.seq[i]; copyTrick(cp.lit); setMood('happy', 0.5); }
    if (cp.t >= cp.seq.length * COPY_STEP + 0.2) { cp.phase = 'you'; cp.at = 0; cp.lit = null; toast('Your turn: ' + cp.seq.length + ' taps.', 1600); }
  }
  // the Glimmerkin points with a sparkling line at whoever is showing
  const f = cp.phase === 'show' && cp.lit && litOf(cp.lit);
  if (f && (cp.t % COPY_STEP) < COPY_STEP * 0.8) { const x0 = H.cx, y0 = H.gy - H.petS * 0.55, x1 = f.x, y1 = f.y - bs * 0.25; c.save(); c.strokeStyle = 'rgba(255,215,120,.6)'; c.lineWidth = 2; c.setLineDash([3, 6]); c.lineDashOffset = -T * 40; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.restore(); glow(c, x1, y1, bs * 0.35, 48, 100, 75, 0.4); }
  c.save(); c.font = '800 15px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,235,180,.95)'; c.strokeStyle = 'rgba(18,12,38,.8)'; c.lineWidth = 3;
  const label = 'Copy me · round ' + cp.round + (cp.phase === 'you' ? ' · ' + cp.at + ' of ' + cp.seq.length : ''); c.strokeText(label, H.cx, H.gy + H.ry + bs * 0.18); c.fillText(label, H.cx, H.gy + H.ry + bs * 0.18); c.restore();
}
function copyTap(id) {
  const H = home, cp = H.copy; if (cp.phase !== 'you') return;
  if (cp.seq[cp.at] === id) {
    copyTrick(id); cp.at++;
    if (cp.at >= cp.seq.length) { cp.phase = 'wait'; burst(H.cx, H.gy - H.petS * 0.8, 14, 48, { kind: 'star', v: 120, size: 4 }); setTimeout(() => { if (H.copy === cp) nextCopyRound(); }, 900); }
    return;
  }
  const done = cp.round - 1; H.copy = null; sfx('no');
  const best = Math.max(S.j.copyBest || 0, done), rec = done > (S.j.copyBest || 0); S.j.copyBest = best; play(3); save();
  toast((done ? 'Oops! You copied ' + done + (done === 1 ? ' round' : ' rounds') + '.' : 'Oops! That was not the one.') + (rec && done > 0 ? ' A new best.' : best ? ' Best: ' + best + '.' : ''), 3200);
}

/* ---------- snap a picture ---------- */
// Take a picture, in the journal, freezes the nest for a moment while everyone poses. The album keeps how to draw the picture (who was
// there and how they looked), not an image, so each picture is a few hundred bytes. It holds twelve.
const PICS_MAX = 12;
function snapPicture() {
  const H = home, p = S.pet; if (H.snap || scene !== 'home') return; endLife();
  H.snap = { t: 0, taken: false };
  if (!p.asleep) { H.pa.hopV = 260; setMood('happy', 1.4); for (const f of H.lits) if (!f.trick && f.l.id !== (H.carry && H.carry.id)) { const ks = kindsOf(f.l); f.trick = { k: ks[0], t: 0 }; f.moodT = 1.4; } }
  sfx('pick'); toast(p.asleep ? 'Shh… a quiet picture.' : 'Everyone, smile!', 1200);
}
function snapFrame(c, H, dt) {
  const sn = H.snap; if (!sn) return; sn.t += dt;
  if (!sn.taken && sn.t >= 0.65) { sn.taken = true; takePicture(); }
  if (sn.taken) { const a = Math.max(0, 1 - (sn.t - 0.65) / 0.5); c.fillStyle = 'rgba(255,255,255,' + (a * 0.85).toFixed(3) + ')'; c.fillRect(0, 0, VW, VH); if (a <= 0) H.snap = null; }
}
function takePicture() {
  const p = S.pet, d = new Date(), party = S.party.slice(), ls = S.littles.slice().sort((a, b) => (party.includes(b.id) ? 1 : 0) - (party.includes(a.id) ? 1 : 0));
  const pic = { at: Date.now(), h: d.getHours() + d.getMinutes() / 60, s: seasonNow(), z: !!p.asleep, pet: { name: p.name, seed: p.seed, xp: Math.round(p.xp), ...(p.hue0 !== undefined ? { hue0: Math.round(p.hue0) } : {}), diet: Object.fromEntries(Object.entries(p.diet || {}).map(([k, v]) => [k, Math.round(v * 100) / 100])), marks: (p.marks || []).slice(), form: p.form || null, ...(p.wear ? { wear: Object.assign({}, p.wear) } : {}), ...(crownOn(p.crown) ? { crown: Object.assign({}, p.crown, { keep: 1 }) } : {}) },
    ls: ls.map(l => Object.assign({ kind: l.kind, seed: l.seed, name: l.name }, l.kind2 ? { kind2: l.kind2 } : {}, littleLevel(l.xp || 0) >= GROWN_AT ? { grown: 1 } : {})) };
  const e = elder(); if (e) pic.el = Object.assign({ name: e.name, seed: e.seed, xp: e.xp, diet: e.diet, marks: e.marks, form: e.form }, e.hue0 !== undefined ? { hue0: e.hue0 } : {}, e.wear ? { wear: Object.assign({}, e.wear) } : {});   // the elder is in the picture too
  S.pics.push(pic); const full = S.pics.length > PICS_MAX; if (full) S.pics.shift();
  sfx('tinkle'); save();
  // once the flash has faded, the picture is shown with a way to keep it on the phone; anywhere else, a toast says where it went
  const note = 'It is in the journal' + (full ? ', and the oldest made room for it.' : '.');
  setTimeout(() => { const i = S.pics.indexOf(pic); if (i >= 0 && scene === 'home' && ui.sheet.hidden) openPic(i, note); else toast('Picture taken. ' + note, 2600); }, 550);
}
/* Draw a kept picture: the sky at that hour, the isle, the Glimmerkin as it looked then, and the littles in front. */
function drawPic(c, pic, w, h) {
  const sky = skyAt(pic.h), g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
  if (nightAt(pic.h) > 0.5) { const r = RNG(Math.floor(pic.at / 1000) % 100000); for (let i = 0; i < 24; i++) { c.fillStyle = 'rgba(255,250,235,' + (0.3 + r.f() * 0.6) + ')'; c.beginPath(); c.arc(r.f() * w, r.f() * h * 0.5, r.f() + 0.3, 0, TAU); c.fill(); } }
  const cx = w / 2, gy = h * 0.74, rx = w * 0.46, ry = rx * 0.2; c.fillStyle = '#2b2050'; c.beginPath(); c.moveTo(cx - rx, gy); c.quadraticCurveTo(cx, gy + rx * 0.9, cx + rx, gy); c.closePath(); c.fill();
  const ig = c.createRadialGradient(cx, gy - ry * 0.3, rx * 0.1, cx, gy, rx); ig.addColorStop(0, '#58a886'); ig.addColorStop(1, '#215552'); c.fillStyle = ig; c.beginPath(); c.ellipse(cx, gy, rx, ry, 0, 0, TAU); c.fill();
  if (pic.el) { const E = petLook(pic.el); drawCreature(c, E, cx + rx * 0.62, gy - ry * 0.7, h * 0.3, 1.9, { still: true, mood: pic.z ? 'sleep' : 'happy', look: { x: -0.5, y: 0.2 } }); }
  const L = petLook(pic.pet), ps = h * 0.4 * [0.74, 0.87, 1, 1.08][L.stage]; drawCreature(c, L, cx, gy + ry * 0.1, ps, 0.7, { still: true, mood: pic.z ? 'sleep' : 'happy', look: { x: 0, y: 0.2 } });
  const n = Math.min(pic.ls.length, 8), ls = h * 0.17;
  pic.ls.slice(0, n).forEach((q, i) => { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), x = cx + side * (ps * 0.55 + ls * 0.5 + k * ls * 0.62), y = gy + ry * (0.5 + 0.18 * k); const LL = lookFor(q.kind, q.seed, q.kind2); if (q.grown) LL.grown = true; drawCreature(c, LL, x, y, ls, 0.7 + i, { still: true, mood: pic.z ? 'sleep' : 'happy', look: { x: -side * 0.6, y: 0 } }); });
  if (pic.z) { c.fillStyle = 'rgba(8,5,26,.35)'; c.fillRect(0, 0, w, h); }
}
const picDate = pic => { const d = new Date(pic.at); return d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'long' }) + ' ' + d.getFullYear(); };
function picsJournal() {
  if (!S.pics.length) return '';
  return '<h3>Pictures · ' + S.pics.length + ' of ' + PICS_MAX + '</h3><div class="pics" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px">' + S.pics.map((p, i) => '<button class="card" data-do="pic" data-i="' + i + '" style="display:grid;gap:4px;padding:6px;justify-items:center" aria-label="Picture from ' + picDate(p) + '"><canvas data-ic="pic:' + i + '" data-size="72" data-w="96"></canvas><small>' + esc(picDate(p)) + '</small></button>').slice().reverse().join('') + '</div>';
}
// Opened from the journal, or straight after the flash with `taken` saying where the picture went.
function openPic(i, taken) {
  const pic = S.pics[i]; if (!pic) return; const who = pic.ls.slice(0, 8).map(l => l.name);
  const keep = () => keepPicture((c, w, h) => drawPic(c, pic, w, h), 300, 210, pic.pet.name, pic.at);
  if (taken) return openSheet('<h2>Picture taken</h2><canvas data-ic="pic:' + i + '" data-size="210" data-w="300" style="border-radius:14px;max-width:100%"></canvas><p class="dim">' + esc(taken) + '</p><div class="btns">' + KEEP_BTN + '<button class="btn main" data-do="ok">Lovely</button></div>', { ok: closeSheet, keep });
  openSheet('<h2>' + esc(picDate(pic)) + '</h2><canvas data-ic="pic:' + i + '" data-size="210" data-w="300" style="border-radius:14px;max-width:100%"></canvas><p class="dim">' + esc(pic.pet.name) + (pic.el ? ', ' + esc(pic.el.name) : '') + (who.length ? ' with ' + esc(who.length > 1 ? who.slice(0, -1).join(', ') + ' and ' + who[who.length - 1] : who[0]) : '') + (pic.z ? ', fast asleep' : '') + '.</p><div class="btns"><button class="btn" data-do="rm">Remove it</button>' + KEEP_BTN + '<button class="btn main" data-do="back">Back to the journal</button></div>', { back: openJournal, keep, rm: () => { S.pics.splice(i, 1); save(); openJournal(); } });
}

/* ---------- welcome home ---------- */
// When a quest ends and its results are closed, the littles who stayed behind rush over to the party, hopping, and
// friends hug. Then everyone goes back to their places.
const WELCOME_TIME = 3.5;
function welcomeAfter(q) {
  const ids = q.lits.map(f => f.l.id); if (S.littles.every(l => ids.includes(l.id))) return [];
  home.welcome = { ids, t: 0, hugs: {} }; return [];
}
function welcomeWith(f, H, bs, dt) {
  const w = H.welcome; if (!w) return;
  if (!ui.sheet.hidden || scene !== 'home') return;   // it waits for the results to close
  if (f === H.lits[0]) w.t += dt;   // counted once a frame
  if (w.t >= WELCOME_TIME) { H.welcome = null; for (const g of H.lits) g.wt = 0; return; }
  if (w.ids.includes(f.l.id)) { f.moodT = 0.5; return; }
  // a little who stayed runs to a friend in the party if it has one, otherwise to the nearest of the party
  const party = w.ids.map(litOf).filter(Boolean); if (!party.length) return;
  let to = party.find(g => areFriends(g.l.id, f.l.id)); const hug = !!to;
  if (!to) to = party.reduce((a, g) => Math.hypot(g.x - f.x, g.y - f.y) < Math.hypot(a.x - f.x, a.y - f.y) ? g : a, party[0]);
  const k = H.lits.filter(g => !w.ids.includes(g.l.id)).indexOf(f), side = k % 2 ? 1 : -1;
  f.tx = clamp(to.x + side * bs * (0.22 + 0.12 * Math.floor(k / 2 % 2)), H.cx - H.rx * 0.85, H.cx + H.rx * 0.85); f.ty = to.y + bs * 0.04 * Math.floor(k / 2); f.wt = 0.3; f.moodT = 0.5;
  if (hug && !w.hugs[f.l.id] && Math.hypot(f.x - f.tx, f.y - f.ty) < 10) { w.hugs[f.l.id] = 1; f.squash = 0.15; to.squash = 0.15; burst((f.x + to.x) / 2, to.y - bs * 0.45, 8, 340, { kind: 'heart', v: 70, size: 4, life: 1 }); sfx('purr'); }
}

/* ---------- saves and the journal ---------- */
// Older saves get every nest-play field here, so they load unchanged.
function playDefaults() {
  if (S.spot === undefined) S.spot = null;
  S.pet.tricks = S.pet.tricks || {}; S.keeps = S.keeps || []; if (S.dream === undefined) S.dream = null; S.pics = S.pics || []; if (S.offer === undefined) S.offer = null; if (S.offer && !petById(S.offer.id)) S.offer = null;
}
function playJournal() {
  const j = S.j, lines = [];
  const kn = Object.keys(PET_TRICKS).filter(knows); if (kn.length) lines.push(esc(S.pet.name) + ' knows how to ' + kn.map(k => PET_TRICKS[k].name).join(', ') + '.');
  if (j.copyBest) lines.push('Best game of copy me: ' + j.copyBest + (j.copyBest === 1 ? ' round.' : ' rounds.'));
  if (j.tower) lines.push('Tallest little tower: ' + j.tower + ' high.');
  if (j.catchBest > 1) lines.push('Best run of catches: ' + j.catchBest + ' in a row.');
  if (j.spots) { const best = Object.keys(j.spotKinds || {}).sort((a, b) => j.spotKinds[b] - j.spotKinds[a])[0]; lines.push('Found ' + esc(S.pet.name) + '\'s favourite spot on ' + j.spots + (j.spots === 1 ? ' day' : ' days') + (best ? '. Most often ' + SPOTS[best] + '.' : '.')); }
  if (S.keeps.length) lines.push('Keepsakes, ' + S.keeps.length + ' of ' + KEEP_MAX + ': ' + S.keeps.map(k => keepOf(k).name.toLowerCase() + ' from ' + k.by).join(', ') + '.');
  return (lines.length ? '<h3>In the nest</h3><ul class="plain">' + lines.map(l => '<li>' + l + '</li>').join('') + '</ul>' : '') + picsJournal();
}
