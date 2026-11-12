/* ===== World rules at play: each world type has one rule of its own ===== */
$('#q-rule').addEventListener('click', () => { unlockAudio(); if (scene === 'bonus') openBonusRule(); else openRule(); });
const ruleSpeed = () => window.__fast ? 4 : 1;   // the browser tests run the clock faster
function ruleStart(q) {
  const w = q.world; q.rule = w.rule; q.ruleSec = -1;
  if (q.rule === 'tidehollow') { q.tide = false; q.tideT = 0; q.tideLv = 0; }
  if (w.song) { q.songOpen = false; q.songAt = 0; q.doorLv = 0; }
  if (q.rule === 'gloamglass') { q.seen = new Uint8Array(w.W * w.H); q.lightR = 1.5 + q.lits.filter(f => f.kinds.includes('glow')).length; q.dark = document.createElement('canvas'); q.seen[w.exit.y * w.W + w.exit.x] = 1; lightUp(q); }
}
/* Darkness: what is lit now, and what has been seen before. */
function lightSources(q) {
  const w = q.world, out = [{ x: q.fx, y: q.fy, r: q.lightR }];
  for (const f of q.lits) if (f.busy || f.stationed) out.push({ x: f.x, y: f.y, r: f.kinds.includes('glow') ? 2.2 : 1.2 });
  w.cells.forEach((c, k) => { if (c.lamp && c.lit) out.push({ x: k % w.W, y: (k - k % w.W) / w.W, r: 2.6 }); });
  return out;
}
function lightUp(q) {
  const w = q.world, src = lightSources(q);
  for (let k = 0; k < w.cells.length; k++) {
    if (q.seen[k] === 2) continue; const x = k % w.W, y = (k - x) / w.W;
    for (const s of src) if (Math.hypot(x - s.x, y - s.y) <= s.r) { q.seen[k] = 1; break; }
    const c = w.cells[k]; if (c.lamp && !c.lit && Math.hypot(x - q.fx, y - q.fy) <= 1.05) { c.lit = true; const [mx, my] = cellMid(x, y); burst(mx, my, 20, 280, { kind: 'star', v: 120, size: 5 }); sfx('gate'); }
  }
}
const seenAt = (q, k) => !q.seen || q.seen[k] > 0;
function drawDark(c, q) {
  const w = q.world, ts = q.ts, m = q.dark; if (m.width !== cv.width || m.height !== cv.height) { m.width = cv.width; m.height = cv.height; }
  const d = m.getContext('2d'); d.setTransform(DPR, 0, 0, DPR, 0, 0); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, VW, VH);
  d.fillStyle = 'rgba(5,3,16,.985)'; d.fillRect(0, 0, VW, VH); d.globalCompositeOperation = 'destination-out';
  d.fillStyle = 'rgba(0,0,0,.4)'; for (let k = 0; k < w.cells.length; k++) if (q.seen[k]) { const x = k % w.W, y = (k - x) / w.W; d.fillRect(q.ox + x * ts, q.oy + y * ts, ts, ts); }
  const hole = (x, y, r, a) => { const cx = q.ox + (x + 0.5) * ts, cy = q.oy + (y + 0.5) * ts, g = d.createRadialGradient(cx, cy, 0, cx, cy, r * ts); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(0.62, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(cx - r * ts, cy - r * ts, r * ts * 2, r * ts * 2); };
  for (const s of lightSources(q)) hole(s.x, s.y, s.r + 0.6, 1);
  hole(w.exit.x, w.exit.y, 0.9, 0.55);                                        // the portal always glimmers
  c.drawImage(m, 0, 0, VW, VH);
}
/* The rule's part of every frame: clocks, and anything that moves on its own. */
function ruleTick(q, dt) {
  if (q.songOpen !== undefined) q.doorLv = Math.min(1, q.doorLv + (q.songOpen ? dt * 1.5 : 0));
  if (q.rule === 'gloamglass') lightUp(q);
  if (q.rule === 'tidehollow') {
    const len = q.tide ? TIDE_IN : TIDE_OUT; q.tideT += dt * ruleSpeed();
    if (q.tideT >= len) {
      q.tideT = 0; q.tide = !q.tide; sfx('wave');
      if (q.tide) { const stuck = q.lits.some(f => f.busy); if (!stuck) toast('The tide is coming in. The sandy flats are under water.', 2600); }
      else toast('The tide is going out.', 2000);
    }
    q.tideLv += ((q.tide ? 1 : 0) - q.tideLv) * Math.min(1, dt * 2.2);
    const left = Math.ceil((q.tide ? TIDE_IN : TIDE_OUT) - q.tideT); if (left !== q.ruleSec) { q.ruleSec = left; updateRuleChip(); }
  }
}
function ruleChip(q) {
  if (q.world.song) return q.songOpen ? '♪ The song door is open' : '♪ Song stones: ' + q.songAt + ' of ' + q.world.song.length;
  if (q.rule === 'tidehollow') return (q.tide ? '≈ Tide in, turns in ' : '≈ Tide out, turns in ') + Math.max(1, Math.ceil(q.ruleSec / ruleSpeed())) + ' s';
  return q.rule ? RULES[q.rule].name : '';
}
function updateRuleChip() { const el = $('#q-rule'); if (!el || !Q) return; const t = ruleChip(Q); el.hidden = !t; el.textContent = t; }
function openRule() {
  if (!Q || !Q.rule) return; const R = RULES[Q.rule];
  openSheet('<h2>' + esc(Q.B.name) + ': ' + esc(R.name.toLowerCase()) + '</h2><p>' + esc(R.text) + '</p><p class="dim">Every ' + esc(Q.B.name) + ' world has this rule. Every world can still be finished with the littles you brought.</p><div class="btns"><button class="btn main" data-do="ok">Got it</button></div>', { ok: closeSheet });
}
/* Song stones: the next stone in order rings; a wrong one starts the song again. */
const songIdx = (w, k) => w.song ? w.song.findIndex(p => p.y * w.W + p.x === k) : -1;
function ruleStep(q, k) {
  const w = q.world, i = songIdx(w, k); if (i < 0 || q.songOpen) return;
  const [mx, my] = cellMid(...qXY(k));
  if (i === q.songAt) {
    q.songAt++; sfx('note', CHIME_NOTES[i * 2]); burst(mx, my, 14, 36 + i * 40, { kind: 'star', v: 110, size: 5 }); floatText(mx, my - 10, '♪', hsl(36 + i * 40, 90, 78));
    if (q.songAt >= w.song.length) { q.songOpen = true; const [dx, dy] = cellMid(w.door.x, w.door.y); burst(dx, dy, 30, 40, { kind: 'star', v: 160, size: 6 }); setTimeout(() => sfx('win'), 250); toast('The song is complete. The song door sinks into the ground.', 3200); }
  } else { const had = q.songAt; q.songAt = i === 0 ? 1 : 0; sfx(i === 0 ? 'note' : 'no', CHIME_NOTES[0]); if (had > 0 && i !== 0) toast('A wrong note. The song starts again from the first stone.', 2800); }
  updateRuleChip();
}
/* Walking while a song is unfinished goes round stones other than the one tapped. */
function ruleFlood(q, k) {
  const w = q.world; if (!w.song || q.songOpen) return null;
  const avoid = new Set(w.song.map(p => p.y * w.W + p.x).filter(s => s !== k && s !== q.py * w.W + q.px)), prev = flood(w, q.px, q.py, q, avoid);
  return prev.has(k) ? prev : null;
}
function drawSongStone(c, x, y, s, i, on) {
  const cx = x + s / 2, cy = y + s * 0.56, h = 36 + i * 40; if (on) glow(c, cx, cy, s * 0.6, h, 100, 70, 0.55 + 0.15 * Math.sin(T * 4 + i));
  c.save(); c.fillStyle = on ? hsl(h, 50, 70) : '#6f6788'; c.strokeStyle = '#1c1826'; c.lineWidth = Math.max(1, s * 0.03);
  c.beginPath(); c.ellipse(cx, cy, s * 0.32, s * 0.22, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = on ? '#fff8dc' : '#cfc8e6'; for (let d = 0; d <= i; d++) { c.beginPath(); c.arc(cx + (d - i / 2) * s * 0.13, cy, s * 0.045, 0, TAU); c.fill(); }
  c.restore();
}
function drawDoor(c, x, y, s, lv, B, seed, at, n) {
  drawFloor(c, x, y, s, B, seed); if (lv >= 1) return;
  const h = s * 0.86 * (1 - lv), bx = x + s * 0.14, by = y + s * 0.93 - h; c.save(); c.globalAlpha = 1 - lv * 0.6;
  glow(c, x + s / 2, y + s / 2, s * 0.55, 36, 90, 70, 0.25); const g = c.createLinearGradient(bx, 0, bx + s * 0.72, 0); g.addColorStop(0, '#8a8098'); g.addColorStop(1, '#4f4860');
  c.fillStyle = g; c.strokeStyle = '#1c1826'; c.lineWidth = Math.max(1, s * 0.035); rrect(c, bx, by, s * 0.72, h, s * 0.12); c.fill(); c.stroke();
  for (let i = 0; i < n; i++) { const on = i < at; c.fillStyle = on ? hsl(36 + i * 40, 100, 75) : 'rgba(30,24,44,.7)'; if (on) glow(c, x + s / 2, by + h * (0.25 + i * 0.25), s * 0.12, 36 + i * 40, 100, 70, 0.6); c.beginPath(); c.arc(x + s / 2, by + h * (0.25 + i * 0.25), s * 0.05, 0, TAU); c.fill(); }
  c.restore();
}
/* Carried further than one step: a wind pad's gust lifts you from the pad next to you to its twin. */
async function ruleCarry(q, x0, y0, x, y) {
  const w = q.world, c = w.cells[y * w.W + x];
  if (c.pad !== undefined) {
    const [ax, ay] = qXY(c.pad); await anim(0.14, u => { q.fx = lerp(x0, ax, u); q.fy = lerp(y0, ay, u); });
    sfx('gust'); const [mx, my] = cellMid(ax, ay); burst(mx, my, 14, 190, { v: 120, size: 4, g: -60 });
    const d = Math.hypot(x - ax, y - ay); await anim(0.25 + d * 0.06, u => { const e = ease(u); q.fx = lerp(ax, x, e); q.fy = lerp(ay, y, e); q.petHop = Math.sin(u * Math.PI) * (0.5 + d * 0.12); });
    q.petHop = 0; return;
  }
  // a slide over slick moss, in a straight line, picking things up on the way
  const dx = Math.sign(x - x0), dy = Math.sign(y - y0), n = Math.round(Math.abs(x - x0) + Math.abs(y - y0)); let cx = Math.round(x0), cy = Math.round(y0); sfx('slide');
  for (let i = 0; i < n; i++) { const ax = cx, ay = cy; cx += dx; cy += dy; await anim(0.075, u => { q.fx = lerp(ax, cx, u); q.fy = lerp(ay, cy, u); }); if (Q !== q) return; if (i < n - 1) collectAt(cy * w.W + cx); if (i % 2 === 0) { const [mx, my] = cellMid(cx, cy); burst(mx, my + q.ts * 0.3, 3, 120, { v: 40, size: 3 }); } }
}
function drawMoss(c, x, y, s, seed, t) {
  const r = RNG(seed); rrect(c, x + 2, y + 2, s - 4, s - 4, s * 0.22); const g = c.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, 'rgba(140,235,170,.72)'); g.addColorStop(1, 'rgba(50,160,125,.72)'); c.fillStyle = g; c.fill();
  c.fillStyle = 'rgba(220,255,240,.75)'; for (let i = 0; i < 3; i++) { const px = x + s * (0.2 + r.f() * 0.6), py = y + s * (0.2 + r.f() * 0.6), a = 0.5 + 0.5 * Math.sin(t * 2 + i + seed); c.globalAlpha = a; c.beginPath(); c.ellipse(px, py, s * 0.05, s * 0.025, -0.5, 0, TAU); c.fill(); }
  c.globalAlpha = 1; c.strokeStyle = 'rgba(200,255,225,.35)'; c.lineWidth = Math.max(1, s * 0.025); c.beginPath(); c.moveTo(x + s * 0.2, y + s * 0.3); c.quadraticCurveTo(x + s * 0.4, y + s * 0.18, x + s * 0.62, y + s * 0.26); c.stroke();
}
const PAD_HUE = [190, 310, 48];
function drawPad(c, x, y, s, hue, t) {
  const cx = x + s / 2, cy = y + s / 2; glow(c, cx, cy, s * 0.55, hue, 90, 72, 0.35 + 0.1 * Math.sin(t * 3));
  c.save(); c.lineCap = 'round'; c.fillStyle = hsl(hue, 40, 30, 0.6); c.beginPath(); c.ellipse(cx, cy + s * 0.08, s * 0.36, s * 0.24, 0, 0, TAU); c.fill();
  for (let i = 0; i < 3; i++) { const a = t * 3 + i * TAU / 3; c.strokeStyle = hsl(hue, 90, 80, 0.85); c.lineWidth = Math.max(1.5, s * 0.04); c.beginPath(); c.ellipse(cx, cy + s * 0.04 - i * s * 0.08, s * (0.3 - i * 0.07), s * (0.18 - i * 0.04), 0, a, a + 3.6); c.stroke(); }
  c.restore();
}
/* Wildfire: a burnt bramble spreads, wave by wave, through touching brambles and dry thickets. */
async function spreadFire(q, k) {
  const w = q.world, waves = fireFrom(w, k).slice(1); let fled = 0;
  const scare = a => { const x = a % w.W, y = (a - x) / w.W; for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w.W || ny >= w.H) continue; const c = w.cells[ny * w.W + nx]; if (c.enemy && !c.enemy.boss) { gloomGone(c, nx, ny, 1, 'It flees the fire!'); fled++; } } };
  scare(k);
  for (const wave of waves) {
    await wait(0.22); if (Q !== q) return;
    for (const a of wave) { const c = w.cells[a], [x, y] = qXY(a), [mx, my] = cellMid(x, y); if (c.t === 'thicket') { c.t = 'floor'; c.ash = true; } else c.cleared = true; burst(mx, my, 18, 22, { v: 120, size: 5, g: -80 }); scare(a); }
    sfx('hit');
  }
  if (waves.length) { const n = waves.reduce((m, v) => m + v.length, 0); toast('The fire spreads: ' + n + ' more ' + (n > 1 ? 'tiles burn' : 'tile burns') + ' away' + (fled ? ', and ' + fled + (fled > 1 ? ' glooms flee.' : ' gloom flees.') : '.'), 3200); }
  updateQuestHud();
}
function drawThicket(c, x, y, s, seed, ash) {
  const r = RNG(seed), cx = x + s / 2, cy = y + s / 2; c.save(); c.lineCap = 'round';
  if (ash) { rrect(c, x + 1, y + 1, s - 2, s - 2, s * 0.2); c.fillStyle = '#3a2a26'; c.fill(); for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(255,140,60,' + (0.3 + 0.3 * Math.sin(T * 3 + i + seed)) + ')'; c.beginPath(); c.arc(x + s * (0.2 + r.f() * 0.6), y + s * (0.2 + r.f() * 0.6), s * 0.025, 0, TAU); c.fill(); } c.restore(); return; }
  for (let i = 0; i < 7; i++) { const a = r.f() * TAU, l = s * (0.25 + r.f() * 0.2); c.strokeStyle = hsl(30 + r.f() * 14, 45, 34 + r.f() * 14); c.lineWidth = Math.max(1.5, s * 0.05); c.beginPath(); c.moveTo(cx + (r.f() - 0.5) * s * 0.2, cy + s * 0.3); c.quadraticCurveTo(cx + Math.cos(a) * l * 0.5, cy - s * 0.05, cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.6 - s * 0.15); c.stroke(); }
  c.restore();
}
/* Drawing that sits on a tile, under items and creatures. */
function drawRuleCell(c, q, cell, k, X, Y, ts) {
  if (cell.t === 'thicket' || cell.ash) drawThicket(c, X, Y, ts, q.world.seed + k, !!cell.ash);
  if (cell.slick) drawMoss(c, X, Y, ts, q.world.seed + k, T);
  if (cell.pad !== undefined) drawPad(c, X, Y, ts, PAD_HUE[cell.padHue % 3], T);
  if (cell.t === 'door') { drawDoor(c, X, Y, ts, q.doorLv, q.B, q.world.seed + k, q.songAt, q.world.song.length); return; }
  const si = songIdx(q.world, k); if (si >= 0) drawSongStone(c, X, Y, ts, si, q.songOpen || si < q.songAt);
  if (cell.lamp) {
    const cx = X + ts / 2, cy = Y + ts * 0.62, on = cell.lit; if (on) glow(c, cx, cy - ts * 0.2, ts * 1.4, 280, 90, 75, 0.45 + 0.1 * Math.sin(T * 3 + k));
    c.save(); c.lineJoin = 'round'; c.strokeStyle = '#2a1840'; c.lineWidth = Math.max(1, ts * 0.03);
    for (const [dx, h, lean] of [[-0.12, 0.34, -0.12], [0.02, 0.48, 0], [0.14, 0.3, 0.14]]) { const bx = cx + dx * ts, top = cy - h * ts; c.fillStyle = on ? hsl(280, 90, 82) : hsl(262, 30, 42); c.beginPath(); c.moveTo(bx - ts * 0.06, cy); c.lineTo(bx + lean * ts * 0.3, top); c.lineTo(bx + ts * 0.06, cy); c.closePath(); c.fill(); c.stroke(); }
    c.restore();
  }
  if (cell.flat) {
    const r = RNG(q.world.seed + k * 7);
    rrect(c, X + 1, Y + 1, ts - 2, ts - 2, ts * 0.2); c.fillStyle = '#c9b48a'; c.fill();
    c.fillStyle = 'rgba(120,96,60,.5)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(X + ts * (0.2 + r.f() * 0.6), Y + ts * (0.2 + r.f() * 0.6), ts * 0.06, ts * 0.02, r.f() * 3, 0, TAU); c.fill(); }
    if (cell.frozen) { rrect(c, X + 2, Y + 2, ts - 4, ts - 4, ts * 0.2); const g = c.createLinearGradient(X, Y, X + ts, Y + ts); g.addColorStop(0, 'rgba(230,251,255,.92)'); g.addColorStop(1, 'rgba(159,214,238,.92)'); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5; c.stroke(); return; }
    const lv = q.tideLv; if (lv < 0.02) return;
    rrect(c, X + 1, Y + 1 + (1 - lv) * ts * 0.5, ts - 2, ts - 2 - (1 - lv) * ts * 0.5, ts * 0.2);
    c.fillStyle = 'rgba(70,170,205,' + (0.25 + lv * 0.45) + ')'; c.fill();
    c.strokeStyle = 'rgba(200,245,255,' + (0.6 * lv) + ')'; c.lineWidth = Math.max(1, ts * 0.03);
    for (let i = 0; i < 2; i++) { const yy = Y + ts * (0.4 + i * 0.25) + Math.sin(T * 2 + k + i) * ts * 0.04; c.beginPath(); c.moveTo(X + ts * 0.18, yy); c.quadraticCurveTo(X + ts * 0.35, yy - ts * 0.08, X + ts * 0.5, yy); c.quadraticCurveTo(X + ts * 0.65, yy + ts * 0.08, X + ts * 0.82, yy); c.stroke(); }
  }
}
/* A tap on a tile the rule cares about. Returns true when the rule handled it. */
function ruleTap(q, k, c, prev) {
  const w = q.world, [x, y] = qXY(k);
  if (c.t === 'thicket') { toast('A dry thicket. Fire from a bramble wall touching it would burn it away.', 3200); return true; }
  if (c.slick && !prev.has(k) && passable(w, x, y, q)) { toast('Too slippery to stop there. Slide across it to reach the far side.'); sfx('no'); return true; }
  if (c.t === 'door' && !q.songOpen) {
    const n = w.song.length;
    openSheet('<div class="card"><canvas data-ic="ob:boulder" data-size="56"></canvas><div class="tx"><strong>Song door</strong><small>It opens for good once its ' + n + ' song stones are stepped on in order: one dot, then two' + (n > 2 ? ', then three' : '') + '. A wrong stone starts the song again.</small></div></div><p class="dim">Rung so far: ' + q.songAt + ' of ' + n + '. Tapping a stone walks round the others where it can.</p><div class="btns"><button class="btn main" data-do="x">I will find the stones</button></div>', { x: closeSheet });
    return true;
  }
  if (!seenAt(q, k)) { toast('Too dark to see there. Walk closer, or bring a Glow little.'); sfx('no'); return true; }
  if (c.flat && !c.frozen && q.tide) {
    const reach = nearIn(w, prev, x, y) >= 0, here = q.px === x && q.py === y;
    if (here) return false;
    const rows = q.lits.map((f, i) => rowHtml(f, i, 'Freeze it for good', 1, f.stationed ? 'Holding the moon plate' : !f.kinds.includes('tide') ? 'Not a Tide little' : !reach ? 'Too far. Get next to it first' : f.sp < 1 ? 'Out of sparks' : '')).join('');
    openSheet('<div class="card"><canvas data-ic="ob:water" data-size="56"></canvas><div class="tx"><strong>Sandy flat, under the tide</strong><small>It can be crossed once the tide goes out, in ' + Math.max(1, Math.ceil(q.ruleSec / ruleSpeed())) + ' s. Frozen, it holds at any tide.</small></div></div><h3>Send a little</h3><div class="list">' + rows + '</div><div class="btns"><button class="btn main" data-do="x">Wait for the tide</button></div>', {
      x: closeSheet, send: d => { const f = q.lits[+d.i]; closeSheet(); if (Q === q && !q.busy) sendFreeze(f, k); }
    });
    return true;
  }
  return false;
}
async function sendFreeze(f, k) {
  const q = Q, w = q.world, [x, y] = qXY(k), c = w.cells[k], prev = flood(w, q.px, q.py, q), near = nearIn(w, prev, x, y); if (near < 0) return;
  beginAct(f); const path = pathFrom(prev, near); await littleTravel(f, path); await lunge(f, near, x, y, 1); if (Q !== q) return;
  c.frozen = true; f.sp--; f.acts++; const [mx, my] = cellMid(x, y); burst(mx, my, 26, 195, { kind: 'star', v: 150, size: 5 }); sfx('skill'); floatText(mx, my - 8, 'Freeze!', hsl(195, 90, 78));
  updateQuestBar(); await wait(0.2); await littleTravel(f, path.slice().reverse()); endAct(f);
}
