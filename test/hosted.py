"""The hosted game: checks a running Glimmerkin server (the Docker stack) from a real browser.

Start the stack first (`docker compose up -d --build`), then run this. BASE_URL chooses the server and
defaults to http://127.0.0.1:7777. The point of the test is that the server's security headers do not
break the game, that nobody is asked to sign in, and that a guest's creature survives a reload.

With INVITE_CODE set to an unused invite code it goes on to create an account and sign in through the
pages. Over plain HTTP that needs COOKIE_SECURE=false in the stack's .env, because a Secure cookie is
only kept over HTTPS.
"""
import asyncio, os, tempfile
from playwright.async_api import async_playwright

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:7777').rstrip('/')
INVITE = os.environ.get('INVITE_CODE')
PLAYER, PASSWORD = 'ci_player', 'correct-horse-battery'
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

# Collects anything the Content-Security-Policy refuses, so a too-strict policy fails the test by name.
CSP_JS = "window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));"

async def accounts(page, ctx, guest):
    """Join with an invite code from a browser that already holds a guest creature, then sign out and in."""
    await page.goto(BASE + '/join')
    says = rec('join says', await page.text_content('#join-creature'))
    await page.fill('#ca-code', 'NOPE-0000'); await page.fill('#ca-user', PLAYER); await page.fill('#ca-pass', PASSWORD)
    await page.click('button[type=submit]'); await page.wait_for_selector('[data-notice]:not([hidden])')
    bad_code = rec('bad code says', await page.text_content('[data-notice]'))
    await page.fill('#ca-code', INVITE)
    await page.click('button[type=submit]'); await page.wait_for_url(BASE + '/play')
    await page.wait_for_timeout(1200)
    await page.screenshot(path=SHOTS + '/h2_joined.png')
    me = rec('me', await page.evaluate("fetch('/api/me').then(r => r.json())"))
    cookie = rec('cookie', [{k: c[k] for k in ('name', 'httpOnly', 'sameSite')} for c in await ctx.cookies()])
    kept = rec('creature after joining', await page.evaluate("S.pet.name"))
    out = rec('sign out', await page.evaluate("fetch('/api/signout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).then(r => r.status)"))
    signed_out = rec('me after sign out', await page.evaluate("fetch('/api/me').then(r => r.status)"))
    await page.goto(BASE + '/signin')
    await page.fill('#si-user', PLAYER); await page.fill('#si-pass', 'not-the-password')
    await page.click('button[type=submit]'); await page.wait_for_selector('[data-notice]:not([hidden])')
    wrong = rec('wrong password says', await page.text_content('[data-notice]'))
    await page.fill('#si-pass', PASSWORD)
    await page.click('button[type=submit]'); await page.wait_for_url(BASE + '/play')
    back = rec('me after sign in', await page.evaluate("fetch('/api/me').then(r => r.json())"))
    return [
        ('join says the guest creature comes along', guest['name'] in says),
        ('a wrong invite code is refused in plain words', 'invite code' in bad_code),
        ('joining lands in the game, signed in', me.get('username') == PLAYER and me.get('role') == 'player'),
        ('the session cookie is HttpOnly and SameSite=Lax', cookie == [{'name': 'gk_session', 'httpOnly': True, 'sameSite': 'Lax'}]),
        ('the guest creature is still there after joining', kept == guest['name']),
        ('signing out ends the session', out == 204 and signed_out == 401),
        ('a wrong password is refused in plain words', 'do not match' in wrong),
        ('signing in again works', back.get('username') == PLAYER),
    ]

NEW_CTX = dict(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)
PUSH = "(async () => { save(); clearTimeout(cloudTimer); await pushCloud(); return {ok: cloudOk, off: cloudOff, dirty: cloudDirty}; })()"
SERVER_COPY = "fetch('/api/save').then(r => r.json()).then(d => d.save && ({name: d.save.pet.name, belly: Math.round(d.save.pet.belly), savedAt: d.save.savedAt}))"

async def sign_in(browser, user=PLAYER, password=PASSWORD):
    """A new device: a fresh browser profile that signs in and opens the game."""
    ctx = await browser.new_context(**NEW_CTX); page = await ctx.new_page()
    await page.goto(BASE + '/signin'); await page.fill('#si-user', user); await page.fill('#si-pass', password)
    await page.click('button[type=submit]'); await page.wait_for_url(BASE + '/play'); await page.wait_for_timeout(1500)
    return ctx, page

async def saves(browser, phone, guest):
    """The account's creature follows the player between devices; the newer copy wins."""
    # The phone joined with its guest creature. Its copy is the account's copy.
    await phone.reload(); await phone.wait_for_timeout(1500)
    first = rec('server copy after joining', await phone.evaluate(SERVER_COPY))
    note = rec('help sheet says', await phone.evaluate("saveNote()"))

    # A laptop that has never played signs in and finds the same creature.
    lctx, laptop = await sign_in(browser)
    on_laptop = rec('laptop shows', await laptop.evaluate("({name: S.pet.name, owner: localStorage.getItem('glimmerkin.account') === account.id})"))
    # The laptop plays: its newer copy reaches the server.
    await laptop.evaluate("S.pet.belly = 97; S.dust = (S.dust || 0) + 7")
    pushed = rec('laptop push', await laptop.evaluate(PUSH))
    after_laptop = rec('server copy after laptop', await laptop.evaluate(SERVER_COPY))
    # The phone reloads and picks the laptop's copy up.
    await phone.reload(); await phone.wait_for_timeout(1500)
    phone_now = rec('phone after reload', await phone.evaluate("({belly: Math.round(S.pet.belly), ok: cloudOk})"))

    # A stale phone tab: the laptop saves again, then the phone tries to save something older-based.
    await laptop.evaluate("S.pet.belly = 41"); await laptop.evaluate(PUSH)
    await phone.evaluate("(async () => { S.pet.belly = 3; S.savedAt = 5; cloudDirty = true; clearTimeout(cloudTimer); await pushCloud(); })()")
    stale = rec('stale phone after its push was refused', await phone.evaluate("({belly: Math.round(S.pet.belly)})"))

    # The server out of reach: the game keeps saving in the browser, then catches up.
    await lctx.route('**/api/save', lambda route: route.abort())
    await laptop.evaluate("S.pet.belly = 66")
    offline = rec('laptop while the server is out of reach', await laptop.evaluate(PUSH))
    local = rec('laptop local copy while out of reach', await laptop.evaluate("Math.round(JSON.parse(localStorage.getItem('glimmerkin.v1')).pet.belly)"))
    offline_note = rec('help sheet while out of reach', await laptop.evaluate("saveNote()"))
    await lctx.unroute('**/api/save')
    await laptop.evaluate("(async () => { clearTimeout(cloudTimer); await pushCloud(); })()")
    caught_up = rec('server copy after catching up', await laptop.evaluate(SERVER_COPY))

    # A tablet where someone has been playing as a guest signs in to this account, which has its own creature.
    tctx = await browser.new_context(**NEW_CTX); tablet = await tctx.new_page()
    await tablet.goto(BASE + '/play'); await tablet.wait_for_timeout(1200)
    tablet_guest = await tablet.evaluate("save(), S.pet.name")
    await tablet.goto(BASE + '/signin'); await tablet.fill('#si-user', PLAYER); await tablet.fill('#si-pass', PASSWORD)
    await tablet.click('button[type=submit]'); await tablet.wait_for_url(BASE + '/play'); await tablet.wait_for_timeout(1500)
    tablet_now = rec('tablet after signing in', await tablet.evaluate("({name: S.pet.name, aside: (JSON.parse(localStorage.getItem('glimmerkin.guest') || 'null') || {pet: {}}).pet.name})"))
    still = rec('server copy after the tablet signed in', await tablet.evaluate(SERVER_COPY))

    # Keep a copy: the game's code holds the whole save.
    await tablet.click('#btn-help'); await tablet.click('[data-do="copy"]'); await tablet.wait_for_timeout(200)
    code = await tablet.input_value('#save-code')
    await tablet.screenshot(path=SHOTS + '/h3_keep_a_copy.png')
    round_trip = rec('code round trip', await tablet.evaluate("(code) => fetch('/api/save/import', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code})}).then(r => r.json()).then(d => d.creature)", code))
    await lctx.close(); await tctx.close()
    return [
        ('the creature that joined is the account copy', first and first['name'] == guest['name']),
        ('the help sheet says progress saves to the account', 'saves to your account, ' + PLAYER in note and '/account' in note),
        ('a second device shows the same creature', on_laptop == {'name': guest['name'], 'owner': True}),
        ('the second device saves to the account', pushed['ok'] and after_laptop['belly'] == 97),
        ('the first device picks up the newer copy', phone_now == {'belly': 97, 'ok': True}),
        ('an older save is refused and the newer copy adopted', stale == {'belly': 41}),
        ('out of reach: the browser copy keeps saving', offline['dirty'] and not offline['off'] and local == 66 and 'when the server can be reached' in offline_note),
        ('back in reach: the account catches up', caught_up['belly'] == 66),
        ('a guest creature never overwrites the account copy, and is set aside', tablet_now == {'name': guest['name'], 'aside': tablet_guest} and still['name'] == guest['name']),
        ('the copy code brings the same creature back', code.startswith('GLIM1.') and round_trip == guest['name']),
    ]

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        ctx = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.add_init_script(CSP_JS)

        health = await ctx.request.get(BASE + '/healthz')
        rec('health', [health.status, await health.text()])
        door = await ctx.request.get(BASE + '/', max_redirects=0)
        rec('front door', [door.status, door.headers.get('location')])
        missing = await ctx.request.get(BASE + '/nope')
        rec('unknown address', missing.status)

        res = await page.goto(BASE + '/play')
        rec('play', [res.status, res.headers.get('content-type')])
        rec('headers', {k: res.headers.get(k) for k in ('content-security-policy', 'x-content-type-options', 'referrer-policy')})
        rec('cookies set', len(await ctx.cookies()))
        await page.wait_for_timeout(1500)
        await page.screenshot(path=SHOTS + '/h1_play.png')
        state = rec('state', await page.evaluate("({scene, pet: !!(S && S.pet), littles: S.littles.length, title: document.title, signin: !!document.querySelector('input[type=password]')})"))

        # Feed the creature, then reload: a guest's game is kept in this browser.
        await page.click('[data-act="feed"]'); await page.wait_for_timeout(200)
        await page.click('.food:not([disabled])'); await page.wait_for_timeout(900)
        before = rec('before reload', await page.evaluate("save(), ({name: S.pet.name, look: JSON.stringify(S.pet.look || S.pet.kind || null), born: S.born || S.pet.born || null})"))
        await page.reload(); await page.wait_for_timeout(1200)
        after = rec('after reload', await page.evaluate("({name: S.pet.name, look: JSON.stringify(S.pet.look || S.pet.kind || null), born: S.born || S.pet.born || null})"))
        csp = rec('policy refusals', await page.evaluate("window.__csp"))
        account_checks = await accounts(page, ctx, before) if INVITE else []
        if INVITE: account_checks += await saves(b, page, before)
        rec('page errors', errs)
        await b.close()

    h = RESULTS['headers']
    finish([
        ('health check answers', RESULTS['health'][0] == 200 and '"ok":true' in RESULTS['health'][1]),
        ('front door leads to /play', RESULTS['front door'] == [302, '/play']),
        ('unknown address answers 404', RESULTS['unknown address'] == 404),
        ('the game is served', RESULTS['play'][0] == 200 and 'text/html' in (RESULTS['play'][1] or '')),
        ('security headers present', bool(h['content-security-policy']) and h['x-content-type-options'] == 'nosniff' and h['referrer-policy'] == 'no-referrer'),
        ('no cookie for a guest', RESULTS['cookies set'] == 0),
        ('the game starts at the nest', state['scene'] == 'home' and state['pet'] and state['title'] == 'Glimmerkin'),
        ('no sign-in before play', not state['signin']),
        ('the creature survives a reload', before == after and bool(before['name'])),
        ('the policy refuses nothing the game needs', csp == []),
        ('no page errors', errs == []),
    ] + account_checks)

asyncio.run(main())
