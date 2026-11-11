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
