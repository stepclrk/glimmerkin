/* ===== Gesture tricks: more ways to play with the Glimmerkin by touch. None of it changes quests or balance. ===== */
// A hug (press and hold on it), a stretch (hold, then pull), a boop (two taps on its face), a tickle (quick
// scribbles on its tummy), a light to follow (hold the sky, then move), a beat to echo (taps on the sky), a shake
// of the phone (the nest swirls like a snow globe) and two fingers (spread to puff it up, pinch to curl it up).
// The shapes it learns as tricks live with the other tricks in play.js.
const HUG_TIME = 0.6, BIG_HUG = 3, LIGHT_TIME = 0.5, BOOP_GAP = 0.45, BEAT_END = 900, SHAKE_AT = 16;
function tg() { return home.tg || (home.tg = { dx: 0, beat: [], echo: null, boing: null, tickle: 0, peek: 0, flips: [], fdir: 0, fext: null, fturn: null, tapT: -9, boops: 0, boopT: -9, sneeze: null, boopBack: null, light: null, hopT: 0, globe: null, pinch: null, jolts: [] }); }
function touchDx() { return home.tg ? home.tg.dx : 0; }
function touchCount(k) { const t = S.j.touch = S.j.touch || {}; t[k] = (t[k] || 0) + 1; return t[k]; }
const nowMs = () => (window.performance ? performance.now() : Date.now());

/* ---------- each frame ---------- */
function touchTick(dt) {
  const H = home, G = tg(), q = H.ptr, p = S.pet, ps = H.petS;
  // a finger held still: on the Glimmerkin it is a hug, on open sky it is a light to follow
  if (q && !H.carry && !q.hug && !q.light && q.moved < 8 && scene === 'home') {
    if (q.hit && q.hit.k === 'pet' && !p.asleep && T - q.t0 > HUG_TIME) { q.hug = { t: 0, beat: 0.3, big: false, ax: q.x, ay: q.y }; sfx('purr'); }
    else if (!q.hit && !H.toss && !H.copy && !p.asleep && T - q.t0 > LIGHT_TIME) { q.light = true; G.light = { x: q.x, y: q.y, leapT: 0, booped: false }; sfx('tinkle'); if (touchCount('light') === 1) toast(p.name + ' wants to follow the light. Move your finger.', 2600); }
  }
  if (q && q.hug && !q.pull) {
    const h = q.hug; h.t += dt; h.beat -= dt;
    if (h.beat <= 0) { h.beat = 0.7; strokePet(); }   // a hug is a slow, steady stroke
    if (!h.big && h.t > BIG_HUG) {
      h.big = true; const n = touchCount('hug');
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; parts.push({ x: H.cx + G.dx + Math.cos(a) * ps * 0.8, y: H.gy - ps * 0.55 + Math.sin(a) * ps * 0.62, vx: Math.cos(a) * 20, vy: -30 + Math.sin(a) * 14, g: 0, life: 0, max: 1.5, kind: 'heart', h: 340, size: 6 }); }
      sfx('grow'); toast(p.name + ' snuggles right in. A big hug!' + (n === 1 ? ' Hold on, then pull, and it stretches.' : ''), 3000); save();
    }
  }
  if (!q || !q.light) G.light = null;
  // the light: it hops along the nest after it, and leaps for it when it is high above
  const L = G.light, room = H.rx * 0.42;
  const want = L ? clamp(L.x - H.cx, -room, room) : 0, gap = want - G.dx;
  if (Math.abs(gap) > 1) { G.dx += Math.sign(gap) * Math.min(Math.abs(gap), 230 * dt); G.hopT -= dt; if (G.hopT <= 0 && H.pa.hopY <= 0) { G.hopT = 0.3; H.pa.hopV = 150; } }
  if (L) {
    L.leapT -= dt; const px = H.cx + G.dx, nose = { x: px, y: H.gy + H.ry * 0.12 - ps * 0.45 };
    if (L.y < H.gy - ps * 1.4 && Math.abs(L.x - px) < ps * 0.6 && L.leapT <= 0 && H.pa.hopY <= 0) { L.leapT = 0.9; H.pa.hopV = 420; sfx('chirp'); }
    if (Math.hypot(L.x - nose.x, L.y - nose.y) < ps * 0.22) { if (!L.booped) { L.booped = true; burst(nose.x, nose.y, 8, 340, { kind: 'heart', v: 80, size: 4, life: 1 }); sfx('chirp'); } } else L.booped = false;
  }
  // timers
  G.tickle = Math.max(0, G.tickle - dt);
  if (G.tickle > 0 && Math.random() < dt * 2.2) floatText(H.cx + G.dx + rnd(-ps * 0.6, ps * 0.6), H.gy - ps * rnd(1, 1.3), ['hee hee!', 'hee!', 'ha ha!'][Math.floor(Math.random() * 3)]);
  if (G.tickle === 0 && G.tickling) { G.tickling = false; G.peek = 1.6; floatText(H.cx + G.dx, H.gy - ps * 1.3, 'More?'); }
  G.peek = Math.max(0, G.peek - dt);
  if (G.boing && (G.boing.t += dt) > 1.3) G.boing = null;
  if (G.sneeze) { const s = G.sneeze; s.t += dt; if (s.t > 0.32 && !s.done) { s.done = true; const x = H.cx + G.dx, y = H.gy + H.ry * 0.12 - ps * 0.42; burst(x, y, 16, home.look.hue, { kind: 'star', v: 150, size: 4, life: 1.1 }); floatText(x, y - ps * 0.7, 'Achoo!'); sfx('tinkle'); } if (s.t > 0.9) G.sneeze = null; }
  if (G.boopBack && (G.boopBack.t += dt) > 0.9) G.boopBack = null;
  beatTick(dt); globeTick(dt);
}

/* ---------- a finger moving: a stretch, the light, or a tickle ---------- */
function touchMove(q, pt, d) {
  const H = home, G = tg();
  if (q.light && G.light) { G.light.x = pt.x; G.light.y = pt.y; return true; }
  if (q.hug) { if (!q.pull && Math.hypot(pt.x - q.hug.ax, pt.y - q.hug.ay) > 12) { q.pull = true; sfx('pick'); } return true; }   // held, then pulled: a stretch, not a stroke
  if (q.hit && q.hit.k === 'pet' && !S.pet.asleep) tickleMove(pt);
  return false;
}
/* Quick short scribbles on the tummy: four turns within 0.8 seconds, each sweep shorter than a stroke. */
function tickleMove(pt) {
  const H = home, G = tg(), now = nowMs(), short = H.petS * 0.45;
  if (G.fext === null) { G.fext = pt.x; G.fturn = pt.x; return; }
  if (!G.fdir) { if (Math.abs(pt.x - G.fext) > 5) { G.fdir = Math.sign(pt.x - G.fext); G.fext = pt.x; } return; }
  if ((pt.x - G.fext) * G.fdir > 0) { G.fext = pt.x; return; }   // still going the same way
  if (Math.abs(pt.x - G.fext) < 5) return;                         // a jitter, not a turn
  const sweep = Math.abs(G.fext - G.fturn); G.fturn = G.fext; G.fdir = -G.fdir; G.fext = pt.x;
  if (sweep > short) { G.flips = []; return; }                     // a long sweep is a stroke
  G.flips = G.flips.filter(t => now - t < 800); G.flips.push(now);
  if (G.flips.length >= 4 && spotAt({ x: pt.x - G.dx, y: pt.y }) === 'tummy') {
    if (!G.tickling) { G.tickling = true; const n = touchCount('tickle'); sfx('chirp'); floatText(pt.x, pt.y - 30, 'Hee hee!'); if (n === 1) toast(S.pet.name + ' is ticklish! It rolls over giggling.', 2600); }
    G.tickle = 1.1; H.pa.wiggle = 0.6;
  }
}
function touchFingerDown() { const G = tg(); G.fdir = 0; G.fext = null; G.fturn = null; G.flips = []; }

/* ---------- a finger lifted ---------- */
// Returns true when it was one of these tricks, so the usual tap or stroke does not happen as well.
function touchUp(q) {
  const H = home, G = tg(), p = S.pet;
  touchFingerDown();
  if (q.light) { G.light = null; return true; }
  if (q.hug) {
    if (q.pull) { const o = pullPose(q); G.boing = { sx: o.sx, sy: o.sy, tilt: o.tilt, t: 0 }; floatText(H.cx + G.dx, H.gy - H.petS * 1.5, 'Boing!'); sfx('chirp'); if (touchCount('stretch') === 1) toast(p.name + ' boings back with a wobble.', 2400); save(); }
    else if (touched) save();
    return true;
  }
  if (q.moved > 12) return false;
  if (!q.hit) { beatTap(); return false; }   // a tap on the sky: part of a beat, and it still closes the berry tray
  if (q.hit.k !== 'pet' || p.asleep) return false;
  // two quick taps on its face: a boop
  const ny = H.gy + H.ry * 0.12, u = (q.x - H.cx - G.dx) / H.petS, v = (ny - q.y) / H.petS, face = Math.abs(u) < 0.36 && v > 0.22 && v < 0.78;
  if (!face) { G.tapT = -9; return false; }
  if (T - G.tapT > BOOP_GAP) { G.tapT = T; return false; }   // the first tap is an ordinary tap
  G.tapT = -9; boop(); return true;
}
function boop() {
  const H = home, G = tg(), p = S.pet;
  G.boops = T - G.boopT < 4 ? G.boops + 1 : 1; G.boopT = T; H.pa.hopV = 0; touchCount('boop');
  if (G.boops >= 3) {   // three boops in a row and it boops you back
    G.boops = 0; G.boopBack = { t: 0 }; sfx('purr');
    burst(H.cx + G.dx, H.gy - H.petS * 0.5, 10, 340, { kind: 'heart', v: 110, size: 6, life: 1.1 });
    toast(p.name + ' boops you back!', 2200);
  } else { G.sneeze = { t: 0 }; sfx('pick'); if (S.j.touch.boop === 1) toast('Boop! ' + p.name + ' scrunches up its nose.', 2200); }
  save();
}

/* ---------- how it looks ---------- */
function pullPose(q) {
  const ps = home.petS, dx = q.x - q.hug.ax, dy = q.y - q.hug.ay, sy = clamp(1 - dy / ps * 0.9, 0.72, 1.5);
  return { sx: 1 / Math.sqrt(sy), sy, tilt: clamp(dx / ps, -0.7, 0.7) * 0.5 };
}
function touchPose(o, dt) {
  const H = home, G = tg(), q = H.ptr; o.sy = o.sy || 1; o.dx = G.dx; o.lift = 0; o.glow = 0;
  if (q && q.hug && !q.pull) { o.mood = 'sleep'; o.tilt += clamp((q.x - H.cx - G.dx) / H.petS, -1, 1) * 0.1; o.squash += 0.04; o.glow = Math.min(0.4, q.hug.t * 0.15); }
  if (q && q.pull) { const s = pullPose(q); o.sx *= s.sx; o.sy *= s.sy; o.tilt += s.tilt; o.mood = 'happy'; }
  if (G.boing) { const b = G.boing, e = Math.exp(-4 * b.t) * Math.cos(b.t * 17); o.sx *= 1 + (b.sx - 1) * e; o.sy *= 1 + (b.sy - 1) * e; o.tilt += b.tilt * e; }
  if (G.tickle > 0) { o.tilt += 0.42 + Math.sin(T * 28) * 0.05; o.squash += 0.06; o.mood = 'happy'; }
  else if (G.peek > 0) { o.mood = 'happy'; o.look = { x: 0, y: -0.7 }; o.tilt += Math.sin(G.peek * Math.PI / 1.6) * 0.12; }
  if (G.sneeze) { const t = G.sneeze.t; if (t < 0.32) { o.squash += 0.12 * (t / 0.32); o.mood = 'happy'; } else { o.squash -= 0.1 * Math.max(0, 1 - (t - 0.32) * 3); o.mood = 'happy'; } }
  if (G.boopBack) { const k = Math.sin(G.boopBack.t / 0.9 * Math.PI); o.sx *= 1 + 0.2 * k; o.sy *= 1 + 0.2 * k; o.lift += k * H.petS * 0.12; o.mood = 'happy'; }
  if (G.light) { const ps = H.petS; o.look = { x: clamp((G.light.x - H.cx - G.dx) / 120, -1, 1), y: clamp((G.light.y - (H.gy - ps * 0.5)) / 120, -1, 1) }; o.mood = o.mood || 'happy'; }
  if (G.light || Math.abs(G.dx) > 1) o.tilt += clamp(((G.light ? clamp(G.light.x - H.cx, -H.rx * 0.42, H.rx * 0.42) : 0) - G.dx) / 200, -0.1, 0.1);
  if (G.pinch) { const s = G.pinch.s; if (s >= 1) { const k = 1 + (s - 1) * 0.8; o.sx *= k; o.sy *= k; o.glow += (s - 1) * 0.6; o.mood = 'happy'; } else { o.sx *= 1 - (1 - s) * 0.6; o.sy *= 1 - (1 - s) * 0.95; o.mood = 'sleep'; } }
  if (G.globe) { const f = Math.max(0, 1 - G.globe.t / GLOBE_TIME); o.tilt += Math.sin(T * 7) * 0.16 * f; o.mood = 'happy'; }
  return o;
}
function drawTouch(c, H, dt) {
  const G = tg(), q = H.ptr;
  if (q && q.hug && !q.pull) glow(c, q.x, q.y, 30 + Math.min(1, q.hug.t / BIG_HUG) * 40, 40, 100, 72, 0.35 + 0.2 * Math.sin(T * 4));
  if (G.light) { glow(c, G.light.x, G.light.y, 40, 50, 100, 80, 0.75); c.fillStyle = 'rgba(255,250,225,.95)'; c.beginPath(); c.arc(G.light.x, G.light.y, 6 + Math.sin(T * 8), 0, TAU); c.fill(); }
  drawGlobe(c, H, dt);
}

/* ---------- echo my beat ---------- */
// Three to ten taps on open sky, then a pause: it chirps the same rhythm back, hopping on each beat, and the littles
// on the nest bob along.
function beatTap() { const G = tg(); if (G.echo || S.pet.asleep || home.copy) return; G.beat.push(nowMs()); }
function beatTick(dt) {
  const H = home, G = tg(), b = G.beat;
  if (b.length && !G.echo && nowMs() - b[b.length - 1] > BEAT_END) {
    if (b.length >= 3 && b.length <= 10 && scene === 'home') { const gaps = b.slice(1).map((t, i) => (t - b[i]) / 1000), at = [0]; gaps.forEach(g => at.push(at[at.length - 1] + g)); G.echo = { at, i: 0, t: -0.45, gaps }; }
    G.beat = [];
  }
  const e = G.echo; if (!e) return;
  e.t += dt;
  while (e.i < e.at.length && e.t >= e.at[e.i]) {
    sfx('note', CHIME_NOTES[[0, 2, 4, 2, 5, 4, 7, 4, 2, 0][e.i]]); H.pa.hopV = 170;
    floatText(H.cx + touchDx() + rnd(-30, 30), H.gy - H.petS * 1.25, e.i % 2 ? '♫' : '♪');
    for (const f of H.lits) { f.squash = 0.2; f.moodT = 0.5; }
    e.i++;
  }
  if (e.i >= e.at.length && e.t > e.at[e.at.length - 1] + 0.4) { G.echo = null; if (touchCount('beat') === 1) toast(S.pet.name + ' chirps your beat back.', 2400); save(); }
}

/* ---------- shake the phone: a snow globe ---------- */
// Three jolts within 0.8 seconds. The season swirls round the nest and settles, the littles tumble, and the
// Glimmerkin goes a little dizzy. On an iPhone the game has to ask first, from How it works.
const GLOBE_TIME = 3.2;
function motionSample(e) {
  const a = e.acceleration, g = e.accelerationIncludingGravity; let m;
  if (a && a.x !== null && a.x !== undefined) m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  else if (g && g.x !== null && g.x !== undefined) m = Math.abs(Math.hypot(g.x || 0, g.y || 0, g.z || 0) - 9.81);
  else return;
  if (m < SHAKE_AT) return;
  const G = tg(), now = nowMs(); G.jolts = G.jolts.filter(t => now - t < 800); G.jolts.push(now);
  if (G.jolts.length >= 3) { G.jolts = []; shakeNest(); }
}
window.addEventListener('devicemotion', motionSample);
function shakeNest() {
  if (!S || scene !== 'home') return false;
  const H = home, G = tg(), p = S.pet;
  if (!ui.sheet.hidden || G.globe || p.asleep || T - (G.globeEnd || -9) < 1.5) return false;
  const sea = seasonNow(), r = Math.random, bits = [];
  for (let i = 0; i < 46; i++) bits.push({ a: r() * TAU, rr: 0.35 + r() * 0.75, h: r(), sp: (r() < 0.5 ? -1 : 1) * (2 + r() * 2.5), fall: 0.3 + r() * 0.7, rot: r() * 6 });
  G.globe = { t: 0, sea, bits }; sfx('gust');
  for (const f of H.lits) { f.squash = 0.22; f.moodT = 2.4; f.hop = 18; }
  const n = touchCount('shake'); if (n === 1) toast('Whee! The nest swirls like a snow globe.', 2600); save();
  return true;
}
function globeTick(dt) { const G = tg(), g = G.globe; if (!g) return; g.t += dt; for (const f of home.lits) if (g.t < 1.6) f.squash = Math.max(f.squash || 0, 0.12 * Math.abs(Math.sin(g.t * 9 + f.i))); if (g.t > GLOBE_TIME) { G.globe = null; G.globeEnd = T; } }
function drawGlobe(c, H, dt) {
  const G = tg(), g = G.globe; if (!g) return;
  const u = g.t / GLOBE_TIME, swirl = Math.max(0, 1 - u * 1.4), cx = H.cx, cy = H.gy - H.petS * 0.7, R = Math.min(VW * 0.55, H.rx * 1.25);
  for (const b of g.bits) {
    b.a += b.sp * swirl * dt * 2; const settle = Math.max(0, u - 0.25) / 0.75;
    const x = cx + Math.cos(b.a) * R * b.rr, y = lerp(cy + Math.sin(b.a) * R * b.rr * 0.7, H.gy + H.ry * (0.2 + b.h * 0.6), settle * settle * b.fall), al = u > 0.8 ? (1 - u) * 5 : 1;
    c.globalAlpha = clamp(al, 0, 1);
    if (g.sea === 'winter') { c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.arc(x, y, 2.5 + b.h * 2, 0, TAU); c.fill(); }
    else if (g.sea === 'summer') glow(c, x, y, 8, 52, 100, 72, 0.9);
    else { c.save(); c.translate(x, y); c.rotate(b.rot + b.a); c.fillStyle = g.sea === 'spring' ? hsl(330 + b.h * 30, 85, 82) : hsl(18 + b.h * 28, 85, 56); c.beginPath(); c.ellipse(0, 0, 5 + b.h * 3, 2.6 + b.h * 1.5, 0, 0, TAU); c.fill(); c.restore(); }
  }
  c.globalAlpha = 1;
  if (u < 0.85) { const hx = H.cx + G.dx, hy = H.gy - H.petS * 1.15 - H.pa.hopY; c.fillStyle = '#ffe58a'; for (let i = 0; i < 5; i++) { const a = T * 4 + i / 5 * TAU; starPath(c, hx + Math.cos(a) * H.petS * 0.32, hy + Math.sin(a) * H.petS * 0.08, 5, 2.2, 5, -Math.PI / 2); c.fill(); } }
}
/* An iPhone keeps motion behind a question, which can only be asked from a tap. */
const motionNeedsAsk = () => typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
function motionAsk(quiet) {
  if (!motionNeedsAsk()) return;
  DeviceMotionEvent.requestPermission().then(r => {
    home.motionOn = r === 'granted'; if (r === 'granted') { if (!S.motion) { S.motion = true; save(); } if (!quiet) toast('Shake your phone gently and the nest swirls like a snow globe.', 3400); }
    else if (!quiet) toast('Motion is off for this game. To turn it on, open Settings, then Safari, then Motion & Orientation Access.', 5200);
  }).catch(() => { if (!quiet) toast('Motion needs a tap to turn on. Try the button again.'); });
}
// Once allowed, the question is asked again quietly on the first touch of each visit, as iOS forgets it.
window.addEventListener('pointerdown', () => { if (S && S.motion && !home.motionOn && !home.motionTried && motionNeedsAsk()) { home.motionTried = true; motionAsk(true); } }, true);

/* ---------- two fingers: puff up and curl up ---------- */
// Spread two fingers and it puffs up big; pinch them and it curls into a tiny ball. It follows the fingers while they
// move, and on letting go it deflates with a "Pfft!" or uncurls with a hop.
function pinchStart(a, b) {
  const H = home, G = tg(); if (H.carry || S.pet.asleep || H.toss) { H.ptr = null; return; }
  H.ptr = null; G.light = null; G.pinch = { d0: Math.max(30, Math.hypot(a.x - b.x, a.y - b.y)), s: 1, max: 1, min: 1 };
}
function pinchMove(a, b) { const G = tg(), P = G.pinch; if (!P) return; P.s = clamp(Math.hypot(a.x - b.x, a.y - b.y) / P.d0, 0.62, 1.4); P.max = Math.max(P.max, P.s); P.min = Math.min(P.min, P.s); }
function pinchEnd() {
  const H = home, G = tg(), P = G.pinch, p = S.pet; if (!P) return; G.pinch = null;
  const s = P.s, k = s >= 1 ? 1 + (s - 1) * 0.8 : 1;
  if (s >= 1.22) { G.boing = { sx: k, sy: k, tilt: 0, t: 0 }; floatText(H.cx + G.dx, H.gy - H.petS * 1.5, 'Pfft!'); sfx('gust'); if (touchCount('puff') === 1) toast(p.name + ' puffs up big and proud, then lets it all out. Pfft!', 2800); save(); }
  else if (s <= 0.8) { G.boing = { sx: 1 - (1 - s) * 0.6, sy: 1 - (1 - s) * 0.95, tilt: 0, t: 0 }; H.pa.hopV = 320; floatText(H.cx + G.dx, H.gy - H.petS * 1.5, 'Ta-da!'); sfx('chirp'); if (touchCount('curl') === 1) toast(p.name + ' curls up into a tiny ball, then pops out again.', 2800); save(); }
  else G.boing = { sx: s >= 1 ? k : 1 - (1 - s) * 0.6, sy: s >= 1 ? k : 1 - (1 - s) * 0.95, tilt: 0, t: 0 };
}

/* ---------- the journal ---------- */
function touchJournal() {
  const t = S.j.touch || {}, names = [['hug', 'big hug', 'big hugs'], ['boop', 'boop', 'boops'], ['tickle', 'tickle', 'tickles'], ['stretch', 'stretch', 'stretches'], ['light', 'light followed', 'lights followed'], ['beat', 'beat echoed', 'beats echoed'], ['shake', 'snow globe', 'snow globes'], ['puff', 'puff', 'puffs'], ['curl', 'curl', 'curls']];
  const bits = names.filter(n => t[n[0]]).map(n => t[n[0]] + ' ' + (t[n[0]] === 1 ? n[1] : n[2]));
  return bits.length ? 'Fingertip play: ' + bits.join(', ') + '.' : '';
}
