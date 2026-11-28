/* ===== The hatchery: berries choose what an egg hatches =====
   Once treats have opened, an egg in the nest that has no kinds of its own yet (not a friends' egg, and not one from a
   bonus world) can be given berries to choose what hatches: 6 berries of one kind and it hatches a little of that
   kind; 6 of each of two kinds and it hatches a twin with both. A twin egg hatches a twin anyway, so it takes 3 of each
   of its two kinds. The berries go at once, and the egg keeps the kinds (`kinds` and `chose` on the egg) until it
   hatches; it still has to be rubbed warm. Eggs in the burrow are chosen for once brought up to the nest. The journal
   counts eggs chosen for (`j.chosen`). */
const HATCH_ONE = 6, HATCH_TWIN = 3;
const hatcheryOpen = () => unlocked('treats');
const eggChoosable = e => !!e && !e.kinds && hatcheryOpen();
let hatchSel = [];
/* What a choice costs, by kind: a single kind on a plain egg, two kinds on any egg. */
function hatchCost(e, sel) {
  if (!sel.length || (e.twin && sel.length < 2)) return null;
  const each = sel.length > 1 ? (e.twin ? HATCH_TWIN : HATCH_ONE) : HATCH_ONE; return Object.fromEntries(sel.map(k => [k, each]));
}
const hatchCan = (cost) => !!cost && Object.keys(cost).every(k => (S.pantry[k] || 0) >= cost[k]);
function eggLabel(e) {
  if (e.kinds && e.chose) return 'Will hatch ' + (e.kinds.length > 1 ? 'a twin: ' + KINDS[e.kinds[0]].species + ' and ' + KINDS[e.kinds[1]].species : 'a ' + KINDS[e.kinds[0]].species) + '. Rub to warm.';
  if (e.kinds && e.from) return 'A friends\' egg from ' + e.from.join(' and ') + '. Rub to warm.';
  if (e.kinds) return 'Will hatch ' + (e.kinds.length > 1 ? 'a twin' : 'a ' + KINDS[e.kinds[0]].species) + '. Rub to warm.';
  return (e.twin ? 'A twin egg. ' : '') + (hatcheryOpen() ? 'Choose what hatches with berries, or let it surprise you.' : 'Rub to warm.');
}
function eggsSection() {
  if (!S.eggs.length) return '';
  return '<h3>Eggs in the nest · ' + S.eggs.length + '</h3><div class="list">' + S.eggs.map((e, i) => '<button class="card' + (eggChoosable(e) ? '' : ' off') + '" data-do="egg" data-i="' + i + '"' + (eggChoosable(e) ? '' : ' disabled') + '><canvas data-ic="' + (e.twin ? 'thing:egg:twin' : 'egg:' + e.hue) + '" data-size="48"></canvas><span class="tx"><strong>' + (e.twin ? 'Twin egg' : 'Egg') + ', ' + Math.min(100, Math.round(e.warm || 0)) + '% warm</strong><small>' + esc(eggLabel(e)) + '</small></span>' + (eggChoosable(e) ? '<span class="tag cost">Choose</span>' : '') + '</button>').join('') + '</div>';
}
function openHatchery(i, fresh) {
  const e = S.eggs[i]; if (!eggChoosable(e)) return; if (fresh) hatchSel = [];
  const cost = hatchCost(e, hatchSel), ok = hatchCan(cost), most = 2;
  const pick = k => { const inn = hatchSel.includes(k), have = S.pantry[k] || 0; return '<button class="pick' + (inn ? ' in' : '') + '" data-do="kind" data-k="' + k + '" aria-pressed="' + inn + '"><canvas data-ic="kind:' + k + '" data-size="40"></canvas>' + KINDS[k].species + '<small style="display:block;font-weight:600;opacity:.8"><canvas data-ic="berry:' + k + '" data-size="14"></canvas> ' + have + '</small></button>'; };
  const what = !hatchSel.length ? (e.twin ? 'Pick two kinds for the twin.' : 'Pick one kind, or two for a twin.') : e.twin && hatchSel.length < 2 ? 'A twin egg needs two kinds. Pick one more.' : 'It will hatch ' + (hatchSel.length > 1 ? 'a twin, ' + KINDS[hatchSel[0]].species + ' and ' + KINDS[hatchSel[1]].species : 'a ' + KINDS[hatchSel[0]].species) + '. That takes ' + Object.keys(cost).map(k => cost[k] + ' ' + BERRY[k].replace(/y$/, 'ie') + 's').join(' and ') + (ok ? '.' : ', and the pantry is short.');
  openSheet('<h2>Choose what hatches</h2><div class="card"><canvas data-ic="' + (e.twin ? 'thing:egg:twin' : 'egg:' + e.hue) + '" data-size="56"></canvas><div class="tx"><strong>' + (e.twin ? 'Twin egg' : 'Egg') + '</strong><small>Set berries beside it as it warms, and it hatches the kind they belong to: ' + HATCH_ONE + ' of one kind for that kind, ' + (e.twin ? HATCH_TWIN + ' of each of two kinds, since it is a twin egg.' : HATCH_ONE + ' of each of two kinds for a twin.') + ' Or leave it, and it will surprise you.</small></div></div>' +
    '<div class="party" style="flex-wrap:wrap;margin-top:10px">' + ELS.map(pick).join('') + '</div><p style="margin-top:8px">' + esc(what) + '</p>' +
    '<div class="btns"><button class="btn" data-do="back">Back</button><button class="btn main" data-do="set"' + (ok ? '' : ' disabled') + '>Set the berries</button></div>',
    { back: () => openLittles(),
      kind: d => { const k = d.k; if (hatchSel.includes(k)) hatchSel = hatchSel.filter(x => x !== k); else { hatchSel.push(k); if (hatchSel.length > most) hatchSel.shift(); } openHatchery(i); },
      set: () => hatchChoose(i, hatchSel) });
}
function hatchChoose(i, sel) {
  const e = S.eggs[i], cost = e && hatchCost(e, sel); if (!eggChoosable(e) || !hatchCan(cost)) return;
  for (const k in cost) S.pantry[k] -= cost[k];
  e.kinds = sel.slice(); e.chose = true; S.j.chosen = (S.j.chosen || 0) + 1; hatchSel = [];
  sfx('grow'); save(); rebuildHome(); closeSheet();
  toast('The egg glows ' + (sel.length > 1 ? 'in two colours' : 'softly') + '. It will hatch ' + (sel.length > 1 ? 'a twin: ' + KINDS[sel[0]].species + ' and ' + KINDS[sel[1]].species : 'a ' + KINDS[sel[0]].species) + '. Rub it to warm it.', 4200);
}
