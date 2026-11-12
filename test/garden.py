# Drives the garden in a phone-sized headless browser: the way in from Where to?, walking, planting a seed, tending
# it with a little of its kind and without one, growing through its stages, littles helping while the player is
# away, sniffing and picking a bloom, the journal, and the way back to the nest.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 4321; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
TOAST = "document.getElementById('toast').textContent"
SHEET = "ui.sheet.hidden ? '' : ui.sheet.textContent"
AGE = "Object.values(S.garden.beds).forEach(b => { if (b.t) b.t -= GROUNDS.GROW + 1000; })"   # 40 minutes pass

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(**LAUNCH)
        page = await browser.new_page(viewport={'width': 390, 'height': 760})
        errors = []; page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.add_init_script(SEED_JS); await page.goto(PAGE); await page.wait_for_timeout(900); ev = page.evaluate
        stage = await (await page.query_selector('#stage')).bounding_box()
        async def tap(x, y, wait=400):
            pt = await ev("(([x, y]) => { const V = gardenView(); return [(x + 0.5 - V.ox) * V.ts, V.top + (y + 0.5 - V.oy) * V.ts]; })", [x, y])
            await page.mouse.click(stage['x'] + pt[0], stage['y'] + pt[1]); await page.wait_for_timeout(wait)
        async def settle():
            for _ in range(60):
                if not await ev("GA && (GA.path.length || GA.act)"): return
                await page.wait_for_timeout(150)
        async def go_near(x, y):
            # walk until the tile is on screen and clear of the top and the bar, a few steps at a time
            for _ in range(14):
                if await ev("(([x, y]) => { const V = gardenView(), sx = (x + 0.5 - V.ox) * V.ts, sy = V.top + (y + 0.5 - V.oy) * V.ts; return sx > 8 && sx < VW - 8 && sy > topIn + 60 && sy < VH - botIn - 8; })", [x, y]): return
                await ev("(([x, y]) => { GA.path = gardenPath(GA.at.x, GA.at.y, (a, b) => Math.abs(a - x) + Math.abs(b - y) === 1).slice(0, 5); })", [x, y]); await settle()
        async def tap_bed(i, wait=400):
            s = await ev("GA.M.soils[%d]" % i); await go_near(s['x'], s['y']); await tap(s['x'], s['y'], 150); await settle(); await page.wait_for_timeout(wait)

        # before the seventh quest there is no garden
        await ev("closeSheet(); S.pet.asleep = false; S.quests = 6; S.seen = UNLOCKS.filter(u => u.at <= 6).map(u => u.id); S.news = NEWS_V")
        await ev("openQuestSheet()"); locked = await ev("!ui.sheet.querySelector('[data-do=garden]')"); await ev("closeSheet(); enterGarden()")
        rec('locked', {'no card': locked, 'scene': await ev("scene")})
        await ev("S.quests = 7"); due = await ev("takeUnlocks().map(u => u.id)"); rec('unlock', due)
        # a save from before the garden gets its fields
        rec('old save', await ev("(() => { delete S.garden; afterLoad(); return JSON.stringify(S.garden); })()"))
        await ev("S.pet.asleep = true; enterGarden()"); asleep = await ev("scene"); await ev("S.pet.asleep = false")
        # give the party one Ember little and nothing else that is Tide
        await ev("(() => { const r = RNG(5); S.littles = [newLittle('ember', r), newLittle('gale', r)]; S.party = [S.littles[0].id]; })()")
        await page.click('[data-act="quest"]'); await page.wait_for_timeout(250); card = await ev("ui.sheet.querySelector('[data-do=garden]').textContent")
        await page.click('[data-do="garden"]'); await page.wait_for_timeout(500)
        rec('enter', {'asleep stays': asleep, 'card': card, 'scene': await ev("scene"), 'seeds': await ev("S.garden.seeds"), 'name': await ev("document.getElementById('q-name').textContent"), 'bar': await ev("!ui.barGarden.hidden && ui.barQuest.hidden && ui.barHome.hidden"), 'toast': await ev(TOAST), 'party': await ev("GA.lits.length")})
        await ev("GA.night = 0"); await page.wait_for_timeout(150); await page.screenshot(path=SHOTS + '/g1_enter.png')
        # walking: a tile two up the path is walked to; a hedge is not
        st = await ev("GA.M.start"); await tap(st['x'], st['y'] - 2, 100); await settle(); walked = await ev("GA.at")
        hedge = await ev("(() => { const M = GA.M; for (const [dx, dy] of [[1, 0], [-1, 0], [2, 0], [-2, 0], [1, -1], [-1, -1], [2, -1], [-2, -1]]) { const x = GA.at.x + dx, y = GA.at.y + dy; if (M.rows[y][x] === '#') return {x, y}; } return null; })()")
        if hedge: await tap(hedge['x'], hedge['y'], 300)
        rec('walk', {'to': walked, 'want': [st['x'], st['y'] - 2], 'hedge': hedge is not None, 'after hedge': await ev("GA.at"), 'moving': await ev("GA.path.length")})
        # planting: tap soil, choose the Emberflare seed
        await tap_bed(0); sheet = await ev(SHEET); await page.screenshot(path=SHOTS + '/g2_seeds.png')
        await page.click('[data-do="plant"][data-el="ember"]'); await page.wait_for_timeout(300)
        rec('plant', {'sheet': 'Plant a seed' in sheet and 'Emberflare' in sheet, 'bed': await ev("S.garden.beds[0]"), 'left': await ev("S.garden.seeds.ember"), 'toast': await ev(TOAST)})
        # tending with a little of its kind: it grows, it can still glimmer, and the little learns from it
        xp0 = await ev("S.littles[0].xp"); await tap_bed(0); tended = await ev("({t: S.garden.beds[0].t > 0, gl: S.garden.beds[0].gl, xp: S.littles[0].xp, tend: S.littles[0].tend.n})"); t1 = await ev(TOAST)
        await page.wait_for_timeout(600); await tap_bed(0); growing = await ev(TOAST)
        rec('tend', {'bed': tended, 'xp0': xp0, 'toast': t1, 'growing': growing})
        await ev(AGE); await page.wait_for_timeout(1300); sprout = await ev("S.garden.beds[0].st")
        await tap_bed(0); await ev(AGE); await page.wait_for_timeout(1300); await page.screenshot(path=SHOTS + '/g3_bud.png'); bud = await ev("S.garden.beds[0].st")
        await tap_bed(0); await ev(AGE); await page.wait_for_timeout(1300)
        rec('grow', {'sprout': sprout, 'bud': bud, 'bloom': await ev("S.garden.beds[0]"), 'grown': await ev("S.garden.grown"), 'glim': await ev("S.garden.glim"), 'flowers': await ev("S.j.flowers"), 'count': await ev("document.getElementById('q-shards').textContent"), 'toast': await ev(TOAST)})
        await page.screenshot(path=SHOTS + '/g4_bloom.png')
        # a fourth tend the same day gives no more experience
        await ev("S.garden.seeds.ember = 1"); await tap_bed(1); await page.click('[data-do="plant"][data-el="ember"]'); await page.wait_for_timeout(200); xp1 = await ev("S.littles[0].xp"); await tap_bed(1)
        rec('tend cap', {'before': xp1, 'after': await ev("S.littles[0].xp"), 'tended': await ev("S.garden.beds[1].t > 0")})
        # no Tide little in the party or at home: the Glimmerkin can tend it, and then it will not glimmer
        await tap_bed(2); await page.click('[data-do="plant"][data-el="tide"]'); await page.wait_for_timeout(200); await tap_bed(2); ask = await ev(SHEET)
        await page.click('[data-do="no"]'); left = await ev("S.garden.beds[2].t"); await tap_bed(2); await page.click('[data-do="go"]'); await page.wait_for_timeout(200)
        rec('pet tends', {'asks': 'needs a Tide little' in ask and 'will not glimmer' in ask, 'left': left, 'bed': await ev("S.garden.beds[2]"), 'toast': await ev(TOAST)})
        # a Gale little at home sees to a Breezebell that has waited an hour, and it keeps its glimmer
        await tap_bed(3); await page.click('[data-do="plant"][data-el="gale"]'); await page.wait_for_timeout(200)
        early = await ev("(() => { S.garden.beds[3].w -= 59 * 60000; growBeds(Date.now()); return S.garden.beds[3].t; })()")
        helped = await ev("(() => { S.garden.beds[3].w -= 2 * 60000; const r = growBeds(Date.now()); return {t: S.garden.beds[3].t > 0, gl: S.garden.beds[3].gl, who: r.helped.map(h => h.l.kind)}; })()")
        away = await ev("(() => { const b = S.garden.beds[3], h = 3600000; b.st = 0; b.t = 0; b.w = Date.now() - 6 * h; growBeds(Date.now()); return {st: b.st, gl: b.gl}; })()")
        rec('helper', {'early': early, 'helped': helped, 'six hours away': away})
        # sniffing a bloom lifts Joy, once in a while; picking it gives two seeds and frees the soil
        await ev("S.pet.joy = 50"); await tap_bed(0); bloom = await ev(SHEET); await page.screenshot(path=SHOTS + '/g5_sheet.png'); await page.click('[data-do="sniff"]'); await page.wait_for_timeout(200); joy1 = await ev("S.pet.joy")
        await tap_bed(0); await page.click('[data-do="sniff"]'); await page.wait_for_timeout(200); joy2 = await ev("S.pet.joy")
        await tap_bed(0); await page.click('[data-do="pick"]'); await page.wait_for_timeout(200)
        rec('bloom', {'sheet': 'glimmering' in bloom, 'joy': [joy1, joy2], 'bed': await ev("S.garden.beds[0] || null"), 'seeds': await ev("S.garden.seeds.ember"), 'picked': await ev("S.j.picked"), 'toast': await ev(TOAST)})
        # the seed tray from the bar, the journal, and the two ways out
        await page.click('[data-g="seeds"]'); await page.wait_for_timeout(200); tray = await ev(SHEET); await ev("closeSheet()")
        await page.click('[data-g="leave"]'); await page.wait_for_timeout(300); home = await ev("({scene, bar: !ui.barHome.hidden && ui.barGarden.hidden, hud: !ui.hudHome.hidden, bag: !document.getElementById('q-bag').hidden})")
        journal = await ev("(() => { openJournal(); const t = ui.sheet.textContent; closeSheet(); return t; })()")
        saved = await ev("(() => { const d = JSON.parse(localStorage.getItem('glimmerkin.v1')); return !!(d.garden && d.garden.beds[1] && d.garden.gift); })()")
        await ev("enterGarden()"); await page.wait_for_timeout(300); again = await ev("({seeds: S.garden.seeds.tide, beds: Object.keys(S.garden.beds).length})")
        g = await ev("GA.M.gate"); await ev("GA.path = []"); await tap(g['x'], g['y'], 200); await settle(); await page.wait_for_timeout(300)
        rec('leave', {'tray': 'Seeds' in tray and 'Emberflare' in tray, 'home': home, 'journal': 'Flowers · 2 of 6' in journal and 'Emberflare' in journal, 'saved': saved, 'again': again, 'gate': await ev("scene")})
        # a quest still starts and ends as before after a visit
        await ev("openQuestSheet()"); await page.click('[data-do="go"][data-i="0"]'); await page.wait_for_timeout(600)
        rec('quest after', {'scene': await ev("scene"), 'bar': await ev("!ui.barQuest.hidden && ui.barGarden.hidden"), 'bag': await ev("!document.getElementById('q-bag').hidden")})
        rec('errors', errors); await browser.close()
    R = RESULTS
    finish([
        ('the garden is shut before the seventh quest', R['locked']['no card'] and R['locked']['scene'] == 'home'),
        ('the seventh quest opens it', R['unlock'] == ['garden']),
        ('an older save gets an empty garden', '"beds":{}' in R['old save'] and '"seeds":{}' in R['old save']),
        ('a sleeping Glimmerkin stays at the nest', R['enter']['asleep stays'] == 'home'),
        ('Where to? has the garden, and it leads in', 'The garden' in R['enter']['card'] and R['enter']['scene'] == 'garden' and R['enter']['bar'] and 'garden' in R['enter']['name']),
        ('the first visit brings one seed of each kind', sorted(R['enter']['seeds'].values()) == [1] * 6 and 'six seeds' in R['enter']['toast']),
        ('the party walks in too', R['enter']['party'] == 1),
        ('a tap walks there', [R['walk']['to']['x'], R['walk']['to']['y']] == R['walk']['want']),
        ('a tap on a hedge goes nowhere', R['walk']['hedge'] and R['walk']['after hedge'] == R['walk']['to'] and R['walk']['moving'] == 0),
        ('a seed is planted in the soil tapped', R['plant']['sheet'] and R['plant']['bed']['el'] == 'ember' and R['plant']['bed']['st'] == 0 and R['plant']['left'] == 0),
        ('a little of its kind tends it and learns', R['tend']['bed'] == {'t': True, 'gl': True, 'xp': R['tend']['xp0'] + 1, 'tend': 1} and 'warms the soil' in R['tend']['toast']),
        ('a growing flower says how long is left', 'growing' in R['tend']['growing'] and 'minute' in R['tend']['growing']),
        ('it grows a stage after each tend', R['grow']['sprout'] == 1 and R['grow']['bud'] == 2 and R['grow']['bloom']['st'] == 3),
        ('it blooms glimmering and is counted', R['grow']['bloom']['gl'] and R['grow']['grown'] == {'ember': 1} and R['grow']['glim'] == {'ember': True} and R['grow']['flowers'] == 1 and '1 in bloom' in R['grow']['count']),
        ('three tends a day teach a little', R['tend cap']['tended'] and R['tend cap']['after'] == R['tend cap']['before']),
        ('with no little of its kind the player is asked', R['pet tends']['asks'] and R['pet tends']['left'] == 0),
        ('tended by the Glimmerkin it grows without glimmer', R['pet tends']['bed']['t'] > 0 and R['pet tends']['bed']['gl'] is False),
        ('a little at home helps after an hour, not before', R['helper']['early'] == 0 and R['helper']['helped'] == {'t': True, 'gl': True, 'who': ['gale']}),
        ('a flower left for six hours has bloomed', R['helper']['six hours away'] == {'st': 3, 'gl': True}),
        ('sniffing lifts Joy once', R['bloom']['sheet'] and [round(j) for j in R['bloom']['joy']] == [52, 52]),
        ('picking gives two seeds and frees the soil', R['bloom']['bed'] is None and R['bloom']['seeds'] == 2 and R['bloom']['picked'] == 1),
        ('the bar shows the seeds', R['leave']['tray']),
        ('Back to the nest goes home', R['leave']['home'] == {'scene': 'home', 'bar': True, 'hud': True, 'bag': True}),
        ('the journal counts the flowers', R['leave']['journal']),
        ('the garden is saved and is the same on return', R['leave']['saved'] and R['leave']['again']['beds'] == 3),
        ('the gate leads home', R['leave']['gate'] == 'home'),
        ('a quest starts as before', R['quest after'] == {'scene': 'quest', 'bar': True, 'bag': True}),
        ('no errors on the page', R['errors'] == []),
    ])
asyncio.run(main())
