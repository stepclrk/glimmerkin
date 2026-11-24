# Drives what makes carried things more useful (spec 4.4.10) in a phone-sized headless browser: the lucky clover
# doubles berries, the chime stones' tune helps the Glimmerkin rest, the trader takes spares, the ember ring lets its
# wearer face a gloom that scares its kind, a full set of decorations lends an extra spark in its world type, and once
# the Glimmerkin has every mark a starfruit gives a little a look of its own. Keepsakes at work in quests: a chime door
# played on your chime stones, a starfruit shrine, and a banner that calls a portal to its world type.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 1357; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
# a free floor tile beside the start
NEXT = "(() => { const w = Q.world, s = w.start; for (const [dx, dy] of DIRS) { const x = s.x + dx, y = s.y + dy; if (x < 0 || y < 0 || x >= w.W || y >= w.H) continue; const c = w.cells[y * w.W + x]; if (c.t === 'floor' && !c.enemy && !c.item && !c.slick && c.pad === undefined) return y * w.W + x; } return -1; })()"
PORTAL = "{seed: %d, biome: '%s', size: 'nook', name: 'Test Nook'}"

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        page = await (await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)).new_page()
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.add_init_script(SEED_JS)
        await page.goto(PAGE); await page.wait_for_timeout(800)
        ev = page.evaluate
        await ev("""() => { window.__fast = true; closeSheet(); S.quests = 14; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; S.pet.rest = 100; S.pet.asleep = false; S.pet.joy = 50; S.tools = {}; S.charms = {}; S.decor = [];
          S.party = S.littles.slice(0, 2).map(l => l.id); window.__toasts = []; const t0 = toast; window.toast = (m, ms) => { __toasts.push(m); t0(m, ms); }; }""")

        # the lucky clover: berries come in twos, on top of a Bloom little's doubling
        await ev("() => { S.littles[0].charm = 'clover'; startQuest(%s); }" % (PORTAL % (101, 'gloamglass')))
        k = await ev(NEXT)
        rec('clover', await ev("k => { const c = Q.world.cells[k]; c.item = {k: 'berry', el: 'ember', n: 1}; collectAt(k); return {got: Q.loot.berries.ember, dbl: Q.dbl, clover: Q.clover}; }", k))
        await ev("() => { Q.clover = false; const c = Q.world.cells[%d]; c.item = {k: 'berry', el: 'tide', n: 1}; collectAt(%d); }" % (k, k))
        rec('no clover', await ev("Q.loot.berries.tide"))
        await ev("() => { finishQuest(false); closeSheet(); delete S.littles[0].charm; }")

        # the chime stones' tune: sleep is quicker with more stones, and the stone says so
        rec('rest', await ev("""() => { const p = S.pet, out = {}; for (const n of [0, 1, 8]) { S.chimes = n; p.asleep = true; p.rest = 10; S.lastTick = Date.now() - 100e3; tickStats(); out[n] = Math.round(p.rest); } p.asleep = false; out.text = thingText('chime'); return out; }"""))

        # the trader takes spares: beyond one of each, for stardust, or a spare charm for a map piece
        await ev("() => { S.tools = {seed: 3, key: 1}; S.charms = {ring: 2, feather: 1}; S.maps = 0; S.dust = 0; S.trader = null; S.j.trader = false; openShop(); }")
        await page.wait_for_selector('#sheet [data-do="sell"]')
        await page.screenshot(path=SHOTS + '/u1_sell_spares.png')
        rec('sell section', await ev("({text: ui.sheet.textContent, sells: [...ui.sheet.querySelectorAll('[data-do=sell]')].map(b => b.dataset.id), maps: [...ui.sheet.querySelectorAll('[data-do=sellmap]')].map(b => b.dataset.id)})"))
        await page.click('#sheet [data-do="sell"][data-id="tool:seed"]')
        await page.click('#sheet [data-do="sell"][data-id="tool:seed"]')
        rec('sold seeds', await ev("({seed: S.tools.seed, dust: S.dust, more: !!ui.sheet.querySelector('[data-do=sell][data-id=\"tool:seed\"]')})"))
        await page.click('#sheet [data-do="sellmap"][data-id="charm:ring"]')
        rec('swapped a ring', await ev("({ring: S.charms.ring, maps: S.maps, more: !!ui.sheet.querySelector('[data-id=\"charm:ring\"]'), sold: S.j.sold})"))
        await ev("closeSheet()")

        # the ember ring: a little faces a gloom that scares its kind only while it wears one
        await ev("() => { S.tools = {}; S.pet.rest = 100; startQuest(%s); }" % (PORTAL % (202, 'emberfall')))
        k = await ev(NEXT)
        sheet = "() => { const k = %d, w = Q.world, l = Q.lits[0]; w.cells[k].enemy = {g: GLOOMS.findIndex(g => g.scares === l.l.kind), tough: 2}; questTap({x: Q.ox + (k %% w.W + 0.5) * Q.ts, y: Q.oy + (Math.floor(k / w.W) + 0.5) * Q.ts}); const row = ui.sheet.querySelector('[data-do=send][data-i=\"0\"]'); const out = {text: row && row.textContent, off: row && row.disabled}; closeSheet(); return out; }" % k
        rec('scared, no ring', await ev(sheet))
        await ev("() => { Q.lits[0].ring = true; }")
        rec('scared, with ring', await ev(sheet))
        await ev("() => { finishQuest(false); closeSheet(); }")
        rec('ring text', await ev("CHARMS.ring.text"))

        # a full set of decorations for a world type: an extra spark there, and only there
        await ev("() => { S.decor = ['decor:lantern:tidehollow', 'decor:banner:tidehollow', 'decor:chime:tidehollow']; S.pet.rest = 100; __toasts.length = 0; startQuest(%s); }" % (PORTAL % (303, 'tidehollow')))
        rec('full set', await ev("({sp: Q.lits.map(f => f.sp - maxSparks(f.l)), toasts: __toasts.slice()})"))
        await ev("() => { finishQuest(false); closeSheet(); S.pet.rest = 100; startQuest(%s); }" % (PORTAL % (304, 'mossroot')))
        rec('other world', await ev("Q.lits.map(f => f.sp - maxSparks(f.l))"))
        await ev("() => { finishQuest(false); closeSheet(); openJournal(); }")
        rec('journal sets', await ev("() => { const t = ui.sheet.textContent; closeSheet(); return t; }"))

        # starfruit for a little: only once the Glimmerkin has every mark
        lid = await ev("S.littles[1].id")
        await ev("id => { S.pet.marks = ['halo']; S.pantry.star = 2; openLittle(id); }", lid)
        rec('before every mark', await ev("!!ui.sheet.querySelector('[data-do=star]')"))
        await ev("id => { S.pet.marks = Object.keys(MARKS); openLittle(id); }", lid)
        await page.wait_for_selector('#sheet [data-do="star"]')
        await page.click('#sheet [data-do="star"]')
        await page.wait_for_timeout(200)
        await page.screenshot(path=SHOTS + '/u2_little_mark.png')
        rec('little star', await ev("id => { const l = petById(id); return {mark: l.mark, look: lookOf(l).marks, star: S.pantry.star, again: !!ui.sheet.querySelector('[data-do=star]'), text: ui.sheet.textContent}; }", lid))
        # keepsake places: only those the player can use are asked for
        rec('who can use what', await ev("() => { const out = {}; S.chimes = 2; S.pantry.star = 0; out.none = relicsFor(); S.chimes = 3; out.song = relicsFor(); S.pantry.star = 1; out.both = relicsFor(); return out; }"))
        RL = "() => { const g = window.__gw || (window.__gw = genWorld); window.genWorld = (a, b, c, d, e, o) => g(a, b, c, d, e, Object.assign({}, o, {relic: 1, relics: [%s]})); }"
        OPEN = "() => { closeSheet(); S.pet.rest = 100; startQuest(%s); const w = Q.world; w.cells.forEach(c => { if (c.t === 'ob') c.cleared = true; c.enemy = null; }); Q.gateOpen = true; Q.songOpen = true; }"
        TAP_RL = "() => { const v = Q.world.relic; questTap({x: Q.ox + (v.x + 0.5) * Q.ts, y: Q.oy + (v.y + 0.5) * Q.ts}); }"
        # the chime door: play its tune back on your chime stones
        await ev(RL % "'song'")
        await ev("() => { S.chimes = 4; __toasts.length = 0; }")
        await ev(OPEN % (PORTAL % (505, 'stonesong')).replace("'nook'", "'vale'"))
        rec('a chime door', await ev("Q.world.relic"))
        await ev(TAP_RL); await page.wait_for_function("!ui.sheet.hidden")
        await page.screenshot(path=SHOTS + '/u3_song_door.png')
        rec('song sheet', await ev("({text: ui.sheet.textContent, stones: ui.sheet.querySelectorAll('[data-do=note]').length, tune: songTune(Q.world)})"))
        tune = RESULTS['song sheet']['tune']
        await page.click('#sheet [data-do="note"][data-n="%d"]' % ((tune[0] + 1) % 4))
        rec('a wrong note', await ev("({done: Q.world.cells[Q.world.relic.y * Q.world.W + Q.world.relic.x].relic.done, toast: __toasts[__toasts.length - 1]})"))
        dust0 = await ev("Q.loot.dust")
        for n in tune:
            await page.click('#sheet [data-do="note"][data-n="%d"]' % n)
        await page.wait_for_function("!ui.sheet.hidden && ui.sheet.textContent.includes('The chime door opens')")
        rec('the tune played back', await ev("d => ({done: Q.world.cells[Q.world.relic.y * Q.world.W + Q.world.relic.x].relic.done, dust: Q.loot.dust - d, found: Q.found.length, chimes: S.chimes, n: S.j.songs})", dust0))
        await ev("() => { closeSheet(); finishQuest(false); closeSheet(); }")
        # the starfruit shrine: a starfruit fills every little with sparks, and one more besides
        await ev(RL % "'shrine'")
        await ev("() => { S.pantry.star = 1; }")
        await ev(OPEN % (PORTAL % (606, 'gloamglass')).replace("'nook'", "'vale'"))
        await ev("() => { Q.lits.forEach(f => { f.sp = 0; }); }")
        sp0 = await ev("Q.lits.map(f => f.max)")
        await ev(TAP_RL); await page.wait_for_function("!ui.sheet.hidden")
        rec('shrine sheet', await ev("ui.sheet.textContent"))
        await page.click('#sheet [data-do="offer"]')
        rec('offered', await ev("m0 => ({star: S.pantry.star, max: Q.lits.map((f, i) => f.max - m0[i]), full: Q.lits.every(f => f.sp === f.max), done: Q.world.cells[Q.world.relic.y * Q.world.W + Q.world.relic.x].relic.done})", sp0))
        await ev("() => { finishQuest(false); closeSheet(); window.genWorld = window.__gw; }")
        # a banner calls a portal to its world type, once each time the portals drift. Today's wishes are granted, so the
        # portals they would hold on to cannot fill all three places a banner's portal can take
        await ev("() => { S.decor = ['decor:banner:emberfall']; S.pet.rest = 100; S.pet.asleep = false; const d = localDay(); S.wish = { day: d, n: 0, k: 'visit', a: 'emberfall', got: 1, need: 1, done: true }; S.lwish = S.littles.length ? { day: d, id: S.littles[0].id, k: 'visit', a: 'emberfall', done: true } : null; rollPortals(true); openQuestSheet(); }")
        # when the journey and the day's wishes hold all three portals, the sheet says so and offers no banner
        rec('banner held', await ev("""() => { const w = S.wish, lw = S.lwish, L = S.portals.list, b2 = L[2].biome, u = S.unlocked ? S.unlocked.slice() : null, d = localDay();
          S.wish = { day: d, n: 0, k: 'visit', a: L[0].biome, got: 0, need: 1, done: false }; S.lwish = { day: d, id: S.littles[0].id, k: 'visit', a: L[1].biome, done: false }; L[2].biome = L[0].biome;
          const live = !!wishLive() && !!littleWishLive(); openQuestSheet();
          const out = { live, place: bannerPlace() === undefined, button: !!ui.sheet.querySelector('[data-do=banner]'), text: ui.sheet.textContent.includes('No banner can call a portal just now') };
          followBanner('emberfall'); out.called = S.portals.banner || null;
          S.wish = w; S.lwish = lw; L[2].biome = b2; openQuestSheet(); return out; }"""))
        await page.wait_for_selector('#sheet [data-do="banner"][data-b="emberfall"]:not([disabled])')
        await page.click('#sheet [data-do="banner"][data-b="emberfall"]')
        await page.wait_for_function("!!S.portals.banner", timeout=5000)
        rec('banner', await ev("({banner: S.portals.banner, called: S.portals.list.filter(o => o.banner).map(o => o.biome), again: !!ui.sheet.querySelector('[data-do=banner]'), text: ui.sheet.textContent.includes('banner called a portal')})"))
        await ev("closeSheet()")
        await ev("save()")
        await page.reload(); await page.wait_for_timeout(800)
        rec('after a reload', await ev("id => petById(id).mark", lid))
        rec('errors', errs)
        await b.close()

    R = RESULTS
    finish([
        ('the clover doubles berries', R['clover']['clover'] and R['clover']['got'] == (4 if R['clover']['dbl'] else 2) and R['no clover'] == (2 if R['clover']['dbl'] else 1)),
        ('the chime tune quickens sleep, only from two stones', R['rest']['0'] == 35 and R['rest']['1'] == 35 and R['rest']['8'] == 55 and 'rest faster' in R['rest']['text']),
        ('the trader lists only spares', sorted(R['sell section']['sells']) == ['charm:ring', 'tool:seed'] and R['sell section']['maps'] == ['charm:ring'] and 'Sell spares' in R['sell section']['text']),
        ('selling spares pays stardust and keeps one', R['sold seeds'] == {'seed': 1, 'dust': 12, 'more': False}),
        ('a spare charm swaps for a map piece', R['swapped a ring']['ring'] == 1 and R['swapped a ring']['maps'] == 1 and not R['swapped a ring']['more'] and R['swapped a ring']['sold'] == 3),
        ('without the ember ring a scared little stays back', R['scared, no ring']['off'] and 'Too scared' in R['scared, no ring']['text']),
        ('with the ember ring it faces the gloom', not R['scared, with ring']['off'] and 'Too scared' not in R['scared, with ring']['text'] and 'scares its kind' in R['ring text']),
        ('a full set gives an extra spark in its world type', all(n == 1 for n in R['full set']['sp']) and any('full Tidehollow set' in t for t in R['full set']['toasts'])),
        ('and not elsewhere', all(n == 0 for n in R['other world'])),
        ('the journal names full sets', 'Full sets: Tidehollow' in R['journal sets']),
        ('no starfruit for a little before every mark', not R['before every mark']),
        ('a starfruit gives a little a mark of its own, once', R['little star']['mark'] and R['little star']['look'] == [R['little star']['mark']] and R['little star']['star'] == 1 and not R['little star']['again'] and 'from a starfruit' in R['little star']['text']),
        ('the mark is kept', R['after a reload'] == R['little star']['mark']),
        ('only keepsake places the player can use are asked for', R['who can use what'] == {'none': [], 'song': ['song'], 'both': ['song', 'shrine']}),
        ('a chime door offers your chime stones to play on', R['a chime door']['id'] == 'song' and 'Chime door' in R['song sheet']['text'] and R['song sheet']['stones'] == 4 and len(R['song sheet']['tune']) == 3),
        ('a wrong note starts again', not R['a wrong note']['done'] and 'Not quite' in R['a wrong note']['toast']),
        ('the tune played back opens it, nothing spent', R['the tune played back']['done'] and 25 <= R['the tune played back']['dust'] <= 35 and R['the tune played back']['found'] == 1 and R['the tune played back']['chimes'] == 4 and R['the tune played back']['n'] == 1),
        ('the shrine takes a starfruit and fills every little, plus one', 'Starfruit shrine' in R['shrine sheet'] and R['offered']['star'] == 0 and all(n == 1 for n in R['offered']['max']) and R['offered']['full'] and R['offered']['done']),
        ('a banner calls a portal to its world type, once', R['banner']['banner'] == 'emberfall' and R['banner']['called'] == ['emberfall'] and not R['banner']['again'] and R['banner']['text']),
        ('with all three portals held, the sheet says no banner can call one', R['banner held']['live'] and R['banner held']['place'] and not R['banner held']['button'] and R['banner held']['text'] and R['banner held']['called'] is None),
        ('no page errors', not R['errors']),
    ])

asyncio.run(main())
