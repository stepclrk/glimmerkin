/* ===== Quest: a generated world, walked tile by tile ===== */
const FX_HUE = { bramble: 22, water: 195, boulder: 262, chasm: 120, storm: 210, shadow: 48, fog: 200, ruin: 110, crystal: 280 };
const ITEM_NAME = it => it.k === 'shard' ? (it.bonus ? 'Bonus shard' : 'Star shard') : it.k === 'berry' ? BERRY[it.el] : it.k === 'dew' ? 'Dewdrop' : it.k === 'egg' ? (it.twin ? 'Twin egg' : 'Mystery egg') : it.k === 'gift' ? thingName(it.id) : 'Treasure chest';
const ITEM_ICON = it => it.k === 'berry' ? 'berry:' + it.el : it.k === 'egg' ? (it.twin ? 'thing:egg:twin' : 'egg:' + it.hue) : it.k === 'shard' ? 'shard' : it.k === 'dew' ? 'dew' : it.k === 'gift' ? 'thing:' + it.id : 'portal';

function startQuest(portal) {
  const p = S.pet, party = partyLittles();
  if (p.rest < 25) { toast(p.name + ' is too tired to travel.'); return; }
  if (portal.region) { if (!heartOpen() || portal.biome !== regionBiome(S.reg.i).id) return; }
  else if (portal.rare) { if (S.maps < 3) return; S.maps = 0; S.j.rare = (S.j.rare || 0) + 1; }
  p.rest -= 25; const bonus = p.joy >= 60 ? 1 : 0, B = BIOMES.find(b => b.id === portal.biome) || BIOMES[0];
  const can = new Set(); party.forEach(l => kindsOf(l).forEach(k => can.add(k)));
  const flier = l => kindsOf(l).includes('gale') || l.charm === 'feather';
  const world = genWorld(portal.seed, party.map(l => ({ kind: l.kind, kind2: l.kind2, max: maxSparks(l) })), S.quests, portal.rare ? 'realm' : portal.size, B.id, { eggOk: S.littles.length + S.eggs.length < 8, rare: !!portal.rare, gifts: rollGifts(portal, B), can: [...can], fly: party.some(flier), twin: S.quests >= 3 ? 0.15 : 0 });
  world.name = portal.name; const sk = world.start.y * world.W + world.start.x; S.j.biomes[B.id] = (S.j.biomes[B.id] || 0) + 1;
  Q = {
    world, B, rare: !!portal.rare, region: !!portal.region, px: world.start.x, py: world.start.y, fx: world.start.x, fy: world.start.y, trail: [sk, sk, sk, sk],
    lits: party.map((l, i) => ({ l, L: lookOf(l), i, kinds: kindsOf(l), fly: flier(l), ring: l.charm === 'ring', x: world.start.x, y: world.start.y, sp: maxSparks(l) + bonus, max: maxSparks(l) + bonus, busy: false, stationed: false, acts: 0, lift: 0 })),
    gateOpen: false, gateLatched: false, rally: p.belly >= 60, rallyWhy: p.belly >= 60 ? '' : 'Rally needs a Belly of 60 or more when you set out.', loot: { dust: 0, berries: {}, eggs: [], shards: 0 }, found: [], busy: false, done: false, walkTok: 0, walking: false, nextWalk: null, sel: null, acted: false,
    seer: can.has('glow'), dbl: can.has('bloom'), dew2: can.has('tide'), clover: party.some(l => l.charm === 'clover'), fetchN: 0, petHop: 0, petMoodT: 0, stat: null, ts: 40, ox: 0, oy: 0, look: petLook(p), motes: [], bag: null
  };
  ruleStart(Q);
  for (let i = 0; i < (REDUCED ? 4 : 12); i++) Q.motes.push({ ax: Math.random() * TAU, ay: Math.random() * TAU, sx: rnd(0.1, 0.4), sy: rnd(0.1, 0.4) });
  scene = 'quest'; buildQuestBar(); updateQuestHud(); setSceneUI(); save();
  if (portal.region) { toast('The heart of ' + B.name + '. Something large is waiting near the way out.', 4200); sfx('roar'); }
  else if (portal.rare) { toast('The map burns away. Something large is waiting near the way out.', 4200); sfx('roar'); }
  else if (bonus) toast('High spirits: every little carries an extra spark.', 3200);
  if (Q.rule && S.j.biomes[B.id] <= 3) setTimeout(() => { if (Q && Q.world === world) toast(RULES[Q.rule].intro + ' Tap ' + RULES[Q.rule].name.toLowerCase() + ' at the top to learn more.', 4800); }, portal.rare || bonus ? 3400 : 300);
}
function layoutQuest() {
  if (!Q) return; const w = Q.world, ah = VH - topIn - botIn - 20;
  Q.ts = Math.max(24, Math.floor(Math.min((VW - 16) / w.W, ah / w.H, 76))); Q.ox = Math.round((VW - Q.ts * w.W) / 2); Q.oy = Math.round(topIn + 10 + (ah - Q.ts * w.H) / 2);
  const sc = Q.stat || (Q.stat = document.createElement('canvas')); sc.width = cv.width; sc.height = cv.height;
  const c = sc.getContext('2d'), B = Q.B, ts = Q.ts; c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, B.bg[0]); g.addColorStop(1, B.bg[1]); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  glow(c, VW * 0.2, VH * 0.3, VW * 0.7, B.accent[0], B.accent[1], B.accent[2], 0.1); glow(c, VW * 0.85, VH * 0.75, VW * 0.6, B.fl[0], 60, 50, 0.14);
  if (Q.rare) { const rs = RNG(w.seed); for (let i = 0; i < 90; i++) { c.fillStyle = 'rgba(255,245,220,' + (0.25 + rs.f() * 0.6) + ')'; c.beginPath(); c.arc(rs.f() * VW, rs.f() * VH, 0.6 + rs.f() * 1.4, 0, TAU); c.fill(); } }
  for (let y = -2; y <= w.H + 1; y++) for (let x = -2; x <= w.W + 1; x++) {
    const out = x < 0 || y < 0 || x >= w.W || y >= w.H, X = Q.ox + x * ts, Y = Q.oy + y * ts;
    if (out) { c.globalAlpha = Q.rare ? 0.3 : 0.55; drawWall(c, X, Y, ts, B, w.seed + x * 131 + y * 17); c.globalAlpha = 1; continue; }
    const cell = w.cells[y * w.W + x];
    if (cell.t === 'wall') drawWall(c, X, Y, ts, B, w.seed + x * 131 + y * 17);
    else if (cell.t === 'floor') drawFloor(c, X, Y, ts, B, w.seed + y * w.W + x);
  }
}
const qKey = (x, y) => y * Q.world.W + x;
const qXY = k => { const x = k % Q.world.W; return [x, (k - x) / Q.world.W]; };
const cellMid = (x, y) => [Q.ox + (x + 0.5) * Q.ts, Q.oy + (y + 0.5) * Q.ts];

function drawQuest(dt) {
  const c = ctx, q = Q, w = q.world, ts = q.ts, B = q.B;
  c.drawImage(q.stat, 0, 0, VW, VH); if (q.rule) ruleTick(q, dt);
  const awake = q.loot.shards >= w.need, ents = [];
  for (let k = 0; k < w.cells.length; k++) {
    const cell = w.cells[k], x = k % w.W, y = (k - x) / w.W, X = q.ox + x * ts, Y = q.oy + y * ts;
    if (cell.t === 'ob') drawOb(c, cell.ob, X, Y, ts, T, cell.cleared, w.seed + k, B);
    else if (cell.t === 'gate') drawGate(c, X, Y, ts, T, q.gateOpen, B, w.seed + k);
    if (q.rule) drawRuleCell(c, q, cell, k, X, Y, ts);
    let iy = Y + ts * 0.5;
    if (cell.t === 'islet') iy = drawIslet(c, X, Y, ts, T, B) - ts * 0.14;
    if (w.plate && w.plate.x === x && w.plate.y === y) drawPlate(c, X, Y, ts, T, q.gateOpen);
    if (w.exit.x === x && w.exit.y === y) drawPortal(c, X, Y, ts, T, awake);
    if (cell.item) drawItem(c, cell.item, X + ts / 2, iy, ts, T);
    if (cell.enemy) { const e = cell.enemy, sh = cell.shake ? Math.sin(T * 60) * 3 : 0; ents.push({ y: Y + ts * 0.86, draw: () => drawGloom(c, e, X + ts / 2 + sh, Y + ts * (e.boss ? 0.96 : 0.88), ts * (e.boss ? 1.22 : 1), T) }); }
    if (q.seer && cell.crit && ((cell.t === 'ob' && !cell.cleared) || cell.enemy)) { const a = 0.55 + 0.45 * Math.sin(T * 4 + k); c.fillStyle = 'rgba(255,233,160,' + a + ')'; starPath(c, X + ts * 0.84, Y + ts * 0.16, ts * 0.13, ts * 0.05, 4, T); c.fill(); }
  }
  if (q.sel) { const u = (T - q.sel.t) / 0.7; if (u >= 1) q.sel = null; else { c.strokeStyle = 'rgba(255,233,160,' + (1 - u) + ')'; c.lineWidth = 2; rrect(c, q.ox + q.sel.x * ts + 2 - u * 3, q.oy + q.sel.y * ts + 2 - u * 3, ts - 4 + u * 6, ts - 4 + u * 6, ts * 0.2); c.stroke(); } }
  let j = 0; // followers trail behind
  for (const f of q.lits) {
    if (f.stationed) { f.x = w.plate.x; f.y = w.plate.y - 0.1; f.lift = 0; }
    else if (!f.busy) {
      const tk = q.trail[Math.min(q.trail.length - 1, j + 1)]; let [tx, ty] = qXY(tk); const same = tx === q.px && ty === q.py ? 1 : 0.4;
      tx += [-0.36, 0.36, 0][j % 3] * same; ty += [-0.13, -0.13, -0.34][j % 3] * same;
      const dx = tx - f.x, dy = ty - f.y; f.x += dx * Math.min(1, dt * 7); f.y += dy * Math.min(1, dt * 7);
      f.lift = Math.hypot(dx, dy) > 0.06 ? Math.abs(Math.sin(T * 13 + j)) * ts * 0.09 : 0; j++;
    }
    ents.push({ y: q.oy + (f.y + 0.84) * ts, draw: () => drawCreature(c, f.L, q.ox + (f.x + 0.5) * ts, q.oy + (f.y + 0.84) * ts, ts * 0.46, T, { lift: f.lift, mood: f.busy ? 'happy' : 'idle', glow: 0.26 }) });
  }
  q.petMoodT -= dt;
  ents.push({ y: q.oy + (q.fy + 0.86) * ts + 0.5, draw: () => drawCreature(c, q.look, q.ox + (q.fx + 0.5) * ts, q.oy + (q.fy + 0.86) * ts, ts * 0.7 * [0.82, 0.9, 1, 1.05][q.look.stage], T, { lift: q.petHop * ts, mood: q.petMoodT > 0 ? 'happy' : 'idle', glow: 0.36 }) });
  ents.sort((a, b) => a.y - b.y); for (const e of ents) e.draw();
  if (q.seen) { drawDark(c, q); if (q.seer) for (let k = 0; k < w.cells.length; k++) { const cell = w.cells[k]; if (cell.crit && ((cell.t === 'ob' && !cell.cleared) || cell.enemy)) { const x = k % w.W, y = (k - x) / w.W, a = 0.55 + 0.45 * Math.sin(T * 4 + k); c.fillStyle = 'rgba(255,233,160,' + a + ')'; starPath(c, q.ox + x * ts + ts * 0.84, q.oy + y * ts + ts * 0.16, ts * 0.13, ts * 0.05, 4, T); c.fill(); } } }
  for (const m of q.motes) glow(c, VW * (0.5 + 0.55 * Math.sin(T * m.sx + m.ax)), topIn + (VH - topIn - botIn) * (0.5 + 0.5 * Math.sin(T * m.sy + m.ay)), 7, B.accent[0], B.accent[1], B.accent[2], 0.35);
}

/* ---------- HUD + bar ---------- */
function updateQuestHud() {
  const q = Q, w = q.world, left = Math.max(0, w.need - q.loot.shards);
  $('#q-name').textContent = w.name; $('#q-biome').textContent = (q.region ? 'Journey · ' : q.rare ? 'Rare · ' : '') + q.B.name + ' · ' + SIZES[w.size].label;
  updateRuleChip(); $('#q-shards').textContent = '✦ ' + Math.min(q.loot.shards, w.need) + ' / ' + w.need + ' star shards';
  $('#q-hint').textContent = !q.acted && S.quests === 0 && q.loot.shards === 0 ? 'Tap a tile to walk. Tap anything in your way to send a little.' : left ? 'Find ' + left + ' more star shard' + (left > 1 ? 's' : '') + ' to wake the way out.' : 'The way out is awake. Step into the ring of light.';
  const bag = Object.keys(TOOLS).filter(k => S.tools[k] > 0).map(k => k + S.tools[k]).join();
  if (bag !== q.bag) { q.bag = bag; const el = $('#q-bag'); el.innerHTML = bag ? Object.keys(TOOLS).filter(k => S.tools[k] > 0).map(k => '<span aria-label="' + TOOLS[k].name + ', ' + S.tools[k] + '"><canvas data-ic="thing:tool:' + k + '" data-size="22"></canvas>' + S.tools[k] + '</span>').join('') : '<span style="color:var(--mute)">No tools in the bag yet</span>'; paintIcons(el); }
}
function buildQuestBar() {
  ui.barQuest.innerHTML = Q.lits.map((f, i) => '<button class="chip" data-chip="' + i + '"><canvas data-ic="little:' + f.l.id + '" data-size="30"></canvas><span class="nm">' + esc(f.l.name) + '</span><span class="pp"></span></button>').join('') + '<div class="side"><button class="go" data-q="rally">Rally</button><button data-q="leave">Leave</button></div>';
  paintIcons(ui.barQuest); updateQuestBar();
}
function updateQuestBar() {
  if (!Q) return;
  ui.barQuest.querySelectorAll('.chip').forEach((b, i) => { const f = Q.lits[i]; b.querySelector('.pp').innerHTML = f.stationed ? 'on plate' : pips(f.sp, f.max); b.classList.toggle('away', f.stationed); b.setAttribute('aria-label', f.l.name + ', ' + f.sp + ' sparks'); });
  const r = ui.barQuest.querySelector('[data-q="rally"]'); if (r) r.style.opacity = Q.rally ? 1 : 0.35;
}
function openChip(f) {
  const q = Q, n = S.tools.lantern || 0, can = n > 0 && f.sp < f.max && !q.busy;
  openSheet('<div class="card"><canvas data-ic="little:' + f.l.id + '" data-size="64"></canvas><div class="tx"><strong>' + esc(f.l.name) + '</strong><small>' + esc(kindLabel(f.l)) + ' · ' + f.sp + ' of ' + f.max + ' sparks' + (f.stationed ? ' · holding the moon plate' : '') + '</small><small>' + esc(skillLine(f.l)) + '</small></div></div><div class="list" style="margin-top:10px">' + (n > 0 ? '<button class="card' + (can ? '' : ' off') + '" data-do="lantern"' + (can ? '' : ' disabled') + '><canvas data-ic="thing:tool:lantern" data-size="44"></canvas><span class="tx"><strong>Use a spark lantern</strong><small>' + (f.sp >= f.max ? 'Already full of sparks' : 'Refill ' + esc(f.l.name) + ' to ' + f.max + ' sparks') + '</small></span><span class="tag">' + n + ' left</span></button>' : '') + (f.stationed ? '<button class="card" data-do="back"><canvas data-ic="plate" data-size="44"></canvas><span class="tx"><strong>Call ' + esc(f.l.name) + ' back</strong><small>The moon gate closes again</small></span></button>' : '') + '</div><div class="btns"><button class="btn" data-do="x">Close</button></div>', {
    x: closeSheet, back: () => { closeSheet(); if (Q === q) recall(f); },
    lantern: () => { closeSheet(); if (Q !== q || !(S.tools.lantern > 0) || f.sp >= f.max) return; S.tools.lantern--; f.sp = f.max; const [mx, my] = [q.ox + (f.x + 0.5) * q.ts, q.oy + (f.y + 0.4) * q.ts]; burst(mx, my, 26, 46, { kind: 'star', v: 140, size: 5 }); floatText(mx, my - 10, 'Full of sparks'); sfx('grow'); updateQuestBar(); updateQuestHud(); }
  });
}
ui.barQuest.addEventListener('click', e => {
  if (!Q || Q.done) return; unlockAudio();
  const chip = e.target.closest('[data-chip]'), b = e.target.closest('[data-q]');
  if (chip) { openChip(Q.lits[+chip.dataset.chip]); return; }
  if (!b || Q.busy) return;
  if (b.dataset.q === 'rally' && !Q.rally) { toast(Q.rallyWhy); sfx('no'); }
  else if (b.dataset.q === 'rally') {
    Q.rally = false; Q.rallyWhy = 'Already rallied on this quest.'; for (const f of Q.lits) f.sp = Math.min(f.max, f.sp + 1); Q.petMoodT = 1.2; anim(0.4, u => { if (Q) Q.petHop = Math.sin(u * Math.PI) * 0.3; });
    const [mx, my] = cellMid(Q.px, Q.py); burst(mx, my, 16, 340, { kind: 'heart', v: 110, size: 5, life: 0.9 }); sfx('grow'); toast(S.pet.name + ' rallies the littles. One spark each.'); updateQuestBar();
  } else if (b.dataset.q === 'leave') openSheet('<h2>Head home?</h2><p>You keep everything you found, but only half the stardust. This world will have drifted away by the time you look again.</p><div class="btns"><button class="btn" data-do="stay">Stay</button><button class="btn main" data-do="go">Head home</button></div>', { stay: closeSheet, go: () => { closeSheet(); finishQuest(false); } });
});

/* ---------- walking + collecting ---------- */
function collectAt(k) {
  const q = Q, c = q.world.cells[k], it = c.item; if (!it) return;
  c.item = null; const [x, y] = qXY(k), [mx, my] = cellMid(x, y); q.petMoodT = 0.6;
  if (it.k === 'shard') { if (it.bonus) { q.loot.dust += 8; floatText(mx, my, '+8 stardust', '#b9f3ff'); } else { q.loot.shards++; floatText(mx, my, q.loot.shards >= q.world.need ? 'The way out wakes' : 'Star shard'); } burst(mx, my, 14, it.bonus ? 190 : 46, { kind: 'star', v: 120, size: 5 }); sfx('shard'); }
  else if (it.k === 'berry') { const n = (it.n || 1) * (q.dbl ? 2 : 1); q.loot.berries[it.el] = (q.loot.berries[it.el] || 0) + n; floatText(mx, my, '+' + n + ' ' + BERRY[it.el], hsl(EL_HUE[it.el], 90, 76)); burst(mx, my, 6, EL_HUE[it.el], { v: 70 }); sfx('pick'); }
  else if (it.k === 'dew') { const n = q.dew2 ? 2 : 1; for (const f of q.lits) f.sp = Math.min(f.max, f.sp + n); floatText(mx, my, '+' + n + ' spark' + (n > 1 ? 's' : '') + ' each', '#9fefff'); burst(mx, my, 12, 190, { v: 100 }); sfx('skill'); updateQuestBar(); }
  else if (it.k === 'egg') { q.loot.eggs.push({ hue: it.hue, twin: !!it.twin }); floatText(mx, my, it.twin ? 'A twin egg!' : 'An egg!', '#ffc2dc'); burst(mx, my, it.twin ? 30 : 16, it.hue, { kind: 'star', v: 120, size: 5 }); sfx('shard'); }
  else if (it.k === 'chest') { const d = it.dust * (q.clover ? 2 : 1); q.loot.dust += d; floatText(mx, my, '+' + d + ' stardust' + (q.clover ? ' (clover)' : '')); if (it.tool) { const nm = giveThing('tool:' + it.tool); q.found.push('tool:' + it.tool); floatText(mx, my - 20, nm, '#c9f7d0'); } burst(mx, my, 18, 46, { kind: 'star', v: 140, size: 5 }); sfx('shard'); }
  else if (it.k === 'gift') { const nm = giveThing(it.id); q.found.push(it.id); floatText(mx, my, nm, '#ffd2f0'); for (let i = 0; i < 3; i++) burst(mx, my, 10, i * 120 + 40, { kind: 'star', v: 150, size: 6, life: 1 }); sfx('win'); toast('Found: ' + nm + '. ' + thingText(it.id), 4200); }
  updateQuestHud();
}
function walkTo(k) { if (Q.walking) { Q.nextWalk = k; Q.walkTok++; return; } doWalk(k); }
async function doWalk(k) {
  const q = Q, w = q.world, tok = ++q.walkTok, prev = (q.rule && ruleFlood(q, k)) || flood(w, q.px, q.py, q); if (!prev.has(k)) return;
  q.walking = true;
  for (const step of pathFrom(prev, k).slice(1)) {
    if (Q !== q || tok !== q.walkTok || q.done) break;
    const [x, y] = qXY(step), x0 = q.fx, y0 = q.fy;
    if (!passable(w, x, y, q)) { if (q.tide) toast('The tide is in. Wait for it to turn.'); sfx('no'); break; }
    if (Math.abs(x - x0) + Math.abs(y - y0) > 1.5) await ruleCarry(q, x0, y0, x, y);       // a gust, or a slide
    else await anim(0.14, u => { q.fx = lerp(x0, x, u); q.fy = lerp(y0, y, u); q.petHop = Math.sin(u * Math.PI) * 0.1; });
    if (Q !== q) return;
    q.px = x; q.py = y; q.fx = x; q.fy = y; q.petHop = 0; q.trail.unshift(step); if (q.trail.length > 6) q.trail.length = 6; sfx('step'); collectAt(step); if (q.rule) ruleStep(q, step);
    if (w.gate && x === w.gate.x && y === w.gate.y && !q.gateLatched) latchGate('The gate knows you now and stays open.');
    if (x === w.exit.x && y === w.exit.y && tok === q.walkTok) { arriveExit(); break; }
  }
  q.walking = false; if (Q === q && q.nextWalk !== null && !q.done && !q.busy) { const n = q.nextWalk; q.nextWalk = null; doWalk(n); } else q.nextWalk = null;
}
function latchGate(msg) {
  const q = Q, w = q.world; q.gateLatched = true; q.gateOpen = true; const f = q.lits.find(z => z.stationed), [gx, gy] = cellMid(w.gate.x, w.gate.y);
  burst(gx, gy, 18, 160, { kind: 'star', v: 120, size: 5 });
  if (f) { f.stationed = false; f.x = q.px; f.y = q.py; msg += ' ' + f.l.name + ' hops back.'; }
  toast(msg, 3600); updateQuestBar();
}
async function arriveExit() {
  const q = Q, w = q.world, left = w.need - q.loot.shards;
  if (left > 0) { toast('The way out is asleep. ' + left + ' more star shard' + (left > 1 ? 's' : '') + '.'); sfx('no'); return; }
  q.done = true; sfx('win'); const [mx, my] = cellMid(q.px, q.py); burst(mx, my, 40, 46, { kind: 'star', v: 220, size: 7, life: 1.1 }); burst(mx, my, 20, 280, { v: 160 });
  await anim(0.9, u => { q.petHop = Math.sin(u * Math.PI * 3) * 0.2; }); if (Q === q) finishQuest(true);
}

/* ---------- sending littles ---------- */
async function littleTravel(f, keys, sp) { for (const k of keys) { const [x, y] = qXY(k), x0 = f.x, y0 = f.y; if (Math.abs(x - x0) + Math.abs(y - y0) > 1.5) { await littleFly(f, x, y); continue; } await anim(sp || 0.08, u => { f.x = lerp(x0, x, u); f.y = lerp(y0, y, u); f.lift = Math.sin(u * Math.PI) * Q.ts * 0.1; }); } }
async function littleFly(f, x, y) { const x0 = f.x, y0 = f.y, d = Math.hypot(x - x0, y - y0); await anim(0.15 + d * 0.07, u => { const e = ease(u); f.x = lerp(x0, x, e); f.y = lerp(y0, y, e); f.lift = Math.sin(u * Math.PI) * Q.ts * 0.5; }); }
function beginAct(f) { Q.busy = true; Q.walkTok++; Q.nextWalk = null; Q.acted = true; f.busy = true; }
function endAct(f) { f.busy = false; f.lift = 0; if (Q) { Q.busy = false; updateQuestBar(); updateQuestHud(); } }
async function lunge(f, nk, x, y, n) { const [nx, ny] = qXY(nk); for (let i = 0; i < n; i++) await anim(0.22, u => { const s = Math.sin(u * Math.PI); f.x = nx + (x - nx) * 0.5 * s; f.y = ny + (y - ny) * 0.5 * s; }); }
function clearFx(c, x, y, label) { const [mx, my] = cellMid(x, y); burst(mx, my, 26, FX_HUE[c.ob], { kind: c.ob === 'shadow' || c.ob === 'water' ? 'star' : 'dot', v: 150, size: 5 }); sfx('skill'); c.cleared = true; floatText(mx, my - 8, label, hsl(FX_HUE[c.ob], 90, 78)); }
async function sendClear(f, k) {
  const q = Q, w = q.world, [x, y] = qXY(k), c = w.cells[k], prev = flood(w, q.px, q.py, q), near = nearIn(w, prev, x, y); if (near < 0) return;
  beginAct(f); const path = pathFrom(prev, near); await littleTravel(f, path); await lunge(f, near, x, y, 1); if (Q !== q) return;
  clearFx(c, x, y, KINDS[OBST[c.ob].by].verb + '!'); f.sp--; f.acts++; updateQuestBar(); if (q.rule === 'emberfall' && c.ob === 'bramble') spreadFire(q, k);
  await wait(0.2); await littleTravel(f, path.slice().reverse()); endAct(f);
}
async function sendPair(fs, k) {
  const q = Q, w = q.world, [x, y] = qXY(k), c = w.cells[k], prev = flood(w, q.px, q.py, q), near = nearIn(w, prev, x, y); if (near < 0) return;
  const O = OBST[c.ob], path = pathFrom(prev, near); fs.forEach(f => beginAct(f));
  await Promise.all(fs.map((f, i) => (async () => { await wait(i * 0.12); await littleTravel(f, path); })()));
  await Promise.all(fs.map(f => lunge(f, near, x, y, 1))); if (Q !== q) return;
  clearFx(c, x, y, O.skill + '!'); const cost = fs.length > 1 ? 1 : 2; fs.forEach(f => { f.sp -= cost; f.acts += 2; });
  S.j.pairs = S.j.pairs || {}; S.j.pairs[c.ob] = (S.j.pairs[c.ob] || 0) + 1; updateQuestBar();
  await wait(0.2); await Promise.all(fs.map(f => littleTravel(f, path.slice().reverse()))); fs.forEach(f => { f.busy = false; f.lift = 0; }); endAct(fs[0]);
}
function gloomGone(c, x, y, dust, label) {
  const q = Q, [mx, my] = cellMid(x, y), e = c.enemy, hue = GLOOMS[e.g].hue; S.j.glooms[e.boss ? 'boss' : e.g] = (S.j.glooms[e.boss ? 'boss' : e.g] || 0) + 1;
  c.enemy = null; c.shake = false; q.loot.dust += dust; burst(mx, my, e.boss ? 70 : 30, hue, { v: e.boss ? 240 : 170, size: 6, g: -40, life: 0.9 }); if (e.boss) burst(mx, my, 40, 46, { kind: 'star', v: 220, size: 7, life: 1.2 });
  floatText(mx, my - 8, label + ' +' + dust + ' stardust'); sfx(e.boss ? 'win' : 'skill');
}
async function sendFight(f, k) {
  const q = Q, w = q.world, [x, y] = qXY(k), c = w.cells[k], prev = flood(w, q.px, q.py, q), near = nearIn(w, prev, x, y); if (near < 0) return;
  const e = c.enemy, cost = e.boss ? 1 : fightCost(e, f.kinds, f.ring), [mx, my] = cellMid(x, y);
  beginAct(f); const path = pathFrom(prev, near); await littleTravel(f, path);
  for (let i = 0; i < (e.boss ? 2 : 3); i++) { await lunge(f, near, x, y, 1); if (Q !== q) return; c.shake = true; sfx('hit'); burst(mx, my - 6, 8, f.L.hue, { v: 110, size: 4 }); setTimeout(() => { c.shake = false; }, 160); }
  f.sp -= cost; f.acts += 2;
  if (e.boss) { const hit = f.kinds.includes(GLOOMS[e.g].weak) || f.ring ? 2 : 1; e.tough -= hit; if (e.tough <= 0) gloomGone(c, x, y, 15, 'The boss bursts!'); else { floatText(mx, my - 8, hit > 1 ? 'A mighty hit!' : 'It staggers', '#ffb0c4'); sfx('roar'); } }
  else gloomGone(c, x, y, 3, 'Poof!');
  updateQuestBar(); await wait(0.2); await littleTravel(f, path.slice().reverse()); endAct(f);
}
async function sendFetch(f, k, fly) {
  const q = Q, w = q.world, [x, y] = qXY(k);
  beginAct(f);
  if (fly) { await littleFly(f, x, y); if (Q !== q) return; collectAt(k); f.sp--; f.acts++; updateQuestBar(); await wait(0.12); await littleFly(f, q.px, q.py); }
  else { const prev = flood(w, q.px, q.py, q); if (!prev.has(k)) { endAct(f); return; } const path = pathFrom(prev, k); await littleTravel(f, path, 0.065); if (Q !== q) return; collectAt(k); await wait(0.08); await littleTravel(f, path.slice().reverse(), 0.065); }
  endAct(f);
}
async function sendStation(f) {
  const q = Q, w = q.world, pk = qKey(w.plate.x, w.plate.y), prev = flood(w, q.px, q.py, q); if (!prev.has(pk)) return;
  beginAct(f); await littleTravel(f, pathFrom(prev, pk)); if (Q !== q) return;
  f.stationed = true; q.gateOpen = true; sfx('gate'); const [gx, gy] = cellMid(w.gate.x, w.gate.y); burst(gx, gy, 24, 160, { kind: 'star', v: 130, size: 5 });
  toast('The moon gate stays open while ' + f.l.name + ' holds the plate.', 3600); endAct(f);
}
function recall(f) {
  const q = Q, w = q.world; if (q.busy || !f.stationed) return;
  const [px, py] = cellMid(w.plate.x, w.plate.y); burst(px, py, 12, f.L.hue, { v: 90 }); f.stationed = false; q.gateOpen = q.gateLatched; f.x = q.px; f.y = q.py; q.walkTok++; q.nextWalk = null;
  const [mx, my] = cellMid(q.px, q.py); burst(mx, my, 12, f.L.hue, { v: 90 }); sfx('pick'); toast(f.l.name + ' pops back to your side. The gate closes.'); updateQuestBar();
}
/* single-use tools */
function useTool(tool, k) {
  const q = Q, w = q.world, [x, y] = qXY(k), c = w.cells[k], [mx, my] = cellMid(x, y); if (!(S.tools[tool] > 0) || q.busy) return;
  S.tools[tool]--; q.acted = true; q.walkTok++; q.nextWalk = null;
  if (tool === 'seed') { clearFx(c, x, y, 'It grows!'); burst(mx, my, 20, 120, { v: 120, size: 5 }); }
  else if (tool === 'bell') { sfx('tinkle'); c.shake = true; setTimeout(() => { if (Q === q && c.enemy) gloomGone(c, x, y, 1, 'It flees!'); updateQuestHud(); }, 450); }
  else if (tool === 'key') { sfx('gate'); latchGate('The moon key turns. The gate stays open.'); }
  updateQuestHud();
}

/* ---------- tapping the world ---------- */
function questTap(pt) {
  const q = Q; if (!q || q.busy || q.done) return;
  const w = q.world, x = Math.floor((pt.x - q.ox) / q.ts), y = Math.floor((pt.y - q.oy) / q.ts); if (x < 0 || y < 0 || x >= w.W || y >= w.H) return;
  const k = qKey(x, y), c = w.cells[k], prev = flood(w, q.px, q.py, q); q.sel = { x, y, t: T };
  if (w.plate && w.plate.x === x && w.plate.y === y) return openPlate(prev);
  if (q.rule && ruleTap(q, k, c, prev)) return;
  if (c.enemy) return openTarget(k, 'enemy', prev);
  if (c.t === 'ob' && !c.cleared) return openTarget(k, 'ob', prev);
  if (c.t === 'gate' && !q.gateOpen) { const n = S.tools.key || 0; return openSheet('<h2>Moon gate</h2><div class="card"><canvas data-ic="gate" data-size="56"></canvas><div class="tx"><strong>Sealed</strong><small>Somewhere in this world lies a moon plate. The gate opens only while a little sits on it.</small></div></div>' + (n ? '<div class="list" style="margin-top:10px">' + toolRow('key', 'Turn a moon key', 'Opens the gate for good') + '</div>' : '') + '<div class="btns"><button class="btn' + (n ? '' : ' main') + '" data-do="ok">I will look for the plate</button></div>', { ok: closeSheet, tool: () => { closeSheet(); if (Q === q) useTool('key', k); } }); }
  if (c.t === 'islet') { if (c.item) openTarget(k, 'fetch', prev); return; }
  if (prev.has(k)) {
    if (c.item && !(x === q.px && y === q.py)) { const free = q.lits.filter(f => !f.stationed && !f.busy); if (free.length) return sendFetch(free[q.fetchN++ % free.length], k, false); }
    return walkTo(k);
  }
  if (c.item) return openTarget(k, 'fetch', prev);
  if (c.t !== 'wall') { toast('No way through yet.'); sfx('no'); }
}
// a little's portrait with the sparks it has left shown underneath, for the send sheet
function portrait(f, size) { return '<span class="pt"><canvas data-ic="little:' + f.l.id + '" data-size="' + size + '"></canvas><span class="sp">' + pips(f.sp, f.max) + '<b>' + f.sp + '</b></span></span>'; }
function rowHtml(f, i, label, cost, why) {
  return '<button class="card' + (why ? ' off' : '') + '" data-do="send" data-i="' + i + '"' + (why ? ' disabled' : '') + '>' + portrait(f, 48) + '<span class="tx"><strong>' + esc(f.l.name) + '</strong><small>' + esc(why || label) + '</small></span>' + (why ? '' : '<span class="tag cost">' + (cost ? cost + (cost > 1 ? ' sparks' : ' spark') : 'Free') + '</span>') + '</button>';
}
function toolRow(tool, label, text) { return '<button class="card" data-do="tool" style="border-color:var(--mint)"><canvas data-ic="thing:tool:' + tool + '" data-size="48"></canvas><span class="tx"><strong>' + label + '</strong><small>' + text + '</small></span><span class="tag yes">' + S.tools[tool] + ' left</span></button>'; }
function openTarget(k, type, prev) {
  const q = Q, w = q.world, [x, y] = qXY(k), c = w.cells[k], reach = nearIn(w, prev, x, y) >= 0;
  let title, text, icon, note = '', rows = '', run, tool = null, extra = '';
  if (type === 'ob' && OBST[c.ob].pair) {
    // two littles together: one of each kind, or a twin with both
    const O = OBST[c.ob], [A, B] = O.pair; title = O.name; text = O.text; icon = 'ob:' + c.ob; run = fs => sendPair(fs, k);
    const free = f => !f.stationed, list = [];
    q.lits.forEach((f, i) => { if (f.kinds.includes(A) && f.kinds.includes(B)) list.push({ fs: [f], is: [i], cost: 2 }); });
    q.lits.forEach((f, i) => q.lits.forEach((g, j) => { if (i < j && ((f.kinds.includes(A) && g.kinds.includes(B)) || (f.kinds.includes(B) && g.kinds.includes(A)))) list.push({ fs: [f, g], is: [i, j], cost: 1 }); }));
    rows = list.map(o => { const why = o.fs.some(f => !free(f)) ? 'One of them is holding the moon plate' : !reach ? 'Too far. Clear a way to it first' : o.fs.some(f => f.sp < o.cost) ? 'Not enough sparks' : '';
      return '<button class="card' + (why ? ' off' : '') + '" data-do="send" data-i="' + o.is.join(',') + '"' + (why ? ' disabled' : '') + '><span style="display:flex;gap:6px">' + o.fs.map(f => portrait(f, o.fs.length > 1 ? 36 : 48)).join('') + '</span><span class="tx"><strong>' + o.fs.map(f => esc(f.l.name)).join(' and ') + '</strong><small>' + esc(why || O.skill + (o.fs.length > 1 ? ', together' : ', with both skills')) + '</small></span>' + (why ? '' : '<span class="tag cost">' + o.cost + (o.cost > 1 ? ' sparks' : ' spark each') + '</span>') + '</button>'; }).join('');
    if (!list.length) note = 'This needs two littles working together: a ' + KINDS[A].label + ' little and a ' + KINDS[B].label + ' little, or a twin with both kinds.';
  } else if (type === 'ob') {
    const O = OBST[c.ob], K = KINDS[O.by]; title = O.name; text = O.text; icon = 'ob:' + c.ob; run = f => sendClear(f, k);
    rows = q.lits.map((f, i) => rowHtml(f, i, K.does, 1, f.stationed ? 'Holding the moon plate' : !f.kinds.includes(O.by) ? 'Not a ' + K.label + ' little' : !reach ? 'Too far. Clear a way to it first' : f.sp < 1 ? 'Out of sparks' : '')).join('');
    if (!q.lits.some(f => f.kinds.includes(O.by))) note = 'Nobody in this party can shift it. That takes a ' + K.label + ' little, a ' + K.species + '.';
    if ((c.ob === 'chasm' || c.ob === 'water') && reach && S.tools.seed > 0) { tool = 'seed'; extra = toolRow('seed', 'Plant a bridge seed', 'Grows across in a blink. No sparks needed'); }
  } else if (type === 'enemy') {
    const e = c.enemy, G = GLOOMS[e.g]; title = e.boss ? 'Boss ' + G.name : G.name; icon = 'gloom:' + e.g + ':' + e.tough + (e.boss ? ':boss' : ''); run = f => sendFight(f, k);
    text = e.boss ? 'Huge, cross, and sitting on the way out. Each strike costs a spark and knocks off a heart. ' + KINDS[G.weak].label + ' littles and ember rings knock off two.' : 'It blocks the way and will not budge. Weak to ' + KINDS[G.weak].label + '.';
    rows = q.lits.map((f, i) => { const cost = e.boss ? 1 : fightCost(e, f.kinds, f.ring), strong = f.kinds.includes(G.weak); return rowHtml(f, i, e.boss ? (strong || f.ring ? 'Strike hard: two hearts' : 'Strike: one heart') : 'Chase it off' + (strong ? ' (it fears ' + KINDS[G.weak].label + ')' : ''), cost, f.stationed ? 'Holding the moon plate' : !reach ? 'Too far. Clear a way to it first' : f.sp < cost ? 'Needs ' + cost + (cost > 1 ? ' sparks' : ' spark') : ''); }).join('');
    if (!e.boss && reach && S.tools.bell > 0) { tool = 'bell'; extra = toolRow('bell', 'Ring the scare-bell', 'It runs. No sparks needed'); }
    if (e.boss && S.tools.bell > 0) note = 'The scare-bell does nothing to a boss.';
  } else {
    const it = c.item; title = ITEM_NAME(it); text = c.t === 'islet' ? 'It sits on an islet no path reaches.' : 'No path leads there yet.'; icon = ITEM_ICON(it); run = f => sendFetch(f, k, true);
    rows = q.lits.map((f, i) => rowHtml(f, i, 'Fly over and fetch it', 1, f.stationed ? 'Holding the moon plate' : !f.fly ? 'Cannot fly' : f.sp < 1 ? 'Out of sparks' : '')).join('');
    if (!q.lits.some(f => f.fly)) note = c.t === 'islet' ? 'Only a flier can reach it: a Gale little, or one wearing a feather.' : 'Clear a path, or bring a flier: a Gale little, or one wearing a feather.';
  }
  openSheet('<div class="card"><canvas data-ic="' + icon + '" data-size="56"></canvas><div class="tx"><strong>' + esc(title) + '</strong><small>' + esc(text) + '</small></div></div>' + (note ? '<p class="dim" style="margin-top:10px">' + esc(note) + '</p>' : '') + (extra ? '<h3>Use a tool</h3><div class="list">' + extra + '</div>' : '') + '<h3>' + (type === 'ob' && OBST[c.ob].pair ? 'Send them together' : 'Send a little') + '</h3><div class="list">' + rows + '</div>', { send: d => { const fs = String(d.i).split(',').map(i => q.lits[+i]); closeSheet(); if (Q === q && !q.busy) run(type === 'ob' && OBST[c.ob].pair ? fs : fs[0]); }, tool: () => { closeSheet(); if (Q === q && tool) useTool(tool, k); } });
}
function openPlate(prev) {
  const q = Q, w = q.world, held = q.lits.find(f => f.stationed), ok = prev.has(qKey(w.plate.x, w.plate.y));
  if (q.gateLatched) { if (ok) walkTo(qKey(w.plate.x, w.plate.y)); toast('The moon gate already knows you.'); return; }
  const head = '<div class="card"><canvas data-ic="plate" data-size="56"></canvas><div class="tx"><strong>Moon plate</strong><small>The moon gate opens only while a little sits here.</small></div></div>';
  if (held) return openSheet(head + '<div class="btns"><button class="btn" data-do="x">Leave ' + esc(held.l.name) + ' there</button><button class="btn main" data-do="back">Call ' + esc(held.l.name) + ' back</button></div>', { x: closeSheet, back: () => { closeSheet(); recall(held); } });
  openSheet(head + '<h3>Send a little</h3><div class="list">' + q.lits.map((f, i) => rowHtml(f, i, 'Sit on the plate', 0, ok ? '' : 'Cannot reach the plate yet')).join('') + '</div>', { send: d => { const f = q.lits[+d.i]; closeSheet(); if (Q === q && !q.busy) sendStation(f); } });
}

/* ---------- going home ---------- */
function finishQuest(success) {
  const q = Q, p = S.pet, lines = []; let dust = q.loot.dust + q.loot.shards * 3 + (success ? (q.rare ? 30 : 15) : 0); if (!success) dust = Math.floor(dust / 2);
  for (const k in q.loot.berries) S.pantry[k] = (S.pantry[k] || 0) + q.loot.berries[k];
  let eggs = 0, twins = 0; for (const e of q.loot.eggs) { if (S.littles.length + S.eggs.length < 8) { S.eggs.push({ hue: e.hue, seed: (Math.random() * 2147483646) | 0, warm: 0, twin: e.twin }); eggs++; if (e.twin) { twins++; S.j.things['egg:twin'] = true; } } else dust += 12; }
  for (const f of q.lits) { const b = littleLevel(f.l.xp || 0), m0 = maxSparks(f.l); f.l.xp = (f.l.xp || 0) + (success ? 3 : 1) + f.acts; const a = littleLevel(f.l.xp); if (a > b) lines.push(f.l.name + ' reached level ' + a + (maxSparks(f.l) > m0 ? ' and now carries one more spark.' : '.')); }
  if (success) { S.quests++; p.joy = clamp(p.joy + 12, 0, 100); } p.belly = clamp(p.belly - 10, 0, 100);
  lines.push(...journeyAfter(q, success)); rollPortals(true); const name = q.world.name; Q = null; scene = 'home'; closeSheet(); setSceneUI(); rebuildHome();
  if (pendingRemote) { adopt(pendingRemote); return; }
  if (success) { const ids = q.lits.map(f => f.l.id); for (const m of [wishEvent('visit', q.B.id), wishEvent('take', ids), littleWishEvent('visit', ids, q.B.id)]) if (m) lines.push(m); lines.push(...friendsAfter(ids)); if (lines.length) layoutHome(); }
  S.dust += dust; const up = gainXp(dust); if (up) lines.unshift(up); if (success && S.quests === 1) lines.push('A trader\'s balloon has drifted in. Tap it to spend stardust.');
  save(); updateHud();
  const berries = Object.entries(q.loot.berries).map(([k, n]) => '<span><canvas data-ic="berry:' + k + '" data-size="26"></canvas>' + n + '</span>').join('');
  const found = q.found.map(id => '<span><canvas data-ic="thing:' + id + '" data-size="30"></canvas>' + esc(thingName(id)) + '</span>').join('');
  openSheet('<h2>' + (success ? 'Through the portal' : 'Home again') + '</h2><p>' + (success ? esc(name) + ' folds shut behind you. ' : 'You slip back the way you came. ') + esc(p.name) + ' is ' + (success ? 'delighted.' : 'glad to be home.') + '</p><div class="loot"><span><canvas data-ic="shard" data-size="26"></canvas>' + dust + ' stardust</span>' + berries + (eggs ? '<span><canvas data-ic="' + (twins ? 'thing:egg:twin' : 'egg:' + q.loot.eggs[0].hue) + '" data-size="26"></canvas>' + eggs + (eggs > 1 ? ' eggs' : twins ? ' twin egg' : ' egg') + '</span>' : '') + '</div>' + (found ? '<h3>Found</h3><div class="loot" style="font-size:14px">' + found + '</div>' : '') + (lines.length ? '<ul class="plain" style="margin-top:10px">' + lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '') + (eggs ? '<p class="dim">Rub the egg in the nest to warm it until it hatches.</p>' : '') + '<div class="btns"><button class="btn main" data-do="ok">Back to the nest</button></div>', { ok: closeSheet });
}
