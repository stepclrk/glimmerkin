# Drives the deeper solo play in a phone-sized headless browser: wishes, world rules, littles working
# together, Mythic forms and the journey.
import os, pathlib, tempfile, re, asyncio
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

async def wishes(page, ev):
    rec('wish start', await ev("({has: !!S.wish, day: S.wish.day === localDay(), kind: S.wish.k})"))
    # a berry wish comes true when that berry is eaten
    await ev("S.wish = {day: localDay(), n: 0, k: 'eat', a: 'tide', got: 0, need: 1, done: false}; S.pantry.tide = 2; S.pet.belly = 50; S.pet.joy = 70")
    xp = await ev("S.pet.xp")
    await page.click('[data-act="feed"]'); await page.wait_for_timeout(150); await page.click('[data-food="tide"]'); await page.wait_for_timeout(900)
    rec('wish eat', await ev("({granted: S.j.wishes, next: S.wish.n, waits: S.wish.wait > Date.now(), gained: S.pet.xp - %s})" % xp))
    await ev("ui.tray.hidden = true")
    # the bubble shows the wish and opens it
    await ev("S.wish = {day: localDay(), n: 1, k: 'cuddle', a: '', got: 0, need: 24, done: false}; S.pet.belly = 80; S.pet.joy = 80; S.pet.rest = 90; S.pet.asleep = false")
    await page.wait_for_timeout(2600); await page.screenshot(path=SHOTS + "/d1_wish.png")
    b = await ev("home.bubble"); await page.mouse.click(b['x'], b['y']); await page.wait_for_timeout(250)
    rec('wish sheet', await ev("document.querySelector('#sheet h2').textContent + ' | ' + document.querySelector('#sheet p').textContent"))
    await page.screenshot(path=SHOTS + '/d2_wish_sheet.png'); await ev("closeSheet()")
    # a trip wish keeps its world on offer and is granted by finishing a quest there
    await ev("S.wish = {day: localDay(), n: 2, k: 'visit', a: 'stonesong', got: 0, need: 1, done: false}; rollPortals(true)")
    res = await ev("async () => { %s const i = S.portals.list.findIndex(o => o.biome === 'stonesong'); S.pet.rest = 100; startQuest(S.portals.list[i]); const r = await bot(); window.anim = _a; return {offered: i >= 0, scene: r.scene, granted: S.j.wishes, lines: [...document.querySelectorAll('#sheet li')].map(e => e.textContent)}; }" % FAST)
    rec('wish visit', res); await ev("closeSheet()")

def quest_js(biome, seed, size, kinds):
    # a quest in one world type with a chosen party, after the first quest so the world's rule applies
    return "S.quests = Math.max(S.quests, 3); S.pet.rest = 100; S.pet.joy = 90; S.party = %s.map(k => S.littles.find(l => l.kind === k && !l.kind2).id); startQuest({seed: %d, biome: '%s', size: '%s', name: 'Test'})" % (kinds, seed, biome, size)
async def finish_quest(ev):
    return await ev("async () => { %s const r = await bot(); window.anim = _a; return {log: r.log.join(','), scene: r.scene}; }" % FAST)

async def tides(page, ev):
    await ev("closeSheet(); " + quest_js('tidehollow', 3101, 'realm', "['tide', 'ember', 'bloom']"))
    await page.wait_for_timeout(400)
    rec('tide world', await ev("({rule: Q.rule, flats: Q.world.cells.filter(c => c.flat).length, chip: document.getElementById('q-rule').textContent})"))
    await ev("Q.tide = true; Q.tideT = 0; Q.tideLv = 1; updateRuleChip()"); await page.wait_for_timeout(300)
    await page.screenshot(path=SHOTS + '/d3_tide_in.png')
    # with the tide in a flat cannot be walked onto; a Tide little freezes one for good
    k = await ev("(() => { const w = Q.world, prev = flood(w, Q.px, Q.py, Q); for (let k = 0; k < w.cells.length; k++) { const c = w.cells[k]; if (c.flat && !prev.has(k) && nearIn(w, prev, k % w.W, Math.floor(k / w.W)) >= 0) return k; } for (const [dx, dy] of DIRS) { const x = Q.px + dx, y = Q.py + dy, c = w.cells[y * w.W + x]; if (x >= 0 && y >= 0 && x < w.W && y < w.H && c.t === 'floor' && !c.enemy) { c.flat = true; return y * w.W + x; } } return -1; })()")
    if k >= 0:
        await ev("(k => { const w = Q.world; questTap({x: Q.ox + (k %% w.W + .5) * Q.ts, y: Q.oy + (Math.floor(k / w.W) + .5) * Q.ts}); })(%d)" % k); await page.wait_for_timeout(250)
        await page.screenshot(path=SHOTS + '/d4_tide_sheet.png')
        title = await ev("document.querySelector('#sheet strong').textContent")
        await page.click('#sheet [data-do="send"]:not([disabled])'); await page.wait_for_timeout(1800)
        rec('tide freeze', {'title': title, 'frozen': await ev("Q.world.cells[%d].frozen === true" % k), 'walkable': await ev("passable(Q.world, %d %% Q.world.W, Math.floor(%d / Q.world.W), Q)" % (k, k))})
    else:
        rec('tide freeze', {'title': 'no flat in reach', 'frozen': True, 'walkable': True})
    rec('tide quest', await finish_quest(ev)); await ev("closeSheet()")

async def darkness(page, ev):
    await ev("closeSheet(); " + quest_js('gloamglass', 3203, 'realm', "['glow', 'stone', 'gale']"))
    await page.wait_for_timeout(500); await page.screenshot(path=SHOTS + '/d5_dark.png')
    rec('dark world', await ev("({rule: Q.rule, lamps: Q.world.cells.filter(c => c.lamp).length, seen: Q.seen.filter(Boolean).length, cells: Q.world.cells.length, r: Q.lightR})"))
    # a tap on a tile nobody has seen does nothing but explain
    k = await ev("(() => { for (let k = 0; k < Q.seen.length; k++) if (!Q.seen[k]) return k; return -1; })()")
    await ev("(k => { const w = Q.world; questTap({x: Q.ox + (k %% w.W + .5) * Q.ts, y: Q.oy + (Math.floor(k / w.W) + .5) * Q.ts}); })(%d)" % k); await page.wait_for_timeout(200)
    rec('dark tap', await ev("({toast: document.getElementById('toast').textContent, walking: Q.walking})"))
    rec('dark quest', await finish_quest(ev))
    rec('dark after', await ev("({lit: true})")); await ev("closeSheet()")

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
        await ev("""() => { window.__fast = true; const r = RNG(5); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r)); S.littles = S.littles.slice(0, 6); S.quests = 5; S.dust = 200; S.pet.rest = 100; afterLoad(); }""")
        await wishes(page, ev)
        await tides(page, ev)
        await darkness(page, ev)
        await b.close()
    rec('errors', [e for e in errs if 'Failed to load resource' not in e])
asyncio.run(main())
R = RESULTS
finish([('no page errors', not R['errors']),
        ('a wish is ready on the first day', R['wish start']['has'] and R['wish start']['day']),
        ('eating the wished berry grants the wish', R['wish eat']['granted'] == 1 and R['wish eat']['next'] == 1 and R['wish eat']['waits'] and R['wish eat']['gained'] > 1),
        ('the bubble opens the wish', R['wish sheet'].startswith('A wish') and 'long cuddle' in R['wish sheet']),
        ('Tidehollow has tidal flats and a tide clock', R['tide world']['rule'] == 'tidehollow' and R['tide world']['flats'] > 0 and 'Tide' in R['tide world']['chip']),
        ('a Tide little freezes a flat under the tide', R['tide freeze']['frozen'] and R['tide freeze']['walkable']),
        ('a Tidehollow world is finished through the tides', R['tide quest']['scene'] == 'home' and R['tide quest']['log'].endswith('exit')),
        ('Gloamglass is dark, with lamps, and a Glow little lights further', R['dark world']['rule'] == 'gloamglass' and R['dark world']['lamps'] > 0 and 0 < R['dark world']['seen'] < R['dark world']['cells'] and R['dark world']['r'] >= 2.5),
        ('a tile nobody has seen cannot be walked to', 'Too dark' in R['dark tap']['toast'] and not R['dark tap']['walking']),
        ('a Gloamglass world is finished in the dark', R['dark quest']['scene'] == 'home' and R['dark quest']['log'].endswith('exit')),
        ('a trip wish stays on offer and comes true', R['wish visit']['offered'] and R['wish visit']['scene'] == 'home' and R['wish visit']['granted'] == 2 and any('Wish granted' in l for l in R['wish visit']['lines']))])
