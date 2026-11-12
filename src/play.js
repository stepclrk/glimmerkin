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

/* ---------- saves and the journal ---------- */
// Older saves get every nest-play field here, so they load unchanged.
function playDefaults() {
  if (S.spot === undefined) S.spot = null;
}
function playJournal() {
  const j = S.j, lines = [];
  if (j.spots) { const best = Object.keys(j.spotKinds || {}).sort((a, b) => j.spotKinds[b] - j.spotKinds[a])[0]; lines.push('Found ' + esc(S.pet.name) + '\'s favourite spot on ' + j.spots + (j.spots === 1 ? ' day' : ' days') + (best ? '. Most often ' + SPOTS[best] + '.' : '.')); }
  return lines.length ? '<h3>In the nest</h3><ul class="plain">' + lines.map(l => '<li>' + l + '</li>').join('') + '</ul>' : '';
}
