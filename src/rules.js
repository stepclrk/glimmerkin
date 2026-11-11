/* ===== World rules at play: each world type has one rule of its own ===== */
$('#q-rule').addEventListener('click', () => { unlockAudio(); openRule(); });
const ruleSpeed = () => window.__fast ? 4 : 1;   // the browser tests run the clock faster
function ruleStart(q) {
  const w = q.world; q.rule = w.rule; q.ruleSec = -1;
  if (q.rule === 'tidehollow') { q.tide = false; q.tideT = 0; q.tideLv = 0; }
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
  if (q.rule === 'tidehollow') return (q.tide ? '≈ Tide in, turns in ' : '≈ Tide out, turns in ') + Math.max(1, Math.ceil(q.ruleSec / ruleSpeed())) + ' s';
  return q.rule ? RULES[q.rule].name : '';
}
function updateRuleChip() { const el = $('#q-rule'); if (!el || !Q) return; const t = ruleChip(Q); el.hidden = !t; el.textContent = t; }
function openRule() {
  if (!Q || !Q.rule) return; const R = RULES[Q.rule];
  openSheet('<h2>' + esc(Q.B.name) + ': ' + esc(R.name.toLowerCase()) + '</h2><p>' + esc(R.text) + '</p><p class="dim">Every ' + esc(Q.B.name) + ' world has this rule. Every world can still be finished with the littles you brought.</p><div class="btns"><button class="btn main" data-do="ok">Got it</button></div>', { ok: closeSheet });
}
/* Drawing that sits on a tile, under items and creatures. */
function drawRuleCell(c, q, cell, k, X, Y, ts) {
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
