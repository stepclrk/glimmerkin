/* ===== Wishes: a small thing the Glimmerkin wants, a few times a day ===== */
const WISHES_PER_DAY = 3;
const wishBond = () => 4 + 3 * petLevel(S.pet.xp);   // bond a granted wish adds: about a third of a level early on
/* Today's wish, rolled once per local day and again after each one granted, up to three a day. */
function ensureWish() {
  const day = localDay(), w = S.wish;
  if (w && w.day === day) return w;
  S.wish = newWish(day, 0, null); return S.wish;
}
function newWish(day, n, prev) {
  const r = RNG((day * 613 + n * 97 + S.pet.seed) >>> 0), opts = [];
  const stocked = ELS.filter(e => S.pantry[e] > 0);
  opts.push({ k: 'eat', a: stocked.length ? r.pick(stocked) : r.pick(ELS), need: 1 });
  if (S.portals && S.portals.list && S.portals.list.length) opts.push({ k: 'visit', a: r.pick(S.portals.list).biome, need: 1 });
  const toys = Object.keys(TOYS).filter(t => S.toys[t]); if (toys.length) opts.push({ k: 'play', a: r.pick(toys), need: 1 });
  if (S.littles.length >= 2) opts.push({ k: 'take', a: r.pick(S.littles).id, need: 1 });
  opts.push({ k: 'cuddle', a: '', need: 24 });
  const pool = opts.filter(o => o.k !== prev); const o = r.pick(pool.length ? pool : opts);
  return { day, n, k: o.k, a: o.a, got: 0, need: o.need, done: false };
}
function wishText(w) {
  if (w.k === 'eat') return 'a ' + BERRY[w.a] + ' to eat';
  if (w.k === 'visit') return 'a trip to ' + (BIOMES.find(b => b.id === w.a) || BIOMES[0]).name;
  if (w.k === 'play') return 'a game with the ' + TOYS[w.a].name.toLowerCase();
  if (w.k === 'take') { const l = petById(w.a); return 'to take ' + (l ? l.name : 'a little') + ' on a quest'; }
  return 'a long cuddle';
}
function wishHow(w) {
  if (w.k === 'eat') return BERRY[w.a] + 's grow in ' + (BIOMES.find(b => b.el === w.a) || BIOMES[0]).name + '. Feed one from the pantry.';
  if (w.k === 'visit') return 'Finish a quest there. A portal to it stays on offer until you do.';
  if (w.k === 'play') return 'Tap the ' + TOYS[w.a].name.toLowerCase() + ' in the nest.';
  if (w.k === 'take') return 'Put it in the party and finish a quest together.';
  return 'Stroke it for a good while.';
}
const wishLive = () => { const w = S.wish; return w && !w.done && w.day === localDay() && !(w.wait && Date.now() < w.wait) ? w : null; };
/* Something happened that a wish might be about. Returns a line for the quest results when the wish comes true. */
function wishEvent(k, a) {
  const w = wishLive(); if (!w || w.k !== k) return null;
  if (k === 'take' ? !(a || []).includes(w.a) : w.a && w.a !== a) return null;
  w.got++; if (w.got < w.need) return null;
  return grantWish(w, k === 'visit' || k === 'take');
}
function grantWish(w, quiet) {   // quiet: the quest results sheet tells the player instead
  const p = S.pet, bond = wishBond(), what = wishText(w);
  w.done = true; S.j.wishes = (S.j.wishes || 0) + 1; p.joy = clamp(p.joy + 8, 0, 100);
  const up = gainXp(bond); if (scene === 'home' && !quiet) { const H = home; burst(H.cx, H.gy - H.petS * 0.6, 26, 330, { kind: 'heart', v: 150, size: 6, life: 1.1 }); burst(H.cx, H.gy - H.petS * 0.6, 18, 48, { kind: 'star', v: 170, size: 6 }); setMood('happy', 1.4); H.pa.hopV = 300; sfx('win'); }
  if (w.n + 1 < WISHES_PER_DAY) S.wish = Object.assign(newWish(w.day, w.n + 1, w.k), { wait: Date.now() + 90e3 });
  const msg = 'Wish granted: ' + what + '. ' + p.name + '\'s bond deepens.';
  if (scene === 'home' && !quiet && !up) toast(msg, 3600);
  save(); if (scene === 'home') updateHud(); return msg;
}
function drawWishIcon(c, w, x, y) {
  if (w.k === 'eat') drawItem(c, { k: 'berry', el: w.a }, x, y + 2, 62, 0);
  else if (w.k === 'visit') { const B = BIOMES.find(b => b.id === w.a) || BIOMES[0]; glow(c, x, y, 20, B.accent[0], B.accent[1], B.accent[2], 0.6); drawPortal(c, x - 15, y - 15, 30, T, true); }
  else if (w.k === 'play') drawThing(c, 'toy:' + w.a, x, y, 34, T);
  else if (w.k === 'take') { const l = petById(w.a); if (l) drawCreature(c, lookOf(l), x, y + 13, 24, T, { still: true, noShadow: true }); }
  else { c.fillStyle = '#ff6f9c'; for (const [dx, s] of [[-6, 5], [6, 6.5]]) { const hx = x + dx, hy = y - 1; c.beginPath(); c.moveTo(hx, hy + s * 1.3); c.bezierCurveTo(hx - s * 2, hy, hx - s * 0.8, hy - s * 1.5, hx, hy - s * 0.4); c.bezierCurveTo(hx + s * 0.8, hy - s * 1.5, hx + s * 2, hy, hx, hy + s * 1.3); c.fill(); } }
}
function openWish() {
  const w = wishLive(), p = S.pet, total = S.j.wishes || 0;
  const body = w ? '<p>' + esc(p.name) + ' wishes for <b>' + esc(wishText(w)) + '</b>.</p><p class="dim">' + esc(wishHow(w)) + (w.need > 1 ? ' ' + Math.min(w.got, w.need) + ' of ' + w.need + ' so far.' : '') + '</p><p class="dim">Granting it deepens your bond by ' + wishBond() + '. Up to three wishes a day.</p>'
    : S.wish && !S.wish.done && S.wish.day === localDay() ? '<p>' + esc(p.name) + ' is still thinking about what it wants next.</p>' : '<p>' + esc(p.name) + ' has everything it wished for today. New wishes come tomorrow.</p>';
  openSheet('<h2>A wish</h2>' + body + '<p class="dim">Wishes granted so far: ' + total + '.</p><div class="btns"><button class="btn main" data-do="ok">I will see to it</button></div>', { ok: closeSheet });
}

/* ===== Littles: one small wish a day among them, and friends made on quests ===== */
const LWISH_XP = 4, FRIENDS_AT = 5;
function ensureLittleWish() {
  const day = localDay(); if (S.lwish && S.lwish.day === day) return S.lwish;
  S.lwish = null; if (!S.littles.length) return null;
  const r = RNG((day * 389 + S.pet.seed * 7) >>> 0), l = r.pick(S.littles), hb = BIOMES.find(b => b.el === l.kind) || r.pick(BIOMES);
  S.lwish = S.pantry[l.kind] > 0 && r.chance(0.4) ? { day, id: l.id, k: 'treat', a: l.kind, done: false } : { day, id: l.id, k: 'visit', a: hb.id, done: false };
  return S.lwish;
}
const littleWishLive = () => { const w = S.lwish; return w && !w.done && w.day === localDay() && petById(w.id) ? w : null; };
function littleWishText(w) { return w.k === 'treat' ? (/^[AEIOU]/.test(BERRY[w.a]) ? 'an ' : 'a ') + BERRY[w.a] + ' as a treat' : 'a trip to ' + (BIOMES.find(b => b.id === w.a) || BIOMES[0]).name; }
function littleWishHow(w, l) { return w.k === 'treat' ? 'Open Feed and drag one onto ' + l.name + '.' : 'Finish a quest there with ' + l.name + ' in the party. A portal to it stays on offer until you do.'; }
/* Something happened that the little's wish might be about. Returns a line for the quest results when it comes true. */
function littleWishEvent(k, ids, a) {
  const w = littleWishLive(); if (!w || w.k !== k || w.a !== a || !ids.includes(w.id)) return null;
  const l = petById(w.id), b = littleLevel(l.xp || 0); w.done = true; l.xp = (l.xp || 0) + LWISH_XP; S.j.lwishes = (S.j.lwishes || 0) + 1;
  const f = scene === 'home' && litOf(l.id); if (f) { f.moodT = 2; burst(f.x, f.y - home.baseS * 0.3, 16, 330, { kind: 'heart', v: 120, size: 5, life: 1 }); }
  const a2 = littleLevel(l.xp), msg = l.name + '\'s wish came true: ' + littleWishText(w) + '. It gains ' + LWISH_XP + ' experience' + (a2 > b ? ' and reached level ' + a2 + '.' : '.');
  save(); return msg;
}
function openLittleWish() {
  const w = littleWishLive(); if (!w) return; const l = petById(w.id);
  openSheet('<h2>' + esc(l.name) + ' has a wish</h2><div class="card"><canvas data-ic="little:' + l.id + '" data-size="60"></canvas><div class="tx"><strong>' + esc(littleWishText(w)) + '</strong><small>' + esc(littleWishHow(w, l)) + '</small></div></div><p class="dim">Granting it gives ' + esc(l.name) + ' ' + LWISH_XP + ' experience. One little has a wish each day.</p><div class="btns"><button class="btn main" data-do="ok">I will see to it</button></div>', { ok: closeSheet });
}
function drawLittleWish(c, H, bs) {
  H.lbubble = null; const w = littleWishLive(), f = w && litOf(w.id); if (!f || H.carry && H.carry.id === f.l.id || S.pet.asleep) return;
  const x = f.x + bs * 0.24, y = f.y - bs * 0.6 + Math.sin(T * 2.4) * 2, r = bs * 0.11; H.lbubble = { x, y };
  c.fillStyle = 'rgba(245,240,255,.95)'; c.beginPath(); c.arc(x - r * 0.9, y + r * 1.15, r * 0.22, 0, TAU); c.fill(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  if (w.k === 'treat') drawItem(c, { k: 'berry', el: w.a }, x, y + 1, r * 3, 0);
  else { const B = BIOMES.find(b => b.id === w.a) || BIOMES[0]; glow(c, x, y, r * 1.2, B.accent[0], B.accent[1], B.accent[2], 0.5); drawPortal(c, x - r * 0.7, y - r * 0.7, r * 1.4, T, true); }
}
/* Friends: two littles who finish five quests together become friends, and sit together in the nest. */
const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const areFriends = (a, b) => (S.friends[pairKey(a, b)] || 0) >= FRIENDS_AT;
function friendsAfter(ids) {
  const lines = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = pairKey(ids[i], ids[j]); S.friends[k] = (S.friends[k] || 0) + 1; if (S.friends[k] === FRIENDS_AT) { const a = petById(ids[i]), b = petById(ids[j]); lines.push(a.name + ' and ' + b.name + ' are friends now. They sit together in the nest.'); } }
  return lines;
}
function friendsOf(id) { return S.littles.filter(l => l.id !== id && areFriends(id, l.id)); }
