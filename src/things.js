/* ===== Things: tools, charms, toys, decorations, rare finds, the trader, the journal ===== */
const TOOLS = {
  seed: { name: 'Bridge seed', text: 'Grows a bridge over one chasm or pool, whoever you brought.' },
  lantern: { name: 'Spark lantern', text: 'Refills one little to full sparks. Tap a little during a quest.' },
  key: { name: 'Moon key', text: 'Opens a moon gate with nobody on the plate.' },
  bell: { name: 'Scare-bell', text: 'Sends one gloom running without a fight. Bosses ignore it.' }
};
const CHARMS = {
  ring: { name: 'Ember ring', text: 'Fights cost the wearer one spark less.' },
  feather: { name: 'Feather', text: 'The wearer can fly to fetch things.' },
  clover: { name: 'Lucky clover', text: 'Chests give double stardust while the wearer travels with you.' }
};
const TOYS = {
  ball: { name: 'Bouncy ball', text: 'Something to chase around the nest. Joy fades more slowly.' },
  musicbox: { name: 'Music box', text: 'Tap it for a tune. Joy fades more slowly.' }
};
const DECOR = { lantern: 'lantern', banner: 'banner', chime: 'wind chime' };
const MARKS = { freckles: 'star freckles', bellystar: 'a belly star', antennae: 'glowing antennae', wingbuds: 'wing buds', halo: 'a halo', comet: 'a pet comet', crest: 'a feather crest', shimmer: 'an aurora shimmer' };
const CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
const PRICE = { tool: 12, star: 18, decor: 25, chime: 28, map: 30, toy: 40, charm: 45, egg: 90 };
const TRADER_LOOK = { kind: 'trader', hue: 34, sat: 62, bw: 0.98, bh: 0.86, top: 0.72, ears: 'horn', tail: 'none', pattern: 'stripes', eyeS: 1.12, cheek: true, phase: 1.3, float: 0, feats: [] };

function thingName(id) {
  const [k, a, b] = id.split(':');
  if (k === 'tool') return TOOLS[a].name; if (k === 'charm') return CHARMS[a].name; if (k === 'toy') return TOYS[a].name;
  if (k === 'decor') return (BIOMES.find(z => z.id === b) || BIOMES[0]).name + ' ' + DECOR[a];
  return k === 'chime' ? 'Chime stone' : k === 'star' ? 'Starfruit' : k === 'map' ? 'Map piece' : 'Twin egg';
}
function thingText(id) {
  const [k, a] = id.split(':');
  if (k === 'tool') return TOOLS[a].text; if (k === 'charm') return CHARMS[a].text; if (k === 'toy') return TOYS[a].text;
  if (k === 'decor') return 'A decoration for the nest.';
  return k === 'chime' ? 'Adds a note to the tune that plays at the nest.' : k === 'star' ? 'A food that changes your Glimmerkin for good.' : k === 'map' ? 'Three pieces reveal a rare portal.' : 'Hatches a little with two skills.';
}
function giveThing(id) {
  const [k, a] = id.split(':');
  if (k === 'tool') S.tools[a] = (S.tools[a] || 0) + 1;
  else if (k === 'charm') S.charms[a] = (S.charms[a] || 0) + 1;
  else if (k === 'toy') S.toys[a] = true;
  else if (k === 'decor') { if (!S.decor.includes(id)) S.decor.push(id); }
  else if (k === 'chime') S.chimes = Math.min(8, S.chimes + 1);
  else if (k === 'star') S.pantry.star = (S.pantry.star || 0) + 1;
  else if (k === 'map') S.maps = Math.min(3, S.maps + 1);
  else if (k === 'egg') S.eggs.push({ hue: Math.floor(Math.random() * 360), seed: (Math.random() * 2147483646) | 0, warm: 0, twin: true });
  S.j.things[id] = true; return thingName(id);
}
function allDecor() { const o = []; for (const b of BIOMES) for (const t in DECOR) o.push('decor:' + t + ':' + b.id); return o; }
function rollGifts(portal, B) {
  const r = RNG((portal.seed ^ 0x5bd1e995) >>> 0), g = [];
  if (portal.rare) { g.push('charm:' + r.pick(Object.keys(CHARMS)), 'star'); if (S.chimes < 8) g.push('chime'); }
  const dec = Object.keys(DECOR).map(t => 'decor:' + t + ':' + B.id).filter(id => !S.decor.includes(id));
  if (dec.length && (S.quests === 0 || portal.rare || r.chance(0.5))) g.push(r.pick(dec));
  if (portal.rare || S.quests === 0) return g;
  if (S.maps < 3 && r.chance(0.3)) g.push('map');
  if (S.chimes < 8 && r.chance(0.24)) g.push('chime');
  if (r.chance(0.22)) g.push('star');
  if (r.chance(0.12)) g.push('charm:' + r.pick(Object.keys(CHARMS)));
  const toys = Object.keys(TOYS).filter(t => !S.toys[t]); if (toys.length && r.chance(0.15)) g.push('toy:' + r.pick(toys));
  return g;
}

/* ---------- drawing ---------- */
function drawBall(c, x, y, r, spin) {
  c.save(); c.translate(x, y); glow(c, 0, 0, r * 2.2, 320, 100, 72, 0.3); c.rotate(spin || 0);
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = '#ff8fb3'; c.fill(); c.save(); c.clip();
  c.fillStyle = '#8fc8ff'; c.fillRect(-r, -r * 0.3, r * 2, r * 0.6); c.fillStyle = '#ffd766'; c.fillRect(-r, -r * 0.08, r * 2, r * 0.16); c.restore();
  c.strokeStyle = '#3a1630'; c.lineWidth = Math.max(1, r * 0.12); c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(-r * 0.35, -r * 0.45, r * 0.2, 0, TAU); c.fill(); c.restore();
}
function drawMusicBox(c, x, y, w, open, t) { // x centre, y base
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.strokeStyle = '#2a1830'; c.lineWidth = Math.max(1, w * 0.045); const h = w * 0.5;
  glow(c, 0, -h * 0.6, w * 1.1, 285, 90, 72, 0.25 + open * 0.3);
  c.save(); c.translate(-w / 2, -h); c.rotate(-open * 1.05); c.fillStyle = '#7d4fb0'; rrect(c, 0, -w * 0.14, w, w * 0.16, w * 0.04); c.fill(); c.stroke(); c.restore();
  if (open > 0.3) { c.fillStyle = '#ffd766'; c.beginPath(); c.arc(0, -h - w * 0.12, w * 0.09, 0, TAU); c.fill(); c.fillStyle = '#ff8fb3'; c.beginPath(); c.moveTo(-w * 0.09, -h - w * 0.02); c.lineTo(w * 0.09, -h - w * 0.02); c.lineTo(0, -h - w * 0.2); c.fill(); }
  c.fillStyle = '#9a66d0'; rrect(c, -w / 2, -h, w, h, w * 0.06); c.fill(); c.stroke();
  c.fillStyle = '#ffd766'; starPath(c, 0, -h / 2, w * 0.13, w * 0.055, 5, -Math.PI / 2 + (open ? t * 2 : 0)); c.fill();
  c.strokeStyle = '#ffd766'; c.beginPath(); c.moveTo(w / 2, -h * 0.5); c.lineTo(w * 0.66, -h * 0.5); c.lineTo(w * 0.66, -h * 0.5 + Math.sin(t * (open ? 9 : 0)) * w * 0.1 - w * 0.1); c.stroke();
  c.restore();
}
function drawStone(c, x, y, r, i, lit, t) {
  const h = i * 45 + 10; glow(c, x, y, r * (2 + lit * 1.6), h, 100, 70, 0.3 + lit * 0.6);
  c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.8 + i) * 0.15); c.fillStyle = hsl(h, 45, 62 + lit * 20); c.strokeStyle = hsl(h, 40, 22); c.lineWidth = Math.max(1, r * 0.14);
  c.beginPath(); c.moveTo(-r * 0.8, r * 0.5); c.quadraticCurveTo(-r, -r * 0.6, -r * 0.2, -r); c.quadraticCurveTo(r * 0.9, -r * 0.9, r * 0.85, r * 0.3); c.quadraticCurveTo(r * 0.4, r, -r * 0.8, r * 0.5); c.fill(); c.stroke();
  c.strokeStyle = hsl(h + 40, 100, 90, 0.95); c.lineWidth = Math.max(1, r * 0.12); c.beginPath(); const k = i % 4;
  if (k === 0) { c.arc(0, 0, r * 0.3, 0, TAU); } else if (k === 1) { c.moveTo(-r * 0.3, r * 0.3); c.lineTo(0, -r * 0.4); c.lineTo(r * 0.3, r * 0.3); } else if (k === 2) { c.moveTo(-r * 0.3, -r * 0.3); c.lineTo(r * 0.3, 0); c.lineTo(-r * 0.3, r * 0.3); } else { c.moveTo(0, -r * 0.45); c.lineTo(0, r * 0.4); c.moveTo(-r * 0.3, -r * 0.05); c.lineTo(r * 0.3, -r * 0.05); }
  c.stroke(); c.restore();
}
function lanternShape(c, x, y, w, B, t) { // x centre, y top of lantern
  const [ah, as, al] = B.accent; glow(c, x, y + w * 0.6, w * 2.1, ah, as, al, 0.3 + 0.1 * Math.sin(t * 4 + x));
  c.save(); c.lineJoin = 'round'; c.strokeStyle = '#2a1830'; c.lineWidth = Math.max(1, w * 0.09);
  c.fillStyle = '#3d2a1c'; rrect(c, x - w * 0.3, y, w * 0.6, w * 0.16, w * 0.04); c.fill(); rrect(c, x - w * 0.3, y + w * 1.08, w * 0.6, w * 0.16, w * 0.04); c.fill();
  const g = c.createLinearGradient(0, y, 0, y + w * 1.2); g.addColorStop(0, hsl(ah, as, al + 16)); g.addColorStop(1, hsl(ah + 15, as, al - 12)); c.fillStyle = g;
  c.beginPath(); c.ellipse(x, y + w * 0.62, w * 0.5, w * 0.5, 0, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(42,24,48,.35)'; c.lineWidth = 1; for (const d of [-0.22, 0.22]) { c.beginPath(); c.ellipse(x + d * w, y + w * 0.62, w * 0.18, w * 0.5, 0, 0, TAU); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(x, y + w * 0.62, w * 0.14, 0, TAU); c.fill(); c.restore();
}
function flagShape(c, x, y, w, B, sw) { // hangs from x,y
  const [ah, as, al] = B.accent; c.save(); c.translate(x, y); c.rotate(sw || 0); c.lineJoin = 'round';
  c.fillStyle = hsl(ah, as, al); c.strokeStyle = '#2a1830'; c.lineWidth = Math.max(1, w * 0.07); c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(w / 2, 0); c.lineTo(0, w * 1.25); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = B.bg[1]; c.beginPath(); c.moveTo(-w * 0.3, w * 0.12); c.lineTo(w * 0.3, w * 0.12); c.lineTo(0, w * 0.82); c.closePath(); c.fill();
  c.fillStyle = hsl(ah, as, al + 18); starPath(c, 0, w * 0.34, w * 0.14, w * 0.06, 4, 0); c.fill(); c.restore();
}
function chimeShape(c, x, y, w, B, sw) { // hangs from x,y
  const [ah, as, al] = B.accent; c.save(); c.translate(x, y); c.rotate(sw || 0); c.lineCap = 'round';
  c.strokeStyle = 'rgba(235,225,255,.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, w * 0.3); c.stroke();
  c.fillStyle = hsl(ah, as, al); c.strokeStyle = '#2a1830'; c.lineWidth = Math.max(1, w * 0.06); rrect(c, -w * 0.45, w * 0.3, w * 0.9, w * 0.16, w * 0.06); c.fill(); c.stroke();
  [0.9, 1.25, 0.7].forEach((len, i) => { const tx = (i - 1) * w * 0.3; c.strokeStyle = 'rgba(235,225,255,.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(tx, w * 0.46); c.lineTo(tx, w * 0.58); c.stroke(); c.strokeStyle = hsl(ah + 20, 60, 88); c.lineWidth = Math.max(2, w * 0.13); c.beginPath(); c.moveTo(tx, w * 0.6); c.lineTo(tx, w * (0.6 + len * 0.6)); c.stroke(); });
  c.restore();
}
function drawThing(c, id, x, y, s, t) { // centred on x,y inside a box of size s
  const p = id.split(':'), k = p[0], a = p[1], u = s * 0.01; t = t || 0;
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = Math.max(1, s * 0.035); c.strokeStyle = '#2a1830';
  if (k === 'tool' && a === 'seed') {
    glow(c, 0, 0, 46 * u, 120, 90, 65, 0.4); c.fillStyle = '#b98045'; c.beginPath(); c.ellipse(0, 10 * u, 15 * u, 19 * u, 0.2, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#e2b877'; c.beginPath(); c.ellipse(-5 * u, 4 * u, 4 * u, 7 * u, 0.3, 0, TAU); c.fill();
    c.fillStyle = '#7fd47a'; c.beginPath(); c.moveTo(0, -8 * u); c.quadraticCurveTo(22 * u, -16 * u, 14 * u, -36 * u); c.quadraticCurveTo(-4 * u, -28 * u, 0, -8 * u); c.fill(); c.stroke();
  } else if (k === 'tool' && a === 'lantern') {
    glow(c, 0, 4 * u, 50 * u, 46, 100, 68, 0.55 + 0.15 * Math.sin(t * 5)); c.strokeStyle = '#5a3a12'; c.beginPath(); c.arc(0, -22 * u, 9 * u, Math.PI, TAU); c.stroke();
    c.fillStyle = '#8a5a1c'; rrect(c, -13 * u, -24 * u, 26 * u, 7 * u, 2 * u); c.fill(); rrect(c, -15 * u, 22 * u, 30 * u, 7 * u, 2 * u); c.fill();
    c.fillStyle = '#fff1b8'; rrect(c, -11 * u, -17 * u, 22 * u, 39 * u, 5 * u); c.fill(); c.stroke(); c.fillStyle = '#ffb53a'; starPath(c, 0, 3 * u, 9 * u, 3.6 * u, 4, t * 2); c.fill();
  } else if (k === 'tool' && a === 'key') {
    glow(c, 0, 0, 46 * u, 215, 90, 75, 0.45); c.strokeStyle = '#3a4a7a'; c.fillStyle = '#dfe9ff';
    rrect(c, -4 * u, -8 * u, 7 * u, 40 * u, 2 * u); c.fill(); c.stroke(); c.fillRect(2 * u, 17 * u, 10 * u, 5 * u); c.fillRect(2 * u, 26 * u, 7 * u, 5 * u);
    c.beginPath(); c.arc(-1 * u, -20 * u, 14 * u, 0.5 * Math.PI, 1.5 * Math.PI); c.arc(6 * u, -20 * u, 11 * u, 1.5 * Math.PI, 0.5 * Math.PI, true); c.closePath(); c.fill(); c.stroke();
  } else if (k === 'tool') {
    glow(c, 0, 0, 46 * u, 44, 100, 68, 0.4); c.rotate(Math.sin(t * 6) * 0.12); c.fillStyle = '#ffd766'; c.strokeStyle = '#7a4a10';
    c.beginPath(); c.moveTo(-20 * u, 16 * u); c.quadraticCurveTo(-16 * u, -4 * u, -12 * u, -12 * u); c.quadraticCurveTo(0, -30 * u, 12 * u, -12 * u); c.quadraticCurveTo(16 * u, -4 * u, 20 * u, 16 * u); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#a8651c'; c.beginPath(); c.arc(0, 21 * u, 5 * u, 0, TAU); c.fill(); c.fillStyle = '#ff8fb3'; c.beginPath(); c.arc(0, -25 * u, 5 * u, 0, TAU); c.fill(); c.stroke();
  } else if (k === 'charm' && a === 'ring') {
    glow(c, 0, 0, 44 * u, 14, 100, 62, 0.45); c.strokeStyle = '#a8651c'; c.lineWidth = 7 * u; c.beginPath(); c.arc(0, 9 * u, 17 * u, 0, TAU); c.stroke(); c.strokeStyle = '#ffd766'; c.lineWidth = 4 * u; c.stroke();
    c.lineWidth = Math.max(1, s * 0.03); c.strokeStyle = '#6a1010'; c.fillStyle = '#ff5a3a'; starPath(c, 0, -13 * u, 12 * u, 8 * u, 2, Math.PI / 2); c.fill(); c.stroke(); c.fillStyle = '#ffd0b0'; c.beginPath(); c.arc(-2 * u, -16 * u, 2.5 * u, 0, TAU); c.fill();
  } else if (k === 'charm' && a === 'feather') {
    glow(c, 0, 0, 44 * u, 170, 90, 75, 0.45); c.rotate(0.5 + Math.sin(t * 2) * 0.06); c.fillStyle = '#e9fff8'; c.strokeStyle = '#2f7f74';
    c.beginPath(); c.moveTo(0, 28 * u); c.quadraticCurveTo(-22 * u, 0, 0, -34 * u); c.quadraticCurveTo(22 * u, 0, 0, 28 * u); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, 36 * u); c.lineTo(0, -26 * u); for (let i = -2; i <= 2; i++) { c.moveTo(0, i * 9 * u); c.lineTo(-8 * u, i * 9 * u - 7 * u); c.moveTo(0, i * 9 * u); c.lineTo(8 * u, i * 9 * u - 7 * u); } c.stroke();
  } else if (k === 'charm') {
    glow(c, 0, 0, 44 * u, 120, 90, 65, 0.45); c.strokeStyle = '#1d5a2c'; c.beginPath(); c.moveTo(0, 2 * u); c.quadraticCurveTo(4 * u, 24 * u, 14 * u, 32 * u); c.stroke();
    c.fillStyle = '#5fd07a'; for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.arc(Math.cos(an) * 12 * u, Math.sin(an) * 12 * u - 4 * u, 11.5 * u, 0, TAU); c.fill(); c.stroke(); }
    c.fillStyle = '#bff5c8'; c.beginPath(); c.arc(0, -4 * u, 4 * u, 0, TAU); c.fill();
  } else if (k === 'toy' && a === 'ball') drawBall(c, 0, 0, 26 * u, 0.4);
  else if (k === 'toy') drawMusicBox(c, 0, 22 * u, 56 * u, 0.6, t);
  else if (k === 'decor') {
    const B = BIOMES.find(z => z.id === p[2]) || BIOMES[0];
    if (a === 'lantern') lanternShape(c, 0, -30 * u, 46 * u, B, t); else if (a === 'banner') flagShape(c, 0, -30 * u, 50 * u, B, Math.sin(t * 2) * 0.08); else chimeShape(c, 0, -36 * u, 52 * u, B, Math.sin(t * 2) * 0.08);
  } else if (k === 'chime') drawStone(c, 0, 0, 24 * u, 3, 0.5 + 0.3 * Math.sin(t * 3), t);
  else if (k === 'star') {
    for (let i = 0; i < 3; i++) glow(c, 0, 0, (52 - i * 8) * u, (t * 80 + i * 110) % 360, 100, 70, 0.28);
    c.fillStyle = '#ffe36b'; c.strokeStyle = '#a8651c'; starPath(c, 0, 2 * u, 30 * u, 15 * u, 5, -Math.PI / 2 + Math.sin(t * 2) * 0.1); c.fill(); c.stroke();
    c.fillStyle = '#fff6c4'; starPath(c, 0, 2 * u, 13 * u, 6 * u, 5, -Math.PI / 2); c.fill(); c.fillStyle = '#7fd47a'; c.strokeStyle = '#1d5a2c'; c.beginPath(); c.ellipse(7 * u, -27 * u, 9 * u, 4 * u, -0.6, 0, TAU); c.fill(); c.stroke();
  } else if (k === 'map') {
    glow(c, 0, 0, 46 * u, 36, 90, 70, 0.4); c.rotate(-0.12); c.fillStyle = '#f0dba8'; c.strokeStyle = '#6b4a2e';
    c.beginPath(); c.moveTo(-26 * u, -22 * u); c.lineTo(20 * u, -26 * u); c.lineTo(28 * u, -6 * u); c.lineTo(18 * u, 4 * u); c.lineTo(26 * u, 22 * u); c.lineTo(-20 * u, 26 * u); c.lineTo(-28 * u, 6 * u); c.lineTo(-22 * u, -6 * u); c.closePath(); c.fill(); c.stroke();
    c.setLineDash([3 * u, 4 * u]); c.strokeStyle = '#8a5a2c'; c.beginPath(); c.moveTo(-16 * u, 14 * u); c.quadraticCurveTo(-4 * u, -8 * u, 10 * u, -10 * u); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#d0403a'; c.lineWidth = Math.max(1.5, 4 * u); c.beginPath(); c.moveTo(8 * u, -16 * u); c.lineTo(18 * u, -6 * u); c.moveTo(18 * u, -16 * u); c.lineTo(8 * u, -6 * u); c.stroke();
  } else if (k === 'egg') drawItem(c, { k: 'egg', hue: 285, twin: true }, 0, 0, s * 1.3, t);
  c.restore();
}
function drawBalloon(c, x, y, s, t) {
  const R = s * 0.5; c.save(); c.translate(x, y + Math.sin(t * 0.9) * 5); c.rotate(Math.sin(t * 0.6) * 0.04); c.lineJoin = 'round'; c.lineCap = 'round';
  glow(c, 0, -R * 0.2, s * 1.2, 44, 100, 70, 0.28);
  const env = () => { c.beginPath(); c.moveTo(-R * 0.26, R * 0.72); c.bezierCurveTo(-R * 1.25, R * 0.1, -R * 0.95, -R * 1.15, 0, -R * 1.15); c.bezierCurveTo(R * 0.95, -R * 1.15, R * 1.25, R * 0.1, R * 0.26, R * 0.72); c.closePath(); };
  env(); c.save(); c.clip(); ['#3fbfa8', '#ffd27a', '#ff8fb3', '#8fc8ff', '#ffd27a', '#3fbfa8'].forEach((col, i) => { c.fillStyle = col; c.fillRect(-R * 1.2 + i * R * 0.4, -R * 1.2, R * 0.42, R * 2); });
  const g = c.createRadialGradient(-R * 0.4, -R * 0.6, R * 0.1, 0, -R * 0.2, R * 1.3); g.addColorStop(0, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(40,20,70,.35)'); c.fillStyle = g; c.fillRect(-R * 1.3, -R * 1.3, R * 2.6, R * 2.2); c.restore();
  c.strokeStyle = '#2a1830'; c.lineWidth = Math.max(1.2, s * 0.025); env(); c.stroke();
  c.lineWidth = 1; c.beginPath(); c.moveTo(-R * 0.26, R * 0.72); c.lineTo(-R * 0.32, R * 1.12); c.moveTo(R * 0.26, R * 0.72); c.lineTo(R * 0.32, R * 1.12); c.stroke();
  drawCreature(c, TRADER_LOOK, 0, R * 1.42, s * 0.44, t, { noShadow: true, glow: 0.12 });
  c.fillStyle = '#8a5a2c'; c.strokeStyle = '#2a1830'; c.lineWidth = Math.max(1.2, s * 0.025); rrect(c, -R * 0.4, R * 1.12, R * 0.8, R * 0.44, R * 0.08); c.fill(); c.stroke();
  c.strokeStyle = '#b08455'; c.lineWidth = 1; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-R * 0.4 + i * R * 0.2, R * 1.14); c.lineTo(-R * 0.4 + i * R * 0.2, R * 1.54); c.stroke(); }
  glow(c, R * 0.52, R * 1.3, R * 0.5, 46, 100, 70, 0.6 + 0.2 * Math.sin(t * 5)); c.fillStyle = '#fff1b8'; c.beginPath(); c.arc(R * 0.52, R * 1.3, R * 0.08, 0, TAU); c.fill();
  c.restore();
}

/* ---------- the wandering trader ---------- */
function localDay() { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); }
function traderToday() {
  if (!S || S.quests < 1) return null; const day = localDay();
  if (!S.trader || S.trader.day !== day) {
    const r = RNG(day * 977 + S.pet.seed), here = !S.j.trader || r.chance(0.6); let stock = null;
    if (here) {
      const tools = Object.keys(TOOLS), ids = ['tool:' + r.pick(tools), r.chance(0.5) ? 'star' : 'tool:' + r.pick(tools)];
      const dec = allDecor().filter(id => !S.decor.includes(id)); ids.push(dec.length && r.chance(0.6) ? r.pick(dec) : S.chimes < 8 ? 'chime' : 'star');
      const sp = Object.keys(TOYS).filter(k => !S.toys[k]).map(k => 'toy:' + k); sp.push('charm:' + r.pick(Object.keys(CHARMS))); if (S.maps < 3) sp.push('map'); if (S.littles.length + S.eggs.length < 8) sp.push('egg:twin');
      ids.push(r.pick(sp)); stock = ids.map(id => ({ id, price: PRICE[id.split(':')[0]], sold: false })); S.j.trader = true;
    }
    S.trader = { day, stock };
  }
  return S.trader.stock;
}
function openShop() {
  const stock = traderToday(); if (!stock) return;
  openSheet('<h2>The wandering trader</h2><p class="dim">Drifts in on some days, never with the same wares twice. You have <b style="color:var(--lantern)">✦ ' + S.dust + '</b> stardust.</p><div class="list">' + stock.map((o, i) => { const off = o.sold || S.dust < o.price; return '<button class="card' + (off ? ' off' : '') + '" data-do="buy" data-i="' + i + '"' + (off ? ' disabled' : '') + '><canvas data-ic="thing:' + o.id + '" data-size="52"></canvas><span class="tx"><strong>' + esc(thingName(o.id)) + '</strong><small>' + esc(thingText(o.id)) + '</small></span><span class="tag ' + (o.sold ? '' : 'cost') + '">' + (o.sold ? 'Sold' : '✦ ' + o.price) + '</span></button>'; }).join('') + '</div><div class="btns"><button class="btn" data-do="ok">Wave goodbye</button></div>', {
    ok: closeSheet, buy: d => {
      const o = stock[+d.i]; if (!o || o.sold || S.dust < o.price) return;
      if (o.id === 'egg:twin' && S.littles.length + S.eggs.length >= 8) { toast('The nest is full. No room for another egg.'); return; }
      S.dust -= o.price; o.sold = true; giveThing(o.id); sfx('buy'); save(); updateHud(); if (!ui.tray.hidden) buildTray(); openShop(); toast(thingName(o.id) + ' is yours.');
    }
  });
}

/* ---------- the journal ---------- */
function openJournal() {
  const j = S.j, cell = (ic, label, known, extra) => '<div class="cell' + (known ? '' : ' unk') + '"><canvas data-ic="' + ic + '" data-size="44"></canvas><span>' + (known ? esc(label) : '?') + '</span>' + (known && extra ? '<em>' + extra + '</em>' : '') + '</div>';
  const kinds = Object.keys(KINDS), nk = kinds.filter(k => j.kinds[k]).length, nb = BIOMES.filter(b => j.biomes[b.id]).length, dec = allDecor(), nd = dec.filter(id => S.decor.includes(id)).length;
  const worn = k => S.littles.filter(l => l.charm === k).length;
  let h = '<h2>Journal</h2><p class="dim">Everything ' + esc(S.pet.name) + ' and you have met and found. ' + S.quests + (S.quests === 1 ? ' quest' : ' quests') + ' finished.</p>';
  h += '<h3>Littles · ' + nk + ' of 6 kinds' + (j.twins ? ' · ' + j.twins + (j.twins > 1 ? ' twins' : ' twin') : '') + '</h3><div class="grid">' + kinds.map(k => cell('kind:' + k, KINDS[k].species, j.kinds[k])).join('') + '</div>';
  h += '<h3>Worlds · ' + nb + ' of 6</h3><div class="grid">' + BIOMES.map(b => cell('biome:' + b.id, b.name, j.biomes[b.id], '×' + (j.biomes[b.id] || 0))).join('') + cell('portal', 'Rare portal', j.rare, '×' + (j.rare || 0)) + '</div>';
  h += '<h3>Glooms chased off</h3><div class="grid">' + GLOOMS.map((g, i) => cell('gloom:' + i + ':2', g.name, j.glooms[i], '×' + (j.glooms[i] || 0))).join('') + cell('gloom:5:4:boss', 'Boss gloom', j.glooms.boss, '×' + (j.glooms.boss || 0)) + '</div>';
  h += '<h3>Tools and charms</h3><div class="grid">' + Object.keys(TOOLS).map(k => cell('thing:tool:' + k, TOOLS[k].name, j.things['tool:' + k], 'have ' + (S.tools[k] || 0))).join('') + Object.keys(CHARMS).map(k => cell('thing:charm:' + k, CHARMS[k].name, j.things['charm:' + k], 'have ' + ((S.charms[k] || 0) + worn(k)))).join('') + '</div>';
  h += '<h3>Rare finds</h3><div class="grid">' + Object.keys(TOYS).map(k => cell('thing:toy:' + k, TOYS[k].name, S.toys[k])).join('') + cell('thing:star', 'Starfruit', j.things.star, 'eaten ' + (j.star || 0)) + cell('thing:map', 'Map piece', j.things.map, S.maps + ' of 3') + cell('thing:chime', 'Chime stone', S.chimes > 0, S.chimes + ' of 8') + cell('thing:egg:twin', 'Twin egg', j.twins || j.things['egg:twin']) + '</div>';
  h += '<h3>Decorations · ' + nd + ' of ' + dec.length + '</h3><div class="grid">' + dec.map(id => cell('thing:' + id, thingName(id), S.decor.includes(id))).join('') + '</div>';
  const marks = S.pet.marks || []; h += '<h3>Starfruit marks · ' + marks.length + ' of ' + Object.keys(MARKS).length + '</h3><p class="dim">' + (marks.length ? esc(S.pet.name) + ' has ' + marks.map(m => MARKS[m]).join(', ') + '.' : 'None yet. Each starfruit eaten leaves a mark for good.') + '</p>';
  openSheet(h + '<div class="btns"><button class="btn main" data-do="ok">Close</button></div>', { ok: closeSheet });
}
