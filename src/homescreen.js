/* ===== The home screen: offering, on a phone, to keep the game on its home screen. Hosted site only ===== */
// Asked once per device, so it lives in this browser rather than in the save, which follows the player around.
const HOMESCREEN_KEY = 'glimmerkin.homescreen';
let installAsk = null;   // Chrome's own install prompt, held until the player asks for it
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installAsk = e; });
window.addEventListener('appinstalled', () => { installAsk = null; homescreenAsked(); });
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function onHomescreen() { return !!((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone); }
function homescreenAsked() { try { localStorage.setItem(HOMESCREEN_KEY, '1'); } catch (e) { } }
function homescreenSeen() { try { return !!localStorage.getItem(HOMESCREEN_KEY); } catch (e) { return true; } }
// Phones and tablets only: a computer's browser has its own install button, and "home screen" means nothing there.
function canHomescreen() { return HOSTED && !onHomescreen() && (IOS || !!installAsk || !!(window.matchMedia && matchMedia('(pointer: coarse)').matches)); }

// Counted as asked when a button is pressed, so a sheet closed by an account copy arriving is offered again next time.
function openHomescreen() {
  const head = '<h2>Keep Glimmerkin on your home screen</h2><div class="card"><canvas data-ic="phone" data-size="64"></canvas><div class="tx"><strong>One tap to ' + esc(S.pet.name) + '</strong><small>It opens full screen, straight into the nest, like an app. Nothing to download.</small></div></div>';
  const step = (n, text) => '<div class="card"><span class="step">' + n + '</span><div class="tx"><small>' + text + '</small></div></div>';
  if (installAsk) {
    return openSheet(head + '<div class="btns"><button class="btn" data-do="no">Not now</button><button class="btn main" data-do="add">Add to home screen</button></div>', {
      no: () => { homescreenAsked(); closeSheet(); },
      add: async () => {
        const ask = installAsk; installAsk = null; homescreenAsked(); closeSheet();
        try { await ask.prompt(); const r = await ask.userChoice; if (r && r.outcome === 'accepted') toast(S.pet.name + ' is on your home screen now.'); } catch (e) { }
      }
    });
  }
  const steps = IOS
    ? [step(1, 'Tap <b>Share</b>: the square with an arrow pointing up. If you cannot see it, tap <b>···</b> first.'), step(2, 'Scroll down and tap <b>Add to Home Screen</b>.'), step(3, 'Tap <b>Add</b>.')]
    : [step(1, 'Open your browser’s menu: <b>⋮</b> or <b>≡</b>.'), step(2, 'Tap <b>Add to home screen</b> or <b>Install app</b>.'), step(3, 'Tap <b>Add</b> or <b>Install</b>.')];
  openSheet(head + '<h3>How to add it</h3><div class="list">' + steps.join('') + '</div><div class="btns"><button class="btn main" data-do="ok">Got it</button></div>', { ok: () => { homescreenAsked(); closeSheet(); } });
}
/* Offered once, to a player who has come back after finishing a quest, at a start with nothing else to show. */
function offerHomescreen() {
  if (!S || S.quests < 1 || homescreenSeen() || !canHomescreen() || scene !== 'home' || !ui.sheet.hidden) return false;
  openHomescreen(); return true;
}

/* New builds. A phone keeps the game open in the background, above all one opened from the home screen, and its
   browser never reloads it, so a copy can run for days after a newer build is out. The hosted page says which build
   it is; the game asks the server for the current one when it comes back into view and every few minutes, and when
   there is a newer one it saves and reloads, at the nest, between things. */
const BUILD = ((document.querySelector('meta[name="glimmerkin-build"]') || {}).content) || '';
let buildAsked = 0, buildNew = false, lastTouch = Date.now();
document.addEventListener('pointerdown', () => { lastTouch = Date.now(); }, true);
async function checkBuild() {
  if (!BUILD || !HOSTED) return;
  if (!buildNew && Date.now() - buildAsked > 60000) {
    buildAsked = Date.now();
    try { const r = await fetch('/build.json', { cache: 'no-store' }); const d = r.ok ? await r.json() : null; buildNew = !!(d && d.build && d.build !== BUILD); } catch (e) { return; }
  }
  if (buildNew) reloadForBuild();
}
// Only at the nest with no sheet open, and not while a finger is on the screen or has just been.
function reloadForBuild() {
  if (scene !== 'home' || !ui.sheet.hidden || down || (!document.hidden && Date.now() - lastTouch < 8000)) return;
  if (S) saveLocal();
  location.reload();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastTouch = 0; checkBuild(); } });
setInterval(checkBuild, 20000);
