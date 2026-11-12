/* ===== Bonus worlds: a secret door in a normal world leads to a short world that plays another way ===== */
/* Each bonus world adds itself to BONUS with: name, line (one sentence for the door), hint (shown at the top while
   it is played), text (its rule, in full), start(b), draw(b, c, dt), end(b, early) which fills b.loot and gives the
   sentence for the results, and any of down(b, pt), move(b, pt), up(b, pt, tap) for the pointer. */
const BONUS = {};
let BW = null;          // the bonus world being played. The quest it was entered from waits, untouched, in Q
const bonusSpeed = () => window.__fast ? 4 : 1;   // the browser tests run the clock faster
/* Which bonus world a door leads to: the one this player has visited least, so all of them come round. */
function bonusPick(seed) {
  const ids = Object.keys(BONUS), n = id => (S.j.bonus || {})[id] || 0, least = Math.min(...ids.map(n)), pool = ids.filter(id => n(id) === least);
  return pool[(seed >>> 0) % pool.length];
}
const secretHere = q => !!(q.world.secret && !q.secretUsed && q.world.secret.x === q.px && q.world.secret.y === q.py);
function drawSecretDoor(c, x, y, s, t) {
  const cx = x + s / 2, by = y + s * 0.86, w = s * 0.26, h = s * 0.6, a = 0.5 + 0.5 * Math.sin(t * 2.4);
  c.save(); c.lineJoin = 'round'; glow(c, cx, by - h * 0.5, s * 0.6, 290, 90, 72, 0.22 + 0.16 * a);
  const arch = (k) => { c.beginPath(); c.moveTo(cx - w * k, by); c.lineTo(cx - w * k, by - h * 0.55); c.arc(cx, by - h * 0.55, w * k, Math.PI, 0); c.lineTo(cx + w * k, by); c.closePath(); };
  for (let i = 0; i < 3; i++) { arch(1.18 - i * 0.07); c.strokeStyle = hsl(46 + i * 110 + t * 40, 95, 74, 0.55 + 0.35 * a); c.lineWidth = Math.max(1, s * 0.035); c.stroke(); }
  arch(1); const g = c.createLinearGradient(0, by - h, 0, by); g.addColorStop(0, '#3a2a78'); g.addColorStop(1, '#150d33'); c.fillStyle = g; c.fill(); c.strokeStyle = '#0c0720'; c.lineWidth = Math.max(1, s * 0.03); c.stroke();
  c.fillStyle = '#fff3c4'; starPath(c, cx, by - h * 0.5, s * 0.075, s * 0.03, 4, t * 1.5); c.fill();
  for (let i = 0; i < 3; i++) { const u = (t * 0.5 + i / 3) % 1; c.fillStyle = 'rgba(255,240,200,' + (1 - u) * 0.8 + ')'; c.beginPath(); c.arc(cx + Math.sin(i * 2.4 + t) * w * 1.2, by - h * 0.2 - u * h * 0.9, s * 0.02, 0, TAU); c.fill(); }
  c.restore();
}
function openSecret() {
  const q = Q; if (!q || q.busy || q.done || !secretHere(q)) return;
  const id = q.secretId || (q.secretId = bonusPick(q.world.seed)), D = BONUS[id];
  openSheet('<h2>A secret door</h2><div class="card"><canvas data-ic="secret" data-size="56"></canvas><div class="tx"><strong>' + esc(D.name) + '</strong><small>' + esc(D.line) + '</small></div></div><p class="dim" style="margin-top:10px">It leads to a bonus world, which plays in its own way. Nothing can go wrong in there, and this world waits for you just as you left it.</p><div class="btns"><button class="btn" data-do="no">Not now</button><button class="btn main" data-do="go">Step through</button></div>', { no: closeSheet, go: () => { closeSheet(); if (Q === q && !q.busy && !q.done && secretHere(q)) enterBonus(id); } });
}
function enterBonus(id) {
  const q = Q, D = BONUS[id], seed = (q.world.seed ^ 0xb0b05) >>> 0;
  q.secretUsed = true; q.walkTok++; q.nextWalk = null;
  BW = { id, D, q, seed, B: q.B, name: worldName(RNG(seed), q.B), lits: q.lits, look: q.look, t: 0, over: false, count: '', loot: { dust: 0, berries: {}, eggs: [] }, x: 0, y: 0, w: 1, h: 1 };
  scene = 'bonus'; ui.toast.classList.remove('on'); ui.barBonus.innerHTML = (D.bar || '') + '<button data-b="leave">Back to the quest</button>';
  layoutBonus(); D.start(BW); setSceneUI(); bonusHud(); sfx('gate');
  const [mx, my] = [VW / 2, BW.y + BW.h / 2]; burst(mx, my, 30, 290, { kind: 'star', v: 200, size: 6, life: 1 });
}
function layoutBonus() { if (!BW) return; BW.x = 0; BW.y = topIn + 6; BW.w = VW; BW.h = Math.max(120, VH - topIn - botIn - 12); if (BW.D.layout) BW.D.layout(BW); }
function bonusHud() {
  if (!BW) return; $('#q-name').textContent = BW.name; $('#q-biome').textContent = 'Bonus world'; $('#q-shards').textContent = BW.count;
  const r = $('#q-rule'); r.hidden = false; r.textContent = BW.D.name; $('#q-bag').hidden = true; $('#q-hint').textContent = BW.D.hint;
}
function bonusCount(txt) { if (BW && BW.count !== txt) { BW.count = txt; $('#q-shards').textContent = txt; } }
function bonusHint(txt) { $('#q-hint').textContent = txt; }
function openBonusRule() {
  if (!BW) return; const D = BW.D;
  openSheet('<h2>' + esc(D.name) + '</h2><p>' + esc(D.text) + '</p><p class="dim">This is a bonus world. Nothing can go wrong here. What you earn is added to what you have found on the quest.</p><div class="btns"><button class="btn main" data-do="ok">Got it</button></div>', { ok: closeSheet });
}
function drawBonus(dt) {
  const b = BW, c = ctx, g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, b.B.bg[0]); g.addColorStop(1, b.B.bg[1]); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  b.t += dt; b.D.draw(b, c, dt);
}
/* The world is over: finished, or left early with what was earned so far. The loot joins the quest's. */
function bonusEnd(early) {
  const b = BW; if (!b || b.over) return; b.over = true;
  const line = b.D.end(b, !!early), q = b.q, L = b.loot;
  q.loot.dust += L.dust; for (const k in L.berries) q.loot.berries[k] = (q.loot.berries[k] || 0) + L.berries[k]; q.loot.eggs.push(...L.eggs);
  S.j.bonus = S.j.bonus || {}; S.j.bonus[b.id] = (S.j.bonus[b.id] || 0) + 1; save(); if (!early) sfx('win');
  const berries = Object.entries(L.berries).map(([k, n]) => '<span><canvas data-ic="berry:' + k + '" data-size="26"></canvas>' + n + '</span>').join('');
  const eggs = L.eggs.length ? '<span><canvas data-ic="egg:' + L.eggs[0].hue + '" data-size="26"></canvas>' + L.eggs.length + (L.eggs.length > 1 ? ' eggs' : ' egg') + '</span>' : '';
  openSheet('<h2>' + esc(b.D.name) + '</h2><p>' + esc(line) + '</p><div class="loot"><span><canvas data-ic="shard" data-size="26"></canvas>' + L.dust + ' stardust</span>' + berries + eggs + '</div><p class="dim">It goes home with everything else you find in ' + esc(q.world.name) + '.</p><div class="btns"><button class="btn main" data-do="ok">Back to the quest</button></div>', { ok: closeSheet }, leaveBonus);
}
function leaveBonus() {
  const b = BW; if (!b) return; const q = b.q; BW = null; scene = 'quest'; $('#q-bag').hidden = false; q.bag = null;
  setSceneUI(); updateQuestHud(); updateQuestBar(); const [mx, my] = cellMid(q.px, q.py); burst(mx, my, 24, 290, { kind: 'star', v: 150, size: 5 }); toast('The secret door fades behind you.', 2600);
}
ui.barBonus.addEventListener('click', e => {
  const btn = e.target.closest('[data-b]'); if (!btn || !BW || BW.over) return; unlockAudio();
  if (btn.dataset.b === 'leave') bonusEnd(true); else if (BW.D.press) BW.D.press(BW, btn.dataset.b);
});
function bonusDown(pt) { if (BW && !BW.over && BW.D.down) BW.D.down(BW, pt); }
function bonusMove(pt) { if (BW && !BW.over && BW.D.move) BW.D.move(BW, pt); }
function bonusUp(pt, tap) { if (BW && !BW.over && BW.D.up) BW.D.up(BW, pt, tap); }
