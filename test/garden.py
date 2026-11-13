# Drives the garden in a phone-sized headless browser: the way in from Where to?, walking, planting a seed, tending
# it with a little of its kind and without one, growing through its stages, littles helping while the player is
# away, sniffing and picking a bloom, the journal, the way back to the nest, and the hidden places: opening each
# kind, what each holds, and the garden map. Then crosses: pollen between neighbours, crossed seeds, moving a bloom
# and the flower book.
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
        rec('leave', {'tray': 'Seeds' in tray and 'Emberflare' in tray, 'home': home, 'journal': 'The flower book · 2 of 21' in journal and 'Emberflare' in journal, 'saved': saved, 'again': again, 'gate': await ev("scene")})
        # hidden places: shut they are hedge; each opens its own way, for good, and holds what it should
        await ev("(() => { delete S.garden.open; delete S.garden.wild; delete S.garden.pods; afterLoad(); const r = RNG(8); S.littles.push(newLittle('stone', r)); S.party = [S.littles[1].id]; S.garden.seeds.glow = 2; closeSheet(); enterGarden(); GA.night = 0; })()"); await page.wait_for_timeout(300)
        HIDES = "GA.M.hides.map((h, i) => ({i, kind: h.kind, ob: h.ob || '', el: h.el || '', prize: h.prize, door: h.door, at: h.at, thing: h.thing || null, beds: h.beds, mid: {x: h.x0 + 1, y: h.y0 + 1}, by: h.ob ? OBST[h.ob].by : '', season: h.season || ''}))"
        hides = await ev(HIDES); hud0 = await ev("document.getElementById('q-biome').textContent"); shut0 = await ev("GA.shut.size")
        await page.click('[data-g="map"]'); await page.wait_for_timeout(250); map0 = await ev(SHEET); await page.screenshot(path=SHOTS + '/g6_map_none.png'); await ev("closeSheet()")
        h0 = hides[0]; await go_near(h0['at']['x'], h0['at']['y']); await ev("(([x, y]) => { const V = gardenView(); gardenTap({x: (x + 0.5 - V.ox) * V.ts, y: V.top + (y + 0.5 - V.oy) * V.ts}); })", [h0['mid']['x'], h0['mid']['y']])
        inside = await ev("({path: GA.path.length, act: GA.act})")
        async def tap_door(h, wait=350):
            await go_near(h['door']['x'], h['door']['y']); await tap(h['door']['x'], h['door']['y'], 150); await settle(); await page.wait_for_timeout(wait)
        async def reenter(party_kind):
            await ev("(k => { leaveGarden(); S.party = S.littles.filter(l => l.kind === k).map(l => l.id).slice(0, 1); enterGarden(); GA.night = 0; })", party_kind); await page.wait_for_timeout(300)
        opened = []; shots = 0
        for h in hides:
            o = {'kind': h['kind'], 'prize': h['prize']}
            if h['kind'] == 'over':
                await reenter('gale'); await tap_door(h); o['refused'] = await ev(TOAST); o['still shut'] = await ev("!S.garden.open[%d]" % h['i'])
                await reenter(h['by']); await tap_door(h)
            elif h['kind'] == 'lock':
                await ev("Object.keys(S.garden.beds).forEach(k => { if (S.garden.beds[k].el === '%s') delete S.garden.beds[k]; })" % h['el'])
                await tap_door(h); o['refused'] = await ev(TOAST); o['still shut'] = await ev("!S.garden.open[%d]" % h['i'])
                await ev("S.garden.beds[9] = {el: '%s', st: 3, t: 0, w: Date.now(), gl: false}" % h['el']); await page.wait_for_timeout(700); await tap_door(h)
            elif h['kind'] == 'night':
                await ev("GA.night = 0"); await tap_door(h); o['refused'] = await ev(TOAST); o['still shut'] = await ev("!S.garden.open[%d]" % h['i'])
                await ev("GA.night = 1"); await page.wait_for_timeout(700); await page.screenshot(path=SHOTS + '/g7_moon_gate.png'); await tap_door(h); await ev("GA.night = 0")
            elif h['kind'] == 'season':
                other = 'summer' if h['season'] != 'summer' else 'winter'
                await ev("seasonNow = () => '%s'" % other); await tap_door(h); o['refused'] = await ev(TOAST); o['still shut'] = await ev("!S.garden.open[%d]" % h['i'])
                await ev("seasonNow = () => '%s'" % h['season']); await page.wait_for_timeout(700); await page.screenshot(path=SHOTS + '/g7_season_arch.png'); await tap_door(h); o['season'] = h['season']
            else:
                await tap_door(h)
            o['toast'] = await ev(TOAST); o['open'] = await ev("S.garden.open[%d] === 1 && GA.M.rows[%d][%d] === ','" % (h['i'], h['door']['y'], h['door']['x']))
            await page.screenshot(path=SHOTS + '/g7_found_%d.png' % h['i'])
            await go_near(h['mid']['x'], h['mid']['y']); await tap(h['mid']['x'], h['mid']['y'] + 1, 150); await settle(); o['walked in'] = await ev("GA.at") == {'x': h['mid']['x'], 'y': h['mid']['y'] + 1}
            await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/g8_inside_%d.png' % h['i'])
            if h['prize'] in ('wild', 'pod'):
                n0 = await ev("Object.values(S.garden.seeds).reduce((a, b) => a + b, 0)"); t = h['thing']
                await tap(t['x'], t['y'], 150); await settle(); await page.wait_for_timeout(250); o['first'] = await ev(TOAST); n1 = await ev("Object.values(S.garden.seeds).reduce((a, b) => a + b, 0)")
                await tap(t['x'], t['y'], 150); await settle(); await page.wait_for_timeout(250); o['second'] = await ev(TOAST); n2 = await ev("Object.values(S.garden.seeds).reduce((a, b) => a + b, 0)")
                await ev("if (S.garden.wild[%d] !== undefined) S.garden.wild[%d] -= GROUNDS.WILD_DAYS" % (h['i'], h['i']))
                await tap(t['x'], t['y'], 150); await settle(); await page.wait_for_timeout(250); n3 = await ev("Object.values(S.garden.seeds).reduce((a, b) => a + b, 0)"); o['seeds'] = [n1 - n0, n2 - n1, n3 - n2]
            elif h['prize'] == 'rich':
                b = h['beds'][0]; await tap_bed(b); await page.click('[data-do="plant"][data-el="glow"]'); await page.wait_for_timeout(250); o['planted'] = await ev(TOAST)
                await tap_bed(b); o['ask'] = await ev(SHEET); await page.click('[data-do="go"]'); await page.wait_for_timeout(250); o['bed'] = await ev("S.garden.beds[%d]" % b)
            else:
                await tap_bed(h['beds'][0]); o['sheet'] = await ev(SHEET); await ev("closeSheet()"); o['beds'] = h['beds']
            opened.append(o); print('hidden', o)
        await page.click('[data-g="map"]'); await page.wait_for_timeout(250); map4 = await ev(SHEET); canvas = await ev("(() => { const k = ui.sheet.querySelector('canvas[data-ic=gmap]'); return !!k && k.width > 100 && k.height > 100; })()"); await page.screenshot(path=SHOTS + '/g9_map_all.png'); await ev("closeSheet()")
        hud4 = await ev("document.getElementById('q-biome').textContent"); await ev("leaveGarden()")
        journal2 = await ev("(() => { openJournal(); const t = ui.sheet.textContent; closeSheet(); return t; })()")
        kept = await ev("(() => { const d = JSON.parse(localStorage.getItem('glimmerkin.v1')); enterGarden(); const r = {saved: Object.keys(d.garden.open).length, shut: GA.shut.size, doors: GA.M.hides.every(h => GA.M.rows[h.door.y][h.door.x] === ',')}; leaveGarden(); return r; })()")
        rec('hidden', {'hides': len(hides), 'hud': [hud0, hud4], 'shut': shut0, 'map': ['0 of 6 found' in map0 and 'Cloud' in map0, '6 of 6 found' in map4 and 'Every one is found' in map4 and canvas], 'inside': inside, 'journal': 'Hidden places found: 6 of 36' in journal2, 'kept': kept})
        RESULTS['opened'] = opened
        # crosses: two blooms side by side make a seed, within the hour with a Gale little and in a day without
        H = 3600000
        await ev("(() => { S.garden.beds = {}; S.garden.pairs = {}; S.garden.seeds = {}; S.j.crossed = 0; S.littles = S.littles.filter(l => l.kind !== 'gale'); S.party = [S.littles.find(l => l.kind === 'ember').id]; enterGarden(); GA.night = 0; })()"); await page.wait_for_timeout(300)
        pairs = await ev("bedPairs()")
        BLOOM = "(([i, el, ago]) => { S.garden.beds[i] = {el, st: 3, t: 0, w: Date.now() - ago, gl: true}; })"
        await ev(BLOOM, [0, 'ember', 2 * H]); await ev(BLOOM, [1, 'tide', 2 * H])
        slow = await ev("({made: growBeds(Date.now()).crossed.length, seeds: S.garden.seeds})"); await tap_bed(0); note_slow = await ev(SHEET); await page.screenshot(path=SHOTS + '/g10_cross.png'); await ev("closeSheet()")
        await ev(BLOOM, [0, 'ember', 25 * H]); await ev(BLOOM, [1, 'tide', 25 * H]); breeze = await ev("({made: growBeds(Date.now()).crossed, seeds: S.garden.seeds['ember+tide'], again: growBeds(Date.now()).crossed.length})")
        await ev("(() => { S.garden.pairs = {}; S.garden.seeds = {}; S.littles.push(newLittle('gale', RNG(3))); })()"); await ev(BLOOM, [0, 'ember', 2 * H]); await ev(BLOOM, [1, 'tide', 2 * H])
        await page.wait_for_timeout(1300); live = await ev(TOAST)
        gale = await ev("({seeds: S.garden.seeds['ember+tide'], counted: S.j.crossed, pair: S.garden.pairs['0:1'] > 0, again: growBeds(Date.now()).crossed.length})")
        await tap_bed(0); note_fast = await ev(SHEET); await ev("closeSheet()")
        await ev(BLOOM, [6, 'stone', 2 * H]); await ev(BLOOM, [7, 'stone', 2 * H]); same = await ev("({made: growBeds(Date.now()).crossed.map(x => x.id), seeds: S.garden.seeds.stone})")
        await ev("S.garden.pairs = {}"); await ev(BLOOM, [1, 'ember+tide', 2 * H]); mixed = await ev("growBeds(Date.now()).crossed.filter(x => x.id !== 'stone').length"); await tap_bed(0); note_no = await ev(SHEET); await ev("closeSheet()")
        rec('cross', {'pairs': pairs, 'slow': slow, 'note slow': note_slow, 'breeze': breeze, 'live': live, 'gale': gale, 'note fast': note_fast, 'same': same, 'mixed': mixed, 'note no': note_no})
        # a crossed seed is planted like any other, and needs its two kinds in turn
        await tap_bed(8); tray2 = await ev(SHEET); await page.click('[data-do="plant"][data-el="ember+tide"]'); await page.wait_for_timeout(250)
        await tap_bed(8); turn1 = await ev("({t: S.garden.beds[8].t > 0, gl: S.garden.beds[8].gl})"); toast1 = await ev(TOAST); await ev(AGE); await page.wait_for_timeout(1300)
        await tap_bed(8); ask2 = await ev(SHEET); await page.click('[data-do="go"]'); await page.wait_for_timeout(250)
        rec('cross seed', {'tray': tray2, 'bed': await ev("S.garden.beds[8]"), 'turn1': turn1, 'toast1': toast1, 'ask2': ask2})
        # moving a bloom: lift it, a taken patch is refused, its own patch puts it back, an empty one takes it
        await tap_bed(0); await page.click('[data-do="move"]'); await page.wait_for_timeout(250); lifted = await ev("GA.carry && GA.carry.from"); hint = await ev("document.getElementById('q-hint').textContent")
        await page.screenshot(path=SHOTS + '/g11_carry.png')
        s1 = await ev("GA.M.soils[1]"); await tap(s1['x'], s1['y'], 300); taken = await ev(TOAST); still = await ev("GA.carry && GA.carry.from")
        s0 = await ev("GA.M.soils[0]"); await tap(s0['x'], s0['y'], 300); back = await ev("({carry: GA.carry || null, bed: !!S.garden.beds[0], toast: document.getElementById('toast').textContent})")
        await tap_bed(0); await page.click('[data-do="move"]'); await page.wait_for_timeout(250); await tap_bed(5); await page.wait_for_timeout(300)
        rec('move', {'lifted': lifted, 'hint': hint, 'taken': taken, 'still': still, 'back': back, 'moved': await ev("({from: S.garden.beds[0] || null, to: S.garden.beds[5].el, st: S.garden.beds[5].st, carry: GA.carry || null})"), 'toast': await ev(TOAST)})
        # lilies: a Glow little's light for the last step, a bud that waits for dark, and blooms that fold by the hour
        lily = await ev("(() => { const at = (h, st) => { const b = {el: 'ember+glow', st, t: new Date(2026, 5, 10, h, 0).getTime()}; return {h: new Date(bedDue(b)).getHours(), late: waitsForDark(b)}; }; const now = Date.now(), day = !isNightHour(new Date(now + GROUNDS.GROW).getHours()); "
                        "S.garden.beds[9] = {el: 'glow', st: 2, t: now - 26 * 3600000, w: 0, gl: true}; S.garden.beds[4] = {el: 'glow', st: 2, t: now, w: 0, gl: true}; S.garden.beds[3] = {el: 'ember', st: 2, t: now - GROUNDS.GROW - 1000, w: 0, gl: true}; growBeds(now + GROUNDS.GROW + 1000); "
                        "const r = {need: [0, 1, 2].map(st => flowerNeed('ember+glow', st)), noon: at(12, 2), evening: at(22, 2), sprout: at(12, 1), plain: (() => { const b = {el: 'ember', st: 2, t: new Date(2026, 5, 10, 12, 0).getTime()}; return waitsForDark(b); })(), "
                        "old: S.garden.beds[9].st, fresh: S.garden.beds[4].st === (day ? 2 : 3), ember: S.garden.beds[3].st, text: seedNeeds('glow')}; GA.night = 1; r.night = [bloomOpen('glow'), bloomOpen('tide+glow'), bloomOpen('ember')]; GA.night = 0; r.day = [bloomOpen('glow'), bloomOpen('ember')]; delete S.garden.beds[4]; return r; })()")
        await ev("GA.night = 1"); await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/g12_night.png'); await ev("GA.night = 0")
        rec('lily', lily)
        await ev("(() => { S.garden.grown['ember+tide'] = 1; leaveGarden(); })()")
        book = await ev("(() => { openJournal(); const t = ui.sheet.textContent, n = ui.sheet.querySelectorAll('canvas[data-ic^=\"flower:\"]').length; closeSheet(); return {t, n}; })()")
        rec('book', {'title': 'The flower book · ' in book['t'], 'cross': 'Embercup' in book['t'], 'cells': book['n']})
        # quarters: the far gate is shut until its region's heart is beaten, and each quarter keeps its own beds and finds
        await ev("(() => { S.reg = {i: 0, n: 0, built: []}; S.garden.beds = {}; S.garden.pairs = {}; S.garden.seeds = {ember: 2}; delete S.garden.more; afterLoad(); enterGarden(); GA.night = 0; })()"); await page.wait_for_timeout(300)
        far = await ev("({far: GA.M.far, at: GA.M.farAt, more: JSON.stringify(S.garden.more)})")
        async def tap_far(wait=400):
            f = await ev("GA.M.far"); await go_near(f['x'], f['y']); await tap(f['x'], f['y'], 150); await settle(); await page.wait_for_timeout(wait)
        await tap_far(); await page.screenshot(path=SHOTS + '/g13_far_shut.png'); shut_gate = await ev("({q: GA.q, toast: document.getElementById('toast').textContent})")
        await ev("S.reg.i = 2"); await page.wait_for_timeout(200); await tap_far()
        q1 = await ev("({q: GA.q, name: document.getElementById('q-name').textContent, hud: document.getElementById('q-biome').textContent, start: GA.at.x === GA.M.start.x && GA.at.y === GA.M.start.y, shut: GA.shut.size, toast: document.getElementById('toast').textContent, other: GA.M.rows.join('') !== gardenMap(0).rows.join('')})")
        await ev("GA.night = 0"); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/g14_ember_quarter.png')
        await tap_bed(0); await page.click('[data-do="plant"][data-el="ember"]'); await page.wait_for_timeout(250)
        planted = await ev("({there: S.garden.more[1].beds[0].el, here: Object.keys(S.garden.beds).length})")
        await page.click('[data-g="map"]'); await page.wait_for_timeout(250); qmap = await ev(SHEET); await ev("closeSheet()")
        await tap_far(); next_shut = await ev("({q: GA.q, toast: document.getElementById('toast').textContent})")
        g1 = await ev("GA.M.gate"); await go_near(g1['x'], g1['y'] - 1); await tap(g1['x'], g1['y'], 200); await settle(); await page.wait_for_timeout(300)
        back = await ev("({q: GA.q, scene, at: GA.at.x === GA.M.farAt.x && GA.at.y === GA.M.farAt.y, name: document.getElementById('q-name').textContent})")
        grows = await ev("(() => { const b = S.garden.more[1].beds[0]; b.t = Date.now() - GROUNDS.GROW - 1000; growBeds(Date.now()); const st = b.st; b.st = 3; b.t = 0; return {st, bloom: inBloom(), card: gardenCard().includes('1 in bloom')}; })()")
        last = await ev("(() => { S.reg.i = 6; goQuarter(5, false); const f = GA.M.far, V = gardenView(); GA.at = {x: GA.M.farAt.x, y: GA.M.farAt.y}; GA.px = GA.at.x; GA.py = GA.at.y; const V2 = gardenView(); gardenTap({x: (f.x + 0.5 - V2.ox) * V2.ts, y: V2.top + (f.y + 0.5 - V2.oy) * V2.ts}); return {q: GA.q, act: GA.act, name: document.getElementById('q-name').textContent}; })()")
        await ev("GA.night = 0"); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/g15_stone_quarter.png')
        line = await ev("(() => { const q0 = S.quests; S.quests = 99; S.reg = {i: 1, n: 3, built: []}; const a = journeyAfter({B: BIOMES[1], region: true}, true); S.reg = {i: 0, n: 3, built: []}; const b = journeyAfter({B: BIOMES[0], region: true}, true); S.quests = q0; S.reg = {i: 2, n: 0, built: []}; return {ember: a.join(' '), moss: b.join(' ')}; })()")
        saved2 = await ev("(() => { leaveGarden(); const d = JSON.parse(localStorage.getItem('glimmerkin.v1')); return !!(d.garden.more && d.garden.more[1] && d.garden.more[1].beds[0]); })()")
        rec('quarters', {'far': far, 'shut': shut_gate, 'q1': q1, 'planted': planted, 'map': 'Emberfall quarter' in qmap, 'next': next_shut, 'back': back, 'grows': grows, 'last': last, 'line': line, 'saved': saved2})
        # the vase: a picked flower stands at the nest for a day, three at most
        v0 = await ev("(() => { S.garden.vase = []; S.reg.i = 0; enterGarden(); ['ember', 'tide', 'stone+bloom'].forEach((el, i) => { S.garden.beds[i] = {el, st: 3, t: 0, w: Date.now(), gl: i === 2}; }); return S.garden.vase.length; })()")
        picks = []
        for i in range(3):
            await tap_bed(i); await page.click('[data-do="pick"]'); await page.wait_for_timeout(250); picks.append(await ev("document.getElementById('toast').textContent"))
        v3 = await ev("S.garden.vase.map(f => [f.el, f.gl])")
        await ev("S.garden.beds[0] = {el: 'gale', st: 3, t: 0, w: Date.now(), gl: false}"); await tap_bed(0); await page.click('[data-do="pick"]'); await page.wait_for_timeout(250)
        v4 = await ev("({els: S.garden.vase.map(f => f.el), toast: document.getElementById('toast').textContent})")
        await ev("leaveGarden()"); await page.wait_for_function("scene === 'home' && !!home.vasePos"); await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/g16_vase.png')
        vp = await ev("home.vasePos"); await page.mouse.click(vp['x'], vp['y']); await page.wait_for_timeout(300); vsheet = await ev(SHEET)
        await page.click('[data-do="out"][data-i="0"]'); await page.wait_for_timeout(250); vout = await ev("({els: S.garden.vase.map(f => f.el), sheet: document.getElementById('sheet').textContent})"); await ev("closeSheet()")
        vday = await ev("(() => { S.garden.vase[0].at -= 25 * 3600000; S.garden.vase[1].at -= 23 * 3600000; const els = vaseNow().map(f => f.el); S.garden.vase = []; const shown = vaseShown(); const old = JSON.parse(JSON.stringify(S)); delete old.garden.vase; S.garden = old.garden; return {els, shown, old: ensureGarden().vase}; })()")
        rec('vase', {'start': v0, 'picks': picks, 'three': v3, 'four': v4, 'sheet': vsheet, 'out': vout, 'day': vday})
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
        ('a garden has six hidden places, all shut at first', R['hidden']['hides'] == 6 and R['hidden']['shut'] == 54 and R['hidden']['hud'][0] == 'Hidden places 0 of 6'),
        ('a hidden place not yet found cannot be tapped', R['hidden']['inside'] == {'path': 0, 'act': None}),
        ('the map counts them and clouds those not found', R['hidden']['map'] == [True, True]),
        ('every hidden place opens and can be walked into', all(o['open'] and o['walked in'] and 'A hidden place!' in o['toast'] for o in R['opened'])),
        ('overgrown needs a little of the right kind in the party', all(o['still shut'] and 'could clear the way' in o['refused'] and 'for good' in o['toast'] for o in R['opened'] if o['kind'] == 'over')),
        ('a flower lock opens only while its flower blooms', all(o['still shut'] and 'in bloom in the garden' in o['refused'] and 'swings open' in o['toast'] for o in R['opened'] if o['kind'] == 'lock')),
        ('vines are walked through', all('only look solid' in o['toast'] for o in R['opened'] if o['kind'] == 'vines')),
        ('a wild flower gives a seed every three days', [o['seeds'] for o in R['opened'] if o['prize'] == 'wild'] == [[1, 0, 1]] * 2 and all('no seed to spare' in o['second'] for o in R['opened'] if o['prize'] == 'wild')),
        ('the seed pod gives three seeds once', [o['seeds'] for o in R['opened'] if o['prize'] == 'pod'] == [[3, 0, 0]] and all('empty' in o['second'] for o in R['opened'] if o['prize'] == 'pod')),
        ('rich soil glimmers whoever tends it', all('rich soil' in o['planted'] and 'still glimmer' in o['ask'] and o['bed']['gl'] is True and o['bed']['t'] > 0 for o in R['opened'] if o['prize'] == 'rich') and sum(o['prize'] == 'rich' for o in R['opened']) == 1),
        ('a hidden place can hold two more beds', all('Plant a seed' in o['sheet'] and len(o['beds']) == 2 for o in R['opened'] if o['prize'] == 'beds') and sum(o['prize'] == 'beds' for o in R['opened']) == 2),
        ('the moonflower gate opens only after dark', [('shut tight' in o['refused'] and o['still shut'] and 'moonflowers are open' in o['toast']) for o in R['opened'] if o['kind'] == 'night'] == [True]),
        ('the season arch opens only in its season', [('bare twigs' in o['refused'] and o['still shut'] and 'is awake' in o['toast']) for o in R['opened'] if o['kind'] == 'season'] == [True]),
        ('found places are counted, saved and stay open', R['hidden']['hud'][1] == 'Hidden places 6 of 6' and R['hidden']['journal'] and R['hidden']['kept'] == {'saved': 6, 'shut': 0, 'doors': True}),
        ('beds side by side are paired', [0, 1] in R['cross']['pairs'] and [6, 7] in R['cross']['pairs'] and [2, 3] not in R['cross']['pairs']),
        ('without a Gale little a cross takes a day', R['cross']['slow'] == {'made': 0, 'seeds': {}} and R['cross']['breeze']['made'] == [{'id': 'ember+tide', 'a': 'ember', 'b': 'tide'}] and R['cross']['breeze']['seeds'] == 1 and R['cross']['breeze']['again'] == 0),
        ('a bloom says what it is crossing with', 'Pollen is drifting' in R['cross']['note slow'] and 'Dewcup' in R['cross']['note slow'] and 'seed of a new flower' in R['cross']['note slow'] and 'Gale little would' in R['cross']['note slow'] and 'Embercup seed' in R['cross']['note fast']),
        ('with a Gale little it takes an hour, and says so', R['cross']['gale'] == {'seeds': 1, 'counted': 2, 'pair': True, 'again': 0} and 'have crossed' in R['cross']['live'] and 'Embercup' in R['cross']['live']),
        ('two of a kind make a seed of that kind', R['cross']['same'] == {'made': ['stone'], 'seeds': 1}),
        ('a crossed flower does not cross again', R['cross']['mixed'] == 0 and 'will not cross' in R['cross']['note no']),
        ('a crossed seed is planted from the tray', 'Embercup' in R['cross seed']['tray'] and 'A cross' in R['cross seed']['tray'] and R['cross seed']['bed']['el'] == 'ember+tide'),
        ('a cross needs its two kinds in turn', R['cross seed']['turn1'] == {'t': True, 'gl': True} and 'warms the soil' in R['cross seed']['toast1'] and 'needs a Tide little this time' in R['cross seed']['ask2'] and R['cross seed']['bed']['st'] == 1 and R['cross seed']['bed']['gl'] is False),
        ('a bloom is lifted and can be put back', R['move']['lifted'] == 0 and 'set the Emberflare down' in R['move']['hint'] and 'taken' in R['move']['taken'] and R['move']['still'] == 0 and R['move']['back']['carry'] is None and R['move']['back']['bed'] and 'puts it back' in R['move']['back']['toast']),
        ('a bloom is moved to an empty patch and stays in bloom', R['move']['moved'] == {'from': None, 'to': 'ember', 'st': 3, 'carry': None} and 'sets the Emberflare down' in R['move']['toast']),
        ('a lily needs a Glow little last, and its bud waits for dark', R['lily']['need'] == ['ember', 'glow', 'glow'] and R['lily']['noon'] == {'h': 20, 'late': True} and R['lily']['evening'] == {'h': 22, 'late': False} and R['lily']['sprout'] == {'h': 12, 'late': False} and R['lily']['plain'] is False and 'after dark' in R['lily']['text']),
        ('a lily bud tended yesterday has opened, and one tended now keeps to the clock', R['lily']['old'] == 3 and R['lily']['fresh'] and R['lily']['ember'] == 3),
        ('lilies open at night and other flowers by day', R['lily']['night'] == [True, True, False] and R['lily']['day'] == [False, True]),
        ('the flower book shows all 21', R['book'] == {'title': True, 'cross': True, 'cells': 21}),
        ('every garden has a far gate, shut until its heart is beaten', R['quarters']['far']['far'] is not None and R['quarters']['far']['more'] == '{}' and R['quarters']['shut']['q'] == 0 and 'heart of Emberfall' in R['quarters']['shut']['toast']),
        ('the far gate leads to the next quarter, a garden of its own', R['quarters']['q1']['q'] == 1 and R['quarters']['q1']['name'] == 'Emberfall quarter' and R['quarters']['q1']['hud'] == 'Hidden places 0 of 6' and R['quarters']['q1']['start'] and R['quarters']['q1']['shut'] == 54 and R['quarters']['q1']['other'] and R['quarters']['map']),
        ('a quarter keeps its own beds', R['quarters']['planted'] == {'there': 'ember', 'here': 0} and R['quarters']['saved']),
        ('the quarter beyond is shut in its turn', R['quarters']['next']['q'] == 1 and 'heart of Tidehollow' in R['quarters']['next']['toast']),
        ('a quarter\'s gate leads back to the one before', R['quarters']['back'] == {'q': 0, 'scene': 'garden', 'at': True, 'name': R['enter']['name']}),
        ('flowers grow in every quarter and are counted', R['quarters']['grows'] == {'st': 1, 'bloom': 1, 'card': True}),
        ('the last quarter has no far gate', R['quarters']['last'] == {'q': 5, 'act': None, 'name': 'Stonesong quarter'}),
        ('beating a heart says its quarter has opened', 'Emberfall quarter of the garden has opened' in R['quarters']['line']['ember'] and 'quarter' not in R['quarters']['line']['moss']),
        ('a quest starts as before', R['quest after'] == {'scene': 'quest', 'bar': True, 'bag': True}),
        ('no errors on the page', R['errors'] == []),
        ('a picked flower goes in the vase at the nest', R['vase']['start'] == 0 and R['vase']['three'] == [['ember', False], ['tide', False], ['stone+bloom', True]] and all('vase at the nest' in t for t in R['vase']['picks'])),
        ('a fourth flower takes the place of the oldest', R['vase']['four']['els'] == ['tide', 'stone+bloom', 'gale'] and 'Emberflare makes way' in R['vase']['four']['toast']),
        ('a tap on the vase lists what is in it', 'The vase' in R['vase']['sheet'] and 'Fresh for 24 more hours' in R['vase']['sheet'] and 'glimmering' in R['vase']['sheet']),
        ('a flower can be taken out of the vase', R['vase']['out']['els'] == ['stone+bloom', 'gale'] and 'Take it out' in R['vase']['out']['sheet']),
        ('a flower leaves the vase after a day, and an older save gets an empty vase', R['vase']['day'] == {'els': ['gale'], 'shown': True, 'old': []}),
    ])
asyncio.run(main())
