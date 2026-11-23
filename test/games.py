# Little games (spec 4.3.3): once a day one little asks to play with a bubble in the nest, from the fifth quest on.
# The ask sheet, Not now, playing in the bonus world's frame, leaving before a move (the ask stays), a swap that lines
# nothing up (costs nothing), playing a game to its end (stardust, experience, Joy, a berry at the goal), the journal's
# Little games page and playing again there (no stardust), the back button, and a little leaving on an adventure.
import os, pathlib, tempfile, asyncio
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / "dist" / "index.html").as_uri()           # run `sh build.sh` first
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
        rec('own game', await ev("() => { const l = petById(S.gask.id); return S.gask.g === (gameOf(l) || S.gask.g) && (!gameOf(l) || GAMES[S.gask.g].kind === l.kind); }"))
        rec('same all day', await ev("() => { const k = JSON.stringify(S.gask); S.gask = null; ensureGameAsk(); const a = JSON.stringify(S.gask); S.gask = null; ensureGameAsk(); return JSON.stringify(S.gask) === a; }"))
        # the rest of the ask is played as Berry Swap, with a Sproutling
        await ev("() => { S.gask = { day: localDay(), id: S.littles.find(l => l.kind === 'bloom').id, g: 'swap', done: false }; }"); await page.wait_for_timeout(300)

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
        # the bubble is worked out as the nest is drawn, so let the nest draw twice before looking
        await ev("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
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

        # Pebble Pile, a Pebblit's game: tap turns, a drag moves, a swipe down drops; a full row sings; a pile too high
        # is stamped down; the clock ends it
        await ev("() => startGame('pile', S.littles.find(l => l.kind === 'stone') || S.littles[0], false)"); await page.wait_for_function("scene === 'bonus' && BW && BW.gid === 'pile'", timeout=5000)
        await page.screenshot(path=os.path.join(SHOTS, 'games-5-pile.png'))
        pile = {}
        pile['frame'] = await ev("() => ({ name: document.querySelector('#q-name').textContent, rule: document.querySelector('#q-rule').textContent, count: document.querySelector('#q-shards').textContent })")
        await ev("() => { BW.cur = pileSpawn(BW.well, { k: 'bend', rot: 0, x: 2, y: 0, hues: [1, 2, 3], glow: -1 }); BW.go = true; BW.fallT = -999; }")
        mid = await ev("() => ({ x: BW.wx + 3 * BW.cell, y: BW.wy + 6 * BW.cell })")
        await page.mouse.click(mid['x'], mid['y']); await page.wait_for_timeout(150)
        pile['turned'] = await ev("BW.cur.rot")
        x0 = await ev("BW.cur.x")
        await page.mouse.move(mid['x'], mid['y']); await page.mouse.down(); await page.mouse.move(mid['x'] - await ev("BW.cell * 2"), mid['y'], steps=5); await page.mouse.up(); await page.wait_for_timeout(150)
        pile['moved'] = x0 - await ev("BW.cur.x")
        # a bottom row with a gap the bend fills
        await ev("() => { const C = PILE.cols, R = PILE.rows; BW.well.fill(0); for (let x = 0; x < C; x++) if (x > 1) BW.well[(R - 1) * C + x] = 3; BW.well[(R - 1) * C + 4] = 13; BW.cur = { k: 'bend', rot: 0, x: 0, y: 0, hues: [1, 2, 3], glow: -1 }; BW.score = 0; BW.fallT = -999; }")
        await page.mouse.move(mid['x'], mid['y'] - 60); await page.mouse.down(); await page.mouse.move(mid['x'], mid['y'] + 80, steps=4); await page.mouse.up(); await page.wait_for_timeout(200)
        pile['sung'] = await ev("() => ({ score: BW.score, bottom: BW.well.slice((PILE.rows - 1) * PILE.cols).filter(Boolean).length })")
        # a pile to the top is stamped down
        await ev("() => { const C = PILE.cols; for (let i = C; i < BW.well.length; i++) BW.well[i] = (i % C === 0) ? 0 : 2; BW.nxt = { k: 'line', rot: 0, x: 2, y: 0, hues: [1, 1, 1], glow: -1 }; BW.cur = { k: 'line', rot: 0, x: 2, y: 0, hues: [1, 1, 1], glow: -1 }; GAMES.pile.settle(BW); }")
        pile['stamp'] = await ev("() => ({ stamps: BW.stamps, cur: !!BW.cur, top: BW.well.slice(0, PILE.stamp * PILE.cols).filter(Boolean).length })")
        await ev("() => { BW.clock = PILE.secs - 0.05; }")
        await page.wait_for_function("BW && BW.over && !!S.j.games.pile", timeout=8000)
        pile['end'] = await ev("() => ({ text: ui.sheet.innerText.slice(0, 120), n: S.j.games.pile && S.j.games.pile.n })")
        await page.click('#sheet [data-do="ok"]'); await page.wait_for_function("scene === 'home'", timeout=5000)
        rec('pile', pile)
        # Bubble Pop, a Puddlefin's game: a lone bubble does nothing, a group pops and the bubbles below rise, six
        # leave a pearl, and the game ends when no two touching bubbles match
        await ev("() => startGame('pop', S.littles.find(l => l.kind === 'tide') || S.littles[0], false)"); await page.wait_for_function("scene === 'bonus' && BW && BW.gid === 'pop'", timeout=5000)
        await page.screenshot(path=os.path.join(SHOTS, 'games-6-pop.png'))
        pop = {}
        pop['frame'] = await ev("() => ({ name: document.querySelector('#q-name').textContent, rule: document.querySelector('#q-rule').textContent, count: document.querySelector('#q-shards').textContent })")
        # column 0: six of colour 1 down the top, then a 2; the rest a checker of 3 and 4 so nothing else matches
        await ev("() => { const C = POP.cols, R = POP.rows; for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) BW.g[y * C + x] = x === 0 ? (y < 6 ? 1 : 2) : ((x + y) % 2 ? 3 : 4); BW.g[8 * C] = 2; BW.g[7 * C] = 4; BW.popped = 0; BW.pearls = 0; }")
        lone = await ev("() => GAMES.pop.mid(BW, 1)")
        await page.mouse.click(lone['x'], lone['y']); await page.wait_for_timeout(150)
        pop['lone'] = await ev("() => ({ popped: BW.popped, hint: document.querySelector('#q-hint').textContent })")
        grp = await ev("() => GAMES.pop.mid(BW, 2 * POP.cols)")
        await page.mouse.click(grp['x'], grp['y']); await page.wait_for_timeout(150)
        pop['group'] = await ev("() => ({ popped: BW.popped, pearls: BW.pearls, top: BW.g[0], risen: BW.g[POP.cols] })")
        await ev("() => { BW.done = T; }")
        await page.wait_for_function("BW && BW.over && !!S.j.games.pop", timeout=8000)
        pop['end'] = await ev("() => ({ text: ui.sheet.innerText.slice(0, 160), n: S.j.games.pop.n, best: S.j.games.pop.best })")
        await page.click('#sheet [data-do="ok"]'); await page.wait_for_function("scene === 'home'", timeout=5000)
        rec('pop', pop)
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
        ('a little asks from the fifth quest', ask['g'] in ('swap', 'pile', 'pop', 'link') and ask['little'] and ask['bubble']),
        ('the asking little is not the one with a wish', ask['notWish']),
        ('the ask is the same all day', RESULTS['same all day']),
        ('a little asks for its own kind\'s game', RESULTS['own game']),
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
        ('Pebble Pile has its frame', pile['frame']['name'] == 'Pebble Pile' and pile['frame']['rule'] == 'Stack' and pile['frame']['count'].endswith('left')),
        ('a tap turns the pebbles', pile['turned'] == 1),
        ('a drag moves them', pile['moved'] == 2),
        ('a swipe down drops them and a full row sings, twice with a glowing pebble', pile['sung']['score'] == 2 and pile['sung']['bottom'] < 7),
        ('a pile too high is stamped down', pile['stamp']['stamps'] == 1 and pile['stamp']['cur'] and pile['stamp']['top'] == 0),
        ('the clock ends Pebble Pile', 'Pebble Pile' in pile['end']['text'] and pile['end']['n'] == 1),
        ('Bubble Pop has its frame', pop['frame']['name'] == 'Bubble Pop' and pop['frame']['rule'] == 'Pop' and pop['frame']['count'] == '63 bubbles left'),
        ('a lone bubble does not pop', pop['lone']['popped'] == 0 and 'nobody of its colour' in pop['lone']['hint']),
        ('six together pop, leave a pearl and the rest rise', pop['group']['popped'] == 6 and pop['group']['pearls'] == 1 and pop['group']['top'] == 2 and pop['group']['risen'] == 4),
        ('Bubble Pop ends with its score', '6 bubbles popped, 1 pearl' in pop['end']['text'] and pop['end']['best'] == 6),
        ('no errors', not errs),
    ]
    if errs: print('errors:', errs[:5])
    finish(checks)

asyncio.run(main())
