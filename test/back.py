# The back button, as Android's back button and the browser's both press it: one step back through the game, and
# out of it only from the nest with nothing open. The built page is served as if from the hosted site, with a
# stand-in page before it in the history so that leaving the game can be seen.
import os, pathlib, tempfile, json, asyncio
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
GAME = (ROOT / 'dist' / 'index.html').read_bytes()       # run `sh build.sh` first
SITE = 'https://glimmerkin.test'
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

async def serve(route):
    url = route.request.url
    if url.startswith(SITE + '/api/'): return await route.fulfill(status=401, content_type='application/json', body=json.dumps({'error': 'signed_out', 'message': 'Nobody is signed in.'}))
    if url.startswith(SITE + '/play'): return await route.fulfill(status=200, content_type='text/html; charset=utf-8', body=GAME)
    if url.rstrip('/') == SITE: return await route.fulfill(status=200, content_type='text/html', body='<title>Before the game</title><p>Before the game</p>')
    if url.startswith(SITE): return await route.fulfill(status=404, body='')
    return await route.abort()

SHEET = "ui.sheet.hidden ? null : (ui.sheet.querySelector('h2') ? ui.sheet.querySelector('h2').textContent : 'open')"
STATE = "({ scene, sheet: " + SHEET + ", tray: !ui.tray.hidden, level: (history.state && history.state.glim) || 0, at: location.pathname })"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        ctx = await b.new_context(**p.devices['Pixel 7']); page = await ctx.new_page()
        errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        await page.route('**/*', serve)
        ev = page.evaluate

        async def fresh_game():
            await page.goto(SITE + '/'); await page.goto(SITE + '/play')
            await page.wait_for_function("typeof S !== 'undefined' && S && scene === 'home'")
            await page.wait_for_timeout(600)
            await ev("closeSheet(); ui.tray.hidden = true; S.pet.asleep = false; S.pet.rest = 100; updateHud()")
        async def back():
            await page.go_back(wait_until='commit'); await page.wait_for_timeout(150)
        async def settled(expr):   # the game has caught up with the history
            await page.wait_for_function(expr, timeout=5000)

        await fresh_game()
        await page.screenshot(path=SHOTS + '/back_nest.png')

        # The reported case: open Where to? from the nest, press back, and the nest is still there.
        await page.click('[data-act="quest"]'); await settled("!ui.sheet.hidden && history.state && history.state.glim > 0")
        rec('quest menu open', await ev(STATE))
        await back(); await settled("ui.sheet.hidden && !(history.state && history.state.glim)")
        rec('back from quest menu', await ev(STATE))
        # At the bare nest one more press leaves the game.
        await back(); await page.wait_for_url(SITE + '/', timeout=5000)
        rec('back from bare nest', await ev("location.pathname + ' ' + document.title"))

        # The berry tray closes.
        await fresh_game()
        await page.click('[data-act="feed"]'); await settled("!ui.tray.hidden && history.state && history.state.glim > 0")
        await back(); await settled("ui.tray.hidden")
        rec('back from tray', await ev(STATE))

        # A sheet opened from another goes back to it: Littles, then one little, then back, then closed.
        await page.click('[data-act="littles"]'); await settled("!ui.sheet.hidden && history.state && history.state.glim > 0")
        littles = await ev(SHEET)
        await page.click('#sheet [data-do="open"]'); await settled("!ui.sheet.hidden && !!ui.sheet.querySelector('[data-do=party]')")
        await back(); await settled("!ui.sheet.hidden && !ui.sheet.querySelector('[data-do=party]')")
        rec('back from a little', [littles, await ev(SHEET)])
        await back(); await settled("ui.sheet.hidden")
        rec('back from littles', await ev(STATE))

        # A sheet closed with its own button leaves no spare entries, so one press still leaves.
        await page.click('#btn-help'); await settled("!ui.sheet.hidden && history.state && history.state.glim > 0")
        await page.click('#sheet [data-do="ok"]'); await settled("ui.sheet.hidden && !(history.state && history.state.glim)")
        rec('closed with a button', await ev(STATE))
        await back(); await page.wait_for_url(SITE + '/', timeout=5000)
        rec('then back leaves', await ev("location.pathname"))

        # A quest: back asks "Head home?", back again stays in the quest, and heading home ends at the nest.
        await fresh_game()
        await ev("startQuest({seed: 4242, biome: 'mossroot', size: 'nook', name: 'Back test'})")
        await page.mouse.click(5, 300)   # a touch, as any player makes in a quest
        await settled("scene === 'quest' && history.state && history.state.glim > 0")
        await back(); await settled("!ui.sheet.hidden && !!ui.sheet.querySelector('[data-do=stay]')")
        rec('back in a quest', await ev(STATE))
        await page.screenshot(path=SHOTS + '/back_quest.png')
        await back(); await settled("ui.sheet.hidden")
        rec('back from head home', await ev(STATE))
        await back(); await settled("!ui.sheet.hidden && !!ui.sheet.querySelector('[data-do=go]')")
        await page.click('#sheet [data-do="go"]'); await settled("scene === 'home'")
        await page.wait_for_timeout(300)
        rec('headed home', await ev(STATE))
        if await ev("!ui.sheet.hidden"):
            await back(); await settled("ui.sheet.hidden")
        rec('after the quest', await ev(STATE))
        await back(); await page.wait_for_url(SITE + '/', timeout=5000)
        rec('leaves after the quest', await ev("location.pathname"))

        # A bonus world: back ends the visit (its result sheet), and back again is the quest.
        await fresh_game()
        await ev("startQuest({seed: 4243, biome: 'mossroot', size: 'nook', name: 'Bonus test'}); enterBonus(Object.keys(BONUS)[0])")
        await page.mouse.click(5, 300)
        await settled("scene === 'bonus' && history.state && history.state.glim > 0")
        await back(); await settled("!ui.sheet.hidden")
        rec('back in a bonus world', await ev(STATE))
        await back(); await settled("ui.sheet.hidden && scene === 'quest'")
        rec('back to the quest', await ev(STATE))

        # The garden: back goes home to the nest.
        await fresh_game()
        await ev("S.quests = 8; enterGarden()")
        await page.mouse.click(5, 300)
        await settled("scene === 'garden' && history.state && history.state.glim > 0")
        await back(); await settled("scene === 'home'")
        await page.wait_for_timeout(300)
        rec('back from the garden', await ev(STATE))

        # Inside Claude the history is the page around the game's, so it is left alone.
        rec('hosted only', await ev("backNav.on === HOSTED"))
        rec('errors', errs)
        await b.close()

    R = RESULTS
    finish([
        ('the quest menu opens with spare entries', R['quest menu open']['sheet'] == 'Where to?' and R['quest menu open']['level'] > 0),
        ('back closes the quest menu and stays at the nest', R['back from quest menu'] == {'scene': 'home', 'sheet': None, 'tray': False, 'level': 0, 'at': '/play'}),
        ('back from the bare nest leaves the game', R['back from bare nest'].startswith('/ ')),
        ('back closes the berry tray', R['back from tray']['tray'] is False and R['back from tray']['at'] == '/play'),
        ('back from a little returns to Littles', R['back from a little'][0] == R['back from a little'][1] and R['back from a little'][0] is not None),
        ('back from Littles closes it', R['back from littles']['sheet'] is None and R['back from littles']['at'] == '/play'),
        ('a sheet closed by its button leaves no spares', R['closed with a button']['level'] == 0),
        ('after that, one press leaves', R['then back leaves'] == '/'),
        ('back in a quest asks to head home', R['back in a quest']['scene'] == 'quest' and R['back in a quest']['at'] == '/play'),
        ('back again stays in the quest', R['back from head home']['scene'] == 'quest' and R['back from head home']['sheet'] is None),
        ('heading home ends at the nest', R['headed home']['scene'] == 'home' and R['headed home']['at'] == '/play'),
        ('the nest after a quest is still in the game', R['after the quest']['scene'] == 'home' and R['after the quest']['sheet'] is None and R['after the quest']['at'] == '/play'),
        ('then one press leaves', R['leaves after the quest'] == '/'),
        ('back in a bonus world ends the visit', R['back in a bonus world']['sheet'] is not None and R['back in a bonus world']['at'] == '/play'),
        ('back again is the quest', R['back to the quest']['scene'] == 'quest' and R['back to the quest']['at'] == '/play'),
        ('back from the garden goes to the nest', R['back from the garden']['scene'] == 'home' and R['back from the garden']['at'] == '/play'),
        ('only on the hosted site', R['hosted only'] is True),
        ('no page errors', not R['errors']),
    ])

asyncio.run(main())
