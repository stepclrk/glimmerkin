/* ===== The garden: a place of the player's own to walk round, plant and tend ===== */
/* Its map comes from genGrounds in core.js, by the creature's seed. The save keeps only what the player has done
   there (S.garden): beds by number, each { el, st, t, w, gl }: the flower's kind, its stage (0 seed to 3 bloom), when
   it was last tended (0 while it waits to be tended), since when it has waited, and whether it can still glimmer. */
let GA = null;   // the garden while it is being walked: its map, where everyone is, what they are doing
const gardenSeed = () => (S.pet.seed ^ 0x9a2d3e7) >>> 0;
const TENDS_A_DAY = 3;   // tends a day that give a little experience
function ensureGarden() { const g = S.garden = S.garden || {}; g.beds = g.beds || {}; g.seeds = g.seeds || {}; g.grown = g.grown || {}; g.glim = g.glim || {}; return g; }
const gardenHelper = el => S.littles.find(l => kindsOf(l).includes(el));
const inBloom = () => Object.values(ensureGarden().beds).filter(b => b.st >= 3).length;
const toTend = () => Object.values(ensureGarden().beds).filter(b => b.st < 3 && !b.t).length;
const minsLeft = (b, now) => Math.max(1, Math.ceil((b.t + GROUNDS.GROW - now) / 60000));
const aOrAn = w => (/^[AEIOU]/.test(w) ? 'an ' : 'a ') + w;
/* Brings every bed up to now. A tended flower reaches its next stage after GROW. One left waiting for HELP is tended
   by a little of its kind, if the player has one. Gives back who helped and what came into bloom. */
function growBeds(now) {
  const g = ensureGarden(), helped = [], bloomed = [];
  for (const k in g.beds) {
    const b = g.beds[k];
    for (let i = 0; i < 8 && b.st < 3; i++) {
      if (b.t) { if (now < b.t + GROUNDS.GROW) break; b.st++; b.w = b.t + GROUNDS.GROW; b.t = 0; if (b.st >= 3) { g.grown[b.el] = (g.grown[b.el] || 0) + 1; if (b.gl) g.glim[b.el] = true; S.j.flowers = (S.j.flowers || 0) + 1; bloomed.push(b); } }
      else { const l = gardenHelper(b.el); if (!l || now < b.w + GROUNDS.HELP) break; b.t = b.w + GROUNDS.HELP; if (!helped.some(h => h.l === l && h.el === b.el)) helped.push({ l, el: b.el }); }
    }
  }
  return { helped, bloomed };
}
function gardenCard() {
  const n = inBloom(), w = toTend(), g = ensureGarden(), planted = Object.keys(g.beds).length;
  const line = !g.gift ? 'A place of your own to walk round and plant. A gift of seeds is waiting.' : !planted ? 'Nothing is planted yet. Tap a patch of soil to plant a seed.' : (n ? n + ' in bloom' : 'Nothing in bloom yet') + (w ? ' · ' + w + ' waiting to be tended' : '') + '.';
  return '<button class="card" data-do="garden"><canvas data-ic="flower:bloom" data-size="44"></canvas><span class="tx"><strong>The garden</strong><small>' + esc(line) + '</small></span><span class="tag">Walk in</span></button>';
}
function enterGarden() {
  const p = S.pet; if (!unlocked('garden')) return; if (p.asleep) { toast(p.name + ' is asleep. Wake it first.'); return; }
  closeSheet(); ui.tray.hidden = true; const g = ensureGarden(), first = !g.gift; if (first) { g.gift = true; for (const el of ELS) g.seeds[el] = (g.seeds[el] || 0) + 1; }
  const was = growBeds(Date.now()), M = genGrounds(gardenSeed()), d = new Date();
  GA = { M, px: M.start.x, py: M.start.y, at: { x: M.start.x, y: M.start.y }, path: [], act: null, trail: [], face: 1, look: petLook(p), happy: 0, sniffAt: -99, mark: null, acc: 0, night: nightAt(d.getHours() + d.getMinutes() / 60), soilAt: new Map(M.soils.map((s, i) => [s.y * M.W + s.x, i])),
    lits: partyLittles().slice(0, 3).map((l, i) => ({ l, L: lookOf(l), x: M.start.x, y: M.start.y - 0.3 * (i + 1), hop: 0, busy: 0 })) };
  for (let i = 0; i < 70; i++) GA.trail.push({ x: M.start.x, y: M.start.y - 1.2 + i * 1.2 / 69 });
  scene = 'garden'; setSceneUI(); gardenHud(); sfx('gate'); save();
  const names = was.helped.map(h => h.l.name).filter((n, i, a) => a.indexOf(n) === i);
  toast(first ? 'A gift of six seeds, one of each kind. Tap a patch of soil to plant one.' : was.bloomed.length ? (was.bloomed.length === 1 ? 'The ' + FLOWERS[was.bloomed[0].el].name + ' has' : was.bloomed.length + ' flowers have') + ' come into bloom while you were away.' : names.length ? names.join(' and ') + ' tended the garden while you were away.' : 'Tap to walk.', 4600);
}
function leaveGarden() {
  if (!GA) return; GA = null; scene = 'home'; $('#q-bag').hidden = false; closeSheet(); setSceneUI(); updateHud(); save();
  if (pendingRemote) adopt(pendingRemote);
}
function gardenHud() {
  if (!GA) return; const n = inBloom(), w = toTend(), g = ensureGarden();
  $('#q-name').textContent = S.pet.name + '\'s garden'; $('#q-biome').textContent = 'Garden'; $('#q-shards').textContent = '✿ ' + n + ' in bloom'; $('#q-rule').hidden = true; $('#q-bag').hidden = true;
  $('#q-hint').textContent = w ? 'A bubble shows the kind of little a flower needs. Tap it to tend the flower.' : Object.keys(g.beds).length < GA.M.soils.length && Object.values(g.seeds).some(v => v > 0) ? 'Tap to walk. Tap a patch of soil to plant a seed.' : n ? 'Tap a flower in bloom to sniff it or pick it.' : 'Tap to walk. Flowers grow while you are away, too.';
}
ui.barGarden.addEventListener('click', e => {
  const b = e.target.closest('[data-g]'); if (!b || !GA) return; unlockAudio();
  if (b.dataset.g === 'leave') leaveGarden(); else openSeeds(-1);
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
  const bed = A.soilAt.get(y * M.W + x), ch = M.rows[y][x];
  const p = bed !== undefined ? gardenPath(A.at.x, A.at.y, (a, b) => Math.abs(a - x) + Math.abs(b - y) === 1) : groundsWalk(M, x, y) ? gardenPath(A.at.x, A.at.y, (a, b) => a === x && b === y) : null;
  if (!p) { if (ch === '~') toast('The pond. ' + S.pet.name + ' would rather not get wet.'); return; }
  A.path = p; A.act = bed !== undefined ? { bed } : ch === 'G' ? { gate: true } : null; A.mark = { x, y, t: 0.5 }; sfx('step');
}
function gardenArrive() {
  const A = GA, a = A.act; A.act = null; if (!a) return;
  if (a.gate) { leaveGarden(); return; }
  const g = ensureGarden(), now = Date.now(); growBeds(now); const b = g.beds[a.bed], s = A.M.soils[a.bed]; if (s.x !== A.at.x) A.face = Math.sign(s.x - A.at.x);
  if (!b) openSeeds(a.bed);
  else if (b.st >= 3) openBloom(a.bed);
  else if (b.t) { const m = minsLeft(b, now); toast('The ' + FLOWERS[b.el].name + ' ' + FLOWER_STAGES[b.st] + ' is growing. It will be a ' + FLOWER_STAGES[b.st + 1] + ' in ' + m + (m === 1 ? ' minute.' : ' minutes.'), 3600); }
  else tendBed(a.bed, false);
}

/* ---------- planting, tending, sniffing and picking ---------- */
function openSeeds(bed) {
  const g = ensureGarden(), have = ELS.filter(el => g.seeds[el] > 0);
  const cards = have.map(el => '<button class="card" data-do="plant" data-el="' + el + '"' + (bed < 0 ? ' disabled' : '') + '><canvas data-ic="flower:' + el + '" data-size="48"></canvas><span class="tx"><strong>' + FLOWERS[el].name + '</strong><small>Needs ' + aOrAn(KINDS[el].label) + ' little to tend it.' + (gardenHelper(el) ? '' : ' You have none yet, so ' + esc(S.pet.name) + ' will tend it.') + '</small></span><span class="tag">' + g.seeds[el] + (g.seeds[el] === 1 ? ' seed' : ' seeds') + '</span></button>').join('');
  openSheet('<h2>' + (bed < 0 ? 'Seeds' : 'Plant a seed') + '</h2><p class="dim">' + (have.length ? (bed < 0 ? 'Tap a patch of soil to plant one. ' : '') + 'A flower takes about two hours to bloom, and needs tending three times on the way.' : 'No seeds left. Picking a flower in bloom gives two of its seeds.') + '</p><div class="list">' + cards + '</div><div class="btns"><button class="btn' + (bed < 0 || !have.length ? ' main' : '') + '" data-do="ok">' + (bed < 0 || !have.length ? 'Close' : 'Not now') + '</button></div>', { ok: closeSheet, plant: d => { closeSheet(); plantSeed(bed, d.el); } });
}
function bedMid(bed) { const V = gardenView(), s = GA.M.soils[bed]; return [(s.x + 0.5 - V.ox) * V.ts, V.top + (s.y + 0.5 - V.oy) * V.ts, V.ts]; }
function plantSeed(bed, el) {
  const g = ensureGarden(); if (!GA || bed < 0 || g.beds[bed] || !(g.seeds[el] > 0)) return;
  g.seeds[el]--; g.beds[bed] = { el, st: 0, t: 0, w: Date.now(), gl: true };
  const [x, y] = bedMid(bed); burst(x, y, 10, 30, { v: 70, size: 3 }); GA.happy = 1; sfx('pick'); save(); gardenHud();
  toast(S.pet.name + ' digs in the ' + FLOWERS[el].name + ' seed. Tap its bubble to tend it.', 3600);
}
function tendBed(bed, byPet) {
  const A = GA, g = ensureGarden(), b = g.beds[bed]; if (!A || !b || b.t || b.st >= 3) return;
  const F = FLOWERS[b.el], f = A.lits.find(q => kindsOf(q.l).includes(b.el)), s = A.M.soils[bed], next = FLOWER_STAGES[b.st + 1], [x, y, ts] = bedMid(bed);
  if (!f && !byPet) {
    const h = gardenHelper(b.el);
    openSheet('<h2>' + F.name + ' ' + FLOWER_STAGES[b.st] + '</h2><div class="card"><canvas data-ic="kind:' + b.el + '" data-size="56"></canvas><div class="tx"><strong>It needs ' + aOrAn(KINDS[b.el].label) + ' little</strong><small>' + (h ? esc(h.name) + ' is not in the party. Left alone, ' + esc(h.name) + ' will see to it within the hour.' : 'You have no ' + KINDS[b.el].species + ' yet.') + ' ' + esc(S.pet.name) + ' can tend it now instead, but then it will not glimmer when it blooms.</small></div></div><div class="btns"><button class="btn" data-do="no">Leave it</button><button class="btn main" data-do="go">' + esc(S.pet.name) + ' tends it</button></div>', { no: closeSheet, go: () => { closeSheet(); tendBed(bed, true); } });
    return;
  }
  b.t = Date.now(); let line;
  if (f) {
    const l = f.l, day = localDay(), n = l.tend && l.tend.day === day ? l.tend.n : 0; f.busy = 1.5; f.bx = s.x + (A.at.x < s.x ? 0.42 : A.at.x > s.x ? -0.42 : 0.3); f.by = s.y + 0.12; f.hop = 1;
    line = l.name + ' ' + F.job + '.';
    if (n < TENDS_A_DAY) { const lv = littleLevel(l.xp || 0), m0 = maxSparks(l); l.tend = { day, n: n + 1 }; l.xp = (l.xp || 0) + 1; const a = littleLevel(l.xp); if (a > lv) { line = l.name + ' ' + F.job + ' and reached level ' + a + (maxSparks(l) > m0 ? ', and now carries one more spark.' : '.') + grownLine(l, lv, a); f.L = lookOf(l); sfx('grow'); } }
    burst(x, y - ts * 0.2, 16, EL_HUE[b.el], { kind: 'star', v: 110, size: 4 }); sfx('skill');
  } else { b.gl = false; A.happy = 1.2; burst(x, y - ts * 0.2, 8, 330, { kind: 'heart', v: 70, size: 4 }); sfx('purr'); line = S.pet.name + ' tends the ' + F.name + '.'; }
  toast(line + ' It will be a ' + next + ' in ' + Math.round(GROUNDS.GROW / 60000) + ' minutes.', 3800); save(); gardenHud();
}
function openBloom(bed) {
  const g = ensureGarden(), b = g.beds[bed]; if (!b) return; const F = FLOWERS[b.el];
  openSheet('<h2>' + F.name + '</h2><div class="card"><canvas data-ic="flower:' + b.el + (b.gl ? ':g' : '') + '" data-size="60"></canvas><div class="tx"><strong>' + (b.gl ? 'In bloom, and glimmering' : 'In bloom') + '</strong><small>' + (b.gl ? 'A little of its own kind tended it at every step.' : 'It stays in bloom until you pick it.') + ' Picking it gives two ' + F.name + ' seeds and frees the soil.</small></div></div><div class="btns"><button class="btn" data-do="pick">Pick it</button><button class="btn main" data-do="sniff">Sniff it</button></div>', {
    sniff: () => { closeSheet(); const A = GA, p = S.pet, [x, y, ts] = bedMid(bed); A.happy = 1.6; burst(x, y - ts * 0.6, 7, 330, { kind: 'heart', v: 70, size: 4 }); sfx('purr'); if (T - A.sniffAt > 25) { A.sniffAt = T; p.joy = clamp(p.joy + 2, 0, 100); save(); } toast(p.name + ' sniffs the ' + F.name + '. Lovely.'); },
    pick: () => { closeSheet(); const [x, y, ts] = bedMid(bed); delete g.beds[bed]; g.seeds[b.el] = (g.seeds[b.el] || 0) + 2; S.j.picked = (S.j.picked || 0) + 1; burst(x, y - ts * 0.5, 14, FLOWERS[b.el].hue, { kind: 'star', v: 120, size: 4 }); sfx('pick'); save(); gardenHud(); toast('Two ' + F.name + ' seeds for the seed tray.'); }
  });
}
function gardenJournal() {
  if (!unlocked('garden')) return ''; const g = ensureGarden(), n = ELS.filter(el => g.grown[el]).length;
  return '<h3>Flowers · ' + n + ' of ' + ELS.length + '</h3><p class="dim">Grown in the garden' + (S.j.flowers ? ', ' + S.j.flowers + ' in all' : '') + '. A flower tended at every step by a little of its own kind opens glimmering.</p><div class="grid">' + ELS.map(el => '<div class="cell' + (g.grown[el] ? '' : ' unk') + '"><canvas data-ic="flower:' + el + (g.glim[el] ? ':g' : '') + '" data-size="44"></canvas><span>' + (g.grown[el] ? FLOWERS[el].name : '?') + '</span>' + (g.grown[el] ? '<em>×' + g.grown[el] + (g.glim[el] ? ' ✦' : '') + '</em>' : '') + '</div>').join('') + '</div>';
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
  o = o || {}; const F = FLOWERS[el], ph = ELS.indexOf(el) * 1.3, open = clamp(stage - 2, 0, 1), grow = clamp(stage, 0, 3) / 3;
  c.save(); c.lineJoin = 'round';
  if (stage < 0.6) {
    c.fillStyle = hsl(28, 30, 22); c.beginPath(); c.ellipse(x, y, s * 0.16, s * 0.06, 0, Math.PI, TAU); c.fill();
    c.fillStyle = hsl(F.hue, 70, 62); c.strokeStyle = hsl(F.hue + 20, 50, 25); c.lineWidth = 1; c.beginPath(); c.ellipse(x, y - s * 0.05, s * 0.05, s * 0.035, -0.4, 0, TAU); c.fill(); c.stroke(); c.restore(); return;
  }
  const sway = o.still ? 0 : Math.sin(t * 1.3 + ph) * (el === 'gale' ? 0.09 : 0.04), H = s * (0.18 + 0.62 * grow), hx = x + Math.sin(sway) * H, hy = y - Math.cos(sway) * H;
  c.strokeStyle = hsl(128, 45, 34); c.lineWidth = Math.max(1.5, s * 0.035); c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - s * 0.04, y - H * 0.55, hx, hy); c.stroke();
  const leaf = (u, side, L) => { c.save(); c.translate(lerp(x, hx, u) - s * 0.02, lerp(y, hy, u)); c.rotate(side * (1 + (o.still ? 0 : Math.sin(t * 1.1 + ph + side) * 0.06))); c.fillStyle = hsl(118, 50, 42); c.strokeStyle = hsl(140, 50, 20); c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-L * 0.35, -L * 0.5, 0, -L); c.quadraticCurveTo(L * 0.35, -L * 0.5, 0, 0); c.fill(); c.stroke(); c.restore(); };
  if (stage < 1.6) { leaf(0.95, -1, s * 0.16 * Math.min(1, stage)); leaf(0.95, 1, s * 0.16 * Math.min(1, stage)); c.restore(); return; }
  leaf(0.3, -1, s * 0.2); leaf(0.5, 1, s * 0.17); if (el === 'bloom') leaf(0.7, -1, s * 0.13);
  const R = s * (0.2 + 0.14 * open);
  if (el === 'glow' && open > 0.3) glow(c, hx, hy, R * 2.4, F.hue, 100, 70, 0.3 * open);
  if (o.shine && open > 0.5) glow(c, hx, hy, R * 2.4, 48, 100, 75, 0.35 + (o.still ? 0 : 0.15 * Math.sin(t * 3 + ph)));
  c.save(); c.translate(hx, hy); c.rotate(sway * 0.6);
  if (open <= 0.02) {
    const bh = s * 0.22 * clamp(stage - 1, 0.4, 1); c.fillStyle = hsl(F.hue, 75, 55); c.strokeStyle = hsl(F.hue + 25, 55, 24); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-bh * 0.55, -bh * 0.15, -bh * 0.35, -bh * 0.9, 0, -bh); c.bezierCurveTo(bh * 0.35, -bh * 0.9, bh * 0.55, -bh * 0.15, 0, 0); c.fill(); c.stroke();
    c.fillStyle = hsl(118, 50, 38); for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sd * bh * 0.5, -bh * 0.05, sd * bh * 0.3, -bh * 0.35); c.quadraticCurveTo(sd * bh * 0.15, -bh * 0.1, 0, 0); c.fill(); }
    c.restore(); c.restore(); return;
  }
  const lt = o.shine ? 72 : 62, rot = -Math.PI / 2 + (o.still ? 0 : Math.sin(t * 0.4 + ph) * 0.05), cr = R * 0.2;
  petalRing(c, F, el, R, R * 0.36, rot, F.hue, lt, open); petalRing(c, F, el, R * 0.62, R * 0.27, rot + Math.PI / F.n, F.hue - 12, lt + 8, open);
  c.fillStyle = hsl(46, 95, 66); c.strokeStyle = hsl(30, 60, 30); c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, cr, cr * 0.86, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = 'rgba(80,40,10,.45)'; for (let i = 0; i < 5; i++) { const a = i * 2.4 + ph; c.beginPath(); c.arc(Math.cos(a) * cr * 0.45, Math.sin(a) * cr * 0.4, cr * 0.13, 0, TAU); c.fill(); }
  c.restore();
  if (open > 0.6) {   // each kind's own touch
    if (el === 'ember') flame(c, hx, hy - cr * 0.3, R * 0.11, o.still ? 0 : t, ph);
    if (el === 'glow') for (let i = 0; i < 3; i++) { const a = (o.still ? 0 : t * 1.2) + i * TAU / 3 + ph, mx = hx + Math.cos(a) * R * 1.25, my = hy + Math.sin(a) * R * 0.55; glow(c, mx, my, R * 0.3, 50, 100, 72, 0.7); c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(mx, my, Math.max(1, R * 0.05), 0, TAU); c.fill(); }
    if (el === 'gale' && !o.still) for (let i = 0; i < 2; i++) { const u = (t * 0.25 + i * 0.5 + ph) % 1, dx = hx + Math.sin(u * 6 + i) * R * 0.8 + u * R * 1.2, dy = hy - u * s * 0.9; c.strokeStyle = 'rgba(240,255,250,' + (0.8 * (1 - u)) + ')'; c.lineWidth = 1; for (let k = 0; k < 6; k++) { const a = k * TAU / 6; c.beginPath(); c.moveTo(dx, dy); c.lineTo(dx + Math.cos(a) * R * 0.12, dy + Math.sin(a) * R * 0.12); c.stroke(); } }
    if (el === 'stone' && !o.still) { const k = (t * 0.7 + ph) % 3; if (k < 0.5) { c.fillStyle = 'rgba(255,255,255,' + Math.sin(k / 0.5 * Math.PI) + ')'; starPath(c, hx + R * 0.6, hy - R * 0.5, R * 0.16, R * 0.04, 4, 0); c.fill(); } }
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
function drawGarden(dt) {
  const A = GA, M = A.M, c = ctx, g = ensureGarden(), now = Date.now();
  A.acc += dt; if (A.acc >= 1) { A.acc = 0; const was = growBeds(now); if (was.bloomed.length) { sfx('grow'); toast('The ' + FLOWERS[was.bloomed[0].el].name + ' is in bloom!', 3600); save(); } if (was.bloomed.length || was.helped.length) gardenHud(); }
  // walking
  let left = dt * 4.6, moved = false;
  while (A.path.length && left > 0) { const n = A.path[0], dx = n.x - A.px, dy = n.y - A.py, d = Math.hypot(dx, dy); if (dx) A.face = Math.sign(dx); if (d <= left) { A.px = n.x; A.py = n.y; A.at = n; A.path.shift(); left -= d; } else { A.px += dx / d * left; A.py += dy / d * left; left = 0; } moved = true; }
  if (moved) { const l = A.trail[A.trail.length - 1]; if (Math.hypot(l.x - A.px, l.y - A.py) > 0.04) { A.trail.push({ x: A.px, y: A.py }); if (A.trail.length > 90) A.trail.shift(); } }
  if (!A.path.length && A.act) gardenArrive(); if (!GA) return;
  A.lits.forEach((f, i) => { const p = f.busy > 0 ? { x: f.bx, y: f.by } : A.trail[Math.max(0, A.trail.length - 1 - (i + 1) * 20)]; f.busy = Math.max(0, f.busy - dt); f.dx = p.x - f.x; f.x = lerp(f.x, p.x, Math.min(1, dt * 9)); f.y = lerp(f.y, p.y, Math.min(1, dt * 9)); f.hop = Math.max(0, f.hop - dt * 1.6); });
  A.happy = Math.max(0, A.happy - dt);
  const V = gardenView(), ts = V.ts, X = x => (x - V.ox) * ts, Y = y => V.top + (y - V.oy) * ts;
  const x0 = Math.floor(V.ox) - 1, x1 = Math.ceil(V.ox + VW / ts), y0 = Math.floor(V.oy - V.top / ts) - 1, y1 = Math.ceil(V.oy + (VH - V.top) / ts);
  const at = (x, y) => x < 0 || y < 0 || x >= M.W || y >= M.H ? '#' : M.rows[y][x];
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
      else if (ch === 's') {
        const b = g.beds[A.soilAt.get(y * M.W + x)]; drawBed(c, sx + ts / 2, sy + ts * 0.62, ts * 0.86, T, !b);
        if (b) { const st = b.st >= 3 ? 3 : b.st + (b.t ? clamp((now - b.t) / GROUNDS.GROW, 0, 1) * 0.9 : 0); drawFlower(c, b.el, sx + ts / 2, sy + ts * 0.62, ts * 1.05, T, st, { shine: b.gl && b.st >= 3, still: REDUCED }); if (b.st < 3 && !b.t) needs.push([sx + ts * 0.9, sy + ts * (0.2 - b.st * 0.14), b.el]); }
      }
    }
    who.filter(o => Math.round(o.y) === y).sort((a, b) => a.y - b.y).forEach(o => o.f());
  }
  for (const [x, y, el] of needs) drawNeed(c, x, y, ts * 0.16, el, T);
  if (A.night > 0.02) {
    c.fillStyle = 'rgba(12,8,48,' + 0.4 * A.night + ')'; c.fillRect(0, 0, VW, VH); glow(c, X(A.px + 0.5), Y(A.py + 0.4), ts * 2.2, 50, 100, 75, 0.28 * A.night);
    if (!REDUCED) for (let i = 0; i < 10; i++) glow(c, X((i * 2.37 + Math.sin(T * 0.3 + i) * 1.5) % M.W), Y((i * 3.1) % M.H + Math.cos(T * 0.4 + i)), 7, 60 + (i % 3) * 50, 100, 70, 0.7 * A.night);
  }
}
