# Drives the Glimmerkin's needs around quests (spec 4.2) in a phone-sized headless browser: the notch at 60 on the
# Joy and Belly meters, and getting ready to travel: Where to? puts a tired Glimmerkin to bed, opens while it sleeps,
# and wakes it when a portal is chosen once it has rested enough.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 2468; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
SHEET = "(() => ({ open: !ui.sheet.hidden, h2: ui.sheet.querySelector('h2') && ui.sheet.querySelector('h2').textContent, text: ui.sheet.textContent, bed: !!ui.sheet.querySelector('[data-do=\"bed\"]'), cards: [...ui.sheet.querySelectorAll('[data-do=\"go\"]')].filter(b => /^[0-9]$/.test(b.dataset.i)).map(b => b.disabled) }))()"

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
        await ev("""() => { window.__fast = true; closeSheet(); S.quests = 14; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; S.pet.rest = 100; S.pet.asleep = false; S.chimes = 0;
          S.party = S.littles.slice(0, 2).map(l => l.id); window.__toasts = []; const t0 = toast; window.toast = (m, ms) => { __toasts.push(m); t0(m, ms); }; updateHud(); }""")

        # the notch at 60 on Joy and Belly, none on Rest
        rec('notches', await ev("""() => ['belly', 'joy', 'rest'].map(m => { const i = document.querySelector('.meter[data-m="' + m + '"] i'), s = i.querySelector('s'); if (!s) return null; const a = i.getBoundingClientRect(), r = s.getBoundingClientRect(); return Math.round((r.left + r.width / 2 - a.left) / a.width * 100); })"""))
        await page.screenshot(path=os.path.join(SHOTS, 'needs-meters.png'), clip={'x': 0, 'y': 0, 'width': 390, 'height': 140})

        # too tired and awake: greyed portals, the Rest it has, and Put to bed
        await ev("() => { S.pet.rest = 10; S.pet.asleep = false; openQuestSheet(); }")
        rec('tired awake', await ev(SHEET))
        await page.screenshot(path=os.path.join(SHOTS, 'needs-tired.png'))
        rec('refused', await ev("() => { startQuest(S.portals.list[0]); return { scene, rest: Math.round(S.pet.rest), toast: __toasts[__toasts.length - 1] }; }"))
        await ev("() => { __toasts.length = 0; ui.sheet.querySelector('[data-do=\"bed\"]').click(); }")
        rec('put to bed', await ev("() => ({ asleep: S.pet.asleep, open: !ui.sheet.hidden, toast: __toasts[0], label: document.querySelector('#sleep-label').textContent })"))

        # asleep and still tired: Where to? opens and says how long is left
        await ev("() => openQuestSheet()")
        rec('asleep tired', await ev(SHEET))
        await ev("() => closeSheet()")

        # asleep and rested enough: choosing a portal wakes it and sets off
        await ev("() => { S.pet.rest = 30; openQuestSheet(); }")
        rec('asleep ready', await ev(SHEET))
        await ev("() => ui.sheet.querySelector('[data-do=\"go\"][data-i=\"0\"]').click()")
        await page.wait_for_function("scene === 'quest'", timeout=5000)
        rec('woke and went', await ev("() => ({ scene, asleep: S.pet.asleep, rest: Math.round(S.pet.rest) })"))
        await ev("() => { finishQuest(false); closeSheet(); }")

        # rested and awake: no line about Rest at all
        await ev("() => { S.pet.rest = 100; S.pet.asleep = false; openQuestSheet(); }")
        rec('rested', await ev(SHEET))
        await ev("() => closeSheet()")
        await b.close()

    R = RESULTS
    rec('errors', errs)
    finish([
        ('Joy and Belly carry a notch at 60, Rest none', R['notches'][0] == 60 and R['notches'][1] == 60 and R['notches'][2] is None),
        ('too tired: portals are greyed and the sheet says the Rest it has', R['tired awake']['h2'] == 'Where to?' and all(R['tired awake']['cards']) and 'too tired to travel. Rest is 10 and a quest needs 25' in R['tired awake']['text']),
        ('too tired: Where to? offers Put to bed', R['tired awake']['bed']),
        ('a quest cannot start under 25 Rest', R['refused']['scene'] == 'home' and R['refused']['rest'] == 10 and 'too tired' in R['refused']['toast']),
        ('Put to bed closes the sheet, sleeps, and says how long', R['put to bed']['asleep'] and not R['put to bed']['open'] and 'Ready to travel in about 60 seconds' in (R['put to bed']['toast'] or '') and R['put to bed']['label'] == 'Wake'),
        ('asleep and tired: Where to? opens and says how long is left', R['asleep tired']['h2'] == 'Where to?' and all(R['asleep tired']['cards']) and 'asleep and needs 25 Rest' in R['asleep tired']['text'] and not R['asleep tired']['bed']),
        ('asleep and rested enough: portals are open and the sheet says a portal wakes it', R['asleep ready']['h2'] == 'Where to?' and not any(R['asleep ready']['cards']) and 'Choosing a portal wakes it' in R['asleep ready']['text']),
        ('choosing a portal wakes it and sets off, taking 25 Rest', R['woke and went'] == {'scene': 'quest', 'asleep': False, 'rest': 5}),
        ('rested and awake: no Rest line', 'too tired' not in R['rested']['text'] and 'asleep' not in R['rested']['text'] and not R['rested']['bed'] and not any(R['rested']['cards'])),
        ('no script errors', not errs),
    ])

asyncio.run(main())
