# Drives big builds (spec 4.4.16) in a phone-sized headless browser: shut before the journey opens, then three builds
# in the journey's sheet, refused without the stardust, each built once; the mooring post bringing the trader on a day
# it would not have come, the observatory naming what a portal's world hides exactly as the world then holds it, the
# lantern tower adding a spark to every little, each drawn at the nest, and an older save loading.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 7373; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
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
        await ev("""() => { window.__fast = true; closeSheet(); S.quests = 2; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; S.pet.rest = 100; S.pet.asleep = false; S.pet.joy = 30;
          window.__toasts = []; const t0 = toast; window.toast = (m, ms) => { __toasts.push(m); t0(m, ms); }; }""")
        rec('shut', await ev("() => buildsSection() === ''"))

        await ev("() => { S.quests = 8; S.dust = 500; openJourney(); }")
        rec('sheet', await ev("() => [...ui.sheet.querySelectorAll('[data-do=\"bigbuild\"]')].map(b => ({ id: b.dataset.id, off: b.disabled, text: b.textContent }))"))
        await page.screenshot(path=os.path.join(SHOTS, 'builds-sheet.png'))

        # the mooring post: find a day the trader would not come, build, and it comes
        rec('mooring', await ev("""() => { const real = localDay; let d = 0; for (; d < 40; d++) { window.localDay = () => real() + d; S.trader = null; if (!traderToday()) break; }
          const before = traderToday(); ui.sheet.querySelector('[data-do=\"bigbuild\"][data-id=\"mooring\"]').click(); const after = traderToday(); window.localDay = real;
          return { found: d < 40, before, after: !!after && after.length >= 4, dust: S.dust, builds: S.builds.slice(), toast: __toasts[__toasts.length - 1] }; }"""))
        rec('once', await ev("() => { openJourney(); const b = ui.sheet.querySelector('[data-do=\"bigbuild\"][data-id=\"mooring\"]'); return { off: b.disabled, text: b.textContent }; }"))
        rec('short', await ev("() => { const b = ui.sheet.querySelector('[data-do=\"bigbuild\"][data-id=\"observatory\"]'); const r = { off: b.disabled, text: b.textContent }; b.click(); return Object.assign(r, { builds: S.builds.slice() }); }"))

        # the observatory: each portal card says what its world hides, as the world then holds it
        await ev("() => { S.dust = 2000; openJourney(); ui.sheet.querySelector('[data-do=\"bigbuild\"][data-id=\"observatory\"]').click(); closeSheet(); rollPortals(true); openQuestSheet(); }")
        rec('looks', await ev("""() => { const party = partyLittles(); return S.portals.list.map(o => { const w = questWorld(o, party); return { line: observatoryLine(o), vault: !!w.vault, secret: !!w.secret }; }); }"""))
        rec('on cards', await ev("() => [...ui.sheet.querySelectorAll('[data-do=\"go\"]')].filter(b => b.textContent.includes('The observatory sees')).length"))
        await page.screenshot(path=os.path.join(SHOTS, 'builds-observatory.png'))
        # it is right: the world set out into holds what the card said
        rec('true', await ev("() => { const o = S.portals.list[0], line = observatoryLine(o); startQuest(o); const r = { line, vault: !!Q.world.vault, secret: !!Q.world.secret }; finishQuest(false); closeSheet(); return r; }"))

        # the lantern tower: an extra spark for every little
        await ev("() => { S.pet.rest = 100; S.pet.joy = 30; startQuest({ seed: 91, biome: 'mossroot', size: 'nook', name: 'Before' }); }")
        rec('before tower', await ev("() => { const r = Q.lits.map(f => f.max - maxSparks(f.l)); finishQuest(false); closeSheet(); return r; }"))
        await ev("() => { openJourney(); ui.sheet.querySelector('[data-do=\"bigbuild\"][data-id=\"tower\"]').click(); closeSheet(); S.pet.rest = 100; S.pet.joy = 30; startQuest({ seed: 91, biome: 'mossroot', size: 'nook', name: 'After' }); }")
        rec('after tower', await ev("() => { const r = { extra: Q.lits.map(f => f.max - maxSparks(f.l)), toast: __toasts[__toasts.length - 1] }; finishQuest(false); closeSheet(); return r; }"))
        await ev("() => { closeSheet(); rebuildHome(); }")
        await page.wait_for_timeout(400)
        await page.screenshot(path=os.path.join(SHOTS, 'builds-nest.png'))
        rec('journal', await ev("() => { openJournal(); const h = [...ui.sheet.querySelectorAll('h3')].find(h => h.textContent.startsWith('Big builds')); const r = h ? h.textContent : null; closeSheet(); return r; }"))
        rec('all built', await ev("() => S.builds.slice().sort()"))
        rec('old save', await ev("() => { const d = JSON.parse(JSON.stringify(S)); delete d.builds; S = d; afterLoad(); return S.builds; }"))
        await b.close()

    R = RESULTS
    rec('errors', errs)
    looks = R['looks']
    finish([
        ('before the journey opens there are no big builds', R['shut']),
        ('the journey lists three builds, priced 400, 600 and 900', [x['id'] for x in R['sheet']] == ['mooring', 'observatory', 'tower'] and '400' in R['sheet'][0]['text'] and '600' in R['sheet'][1]['text'] and '900' in R['sheet'][2]['text']),
        ('only what can be afforded can be built', [x['off'] for x in R['sheet']] == [False, True, True]),
        ('the mooring post brings the trader on a day it would not have come', R['mooring']['found'] and R['mooring']['before'] is None and R['mooring']['after'] and R['mooring']['dust'] == 100 and R['mooring']['builds'] == ['mooring']),
        ('a build is bought once', R['once']['off'] and 'Built' in R['once']['text']),
        ('a build is refused without the stardust', R['short']['off'] and 'Save up' in R['short']['text'] and R['short']['builds'] == ['mooring']),
        ('the observatory names what each world hides', all(x['line'] == ('The observatory sees ' + ' and '.join([w for w, on in (('a treasure vault', x['vault']), ('a secret door', x['secret'])) if on]) + '.' if (x['vault'] or x['secret']) else 'The observatory sees nothing hidden.') for x in looks)),
        ('the observatory shows on the portal cards', R['on cards'] == 3),
        ('the world set out into holds what the observatory saw', ('vault' in R['true']['line']) == R['true']['vault'] and ('secret' in R['true']['line']) == R['true']['secret']),
        ('the lantern tower gives every little an extra spark', all(v == 0 for v in R['before tower']) and all(v == 1 for v in R['after tower']['extra']) and 'lantern tower' in R['after tower']['toast']),
        ('the journal lists the builds', R['journal'] == 'Big builds · 3 of 3'),
        ('all three are kept', R['all built'] == ['mooring', 'observatory', 'tower']),
        ('an older save loads with no builds', R['old save'] == []),
        ('no script errors', not errs),
    ])

asyncio.run(main())
