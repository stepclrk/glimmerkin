# Notes from the nest (spec section 5, Notes), the page's half: the "?" sheet's Notes button on the hosted site only,
# every kind off until switched on, what happens when the phone will not let the game send notes, the list of what is
# coming written to the device's cache for the service worker, and Turn all off. The page and its worker are served
# by a small local server standing in for the hosted site. The worker's half is checked by test/notes.test.js.
import os, pathlib, tempfile, json, asyncio, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
GAME = (ROOT / 'dist' / 'index.html').read_bytes()       # run `sh build.sh` first
WORKER = (ROOT / 'dist' / 'sw.js').read_bytes()
FILE_PAGE = (ROOT / 'dist' / 'index.html').as_uri()
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
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, status, body, kind):
        self.send_response(status); self.send_header('Content-Type', kind); self.send_header('Content-Length', str(len(body))); self.send_header('Cache-Control', 'no-cache'); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/play': return self.send(200, GAME, 'text/html; charset=utf-8')
        if path == '/sw.js': return self.send(200, WORKER, 'text/javascript')
        if path == '/build.json': return self.send(200, b'{"build":null}', 'application/json')
        if path.startswith('/api/'): return self.send(401, json.dumps({'error': 'signed_out', 'message': 'Nobody is signed in.'}).encode(), 'application/json')
        return self.send(404, b'', 'text/plain')
server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
ORIGIN = 'http://localhost:%d' % server.server_address[1]   # localhost counts as secure, so a worker may run
DOC = "async () => { const c = await caches.open('glimmerkin-notes'), r = await c.match('/play/notes.json'); return r ? await r.json() : null; }"

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        # the page opened as a file: no Notes button
        ctx0 = await b.new_context(viewport={'width': 390, 'height': 760})
        pg0 = await ctx0.new_page(); await pg0.goto(FILE_PAGE); await pg0.wait_for_timeout(600)
        rec('file page', await pg0.evaluate("() => { closeSheet(); document.querySelector('#btn-help').click(); return { notes: !!ui.sheet.querySelector('[data-do=\"notes\"]'), can: notesCan() }; }"))
        await ctx0.close()

        ctx = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)
        await ctx.grant_permissions(['notifications'], origin=ORIGIN)
        page = await ctx.new_page()
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_' not in m.text and '401' not in m.text and '404' not in m.text else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.goto(ORIGIN + '/play')
        await page.wait_for_function("typeof S !== 'undefined' && S && S.pet && typeof scene !== 'undefined' && scene === 'home'", timeout=15000)
        await page.wait_for_function("navigator.serviceWorker.controller || false", timeout=15000)
        ev = page.evaluate
        await ev("() => { closeSheet(); S.quests = 14; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; S.littles.forEach(l => l.xp = 200); }")

        # the "?" sheet has Notes; every kind starts off
        rec('help', await ev("() => { closeSheet(); document.querySelector('#btn-help').click(); return !!ui.sheet.querySelector('[data-do=\"notes\"]'); }"))
        await ev("() => ui.sheet.querySelector('[data-do=\"notes\"]').click()")
        rec('sheet', await ev("() => ({ h2: ui.sheet.querySelector('h2').textContent, text: ui.sheet.textContent, on: [...ui.sheet.querySelectorAll('[data-do=\"flip\"]')].map(x => x.getAttribute('aria-checked')), can: notesCan() })"))
        await page.screenshot(path=os.path.join(SHOTS, 'notes-sheet.png'))

        # switching one on: on, or (where the phone will not let a page sync in the background) a plain reason and still off
        await ev("() => ui.sheet.querySelector('[data-k=\"home\"]').click()")
        await page.wait_for_function("ui.sheet.querySelector('[data-k=\"home\"]').getAttribute('aria-checked') === 'true' || ui.sheet.textContent.includes('home screen')", timeout=8000)
        rec('switch', await ev("() => ({ on: !!notePrefs().home, said: ui.sheet.querySelector('p.dim').textContent })"))

        # the list of what is coming, for the worker: only kinds that are on
        await ev("""() => { setNotePrefs({ home: true, today: true }); const l = S.littles[S.littles.length - 1]; setOff(l.id); closeSheet(); S.away[0].left = Date.now() - 9.5 * 86400000; save(); }""")
        doc = None
        for _ in range(40):
            doc = await ev(DOC)
            if doc: break
            await page.wait_for_timeout(250)
        rec('doc', doc)
        rec('events', await ev("() => { const e = noteEvents(); return { kinds: [...new Set(e.map(x => x.kind))].sort(), firstHome: e.filter(x => x.kind === 'home')[0] }; }"))
        # December's gifts, from a day in December: the ones not yet opened, at 8 in the morning
        rec('gifts', await ev("() => { S.advent = { y: 2026, got: [1, 2] }; const e = noteEvents(new Date(2026, 11, 2, 12).getTime()).filter(x => x.kind === 'gift'); return { first: new Date(e[0].at).getDate(), hour: new Date(e[0].at).getHours(), n: e.length }; }"))

        # turn all off: nothing on, and nothing listed
        await ev("() => { openNotes(''); ui.sheet.querySelector('[data-do=\"off\"]').click(); }")
        await page.wait_for_timeout(2200)
        rec('all off', await ev("async () => ({ prefs: notePrefs(), doc: await (" + DOC + ")() })"))
        rec('worker kept its cache name apart', WORKER.count(b"k !== NOTES") == 1)
        await b.close()

    R = RESULTS
    rec('errors', errs)
    ev_home = R['events']['firstHome']
    finish([
        ('the page opened as a file has no Notes button', R['file page'] == {'notes': False, 'can': False}),
        ('the hosted page\'s "?" sheet has a Notes button', R['help']),
        ('the notes sheet lists four kinds, every one off, and the rules', R['sheet']['h2'] == 'Notes from the nest' and R['sheet']['on'] == ['false'] * 4 and 'At most one a day' in R['sheet']['text'] and 'never about hunger or tiredness' in R['sheet']['text'] and 'nothing about them is sent anywhere' in R['sheet']['text']),
        ('switching one on turns it on, or says plainly why it cannot', R['switch']['on'] or 'home screen' in R['switch']['said']),
        ('the list for the worker holds only kinds that are on', R['doc'] and R['doc']['prefs'] == {'home': True, 'today': True} and {e['kind'] for e in R['doc']['events']} <= {'home', 'today'} and any(e['kind'] == 'home' for e in R['doc']['events'])),
        ('a little away is due to send its picture on day 10', ev_home and 'has sent a picture' in ev_home['title']),
        ('December gifts not yet opened, at 8 in the morning', R['gifts']['first'] == 3 and R['gifts']['hour'] == 8 and R['gifts']['n'] == 23),
        ('Turn all off switches everything off and clears the list', R['all off']['prefs'] == {} and R['all off']['doc'] and R['all off']['doc']['events'] == []),
        ('the worker keeps the notes apart from the offline copy when it updates', R['worker kept its cache name apart']),
        ('no script errors', not errs),
    ])

asyncio.run(main())
