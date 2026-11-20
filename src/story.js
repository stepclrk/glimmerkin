/* ===== The story of the glooms (4.4.11) =====
   Six chapters, one for each heart of the journey the player has ever beaten (S.reg.most), told after the quest and
   kept in the journal to read again. From the first chapter on, a gloom is calmed rather than chased off: the same
   little, the same sparks, but its light comes back, it is counted (S.calmed) and it may visit the garden. */
const CHAPTERS = [
  { title: 'The lamp that went out', text: [
    'Long ago, every gloom was a little like yours, each with a light of its own. When the great lamp over the isles went out, they lost their way in the dark, and forgot who they were.',
    'The glooms you meet in the worlds are not cross. They are lost.'] },
  { title: 'Where the light went', text: [
    'The lamp did not break. A long winter wind blew it out, and its light scattered through the worlds as star shards. That is why a portal home wakes when you gather them.',
    'A gloom that is calmed remembers a little of that light, and keeps it.'] },
  { title: 'Wick', text: [
    'The first to lose its light was a Lanternbug called Wick, who stayed out too late looking for the lamp. Its glow went cold and grey, and the dark crept into it.',
    'Every gloom since has a little of Wick in it: lost, a bit frightened, and hoping somebody kind will come.'] },
  { title: 'The keepers', text: [
    'Once, Glimmerkins were the keepers of the lamp. Each one looked after it for a while, then handed it on to its child, and stayed close by to help.',
    'Your family still does. That is why an elder stays at the nest.'] },
  { title: 'Why they gather at the hearts', text: [
    'The light runs deepest at the heart of each world, so that is where the glooms gather, trying to get warm. The biggest are the oldest, and the most lost.',
    'A boss that is calmed goes home lighter than it came.'] },
  { title: 'The lamp relit', text: [
    'With the last heart, enough light has come home to the isles to light the lamp again. It glows over every nest now, yours too.',
    'And the glooms? Every one you calmed remembers you. Some come to visit. One day, perhaps, they will all find their way home.'] }
];
const CALM_KEEP = 60;   // calmed glooms remembered by name of their kind and where they were met; the count goes on in the journal

function ensureStory() {
  if (!S.story || typeof S.story !== 'object') S.story = { told: 0 };
  if (!Array.isArray(S.calmed)) S.calmed = [];
}
const storyCalm = () => !!S.story && S.story.told >= 1;
const chaptersOpen = () => Math.min(CHAPTERS.length, (S.reg && S.reg.most) || 0);
const chapterDue = () => !!S.story && S.story.told < chaptersOpen();
/* Who tells it: the village's storyteller (4.4.12), else the most recent elder, else the wandering trader. */
function storyTeller() {
  const k = typeof villageStoryteller === 'function' ? villageStoryteller() : -1;
  const e = k >= 0 ? S.elders[k] : S.elders && S.elders.length ? S.elders[S.elders.length - 1] : null;
  return e ? { name: e.name, icon: 'elder:' + S.elders.indexOf(e) } : { name: 'The wandering trader', icon: 'thing:map' };
}
/* One chapter. `back` is where its last button goes: the journal, the village, or (for a newly told chapter) on to the
   next one due, if any. */
function openChapter(n, back) {
  const C = CHAPTERS[n], t = storyTeller(), fresh = n >= S.story.told;
  if (!C) return;
  if (fresh) { S.story.told = n + 1; save(); }
  const more = fresh && chapterDue();
  openSheet('<h2>' + esc(C.title) + '</h2><div class="card"><canvas data-ic="' + t.icon + '" data-size="64"></canvas><div class="tx"><strong>' + esc(t.name) + (t.name.startsWith('The ') ? ' tells' : ' tells') + ' a story</strong><small>Chapter ' + (n + 1) + ' of ' + CHAPTERS.length + (fresh ? ' · for beating the heart of a region' : '') + '</small></div></div>' +
    C.text.map(p => '<p>' + esc(p) + '</p>').join('') +
    (fresh && n === 0 ? '<p class="dim">From now on, a little sent to a gloom calms it instead of chasing it off. It costs the same sparks. The story goes on with each heart you beat, and the journal keeps it.</p>' : fresh && !more && n < CHAPTERS.length - 1 ? '<p class="dim">The next chapter comes with the next heart you beat.</p>' : '') +
    '<div class="btns">' + (more ? '<button class="btn main" data-do="next">Next chapter</button>' : back ? '<button class="btn" data-do="back">' + esc(back.label) + '</button><button class="btn main" data-do="ok">Thank you</button>' : '<button class="btn main" data-do="ok">Thank you</button>') + '</div>',
    { ok: closeSheet, next: () => openChapter(S.story.told, back), back: () => back && back.go() });
}
/* After a quest's results, or at start-up: the next chapter, if one is due. Returns whether it opened one. */
function tellStory() { if (!chapterDue() || scene !== 'home' || !ui.sheet.hidden) return false; openChapter(S.story.told); return true; }

/* A gloom calmed on a quest: kept by kind and where it was met, for the garden's visitors and the journal. */
function recordCalm(e, B) {
  S.calmed.push({ g: e.g, b: B.id, at: Date.now() }); if (S.calmed.length > CALM_KEEP) S.calmed.splice(0, S.calmed.length - CALM_KEEP);
  S.j.calmed = (S.j.calmed || 0) + 1; if (e.boss) S.j.calmedBoss = (S.j.calmedBoss || 0) + 1;
}
const calmedKinds = () => new Set((S.calmed || []).map(c => c.g));
/* Where the most recent calmed gloom of a kind was met, for its line in the garden. */
function calmedWhere(g) { const c = (S.calmed || []).filter(x => x.g === g).pop(); const B = c && BIOMES.find(b => b.id === c.b); return B ? B.name : ''; }

/* The journal's part: the chapters so far, to read again, and how many glooms have been calmed. */
function storyJournal() {
  if (!S.story || !S.story.told) return '';
  return '<h3>The story · ' + S.story.told + ' of ' + CHAPTERS.length + ' chapters</h3><p class="dim">' + (S.j.calmed ? S.j.calmed + (S.j.calmed === 1 ? ' gloom' : ' glooms') + ' calmed' + (S.j.calmedBoss ? ', ' + S.j.calmedBoss + (S.j.calmedBoss === 1 ? ' of them a boss' : ' of them bosses') : '') + '.' : 'No glooms calmed yet. Send a little to one on a quest.') + '</p><div class="list">' +
    CHAPTERS.slice(0, S.story.told).map((C, i) => '<button class="card" data-do="chapter" data-i="' + i + '"><canvas data-ic="calm:' + (i % GLOOMS.length) + '" data-size="40"></canvas><span class="tx"><strong>' + esc(C.title) + '</strong><small>Chapter ' + (i + 1) + '</small></span><span class="tag">Read</span></button>').join('') + '</div>';
}
