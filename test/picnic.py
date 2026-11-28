# Drives the picnic basket (spec 4.4.14) in a phone-sized headless browser: shut before treats open, then a basket
# under the party in Where to?, packing and unpacking berries, the berries leaving the pantry as the party sets out,
# showing in the bag, a little given its own berry for two sparks and another for one, never past its most, what is
# left coming home whether the quest is finished or left, the basket staying packed, and an older save loading.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 5151; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
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
        await ev("""() => { window.__fast = true; closeSheet(); S.quests = 4; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; S.pet.rest = 100; S.pet.asleep = false; S.pet.joy = 30; S.pet.belly = 30;
          window.__toasts = []; const t0 = toast; window.toast = (m, ms) => { __toasts.push(m); t0(m, ms); }; }""")

        rec('shut', await ev("() => { openQuestSheet(); const r = !!ui.sheet.querySelector('[data-do=\"pack\"]') || ui.sheet.textContent.includes('Picnic basket'); closeSheet(); return r; }"))

        # five quests: the basket shows; pack a tide berry twice and a bloom berry, then take one out and put it back
        await ev("() => { S.quests = 5; S.pantry = { tide: 2, bloom: 1, ember: 0 }; S.basket = []; openQuestSheet(); }")
        rec('empty', await ev("() => ({ title: [...ui.sheet.querySelectorAll('h3')].map(h => h.textContent).find(t => t.startsWith('Picnic')), offer: [...ui.sheet.querySelectorAll('[data-do=\"pack\"]')].map(b => b.dataset.el) })"))
        await ev("() => ui.sheet.querySelector('[data-do=\"pack\"][data-el=\"tide\"]').click()")
        await ev("() => ui.sheet.querySelector('[data-do=\"pack\"][data-el=\"tide\"]').click()")
        rec('tide gone', await ev("() => ({ basket: S.basket.slice(), offer: [...ui.sheet.querySelectorAll('[data-do=\"pack\"]')].map(b => b.dataset.el) })"))
        await ev("() => ui.sheet.querySelector('[data-do=\"pack\"][data-el=\"bloom\"]').click()")
        rec('full', await ev("() => ({ basket: S.basket.slice(), offer: ui.sheet.querySelectorAll('[data-do=\"pack\"]').length, pantry: S.pantry.tide })"))
        await page.screenshot(path=os.path.join(SHOTS, 'picnic-where.png'))
        await ev("() => ui.sheet.querySelector('[data-do=\"unpack\"][data-i=\"2\"]').click()")
        rec('unpacked', await ev("() => S.basket.slice()"))
        await ev("() => { ui.sheet.querySelector('[data-do=\"pack\"][data-el=\"bloom\"]').click(); closeSheet(); }")

        # set out with a Puddlefin and a Sproutling: the berries leave the pantry and show in the bag
        await ev("""() => { const t = S.littles.find(l => l.kind === 'tide') || S.littles[0]; t.kind = 'tide'; t.kind2 = undefined; const o = S.littles.find(l => l !== t); o.kind = 'stone'; o.kind2 = undefined; S.party = [t.id, o.id]; S.tools = {};
          startQuest({ seed: 77, biome: 'mossroot', size: 'vale', name: 'Picnic Vale' }); }""")
        await page.wait_for_timeout(300)
        rec('set out', await ev("() => ({ scene, basket: Q.basket.slice(), pantry: { tide: S.pantry.tide, bloom: S.pantry.bloom }, bag: [...$('#q-bag').querySelectorAll('[data-berry]')].map(s => s.dataset.berry + s.textContent) })"))
        await page.screenshot(path=os.path.join(SHOTS, 'picnic-bag.png'))

        # the Puddlefin, two sparks down, takes its own berry: two sparks. Full, it is offered nothing.
        await ev("() => { const f = Q.lits.find(f => f.l.kind === 'tide'); f.sp = f.max - 2; updateQuestBar(); openChip(f); }")
        rec('chip', await ev("() => [...ui.sheet.querySelectorAll('[data-do=\"feed\"]')].map(b => ({ el: b.dataset.el, off: b.disabled, text: b.textContent }))"))
        await page.screenshot(path=os.path.join(SHOTS, 'picnic-chip.png'))
        await ev("() => ui.sheet.querySelector('[data-do=\"feed\"][data-el=\"tide\"]').click()")
        rec('own berry', await ev("() => { const f = Q.lits.find(f => f.l.kind === 'tide'); return { full: f.sp === f.max, basket: Q.basket.slice(), eaten: S.j.picnics }; }"))
        await ev("() => openChip(Q.lits.find(f => f.l.kind === 'tide'))")
        rec('when full', await ev("() => [...ui.sheet.querySelectorAll('[data-do=\"feed\"]')].every(b => b.disabled)"))
        # the Pebblit, one spark down, takes a Mossfig: one spark
        await ev("() => { closeSheet(); const f = Q.lits.find(f => f.l.kind === 'stone'); f.sp = f.max - 3; openChip(f); ui.sheet.querySelector('[data-do=\"feed\"][data-el=\"bloom\"]').click(); }")
        rec('other berry', await ev("() => { const f = Q.lits.find(f => f.l.kind === 'stone'); return { gap: f.max - f.sp, basket: Q.basket.slice() }; }"))

        # leave early: the tide berry left comes home
        await ev("() => finishQuest(false)")
        rec('home', await ev("() => ({ tide: S.pantry.tide, bloom: S.pantry.bloom, line: ui.sheet.textContent.includes('from the picnic basket came home'), basket: S.basket.slice() })"))

        # next time: packed the same way, as far as the pantry goes
        await ev("() => { closeSheet(); S.pet.rest = 100; openQuestSheet(); }")
        rec('again', await ev("() => ({ basket: S.basket.slice(), ready: basketReady() })"))

        rec('old save', await ev("() => { const d = JSON.parse(JSON.stringify(S)); delete d.basket; S = d; afterLoad(); return S.basket; }"))
        await b.close()

    R = RESULTS
    rec('errors', errs)
    finish([
        ('before treats open there is no basket', R['shut'] is False),
        ('Where to? shows an empty basket and the berries the pantry holds', R['empty']['title'] == 'Picnic basket · 0 of 3' and sorted(R['empty']['offer']) == ['bloom', 'tide']),
        ('a berry is offered only while the pantry has one not packed', R['tide gone']['basket'] == ['tide', 'tide'] and R['tide gone']['offer'] == ['bloom']),
        ('the basket holds three, and nothing leaves the pantry while packing', R['full'] == {'basket': ['tide', 'tide', 'bloom'], 'offer': 0, 'pantry': 2}),
        ('a berry can be taken out again', R['unpacked'] == ['tide', 'tide']),
        ('setting out takes the berries from the pantry into the quest', R['set out']['scene'] == 'quest' and R['set out']['basket'] == ['tide', 'tide', 'bloom'] and R['set out']['pantry'] == {'tide': 0, 'bloom': 0}),
        ('the bag shows the basket', sorted(R['set out']['bag']) == ['bloom1', 'tide2']),
        ('a little\'s chip offers each berry, its own as its favourite', any(x['el'] == 'tide' and not x['off'] and '2 sparks' in x['text'] for x in R['chip']) and any(x['el'] == 'bloom' and '1 spark' in x['text'] for x in R['chip'])),
        ('its own berry gives two sparks', R['own berry'] == {'full': True, 'basket': ['tide', 'bloom'], 'eaten': 1}),
        ('a little full of sparks is offered nothing', R['when full']),
        ('any other berry gives one spark', R['other berry'] == {'gap': 2, 'basket': ['tide']}),
        ('what is left comes home, even when leaving early', R['home']['tide'] == 1 and R['home']['bloom'] == 0 and R['home']['line']),
        ('the basket stays packed for next time, as far as the pantry goes', R['again']['basket'] == ['tide', 'tide', 'bloom'] and R['again']['ready'] == ['tide']),
        ('an older save loads with an empty basket', R['old save'] == []),
        ('no script errors', not errs),
    ])

asyncio.run(main())
