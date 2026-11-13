/* ---------- visitors ----------
   Small creatures come to the garden, drawn by what is in bloom, what is set down, the pond, the trees, the hour,
   the season and the quarter. Who comes is rolled once an hour for each quarter, so leaving and coming back finds
   the same visitors. A tap on one walks up to it and watches it; the first time, it goes in the visitor book
   (`garden.seen`, by visitor, how many times each has been watched). They give nothing but a little Joy, as play does. */
const VISITORS = [
  { id: 'flamemoth', name: 'Flame moth', body: 'wing', h: 16, h2: 44, at: 'bloom', el: 'ember', day: 1, line: 'It warms its wings on the Ember flower.' },
  { id: 'dewdrop', name: 'Dewdrop butterfly', body: 'wing', h: 200, h2: 180, at: 'bloom', el: 'tide', day: 1, line: 'It sips the dew from the Tide flower.' },
  { id: 'pebblebeetle', name: 'Pebble beetle', body: 'bug', h: 250, h2: 230, spots: 0, at: 'bloom', el: 'stone', day: 1, line: 'Its shell is as smooth as a river stone.' },
  { id: 'bumblebee', name: 'Bumblebee', body: 'bug', h: 46, h2: 0, stripes: 1, at: 'bloom', el: 'bloom', day: 1, line: 'It buzzes from petal to petal.' },
  { id: 'breezefly', name: 'Breezefly', body: 'fly', h: 150, at: 'bloom', el: 'gale', day: 1, line: 'It hangs in the air, then darts away on the breeze.' },
  { id: 'lanternmoth', name: 'Lantern moth', body: 'wing', h: 52, h2: 60, glows: 1, at: 'bloom', el: 'glow', day: 0, line: 'It comes to the lilies after dark, glowing softly.' },
  { id: 'patchwing', name: 'Patchwing', body: 'wing', h: 300, h2: 90, at: 'cross', day: 1, rare: 1, line: 'Each wing is a different colour, like the crossed flower it loves.' },
  { id: 'glimmerwing', name: 'Glimmerwing', body: 'wing', h: 48, h2: 320, glows: 1, at: 'glim', rare: 1, line: 'It only comes to a flower that glimmers.' },
  { id: 'rainbow', name: 'Rainbow butterfly', body: 'wing', h: 0, h2: 200, rainbow: 1, at: 'six', day: 1, rare: 1, line: 'It comes only when all six kinds of flower bloom in one quarter.' },
  { id: 'robin', name: 'Robin', body: 'bird', h: 22, h2: 28, at: 'bath', day: 1, line: 'It splashes in the bird bath and shakes itself dry.' },
  { id: 'hedgehog', name: 'Hedgehog', body: 'critter', h: 30, spines: 1, at: 'bench', line: 'It snuffles about under the bench.' },
  { id: 'lampmoths', name: 'Lamp moths', body: 'wing', h: 40, h2: 45, many: 1, at: 'lamp', day: 0, line: 'They dance round the lantern post.' },
  { id: 'frog', name: 'Pond frog', body: 'frog', h: 118, at: 'pond', day: 1, line: 'It sits on a lily pad and says nothing at all.' },
  { id: 'duckling', name: 'Duckling', body: 'bird', h: 52, h2: 30, swims: 1, at: 'pond', rare: 1, line: 'It paddles round and round the pond.' },
  { id: 'owl', name: 'Little owl', body: 'bird', h: 32, h2: 40, owl: 1, at: 'tree', day: 0, line: 'It blinks down from the tree. Hoo.' },
  { id: 'ladybird', name: 'Ladybird', body: 'bug', h: 2, h2: 0, spots: 1, at: 'grass', season: 'spring', day: 1, line: 'It is out in the spring sunshine.' },
  { id: 'grasshopper', name: 'Grasshopper', body: 'critter', h: 95, legs: 1, at: 'grass', season: 'summer', day: 1, line: 'It chirps in the long summer grass.' },
  { id: 'squirrel', name: 'Squirrel', body: 'critter', h: 22, tail: 1, ears: 1, at: 'tree', season: 'autumn', day: 1, line: 'It is burying something for the winter.' },
  { id: 'snowbunny', name: 'Snow bunny', body: 'critter', h: 220, pale: 1, ears: 2, at: 'grass', season: 'winter', line: 'It leaves tiny tracks in the snow.' },
  { id: 'salamander', name: 'Ember salamander', body: 'critter', h: 14, tail: 2, at: 'grass', q: 1, line: 'It is warm to the touch, like a coal.' },
  { id: 'shellcrab', name: 'Shell crab', body: 'crab', h: 350, at: 'grass', q: 2, line: 'It scuttles sideways in its borrowed shell.' },
  { id: 'skyfinch', name: 'Sky finch', body: 'bird', h: 205, h2: 50, at: 'grass', q: 3, line: 'It sings a high, sweet song.' },
  { id: 'glassmoth', name: 'Glass moth', body: 'wing', h: 268, h2: 210, glass: 1, at: 'grass', q: 4, line: 'You can see right through its wings.' },
  { id: 'rocklizard', name: 'Rock lizard', body: 'critter', h: 36, tail: 2, grey: 1, at: 'grass', q: 5, line: 'It suns itself on a warm stone.' }
];
const VISIT = { MAX: 5, COMMON: 0.7, RARE: 0.3, HOUR: 3600000 };
const visitorById = id => VISITORS.find(v => v.id === id);
/* Where each visitor could be in quarter q right now: tiles of the garden map, as {x, y}. */
function visitAnchors(v, A) {
  const M = A.M, Z = here(), night = A.night > 0.5, out = [], open = (x, y) => !A.shut.has(y * M.W + x);
  if (v.day === 1 && night || v.day === 0 && !night) return out;
  if (v.season && v.season !== A.season) return out;
  if (v.q !== undefined && v.q !== A.q) return out;
  const blooms = Object.entries(Z.beds).filter(([i, b]) => b.st >= 3 && M.soils[i] && open(M.soils[i].x, M.soils[i].y)).map(([i, b]) => ({ b, s: M.soils[i] }));
  if (v.at === 'bloom') return blooms.filter(o => FLOWERS[o.b.el].a === v.el || FLOWERS[o.b.el].b === v.el).map(o => ({ x: o.s.x, y: o.s.y }));
  if (v.at === 'cross') return blooms.filter(o => isCross(o.b.el)).map(o => ({ x: o.s.x, y: o.s.y }));
  if (v.at === 'glim') return blooms.filter(o => o.b.gl).map(o => ({ x: o.s.x, y: o.s.y }));
  if (v.at === 'six') return ELS.every(el => blooms.some(o => o.b.el === el)) ? blooms.map(o => ({ x: o.s.x, y: o.s.y })) : out;
  if (v.at === 'bath' || v.at === 'bench' || v.at === 'lamp') return Object.keys(Z.things).filter(k => Z.things[k] === v.at).map(k => ({ x: k % M.W, y: (k - k % M.W) / M.W }));
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
    const ch = M.rows[y][x]; if (!open(x, y)) continue;
    if (v.at === 'pond' && ch === '~') out.push({ x, y });
    else if (v.at === 'tree' && ch === 'T') out.push({ x, y });
    else if (v.at === 'grass' && ch === '.' && !Z.things[y * M.W + x] && !(x === M.start.x && y === M.start.y)) out.push({ x, y });
  }
  return out;
}
/* Who has come to the quarter being walked: rolled from the hour, the quarter and the garden, so it stays the same
   for the hour. */
function rollVisitors(A, now) {
  const r = RNG((gardenSeed() ^ Math.imul(Math.floor((now || Date.now()) / VISIT.HOUR) + 1, 2654435761) ^ (A.q + 1) * 40503) >>> 0), out = [], taken = new Set();
  for (const v of VISITORS) {
    const roll = r.f(), pick = r.f(); const can = visitAnchors(v, A).filter(p => !taken.has(p.y * A.M.W + p.x)); if (!can.length || roll > (v.rare ? VISIT.RARE : VISIT.COMMON)) continue;
    const p = can[Math.floor(pick * can.length)]; taken.add(p.y * A.M.W + p.x); out.push({ v, x: p.x, y: p.y, ph: pick * TAU, t: 0, watch: 0 });
  }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r.f() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out.slice(0, VISIT.MAX);
}
/* Where a visitor is drawn, in garden tiles, with the hover of a flyer. */
function visitorAt(o) {
  const v = o.v, t = REDUCED ? 0 : o.t, fly = v.body === 'wing' || v.body === 'fly' || (v.body === 'bug' && v.stripes), at = v.at;
  if (o.watch > 0 && GA) return { x: GA.px + 0.5 + Math.sin(t * 2) * 0.05, y: GA.py - 0.15 };
  let x = o.x + 0.5, y = o.y + 0.5;
  if (at === 'bloom' || at === 'cross' || at === 'glim' || at === 'six') y = o.y - 0.12;
  else if (at === 'bath') y = o.y + 0.28; else if (at === 'lamp') y = o.y - 0.35; else if (at === 'bench') { x += 0.36; y = o.y + 0.86; }
  else if (at === 'pond') y = o.y + 0.62; else if (at === 'tree') { if (v.owl) y = o.y + 0.1; else { x += 0.28; y = o.y + 0.86; } } else y = o.y + 0.8;
  if (fly) { x += Math.sin(t * 0.9 + o.ph) * 0.22; y += Math.sin(t * 1.4 + o.ph) * 0.1; }
  else if (v.swims) x += Math.sin(t * 0.5 + o.ph) * 0.25;
  return { x, y };
}
/* Each frame: move the visitors on and draw them over the garden. A visitor not yet in the book twinkles. */
function drawVisitors(c, A, X, Y, ts, dt) {
  const g = ensureGarden();
  for (const o of A.vis || []) {
    o.t += dt; if (o.watch > 0) o.watch -= dt;
    const p = visitorAt(o), x = X(p.x), y = Y(p.y), s = ts * (o.watch > 0 ? 0.56 : 0.48);
    drawVisitor(c, o.v, x, y, s, o.t, A.night);
    if (!g.seen[o.v.id]) { const u = REDUCED ? 0.5 : (o.t * 0.7) % 1; c.fillStyle = 'rgba(255,248,200,' + Math.sin(u * Math.PI) + ')'; starPath(c, x + s * 0.7, y - s * 0.8, s * 0.22, s * 0.08, 4, 0); c.fill(); }
  }
}
/* One visitor, drawn in code. x, y is where it sits or hovers; s is its size. An icon is still, single and unlit. */
function drawVisitor(c, v, x, y, s, t, night, icon) {
  const flap = icon ? 1 : REDUCED ? 0.75 : 0.45 + Math.abs(Math.sin(t * 9 + v.h)) * 0.55, ink = '#2a2440', lw = Math.max(1, s * 0.05);
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = ink; c.lineWidth = lw;
  const n = v.many && !icon ? 3 : 1;
  for (let m = 0; m < n; m++) {
    const mx = v.many && !icon ? x + Math.cos(t * 2 + m * 2.1) * s * 1.1 : x, my = v.many && !icon ? y + Math.sin(t * 2.6 + m * 2.1) * s * 0.7 : y, ms = v.many && !icon ? s * 0.6 : s;
    if (v.body === 'wing') {
      if (v.glows && !icon) glow(c, mx, my, ms * 1.6, v.h, 100, 70, night ? 0.6 : 0.35);
      for (const sd of [-1, 1]) {
        const top = v.rainbow ? hsl((t * 60 + (sd > 0 ? 0 : 120)) % 360, 85, 62) : hsl(sd > 0 && v.h2 !== undefined && v.id === 'patchwing' ? v.h2 : v.h, 85, 62), low = v.rainbow ? hsl((t * 60 + 240) % 360, 85, 70) : hsl(v.h2, 85, 76);
        c.globalAlpha = v.glass ? 0.45 : 1; c.fillStyle = top; c.beginPath(); c.ellipse(mx + sd * ms * 0.34 * flap, my - ms * 0.14, ms * 0.36 * flap, ms * 0.27, sd * 0.5, 0, TAU); c.fill(); c.globalAlpha = 1; c.stroke();
        c.globalAlpha = v.glass ? 0.45 : 1; c.fillStyle = low; c.beginPath(); c.ellipse(mx + sd * ms * 0.24 * flap, my + ms * 0.17, ms * 0.22 * flap, ms * 0.17, -sd * 0.5, 0, TAU); c.fill(); c.globalAlpha = 1; c.stroke();
      }
      c.fillStyle = ink; c.beginPath(); c.ellipse(mx, my, ms * 0.07, ms * 0.3, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(mx, my - ms * 0.28); c.lineTo(mx - ms * 0.13, my - ms * 0.5); c.moveTo(mx, my - ms * 0.28); c.lineTo(mx + ms * 0.13, my - ms * 0.5); c.stroke();
    } else if (v.body === 'fly') {
      c.fillStyle = 'rgba(230,250,255,.7)'; for (const sd of [-1, 1]) for (const k of [0, 1]) { c.beginPath(); c.ellipse(mx + sd * ms * 0.4, my - ms * 0.1 + k * ms * 0.18, ms * 0.4 * flap, ms * 0.09, sd * (k ? -0.2 : 0.2), 0, TAU); c.fill(); c.stroke(); }
      c.fillStyle = hsl(v.h, 70, 50); c.beginPath(); c.ellipse(mx, my + ms * 0.15, ms * 0.07, ms * 0.48, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(mx, my - ms * 0.3, ms * 0.12, 0, TAU); c.fill(); c.stroke();
    } else if (v.body === 'bug') {
      if (v.stripes) { c.fillStyle = 'rgba(255,255,255,.8)'; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(mx + sd * ms * 0.14, my - ms * 0.3, ms * 0.17 * flap + 0.5, ms * 0.24, sd * 0.4, 0, TAU); c.fill(); c.stroke(); } }
      c.fillStyle = hsl(v.h, v.id === 'pebblebeetle' ? 12 : 90, v.id === 'pebblebeetle' ? 60 : 55); c.beginPath(); c.ellipse(mx, my, ms * 0.36, ms * 0.26, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = ink; if (v.stripes) for (const bx of [-0.1, 0.1]) c.fillRect(mx + bx * ms - ms * 0.04, my - ms * 0.24, ms * 0.08, ms * 0.48);
      if (v.spots) { c.beginPath(); c.moveTo(mx, my - ms * 0.26); c.lineTo(mx, my + ms * 0.26); c.stroke(); for (const [dx, dy] of [[-0.16, -0.06], [0.16, -0.06], [-0.12, 0.12], [0.12, 0.12]]) { c.beginPath(); c.arc(mx + dx * ms, my + dy * ms, ms * 0.05, 0, TAU); c.fill(); } }
      if (!v.stripes && !v.spots) { c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(mx - ms * 0.1, my - ms * 0.08, ms * 0.14, ms * 0.07, -0.3, 0, TAU); c.fill(); }
      c.fillStyle = ink; c.beginPath(); c.arc(mx + ms * 0.34, my - ms * 0.02, ms * 0.1, 0, TAU); c.fill();
    } else if (v.body === 'bird') {
      const bob = REDUCED ? 0 : Math.sin(t * 3) * ms * 0.03, by = my + bob;
      if (v.swims) { c.strokeStyle = 'rgba(235,250,255,.7)'; c.beginPath(); c.ellipse(mx, by + ms * 0.14, ms * 0.5, ms * 0.12, 0, 0, TAU); c.stroke(); c.strokeStyle = ink; }
      c.fillStyle = hsl(v.h, v.owl ? 30 : 60, v.owl ? 45 : 56); c.beginPath(); c.ellipse(mx, by, ms * (v.owl ? 0.3 : 0.32), ms * (v.owl ? 0.36 : 0.24), 0, 0, TAU); c.fill(); c.stroke();
      if (v.owl) { for (const sd of [-1, 1]) { c.fillStyle = '#fff4d0'; c.beginPath(); c.arc(mx + sd * ms * 0.12, by - ms * 0.12, ms * 0.11, 0, TAU); c.fill(); c.stroke(); c.fillStyle = ink; const blink = !REDUCED && (t % 4) < 0.15; if (blink) { c.beginPath(); c.moveTo(mx + sd * ms * 0.12 - ms * 0.08, by - ms * 0.12); c.lineTo(mx + sd * ms * 0.12 + ms * 0.08, by - ms * 0.12); c.stroke(); } else { c.beginPath(); c.arc(mx + sd * ms * 0.12, by - ms * 0.12, ms * 0.05, 0, TAU); c.fill(); } } c.fillStyle = '#f0a030'; c.beginPath(); c.moveTo(mx - ms * 0.04, by - ms * 0.02); c.lineTo(mx + ms * 0.04, by - ms * 0.02); c.lineTo(mx, by + ms * 0.06); c.fill(); for (const sd of [-1, 1]) { c.fillStyle = hsl(v.h, 30, 40); c.beginPath(); c.moveTo(mx + sd * ms * 0.2, by - ms * 0.3); c.lineTo(mx + sd * ms * 0.26, by - ms * 0.46); c.lineTo(mx + sd * ms * 0.08, by - ms * 0.33); c.fill(); } }
      else {
        c.fillStyle = hsl(v.h2, 80, 72); c.beginPath(); c.ellipse(mx + ms * 0.06, by + ms * 0.06, ms * 0.16, ms * 0.12, 0, 0, TAU); c.fill();
        c.fillStyle = hsl(v.h, 60, 56); c.beginPath(); c.arc(mx + ms * 0.24, by - ms * 0.18, ms * 0.16, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#f0a030'; c.beginPath(); c.moveTo(mx + ms * 0.38, by - ms * 0.2); c.lineTo(mx + ms * 0.52, by - ms * 0.15); c.lineTo(mx + ms * 0.38, by - ms * 0.11); c.fill();
        c.fillStyle = ink; c.beginPath(); c.arc(mx + ms * 0.28, by - ms * 0.21, ms * 0.035, 0, TAU); c.fill();
        c.fillStyle = hsl(v.h, 45, 40); c.beginPath(); c.moveTo(mx - ms * 0.24, by - ms * 0.04); c.lineTo(mx - ms * 0.5, by - ms * 0.2); c.lineTo(mx - ms * 0.44, by + ms * 0.04); c.fill();
      }
    } else if (v.body === 'frog') {
      c.fillStyle = '#3f8f4a'; c.beginPath(); c.moveTo(mx, my); c.ellipse(mx, my, ms * 0.62, ms * 0.24, 0, 0.3, TAU - 0.1); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = hsl(v.h, 45, 52); c.beginPath(); c.ellipse(mx, my - ms * 0.14, ms * 0.34, ms * 0.22, 0, 0, TAU); c.fill(); c.stroke();
      for (const sd of [-1, 1]) { c.fillStyle = hsl(v.h, 45, 60); c.beginPath(); c.arc(mx + sd * ms * 0.16, my - ms * 0.34, ms * 0.1, 0, TAU); c.fill(); c.stroke(); c.fillStyle = ink; c.beginPath(); c.arc(mx + sd * ms * 0.16, my - ms * 0.34, ms * 0.04, 0, TAU); c.fill(); }
    } else if (v.body === 'crab') {
      const sx = REDUCED ? 0 : Math.sin(t * 2) * ms * 0.15; c.fillStyle = hsl(30, 40, 75); c.beginPath(); c.arc(mx + sx, my - ms * 0.22, ms * 0.26, Math.PI, TAU); c.fill(); c.stroke();
      c.fillStyle = hsl(v.h, 70, 55); c.beginPath(); c.ellipse(mx + sx, my - ms * 0.06, ms * 0.3, ms * 0.14, 0, 0, TAU); c.fill(); c.stroke(); for (const sd of [-1, 1]) { c.beginPath(); c.arc(mx + sx + sd * ms * 0.38, my - ms * 0.12, ms * 0.09, 0, TAU); c.fill(); c.stroke(); }
    } else {   // a creature on four legs: hedgehog, grasshopper, squirrel, snow bunny, salamander, lizard
      const col = v.pale ? '#f2f4fb' : v.grey ? hsl(v.h, 12, 58) : hsl(v.h, v.legs ? 55 : 60, v.legs ? 50 : 52), hop = !REDUCED && (v.ears === 2 || v.legs) ? Math.abs(Math.sin(t * 2.4)) * ms * 0.12 : 0, by = my - hop;
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(mx, my + ms * 0.02, ms * 0.36, ms * 0.08, 0, 0, TAU); c.fill();
      if (v.tail === 1) { c.fillStyle = col; c.beginPath(); c.ellipse(mx - ms * 0.34, by - ms * 0.36, ms * 0.16, ms * 0.3, -0.3, 0, TAU); c.fill(); c.stroke(); }
      if (v.tail === 2) { c.strokeStyle = col; c.lineWidth = ms * 0.1; c.beginPath(); c.moveTo(mx - ms * 0.2, by - ms * 0.1); c.quadraticCurveTo(mx - ms * 0.55, by - ms * 0.05, mx - ms * 0.6, by - ms * 0.25); c.stroke(); c.strokeStyle = ink; c.lineWidth = lw; }
      if (v.spines) { c.fillStyle = hsl(v.h, 35, 32); c.beginPath(); for (let i = 0; i <= 8; i++) { const a = Math.PI + i * Math.PI / 8, r = i % 2 ? ms * 0.3 : ms * 0.42; c.lineTo(mx - ms * 0.04 + Math.cos(a) * r * 1.1, by - ms * 0.12 + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); }
      c.fillStyle = col; c.beginPath(); c.ellipse(mx, by - ms * 0.14, ms * (v.legs ? 0.34 : v.tail === 2 ? 0.3 : 0.26), ms * (v.legs || v.tail === 2 ? 0.11 : 0.17), 0, 0, TAU); c.fill(); c.stroke();
      if (v.legs) { c.strokeStyle = col; c.lineWidth = ms * 0.06; c.beginPath(); c.moveTo(mx - ms * 0.1, by - ms * 0.14); c.lineTo(mx - ms * 0.22, by - ms * 0.4); c.lineTo(mx - ms * 0.34, by - ms * 0.02); c.stroke(); c.strokeStyle = ink; c.lineWidth = lw; }
      c.fillStyle = col; c.beginPath(); c.arc(mx + ms * 0.26, by - ms * 0.22, ms * 0.13, 0, TAU); c.fill(); c.stroke();
      if (v.ears) for (const dx of [0.2, 0.3]) { c.fillStyle = col; c.beginPath(); c.ellipse(mx + dx * ms, by - ms * (v.ears === 2 ? 0.46 : 0.36), ms * 0.045, ms * (v.ears === 2 ? 0.14 : 0.07), 0.2, 0, TAU); c.fill(); c.stroke(); }
      c.fillStyle = ink; c.beginPath(); c.arc(mx + ms * 0.3, by - ms * 0.24, ms * 0.03, 0, TAU); c.fill();
      if (v.id === 'squirrel') { c.fillStyle = '#8a5a2b'; c.beginPath(); c.arc(mx + ms * 0.38, by - ms * 0.08, ms * 0.07, 0, TAU); c.fill(); c.stroke(); }
    }
  }
  c.restore();
}
/* The visitor drawn under a tap, if any. */
function visitorTapAt(pt) {
  const A = GA, V = gardenView(), ts = V.ts;
  return (A.vis || []).filter(o => !(o.watch > 0)).map(o => { const p = visitorAt(o); return { o, d: Math.hypot(pt.x - (p.x - V.ox) * ts, pt.y - (V.top + (p.y - V.oy) * ts)) }; }).filter(o => o.d < ts * 0.36).sort((a, b) => a.d - b.d).map(o => o.o)[0];
}
function visitWalk(o) {
  const A = GA, near = (a, b) => Math.abs(a - o.x) + Math.abs(b - o.y) <= 1, p = near(A.at.x, A.at.y) ? [] : gardenPath(A.at.x, A.at.y, near);
  if (!p) return; A.path = p; A.act = { visit: A.vis.indexOf(o) }; A.mark = { x: o.x, y: o.y, t: 0.5 }; sfx('step');
}
/* The Glimmerkin has walked up to a visitor and watches it. A flyer comes to rest on its head for a moment. */
function watchVisitor(i) {
  const A = GA, o = A.vis && A.vis[i]; if (!o) return; const g = ensureGarden(), v = o.v, first = !g.seen[v.id];
  if (o.x !== A.at.x) A.face = Math.sign(o.x - A.at.x); g.seen[v.id] = (g.seen[v.id] || 0) + 1; A.happy = 1.6;
  if (v.body === 'wing' || v.body === 'fly' || (v.body === 'bug' && v.stripes)) o.watch = 3;
  const V = gardenView(), p = visitorAt(o); burst((p.x - V.ox) * V.ts, V.top + (p.y - V.oy) * V.ts, first ? 14 : 6, first ? 50 : 330, { kind: first ? 'star' : 'heart', v: 80, size: 3 }); sfx(first ? 'tinkle' : 'chirp'); playJoy(); save();
  toast((o.watch > 0 ? 'The ' + v.name.toLowerCase() + (v.many ? ' flutter' : ' lands') + ' on ' + S.pet.name + '\'s head. ' : S.pet.name + ' watches the ' + v.name.toLowerCase() + '. ') + v.line + (first ? ' New in the visitor book!' : ''), 4600);
}
/* Where a visitor comes, for the visitor book: a clue for one not yet seen. */
function visitorHint(v) {
  const where = v.at === 'bloom' ? KINDS[v.el].label + ' flowers' : v.at === 'cross' ? 'Crossed flowers' : v.at === 'glim' ? 'Glimmering flowers' : v.at === 'six' ? 'All six flowers' : v.at === 'bath' ? 'A bird bath' : v.at === 'bench' ? 'A bench' : v.at === 'lamp' ? 'A lantern post' : v.at === 'pond' ? 'The pond' : v.at === 'tree' ? 'Lone trees' : v.q ? BIOMES[v.q].name + ' quarter' : 'Grass';
  return where + (v.season ? ', ' + v.season : '') + (v.day === 0 ? ', at night' : '');
}
/* The visitor book, a section of the journal: every visitor, with how often each has been watched. One not yet
   watched is a grey shape with a clue to where it comes. */
function visitorJournal() {
  if (!unlocked('garden')) return ''; const g = ensureGarden(), n = VISITORS.filter(v => g.seen[v.id]).length;
  const cell = v => { const s = g.seen[v.id]; return '<div class="cell' + (s ? '' : ' unk') + '"><canvas data-ic="visitor:' + v.id + '" data-size="44"></canvas><span>' + (s ? v.name : '?') + '</span>' + (s ? '<em>×' + s + '</em>' : '<small>' + visitorHint(v) + '</small>') + '</div>'; };
  return '<h3>The visitor book · ' + n + ' of ' + VISITORS.length + '</h3><p class="dim">Small creatures come to the garden for what is in bloom, what is set down, the pond and the trees, the hour and the season. Tap one to watch it, and it goes in the book.</p><div class="grid">' + VISITORS.map(cell).join('') + '</div>';
}
