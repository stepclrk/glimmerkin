/* ===== Dressing up: the wardrobe and the costumes, drawn on the Glimmerkin and the elder ===== */
/* A costume is worn on the head, at the neck or on the face, and the ghost sheet over everything. What is owned belongs to the
   nest (S.wardrobe); what is worn belongs to each creature (pet.wear, and each elder's own). Dressing up changes
   nothing in care, quests or the balance of the game. */
const WEAR = {
  scarf: { name: 'Knitted scarf', slot: 'neck', text: 'Stripy, and long enough to trail.', price: 0 },
  specs: { name: 'Round spectacles', slot: 'face', text: 'For reading the journal.', price: 20, shop: true },
  explorer: { name: 'Explorer\'s hat', slot: 'head', text: 'With a feather from Cloudspire.', price: 30, shop: true },
  wizard: { name: 'Wizard\'s hat', slot: 'head', text: 'The star on top glows after dark.', price: 35, shop: true },
  // seasonal: the trader carries them only in their season; once owned they are kept for good and worn any time
  bobble: { name: 'Bobble hat', slot: 'head', text: 'Red and white, for snowy days.', price: 30, season: 'winter' },
  crown: { name: 'Paper crown', slot: 'head', text: 'From a cracker, in the last December gift.', price: 0, gift: 'the gift on 25 December' },
  souwester: { name: 'Sou\'wester', slot: 'head', text: 'For April showers.', price: 30, season: 'spring' },
  sunhat: { name: 'Straw sun hat', slot: 'head', text: 'With a flower in the band.', price: 30, season: 'summer' },
  shades: { name: 'Star sunglasses', slot: 'face', text: 'Very cool. Off for a nap.', price: 25, season: 'summer' },
  acorn: { name: 'Acorn cap', slot: 'head', text: 'Fell off an oak, just the right size.', price: 25, season: 'autumn' },
  ghost: { name: 'Ghost sheet', slot: 'body', text: 'Boo. Ears, wings and crowns poke out.', price: 0, gift: 'Halloween week, 24 to 31 October' }
};
const WEAR_IDS = Object.keys(WEAR);
const WEAR_SLOTS = ['body', 'neck', 'face', 'head'];   // drawn in this order
const SLOT_NAME = { head: 'Head', neck: 'Neck', face: 'Face', body: 'Over everything' };
const WEAR_TRADER = 0.35;     // chance the trader carries a costume not yet owned

function ensureWardrobe() { S.wardrobe = Array.isArray(S.wardrobe) ? S.wardrobe.filter(id => WEAR[id]) : []; }
/* The scarf is the wardrobe's gift: owned as soon as the wardrobe opens. */
const wearOwned = id => id === 'scarf' ? unlocked('wardrobe') : S.wardrobe.includes(id);
/* Where a costume not yet owned comes from, for the wardrobe's dimmed cards. */
const wearWhere = id => { const it = WEAR[id]; return it.gift ? 'Comes in ' + it.gift + '.' : it.season ? 'With the wandering trader in ' + it.season + '.' : 'Sometimes with the wandering trader.'; };
/* The season's costumes not yet owned, which the trader carries as an extra item. */
const wearInSeason = () => WEAR_IDS.filter(k => WEAR[k].season === seasonNow() && !wearOwned(k));
/* Halloween week: the ghost sheet turns up in the wardrobe by itself. */
const isHalloween = d => d.getMonth() === 9 && d.getDate() >= 24;
function halloweenSheet() {
  if (!unlocked('wardrobe') || wearOwned('ghost') || !isHalloween(new Date())) return false;
  S.wardrobe.push('ghost'); S.j.things['wear:ghost'] = true; save(); toast('A ghost sheet has turned up in the wardrobe for Halloween.', 3600); return true;
}

/* ---------- drawing ---------- */
const WINK = '#1a1030';
function wearLine(c, G, k) { c.strokeStyle = WINK; c.lineWidth = G.lw * (k || 1); c.stroke(); }
/* Something already sits on top of the head: a Mythic form's crown, a diet feature, antlers or a starfruit mark. */
function headBusy(L) { const m = L.marks || []; return !!(L.form || L.antlers || (L.feats || []).length || m.includes('crest') || m.includes('halo') || m.includes('antennae')); }

const WEAR_DRAW = {
  scarf(c, G, L) {
    const { cx, cy, w, h, s } = G, y0 = cy + h * 0.3, th = s * 0.1, sw = G.still ? 0 : Math.sin(G.t * 2.2 + G.ph) * s * 0.012;
    c.save(); bodyPath(c, cx, cy, w * 1.06, h * 1.02, L.top || 0.62); c.clip();
    c.beginPath(); c.moveTo(cx - w * 1.1, y0 - th * 0.5); c.quadraticCurveTo(cx, y0 + th * 0.9, cx + w * 1.1, y0 - th * 0.5);
    c.lineTo(cx + w * 1.1, y0 + th * 0.6); c.quadraticCurveTo(cx, y0 + th * 2, cx - w * 1.1, y0 + th * 0.6); c.closePath();
    c.fillStyle = '#ff6f91'; c.fill(); wearLine(c, G);
    c.strokeStyle = '#ffd2de'; c.lineWidth = s * 0.022;
    for (let i = -3; i <= 3; i++) { const x = cx + i * w * 0.28, yy = y0 + th * 0.55 + (1 - (i / 3.5) ** 2) * th * 0.7; c.beginPath(); c.moveTo(x - s * 0.01, yy - th * 0.45); c.lineTo(x + s * 0.01, yy + th * 0.45); c.stroke(); }
    c.restore();
    const tx = cx + w * 0.45, ty = y0 + th * 0.9;   // the end that hangs down
    c.beginPath(); c.moveTo(tx - s * 0.05, ty); c.lineTo(tx + s * 0.06, ty); c.lineTo(tx + s * 0.1 + sw, ty + s * 0.26); c.lineTo(tx - s * 0.01 + sw, ty + s * 0.27); c.closePath();
    c.fillStyle = '#ff6f91'; c.fill(); wearLine(c, G);
    c.strokeStyle = '#ffd2de'; c.lineWidth = s * 0.02; for (const k of [0.4, 0.7]) { c.beginPath(); c.moveTo(tx - s * 0.03 + k * s * 0.05 + sw * k, ty + k * s * 0.26); c.lineTo(tx + s * 0.08 + k * s * 0.02 + sw * k, ty + k * s * 0.26); c.stroke(); }
    c.strokeStyle = WINK; c.lineWidth = G.lw * 0.8; for (let i = 0; i < 4; i++) { const fx = tx + i * s * 0.03 + sw; c.beginPath(); c.moveTo(fx, ty + s * 0.27); c.lineTo(fx + s * 0.005, ty + s * 0.32); c.stroke(); }
  },
  specs(c, G, L) {
    const { cx, w, s } = G, er = s * 0.088 * (L.eyeS || 1), ey = G.cy - G.h * 0.06, exo = w * 0.42, r = er * 1.3;
    c.strokeStyle = '#c98a2c'; c.lineWidth = s * 0.026;
    for (const sd of [-1, 1]) { c.fillStyle = 'rgba(200,235,255,.22)'; c.beginPath(); c.arc(cx + sd * exo, ey, r, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.moveTo(cx + sd * (exo + r), ey - r * 0.2); c.lineTo(cx + sd * w * 0.98, ey - r * 0.5); c.stroke(); }
    c.beginPath(); c.moveTo(cx - exo + r, ey - r * 0.15); c.quadraticCurveTo(cx, ey - r * 0.6, cx + exo - r, ey - r * 0.15); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(cx + sd * exo - r * 0.4, ey - r * 0.45, r * 0.22, r * 0.1, -0.6, 0, TAU); c.fill(); }
  },
  explorer(c, G) {
    const { cx, w, s } = G, y = G.cy - G.h * 0.86;
    c.fillStyle = '#b07a43'; c.beginPath(); c.ellipse(cx, y, w * 0.95, s * 0.075, 0, 0, TAU); c.fill(); wearLine(c, G);
    c.fillStyle = '#c99158'; c.beginPath(); c.moveTo(cx - w * 0.55, y); c.bezierCurveTo(cx - w * 0.55, y - s * 0.3, cx + w * 0.55, y - s * 0.3, cx + w * 0.55, y); c.quadraticCurveTo(cx, y + s * 0.05, cx - w * 0.55, y); c.closePath(); c.fill(); wearLine(c, G);
    c.fillStyle = '#6a3f1d'; c.beginPath(); c.moveTo(cx - w * 0.55, y - s * 0.02); c.quadraticCurveTo(cx, y + s * 0.03, cx + w * 0.55, y - s * 0.02); c.lineTo(cx + w * 0.53, y - s * 0.08); c.quadraticCurveTo(cx, y - s * 0.03, cx - w * 0.53, y - s * 0.08); c.closePath(); c.fill();
    c.save(); c.translate(cx + w * 0.4, y - s * 0.07); c.rotate(0.7 + (G.still ? 0 : Math.sin(G.t * 2.2 + G.ph) * 0.06)); c.fillStyle = '#ff6b5a'; c.beginPath(); c.ellipse(0, -s * 0.14, s * 0.035, s * 0.15, 0, 0, TAU); c.fill(); c.strokeStyle = WINK; c.lineWidth = G.lw * 0.7; c.stroke(); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -s * 0.27); c.stroke(); c.restore();
  },
  wizard(c, G) {
    const { cx, w, s } = G, y = G.cy - G.h * 0.86, tip = { x: cx + w * 0.18, y: y - s * 0.62 };
    c.fillStyle = '#3b3fb8'; c.beginPath(); c.ellipse(cx, y, w * 0.85, s * 0.07, 0, 0, TAU); c.fill(); wearLine(c, G);
    c.beginPath(); c.moveTo(cx - w * 0.5, y); c.quadraticCurveTo(cx - w * 0.1, y - s * 0.3, tip.x, tip.y); c.quadraticCurveTo(cx + w * 0.2, y - s * 0.3, cx + w * 0.5, y); c.quadraticCurveTo(cx, y + s * 0.04, cx - w * 0.5, y); c.closePath(); c.fillStyle = '#4b50d8'; c.fill(); wearLine(c, G);
    c.fillStyle = '#ffe27a'; starPath(c, cx - w * 0.12, y - s * 0.14, s * 0.05, s * 0.022, 5, -Math.PI / 2); c.fill(); starPath(c, cx + w * 0.16, y - s * 0.3, s * 0.035, s * 0.015, 5, -Math.PI / 2); c.fill();
    c.beginPath(); c.arc(cx + w * 0.22, y - s * 0.08, s * 0.018, 0, TAU); c.fill();
    const lit = G.night ? 1 : 0.45; glow(c, tip.x, tip.y, s * 0.12 * (1 + lit), 50, 100, 75, 0.8 * lit); c.fillStyle = '#fff6c4'; c.beginPath(); c.arc(tip.x, tip.y, s * 0.03, 0, TAU); c.fill();
  }
};
Object.assign(WEAR_DRAW, {
  bobble(c, G) {
    const { cx, cy, w, h, s } = G, y = cy - h * 0.66, dome = () => { c.beginPath(); c.moveTo(cx - w * 0.72, y); c.bezierCurveTo(cx - w * 0.72, y - s * 0.34, cx + w * 0.72, y - s * 0.34, cx + w * 0.72, y); };
    c.save(); dome(); c.closePath(); c.fillStyle = '#e8434f'; c.fill(); c.clip(); c.fillStyle = '#fff'; for (const k of [0.1, 0.19]) c.fillRect(cx - w, y - s * k - s * 0.025, w * 2, s * 0.045); c.restore();
    dome(); wearLine(c, G);
    c.fillStyle = '#f6f2ff'; rrect(c, cx - w * 0.78, y - s * 0.05, w * 1.56, s * 0.1, s * 0.05); c.fill(); wearLine(c, G);
    c.strokeStyle = 'rgba(120,100,160,.5)'; c.lineWidth = s * 0.012; for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(cx + i * w * 0.115, y - s * 0.035); c.lineTo(cx + i * w * 0.115, y + s * 0.035); c.stroke(); }
    const py = y - s * 0.3 + (G.still ? 0 : Math.sin(G.t * 2.2 + G.ph + 0.6) * s * 0.01); c.fillStyle = '#fff'; c.beginPath();
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12, r = s * (i % 2 ? 0.075 : 0.09); c[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, py + Math.sin(a) * r); } c.closePath(); c.fill(); wearLine(c, G, 0.8);
  },
  crown(c, G) {
    const { cx, w, s } = G, y = G.cy - G.h * 0.86 + s * 0.02, hw = w * 0.62, ht = s * 0.16, n = 5;
    const path = () => { c.beginPath(); c.moveTo(cx - hw, y); for (let i = 0; i <= n * 2; i++) c.lineTo(cx - hw + i * hw / n, i % 2 ? y - ht : y - ht * 0.45); c.lineTo(cx + hw, y); c.closePath(); };
    path(); c.fillStyle = '#ff9ec4'; c.fill(); c.save(); c.clip(); c.fillStyle = 'rgba(255,255,255,.28)'; for (let i = 0; i < 5; i++) c.fillRect(cx - hw + i * hw * 0.45, y - ht, hw * 0.12, ht); c.restore();
    path(); c.strokeStyle = '#c4507e'; c.lineWidth = G.lw * 0.7; c.stroke();
  },
  souwester(c, G) {
    const { cx, w, s } = G, y = G.cy - G.h * 0.86 + s * 0.01;
    c.fillStyle = '#ffc928'; c.beginPath(); c.moveTo(cx - w * 0.95, y + s * 0.07); c.quadraticCurveTo(cx - w * 0.9, y - s * 0.04, cx - w * 0.6, y - s * 0.02); c.lineTo(cx + w * 0.6, y - s * 0.02); c.quadraticCurveTo(cx + w * 0.9, y - s * 0.03, cx + w * 1.0, y + s * 0.12); c.quadraticCurveTo(cx, y + s * 0.05, cx - w * 0.95, y + s * 0.07); c.closePath(); c.fill(); wearLine(c, G);
    c.beginPath(); c.moveTo(cx - w * 0.62, y); c.bezierCurveTo(cx - w * 0.6, y - s * 0.3, cx + w * 0.6, y - s * 0.3, cx + w * 0.62, y); c.quadraticCurveTo(cx, y + s * 0.04, cx - w * 0.62, y); c.closePath(); c.fillStyle = '#ffd84a'; c.fill(); wearLine(c, G);
    c.strokeStyle = 'rgba(160,110,0,.55)'; c.lineWidth = s * 0.014; c.beginPath(); c.moveTo(cx, y - s * 0.22); c.lineTo(cx, y + s * 0.01); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(cx - w * 0.28, y - s * 0.14, s * 0.05, s * 0.022, -0.5, 0, TAU); c.fill();
  },
  sunhat(c, G) {
    const { cx, w, s } = G, y = G.cy - G.h * 0.86;
    c.fillStyle = '#f2d38a'; c.beginPath(); c.ellipse(cx, y, w * 1.3, s * 0.1, -0.06, 0, TAU); c.fill(); wearLine(c, G);
    c.strokeStyle = 'rgba(160,110,40,.45)'; c.lineWidth = s * 0.01; for (const k of [0.75, 1.05]) { c.beginPath(); c.ellipse(cx, y, w * k, s * 0.1 * k / 1.3, -0.06, 0, TAU); c.stroke(); }
    c.beginPath(); c.moveTo(cx - w * 0.5, y); c.bezierCurveTo(cx - w * 0.5, y - s * 0.25, cx + w * 0.5, y - s * 0.25, cx + w * 0.5, y); c.quadraticCurveTo(cx, y + s * 0.04, cx - w * 0.5, y); c.closePath(); c.fillStyle = '#f7dc98'; c.fill(); wearLine(c, G);
    c.fillStyle = '#ff8fb3'; c.beginPath(); c.moveTo(cx - w * 0.5, y - s * 0.02); c.quadraticCurveTo(cx, y + s * 0.03, cx + w * 0.5, y - s * 0.02); c.lineTo(cx + w * 0.49, y - s * 0.075); c.quadraticCurveTo(cx, y - s * 0.03, cx - w * 0.49, y - s * 0.075); c.closePath(); c.fill();
    const fx = cx + w * 0.42, fy = y - s * 0.05; c.fillStyle = '#ff5f8a'; for (let p = 0; p < 5; p++) { const a = p * TAU / 5; c.beginPath(); c.arc(fx + Math.cos(a) * s * 0.035, fy + Math.sin(a) * s * 0.035, s * 0.028, 0, TAU); c.fill(); }
    c.fillStyle = '#fff3a0'; c.beginPath(); c.arc(fx, fy, s * 0.022, 0, TAU); c.fill();
  },
  shades(c, G, L) {
    if (G.mood === 'sleep') return;   // off for a nap
    const { cx, w, s } = G, er = s * 0.088 * (L.eyeS || 1), ey = G.cy - G.h * 0.06, exo = w * 0.42, r = er * 1.45;
    c.strokeStyle = '#ff5fa2'; c.lineWidth = s * 0.024;
    for (const sd of [-1, 1]) {
      c.fillStyle = 'rgba(30,14,60,.9)'; starPath(c, cx + sd * exo, ey, r, r * 0.55, 5, -Math.PI / 2); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(cx + sd * exo - r * 0.25, ey - r * 0.25, r * 0.18, r * 0.08, -0.6, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(cx + sd * (exo + r * 0.8), ey - r * 0.2); c.lineTo(cx + sd * w * 0.98, ey - r * 0.45); c.stroke();
    }
    c.beginPath(); c.moveTo(cx - exo + r * 0.5, ey - r * 0.2); c.quadraticCurveTo(cx, ey - r * 0.55, cx + exo - r * 0.5, ey - r * 0.2); c.stroke();
  },
  acorn(c, G) {
    const { cx, w, s } = G, y = G.cy - G.h * 0.86 + s * 0.01, r = w * 0.48;
    const cup = () => { c.beginPath(); c.moveTo(cx - r, y); c.bezierCurveTo(cx - r, y - s * 0.2, cx + r, y - s * 0.2, cx + r, y); c.quadraticCurveTo(cx, y + s * 0.05, cx - r, y); c.closePath(); };
    cup(); c.fillStyle = '#9a6a3a'; c.fill(); c.save(); c.clip(); c.strokeStyle = 'rgba(60,35,15,.55)'; c.lineWidth = s * 0.012;
    for (let i = -8; i <= 8; i++) for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(cx + i * s * 0.035, y + s * 0.05); c.lineTo(cx + i * s * 0.035 + sd * s * 0.15, y - s * 0.2); c.stroke(); }
    c.restore(); cup(); wearLine(c, G);
    c.strokeStyle = '#6b4320'; c.lineWidth = s * 0.035; c.beginPath(); c.moveTo(cx, y - s * 0.15); c.quadraticCurveTo(cx + s * 0.01, y - s * 0.24, cx + s * 0.07, y - s * 0.26); c.stroke();
    c.save(); c.translate(cx - r * 0.7, y - s * 0.08); c.rotate(-0.9); c.fillStyle = '#e8892c'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * 0.08, -s * 0.09, 0, -s * 0.2); c.quadraticCurveTo(-s * 0.08, -s * 0.09, 0, 0); c.fill(); c.strokeStyle = '#8a4a12'; c.lineWidth = G.lw * 0.6; c.stroke(); c.restore();
  },
  /* A sheet over the whole creature, with holes for its own eyes. Ears, wings and crowns poke out above it. */
  ghost(c, G, L) {
    const { cx, cy, w, h, s } = G, er = s * 0.088 * (L.eyeS || 1), ey = cy - h * 0.06, exo = w * 0.42, top = cy - h * 1.06, bot = L.float ? cy + h * 1.2 : cy + h * 1.02, W = w * 1.12;
    const sway = G.still ? 0 : Math.sin(G.t * 2.4 + G.ph) * s * 0.02;
    c.beginPath(); c.moveTo(cx - W + sway, bot); c.bezierCurveTo(cx - W * 1.02, cy - h * 0.2, cx - W * 0.8, top, cx, top); c.bezierCurveTo(cx + W * 0.8, top, cx + W * 1.02, cy - h * 0.2, cx + W + sway, bot);
    for (let i = 0; i < 5; i++) { const x1 = cx + W - (i + 1) * W * 2 / 5 + sway; c.quadraticCurveTo(x1 + W * 0.2, bot - s * (i % 2 ? 0.08 : -0.02), x1, bot); }
    c.closePath();
    for (const sd of [-1, 1]) { c.moveTo(cx + sd * exo + er * 1.15, ey); c.ellipse(cx + sd * exo, ey, er * 1.15, er * 1.35, 0, 0, TAU); }
    c.fillStyle = 'rgba(250,248,255,.93)'; c.fill('evenodd'); c.strokeStyle = 'rgba(120,100,170,.9)'; c.lineWidth = G.lw; c.stroke();
    c.fillStyle = 'rgba(255,140,170,.45)'; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(cx + sd * w * 0.7, ey + er * 1.6, er * 0.55, er * 0.32, 0, 0, TAU); c.fill(); }
    c.beginPath(); c.arc(cx, ey + er * 1.7, er * 0.4, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  }
});
/* Draws what a look wears, over the creature. G is drawCreature's own geometry. A hat perches to one side, smaller
   and tilted, when something already sits on top of the head, so a Mythic keeps its crown. */
function drawWear(c, L, G) {
  const on = L.wear; if (!on) return;
  for (const slot of WEAR_SLOTS) {
    const id = on[slot]; if (!id || !WEAR[id] || WEAR[id].slot !== slot) continue;
    if (slot === 'head' && headBusy(L)) {
      const ax = G.cx, ay = G.cy - G.h * 0.86; c.save(); c.translate(ax - G.w * 0.5, ay + G.h * 0.12); c.rotate(-0.42); c.scale(0.7, 0.7); c.translate(-ax, -ay);
      WEAR_DRAW[id](c, G, L); c.restore();
    } else WEAR_DRAW[id](c, G, L);
  }
}
/* A costume on its own, centred in a box of size s. */
function drawWearIcon(c, id, x, y, s) {
  const it = WEAR[id]; if (!it) return; const q = s * 1.05, w = q * 0.5, h = q * 0.46, L = { top: 0.62, eyeS: 1 };
  const G = { cx: x, cy: 0, w, h, s: q, lw: Math.max(1, q * 0.034), t: 0, ph: 0, still: true, night: false };
  if (it.slot === 'body') { G.s = q * 0.62; G.w = w * 0.62; G.h = h * 0.62; G.lw = Math.max(1, G.s * 0.034); G.cy = y; }
  else G.cy = it.slot === 'head' ? y + s * 0.2 + h * 0.86 : it.slot === 'face' ? y + h * 0.06 : y - h * 0.38;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; WEAR_DRAW[id](c, G, L); c.restore();
}

/* ---------- the wardrobe ---------- */
/* Opens on the Glimmerkin, or on the elder when who is 'elder'. */
function openWardrobe(who) {
  const e = elder(), forElder = who === 'elder' && !!e, cr = forElder ? e : S.pet, on = cr.wear || {};
  const card = id => { const it = WEAR[id], worn = on[it.slot] === id; return '<button class="card" data-do="wear" data-id="' + id + '"><canvas data-ic="thing:wear:' + id + '" data-size="52"></canvas><span class="tx"><strong>' + esc(it.name) + '</strong><small>' + SLOT_NAME[it.slot] + ' · ' + esc(it.text) + '</small></span><span class="tag' + (worn ? ' cost' : '') + '">' + (worn ? 'Take off' : 'Wear') + '</span></button>'; };
  const owned = WEAR_IDS.filter(wearOwned), want = WEAR_IDS.filter(id => !wearOwned(id));
  const tabs = e ? '<div class="btns" style="margin:0 0 6px"><button class="btn' + (forElder ? '' : ' main') + '" data-do="who" data-w="pet">' + esc(S.pet.name) + '</button><button class="btn' + (forElder ? ' main' : '') + '" data-do="who" data-w="elder">' + esc(e.name) + ', the elder</button></div>' : '';
  openSheet('<h2>Wardrobe</h2><p class="dim">' + esc(cr.name) + ' can wear one thing on its head, one at its neck and one on its face' + (wearOwned('ghost') ? ', and the ghost sheet over everything' : '') + '. Dressing up changes nothing else.</p>' + tabs +
    '<div style="display:flex;justify-content:center"><canvas data-ic="' + (forElder ? 'elder:' + (S.elders.length - 1) : 'kin') + '" data-size="120"></canvas></div><div class="list">' + owned.map(card).join('') +
    want.map(id => '<div class="card off"><canvas data-ic="thing:wear:' + id + '" data-size="52"></canvas><span class="tx"><strong>' + esc(WEAR[id].name) + '</strong><small>' + esc(wearWhere(id)) + '</small></span></div>').join('') +
    '</div><div class="btns"><button class="btn main" data-do="ok">Done</button></div>', {
    ok: closeSheet, who: d => openWardrobe(d.w),
    wear: d => {
      const id = d.id, it = WEAR[id]; if (!it || !wearOwned(id)) return;
      const w = Object.assign({}, cr.wear || {}); if (w[it.slot] === id) delete w[it.slot]; else w[it.slot] = id;
      if (Object.keys(w).length) cr.wear = w; else delete cr.wear;
      sfx('pick'); save(); refreshLooks(); openWardrobe(forElder ? 'elder' : 'pet');
    }
  });
}
/* Looks are cached where they are drawn; a change of clothes redraws them. */
function refreshLooks() { home.look = petLook(S.pet); if (home.elder) home.elder.look = petLook(elder()); if (GA) GA.look = petLook(S.pet); }
function wearJournal() {
  if (!unlocked('wardrobe')) return '';
  const n = WEAR_IDS.filter(wearOwned).length;
  return '<h3>Wardrobe · ' + n + ' of ' + WEAR_IDS.length + '</h3><div class="grid">' + WEAR_IDS.map(id => '<div class="cell' + (wearOwned(id) ? '' : ' unk') + '"><canvas data-ic="thing:wear:' + id + '" data-size="44"></canvas><span>' + (wearOwned(id) ? esc(WEAR[id].name) : '?') + '</span></div>').join('') + '</div>';
}
