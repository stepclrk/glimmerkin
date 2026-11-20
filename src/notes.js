/* ===== Notes from the nest (section 5, Notes). Hosted site only =====
   The installed game can leave a note on the phone when something nice happens. Nothing is sent from the server and
   nothing leaves the device: the page writes a short list of what is coming (when a little's next picture is due, a
   December gift, a flower about to open, the next today's world) into the device's cache, and the service worker
   (src/sw.js) looks at it when the browser wakes it in the background (periodic background sync) and shows at most
   one note a day, between 8:00 and 20:00, never about hunger or tiredness. Every kind of note is off until the player
   turns it on here; the choice is kept on this device only (`glimmerkin.notes`), not in the save. */
const NOTE_KINDS = {
  home: { name: 'A little sends a picture', text: 'From its adventure, every 10 days' },
  gift: { name: 'A December gift', text: 'When one is waiting on its cloud' },
  bloom: { name: 'Flowers in bloom', text: 'When a flower you tended opens in the garden' },
  today: { name: 'Today\'s world', text: 'Each morning at 8, when the new world opens' }
};
const NOTES_KEY = 'glimmerkin.notes', NOTES_CACHE = 'glimmerkin-notes', NOTES_DOC = '/play/notes.json', NOTES_TAG = 'glimmerkin-notes';
const NOTES_AHEAD = 30 * 86400000;   // how far ahead the list looks
function notePrefs() { try { const p = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); return p && typeof p === 'object' ? p : {}; } catch (e) { return {}; } }
function setNotePrefs(p) { try { localStorage.setItem(NOTES_KEY, JSON.stringify(p)); } catch (e) { } }
const notesOn = () => Object.keys(NOTE_KINDS).some(k => notePrefs()[k]);
/* Whether notes can work here: the hosted page, with a service worker, notifications and background sync. */
const notesCan = () => HOSTED && !!navigator.serviceWorker && 'Notification' in window && typeof ServiceWorkerRegistration !== 'undefined' && 'periodicSync' in ServiceWorkerRegistration.prototype;

/* What is coming, as { kind, at, title, body }, soonest first. */
function noteEvents(now) {
  now = now || Date.now(); const out = [], end = now + NOTES_AHEAD, at8 = d => { const x = new Date(d); x.setHours(8, 0, 0, 0); return x.getTime(); };
  for (const a of S.away || []) for (let n = a.pics.length; n < Math.min(AWAY_PICS, a.pics.length + 3); n++) { const t = a.left + (n + 1) * PIC_GAP; if (t <= end) out.push({ kind: 'home', at: t, title: a.name + ' has sent a picture', body: 'From its adventure. Tap to see it.' }); }
  const y = new Date(now).getFullYear(), got = S.advent && S.advent.y === y ? S.advent.got : [];
  for (let day = 1; day <= GIFT_DAYS; day++) { const t = at8(new Date(y, 11, day)); if (t >= now - 86400000 && t <= end && !got.includes(day)) out.push({ kind: 'gift', at: t, title: 'A December gift is waiting', body: 'It is on its cloud by the nest.' }); }
  if (S.garden) for (const b of allBeds()) if (b.t && b.st === 2) { const t = bedDue(b); if (t <= end) out.push({ kind: 'bloom', at: t, title: 'A flower is in bloom', body: 'The ' + FLOWERS[b.el].name + ' has opened in ' + S.pet.name + '\'s garden.' }); }
  if (unlocked('today')) for (let d = 0; d < 7; d++) { const t = at8(now + d * 86400000); if (t > now) out.push({ kind: 'today', at: t, title: 'Today\'s world is open', body: 'A new world waits under Where to?' }); }
  return out.sort((a, b) => a.at - b.at);
}
/* Writes the list for the service worker. Called a moment after each save while any note is on. */
let notesTimer = 0;
function notesSync() {
  if (!notesCan() || !window.caches) return; clearTimeout(notesTimer);
  notesTimer = setTimeout(() => {
    const prefs = notePrefs(), doc = { prefs, name: S.pet.name, events: notesOn() ? noteEvents().filter(e => prefs[e.kind]) : [] };
    caches.open(NOTES_CACHE).then(c => c.put(NOTES_DOC, new Response(JSON.stringify(doc), { headers: { 'Content-Type': 'application/json' } }))).catch(() => { });
  }, 1500);
}
/* Turning a kind on asks for notifications (from the tap) and for background sync; the sheet says what came of it. */
async function notesSwitch(kind) {
  const p = notePrefs(), on = !p[kind]; let why = '';
  if (on) {
    if (!notesCan()) why = 'Notes work in the game kept on a phone\'s home screen, in Chrome on Android.';
    else {
      const perm = Notification.permission === 'default' ? await Notification.requestPermission().catch(() => 'denied') : Notification.permission;
      if (perm !== 'granted') why = 'Notes are blocked for this site. Allow notifications for it in the phone\'s settings, then try again.';
      else try { const reg = await navigator.serviceWorker.ready; await reg.periodicSync.register(NOTES_TAG, { minInterval: 12 * 3600000 }); } catch (e) { why = 'This phone only lets the game send notes once it is kept on the home screen. Add it there first.'; }
    }
  }
  if (!why) { p[kind] = on; setNotePrefs(p); notesSync(); if (!notesOn() && notesCan()) navigator.serviceWorker.ready.then(r => r.periodicSync.unregister(NOTES_TAG)).catch(() => { }); }
  openNotes(why);
}
function notesAllOff() { setNotePrefs({}); notesSync(); if (notesCan()) navigator.serviceWorker.ready.then(r => r.periodicSync.unregister(NOTES_TAG)).catch(() => { }); openNotes(''); }
function openNotes(why) {
  const p = notePrefs(), tog = on => '<span class="switch' + (on ? ' on' : '') + '" aria-hidden="true"><b></b></span>';
  openSheet('<h2>Notes from the nest</h2><p>The game can leave a note on this phone when something nice happens. At most one a day, never before 8 or after 8 in the evening, and never about hunger or tiredness.</p>' + (why ? '<p class="dim" style="color:var(--lantern)">' + esc(why) + '</p>' : !notesCan() ? '<p class="dim">Notes work in the game kept on a phone\'s home screen, in Chrome on Android. They are not available here.</p>' : '') +
    '<div class="list">' + Object.keys(NOTE_KINDS).map(k => '<button class="card" data-do="flip" data-k="' + k + '" role="switch" aria-checked="' + !!p[k] + '"><span class="tx"><strong>' + esc(NOTE_KINDS[k].name) + '</strong><small>' + esc(NOTE_KINDS[k].text) + '</small></span>' + tog(p[k]) + '</button>').join('') + '</div>' +
    '<p class="dim" style="margin-top:10px">Every note is off until you turn it on. They are made on this phone, and nothing about them is sent anywhere. A grown-up can turn them all off here.</p><div class="btns"><button class="btn" data-do="off">Turn all off</button><button class="btn main" data-do="ok">Done</button></div>',
    { ok: closeSheet, flip: d => notesSwitch(d.k), off: notesAllOff });
}
