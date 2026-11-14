# Drives play in the garden in a phone-sized headless browser: littles wandering off to play by kind when the
# Glimmerkin stands still, walking calling them back, a tap on a little, a tree, the pond, the bench and the bird
# bath, the Joy it gives and how often, and that none of it is saved. Then hide and seek: hiding, clues, finding,
# the reward, calling them out. Then visitors: who comes and when, the same for the hour, watching one, the book.
# Then flower crowns: weaving the vase's flowers, the hat it replaces, pictures, wilting, and a Mythic's head.
import os, pathlib, tempfile, asyncio, json
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
PLAYS = "GA.lits.map(f => f.play ? {kind: f.play.kind, there: !f.play.path.length, bench: !!f.play.bench, night: !!f.play.night, x: Math.round(f.x), y: Math.round(f.y)} : null)"
# Stands the Glimmerkin on tile (x, y) with the party around it, as if it had walked there.
PUT = "(([x, y]) => { closeSheet(); GA.px = x; GA.py = y; GA.at = {x, y}; GA.path = []; GA.act = null; GA.sit = undefined; GA.trail = []; for (let i = 0; i < 90; i++) GA.trail.push({x, y}); GA.lits.forEach(f => { f.x = x; f.y = y; f.play = null; f.busy = 0; }); GA.still = 0; })"
# A walkable tile beside something, and the thing: the first found in reading order.
NEAR = "(([what]) => { const M = GA.M; for (let y = 1; y < M.H - 1; y++) for (let x = 1; x < M.W - 1; x++) { if (!groundsWalk(M, x, y) || GA.shut.has(y * M.W + x)) continue; for (const [dx, dy] of DIRS) if (M.rows[y + dy][x + dx] === what) return {x, y, tx: x + dx, ty: y + dy}; } return null; })"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(**LAUNCH)
        page = await browser.new_page(viewport={'width': 390, 'height': 760})
        errors = []; page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.add_init_script(SEED_JS); await page.goto(PAGE); await page.wait_for_timeout(900); ev = page.evaluate
        stage = await (await page.query_selector('#stage')).bounding_box()
        async def click(pt, wait=300):
            await page.mouse.click(stage['x'] + pt[0], stage['y'] + pt[1]); await page.wait_for_timeout(wait)
        async def tap(x, y, wait=300):
            await click(await ev("(([x, y]) => { const V = gardenView(); return [(x + 0.5 - V.ox) * V.ts, V.top + (y + 0.5 - V.oy) * V.ts]; })", [x, y]), wait)
        async def settle():
            for _ in range(60):
                if not await ev("GA && (GA.path.length || GA.act)"): return
                await page.wait_for_timeout(150)
        async def play_now(wait=1600):
            await ev("GA.still = 30"); await page.wait_for_timeout(wait)

        await ev("""(() => { closeSheet(); S.pet.asleep = false; S.quests = 12; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V;
          const r = RNG(5); S.littles = [newLittle('tide', r), newLittle('gale', r), newLittle('ember', r), newLittle('stone', r), newLittle('bloom', r), newLittle('glow', r)];
          ['Pip', 'Wisp', 'Cinder', 'Pebble', 'Moss', 'Gleam'].forEach((n, i) => S.littles[i].name = n); S.party = S.littles.slice(0, 3).map(l => l.id);
          const g = ensureGarden(); g.gift = true; enterGarden(); GA.night = 0; closeSheet(); })()""")
        pond = rec('pond', await ev(NEAR, ['~']))
        tree = rec('tree', await ev(NEAR, ['T']))

        # standing still by the pond: Pip jumps in, Wisp chases petals, Cinder dozes off; none of it before a moment has passed
        await ev(PUT, [pond['x'], pond['y']]); await page.wait_for_timeout(600); early = await ev(PLAYS)
        await play_now(); plays = await ev(PLAYS); await page.screenshot(path=SHOTS + '/gp1_play.png')
        rec('play', {'early': early, 'plays': plays})
        # walking calls them back into line
        away = await ev("(() => { const M = GA.M, near = GA.lits.map(f => Math.round(f.x) + ',' + Math.round(f.y)); for (let r = 2; r < 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = GA.at.x + dx, y = GA.at.y + dy; if (Math.abs(dx) + Math.abs(dy) === r && groundsWalk(M, x, y) && !GA.shut.has(y * M.W + x) && !near.includes(x + ',' + y)) return {x, y}; } })()")
        await tap(away['x'], away['y'], 100)
        back = await ev(PLAYS); await settle(); rec('walk back', back)

        # a tap on a little: it hops and says so, and Joy goes up once in 25 seconds
        await ev(PUT, [pond['x'], pond['y']]); await play_now()
        swim = await ev("GA.lits.findIndex(f => f.play && f.play.kind === 'swim')")
        await ev("S.pet.joy = 50; GA.playAt = -99")
        pt = await ev("(() => { const f = GA.lits[%d], V = gardenView(); return [(f.x + 0.5 - V.ox) * V.ts, V.top + (f.y + 0.45 - V.oy) * V.ts]; })()" % swim)
        await click(pt); t1 = await ev(TOAST); j1 = await ev("Math.round(S.pet.joy)"); await click(pt); j2 = await ev("Math.round(S.pet.joy)")
        rec('tap little', {'toast': t1, 'joy': [j1, j2], 'still there': await ev("GA.at")})

        # the pond: walk up to it, ripples spread, and a Tide little jumps in
        await ev(PUT, [pond['x'], pond['y']]); await tap(pond['tx'], pond['ty'], 100); await settle(); await page.wait_for_timeout(200)
        rec('pond tap', {'toast': await ev(TOAST), 'ripples': await ev("(GA.rip || []).length"), 'plays': await ev(PLAYS)})
        # without a Tide little, the Glimmerkin dips a toe in
        await ev("S.party = [S.littles[2].id]; walkQuarter(0, false); gardenHud()"); await ev(PUT, [pond['x'], pond['y']]); await tap(pond['tx'], pond['ty'], 100); await settle()
        rec('pond alone', await ev(TOAST))

        # a tree: walk up to it and shake it; things fall, and a Gale little chases them
        await ev("S.party = S.littles.slice(0, 3).map(l => l.id); walkQuarter(0, false); gardenHud()")
        await ev(PUT, [tree['x'], tree['y']]); await ev("GA.playAt = -99; S.pet.joy = 50"); await tap(tree['tx'], tree['ty'], 100); await settle(); await page.wait_for_timeout(250)
        rec('tree', {'toast': await ev(TOAST), 'falling': await ev("(GA.fall || []).length"), 'plays': await ev(PLAYS), 'joy': await ev("Math.round(S.pet.joy)")}); await page.screenshot(path=SHOTS + '/gp2_tree.png')

        # the bench: Cinder dozes on it, the Glimmerkin can sit on it, and walking gets up again
        spot = await ev("(() => { const M = GA.M, s = M.start; for (const [dx, dy] of [[0, -1], [0, -2], [1, -1], [-1, -1]]) { const x = s.x + dx, y = s.y + dy; if ('.,'.includes(M.rows[y][x])) return {x, y}; } })()")
        await ev("(([x, y]) => { const g = ensureGarden(); g.things = {}; g.things[y * GA.M.W + x] = 'bench'; })", [spot['x'], spot['y']])
        await ev(PUT, [spot['x'], spot['y'] - 1 if await ev("(([x, y]) => groundsWalk(GA.M, x, y))", [spot['x'], spot['y'] - 1]) else spot['y']]); await play_now(3200)
        doze = await ev(PLAYS)
        await ev(PUT, [spot['x'], spot['y'] - 1 if await ev("(([x, y]) => groundsWalk(GA.M, x, y))", [spot['x'], spot['y'] - 1]) else spot['y']])
        await tap(spot['x'], spot['y'], 100); await settle(); await page.wait_for_timeout(300); bsheet = await ev(SHEET)
        await page.click('#sheet [data-do="sit"]'); await page.wait_for_timeout(300); sat = await ev("GA.sit"); stoast = await ev(TOAST)
        await page.screenshot(path=SHOTS + '/gp3_bench.png')
        await ev("GA.path = gardenPath(GA.at.x, GA.at.y, (a, b) => Math.abs(a - GA.at.x) + Math.abs(b - GA.at.y) === 1)"); await page.wait_for_timeout(200); up = await ev("GA.sit === undefined")
        rec('bench', {'doze': doze, 'sheet': bsheet, 'sit': sat, 'toast': stoast, 'up': up, 'square': spot['y'] * 25 + spot['x']})
        # the bird bath: a splash
        await settle(); await ev("(([x, y]) => { const g = ensureGarden(); g.things = {}; g.things[y * GA.M.W + x] = 'bath'; })", [spot['x'], spot['y']]); await settle()
        await ev(PUT, [spot['x'], spot['y']]); await ev("openDeco(GA.at.y * GA.M.W + GA.at.x)"); await page.wait_for_timeout(200); bath = await ev(SHEET)
        await page.click('#sheet [data-do="splash"]'); await page.wait_for_timeout(200)
        rec('bath', {'sheet': bath, 'toast': await ev(TOAST)})
        # a lantern post's sheet is as it was
        await ev("ensureGarden().things[GA.at.y * GA.M.W + GA.at.x] = 'lamp'; openDeco(GA.at.y * GA.M.W + GA.at.x)"); await page.wait_for_timeout(200)
        rec('lamp', await ev("[...ui.sheet.querySelectorAll('[data-do]')].map(b => b.dataset.do)")); await ev("closeSheet(); ensureGarden().things = {}")

        # Stone stacks pebbles, Bloom rolls in the grass by a bloom, Glow shines with fireflies after dark
        await ev("(() => { const g = ensureGarden(); g.beds[0] = {el: 'bloom', st: 3, t: 0, w: Date.now(), gl: true}; S.party = S.littles.slice(3, 6).map(l => l.id); walkQuarter(0, false); GA.night = 1; gardenHud(); })()")
        bed = await ev("GA.M.soils[0]"); near = await ev("(([x, y]) => { for (const [dx, dy] of DIRS) if (groundsWalk(GA.M, x + dx, y + dy)) return {x: x + dx, y: y + dy}; })", [bed['x'], bed['y']])
        rec('near', near); await ev(PUT, [near['x'], near['y']]); await play_now(4600); kinds = await ev(PLAYS); await page.screenshot(path=SHOTS + '/gp4_night.png')
        rec('more kinds', kinds)

        # hide and seek: Play on the bar, everyone hides somewhere the Glimmerkin can walk up to
        await ev("(() => { ensureGarden().beds = {}; S.party = S.littles.slice(0, 3).map(l => l.id); S.littles.forEach(l => { delete l.tend; l.xp = 0; }); S.littles[1].tend = {day: localDay(), n: 3}; walkQuarter(0, false); GA.night = 0; gardenHud(); })()")
        await page.click('#bar-garden [data-g="play"]'); await page.wait_for_timeout(250); psheet = await ev(SHEET)
        await page.click('#sheet [data-do="seek"]'); await page.wait_for_timeout(300)
        HID = "GA.lits.map(f => f.hide ? {kind: f.hide.kind, ox: f.hide.ox, oy: f.hide.oy, x: f.hide.x, y: f.hide.y, shut: GA.shut.has(f.hide.oy * GA.M.W + f.hide.ox), way: !!gardenPath(GA.at.x, GA.at.y, (a, b) => a === f.hide.x && b === f.hide.y) || (GA.at.x === f.hide.x && GA.at.y === f.hide.y)} : null)"
        hid = await ev(HID); await ev("GA.still = 30"); await page.wait_for_timeout(600)
        rec('seek start', {'sheet': psheet, 'hid': hid, 'toast': await ev(TOAST), 'name': await ev("document.getElementById('q-name').textContent"), 'count': await ev("document.getElementById('q-biome').textContent"), 'playing': await ev("GA.lits.filter(f => f.play).length")})
        await ev(PUT, [hid[0]['x'], hid[0]['y']]); await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/gp5_seek.png')
        await ev("GA.hunt.t = 45"); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/gp6_peek.png')
        # a tap on the place a little hides walks up to it and finds it
        await tap(hid[0]['ox'], hid[0]['oy'], 100); await settle(); await page.wait_for_timeout(200)
        one = {'toast': await ev(TOAST), 'count': await ev("document.getElementById('q-biome').textContent"), 'hidden': await ev("GA.lits.filter(f => f.hide).length"), 'clock': await ev("GA.hunt.t")}
        rec('seek one', one)
        await ev("S.pet.joy = 50"); xp0 = await ev("S.littles.slice(0, 3).map(l => l.xp || 0)")
        for h in hid[1:]:
            await ev(PUT, [h['x'], h['y']]); await page.wait_for_timeout(150); await tap(h['ox'], h['oy'], 100); await settle(); await page.wait_for_timeout(150)
        rec('seek all', {'toast': await ev(TOAST), 'hunt': await ev("!!GA.hunt"), 'joy': await ev("Math.round(S.pet.joy)"), 'xp': [xp0, await ev("S.littles.slice(0, 3).map(l => l.xp || 0)")], 'name': await ev("document.getElementById('q-name').textContent")})
        # calling them out ends a game, and with no littles there is nobody to play with
        await ev("startSeek()"); await page.click('#bar-garden [data-g="play"]'); await page.wait_for_timeout(250); osheet = await ev(SHEET)
        await page.click('#sheet [data-do="stop"]'); await page.wait_for_timeout(200)
        rec('seek out', {'sheet': osheet, 'hunt': await ev("!!GA.hunt"), 'hidden': await ev("GA.lits.filter(f => f.hide).length"), 'toast': await ev(TOAST)})
        await ev("(() => { window.keepL = S.littles; S.littles = []; S.party = []; walkQuarter(0, false); openPlay(); })()"); await page.wait_for_timeout(200)
        rec('seek none', {'off': await ev("ui.sheet.querySelector('[data-do=seek]').disabled"), 'sheet': await ev(SHEET)})
        await ev("closeSheet(); S.littles = keepL; S.party = S.littles.slice(0, 3).map(l => l.id); walkQuarter(0, false)")

        # visitors: blooms of every kind, a bird bath and a bench, by day
        await ev("""(() => { const g = ensureGarden(); g.seen = {}; g.things = {}; const els = ['ember', 'tide', 'stone', 'bloom', 'gale', 'glow', 'ember+tide', 'bloom', 'tide', 'stone']; for (let i = 0; i < 10; i++) g.beds[i] = {el: els[i], st: 3, t: 0, w: Date.now(), gl: i === 6}; walkQuarter(0, false); GA.night = 0; GA.season = 'summer'; })()""")
        spot = await ev("(() => { const M = GA.M, s = M.start; for (const [dx, dy] of [[0, -1], [0, -2], [1, -1], [-1, -1]]) { const x = s.x + dx, y = s.y + dy; if ('.,'.includes(M.rows[y][x])) return {x, y}; } })()")
        await ev("(([x, y]) => { const g = ensureGarden(); g.things[y * GA.M.W + x] = 'bath'; })", [spot['x'], spot['y']])
        CHK = """(() => { const ok = o => visitAnchors(o.v, GA).some(p => p.x === o.x && p.y === o.y); const day = rollVisitors(GA, 1e12), again = rollVisitors(GA, 1e12 + 1000), later = rollVisitors(GA, 1e12 + 3.7e6);
          const all = VISITORS.filter(v => visitAnchors(v, GA).length).map(v => v.id); const dayFits = day.every(ok); GA.night = 1; const night = rollVisitors(GA, 1e12), nightAll = VISITORS.filter(v => visitAnchors(v, GA).length).map(v => v.id), nightFits = night.every(ok); GA.night = 0;
          const quarters = VISITORS.filter(v => v.q).map(v => [v.q, visitAnchors(v, GA).length]); const keepQ = GA.q; GA.q = S.reg.quarters.indexOf('tidehollow'); const crab = visitAnchors(visitorById('shellcrab'), GA).length; GA.q = keepQ;
          const B = ensureGarden().beds, keep = [B[2], B[9]]; delete B[2]; delete B[9]; const noRainbow = visitAnchors(visitorById('rainbow'), GA).length; B[2] = keep[0]; B[9] = keep[1];
          return {day: day.map(o => o.v.id), again: again.map(o => o.v.id), later: later.map(o => o.v.id), fits: dayFits && nightFits, n: Math.max(day.length, later.length, night.length), all, night: night.map(o => o.v.id), nightAll, quarters, crab, noRainbow, rainbow: all.includes('rainbow')}; })()"""
        rec('visitors', await ev(CHK))
        # watching one: walk up to it, it lands on the Glimmerkin's nose, and goes in the book the first time
        await ev("(([x, y]) => { GA.vis = [{v: visitorById('robin'), x, y, ph: 0, t: 0, watch: 0}, {v: visitorById('dewdrop'), x: GA.M.soils[1].x, y: GA.M.soils[1].y, ph: 0, t: 0, watch: 0}]; })", [spot['x'], spot['y']])
        await ev(PUT, [spot['x'], spot['y'] + 1 if await ev("(([x, y]) => groundsWalk(GA.M, x, y))", [spot['x'], spot['y'] + 1]) else spot['y'] - 1]); await ev("GA.playAt = -99; S.pet.joy = 50")
        async def tap_vis(i):
            pt = await ev("(() => { const o = GA.vis[%d], p = visitorAt(o), V = gardenView(); return [(p.x - V.ox) * V.ts, V.top + (p.y - V.oy) * V.ts]; })()" % i)
            await click(pt, 100); await settle(); await page.wait_for_timeout(200)
        await tap_vis(0); w1 = {'toast': await ev(TOAST), 'seen': await ev("ensureGarden().seen"), 'joy': await ev("Math.round(S.pet.joy)")}
        await page.wait_for_timeout(300); await tap_vis(0); w2 = await ev(TOAST)
        b1 = await ev("GA.M.soils[1]"); await ev(PUT, [b1['x'], b1['y'] - 1 if await ev("(([x, y]) => groundsWalk(GA.M, x, y))", [b1['x'], b1['y'] - 1]) else b1['y'] + 1])
        await tap_vis(1); w3 = {'toast': await ev(TOAST), 'watch': await ev("GA.vis[1].watch > 0"), 'sheet': await ev(SHEET)}
        await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/gp7_visitor.png')
        rec('watch', {'first': w1, 'again': w2, 'flyer': w3})

        # the visitor book in the journal: everyone, watched or with a clue
        await ev("leaveGarden(); openJournal()"); await page.wait_for_timeout(400)
        book = await ev("(() => { const h = [...ui.sheet.querySelectorAll('h3')].find(e => e.textContent.startsWith('The visitor book')); const grid = h && h.nextElementSibling.nextElementSibling; return {title: h && h.textContent, cells: grid ? grid.children.length : 0, known: grid ? [...grid.querySelectorAll('.cell:not(.unk) span')].map(e => e.textContent) : [], clues: grid ? [...grid.querySelectorAll('.cell.unk small')].map(e => e.textContent) : [], counts: grid ? [...grid.querySelectorAll('.cell em')].map(e => e.textContent) : []}; })()")
        await ev("(() => { const h = [...ui.sheet.querySelectorAll('h3')].find(e => e.textContent.startsWith('The visitor book')); if (h) h.scrollIntoView(); })()"); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/gp8_book.png')
        rec('book', book); await ev("closeSheet(); enterGarden(); closeSheet()")

        # flower crowns: woven at the nest from the vase's flowers
        await ev("leaveGarden(); closeSheet(); S.wardrobe = ['explorer']; S.pet.wear = {head: 'explorer', neck: 'scarf'}; const g = ensureGarden(); g.vase = [{el: 'tide', gl: false, at: Date.now() - 3600000}]; refreshLooks(); openVase()")
        await page.wait_for_timeout(200); one = await ev("!!ui.sheet.querySelector('[data-do=weave]')")
        await ev("(() => { const g = ensureGarden(); g.vase.push({el: 'ember+tide', gl: true, at: Date.now() - 1800000}, {el: 'bloom', gl: false, at: Date.now()}); openVase(); })()"); await page.wait_for_timeout(200)
        await page.click('#sheet [data-do="weave"]'); await page.wait_for_timeout(250); wsheet = await ev(SHEET)
        await page.click('#sheet [data-do="weave"]'); await page.wait_for_timeout(300)
        woven = await ev("({crown: S.pet.crown, vase: ensureGarden().vase.length, wear: S.pet.wear, look: !!petLook(S.pet).crown, toast: document.getElementById('toast').textContent})")
        await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/gp9_crown.png')
        await ev("takePicture()"); pic = await ev("S.pics[S.pics.length - 1].pet.crown")
        await ev("openVase()"); await page.wait_for_timeout(200); vsheet = await ev(SHEET)
        rec('crown', {'one flower': one, 'sheet': wsheet, 'woven': woven, 'pic': pic, 'vase sheet': vsheet})
        # a hat from the wardrobe takes its place, and a crown wilts after a day but a picture keeps it
        await ev("closeSheet(); openWardrobe('pet')"); await page.wait_for_timeout(200); await page.click('#sheet [data-do="wear"][data-id="explorer"]'); await page.wait_for_timeout(250)
        hat = await ev("({crown: !!S.pet.crown, wear: S.pet.wear, toast: document.getElementById('toast').textContent})")
        await ev("closeSheet(); S.pet.crown = {els: ['tide', 'bloom'], gl: [false, false], at: Date.now() - 25 * 3600000}"); wilt0 = await ev("!!petLook(S.pet).crown && crownOn(S.pet.crown)")
        await ev("openVase()"); await page.wait_for_timeout(150); wilt = await ev("S.pet.crown === undefined"); await ev("closeSheet()")
        keep = await ev("crownOn(Object.assign({}, S.pics[S.pics.length - 1].pet.crown, {at: 0}))")
        rec('crown after', {'hat': hat, 'wilted shown': wilt0, 'wilted off': wilt, 'picture keeps': keep})
        # on a Wildcrown it sits on its own crown; on another Mythic it perches
        await ev("(() => { S.pet.crown = {els: ['tide', 'ember+tide', 'bloom'], gl: [false, true, false], at: Date.now()}; delete S.pet.wear; S.pet.xp = 99999; S.pet.form = 'bloom'; refreshLooks(); })()"); await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/gp10_wildcrown.png')
        await ev("S.pet.form = 'tide'; refreshLooks()"); await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/gp11_perch.png')
        await ev("S.pet.form = null; S.pet.xp = 0; refreshLooks(); enterGarden(); closeSheet()")

        # nothing of play is saved
        await ev("leaveGarden()"); saved = json.loads(await ev("localStorage.getItem('glimmerkin.v1')"))
        rec('saved', {'crown': saved['pet'].get('crown'), 'seen': saved['garden'].get('seen'), 'garden keys': sorted(k for k in saved['garden'].keys() if k != 'seen'), 'little keys': sorted(set(k for l in saved['littles'] for k in l.keys())), 'scene': await ev("scene")})
        rec('errors', errors); await browser.close()
    R = RESULTS; P = R['play']['plays']; B = R['bench']; K = R['more kinds']
    finish([
        ('the test garden has a pond and a tree to walk up to', R['pond'] is not None and R['tree'] is not None),
        ('littles stay in line for a moment', R['play']['early'] == [None, None, None]),
        ('standing still, a Tide little jumps in the pond', P[0] and P[0]['kind'] == 'swim' and P[0]['there'] and (P[0]['x'], P[0]['y']) == (R['pond']['tx'], R['pond']['ty'])),
        ('a Gale little chases petals', P[1] and P[1]['kind'] == 'chase'),
        ('littles at play spread out, clear of the Glimmerkin', len({(q['x'], q['y']) for q in K if q}) == 3 and (R['near']['x'], R['near']['y']) not in {(q['x'], q['y']) for q in K if q}),
        ('an Ember little with no bench dozes where it is', P[2] and P[2]['kind'] == 'doze' and not P[2]['bench']),
        ('walking calls them back into line', R['walk back'] == [None, None, None]),
        ('a tap on a little says how it is getting on', 'Pip splashes about' in R['tap little']['toast'] and R['tap little']['still there'] == {'x': R['pond']['x'], 'y': R['pond']['y']}),
        ('playing gives 1 Joy, at most once in 25 seconds', R['tap little']['joy'] == [51, 51]),
        ('a tap on the pond ripples it, and the Tide little jumps in', R['pond tap']['ripples'] >= 1 and 'Pip jumps in with a splash' in R['pond tap']['toast'] and R['pond tap']['plays'][0] and R['pond tap']['plays'][0]['kind'] == 'swim'),
        ('alone, the Glimmerkin dips a toe in', 'dips a toe in' in R['pond alone']),
        ('a tap on a tree shakes it, and the Gale little chases what falls', 'shakes the tree' in R['tree']['toast'] and 'Wisp chases them' in R['tree']['toast'] and R['tree']['falling'] > 0 and R['tree']['plays'][1] and R['tree']['plays'][1]['kind'] == 'chase' and R['tree']['joy'] == 51),
        ('an Ember little dozes on the bench', any(q and q['kind'] == 'doze' and q['bench'] and q['y'] * 25 + q['x'] == B['square'] for q in B['doze'])),
        ('the bench can be sat on, and walking gets up', 'Sit down' in B['sheet'] and B['sit'] == B['square'] and 'sits on the bench' in B['toast'] and B['up']),
        ('the bird bath splashes', 'Splash' in R['bath']['sheet'] and 'Splash!' in R['bath']['toast'] and 'Pip squeals' in R['bath']['toast']),
        ('the lantern post sheet is unchanged', R['lamp'] == ['up', 'close']),
        ('a Stone little stacks pebbles', K[0] and K[0]['kind'] == 'stack'),
        ('a Bloom little rolls in the grass by a bloom', K[1] and K[1]['kind'] == 'roll' and K[1]['there']),
        ('a Glow little shines with fireflies after dark', K[2] and K[2]['kind'] == 'shine' and K[2]['night']),
        ('nothing of play is saved', not any('play' in k or 'sit' in k for k in R['saved']['garden keys'] + R['saved']['little keys']) and R['saved']['scene'] == 'home'),
        ('Play on the bar offers hide and seek', 'Hide and seek' in R['seek start']['sheet'] and 'Pip, Wisp, Cinder hide' in R['seek start']['sheet']),
        ('every little hides, each in its own place', all(R['seek start']['hid']) and len({(h['ox'], h['oy']) for h in R['seek start']['hid']}) == 3),
        ('hiding places are never in a hidden place not yet found, and can always be walked up to', all(not h['shut'] and h['way'] for h in R['seek start']['hid'])),
        ('the game says who ran off and counts the finds', 'run off to hide' in R['seek start']['toast'] and R['seek start']['name'] == 'Hide and seek' and R['seek start']['count'] == 'Found 0 of 3'),
        ('hidden littles do not wander off to play', R['seek start']['playing'] == 0),
        ('a tap on a hiding place finds the little', 'Found you,' in R['seek one']['toast'] and R['seek one']['count'] == 'Found 1 of 3' and R['seek one']['hidden'] == 2 and R['seek one']['clock'] < 5),
        ('finding everyone ends the game with 3 Joy', 'You found everyone' in R['seek all']['toast'] and not R['seek all']['hunt'] and R['seek all']['joy'] == 53 and 'garden' in R['seek all']['name']),
        ('each little gets 1 experience, within the three a day', R['seek all']['xp'][1] == [R['seek all']['xp'][0][0] + 1, R['seek all']['xp'][0][1], R['seek all']['xp'][0][2] + 1]),
        ('they can be called out', 'Call them out' in R['seek out']['sheet'] and not R['seek out']['hunt'] and R['seek out']['hidden'] == 0 and 'Out they come' in R['seek out']['toast']),
        ('with no littles there is nobody to play with', R['seek none']['off'] and 'Bring a little along' in R['seek none']['sheet']),
        ('visitors come for what is there, and fit where they are', R['visitors']['fits'] and 'robin' in R['visitors']['all'] and 'dewdrop' in R['visitors']['all'] and 'patchwing' in R['visitors']['all'] and 'glimmerwing' in R['visitors']['all']),
        ('the same visitors stay for the hour, and others may come the next', R['visitors']['day'] == R['visitors']['again'] and R['visitors']['day'] and R['visitors']['later']),
        ('no more than five come at once', 0 < R['visitors']['n'] <= 5),
        ('day visitors stay away at night, and night ones come', 'robin' not in R['visitors']['nightAll'] and 'lanternmoth' in R['visitors']['nightAll'] and 'lanternmoth' not in R['visitors']['all']),
        ('each further quarter has a visitor of its own', all(n == 0 for q, n in R['visitors']['quarters']) and R['visitors']['crab'] > 0),
        ('the rainbow butterfly needs all six kinds in bloom', R['visitors']['rainbow'] and R['visitors']['noRainbow'] == 0),
        ('watching a visitor the first time puts it in the book', 'watches the robin' in R['watch']['first']['toast'] and 'New in the visitor book' in R['watch']['first']['toast'] and R['watch']['first']['seen'] == {'robin': 1} and R['watch']['first']['joy'] == 51),
        ('watching it again is not new', 'robin' in R['watch']['again'] and 'New in the visitor book' not in R['watch']['again']),
        ('a butterfly lands on the Glimmerkin\'s nose, and the bloom under it is left alone', "lands on" in R['watch']['flyer']['toast'] and R['watch']['flyer']['watch'] and R['watch']['flyer']['sheet'] == ''),
        ('the journal has the visitor book, with clues for the rest', R['book']['title'] == 'The visitor book · 2 of 24' and R['book']['cells'] == 24 and R['book']['known'] == ['Dewdrop butterfly', 'Robin'] and R['book']['counts'] == ['×1', '×2'] and 'Ember flowers' in R['book']['clues'] and 'Lone trees, at night' in R['book']['clues'] and 'Tidehollow quarter' in R['book']['clues']),
        ('the crown is saved', R['saved']['crown'] and R['saved']['crown']['els'] == ['tide', 'ember+tide', 'bloom']),
        ('the book is saved', R['saved']['seen'] == {'robin': 2, 'dewdrop': 1}),
        ('one flower in the vase is not enough for a crown', not R['crown']['one flower']),
        ('weaving shows the flowers and says the hat comes off', 'Weave a flower crown' in R['crown']['sheet'] and 'Embercup' in R['crown']['sheet'] and "explorer's hat comes off" in R['crown']['sheet']),
        ("the crown takes the vase's flowers and the hat's place", R['crown']['woven']['crown']['els'] == ['tide', 'ember+tide', 'bloom'] and R['crown']['woven']['crown']['gl'] == [False, True, False] and R['crown']['woven']['vase'] == 0 and R['crown']['woven']['wear'] == {'neck': 'scarf'} and R['crown']['woven']['look'] and 'wears its flower crown' in R['crown']['woven']['toast']),
        ('a picture keeps the crown', R['crown']['pic'] and R['crown']['pic']['keep'] == 1 and R['crown']['pic']['els'] == ['tide', 'ember+tide', 'bloom']),
        ('the vase says a crown is worn and can take it off', 'wearing a flower crown' in R['crown']['vase sheet'] and 'Take the crown off' in R['crown']['vase sheet'] and 'Weave a crown' not in R['crown']['vase sheet']),
        ('a hat from the wardrobe takes the crown off', not R['crown after']['hat']['crown'] and R['crown after']['hat']['wear']['head'] == 'explorer' and 'crown comes off' in R['crown after']['hat']['toast']),
        ('a crown wilts after a day, but not in a picture', not R['crown after']['wilted shown'] and R['crown after']['wilted off'] and R['crown after']['picture keeps']),
        ('no errors', not R['errors']),
    ])

asyncio.run(main())
