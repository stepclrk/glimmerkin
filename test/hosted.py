"""The hosted game: checks a running Glimmerkin server (the Docker stack) from a real browser.

Start the stack first (`docker compose up -d --build`), then run this. BASE_URL chooses the server and
defaults to http://127.0.0.1:7777. The point of the test is that the server's security headers do not
break the game, that nobody is asked to sign in, and that a guest's creature survives a reload.

With ACCOUNTS=1 it goes on to create an account (no invite code: sign-up is open) and sign in through the
pages, and to follow a creature between devices. With OWNER_USERNAME and OWNER_ONE_TIME_PASSWORD set (from
the owner command) it also works the owner page. Over plain HTTP all of that needs COOKIE_SECURE=false in
the stack's .env, because a Secure cookie is only kept over HTTPS.
"""
import asyncio, os, tempfile
from playwright.async_api import async_playwright

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:7777').rstrip('/')
ACCOUNTS = os.environ.get('ACCOUNTS') == '1'
PLAYER, PASSWORD = 'ci_player', 'correct-horse-battery'
OWNER, OWNER_OTP = os.environ.get('OWNER_USERNAME'), os.environ.get('OWNER_ONE_TIME_PASSWORD')
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
    """Join, with no invite code, from a browser that already holds a guest creature, then sign out and in."""
    # A guest sees a quiet sign at the nest; tapping it says where the creature is kept and offers an account.
    await page.goto(BASE + '/play'); await page.wait_for_selector('#guest:not([hidden])')
    pill = rec('guest sign', await page.text_content('#guest'))
    await page.click('#guest'); await page.wait_for_selector('#sheet:not([hidden]) [data-do="join"]')
    sheet = rec('guest sheet', await page.text_content('#sheet'))
    await page.screenshot(path=SHOTS + '/h1_guest.png')
    await page.click('#sheet [data-do="ok"]'); await page.wait_for_selector('#sheet', state='hidden')
    await page.goto(BASE + '/join')
    says = rec('join says', await page.text_content('#join-creature'))
    asks_code = rec('join asks for a code', await page.locator('#ca-code').count())
    await page.fill('#ca-user', 'a b'); await page.fill('#ca-pass', PASSWORD)
    await page.click('button[type=submit]'); await page.wait_for_selector('[data-notice]:not([hidden])')
    bad_name = rec('bad username says', await page.text_content('[data-notice]'))
    await page.fill('#ca-user', PLAYER)
    await page.click('button[type=submit]'); await page.wait_for_url(BASE + '/play')
    await page.wait_for_timeout(1200)
    await page.screenshot(path=SHOTS + '/h2_joined.png')
    await page.wait_for_function("cloudKind === 'server'")
    pill_after = rec('guest sign after joining', await page.is_hidden('#guest'))
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
        ('a guest sees that they are playing as a guest', pill == 'Playing as a guest'),
        ('tapping it says the creature is in this browser only and offers an account', 'this browser only' in sheet and 'Create an account' in sheet and 'Sign in' in sheet),
        ('the guest sign goes once signed in', pill_after),
        ('joining asks for no invite code', asks_code == 0),
        ('a bad username is refused in plain words', 'Make one up' in bad_name),
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
    RESULTS['code'] = code
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

DETAILS = "({username: document.getElementById('d-username').textContent, creature: document.getElementById('d-creature').textContent, form: document.getElementById('d-form').textContent, saved: document.getElementById('d-saved').textContent})"
PASSWORD2 = 'a-different-horse-entirely'

async def account_page(browser, account_creature):
    """The account page: a guest creature set aside is offered, never forced; import, password, sign out."""
    ctx = await browser.new_context(**NEW_CTX); page = await ctx.new_page(); await page.add_init_script(CSP_JS)
    await page.goto(BASE + '/play'); await page.wait_for_timeout(1200)
    guest = await page.evaluate("save(), S.pet.name")
    unsigned = rec('account page signed out goes to', (await ctx.request.get(BASE + '/account', max_redirects=0)).headers.get('location'))
    await page.goto(BASE + '/signin'); await page.fill('#si-user', PLAYER); await page.fill('#si-pass', PASSWORD)
    await page.click('button[type=submit]'); await page.wait_for_url(BASE + '/play'); await page.wait_for_timeout(1500)
    await page.goto(BASE + '/account'); await page.wait_for_selector('#guest-offer:not([hidden])')
    await page.screenshot(path=SHOTS + '/h4_account.png', full_page=True)
    details = rec('account details', await page.evaluate(DETAILS))
    offer = rec('guest offer', await page.text_content('#guest-yes'))
    # Say yes: the guest creature replaces the account's, because the player asked.
    await page.click('#guest-yes'); await page.wait_for_selector('#done:not([hidden])')
    swapped = rec('after bringing the guest in', [await page.evaluate(DETAILS), await page.evaluate(SERVER_COPY)])
    # Bring the first creature back with the code the game made.
    await page.click('[data-open="import-form"]'); await page.fill('#im-code', 'GLIM1.nonsense'); await page.click('#import-form button[type=submit]')
    await page.wait_for_selector('#import-form [data-notice]:not([hidden])')
    bad_code = rec('bad save code says', await page.text_content('#import-form [data-notice]'))
    await page.fill('#im-code', RESULTS['code']); await page.click('#import-form button[type=submit]'); await page.wait_for_selector('#done:not([hidden])')
    restored = rec('after importing the code', [await page.evaluate(DETAILS), await page.evaluate(SERVER_COPY), await page.evaluate("JSON.parse(localStorage.getItem('glimmerkin.v1')).pet.name")])
    # Change password.
    await page.click('[data-open="password-form"]'); await page.fill('#pw-current', 'not-the-password'); await page.fill('#pw-next', PASSWORD2); await page.click('#password-form button[type=submit]')
    await page.wait_for_selector('#password-form [data-notice]:not([hidden])')
    wrong = rec('wrong current password says', await page.text_content('#password-form [data-notice]'))
    await page.fill('#pw-current', PASSWORD); await page.click('#password-form button[type=submit]'); await page.wait_for_selector('#done:not([hidden])')
    changed = rec('after changing password', await page.text_content('#done'))
    policy = rec('policy refusals on the account page', await page.evaluate("window.__csp"))
    # Sign out: the session ends and this browser no longer holds the account's creature.
    await page.click('#signout'); await page.wait_for_url(lambda u: not u.endswith('/account')); await page.wait_for_timeout(800)
    out = rec('after signing out', [await page.evaluate("fetch('/api/me').then(r => r.status)"), await page.evaluate("localStorage.getItem('glimmerkin.account')"), await page.evaluate("(JSON.parse(localStorage.getItem('glimmerkin.v1') || 'null') || {pet: {}}).pet.name") != account_creature['name']])
    old = rec('old password after the change', (await ctx.request.post(BASE + '/api/signin', data={'username': PLAYER, 'password': PASSWORD}, headers={'Origin': BASE})).status)
    await ctx.close()
    name = account_creature['name']
    return [
        ('the account page needs a sign-in', unsigned == '/signin'),
        ('the account page shows username, creature, form and last saved', details['username'] == PLAYER and details['creature'] == name and details['form'] == 'Hatchling' and details['saved'].startswith('Today')),
        ('a guest creature is offered, not forced', guest in offer and name in offer),
        ('saying yes brings the guest creature in', swapped[0]['creature'] == guest and swapped[1]['name'] == guest),
        ('a bad save code is refused in plain words', 'could not be brought in' in bad_code),
        ('a copy code brings the first creature back, here and on the server', restored[0]['creature'] == name and restored[1]['name'] == name and restored[2] == name),
        ('a wrong current password is refused', 'not right' in wrong),
        ('the password is changed', 'Password changed' in changed and old == 401),
        ('the account page needs nothing its policy refuses', policy == []),
        ('signing out ends the session and clears the creature from this browser', out == [401, None, True]),
    ]

async def owner_page(browser):
    """The owner page: first sign-in with the one-time password, players, reset, remove."""
    ctx = await browser.new_context(**NEW_CTX); page = await ctx.new_page(); await page.add_init_script(CSP_JS)
    await page.goto(BASE + '/signin'); await page.fill('#si-user', OWNER); await page.fill('#si-pass', OWNER_OTP)
    await page.click('button[type=submit]'); await page.wait_for_url(BASE + '/account')
    must = rec('owner first sign-in', [await page.is_visible('#must-change'), await page.is_hidden('#actions')])
    await page.fill('#pw-current', OWNER_OTP); await page.fill('#pw-next', 'the-owners-own-password'); await page.click('#password-form button[type=submit]')
    await page.wait_for_url(BASE + '/owner'); await page.wait_for_selector('#players tr')
    invites = rec('invite section on the owner page', await page.locator('#invites, #new-invite').count())
    # Someone new joins.
    jctx = await browser.new_context(**NEW_CTX); joiner = await jctx.new_page()
    await joiner.goto(BASE + '/join'); await joiner.fill('#ca-user', 'short_stay'); await joiner.fill('#ca-pass', 'only-here-briefly')
    await joiner.click('button[type=submit]'); await joiner.wait_for_url(BASE + '/play'); await joiner.wait_for_timeout(1200)
    await joiner.evaluate(PUSH)
    await page.reload(); await page.wait_for_selector('#players tr')
    await page.screenshot(path=SHOTS + '/h5_owner.png', full_page=True)
    summary = rec('owner summary', await page.text_content('#summary'))
    rows = rec('player rows', await page.eval_on_selector_all('#players tr', "rows => rows.map(r => [...r.querySelectorAll('td')].slice(0, 3).map(td => td.textContent))"))
    # Reset the first player's password and sign in with the one-time password.
    await page.click('#players tr:has-text("' + PLAYER + '") >> text=Reset password'); await page.wait_for_selector('#one-time:not([hidden])')
    otp = await page.text_content('#one-time-password')
    rctx = await browser.new_context(**NEW_CTX); reset = await rctx.new_page()
    await reset.goto(BASE + '/signin'); await reset.fill('#si-user', PLAYER); await reset.fill('#si-pass', otp)
    await reset.click('button[type=submit]'); await reset.wait_for_url(BASE + '/account')
    await reset.fill('#pw-current', otp); await reset.fill('#pw-next', 'chosen-after-the-reset'); await reset.click('#password-form button[type=submit]'); await reset.wait_for_url(BASE + '/play')
    after_reset = rec('player after reset', await reset.evaluate("fetch('/api/me').then(r => r.json()).then(d => [d.username, d.mustChangePassword])"))
    # Remove the short-stay player: asks first.
    row = '#players tr:has-text("short_stay")'
    await page.click(row + ' >> text=Remove'); asks = rec('remove asks', await page.text_content(row + ' td.end'))
    await page.click(row + ' >> text=Keep'); kept = await page.is_visible(row)
    await page.click(row + ' >> text=Remove'); await page.click(row + ' >> text=Yes, remove'); await page.wait_for_selector(row, state='detached')
    removed = rec('removed player session', await joiner.evaluate("fetch('/api/me').then(r => r.status)"))
    policy = rec('policy refusals on the owner page', await page.evaluate("window.__csp"))
    as_player = rec('owner page as a player goes to', (await rctx.request.get(BASE + '/owner', max_redirects=0)).headers.get('location'))
    await ctx.close(); await jctx.close(); await rctx.close()
    return [
        ('a one-time password must be replaced before anything else', must == [True, True]),
        ('the owner page has no invite codes', invites == 0),
        ('the summary counts players', '3 players' in summary and 'code' not in summary and 'Last backup' in summary),
        ('players show username, creature and form, and last played', any(r[0] == 'short_stay' and r[1].endswith(', Hatchling') and r[2] == 'Today' for r in rows) and any(r[0].startswith(OWNER) and '(you)' in r[0] for r in rows)),
        ('a reset one-time password signs the player in and must be replaced', len(otp) >= 10 and after_reset == [PLAYER, False]),
        ('remove asks first, and keeps the player if told to', 'for good' in asks and kept),
        ('remove deletes the account and ends its session', removed == 401),
        ('the owner page needs nothing its policy refuses', policy == []),
        ('a player cannot open the owner page', as_player == '/account'),
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
        rec('front door', [door.status, 'Play as a guest' in await door.text()])
        privacy = await ctx.request.get(BASE + '/privacy')
        privacy_text = await privacy.text()
        rec('privacy page', [privacy.status, all(w in privacy_text for w in ('A username', 'scrambled copy of your password', 'One save', 'Delete my account'))])

        # Someone who has never played: the landing page, then one tap into the game.
        await page.goto(BASE + '/'); await page.wait_for_timeout(600)
        await page.screenshot(path=SHOTS + '/h0_landing.png', full_page=True)
        landing = rec('landing', {'stays': page.url == BASE + '/', 'fits': await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), 'refused': await page.evaluate("window.__csp")})
        await page.goto(BASE + '/privacy')
        rec('privacy fits a phone', await page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        await page.goto(BASE + '/'); await page.click('text=Play as a guest'); await page.wait_for_url(BASE + '/play')
        rec('one tap from landing', await page.evaluate("({scene, signin: !!document.querySelector('input[type=password]')})"))
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
        # A browser that has played before skips the landing page, unless asked for it.
        await page.goto(BASE + '/'); await page.wait_for_url(BASE + '/play')
        await page.goto(BASE + '/?home'); await page.wait_for_timeout(400)
        rec('returning player', [True, page.url == BASE + '/?home'])
        account_checks = await accounts(page, ctx, before) if ACCOUNTS else []
        if ACCOUNTS: account_checks += await saves(b, page, before)
        if ACCOUNTS: account_checks += await account_page(b, before)
        if ACCOUNTS and OWNER and OWNER_OTP: account_checks += await owner_page(b)
        rec('page errors', errs)
        await b.close()

    h = RESULTS['headers']
    finish([
        ('health check answers', RESULTS['health'][0] == 200 and '"ok":true' in RESULTS['health'][1]),
        ('the front door is the landing page', RESULTS['front door'] == [200, True]),
        ('the landing page fits a phone and needs nothing its policy refuses', landing == {'stays': True, 'fits': True, 'refused': []}),
        ('play as a guest starts the game in one tap, with no sign-in', RESULTS['one tap from landing'] == {'scene': 'home', 'signin': False}),
        ('a browser that has played before goes straight to the game', RESULTS['returning player'] == [True, True]),
        ('the privacy page says what is kept and how to delete it', RESULTS['privacy page'] == [200, True] and RESULTS['privacy fits a phone']),
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
