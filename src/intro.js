/* ===== A gentle start: the game opens up one thing at a time, and old hands hear what is new ===== */
/* Each unlock opens after a number of finished quests (S.quests). Care, plain quests and playing with littles
   are there from the start. */
const UNLOCKS = [
  { id: 'today', at: 1, icon: 'biome:cloudspire', title: 'Today\'s world', text: () => 'Each day Where to? has one extra portal, the same for every player. Finish it for ' + TODAY_BONUS + ' stardust more. A new one opens every morning.' },
  { id: 'wishes', at: 1, icon: 'kin', title: 'Wishes', text: () => S.pet.name + ' has started to wish for things. When a glowing bubble shows beside it, tap the bubble to see what it wants. Granting a wish deepens your bond.' },
  { id: 'rules', at: 2, icon: 'biome:tidehollow', title: 'World rules', text: () => 'From now on each world type has a rule of its own, like the tides of Tidehollow or the dark of Gloamglass. The rule is named at the top of a quest. Tap the name to read how it works.' },
  { id: 'journey', at: 3, icon: 'thing:map', title: 'The journey', text: () => 'Six regions wait, opened one after another. Finish three quests in a region\'s world type to open its heart, then beat the boss there to open the next. ' + journeyLine() + ' Open the journey from Where to?' },
  { id: 'together', at: 4, icon: 'ob:fog', title: 'Littles together', text: () => 'Some blockers now need two littles at once. Ember and Tide make steam to clear fog, Stone and Bloom uproot stones, Gale and Glow shatter crystal. Where to? says what your three can do together.' },
  { id: 'treats', at: 5, icon: 'berry:bloom', title: 'Treats and little wishes', text: () => 'Open Feed and drag a berry onto a little to give it a treat. Its own kind\'s berry is its favourite. Each day one little has a small wish of its own, shown as a bubble beside it.' }
];
const unlocked = id => { const u = UNLOCKS.find(x => x.id === id); return !u || (S.quests || 0) >= u.at; };
/* Unlocks reached but not yet shown, marked as shown. */
function takeUnlocks() { const due = UNLOCKS.filter(u => S.quests >= u.at && !S.seen.includes(u.id)); due.forEach(u => S.seen.push(u.id)); if (due.length) save(); return due; }
function openUnlocks(due, then) {
  openSheet('<h2>Something new</h2>' + due.map(u => '<div class="card"><canvas data-ic="' + u.icon + '" data-size="56"></canvas><div class="tx"><strong>' + esc(u.title) + '</strong><small>' + esc(u.text()) + '</small></div></div>').join('<div style="height:8px"></div>') + '<div class="btns"><button class="btn main" data-do="ok">Lovely</button></div>', { ok: closeSheet }, then || null);
}

/* What's new: for players who were here before a change, shown once. Each entry has the news version it came in,
   and is left out while the thing it tells of is still locked: the unlock sheet tells of it later. */
const NEWS = [
  { v: 2, need: 'today', icon: 'biome:cloudspire', title: 'Today\'s world', text: 'Each day Where to? has one extra portal, the same for every player. Finish it for a little more stardust.' },
  { v: 1, need: 'wishes', icon: 'kin', title: 'Wishes and Mythic forms', text: 'Your Glimmerkin wishes for things, up to three a day: tap the glowing bubble beside it. What it eats and where it travels now decide which of six Mythic forms it becomes.' },
  { v: 1, need: 'rules', icon: 'biome:emberfall', title: 'World rules', text: 'Each world type has a rule of its own: tides, wildfire, slick moss, gusts, song stones and darkness. Tap the rule\'s name at the top of a quest to read it.' },
  { v: 1, need: 'together', icon: 'ob:fog', title: 'Littles together', text: 'Fog banks, root-bound stones and singing crystals need two littles at once, or one twin with both kinds.' },
  { v: 1, need: 'journey', icon: 'thing:map', title: 'The journey', text: 'Six regions, each ending in a boss. Every region beaten lets you build a new piece of the nest. Open it from Where to?' },
  { v: 1, icon: 'paw', title: 'Playing with littles', text: 'Stroke a little, or tap it twice for a trick. Press and hold to carry it: onto the nest to take it along, onto a perch to rest. Drag a berry from Feed onto a little for a treat. Littles chase the ball, dance to the music box, make friends and have small wishes of their own.' },
  { v: 1, icon: 'shard', title: 'Sparks at a glance', text: 'When you send a little, each portrait shows how many sparks it has left.' }
];
const NEWS_V = NEWS.reduce((m, n) => Math.max(m, n.v), 0);
function openNews(all) {
  const items = NEWS.filter(n => (all || n.v > (S.news || 0)) && unlocked(n.need)).sort((a, b) => b.v - a.v);   // newest first
  S.news = NEWS_V; items.forEach(n => { if (n.need && !S.seen.includes(n.need)) S.seen.push(n.need); }); save();   // told of here, so no unlock sheet later
  openSheet('<h2>What\'s new</h2><p class="dim">Things that have come to Glimmerkin lately.</p><div class="list">' + items.map(n => '<div class="card"><canvas data-ic="' + n.icon + '" data-size="52"></canvas><div class="tx"><strong>' + esc(n.title) + '</strong><small>' + esc(n.text) + '</small></div></div>').join('') + '</div><div class="btns"><button class="btn main" data-do="ok">Lovely</button></div>', { ok: closeSheet });
}
/* Saves from before the gentle start: what they have already reached counts as shown, and they get the news. */
function ensureIntro() {
  if (!Array.isArray(S.seen)) S.seen = UNLOCKS.filter(u => S.quests >= u.at).map(u => u.id);
  if (S.news === undefined) S.news = S.quests >= 1 ? 0 : NEWS_V;   // a player who never finished a quest has nothing to catch up on
  S.j.rules = S.j.rules || {};
}
/* At start-up: news first, for those who have some; otherwise anything unlocked but never shown. */
function introOnStart() {
  if (S.news < NEWS_V && NEWS.some(n => n.v > S.news && unlocked(n.need))) { openNews(false); return true; }
  S.news = NEWS_V;
  const due = takeUnlocks(); if (due.length) { openUnlocks(due); return true; }
  return false;
}
