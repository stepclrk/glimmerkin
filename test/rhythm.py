# Drives the game's rhythm in a phone-sized headless browser: the gentle start that opens the game up one
# thing at a time, the news a returning player is shown, today's world, the seasons, December's gifts, friends'
# eggs and grown-up littles.
import os, pathlib, tempfile, re, asyncio, json
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
BOT = re.search(r'BOT = """(.*?)"""', (ROOT / 'test' / 'smoke.py').read_text(), re.S).group(1)
FAST = "const _a = window.anim; window.anim = (d, f) => _a(d * 0.1, f); const bot = __BOT__;".replace('__BOT__', BOT)
# Finish one quest in a world type, then close the results and wait for whatever opens after them.
QUEST = "async () => { __FAST__ closeSheet(); S.pet.rest = 100; S.pet.joy = 90; startQuest({seed: __SEED__, biome: '__BIOME__', size: 'nook', name: 'Test'}); const rule = Q.world.rule, pair = Q.world.cells.some(c => c.t === 'ob' && PAIRS[c.ob]); const r = await bot(); window.anim = _a; const results = document.querySelector('#sheet h2').textContent; closeSheet(); await new Promise(res => setTimeout(res, 400)); return {rule, pair, scene: r.scene, quests: S.quests, results, after: ui.sheet.hidden ? '' : [...document.querySelectorAll('#sheet strong')].map(e => e.textContent).join(', ')}; }".replace('__FAST__', FAST)

async def new_page(b, errs, init=None):
    ctx = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)
    page = await ctx.new_page()
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    await page.add_init_script(SEED_JS)
    if init: await page.add_init_script(init)
    await page.goto(PAGE); await page.wait_for_timeout(1300)
    return page

async def gentle_start(b, errs):
    page = await new_page(b, errs); ev = page.evaluate
    await ev("window.__fast = true")
    rec('fresh', await ev("({quests: S.quests, seen: S.seen, news: S.news === NEWS_V, sheet: !ui.sheet.hidden, wish: !!wishLive(), lwish: !!littleWishLive(), treats: unlocked('treats')})"))
    await ev("openQuestSheet()"); await page.wait_for_timeout(200)
    rec('fresh portals', await ev("({journey: !!document.querySelector('#sheet [data-do=journey]'), together: document.querySelector('#sheet').textContent.includes('work together') || document.querySelector('#sheet').textContent.includes('Together they'), portals: S.portals.list.map(o => o.biome)})"))
    await page.screenshot(path=SHOTS + '/r1_fresh_portals.png')
    seq = []
    for i, biome in enumerate(['tidehollow', 'gloamglass', 'mossroot', 'emberfall', 'stonesong']):
        res = await ev(QUEST.replace('__SEED__', str(5100 + i)).replace('__BIOME__', biome))
        seq.append(res)
        if i == 0: await page.screenshot(path=SHOTS + '/r2_something_new.png')
        if i == 2: await page.screenshot(path=SHOTS + '/r3_journey_unlocked.png')
    rec('quests', seq)
    rec('after five', await ev("({seen: S.seen, wish: unlocked('wishes') && !!S.wish, treats: unlocked('treats'), journeyCard: (openQuestSheet(), !!document.querySelector('#sheet [data-do=journey]')), reg: S.reg.n})"))
    await ev("closeSheet()")
    await page.context.close()

OLD = "localStorage.setItem('glimmerkin.v1', JSON.stringify(%s))"
async def returning(b, errs):
    # a save from before the gentle start, well into the game: it is shown what is new, once
    page = await new_page(b, errs); ev = page.evaluate
    old = await ev("(() => { const s = JSON.parse(JSON.stringify(S)); delete s.seen; delete s.news; s.quests = 7; s.savedAt = Date.now(); return s; })()")
    await page.context.close()
    page = await new_page(b, errs, "if (!sessionStorage.getItem('once')) { sessionStorage.setItem('once', 1); " + (OLD % json.dumps(old)) + " }")
    ev = page.evaluate
    await page.wait_for_function("!ui.sheet.hidden", timeout=5000); await page.wait_for_timeout(300)
    await page.screenshot(path=SHOTS + '/r4_whats_new.png')
    rec('returning', await ev("({title: document.querySelector('#sheet h2') && document.querySelector('#sheet h2').textContent, items: [...document.querySelectorAll('#sheet strong')].map(e => e.textContent), seen: S.seen, news: S.news === NEWS_V, expect: NEWS.filter(n => unlocked(n.need)).length})"))
    # Start again from what was stored, as a new visit does. Not a page reload: headless Chromium now and then hands
    # a reloaded file:// page an empty localStorage, which a player on the hosted site never meets.
    await ev("closeSheet(); S = loadLocal(); afterLoad(); introOnStart()"); await page.wait_for_timeout(300)
    rec('returning again', await ev("({sheet: !ui.sheet.hidden, title: ui.sheet.hidden ? '' : ui.sheet.querySelector('h2') && ui.sheet.querySelector('h2').textContent, quests: S.quests, news: S.news})"))
    await ev("closeSheet()"); await page.click('#btn-help'); await page.click('#sheet [data-do="news"]'); await page.wait_for_timeout(200)
    rec('help news', await ev("document.querySelector('#sheet h2').textContent"))
    await page.context.close()
    # a save from before the gentle start that never finished a quest has nothing to catch up on
    old2 = dict(old); old2['quests'] = 0
    page = await new_page(b, errs, "if (!sessionStorage.getItem('once')) { sessionStorage.setItem('once', 1); " + (OLD % json.dumps(old2)) + " }")
    rec('returning beginner', await page.evaluate("({sheet: !ui.sheet.hidden, seen: S.seen, news: S.news === NEWS_V})"))
    await page.context.close()

async def today(b, errs):
    page = await new_page(b, errs); ev = page.evaluate
    await ev("window.__fast = true; S.quests = 1; S.seen = UNLOCKS.map(u => u.id); S.pet.rest = 100; S.pet.joy = 90; save()")
    # the same portal whoever plays: it depends on the date alone
    rec('today same', await ev("(() => { const a = JSON.stringify(todayPortal()), keep = S; S = newGame(); const b = JSON.stringify(todayPortal()); S = keep; return {same: a === b, portal: todayPortal()}; })()"))
    await ev("openQuestSheet()"); await page.wait_for_timeout(200)
    await page.screenshot(path=SHOTS + '/r5_today_card.png')
    first = await ev("document.querySelector('#sheet .list .card strong').textContent")
    dust = await ev("S.dust")
    await page.click('#sheet [data-do="go"][data-i="today"]'); await page.wait_for_timeout(300)
    rec('today start', await ev("({scene, today: Q && Q.today === localDay(), name: Q && Q.world.name, biome: Q && Q.B.id})"))
    res = await ev("async () => { %s const r = await bot(); window.anim = _a; return {scene: r.scene, lines: [...document.querySelectorAll('#sheet li')].map(e => e.textContent).join(' | '), loot: document.querySelector('#sheet .loot').textContent}; }".replace('%s', FAST))
    rec('today quest', dict(res, first=first, dust=await ev("S.dust") - dust, days=await ev("S.j.days"), done=await ev("todayDone()")))
    await ev("closeSheet()"); await page.wait_for_timeout(500); await ev("closeSheet(); S.pet.rest = 100; openQuestSheet()"); await page.wait_for_timeout(200)
    await page.screenshot(path=SHOTS + '/r6_today_done.png')
    rec('today after', await ev("(() => { const b = document.querySelector('#sheet [data-i=today]'); b.disabled = false; b.click(); return {disabled: true, scene, tag: document.querySelector('#sheet [data-i=today] .tag') && document.querySelector('#sheet [data-i=today] .tag').textContent}; })()"))
    await ev("closeSheet(); openJournal()")
    rec('today journal', await ev("document.querySelector('#sheet p.dim').textContent"))
    await page.context.close()

# Moves the clock to a local date and time, keeping it running.
def at(when):
    return "(() => { const D = Date, off = new D('%s').getTime() - D.now(); class FD extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } } window.Date = FD; })()" % when

async def seasons(b, errs):
    page = await new_page(b, errs, at('2026-12-03T10:00:00')); ev = page.evaluate
    await ev("closeSheet(); S.createdAt = new Date('2026-11-01T09:00:00').getTime(); S.quests = 1; S.seen = UNLOCKS.map(u => u.id); S.trader = null; S.pet.belly = 50; save()")
    await page.wait_for_timeout(600)
    rec('winter', await ev("({season: seasonNow(), waiting: giftsWaiting(), gift: !!home.gift, trader: traderToday() && traderToday().map(o => o.id)})"))
    await page.screenshot(path=SHOTS + '/r7_winter_nest.png')
    g = await ev("home.gift"); await page.mouse.click(g['x'], g['y']); await page.wait_for_timeout(300)
    await page.screenshot(path=SHOTS + '/r8_gift.png')
    first = await ev("({title: document.querySelector('#sheet h2').textContent, text: document.querySelector('#sheet').textContent, got: S.advent.got.slice(), next: !!document.querySelector('#sheet [data-do=next]')})")
    await page.click('#sheet [data-do="next"]'); await page.wait_for_timeout(200)
    second = await ev("({got: S.advent.got.slice(), next: !!document.querySelector('#sheet [data-do=next]')})")
    await page.click('#sheet [data-do="next"]'); await page.wait_for_timeout(200)
    third = await ev("({got: S.advent.got.slice(), next: !!document.querySelector('#sheet [data-do=next]'), text: document.querySelector('#sheet').textContent, waiting: giftsWaiting().length, gifts: S.j.gifts})")
    await ev("closeSheet()"); await page.wait_for_timeout(300)
    rec('gifts', {'first': first, 'second': second, 'third': third, 'gift after': await ev("!!home.gift"),
                  'same': await ev("JSON.stringify(giftFor(2026, 9)) === JSON.stringify(giftFor(2026, 9))"), 'last': await ev("giftFor(2026, 25)")})
    # a frostberry: Belly and Joy, but no change of colour
    await ev("S.pantry.frost = 1; S.pet.belly = 50; S.pet.joy = 50")
    diet = await ev("JSON.stringify(S.pet.diet)")
    await page.click('[data-act="feed"]'); await page.wait_for_timeout(200); await page.click('[data-food="frost"]'); await page.wait_for_timeout(900)
    rec('frost', await ev("({belly: Math.round(S.pet.belly), joy: Math.round(S.pet.joy), eaten: S.j.frost, left: S.pantry.frost, same: JSON.stringify(S.pet.diet) === %s})" % json.dumps(diet)))
    await ev("ui.tray.hidden = true; openJournal()")
    rec('gift journal', await ev("document.querySelector('#sheet p.dim').textContent"))
    await page.context.close()
    page = await new_page(b, errs, at('2026-07-15T13:00:00')); ev = page.evaluate
    await ev("closeSheet(); S.quests = 1; S.trader = null"); await page.wait_for_timeout(500)
    rec('summer', await ev("({season: seasonNow(), waiting: giftsWaiting(), gift: !!home.gift, trader: (traderToday() || []).map(o => o.id)})"))
    await page.screenshot(path=SHOTS + '/r9_summer_nest.png')
    await page.context.close()
    page = await new_page(b, errs, at('2026-10-20T16:00:00')); await page.wait_for_timeout(400)
    rec('autumn', await page.evaluate("seasonNow()")); await page.screenshot(path=SHOTS + '/r10_autumn_nest.png')
    await page.context.close()
    page = await new_page(b, errs, at('2026-04-20T11:00:00')); await page.wait_for_timeout(400)
    rec('spring', await page.evaluate("seasonNow()")); await page.screenshot(path=SHOTS + '/r11_spring_nest.png')
    await page.context.close()

async def friends(b, errs):
    page = await new_page(b, errs); ev = page.evaluate
    await ev("closeSheet(); window.__fast = true; S.quests = 6; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; const [a, c] = S.littles; S.party = [a.id, c.id]; S.friends = {}; S.friends[pairKey(a.id, c.id)] = 4; S.eggs = []; save()")
    kinds = await ev("S.littles.map(l => l.kind)")
    res = await ev("async () => { %s S.pet.rest = 100; S.pet.joy = 90; startQuest({seed: 6100, biome: 'mossroot', size: 'nook', name: 'Test'}); const r = await bot(); window.anim = _a; return {scene: r.scene, lines: [...document.querySelectorAll('#sheet li')].map(e => e.textContent).join(' | '), egg: S.eggs[S.eggs.length - 1] || null}; }".replace('%s', FAST))
    rec('friends egg', dict(res, kinds=kinds))
    await ev("closeSheet()"); await page.wait_for_timeout(700); await ev("closeSheet()"); await page.wait_for_timeout(300)
    await page.screenshot(path=SHOTS + '/r12_friends_egg.png')
    await ev("S.eggs[S.eggs.length - 1].warm = 95; strokeEgg(S.eggs.length - 1)"); await page.wait_for_timeout(300)
    rec('friends hatch', await ev("({text: document.querySelector('#sheet').textContent, kinds: kindsOf(S.littles[S.littles.length - 1]), twins: S.j.twins, feggs: S.j.feggs})"))
    await page.screenshot(path=SHOTS + '/r13_friends_hatch.png'); await ev("closeSheet()")
    # a full nest: friends bring stardust instead
    rec('friends full', await ev("(() => { const r = RNG(9); while (S.littles.length < 8) S.littles.push(newLittle('stone', r)); S.eggs = []; const d = S.dust, line = friendEgg(S.littles[0], S.littles[1]); return {line, dust: S.dust - d, eggs: S.eggs.length}; })()"))
    # grown up at level 6: a treat that crosses it
    await ev("rebuildHome(); const l = S.littles[0]; l.xp = 89; l.treats = null; S.pantry[l.kind] = 1; giveTreat(l.id, l.kind)"); await page.wait_for_timeout(200)
    rec('grown', await ev("(() => { const l = S.littles[0]; return {level: littleLevel(l.xp), toast: document.getElementById('toast').textContent, look: lookOf(l).grown === true, home: litOf(l.id).L.grown === true, other: !!lookOf(S.littles[1]).grown}; })()"))
    await page.wait_for_timeout(1500); await page.screenshot(path=SHOTS + '/r14_grown.png')
    await ev("openLittle(S.littles[0].id)")
    rec('grown sheet', await ev("document.querySelector('#sheet small').textContent"))
    await page.screenshot(path=SHOTS + '/r15_grown_sheet.png')
    await page.context.close()

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        await gentle_start(b, errs)
        await returning(b, errs)
        await today(b, errs)
        await seasons(b, errs)
        await friends(b, errs)
        await b.close()
    rec('errors', [e for e in errs if 'Failed to load resource' not in e])
asyncio.run(main())
R = RESULTS
Q = R['quests']
finish([('no page errors', not R['errors']),
        ('a new player starts with care and plain quests only', R['fresh']['quests'] == 0 and R['fresh']['seen'] == [] and R['fresh']['news'] and not R['fresh']['sheet'] and not R['fresh']['wish'] and not R['fresh']['lwish'] and not R['fresh']['treats']),
        ('Where to? holds back the journey and littles together', not R['fresh portals']['journey'] and not R['fresh portals']['together']),
        ('every quest of the first five is finished', all(q['scene'] == 'home' for q in Q) and Q[-1]['quests'] == 5),
        ('the first two quests have no world rule', Q[0]['rule'] is None and Q[1]['rule'] is None),
        ('world rules start on the third quest', Q[2]['rule'] == 'mossroot' and Q[3]['rule'] == 'emberfall'),
        ('no pair blocker before the fifth quest', not any(q['pair'] for q in Q[:4])),
        ('each unlock is shown once, after the quest that opens it', [q['after'] for q in Q] == ["Today's world, Wishes", 'World rules, Dressing up', 'The journey', 'Littles together', 'Treats and little wishes']),
        ('after five quests everything is open', R['after five']['seen'] == ['today', 'wishes', 'rules', 'wardrobe', 'journey', 'together', 'treats'] and R['after five']['wish'] and R['after five']['treats'] and R['after five']['journeyCard']),
        ('the journey counts only once it is open', R['after five']['reg'] == 1),
        ('a returning player is shown what is new', R['returning']['title'] == "What's new" and len(R['returning']['items']) == R['returning']['expect'] and R['returning']['items'].index('Secret doors') < R['returning']['items'].index("Today's world") == R['returning']['items'].index('Secret doors') + 5 and R['returning']['news']),
        ('what a returning player has reached counts as shown', sorted(R['returning']['seen']) == sorted(['today', 'wishes', 'rules', 'wardrobe', 'journey', 'together', 'treats', 'bonus', 'garden'])),
        ('the news is shown only once', not R['returning again']['sheet'] and R['returning again']['quests'] == 7),
        ('the help sheet opens the news again', R['help news'] == "What's new"),
        ('a returning beginner is not shown news', not R['returning beginner']['sheet'] and R['returning beginner']['seen'] == [] and R['returning beginner']['news']),
        ("today's world is the same portal whoever plays", R['today same']['same']),
        ("today's world is first in Where to?", R['today quest']['first'] == R['today same']['portal']['name']),
        ("today's world starts and is finished", R['today start']['today'] and R['today quest']['scene'] == 'home'),
        ("finishing it pays the bonus once and counts the day", "Today's world is done" in R['today quest']['lines'] and R['today quest']['days'] == 1 and R['today quest']['done']),
        ("a finished today's world cannot be entered again today", R['today after']['scene'] == 'home' and R['today after']['tag'] == 'Done'),
        ("the journal counts the days", 'on 1 day' in R['today journal']),
        ('December is winter, with gifts waiting from the 1st', R['winter']['season'] == 'winter' and R['winter']['waiting'] == [1, 2, 3] and R['winter']['gift']),
        ('the trader carries frostberries in winter', 'frost' in (R['winter']['trader'] or [])),
        ('a gift opens, oldest first, and offers the next', R['gifts']['first']['title'] == 'A December gift' and R['gifts']['first']['got'] == [1] and R['gifts']['first']['next'] and R['gifts']['second']['got'] == [1, 2]),
        ('when every gift is open the nest has none and says another comes tomorrow', R['gifts']['third']['got'] == [1, 2, 3] and not R['gifts']['third']['next'] and 'Another gift comes tomorrow' in R['gifts']['third']['text'] and R['gifts']['third']['waiting'] == 0 and not R['gifts']['gift after'] and R['gifts']['third']['gifts'] == 3),
        ("a gift's contents are fixed, and the 25th holds a starfruit", R['gifts']['same'] and any(g['k'] == 'star' for g in R['gifts']['last'])),
        ('a frostberry feeds without changing colours', R['frost']['eaten'] == 1 and R['frost']['left'] == 0 and R['frost']['belly'] == 65 and R['frost']['joy'] >= 57 and R['frost']['same']),
        ('the journal counts December gifts', '3 December gifts opened' in R['gift journal']),
        ('summer has no gifts and no frostberries', R['summer']['season'] == 'summer' and R['summer']['waiting'] == [] and not R['summer']['gift'] and 'frost' not in R['summer']['trader']),
        ('the seasons follow the months', R['autumn'] == 'autumn' and R['spring'] == 'spring'),
        ('new friends leave an egg of their two kinds', 'are friends now' in R['friends egg']['lines'] and 'leave an egg' in R['friends egg']['lines'] and R['friends egg']['egg'] and R['friends egg']['egg']['kinds'] == R['friends egg']['kinds'][:2] and R['friends egg']['egg']['twin'] == (R['friends egg']['kinds'][0] != R['friends egg']['kinds'][1])),
        ("a friends' egg hatches their kinds and names them", 'Born to friends' in R['friends hatch']['text'] and R['friends hatch']['kinds'] == R['friends egg']['egg']['kinds'] and R['friends hatch']['feggs'] == 1),
        ('a full nest gets stardust instead of an egg', R['friends full']['dust'] == 25 and R['friends full']['eggs'] == 0 and 'stardust instead' in R['friends full']['line']),
        ('a little grows up at level 6', R['grown']['level'] == 6 and 'all grown up' in R['grown']['toast'] and R['grown']['look'] and R['grown']['home'] and not R['grown']['other']),
        ("the little's sheet says it is grown up", 'grown up' in R['grown sheet']),
       ])
