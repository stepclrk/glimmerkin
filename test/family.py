# Drives a new generation in a phone-sized headless browser: the starlit egg, hatching it, the elder at the nest,
# what carries on and what starts again, the family tree, and an older save loading unchanged.
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

# A save from before generations existed: Mythic, the journey done, a planted garden, things owned.
OLD_SAVE = """() => {
  closeSheet(); const r = RNG(9); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r));
  S.quests = 40; S.seen = UNLOCKS.filter(u => !u.when).map(u => u.id); S.news = NEWS_V; S.dust = 321; S.tools = { lantern: 2, bell: 1 }; S.chimes = 3;
  S.pet.xp = petNeed(9) + 5; S.pet.diet = { ember: 2 }; S.pet.ate = { ember: 30 }; S.pet.marks = ['halo', 'comet']; S.pet.tricks = { spin: 5, bow: 2 }; S.pet.asleep = false;
  S.reg = { i: 6, n: 0, built: ['mossroot', 'emberfall'] }; S.j.regions = 6; S.j.biomes = { emberfall: 12, mossroot: 4 };
  delete S.gen; delete S.elders; delete S.heir; delete S.nestSeed; delete S.pet.born; delete S.pet.q0; delete S.pet.form;
  ensureGarden(); S.garden.beds[2] = { el: 'tide', st: 1, t: 0, w: Date.now(), gl: 1 };
  window.__before = { seed: S.pet.seed, garden: gardenSeed(), soils: JSON.stringify(gardenMap(0).soils), littles: S.littles.length };
  afterLoad(); return { heir: !!S.heir, gen: S.gen, nest: S.nestSeed === window.__before.seed, garden: gardenSeed() === window.__before.garden, form: S.pet.form, most: S.reg.most, unlocked: unlocked('family') };
}"""

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
        rec('old save', await ev(OLD_SAVE))
        # the egg is told of once, as something new
        rec('told', await ev("(() => { const due = takeUnlocks(); openUnlocks(due); return { ids: due.map(u => u.id), title: document.querySelector('#sheet h2').textContent }; })()"))
        await ev("closeSheet()")
        await page.wait_for_function("home.heirPos && home.heirPos.x > 0")
        await page.screenshot(path=SHOTS + '/f1_egg.png')
        # rubbing the egg warms it, and warm it asks before hatching
        pos = await ev("({ x: home.heirPos.x, y: home.heirPos.y - home.baseS * 0.13 })")
        rec('egg hit', await ev("homeHit(%s)" % ('{x: %f, y: %f}' % (pos['x'], pos['y']))))
        await page.mouse.move(pos['x'], pos['y']); await page.mouse.down()
        for i in range(16):
            await page.mouse.move(pos['x'] + (18 if i % 2 else -18), pos['y'], steps=4)
        await page.mouse.up()
        rec('warmth', await ev("S.heir.warm"))
        await ev("S.heir.warm = 96; strokeHeir()")
        await page.wait_for_function("!ui.sheet.hidden && document.querySelector('#sheet h2').textContent.includes('warm')")
        await page.screenshot(path=SHOTS + '/f2_ask.png')
        await page.click('#sheet [data-do="no"]')
        rec('not yet', await ev("({ heir: !!S.heir, warm: S.heir.warm, gen: S.gen })"))
        await ev("askHatch()"); await page.click('#sheet [data-do="yes"]')
        await page.wait_for_function("S.gen === 2 && !ui.sheet.hidden")
        await page.screenshot(path=SHOTS + '/f3_hatched.png')
        rec('hatched', await ev("""({ gen: S.gen, heir: S.heir, elders: S.elders.length, elder: S.elders[0] && { name: S.elders[0].name, form: S.elders[0].form, tricks: S.elders[0].tricks, quests: S.elders[0].quests },
          stage: stageOf(petLevel(S.pet.xp)), newSeed: S.pet.seed !== window.__before.seed, marks: S.pet.marks, visits: S.pet.visits, hue0: typeof S.pet.hue0, form: S.pet.form || null,
          reg: [S.reg.i, S.reg.n, S.reg.most], built: S.reg.built.length, littles: S.littles.length === window.__before.littles, dust: S.dust, tools: S.tools, chimes: S.chimes,
          bed: S.garden.beds[2] && S.garden.beds[2].el, garden: gardenSeed() === window.__before.garden, soils: JSON.stringify(gardenMap(0).soils) === window.__before.soils,
          quarter: quarterOpen(5), unlocked: unlocked('family'), hud: document.getElementById('stage-tag').textContent, sheet: document.querySelector('#sheet h2').textContent })"""))
        await ev("closeSheet()")
        await page.wait_for_function("home.elder && home.elder.x > 0")
        await page.wait_for_timeout(600)
        await page.screenshot(path=SHOTS + '/f4_elder.png')
        # the elder can be tapped and stroked
        ep = await ev("({ x: home.elder.x, y: home.elder.y - home.elder.s * 0.45 })")
        await ev("document.getElementById('toast').textContent = ''")
        rec('elder hit', await ev("homeHit({x: %f, y: %f})" % (ep['x'], ep['y'])))
        await page.mouse.click(ep['x'], ep['y']); await page.wait_for_timeout(150)
        rec('elder tap', await ev("document.getElementById('toast').textContent"))
        # its form comes from its own travels, not the family's
        rec('own form', await ev("(() => { S.pet.diet = {}; S.pet.ate = {}; S.pet.visits = { stonesong: 8 }; S.j.biomes.emberfall = 99; return formFor(S.pet, formVisits()); })()"))
        # a trick the elder knows takes three tries
        rec('tricks', await ev("({ spin: learnAt('spin'), bow: learnAt('bow'), leap: learnAt('leap') })"))
        # a heart beaten again gives its piece a star, and no quarter shuts
        rec('again', await ev("(() => { S.reg.i = 1; S.reg.n = 3; const lines = journeyAfter({ B: BIOMES[1], region: true }, true); return { stars: S.reg.stars, i: S.reg.i, most: S.reg.most, regions: S.j.regions, lines }; })()"))
        # the journal has the family tree; a picture has the elder in it
        await ev("openJournal()"); await page.wait_for_timeout(200)
        rec('journal', await ev("({ family: document.querySelector('#sheet').textContent.includes('The family · 2 generations'), second: document.querySelector('#sheet').textContent.includes('second generation'), formsTag: document.querySelector('#sheet').textContent.includes('family') })"))
        await page.screenshot(path=SHOTS + '/f5_journal.png')
        await ev("closeSheet(); takePicture()")
        rec('picture', await ev("({ el: !!S.pics[S.pics.length - 1].el, name: S.pics[S.pics.length - 1].el.name === S.elders[0].name })"))
        # it all survives a reload
        await ev("save(); saveLocal()")
        await page.reload(); await page.wait_for_function("typeof S !== 'undefined' && S && S.pet && S.gen")
        rec('reload', await ev("({ gen: S.gen, elders: S.elders.length, most: S.reg.most })"))
        await b.close()
    rec('errors', [e for e in errs if 'Failed to load resource' not in e])
asyncio.run(main())
R = RESULTS
h = R['hatched']
finish([('no page errors', not R['errors']),
        ('an older save loads with its garden and gets the egg', R['old save']['heir'] and R['old save']['gen'] == 1 and R['old save']['nest'] and R['old save']['garden'] and R['old save']['most'] == 6 and R['old save']['form'] == 'ember'),
        ('the egg is told of as something new', 'family' in R['told']['ids'] and R['told']['title'] == 'Something new'),
        ('the egg can be rubbed warm', R['egg hit'] == {'k': 'heir'} and R['warmth'] > 0),
        ('not yet leaves the egg warm', R['not yet']['heir'] and R['not yet']['warm'] == 100 and R['not yet']['gen'] == 1),
        ('hatching makes an elder and a new Hatchling', h['gen'] == 2 and h['heir'] is None and h['elders'] == 1 and h['elder']['form'] == 'ember' and h['stage'] == 0 and h['newSeed'] and h['form'] is None and h['sheet'] == 'A new Glimmerkin'),
        ('the elder keeps the tricks it knew', h['elder']['tricks'] == {'spin': 5} and h['elder']['quests'] == 40),
        ('the child inherits colour and the last mark', h['marks'] == ['comet'] and h['hue0'] == 'number' and h['visits'] == {}),
        ('the journey starts again, pieces and quarters stay', h['reg'] == [0, 0, 6] and h['built'] == 2 and h['quarter']),
        ('littles, stardust and things carry on', h['littles'] and h['dust'] == 321 and h['tools'] == {'lantern': 2, 'bell': 1} and h['chimes'] == 3),
        ('the garden is the same garden', h['bed'] == 'tide' and h['garden'] and h['soils']),
        ('the HUD names the generation', h['hud'].startswith('Gen 2')),
        ('the elder rests at the nest and answers a tap', R['elder hit'] == {'k': 'elder'} and 'elder' in R['elder tap']),
        ('the new form comes from its own visits', R['own form'] == 'stone'),
        ('a trick the elder knows takes three tries', R['tricks'] == {'spin': 3, 'bow': 5, 'leap': 5}),
        ('a heart beaten again adds a star', R['again']['stars'] == {'emberfall': 1} and R['again']['most'] == 6 and R['again']['regions'] == 6 and any('A star' in l for l in R['again']['lines']) and not any('quarter' in l for l in R['again']['lines'])),
        ('the journal has the family tree', R['journal']['family'] and R['journal']['second'] and R['journal']['formsTag']),
        ('pictures keep the elder', R['picture']['el'] and R['picture']['name']),
        ('a new generation survives a reload', R['reload']['gen'] == 2 and R['reload']['elders'] == 1 and R['reload']['most'] == 6)])
