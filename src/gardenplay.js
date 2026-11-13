/* ---------- play in the garden ----------
   When the Glimmerkin stands still for a moment, each little in the party wanders off to do something of its kind,
   and walking calls them back into line. Trees, the pond, a little, the bench and the bird bath answer a tap. It is
   all there to enjoy: it saves nothing, and the only thing it gives is a little Joy, at most once in 25 seconds. */
const PLAY = { AFTER: 3.5, GAP: 1.3, REACH: 7, SPEED: 2.6, JOY_GAP: 25 };
const PLAY_LINES = {
  swim: n => n + ' splashes about in the pond. Splash!',
  doze: n => n + ' opens one eye, then dozes off again.',
  warm: n => n + ' is warm and cosy by the lantern.',
  chase: n => n + ' leaps for a petal and misses. Again!',
  stack: n => n + ' shows off its pile of pebbles.',
  roll: n => n + ' rolls over in the grass and giggles.',
  shine: n => n + ' glows a little brighter.',
  hop: n => n + ' squeaks and hops for joy.'
};
const SHAKE_LINE = { spring: 'Blossom comes drifting down.', summer: 'Petals come drifting down.', autumn: 'Leaves come tumbling down.', winter: 'Snow slides off in soft clumps.' };
/* A little Joy for playing, at most once in 25 seconds. */
function playJoy() { const A = GA; if (!A || T - (A.playAt === undefined ? -99 : A.playAt) < PLAY.JOY_GAP) return; A.playAt = T; S.pet.joy = clamp(S.pet.joy + 1, 0, 100); }
/* Walkable tiles within a few steps of (sx, sy), nearest first, each with the way there. */
function playNear(sx, sy, ok) {
  const A = GA, M = A.M, prev = new Map(), k0 = sy * M.W + sx, q = [k0], dist = new Map([[k0, 0]]); prev.set(k0, -1);
  for (let i = 0; i < q.length; i++) {
    const k = q[i], x = k % M.W, y = (k - x) / M.W;
    if (ok(x, y)) { const p = []; for (let n = k; n !== -1; n = prev.get(n)) p.push({ x: n % M.W, y: (n - n % M.W) / M.W }); return p.reverse(); }
    if (dist.get(k) >= PLAY.REACH) continue;
    for (const [dx, dy] of DIRS) { const nk = (y + dy) * M.W + x + dx; if (!prev.has(nk) && groundsWalk(M, x + dx, y + dy) && !A.shut.has(nk)) { prev.set(nk, k); dist.set(nk, dist.get(k) + 1); q.push(nk); } }
  }
  return null;
}
const tileOf = f => ({ x: clamp(Math.round(f.x), 0, GA.M.W - 1), y: clamp(Math.round(f.y), 0, GA.M.H - 1) });
/* Whether the Glimmerkin or another little at play is already on tile (x, y), so that littles spread out. */
const playEnd = o => o.play.path.length ? o.play.path[o.play.path.length - 1] : tileOf(o);
const taken = (f, x, y) => (x === GA.at.x && y === GA.at.y) || GA.lits.some(o => o !== f && o.play && playEnd(o).x === x && playEnd(o).y === y);
/* The nearest free tile to stand on, with the way there. */
const freeSpot = f => { const at = tileOf(f); return playNear(at.x, at.y, (x, y) => !taken(f, x, y)) || [at]; };
const isPond = (x, y) => { const M = GA.M; return x >= 0 && y >= 0 && x < M.W && y < M.H && M.rows[y][x] === '~'; };
const pondBeside = (x, y) => DIRS.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).find(p => isPond(p.x, p.y));
/* What a little of kind el goes off to do from where it stands, or null if there is nothing of that kind near. */
function playFor(f, el) {
  const A = GA, M = A.M, at = tileOf(f), Z = here(), night = gardenIsNight();
  const thingAt = kind => (x, y) => Z.things[y * M.W + x] === kind && A.sit !== y * M.W + x && !A.lits.some(o => o !== f && o.play && o.play.k === y * M.W + x);
  if (el === 'tide') { const p = playNear(at.x, at.y, (x, y) => !!pondBeside(x, y) && !GA.lits.some(o => o !== f && o.play && o.play.kind === 'swim' && Math.abs(playEnd(o).x - x) + Math.abs(playEnd(o).y - y) <= 1)); if (p) { const w = p[p.length - 1], o = pondBeside(w.x, w.y); return { kind: 'swim', path: p.concat([o]), sx: o.x, sy: o.y }; } return null; }
  if (el === 'ember') {
    let p = playNear(at.x, at.y, thingAt('bench')); if (p) { const w = p[p.length - 1]; return { kind: 'doze', path: p, k: w.y * M.W + w.x, bench: true }; }
    if (night) { p = playNear(at.x, at.y, (x, y) => !taken(f, x, y) && DIRS.some(([dx, dy]) => Z.things[(y + dy) * M.W + x + dx] === 'lamp')); if (p) return { kind: 'warm', path: p }; }
    return { kind: 'doze', path: freeSpot(f) };
  }
  if (el === 'gale') return { kind: 'chase', path: freeSpot(f), spin: f.l.seed % 2 ? 1 : -1 };
  if (el === 'stone') return { kind: 'stack', path: freeSpot(f) };
  if (el === 'bloom') {
    const p = playNear(at.x, at.y, (x, y) => DIRS.some(([dx, dy]) => { const b = A.soilAt.get((y + dy) * M.W + x + dx); return b !== undefined && Z.beds[b] && Z.beds[b].st >= 3; }) && !taken(f, x, y));
    return { kind: 'roll', path: p || freeSpot(f) };
  }
  if (el === 'glow') return { kind: 'shine', path: freeSpot(f), night };
  return null;
}
function startPlay(f) {
  const ks = kindsOf(f.l), order = ks.length > 1 && f.l.seed % 2 ? [ks[1], ks[0]] : ks;
  let P = null; for (const el of order) { P = playFor(f, el); if (P) break; }
  if (!P) P = { kind: 'hop', path: freeSpot(f) };
  P.t = 0; P.path = P.path.slice(1); f.play = P;
}
/* Sends little f off to play now, as the tree or the pond calls it. */
function playNow(f, P) { P.t = 0; P.path = P.path.slice(1); f.play = P; f.busy = 0; }
/* Each frame: count how long the Glimmerkin has stood still, start the littles playing, and move them. */
function playTick(A, dt, moved) {
  if (moved || A.path.length || A.carry) { A.still = 0; if (moved || A.path.length) A.sit = undefined; A.lits.forEach(f => { f.play = null; }); }
  else if (ui.sheet.hidden) A.still = (A.still || 0) + dt;
  A.lits.forEach((f, i) => {
    if (!f.play && !(f.busy > 0) && A.still > PLAY.AFTER + i * PLAY.GAP) startPlay(f);
    const P = f.play; if (!P) return; P.t += dt;
    let left = dt * PLAY.SPEED; while (P.path.length && left > 0) { const n = P.path[0], dx = n.x - f.x, dy = n.y - f.y, d = Math.hypot(dx, dy); f.dx = dx; if (d <= left) { f.x = n.x; f.y = n.y; P.path.shift(); left -= d; } else { f.x += dx / d * left; f.y += dy / d * left; left = 0; } }
    if (!P.path.length && P.kind === 'chase' && P.t > (P.next || 0)) { const at = tileOf(f), opts = DIRS.map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy })).filter(p => groundsWalk(A.M, p.x, p.y) && !A.shut.has(p.y * A.M.W + p.x) && Math.abs(p.x - A.at.x) + Math.abs(p.y - A.at.y) <= 3); if (opts.length) P.path.push(opts[Math.floor((P.t * 7.3) % opts.length)]); P.next = P.t + 0.6; f.hop = 1; }
  });
}
/* How a little at play is drawn: where, in what mood, and what goes with it. */
function drawLit(c, A, f, X, Y, ts) {
  const P = f.play, arrived = P && !P.path.length, x = X(f.x + 0.5), y = Y(f.y + 0.8), s = ts * 0.62, look = { x: clamp((f.dx || 0) * 30, -0.6, 0.6) || A.face * 0.3, y: 0 };
  const base = { lift: Math.sin(f.hop * Math.PI) * ts * 0.4, mood: f.hop > 0 || f.busy > 0 ? 'happy' : 'idle', look };
  if (!P || !arrived) { drawCreature(c, f.L, x, y, s, T, base); return; }
  const k = P.kind, t = P.t, wob = REDUCED ? 0 : 1;
  if (k === 'swim') {
    const wy = Y(f.y + 0.55); c.save(); c.strokeStyle = 'rgba(235,250,255,.75)'; c.lineWidth = 1.6; for (let i = 0; i < 3; i++) { const u = REDUCED ? (i + 1) / 4 : (t * 0.5 + i / 3) % 1; c.globalAlpha = 1 - u; c.beginPath(); c.ellipse(x, wy, ts * (0.25 + u * 0.45), ts * (0.08 + u * 0.15), 0, 0, TAU); c.stroke(); } c.restore();
    c.save(); c.beginPath(); c.rect(0, 0, VW, wy); c.clip(); drawCreature(c, f.L, x, wy + s * 0.18 + Math.sin(t * 3) * ts * 0.02 * wob, s, T, { mood: 'happy', noShadow: true, look }); c.restore();
    if (!REDUCED && (t % 2.4) < 0.7) { const u = (t % 2.4) / 0.7; c.fillStyle = 'rgba(200,235,255,' + (1 - u) + ')'; for (const d of [-1, -0.4, 0.4, 1]) { c.beginPath(); c.ellipse(x + d * ts * 0.3 * (0.5 + u), wy - ts * 0.35 * Math.sin(u * Math.PI) - ts * 0.05, ts * 0.04, ts * 0.06, 0, 0, TAU); c.fill(); } }
    return;
  }
  if (k === 'doze') {
    drawCreature(c, f.L, x, y - (P.bench ? ts * 0.26 : 0), s * 0.95, T, { mood: 'sleep', still: true, look: { x: 0, y: 0 } });
    c.save(); c.fillStyle = 'rgba(255,255,255,.9)'; c.textAlign = 'center'; for (let i = 0; i < 2; i++) { const u = REDUCED ? 0.4 + i * 0.3 : (t * 0.4 + i / 2) % 1; c.globalAlpha = Math.sin(u * Math.PI); c.font = '700 ' + Math.round(ts * (0.16 + u * 0.1)) + 'px system-ui, sans-serif'; c.fillText('z', x + ts * (0.22 + u * 0.18), y - ts * (0.75 + u * 0.4) - (P.bench ? ts * 0.26 : 0)); } c.restore();
    return;
  }
  if (k === 'roll') { c.save(); c.translate(x, y); c.rotate(Math.sin(t * 3.2) * 0.45 * wob); drawCreature(c, f.L, 0, 0, s, T, { mood: 'happy', look }); c.restore(); if (!REDUCED && (t % 3) < 0.05) burst(x, y - ts * 0.5, 4, 330, { kind: 'heart', v: 50, size: 3 }); return; }
  if (k === 'stack') {
    const n = Math.min(3, 1 + Math.floor(t / 1.6)), px = x + ts * 0.36 * (f.l.seed % 2 ? 1 : -1);
    for (let i = 0; i < n; i++) { const r = ts * (0.11 - i * 0.025); c.fillStyle = hsl(250, 8, 58 + i * 8); c.strokeStyle = '#2a2440'; c.lineWidth = 1; c.beginPath(); c.ellipse(px, y - ts * 0.04 - i * ts * 0.12, r * 1.3, r * 0.75, 0, 0, TAU); c.fill(); c.stroke(); }
    drawCreature(c, f.L, x, y, s, T, { mood: n >= 3 ? 'happy' : 'idle', look: { x: (px - x) / ts * 1.2, y: 0.2 } });
    return;
  }
  if (k === 'chase') {
    drawCreature(c, f.L, x, y, s, T, Object.assign(base, { mood: 'happy' }));
    for (let i = 0; i < 4; i++) { const a = (REDUCED ? i : t * 2.1 * P.spin + i * 1.6), px = x + Math.cos(a) * ts * (0.5 + 0.1 * i), py = y - ts * (0.55 + 0.25 * Math.sin(a * 1.3 + i)); c.save(); c.translate(px, py); c.rotate(a); petalBit(c, ts, i); c.restore(); }
    return;
  }
  if (k === 'warm') { glow(c, x, y - ts * 0.3, ts * 0.8, 30, 100, 65, 0.3); drawCreature(c, f.L, x, y, s, T, { mood: 'happy', look }); return; }
  if (k === 'shine') {
    glow(c, x, y - ts * 0.3, ts * (0.8 + 0.1 * Math.sin(t * 2) * wob), 52, 100, 75, P.night ? 0.5 : 0.3);
    drawCreature(c, f.L, x, y, s, T, { mood: 'happy', lift: ts * (0.08 + 0.05 * Math.sin(t * 2) * wob), look });
    if (P.night) for (let i = 0; i < 5; i++) { const a = (REDUCED ? i * 1.25 : t * 1.3 + i * 1.25); glow(c, x + Math.cos(a) * ts * 0.55, y - ts * 0.45 + Math.sin(a * 1.7) * ts * 0.3, ts * 0.12, 60, 100, 72, 0.9); }
    return;
  }
  drawCreature(c, f.L, x, y, s, T, Object.assign(base, { mood: 'happy', lift: base.lift || Math.abs(Math.sin(t * 3)) * ts * 0.15 * wob }));
}
/* A petal, leaf or snowflake of the season. */
function petalBit(c, ts, i) {
  const sn = GA.season, r = ts * 0.06;
  if (sn === 'winter') { c.fillStyle = '#f4f8ff'; c.beginPath(); c.arc(0, 0, r * 0.8, 0, TAU); c.fill(); return; }
  c.fillStyle = sn === 'autumn' ? hsl(14 + i * 9, 85, 52) : sn === 'summer' ? (i % 2 ? '#fff6c8' : '#ffd6e6') : (i % 2 ? '#ffd0e4' : '#ffffff');
  c.beginPath(); c.ellipse(0, 0, r * 1.2, r * 0.65, 0, 0, TAU); c.fill();
}
/* Things shaken from a tree, and ripples on the pond, in garden tiles. */
function drawPlayFx(c, A, X, Y, ts, dt) {
  A.fall = (A.fall || []).filter(p => (p.t += dt) < p.life);
  for (const p of A.fall) { const u = p.t / p.life; c.save(); c.globalAlpha = Math.min(1, (1 - u) * 3); c.translate(X(p.x + p.vx * p.t + Math.sin(p.t * 3 + p.ph) * 0.12), Y(p.y + p.vy * p.t)); c.rotate(p.ph + p.t * 2); petalBit(c, ts, p.i); c.restore(); }
  A.rip = (A.rip || []).filter(r => (r.t += dt) < 1.6);
  c.save(); c.strokeStyle = 'rgba(235,250,255,.8)'; c.lineWidth = 1.6; for (const r of A.rip) for (let i = 0; i < 2; i++) { const u = clamp(r.t / 1.6 - i * 0.25, 0, 1); if (!u) continue; c.globalAlpha = 1 - u; c.beginPath(); c.ellipse(X(r.x + 0.5), Y(r.y + 0.55), ts * (0.1 + u * 0.5), ts * (0.04 + u * 0.18), 0, 0, TAU); c.stroke(); } c.restore();
}
/* The Glimmerkin has walked up to a tree and shakes it. A Gale little comes to chase what falls. */
function shakeTree(x, y) {
  const A = GA; if (x !== A.at.x) A.face = Math.sign(x - A.at.x); A.happy = 1.2; A.fall = A.fall || [];
  for (let i = 0; i < (REDUCED ? 6 : 14); i++) { const r = gdH(x * 3 + i, y * 5 + A.fall.length, 9); A.fall.push({ x: x + 0.15 + r * 0.7, y: y - 0.25 + gdH(i, x, 2) * 0.4, vx: (gdH(i, y, 5) - 0.5) * 0.5, vy: 0.45 + gdH(x, i, 7) * 0.4, ph: r * TAU, i, t: 0, life: 2 + r }); }
  sfx('gust'); playJoy(); save();
  const f = A.lits.find(o => kindsOf(o.l).includes('gale')); if (f) playNow(f, { kind: 'chase', path: [tileOf(f)].concat(playNear(tileOf(f).x, tileOf(f).y, (a, b) => Math.abs(a - x) + Math.abs(b - y) === 1) || []), spin: 1 });
  toast(S.pet.name + ' shakes the tree. ' + SHAKE_LINE[A.season] + (f ? ' ' + f.l.name + ' chases them.' : ''), 3600);
}
/* The Glimmerkin has walked up to the pond. Ripples spread, and a Tide little jumps in. */
function dipPond(x, y) {
  const A = GA; if (x !== A.at.x) A.face = Math.sign(x - A.at.x); A.rip = A.rip || []; A.rip.push({ x, y, t: 0 }); A.happy = 1; sfx('wave'); playJoy(); save();
  const f = A.lits.find(o => kindsOf(o.l).includes('tide') && !(o.play && o.play.kind === 'swim'));
  if (f) { const p = playNear(tileOf(f).x, tileOf(f).y, (a, b) => a === A.at.x && b === A.at.y) || [tileOf(f)]; playNow(f, { kind: 'swim', path: p.concat([{ x, y }]) }); }
  toast(f ? f.l.name + ' jumps in with a splash!' : S.pet.name + ' dips a toe in. Ripples spread across the pond.', 3400);
}
/* A tap on a little: it hops and says how it is getting on. */
function tapLittle(f) {
  const A = GA, V = gardenView(), x = (f.x + 0.5 - V.ox) * V.ts, y = V.top + (f.y + 0.3 - V.oy) * V.ts, P = f.play && !f.play.path.length ? f.play.kind : 'hop';
  if (P !== 'swim' && P !== 'doze') f.hop = 1; burst(x, y, 6, 330, { kind: 'heart', v: 60, size: 3 }); sfx('chirp'); playJoy(); save();
  toast(PLAY_LINES[P](f.l.name), 3000);
}
/* The little drawn under a tap, if any. Littles busy tending are left alone. */
function littleAt(pt) {
  const A = GA, V = gardenView(), ts = V.ts;
  return A.lits.filter(f => !(f.busy > 0)).map(f => ({ f, d: Math.hypot(pt.x - (f.x + 0.5 - V.ox) * ts, pt.y - (V.top + (f.y + 0.45 - V.oy) * ts)) })).filter(o => o.d < ts * 0.34).sort((a, b) => a.d - b.d).map(o => o.f)[0];
}
/* Sitting on the bench, and splashing in the bird bath, from their sheets. */
function sitDown(k) { const A = GA; A.sit = k; A.still = 0; A.happy = 1.6; sfx('purr'); playJoy(); save(); toast(S.pet.name + ' sits on the bench for a rest.', 3000); }
function splashBath(k) {
  const A = GA, M = A.M, x = k % M.W, y = (k - x) / M.W, V = gardenView(); burst((x + 0.5 - V.ox) * V.ts, V.top + (y + 0.3 - V.oy) * V.ts, 14, 198, { v: 110, size: 3 }); A.happy = 1.4; sfx('wave'); playJoy(); save();
  const f = A.lits.find(o => kindsOf(o.l).includes('tide')); if (f) f.hop = 1;
  toast('Splash! ' + S.pet.name + ' flicks water everywhere' + (f ? ', and ' + f.l.name + ' squeals with delight.' : '.'), 3200);
}
