/* ===== Bonus world: Starweave. Join the stars of a little's outline in one unbroken thread ===== */
const WEAVE_DUST = 12, WEAVE_NEAR = 26;   // stardust for a finished constellation; how near a finger must come to a star, in px
BONUS.starweave = {
  name: 'Starweave',
  line: 'Join the bright stars in one line, and a constellation of one of your littles wakes.',
  hint: 'Drag from star to star. The thread only stretches to a nearby star, and cannot cross itself.',
  text: 'The bright stars mark the outline of one of your littles. Start on any star and drag from one to the next until every star is on the thread. The thread only stretches as far as a nearby star: the ones it can reach from where it is have a ring round them. It cannot cross itself. Lift your finger whenever you like; the thread stays. Tap a star already on the thread to rub the thread back to it, or use Start again. The finished constellation shines over the nest at night.',
  bar: '<button data-b="again">Start again</button>',
  start(b) {
    const f = b.lits[b.seed % b.lits.length]; b.f = f; b.g = weaveStars(b.seed, f.L); b.path = []; b.drawing = false; b.finger = null; b.won = 0; b.no = null; b.undos = 0; this.layout(b);
  },
  layout(b) { const g = b.g; if (!g) return; const ys = g.pts.map(p => p.y), xs = g.pts.map(p => p.x), hi = Math.max(...ys) - Math.min(...ys), wd = Math.max(...xs) - Math.min(...xs); b.sc = Math.min(b.w * 0.74 / wd, b.h * 0.7 / hi); b.cx = b.x + b.w / 2; b.cy = b.y + b.h * 0.5 - (Math.max(...ys) + Math.min(...ys)) / 2 * b.sc; },
  at(b, k) { const p = b.g.pts[k]; return { x: b.cx + p.x * b.sc, y: b.cy + p.y * b.sc }; },
  near(b, pt, r) { let best = -1, bd = r; b.g.pts.forEach((_, k) => { const s = this.at(b, k), d = Math.hypot(pt.x - s.x, pt.y - s.y); if (d < bd) { bd = d; best = k; } }); return best; },
  /* Take the thread on to star k if it can go there; say why when it cannot. */
  reachFor(b, k) {
    const g = b.g, path = b.path;
    if (weaveCan(g, path, k)) {
      path.push(k); b.no = null; const s = this.at(b, k); burst(s.x, s.y, 8, 46, { kind: 'star', v: 80, size: 4 }); sfx('note', CHIME_NOTES[(path.length - 1) % CHIME_NOTES.length]);
      if (path.length === g.pts.length) { b.won = T; b.drawing = false; sfx('win'); bonusHint('The last star joins the first. ' + b.f.l.name + ' shines in the stars.'); }
      else if (!g.pts.some((_, j) => weaveCan(g, path, j))) bonusHint('No star is in reach from here. Tap an earlier star on the thread to rub it back, and try another way.');
      else bonusHint(BONUS.starweave.hint);
      return true;
    }
    if (!path.includes(k) && (!b.no || b.no.k !== k)) { const a = g.pts[path[path.length - 1]], p = g.pts[k], far = Math.hypot(a.x - p.x, a.y - p.y) > g.reach; b.no = { k, t: T }; sfx('no'); bonusHint(far ? 'That star is too far for the thread. Go by a nearer one.' : 'The thread would cross itself there.'); }
    return false;
  },
  down(b, pt) {
    if (b.won) return; const k = this.near(b, pt, WEAVE_NEAR * 1.5), path = b.path; b.finger = pt; if (k < 0) { b.drawing = path.length > 0 && Math.hypot(pt.x - this.at(b, path[path.length - 1]).x, pt.y - this.at(b, path[path.length - 1]).y) < WEAVE_NEAR * 2.5; return; }
    const i = path.indexOf(k);
    if (i >= 0 && i < path.length - 1) { path.length = i + 1; b.undos++; sfx('step'); bonusHint(BONUS.starweave.hint); }   // rub the thread back to this star
    else if (i < 0) this.reachFor(b, k);
    b.drawing = !b.won;
  },
  move(b, pt) { if (b.won) return; b.finger = pt; if (!b.drawing || !b.path.length) return; const k = this.near(b, pt, WEAVE_NEAR); if (k >= 0 && k !== b.path[b.path.length - 1]) this.reachFor(b, k); },
  up(b) { b.drawing = false; b.finger = null; b.no = null; },
  press(b, what) { if (what === 'again' && !b.won) { b.path = []; b.drawing = false; sfx('step'); bonusHint(BONUS.starweave.hint); } },
  draw(b, c, dt) {
    const g = b.g, path = b.path, n = g.pts.length, rs = RNG(b.seed);
    for (let i = 0; i < (REDUCED ? 50 : 120); i++) { const x = rs.f() * VW, y = rs.f() * VH, a = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(T * (1 + rs.f() * 2) + i)); c.fillStyle = 'rgba(255,248,225,' + a.toFixed(2) + ')'; c.fillRect(x, y, 1.5, 1.5); }
    if (b.won) { const a = clamp((T - b.won) / 1.6, 0, 1), base = Math.max(...g.pts.map(p => p.y)); c.save(); c.globalAlpha = a * 0.6; glow(c, b.cx, b.cy, b.sc * 1.2, 48, 100, 70, 0.4); drawCreature(c, b.f.L, b.cx, b.cy + base * b.sc + (b.f.L.float || 0) * b.sc * 0.6, b.sc / (b.f.L.grown ? 1.12 : 1), 0, { noShadow: true, still: true, mood: 'happy' }); c.restore(); }
    // the thread
    if (path.length) {
      c.save(); c.strokeStyle = 'rgba(255,207,107,.92)'; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = 'rgba(255,207,107,.8)'; c.shadowBlur = 10; c.beginPath();
      path.forEach((k, i) => { const s = this.at(b, k); i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y); }); if (b.won) c.closePath(); c.stroke();
      if (b.drawing && b.finger && !b.won) { const s = this.at(b, path[path.length - 1]); c.globalAlpha = 0.5; c.lineWidth = 1.6; c.setLineDash([4, 5]); c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(b.finger.x, b.finger.y); c.stroke(); }
      c.restore();
    }
    g.pts.forEach((p, k) => {
      const s = this.at(b, k), on = path.includes(k), last = path[path.length - 1] === k, can = !b.won && !on && path.length && weaveCan(g, path, k), r = on ? 7 : 5.5;
      glow(c, s.x, s.y, on ? 20 : 14, 48, 100, 75, on ? 0.8 : 0.45); c.fillStyle = on ? '#fff3c4' : '#d8d0ff'; starPath(c, s.x, s.y, r, r * 0.38, 4, T * 0.3 + k); c.fill();
      if (can) { c.strokeStyle = 'rgba(134,232,200,' + (0.55 + 0.3 * Math.sin(T * 4 + k)) + ')'; c.lineWidth = 1.5; c.beginPath(); c.arc(s.x, s.y, 13, 0, TAU); c.stroke(); }
      if (last && !b.won) { c.strokeStyle = 'rgba(255,233,160,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(s.x, s.y, 11 + Math.sin(T * 5) * 2, 0, TAU); c.stroke(); }
      if (b.no && b.no.k === k && T - b.no.t < 0.6) { c.strokeStyle = 'rgba(255,143,179,' + (1 - (T - b.no.t) / 0.6) + ')'; c.lineWidth = 2.5; c.beginPath(); c.arc(s.x, s.y, 15, 0, TAU); c.stroke(); }
    });
    if (!path.length) { c.font = '800 13px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(239,234,252,.85)'; c.fillText('Start on any star', b.cx, b.y + b.h - 16); }
    bonusCount('Stars ' + path.length + ' of ' + n);
    if (b.won && T - b.won > 3 / bonusSpeed()) bonusEnd(false);
  },
  end(b, early) {
    const l = b.f.l;
    if (early || !b.won) { b.loot.dust = Math.floor(b.path.length / 3); return 'You head back with the thread unfinished. The stars will wait for another night.'; }
    b.loot.dust = WEAVE_DUST;
    if (S.sky.some(k => k.id === l.id)) return l.name + '\'s constellation already shines over the nest. Tonight it shines a little brighter.';
    S.sky.push(Object.assign({ id: l.id, kind: l.kind, seed: l.seed, name: l.name, ws: b.seed }, l.kind2 ? { kind2: l.kind2 } : {}));
    return l.name + '\'s constellation is yours to keep. Look for it in the sky over the nest at night.';
  }
};
/* The constellations a player has kept, small and faint in the night sky over the nest. */
const skyShapes = new Map();
function drawSkyKept(c, nf) {
  S.sky.forEach((k, i) => {
    let g = skyShapes.get(k.id + ':' + k.ws); if (!g) { g = weaveStars(k.ws, lookFor(k.kind, k.seed, k.kind2)); skyShapes.set(k.id + ':' + k.ws, g); }
    const s = 26, x = VW * (0.34 + (i % 3) * 0.16), y = topIn + 50 + Math.floor(i / 3) * 58 + (i % 2) * 10,   // between the balloon and the moon
    tw = 0.75 + 0.25 * Math.sin(T * 0.8 + i * 2);
    c.strokeStyle = 'rgba(255,233,170,' + (0.45 * nf * tw).toFixed(3) + ')'; c.lineWidth = 1; c.beginPath(); g.pts.forEach((p, j) => { j ? c.lineTo(x + p.x * s, y + p.y * s) : c.moveTo(x + p.x * s, y + p.y * s); }); c.closePath(); c.stroke();
    c.fillStyle = 'rgba(255,246,215,' + (0.9 * nf * tw).toFixed(3) + ')'; for (const p of g.pts) { c.beginPath(); c.arc(x + p.x * s, y + p.y * s, 1.5, 0, TAU); c.fill(); }
  });
}
