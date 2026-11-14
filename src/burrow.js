/* ===== The burrow: a snug home in the garden for eight more littles and eggs ===== */
/* Dug for BURROW_PRICE stardust from Things in the garden, where the Glimmerkin stands, and set down like a garden thing
   (`things[k] = 'burrow'` in that quarter). Its littles and eggs live in S.burrow, not in S.littles and S.eggs, so the
   nest, the party and quests see only the nest's. A little or an egg moves between the two from the burrow's sheet, or
   from a little's own sheet at the nest. Eggs wait in the burrow; one is hatched by bringing it up to the nest. By day
   up to three of its littles play outside its door. */
const BURROW_PRICE = 150, BURROW_OUT = 3;
const burrowLittle = id => S.burrow ? S.burrow.littles.find(l => l.id === id) : null;
/* Where the burrow stands: the quarter and the tile, or null while it is held to be set down again. */
function burrowSpot() {
  if (!S.burrow) return null;
  for (const o of quarterStores()) for (const k in o.Z.things || {}) if (o.Z.things[k] === 'burrow') return { q: o.q, k: +k };
  return null;
}

/* ---------- drawing ---------- */
/* The burrow from outside: a grassy mound with a round door, a lit window and a chimney. x is its middle, y the ground. */
function drawMound(c, x, y, s, t, night) {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; const lw = Math.max(1, s * 0.016);
  c.fillStyle = 'rgba(10,30,10,.3)'; c.beginPath(); c.ellipse(x, y, s * 0.6, s * 0.11, 0, 0, TAU); c.fill();
  const g = c.createLinearGradient(0, y - s * 0.75, 0, y); g.addColorStop(0, '#6fbf5a'); g.addColorStop(1, '#2f7a34');
  c.fillStyle = g; c.strokeStyle = '#1d4a22'; c.lineWidth = lw * 1.4;
  c.beginPath(); c.moveTo(x - s * 0.6, y); c.bezierCurveTo(x - s * 0.58, y - s * 0.62, x - s * 0.2, y - s * 0.78, x + s * 0.05, y - s * 0.76); c.bezierCurveTo(x + s * 0.4, y - s * 0.74, x + s * 0.6, y - s * 0.45, x + s * 0.6, y); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#8fd86e'; c.lineWidth = lw; for (let i = 0; i < 12; i++) { const a = -2.6 + i * 0.19, gx = x + Math.cos(a) * s * 0.52, gy = y - s * 0.05 + Math.sin(a) * s * 0.68; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - s * 0.015, gy - s * 0.045); c.moveTo(gx, gy); c.lineTo(gx + s * 0.022, gy - s * 0.038); c.stroke(); }
  for (const [fx, fy, h] of [[-0.3, -0.62, 330], [0.18, -0.7, 20], [0.42, -0.44, 200], [-0.48, -0.34, 50]]) { c.fillStyle = hsl(h, 80, 72); for (let i = 0; i < 5; i++) { const a = i * TAU / 5; c.beginPath(); c.arc(x + fx * s + Math.cos(a) * s * 0.022, y + fy * s + Math.sin(a) * s * 0.022, s * 0.018, 0, TAU); c.fill(); } c.fillStyle = '#ffe58a'; c.beginPath(); c.arc(x + fx * s, y + fy * s, s * 0.013, 0, TAU); c.fill(); }
  c.fillStyle = '#8a6a5a'; c.strokeStyle = '#2a1830'; c.lineWidth = lw; rrect(c, x + s * 0.2, y - s * 0.92, s * 0.1, s * 0.2, s * 0.015); c.fill(); c.stroke();
  c.fillStyle = '#6a4c40'; rrect(c, x + s * 0.18, y - s * 0.95, s * 0.14, s * 0.05, s * 0.015); c.fill(); c.stroke();
  c.fillStyle = 'rgba(240,240,255,.5)'; for (let i = 0; i < 4; i++) { const u = REDUCED ? i / 4 : (t * 0.25 + i / 4) % 1; c.globalAlpha = 1 - u; c.beginPath(); c.arc(x + s * (0.26 + Math.sin(u * 5 + i) * 0.04), y - s * (0.98 + u * 0.4), s * (0.035 + u * 0.05), 0, TAU); c.fill(); } c.globalAlpha = 1;
  glow(c, x + s * 0.32, y - s * 0.3, s * 0.2, 40, 100, 70, 0.4 + 0.4 * night);
  c.fillStyle = night ? '#ffe7a0' : '#ffd98a'; c.strokeStyle = '#5a3a1e'; c.lineWidth = lw * 2; c.beginPath(); c.arc(x + s * 0.32, y - s * 0.3, s * 0.09, 0, TAU); c.fill(); c.stroke();
  c.lineWidth = lw; c.beginPath(); c.moveTo(x + s * 0.32, y - s * 0.39); c.lineTo(x + s * 0.32, y - s * 0.21); c.moveTo(x + s * 0.23, y - s * 0.3); c.lineTo(x + s * 0.41, y - s * 0.3); c.stroke();
  c.fillStyle = '#a69a8c'; c.strokeStyle = '#2a1830';
  for (let i = 0; i < 9; i++) { const a = Math.PI + i * Math.PI / 8, r = s * 0.25; c.beginPath(); c.ellipse(x - s * 0.1 + Math.cos(a) * r, y - s * 0.02 + Math.sin(a) * r, s * 0.05, s * 0.04, a, 0, TAU); c.fill(); c.stroke(); }
  c.fillStyle = '#2a1a14'; c.beginPath(); c.arc(x - s * 0.1, y, s * 0.21, Math.PI, 0); c.closePath(); c.fill();
  glow(c, x - s * 0.1, y - s * 0.08, s * 0.2, 36, 100, 60, 0.45);
  c.fillStyle = '#b5743a'; c.beginPath(); c.moveTo(x - s * 0.31, y); c.lineTo(x - s * 0.31, y - s * 0.19); c.quadraticCurveTo(x - s * 0.36, y - s * 0.23, x - s * 0.42, y - s * 0.16); c.lineTo(x - s * 0.42, y + s * 0.02); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ffcf6b'; c.beginPath(); c.arc(x - s * 0.39, y - s * 0.07, s * 0.014, 0, TAU); c.fill();
  c.fillStyle = '#c9bfb2'; for (const [sx, sy, sw] of [[-0.1, 0.06, 0.15], [-0.04, 0.15, 0.11]]) { c.beginPath(); c.ellipse(x + sx * s, y + sy * s, sw * s, sw * s * 0.32, 0, 0, TAU); c.fill(); c.stroke(); }
  c.restore();
}
/* Inside the burrow: earth walls, a stove, a round window, and eight nooks in two rows with whoever lives there. */
function drawBurrowRoom(c, w, h, t) {
  const r = RNG(77), B = S.burrow || { littles: [], eggs: [] };
  const g = c.createRadialGradient(w / 2, h * 0.5, h * 0.1, w / 2, h * 0.55, w * 0.8); g.addColorStop(0, '#7a4e32'); g.addColorStop(1, '#2e1a12'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(160,120,90,.25)'; c.beginPath(); c.ellipse(r.f() * w, r.f() * h, 1.5 + r.f() * 3, 1 + r.f() * 2, r.f() * 3, 0, TAU); c.fill(); }
  c.strokeStyle = '#4a2c1a'; c.lineCap = 'round'; for (let i = 0; i < 7; i++) { const x = w * (0.05 + i * 0.15) + r.f() * 10; c.lineWidth = 2 + r.f() * 2; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 6, h * 0.06, x - 8, h * 0.1, x + 3, h * (0.12 + r.f() * 0.08)); c.stroke(); }
  const wx = w * 0.8, wy = h * 0.2, wr = h * 0.11, night = nightAt(new Date().getHours()) > 0.5;
  c.save(); c.beginPath(); c.arc(wx, wy, wr, 0, TAU); c.clip(); c.fillStyle = night ? '#241d55' : '#8fc8ff'; c.fillRect(wx - wr, wy - wr, wr * 2, wr * 2); c.fillStyle = night ? '#fff1c0' : '#fff7d0'; c.beginPath(); c.arc(wx + wr * 0.35, wy - wr * 0.35, wr * 0.22, 0, TAU); c.fill(); c.fillStyle = '#2f7a34'; c.fillRect(wx - wr, wy + wr * 0.4, wr * 2, wr); c.restore();
  c.strokeStyle = '#6b4424'; c.lineWidth = 4; c.beginPath(); c.arc(wx, wy, wr, 0, TAU); c.stroke(); c.lineWidth = 2; c.beginPath(); c.moveTo(wx, wy - wr); c.lineTo(wx, wy + wr); c.moveTo(wx - wr, wy); c.lineTo(wx + wr, wy); c.stroke();
  const fx = w * 0.18, fy = h * 0.34; c.fillStyle = '#6a6a78'; c.strokeStyle = '#1e1420'; c.lineWidth = 1.5; rrect(c, fx - h * 0.09, fy - h * 0.16, h * 0.18, h * 0.17, 6); c.fill(); c.stroke();
  c.fillStyle = '#5a5a66'; c.fillRect(fx - 4, 0, 8, fy - h * 0.16);
  c.fillStyle = '#2a1a1a'; c.beginPath(); c.arc(fx, fy - h * 0.05, h * 0.055, Math.PI, 0); c.lineTo(fx + h * 0.055, fy - h * 0.005); c.lineTo(fx - h * 0.055, fy - h * 0.005); c.closePath(); c.fill();
  glow(c, fx, fy - h * 0.05, h * 0.16, 28, 100, 60, 0.6); flame(c, fx - h * 0.015, fy - h * 0.01, h * 0.035, t, 0); flame(c, fx + h * 0.02, fy - h * 0.01, h * 0.03, t, 1);
  const who = B.littles.map(l => ({ l })).concat(B.eggs.map(e => ({ e }))), per = BURROW_ROOM / 2, nw = w / per;
  for (let k = 0; k < BURROW_ROOM; k++) {
    const i = k % per, nx = nw * (i + 0.5), ny = h * (k < per ? 0.66 : 0.94), rw = nw * 0.44, rh = h * 0.13, o = who[k];
    c.fillStyle = '#20120c'; c.beginPath(); c.ellipse(nx, ny, rw, rh, 0, Math.PI, 0); c.lineTo(nx + rw, ny + 3); c.lineTo(nx - rw, ny + 3); c.closePath(); c.fill();
    c.strokeStyle = '#a07050'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(nx, ny, rw, rh, 0, Math.PI, 0); c.stroke();
    c.fillStyle = '#4f8a3c'; c.beginPath(); c.ellipse(nx, ny + 2, rw * 0.9, h * 0.022, 0, 0, TAU); c.fill();
    if (o && o.l) { const L = lookOf(o.l); drawCreature(c, L, nx, ny + 1, Math.min(h * 0.17, nw * 0.6), t + k, { still: true, mood: night ? 'sleep' : 'happy', noShadow: true, look: { x: i % 2 ? -0.3 : 0.3, y: 0.1 } }); }
    else if (o && o.e) { glow(c, nx, ny - h * 0.04, h * 0.09, 30, 100, 60, 0.35); drawItem(c, { k: 'egg', hue: o.e.hue }, nx, ny - h * 0.05, h * 0.26, t); }
  }
}
/* By day, up to three of the burrow's littles play on open ground beside it, a different three each hour. */
function burrowYard(A) {
  const sp = burrowSpot(); if (!sp || sp.q !== A.q || !S.burrow.littles.length || A.night > 0.5) return [];
  const M = A.M, bx = sp.k % M.W, by = (sp.k - bx) / M.W, Z = here(), out = [], ls = S.burrow.littles, h = new Date().getHours();
  for (const [dx, dy] of [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, 1]]) {
    if (out.length >= Math.min(BURROW_OUT, ls.length)) break;
    const x = bx + dx, y = by + dy, ch = M.rows[y] && M.rows[y][x];
    if ((ch === '.' || ch === ',') && !Z.things[y * M.W + x] && !A.shut.has(y * M.W + x)) out.push({ x, y, l: ls[(h + out.length) % ls.length] });
  }
  return out.filter((o, i, a) => a.findIndex(p => p.l === o.l) === i);
}
function drawBurrowYard(c, A, X, Y, ts) {
  return burrowYard(A).map((o, i) => ({ y: o.y, f: () => drawCreature(c, lookOf(o.l), X(o.x + 0.5), Y(o.y + 0.82), ts * 0.62, T + i * 1.7, { mood: 'happy', lift: REDUCED ? 0 : Math.max(0, Math.sin(T * 3 + i * 2)) * ts * 0.12, look: { x: o.x < A.px ? 0.5 : -0.5, y: 0 } }) }));
}

/* ---------- digging and moving it ---------- */
function burrowThingsCard(free) {
  const g = ensureGarden();
  if (!S.burrow) { const ok = free && S.dust >= BURROW_PRICE; return '<button class="card' + (ok ? '' : ' off') + '" data-do="dig"' + (ok ? '' : ' disabled') + '><canvas data-ic="mound" data-size="48"></canvas><span class="tx"><strong>Dig a burrow</strong><small>A snug home for ' + BURROW_ROOM + ' more littles and eggs, dug where ' + esc(S.pet.name) + ' stands.' + (S.dust < BURROW_PRICE ? ' You have ✦ ' + S.dust + '.' : '') + '</small></span><span class="tag cost">✦ ' + BURROW_PRICE + '</span></button>'; }
  if (g.held.burrow > 0) return '<button class="card' + (free ? '' : ' off') + '" data-do="putb"' + (free ? '' : ' disabled') + '><canvas data-ic="mound" data-size="48"></canvas><span class="tx"><strong>The burrow</strong><small>Set it down where ' + esc(S.pet.name) + ' stands. Everyone inside comes too.</small></span><span class="tag">1</span></button>';
  return '';
}
function digBurrow(k) {
  if (S.burrow || S.dust < BURROW_PRICE || !GA) return; closeSheet();
  S.dust -= BURROW_PRICE; S.burrow = { littles: [], eggs: [] }; here().things[k] = 'burrow'; GA.happy = 1; S.j.things.burrow = true;
  sfx('buy'); save(); gardenHud(); toast('A burrow! There is room in it for ' + BURROW_ROOM + ' littles and eggs. Tap it to look inside.', 4200);
}
function putBurrow(k) { const g = ensureGarden(); if (!(g.held.burrow > 0) || !GA) return; closeSheet(); g.held.burrow = 0; here().things[k] = 'burrow'; GA.happy = 1; sfx('pick'); save(); toast('The burrow is set down here.'); }
function liftBurrow() {
  const sp = burrowSpot(); if (!sp) return; closeSheet(); delete quarterStore(sp.q).things[sp.k]; ensureGarden().held.burrow = 1; sfx('pick'); save();
  toast('The burrow is picked up, with everyone in it. Things, below, sets it down again.', 3600);
}

/* ---------- the burrow's sheet ---------- */
function refreshLits() {
  if (GA) { const q = partyLittles().slice(0, 3); GA.lits = q.map((l, i) => GA.lits.find(f => f.l.id === l.id) || { l, L: lookOf(l), x: GA.px, y: GA.py, hop: 0, busy: 0 }); }
  rebuildHome();
}
function openBurrow() {
  const B = S.burrow; if (!B) return; const n = B.littles.length + B.eggs.length, room = burrowRoom(), up = nestRoom() > 0;
  const lit = (l, d, tag, off) => '<button class="card' + (off ? ' off' : '') + '" data-do="' + d + '" data-id="' + l.id + '"' + (off ? ' disabled' : '') + '><canvas data-ic="little:' + l.id + '" data-size="52"></canvas><span class="tx"><strong>' + esc(l.name) + '</strong><small>' + esc(kindLabel(l)) + ' · Lv ' + littleLevel(l.xp || 0) + '</small></span><span class="tag">' + tag + '</span></button>';
  const egg = (e, i, d, tag, line, off) => '<button class="card' + (off ? ' off' : '') + '" data-do="' + d + '" data-i="' + i + '"' + (off ? ' disabled' : '') + '><canvas data-ic="egg:' + e.hue + '" data-size="52"></canvas><span class="tx"><strong>' + (e.twin ? 'A twin egg' : 'An egg') + '</strong><small>' + line + '</small></span><span class="tag">' + tag + '</span></button>';
  const nestLits = S.littles.length > 1 ? S.littles : [];
  let h = '<h2>The burrow</h2><canvas data-ic="burrow" data-size="190" data-w="300" style="border-radius:14px;max-width:100%;display:block;margin:0 auto"></canvas>';
  h += '<p class="dim" style="margin-top:10px">' + n + ' of ' + BURROW_ROOM + ' places taken. Littles here rest, and play outside by day. Quests set off from the nest, so bring a little up to take it along. Eggs wait here, warm and safe: bring one up to the nest to hatch it.</p>';
  if (n) h += '<h3>In the burrow</h3><div class="list">' + B.littles.map(l => lit(l, 'up', up ? 'To the nest' : 'Swap')).join('') + B.eggs.map((e, i) => egg(e, i, 'eggup', 'To the nest', up ? 'Bring it up to the nest to hatch it.' : 'The nest is full. Make room there first.', !up)).join('') + '</div>';
  if (room > 0 && (nestLits.length || S.eggs.length)) h += '<h3>At the nest</h3><div class="list">' + nestLits.map(l => lit(l, 'down', 'To the burrow')).join('') + S.eggs.map((e, i) => egg(e, i, 'eggdown', 'To the burrow', 'Waiting in the cradle.')).join('') + '</div>';
  else if (room <= 0) h += '<p class="dim">The burrow is full. A little at the nest can swap places with one here.</p>';
  h += '<div class="btns"><button class="btn" data-do="lift">Move the burrow</button><button class="btn main" data-do="ok">Back to the garden</button></div>';
  openSheet(h, {
    ok: closeSheet, lift: liftBurrow,
    up: d => { const l = burrowLittle(d.id); if (!l) return; if (nestRoom() <= 0) { openSwap(l.id); return; } moveUp(l); toast(l.name + ' goes up to the nest.'); openBurrow(); },
    down: d => { const l = petById(d.id); if (!l || burrowRoom() <= 0 || S.littles.length <= 1) return; moveDown(l); toast(l.name + ' moves into the burrow.'); openBurrow(); },
    eggup: d => { const e = B.eggs[+d.i]; if (!e || nestRoom() <= 0) return; B.eggs.splice(+d.i, 1); S.eggs.push(e); sfx('pick'); save(); refreshLits(); toast('The egg goes up to the cradle at the nest.'); openBurrow(); },
    eggdown: d => { const e = S.eggs[+d.i]; if (!e || burrowRoom() <= 0) return; S.eggs.splice(+d.i, 1); B.eggs.push(e); sfx('pick'); save(); refreshLits(); toast('The egg goes down to the burrow.'); openBurrow(); }
  });
}
function moveUp(l) { const B = S.burrow; B.littles.splice(B.littles.indexOf(l), 1); S.littles.push(l); sfx('pick'); save(); refreshLits(); }
function moveDown(l) { S.littles.splice(S.littles.indexOf(l), 1); S.party = S.party.filter(id => id !== l.id); S.burrow.littles.push(l); sfx('pick'); save(); refreshLits(); }
/* With the nest full, a little coming up swaps places with one going down. */
function openSwap(id) {
  const l = burrowLittle(id); if (!l) return;
  openSheet('<h2>Swap with ' + esc(l.name) + '</h2><p class="dim">The nest is full. Who goes down to the burrow so ' + esc(l.name) + ' can come up?</p><div class="list">' + S.littles.map(o => '<button class="card" data-do="pick" data-id="' + o.id + '"><canvas data-ic="little:' + o.id + '" data-size="52"></canvas><span class="tx"><strong>' + esc(o.name) + '</strong><small>' + esc(kindLabel(o)) + ' · Lv ' + littleLevel(o.xp || 0) + (S.party.includes(o.id) ? ' · in the party' : '') + '</small></span><span class="tag">Swap</span></button>').join('') + '</div><div class="btns"><button class="btn main" data-do="back">Back</button></div>', {
    back: openBurrow,
    pick: d => { const o = petById(d.id), b = burrowLittle(id); if (!o || !b) return; const was = S.party.includes(o.id); moveDown(o); moveUp(b); if (was && S.party.length < 3) { S.party.push(b.id); refreshLits(); save(); } toast(b.name + ' and ' + o.name + ' swap places.'); openBurrow(); }
  });
}
/* From a little's own sheet at the nest. */
function sendToBurrow(id) {
  const l = petById(id); if (!l || burrowRoom() <= 0) return; if (S.littles.length <= 1) { toast('Someone has to stay at the nest.'); return; }
  moveDown(l); toast(l.name + ' moves into the burrow in the garden.', 3200); openLittles();
}
