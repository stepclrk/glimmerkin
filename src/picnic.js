/* ===== The picnic basket: berries packed for a quest =====
   Once treats have opened, Where to? has a picnic basket under the party: up to three berries from the pantry. They
   leave the pantry as the party sets out, and in the world a berry from the basket can go to a little from its chip in
   the bar: two sparks for its own kind's berry (either kind, for a twin), one for any other, never past the most it
   can carry. Whatever is left comes home to the pantry, finished or not, so nothing is lost. The basket stays packed
   the same way for next time, as far as the pantry allows. Saved as `basket` (the berries packed, by kind) and
   `j.picnics` (berries eaten from it). Every world is still budgeted without the basket, so it only ever helps. */
const BASKET_MAX = 3;
const basketOpen = () => unlocked('treats');
function ensureBasket() { S.basket = Array.isArray(S.basket) ? S.basket.filter(el => ELS.includes(el)).slice(0, BASKET_MAX) : []; }
/* What will actually go: the packed berries the pantry holds now. */
function basketReady() {
  const left = Object.assign({}, S.pantry), out = [];
  for (const el of S.basket) if ((left[el] || 0) > 0) { left[el]--; out.push(el); }
  return out;
}
function basketBlock() {
  if (!basketOpen()) return '';
  const ready = basketReady(), slots = [];
  for (let i = 0; i < BASKET_MAX; i++) { const el = S.basket[i], ok = el && ready.includes(el);
    slots.push(el ? '<button class="pick in" data-do="unpack" data-i="' + i + '" aria-label="Take the ' + BERRY[el] + ' out"' + (ok ? '' : ' style="opacity:.4"') + '><canvas data-ic="berry:' + el + '" data-size="30"></canvas>' + BERRY[el] + '</button>' : '<button class="pick" disabled style="opacity:.5"><span style="font-size:22px;line-height:30px">+</span>Empty</button>'); }
  const pantry = ELS.filter(el => (S.pantry[el] || 0) > S.basket.filter(b => b === el).length);
  return '<h3>Picnic basket · ' + S.basket.length + ' of ' + BASKET_MAX + '</h3><p class="dim">Pack berries to give your littles sparks on the way: two for a little\'s own berry, one for any other. Anything left comes home.</p><div class="party">' + slots.join('') + '</div>' +
    (S.basket.length < BASKET_MAX ? (pantry.length ? '<div class="foods" style="margin-top:6px">' + pantry.map(el => '<button class="food" data-do="pack" data-el="' + el + '" aria-label="Pack a ' + BERRY[el] + '"><canvas data-ic="berry:' + el + '" data-size="26"></canvas>' + ((S.pantry[el] || 0) - S.basket.filter(b => b === el).length) + '</button>').join('') + '</div>' : '<p class="dim">The pantry has no more berries to pack.</p>') : '');
}
function basketPack(el) { if (S.basket.length >= BASKET_MAX || !ELS.includes(el) || (S.pantry[el] || 0) <= S.basket.filter(b => b === el).length) return; S.basket.push(el); sfx('pick'); save(); }
function basketUnpack(i) { if (i < 0 || i >= S.basket.length) return; S.basket.splice(i, 1); sfx('pick'); save(); }
/* As the party sets out: the berries leave the pantry and go in the quest's basket. */
function basketSetOut() {
  if (!basketOpen()) return []; const out = basketReady();
  for (const el of out) S.pantry[el]--;
  return out;
}
/* Whatever is left comes home. */
function basketHome(q) { for (const el of q.basket || []) S.pantry[el] = (S.pantry[el] || 0) + 1; const n = (q.basket || []).length; q.basket = []; return n; }
const basketGain = (f, el) => f.kinds.includes(el) ? 2 : 1;
/* The rows a little's chip sheet offers: one for each kind of berry in the basket. */
function basketRows(f) {
  const q = Q; if (!q || !q.basket || !q.basket.length) return '';
  return [...new Set(q.basket)].map(el => { const n = basketGain(f, el), full = f.sp >= f.max, ok = !full && !f.stationed && !q.busy, c = q.basket.filter(b => b === el).length;
    return '<button class="card' + (ok ? '' : ' off') + '" data-do="feed" data-el="' + el + '"' + (ok ? '' : ' disabled') + '><canvas data-ic="berry:' + el + '" data-size="44"></canvas><span class="tx"><strong>Give it a ' + BERRY[el] + '</strong><small>' + (full ? 'Already full of sparks' : f.stationed ? 'Holding the moon plate' : (n > 1 ? 'Its favourite: 2 sparks' : '1 spark')) + '</small></span><span class="tag">' + c + ' packed</span></button>'; }).join('');
}
function basketFeed(f, el) {
  const q = Q; if (!q || !q.basket) return; const i = q.basket.indexOf(el); if (i < 0 || f.sp >= f.max || f.stationed || q.busy) return;
  q.basket.splice(i, 1); const n = Math.min(basketGain(f, el), f.max - f.sp); f.sp += n; S.j.picnics = (S.j.picnics || 0) + 1;
  const [mx, my] = [q.ox + (f.x + 0.5) * q.ts, q.oy + (f.y + 0.4) * q.ts]; burst(mx, my, 14, EL_HUE[el] !== undefined ? EL_HUE[el] : 46, { kind: 'star', v: 120, size: 5 });
  floatText(mx, my - 10, '+' + n + (n > 1 ? ' sparks' : ' spark')); sfx('chomp'); q.bag = null; updateQuestBar(); updateQuestHud();
}
/* In the bag: the basket's berries after the tools. */
function basketBag(q) { if (!q.basket || !q.basket.length) return ''; return [...new Set(q.basket)].map(el => '<span data-berry="' + el + '" aria-label="' + BERRY[el] + ' in the picnic basket"><canvas data-ic="berry:' + el + '" data-size="22"></canvas>' + q.basket.filter(b => b === el).length + '</span>').join(''); }
