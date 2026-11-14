/* ===== A gentle start: the game opens up one thing at a time, and old hands hear what is new ===== */
/* Each unlock opens after a number of finished quests (S.quests). Care, plain quests and playing with littles
   are there from the start. */
const UNLOCKS = [
  { id: 'today', at: 1, icon: 'biome:cloudspire', title: 'Today\'s world', text: () => 'Each day Where to? has one extra portal, the same for every player. Finish it for ' + TODAY_BONUS + ' stardust more. A new one opens every morning.' },
  { id: 'wishes', at: 1, icon: 'kin', title: 'Wishes', text: () => S.pet.name + ' has started to wish for things. When a glowing bubble shows beside it, tap the bubble to see what it wants. Granting a wish deepens your bond.' },
  { id: 'rules', at: 2, icon: 'biome:tidehollow', title: 'World rules', text: () => 'From now on each world type has a rule of its own, like the tides of Tidehollow or the dark of Gloamglass. The rule is named at the top of a quest. Tap the name to read how it works.' },
  { id: 'wardrobe', at: 2, icon: 'thing:wear:scarf', title: 'Dressing up', text: () => 'A wardrobe has opened, with a knitted scarf to start. Open the journal and press Wardrobe to dress ' + S.pet.name + ': one thing on its head, one at its neck and one on its face. The wandering trader sometimes carries more.' },
  { id: 'journey', at: 3, icon: 'thing:map', title: 'The journey', text: () => 'Six regions wait, opened one after another. Finish three quests in a region\'s world type to open its heart, then beat the boss there to open the next. ' + journeyLine() + ' Open the journey from Where to?' },
  { id: 'together', at: 4, icon: 'ob:fog', title: 'Littles together', text: () => 'Some blockers now need two littles at once. Ember and Tide make steam to clear fog, Stone and Bloom uproot stones, Gale and Glow shatter crystal. Where to? says what your three can do together.' },
  { id: 'treats', at: 5, icon: 'berry:bloom', title: 'Treats and little wishes', text: () => 'Open Feed and drag a berry onto a little to give it a treat. Its own kind\'s berry is its favourite. Each day one little has a small wish of its own, shown as a bubble beside it.' },
  { id: 'bonus', at: 6, icon: 'secret', title: 'Secret doors', text: () => 'Now and then a world hides a small shimmering door. Walk up to it and step through to a bonus world that plays in a different way. Nothing can go wrong in there, and what you earn comes home with you.' },
  { id: 'family', when: () => !!S.heir || S.gen > 1, icon: 'heir', title: 'A new generation', text: () => S.heir ? S.pet.name + ' has laid a starlit egg. Rub it warm and it hatches a new Glimmerkin, who starts the journey again. ' + S.pet.name + ' will stay at the nest as an elder, and everything you have stays too. There is no hurry: the egg waits until you are ready.' : 'Your Glimmerkin is one of a family now. The journal has its family tree.' },
  { id: 'garden', at: 7, icon: 'flower:bloom', title: 'The garden', text: () => 'A garden of your own has opened, with a gift of six seeds. Walk in from Where to?, plant a seed in a patch of soil, and tend it with a little of its kind. Flowers go on growing while you are away, and nothing ever wilts. There are hidden places to find, too.' }
];
const unlocked = id => { const u = UNLOCKS.find(x => x.id === id); return !u || (u.when ? u.when() : (S.quests || 0) >= u.at); };
/* Unlocks reached but not yet shown, marked as shown. */
function takeUnlocks() { const due = UNLOCKS.filter(u => unlocked(u.id) && !S.seen.includes(u.id)); due.forEach(u => S.seen.push(u.id)); if (due.length) save(); return due; }
function openUnlocks(due, then) {
  openSheet('<h2>Something new</h2>' + due.map(u => '<div class="card"><canvas data-ic="' + u.icon + '" data-size="56"></canvas><div class="tx"><strong>' + esc(u.title) + '</strong><small>' + esc(u.text()) + '</small></div></div>').join('<div style="height:8px"></div>') + '<div class="btns"><button class="btn main" data-do="ok">Lovely</button></div>', { ok: closeSheet }, then || null);
}

/* What's new: for players who were here before a change, shown once. Each entry has the news version it came in,
   and is left out while the thing it tells of is still locked: the unlock sheet tells of it later. */
const NEWS = [
  { v: 18, icon: 'gloom:5:4:boss', title: 'Bosses swipe back', text: 'A boss now eyes one of your littles. After a strike, it swipes, and that little goes dizzy and sits out the next strike. Send the little it is eyeing and it dodges.' },
  { v: 17, icon: 'gloom:0:2', title: 'Brave or scared', text: 'Each gloom now scares one kind of little, who will not go near it, bosses too. Tap a gloom to see who is brave enough to send. A scared little looks worried when one is close.' },
  { v: 17, icon: 'shard', title: 'Bright finish', text: 'Sparks your littles have not spent when you step through the portal now turn into stardust, 2 for each, so it pays to choose who you send.' },
  { v: 16, need: 'wardrobe', icon: 'thing:wear:bobble', title: 'Seasonal costumes', text: 'Each season the wandering trader brings something to wear: a bobble hat in winter, a sou\'wester in spring, a sun hat and star sunglasses in summer, an acorn cap in autumn. The last December gift holds a paper crown, and a ghost sheet turns up in Halloween week. Once yours, they can be worn all year.' },
  { v: 15, need: 'wardrobe', icon: 'thing:wear:scarf', title: 'Dressing up', text: 'There is a wardrobe now, with a knitted scarf to start. Open the journal and press Wardrobe to dress your Glimmerkin, or the elder. The wandering trader sometimes carries spectacles and hats.' },
  { v: 14, need: 'family', icon: 'heir', title: 'A new generation', text: 'A Glimmerkin that is Mythic and has finished the journey now lays a starlit egg. Rub it warm to hatch a new Glimmerkin, who starts the journey again. The old one stays at the nest as an elder, and everything you have stays too.' },
  { v: 13, need: 'garden', icon: 'thing:garden:lamp', title: 'Things for the garden', text: 'On some days the wandering trader now carries a bench, a lantern post, a bird bath or stepping stones. Things, in the garden, sets one down where your Glimmerkin stands.' },
  { v: 12, need: 'garden', icon: 'flower:bloom', title: 'A vase at the nest', text: 'A flower you pick in the garden now stands in a vase on the rim of the nest for a day. The vase holds three. Tap it to see what is in it, or to take one out.' },
  { v: 11, need: 'garden', icon: 'flower:ember', title: 'More garden', text: 'The garden goes on. A gate at the far end of it leads to a new quarter for each region of the journey, with its own soil and hidden places. Each gate opens when you beat that region\'s heart.' },
  { v: 10, need: 'garden', icon: 'flower:glow', title: 'The garden by night', text: 'Lilies, the flowers with Glow in them, now open after dark and fold by day, and the other flowers the other way round. The seasons reach the garden, too, and two more hidden places wait: one opens only at night, one only in its season.' },
  { v: 9, need: 'garden', icon: 'flower:ember+tide', title: 'Crossed flowers', text: 'Two different flowers in bloom side by side now cross, and make a seed with something of both. There are fifteen crosses to find, and the journal has a flower book for all 21. A bloom can be moved, too: tap it and choose Move it.' },
  { v: 8, need: 'garden', icon: 'flower:glow', title: 'Hidden places', text: 'The garden has four hidden places, with more soil, a wild flower and a seed pod. Look for something odd in the hedge: brambles, vines with fireflies, a stone door. The new Map button shows where to look.' },
  { v: 7, need: 'garden', icon: 'flower:bloom', title: 'The garden', text: 'A garden of your own to walk round. Plant seeds in its soil and tend them with your littles. Walk in from Where to?' },
  { v: 6, icon: 'paw', title: 'Welcome home', text: 'When the party comes home from a quest, the littles who stayed behind rush over to greet them, and friends hug.' },
  { v: 6, icon: 'book', title: 'Pictures', text: 'Open the journal and press Take a picture. Everyone poses, and the picture is kept in the journal.' },
  { v: 6, icon: 'paw', title: 'Copy me', text: 'Open Littles and press Play copy me. Your Glimmerkin points at the littles on the nest in turn: tap them in the same order.' },
  { v: 6, icon: 'paw', title: 'Nest life', text: 'Leave the nest be for a moment and watch: the littles chase each other, doze off, tidy their friends and show off to your Glimmerkin.' },
  { v: 6, icon: 'kin', title: 'Bedtime', text: 'When your Glimmerkin sleeps, the littles curl up against it, and it dreams of the last world it visited.' },
  { v: 6, icon: 'paw', title: 'Little towers', text: 'Carry a little onto another little\'s head and it climbs on top. Stack three and watch them wobble.' },
  { v: 6, icon: 'paw', title: 'Keepsakes', text: 'Now and then a little brings home something it found for your Glimmerkin. Tap the little to take it. Keepsakes sit on the rim of the nest, and each one remembers who found it.' },
  { v: 6, icon: 'paw', title: 'Home with bits of the world', text: 'Littles come home from a quest with soot, seaweed, leaves and more stuck to them. Stroke them clean.' },
  { v: 6, icon: 'kin', title: 'Teach it a trick', text: 'Draw a circle, a zigzag or a swipe on the sky near your Glimmerkin and it tries a trick. Stroke it to praise it. Five tries and it knows the trick for good.' },
  { v: 6, icon: 'berry:bloom', title: 'Catch!', text: 'Open Feed and flick a berry upwards. Your Glimmerkin leaps to catch it. A miss bounces on the nest, and a little scrambles for it.' },
  { v: 6, icon: 'kin', title: 'Its favourite spot', text: 'Its head, cheeks and tummy each feel different to stroke. One of them is its favourite each day: find it for a big purr.' },
  { v: 5, need: 'bonus', icon: 'secret', title: 'Secret doors', text: 'About one world in four hides a small shimmering door. Step through it to a bonus world that plays in a different way.' },
  { v: 4, icon: 'egg:330', title: 'Friends\' eggs', text: 'Two littles who become friends leave an egg in the cradle. It hatches a little of their two kinds: a twin when their kinds differ.' },
  { v: 4, icon: 'paw', title: 'Grown-up littles', text: 'At level 6 a little is all grown up: a little bigger, with fluffy side tufts and a star on its brow.' },
  { v: 3, icon: 'berry:frost', title: 'The seasons', text: 'The nest follows the calendar: snow in winter, blossom in spring, seeds on the summer air and falling leaves in autumn. In winter the trader carries frostberries.' },
  { v: 3, icon: 'present', title: 'December gifts', text: 'From the 1st to the 25th of December a wrapped gift waits by the nest each day. Tap it to open it. A gift you miss waits for your next visit.' },
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
  if (!Array.isArray(S.seen)) S.seen = UNLOCKS.filter(u => !u.when && S.quests >= u.at).map(u => u.id);
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
