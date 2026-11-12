/* ===== The calendar: today's world ===== */
/* One extra portal a day, built from the date alone, so every player is sent to the same world that day.
   The map is fitted to each party's littles, as every world is. */
const TODAY_BONUS = 10;   // stardust on top of the usual pay, once a day
function todayPortal() {
  const day = localDay(), r = RNG((day * 7919 + 1013) >>> 0), B = r.pick(BIOMES);
  return { seed: r.int(1, 2147483646), biome: B.id, size: 'vale', name: worldName(r, B), today: day };
}
const todayDone = () => !!(S.today && S.today.day === localDay() && S.today.done);
/* After a quest: today's world finished for the first time today. Returns lines for the results, and the bonus. */
function todayAfter(q, success) {
  if (!success || !q.today || q.today !== localDay() || todayDone()) return { lines: [], dust: 0 };
  S.today = { day: q.today, done: true }; S.j.days = (S.j.days || 0) + 1;
  return { lines: ['Today\'s world is done: ' + TODAY_BONUS + ' stardust more. A new one opens tomorrow.'], dust: TODAY_BONUS };
}
function todayCard() {
  const o = todayPortal(), B = BIOMES.find(b => b.id === o.biome), done = todayDone(), tired = S.pet.rest < 25, off = done || tired;
  return '<button class="card' + (off ? ' off' : '') + '" data-do="go" data-i="today"' + (off ? ' disabled' : '') + ' style="border-color:var(--mint);background:rgba(134,232,200,.08)"><canvas data-ic="biome:' + B.id + '" data-size="60"></canvas><span class="tx"><strong>' + esc(o.name) + '</strong><small>Today\'s world · ' + B.name + ' · every player is sent here today</small><small>' + (done ? 'Done today. A new world opens tomorrow.' : 'Finish it for ' + TODAY_BONUS + ' stardust more.') + '</small></span><span class="tag ' + (done ? 'yes' : 'cost') + '">' + (done ? 'Done' : 'Go') + '</span></button>';
}
