# Little games (spec 4.3.3): once a day one little asks to play with a bubble in the nest, from the fifth quest on.
# The ask sheet, Not now, playing in the bonus world's frame, leaving before a move (the ask stays), a swap that lines
# nothing up (costs nothing), playing a game to its end (stardust, experience, Joy, a berry at the goal), the journal's
# Little games page and playing again there (no stardust), the back button, and a little leaving on an adventure.
import os, pathlib, tempfile, asyncio
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()           # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)

SETUP = """(q) => { window.__fast = true; closeSheet(); const r = RNG(5); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r));
  S.littles = S.littles.slice(0, 6); S.quests = q; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; S.pet.rest = 100; S.pet.asleep = false; S.pet.joy = 40; S.gask = null; S.j.games = {}; afterLoad(); closeSheet(); }"""
# The next swap to play, as two points to drag between, or null while the game is busy.
NEXT = """() => { if (!BW || !BW.lg || BW.ph || BW.done) return null; const ms = swapMoves(BW.grid, BW.n), own = BW.own;
  const mine = ms.find(([a, b]) => { const h = BW.grid.slice(); [h[a], h[b]] = [h[b], h[a]]; return swapRuns(h, BW.n).some(run => h[run[0]] === own) || h[a] === SWAP.star || h[b] === SWAP.star; }) || ms[0];
  const D = GAMES.swap; return [D.mid(BW, mine[0]), D.mid(BW, mine[1])]; }"""

async def play_out(page):
    # Swap until the game is over: at most the game's 20 swaps, waiting for each to play out on a slow machine.
    import time
    end = time.time() + 180
    while time.time() < end:
        if await page.evaluate("!BW || BW.over"): return True
        mv = await page.evaluate(NEXT)
        if mv is None:
            await page.wait_for_timeout(150); continue
        a, c = mv
        left = await page.evaluate("BW.left")
        await page.mouse.move(a['x'], a['y']); await page.mouse.down()
        await page.mouse.move((a['x'] + c['x']) / 2, (a['y'] + c['y']) / 2, steps=2); await page.mouse.move(c['x'], c['y'], steps=2); await page.mouse.up()
        await page.wait_for_function("(n) => !BW || BW.over || BW.left < n || (!BW.ph && !BW.drag)", arg=left, timeout=10000)
    await page.wait_for_function("!BW || BW.over", timeout=15000)
    return True

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        ctx = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page()
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_' not in m.text else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.goto(PAGE); await page.wait_for_timeout(600)
        ev = page.evaluate

        # before the fifth quest nobody asks; from it, one little does, and its bubble shows
        await ev(SETUP, 4)
        rec('locked', await ev("() => ({ ask: S.gask, unlock: unlocked('games') })"))
        await ev(SETUP, 5); await page.wait_for_function("!!home.gbubble", timeout=5000)
        ask = rec('ask', await ev("() => ({ g: S.gask && S.gask.g, little: !!petById(S.gask.id), notWish: !S.lwish || S.littles.length < 2 || S.lwish.id !== S.gask.id, bubble: !!home.gbubble })"))
        rec('same all day', await ev("() => { const a = JSON.stringify(S.gask); S.gask = null; ensureGameAsk(); return JSON.stringify(S.gask) === a; }"))

        # tapping the bubble asks; Not now keeps the ask
        bb = await ev("home.gbubble"); await page.mouse.click(bb['x'], bb['y']); await page.wait_for_timeout(300)
        sheet = rec('ask sheet', await ev("() => ({ open: !ui.sheet.hidden && ui.sheet.classList.contains('on') || !!ui.sheet.querySelector('[data-do=\"go\"]'), text: ui.sheet.innerText.slice(0, 80), play: !!ui.sheet.querySelector('[data-do=\"go\"]') })"))
        await page.click('#sheet [data-do="no"]'); await page.wait_for_timeout(200)
        rec('not now', await ev("() => ({ live: !!gameAskLive(), scene })"))

        # playing: the bonus frame with the game's name, the little, swaps left, and Back to the nest
        await page.screenshot(path=os.path.join(SHOTS, 'games-1-ask.png'))
        bb = await ev("home.gbubble"); await page.mouse.click(bb['x'], bb['y']); await page.wait_for_timeout(250)
        await page.click('#sheet [data-do="go"]'); await page.wait_for_function("scene === 'bonus' && BW && BW.lg", timeout=5000)
        frame = rec('frame', await ev("() => ({ name: document.querySelector('#q-name').textContent, sub: document.querySelector('#q-biome').textContent, count: document.querySelector('#q-shards').textContent, rule: document.querySelector('#q-rule').textContent, bar: ui.barBonus.innerText.trim(), paid: BW.paid })"))
        await page.screenshot(path=os.path.join(SHOTS, 'games-2-swap.png'))

        # leaving before any move: nothing counts and the ask stays
        await page.click('#bar-bonus [data-b="leave"]'); await page.wait_for_function("scene === 'home'", timeout=5000)
        early = rec('left before a move', await ev("() => ({ live: !!gameAskLive(), played: Object.keys(S.j.games).length })"))

        # again; a swap that lines nothing up swaps back and costs nothing; a tap then a tap swaps
        await ev("() => openGameAsk()"); await page.click('#sheet [data-do="go"]'); await page.wait_for_function("scene === 'bonus' && BW && BW.lg", timeout=5000)
        nope = await ev("() => { const n = BW.n; for (let i = 0; i < n * n; i++) for (const k of [i + 1, i + n]) if (k < n * n && swapNext(i, k, n) && !swapCan(BW.grid, n, i, k)) { const D = GAMES.swap; return [D.mid(BW, i), D.mid(BW, k)]; } return null; }")
        before = await ev("JSON.stringify(BW.grid)")
        await page.mouse.click(nope[0]['x'], nope[0]['y']); await page.wait_for_timeout(80); await page.mouse.click(nope[1]['x'], nope[1]['y'])
        await page.wait_for_function("BW && !BW.ph", timeout=5000)
        rec('no line, no cost', await ev("(g) => ({ left: BW.left, same: JSON.stringify(BW.grid) === g, played: BW.played })", before))

        # play it out: stardust, experience, Joy, the ask used up, the best kept
        dust0, xp0 = await ev("[S.dust, petById(S.gask.id).xp || 0]")
        await play_out(page)
        await page.wait_for_function("!!ui.sheet.querySelector('[data-do=\"ok\"]')", timeout=8000)
        await page.screenshot(path=os.path.join(SHOTS, 'games-3-results.png'))
        res = rec('results', await ev("(o) => ({ dust: S.dust - o[0], xp: (petById(S.gask.id).xp || 0) - o[1], joy: S.pet.joy, done: S.gask.done, j: S.j.games.swap, text: ui.sheet.innerText.slice(0, 160) })", [dust0, xp0]))
        await page.click('#sheet [data-do="ok"]'); await page.wait_for_function("scene === 'home' && !BW", timeout=5000)
        rec('home again', await ev("() => ({ scene, bubble: !!home.gbubble, live: !!gameAskLive() })"))

        # the journal's Little games page; playing again there earns nothing
        await ev("() => openJournal()"); await page.wait_for_timeout(200)
        jbtn = rec('journal button', await ev("() => !!ui.sheet.querySelector('[data-do=\"games\"]')"))
        await page.click('#sheet [data-do="games"]'); await page.wait_for_timeout(200)
        page_txt = rec('games page', await ev("() => ui.sheet.innerText.slice(0, 200)"))
        await page.screenshot(path=os.path.join(SHOTS, 'games-4-journal.png'))
        await page.click('#sheet [data-do="play"]'); await page.wait_for_function("scene === 'bonus' && BW && BW.lg", timeout=5000)
        paid2 = await ev("BW.paid"); dust1 = await ev("S.dust")
        await play_out(page)
        await page.wait_for_function("!!ui.sheet.querySelector('[data-do=\"ok\"]')", timeout=8000)
        again = rec('played again', await ev("(d) => ({ dust: S.dust - d, n: S.j.games.swap.n, text: ui.sheet.innerText.slice(0, 300) })", dust1))
        await page.click('#sheet [data-do="ok"]'); await page.wait_for_function("scene === 'home'", timeout=5000)

        # a step back (the back button on the hosted site, test/back.py) leaves a game, as Back to the nest does
        await ev("() => { S.gask = null; ensureGameAsk(); }")
        await ev("() => startGame('swap', S.littles[0], false)"); await page.wait_for_function("scene === 'bonus'", timeout=5000)
        await ev("() => backStep()"); await page.wait_for_function("scene === 'home'", timeout=5000)
        rec('back button', await ev("() => ({ scene, bw: !!BW })"))

        # a little who goes off on an adventure takes its ask with it
        rec('adventure', await ev("() => { S.gask = { day: localDay(), id: S.littles[1].id, g: 'swap', done: false }; const l = S.littles[1]; l.xp = 999; setOff(l.id); return S.gask; }"))
        # an old save without the new fields loads
        rec('old save', await ev("() => { delete S.gask; delete S.j.games; afterLoad(); closeSheet(); return { j: typeof S.j.games, ask: S.gask === null || typeof S.gask === 'object' }; }"))
        await b.close()

    checks = [
        ('nobody asks before the fifth quest', RESULTS['locked']['ask'] is None and not RESULTS['locked']['unlock']),
        ('a little asks from the fifth quest', ask['g'] == 'swap' and ask['little'] and ask['bubble']),
        ('the asking little is not the one with a wish', ask['notWish']),
        ('the ask is the same all day', RESULTS['same all day']),
        ('the bubble opens the ask', sheet['play'] and 'wants to play' in sheet['text']),
        ('Not now keeps the ask', RESULTS['not now']['live'] and RESULTS['not now']['scene'] == 'home'),
        ('the game has its frame', frame['name'] == 'Berry Swap' and frame['sub'].startswith('A game with') and frame['count'] == '20 swaps left' and frame['rule'] == 'Swap' and frame['bar'] == 'Back to the nest' and frame['paid']),
        ('leaving before a move keeps the ask', early['live'] and early['played'] == 0),
        ('a swap that lines nothing up costs nothing', RESULTS['no line, no cost']['left'] == 20 and RESULTS['no line, no cost']['same'] and not RESULTS['no line, no cost']['played']),
        ('a game asked for pays 5 to 15 stardust', 5 <= res['dust'] <= 15),
        ('the little gains experience', res['xp'] == 3),
        ('Joy rises', res['joy'] >= 47),
        ('the ask is used up', res['done'] and not RESULTS['home again']['live'] and not RESULTS['home again']['bubble']),
        ('the best is kept', res['j']['n'] == 1 and res['j']['best'] > 0),
        ('the journal has Little games', jbtn and 'Berry Swap' in page_txt),
        ('playing again earns nothing', not paid2 and again['dust'] == 0 and again['n'] == 2 and 'Just for fun' in again['text']),
        ('the back button leaves a game', RESULTS['back button']['scene'] == 'home' and not RESULTS['back button']['bw']),
        ('a little away takes its ask', RESULTS['adventure'] is None),
        ('an old save loads', RESULTS['old save']['j'] == 'object' and RESULTS['old save']['ask']),
        ('no errors', not errs),
    ]
    if errs: print('errors:', errs[:5])
    finish(checks)

asyncio.run(main())
