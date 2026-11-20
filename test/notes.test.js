// The service worker's half of notes from the nest (src/sw.js): from the list the page wrote, at most one note a day,
// only between 8:00 and 20:00, only for kinds that are switched on, only once something has come, never twice.
// Runs the worker in a sandbox with an in-memory cache.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'sw.js'), 'utf8');
const store = new Map(), shown = [], handlers = {};
const caches = {
  async open(name) { if (!store.has(name)) store.set(name, new Map()); const m = store.get(name); return { async match(k) { const v = m.get(String(k)); return v ? new Response(v) : undefined; }, async put(k, r) { m.set(String(k), await r.text()); }, async add() { } }; },
  async keys() { return [...store.keys()]; }, async delete(k) { return store.delete(k); }
};
const self = { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() { }, registration: { showNotification: async (title, o) => { shown.push({ title, body: o.body, kind: o.data.kind }); } }, clients: { claim() { } } };
const ctx = vm.createContext({ self, caches, Response, URL, Request: class { constructor(u) { this.url = u; } }, fetch: async () => { throw new Error('offline'); }, location: { origin: 'https://glimmerkin.test' }, setTimeout, console, Promise, JSON, Date, Math });
vm.runInContext(src, ctx);

const at = (d, h, m) => new Date(2026, 10, d, h, m || 0).getTime();
const results = [];
const check = (name, ok) => { results.push([name, ok]); console.log((ok ? 'ok   ' : 'FAIL ') + name); };
async function write(prefs, events) { const c = await caches.open('glimmerkin-notes'); await c.put('/play/notes.json', new Response(JSON.stringify({ prefs, name: 'Dablu', events }))); }
async function due(now) { return vm.runInContext('noteDue', ctx)(now); }

(async () => {
  check('the worker listens for background sync and taps on a note', typeof handlers.periodicsync === 'function' && typeof handlers.notificationclick === 'function');
  check('nothing written, nothing shown', (await due(at(21, 10))) === null);
  await write({ home: true, today: false }, [
    { kind: 'home', at: at(21, 9), title: 'Pip has sent a picture', body: 'From its adventure.' },
    { kind: 'today', at: at(21, 8), title: 'Today\'s world is open', body: 'A new world.' },
    { kind: 'home', at: at(23, 9), title: 'Bo has sent a picture', body: 'From its adventure.' }
  ]);
  check('nothing before it has come', (await due(at(21, 8, 30))) === null);
  check('nothing before 8 in the morning', (await due(at(22, 7, 59))) === null);
  check('nothing from 8 in the evening', (await due(at(21, 20, 0))) === null);
  const a = await due(at(21, 10));
  check('a note that has come, of a kind switched on', a && a.title === 'Pip has sent a picture');
  check('only one a day', (await due(at(21, 15))) === null);
  check('the same note is not shown twice', (await due(at(22, 10))) === null);
  check('a kind switched off is never shown', !shown.length && (await due(at(22, 11))) === null);
  const b = await due(at(23, 12));
  check('the next one comes on a later day', b && b.title === 'Bo has sent a picture');
  await write({ home: true }, [{ kind: 'home', at: at(25, 9), title: 'Old', body: '' }]);
  check('one more than two days late is let go', (await due(at(28, 10))) === null);
  // the background wake itself shows it
  await write({ gift: true }, [{ kind: 'gift', at: Date.now() - 3600000, title: 'A December gift is waiting', body: 'On its cloud.' }]);
  const h = new Date().getHours(), done = [];
  await handlers.periodicsync({ tag: 'glimmerkin-notes', waitUntil: p => done.push(p) }); await Promise.all(done);
  check('a background wake shows the note it finds' + (h >= 8 && h < 20 ? '' : ' (outside 8 to 20 now, so none)'), h >= 8 && h < 20 ? shown.length === 1 && shown[0].title === 'A December gift is waiting' && shown[0].kind === 'gift' : shown.length === 0);
  const before = shown.length; done.length = 0;
  await handlers.periodicsync({ tag: 'something-else', waitUntil: p => done.push(p) }); await Promise.all(done);
  check('another tag shows nothing', shown.length === before);
  const failed = results.filter(r => !r[1]).map(r => r[0]);
  console.log(failed.length ? 'FAILED: ' + failed.join(', ') : 'ALL CHECKS PASSED'); process.exit(failed.length ? 1 : 0);
})();
