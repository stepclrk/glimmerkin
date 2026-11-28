# Drives the hatchery (spec 4.4.15) in a phone-sized headless browser: shut before treats open, then eggs listed in
# Littles, choosing one kind for 6 berries, two kinds for a twin for 6 of each, a twin egg for 3 of each, a short
# pantry refusing, a friends' egg not choosable, the chosen egg hatching what was chosen, and an older save loading.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 6262; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
EGGS = "() => { S.eggs = [{ hue: 40, seed: 11, warm: 20 }, { hue: 200, seed: 12, warm: 0, twin: true }, { hue: 320, seed: 13, warm: 0, twin: true, kinds: ['ember', 'tide'], from: ['Pip', 'Moss'] }, { hue: 90, seed: 14, warm: 0 }]; rebuildHome(); }"

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
        await ev("""() => { window.__fast = true; closeSheet(); S.quests = 4; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V;
          window.__toasts = []; const t0 = toast; window.toast = (m, ms) => { __toasts.push(m); t0(m, ms); }; }""")
        await ev(EGGS)
        rec('shut', await ev("() => { openLittles(); const r = [...ui.sheet.querySelectorAll('[data-do=\"egg\"]')].filter(b => !b.disabled).length; closeSheet(); return r; }"))

        await ev("() => { S.quests = 5; S.pantry = { tide: 7, bloom: 6, glow: 2, stone: 3, gale: 3 }; openLittles(); }")
        rec('list', await ev("() => [...ui.sheet.querySelectorAll('[data-do=\"egg\"]')].map(b => ({ off: b.disabled, text: b.textContent }))"))
        await page.screenshot(path=os.path.join(SHOTS, 'hatchery-littles.png'))

        # a plain egg: one kind, 6 berries
        await ev("() => ui.sheet.querySelectorAll('[data-do=\"egg\"]')[0].click()")
        await ev("() => ui.sheet.querySelector('[data-do=\"kind\"][data-k=\"tide\"]').click()")
        rec('one picked', await ev("() => ({ h2: ui.sheet.querySelector('h2').textContent, set: !ui.sheet.querySelector('[data-do=\"set\"]').disabled, text: ui.sheet.textContent.includes('It will hatch a Puddlefin. That takes 6 Tideplums.') })"))
        await page.screenshot(path=os.path.join(SHOTS, 'hatchery-choose.png'))
        # two kinds on a plain egg: 6 of each, and the pantry is short of Glowdrops
        await ev("() => ui.sheet.querySelector('[data-do=\"kind\"][data-k=\"glow\"]').click()")
        rec('short', await ev("() => ({ set: !ui.sheet.querySelector('[data-do=\"set\"]').disabled, text: ui.sheet.textContent.includes('6 Tideplums and 6 Glowdrops, and the pantry is short') })"))
        await ev("() => { ui.sheet.querySelector('[data-do=\"kind\"][data-k=\"glow\"]').click(); ui.sheet.querySelector('[data-do=\"set\"]').click(); }")
        rec('chosen', await ev("() => ({ kinds: S.eggs[0].kinds, chose: S.eggs[0].chose, tide: S.pantry.tide, count: S.j.chosen, toast: __toasts[__toasts.length - 1] })"))

        # the twin egg: one kind is not enough, two kinds take 3 of each
        await ev("() => { openLittles(); ui.sheet.querySelectorAll('[data-do=\"egg\"]')[1].click(); ui.sheet.querySelector('[data-do=\"kind\"][data-k=\"stone\"]').click(); }")
        rec('twin one', await ev("() => ({ set: !ui.sheet.querySelector('[data-do=\"set\"]').disabled, text: ui.sheet.textContent.includes('A twin egg needs two kinds') })"))
        await ev("() => { ui.sheet.querySelector('[data-do=\"kind\"][data-k=\"gale\"]').click(); ui.sheet.querySelector('[data-do=\"set\"]').click(); }")
        rec('twin chosen', await ev("() => ({ kinds: S.eggs[1].kinds, stone: S.pantry.stone, gale: S.pantry.gale })"))

        # after choosing, the list says what each will hatch and offers no second choice
        await ev("() => openLittles()")
        rec('after', await ev("() => [...ui.sheet.querySelectorAll('[data-do=\"egg\"]')].map(b => ({ off: b.disabled, text: b.textContent }))"))
        await ev("() => closeSheet()")
        await page.wait_for_timeout(300)
        await page.screenshot(path=os.path.join(SHOTS, 'hatchery-nest.png'))

        # hatching: the chosen egg hatches what was chosen
        await ev("() => { S.eggs[0].warm = 100; hatch(0); }")
        rec('hatched', await ev("() => { const l = S.littles[S.littles.length - 1]; return { kind: l.kind, kind2: l.kind2 || null }; }"))
        await ev("() => { closeSheet(); S.eggs[0].warm = 100; hatch(0); }")
        rec('twin hatched', await ev("() => { const l = S.littles[S.littles.length - 1]; return { kind: l.kind, kind2: l.kind2 || null }; }"))
        rec('tap hint', await ev("() => { closeSheet(); S.eggs = [{ hue: 10, seed: 3, warm: 0 }]; rebuildHome(); return eggChoosable(S.eggs[0]); }"))
        rec('old save', await ev("() => { const d = JSON.parse(JSON.stringify(S)); S = d; afterLoad(); return S.eggs.map(e => !!e.kinds); }"))
        await b.close()

    R = RESULTS
    rec('errors', errs)
    finish([
        ('before treats open no egg can be chosen for', R['shut'] == 0),
        ('Littles lists each egg; a friends\' egg cannot be chosen for', [x['off'] for x in R['list']] == [False, False, True, False] and 'friends\' egg from Pip and Moss' in R['list'][2]['text'] and 'Choose' in R['list'][0]['text']),
        ('one kind takes 6 berries of it', R['one picked']['h2'] == 'Choose what hatches' and R['one picked']['set'] and R['one picked']['text']),
        ('two kinds on a plain egg take 6 of each, refused when short', not R['short']['set'] and R['short']['text']),
        ('choosing takes the berries and sets the kinds', R['chosen']['kinds'] == ['tide'] and R['chosen']['chose'] and R['chosen']['tide'] == 1 and R['chosen']['count'] == 1 and 'hatch a Puddlefin' in R['chosen']['toast']),
        ('a twin egg needs two kinds', not R['twin one']['set'] and R['twin one']['text']),
        ('a twin egg takes 3 of each', R['twin chosen'] == {'kinds': ['stone', 'gale'], 'stone': 0, 'gale': 0}),
        ('a chosen egg says what it will hatch and is not chosen again', R['after'][0]['off'] and 'Will hatch a Puddlefin' in R['after'][0]['text'] and 'Will hatch a twin: Pebblit and Zephyrmoth' in R['after'][1]['text']),
        ('the egg hatches the kind chosen', R['hatched'] == {'kind': 'tide', 'kind2': None}),
        ('the twin egg hatches both kinds chosen', R['twin hatched'] == {'kind': 'stone', 'kind2': 'gale'}),
        ('a plain egg can be chosen for', R['tap hint'] is True),
        ('an older save loads unchanged', R['old save'] == [False]),
        ('no script errors', not errs),
    ])

asyncio.run(main())
