/* ===== The requests board: somewhere for what you collect to go =====
   Each local day three friends of the nest ask for things the player collects: berries, stardust, a tool, a starfruit,
   a charm, an egg, seeds or frostberries. Filling a request gives favours, and favours buy things from the board's
   own list, two costumes among them that nothing else gives. A request not filled simply goes when the day ends:
   nothing is lost. Saved as `req` (`day`, `list`, `done`), `favours`, and `j.requests` (requests filled). */
const REQ_A_DAY = 3;
const REQ_KINDS = {
  berry: { fav: 1, why: ['for a pie', 'for jam', 'for a picnic', 'for a birthday cake'] },
  dust: { fav: 1, why: ['for the lamp fund', 'to mend a roof', 'for a new kite string'] },
  tool: { fav: 1, why: ['to help a friend get home', 'for a long trip', 'to keep in a pocket, just in case'] },
  star: { fav: 1, why: ['for a party', 'to share with a friend', 'because it sparkles'] },
  charm: { fav: 2, why: ['for luck on a long journey', 'for a little who is scared of the dark'] },
  egg: { fav: 2, why: ['for a family who would love one'] },
  seeds: { fav: 1, why: ['for a window box', 'for a garden of their own'] },
  frost: { fav: 1, why: ['for a winter feast'] }
};
/* What favours buy. Each is there only while it makes sense to have it. */
const FAVOURS = [
  { id: 'wear:garland', cost: 3, ok: () => unlocked('wardrobe') && !wearOwned('garland') },
  { id: 'wear:bow', cost: 3, ok: () => unlocked('wardrobe') && !wearOwned('bow') },
  { id: 'egg:twin', cost: 4, ok: () => eggRoom() > 0 },
  { id: 'map', cost: 2, ok: () => S.maps < 3 },
  { id: 'chime', cost: 2, ok: () => S.chimes < 8 },
  { id: 'star', cost: 1, ok: () => true }
];

function ensureRequests() {
  if (typeof S.favours !== 'number') S.favours = 0;
  if (!S.req || typeof S.req !== 'object' || !Array.isArray(S.req.list)) S.req = { day: 0, list: [], done: [] };
  return S.req;
}
const allEggs = () => S.eggs.length + (S.burrow ? S.burrow.eggs.length : 0);
/* Who asks: the trader, littles and elders by name, and garden visitors once they have been watched. */
function reqAskers() {
  const o = ['The wandering trader'];
  for (const l of S.littles) o.push(l.name);
  for (const e of S.elders || []) o.push(e.name + ', the elder');
  const seen = (S.garden && S.garden.seen) || {}; for (const v of VISITORS) if (seen[v.id]) o.push('The ' + v.name.toLowerCase());
  return o;
}
/* Today's three, rolled once a day from the day and the creature's seed, from what the player could give. */
function todaysRequests() {
  const R = ensureRequests(), day = localDay(); if (R.day === day && R.list.length) return R;
  const r = RNG((day * 7717 + S.pet.seed) >>> 0), pool = ['berry', 'berry', 'dust', 'tool', 'star'];
  if (Object.values(S.charms).some(n => n > 0)) pool.push('charm');
  if (allEggs() > 0) pool.push('egg');
  if (unlocked('garden')) pool.push('seeds', 'seeds');
  if (seasonNow() === 'winter' || (S.pantry.frost || 0) >= 2) pool.push('frost');
  const askers = r.shuffle(reqAskers()), list = [], used = new Set();
  for (let i = 0; list.length < REQ_A_DAY && i < 40; i++) {
    const k = r.pick(pool); if (used.has(k) && k !== 'berry') continue; used.add(k);
    const q = { k, who: askers[list.length % askers.length], why: r.pick(REQ_KINDS[k].why), fav: REQ_KINDS[k].fav };
    if (k === 'berry') { q.el = r.pick(ELS.filter(e => !list.some(o => o.el === e))); q.n = r.int(4, 8); }
    else if (k === 'dust') q.n = 5 * r.int(6, 12);
    else if (k === 'tool') { q.t = r.pick(Object.keys(TOOLS)); q.n = r.int(1, 2); }
    else if (k === 'charm') { q.t = r.pick(Object.keys(CHARMS).filter(c => S.charms[c] > 0)); q.n = 1; }
    else if (k === 'seeds') { q.el = r.pick(ELS); q.n = 3; }
    else q.n = k === 'frost' ? 2 : 1;
    list.push(q);
  }
  S.req = { day, list, done: list.map(() => false) }; save(); return S.req;
}
/* How many the player has of what a request asks for. */
function reqHave(q) {
  if (q.k === 'berry') return S.pantry[q.el] || 0;
  if (q.k === 'dust') return S.dust;
  if (q.k === 'tool') return S.tools[q.t] || 0;
  if (q.k === 'charm') return S.charms[q.t] || 0;
  if (q.k === 'star') return S.pantry.star || 0;
  if (q.k === 'frost') return S.pantry.frost || 0;
  if (q.k === 'egg') return allEggs();
  if (q.k === 'seeds') return (ensureGarden().seeds[q.el] || 0);
  return 0;
}
function reqWhat(q) {
  const n = q.n;
  if (q.k === 'berry') return n + ' ' + BERRY[q.el].replace(/y$/, 'ie') + 's';
  if (q.k === 'dust') return n + ' stardust';
  if (q.k === 'tool') return (n > 1 ? n + ' ' + TOOLS[q.t].name.toLowerCase() + 's' : 'a ' + TOOLS[q.t].name.toLowerCase());
  if (q.k === 'charm') return (/^[aeiou]/i.test(CHARMS[q.t].name) ? 'an ' : 'a ') + CHARMS[q.t].name.toLowerCase();
  if (q.k === 'star') return 'a starfruit';
  if (q.k === 'frost') return 'two frostberries';
  if (q.k === 'egg') return 'an egg';
  return n + ' ' + FLOWERS[q.el].name + ' seeds';
}
function reqIcon(q) {
  if (q.k === 'berry') return 'berry:' + q.el; if (q.k === 'dust') return 'shard'; if (q.k === 'tool') return 'thing:tool:' + q.t;
  if (q.k === 'charm') return 'thing:charm:' + q.t; if (q.k === 'star') return 'thing:star'; if (q.k === 'frost') return 'thing:frost';
  if (q.k === 'egg') return 'egg:' + ((S.eggs[0] || (S.burrow && S.burrow.eggs[0]) || { hue: 300 }).hue); return 'flower:' + q.el;
}
/* Gives what a request asks for. An egg goes from the burrow first, then the coolest egg in the nest. */
function reqGive(i) {
  const R = todaysRequests(), q = R.list[i]; if (!q || R.done[i] || reqHave(q) < q.n) return;
  if (q.k === 'berry') S.pantry[q.el] -= q.n; else if (q.k === 'dust') S.dust -= q.n; else if (q.k === 'tool') S.tools[q.t] -= q.n;
  else if (q.k === 'charm') S.charms[q.t] -= q.n; else if (q.k === 'star') S.pantry.star -= 1; else if (q.k === 'frost') S.pantry.frost -= 2;
  else if (q.k === 'seeds') ensureGarden().seeds[q.el] -= q.n;
  else if (q.k === 'egg') { if (S.burrow && S.burrow.eggs.length) S.burrow.eggs.pop(); else { let k = 0; S.eggs.forEach((e, j) => { if ((e.warm || 0) < (S.eggs[k].warm || 0)) k = j; }); S.eggs.splice(k, 1); if (scene === 'home') rebuildHome(); } }
  R.done[i] = true; S.favours += q.fav; S.j.requests = (S.j.requests || 0) + 1; sfx('buy'); save(); updateHud();
  toast(q.who + ' is delighted. ' + (q.fav > 1 ? q.fav + ' favours' : 'A favour') + ' for you.', 3200);
}
function favourBuy(id) {
  const f = FAVOURS.find(x => x.id === id); if (!f || !f.ok() || S.favours < f.cost) return;
  S.favours -= f.cost; giveThing(id); sfx('buy'); save(); updateHud(); if (scene === 'home') rebuildHome();
  toast(thingName(id) + (id.startsWith('wear:') ? ' went into the wardrobe.' : ' is yours.'), 3200);
}
function requestsCard() {
  const R = todaysRequests(), n = R.done.filter(Boolean).length, can = R.list.some((q, i) => !R.done[i] && reqHave(q) >= q.n);
  return '<button class="card" data-do="requests"' + (can ? ' style="border-color:var(--lantern)"' : '') + '><canvas data-ic="board" data-size="44"></canvas><span class="tx"><strong>The requests board</strong><small>' + (n >= REQ_A_DAY ? 'All three filled today. New requests tomorrow.' : n + ' of ' + REQ_A_DAY + ' filled today' + (can ? ', and you can fill another now.' : '.')) + ' ' + favLine() + '</small></span><span class="tag">Open</span></button>';
}
const favLine = () => S.favours + (S.favours === 1 ? ' favour' : ' favours') + ' to spend.';
function openRequests(back) {
  const R = todaysRequests();
  const row = (q, i) => { const done = R.done[i], have = reqHave(q), ok = !done && have >= q.n;
    return '<button class="card' + (ok || done ? '' : ' off') + '" data-do="give" data-i="' + i + '"' + (ok ? '' : ' disabled') + '><canvas data-ic="' + reqIcon(q) + '" data-size="48"></canvas><span class="tx"><strong>' + esc(q.who) + '</strong><small>Would love ' + esc(reqWhat(q)) + ' ' + esc(q.why) + '.</small><small>' + (done ? 'Done. Thank you!' : 'You have ' + (q.k === 'dust' ? '✦ ' : '') + have + '. ' + (q.fav > 1 ? q.fav + ' favours' : '1 favour') + ' for it.') + '</small></span><span class="tag ' + (done ? 'yes' : ok ? 'cost' : '') + '">' + (done ? 'Done' : ok ? 'Give' : have + ' of ' + q.n) + '</span></button>'; };
  const shop = FAVOURS.filter(f => f.ok());
  const buy = f => { const ok = S.favours >= f.cost; return '<button class="card' + (ok ? '' : ' off') + '" data-do="fav" data-id="' + f.id + '"' + (ok ? '' : ' disabled') + '><canvas data-ic="thing:' + f.id + '" data-size="48"></canvas><span class="tx"><strong>' + esc(thingName(f.id)) + '</strong><small>' + esc(f.id.startsWith('wear:') ? WEAR[f.id.slice(5)].text + ' Only from the requests board.' : thingText(f.id)) + '</small></span><span class="tag cost">' + f.cost + (f.cost === 1 ? ' favour' : ' favours') + '</span></button>'; };
  openSheet('<h2>The requests board</h2><p class="dim">Friends of the nest pin up three requests a day. Give them things you have collected and they owe you a favour. A request you leave simply goes when the day ends.</p><h3>Today\'s requests</h3><div class="list">' + R.list.map(row).join('') + '</div>' +
    '<h3>Favours · ' + S.favours + '</h3><p class="dim">Favours buy things from the board, some of them found nowhere else.</p><div class="list">' + (shop.length ? shop.map(buy).join('') : '<p class="dim">Nothing to spend favours on just now.</p>') + '</div>' +
    '<div class="btns">' + (back ? '<button class="btn" data-do="back">Back</button>' : '') + '<button class="btn main" data-do="ok">Done</button></div>',
    { ok: closeSheet, back: () => back && back(), give: d => { reqGive(+d.i); openRequests(back); }, fav: d => { favourBuy(d.id); openRequests(back); } });
}
function requestsJournal() {
  if (!unlocked('requests')) return '';
  return '<p class="dim">Requests filled: ' + (S.j.requests || 0) + '. Favours to spend: ' + S.favours + '.</p>';
}

/* ---------- drawing ---------- */
/* A favour: a round rosette with a ribbon and a heart. */
function drawFavour(c, x, y, s) {
  c.save(); c.lineJoin = 'round';
  c.fillStyle = '#e05a8a'; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(x + sd * s * 0.06, y + s * 0.1); c.lineTo(x + sd * s * 0.22, y + s * 0.48); c.lineTo(x + sd * s * 0.1, y + s * 0.4); c.lineTo(x + sd * s * 0.02, y + s * 0.5); c.closePath(); c.fill(); }
  c.fillStyle = '#ffcf6b'; c.beginPath(); for (let i = 0; i < 24; i++) { const a = i * TAU / 24, r = s * (i % 2 ? 0.3 : 0.34); c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y - s * 0.05 + Math.sin(a) * r); } c.closePath(); c.fill(); c.strokeStyle = '#8a5a1c'; c.lineWidth = Math.max(1, s * 0.03); c.stroke();
  c.fillStyle = '#ff6f91'; const hy = y - s * 0.05, hs = s * 0.15; c.beginPath(); c.moveTo(x, hy + hs * 0.9); c.bezierCurveTo(x - hs * 1.4, hy - hs * 0.1, x - hs * 0.6, hy - hs * 1.2, x, hy - hs * 0.35); c.bezierCurveTo(x + hs * 0.6, hy - hs * 1.2, x + hs * 1.4, hy - hs * 0.1, x, hy + hs * 0.9); c.fill();
  c.restore();
}
/* The board: a wooden notice board on two posts, with three notes pinned to it. */
function drawReqBoard(c, x, y, s) {
  c.save(); c.lineJoin = 'round';
  c.fillStyle = '#6d4a3a'; c.fillRect(x - s * 0.36, y - s * 0.1, s * 0.07, s * 0.5); c.fillRect(x + s * 0.29, y - s * 0.1, s * 0.07, s * 0.5);
  c.fillStyle = '#b98a5a'; c.strokeStyle = '#5a3a2c'; c.lineWidth = Math.max(1, s * 0.04); rrect(c, x - s * 0.44, y - s * 0.4, s * 0.88, s * 0.56, s * 0.05); c.fill(); c.stroke();
  const notes = [['#fff6d8', -0.27, -0.26, -0.08], ['#d8f3ff', 0, -0.3, 0.06], ['#ffe0ec', 0.25, -0.24, -0.05]];
  for (const [col, dx, dy, rot] of notes) { c.save(); c.translate(x + dx * s, y + dy * s); c.rotate(rot); c.fillStyle = col; c.fillRect(-s * 0.11, 0, s * 0.22, s * 0.3); c.strokeStyle = 'rgba(90,60,40,.35)'; c.lineWidth = Math.max(1, s * 0.015); for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(-s * 0.07, k * s * 0.07); c.lineTo(s * 0.07, k * s * 0.07); c.stroke(); } c.fillStyle = '#e05a5a'; c.beginPath(); c.arc(0, s * 0.02, s * 0.025, 0, TAU); c.fill(); c.restore(); }
  c.restore();
}
