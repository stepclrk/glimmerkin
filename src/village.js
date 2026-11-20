/* ===== Glimmer village (4.4.12) =====
   Once there is an elder, a village opens beside the garden: a cottage for each elder round a fire, with the grown-up
   littles at play. Each elder can take one role. Elders still have no needs, and a role is something an elder does,
   never something the player has to do. Saved as `village`: `roles` (role by elder, by its place in S.elders),
   `tended` (the local day the gardener last tended) and `stall` (the week, and whether its thing was bought). */
const ROLES = {
  gardener: { name: 'Gardener', text: 'Tends one flower in your garden each day that is waiting to be tended.' },
  storyteller: { name: 'Storyteller', text: 'Tells the story of the glooms at the fire, and tales of the family.' },
  trader: { name: 'Trader', text: 'Keeps a stall with one thing the wandering trader never has, new each week.' },
  lamplighter: { name: 'Lamplighter', text: 'Lights the lanterns at dusk, and pins up the pictures from littles away on adventures.' }
};
const ROLE_IDS = Object.keys(ROLES);
const VILLAGE_SLOTS = [[0.2, 0.5], [0.8, 0.52], [0.5, 0.36], [0.13, 0.82], [0.87, 0.84], [0.5, 0.97]];   // cottages, as fractions of the ground
const villageOpen = () => !!S.elders && S.elders.length > 0;
let VL = null;   // the village while it is open: where things are drawn, for taps

function ensureVillage() {
  if (!S.village || typeof S.village !== 'object') S.village = { roles: {}, tended: 0, stall: null };
  S.village.roles = S.village.roles || {};
  for (const k of Object.keys(S.village.roles)) if (!S.elders[+k] || !ROLES[S.village.roles[k]]) delete S.village.roles[k];
  return S.village;
}
/* The elders shown: the six most recent, each with its place in S.elders. */
const villageElders = () => S.elders.map((e, i) => ({ e, i })).slice(-VILLAGE_SLOTS.length);
const roleOf = i => (S.village && S.village.roles[i]) || null;
const elderWith = role => { const k = Object.keys((S.village && S.village.roles) || {}).find(i => S.village.roles[i] === role); return k === undefined ? -1 : +k; };
function villageStoryteller() { return S.village ? elderWith('storyteller') : -1; }

function villageCard() {
  const n = S.elders.length, roles = Object.values(ensureVillage().roles).length;
  return '<button class="card" data-do="village"><canvas data-ic="elder:' + (n - 1) + '" data-size="44"></canvas><span class="tx"><strong>Glimmer village</strong><small>' + n + (n === 1 ? ' elder lives' : ' elders live') + ' there' + (roles ? ', ' + roles + ' with a role.' : '. Tap an elder to give it a role.') + '</small></span><span class="tag">Walk over</span></button>';
}

function enterVillage() {
  if (!villageOpen()) return; closeSheet(); ui.tray.hidden = true; ensureVillage();
  VL = { t: 0, spots: [] }; scene = 'village'; setSceneUI(); villageHud(); sfx('gate');
  const line = gardenerRound(); save();
  toast(line || (elderWith('storyteller') >= 0 ? S.elders[elderWith('storyteller')].name + ' is by the fire. Tap the fire for a story.' : 'Tap an elder to see what it does, or give it a role.'), 4200);
}
function leaveVillage() { if (!VL) return; VL = null; scene = 'home'; closeSheet(); setSceneUI(); updateHud(); save(); }
function villageHud() {
  const n = S.elders.length, v = ensureVillage();
  $('#q-name').textContent = 'Glimmer village'; $('#q-biome').textContent = n + (n === 1 ? ' elder' : ' elders') + ' · ' + genName(S.gen); $('#q-shards').textContent = ''; $('#q-rule').hidden = true; $('#q-bag').hidden = true;
  $('#q-hint').textContent = Object.keys(v.roles).length ? 'Tap an elder to see what it does. Tap the fire for a story.' : 'Tap an elder to give it a role. Elders have no needs: a role is something they do for you.';
}

/* ---------- what the roles do ---------- */
/* The gardener: once a local day, one flower waiting to be tended, anywhere in the garden, is tended. Called on
   walking into the village or the garden. Returns a line to tell, or ''. */
function gardenerRound() {
  const k = elderWith('gardener'); if (k < 0 || !unlocked('garden')) return ''; const v = S.village, day = localDay(); if (v.tended === day) return '';
  const now = Date.now(); for (const { Z } of quarterStores()) for (const b of Object.values(Z.beds)) if (b.st < 3 && !b.t) { b.t = now; v.tended = day; return S.elders[k].name + ' tended the ' + FLOWERS[b.el].name + ' in the garden today.'; }
  return '';
}
/* The trader's stall: one thing a week the wandering trader never carries. A costume out of its season that is not
   yet owned, or else two frostberries out of winter, or else a starfruit. */
const villageWeek = () => Math.floor(localDay() / 7);
function stallThing() {
  const v = ensureVillage(), wk = villageWeek(); if (!v.stall || v.stall.week !== wk) v.stall = { week: wk, bought: false };
  const r = RNG((wk * 7919 + S.pet.seed) >>> 0), off = WEAR_IDS.filter(id => WEAR[id].season && WEAR[id].season !== seasonNow() && !wearOwned(id));
  const id = unlocked('wardrobe') && off.length ? 'wear:' + r.pick(off) : seasonNow() !== 'winter' ? 'frost' : 'star';
  return { id, price: id.startsWith('wear:') ? WEAR[id.slice(5)].price : PRICE[id], bought: v.stall.bought };
}
function openStall() {
  const k = elderWith('trader'); if (k < 0) return; const s = stallThing(), e = S.elders[k];
  openSheet('<h2>' + esc(e.name) + '\'s stall</h2><p class="dim">One thing a week the wandering trader never carries. Something new comes each week.</p><div class="list"><button class="card' + (s.bought || S.dust < s.price ? ' off' : '') + '" data-do="buy"' + (s.bought || S.dust < s.price ? ' disabled' : '') + '><canvas data-ic="thing:' + s.id + '" data-size="52"></canvas><span class="tx"><strong>' + esc(thingName(s.id)) + '</strong><small>' + (s.bought ? 'Bought this week.' : s.id.startsWith('wear:') ? 'From another season. ' + esc(WEAR[s.id.slice(5)].text) : s.id === 'frost' ? 'Two winter berries, out of season.' : 'A starfruit.') + '</small></span><span class="tag ' + (s.bought ? 'yes' : 'cost') + '">' + (s.bought ? 'Bought' : '✦ ' + s.price) + '</span></button></div><div class="btns"><button class="btn main" data-do="ok">Close</button></div>',
    { ok: closeSheet, buy: () => { const t = stallThing(); if (t.bought || S.dust < t.price) return; S.dust -= t.price; S.village.stall.bought = true; giveThing(t.id); sfx('buy'); save(); updateHud(); openStall(); toast(thingName(t.id) + ' is yours.'); } });
}
/* The storyteller: the story of the glooms so far, or a tale of the family when there is no chapter yet. */
function familyTale() {
  const r = RNG((localDay() * 131 + S.pet.seed) >>> 0), e = r.pick(S.elders), kids = S.littles.filter(l => littleLevel(l.xp || 0) >= GROWN_AT);
  const tales = [
    e.name + ' finished ' + (e.quests || 0) + ' quests before it handed the nest on, and still talks about the first one.',
    'When ' + e.name + ' was a Hatchling it was scared of the dark. Now it is ' + (FORMS[e.form] ? 'a ' + FORMS[e.form].name : 'Mythic') + ', and nothing much scares it at all.',
    kids.length ? r.pick(kids).name + ' was only an egg once. ' + e.name + ' remembers it hatching.' : 'Every little in the nest started as an egg, rubbed warm by somebody who loved it.'
  ];
  return r.pick(tales);
}
function openFire() {
  const k = elderWith('storyteller'), e = k >= 0 ? S.elders[k] : null, told = S.story ? S.story.told : 0;
  const back = { label: 'Back to the fire', go: openFire };
  openSheet('<h2>By the fire</h2><div class="card"><canvas data-ic="' + (e ? 'elder:' + k : 'kin') + '" data-size="56"></canvas><div class="tx"><strong>' + (e ? esc(e.name) + ', the storyteller' : 'Nobody is telling stories yet') + '</strong><small>' + (e ? esc(familyTale()) : 'Give an elder the storyteller\'s role, and it tells stories here.') + '</small></div></div>' +
    (e && told ? '<h3>The story of the glooms</h3><div class="list">' + CHAPTERS.slice(0, told).map((C, i) => '<button class="card" data-do="chapter" data-i="' + i + '"><canvas data-ic="calm:' + (i % GLOOMS.length) + '" data-size="40"></canvas><span class="tx"><strong>' + esc(C.title) + '</strong><small>Chapter ' + (i + 1) + '</small></span><span class="tag">Listen</span></button>').join('') + '</div>' : '') +
    '<div class="btns"><button class="btn main" data-do="ok">Close</button></div>', { ok: closeSheet, chapter: d => openChapter(+d.i, back) });
}
/* The lamplighter's board: the latest pictures from littles away. */
function boardPics() { const out = []; (S.away || []).forEach((a, i) => a.pics.forEach((p, n) => out.push({ i, n, at: p.at }))); return out.sort((a, b) => b.at - a.at).slice(0, 3); }
function openBoard() {
  const k = elderWith('lamplighter'); if (k < 0) return; const pics = boardPics();
  openSheet('<h2>The village board</h2><p class="dim">' + esc(S.elders[k].name) + ' pins up the pictures littles send from their adventures.</p>' + (pics.length ? '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + pics.map(p => '<button class="card" data-do="selfie" data-i="' + p.i + '" data-n="' + p.n + '" style="padding:6px;justify-content:center"><canvas data-ic="away:' + p.i + ':' + p.n + '" data-size="84" data-w="84" style="border-radius:8px"></canvas></button>').join('') + '</div>' : '<p>No pictures yet. A little that is all grown up can go on an adventure from its sheet in Littles.</p>') +
    '<div class="btns"><button class="btn main" data-do="ok">Close</button></div>', { ok: closeSheet, selfie: d => openSelfie(+d.i, +d.n, openBoard) });
}

/* ---------- an elder and its role ---------- */
function openElder(i) {
  const e = S.elders[i]; if (!e) return; const mine = roleOf(i), v = ensureVillage();
  const row = id => { const who = elderWith(id), R = ROLES[id], other = who >= 0 && who !== i ? S.elders[who].name : '';
    return '<button class="card"' + (mine === id ? ' style="border-color:var(--mint)"' : '') + ' data-do="role" data-r="' + id + '"><span class="tx"><strong>' + R.name + '</strong><small>' + esc(R.text) + (other ? ' ' + esc(other) + ' does this now.' : '') + '</small></span>' + (mine === id ? '<span class="tag yes">Doing this</span>' : '') + '</button>'; };
  openSheet('<h2>' + esc(e.name) + (mine ? ', the ' + ROLES[mine].name.toLowerCase() : '') + '</h2><div class="card"><canvas data-ic="elder:' + i + '" data-size="64"></canvas><div class="tx"><strong>' + esc(e.name) + (FORMS[e.form] ? ' · ' + esc(FORMS[e.form].name) : '') + '</strong><small>' + esc(genName(i + 1)) + '. ' + (e.quests || 0) + (e.quests === 1 ? ' quest' : ' quests') + ' finished.</small></div></div>' +
    '<h3>What ' + esc(e.name) + ' does in the village</h3><div class="list">' + ROLE_IDS.map(row).join('') + '</div><p class="dim" style="margin-top:10px">Elders have no needs. A role is something they do, never something you have to do. Tap a role to give it, or tap it again to take it back.</p><div class="btns"><button class="btn main" data-do="ok">Done</button></div>',
    { ok: closeSheet, role: d => { const r = d.r, who = elderWith(r); if (mine === r) delete v.roles[i]; else { if (who >= 0) delete v.roles[who]; v.roles[i] = r; } save(); villageHud(); openElder(i); if (v.roles[i] === 'gardener') { const l = gardenerRound(); if (l) { save(); toast(l, 3600); } } } });
}

/* ---------- drawing and tapping ---------- */
function villageGround() { const top = topIn + 8, h = VH - topIn - botIn - 8; return { x0: 18, w: VW - 36, y0: top + h * 0.34, h: h * 0.62, top, full: h }; }
function villageSpot(k) { const G = villageGround(), [fx, fy] = VILLAGE_SLOTS[k]; return { x: G.x0 + fx * G.w, y: G.y0 + fy * G.h }; }
function drawCottage(c, x, y, s, hue, lit) {
  c.save(); c.lineJoin = 'round';
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y, s * 0.62, s * 0.12, 0, 0, TAU); c.fill();
  c.fillStyle = '#6d4a3a'; c.fillRect(x + s * 0.18, y - s * 0.92, s * 0.1, s * 0.26);
  for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(230,225,255,' + (0.35 - i * 0.1) + ')'; c.beginPath(); c.arc(x + s * 0.24 + i * s * 0.08 + Math.sin(T + i) * s * 0.02, y - s * 1.0 - i * s * 0.13, s * (0.06 + i * 0.025), 0, TAU); c.fill(); }
  const g = c.createLinearGradient(0, y - s * 0.8, 0, y); g.addColorStop(0, hsl(hue, 45, 70)); g.addColorStop(1, hsl(hue, 40, 52)); c.fillStyle = g; c.strokeStyle = hsl(hue, 40, 30); c.lineWidth = 2;
  c.beginPath(); c.moveTo(x - s * 0.55, y); c.bezierCurveTo(x - s * 0.6, y - s * 0.75, x + s * 0.6, y - s * 0.75, x + s * 0.55, y); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = hsl(40, 55, 58); c.beginPath(); c.moveTo(x - s * 0.62, y - s * 0.3); c.bezierCurveTo(x - s * 0.55, y - s * 1.0, x + s * 0.55, y - s * 1.0, x + s * 0.62, y - s * 0.3); c.quadraticCurveTo(x, y - s * 0.45, x - s * 0.62, y - s * 0.3); c.fill(); c.strokeStyle = hsl(35, 50, 38); c.stroke();
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * s * 0.12, y - s * 0.4); c.lineTo(x + i * s * 0.1, y - s * 0.62); c.stroke(); }
  c.fillStyle = '#5a3a2c'; c.beginPath(); c.moveTo(x - s * 0.13, y); c.lineTo(x - s * 0.13, y - s * 0.2); c.arc(x, y - s * 0.2, s * 0.13, Math.PI, 0); c.lineTo(x + s * 0.13, y); c.closePath(); c.fill();
  if (lit) glow(c, x - s * 0.32, y - s * 0.24, s * 0.3, 45, 100, 65, 0.6);
  c.fillStyle = lit ? '#ffe08a' : '#3a2f55'; c.beginPath(); c.arc(x - s * 0.32, y - s * 0.24, s * 0.08, 0, TAU); c.fill(); c.strokeStyle = '#5a3a2c'; c.lineWidth = 1.5; c.stroke();
  c.restore();
}
function villageLabel(c, x, y, s) { c.save(); c.font = '800 11.5px Nunito, system-ui, sans-serif'; const w = c.measureText(s).width + 16; x = Math.max(w / 2 + 4, Math.min(VW - w / 2 - 4, x)); c.fillStyle = 'rgba(31,23,64,.86)'; c.beginPath(); c.roundRect(x - w / 2, y - 10, w, 20, 10); c.fill(); c.fillStyle = '#ffd97f'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y + 0.5); c.restore(); }
function drawVillage(dt) {
  const c = ctx, G = villageGround(), h = new Date().getHours(), night = h >= 20 || h < 6, dusk = !night && (h >= 17 || h < 8), lamps = elderWith('lamplighter') >= 0 && (night || dusk);
  VL.t += dt; VL.spots = [];
  let g = c.createLinearGradient(0, 0, 0, G.y0); const sky = night ? ['#0d0a2a', '#2b2560'] : dusk ? ['#1b1440', '#f0a07e'] : ['#6fb6ff', '#d8f0ff'];
  g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  if (night || dusk) { const r = RNG(77); for (let i = 0; i < 50; i++) { c.fillStyle = 'rgba(255,255,240,' + (0.3 + r.f() * 0.6) * (night ? 1 : 0.6) + ')'; c.beginPath(); c.arc(r.f() * VW, r.f() * G.y0 * 0.8, r.f() * 1.4 + 0.3, 0, TAU); c.fill(); } }
  c.fillStyle = night ? '#2c2552' : '#4a3a78'; c.beginPath(); c.moveTo(0, G.y0 - 10); c.bezierCurveTo(VW * 0.25, G.y0 - 60, VW * 0.45, G.y0 - 30, VW * 0.6, G.y0 - 38); c.bezierCurveTo(VW * 0.8, G.y0 - 48, VW * 0.9, G.y0 - 30, VW, G.y0 - 36); c.lineTo(VW, G.y0 + 40); c.lineTo(0, G.y0 + 40); c.fill();
  g = c.createLinearGradient(0, G.y0 - 20, 0, VH); g.addColorStop(0, night ? '#2f5a40' : '#4f8a5a'); g.addColorStop(1, night ? '#1b3a28' : '#2d5a3c'); c.fillStyle = g; c.beginPath(); c.moveTo(0, G.y0); c.bezierCurveTo(VW * 0.3, G.y0 - 26, VW * 0.65, G.y0 - 8, VW, G.y0 - 18); c.lineTo(VW, VH); c.lineTo(0, VH); c.fill();
  const r2 = RNG(31); for (let i = 0; i < 80; i++) { const x = r2.f() * VW, y = G.y0 + r2.f() * (VH - G.y0); c.strokeStyle = 'rgba(160,220,150,.3)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 6); c.moveTo(x, y); c.lineTo(x + 2, y - 6); c.stroke(); if (r2.chance(0.3)) { c.fillStyle = hsl(r2.f() * 360, 80, 75); c.beginPath(); c.arc(x + 4, y - 3, 2, 0, TAU); c.fill(); } }
  const fire = { x: G.x0 + G.w * 0.5, y: G.y0 + G.h * 0.66 };
  c.fillStyle = '#cdb27c'; c.beginPath(); c.ellipse(fire.x, fire.y, G.w * 0.24, G.h * 0.09, 0, 0, TAU); c.fill();
  c.fillStyle = '#d9c08f'; c.beginPath(); c.moveTo(fire.x - 22, VH); c.bezierCurveTo(fire.x - 40, fire.y + 80, fire.x + 30, fire.y + 50, fire.x - 6, fire.y + 10); c.lineTo(fire.x + 14, fire.y + 10); c.bezierCurveTo(fire.x + 50, fire.y + 60, fire.x - 10, fire.y + 90, fire.x + 26, VH); c.fill();
  const els = villageElders(), s = Math.min(92, G.w * 0.24), ents = [];
  els.forEach(({ e, i }, k) => {
    const p = villageSpot(k), role = roleOf(i), cs = s * (k === 2 || k === 5 ? 0.78 : 1), hue = (EL_HUE[e.form] !== undefined ? EL_HUE[e.form] : 280);
    ents.push({ y: p.y - 1, draw: () => drawCottage(c, p.x, p.y, cs, hue, lamps || night || dusk) });
    if (role === 'gardener') ents.push({ y: p.y + 2, draw: () => { for (let j = 0; j < 4; j++) drawFlower(c, ELS[(e.seed + j) % 6], p.x - cs * 0.5 + j * cs * 0.2, p.y + 8, cs * 0.3, T, 3); } });
    const side = k % 2 ? -1 : 1;   // the elder stands on the side towards the fire, its stall or board on the other
    if (role === 'trader') { const sx = p.x - side * cs * 0.62, sy = p.y + 10; VL.spots.push({ kind: 'stall', x: sx, y: sy - 14, r: 30 }); ents.push({ y: sy, draw: () => { c.fillStyle = '#8a5a3a'; c.fillRect(sx - 30, sy - 16, 60, 16); c.fillStyle = '#6d4a3a'; c.fillRect(sx - 26, sy, 5, 10); c.fillRect(sx + 21, sy, 5, 10); for (let j = 0; j < 4; j++) { c.fillStyle = j % 2 ? '#fff4e0' : '#4fb3c9'; c.beginPath(); c.moveTo(sx - 32 + j * 16, sy - 30); c.lineTo(sx - 16 + j * 16, sy - 30); c.lineTo(sx - 16 + j * 16, sy - 22); c.quadraticCurveTo(sx - 24 + j * 16, sy - 17, sx - 32 + j * 16, sy - 22); c.fill(); } } }); }
    if (role === 'lamplighter') { const bx = p.x - side * cs * 0.66, by = p.y + 6; VL.spots.push({ kind: 'board', x: bx, y: by - 22, r: 26 }); ents.push({ y: by, draw: () => { c.fillStyle = '#6d4a3a'; c.fillRect(bx - 2, by - 20, 4, 20); c.fillStyle = '#b98a5a'; c.fillRect(bx - 20, by - 46, 40, 28); c.strokeStyle = '#5a3a2c'; c.lineWidth = 2; c.strokeRect(bx - 20, by - 46, 40, 28); const n = boardPics().length; for (let j = 0; j < Math.max(1, n); j++) { c.fillStyle = n ? '#fff6e2' : 'rgba(255,246,226,.35)'; c.fillRect(bx - 16 + j * 11, by - 42 + (j % 2) * 3, 10, 12); } } }); }
    const at = role === 'storyteller' ? { x: fire.x - G.w * 0.16, y: fire.y + 6 } : { x: p.x + side * cs * 0.62, y: p.y + 12 };
    const es = s * 0.5; VL.spots.push({ kind: 'elder', i, x: at.x, y: at.y - es * 0.5, r: es * 0.6 });
    ents.push({ y: at.y, draw: () => { drawCreature(c, petLook(e), at.x, at.y, es, T, { mood: 'happy', glow: 0.3 }); villageLabel(c, at.x, at.y + 14, e.name + (role ? ' · ' + ROLES[role].name.toLowerCase() : '')); } });
  });
  if (lamps) { const a = villageSpot(0), b = villageSpot(Math.min(1, els.length - 1)); if (els.length > 1) { c.strokeStyle = 'rgba(60,40,30,.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(a.x, a.y - s * 0.5); c.quadraticCurveTo((a.x + b.x) / 2, a.y - s * 0.1, b.x, b.y - s * 0.5); c.stroke(); for (let j = 1; j < 8; j++) { const u = j / 8, x = (1 - u) * (1 - u) * a.x + 2 * u * (1 - u) * (a.x + b.x) / 2 + u * u * b.x, y = (1 - u) * (1 - u) * (a.y - s * 0.5) + 2 * u * (1 - u) * (a.y - s * 0.1) + u * u * (b.y - s * 0.5); glow(c, x, y + 5, 12, 45, 100, 65, 0.6); c.fillStyle = hsl([45, 330, 190][j % 3], 90, 72); c.beginPath(); c.arc(x, y + 5, 3.5, 0, TAU); c.fill(); } } }
  ents.push({ y: fire.y, draw: () => {
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; c.fillStyle = '#8c8aa0'; c.beginPath(); c.ellipse(fire.x + Math.cos(a) * 22, fire.y + Math.sin(a) * 9, 6, 4, 0, 0, TAU); c.fill(); }
    glow(c, fire.x, fire.y - 8, 70, 30, 100, 60, 0.5 + 0.08 * Math.sin(T * 7));
    for (const [dx, hh, col] of [[-6, 24, '#ff8a3c'], [5, 30, '#ffb347'], [0, 18, '#fff1a0']]) { const f = hh * (0.9 + 0.1 * Math.sin(T * 9 + dx)); c.fillStyle = col; c.beginPath(); c.moveTo(fire.x + dx - 8, fire.y); c.quadraticCurveTo(fire.x + dx - 6, fire.y - f * 0.6, fire.x + dx, fire.y - f); c.quadraticCurveTo(fire.x + dx + 6, fire.y - f * 0.6, fire.x + dx + 8, fire.y); c.fill(); }
  } });
  VL.spots.push({ kind: 'fire', x: fire.x, y: fire.y - 12, r: 34 });
  const kids = S.littles.filter(l => littleLevel(l.xp || 0) >= GROWN_AT).slice(0, 4);   // grown-up littles at play by the fire
  kids.forEach((l, j) => { const a = T * 0.4 + j * TAU / Math.max(1, kids.length), x = fire.x + Math.cos(a) * G.w * 0.2, y = fire.y + 22 + Math.sin(a) * 14; ents.push({ y, draw: () => drawCreature(c, lookOf(l), x, y, s * 0.26, T, { mood: 'happy', lift: Math.abs(Math.sin(T * 6 + j)) * 4 }) }); });
  ents.sort((a, b) => a.y - b.y); for (const e of ents) e.draw();
}
function villageTap(pt) {
  if (!VL) return; let best = null, bd = 1e9;
  for (const s of VL.spots) { const d = Math.hypot(pt.x - s.x, pt.y - s.y); if (d < s.r + 10 && d < bd) { bd = d; best = s; } }
  if (!best) return; sfx('chirp');
  if (best.kind === 'elder') openElder(best.i); else if (best.kind === 'fire') openFire(); else if (best.kind === 'stall') openStall(); else if (best.kind === 'board') openBoard();
}
ui.barVillage.addEventListener('click', e => {
  const b = e.target.closest('[data-v]'); if (!b || !VL) return; unlockAudio();
  if (b.dataset.v === 'leave') leaveVillage(); else if (b.dataset.v === 'fire') openFire(); else if (b.dataset.v === 'elders') openElders();
});
function openElders() {
  openSheet('<h2>The elders</h2><p class="dim">Each can take one role in the village. Tap one to choose.</p><div class="list">' + S.elders.map((e, i) => '<button class="card" data-do="elder" data-i="' + i + '"><canvas data-ic="elder:' + i + '" data-size="52"></canvas><span class="tx"><strong>' + esc(e.name) + '</strong><small>' + esc(genName(i + 1)) + (roleOf(i) ? ' · ' + ROLES[roleOf(i)].name : ' · no role yet') + '</small></span></button>').join('') + '</div><div class="btns"><button class="btn main" data-do="ok">Close</button></div>', { ok: closeSheet, elder: d => openElder(+d.i) });
}
