# Drives nest play in a phone-sized headless browser: the Glimmerkin's favourite spot, catching berries, tricks it
# learns, littles coming home messy, keepsakes, little towers, the bedtime pile, nest life, copy me, pictures and
# the welcome home.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 4321; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
TOAST = "document.getElementById('toast').textContent"

async def stroke(page, x, y, n=8, dx=20):
    await page.mouse.move(x - dx, y); await page.mouse.down()
    for i in range(n):
        await page.mouse.move(x + (dx if i % 2 == 0 else -dx), y, steps=3)
    await page.mouse.up()

async def spot(page, ev):
    # each part of the Glimmerkin answers a stroke in its own way, and one spot a day is its favourite
    fav = await ev("favSpot()")
    pts = await ev("(() => { const H = home, ps = H.petS, ny = H.gy + H.ry * 0.12; return {head: [H.cx, ny - ps * 0.8], left: [H.cx - ps * 0.32, ny - ps * 0.5], right: [H.cx + ps * 0.32, ny - ps * 0.5], tummy: [H.cx, ny - ps * 0.15]}; })()")
    rec('spot zones', await ev("(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, spotAt({x: v[0], y: v[1]})])))(%s)" % str(pts).replace("'", '"')))
    other = [k for k in ['head', 'left', 'right', 'tummy'] if k != fav][0]
    await ev("S.wish = {day: localDay(), n: 0, k: 'cuddle', a: '', need: 24, got: 0, done: false, at: 0}; S.spot = null; S.j.spots = 0")
    await stroke(page, pts[other][0], pts[other][1], 6, 10)
    plain = await ev("({got: S.wish.got, found: !!(S.spot && S.spot.found), tilt: home.pa.tilt, wiggle: home.pa.wiggle})")
    await stroke(page, pts[fav][0], pts[fav][1], 6, 10); await page.wait_for_timeout(150)
    await page.screenshot(path=SHOTS + '/p1_spot.png')
    rec('spot stroke', {'fav': fav, 'other': other, 'plain': plain, 'got': await ev("S.wish.got"), 'found': await ev("S.spot.found"), 'days': await ev("S.j.spots"), 'toast': await ev(TOAST), 'journal': await ev("(() => { openJournal(); const t = ui.sheet.textContent; closeSheet(); return t.includes('favourite spot on 1 day'); })()")})

async def catch(page, ev):
    # a berry flicked up from the pantry: the Glimmerkin leaps and catches it, and it feeds as a tap does
    await ev("closeSheet(); S.pet.asleep = false; S.pet.belly = 40; S.pantry = {bloom: 6, tide: 2}; S.j.catchBest = 0; home.catchRun = 0; const l = S.littles.find(l => S.party.includes(l.id)); delete l.treats")
    await page.click('[data-act="feed"]'); await page.wait_for_timeout(200)
    b = await (await page.query_selector('[data-food="bloom"]')).bounding_box()
    x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
    belly = await ev("S.pet.belly")
    await page.mouse.move(x, y); await page.mouse.down()
    for i in range(1, 7):
        await page.mouse.move(x, y - i * 30)
    await page.mouse.up()
    flying = await ev("!!home.toss")
    await page.wait_for_timeout(250); await page.screenshot(path=SHOTS + '/p2_catch.png')
    await page.wait_for_function("!home.toss", timeout=8000)   # in the air for about a second, longer on a slow machine
    rec('catch flick', {'flying': flying, 'left': await ev("S.pantry.bloom"), 'belly': await ev("S.pet.belly") - belly, 'run': await ev("home.catchRun"), 'toss': await ev("!!home.toss")})
    # a second catch in a row is counted, and the best run is kept
    await ev("tossBerry('bloom', home.cx, VH - 120, 0, -950)"); await page.wait_for_function("!home.toss", timeout=8000)
    rec('catch run', {'run': await ev("home.catchRun"), 'best': await ev("S.j.catchBest")})
    # one flicked far to the side bounces on the nest: the nearest little on the nest gets it as a treat
    xp = await ev("S.littles.reduce((n, l) => n + (l.xp || 0), 0)")
    await ev("tossBerry('bloom', home.cx, VH - 120, 9000, -900)"); await page.wait_for_timeout(300)
    side = await ev("home.toss && home.toss.vx")
    for i in range(40):
        await page.wait_for_timeout(100)
        if not await ev("!!home.toss"): break
    rec('catch miss', {'side': side, 'run': await ev("home.catchRun"), 'best': await ev("S.j.catchBest"), 'left': await ev("S.pantry.bloom"), 'xp': await ev("S.littles.reduce((n, l) => n + (l.xp || 0), 0)") - xp, 'toast': await ev(TOAST)})
    # a full Glimmerkin will not play catch, and nothing leaves the pantry
    await ev("S.pet.belly = 99; tossBerry('tide', home.cx, VH - 120, 0, -900)")
    rec('catch full', {'tide': await ev("S.pantry.tide"), 'toss': await ev("!!home.toss"), 'toast': await ev(TOAST)})
    await ev("ui.tray.hidden = true; S.pet.belly = 50")

async def draw(page, pts):
    await page.mouse.move(*pts[0]); await page.mouse.down()
    for q in pts[1:]: await page.mouse.move(*q)
    await page.mouse.up()

async def tricks(page, ev):
    # a shape drawn on the sky asks for a trick; a stroke straight after is praise; five praised tries teach it
    import math
    await ev("closeSheet(); S.pet.asleep = false; S.pet.tricks = {}; home.pa.trick = null; home.praise = null; S.pet.joy = 50")
    c = await ev("({x: VW * 0.55, y: home.gy - home.baseS * 1.9, px: home.cx, py: home.gy + home.ry * 0.12 - home.petS * 0.8})")
    circle = [(c['x'] + math.cos(i / 24 * 6.4) * 45, c['y'] + math.sin(i / 24 * 6.4) * 45) for i in range(25)]
    zig = [(c['x'] - 60 + (i % 2) * 120, c['y'] + i * 6) for i in range(6)]
    up = [(c['x'], c['y'] + 80 - i * 16) for i in range(11)]
    await draw(page, circle); await page.wait_for_timeout(100)
    tried = await ev("({k: home.pa.trick && home.pa.trick.k, good: home.pa.trick && home.pa.trick.good, toast: %s})" % TOAST)
    await page.wait_for_timeout(250); await page.screenshot(path=SHOTS + '/p3_trick_try.png')
    await stroke(page, c['px'], c['py'], 4, 10); await stroke(page, c['px'], c['py'], 4, 10)
    rec('trick try', {'tried': tried, 'n': await ev("S.pet.tricks.spin")})
    # four more praised tries and it has learned to spin
    for i in range(4):
        await page.wait_for_timeout(1400); await draw(page, circle); await page.wait_for_timeout(100); await stroke(page, c['px'], c['py'], 4, 10)
    rec('trick learned', {'n': await ev("S.pet.tricks.spin"), 'knows': await ev("knows('spin')"), 'toast': await ev(TOAST)})
    await page.wait_for_timeout(1500); await draw(page, circle); await page.wait_for_timeout(200)
    rec('trick good', {'good': await ev("home.pa.trick && home.pa.trick.good"), 'join': await ev("home.lits.filter(f => f.perch < 0 && f.trick).length"), 'party': await ev("S.party.length")})
    await page.wait_for_timeout(1500); await draw(page, zig); await page.wait_for_timeout(50); z = await ev("home.pa.trick && home.pa.trick.k")
    await page.wait_for_timeout(1500); await draw(page, up); await page.wait_for_timeout(50); u = await ev("home.pa.trick && home.pa.trick.k")
    rec('trick shapes', [z, u])
    # a happy Glimmerkin shows off what it knows by itself now and then
    await page.wait_for_timeout(1500); await ev("S.pet.joy = 90; home.selfT = 0.01")
    await page.wait_for_timeout(200)
    rec('trick by itself', {'k': await ev("home.pa.trick && home.pa.trick.k"), 'journal': await ev("(() => { openJournal(); const t = ui.sheet.textContent; closeSheet(); return t.includes('knows how to spin'); })()")})
    await page.wait_for_timeout(1500)

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
        await ev("""() => { window.__fast = true; const r = RNG(5); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r)); S.littles = S.littles.slice(0, 6); S.party = S.littles.slice(0, 3).map(l => l.id); S.quests = 6; S.seen = UNLOCKS.map(u => u.id); S.dust = 200; S.pet.rest = 100; S.pet.belly = 50; S.pet.joy = 50; afterLoad(); closeSheet(); }""")
        await page.wait_for_timeout(1500)
        await spot(page, ev)
        await catch(page, ev)
        await tricks(page, ev)
        await b.close()
    rec('errors', [e for e in errs if 'Failed to load resource' not in e])
asyncio.run(main())
R = RESULTS
finish([('no page errors', not R['errors']),
        ('the head, cheeks and tummy are told apart', R['spot zones'] == {'head': 'head', 'left': 'left', 'right': 'right', 'tummy': 'tummy'}),
        ('a cheek leans in or the tummy wiggles, and only the favourite spot is found', (R['spot stroke']['plain']['tilt'] != 0 or R['spot stroke']['plain']['wiggle'] > 0 or R['spot stroke']['other'] == 'head') and not R['spot stroke']['plain']['found']),
        ('the favourite spot is found once a day and counts double for a cuddle', R['spot stroke']['found'] and R['spot stroke']['days'] == 1 and 'the spot' in R['spot stroke']['toast'] and R['spot stroke']['got'] - R['spot stroke']['plain']['got'] > R['spot stroke']['plain']['got']),
        ('the journal counts the days the spot was found', R['spot stroke']['journal']),
        ('a berry flicked up from the pantry is caught and eaten', R['catch flick']['flying'] and R['catch flick']['left'] == 5 and R['catch flick']['belly'] >= 17 and R['catch flick']['run'] == 1 and not R['catch flick']['toss']),
        ('catches in a row are counted and the best run kept', R['catch run']['run'] == 2 and R['catch run']['best'] == 2),
        ('a missed berry bounces on the nest and a little takes it as a treat', R['catch miss']['run'] == 0 and R['catch miss']['best'] == 2 and R['catch miss']['left'] == 3 and R['catch miss']['xp'] >= 1),
        ('a circle drawn on the sky makes it try to spin, and a stroke praises it once', R['trick try']['tried']['k'] == 'spin' and R['trick try']['tried']['good'] is False and 'Stroke it' in R['trick try']['tried']['toast'] and R['trick try']['n'] == 1),
        ('five praised tries teach it a trick for good', R['trick learned']['n'] == 5 and R['trick learned']['knows'] and 'learned to spin' in R['trick learned']['toast']),
        ('a learned trick is done neatly and the party joins in', R['trick good']['good'] and R['trick good']['join'] == R['trick good']['party']),
        ('a zigzag asks for a wiggle and a swipe up for a leap', R['trick shapes'] == ['wiggle', 'leap']),
        ('a happy Glimmerkin shows off a learned trick by itself, and the journal lists it', R['trick by itself']['k'] == 'spin' and R['trick by itself']['journal']),
        ('a full Glimmerkin does not play catch', R['catch full']['tide'] == 2 and not R['catch full']['toss'] and 'full' in R['catch full']['toast'])])
