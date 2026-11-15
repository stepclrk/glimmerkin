/* ===== The back button: one step back through the game, and out only from the nest ===== */
// Android's back button (and the browser's) walks the page's history, so with nothing in it the first press leaves
// the game. While anything is open, a sheet, the berry tray, a quest, the garden or a bonus world, the game keeps a
// few entries of its own in the history, all at the same address, so a press lands here as a popstate and steps back
// one level instead. At the nest with nothing open there are none, and the press leaves the game as it always has.
//
// Chrome skips history entries a page adds without a tap since the last back or forward, so that a page cannot trap
// the back button. An entry added straight after a press would be skipped, and the next press would leave the game.
// So entries are only added once the player has touched the game since the last step through the history, and a few
// at a time (BACK_SPARE), enough for several presses in a row. Spares left over when the game is back at the bare
// nest are taken off again, so that one press still leaves. Hosted site only: inside Claude the game sits in a frame
// whose history belongs to the page around it.
const BACK_SPARE = 4;
const backNav = { on: HOSTED && !!(window.history && history.pushState), armed: false, trim: false, level: 0, trimT: 0 };
const backLevel = () => { const s = history.state; return s && typeof s.glim === 'number' ? s.glim : 0; };
// Anything a back press could close or leave.
const backBusy = () => scene !== 'home' || !ui.sheet.hidden || !ui.tray.hidden;
// One step back, as the player would take it with a tap.
function backStep() {
  if (!ui.sheet.hidden) {
    if (ui.sheet.dataset.lock) return;                                         // a choice that has to be made
    const up = [...ui.sheet.querySelectorAll('.btns button')].find(b => /^Back\b/.test(b.textContent.trim()));
    if (up) up.click(); else closeSheet();                                    // back to the sheet it came from, or closed
  } else if (!ui.tray.hidden) ui.tray.hidden = true;
  else if (scene === 'bonus') { const b = ui.barBonus.querySelector('[data-b="leave"]'); if (b) b.click(); }
  else if (scene === 'garden') { const b = ui.barGarden.querySelector('[data-g="leave"]'); if (b) b.click(); }
  else if (scene === 'quest') { const b = ui.barQuest.querySelector('[data-q="leave"]'); if (b) b.click(); }   // asks "Head home?"
}
// Keep the history in step with the game: spares while something is open, none at the bare nest.
function backSync() {
  if (!backNav.on || backNav.trim) return;
  const n = backLevel();
  if (!backBusy()) {
    if (n > 0) { backNav.trim = true; backNav.armed = false; clearTimeout(backNav.trimT); backNav.trimT = setTimeout(() => { backNav.trim = false; backNav.level = backLevel(); }, 1500); history.go(-n); }
    return;
  }
  if (!backNav.armed || n >= BACK_SPARE) return;
  try { for (let i = n + 1; i <= BACK_SPARE; i++) history.pushState({ glim: i }, ''); backNav.level = BACK_SPARE; } catch (e) { backNav.on = false; }
}
if (backNav.on) {
  // A page reloaded in the middle of things starts again at the nest: this entry is where the game begins.
  try { if (backLevel()) history.replaceState(null, ''); } catch (e) { backNav.on = false; }
  for (const t of ['pointerdown', 'keydown']) window.addEventListener(t, () => { backNav.armed = true; }, true);
  window.addEventListener('popstate', () => {
    const was = backNav.level, n = backNav.level = backLevel();
    if (backNav.trim) { if (!n) { backNav.trim = false; clearTimeout(backNav.trimT); } return; }   // the game's own tidying up
    backNav.armed = false;
    if (n < was && backBusy()) { unlockAudio(); backStep(); }                 // a forward press steps nothing
    backSync();
  });
}
