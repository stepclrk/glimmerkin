# Playing with no connection. The built page and its service worker are served by a small local server standing in
# for the hosted site, so the worker really installs and keeps its copy. The connection is then cut, or the server
# answers with errors the way a tunnel that is down does, and the game must still open with the creature in it.
import os, pathlib, tempfile, json, asyncio, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
GAME = (ROOT / 'dist' / 'index.html').read_bytes()       # run `sh build.sh` first
WORKER = (ROOT / 'dist' / 'sw.js').read_bytes()
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

# What the stand-in server does: 'up' answers, 'down' answers every request with 502 like a tunnel with nothing behind it.
SITE = {'mode': 'up', 'build': 'aaaaaaaaaaaaaaaa', 'plays': 0, 'builds': 0}
# A stand-in for the account API, with the server's rules: a save names the copy (rev) it grew from and is refused
# with 409 other_device if another device saved since; one that names none is refused if older than the stored one.
ACCOUNT = {'signed_in': False, 'save': None, 'rev': 0, 'puts': 0}
ME = {'id': '7d0c6a43-0000-4000-8000-000000000001', 'username': 'mossy_pip', 'role': 'player', 'mustChangePassword': False}
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, status, body, kind, extra=()):
        self.send_response(status); self.send_header('Content-Type', kind); self.send_header('Content-Length', str(len(body)))
        for k, v in extra: self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        path = self.path.split('?')[0]
        if SITE['mode'] == 'down': return self.send(502, b'<h1>Bad gateway</h1>', 'text/html')
        if path == '/play':
            SITE['plays'] += 1
            page = GAME.replace(b'</head>', b'<meta name="glimmerkin-build" content="' + SITE['build'].encode() + b'">\n</head>', 1)
            return self.send(200, page, 'text/html; charset=utf-8', [('Cache-Control', 'no-cache')])
        if path == '/sw.js': return self.send(200, WORKER, 'text/javascript', [('Cache-Control', 'no-cache')])
        if path == '/build.json':
            SITE['builds'] += 1
            return self.send(200, json.dumps({'build': SITE['build']}).encode(), 'application/json', [('Cache-Control', 'no-store')])
        if path == '/api/me' and ACCOUNT['signed_in']: return self.json(200, ME)
        if path == '/api/save' and ACCOUNT['signed_in']: return self.json(200, {'save': ACCOUNT['save'], 'savedAt': ACCOUNT['save']['savedAt'] if ACCOUNT['save'] else None, 'rev': ACCOUNT['rev']})
        if path.startswith('/api/'): return self.send(401, json.dumps({'error': 'signed_out', 'message': 'Nobody is signed in.'}).encode(), 'application/json')
        return self.send(404, b'', 'text/plain')
    def json(self, status, data): return self.send(status, json.dumps(data).encode(), 'application/json', [('Cache-Control', 'no-store')])
    def do_PUT(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
        if SITE['mode'] == 'down': return self.send(502, b'<h1>Bad gateway</h1>', 'text/html')
        if self.path != '/api/save' or not ACCOUNT['signed_in']: return self.json(401, {'error': 'signed_out', 'message': 'Nobody is signed in.'})
        doc, held, base = body['save'], ACCOUNT['save'], body.get('base')
        if base is None and held and held['savedAt'] > doc['savedAt']: return self.json(409, {'error': 'newer_save', 'message': 'Newer.', 'save': held, 'savedAt': held['savedAt'], 'rev': ACCOUNT['rev']})
        if base is not None and base != ACCOUNT['rev']: return self.json(409, {'error': 'other_device', 'message': 'Another device.', 'save': held, 'savedAt': held['savedAt'], 'rev': ACCOUNT['rev']})
        ACCOUNT['save'] = doc; ACCOUNT['puts'] += 1; ACCOUNT['rev'] += 1
        return self.json(200, {'savedAt': doc['savedAt'], 'rev': ACCOUNT['rev']})

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = 'http://localhost:%d/play' % server.server_address[1]   # localhost counts as secure, so a worker may run

STATE = "({ name: S.pet.name, quests: S.quests, scene, build: BUILD, controlled: !!navigator.serviceWorker.controller })"
async def until(page, test, seconds=5):
    for _ in range(int(seconds * 10)):
        if test(): return True
        await page.wait_for_timeout(100)
    return False
NOTE = "saveNote().replace(/<[^>]+>/g, '')"
async def wait_for_game(page):
    await page.wait_for_function("typeof S !== 'undefined' && S && S.pet && typeof scene !== 'undefined' && scene === 'home'", timeout=15000)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        ctx = await b.new_context(**p.devices['Pixel 7'])
        await ctx.route('https://fonts.*/**', lambda r: r.abort())   # fonts from outside: not needed here
        page = await ctx.new_page()
        errs = []; page.on('pageerror', lambda e: errs.append(str(e)))

        # First visit, online: the worker installs and keeps a copy without being asked.
        await page.goto(URL); await wait_for_game(page)
        await page.evaluate("navigator.serviceWorker.ready")
        kept = await page.evaluate("caches.open('glimmerkin-offline-1').then(c => c.match('/play')).then(r => !!r)")
        for _ in range(20):
            if kept: break
            await page.wait_for_timeout(250)
            kept = await page.evaluate("caches.open('glimmerkin-offline-1').then(c => c.match('/play')).then(r => !!r)")
        rec('copy kept on first visit', kept)
        name = await page.evaluate("S.quests = 2; save(), S.pet.name")

        # Online again with a newer build out: the server's page wins over the kept copy.
        SITE['build'] = 'bbbbbbbbbbbbbbbb'; plays = SITE['plays']
        await page.reload(); await wait_for_game(page)
        rec('online reload', dict(await page.evaluate(STATE), asked=SITE['plays'] - plays))

        # No connection at all: the home screen icon still opens the game, creature and all.
        await ctx.set_offline(True); plays = SITE['plays']
        await page.reload(); await wait_for_game(page)
        offline = rec('offline open', dict(await page.evaluate(STATE), asked=SITE['plays'] - plays))
        await page.screenshot(path=SHOTS + '/offline_nest.png')
        # Play goes on: a quest, finished, saved in this browser.
        await page.evaluate("startQuest(S.portals.list[0])"); await page.wait_for_timeout(300)
        await page.evaluate("finishQuest(true)"); await page.wait_for_timeout(300); await page.evaluate("closeSheet()")
        quests = await page.evaluate("S.quests")
        # The check for a newer build is never answered from the copy: offline it just finds nothing.
        builds = SITE['builds']
        await page.evaluate("buildAsked = 0; checkBuild()"); await page.wait_for_timeout(500)
        rec('offline build check', {'asked server': SITE['builds'] - builds, 'still here': await page.evaluate("scene")})
        await page.reload(); await wait_for_game(page)
        rec('offline progress kept', {'quests': await page.evaluate("S.quests"), 'expected': quests})

        # Connected, but the server is out of reach behind the tunnel (502): the kept copy opens instead of the error.
        await ctx.set_offline(False); SITE['mode'] = 'down'
        await page.reload(); await wait_for_game(page)
        rec('server down open', await page.evaluate(STATE))
        SITE['mode'] = 'up'

        # Back online: the server's page again, and the progress made offline is still there.
        SITE['build'] = 'cccccccccccccccc'
        await page.reload(); await wait_for_game(page)
        rec('back online', dict(await page.evaluate(STATE), quests=await page.evaluate("S.quests")))

        # Other addresses are not kept: offline, only the game opens.
        await ctx.set_offline(True)
        try:
            r = await page.goto(URL.replace('/play', '/account')); other = r.status if r else None
        except Exception as e:
            other = 'unreachable'
        rec('other pages offline', other)
        rec('errors', errs)
        rec('name kept', name == offline['name'])
        await ctx.close()

        # Signed in. Offline play is kept here and reaches the account as soon as the device is back online,
        # without reopening the game.
        ACCOUNT.update(signed_in=True, save=None, rev=0, puts=0)
        ctx = await b.new_context(**p.devices['Pixel 7'])
        await ctx.route('https://fonts.*/**', lambda r: r.abort())
        page = await ctx.new_page(); page.on('pageerror', lambda e: errs.append(str(e)))
        await page.goto(URL); await wait_for_game(page)
        await until(page, lambda: ACCOUNT['save'] is not None)
        await page.evaluate("navigator.serviceWorker.ready")
        await ctx.set_offline(True)
        await page.evaluate("S.quests = 5; save()"); await page.wait_for_timeout(5000)
        away = rec('signed in, offline', {'account quests': ACCOUNT['save']['quests'], 'note': await page.evaluate(NOTE)})
        await ctx.set_offline(False)
        rec('signed in, back online', {'caught up': await until(page, lambda: ACCOUNT['save']['quests'] == 5, 3), 'note': await page.evaluate(NOTE)})

        # Opened with no connection at all: the game does not know yet who is signed in, but says the progress
        # will reach the account, and catches up the moment the connection is back, however long it has been.
        await ctx.set_offline(True)
        await page.reload(); await wait_for_game(page)
        await page.evaluate("S.quests = 6; save()"); await page.wait_for_timeout(1000)
        cold = rec('opened offline', {'note': await page.evaluate(NOTE), 'waiting': await page.evaluate("cloudWaiting")})
        await ctx.set_offline(False)
        rec('opened offline, back online', {'caught up': await until(page, lambda: ACCOUNT['save']['quests'] == 6, 3), 'kind': await page.evaluate("cloudKind"), 'note': await page.evaluate(NOTE)})

        # Two devices on one account. The phone (page) plays offline while the tablet plays online: both copies have
        # something the other lacks, so back online the phone asks which to keep, and nothing is replaced unasked.
        tctx = await b.new_context(**p.devices['Galaxy Tab S9'] if 'Galaxy Tab S9' in p.devices else p.devices['iPad Mini'])
        await tctx.route('https://fonts.*/**', lambda r: r.abort())
        tab = await tctx.new_page(); tab.on('pageerror', lambda e: errs.append(str(e)))
        await tab.goto(URL); await wait_for_game(tab)
        await until(tab, lambda: False, 1)
        rec('tablet took the account creature', await tab.evaluate("S.pet.name") == await page.evaluate("S.pet.name"))
        await ctx.set_offline(True)
        await page.evaluate("S.quests = 10; save()"); await page.wait_for_timeout(1500); await page.evaluate("closeSheet()")
        await tab.evaluate("S.quests = 20; S.dust = 77; save()")
        await until(tab, lambda: ACCOUNT['save']['quests'] == 20)
        await ctx.set_offline(False)
        await page.wait_for_function("!ui.sheet.hidden && ui.sheet.querySelector('h2').textContent.startsWith('Two copies')", timeout=5000)
        await page.screenshot(path=SHOTS + '/offline_two_copies.png')
        sheet = rec('two copies', await page.evaluate("[...ui.sheet.querySelectorAll('.card .tx')].map(e => e.textContent)"))
        held = rec('nothing replaced while asking', {'account': ACCOUNT['save']['quests'], 'phone': await page.evaluate("S.quests")})
        await page.click('[data-do=mine]')
        kept_mine = rec('kept this device', await until(page, lambda: ACCOUNT['save']['quests'] == 10, 3))

        # Again, and this time the account's copy is kept.
        await ctx.set_offline(True)
        await page.evaluate("S.quests = 11; save()"); await page.wait_for_timeout(1500); await page.evaluate("closeSheet()")
        await tab.reload(); await wait_for_game(tab); await until(tab, lambda: False, 1)
        await tab.evaluate("S.quests = 30; save()")
        await until(tab, lambda: ACCOUNT['save']['quests'] == 30)
        await ctx.set_offline(False)
        await page.wait_for_function("!ui.sheet.hidden && ui.sheet.querySelector('h2').textContent.startsWith('Two copies')", timeout=5000)
        await page.click('[data-do=theirs]'); await page.wait_for_timeout(1000)
        rec('kept the account', {'phone': await page.evaluate("S.quests"), 'account': ACCOUNT['save']['quests']})

        # Both online: the phone sat idle while the tablet played, then the phone is touched. Nothing was played
        # here while out of reach, so the tablet's copy simply wins, as it always has, with no question.
        await tab.evaluate("S.quests = 40; save()")
        await until(tab, lambda: ACCOUNT['save']['quests'] == 40)
        await page.evaluate("S.sound = !S.sound; save()")
        await page.wait_for_function("S.quests === 40", timeout=8000)
        rec('online on both, no question', {'sheet': await page.evaluate("ui.sheet.hidden ? null : ui.sheet.querySelector('h2').textContent"), 'account': ACCOUNT['save']['quests']})
        await tctx.close(); await ctx.close(); await b.close()

asyncio.run(main())
server.shutdown()
R = RESULTS
finish([
    ('the first visit keeps a copy of the game', R['copy kept on first visit'] is True),
    ('online, the server\'s newer page is used', R['online reload']['build'] == 'bbbbbbbbbbbbbbbb' and R['online reload']['asked'] == 1 and R['online reload']['controlled']),
    ('offline, the game opens at the nest with the same creature', R['offline open']['asked'] == 0 and R['offline open']['scene'] == 'home' and R['name kept'] and R['offline open']['quests'] >= 2),
    ('offline, the build check asks nothing and changes nothing', R['offline build check']['asked server'] == 0 and R['offline build check']['still here'] == 'home'),
    ('progress made offline survives reopening offline', R['offline progress kept']['quests'] == R['offline progress kept']['expected'] and R['offline progress kept']['quests'] >= 3),
    ('with the server answering errors, the kept copy opens', R['server down open']['scene'] == 'home' and R['server down open']['build'] == 'bbbbbbbbbbbbbbbb'),
    ('back online, the newest page and the offline progress', R['back online']['build'] == 'cccccccccccccccc' and R['back online']['quests'] == R['offline progress kept']['expected']),
    ('pages other than the game are not kept', R['other pages offline'] == 'unreachable'),
    ('signed in and offline, saves wait on the device and the game says so', R['signed in, offline']['account quests'] != 5 and R['signed in, offline']['note'].startswith('You are offline') and 'mossy_pip' in R['signed in, offline']['note']),
    ('back online, the account catches up straight away', R['signed in, back online']['caught up'] and 'Progress saves to your account' in R['signed in, back online']['note']),
    ('opened offline, the game says progress will reach the account', R['opened offline']['note'].startswith('You are offline') and 'reach your account' in R['opened offline']['note'] and R['opened offline']['waiting']),
    ('opened offline, it catches up as soon as the connection is back', R['opened offline, back online']['caught up'] and R['opened offline, back online']['kind'] == 'server'),
    ('a second device takes the account creature', R['tablet took the account creature']),
    ('two copies: the phone asks which to keep, showing both', len(R['two copies']) == 2 and '10 quests' in R['two copies'][0] and '20 quests' in R['two copies'][1] and 'Last played today' in R['two copies'][0]),
    ('two copies: nothing is replaced while asking', R['nothing replaced while asking'] == {'account': 20, 'phone': 10}),
    ('two copies: keeping this device sends it to the account', R['kept this device']),
    ('two copies: keeping the account\'s brings it to this device', R['kept the account'] == {'phone': 30, 'account': 30}),
    ('online on both devices, the newer play wins without a question', R['online on both, no question'] == {'sheet': None, 'account': 40}),
    ('no page errors', not R['errors']),
])
