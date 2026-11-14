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
        if path.startswith('/api/'): return self.send(401, json.dumps({'error': 'signed_out', 'message': 'Nobody is signed in.'}).encode(), 'application/json')
        return self.send(404, b'', 'text/plain')

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = 'http://localhost:%d/play' % server.server_address[1]   # localhost counts as secure, so a worker may run

STATE = "({ name: S.pet.name, quests: S.quests, scene, build: BUILD, controlled: !!navigator.serviceWorker.controller })"
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
        await ctx.close(); await b.close()

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
    ('no page errors', not R['errors']),
])
