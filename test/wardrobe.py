# Drives dressing up in a phone-sized headless browser: the wardrobe opening with its scarf, wearing and taking off,
# the trader's costumes, hats perching on a busy head, pictures, the elder's outfit, and an older save loading.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 777; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright

# Draws a look on a spare canvas and returns its pixels, to tell whether a costume changed anything.
# Moves the clock to a local date and time, keeping it running.
def at(when):
    return "(() => { const D = Date, off = new D('%s').getTime() - D.now(); class FD extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } } window.Date = FD; })()" % when
PIXELS = """(L) => { const k = document.createElement('canvas'); k.width = k.height = 160; const c = k.getContext('2d'); drawCreature(c, L, 80, 150, 90, 0, { still: true, noShadow: true }); return k.toDataURL(); }"""

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        page = await (await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)).new_page()
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.add_init_script(SEED_JS); await page.add_init_script(at('2026-11-13T15:00:00'))   # autumn, away from Halloween
        await page.goto(PAGE); await page.wait_for_timeout(800)
        ev = page.evaluate

        rec('fresh', await ev("(() => { closeSheet(); openJournal(); const btn = !!document.querySelector('#sheet [data-do=wardrobe]'); closeSheet(); return { wardrobe: S.wardrobe, open: unlocked('wardrobe'), scarf: wearOwned('scarf'), btn }; })()"))

        # Two quests open the wardrobe, with the scarf in it.
        rec('opened', await ev("(() => { S.quests = 2; const due = takeUnlocks().map(u => u.id); openJournal(); const btn = !!document.querySelector('#sheet [data-do=wardrobe]'); closeSheet(); return { due, scarf: wearOwned('scarf'), specs: wearOwned('specs'), btn }; })()"))

        await ev("openWardrobe('pet')"); await page.wait_for_timeout(150)
        rec('sheet', await ev("({ wearable: [...document.querySelectorAll('#sheet [data-do=wear]')].map(e => e.dataset.id), shown: [...document.querySelectorAll('#sheet strong')].map(e => e.textContent) })"))
        await page.click('#sheet [data-do=wear][data-id=scarf]'); await page.wait_for_timeout(150)
        rec('worn', await ev("({ wear: S.pet.wear, look: home.look.wear, tag: document.querySelector('#sheet [data-id=scarf] .tag').textContent })"))
        await page.screenshot(path=SHOTS + '/w1_wardrobe.png')
        await page.click('#sheet [data-do=wear][data-id=scarf]'); await page.wait_for_timeout(150)
        rec('off', await ev("({ wear: S.pet.wear === undefined, look: home.look.wear === undefined })"))
        await ev("closeSheet()")

        # The trader carries a costume not yet owned on some days, at its own price.
        rec('trader', await ev("""(() => { const real = localDay; let found = null;
          for (let d = 0; d < 80 && !found; d++) { window.localDay = () => real() + d; S.trader = null; const st = traderToday() || []; const o = st.find(x => x.id.startsWith('wear:')); if (o) found = { d, id: o.id, price: o.price }; }
          return found; })()"""))
        if RESULTS['trader']:
            await ev("S.dust = 100; openShop()"); await page.wait_for_timeout(150)
            i = await ev("traderToday().findIndex(x => x.id.startsWith('wear:'))")
            await page.click('#sheet [data-do=buy][data-i="%d"]' % i); await page.wait_for_timeout(150)
            rec('bought', await ev("({ wardrobe: S.wardrobe.slice(), dust: S.dust, toast: document.getElementById('toast').textContent })"))
            rec('not again', await ev("(() => { const id = S.wardrobe[0]; for (let d = 0; d < 80; d++) { window.localDay = () => Math.floor(Date.now() / 864e5) + d; S.trader = null; const st = traderToday() || []; if (st.some(x => x.id === 'wear:' + id)) return false; } return true; })()"))
            await ev("closeSheet()")

        # Every costume draws something, and a hat perches when the head is already busy.
        # The season's costumes: the trader carries one on every day it comes, a gift on the 25th holds the paper crown,
        # and in Halloween week the ghost sheet turns up by itself.
        SEASON = """(() => { const real = localDay, seen = new Set(); let here = 0, every = true; S.wardrobe = [];
          for (let d = 0; d < 30; d++) { window.localDay = () => real() + d; S.trader = null; const st = traderToday(); if (!st) continue; here++; const w = st.filter(o => o.id.startsWith('wear:') && WEAR[o.id.slice(5)].season); if (!w.length) every = false; w.forEach(o => seen.add(o.id.slice(5) + ':' + o.price)); }
          window.localDay = real; S.trader = null; return { season: seasonNow(), here, every, seen: [...seen].sort() }; })()"""
        rec('autumn', await ev(SEASON))
        await ev(at('2026-07-10T12:00:00')); rec('summer', await ev(SEASON))
        await ev(at('2026-12-25T10:00:00')); rec('winter', await ev(SEASON))
        rec('crown', await ev("(() => { S.wardrobe = []; const g = giftFor(2026, 25); S.advent = { y: 2026, got: [] }; S.createdAt = new Date('2026-11-01').getTime(); for (let d = 1; d < 25; d++) S.advent.got.push(d); openGift(); const r = { gift: g.map(x => x.id || x.k), owned: wearOwned('crown'), again: giftFor(2026, 25).some(x => x.id === 'wear:crown') }; closeSheet(); return r; })()"))
        await ev(at('2026-10-30T18:00:00'))
        rec('halloween', await ev("(() => { const first = halloweenSheet(), second = halloweenSheet(); openWardrobe('pet'); const r = { first, second, owned: wearOwned('ghost'), card: !!document.querySelector('#sheet [data-id=ghost]'), words: document.querySelector('#sheet p').textContent }; closeSheet(); return r; })()"))
        await ev(at('2026-11-13T15:00:00'))
        rec('not halloween', await ev("(() => { S.wardrobe = S.wardrobe.filter(k => k !== 'ghost'); return halloweenSheet(); })()"))
        rec('shades sleep', await ev("(() => { const k = document.createElement('canvas'), c = k.getContext('2d'), L = petLook(S.pet), P = (L2, mood) => { k.width = k.height = 160; drawCreature(c, L2, 80, 150, 90, 0, { still: true, noShadow: true, mood }); return k.toDataURL(); }; const W = Object.assign({}, L, { wear: { face: 'shades' } }); return { awake: P(W, 'idle') !== P(L, 'idle'), asleep: P(W, 'sleep') === P(L, 'sleep') }; })()"))

        rec('draws', await ev("(() => { const P = " + PIXELS + "; S.wardrobe = WEAR_IDS.filter(k => k !== 'scarf'); const base = petLook(S.pet), plain = P(base); return WEAR_IDS.filter(id => P(Object.assign({}, base, { wear: { [WEAR[id].slot]: id } })) === plain); })()"))
        rec('busy', await ev("""(() => { const p = S.pet, xp = p.xp; const hatch = headBusy(petLook(p));
          p.xp = petNeed(9) + 5; p.form = 'bloom'; const myth = headBusy(petLook(p)); p.xp = xp; delete p.form; return { hatch, myth }; })()"""))
        rec('perched', await ev("(() => { const P = " + PIXELS + "; const p = { name: 'x', seed: 11, xp: petNeed(9) + 5, form: 'tide', diet: {} }; const L = petLook(p); return P(Object.assign({}, L, { wear: { head: 'wizard' } })) !== P(L); })()"))

        # A whole outfit, at the nest, in a picture.
        await ev("S.pet.wear = { head: 'wizard', neck: 'scarf', face: 'specs' }; refreshLooks(); S.pics = S.pics || []; takePicture()")
        await page.wait_for_timeout(300)
        rec('picture', await ev("S.pics[S.pics.length - 1].pet.wear"))
        await page.screenshot(path=SHOTS + '/w2_dressed.png')

        # Hatching a new generation: the elder keeps its outfit, the child hatches with nothing on, the wardrobe stays.
        rec('hatch', await ev("""(() => { closeSheet(); S.pet.xp = petNeed(9) + 5; S.reg.i = BIOMES.length; checkHeir(false); hatchHeir(); closeSheet();
          return { elder: elder().wear, pet: S.pet.wear === undefined, wardrobe: S.wardrobe.slice(), gen: S.gen }; })()"""))
        await ev("openWardrobe('elder')"); await page.wait_for_timeout(150)
        rec('elder tabs', await ev("({ who: document.querySelectorAll('#sheet [data-do=who]').length, wearable: document.querySelectorAll('#sheet [data-do=wear]').length, all: WEAR_IDS.length })"))
        await page.click('#sheet [data-do=wear][data-id=explorer]'); await page.wait_for_timeout(150)
        rec('elder dressed', await ev("({ elder: elder().wear, pet: S.pet.wear === undefined, look: home.elder ? home.elder.look.wear : 'none' })"))
        await page.click('#sheet [data-do=who][data-w=pet]'); await page.wait_for_timeout(150)
        await page.click('#sheet [data-do=wear][data-id=explorer]'); await page.wait_for_timeout(150)
        rec('both', await ev("({ elder: elder().wear.head, pet: S.pet.wear && S.pet.wear.head })"))
        await ev("closeSheet()"); await page.wait_for_timeout(400)
        await page.screenshot(path=SHOTS + '/w3_elder.png')

        # An older save, from before the wardrobe, loads with nothing worn and nothing owned.
        rec('old save', await ev("(() => { delete S.wardrobe; delete S.pet.wear; S.elders.forEach(e => delete e.wear); afterLoad(); return { wardrobe: S.wardrobe, wear: S.pet.wear === undefined, look: home.look.wear === undefined }; })()"))
        await b.close()

    R = RESULTS
    finish([
        ('a new game has no wardrobe yet', R['fresh']['wardrobe'] == [] and not R['fresh']['open'] and not R['fresh']['scarf'] and not R['fresh']['btn']),
        ('two quests open the wardrobe, with the scarf in it', 'wardrobe' in R['opened']['due'] and R['opened']['scarf'] and not R['opened']['specs'] and R['opened']['btn']),
        ('only what is owned can be worn', R['sheet']['wearable'] == ['scarf'] and "Explorer's hat" in R['sheet']['shown']),
        ('wearing the scarf puts it on the Glimmerkin', R['worn']['wear'] == {'neck': 'scarf'} and R['worn']['look'] == {'neck': 'scarf'} and R['worn']['tag'] == 'Take off'),
        ('tapping it again takes it off', R['off']['wear'] and R['off']['look']),
        ('the trader sometimes carries a costume', bool(R['trader']) and R['trader']['price'] in (20, 25, 30, 35)),
        ("the trader carries the season's costumes on every day it comes", R['autumn']['season'] == 'autumn' and R['autumn']['here'] > 5 and R['autumn']['every'] and R['autumn']['seen'] == ['acorn:25']),
        ('in summer, the sun hat and the star sunglasses', R['summer']['season'] == 'summer' and R['summer']['every'] and R['summer']['seen'] == ['shades:25', 'sunhat:30']),
        ('in winter, the bobble hat', R['winter']['season'] == 'winter' and R['winter']['every'] and R['winter']['seen'] == ['bobble:30']),
        ('the gift on the 25th holds a paper crown, once', 'wear:crown' in R['crown']['gift'] and 'star' in R['crown']['gift'] and R['crown']['owned'] and not R['crown']['again']),
        ('in Halloween week the ghost sheet turns up, once', R['halloween']['first'] and not R['halloween']['second'] and R['halloween']['owned'] and R['halloween']['card'] and 'ghost sheet' in R['halloween']['words'] and R['not halloween'] is False),
        ('star sunglasses come off for a nap', R['shades sleep'] == {'awake': True, 'asleep': True}),
        ('a costume bought is owned', R.get('bought') and len(R['bought']['wardrobe']) == 1 and 'went into the wardrobe' in R['bought']['toast']),
        ('the trader never sells one already owned', R.get('not again') is True),
        ('every costume draws', R['draws'] == []),
        ('a hat perches when the head is busy', R['busy'] == {'hatch': False, 'myth': True} and R['perched']),
        ('a picture keeps what was worn', R['picture'] == {'head': 'wizard', 'neck': 'scarf', 'face': 'specs'}),
        ('the elder keeps its outfit and the child hatches with nothing on', R['hatch']['elder'] == {'head': 'wizard', 'neck': 'scarf', 'face': 'specs'} and R['hatch']['pet'] and len(R['hatch']['wardrobe']) == len(set(R['hatch']['wardrobe'])) >= 3 and R['hatch']['gen'] == 2),
        ('the elder can be dressed on its own', R['elder tabs']['who'] == 2 and R['elder tabs']['wearable'] == R['elder tabs']['all'] and R['elder dressed']['elder']['head'] == 'explorer' and R['elder dressed']['pet']),
        ('both can wear the same costume at once', R['both'] == {'elder': 'explorer', 'pet': 'explorer'}),
        ('an older save loads with nothing worn', R['old save']['wardrobe'] == [] and R['old save']['wear'] and R['old save']['look']),
        ('no errors', not errs or print(errs)),
    ])

asyncio.run(main())
