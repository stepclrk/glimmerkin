/* ===== Boot: sizing, input, frame loop ===== */
function measure() {
  const r = app.getBoundingClientRect(); VW = Math.max(280, r.width); VH = Math.max(360, r.height); DPR = Math.min(2.5, window.devicePixelRatio || 1);
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  topIn = ui.hud.offsetTop + ui.hud.offsetHeight; botIn = VH - ui.bar.offsetTop;
  ui.toast.style.top = (topIn + 10) + 'px';
  if (scene === 'quest') layoutQuest(); else layoutHome();
}
window.addEventListener('resize', measure);
const ptOf = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
let down = null;
cv.addEventListener('pointerdown', e => { unlockAudio(); const p = ptOf(e); down = { id: e.pointerId, x: p.x, y: p.y, moved: 0 }; try { cv.setPointerCapture(e.pointerId); } catch (_) { } if (scene === 'home') homeDown(p); });
cv.addEventListener('pointermove', e => { if (!down || e.pointerId !== down.id) return; const p = ptOf(e); down.moved += Math.hypot(p.x - down.x, p.y - down.y); down.x = p.x; down.y = p.y; if (scene === 'home') homeMove(p); });
const onUp = e => { if (!down || e.pointerId !== down.id) return; const d = down; down = null; if (scene === 'home') homeUp(); else if (d.moved < 14 && e.type === 'pointerup') questTap({ x: d.x, y: d.y }); };
cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

let lastMs = 0, statAcc = 0, saveAcc = 0;
function frame(ms) {
  const dt = Math.min(0.05, lastMs ? (ms - lastMs) / 1000 : 0.016); lastMs = ms; T += dt;
  stepAnims(dt);
  try { if (scene === 'quest' && Q) drawQuest(dt); else drawHome(dt); drawParts(ctx, dt); } catch (e) { if (!frame.err) { frame.err = true; console.error(e); } }
  statAcc += dt; if (statAcc >= 1) { statAcc = 0; tickStats(); if (scene === 'home') updateHud(); saveAcc++; if (saveAcc >= 20) { saveAcc = 0; saveLocal(); } }
  requestAnimationFrame(frame);
}
function afterLoad() {
  S.eggs = S.eggs || []; S.pantry = S.pantry || {}; S.pet.diet = S.pet.diet || {}; S.quests = S.quests || 0; if (S.sound === undefined) S.sound = true;
  if (S.dust === undefined) S.dust = Math.round(S.pet.xp || 0); S.tools = S.tools || {}; S.charms = S.charms || {}; S.toys = S.toys || {}; S.decor = S.decor || []; S.chimes = S.chimes || 0; S.maps = S.maps || 0; S.pet.marks = S.pet.marks || []; S.pet.ate = S.pet.ate || {};
  S.j = S.j || {}; for (const k of ['kinds', 'biomes', 'glooms', 'things']) S.j[k] = S.j[k] || {}; S.littles.forEach(l => kindsOf(l).forEach(k => { S.j.kinds[k] = true; }));
  if (stageOf(petLevel(S.pet.xp)) >= 3 && !S.pet.form) S.pet.form = formFor(S.pet, S.j.biomes);   // a Mythic from before forms existed
  partyLittles(); const away = tickStats(); rollPortals(); ensureWish(); Q = null; scene = 'home'; closeSheet(); setSceneUI(); rebuildHome(); updateHud(); return away;
}
function start(data) {
  const local = data && data.v === 1 && data.pet && data.littles ? data : loadLocal();
  fresh = !local; S = local || newGame(); loadStamp = S.savedAt || 0; const away = afterLoad(); paintIcons(document);
  setTimeout(() => toast(fresh ? 'This is ' + S.pet.name + '. Stroke it, feed it, then find a portal.' : away ? S.pet.name + ' missed you.' : S.pet.name + ' is glad to see you.', 4600), 500);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => { });
  window.addEventListener('load', measure);
  document.addEventListener('visibilitychange', () => { if (document.hidden && S) { saveLocal(); clearTimeout(cloudTimer); pushCloud(); } });
  initCloud(); requestAnimationFrame(frame);
}
window.__glim = { get S() { return S; }, get Q() { return Q; }, startQuest, finishQuest, questTap, save };
try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => S); } catch (e) { }
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start); else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
</script>
</body>
</html>
