# Drives the requests board (spec 4.4.13) in a phone-sized headless browser: shut until four quests, then a card under
# Where to?, three requests a day rolled from the day and the seed, the same all day, a request that cannot be filled
# yet greyed out with how many are held, giving what is asked for (berries, stardust, an egg), favours earned and
# spent, the two favour-only costumes in the wardrobe, a new day bringing new requests, and an older save loading.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 4242; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        page = await (await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)).new_page()
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.add_init_script(SEED_JS)
        await page.goto(PAGE); await page.wait_for_timeout(800)
        ev = page.evaluate
        await ev("""() => { window.__fast = true; closeSheet(); S.quests = 3; S.seen = UNLOCKS.filter(u => unlocked(u.id)).map(u => u.id); S.news = NEWS_V; S.pet.rest = 100; S.pet.asleep = false;
          window.__toasts = []; const t0 = toast; window.toast = (m, ms) => { __toasts.push(m); t0(m, ms); }; }""")

        # three quests: no board
        rec('shut', await ev("() => { openQuestSheet(); const r = { unlock: unlocked('requests'), card: !!ui.sheet.querySelector('[data-do=\"requests\"]') }; closeSheet(); return r; }"))

        # four quests: told once, then a card under Where to?
        await ev("() => { S.quests = 4; }")
        rec('unlock', await ev("() => takeUnlocks().map(u => u.id)"))
        await ev("() => openQuestSheet()")
        rec('card', await ev("() => { const c = ui.sheet.querySelector('[data-do=\"requests\"]'); return c && c.textContent; }"))
        await ev("() => ui.sheet.querySelector('[data-do=\"requests\"]').click()")
        await page.wait_for_timeout(200)
        rec('sheet', await ev("() => ({ h2: ui.sheet.querySelector('h2').textContent, rows: ui.sheet.querySelectorAll('[data-do=\"give\"]').length, back: !!ui.sheet.querySelector('[data-do=\"back\"]'), list: S.req.list.map(q => q.k), favours: S.favours })"))
        await page.screenshot(path=os.path.join(SHOTS, 'requests.png'))
        rec('same all day', await ev("() => { const a = JSON.stringify(S.req.list); S.req.day = localDay(); return JSON.stringify(todaysRequests().list) === a; }"))

        # set three known requests, so each kind of giving is checked
        await ev("""() => { S.req = { day: localDay(), done: [false, false, false], list: [
            { k: 'berry', el: 'tide', n: 5, who: 'Pip', why: 'for a pie', fav: 1 },
            { k: 'dust', n: 40, who: 'The wandering trader', why: 'for the lamp fund', fav: 1 },
            { k: 'egg', n: 1, who: 'The wandering trader', why: 'for a family who would love one', fav: 2 } ] };
          S.pantry.tide = 3; S.dust = 100; S.eggs = [{ hue: 40, seed: 5, warm: 3 }, { hue: 200, seed: 6, warm: 0 }]; S.favours = 0; rebuildHome(); openRequests(); }""")
        rec('short', await ev("() => { const b = ui.sheet.querySelectorAll('[data-do=\"give\"]')[0]; return { disabled: b.disabled, text: b.textContent }; }"))
        await ev("() => { S.pantry.tide = 7; openRequests(); ui.sheet.querySelectorAll('[data-do=\"give\"]')[0].click(); }")
        rec('berries given', await ev("() => ({ tide: S.pantry.tide, done: S.req.done[0], favours: S.favours, toast: __toasts[__toasts.length - 1], tag: ui.sheet.querySelectorAll('[data-do=\"give\"]')[0].textContent })"))
        await ev("() => ui.sheet.querySelectorAll('[data-do=\"give\"]')[0].click()")
        rec('not twice', await ev("() => ({ tide: S.pantry.tide, favours: S.favours })"))
        await ev("() => ui.sheet.querySelectorAll('[data-do=\"give\"]')[1].click()")
        rec('dust given', await ev("() => ({ dust: S.dust, favours: S.favours })"))
        await ev("() => ui.sheet.querySelectorAll('[data-do=\"give\"]')[2].click()")
        rec('egg given', await ev("() => ({ eggs: S.eggs.map(e => e.hue), favours: S.favours, count: S.j.requests })"))

        # favours: the garland for 3, then nothing else affordable but a starfruit
        await ev("() => { S.quests = 4; openRequests(); }")
        rec('shop', await ev("() => [...ui.sheet.querySelectorAll('[data-do=\"fav\"]')].map(b => ({ id: b.dataset.id, off: b.disabled }))"))
        await ev("() => { S.quests = 4; openRequests(); ui.sheet.querySelector('[data-id=\"wear:garland\"]').click(); }")
        rec('bought', await ev("() => ({ favours: S.favours, garland: wearOwned('garland'), offered: !!ui.sheet.querySelector('[data-id=\"wear:garland\"]') })"))
        await ev("() => { closeSheet(); openWardrobe(); ui.sheet.querySelector('[data-do=\"wear\"][data-id=\"garland\"]').click(); }")
        rec('worn', await ev("() => S.pet.wear"))
        await ev("() => { closeSheet(); }")
        await page.wait_for_timeout(300)
        await page.screenshot(path=os.path.join(SHOTS, 'requests-garland.png'))
        rec('bow where', await ev("() => wearWhere('bow')"))
        rec('trader never', await ev("() => { const out = []; for (let d = 0; d < 60; d++) { S.trader = null; const real = localDay; window.localDay = () => real() + d; const st = traderToday() || []; window.localDay = real; out.push(...st.map(o => o.id)); } return out.filter(id => id === 'wear:garland' || id === 'wear:bow').length; }"))

        # a new day: new requests, nothing done
        rec('new day', await ev("() => { const real = localDay; window.localDay = () => real() + 1; const R = todaysRequests(); window.localDay = real; return { n: R.list.length, done: R.done.filter(Boolean).length }; }"))

        # an older save loads with no favours and no requests
        rec('old save', await ev("() => { const d = JSON.parse(JSON.stringify(S)); delete d.favours; delete d.req; S = d; afterLoad(); return { favours: S.favours, req: S.req }; }"))
        await b.close()

    R = RESULTS
    rec('errors', errs)
    finish([
        ('before four quests there is no board', R['shut'] == {'unlock': False, 'card': False}),
        ('four quests open the board, told once', 'requests' in R['unlock']),
        ('Where to? has a card for the board', R['card'] and 'The requests board' in R['card'] and '0 of 3 filled today' in R['card']),
        ('the board holds three requests, with a way back', R['sheet']['h2'] == 'The requests board' and R['sheet']['rows'] == 3 and R['sheet']['back']),
        ('the requests stay the same all day', R['same all day']),
        ('a request not yet fillable is greyed out with how many are held', R['short']['disabled'] and '3 of 5' in R['short']['text']),
        ('giving berries takes them and earns a favour', R['berries given']['tide'] == 2 and R['berries given']['done'] and R['berries given']['favours'] == 1 and 'Pip is delighted' in R['berries given']['toast'] and 'Done' in R['berries given']['tag']),
        ('a request is filled once', R['not twice'] == {'tide': 2, 'favours': 1}),
        ('giving stardust takes it', R['dust given'] == {'dust': 60, 'favours': 2}),
        ('giving an egg takes the coolest egg and earns two favours', R['egg given']['eggs'] == [40] and R['egg given']['favours'] == 4 and R['egg given']['count'] == 3),
        ('favours buy from the board, priced in favours', any(x['id'] == 'wear:garland' and not x['off'] for x in R['shop']) and any(x['id'] == 'egg:twin' and not x['off'] for x in R['shop'])),
        ('the garland is bought once and goes to the wardrobe', R['bought'] == {'favours': 1, 'garland': True, 'offered': False}),
        ('the garland can be worn', R['worn'] == {'neck': 'garland'}),
        ('the wardrobe says where the bow comes from', R['bow where'] == 'From the requests board, for 3 favours.'),
        ('the trader never carries the favour costumes', R['trader never'] == 0),
        ('a new day brings three new requests', R['new day'] == {'n': 3, 'done': 0}),
        ('an older save loads with no favours and no requests', R['old save']['favours'] == 0 and R['old save']['req']['list'] == []),
        ('no script errors', not errs),
    ])

asyncio.run(main())
