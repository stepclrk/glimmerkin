# Drives nest play in a phone-sized headless browser: the Glimmerkin's favourite spot, catching berries, tricks it
# learns, littles coming home messy, keepsakes, little towers, the bedtime pile, nest life, copy me, pictures and
# the welcome home.
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

async def stroke(page, x, y, n=8, dx=20):
    await page.mouse.move(x - dx, y); await page.mouse.down()
    for i in range(n):
        await page.mouse.move(x + (dx if i % 2 == 0 else -dx), y, steps=3)
    await page.mouse.up()

async def spot(page, ev):
    # each part of the Glimmerkin answers a stroke in its own way, and one spot a day is its favourite
    fav = await ev("favSpot()")
    pts = await ev("(() => { const H = home, ps = H.petS, ny = H.gy + H.ry * 0.12; return {head: [H.cx, ny - ps * 0.8], left: [H.cx - ps * 0.32, ny - ps * 0.5], right: [H.cx + ps * 0.32, ny - ps * 0.5], tummy: [H.cx, ny - ps * 0.15]}; })()")
    rec('spot zones', await ev("(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, spotAt({x: v[0], y: v[1]})])))(%s)" % str(pts).replace("'", '"')))
    other = [k for k in ['head', 'left', 'right', 'tummy'] if k != fav][0]
    await ev("S.wish = {day: localDay(), n: 0, k: 'cuddle', a: '', need: 24, got: 0, done: false, at: 0}; S.spot = null; S.j.spots = 0")
    await stroke(page, pts[other][0], pts[other][1], 6, 10)
    plain = await ev("({got: S.wish.got, found: !!(S.spot && S.spot.found), tilt: home.pa.tilt, wiggle: home.pa.wiggle})")
    await stroke(page, pts[fav][0], pts[fav][1], 6, 10); await page.wait_for_timeout(150)
    await page.screenshot(path=SHOTS + '/p1_spot.png')
    rec('spot stroke', {'fav': fav, 'other': other, 'plain': plain, 'got': await ev("S.wish.got"), 'found': await ev("S.spot.found"), 'days': await ev("S.j.spots"), 'toast': await ev(TOAST), 'journal': await ev("(() => { openJournal(); const t = ui.sheet.textContent; closeSheet(); return t.includes('favourite spot on 1 day'); })()")})

async def catch(page, ev):
    # a berry flicked up from the pantry: the Glimmerkin leaps and catches it, and it feeds as a tap does
    await ev("closeSheet(); S.pet.asleep = false; S.pet.belly = 40; S.pantry = {bloom: 6, tide: 2}; S.j.catchBest = 0; home.catchRun = 0; const l = S.littles.find(l => S.party.includes(l.id)); delete l.treats")
    await page.click('[data-act="feed"]'); await page.wait_for_timeout(200)
    b = await (await page.query_selector('[data-food="bloom"]')).bounding_box()
    x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
    belly = await ev("S.pet.belly")
    await page.mouse.move(x, y); await page.mouse.down()
    for i in range(1, 7):
        await page.mouse.move(x, y - i * 30)
    await page.mouse.up()
    flying = await ev("!!home.toss")
    await page.wait_for_timeout(250); await page.screenshot(path=SHOTS + '/p2_catch.png')
    await page.wait_for_function("!home.toss", timeout=8000)   # in the air for about a second, longer on a slow machine
    rec('catch flick', {'flying': flying, 'left': await ev("S.pantry.bloom"), 'belly': await ev("S.pet.belly") - belly, 'run': await ev("home.catchRun"), 'toss': await ev("!!home.toss")})
    # a second catch in a row is counted, and the best run is kept
    await ev("tossBerry('bloom', home.cx, VH - 120, 0, -950)"); await page.wait_for_function("!home.toss", timeout=8000)
    rec('catch run', {'run': await ev("home.catchRun"), 'best': await ev("S.j.catchBest")})
    # one flicked far to the side bounces on the nest: the nearest little on the nest gets it as a treat
    xp = await ev("S.littles.reduce((n, l) => n + (l.xp || 0), 0)")
    await ev("tossBerry('bloom', home.cx, VH - 120, 9000, -900)"); await page.wait_for_timeout(300)
    side = await ev("home.toss && home.toss.vx")
    for i in range(40):
        await page.wait_for_timeout(100)
        if not await ev("!!home.toss"): break
    rec('catch miss', {'side': side, 'run': await ev("home.catchRun"), 'best': await ev("S.j.catchBest"), 'left': await ev("S.pantry.bloom"), 'xp': await ev("S.littles.reduce((n, l) => n + (l.xp || 0), 0)") - xp, 'toast': await ev(TOAST)})
    # a full Glimmerkin will not play catch, and nothing leaves the pantry
    await ev("S.pet.belly = 99; tossBerry('tide', home.cx, VH - 120, 0, -900)")
    rec('catch full', {'tide': await ev("S.pantry.tide"), 'toss': await ev("!!home.toss"), 'toast': await ev(TOAST)})
    await ev("ui.tray.hidden = true; S.pet.belly = 50")

async def draw(page, pts):
    await page.mouse.move(*pts[0]); await page.mouse.down()
    for q in pts[1:]: await page.mouse.move(*q)
    await page.mouse.up()

async def tricks(page, ev):
    # a shape drawn on the sky asks for a trick; a stroke straight after is praise; five praised tries teach it
    import math
    await ev("closeSheet(); S.pet.asleep = false; S.pet.tricks = {}; home.pa.trick = null; home.praise = null; S.pet.joy = 50")
    c = await ev("({x: VW * 0.55, y: home.gy - home.baseS * 1.9, px: home.cx, py: home.gy + home.ry * 0.12 - home.petS * 0.8})")
    circle = [(c['x'] + math.cos(i / 24 * 6.4) * 45, c['y'] + math.sin(i / 24 * 6.4) * 45) for i in range(25)]
    zig = [(c['x'] - 60 + (i % 2) * 120, c['y'] + i * 6) for i in range(6)]
    up = [(c['x'], c['y'] + 80 - i * 16) for i in range(11)]
    await draw(page, circle); await page.wait_for_timeout(100)
    tried = await ev("({k: home.pa.trick && home.pa.trick.k, good: home.pa.trick && home.pa.trick.good, toast: %s})" % TOAST)
    await page.wait_for_timeout(250); await page.screenshot(path=SHOTS + '/p3_trick_try.png')
    await stroke(page, c['px'], c['py'], 4, 10); await stroke(page, c['px'], c['py'], 4, 10)
    rec('trick try', {'tried': tried, 'n': await ev("S.pet.tricks.spin")})
    # four more praised tries and it has learned to spin
    for i in range(4):
        await page.wait_for_timeout(1400); await draw(page, circle); await page.wait_for_timeout(100); await stroke(page, c['px'], c['py'], 4, 10)
    rec('trick learned', {'n': await ev("S.pet.tricks.spin"), 'knows': await ev("knows('spin')"), 'toast': await ev(TOAST)})
    await page.wait_for_timeout(1500); await draw(page, circle); await page.wait_for_timeout(200)
    rec('trick good', {'good': await ev("home.pa.trick && home.pa.trick.good"), 'join': await ev("home.lits.filter(f => f.perch < 0 && f.trick).length"), 'party': await ev("S.party.length")})
    await page.wait_for_timeout(1500); await draw(page, zig); await page.wait_for_timeout(50); z = await ev("home.pa.trick && home.pa.trick.k")
    await page.wait_for_timeout(1500); await draw(page, up); await page.wait_for_timeout(50); u = await ev("home.pa.trick && home.pa.trick.k")
    rec('trick shapes', [z, u])
    # a happy Glimmerkin shows off what it knows by itself now and then
    await page.wait_for_timeout(1500); await ev("S.pet.joy = 90; home.selfT = 0.01")
    await page.wait_for_timeout(200)
    rec('trick by itself', {'k': await ev("home.pa.trick && home.pa.trick.k"), 'journal': await ev("(() => { openJournal(); const t = ui.sheet.textContent; closeSheet(); return t.includes('knows how to spin'); })()")})
    await page.wait_for_timeout(1500)

async def tidy(page, ev):
    # the party comes home with bits of the world on them; stroking rubs them off
    await ev("closeSheet(); S.pet.asleep = false; S.pet.rest = 100; startQuest({seed: 6100, biome: 'tidehollow', size: 'nook', name: 'Test'}); finishQuest(false)")
    await page.wait_for_timeout(300)
    lines = await ev("[...document.querySelectorAll('#sheet li')].map(e => e.textContent).join(' | ')")
    await ev("closeSheet()"); await page.wait_for_timeout(1800)
    muck = await ev("S.party.map(id => petById(id).muck)")
    await page.screenshot(path=SHOTS + '/p4_muck.png')
    f = await ev("(() => { const f = litOf(S.party[0]); return {x: f.x, y: f.y - home.baseS * 0.18, id: f.l.id}; })()")
    await stroke(page, f['x'], f['y'], 4, 20)
    part = await ev("petById('%s').muck && petById('%s').muck.n" % (f['id'], f['id']))
    await stroke(page, f['x'], f['y'], 10, 20); await page.wait_for_timeout(100)
    rec('tidy', {'lines': lines, 'muck': muck, 'part': part, 'clean': await ev("!petById('%s').muck" % f['id']), 'toast': await ev(TOAST), 'others': await ev("S.party.slice(1).every(id => petById(id).muck && petById(id).muck.n === 7)")})

async def keepsakes(page, ev):
    # a little brings home something it found, and offers it to the Glimmerkin; a tap takes it for the rim
    await ev("closeSheet(); S.keeps = []; S.offer = null; S.pet.asleep = false")
    line = await ev("(() => { const r = playR.f; playR.f = () => 0.01; const q = {B: BIOMES.find(b => b.id === 'tidehollow'), lits: [litOf(S.party[1])]}; const out = keepAfter(q); playR.f = r; return out.join(''); })()")
    await page.wait_for_timeout(2200); await page.screenshot(path=SHOTS + '/p5_offer.png')
    f = await ev("(() => { const f = litOf(S.offer.id); return {x: f.x, y: f.y - home.baseS * 0.18, near: Math.abs(f.x - home.cx) < home.petS * 0.8}; })()")
    await page.mouse.click(f['x'], f['y']); await page.wait_for_timeout(300)
    rec('keep offer', {'line': line, 'near': f['near'], 'offer': await ev("S.offer"), 'keeps': await ev("S.keeps"), 'toast': await ev(TOAST)})
    await page.wait_for_timeout(1500); await page.screenshot(path=SHOTS + '/p5_keeps.png')
    k = await ev("home.keepPos[0]"); await page.mouse.click(k['x'], k['y']); await page.wait_for_timeout(150)
    rec('keep story', {'toast': await ev(TOAST), 'journal': await ev("(() => { openJournal(); const t = ui.sheet.textContent; closeSheet(); return t.includes('Keepsakes, 1 of 8'); })()")})
    # a full rim takes no more
    rec('keep full', await ev("(() => { S.keeps = Array.from({length: 8}, (_, i) => ({b: 'mossroot', i: i % 3, by: 'Pim', at: localDay()})); const r = playR.f; playR.f = () => 0.01; const out = keepAfter({B: BIOMES[0], lits: [litOf(S.party[0])]}); playR.f = r; return {out, offer: S.offer}; })()"))
    await ev("S.keeps = S.keeps.slice(0, 3)")

async def carry_onto(page, ev, src, dst):
    f = await ev("(() => { const f = litOf('%s'); return {x: f.x, y: f.y - home.baseS * 0.18}; })()" % src)
    g = await ev("(() => { const f = litOf('%s'); return {x: f.x, y: f.y - home.baseS * 0.63}; })()" % dst)
    await page.mouse.move(f['x'], f['y']); await page.mouse.down(); await page.wait_for_timeout(700)
    await page.mouse.move(g['x'], g['y'], steps=8); await page.wait_for_timeout(100); await page.mouse.up(); await page.wait_for_timeout(200)

async def tower(page, ev):
    # a little carried onto another's head climbs on top; three high wobbles and topples
    await ev("closeSheet(); S.pet.asleep = false; S.offer = null; home.tower = null; S.j.tower = 0; S.friends = {}; layoutHome()")
    await page.wait_for_timeout(2500)
    ids = await ev("(() => { const party = S.party.slice(), base = party.find(id => !kindsOf(petById(id)).includes('stone')); return [base].concat(party.filter(id => id !== base)); })()")
    before = await ev("S.party.slice()")
    await carry_onto(page, ev, ids[1], ids[0])
    two = await ev("({ids: home.tower && home.tower.ids, party: S.party.slice(), toast: %s})" % TOAST)
    await page.wait_for_timeout(500)
    await carry_onto(page, ev, ids[2], ids[1])
    await page.wait_for_timeout(600); await page.screenshot(path=SHOTS + '/p6_tower.png')
    three = await ev("(() => { const t = home.tower; if (!t) return null; const fs = t.ids.map(litOf); return {n: t.ids.length, life: t.life, above: fs[1].y < fs[0].y - 20 && fs[2].y < fs[1].y - 20, toast: %s}; })()" % TOAST)
    for i in range(70):
        await page.wait_for_timeout(100)
        if not await ev("!!home.tower"): break
    rec('tower', {'two': two, 'before': before, 'three': three, 'fell': await ev("!home.tower"), 'toast': await ev(TOAST), 'party': await ev("S.party.slice()"), 'best': await ev("S.j.tower")})
    await page.wait_for_timeout(1500)

async def bedtime(page, ev):
    # at bedtime every little curls up against the Glimmerkin, and it dreams of the last world it visited
    await ev("closeSheet(); home.tower = null; S.offer = null; S.pet.asleep = false; S.pet.rest = 100")
    await page.click('[data-act="sleep"]'); await page.wait_for_timeout(3500)
    await page.screenshot(path=SHOTS + '/p7_bedtime.png')
    pile = await ev("(() => { const H = home; return {asleep: S.pet.asleep, dream: S.dream, near: H.lits.every(f => Math.abs(f.x - H.cx) < H.petS * 1.05 && Math.abs(f.y - H.gy) < H.ry * 2), n: H.lits.length}; })()")
    f = await ev("(() => { const f = home.lits[0]; return {x: f.x, y: f.y - home.baseS * 0.18}; })()")
    await page.mouse.click(f['x'], f['y']); await page.wait_for_timeout(200)
    rec('bedtime', {'pile': pile, 'toast': await ev(TOAST), 'still': await ev("S.pet.asleep"), 'snug': await ev("home.lits[0].snug")})
    await page.click('[data-act="sleep"]'); await page.wait_for_timeout(3500)
    rec('bedtime wake', await ev("home.lits.filter(f => f.perch >= 0).every(f => Math.hypot(f.x - f.hx, f.y - f.hy) < 30)"))

async def nest_life(page, ev):
    # the littles get on with their own lives: chasing, dozing, tidying a friend, showing off to the Glimmerkin
    await ev("closeSheet(); S.pet.asleep = false; home.life = null; home.lifeT = 999; S.offer = null")
    await page.wait_for_timeout(2500)
    out = {}
    await ev("startLife('chase')"); a0 = await ev("home.life.ids.map(id => [litOf(id).x, litOf(id).y])")
    await page.wait_for_timeout(1500); await page.screenshot(path=SHOTS + '/p8_chase.png')
    a1 = await ev("home.life ? home.life.ids.map(id => [litOf(id).x, litOf(id).y]) : null")
    out['chase'] = bool(a1) and any(abs(a0[i][0] - a1[i][0]) + abs(a0[i][1] - a1[i][1]) > 20 for i in range(2))
    await ev("endLife(); startLife('nap')"); await page.wait_for_timeout(300)
    out['nap'] = await ev("litOf(home.life.ids[0]).napT > 0")
    await ev("endLife(); startLife('groom'); home.life.dur = 12")
    try: await page.wait_for_function("home.life && home.life.hearts >= 1", timeout=10000)
    except Exception: pass
    out['groom'] = await ev("home.life ? home.life.hearts : -1")
    await ev("endLife(); startLife('show')"); await page.wait_for_timeout(100)
    out['show'] = await ev("!!litOf(home.life.ids[0]).trick")
    await ev("endLife(); home.lifeT = 0.01; S.pet.asleep = true"); await page.wait_for_timeout(300)
    out['asleep'] = await ev("home.life")
    await ev("S.pet.asleep = false; home.lifeT = 0.01; home.idleAt = T"); await page.wait_for_timeout(300)
    out['touched'] = await ev("home.life")
    await ev("home.lifeT = 0.01; home.idleAt = T - 20"); await page.wait_for_timeout(300)
    out['idle'] = await ev("!!home.life")
    await ev("endLife(); home.lifeT = 999")
    rec('nest life', out)
    await page.wait_for_timeout(1500)

async def tap_little(page, ev, lid):
    f = await ev("(() => { const f = litOf('%s'); return {x: f.x, y: f.y - home.baseS * 0.2}; })()" % lid)
    await page.mouse.click(f['x'], f['y']); await page.wait_for_timeout(250)

async def copy_me(page, ev):
    # the Glimmerkin points at littles in turn; tap them in the same order, one more each round
    await ev("closeSheet(); S.pet.asleep = false; S.j.copyBest = 0; endLife()")
    await page.click('[data-act="littles"]'); await page.wait_for_timeout(200)
    await page.click('#sheet [data-do="copy"]')
    await page.wait_for_function("home.copy && home.copy.phase === 'you'", timeout=8000)
    await page.screenshot(path=SHOTS + '/p9_copy.png')
    seq = await ev("home.copy.seq.slice()")
    for lid in seq: await tap_little(page, ev, lid)
    await page.wait_for_function("home.copy && home.copy.phase === 'you' && home.copy.round === 2", timeout=10000)
    seq2 = await ev("home.copy.seq.slice()")
    wrong = [i for i in await ev("home.copy.ids") if i != seq2[0]][0]
    await tap_little(page, ev, wrong)
    rec('copy me', {'seq': len(seq), 'seq2': len(seq2), 'kept': seq2[:len(seq)] == seq, 'over': await ev("!home.copy"), 'best': await ev("S.j.copyBest"), 'toast': await ev(TOAST)})
    await page.wait_for_timeout(1500)

async def pictures(page, ev):
    # the camera takes a picture while everyone poses; the journal keeps it as a recipe and draws it again
    await ev("closeSheet(); S.pics = []; S.pet.asleep = false")
    await page.click('#btn-journal'); await page.wait_for_timeout(200); await page.click('#sheet [data-do=snap]'); await page.wait_for_timeout(250)
    posing = await ev("home.lits.filter(f => f.trick).length")
    await page.wait_for_timeout(1300)
    pic = await ev("S.pics[0] && {n: S.pics.length, ls: S.pics[0].ls.length, littles: S.littles.length, pet: S.pics[0].pet.seed === S.pet.seed, size: JSON.stringify(S.pics[0]).length}")
    toast = await ev(TOAST)
    await page.click('#btn-journal'); await page.wait_for_timeout(200)
    has = await ev("!!document.querySelector('#sheet [data-do=pic]')")
    await page.click('#sheet [data-do=pic]'); await page.wait_for_timeout(250)
    await page.screenshot(path=SHOTS + '/p10_picture.png')
    sheet = await ev("({title: document.querySelector('#sheet h2').textContent, text: document.querySelector('#sheet p').textContent, drawn: (() => { const k = document.querySelector('#sheet canvas'); const d = k.getContext('2d').getImageData(k.width / 2, k.height / 2, 1, 1).data; return d[3] > 0; })()})")
    for i in range(13): await ev("takePicture()")
    rec('pictures', {'posing': posing, 'pic': pic, 'toast': toast, 'journal': has, 'sheet': sheet, 'max': await ev("S.pics.length")})
    await ev("closeSheet(); S.pics = S.pics.slice(0, 2)")
    await page.wait_for_timeout(1000)

async def welcome(page, ev):
    # after a quest, the littles who stayed rush over to the party once the results close, and friends hug
    await ev("closeSheet(); S.friends = {}; const stay = S.littles.find(l => !S.party.includes(l.id)); S.friends[pairKey(stay.id, S.party[0])] = 5; S.pet.rest = 100; S.pet.asleep = false; startQuest({seed: 6200, biome: 'mossroot', size: 'nook', name: 'Test'}); finishQuest(false)")
    await page.wait_for_timeout(800)
    waiting = await ev("!!home.welcome && home.welcome.t === 0")
    await ev("closeSheet()"); await page.wait_for_timeout(1700)
    await page.screenshot(path=SHOTS + '/p11_welcome.png')
    near = await ev("(() => { const w = home.welcome; if (!w) return null; const stay = home.lits.filter(f => !w.ids.includes(f.l.id)); return {stay: stay.length, close: stay.filter(f => f.y < home.gy + home.ry * 1.5).length, hugs: Object.keys(w.hugs).length}; })()")
    await page.wait_for_timeout(4500)
    rec('welcome', {'waiting': waiting, 'near': near, 'over': await ev("!home.welcome"), 'back': await ev("home.lits.filter(f => f.perch >= 0).every(f => Math.hypot(f.x - f.hx, f.y - f.hy) < 40)")})

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
        await ev("""() => { window.__fast = true; const r = RNG(5); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r)); S.littles = S.littles.slice(0, 6); S.party = S.littles.slice(0, 3).map(l => l.id); S.quests = 6; S.seen = UNLOCKS.map(u => u.id); S.dust = 200; S.pet.rest = 100; S.pet.belly = 50; S.pet.joy = 50; afterLoad(); closeSheet(); }""")
        await page.wait_for_timeout(1500)
        await spot(page, ev)
        await catch(page, ev)
        await tricks(page, ev)
        await tidy(page, ev)
        await keepsakes(page, ev)
        await tower(page, ev)
        await bedtime(page, ev)
        await nest_life(page, ev)
        await copy_me(page, ev)
        await pictures(page, ev)
        await welcome(page, ev)
        await b.close()
    rec('errors', [e for e in errs if 'Failed to load resource' not in e])
asyncio.run(main())
R = RESULTS
finish([('no page errors', not R['errors']),
        ('the head, cheeks and tummy are told apart', R['spot zones'] == {'head': 'head', 'left': 'left', 'right': 'right', 'tummy': 'tummy'}),
        ('a cheek leans in or the tummy wiggles, and only the favourite spot is found', (R['spot stroke']['plain']['tilt'] != 0 or R['spot stroke']['plain']['wiggle'] > 0 or R['spot stroke']['other'] == 'head') and not R['spot stroke']['plain']['found']),
        ('the favourite spot is found once a day and counts double for a cuddle', R['spot stroke']['found'] and R['spot stroke']['days'] == 1 and 'the spot' in R['spot stroke']['toast'] and R['spot stroke']['got'] - R['spot stroke']['plain']['got'] > R['spot stroke']['plain']['got']),
        ('the journal counts the days the spot was found', R['spot stroke']['journal']),
        ('a berry flicked up from the pantry is caught and eaten', R['catch flick']['flying'] and R['catch flick']['left'] == 5 and R['catch flick']['belly'] >= 17 and R['catch flick']['run'] == 1 and not R['catch flick']['toss']),
        ('catches in a row are counted and the best run kept', R['catch run']['run'] == 2 and R['catch run']['best'] == 2),
        ('a missed berry bounces on the nest and a little takes it as a treat', R['catch miss']['run'] == 0 and R['catch miss']['best'] == 2 and R['catch miss']['left'] == 3 and R['catch miss']['xp'] >= 1),
        ('a circle drawn on the sky makes it try to spin, and a stroke praises it once', R['trick try']['tried']['k'] == 'spin' and R['trick try']['tried']['good'] is False and 'Stroke it' in R['trick try']['tried']['toast'] and R['trick try']['n'] == 1),
        ('five praised tries teach it a trick for good', R['trick learned']['n'] == 5 and R['trick learned']['knows'] and 'learned to spin' in R['trick learned']['toast']),
        ('a learned trick is done neatly and the party joins in', R['trick good']['good'] and R['trick good']['join'] == R['trick good']['party']),
        ('a zigzag asks for a wiggle and a swipe up for a leap', R['trick shapes'] == ['wiggle', 'leap']),
        ('a happy Glimmerkin shows off a learned trick by itself, and the journal lists it', R['trick by itself']['k'] == 'spin' and R['trick by itself']['journal']),
        ('the party comes home with bits of the world on them, and the results say so', 'seaweed from Tidehollow' in R['tidy']['lines'] and all(m and m['b'] == 'tidehollow' and m['n'] == 7 for m in R['tidy']['muck'])),
        ('stroking a little rubs the bits off until it is clean', 0 < (R['tidy']['part'] or 0) < 7 and R['tidy']['clean'] and 'clean again' in R['tidy']['toast'] and R['tidy']['others']),
        ('a little brings home a keepsake and waits beside the Glimmerkin with it', 'found something in Tidehollow' in R['keep offer']['line'] and R['keep offer']['near']),
        ('a tap on that little puts the keepsake on the rim', R['keep offer']['offer'] is None and len(R['keep offer']['keeps']) == 1 and R['keep offer']['keeps'][0]['b'] == 'tidehollow' and 'rim of the nest' in R['keep offer']['toast']),
        ('a tap on a keepsake tells its story, and the journal lists it', 'from Tidehollow, found by' in R['keep story']['toast'] and R['keep story']['journal']),
        ('a full rim takes no more keepsakes', R['keep full']['out'] == [] and R['keep full']['offer'] is None),
        ('a little carried onto another\'s head climbs on top, and the party stays as it was', R['tower']['two']['ids'] and len(R['tower']['two']['ids']) == 2 and 'climbs onto' in R['tower']['two']['toast'] and sorted(R['tower']['two']['party']) == sorted(R['tower']['before'])),
        ('three high stand one above another and wobble', R['tower']['three'] and R['tower']['three']['n'] == 3 and R['tower']['three']['above'] and 'Three high' in R['tower']['three']['toast']),
        ('the tower topples after a few seconds, and the journal keeps the tallest', R['tower']['fell'] and 'Down they go' in R['tower']['toast'] and R['tower']['best'] == 3 and sorted(R['tower']['party']) == sorted(R['tower']['before'])),
        ('at bedtime every little curls up against the Glimmerkin, which dreams of the last world', R['bedtime']['pile']['asleep'] and R['bedtime']['pile']['near'] and R['bedtime']['pile']['dream'] == 'tidehollow'),
        ('a tap on a sleeping little makes it snuggle closer without waking anyone', R['bedtime']['still'] and R['bedtime']['snug'] == 1 and 'snuggles closer' in R['bedtime']['toast']),
        ('on waking the littles go back to their perches', R['bedtime wake']),
        ('the littles chase, doze, tidy a friend and show off by themselves', R['nest life']['chase'] and R['nest life']['nap'] and R['nest life']['groom'] >= 1 and R['nest life']['show']),
        ('nest life waits while the Glimmerkin sleeps or the nest was just touched, and starts by itself when idle', R['nest life']['asleep'] is None and R['nest life']['touched'] is None and R['nest life']['idle']),
        ('copy me shows two, and a round copied right adds one more', R['copy me']['seq'] == 2 and R['copy me']['seq2'] == 3 and R['copy me']['kept']),
        ('a wrong tap ends copy me and keeps the best round', R['copy me']['over'] and R['copy me']['best'] == 1 and 'copied 1 round' in R['copy me']['toast']),
        ('the camera takes a picture while everyone poses, kept small', R['pictures']['posing'] >= 3 and R['pictures']['pic'] and R['pictures']['pic']['n'] == 1 and R['pictures']['pic']['ls'] == R['pictures']['pic']['littles'] and R['pictures']['pic']['pet'] and R['pictures']['pic']['size'] < 1500 and 'Picture taken' in R['pictures']['toast']),
        ('the journal shows pictures and opens one, drawn again', R['pictures']['journal'] and 'with' in R['pictures']['sheet']['text'] and R['pictures']['sheet']['drawn']),
        ('the album keeps twelve', R['pictures']['max'] == 12),
        ('the welcome home waits for the results to close', R['welcome']['waiting']),
        ('the littles who stayed rush over to the party, and a friend hugs', R['welcome']['near'] and R['welcome']['near']['stay'] >= 3 and R['welcome']['near']['close'] == R['welcome']['near']['stay'] and R['welcome']['near']['hugs'] >= 1),
        ('then everyone goes back to their places', R['welcome']['over'] and R['welcome']['back']),
        ('a full Glimmerkin does not play catch', R['catch full']['tide'] == 2 and not R['catch full']['toss'] and 'full' in R['catch full']['toast'])])
