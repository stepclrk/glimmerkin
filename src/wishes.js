/* ===== Wishes: each day the Glimmerkin wants one thing. Granting it pays stardust, Joy and bond. ===== */
const WISH_DUST = 10;
function wishBiome(w) { // the world type a wish sends you to, or null
  if (!w || w.done) return null;
  if (w.kind === 'world') return w.biome;
  if (w.kind === 'berry' && !(S.pantry[w.el] > 0)) return (BIOMES.find(b => b.el === w.el) || BIOMES[0]).id;
  return null;
}
function wishText(w) {
  const n = S.pet.name;
  if (w.kind === 'berry') { const B = BIOMES.find(b => b.el === w.el); return n + ' is dreaming of a ' + BERRY[w.el] + '.' + (S.pantry[w.el] > 0 ? '' : ' It grows in ' + B.name + '.'); }
  if (w.kind === 'world') return n + ' wishes to see ' + BIOMES.find(b => b.id === w.biome).name + ' today. Finish a quest there.';
  if (w.kind === 'cuddle') return n + ' wants a long cuddle. Stroke it until Joy reaches 90.';
  return n + ' wants a proper nap. Let it sleep until Rest is full, then wake it.';
}
/* One wish per calendar day, the same all day for the same creature. */
function rollWish() {
  const day = localDay(); if (S.wish && S.wish.day === day) return S.wish;
  const p = S.pet, r = RNG(((p.seed || 1) ^ (day * 2654435761)) >>> 0), kinds = ['berry', 'berry', 'berry', 'cuddle', 'nap'];
  if (S.quests >= 1) kinds.push('world', 'world', 'world');
  let kind = r.pick(kinds);
  if (kind === 'cuddle' && p.joy >= 88) kind = 'berry'; if (kind === 'nap' && p.rest >= 90 && !p.asleep) kind = 'berry';
  S.wish = { day, kind, done: false };
  if (kind === 'berry') S.wish.el = r.pick(ELS); else if (kind === 'world') S.wish.biome = r.pick(BIOMES).id;
  return S.wish;
}
/* Called wherever something a wish could be about has just happened. */
function wishCheck(what, value) {
  const w = S.wish; if (!w || w.done || w.day !== localDay() || w.kind !== what) return false;
  if (what === 'berry' && value !== w.el) return false;
  if (what === 'world' && value !== w.biome) return false;
  if (what === 'cuddle' && S.pet.joy < 90) return false;
  if (what === 'nap' && S.pet.rest < 95) return false;
  w.done = true; S.j.wishes = (S.j.wishes || 0) + 1;
  const p = S.pet; p.joy = clamp(p.joy + 15, 0, 100); S.dust += WISH_DUST;
  let msg = 'Wish granted. ' + p.name + ' is thrilled: +' + WISH_DUST + ' stardust.';
  // every fifth wish, the creature gives something back
  if (S.j.wishes % 5 === 0) { const t = RNG(S.j.wishes * 7919 + (p.seed || 1)).pick(Object.keys(TOOLS)); msg += ' It has found you a present: ' + giveThing('tool:' + t).toLowerCase() + '.'; }
  if (scene === 'home' && home) { for (let i = 0; i < 3; i++) burst(home.cx, home.gy - home.petS * 0.6, 12, 330 + i * 20, { kind: 'star', v: 170, size: 6, life: 1 }); setMood('happy', 1.8); home.pa.hopV = 320; }
  sfx('win'); gainXp(WISH_DUST); toast(msg, 4600); save(); updateHud();
  return true;
}
/* The thought bubble's picture. */
function drawWish(c, w, bx, by) {
  if (w.kind === 'berry') drawItem(c, { k: 'berry', el: w.el }, bx, by + 2, 62, 0);
  else if (w.kind === 'world') { const B = BIOMES.find(b => b.id === w.biome); for (let i = 0; i < 3; i++) { c.strokeStyle = hsl(B.accent[0], B.accent[1], 46 - i * 6, 1 - i * 0.22); c.lineWidth = 3; c.beginPath(); c.arc(bx, by, 13 - i * 4.4, T * (1 + i * 0.4) + i * 2, T * (1 + i * 0.4) + i * 2 + 4.6); c.stroke(); } }
  else if (w.kind === 'cuddle') { c.fillStyle = '#ff6f9c'; const s = 7; c.beginPath(); c.moveTo(bx, by + s * 1.3); c.bezierCurveTo(bx - s * 2.2, by - s * 0.2, bx - s * 0.9, by - s * 1.6, bx, by - s * 0.5); c.bezierCurveTo(bx + s * 0.9, by - s * 1.6, bx + s * 2.2, by - s * 0.2, bx, by + s * 1.3); c.fill(); }
  else { c.fillStyle = '#6b62b8'; c.font = '800 16px Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('z z', bx, by + 1); }
}
