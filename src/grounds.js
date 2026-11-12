/* ===== The garden: a place of the player's own to walk round, plant and tend ===== */
/* Its map comes from genGrounds in core.js, by the creature's seed. The save keeps only what the player has done
   there (S.garden): beds by number, each { el, st, t, w, gl }: the flower's kind, its stage (0 seed to 3 bloom), when
   it was last tended (0 while it waits to be tended), since when it has waited, and whether it can still glimmer.
   Hidden places are named by number too: open (those found), wild (the day a wild flower last gave a seed) and
   pods (the seed pods emptied). el is a flower's name in FLOWERS: a kind, or two kinds for a cross ('ember+tide').
   pairs holds, for two beds side by side ('3:4'), when their blooms last made a seed between them. */
let GA = null;   // the garden while it is being walked: its map, where everyone is, what they are doing
const gardenSeed = () => (S.pet.seed ^ 0x9a2d3e7) >>> 0;
const TENDS_A_DAY = 3;   // tends a day that give a little experience
function ensureGarden() { const g = S.garden = S.garden || {}; g.beds = g.beds || {}; g.seeds = g.seeds || {}; g.grown = g.grown || {}; g.glim = g.glim || {}; g.open = g.open || {}; g.wild = g.wild || {}; g.pods = g.pods || {}; g.pairs = g.pairs || {}; return g; }
const gardenHelper = el => S.littles.find(l => kindsOf(l).includes(el));
const inBloom = () => Object.values(ensureGarden().beds).filter(b => b.st >= 3).length;
const toTend = () => Object.values(ensureGarden().beds).filter(b => b.st < 3 && !b.t).length;
const minsLeft = (b, now) => Math.max(1, Math.ceil((b.t + GROUNDS.GROW - now) / 60000));
const hidesFound = () => Object.keys(ensureGarden().open).length;
const needOf = b => flowerNeed(b.el, b.st);
const isCross = id => FLOWERS[id].a !== FLOWERS[id].b;
/* Beds that lie side by side, as pairs of bed numbers. They come from the garden's map, so they are worked out once. */
let bedPairsOf = null;
function bedPairs() { const sd = gardenSeed(); if (!bedPairsOf || bedPairsOf.sd !== sd) { const so = genGrounds(sd).soils, p = []; so.forEach((a, i) => so.forEach((b, j) => { if (j > i && a.y === b.y && Math.abs(a.x - b.x) === 1) p.push([i, j]); })); bedPairsOf = { sd, p }; } return bedPairsOf.p; }
const crossWait = () => gardenHelper('gale') ? GROUNDS.CROSS : GROUNDS.BREEZE;
/* The pairs of blooms side by side that are making a seed: which seed, and when it will be ready. */
function crossing() {
  const g = ensureGarden(), out = [];
  for (const [i, j] of bedPairs()) { const a = g.beds[i], b = g.beds[j]; if (!a || !b || a.st < 3 || b.st < 3) continue; const id = crossOf(a.el, b.el); if (id) out.push({ i, j, id, k: i + ':' + j, at: Math.max(a.w || 0, b.w || 0, g.pairs[i + ':' + j] || 0) + crossWait() }); }
  return out;
}
const aOrAn = w => (/^[AEIOU]/.test(w) ? 'an ' : 'a ') + w;
/* Brings every bed up to now. A tended flower reaches its next stage after GROW. One left waiting for HELP is tended
   by a little of the kind it needs, if the player has one. Two blooms side by side make a seed between them, at most
   one a look. Gives back who helped, what came into bloom and the seeds made. */
function growBeds(now) {
  const g = ensureGarden(), helped = [], bloomed = [], crossed = [];
  for (const k in g.beds) {
    const b = g.beds[k];
    for (let i = 0; i < 8 && b.st < 3; i++) {
      if (b.t) { if (now < b.t + GROUNDS.GROW) break; b.st++; b.w = b.t + GROUNDS.GROW; b.t = 0; if (b.st >= 3) { g.grown[b.el] = (g.grown[b.el] || 0) + 1; if (b.gl) g.glim[b.el] = true; S.j.flowers = (S.j.flowers || 0) + 1; bloomed.push(b); } }
      else { const l = gardenHelper(needOf(b)); if (!l || now < b.w + GROUNDS.HELP) break; b.t = b.w + GROUNDS.HELP; if (!helped.some(h => h.l === l && h.el === b.el)) helped.push({ l, el: b.el }); }
    }
  }
  const kept = {};
  for (const x of crossing()) { if (now >= x.at) { g.seeds[x.id] = (g.seeds[x.id] || 0) + 1; kept[x.k] = now; S.j.crossed = (S.j.crossed || 0) + 1; crossed.push({ id: x.id, a: g.beds[x.i].el, b: g.beds[x.j].el }); } else if (g.pairs[x.k]) kept[x.k] = g.pairs[x.k]; }
  g.pairs = kept;
  return { helped, bloomed, crossed };
}
function gardenCard() {
  const n = inBloom(), w = toTend(), g = ensureGarden(), planted = Object.keys(g.beds).length;
  const line = !g.gift ? 'A place of your own to walk round and plant. A gift of seeds is waiting.' : !planted ? 'Nothing is planted yet. Tap a patch of soil to plant a seed.' : (n ? n + ' in bloom' : 'Nothing in bloom yet') + (w ? ' · ' + w + ' waiting to be tended' : '') + '.';
  return '<button class="card" data-do="garden"><canvas data-ic="flower:bloom" data-size="44"></canvas><span class="tx"><strong>The garden</strong><small>' + esc(line) + '</small></span><span class="tag">Walk in</span></button>';
}
function enterGarden() {
  const p = S.pet; if (!unlocked('garden')) return; if (p.asleep) { toast(p.name + ' is asleep. Wake it first.'); return; }
  closeSheet(); ui.tray.hidden = true; const g = ensureGarden(), first = !g.gift; if (first) { g.gift = true; for (const el of ELS) g.seeds[el] = (g.seeds[el] || 0) + 1; }
  const was = growBeds(Date.now()), M = genGrounds(gardenSeed()), d = new Date(); M.hides.forEach((h, i) => { if (g.open[i]) groundsOpen(M, i); });
  GA = { M, px: M.start.x, py: M.start.y, at: { x: M.start.x, y: M.start.y }, path: [], act: null, trail: [], face: 1, look: petLook(p), happy: 0, sniffAt: -99, mark: null, acc: 0, night: nightAt(d.getHours() + d.getMinutes() / 60), soilAt: new Map(M.soils.map((s, i) => [s.y * M.W + s.x, i])), doorAt: new Map(M.hides.map((h, i) => [h.door.y * M.W + h.door.x, i])), thingAt: new Map(M.hides.filter(h => h.thing).map(h => [h.thing.y * M.W + h.thing.x, M.hides.indexOf(h)])), shut: new Map(),
    lits: partyLittles().slice(0, 3).map((l, i) => ({ l, L: lookOf(l), x: M.start.x, y: M.start.y - 0.3 * (i + 1), hop: 0, busy: 0 })) };
  for (let i = 0; i < 70; i++) GA.trail.push({ x: M.start.x, y: M.start.y - 1.2 + i * 1.2 / 69 });
  gardenShut(); scene = 'garden'; setSceneUI(); gardenHud(); sfx('gate'); save();
  const names = was.helped.map(h => h.l.name).filter((n, i, a) => a.indexOf(n) === i);
  toast(first ? 'A gift of six seeds, one of each kind. Tap a patch of soil to plant one.' : was.crossed.length ? crossLine(was.crossed) : was.bloomed.length ? (was.bloomed.length === 1 ? 'The ' + FLOWERS[was.bloomed[0].el].name + ' has' : was.bloomed.length + ' flowers have') + ' come into bloom while you were away.' : names.length ? names.join(' and ') + ' tended the garden while you were away.' : 'Tap to walk.', 4600);
}
/* What to say of the seeds two blooms have made between them. */
function crossLine(list) {
  const x = list[0], F = FLOWERS[x.id];
  return (x.a === x.b ? 'The two ' + F.name + ' flowers side by side have made ' + aOrAn(F.name) + ' seed.' : 'The ' + FLOWERS[x.a].name + ' and the ' + FLOWERS[x.b].name + ' have crossed: ' + aOrAn(F.name) + ' seed, with something of both.') + (list.length > 1 ? ' ' + (list.length - 1 === 1 ? 'One more seed was' : (list.length - 1) + ' more seeds were') + ' made, too.' : '') + ' Look in the seed tray.';
}
function leaveGarden() {
  if (!GA) return; GA = null; scene = 'home'; $('#q-bag').hidden = false; closeSheet(); setSceneUI(); updateHud(); save();
  if (pendingRemote) adopt(pendingRemote);
}
function gardenHud() {
  if (!GA) return; const n = inBloom(), w = toTend(), g = ensureGarden();
  $('#q-name').textContent = S.pet.name + '\'s garden'; $('#q-biome').textContent = 'Hidden places ' + hidesFound() + ' of ' + GA.M.hides.length; $('#q-shards').textContent = '✿ ' + n + ' in bloom'; $('#q-rule').hidden = true; $('#q-bag').hidden = true;
  $('#q-hint').textContent = GA.carry ? 'Tap an empty patch of soil to set the ' + FLOWERS[g.beds[GA.carry.from].el].name + ' down, or its own patch to put it back.' : w ? 'A bubble shows the kind of little a flower needs. Tap it to tend the flower.' : GA.M.soils.some((s, i) => !g.beds[i] && !GA.shut.has(s.y * GA.M.W + s.x)) && Object.values(g.seeds).some(v => v > 0) ? 'Tap to walk. Tap a patch of soil to plant a seed.' : hidesFound() < GA.M.hides.length && n ? 'Tap a flower in bloom to sniff it or pick it. Tap anything odd in the hedge for a closer look.' : n ? 'Tap a flower in bloom to sniff it or pick it.' : 'Tap to walk. Flowers grow while you are away, too.';
}
ui.barGarden.addEventListener('click', e => {
  const b = e.target.closest('[data-g]'); if (!b || !GA) return; unlockAudio();
  if (b.dataset.g === 'leave') leaveGarden(); else if (b.dataset.g === 'map') openGardenMap(); else openSeeds(-1);
});

/* ---------- walking ---------- */
function gardenView() {
  const A = GA, M = A.M, ts = clamp(VW / 7.5, 40, 70), vw = VW / ts, ph = Math.max(120, VH - topIn - botIn), vh = ph / ts;
  return { ts, ox: M.W <= vw ? (M.W - vw) / 2 : clamp(A.px + 0.5 - vw / 2, 0, M.W - vw), oy: M.H <= vh ? (M.H - vh) / 2 : clamp(A.py + 0.5 - vh / 2, 0, M.H - vh), top: topIn };
}
function gardenPath(sx, sy, ok) {
  const M = GA.M, prev = new Map(), k0 = sy * M.W + sx, q = [k0]; prev.set(k0, -1);
  for (let i = 0; i < q.length; i++) {
    const k = q[i], x = k % M.W, y = (k - x) / M.W;
    if (ok(x, y)) { const p = []; for (let n = k; n !== -1; n = prev.get(n)) p.push({ x: n % M.W, y: (n - n % M.W) / M.W }); return p.reverse().slice(1); }
    for (const [dx, dy] of DIRS) { const nk = (y + dy) * M.W + x + dx; if (!prev.has(nk) && groundsWalk(M, x + dx, y + dy)) { prev.set(nk, k); q.push(nk); } }
  }
  return null;
}
function gardenTap(pt) {
  const A = GA; if (!A || !ui.sheet.hidden) return;
  const V = gardenView(), M = A.M, x = Math.floor(pt.x / V.ts + V.ox), y = Math.floor((pt.y - V.top) / V.ts + V.oy); if (x < 0 || y < 0 || x >= M.W || y >= M.H) return;
  const k = y * M.W + x; if (A.shut.has(k)) return;   // a hidden place not yet found is hedge like any other
  const bed = A.soilAt.get(k), ch = M.rows[y][x], next = (a, b) => Math.abs(a - x) + Math.abs(b - y) === 1;
  if (ch === 'D') { const h = M.hides[A.doorAt.get(k)]; A.path = gardenPath(A.at.x, A.at.y, (a, b) => a === h.at.x && b === h.at.y) || []; A.act = { hide: A.doorAt.get(k) }; A.mark = { x, y, t: 0.5 }; sfx('step'); return; }
  if (ch === 'W' || ch === 'P') { const q = gardenPath(A.at.x, A.at.y, next); if (q) { A.path = q; A.act = { thing: A.thingAt.get(k) }; A.mark = { x, y, t: 0.5 }; sfx('step'); } return; }
  if (A.carry && bed !== undefined) { if (bed === A.carry.from) { A.carry = null; gardenHud(); toast(S.pet.name + ' puts it back.'); return; } if (ensureGarden().beds[bed]) { toast('That patch is taken. Tap an empty patch of soil.'); return; } }
  const p = bed !== undefined ? gardenPath(A.at.x, A.at.y, (a, b) => Math.abs(a - x) + Math.abs(b - y) === 1) : groundsWalk(M, x, y) ? gardenPath(A.at.x, A.at.y, (a, b) => a === x && b === y) : null;
  if (!p) { if (ch === '~') toast('The pond. ' + S.pet.name + ' would rather not get wet.'); return; }
  A.path = p; A.act = bed !== undefined ? { bed } : ch === 'G' ? { gate: true } : null; A.mark = { x, y, t: 0.5 }; sfx('step');
}
function gardenArrive() {
  const A = GA, a = A.act; A.act = null; if (!a) return;
  if (a.gate) { leaveGarden(); return; }
  if (a.hide !== undefined) { tryHide(a.hide); return; }
  if (a.thing !== undefined) { takeThing(a.thing); return; }
  const g = ensureGarden(), now = Date.now(); growBeds(now); const b = g.beds[a.bed], s = A.M.soils[a.bed]; if (s.x !== A.at.x) A.face = Math.sign(s.x - A.at.x);
  if (!b && A.carry) setDown(a.bed);
  else if (!b) openSeeds(a.bed);
  else if (b.st >= 3) openBloom(a.bed);
  else if (b.t) { const m = minsLeft(b, now); toast('The ' + FLOWERS[b.el].name + ' ' + FLOWER_STAGES[b.st] + ' is growing. It will be a ' + FLOWER_STAGES[b.st + 1] + ' in ' + m + (m === 1 ? ' minute.' : ' minutes.'), 3600); }
  else tendBed(a.bed, false);
}

/* ---------- hidden places ---------- */
/* The tiles of every hidden place not yet found. They are drawn as hedge and cannot be tapped. */
function gardenShut() { const A = GA, M = A.M, g = ensureGarden(); A.shut.clear(); M.hides.forEach((h, i) => { if (!g.open[i]) for (let y = h.y0; y <= h.y1; y++) for (let x = h.x0; x <= h.x1; x++) A.shut.set(y * M.W + x, i); }); }
const hideName = h => h.kind === 'over' ? (h.ob === 'bramble' ? 'Bramble nook' : 'Boulder nook') : h.kind === 'vines' ? 'Vine hollow' : FLOWERS[h.el].name + ' door';
const hideHolds = h => h.prize === 'wild' ? 'A wild ' + FLOWERS[h.wild].name + ' grows here, with a seed to spare every ' + GROUNDS.WILD_DAYS + ' days.' : HIDE_PRIZES[h.prize];
/* The Glimmerkin has walked up to the way in of hidden place i: open it if it can be opened, or say what it needs. */
function tryHide(i) {
  const A = GA, g = ensureGarden(), h = A.M.hides[i]; if (!A || g.open[i]) return; if (h.door.x !== A.at.x) A.face = Math.sign(h.door.x - A.at.x);
  const V = gardenView(), x = (h.door.x + 0.5 - V.ox) * V.ts, y = V.top + (h.door.y + 0.5 - V.oy) * V.ts; let line;
  if (h.kind === 'over') {
    const by = OBST[h.ob].by, f = A.lits.find(q => kindsOf(q.l).includes(by)), what = h.ob === 'bramble' ? 'brambles' : 'boulder';
    if (!f) { const own = gardenHelper(by); sfx('no'); toast((h.ob === 'bramble' ? 'Brambles, and something behind them. ' : 'A boulder, and something behind it. ') + (own ? own.name + ' could clear the way. Bring it along in the party.' : 'A little of the ' + KINDS[by].label + ' kind could clear the way. You have none yet.'), 4600); return; }
    f.busy = 1.5; f.bx = h.at.x + (h.door.x - h.at.x) * 0.4; f.by = h.at.y + (h.door.y - h.at.y) * 0.4; f.hop = 1; burst(x, y, 18, EL_HUE[by], { kind: 'star', v: 130, size: 4 }); sfx('skill');
    line = f.l.name + ' clears the ' + what + ' for good.';
  } else if (h.kind === 'lock') {
    const F = FLOWERS[h.el]; if (!Object.values(g.beds).some(b => b.el === h.el && b.st >= 3)) { sfx('no'); toast('A stone door with ' + aOrAn(F.name) + ' carved on it. It opens while ' + aOrAn(F.name) + ' is in bloom in the garden.', 4600); return; }
    burst(x, y, 18, F.hue, { kind: 'star', v: 130, size: 4 }); sfx('gate'); line = 'The carved ' + F.name + ' glows, and the stone door swings open for good.';
  } else { burst(x, y, 14, 60, { kind: 'star', v: 110, size: 3 }); sfx('tinkle'); line = 'The vines only look solid. ' + S.pet.name + ' pushes through.'; }
  g.open[i] = 1; groundsOpen(A.M, i); gardenShut(); A.happy = 1.6; sfx('win'); save(); gardenHud();
  toast(line + ' A hidden place! ' + hideHolds(h), 5200);
}
const wildWait = i => { const d = ensureGarden().wild[i]; return d === undefined ? 0 : Math.max(0, d + GROUNDS.WILD_DAYS - localDay()); };
/* The wild flower or the seed pod of hidden place i. */
function takeThing(i) {
  const A = GA, g = ensureGarden(), h = A.M.hides[i]; if (!A || !g.open[i] || !h.thing) return; if (h.thing.x !== A.at.x) A.face = Math.sign(h.thing.x - A.at.x);
  const V = gardenView(), x = (h.thing.x + 0.5 - V.ox) * V.ts, y = V.top + (h.thing.y + 0.3 - V.oy) * V.ts;
  if (h.prize === 'wild') {
    const F = FLOWERS[h.wild], w = wildWait(i); if (w) { toast('The wild ' + F.name + ' has no seed to spare yet. Come back in ' + w + (w === 1 ? ' day.' : ' days.'), 3600); return; }
    g.wild[i] = localDay(); g.seeds[h.wild] = (g.seeds[h.wild] || 0) + 1; burst(x, y, 10, F.hue, { kind: 'star', v: 100, size: 4 }); sfx('pick'); A.happy = 1.2; save(); gardenHud();
    toast('The wild ' + F.name + ' drops a seed for the seed tray. It will have another in ' + GROUNDS.WILD_DAYS + ' days.', 4200);
  } else {
    if (g.pods[i]) { toast('The seed pod is empty.'); return; }
    g.pods[i] = 1; for (const el of h.pod) g.seeds[el] = (g.seeds[el] || 0) + 1; burst(x, y, 16, 48, { kind: 'star', v: 130, size: 4 }); sfx('pick'); A.happy = 1.6; save(); gardenHud();
    const names = ELS.filter(el => h.pod.includes(el)).map(el => { const n = h.pod.filter(e => e === el).length; return (n === 1 ? 'one' : n === 2 ? 'two' : 'three') + ' ' + FLOWERS[el].name; });
    toast('The seed pod bursts: ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]) + (h.pod.length === 1 ? ' seed' : ' seeds') + ' for the seed tray.', 4600);
  }
}
function openGardenMap() {
  if (!GA) return; const g = ensureGarden(), M = GA.M, n = hidesFound();
  openSheet('<h2>Garden map</h2><p class="dim">Hidden places: ' + n + ' of ' + M.hides.length + ' found. ' + (n < M.hides.length ? 'Cloud lies over those not found yet. Look for something odd in the hedge near one.' : 'Every one is found.') + '</p><canvas data-ic="gmap" data-size="' + M.H * 10 + '" data-w="' + M.W * 10 + '" style="display:block;margin:10px auto;max-width:100%"></canvas>'
    + (n ? '<ul class="plain">' + M.hides.map((h, i) => g.open[i] ? '<li><b>' + hideName(h) + '.</b> ' + hideHolds(h) + '</li>' : '').join('') + '</ul>' : '') + '<div class="btns"><button class="btn main" data-do="ok">Close</button></div>', { ok: closeSheet });
}
/* The garden from above, a few pixels a tile, with cloud over what has not been found. */
function drawGardenMap(c, w, h) {
  if (!GA) return; const A = GA, M = A.M, g = ensureGarden(), s = Math.min(w / M.W, h / M.H);
  const col = { '#': '#1f4a35', T: '#2f6b45', '.': '#5fa052', ',': '#e2cf9c', G: '#b9a4ff', '~': '#3f9ac4', s: '#4a2f22', D: '#1f4a35', W: '#5fa052', P: '#5fa052' };
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) { c.fillStyle = col[A.shut.has(y * M.W + x) ? '#' : M.rows[y][x]]; c.fillRect(x * s, y * s, s + 0.5, s + 0.5); }
  M.soils.forEach((q, i) => { const b = g.beds[i]; if (b && !A.shut.has(q.y * M.W + q.x)) { c.fillStyle = hsl(FLOWERS[b.el].hue, 90, b.st >= 3 ? 68 : 45); c.beginPath(); c.arc((q.x + 0.5) * s, (q.y + 0.5) * s, s * (b.st >= 3 ? 0.42 : 0.24), 0, TAU); c.fill(); } });
  M.hides.forEach((h, i) => {
    if (g.open[i]) { if (h.thing) { c.fillStyle = h.prize === 'wild' ? hsl(FLOWERS[h.wild].hue, 90, 68) : '#d9b25a'; c.beginPath(); c.arc((h.thing.x + 0.5) * s, (h.thing.y + 0.5) * s, s * 0.42, 0, TAU); c.fill(); } return; }
    c.fillStyle = 'rgba(236,232,255,.92)'; for (const [dx, dy, r] of [[-0.9, 0.2, 1], [0, -0.3, 1.25], [0.9, 0.2, 1], [0, 0.5, 1.1]]) { c.beginPath(); c.arc(((h.x0 + h.x1) / 2 + 0.5 + dx) * s, ((h.y0 + h.y1) / 2 + 0.5 + dy) * s, r * s, 0, TAU); c.fill(); }
    c.fillStyle = '#4b3f86'; c.font = '800 ' + Math.round(s * 1.5) + 'px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', ((h.x0 + h.x1) / 2 + 0.5) * s, ((h.y0 + h.y1) / 2 + 0.6) * s);
  });
  c.fillStyle = '#fff'; c.strokeStyle = '#241b4c'; c.lineWidth = 1.5; c.beginPath(); c.arc((A.at.x + 0.5) * s, (A.at.y + 0.5) * s, s * 0.45, 0, TAU); c.fill(); c.stroke();
}

/* ---------- planting, tending, sniffing and picking ---------- */
function seedNeeds(el) {
  const F = FLOWERS[el], lack = [F.a, F.b].filter((k, i, a) => a.indexOf(k) === i && !gardenHelper(k));
  return (isCross(el) ? 'A cross. Needs ' + KINDS[F.a].label + ' and ' + KINDS[F.b].label + ' littles in turn to tend it.' : 'Needs ' + aOrAn(KINDS[el].label) + ' little to tend it.') + (!lack.length ? '' : lack.length === 2 ? ' You have neither yet, so ' + S.pet.name + ' will tend it.' : isCross(el) ? ' You have no ' + KINDS[lack[0]].label + ' little yet, so ' + S.pet.name + ' will take that turn.' : ' You have none yet, so ' + S.pet.name + ' will tend it.');
}
function openSeeds(bed) {
  const g = ensureGarden(), have = FLOWER_IDS.filter(el => g.seeds[el] > 0);
  const cards = have.map(el => '<button class="card" data-do="plant" data-el="' + el + '"' + (bed < 0 ? ' disabled' : '') + '><canvas data-ic="flower:' + el + '" data-size="48"></canvas><span class="tx"><strong>' + FLOWERS[el].name + '</strong><small>' + esc(seedNeeds(el)) + '</small></span><span class="tag">' + g.seeds[el] + (g.seeds[el] === 1 ? ' seed' : ' seeds') + '</span></button>').join('');
  openSheet('<h2>' + (bed < 0 ? 'Seeds' : 'Plant a seed') + '</h2><p class="dim">' + (have.length ? (bed < 0 ? 'Tap a patch of soil to plant one. ' : '') + 'A flower takes about two hours to bloom, and needs tending three times on the way.' : 'No seeds left. Picking a flower in bloom gives two of its seeds.') + '</p><div class="list">' + cards + '</div><div class="btns"><button class="btn' + (bed < 0 || !have.length ? ' main' : '') + '" data-do="ok">' + (bed < 0 || !have.length ? 'Close' : 'Not now') + '</button></div>', { ok: closeSheet, plant: d => { closeSheet(); plantSeed(bed, d.el); } });
}
function bedMid(bed) { const V = gardenView(), s = GA.M.soils[bed]; return [(s.x + 0.5 - V.ox) * V.ts, V.top + (s.y + 0.5 - V.oy) * V.ts, V.ts]; }
function plantSeed(bed, el) {
  const g = ensureGarden(); if (!GA || bed < 0 || g.beds[bed] || !(g.seeds[el] > 0)) return;
  g.seeds[el]--; g.beds[bed] = { el, st: 0, t: 0, w: Date.now(), gl: true }; const rich = GA.M.soils[bed].rich;
  const [x, y] = bedMid(bed); burst(x, y, 10, 30, { v: 70, size: 3 }); GA.happy = 1; sfx('pick'); save(); gardenHud();
  toast(S.pet.name + ' digs in the ' + FLOWERS[el].name + ' seed' + (rich ? ' in the rich soil. It will open glimmering whoever tends it.' : '. Tap its bubble to tend it.'), 3600);
}
function tendBed(bed, byPet) {
  const A = GA, g = ensureGarden(), b = g.beds[bed]; if (!A || !b || b.t || b.st >= 3) return;
  const F = FLOWERS[b.el], need = needOf(b), f = A.lits.find(q => kindsOf(q.l).includes(need)), s = A.M.soils[bed], next = FLOWER_STAGES[b.st + 1], [x, y, ts] = bedMid(bed);
  if (!f && !byPet) {
    const h = gardenHelper(need);
    openSheet('<h2>' + F.name + ' ' + FLOWER_STAGES[b.st] + '</h2><div class="card"><canvas data-ic="kind:' + need + '" data-size="56"></canvas><div class="tx"><strong>It needs ' + aOrAn(KINDS[need].label) + ' little' + (isCross(b.el) ? ' this time' : '') + '</strong><small>' + (h ? esc(h.name) + ' is not in the party. Left alone, ' + esc(h.name) + ' will see to it within the hour.' : 'You have no ' + KINDS[need].species + ' yet.') + ' ' + esc(S.pet.name) + ' can tend it now instead' + (s.rich ? ', and in this rich soil it will still glimmer when it blooms.' : ', but then it will not glimmer when it blooms.') + '</small></div></div><div class="btns"><button class="btn" data-do="no">Leave it</button><button class="btn main" data-do="go">' + esc(S.pet.name) + ' tends it</button></div>', { no: closeSheet, go: () => { closeSheet(); tendBed(bed, true); } });
    return;
  }
  b.t = Date.now(); let line;
  if (f) {
    const l = f.l, day = localDay(), n = l.tend && l.tend.day === day ? l.tend.n : 0; f.busy = 1.5; f.bx = s.x + (A.at.x < s.x ? 0.42 : A.at.x > s.x ? -0.42 : 0.3); f.by = s.y + 0.12; f.hop = 1;
    line = l.name + ' ' + FLOWERS[need].job + '.';
    if (n < TENDS_A_DAY) { const lv = littleLevel(l.xp || 0), m0 = maxSparks(l); l.tend = { day, n: n + 1 }; l.xp = (l.xp || 0) + 1; const a = littleLevel(l.xp); if (a > lv) { line = l.name + ' ' + FLOWERS[need].job + ' and reached level ' + a + (maxSparks(l) > m0 ? ', and now carries one more spark.' : '.') + grownLine(l, lv, a); f.L = lookOf(l); sfx('grow'); } }
    burst(x, y - ts * 0.2, 16, EL_HUE[need], { kind: 'star', v: 110, size: 4 }); sfx('skill');
  } else { if (!s.rich) b.gl = false; A.happy = 1.2; burst(x, y - ts * 0.2, 8, 330, { kind: 'heart', v: 70, size: 4 }); sfx('purr'); line = S.pet.name + ' tends the ' + F.name + '.'; }
  toast(line + ' It will be a ' + next + ' in ' + Math.round(GROUNDS.GROW / 60000) + ' minutes.', 3800); save(); gardenHud();
}
/* What a bloom is doing with the flower beside it, for its sheet. */
function crossNote(bed) {
  const g = ensureGarden(), now = Date.now(), x = crossing().find(q => q.i === bed || q.j === bed);
  if (x) { const o = g.beds[x.i === bed ? x.j : x.i], m = Math.max(1, Math.ceil((x.at - now) / 60000)), known = g.grown[x.id] || g.seeds[x.id] > 0 || !isCross(x.id); return 'Pollen is drifting between it and the ' + FLOWERS[o.el].name + ' beside it. ' + (known ? (/^[AEIOU]/.test(FLOWERS[x.id].name) ? 'An ' : 'A ') + FLOWERS[x.id].name + ' seed' : 'A seed of a new flower') + ' will be ready in about ' + (m >= 120 ? Math.round(m / 60) + ' hours' : m + (m === 1 ? ' minute' : ' minutes')) + (gardenHelper('gale') ? '.' : '. A Gale little would carry the pollen within the hour.'); }
  const nb = bedPairs().filter(p => p[0] === bed || p[1] === bed).map(p => g.beds[p[0] === bed ? p[1] : p[0]]).find(o => o && o.st >= 3);
  if (nb) return 'It will not cross with the ' + FLOWERS[nb.el].name + ' beside it: a crossed flower makes seeds only with another of its own.';
  return 'Two different plain flowers in bloom side by side cross, and make a seed with something of both.';
}
function openBloom(bed) {
  const g = ensureGarden(), b = g.beds[bed]; if (!b) return; const F = FLOWERS[b.el];
  openSheet('<h2>' + F.name + '</h2><div class="card"><canvas data-ic="flower:' + b.el + (b.gl ? ':g' : '') + '" data-size="60"></canvas><div class="tx"><strong>' + (b.gl ? 'In bloom, and glimmering' : 'In bloom') + '</strong><small>' + (b.gl ? 'The right kind of little tended it at every step.' : 'It stays in bloom until you pick it.') + ' Picking it gives two ' + F.name + ' seeds and frees the soil.</small></div></div><p class="dim">' + esc(crossNote(bed)) + '</p><div class="btns"><button class="btn" data-do="move">Move it</button><button class="btn" data-do="pick">Pick it</button><button class="btn main" data-do="sniff">Sniff it</button></div>', {
    sniff: () => { closeSheet(); const A = GA, p = S.pet, [x, y, ts] = bedMid(bed); A.happy = 1.6; burst(x, y - ts * 0.6, 7, 330, { kind: 'heart', v: 70, size: 4 }); sfx('purr'); if (T - A.sniffAt > 25) { A.sniffAt = T; p.joy = clamp(p.joy + 2, 0, 100); save(); } toast(p.name + ' sniffs the ' + F.name + '. Lovely.'); },
    pick: () => { closeSheet(); const [x, y, ts] = bedMid(bed); delete g.beds[bed]; g.seeds[b.el] = (g.seeds[b.el] || 0) + 2; S.j.picked = (S.j.picked || 0) + 1; burst(x, y - ts * 0.5, 14, FLOWERS[b.el].hue, { kind: 'star', v: 120, size: 4 }); sfx('pick'); save(); gardenHud(); toast('Two ' + F.name + ' seeds for the seed tray.'); },
    move: () => { closeSheet(); GA.carry = { from: bed }; GA.happy = 1; sfx('pick'); gardenHud(); toast(S.pet.name + ' lifts the ' + F.name + ', roots and all. Tap an empty patch of soil to set it down.', 4200); }
  });
}
/* Sets the flower being carried down in an empty bed. It keeps its bloom, and starts again with its new neighbours. */
function setDown(bed) {
  const A = GA, g = ensureGarden(); if (!A || !A.carry) return; const from = A.carry.from, b = g.beds[from]; A.carry = null; if (!b || g.beds[bed]) { gardenHud(); return; }
  delete g.beds[from]; b.w = Date.now(); g.beds[bed] = b; const [x, y] = bedMid(bed); burst(x, y, 10, 30, { v: 70, size: 3 }); A.happy = 1; sfx('pick'); growBeds(Date.now()); save(); gardenHud();
  const x2 = crossing().find(q => q.i === bed || q.j === bed);
  toast(S.pet.name + ' sets the ' + FLOWERS[b.el].name + ' down.' + (x2 ? ' Pollen starts to drift between it and the ' + FLOWERS[g.beds[x2.i === bed ? x2.j : x2.i].el].name + ' beside it.' : ''), 4200);
}
function gardenJournal() {
  if (!unlocked('garden')) return ''; const g = ensureGarden(), n = FLOWER_IDS.filter(el => g.grown[el]).length;
  const cell = el => '<div class="cell' + (g.grown[el] ? '' : ' unk') + '"><canvas data-ic="flower:' + el + (g.glim[el] ? ':g' : '') + '" data-size="44"></canvas><span>' + (g.grown[el] ? FLOWERS[el].name : '?') + '</span>' + (g.grown[el] ? '<em>×' + g.grown[el] + (g.glim[el] ? ' ✦' : '') + '</em>' : '') + '</div>';
  return '<h3>The flower book · ' + n + ' of ' + FLOWER_IDS.length + '</h3><p class="dim">Grown in the garden' + (S.j.flowers ? ', ' + S.j.flowers + ' in all' : '') + '. Hidden places found: ' + hidesFound() + ' of ' + GROUNDS.HIDES + '. A flower tended at every step by the right kind of little opens glimmering.</p><div class="grid">' + ELS.map(cell).join('') + '</div><p class="dim">Crosses' + (S.j.crossed ? ', ' + S.j.crossed + (S.j.crossed === 1 ? ' seed' : ' seeds') + ' made' : '') + '. Two different plain flowers in bloom side by side make a seed with something of both.</p><div class="grid">' + FLOWER_IDS.filter(isCross).map(cell).join('') + '</div>';
}

/* ---------- drawing ---------- */
const gdH = (x, y, k) => { const v = Math.sin(x * 127.1 + y * 311.7 + (k || 0) * 74.7) * 43758.5453; return v - Math.floor(v); };
function petalPath(c, shape, L, W) {
  c.beginPath(); c.moveTo(0, 0);
  if (shape === 'round') { c.bezierCurveTo(-W * 1.25, -L * 0.3, -W * 0.95, -L, 0, -L); c.bezierCurveTo(W * 0.95, -L, W * 1.25, -L * 0.3, 0, 0); }
  else if (shape === 'cup') { c.bezierCurveTo(-W * 1.5, -L * 0.2, -W * 1.4, -L * 1.05, 0, -L * 0.88); c.bezierCurveTo(W * 1.4, -L * 1.05, W * 1.5, -L * 0.2, 0, 0); }
  else if (shape === 'flame') { c.bezierCurveTo(-W * 1.35, -L * 0.35, -W * 0.7, -L * 0.8, W * 0.25, -L * 1.06); c.bezierCurveTo(W * 0.15, -L * 0.75, W * 1.25, -L * 0.4, 0, 0); }
  else if (shape === 'facet') { c.lineTo(-W * 1.05, -L * 0.45); c.lineTo(0, -L); c.lineTo(W * 1.05, -L * 0.45); }
  else if (shape === 'frill') { c.bezierCurveTo(-W * 0.95, -L * 0.3, -W * 0.85, -L * 0.95, -W * 0.38, -L); c.lineTo(0, -L * 0.84); c.lineTo(W * 0.38, -L); c.bezierCurveTo(W * 0.85, -L * 0.95, W * 0.95, -L * 0.3, 0, 0); }
  else { c.quadraticCurveTo(-W * 0.95, -L * 0.42, 0, -L); c.quadraticCurveTo(W * 0.95, -L * 0.42, 0, 0); }
  c.closePath();
}
function petalRing(c, F, el, R, W, rot, hue, light, open) {
  for (let i = 0; i < F.n; i++) {
    c.save(); c.scale(1, 0.86); c.rotate(rot + i * TAU / F.n);
    const g = c.createLinearGradient(0, 0, 0, -R); g.addColorStop(0, hsl(hue + 18, 85, light - 18)); g.addColorStop(1, hsl(hue - 6, 95, light + 10));
    c.fillStyle = g; c.strokeStyle = hsl(hue + 25, 55, 24, 0.9); c.lineWidth = Math.max(1, R * 0.05); petalPath(c, F.shape, R * open, W * (0.55 + 0.45 * open)); c.fill(); c.stroke();
    if (el === 'stone') { c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = Math.max(0.8, R * 0.03); c.beginPath(); c.moveTo(0, -R * 0.15); c.lineTo(0, -R * 0.85 * open); c.stroke(); }
    if (el === 'tide' && i === 1) { c.fillStyle = 'rgba(220,245,255,.85)'; c.beginPath(); c.arc(-W * 0.3, -R * 0.62 * open, R * 0.09, 0, TAU); c.fill(); }
    c.restore();
  }
}
/* A flower of one kind. x, y is where its stem meets the soil; stage runs from 0 (seed) to 3 (bloom) and may be
   part-way while it grows. o.shine: glimmering. o.still: no sway, for icons. */
function drawFlower(c, el, x, y, s, t, stage, o) {
  o = o || {}; const F = FLOWERS[el], FB = FLOWERS[F.b], has = k => F.a === k || F.b === k, ph = FLOWER_IDS.indexOf(el) * 1.3, open = clamp(stage - 2, 0, 1), grow = clamp(stage, 0, 3) / 3;
  c.save(); c.lineJoin = 'round';
  if (stage < 0.6) {
    c.fillStyle = hsl(28, 30, 22); c.beginPath(); c.ellipse(x, y, s * 0.16, s * 0.06, 0, Math.PI, TAU); c.fill();
    c.fillStyle = hsl(F.hue, 70, 62); c.strokeStyle = hsl(F.hue + 20, 50, 25); c.lineWidth = 1; c.beginPath(); c.ellipse(x, y - s * 0.05, s * 0.05, s * 0.035, -0.4, 0, TAU); c.fill(); c.stroke(); c.restore(); return;
  }
  const sway = o.still ? 0 : Math.sin(t * 1.3 + ph) * (has('gale') ? 0.09 : 0.04), H = s * (0.18 + 0.62 * grow), hx = x + Math.sin(sway) * H, hy = y - Math.cos(sway) * H;
  c.strokeStyle = hsl(128, 45, 34); c.lineWidth = Math.max(1.5, s * 0.035); c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - s * 0.04, y - H * 0.55, hx, hy); c.stroke();
  const leaf = (u, side, L) => { c.save(); c.translate(lerp(x, hx, u) - s * 0.02, lerp(y, hy, u)); c.rotate(side * (1 + (o.still ? 0 : Math.sin(t * 1.1 + ph + side) * 0.06))); c.fillStyle = hsl(118, 50, 42); c.strokeStyle = hsl(140, 50, 20); c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-L * 0.35, -L * 0.5, 0, -L); c.quadraticCurveTo(L * 0.35, -L * 0.5, 0, 0); c.fill(); c.stroke(); c.restore(); };
  if (stage < 1.6) { leaf(0.95, -1, s * 0.16 * Math.min(1, stage)); leaf(0.95, 1, s * 0.16 * Math.min(1, stage)); c.restore(); return; }
  leaf(0.3, -1, s * 0.2); leaf(0.5, 1, s * 0.17); if (has('bloom')) leaf(0.7, -1, s * 0.13);
  const R = s * (0.2 + 0.14 * open);
  if (has('glow') && open > 0.3) glow(c, hx, hy, R * 2.4, FLOWERS.glow.hue, 100, 70, 0.3 * open);
  if (o.shine && open > 0.5) glow(c, hx, hy, R * 2.4, 48, 100, 75, 0.35 + (o.still ? 0 : 0.15 * Math.sin(t * 3 + ph)));
  c.save(); c.translate(hx, hy); c.rotate(sway * 0.6);
  if (open <= 0.02) {
    const bh = s * 0.22 * clamp(stage - 1, 0.4, 1); const bg = c.createLinearGradient(0, 0, 0, -bh); bg.addColorStop(0, hsl(F.hue, 75, 55)); bg.addColorStop(1, hsl(FB.hue, 75, 58)); c.fillStyle = bg; c.strokeStyle = hsl(F.hue + 25, 55, 24); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-bh * 0.55, -bh * 0.15, -bh * 0.35, -bh * 0.9, 0, -bh); c.bezierCurveTo(bh * 0.35, -bh * 0.9, bh * 0.55, -bh * 0.15, 0, 0); c.fill(); c.stroke();
    c.fillStyle = hsl(118, 50, 38); for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sd * bh * 0.5, -bh * 0.05, sd * bh * 0.3, -bh * 0.35); c.quadraticCurveTo(sd * bh * 0.15, -bh * 0.1, 0, 0); c.fill(); }
    c.restore(); c.restore(); return;
  }
  const lt = o.shine ? 72 : 62, rot = -Math.PI / 2 + (o.still ? 0 : Math.sin(t * 0.4 + ph) * 0.05), cr = R * 0.2;
  petalRing(c, F, F.a, R, R * 0.36, rot, F.hue, lt, open); petalRing(c, FB, F.b, R * 0.62, R * 0.27, rot + Math.PI / FB.n, FB.hue - 12, lt + 8, open);
  c.fillStyle = hsl(46, 95, 66); c.strokeStyle = hsl(30, 60, 30); c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, cr, cr * 0.86, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = 'rgba(80,40,10,.45)'; for (let i = 0; i < 5; i++) { const a = i * 2.4 + ph; c.beginPath(); c.arc(Math.cos(a) * cr * 0.45, Math.sin(a) * cr * 0.4, cr * 0.13, 0, TAU); c.fill(); }
  c.restore();
  if (open > 0.6) {   // each kind's own touch
    if (has('ember')) flame(c, hx, hy - cr * 0.3, R * 0.11, o.still ? 0 : t, ph);
    if (has('glow')) for (let i = 0; i < 3; i++) { const a = (o.still ? 0 : t * 1.2) + i * TAU / 3 + ph, mx = hx + Math.cos(a) * R * 1.25, my = hy + Math.sin(a) * R * 0.55; glow(c, mx, my, R * 0.3, 50, 100, 72, 0.7); c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(mx, my, Math.max(1, R * 0.05), 0, TAU); c.fill(); }
    if (has('gale') && !o.still) for (let i = 0; i < 2; i++) { const u = (t * 0.25 + i * 0.5 + ph) % 1, dx = hx + Math.sin(u * 6 + i) * R * 0.8 + u * R * 1.2, dy = hy - u * s * 0.9; c.strokeStyle = 'rgba(240,255,250,' + (0.8 * (1 - u)) + ')'; c.lineWidth = 1; for (let k = 0; k < 6; k++) { const a = k * TAU / 6; c.beginPath(); c.moveTo(dx, dy); c.lineTo(dx + Math.cos(a) * R * 0.12, dy + Math.sin(a) * R * 0.12); c.stroke(); } }
    if (has('stone') && !o.still) { const k = (t * 0.7 + ph) % 3; if (k < 0.5) { c.fillStyle = 'rgba(255,255,255,' + Math.sin(k / 0.5 * Math.PI) + ')'; starPath(c, hx + R * 0.6, hy - R * 0.5, R * 0.16, R * 0.04, 4, 0); c.fill(); } }
  }
  if (o.shine && open > 0.5) for (let i = 0; i < 4; i++) { const a = i * 1.7 + ph, k = o.still ? 0.5 : (t * 0.9 + i * 0.37) % 1; c.fillStyle = 'rgba(255,248,200,' + Math.sin(k * Math.PI) + ')'; starPath(c, hx + Math.cos(a) * R * 1.35, hy + Math.sin(a) * R, R * 0.18 * Math.sin(k * Math.PI), R * 0.05, 4, 0); c.fill(); }
  c.restore();
}
/* A bed: dark soil ringed by small stones. x, y is its middle. */
function drawBed(c, x, y, w, t, empty) {
  const h = w * 0.34; c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y + h * 0.18, w * 0.54, h * 0.6, 0, 0, TAU); c.fill();
  const g = c.createRadialGradient(x, y - h * 0.1, w * 0.05, x, y, w * 0.5); g.addColorStop(0, '#5a3b2a'); g.addColorStop(1, '#2e1d17'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, w * 0.5, h * 0.5, 0, 0, TAU); c.fill();
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = w * (0.045 + ((i * 37) % 5) * 0.004); c.fillStyle = hsl(255, 12, 48 + Math.sin(a) * 10); c.strokeStyle = 'rgba(20,12,30,.6)'; c.lineWidth = 1; c.beginPath(); c.ellipse(x + Math.cos(a) * w * 0.5, y + Math.sin(a) * h * 0.5, r * 1.2, r * 0.8, 0, 0, TAU); c.fill(); c.stroke(); }
  if (empty) { c.strokeStyle = 'rgba(200,255,230,' + (0.6 + 0.25 * Math.sin(t * 3)) + ')'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - w * 0.07, y); c.lineTo(x + w * 0.07, y); c.moveTo(x, y - w * 0.07); c.lineTo(x, y + w * 0.07); c.stroke(); }
}
/* The bubble over a flower that says which kind of little it needs. */
function drawNeed(c, x, y, r, kind, t) {
  y += Math.sin(t * 2.4 + x) * r * 0.18; const h = EL_HUE[kind];
  c.save(); c.fillStyle = 'rgba(255,255,255,.94)'; c.strokeStyle = 'rgba(60,40,110,.6)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(x - r * 0.55, y + r * 1.25, r * 0.22, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = hsl(h, 80, 55); c.strokeStyle = hsl(h, 60, 26); c.lineWidth = 1; c.lineCap = 'round';
  if (kind === 'tide') { c.beginPath(); c.moveTo(x, y - r * 0.62); c.bezierCurveTo(x + r * 0.55, y - r * 0.05, x + r * 0.45, y + r * 0.55, x, y + r * 0.55); c.bezierCurveTo(x - r * 0.45, y + r * 0.55, x - r * 0.55, y - r * 0.05, x, y - r * 0.62); c.fill(); c.stroke(); }
  else if (kind === 'ember') flame(c, x, y + r * 0.35, r * 0.32, t, 0);
  else if (kind === 'glow') { starPath(c, x, y, r * 0.58, r * 0.25, 5, -Math.PI / 2); c.fill(); c.stroke(); }
  else if (kind === 'gale') { c.lineWidth = Math.max(1.5, r * 0.14); c.strokeStyle = hsl(h, 70, 40); for (const k of [-0.25, 0.15]) { c.beginPath(); c.moveTo(x - r * 0.55, y + k * r * 2); c.quadraticCurveTo(x + r * 0.2, y + k * r * 2 - r * 0.3, x + r * 0.45, y + k * r * 2 + r * 0.05); c.stroke(); } }
  else if (kind === 'stone') { c.beginPath(); c.ellipse(x, y + r * 0.08, r * 0.5, r * 0.38, -0.2, 0, TAU); c.fill(); c.stroke(); }
  else { c.beginPath(); c.moveTo(x - r * 0.4, y + r * 0.45); c.quadraticCurveTo(x - r * 0.5, y - r * 0.5, x + r * 0.45, y - r * 0.45); c.quadraticCurveTo(x + r * 0.4, y + r * 0.4, x - r * 0.4, y + r * 0.45); c.fill(); c.stroke(); }
  c.restore();
}
function gdGrass(c, x, y, s, gx, gy) {
  c.fillStyle = hsl(112 + gdH(gx, gy) * 16, 44, 35 + gdH(gx, gy, 1) * 5); c.fillRect(x, y, s + 1, s + 1);
  c.strokeStyle = 'rgba(190,240,150,.28)'; c.lineWidth = 1; for (let i = 0; i < 3; i++) { const px = x + gdH(gx, gy, i + 2) * s, py = y + gdH(gx, gy, i + 5) * s; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 1.5, py - s * 0.09); c.moveTo(px + 3, py); c.lineTo(px + 3, py - s * 0.11); c.stroke(); }
  if (gdH(gx, gy, 9) < 0.14) { const px = x + s * (0.2 + gdH(gx, gy, 10) * 0.6), py = y + s * (0.2 + gdH(gx, gy, 11) * 0.6); c.fillStyle = gdH(gx, gy, 12) < 0.5 ? '#fff' : '#ffe9a0'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(px + Math.cos(i * 1.26) * s * 0.045, py + Math.sin(i * 1.26) * s * 0.045, s * 0.03, 0, TAU); c.fill(); } c.fillStyle = '#f5b83a'; c.beginPath(); c.arc(px, py, s * 0.025, 0, TAU); c.fill(); }
}
function gdPath(c, x, y, s, gx, gy) { for (let i = 0; i < 3; i++) { c.fillStyle = hsl(40, 38, 70 + gdH(gx, gy, i) * 8, 0.85); c.beginPath(); c.ellipse(x + s * (0.28 + (i % 2) * 0.42 + gdH(gx, gy, i + 3) * 0.08), y + s * (0.2 + i * 0.3), s * 0.19, s * 0.12, gdH(gx, gy, i + 6), 0, TAU); c.fill(); } }
function gdWater(c, x, y, s, gx, gy, t) {
  c.fillStyle = hsl(198 + gdH(gx, gy) * 8, 62, 44); c.fillRect(x, y, s + 1, s + 1);
  c.strokeStyle = 'rgba(220,245,255,.4)'; c.lineWidth = 1.2; for (let i = 0; i < 2; i++) { const px = x + ((gdH(gx, gy, i) + t * 0.05) % 1) * s * 0.7, py = y + s * (0.3 + i * 0.4); c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + s * 0.12, py - s * 0.05, px + s * 0.25, py); c.stroke(); }
  if (gdH(gx, gy, 4) < 0.3) { const cx = x + s * 0.5, cy = y + s * 0.55 + Math.sin(t * 1.5 + gx) * 1.2; c.fillStyle = '#3f9a5d'; c.strokeStyle = '#1f5a3a'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, s * 0.26, 0.3, TAU - 0.3); c.closePath(); c.fill(); c.stroke(); }
}
function gdHedge(c, x, y, s, gx, gy, t, tree) {
  const sw = REDUCED ? 0 : Math.sin(t * 0.9 + gx + gy) * s * 0.012;
  if (tree) { c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x + s * 0.5, y + s * 0.92, s * 0.3, s * 0.1, 0, 0, TAU); c.fill(); c.fillStyle = '#5b4030'; c.fillRect(x + s * 0.42, y + s * 0.4, s * 0.16, s * 0.52); }
  for (const [bx, by, br] of tree ? [[0.5, 0.14, 0.5]] : [[0.27, 0.52, 0.33], [0.73, 0.52, 0.33], [0.5, 0.34, 0.38]]) {
    const cx = x + s * bx + sw, cy = y + s * by, g = c.createRadialGradient(cx - br * s * 0.3, cy - br * s * 0.4, br * s * 0.1, cx, cy, br * s);
    g.addColorStop(0, hsl(128 + gdH(gx, gy, 4) * 20, 46, tree ? 36 : 31)); g.addColorStop(1, hsl(150, 50, 15)); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, br * s, 0, TAU); c.fill();
  }
  if (gdH(gx, gy, 6) < 0.3) { c.fillStyle = gdH(gx, gy, 7) < 0.5 ? '#ffc2dc' : '#fff2b0'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + s * (0.25 + gdH(gx, gy, 8 + i) * 0.5), y + s * (0.2 + gdH(gx, gy, 12 + i) * 0.4), s * 0.035, 0, TAU); c.fill(); } }
}
function gdGate(c, x, y, s, t) {
  c.fillStyle = '#6f6a85'; c.strokeStyle = '#2a2440'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + s * 0.08, y + s); c.lineTo(x + s * 0.08, y + s * 0.3); c.arc(x + s * 0.5, y + s * 0.3, s * 0.42, Math.PI, TAU); c.lineTo(x + s * 0.92, y + s); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#241b4c'; c.beginPath(); c.moveTo(x + s * 0.24, y + s); c.lineTo(x + s * 0.24, y + s * 0.36); c.arc(x + s * 0.5, y + s * 0.36, s * 0.26, Math.PI, TAU); c.lineTo(x + s * 0.76, y + s); c.closePath(); c.fill();
  glow(c, x + s * 0.5, y + s * 0.6, s * 0.5, 265, 100, 75, 0.45 + 0.15 * Math.sin(t * 2));
}
/* A way in that is still shut. Brambles and boulders are plain to see; vines and a stone door sit in the hedge. */
function gdDoor(c, h, x, y, s, gx, gy, t) {
  const cx = x + s / 2, cy = y + s / 2; c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  if (h.kind === 'over' && h.ob === 'boulder') {
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(cx, y + s * 0.86, s * 0.42, s * 0.12, 0, 0, TAU); c.fill();
    const g = c.createRadialGradient(cx - s * 0.12, cy - s * 0.2, s * 0.05, cx, cy, s * 0.55); g.addColorStop(0, '#b3abc4'); g.addColorStop(1, '#4b4560'); c.fillStyle = g; c.strokeStyle = '#1c1826'; c.lineWidth = Math.max(1.2, s * 0.035);
    c.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU, q = s * (0.4 + (gdH(gx, gy, i % 8) - 0.5) * 0.1), px = cx + Math.cos(a) * q, py = cy + s * 0.04 + Math.sin(a) * q * 0.92; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(28,24,38,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - s * 0.1, cy - s * 0.2); c.lineTo(cx + s * 0.02, cy); c.lineTo(cx - s * 0.05, cy + s * 0.18); c.stroke();
  } else if (h.kind === 'over') {
    for (let i = 0; i < 7; i++) { const a0 = gdH(gx, gy, i) * TAU, x0 = cx + Math.cos(a0) * s * 0.46, y0 = cy + Math.sin(a0) * s * 0.46, x1 = cx - Math.cos(a0 + gdH(gx, gy, i + 7) - 0.5) * s * 0.46, y1 = cy - Math.sin(a0 + gdH(gx, gy, i + 7) - 0.5) * s * 0.46, mx = cx + (gdH(gx, gy, i + 14) - 0.5) * s * 0.5, my = cy + (gdH(gx, gy, i + 21) - 0.5) * s * 0.5; c.strokeStyle = '#1a1410'; c.lineWidth = s * 0.11; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, x1, y1); c.stroke(); c.strokeStyle = hsl(24 + i * 5, 38, 30); c.lineWidth = s * 0.06; c.stroke(); }
    for (let i = 0; i < 4; i++) { c.fillStyle = '#ff6f91'; c.beginPath(); c.arc(x + s * (0.22 + gdH(gx, gy, 30 + i) * 0.56), y + s * (0.22 + gdH(gx, gy, 34 + i) * 0.56), s * 0.05, 0, TAU); c.fill(); }
  } else if (h.kind === 'lock') {
    c.fillStyle = '#8c86a3'; c.strokeStyle = '#2a2440'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + s * 0.06, y + s); c.lineTo(x + s * 0.06, y + s * 0.42); c.arc(cx, y + s * 0.42, s * 0.44, Math.PI, TAU); c.lineTo(x + s * 0.94, y + s); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#5d5876'; c.beginPath(); c.moveTo(x + s * 0.2, y + s); c.lineTo(x + s * 0.2, y + s * 0.46); c.arc(cx, y + s * 0.46, s * 0.3, Math.PI, TAU); c.lineTo(x + s * 0.8, y + s); c.closePath(); c.fill(); c.stroke();
    c.globalAlpha = 0.55 + (REDUCED ? 0 : 0.2 * Math.sin(t * 2)); drawFlower(c, h.el, cx, y + s * 0.92, s * 0.62, 0, 3, { still: true }); c.globalAlpha = 1;
  } else {
    gdHedge(c, x, y, s, gx, gy, t, false);
    for (let i = 0; i < 5; i++) { const vx = x + s * (0.12 + i * 0.19), len = s * (0.5 + gdH(gx, gy, 40 + i) * 0.4), sw = REDUCED ? 0 : Math.sin(t * 1.2 + i) * s * 0.03; c.strokeStyle = hsl(96, 55, 48); c.lineWidth = Math.max(1.5, s * 0.04); c.beginPath(); c.moveTo(vx, y + s * 0.08); c.quadraticCurveTo(vx + sw, y + len * 0.5, vx + sw * 2, y + len); c.stroke(); c.fillStyle = hsl(104, 60, 56); for (let k = 1; k <= 3; k++) { c.beginPath(); c.ellipse(vx + sw * k * 0.6 + (k % 2 ? 1 : -1) * s * 0.04, y + len * k / 3.2, s * 0.05, s * 0.03, k, 0, TAU); c.fill(); } }
    for (let i = 0; i < 3; i++) { const a = (REDUCED ? 0 : t * (0.7 + i * 0.2)) + i * 2.1; glow(c, cx + Math.cos(a) * s * 0.34, cy + Math.sin(a * 1.3) * s * 0.26, s * 0.12, 58, 100, 72, 0.85); }
  }
  c.restore();
}
/* A seed pod, whole or burst. x, y is where it sits on the ground. */
function gdPod(c, x, y, s, empty, t) {
  c.save(); c.lineJoin = 'round'; c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x, y, s * 0.3, s * 0.08, 0, 0, TAU); c.fill(); c.strokeStyle = '#3a2a12'; c.lineWidth = Math.max(1.2, s * 0.03);
  if (empty) { for (const sd of [-1, 1]) { c.fillStyle = '#8a6a34'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + sd * s * 0.34, y - s * 0.04, x + sd * s * 0.3, y - s * 0.3); c.quadraticCurveTo(x + sd * s * 0.12, y - s * 0.16, x, y); c.fill(); c.stroke(); } }
  else { const b = REDUCED ? 0 : Math.sin(t * 2.2) * s * 0.012; glow(c, x, y - s * 0.26, s * 0.5, 48, 100, 70, 0.3); const g = c.createLinearGradient(x - s * 0.2, y - s * 0.5, x + s * 0.2, y); g.addColorStop(0, '#e9c873'); g.addColorStop(1, '#9a7434'); c.fillStyle = g; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x - s * 0.34, y - s * 0.1, x - s * 0.26, y - s * 0.5 - b, x, y - s * 0.6 - b); c.bezierCurveTo(x + s * 0.26, y - s * 0.5 - b, x + s * 0.34, y - s * 0.1, x, y); c.fill(); c.stroke(); c.beginPath(); c.moveTo(x, y - s * 0.04); c.quadraticCurveTo(x + s * 0.06, y - s * 0.3, x, y - s * 0.56 - b); c.stroke(); }
  c.restore();
}
function drawGarden(dt) {
  const A = GA, M = A.M, c = ctx, g = ensureGarden(), now = Date.now();
  A.acc += dt; if (A.acc >= 1) { A.acc = 0; const was = growBeds(now); if (was.crossed.length) { sfx('grow'); toast(crossLine(was.crossed), 5200); save(); } else if (was.bloomed.length) { sfx('grow'); toast('The ' + FLOWERS[was.bloomed[0].el].name + ' is in bloom!', 3600); save(); } if (was.bloomed.length || was.helped.length || was.crossed.length) gardenHud(); }
  // walking
  let left = dt * 4.6, moved = false;
  while (A.path.length && left > 0) { const n = A.path[0], dx = n.x - A.px, dy = n.y - A.py, d = Math.hypot(dx, dy); if (dx) A.face = Math.sign(dx); if (d <= left) { A.px = n.x; A.py = n.y; A.at = n; A.path.shift(); left -= d; } else { A.px += dx / d * left; A.py += dy / d * left; left = 0; } moved = true; }
  if (moved) { const l = A.trail[A.trail.length - 1]; if (Math.hypot(l.x - A.px, l.y - A.py) > 0.04) { A.trail.push({ x: A.px, y: A.py }); if (A.trail.length > 90) A.trail.shift(); } }
  if (!A.path.length && A.act) gardenArrive(); if (!GA) return;
  A.lits.forEach((f, i) => { const p = f.busy > 0 ? { x: f.bx, y: f.by } : A.trail[Math.max(0, A.trail.length - 1 - (i + 1) * 20)]; f.busy = Math.max(0, f.busy - dt); f.dx = p.x - f.x; f.x = lerp(f.x, p.x, Math.min(1, dt * 9)); f.y = lerp(f.y, p.y, Math.min(1, dt * 9)); f.hop = Math.max(0, f.hop - dt * 1.6); });
  A.happy = Math.max(0, A.happy - dt);
  const V = gardenView(), ts = V.ts, X = x => (x - V.ox) * ts, Y = y => V.top + (y - V.oy) * ts;
  const x0 = Math.floor(V.ox) - 1, x1 = Math.ceil(V.ox + VW / ts), y0 = Math.floor(V.oy - V.top / ts) - 1, y1 = Math.ceil(V.oy + (VH - V.top) / ts);
  const at = (x, y) => x < 0 || y < 0 || x >= M.W || y >= M.H || A.shut.has(y * M.W + x) ? '#' : M.rows[y][x];
  c.fillStyle = '#17392c'; c.fillRect(0, 0, VW, VH);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const ch = at(x, y); if (ch === '~') gdWater(c, X(x), Y(y), ts, x, y, T); else gdGrass(c, X(x), Y(y), ts, x, y); if (ch === ',' || ch === 'G') gdPath(c, X(x), Y(y), ts, x, y); }
  if (A.mark && A.mark.t > 0) { A.mark.t -= dt; c.strokeStyle = 'rgba(255,255,255,' + A.mark.t * 1.6 + ')'; c.lineWidth = 2; c.beginPath(); c.ellipse(X(A.mark.x + 0.5), Y(A.mark.y + 0.55), ts * 0.4 * (1.2 - A.mark.t), ts * 0.22 * (1.2 - A.mark.t), 0, 0, TAU); c.stroke(); }
  // back to front, a row at a time: hedges, beds and whoever stands in that row
  const who = A.lits.map(f => ({ y: f.y, f: () => drawCreature(c, f.L, X(f.x + 0.5), Y(f.y + 0.8), ts * 0.62, T, { lift: Math.sin(f.hop * Math.PI) * ts * 0.4, mood: f.hop > 0 || f.busy > 0 ? 'happy' : 'idle', look: { x: clamp((f.dx || 0) * 30, -0.6, 0.6) || A.face * 0.3, y: 0 } }) }));
  who.push({ y: A.py + 0.01, f: () => drawCreature(c, A.look, X(A.px + 0.5), Y(A.py + 0.85), ts * 0.88, T, { mood: A.happy > 0 ? 'happy' : 'idle', squash: moved && !REDUCED ? Math.sin(T * 14) * 0.04 : 0, look: { x: moved ? A.face * 0.6 : 0, y: 0 } }) });
  const needs = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ch = at(x, y), sx = X(x), sy = Y(y);
      if (ch === '#' || ch === 'T') gdHedge(c, sx, sy, ts, x, y, T, ch === 'T' || gdH(x, y, 3) < 0.25);
      else if (ch === 'G') gdGate(c, sx, sy + ts * 0.3, ts, T);
      else if (ch === 'D') gdDoor(c, M.hides[A.doorAt.get(y * M.W + x)], sx, sy, ts, x, y, T);
      else if (ch === 'W' || ch === 'P') {
        const i = A.thingAt.get(y * M.W + x), h = M.hides[i];
        if (ch === 'P') gdPod(c, sx + ts / 2, sy + ts * 0.78, ts, !!g.pods[i], T);
        else { drawFlower(c, h.wild, sx + ts / 2, sy + ts * 0.8, ts * 1.2, T, 3, { still: REDUCED }); if (!wildWait(i)) { const u = REDUCED ? 0.5 : (T * 0.8) % 1; c.fillStyle = 'rgba(255,248,200,' + Math.sin(u * Math.PI) + ')'; starPath(c, sx + ts * 0.82, sy + ts * 0.1, ts * 0.11, ts * 0.035, 4, 0); c.fill(); } }
      }
      else if (ch === 's') {
        const bn = A.soilAt.get(y * M.W + x), b = A.carry && A.carry.from === bn ? null : g.beds[bn]; drawBed(c, sx + ts / 2, sy + ts * 0.62, ts * 0.86, T, !b); if (M.soils[bn].rich) { glow(c, sx + ts / 2, sy + ts * 0.62, ts * 0.5, 48, 100, 70, 0.22); for (let i = 0; i < 3; i++) { const u = REDUCED ? 0.5 : (T * 0.6 + i / 3) % 1; c.fillStyle = 'rgba(255,240,170,' + Math.sin(u * Math.PI) * 0.9 + ')'; starPath(c, sx + ts * (0.25 + i * 0.25), sy + ts * (0.7 - u * 0.2), ts * 0.06, ts * 0.02, 4, 0); c.fill(); } }
        if (b) { const st = b.st >= 3 ? 3 : b.st + (b.t ? clamp((now - b.t) / GROUNDS.GROW, 0, 1) * 0.9 : 0); drawFlower(c, b.el, sx + ts / 2, sy + ts * 0.62, ts * 1.05, T, st, { shine: b.gl && b.st >= 3, still: REDUCED }); if (b.st < 3 && !b.t) needs.push([sx + ts * 0.9, sy + ts * (0.2 - b.st * 0.14), needOf(b)]); }
      }
    }
    who.filter(o => Math.round(o.y) === y).sort((a, b) => a.y - b.y).forEach(o => o.f());
  }
  for (const [x, y, el] of needs) drawNeed(c, x, y, ts * 0.16, el, T);
  // pollen drifts between two blooms that are making a seed, and a flower being moved rides above the Glimmerkin
  for (const q of crossing()) { if (A.carry && (A.carry.from === q.i || A.carry.from === q.j)) continue; const a = M.soils[q.i], b = M.soils[q.j], ya = Y(a.y + 0.62) - ts * 0.82; for (let i = 0; i < 4; i++) { const u = REDUCED ? (i + 0.5) / 4 : (T * 0.35 + i / 4) % 1, v = i % 2 ? 1 - u : u, px = lerp(X(a.x + 0.5), X(b.x + 0.5), v), py = ya - Math.sin(v * Math.PI) * ts * 0.3; glow(c, px, py, ts * 0.09, 50, 100, 78, 0.9 * Math.sin(u * Math.PI)); } }
  if (A.carry && g.beds[A.carry.from]) { const b = g.beds[A.carry.from]; drawFlower(c, b.el, X(A.px + 0.5), Y(A.py + 0.85) - ts * 0.62 + (REDUCED ? 0 : Math.sin(T * 5) * ts * 0.02), ts * 0.9, T, 3, { shine: b.gl, still: REDUCED }); }
  if (A.night > 0.02) {
    c.fillStyle = 'rgba(12,8,48,' + 0.4 * A.night + ')'; c.fillRect(0, 0, VW, VH); glow(c, X(A.px + 0.5), Y(A.py + 0.4), ts * 2.2, 50, 100, 75, 0.28 * A.night);
    if (!REDUCED) for (let i = 0; i < 10; i++) glow(c, X((i * 2.37 + Math.sin(T * 0.3 + i) * 1.5) % M.W), Y((i * 3.1) % M.H + Math.cos(T * 0.4 + i)), 7, 60 + (i % 3) * 50, 100, 70, 0.7 * A.night);
  }
}
