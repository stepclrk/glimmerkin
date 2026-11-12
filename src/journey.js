/* ===== The journey: six regions opened in order, each ending in a boss, and a nest that grows ===== */
const REGION_QUESTS = 3;   // quests finished in a region's world type before its heart opens
/* One nest piece for each region, bought with stardust once that region's boss is beaten. */
const NEST_PIECES = {
  mossroot: { name: 'Moss lining', text: 'Soft moss along the rim of the nest.', price: 60 },
  emberfall: { name: 'Ember coals', text: 'Warm coals that glow in the front of the nest.', price: 80 },
  tidehollow: { name: 'Shell rim', text: 'Shells from the reef, set all round the nest.', price: 100 },
  cloudspire: { name: 'Feather crest', text: 'Long sky feathers standing up behind the nest.', price: 130 },
  gloamglass: { name: 'Glow crystals', text: 'Three crystals that float above the nest and shine at night.', price: 160 },
  stonesong: { name: 'Standing stones', text: 'A ring of small humming stones in front of the nest.', price: 200 }
};
const regionBiome = i => BIOMES[i] || null;
const journeyDone = () => S.reg.i >= BIOMES.length;
function ensureJourney() { S.reg = S.reg || { i: 0, n: 0, built: [] }; S.reg.built = S.reg.built || []; return S.reg; }

/* The boss portal for the current region, kept with the other portals. */
function regionPortal(r) {
  const B = regionBiome(S.reg.i); if (!B) return null;
  return { seed: r.int(1, 2147483646), biome: B.id, size: 'realm', rare: true, region: true, name: 'The Heart of ' + B.name };
}
const heartOpen = () => !journeyDone() && S.reg.n >= REGION_QUESTS;

/* After a quest: count it towards the region, or open the next region after its boss. Returns lines for the sheet. */
function journeyAfter(q, success) {
  const g = S.reg, B = regionBiome(g.i), out = [];
  if (!success || !B || q.B.id !== B.id || !unlocked('journey')) return out;
  if (q.region) {
    g.i++; g.n = 0; S.j.regions = g.i;
    const nx = regionBiome(g.i);
    out.push('You beat the heart of ' + B.name + '. ' + (nx ? nx.name + ' is the next region on the journey.' : 'Every region is open. The journey is complete.'));
    out.push('The ' + NEST_PIECES[B.id].name.toLowerCase() + ' can now be built for the nest. Open the journey to build it.');
    if (g.i - 1 >= 1 && unlocked('garden')) out.push('The gate to the ' + B.name + ' quarter of the garden has opened.');
  } else if (g.n < REGION_QUESTS) {
    g.n++;
    out.push(g.n >= REGION_QUESTS ? 'The heart of ' + B.name + ' is open. A boss waits there. Find it under Where to?' : g.n + ' of ' + REGION_QUESTS + ' quests done in ' + B.name + ' on the journey.');
  }
  return out;
}

function journeyLine() {
  const g = S.reg, B = regionBiome(g.i);
  if (!B) return 'Every region is open.' + (g.built.length < BIOMES.length ? ' Some nest pieces are still waiting to be built.' : ' The nest is complete.');
  return 'Region ' + (g.i + 1) + ' of ' + BIOMES.length + ': ' + B.name + '. ' + (heartOpen() ? 'Its heart is open and a boss waits.' : 'Finish ' + (REGION_QUESTS - g.n) + ' more ' + (REGION_QUESTS - g.n > 1 ? 'quests' : 'quest') + ' there to open its heart.');
}

function openJourney(back) {
  const g = ensureJourney();
  const piece = (b, i) => {
    const P = NEST_PIECES[b.id], built = g.built.includes(b.id), open = i < g.i, off = built || !open || S.dust < P.price;
    return '<button class="card' + (off && !built ? ' off' : '') + '" data-do="build" data-id="' + b.id + '"' + (off ? ' disabled' : '') + '><canvas data-ic="piece:' + b.id + '" data-size="52"></canvas><span class="tx"><strong>' + esc(P.name) + '</strong><small>' + esc(P.text) + '</small><small>' + (built ? 'In the nest.' : open ? 'Ready to build.' : 'Opens when you beat the heart of ' + b.name + '.') + '</small></span><span class="tag ' + (built ? 'yes' : open ? 'cost' : '') + '">' + (built ? 'Built' : '✦ ' + P.price) + '</span></button>';
  };
  openSheet('<h2>The journey</h2><p class="dim">Six regions, opened one after another. Finish ' + REGION_QUESTS + ' quests in a region\'s world type to open its heart, then beat the boss there to open the next.</p><canvas data-ic="journey" data-size="150" data-w="300" style="display:block;margin:10px auto;max-width:100%"></canvas><p>' + esc(journeyLine()) + '</p><h3>Grow the nest · ' + g.built.length + ' of ' + BIOMES.length + '</h3><p class="dim">You have <b style="color:var(--lantern)">✦ ' + S.dust + '</b> stardust.</p><div class="list">' + BIOMES.map(piece).join('') + '</div><div class="btns">' + (back ? '<button class="btn" data-do="back">Back</button>' : '') + '<button class="btn main" data-do="ok">Done</button></div>', {
    ok: closeSheet, back: () => back(),
    build: d => {
      const P = NEST_PIECES[d.id], i = BIOMES.findIndex(b => b.id === d.id);
      if (!P || g.built.includes(d.id) || i >= g.i || S.dust < P.price) return;
      S.dust -= P.price; g.built.push(d.id); sfx('buy'); save(); updateHud(); openJourney(back); toast('The ' + P.name.toLowerCase() + ' is part of the nest now.');
    }
  });
}

/* The map: six regions along a winding path. */
function drawJourneyMap(c, w, h) {
  const g = S.reg, n = BIOMES.length, pts = BIOMES.map((b, i) => ({ x: w * (0.1 + 0.8 * i / (n - 1)), y: h * (0.5 + (i % 2 ? -0.2 : 0.2)) }));
  c.lineCap = 'round'; c.lineWidth = 3;
  for (let i = 0; i < n - 1; i++) { const a = pts[i], b = pts[i + 1]; c.strokeStyle = i < g.i ? 'rgba(255,215,102,.85)' : 'rgba(220,210,255,.3)'; c.setLineDash(i < g.i ? [] : [4, 5]); c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + (i % 2 ? 14 : -14), b.x, b.y); c.stroke(); }
  c.setLineDash([]);
  const r = Math.min(w / (n * 2.6), h * 0.17);
  BIOMES.forEach((b, i) => {
    const p = pts[i], done = i < g.i, here = i === g.i, [ah, as, al] = b.accent;
    if (here) glow(c, p.x, p.y, r * 2.2, ah, as, al, 0.5);
    const gr = c.createLinearGradient(0, p.y - r, 0, p.y + r); gr.addColorStop(0, b.bg[0]); gr.addColorStop(1, b.bg[1]);
    c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
    c.lineWidth = here ? 3 : 2; c.strokeStyle = done ? '#ffd766' : here ? hsl(ah, as, al) : 'rgba(220,210,255,.35)'; c.stroke();
    c.fillStyle = done || here ? hsl(ah, as, al) : 'rgba(220,210,255,.35)'; c.beginPath(); c.arc(p.x, p.y, r * 0.32, 0, TAU); c.fill();
    if (done) { c.fillStyle = '#ffd766'; star(c, p.x + r * 0.7, p.y - r * 0.7, r * 0.34); }
    if (here) for (let k = 0; k < REGION_QUESTS; k++) { c.fillStyle = k < g.n ? '#ffd766' : 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(p.x + (k - 1) * r * 0.5, p.y + r * 1.4, r * 0.15, 0, TAU); c.fill(); }
    c.fillStyle = done || here ? '#f4efff' : 'rgba(220,210,255,.5)'; c.font = '600 ' + Math.round(Math.max(9, r * 0.5)) + 'px system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText(b.name, p.x, i % 2 ? p.y - r * 1.35 : p.y + r * (here ? 2.1 : 1.75));
  });
}
function star(c, x, y, r) { c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }

/* Nest pieces, drawn on the rim. `front` picks the half in front of the Glimmerkin. */
function drawNestPieces(c, cx, ny, nrx, nry, bs, front, T) {
  const has = id => S.reg && S.reg.built.includes(id), a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU, at = a => [cx + Math.cos(a) * nrx, ny + Math.sin(a) * nry];
  if (!front && has('cloudspire')) for (let a = a0 + 0.35; a < a1 - 0.2; a += 0.42) { const [x, y] = at(a), sw = Math.sin(T * 1.3 + a * 3) * 0.08, len = bs * 0.42; c.save(); c.translate(x, y); c.rotate((a - 1.5 * Math.PI) * 0.5 + sw); c.fillStyle = hsl(250 + a * 10, 60, 88, 0.95); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-len * 0.16, -len * 0.55, 0, -len); c.quadraticCurveTo(len * 0.16, -len * 0.55, 0, 0); c.fill(); c.strokeStyle = 'rgba(120,100,170,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -len * 0.9); c.stroke(); c.restore(); }
  if (!front && has('gloamglass')) for (let k = 0; k < 3; k++) { const x = cx + (k - 1) * nrx * 0.7, y = ny - bs * (1.05 + (k === 1 ? 0.18 : 0)) + Math.sin(T * 1.4 + k * 2) * 4, s = bs * 0.09; glow(c, x, y, s * 4, 268 + k * 20, 90, 70, 0.4 + 0.15 * Math.sin(T * 2 + k)); c.fillStyle = hsl(268 + k * 20, 80, 78, 0.95); c.beginPath(); c.moveTo(x, y - s * 1.6); c.lineTo(x + s, y); c.lineTo(x, y + s * 1.6); c.lineTo(x - s, y); c.closePath(); c.fill(); }
  if (has('mossroot')) for (let a = a0 + 0.12; a < a1; a += 0.3) { const [x, y] = at(a); c.fillStyle = hsl(118 + Math.sin(a * 5) * 14, 45, 38 + Math.sin(a * 7) * 6); c.beginPath(); c.arc(x, y - bs * 0.045, bs * 0.05, 0, TAU); c.fill(); }
  if (has('tidehollow')) for (let a = a0 + 0.26; a < a1; a += 0.52) { const [x, y] = at(a), s = bs * 0.055; c.fillStyle = hsl(18 + a * 6, 70, 84); c.beginPath(); c.moveTo(x, y + s * 0.4); c.arc(x, y + s * 0.4, s, Math.PI * 1.1, Math.PI * 1.9); c.closePath(); c.fill(); c.strokeStyle = 'rgba(150,80,70,.5)'; c.lineWidth = 0.8; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x, y + s * 0.4); c.lineTo(x + k * s * 0.6, y - s * 0.45); c.stroke(); } }
  if (front && has('emberfall')) for (const a of [0.55, 1.15, 1.95, 2.6]) { const [x, y] = at(a), f = 0.6 + 0.4 * Math.sin(T * 3 + a * 5); glow(c, x, y, bs * 0.16, 24, 100, 58, 0.45 * f); c.fillStyle = hsl(20 + f * 20, 100, 50 + f * 15); c.beginPath(); c.ellipse(x, y, bs * 0.05, bs * 0.035, 0, 0, TAU); c.fill(); }
  if (front && has('stonesong')) for (let k = 0; k < 5; k++) { const a = 0.35 + k * 0.6, x = cx + Math.cos(a) * nrx * 1.18, y = ny + Math.sin(a) * nry * 1.9 + bs * 0.06, hh = bs * (0.13 + (k % 2) * 0.04); c.fillStyle = '#6d6478'; rrect(c, x - bs * 0.045, y - hh, bs * 0.09, hh, bs * 0.04); c.fill(); c.fillStyle = hsl(36, 95, 62, 0.5 + 0.4 * Math.sin(T * 1.5 + k)); c.beginPath(); c.arc(x, y - hh * 0.6, bs * 0.015, 0, TAU); c.fill(); }
}
/* A small picture of one nest piece, for the journey sheet. */
function drawPieceIcon(c, id, size) {
  const m = size / 2; c.fillStyle = 'rgba(255,255,255,.06)'; c.beginPath(); c.arc(m, m, m, 0, TAU); c.fill();
  const keep = S.reg; S.reg = { i: 0, n: 0, built: [id] };
  try { const bs = size * 0.9, nrx = size * 0.36, nry = size * 0.1, ny = size * (id === 'gloamglass' ? 0.78 : 0.6), cx = m; c.lineCap = 'round'; c.strokeStyle = '#7b5637'; c.lineWidth = size * 0.07; c.beginPath(); c.ellipse(cx, ny, nrx, nry, 0, 0, TAU); c.stroke(); drawNestPieces(c, cx, ny, nrx, nry, id === 'gloamglass' ? size * 0.5 : bs, false, 0.5); drawNestPieces(c, cx, ny, nrx, nry, id === 'gloamglass' ? size * 0.5 : bs, true, 0.5); }
  finally { S.reg = keep; }
}
