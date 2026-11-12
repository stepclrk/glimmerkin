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

/* ---------- saves and the journal ---------- */
// Older saves get every nest-play field here, so they load unchanged.
function playDefaults() {
  if (S.spot === undefined) S.spot = null;
}
function playJournal() {
  const j = S.j, lines = [];
  if (j.catchBest > 1) lines.push('Best run of catches: ' + j.catchBest + ' in a row.');
  if (j.spots) { const best = Object.keys(j.spotKinds || {}).sort((a, b) => j.spotKinds[b] - j.spotKinds[a])[0]; lines.push('Found ' + esc(S.pet.name) + '\'s favourite spot on ' + j.spots + (j.spots === 1 ? ' day' : ' days') + (best ? '. Most often ' + SPOTS[best] + '.' : '.')); }
  return lines.length ? '<h3>In the nest</h3><ul class="plain">' + lines.map(l => '<li>' + l + '</li>').join('') + '</ul>' : '';
}
