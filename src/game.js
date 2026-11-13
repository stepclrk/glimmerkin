/* ===== Shared game state, saving, sound, particles, icons, sheets ===== */
const $ = s => document.querySelector(s);
const app = $('#app'), cv = $('#stage'), ctx = cv.getContext('2d');
const ui = { hud: $('#hud'), hudHome: $('#hud-home'), hudQuest: $('#hud-quest'), bar: $('#bar'), barHome: $('#bar-home'), barQuest: $('#bar-quest'), barBonus: $('#bar-bonus'), barGarden: $('#bar-garden'), tray: $('#tray'), sheet: $('#sheet'), scrim: $('#scrim'), toast: $('#toast') };
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let VW = 0, VH = 0, DPR = 1, topIn = 0, botIn = 0;
let S = null, Q = null, scene = 'home', T = 0, touched = false, fresh = false;
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const rnd = (a, b) => a + Math.random() * (b - a);

function toast(msg, ms) { ui.toast.textContent = msg; ui.toast.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => ui.toast.classList.remove('on'), ms || 2800); }

/* ---------- state ---------- */
const SAVE_KEY = 'glimmerkin.v1';
function newLittle(kind, r, kind2) { const l = { id: 'l' + Math.floor(r.f() * 1e9).toString(36) + Date.now().toString(36).slice(-3), kind, name: makeName(r), seed: r.int(1, 2147483646), xp: 0 }; if (kind2) l.kind2 = kind2; return l; }
const GROWN_AT = 6;   // the level at which a little is all grown up: a little bigger, with side tufts and a star
function lookOf(l) { const L = lookFor(l.kind, l.seed, l.kind2); if (littleLevel(l.xp || 0) >= GROWN_AT) L.grown = true; return L; }
const grownLine = (l, b, a) => b < GROWN_AT && a >= GROWN_AT ? ' ' + l.name + ' is all grown up.' : '';
function newGame() {
  const seed = (Math.random() * 2147483646) | 0, r = RNG(seed), kinds = r.shuffle(Object.keys(KINDS).slice()).slice(0, 2);
  const s = { v: 1, createdAt: Date.now(), savedAt: 0, lastTick: Date.now(), pet: { name: makeName(r), seed, xp: 0, belly: 62, joy: 55, rest: 100, asleep: false, diet: {} }, littles: kinds.map(k => newLittle(k, r)), party: [], eggs: [], pantry: {}, quests: 0, portals: null, sound: true, dust: 0, seen: [], news: NEWS_V };
  s.party = s.littles.map(l => l.id);
  for (const k of kinds) s.pantry[k] = 2; s.pantry[r.pick(ELS)] = (s.pantry[r.pick(ELS)] || 0) + 2;
  return s;
}
function loadLocal() { try { const s = localStorage.getItem(SAVE_KEY); if (s) { const d = JSON.parse(s); if (d && d.v === 1 && d.pet && d.littles) return d; } } catch (e) { } return null; }
function saveLocal() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
let loadStamp = 0, cloudOk = false, cloudRef = null, cloudReady = false, cloudDirty = false, cloudBusy = false, cloudOff = false, cloudTimer = 0, pendingRemote = null;
// Where the account copy lives: 'claude' inside a Claude artifact, 'server' on the hosted site, '' when there is none.
let cloudKind = '', account = null, cloudTries = 0;
const ACCOUNT_KEY = 'glimmerkin.account';  // which account the creature in this browser belongs to, if any
const GUEST_KEY = 'glimmerkin.guest';      // a guest's creature set aside when its browser signed in to an account that had its own
const HOSTED = !(window.claude && window.claude.use) && /^https?:$/.test(location.protocol);
function save() { touched = true; S.savedAt = Date.now(); saveLocal(); cloudDirty = true; clearTimeout(cloudTimer); cloudTimer = setTimeout(pushCloud, 4000); }
function validSave(d) { return !!(d && d.v === 1 && d.pet && d.littles); }
function unreachable(what) { const e = new Error(what); e.code = 'unavailable'; return e; }
// Both stores answer the same two questions. get() gives the account copy or null. set() stores this copy,
// and gives back the account copy instead if that one turned out to be newer.
function claudeStore(db, uid) {
  const ref = db.doc('data/users/' + uid + '/save');
  return {
    async get() { const snap = await ref.get(); if (!snap || !snap.exists) return null; const d = snap.data(); try { return d && d.json ? JSON.parse(d.json) : null; } catch (e) { return null; } },
    async set(doc) { await ref.set({ json: JSON.stringify(doc), savedAt: doc.savedAt }); return null; }
  };
}
async function ask(method, path, body) {
  let r; try { r = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); } catch (e) { throw unreachable('offline'); }
  if (r.status >= 500 || r.status === 429) throw unreachable('server');
  let d = null; try { d = await r.json(); } catch (e) { }
  return { status: r.status, ok: r.ok, data: d || {} };
}
function serverStore() {
  return {
    async get() { const r = await ask('GET', '/api/save'); if (!r.ok) throw new Error('refused'); return r.data.save || null; },
    async set(doc) { const r = await ask('PUT', '/api/save', { save: doc }); if (r.status === 409) return r.data.save || null; if (!r.ok) throw new Error('refused'); return null; }
  };
}
async function initCloud() {
  try {
    let store = null, foreign = false, guest = false;
    if (window.claude && window.claude.use) {
      const db = await window.claude.use('db'), user = await window.claude.use('user');
      if (!db || !user) return;
      const uid = await user.id(); if (!uid) return;
      store = claudeStore(db, uid); cloudKind = 'claude';
    } else if (HOSTED) {
      const me = await ask('GET', '/api/me'); if (!me.ok) return;      // not signed in: this browser only
      account = me.data; cloudKind = 'server'; if (account.mustChangePassword) return;
      store = serverStore();
      // Whose creature is in this browser? One that is not this account's never overwrites the account copy.
      let owner = null; try { owner = localStorage.getItem(ACCOUNT_KEY); } catch (e) { }
      foreign = !fresh && owner !== account.id; guest = foreign && !owner;
    }
    if (!store) return;
    cloudRef = store;
    let remote = await store.get(); if (!validSave(remote)) remote = null;
    const remoteStamp = remote ? remote.savedAt || 0 : -1; let took = false;
    if (foreign && remote) {
      if (guest) { try { localStorage.setItem(GUEST_KEY, JSON.stringify(S)); } catch (e) { } }
      fresh = true;                                                     // the account copy is the one that counts
    } else if (foreign && !guest) { S = newGame(); afterLoad(); saveLocal(); }      // another account's creature is not copied into this one
    // The account copy wins when it is newer than what this browser had when the page opened.
    if (remote && (fresh || remoteStamp > loadStamp)) {
      if (scene === 'home') { adopt(remote); took = true; } else if (fresh) { pendingRemote = remote; took = true; }
    }
    if (cloudKind === 'server') { try { localStorage.setItem(ACCOUNT_KEY, account.id); } catch (e) { } }
    cloudReady = true; if (took || remoteStamp === (S.savedAt || 0)) cloudOk = true; else if ((S.savedAt || 0) > remoteStamp || !S.savedAt) cloudDirty = true;
    if (cloudDirty) pushCloud();
  } catch (e) {
    cloudReady = false;
    // The hosted server being out of reach is not final: keep playing in this browser and try again.
    if (cloudKind !== 'claude' && HOSTED && e && e.code === 'unavailable' && cloudTries++ < 40) { cloudRef = null; setTimeout(initCloud, 15000); } else cloudOff = true;
  }
}
function adopt(remote) { S = remote; fresh = false; pendingRemote = null; loadStamp = S.savedAt || 0; afterLoad(); saveLocal(); toast('Welcome back. ' + S.pet.name + ' was waiting.'); }
async function pushCloud() {
  if (!cloudRef || !cloudReady || cloudBusy || cloudOff || !cloudDirty || pendingRemote) return;
  cloudBusy = true; cloudDirty = false;
  if (!S.savedAt) S.savedAt = Date.now();
  try {
    const newer = await cloudRef.set(S);
    // Another device saved more recently: its copy wins, now if at the nest, otherwise when the quest ends.
    if (validSave(newer)) { if (scene === 'home') adopt(newer); else pendingRemote = newer; }
    cloudOk = true;
  }
  catch (e) { if (e && e.code === 'unavailable') { cloudDirty = true; cloudOk = false; } else cloudOff = true; }
  cloudBusy = false; if (cloudDirty) { clearTimeout(cloudTimer); cloudTimer = setTimeout(pushCloud, 8000); }
}
function saveNote() {
  if (cloudKind === 'server') {
    if (account.mustChangePassword) return 'Choose a new password on <a href="/account">your account page</a>. Until then progress is saved in this browser only.';
    if (cloudOff) return 'Progress is saved in this browser only. <a href="/signin">Sign in again</a> to save it to your account.';
    return (cloudOk ? 'Progress saves to your account, ' + esc(account.username) + ', so it follows you to any device.' : 'Progress is saved in this browser and will reach your account, ' + esc(account.username) + ', when the server can be reached.') + ' <a href="/account">Your account</a>';
  }
  if (HOSTED) return 'Progress is saved in this browser only. <a href="/signin">Sign in</a> or <a href="/join">create an account</a> to keep it on any device.';
  return cloudOk && !cloudOff ? 'Progress saves to your Claude account, so it follows you to any device.' : cloudRef && !cloudOff ? 'Progress saves to your Claude account once you have played a little.' : 'Progress is saved in this browser only. Account saving is not reachable right now.';
}
/* A copy of the whole save as a code, to carry a creature somewhere else: paste it into the account page. */
function saveCode() { return 'GLIM1.' + btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
function openExport() {
  saveLocal();
  openSheet('<h2>Keep a copy</h2><p>This code is ' + esc(S.pet.name) + ' and everything it owns, as of now. To move it to another Glimmerkin account, paste it into “Bring in a creature saved somewhere else” on the account page.</p><textarea id="save-code" readonly rows="5" aria-label="Save code">' + saveCode() + '</textarea><div class="btns"><button class="btn main" data-do="copy">Copy the code</button><button class="btn" data-do="ok">Done</button></div>', {
    ok: closeSheet,
    copy: async () => {
      const box = $('#save-code'); let done = false;
      try { await navigator.clipboard.writeText(box.value); done = true; } catch (e) { try { box.focus(); box.select(); done = document.execCommand('copy'); } catch (e2) { } }
      toast(done ? 'Copied. Keep it somewhere safe.' : 'Could not copy. Select the code and copy it by hand.');
    }
  });
}
function tickStats() {
  const p = S.pet, now = Date.now(); let dt = (now - (S.lastTick || now)) / 1000; if (dt < 0) dt = 0;
  const away = dt > 600; dt = Math.min(dt, 10 * 3600); S.lastTick = now;
  p.belly = Math.max(Math.min(p.belly, 8), p.belly - dt / 360);
  const toys = S.toys || {}; p.joy = Math.max(Math.min(p.joy, 8), p.joy - dt / 280 * (1 - 0.25 * ((toys.ball ? 1 : 0) + (toys.musicbox ? 1 : 0))));
  p.rest = clamp(p.rest + dt / (p.asleep ? 4 : 60), 0, 100);
  return away;
}
function petById(id) { return S.littles.find(l => l.id === id); }
function partyLittles() { S.party = S.party.filter(id => petById(id)); if (!S.party.length && S.littles.length) S.party = [S.littles[0].id]; return S.party.map(petById); }

/* ---------- sound (tiny synth, no files) ---------- */
let AC = null;
function unlockAudio() { try { if (!S || !S.sound) return; AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { } }
function tone(f, d, type, v, at, f2) {
  const now = AC.currentTime + (at || 0), o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, now); if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + d);
  g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(v || 0.05, now + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  o.connect(g); g.connect(AC.destination); o.start(now); o.stop(now + d + 0.03);
}
function sfx(n, f) {
  if (!S || !S.sound || !AC || AC.state !== 'running') return;
  try {
    switch (n) {
      case 'chirp': tone(880, 0.09, 'sine', 0.05, 0, 1320); tone(1320, 0.1, 'sine', 0.04, 0.08, 1760); break;
      case 'purr': tone(140, 0.16, 'triangle', 0.05, 0, 170); break;
      case 'chomp': tone(300, 0.07, 'square', 0.025, 0, 180); tone(260, 0.07, 'square', 0.025, 0.11, 160); break;
      case 'pick': tone(990, 0.08, 'sine', 0.045, 0, 1480); break;
      case 'shard': tone(1175, 0.14, 'sine', 0.05); tone(1568, 0.2, 'sine', 0.045, 0.09); break;
      case 'skill': tone(392, 0.12, 'triangle', 0.06, 0, 784); tone(1047, 0.18, 'sine', 0.04, 0.1); break;
      case 'hit': tone(180, 0.09, 'sawtooth', 0.035, 0, 90); break;
      case 'no': tone(220, 0.12, 'triangle', 0.05, 0, 165); break;
      case 'step': tone(520, 0.03, 'sine', 0.012); break;
      case 'gate': tone(523, 0.25, 'sine', 0.045); tone(659, 0.25, 'sine', 0.04, 0.12); tone(784, 0.3, 'sine', 0.04, 0.24); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, 'sine', 0.05, i * 0.1)); break;
      case 'note': tone(f, 1.1, 'sine', 0.028); tone(f * 2, 0.5, 'sine', 0.007); break;
      case 'tinkle': [1568, 2093, 1760, 2349].forEach((q, i) => tone(q, 0.5, 'sine', 0.022, i * 0.07)); break;
      case 'buy': tone(1319, 0.08, 'square', 0.02); tone(1760, 0.2, 'square', 0.02, 0.07); break;
      case 'box': [784, 988, 1175, 988, 1319, 1175, 988, 1568].forEach((q, i) => { tone(q, 0.5, 'triangle', 0.035, i * 0.22); tone(q * 2, 0.25, 'sine', 0.01, i * 0.22); }); break;
      case 'slide': tone(700, 0.3, 'sine', 0.02, 0, 350); break;
      case 'gust': tone(300, 0.5, 'sine', 0.03, 0, 900); tone(600, 0.35, 'triangle', 0.012, 0.1, 1400); break;
      case 'wave': tone(196, 0.9, 'sine', 0.035, 0, 147); tone(392, 0.6, 'sine', 0.012, 0.1, 294); break;
      case 'roar': tone(110, 0.5, 'sawtooth', 0.045, 0, 60); break;
      case 'grow': [392, 494, 587, 784].forEach((f, i) => tone(f, 0.35, 'triangle', 0.05, i * 0.13)); break;
    }
  } catch (e) { }
}

/* ---------- particles ---------- */
const parts = [];
function burst(x, y, n, h, o) {
  o = o || {}; if (REDUCED) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = (o.v || 90) * (0.35 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 40), g: o.g === undefined ? 160 : o.g, life: 0, max: (o.life || 0.6) * (0.6 + Math.random() * 0.7), kind: o.kind || 'dot', h: h + rnd(-16, 16), size: (o.size || 4) * (0.6 + Math.random() * 0.8) }); }
}
function floatText(x, y, text, color) { parts.push({ x, y, vx: 0, vy: -36, g: 0, life: 0, max: 1.2, kind: 'text', text, color: color || '#ffe58a', size: 15 }); }
function drawParts(c, dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; const a = 1 - p.life / p.max;
    if (p.kind === 'text') { c.font = '800 ' + p.size + 'px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(18,12,38,' + a + ')'; c.strokeText(p.text, p.x, p.y); c.globalAlpha = a; c.fillStyle = p.color; c.fillText(p.text, p.x, p.y); c.globalAlpha = 1; }
    else if (p.kind === 'heart') { const s = p.size * (0.7 + 0.5 * a); c.globalAlpha = a; c.fillStyle = hsl(p.h, 90, 72); c.beginPath(); c.moveTo(p.x, p.y + s); c.bezierCurveTo(p.x - s * 2, p.y - s * 0.4, p.x - s * 0.8, p.y - s * 1.6, p.x, p.y - s * 0.5); c.bezierCurveTo(p.x + s * 0.8, p.y - s * 1.6, p.x + s * 2, p.y - s * 0.4, p.x, p.y + s); c.fill(); c.globalAlpha = 1; }
    else if (p.kind === 'star') { c.globalAlpha = a; c.fillStyle = hsl(p.h, 100, 80); starPath(c, p.x, p.y, p.size, p.size * 0.4, 4, p.life * 5); c.fill(); c.globalAlpha = 1; }
    else if (p.kind === 'z') { c.globalAlpha = a; c.font = '400 ' + (p.size * (1 + p.life * 0.5)) + 'px "Mystery Quest", fantasy'; c.fillStyle = '#cfe3ff'; c.fillText('z', p.x + Math.sin(p.life * 3) * 6, p.y); c.globalAlpha = 1; }
    else { glow(c, p.x, p.y, p.size * 2.2, p.h, 100, 70, a * 0.8); c.fillStyle = hsl(p.h, 100, 85, a); c.beginPath(); c.arc(p.x, p.y, p.size * 0.5, 0, TAU); c.fill(); }
  }
}

/* ---------- animation helper ---------- */
const anims = [];
function anim(dur, fn) { return new Promise(res => anims.push({ t: 0, dur: Math.max(0.001, dur), fn, res })); }
const wait = s => anim(s, () => { });
function stepAnims(dt) { for (const a of anims.slice()) { a.t += dt; const u = Math.min(1, a.t / a.dur); try { a.fn(u); } catch (e) { } if (u >= 1) { const i = anims.indexOf(a); if (i >= 0) anims.splice(i, 1); a.res(); } } }
const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;

/* ---------- icons painted onto small canvases ---------- */
function paintIcons(root) {
  (root || document).querySelectorAll('canvas[data-ic]').forEach(k => {
    const size = +k.dataset.size || 32, wd = +k.dataset.w || size, d = Math.min(3, window.devicePixelRatio || 1);
    k.width = Math.round(wd * d); k.height = Math.round(size * d); k.style.width = wd + 'px'; k.style.height = size + 'px';
    const c = k.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, wd, size);
    const [kind, a, b, b2] = k.dataset.ic.split(':'), m = size / 2;
    if (kind === 'berry') drawItem(c, { k: 'berry', el: a }, m, m + size * 0.08, size * 2.1, 0);
    else if (kind === 'shard') drawItem(c, { k: 'shard' }, m, m, size * 1.5, 0.4);
    else if (kind === 'dew') drawItem(c, { k: 'dew' }, m, m, size * 1.5, 0);
    else if (kind === 'egg') drawItem(c, { k: 'egg', hue: +a }, m, m, size * 1.5, 0);
    else if (kind === 'thing') { c.save(); c.beginPath(); c.arc(m, m, size / 2, 0, TAU); c.clip(); drawThing(c, k.dataset.ic.slice(6), m, m, size * 0.84, 0.5); c.restore(); }
    else if (kind === 'kind') drawCreature(c, lookFor(a, 4000 + Object.keys(KINDS).indexOf(a) * 17), m, size * 0.93, size * 0.54, 0, { still: true, noShadow: true, glow: 0.2 });
    else if (kind === 'book') { c.fillStyle = '#ffcf6b'; c.strokeStyle = '#3b230c'; c.lineWidth = Math.max(1, size * 0.06); c.lineJoin = 'round'; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(m, size * 0.28); c.quadraticCurveTo(m + sd * size * 0.2, size * 0.16, m + sd * size * 0.4, size * 0.24); c.lineTo(m + sd * size * 0.4, size * 0.76); c.quadraticCurveTo(m + sd * size * 0.2, size * 0.68, m, size * 0.8); c.closePath(); c.fill(); c.stroke(); } }
    else if (kind === 'little') { const l = petById(a); if (l) { const L = lookOf(l); drawCreature(c, L, m, size * 0.93, size * 0.54, 0, { still: true, noShadow: true, glow: 0.2 }); } }
    else if (kind === 'kin') drawCreature(c, petLook(S.pet), m, size * 0.93, size * 0.56, 0, { still: true, noShadow: true, glow: 0.2 });
    else if (kind === 'phone') { const pw = size * 0.5, ph = size * 0.88, px = m - pw / 2, py = (size - ph) / 2; glow(c, m, m, size * 0.5, 270, 80, 65, 0.25); rrect(c, px, py, pw, ph, size * 0.09); c.fillStyle = '#120d22'; c.fill(); c.strokeStyle = '#b9aedb'; c.lineWidth = Math.max(1.5, size * 0.035); c.stroke(); rrect(c, m - size * 0.15, m - size * 0.17, size * 0.3, size * 0.3, size * 0.07); c.fillStyle = '#2b1f5c'; c.fill(); drawCreature(c, petLook(S.pet), m, m + size * 0.11, size * 0.2, 0, { still: true, noShadow: true, glow: 0 }); }
    else if (kind === 'ob') drawOb(c, a, 2, 2, size - 4, 1, false, 7, BIOMES[0]);
    else if (kind === 'gloom') drawGloom(c, { g: +a, tough: +b, boss: !!b2 }, m, size * (b2 ? 0.96 : 0.9), size * (b2 ? 0.74 : 0.9), 0);
    else if (kind === 'journey') drawJourneyMap(c, wd, size);
    else if (kind === 'gmap') drawGardenMap(c, wd, size);
    else if (kind === 'pic') { const pic = S.pics[+a]; if (pic) drawPic(c, pic, wd, size); }
    else if (kind === 'present') { glow(c, m, m, size * 0.5, 350, 90, 70, 0.3); drawPresent(c, m, size * 0.9, size * 0.62); }
    else if (kind === 'piece') drawPieceIcon(c, a, size);
    else if (kind === 'plate') drawPlate(c, 2, 2, size - 4, 0, false);
    else if (kind === 'gate') drawGate(c, 2, 2, size - 4, 0, false, BIOMES[5], 3);
    else if (kind === 'portal') drawPortal(c, 0, 0, size, 0.6, true);
    else if (kind === 'secret') drawSecretDoor(c, 0, 0, size, 0.6);
    else if (kind === 'flower') drawFlower(c, a, m, size * 0.96, size * 1.02, 0, 3, { still: true, shine: b === 'g' });
    else if (kind === 'moon') { glow(c, m, m, size * 0.5, 215, 90, 75, 0.4); c.fillStyle = '#dfe9ff'; c.beginPath(); c.arc(m - 1, m, size * 0.3, 0.5 * Math.PI, 1.5 * Math.PI); c.arc(m + size * 0.12, m, size * 0.25, 1.5 * Math.PI, 0.5 * Math.PI, true); c.closePath(); c.fill(); }
    else if (kind === 'paw') { c.fillStyle = '#86e8c8'; glow(c, m, m, size * 0.5, 160, 80, 70, 0.3); c.beginPath(); c.ellipse(m, m + size * 0.12, size * 0.2, size * 0.16, 0, 0, TAU); c.fill(); for (const [dx, dy] of [[-0.24, -0.08], [-0.09, -0.24], [0.09, -0.24], [0.24, -0.08]]) { c.beginPath(); c.arc(m + dx * size, m + dy * size, size * 0.075, 0, TAU); c.fill(); } }
    else if (kind === 'biome') { const B = BIOMES.find(x => x.id === a) || BIOMES[0], g = c.createLinearGradient(0, 0, 0, size); g.addColorStop(0, B.bg[0]); g.addColorStop(1, B.bg[1]); rrect(c, 0, 0, size, size, size * 0.2); c.fillStyle = g; c.fill(); c.save(); c.clip(); const ts = size / 2; drawWall(c, 0, 0, ts, B, 11); drawWall(c, ts, 0, ts, B, 23); drawFloor(c, 0, ts, ts, B, 5); drawFloor(c, ts, ts, ts, B, 9); drawPortal(c, ts * 0.5, ts * 0.55, ts, 0.8, true); c.restore(); }
  });
}

/* ---------- sheets ---------- */
let sheetHandlers = {}, sheetOnClose = null;
function openSheet(html, handlers, onClose) {
  ui.sheet.innerHTML = html; sheetHandlers = handlers || {}; sheetOnClose = onClose || null;
  ui.sheet.hidden = false; ui.scrim.hidden = false; ui.sheet.scrollTop = 0; paintIcons(ui.sheet);
}
function closeSheet() { if (ui.sheet.hidden) return; ui.sheet.hidden = true; ui.scrim.hidden = true; const f = sheetOnClose; sheetOnClose = null; if (f) f(); }
ui.scrim.addEventListener('click', () => { if (!ui.sheet.dataset.lock) closeSheet(); });
ui.sheet.addEventListener('click', e => {
  const b = e.target.closest('[data-do]'); if (!b || b.disabled) return;
  unlockAudio(); const f = sheetHandlers[b.dataset.do]; if (f) f(b.dataset, b);
});
function pips(n, max) { let s = '<span class="pips" aria-label="' + n + ' of ' + max + ' sparks">'; for (let i = 0; i < max; i++) s += '<u class="' + (i < n ? 'f' : '') + '"></u>'; return s + '</span>'; }
function skillLine(l) { return kindsOf(l).map(k => KINDS[k].does + '. ' + KINDS[k].perk + ': ' + KINDS[k].perkText).join(' ') + (l.charm ? ' Wears the ' + CHARMS[l.charm].name.toLowerCase() + '.' : ''); }
function kindLabel(l) { const ks = kindsOf(l); return ks.length > 1 ? 'Twin ' + ks.map(k => KINDS[k].label).join(' and ') : KINDS[l.kind].species + ' · ' + KINDS[l.kind].label; }
