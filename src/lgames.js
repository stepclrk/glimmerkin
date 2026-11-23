/* ===== Little games (4.3.3): once a day one little asks to play a short game of its own ===== */
/* Each game adds itself to GAMES with: name, kind (the kind of little it belongs to), rule (one word for the top),
   line (one sentence for the ask), hint, text (its rule in full), icon(c, x, y, r), start(b), draw(b, c, dt), end(b, early)
   which returns { score, goal, label, line }, and any of down(b, pt), move(b, pt), up(b, pt, tap). A game sets b.played
   on the first move that counts. Games are played in the bonus world's frame (scene 'bonus', BW with lg set). */
const GAMES = {};
const GAME_XP = 3, GAME_JOY = 8;
const gameIds = () => Object.keys(GAMES);
const gameOf = l => { const g = gameIds().find(id => GAMES[id].kind === l.kind); return g || null; };
/* Today's ask: a little, chosen from the day and the creature's seed, and its game. A little whose kind has no game
   of its own yet asks for the game played least. */
function ensureGameAsk() {
  const day = localDay(); if (S.gask && S.gask.day === day) return S.gask;
  S.gask = null; if (!unlocked('games') || !S.littles.length || !gameIds().length) return null;
  const r = RNG((day * 733 + S.pet.seed * 11) >>> 0), pool = S.littles.length > 1 && S.lwish ? S.littles.filter(l => l.id !== S.lwish.id) : S.littles, l = r.pick(pool);
  const played = id => ((S.j.games || {})[id] || {}).n || 0, least = gameIds().sort((a, b) => played(a) - played(b) || a.localeCompare(b));
  S.gask = { day, id: l.id, g: gameOf(l) || least[0], done: false };
  return S.gask;
}
const gameAskLive = () => { const a = S.gask; return unlocked('games') && a && !a.done && a.day === localDay() && GAMES[a.g] && petById(a.id) ? a : null; };
function drawGameAsk(c, H, bs) {
  H.gbubble = null; const a = gameAskLive(), f = a && litOf(a.id); if (!f || H.carry && H.carry.id === f.l.id || S.pet.asleep || H.copy) return;
  const sd = f.x < H.cx ? -1 : 1, x = f.x + sd * bs * 0.3, y = f.y - bs * 0.74 + Math.sin(T * 2.2 + 1) * 2, r = Math.max(13, bs * 0.13); H.gbubble = { x, y };
  c.fillStyle = 'rgba(245,240,255,.95)'; c.beginPath(); c.arc(f.x + sd * bs * 0.1, f.y - bs * 0.46, r * 0.17, 0, TAU); c.fill(); c.beginPath(); c.arc(f.x + sd * bs * 0.18, f.y - bs * 0.56, r * 0.26, 0, TAU); c.fill();
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,207,107,' + (0.55 + 0.35 * Math.sin(T * 3)) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r + 3, 0, TAU); c.stroke();
  GAMES[a.g].icon(c, x, y, r * 0.8);
}
function openGameAsk() {
  const a = gameAskLive(); if (!a) return; const l = petById(a.id), D = GAMES[a.g];
  openSheet('<h2>' + esc(l.name) + ' wants to play</h2><div class="card"><canvas data-ic="little:' + l.id + '" data-size="64"></canvas><div class="tx"><strong>' + esc(D.name) + '</strong><small>' + esc(D.line) + '</small></div></div>' +
    '<p class="dim">A few minutes, and nothing can go wrong. Playing gives ' + esc(l.name) + ' ' + GAME_XP + ' experience, cheers up ' + esc(S.pet.name) + ' and earns 5 to 15 stardust.</p>' +
    '<div class="btns"><button class="btn" data-do="no">Not now</button><button class="btn main" data-do="go">Play with ' + esc(l.name) + '</button></div>', { no: closeSheet, go: () => { closeSheet(); const b = gameAskLive(); if (b) startGame(b.g, petById(b.id), true); } });
}
function startGame(id, l, paid) {
  if (!l || !GAMES[id] || scene !== 'home') return; const D = GAMES[id], seed = ((Date.now() / 1000 | 0) ^ (l.seed * 31)) >>> 0;
  ui.tray.hidden = true; home.ptr = null; home.carry = null;
  BW = { lg: true, g: id, D, l, f: { l, L: lookOf(l), kinds: kindsOf(l) }, paid: !!paid, played: false, seed, name: D.name, B: { bg: ['#1a1240', '#2a1c4a'] }, lits: [], t: 0, over: false, count: '', loot: { dust: 0, berries: {}, eggs: [] }, x: 0, y: 0, w: 1, h: 1 };
  scene = 'bonus'; ui.toast.classList.remove('on'); ui.barBonus.innerHTML = '<button data-b="leave">Back to the nest</button>';
  layoutBonus(); D.start(BW); setSceneUI(); bonusHud(); $('#q-biome').textContent = 'A game with ' + l.name; $('#q-rule').textContent = D.rule; $('#q-bag').hidden = true; sfx('gate');
}
/* The game is over: finished, or left from the bar. A game a little asked for pays; one played again from the journal does not. */
function gameOver(b, early) {
  const D = b.D, res = D.end(b, early), l = petById(b.l.id);
  if (early && !b.played) { gameLeave(b); return; }
  S.j.games = S.j.games || {}; const J = S.j.games[b.g] || (S.j.games[b.g] = { n: 0, best: 0 }); J.n++; const best = res.score > J.best; if (best) J.best = res.score;
  const lines = [], loot = []; let up = null;
  if (b.paid) {
    const dust = gamePay(res.score, res.goal); S.dust += dust; up = gainXp(dust); loot.push('<span><canvas data-ic="shard" data-size="26"></canvas>' + dust + ' stardust</span>');
    if (S.gask) S.gask.done = true; S.pet.joy = clamp(S.pet.joy + GAME_JOY, 0, 100);
    if (l) { const a0 = littleLevel(l.xp || 0); l.xp = (l.xp || 0) + GAME_XP; const a1 = littleLevel(l.xp); lines.push(l.name + ' gains ' + GAME_XP + ' experience' + (a1 > a0 ? ' and reached level ' + a1 + '.' : '.') + grownLine(l, a0, a1) + ' ' + S.pet.name + ', who watched every move, is happier for it.'); }
    if (res.score >= res.goal && l) { const k = l.kind; S.pantry[k] = (S.pantry[k] || 0) + 1; loot.push('<span><canvas data-ic="berry:' + k + '" data-size="26"></canvas>1</span>'); lines.push('For reaching the goal, ' + l.name + ' gives you ' + (/^[AEIOU]/.test(BERRY[k]) ? 'an ' : 'a ') + BERRY[k] + '.'); }
  } else lines.push('Just for fun: games played again from the journal earn nothing, but your best is kept.');
  if (up) lines.unshift(up);
  save(); sfx('win');
  openSheet('<h2>' + (res.score >= res.goal ? 'Well played!' : 'Good game!') + '</h2><div class="card"><canvas data-ic="little:' + b.l.id + '" data-size="64"></canvas><div class="tx"><strong>' + esc(D.name) + ': ' + esc(res.label) + '</strong><small>' + esc(res.line) + ' ' + (best ? 'Your best yet.' : 'Your best is ' + esc(D.best(J.best)) + '.') + '</small></div></div>' +
    (loot.length ? '<div class="loot">' + loot.join('') + '</div>' : '') + '<p class="dim">' + esc(lines.join(' ')) + '</p><div class="btns"><button class="btn main" data-do="ok">Back to the nest</button></div>', { ok: closeSheet }, () => gameLeave(b));
}
function gameLeave(b) {
  if (BW !== b) return; BW = null; scene = 'home'; $('#q-bag').hidden = false; setSceneUI(); rebuildHome(); updateHud();
  const f = litOf(b.l.id); if (f) { f.moodT = 1.6; burst(f.x, f.y - home.baseS * 0.3, 14, 330, { kind: 'heart', v: 100, size: 4, life: 1 }); }
}
function openGameRule() {
  const D = BW.D; openSheet('<h2>' + esc(D.name) + '</h2><p>' + esc(D.text) + '</p><p class="dim">A little game. Nothing can go wrong, and there is no losing: only a better or a smaller score.</p><div class="btns"><button class="btn main" data-do="ok">Got it</button></div>', { ok: closeSheet });
}
/* The journal's page of little games met, to play again for fun with the little they belong to. */
function gamePlayer(id) { const D = GAMES[id]; return S.littles.find(l => l.kind === D.kind) || S.littles.find(l => kindsOf(l).includes(D.kind)) || S.littles[0]; }
function openGames() {
  const J = S.j.games || {}, met = gameIds().filter(id => J[id] && J[id].n);
  openSheet('<h2>Little games</h2><p class="dim">The games your littles have asked you to play. Tap one to play it again, just for fun: stardust comes only when a little asks.</p>' +
    (met.length ? met.map(id => { const D = GAMES[id], l = gamePlayer(id), n = J[id].n; return '<button class="card" data-do="play" data-id="' + id + '" style="margin-bottom:8px"><canvas data-ic="' + (l ? 'little:' + l.id : 'game:' + id) + '" data-size="48"></canvas><span class="tx"><strong>' + esc(D.name) + '</strong><small>' + (l ? esc(l.name) + '\'s game · ' : '') + 'best: ' + esc(D.best(J[id].best)) + '</small><small>Played ' + (n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times') + '</small></span><span class="tag">Play</span></button>'; }).join('') : '<p>No games yet. One little a day asks to play: look for a bubble beside it in the nest.</p>') +
    '<div class="btns"><button class="btn main" data-do="back">Back to the journal</button></div>', { back: openJournal, play: d => { closeSheet(); startGame(d.id, gamePlayer(d.id), false); } });
}
