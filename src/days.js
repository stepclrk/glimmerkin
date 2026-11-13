/* ===== The calendar: today's world ===== */
/* One extra portal a day, built from the date alone, so every player is sent to the same world that day.
   The map is fitted to each party's littles, as every world is. */
const TODAY_BONUS = 10;   // stardust on top of the usual pay, once a day
function todayPortal() {
  const day = localDay(), r = RNG((day * 7919 + 1013) >>> 0), B = r.pick(BIOMES);
  return { seed: r.int(1, 2147483646), biome: B.id, size: 'vale', name: worldName(r, B), today: day };
}
const todayDone = () => !!(S.today && S.today.day === localDay() && S.today.done);
/* After a quest: today's world finished for the first time today. Returns lines for the results, and the bonus. */
function todayAfter(q, success) {
  if (!success || !q.today || q.today !== localDay() || todayDone()) return { lines: [], dust: 0 };
  S.today = { day: q.today, done: true }; S.j.days = (S.j.days || 0) + 1;
  return { lines: ['Today\'s world is done: ' + TODAY_BONUS + ' stardust more. A new one opens tomorrow.'], dust: TODAY_BONUS };
}
function todayCard() {
  const o = todayPortal(), B = BIOMES.find(b => b.id === o.biome), done = todayDone(), tired = S.pet.rest < 25, off = done || tired;
  return '<button class="card' + (off ? ' off' : '') + '" data-do="go" data-i="today"' + (off ? ' disabled' : '') + ' style="border-color:var(--mint);background:rgba(134,232,200,.08)"><canvas data-ic="biome:' + B.id + '" data-size="60"></canvas><span class="tx"><strong>' + esc(o.name) + '</strong><small>Today\'s world · ' + B.name + ' · every player is sent here today</small><small>' + (done ? 'Done today. A new world opens tomorrow.' : 'Finish it for ' + TODAY_BONUS + ' stardust more.') + '</small></span><span class="tag ' + (done ? 'yes' : 'cost') + '">' + (done ? 'Done' : 'Go') + '</span></button>';
}

/* ===== The seasons: the nest follows the real calendar ===== */
/* Northern seasons by local month. Nothing here changes care, quests or the balance of the game. */
const SEASONS = {
  winter: { name: 'Winter', text: 'Snow falls on the nest, and the trader carries frostberries.' },
  spring: { name: 'Spring', text: 'Blossom drifts across the nest.' },
  summer: { name: 'Summer', text: 'Seeds float up on warm air.' },
  autumn: { name: 'Autumn', text: 'Leaves tumble past the nest.' }
};
function seasonNow() { const m = new Date().getMonth(); return m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn'; }
const FROST = { name: 'Frostberry', text: 'A winter berry. Belly and Joy both, and a happy shiver. It does not change colours.' };
/* What falls past the nest: flakes, petals, seeds or leaves, drawn in front of everything. */
function drawWeather(c, H, dt) {
  const sn = seasonNow(), n = REDUCED ? 8 : 26;
  if (H.wxSeason !== sn || !H.wx) { H.wxSeason = sn; H.wx = []; for (let i = 0; i < n; i++) H.wx.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8, ph: Math.random() * TAU, h: Math.random() }); }
  const up = sn === 'summer', sp = sn === 'winter' ? 0.035 : sn === 'summer' ? 0.02 : 0.045;
  for (const f of H.wx) {
    f.y += (up ? -1 : 1) * sp * f.s * dt * (REDUCED ? 0.5 : 1); f.ph += dt * (sn === 'autumn' ? 2.2 : 1.2);
    if (f.y > 1.05) { f.y = -0.05; f.x = Math.random(); } if (f.y < -0.05) { f.y = 1.05; f.x = Math.random(); }
    const x = (f.x + Math.sin(f.ph) * 0.03) * VW, y = topIn + f.y * (VH - topIn - botIn), r = 3 * f.s;
    c.save(); c.translate(x, y);
    if (sn === 'winter') { c.globalAlpha = 0.85; c.fillStyle = '#f4f8ff'; c.beginPath(); c.arc(0, 0, r * 0.9, 0, TAU); c.fill(); }
    else if (sn === 'spring') { c.rotate(f.ph); c.globalAlpha = 0.85; c.fillStyle = hsl(330 + f.h * 25, 85, 86); c.beginPath(); c.ellipse(0, 0, r * 1.3, r * 0.7, 0, 0, TAU); c.fill(); }
    else if (sn === 'summer') { c.globalAlpha = 0.6; c.strokeStyle = '#fff6da'; c.lineWidth = 0.8; for (let k = 0; k < 6; k++) { const a = k * TAU / 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.4); c.stroke(); } }
    else { c.rotate(Math.sin(f.ph) * 1.2); c.globalAlpha = 0.9; c.fillStyle = hsl(12 + f.h * 34, 85, 52); c.beginPath(); c.moveTo(0, -r * 1.5); c.quadraticCurveTo(r * 1.2, 0, 0, r * 1.5); c.quadraticCurveTo(-r * 1.2, 0, 0, -r * 1.5); c.fill(); }
    c.restore();
  }
}
/* Winter: snow lies on the isle and along the rim of the nest. */
function drawSnowIsle(c, H) {
  if (seasonNow() !== 'winter') return;
  const { cx, gy, rx, ry } = H; c.fillStyle = 'rgba(240,247,255,.32)'; c.beginPath(); c.ellipse(cx, gy - ry * 0.08, rx * 0.97, ry * 0.88, 0, 0, TAU); c.fill();
}
function drawSnowRim(c, H, ny, nrx, nry) {
  if (seasonNow() !== 'winter') return;
  const cx = H.cx; c.fillStyle = 'rgba(248,251,255,.9)'; for (let a = Math.PI + 0.15; a < TAU; a += 0.32) { const x = cx + Math.cos(a) * nrx, y = ny + Math.sin(a) * nry; c.beginPath(); c.ellipse(x, y - H.baseS * 0.045, H.baseS * 0.06, H.baseS * 0.025, 0, 0, TAU); c.fill(); }
}

/* ===== December's gifts: one wrapped gift a day from the 1st to the 25th ===== */
/* A gift missed waits for the next visit, from the day the creature hatched. */
const GIFT_DAYS = 25;
function giftsWaiting() {
  const d = new Date(); if (d.getMonth() !== 11) return [];
  const y = d.getFullYear(), born = new Date(S.createdAt || 0), first = born.getFullYear() === y && born.getMonth() === 11 ? born.getDate() : 1;
  const got = S.advent && S.advent.y === y ? S.advent.got : [], out = [];
  for (let day = first; day <= Math.min(d.getDate(), GIFT_DAYS); day++) if (!got.includes(day)) out.push(day);
  return out;
}
/* What is inside one day's gift: rolled from the year, the day and the creature, so it is the same on any device. */
function giftFor(y, day) {
  const r = RNG((y * 400 + day * 13 + S.pet.seed) >>> 0);
  if (day === GIFT_DAYS) return [{ k: 'star', n: 1 }, { k: 'frost', n: 3 }].concat(S.wardrobe.includes('crown') ? [] : [{ k: 'thing', id: 'wear:crown' }]);   // and a paper crown, once
  const v = r.f();
  if (v < 0.3) return [{ k: 'frost', n: 2 }];
  if (v < 0.55) return [{ k: 'berry', el: r.pick(ELS), n: 3 }];
  if (v < 0.7) return [{ k: 'dust', n: 15 }];
  if (v < 0.8) return [{ k: 'tool', id: 'tool:' + r.pick(Object.keys(TOOLS)) }];
  if (v < 0.9 && S.chimes < 8) return [{ k: 'thing', id: 'chime' }];
  if (v < 0.9) return [{ k: 'dust', n: 15 }];
  return [{ k: 'star', n: 1 }];
}
function giftLine(g) {
  if (g.k === 'frost') return g.n + ' frostberries';
  if (g.k === 'berry') return g.n + ' ' + BERRY[g.el] + 's';
  if (g.k === 'dust') return g.n + ' stardust';
  if (g.k === 'star') return 'a starfruit';
  return (/^[AEIOU]/.test(thingName(g.id)) ? 'an ' : 'a ') + thingName(g.id).toLowerCase();
}
function giftIcon(g) { return g.k === 'frost' ? 'berry:frost' : g.k === 'berry' ? 'berry:' + g.el : g.k === 'dust' ? 'shard' : g.k === 'star' ? 'thing:star' : 'thing:' + g.id; }
function openGift() {
  const days = giftsWaiting(); if (!days.length) return;
  const y = new Date().getFullYear(), day = days[0], inside = giftFor(y, day);
  if (!S.advent || S.advent.y !== y) S.advent = { y, got: [] }; S.advent.got.push(day); S.j.gifts = (S.j.gifts || 0) + 1;
  for (const g of inside) {
    if (g.k === 'frost') { S.pantry.frost = (S.pantry.frost || 0) + g.n; S.j.things.frost = true; }
    else if (g.k === 'berry') S.pantry[g.el] = (S.pantry[g.el] || 0) + g.n;
    else if (g.k === 'dust') S.dust += g.n;
    else if (g.k === 'star') S.pantry.star = (S.pantry.star || 0) + g.n;
    else giveThing(g.id);
  }
  const H = home; if (H.gift) burst(H.gift.x, H.gift.y - H.baseS * 0.12, 30, 0, { kind: 'star', v: 170, size: 6, life: 1 }); sfx('tinkle'); setTimeout(() => sfx('win'), 200);
  save(); updateHud(); if (!ui.tray.hidden) buildTray();
  const more = days.length - 1, when = day === GIFT_DAYS ? 'The last gift of December.' : 'The gift for ' + day + ' December.';
  openSheet('<h2>A December gift</h2><canvas data-ic="present" data-size="64" style="display:block;margin:4px auto 8px"></canvas><p class="dim">' + when + '</p><div class="loot">' + inside.map(g => '<span><canvas data-ic="' + giftIcon(g) + '" data-size="30"></canvas>' + esc(giftLine(g)) + '</span>').join('') + '</div><p class="dim">' + (more ? more + (more > 1 ? ' more gifts wait' : ' more gift waits') + ' under the nest.' : day < GIFT_DAYS ? 'Another gift comes tomorrow.' : 'That was the last one. See you next December.') + '</p><div class="btns">' + (more ? '<button class="btn" data-do="next">Open the next</button>' : '') + '<button class="btn main" data-do="ok">Lovely</button></div>', { ok: closeSheet, next: openGift });
}
/* A wrapped gift floats on a small cloud under the moon while any wait. */
function drawGift(c, H, t) {
  const n = giftsWaiting().length; if (!n) { H.gift = null; return; }
  const w = clamp(H.baseS * 0.26, 30, 46), x = VW * 0.8, y = topIn + 96 + w + Math.sin(t * 1.3) * 4, hop = 0; H.gift = { x, y: y - w * 0.45 };
  c.save(); c.translate(x, y); glow(c, 0, -w * 0.4, w * 1.6, 350, 90, 70, 0.3 + 0.1 * Math.sin(t * 3));
  c.fillStyle = 'rgba(235,240,255,.85)'; for (const [dx, dy, r] of [[-0.55, 0.06, 0.3], [0, 0.1, 0.38], [0.55, 0.06, 0.3], [-0.25, -0.02, 0.26], [0.28, -0.02, 0.26]]) { c.beginPath(); c.arc(dx * w, dy * w, r * w, 0, TAU); c.fill(); } c.restore();
  drawPresent(c, x, y - hop, w);
  if (n > 1) { c.save(); c.translate(x, y - hop); c.strokeStyle = '#2a1830'; c.lineWidth = Math.max(1, w * 0.05); c.fillStyle = '#ffd766'; c.beginPath(); c.arc(w * 0.55, -w * 0.9, w * 0.22, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#3b230c'; c.font = '800 ' + Math.round(w * 0.3) + 'px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), w * 0.55, -w * 0.89); c.textBaseline = 'alphabetic'; c.restore(); }
}
/* A wrapped gift, x centre, y base. */
function drawPresent(c, x, y, w) {
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.strokeStyle = '#2a1830'; c.lineWidth = Math.max(1, w * 0.05);
  c.fillStyle = '#d8405a'; rrect(c, -w / 2, -w * 0.78, w, w * 0.78, w * 0.08); c.fill(); c.stroke();
  c.fillStyle = '#e8566e'; rrect(c, -w * 0.56, -w * 0.94, w * 1.12, w * 0.22, w * 0.06); c.fill(); c.stroke();
  c.fillStyle = '#ffd766'; c.fillRect(-w * 0.07, -w * 0.94, w * 0.14, w * 0.94); c.strokeRect(-w * 0.07, -w * 0.94, w * 0.14, w * 0.94);
  for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * w * 0.18, -w * 1.02, w * 0.2, w * 0.11, sd * 0.5, 0, TAU); c.fill(); c.stroke(); }
  c.restore();
}
