/* ===== Dressing up: the wardrobe and the costumes, drawn on the Glimmerkin and the elder ===== */
/* A costume is worn in one of three places: on the head, at the neck or on the face. What is owned belongs to the
   nest (S.wardrobe); what is worn belongs to each creature (pet.wear, and each elder's own). Dressing up changes
   nothing in care, quests or the balance of the game. */
const WEAR = {
  scarf: { name: 'Knitted scarf', slot: 'neck', text: 'Stripy, and long enough to trail.', price: 0 },
  specs: { name: 'Round spectacles', slot: 'face', text: 'For reading the journal.', price: 20, shop: true },
  explorer: { name: 'Explorer\'s hat', slot: 'head', text: 'With a feather from Cloudspire.', price: 30, shop: true },
  wizard: { name: 'Wizard\'s hat', slot: 'head', text: 'The star on top glows after dark.', price: 35, shop: true }
};
const WEAR_IDS = Object.keys(WEAR);
const WEAR_SLOTS = ['head', 'neck', 'face'];
const SLOT_NAME = { head: 'Head', neck: 'Neck', face: 'Face' };
const WEAR_TRADER = 0.35;     // chance the trader carries a costume not yet owned

function ensureWardrobe() { S.wardrobe = Array.isArray(S.wardrobe) ? S.wardrobe.filter(id => WEAR[id]) : []; }
/* The scarf is the wardrobe's gift: owned as soon as the wardrobe opens. */
const wearOwned = id => id === 'scarf' ? unlocked('wardrobe') : S.wardrobe.includes(id);

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
/* Draws what a look wears, over the creature. G is drawCreature's own geometry. A hat perches to one side, smaller
   and tilted, when something already sits on top of the head, so a Mythic keeps its crown. */
function drawWear(c, L, G) {
  const on = L.wear; if (!on) return;
  for (const slot of ['neck', 'face', 'head']) {
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
  G.cy = it.slot === 'head' ? y + s * 0.2 + h * 0.86 : it.slot === 'face' ? y + h * 0.06 : y - h * 0.38;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; WEAR_DRAW[id](c, G, L); c.restore();
}

/* ---------- the wardrobe ---------- */
/* Opens on the Glimmerkin, or on the elder when who is 'elder'. */
function openWardrobe(who) {
  const e = elder(), forElder = who === 'elder' && !!e, cr = forElder ? e : S.pet, on = cr.wear || {};
  const card = id => { const it = WEAR[id], worn = on[it.slot] === id; return '<button class="card" data-do="wear" data-id="' + id + '"><canvas data-ic="thing:wear:' + id + '" data-size="52"></canvas><span class="tx"><strong>' + esc(it.name) + '</strong><small>' + SLOT_NAME[it.slot] + ' · ' + esc(it.text) + '</small></span><span class="tag' + (worn ? ' cost' : '') + '">' + (worn ? 'Take off' : 'Wear') + '</span></button>'; };
  const owned = WEAR_IDS.filter(wearOwned), want = WEAR_IDS.filter(id => !wearOwned(id));
  const tabs = e ? '<div class="btns" style="margin:0 0 6px"><button class="btn' + (forElder ? '' : ' main') + '" data-do="who" data-w="pet">' + esc(S.pet.name) + '</button><button class="btn' + (forElder ? ' main' : '') + '" data-do="who" data-w="elder">' + esc(e.name) + ', the elder</button></div>' : '';
  openSheet('<h2>Wardrobe</h2><p class="dim">' + esc(cr.name) + ' can wear one thing on its head, one at its neck and one on its face. Dressing up changes nothing else.</p>' + tabs +
    '<div style="display:flex;justify-content:center"><canvas data-ic="' + (forElder ? 'elder:' + (S.elders.length - 1) : 'kin') + '" data-size="120"></canvas></div><div class="list">' + owned.map(card).join('') +
    want.map(id => '<div class="card off"><canvas data-ic="thing:wear:' + id + '" data-size="52"></canvas><span class="tx"><strong>' + esc(WEAR[id].name) + '</strong><small>Sometimes with the wandering trader.</small></span></div>').join('') +
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
