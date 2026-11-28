/* ===== Big builds: something large to save stardust for =====
   Once the journey has opened, its sheet has three big builds after the nest pieces, each bought once with stardust and
   each with a job of its own: a mooring post (the trader calls every day), an observatory (Where to? says which
   portals hide a treasure vault or a secret door) and a lantern tower (every little carries an extra spark in every
   world). Each is drawn at the nest. Saved as `builds`, the ids bought. */
const BUILDS = {
  mooring: { name: 'Mooring post', price: 400, text: 'A post for the trader\'s balloon to tie up at. The trader calls every day.' },
  observatory: { name: 'Observatory', price: 600, text: 'A little domed telescope. Where to? says which portals hide a treasure vault or a secret door.' },
  tower: { name: 'Lantern tower', price: 900, text: 'A tall tower of lanterns that lights the way. Every little carries an extra spark in every world.' }
};
const BUILD_IDS = Object.keys(BUILDS);
const buildsOpen = () => unlocked('journey');
const built = id => Array.isArray(S.builds) && S.builds.includes(id);
function ensureBuilds() { S.builds = Array.isArray(S.builds) ? S.builds.filter(id => BUILDS[id]) : []; }
function buildsSection() {
  if (!buildsOpen()) return '';
  const card = id => { const B = BUILDS[id], have = built(id), off = have || S.dust < B.price;
    return '<button class="card' + (off && !have ? ' off' : '') + '" data-do="bigbuild" data-id="' + id + '"' + (off ? ' disabled' : '') + '><canvas data-ic="build:' + id + '" data-size="52"></canvas><span class="tx"><strong>' + esc(B.name) + '</strong><small>' + esc(B.text) + '</small><small>' + (have ? 'Built.' : S.dust < B.price ? 'Save up: you have ✦ ' + S.dust + '.' : 'Ready to build.') + '</small></span><span class="tag ' + (have ? 'yes' : 'cost') + '">' + (have ? 'Built' : '✦ ' + B.price) + '</span></button>'; };
  return '<h3>Big builds · ' + BUILD_IDS.filter(built).length + ' of ' + BUILD_IDS.length + '</h3><p class="dim">Large things to save up for, each with a job of its own.</p><div class="list">' + BUILD_IDS.map(card).join('') + '</div>';
}
function buildBig(id) {
  const B = BUILDS[id]; if (!B || built(id) || S.dust < B.price || !buildsOpen()) return false;
  S.dust -= B.price; S.builds.push(id); S.j.things['build:' + id] = true;
  if (id === 'mooring' && S.trader && !S.trader.stock) S.trader = null;   // the trader comes today after all
  sfx('buy'); save(); updateHud(); if (scene === 'home') rebuildHome();
  toast({ mooring: 'The mooring post is up. The trader\'s balloon will call every day.', observatory: 'The observatory is built. Where to? now says which portals hide a vault or a secret door.', tower: 'The lantern tower is lit. Every little carries an extra spark in every world.' }[id], 4200);
  return true;
}
/* The observatory: what a portal's world holds, for the party as it stands. Worked out once per portal and party. */
const lookCache = {};
function observatoryLine(o) {
  if (!built('observatory') || !o || o.rare || o.region) return '';
  const party = partyLittles(); if (!party.length) return '';
  const key = o.seed + ':' + party.map(l => l.id + (l.charm || '') + maxSparks(l)).join(',') + ':' + S.quests + ':' + Object.keys(TOOLS).map(k => S.tools[k] || 0).join('');
  if (!(key in lookCache)) { const w = questWorld(o, party); lookCache[key] = [w.vault ? 'a treasure vault' : '', w.secret ? 'a secret door' : ''].filter(Boolean); }
  const seen = lookCache[key];
  return seen.length ? 'The observatory sees ' + seen.join(' and ') + '.' : 'The observatory sees nothing hidden.';
}

/* ---------- drawing ---------- */
function drawMooring(c, x, y, s, t) {
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.fillStyle = '#5a3e5e'; c.beginPath(); c.moveTo(x - s * 0.34, y); c.quadraticCurveTo(x, y + s * 0.5, x + s * 0.34, y); c.closePath(); c.fill();
  c.fillStyle = '#6d4a3a'; c.strokeStyle = '#2a1830'; c.lineWidth = Math.max(1, s * 0.04); rrect(c, x - s * 0.06, y - s * 0.62, s * 0.12, s * 0.64, s * 0.04); c.fill(); c.stroke();
  c.fillStyle = '#ffd766'; c.beginPath(); c.arc(x, y - s * 0.66, s * 0.07, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(240,230,255,.75)'; c.lineWidth = Math.max(1, s * 0.025); c.beginPath(); c.moveTo(x, y - s * 0.5); c.quadraticCurveTo(x + s * 0.3, y - s * 0.9 + Math.sin(t) * s * 0.04, x + s * 0.5, y - s * 1.3); c.stroke();
  c.restore();
}
function drawObservatory(c, x, y, s, t, night) {
  c.save(); c.lineJoin = 'round';
  c.fillStyle = '#4a3a6e'; c.beginPath(); c.moveTo(x - s * 0.5, y); c.quadraticCurveTo(x, y + s * 0.6, x + s * 0.5, y); c.closePath(); c.fill();
  c.fillStyle = '#e8e0f6'; c.strokeStyle = '#2a1830'; c.lineWidth = Math.max(1, s * 0.035); c.fillRect(x - s * 0.3, y - s * 0.3, s * 0.6, s * 0.3); c.strokeRect(x - s * 0.3, y - s * 0.3, s * 0.6, s * 0.3);
  c.fillStyle = '#7fa6e0'; c.beginPath(); c.arc(x, y - s * 0.3, s * 0.3, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
  c.save(); c.translate(x + s * 0.05, y - s * 0.42); c.rotate(-0.6 + Math.sin(t * 0.2) * 0.1); c.fillStyle = '#c9a64a'; c.fillRect(0, -s * 0.05, s * 0.4, s * 0.1); c.strokeRect(0, -s * 0.05, s * 0.4, s * 0.1); c.restore();
  c.fillStyle = night ? '#ffe08a' : '#3a2f55'; c.beginPath(); c.arc(x - s * 0.14, y - s * 0.14, s * 0.06, 0, TAU); c.fill();
  if (night) glow(c, x - s * 0.14, y - s * 0.14, s * 0.2, 45, 100, 65, 0.5);
  c.restore();
}
function drawTower(c, x, y, s, t) {
  c.save(); c.lineJoin = 'round';
  c.fillStyle = '#4a3a6e'; c.beginPath(); c.moveTo(x - s * 0.36, y); c.quadraticCurveTo(x, y + s * 0.5, x + s * 0.36, y); c.closePath(); c.fill();
  c.fillStyle = '#b9a6d8'; c.strokeStyle = '#2a1830'; c.lineWidth = Math.max(1, s * 0.035);
  c.beginPath(); c.moveTo(x - s * 0.18, y); c.lineTo(x - s * 0.11, y - s * 0.9); c.lineTo(x + s * 0.11, y - s * 0.9); c.lineTo(x + s * 0.18, y); c.closePath(); c.fill(); c.stroke();
  for (const k of [0.3, 0.6]) { c.beginPath(); c.moveTo(x - s * (0.18 - k * 0.07), y - s * k * 0.9); c.lineTo(x + s * (0.18 - k * 0.07), y - s * k * 0.9); c.stroke(); }
  const ly = y - s * 1.02, fl = 0.85 + 0.15 * Math.sin(t * 6);
  glow(c, x, ly, s * 0.5 * fl, 45, 100, 65, 0.65);
  c.fillStyle = '#ffd766'; c.beginPath(); c.arc(x, ly, s * 0.1, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#6d4a3a'; c.beginPath(); c.moveTo(x - s * 0.15, ly - s * 0.08); c.lineTo(x, ly - s * 0.24); c.lineTo(x + s * 0.15, ly - s * 0.08); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
function drawBuildIcon(c, id, size) {
  const m = size / 2; glow(c, m, m, size * 0.5, 260, 60, 70, 0.25);
  if (id === 'mooring') drawMooring(c, m - size * 0.08, size * 0.82, size * 0.72, 0);
  else if (id === 'observatory') drawObservatory(c, m, size * 0.72, size * 0.9, 0, true);
  else drawTower(c, m, size * 0.86, size * 0.66, 0);
}
/* At the nest: the mooring post on the left of the isle, the observatory and the tower on rocks of their own. */
function drawBuilds(c, H, T) {
  if (!S.builds || !S.builds.length) return;
  const bs = H.baseS, night = (() => { const h = new Date().getHours(); return h >= 20 || h < 6; })();
  if (built('observatory')) drawObservatory(c, VW * 0.9, H.gy - bs * 1.45 + Math.sin(T * 0.5) * 3, clamp(bs * 0.42, 34, 56), T, night);
  if (built('tower')) drawTower(c, VW * 0.09, H.gy - bs * 1.2 + Math.sin(T * 0.5 + 1) * 3, clamp(bs * 0.42, 34, 56), T);
  if (built('mooring')) drawMooring(c, H.cx - H.rx * 0.9, H.gy - H.ry * 0.2, clamp(bs * 0.34, 26, 44), T);
}
