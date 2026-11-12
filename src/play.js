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
function knows(k) { return (S.pet.tricks && S.pet.tricks[k] || 0) >= LEARN_AT; }
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
  toast(p.name + ' ' + T0.tries + '. Stroke it to praise it' + (n ? ' (' + n + ' of ' + LEARN_AT + ')' : '') + '.', 3000);
}
/* A stroke soon after a try is praise: it counts once per try. */
function praiseTrick() {
  const H = home, pr = H.praise, p = S.pet; if (!pr || pr.done || T > pr.until) return;
  pr.done = true; p.tricks = p.tricks || {}; const n = p.tricks[pr.k] = Math.min(LEARN_AT, (p.tricks[pr.k] || 0) + 1);
  floatText(H.cx, H.gy - H.petS * 1.3, n >= LEARN_AT ? 'Learned!' : n + ' of ' + LEARN_AT);
  if (n >= LEARN_AT) { sfx('grow'); burst(H.cx, H.gy - H.petS * 0.6, 26, 48, { kind: 'star', v: 160, size: 6, life: 1 }); toast(p.name + ' has learned to ' + PET_TRICKS[pr.k].name + '! Draw ' + PET_TRICKS[pr.k].shape + ' and it will.', 4200); H.praise = null; }
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

/* ---------- saves and the journal ---------- */
// Older saves get every nest-play field here, so they load unchanged.
function playDefaults() {
  if (S.spot === undefined) S.spot = null;
  S.pet.tricks = S.pet.tricks || {};
}
function playJournal() {
  const j = S.j, lines = [];
  const kn = Object.keys(PET_TRICKS).filter(knows); if (kn.length) lines.push(esc(S.pet.name) + ' knows how to ' + kn.map(k => PET_TRICKS[k].name).join(', ') + '.');
  if (j.catchBest > 1) lines.push('Best run of catches: ' + j.catchBest + ' in a row.');
  if (j.spots) { const best = Object.keys(j.spotKinds || {}).sort((a, b) => j.spotKinds[b] - j.spotKinds[a])[0]; lines.push('Found ' + esc(S.pet.name) + '\'s favourite spot on ' + j.spots + (j.spots === 1 ? ' day' : ' days') + (best ? '. Most often ' + SPOTS[best] + '.' : '.')); }
  return lines.length ? '<h3>In the nest</h3><ul class="plain">' + lines.map(l => '<li>' + l + '</li>').join('') + '</ul>' : '';
}
