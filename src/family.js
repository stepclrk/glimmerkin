/* ===== A new generation: the starlit egg, elders and the family tree ===== */
/* A Glimmerkin that is Mythic and has beaten every region lays one starlit egg. Hatching it makes the old one an
   elder, who stays at the nest with no needs, and starts a new Glimmerkin and a new journey. Everything else the nest
   owns carries on. */
const HEIR_RUB = 8;           // warmth a stroke gives the starlit egg, out of 100
const ELDER_LEARN = 3;        // praised tries to learn a trick the elder already knows
const GEN_WORDS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
const genName = n => GEN_WORDS[n - 1] ? GEN_WORDS[n - 1] + ' generation' : 'Generation ' + n;

function ensureFamily() {
  if (!S.gen) S.gen = 1; S.elders = S.elders || []; if (S.heir === undefined) S.heir = null;
  if (S.nestSeed === undefined) S.nestSeed = S.pet.seed;   // the garden keeps the seed it was built from
  S.reg.most = Math.max(S.reg.most || 0, S.reg.i); S.reg.stars = S.reg.stars || {};
  const p = S.pet; if (!p.born) p.born = S.createdAt || Date.now(); if (p.q0 === undefined) p.q0 = 0;
}
const elder = () => S.elders.length ? S.elders[S.elders.length - 1] : null;
/* The visits that pull towards a Mythic form: the journal's for the first Glimmerkin, as they always were, and its own
   for every one after, so a child is not pulled towards its parent's form. */
const formVisits = () => S.gen > 1 ? (S.pet.visits || {}) : S.j.biomes;
const familyForms = () => { const f = new Set(S.elders.map(e => e.form).filter(Boolean)); if (S.pet.form) f.add(S.pet.form); return f; };
/* A later generation's worlds go deeper (DEEP in core.js): one step for the second, two from the third on. */
const worldDepth = () => clamp((S.gen || 1) - 1, 0, DEEP.length - 1);
const hasCrest = () => familyForms().size >= ELS.length;
const learnAt = k => { const e = elder(); return e && e.tricks && (e.tricks[k] || 0) >= LEARN_AT ? ELDER_LEARN : LEARN_AT; };

/* Lays the starlit egg the moment the Glimmerkin is Mythic and the journey is complete, in either order. */
function checkHeir(tell) {
  if (S.heir || stageOf(petLevel(S.pet.xp)) < 3 || !journeyDone()) return false;
  S.heir = { seed: 1 + Math.floor(Math.random() * 2147483645), warm: 0, at: Date.now() }; save();
  if (tell && scene === 'home' && ui.sheet.hidden) { const due = takeUnlocks(); if (due.length) setTimeout(() => openUnlocks(due), 400); }
  return true;
}

/* ---------- at the nest ---------- */
function drawStarlitEgg(c, x, y, s, t, warm) {
  const wob = Math.sin(t * 3 + 1) * 0.04 * (1 + (warm || 0) / 50);
  glow(c, x, y, s * 0.7, 46, 100, 72, 0.45 + 0.15 * Math.sin(t * 1.6) + (warm || 0) / 300);
  c.save(); c.translate(x, y); c.rotate(wob);
  const g = c.createRadialGradient(-s * 0.08, -s * 0.12, s * 0.02, 0, 0, s * 0.38); g.addColorStop(0, '#fff6c8'); g.addColorStop(0.55, '#ffd766'); g.addColorStop(1, '#c98a2a');
  c.fillStyle = g; c.strokeStyle = '#5a3a10'; c.lineWidth = Math.max(1, s * 0.03); c.beginPath(); c.ellipse(0, 0, s * 0.24, s * 0.31, 0, 0, TAU); c.fill(); c.stroke();
  const sh = (t * 0.35) % 1; c.save(); c.beginPath(); c.ellipse(0, 0, s * 0.24, s * 0.31, 0, 0, TAU); c.clip();   // a slow shimmer passes over it
  const sg = c.createLinearGradient(-s * 0.5 + sh * s, -s * 0.3, -s * 0.3 + sh * s, s * 0.3); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sg; c.fillRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8); c.restore();
  c.fillStyle = '#fffbe6'; for (const [a, b, q, sp] of [[-0.08, -0.12, 0.06, 1], [0.1, 0.05, 0.045, -1.3], [-0.05, 0.16, 0.035, 0.8]]) { starPath(c, a * s, b * s, q * s, q * s * 0.4, 4, t * sp); c.fill(); }
  c.restore();
}
/* Where the elder rests: on a cloud cushion behind the nest, on the side away from the vase; nearer the Glimmerkin
   while it sleeps. */
function elderSpot(H) { const p = S.pet; return p.asleep ? { x: H.cx + H.petS * 0.86, y: H.gy - H.ry * 0.35 } : { x: Math.min(H.cx + H.rx * 0.74, VW - H.petS * 0.4), y: H.gy - H.baseS * 0.62 }; }
function elderEnt(c, H, dt) {
  const e = elder(); if (!e) { H.elder = null; return null; }
  const want = elderSpot(H), E = H.elder && H.elder.seed === e.seed ? H.elder : (H.elder = { seed: e.seed, look: petLook(e), x: want.x, y: want.y, purr: 0 });
  E.x = lerp(E.x, want.x, Math.min(1, dt * 1.5)); E.y = lerp(E.y, want.y, Math.min(1, dt * 1.5)); E.s = H.petS * 0.75; E.purr = Math.max(0, E.purr - dt);
  return { y: E.y, draw: () => {
    const bob = Math.sin(T * 0.9) * 2, cy = E.y + bob, w = E.s * 0.62;
    glow(c, E.x, cy, w * 1.3, 250, 60, 85, 0.18);
    c.fillStyle = 'rgba(236,230,255,.9)'; for (const [dx, dy, r] of [[-0.6, 0.05, 0.36], [0.6, 0.05, 0.36], [-0.25, 0.12, 0.45], [0.28, 0.12, 0.42], [0, -0.02, 0.4]]) { c.beginPath(); c.ellipse(E.x + dx * w, cy + dy * w, r * w, r * w * 0.55, 0, 0, TAU); c.fill(); }
    drawCreature(c, E.look, E.x, cy - w * 0.06, E.s, T + 3, { mood: S.pet.asleep ? 'sleep' : E.purr > 0 ? 'happy' : 'idle', look: { x: -0.5, y: 0.1 }, noShadow: true, glow: 0.3 });
  } };
}
function elderAt(H, pt) { const E = H.elder; return E && Math.abs(pt.x - E.x) < E.s * 0.45 && pt.y > E.y - E.s * 1.05 && pt.y < E.y + E.s * 0.15; }
function strokeElder() {
  const H = home, E = H.elder; if (!E) return; E.purr = 1; H.strokes++;
  parts.push({ x: H.ptr ? H.ptr.x : E.x, y: (H.ptr ? H.ptr.y : E.y - E.s) - 14, vx: rnd(-20, 20), vy: -60, g: 0, life: 0, max: 0.9, kind: 'heart', h: 340, size: 6 });
  if (H.strokes % 4 === 0) sfx('purr');
}
function elderTap() { const e = elder(); if (!e) return; const i = S.elders.length; sfx('chirp'); if (home.elder) home.elder.purr = 1; toast(e.name + ', a ' + (e.form ? FORMS[e.form].name : 'Mythic') + ' elder of the ' + genName(i).toLowerCase() + '.', 3200); }
const heirSpot = H => ({ x: H.cx + H.rx * 0.36, y: H.gy + H.ry * 0.98 });
function heirEnt(c, H) {
  if (!S.heir) { H.heirPos = null; return null; }
  const P = H.heirPos = heirSpot(H), s = H.baseS * 0.46;
  return { y: P.y, draw: () => { c.fillStyle = 'rgba(8,4,20,.3)'; c.beginPath(); c.ellipse(P.x, P.y + 2, s * 0.22, s * 0.06, 0, 0, TAU); c.fill(); drawStarlitEgg(c, P.x, P.y - s * 0.28, s, T, S.heir.warm); } };
}
function strokeHeir() {
  const h = S.heir, P = home.heirPos; if (!h) return; h.warm = Math.min(100, (h.warm || 0) + HEIR_RUB);
  if (P) burst(P.x, P.y - home.baseS * 0.15, 3, 46, { v: 50, size: 3 }); if (home.strokes++ % 3 === 0) sfx('pick');
  if (h.warm >= 100 && ui.sheet.hidden) { home.ptr = null; askHatch(); }
}
function askHatch() {
  const p = S.pet;
  openSheet('<h2>The starlit egg is warm</h2><div class="card"><canvas data-ic="heir" data-size="64"></canvas><div class="tx"><strong>Hatch it?</strong><small>' + esc(p.name) + ' will become an elder. It stays at the nest, and everything you have stays too. Your new Glimmerkin starts as a Hatchling, and the journey starts again at Mossroot.</small></div></div><p class="dim">This cannot be undone.</p><div class="btns"><button class="btn" data-do="no">Not yet</button><button class="btn main" data-do="yes">Hatch</button></div>', { no: closeSheet, yes: () => { closeSheet(); hatchHeir(); } });
}
function hatchHeir() {
  const h = S.heir; if (!h) return; const old = S.pet, r = RNG(h.seed), was = petLook(old);
  if (!old.form) old.form = formFor(old, formVisits());
  S.elders.push({ name: old.name, seed: old.seed, xp: Math.round(old.xp), diet: Object.assign({}, old.diet), marks: (old.marks || []).slice(), form: old.form, tricks: Object.fromEntries(Object.keys(PET_TRICKS).filter(knows).map(k => [k, LEARN_AT])), born: old.born || S.createdAt || Date.now(), done: Date.now(), quests: S.quests - (old.q0 || 0) });
  if (old.hue0 !== undefined) S.elders[S.elders.length - 1].hue0 = old.hue0;
  if (old.wear) S.elders[S.elders.length - 1].wear = old.wear;   // the elder keeps what it was wearing; the new one hatches with nothing on
  const mark = (old.marks || []).length ? old.marks[old.marks.length - 1] : null;
  S.pet = { name: makeName(r), seed: r.int(1, 2147483646), xp: 0, belly: 62, joy: 55, rest: 100, asleep: false, diet: {}, ate: {}, marks: mark ? [mark] : [], tricks: {}, born: Date.now(), q0: S.quests, visits: {}, hue0: (was.hue + (r.f() * 40 - 20) + 360) % 360 };
  S.gen++; S.heir = null; S.reg.i = 0; S.reg.n = 0; S.wish = null; S.spot = null;
  home.elder = null; home.pa.trick = null; home.praise = null;
  ensureWish(); rollPortals(true); rebuildHome(); sfx('grow'); save(); updateHud();
  burst(home.cx, home.gy - home.petS * 0.5, 50, 46, { kind: 'star', v: 200, size: 7, life: 1.2 });
  const p = S.pet;
  openSheet('<h2>A new Glimmerkin</h2><div class="card"><canvas data-ic="kin" data-size="84"></canvas><div class="tx"><strong>' + esc(p.name) + '</strong><small>' + esc(genName(S.gen)) + ', child of ' + esc(old.name) + '</small></div></div><p>' + esc(old.name) + ' is an elder now, resting by the nest. ' + esc(p.name) + ' has its colouring' + (mark ? ' and its ' + MARKS[mark] : '') + '.</p><p class="dim">The journey starts again at Mossroot, and its worlds go deeper: more in the way of the portal, more glooms and tougher bosses. What ' + esc(p.name) + ' eats and where it travels will decide its own Mythic form.' + (familyForms().size ? ' The family has ' + familyForms().size + ' of the six so far.' : '') + '</p><div class="btns"><button class="btn main" data-do="ok">Welcome, ' + esc(p.name) + '</button></div>', { ok: closeSheet });
}
/* The six-form crest hangs above the nest once the family has had every Mythic form. */
function drawCrest(c, H) {
  if (!hasCrest()) return; const x = H.cx, y = H.gy - H.baseS * 2.02 + Math.sin(T * 0.7) * 3, r = H.baseS * 0.11;
  glow(c, x, y, r * 2.6, 46, 100, 75, 0.3); c.strokeStyle = 'rgba(255,215,102,.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
  ELS.forEach((el, i) => { const a = -Math.PI / 2 + i * TAU / 6 + T * 0.1, gx = x + Math.cos(a) * r, gy = y + Math.sin(a) * r; glow(c, gx, gy, r * 0.6, EL_HUE[el], 100, 70, 0.5); c.fillStyle = hsl(EL_HUE[el], 90, 70); c.beginPath(); c.arc(gx, gy, r * 0.28, 0, TAU); c.fill(); });
}
/* A star on a nest piece for each later generation that beat its region's heart again. */
function drawPieceStars(c, cx, ny, nrx, nry, bs) {
  const st = S.reg.stars || {};
  BIOMES.forEach((b, i) => { const n = Math.min(5, st[b.id] || 0); if (!n || !S.reg.built.includes(b.id)) return; const a = 0.3 + i * (Math.PI - 0.6) / 5, x = cx + Math.cos(a) * nrx, y = ny + Math.sin(a) * nry + bs * 0.07; c.fillStyle = '#ffd766'; for (let k = 0; k < n; k++) { starPath(c, x + (k - (n - 1) / 2) * bs * 0.05, y, bs * 0.022, bs * 0.009, 5, -Math.PI / 2); c.fill(); } });
}

/* ---------- the journal ---------- */
const longDate = t => { const d = new Date(t); return d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'long' }) + ' ' + d.getFullYear(); };
function familyJournal() {
  if (S.gen < 2 && !S.heir) return '';
  const forms = familyForms(), row = (ic, name, line, small) => '<div class="card"><canvas data-ic="' + ic + '" data-size="52"></canvas><div class="tx"><strong>' + esc(name) + '</strong><small>' + esc(line) + '</small><small>' + esc(small) + '</small></div></div>';
  const p = S.pet, L = petLevel(p.xp), now = (stageOf(L) >= 3 && p.form ? FORMS[p.form].name : STAGES[stageOf(L)]) + ', bond level ' + L;
  return '<h3>The family · ' + S.gen + (S.gen === 1 ? ' generation' : ' generations') + '</h3><p class="dim">' + (S.heir ? 'A starlit egg waits in the nest. Rub it warm to hatch a new Glimmerkin. ' : '') + (worldDepth() ? 'Worlds go deeper for this generation: up to ' + DEEP[worldDepth()].gates + ' blockers on the way and bosses with up to ' + DEEP[worldDepth()].hearts + ' hearts. ' : '') + 'Forms in the family: ' + forms.size + ' of 6' + (forms.size ? ' (' + [...forms].map(f => FORMS[f].name).join(', ') + ')' : '') + '.' + (hasCrest() ? ' The six-form crest hangs over the nest.' : '') + '</p><div class="list">' +
    S.elders.map((e, i) => row('elder:' + i, e.name, genName(i + 1) + ' · ' + (e.form ? FORMS[e.form].name : 'Mythic'), 'Hatched ' + longDate(e.born) + ', an elder since ' + longDate(e.done) + ', ' + e.quests + (e.quests === 1 ? ' quest' : ' quests'))).join('') +
    row('kin', p.name, genName(S.gen) + ' · ' + now, 'Hatched ' + longDate(p.born || S.createdAt) + ', ' + (S.quests - (p.q0 || 0)) + (S.quests - (p.q0 || 0) === 1 ? ' quest' : ' quests') + ' so far') + '</div>';
}
