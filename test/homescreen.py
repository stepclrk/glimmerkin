# The offer to keep the game on a phone's home screen. The built page is served as if from the hosted site,
# with every request answered here, so no server is needed: the account API says nobody is signed in.
import os, pathlib, tempfile, json, asyncio
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
GAME = (ROOT / 'dist' / 'index.html').read_bytes()       # run `sh build.sh` first
FILE_PAGE = (ROOT / 'dist' / 'index.html').as_uri()
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

# A stand-in for Chrome's install prompt, fired the way Chrome fires it once the page qualifies.
FAKE_PROMPT = """
window.__prompted = 0;
window.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = async () => { window.__prompted++; }; e.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(e);
}, 200));
"""
STANDALONE = "const mm = window.matchMedia.bind(window); window.matchMedia = q => q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q);"

async def serve(route):
    url = route.request.url
    if url.startswith(SITE + '/api/'): return await route.fulfill(status=401, content_type='application/json', body=json.dumps({'error': 'signed_out', 'message': 'Nobody is signed in.'}))
    if url.startswith(SITE + '/play'): return await route.fulfill(status=200, content_type='text/html; charset=utf-8', body=GAME)
    if url.startswith(SITE): return await route.fulfill(status=404, body='')
    if url.startswith('file:'): return await route.continue_()
    return await route.abort()   # fonts and anything else outside: not needed here

async def open_game(b, device, save=None, scripts=(), url=SITE + '/play'):
    ctx = await b.new_context(**device); page = await ctx.new_page()
    errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
    await page.route('**/*', serve)
    if save: await page.add_init_script("try { if (!localStorage.getItem('glimmerkin.v1')) localStorage.setItem('glimmerkin.v1', %s); } catch (e) {}" % json.dumps(json.dumps(save)))
    for s in scripts: await page.add_init_script(s)
    await page.goto(url); await page.wait_for_timeout(1500)
    return ctx, page, errs

SHEET = "ui.sheet.hidden ? null : ui.sheet.querySelector('h2') && ui.sheet.querySelector('h2').textContent"
async def help_card(page):
    await page.evaluate("closeSheet()"); await page.click('#btn-help'); await page.wait_for_timeout(200)
    has = await page.evaluate("!!ui.sheet.querySelector('[data-do=home]')")
    await page.evaluate("closeSheet()"); return has

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        iphone, pixel = p.devices['iPhone 13'], p.devices['Pixel 7']
        desktop = {'viewport': {'width': 1200, 'height': 800}}

        # A brand-new player is never asked: they have not played yet.
        ctx, page, errs = await open_game(b, iphone)
        rec('new player', await page.evaluate(SHEET))
        saved = await page.evaluate("S.quests = 1; takeUnlocks(); save(), JSON.parse(JSON.stringify(S))")   # its unlock already shown
        await ctx.close()

        # A returning player on an iPhone: asked once, with Safari's steps.
        ctx, page, errs = await open_game(b, iphone, saved)
        rec('iphone offer', await page.evaluate(SHEET))
        rec('iphone steps', await page.evaluate("[...ui.sheet.querySelectorAll('.step + .tx')].map(e => e.textContent)"))
        await page.screenshot(path=SHOTS + '/home_iphone.png')
        await page.click('[data-do=ok]')
        rec('iphone remembered', await page.evaluate("localStorage.getItem('glimmerkin.homescreen')"))
        rec('iphone help card', await help_card(page))
        await page.reload(); await page.wait_for_timeout(1500)
        rec('iphone asked again', await page.evaluate(SHEET))
        rec('iphone errors', errs)
        await ctx.close()

        # Android with Chrome's prompt: one button hands over to Chrome.
        ctx, page, errs = await open_game(b, pixel, saved, [FAKE_PROMPT])
        rec('android offer', await page.evaluate(SHEET))
        await page.screenshot(path=SHOTS + '/home_android.png')
        await page.click('[data-do=add]'); await page.wait_for_timeout(300)
        rec('android prompted', await page.evaluate("window.__prompted"))
        rec('android toast', await page.evaluate("ui.toast.textContent"))
        rec('android errors', errs)
        await ctx.close()

        # Android without the prompt (another browser): the menu steps instead.
        ctx, page, errs = await open_game(b, pixel, saved)
        rec('android menu steps', await page.evaluate("[...ui.sheet.querySelectorAll('.step + .tx')].map(e => e.textContent)"))
        await ctx.close()

        # Already on the home screen, on a computer, or not on the hosted site: never asked, and no card.
        ctx, page, errs = await open_game(b, iphone, saved, [STANDALONE])
        rec('standalone', [await page.evaluate(SHEET), await help_card(page)])
        await ctx.close()
        ctx, page, errs = await open_game(b, desktop, saved)
        rec('desktop', [await page.evaluate(SHEET), await help_card(page)])
        await ctx.close()
        ctx, page, errs = await open_game(b, iphone, saved, url=FILE_PAGE)
        rec('file page', [await page.evaluate(SHEET), await help_card(page)])
        await ctx.close()
        await b.close()

asyncio.run(main())
R = RESULTS
OFFER = 'Keep Glimmerkin on your home screen'
finish([
    ('a new player is not asked', R['new player'] is None),
    ('a returning iPhone player is asked', R['iphone offer'] == OFFER),
    ('the iPhone steps name Share and Add to Home Screen', len(R['iphone steps']) == 3 and 'Share' in R['iphone steps'][0] and 'Add to Home Screen' in R['iphone steps'][1]),
    ('the answer is remembered on this device', R['iphone remembered'] == '1'),
    ('the "?" sheet keeps an Add to home screen card', R['iphone help card'] is True),
    ('nobody is asked twice', R['iphone asked again'] is None),
    ('Android with the prompt is asked', R['android offer'] == OFFER),
    ('the button opens the browser prompt', R['android prompted'] == 1 and 'home screen' in R['android toast']),
    ('Android without the prompt gets the menu steps', len(R['android menu steps']) == 3 and 'menu' in R['android menu steps'][0]),
    ('a game opened from the home screen does not ask', R['standalone'] == [None, False]),
    ('a computer is not asked', R['desktop'] == [None, False]),
    ('the page outside the hosted site does not ask', R['file page'] == [None, False]),
    ('no page errors', not R['iphone errors'] and not R['android errors']),
])
