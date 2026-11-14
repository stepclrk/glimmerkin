# Drives more room for littles and eggs in a phone-sized headless browser. The burrow: digging it from Things in the
# garden, what it costs, eggs that find a full nest going there, the burrow's sheet, littles and eggs moving up and
# down, swapping with a full nest, a little's sheet sending it down, littles playing outside by day, moving the burrow,
# and an older save without one.
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
COUNTS = "({ nest: S.littles.length, eggs: S.eggs.length, bl: S.burrow ? S.burrow.littles.length : -1, be: S.burrow ? S.burrow.eggs.length : -1, party: S.party.length, room: eggRoom() })"
# Stands the Glimmerkin on tile (x, y), as if it had walked there.
PUT = "(([x, y]) => { closeSheet(); GA.px = x; GA.py = y; GA.at = {x, y}; GA.path = []; GA.act = null; GA.sit = undefined; GA.trail = []; for (let i = 0; i < 90; i++) GA.trail.push({x, y}); GA.lits.forEach(f => { f.x = x; f.y = y; f.play = null; f.busy = 0; }); GA.still = 0; })"
# Open grass with open grass on both sides and below: room for the burrow and its littles at play.
YARD = "(() => { const M = GA.M, ok = (x, y) => M.rows[y] && M.rows[y][x] === '.' && !here().things[y * M.W + x] && !GA.shut.has(y * M.W + x); for (let y = 2; y < M.H - 3; y++) for (let x = 2; x < M.W - 2; x++) if (ok(x, y) && ok(x - 1, y) && ok(x + 1, y) && ok(x, y + 1) && !(x === M.start.x && y === M.start.y)) return {x, y}; return null; })()"
EGG = "({ hue: 200, seed: 5, warm: 0, twin: false })"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(**LAUNCH)
        page = await browser.new_page(viewport={'width': 390, 'height': 760})
        errors = []; page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.add_init_script(SEED_JS); await page.goto(PAGE); await page.wait_for_timeout(900); ev = page.evaluate
        async def do(name, **data):   # presses a button on the sheet by its data-do
            sel = '#sheet [data-do="%s"]' % name + ''.join('[data-%s="%s"]' % (k, v) for k, v in data.items())
            await page.click(sel); await page.wait_for_timeout(150)

        await ev("""(() => { closeSheet(); S.pet.asleep = false; S.quests = 12; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; S.dust = 100;
          const r = RNG(5); S.littles = ['tide', 'gale', 'ember', 'stone', 'bloom', 'glow', 'ember'].map(k => newLittle(k, r));
          ['Pip', 'Wisp', 'Cinder', 'Pebble', 'Moss', 'Gleam', 'Sparky'].forEach((n, i) => S.littles[i].name = n); S.party = S.littles.slice(0, 3).map(l => l.id);
          S.eggs = []; S.burrow = null; const g = ensureGarden(); g.gift = true; rebuildHome(); })()""")
        rec('before', await ev(COUNTS))
        # with no burrow, the nest's room is all there is: one place left, and a second egg turns into stardust
        none = await ev("(() => { const a = keepEgg(" + EGG + "), b = keepEgg(" + EGG + "); return { a, b, line: fullLine() }; })()")
        rec('no burrow', none)

        # Things offers a burrow; it costs 150 stardust, so with 100 it cannot be dug
        await ev("enterGarden(); GA.night = 0; closeSheet()"); yard = rec('yard', await ev(YARD))
        await ev(PUT, [yard['x'], yard['y']]); await ev("openThings()"); await page.wait_for_timeout(200)
        poor = rec('too poor', {'sheet': await ev(SHEET), 'off': await ev("document.querySelector('#sheet [data-do=dig]').disabled")})
        await ev("S.dust = 200; openThings()"); await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/room1_things.png')
        await do('dig'); await page.wait_for_timeout(300)
        dug = rec('dug', {'toast': await ev(TOAST), 'dust': await ev("S.dust"), 'spot': await ev("burrowSpot()"), 'k': yard['y'] * await ev("GA.M.W") + yard['x'], 'counts': await ev(COUNTS)})

        # a full nest now sends eggs to the burrow; quest results say so, and the rare portal card too
        res = await ev("(() => { const q = { loot: { eggs: [{ hue: 30, twin: false }, { hue: 90, twin: true }] } }; const out = []; for (const e of q.loot.eggs) out.push(keepEgg(Object.assign({ seed: 3, warm: 0 }, e))); return out; })()")
        rec('eggs after dig', {'went': res, 'counts': await ev(COUNTS), 'line': await ev("fullLine()")})
        # the burrow stands where it was dug; walking to it opens its sheet
        await ev(PUT, [yard['x'], yard['y'] + 1])
        await ev("(([x, y]) => { const V = gardenView(); gardenTap({ x: (x + 0.5 - V.ox) * V.ts, y: V.top + (y + 0.5 - V.oy) * V.ts }); })", [yard['x'], yard['y']])
        for _ in range(40):
            if await ev("!ui.sheet.hidden"): break
            await page.wait_for_timeout(150)
        sheet = rec('burrow sheet', await ev(SHEET)); await page.screenshot(path=SHOTS + '/room2_sheet.png')
        # an egg goes up to the nest: no room there, so it is off; a little goes down; then the egg can go up
        egg_off = rec('egg up off', await ev("document.querySelector('#sheet [data-do=eggup]').disabled"))
        await ev("closeSheet(); S.party = [S.littles[0].id, S.littles[1].id, S.littles[3].id]; openBurrow()")
        cinder = await ev("S.littles.find(l => l.name === 'Cinder').id")
        await do('down', id=cinder); down = rec('down', {'toast': await ev(TOAST), 'counts': await ev(COUNTS), 'party': await ev("S.party.includes(%s)" % json.dumps(cinder))})
        await do('eggup', i=0); eggup = rec('egg up', {'toast': await ev(TOAST), 'counts': await ev(COUNTS)})
        # nest full again: a burrow little coming up swaps with one going down, and takes its place in the party
        await do('up', id=cinder); await page.wait_for_timeout(100); swap_sheet = rec('swap sheet', await ev(SHEET))
        pip = await ev("S.littles.find(l => l.name === 'Pip').id")
        await do('pick', id=pip); swap = rec('swap', {'toast': await ev(TOAST), 'counts': await ev(COUNTS), 'party has Cinder': await ev("S.party.includes(%s)" % json.dumps(cinder)), 'Pip below': await ev("!!burrowLittle(%s)" % json.dumps(pip)), 'garden lits': await ev("GA.lits.map(f => f.l.name)")})
        # by day the burrow's littles play outside its door; at night they are inside
        await ev("closeSheet()"); await ev(PUT, [yard['x'], yard['y'] + 1]); await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/room3_garden.png')
        day = await ev("burrowYard(GA).map(o => o.l.name)"); await ev("GA.night = 1"); night = await ev("burrowYard(GA).length"); await ev("GA.night = 0")
        rec('yard', {'day': day, 'night': night})
        # moving it: picked up with everyone inside, set down again from Things
        await ev("openBurrow()"); await do('lift'); lifted = rec('lifted', {'toast': await ev(TOAST), 'spot': await ev("burrowSpot()"), 'held': await ev("ensureGarden().held.burrow"), 'counts': await ev(COUNTS)})
        await ev("openThings()"); await page.wait_for_timeout(150); await do('putb'); put = rec('put back', {'toast': await ev(TOAST), 'spot': await ev("burrowSpot()"), 'held': await ev("ensureGarden().held.burrow")})

        # at the nest: Littles says who is in the burrow, and a little's own sheet sends it down when there is room
        await ev("leaveGarden()"); await page.wait_for_timeout(200)
        await ev("openLittles()"); await page.wait_for_timeout(150); lsheet = rec('littles sheet', await ev(SHEET))
        moss = await ev("S.littles.find(l => l.name === 'Moss').id")
        await ev("openLittle(%s)" % json.dumps(moss)); await page.wait_for_timeout(150); await do('burrow')
        sent = rec('sent down', {'toast': await ev(TOAST), 'counts': await ev(COUNTS), 'home lits': await ev("home.lits.length")})
        # the last little at the nest cannot go
        last = await ev("(() => { const keep = S.littles.slice(); S.burrow.littles = S.burrow.littles.slice(0, 1); S.burrow.eggs = []; S.littles = keep.slice(0, 1); openLittle(S.littles[0].id); const has = !!document.querySelector('#sheet [data-do=burrow]'); S.littles = keep; return has; })()")
        rec('last little', last)

        # swap an egg: only with the nest and the burrow both full; the egg chosen goes, the things come
        await ev("(() => { S.quests = 12; S.j.trader = true; S.trader = null; const t = traderToday(); return !!t; })()")
        nope = await ev("(() => { S.trader = { day: localDay(), stock: [] }; openShop(); return document.querySelector('#sheet').textContent.includes('Swap an egg'); })()")
        await ev("(() => { const r = RNG(9); while (nestRoom() > 0) S.eggs.push({ hue: 60, seed: 1, warm: 0, twin: false }); while (burrowRoom() > 0) S.burrow.eggs.push({ hue: 300, seed: 2, warm: 0, twin: false }); S.maps = 0; S.tools = {}; openShop(); })()")
        await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/room4_swap.png'); swap_sheet2 = await ev(SHEET)
        before_swap = await ev(COUNTS); be = await ev("S.burrow.eggs.length")
        await do('egg', i=await ev("S.eggs.length")); picked = await ev("document.querySelector('#sheet [data-do=egg][aria-pressed=true]').dataset.i")
        await do('swap', id='tool:key'); swapped = rec('swapped', {'toast': await ev(TOAST), 'keys': await ev("S.tools.key"), 'counts': await ev(COUNTS), 'swaps': await ev("S.j.swaps"), 'open': await ev("swapOpen()"), 'sheet': await ev(SHEET)})
        rec('swap', {'none': nope, 'picked': picked, 'before': before_swap})

        # adventures: only a grown-up little can go, from its own sheet
        await ev("closeSheet(); S.awayNo = null; S.away = []; S.tools = {}; S.littles.forEach(l => l.xp = 0); rebuildHome()")
        gleam = await ev("S.littles.find(l => l.name === 'Gleam').id")
        await ev("openLittle(%s)" % json.dumps(gleam)); young = await ev("!!document.querySelector('#sheet [data-do=adv]')")
        await ev("S.littles.find(l => l.name === 'Gleam').xp = 9999; S.littles.find(l => l.name === 'Gleam').charm = 'clover'; S.charms = {}; openLittle(%s)" % json.dumps(gleam)); await page.wait_for_timeout(100)
        await do('adv'); await page.wait_for_timeout(150); letgo = await ev(SHEET); await page.screenshot(path=SHOTS + '/room5_letgo.png')
        await do('stay'); stay = {'toast': await ev(TOAST), 'no': await ev("S.awayNo === localDay()"), 'still': await ev("!!petById(%s)" % json.dumps(gleam))}
        # with the nest full, it asks with a bubble on the nest, but not on a day it was told to stay
        full = await ev("(() => { S.eggs = S.eggs.slice(0, 0); while (nestRoom() > 0) S.eggs.push({ hue: 60, seed: 1, warm: 0, twin: false }); while (burrowRoom() > 0) S.burrow.eggs.push({ hue: 300, seed: 2, warm: 0, twin: false }); rebuildHome(); return { asker: adventureAsker() && adventureAsker().name }; })()")
        await ev("S.awayNo = null"); await page.wait_for_timeout(500)
        ask = {'asker': await ev("adventureAsker() && adventureAsker().name"), 'bubble': await ev("!!home.abubble")}
        await page.screenshot(path=SHOTS + '/room6_ask.png')
        bub = await ev("home.abubble"); st = await (await page.query_selector('#stage')).bounding_box()
        await page.mouse.click(st['x'] + bub['x'], st['y'] + bub['y']); await page.wait_for_timeout(300); asked = await ev(SHEET)
        n0 = await ev("S.littles.length")
        await do('go'); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/room7_sendoff.png')
        off = rec('set off', {'sheet': await ev(SHEET), 'away': await ev("S.away.map(a => a.name)"), 'nest': await ev("S.littles.length"), 'n0': n0, 'gift': await ev("[S.away[0].gift, S.away[0].n, S.tools]"), 'charm back': await ev("S.charms.clover"), 'party': await ev("S.party.includes(%s)" % json.dumps(gleam)), 'asks now': await ev("adventureAsker() && adventureAsker().name")})
        rec('let go', {'young': young, 'stay': stay, 'full': full, 'ask': ask, 'asked': asked[:80]})
        # pictures: none before day 10, one each 10 days, up to 10, and the first unseen one is shown at the nest
        await ev("closeSheet()")
        pics0 = await ev("(() => { S.away[0].left = Date.now() - 9 * 86400000; adventureMail(); return { n: S.away[0].pics.length, open: !ui.sheet.hidden }; })()")
        await ev("S.away[0].left = Date.now() - 25 * 86400000; adventureMail()"); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/room8_picture.png')
        pics1 = {'n': await ev("S.away[0].pics.length"), 'sheet': await ev(SHEET), 'unseen': await ev("S.away[0].pics.filter(p => p.nu).length")}
        await do('ok'); await page.wait_for_timeout(200); pics2 = {'sheet': await ev(SHEET), 'unseen': await ev("S.away[0].pics.filter(p => p.nu).length")}
        await ev("closeSheet()"); same = await ev("(() => { const a = S.away[0], b = a.pics.map(p => p.s); a.pics = []; a.left -= 0; adventureMail(); closeSheet(); return JSON.stringify(b) === JSON.stringify(a.pics.map(p => p.s)); })()")
        cap = await ev("(() => { S.away[0].left = Date.now() - 400 * 86400000; adventureMail(); closeSheet(); S.away[0].pics.forEach(p => delete p.nu); return S.away[0].pics.length; })()")
        await ev("openJournal()"); await page.wait_for_timeout(300); jt = await ev(SHEET)
        await ev("document.querySelector('#sheet [data-do=away]') || ui.sheet.querySelector('h3')")
        await page.evaluate("(() => { const h = [...document.querySelectorAll('#sheet h3')].find(e => e.textContent.startsWith('Away')); h.scrollIntoView(); })()"); await page.wait_for_timeout(150)
        await page.screenshot(path=SHOTS + '/room9_journal.png')
        await do('selfie', i=0, n=2); one = await ev(SHEET)
        rec('pictures', {'early': pics0, 'two': pics1, 'next': pics2, 'same seeds': same, 'cap': cap, 'one': one[:120]})
        # every picture draws without trouble, all eight places and four times among them
        kinds = await ev("(() => { const seen = new Set(), times = new Set(); const cv = document.createElement('canvas'); cv.width = cv.height = 120; const c = cv.getContext('2d'); for (let s = 1; s < 400; s++) { const sc = picScene(s); seen.add(sc.place); times.add(sc.time); drawSelfie(c, 120, 120, S.away[0], s); } return [seen.size, times.size]; })()")

        # an older save has no burrow, and loads with none
        old = await ev("(() => { const d = JSON.parse(JSON.stringify(S)); delete d.burrow; delete d.away; S = d; afterLoad(); return { burrow: S.burrow, room: eggRoom(), line: fullLine(), away: S.away }; })()")
        rec('old save', old)
        await browser.close()

    checks = [
        ('no burrow: one place, then none', none['a'] == 'nest' and none['b'] is False and none['line'] == 'The nest is full'),
        ('a burrow costs 150', 'Dig a burrow' in poor['sheet'] and '150' in poor['sheet'] and poor['off'] is True),
        ('digging it', dug['dust'] == 50 and dug['spot'] == {'q': 0, 'k': dug['k']} and 'A burrow!' in dug['toast'] and dug['counts']['bl'] == 0),
        ('eggs go to the burrow', RESULTS['eggs after dig']['went'] == ['burrow', 'burrow'] and RESULTS['eggs after dig']['counts']['be'] == 2 and RESULTS['eggs after dig']['line'] == 'The nest and the burrow are full'),
        ('the burrow sheet', '2 of 8 places taken' in sheet and 'In the burrow' in sheet and 'At the nest' in sheet),
        ('an egg waits when the nest is full', egg_off is True),
        ('a little goes down, out of the party', down['counts']['nest'] == 6 and down['counts']['bl'] == 1 and not down['party'] and 'moves into the burrow' in down['toast']),
        ('an egg comes up', eggup['counts']['eggs'] == 2 and eggup['counts']['be'] == 1),
        ('swapping with a full nest', 'Swap with Cinder' in swap_sheet and swap['counts']['nest'] == 6 and swap['counts']['bl'] == 1 and swap['Pip below'] and swap['party has Cinder'] and 'Cinder' in swap['garden lits'] and 'Pip' not in swap['garden lits']),
        ('littles play outside by day only', RESULTS['yard']['day'] == ['Pip'] and RESULTS['yard']['night'] == 0),
        ('moving the burrow', lifted['spot'] is None and lifted['held'] == 1 and lifted['counts']['bl'] == 1 and put['spot'] is not None and put['held'] == 0),
        ('Littles names the burrow', '1 more lives in the burrow' in lsheet),
        ('a little\'s sheet sends it down', sent['counts']['bl'] == 2 and sent['home lits'] == sent['counts']['nest'] and 'Moss moves into the burrow' in sent['toast']),
        ('the last little stays', last is False),
        ('no swap until both are full', RESULTS['swap']['none'] is False and 'Swap an egg' in swap_sheet2 and 'Moon key × 2' in swap_sheet2 and 'Map piece' in swap_sheet2),
        ('swapping an egg from the burrow', swapped['keys'] == 2 and swapped['counts']['be'] == be - 1 and swapped['counts']['eggs'] == before_swap['eggs'] and swapped['swaps'] == 1 and '2 moon keys are yours' in swapped['toast'] and swapped['open'] is False and 'Swap an egg' not in swapped['sheet']),
        ('only grown-ups can go, from their sheet', RESULTS['let go']['young'] is False and 'Let Gleam go' in letgo and 'every 10 days' in letgo),
        ('stay a while longer', 'Maybe another day' in stay['toast'] and stay['no'] and stay['still'] and full['asker'] is None),
        ('a full nest: a bubble asks', ask['asker'] == 'Gleam' and ask['bubble'] and 'Let Gleam go' in asked),
        ('setting off', "I'm going on an adventure!" in off['sheet'] and 'Wave goodbye' in off['sheet'] and off['away'] == ['Gleam'] and off['nest'] == off['n0'] - 1 and off['gift'][2].get(off['gift'][0].split(':')[1]) == 2 and off['charm back'] == 1 and not off['party'] and off['asks now'] is None),
        ('pictures every 10 days', pics0['n'] == 0 and not pics0['open'] and pics1['n'] == 2 and 'A picture from Gleam' in pics1['sheet'] and 'day 10 of its adventure' in pics1['sheet'] and pics1['unseen'] == 1 and 'day 20' in pics2['sheet'] and pics2['unseen'] == 0),
        ('pictures are the same each time, and stop at 10', same and cap == 10),
        ('the journal keeps them', 'Away on adventures · 1' in jt and '10 pictures' in jt and 'Day 30' in one or 'day 30' in one),
        ('eight places, four times', kinds == [8, 4]),
        ('an old save has no burrow', old['burrow'] is None and old['line'] == 'The nest is full' and old['away'] == []),
        ('no errors', not errors),
    ]
    if errors: print('errors:', errors)
    finish(checks)

asyncio.run(main())
