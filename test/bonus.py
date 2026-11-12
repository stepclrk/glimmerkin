# Drives the secret door and each bonus world behind it in a phone-sized headless browser: finding the door,
# stepping through, playing the bonus world to its end, and coming back to the quest with what was earned.
import os, pathlib, tempfile, re, asyncio, json
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def R0(v): return v
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
BOT = re.search(r'BOT = """(.*?)"""', (ROOT / 'test' / 'smoke.py').read_text(), re.S).group(1)

async def new_page(b, errs):
    ctx = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)
    page = await ctx.new_page()
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    await page.add_init_script(SEED_JS)
    await page.goto(PAGE); await page.wait_for_timeout(1300)
    await page.evaluate("window.__fast = true")
    return page

# Start a quest in a world that is sure to hide a door, which leads to one chosen bonus world, and walk to the door.
TO_DOOR = """async (id) => {
  closeSheet(); S.pet.rest = 100; S.pet.joy = 90; S.j.bonus = {}; for (const k of Object.keys(BONUS)) if (k !== id) S.j.bonus[k] = 1;
  let seed = __SEED__; for (;; seed++) { startQuest({seed, biome: '__BIOME__', size: 'vale', name: 'Test', secret: 1}); if (Q.world.secret && Q.world.rule !== 'gloamglass') break; finishQuest(false); closeSheet(); S.pet.rest = 100; }
  const _a = window.anim; window.anim = (d, f) => _a(d * 0.1, f); const bot = __BOT__;
  // play the quest as far as the door: the plan reaches it, so the bot's own clearing gets there
  const w = Q.world, k = w.secret.y * w.W + w.secret.x, tap = () => questTap({x: Q.ox + (w.secret.x + .5) * Q.ts, y: Q.oy + (w.secret.y + .5) * Q.ts});
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 400 && ui.sheet.hidden; i++) {
    while (Q.busy || Q.walking) await sleep(30);
    const prev = flood(w, Q.px, Q.py, Q);
    if (prev.has(k)) { tap(); await sleep(120); continue; }
    let did = false;
    for (let c2 = 0; c2 < w.cells.length && !did; c2++) { const c = w.cells[c2]; if (!c.crit) continue; const x = c2 % w.W, y = Math.floor(c2 / w.W); if (nearIn(w, prev, x, y) < 0) continue;
      if (c.t === 'ob' && !c.cleared && OBST[c.ob].pair) { const [A, B] = OBST[c.ob].pair, free = Q.lits.filter(f => f.sp >= 1), a = free.find(f => f.kinds.includes(A)), b = free.find(f => f !== a && f.kinds.includes(B)), t = free.find(f => f.kinds.includes(A) && f.kinds.includes(B) && f.sp >= 2); if (a && b) { await sendPair([a, b], c2); did = true; } else if (t) { await sendPair([t], c2); did = true; } }
      else if (c.t === 'ob' && !c.cleared) { const f = Q.lits.find(f => f.kinds.some(z => KINDS[z].clears === c.ob) && f.sp >= 1); if (f) { await sendClear(f, c2); did = true; } }
      else if (c.enemy) { const f = Q.lits.filter(f => f.sp >= fightCost(c.enemy, f.kinds, f.ring)).sort((a, b) => b.sp - a.sp)[0]; if (f) { await sendFight(f, c2); did = true; } } }
    if (!did) { if (w.plate && !Q.gateOpen && prev.has(w.plate.y * w.W + w.plate.x)) await sendStation(Q.lits[0]); else if (w.song && !Q.songOpen) { const p = w.song[Q.songAt]; questTap({x: Q.ox + (p.x + .5) * Q.ts, y: Q.oy + (p.y + .5) * Q.ts}); await sleep(150); } else await sleep(100); }
  }
  window.anim = _a;
  return { seed, door: w.secret, at: [Q.px, Q.py], title: ui.sheet.hidden ? '' : ui.sheet.querySelector('h2').textContent, name: ui.sheet.hidden ? '' : ui.sheet.querySelector('strong').textContent, dust: Q.loot.dust };
}"""
def to_door(seed, biome):
    return TO_DOOR.replace('__SEED__', str(seed)).replace('__BIOME__', biome).replace('__BOT__', BOT)
# Finish the quest the bonus world was entered from, and say what came home.
HOME = "async () => { const _a = window.anim; window.anim = (d, f) => _a(d * 0.1, f); const bot = __BOT__; const r = await bot(); window.anim = _a; return { scene, quests: S.quests, dust: S.dust, sheet: r.sheet, bonus: S.j.bonus, stuck: r.log.includes('stuck') }; }".replace('__BOT__', BOT)
STATE = "({scene, id: BW && BW.id, over: BW && BW.over, name: document.querySelector('#q-name').textContent, biome: document.querySelector('#q-biome').textContent, chip: document.querySelector('#q-rule').textContent, hint: document.querySelector('#q-hint').textContent, count: document.querySelector('#q-shards').textContent, barQuest: ui.barQuest.hidden, barBonus: ui.barBonus.hidden, leave: !!ui.barBonus.querySelector('[data-b=leave]')})"
RESULT = "({title: ui.sheet.hidden ? '' : ui.sheet.querySelector('h2').textContent, text: ui.sheet.hidden ? '' : ui.sheet.querySelector('p').textContent, loot: BW && BW.loot, questDust: Q && Q.loot.dust})"
BACK = "({scene, bw: !!BW, used: Q.secretUsed, bag: !document.querySelector('#q-bag').hidden, name: document.querySelector('#q-name').textContent, shards: document.querySelector('#q-shards').textContent, barQuest: ui.barQuest.hidden, chips: ui.barQuest.querySelectorAll('.chip').length})"

async def the_door(b, errs):
    page = await new_page(b, errs); ev = page.evaluate
    # before bonus worlds open, a world built to hide a door hides none
    rec('locked', await ev("(() => { S.pet.rest = 100; startQuest({seed: 77, biome: 'mossroot', size: 'vale', name: 'Test', secret: 1}); const d = !!Q.world.secret; finishQuest(false); closeSheet(); return { door: d, unlocked: unlocked('bonus') }; })()"))
    # the sixth finished quest opens them, and says so
    rec('unlock', await ev("(() => { S.quests = 6; S.seen = UNLOCKS.filter(u => u.id !== 'bonus').map(u => u.id); const due = takeUnlocks(); openUnlocks(due); return { ids: due.map(u => u.id), title: ui.sheet.querySelector('strong').textContent, seen: S.seen.includes('bonus') }; })()"))
    await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/b1_secret_doors_unlock.png'); await ev("closeSheet()")
    # about one world in four hides a door
    rec('rate', await ev("(() => { let n = 0; const party = partyLittles().map(l => ({kind: l.kind, kind2: l.kind2, max: maxSparks(l)})); for (let i = 1; i <= 400; i++) if (genWorld(i * 31, party, 6, 'vale', BIOMES[i % 6].id, {secret: true}).secret) n++; return n; })()"))
    door = rec('door', await ev(to_door(9100, 'emberfall'), 'starfall'))
    await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/b2_secret_door.png')
    # "Not now" leaves the door where it is; tapping it again asks again
    await page.click('#sheet [data-do="no"]'); await page.wait_for_timeout(2600); await page.screenshot(path=SHOTS + '/b2b_door_in_world.png')
    rec('not now', await ev("(async () => { const a = { scene, used: !!Q.secretUsed, sheet: !ui.sheet.hidden }; questTap({x: Q.ox + (Q.world.secret.x + .5) * Q.ts, y: Q.oy + (Q.world.secret.y + .5) * Q.ts}); await new Promise(r => setTimeout(r, 300)); a.again = !ui.sheet.hidden && ui.sheet.querySelector('h2').textContent; return a; })()"))
    await page.context.close()
    return door

async def starfall(b, errs):
    page = await new_page(b, errs); ev = page.evaluate
    await ev("S.quests = 6; S.seen = UNLOCKS.map(u => u.id)")
    before = await ev("S.dust")
    rec('starfall door', await ev(to_door(9200, 'cloudspire'), 'starfall'))
    await page.click('#sheet [data-do="go"]'); await page.wait_for_timeout(300)
    rec('starfall start', await ev(STATE))
    # the rule's name at the top opens its text
    await page.click('#q-rule'); await page.wait_for_timeout(150)
    rec('starfall rule', await ev("ui.sheet.querySelector('h2').textContent + ' | ' + ui.sheet.querySelector('p').textContent.slice(0, 40)")); await ev("closeSheet()")
    # a real drag moves the cloud
    box = await page.evaluate("({x: BW.x, y: BW.y, w: BW.w, h: BW.h})")
    await page.mouse.move(box['x'] + box['w'] * 0.5, box['y'] + box['h'] * 0.5); await page.mouse.down(); await page.mouse.move(box['x'] + box['w'] * 0.8, box['y'] + box['h'] * 0.6, steps=6); await page.wait_for_timeout(500)
    rec('starfall drag', await ev("({go: BW.go, tx: Math.round(BW.tx * 100) / 100, cx: Math.round(BW.cx * 100) / 100})")); await page.mouse.up()
    # steer into the first gloom on purpose: the cloud wobbles, motes fly back up, and nothing ends
    rec('starfall bump', await ev("""async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); const g = BW.drops.find(d => d.k === 'gloom' && d.st === 0 && d.t > BW.clock + 1);
      while (BW.clock < g.t - 2.5) { const d = BW.drops.find(d => d.st === 0 && d.k !== 'gloom' && d.up === undefined); BW.tx = d.x; await sleep(16); }
      const had = BW.points, n = BW.drops.length; while (g.st === 0) { BW.tx = g.x; await sleep(16); }
      return { caught: g.st === 1, had, now: BW.points, tossed: BW.drops.length - n, bumps: BW.bumps, over: BW.over }; }"""))
    await page.screenshot(path=SHOTS + '/b3_starfall.png')
    # then play it properly to the end: go to each mote and shard in turn, and keep clear of glooms
    rec('starfall play', await ev("""async () => { const sleep = ms => new Promise(r => setTimeout(r, ms));
      while (!BW.over) { const d = BW.drops.filter(d => d.st === 0 && d.k !== 'gloom').sort((a, b) => a.t - b.t)[0]; if (d) BW.tx = d.x; await sleep(16); }
      return { points: BW.points, shards: BW.shards, caught: BW.caught, of: BW.fall.drops.filter(d => d.k !== 'gloom').length, bumps: BW.bumps, clock: Math.round(BW.clock) }; }"""))
    await page.wait_for_timeout(300); res = rec('starfall result', await ev(RESULT)); await page.screenshot(path=SHOTS + '/b4_starfall_result.png')
    await page.click('#sheet [data-do="ok"]'); await page.wait_for_timeout(200)
    rec('starfall back', await ev(BACK))
    rec('starfall home', await ev(HOME))
    rec('starfall paid', (await ev("S.dust")) - before)
    await ev("closeSheet(); openJournal()"); await page.wait_for_timeout(150)
    rec('journal', await ev("[...ui.sheet.querySelectorAll('h3')].map(e => e.textContent).filter(t => t.startsWith('Bonus'))"))
    await ev("closeSheet()")
    # leaving early: what was earned so far still comes back to the quest
    rec('early door', (await ev(to_door(9300, 'tidehollow'), 'starfall'))['title'])
    await page.click('#sheet [data-do="go"]'); await page.wait_for_timeout(400)
    await page.click('#bar-bonus [data-b="leave"]'); await page.wait_for_timeout(200)
    rec('early result', await ev(RESULT)); await page.click('#sheet [data-do="ok"]'); await page.wait_for_timeout(200)
    rec('early back', await ev(BACK))
    await ev("finishQuest(false); closeSheet()")
    await page.context.close()

async def garden(b, errs):
    page = await new_page(b, errs); ev = page.evaluate
    await ev("S.quests = 6; S.seen = UNLOCKS.map(u => u.id)")
    pantry = await ev("Object.values(S.pantry).reduce((a, n) => a + n, 0)")
    rec('garden door', (await ev(to_door(9400, 'mossroot'), 'garden'))['name'])
    await page.click('#sheet [data-do="go"]'); await page.wait_for_timeout(300)
    rec('garden start', await ev(STATE))
    rec('garden made', await ev("({pieces: BW.pieces.map(p => p.kinds), wild: BW.pieces.filter(p => p.wild).length, party: BW.lits.length, buds: BW.g.buds.length, ways: BW.g.ways, placed: BW.pieces.filter(p => p.at).length})"))
    await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/b5_garden_start.png')
    pos = "(i => { const D = BW.D, s = D.slot(BW, i), a = BW.g.answer[i], bud = BW.g.buds[0]; return { sx: s.x, sy: s.y - 10, ax: BW.ox + (a.x + .5) * BW.ts, ay: BW.oy + (a.y + .5) * BW.ts, bx: BW.ox + (bud.x + .5) * BW.ts, by: BW.oy + (bud.y + .5) * BW.ts }; })"
    # the first little is dragged from the tray, first onto a bud (refused), then onto its tile
    p0 = await ev(pos + "(0)")
    await page.mouse.move(p0['sx'], p0['sy']); await page.mouse.down(); await page.mouse.move(p0['bx'], p0['by'], steps=8); await page.mouse.up(); await page.wait_for_timeout(150)
    rec('garden on a bud', await ev("({at: BW.pieces[0].at, toast: ui.toast.textContent})"))
    await ev("BW.sel = null")
    await page.mouse.move(p0['sx'], p0['sy']); await page.mouse.down(); await page.mouse.move(p0['ax'], p0['ay'], steps=8); await page.wait_for_timeout(100); await page.screenshot(path=SHOTS + '/b6_garden_drag.png'); await page.mouse.up(); await page.wait_for_timeout(200)
    rec('garden dragged', await ev("({at: BW.pieces[0].at, want: BW.g.answer[0], open: BW.open.filter(Boolean).length})"))
    # the second is tapped, then its tile is tapped
    p1 = await ev(pos + "(1)")
    await page.mouse.click(p1['sx'], p1['sy']); await page.wait_for_timeout(100)
    rec('garden picked', await ev("({sel: BW.sel, hint: document.querySelector('#q-hint').textContent})"))
    await page.mouse.click(p1['ax'], p1['ay']); await page.wait_for_timeout(200)
    rec('garden tapped', await ev("({at: BW.pieces[1].at, want: BW.g.answer[1], sel: BW.sel, open: BW.open.filter(Boolean).length, count: document.querySelector('#q-shards').textContent})"))
    # left alone for a while, the garden shows where the last little goes
    await page.wait_for_timeout(8200)
    rec('garden hint', await ev("({for: BW.hintFor, hint: document.querySelector('#q-hint').textContent})")); await page.screenshot(path=SHOTS + '/b7_garden_hint.png')
    p2 = await ev(pos + "(2)")
    await page.mouse.click(p2['sx'], p2['sy']); await page.mouse.click(p2['ax'], p2['ay']); await page.wait_for_timeout(250)
    rec('garden won', await ev("({won: !!BW.won, open: BW.open.every(Boolean)})")); await page.screenshot(path=SHOTS + '/b8_garden_blooms.png')
    await page.wait_for_function("BW && BW.over", timeout=5000); await page.wait_for_timeout(200)
    rec('garden result', await ev(RESULT)); rec('garden pay', await ev("gardenPay(BW.g)"))
    await page.click('#sheet [data-do="ok"]'); await page.wait_for_timeout(200)
    rec('garden back', await ev(BACK)); rec('garden home', await ev(HOME))
    rec('garden berries', (await ev("Object.values(S.pantry).reduce((a, n) => a + n, 0)")) - pantry)
    await ev("closeSheet()")
    await page.context.close()

async def hide(b, errs):
    page = await new_page(b, errs); ev = page.evaluate
    await ev("S.quests = 6; S.seen = UNLOCKS.map(u => u.id)")
    eggs = await ev("S.eggs.length")
    rec('hide door', (await ev(to_door(9500, 'stonesong'), 'hide'))['name'])
    await page.click('#sheet [data-do="go"]'); await page.wait_for_timeout(400)
    rec('hide start', await ev(STATE))
    rec('hide made', await ev("({hiders: BW.hid.length, wild: BW.hid.filter(h => h.h.wild).length, party: BW.lits.length, names: BW.hid.map(h => h.name), cam: BW.cam, w: BW.w, egg: BW.g.egg})"))
    await page.screenshot(path=SHOTS + '/b9_hide_start.png')
    # a real drag pans the scene, and stops at its edge
    box = await ev("({x: BW.x, y: BW.y, w: BW.w, h: BW.h})"); my = box['y'] + box['h'] * 0.3
    await page.mouse.move(box['x'] + 300, my); await page.mouse.down(); await page.mouse.move(box['x'] + 60, my, steps=6); await page.mouse.up()
    cam1 = await ev("BW.cam")
    for i in range(4):
        await page.mouse.move(box['x'] + 350, my); await page.mouse.down(); await page.mouse.move(box['x'] + 20, my, steps=4); await page.mouse.up()
    rec('hide pan', {'moved': cam1 - R0(await ev("BW.w")), 'edge': await ev("BW.cam === BW.w * (HIDE.screens - 1)"), 'found': await ev("BW.hid.filter(h => h.found).length")})
    # a tap on nothing finds nothing
    await page.mouse.click(box['x'] + 30, box['y'] + 30)
    rec('hide miss', await ev("({taps: BW.taps, found: BW.hid.filter(h => h.found).length})"))
    # left alone, the nearest hiding place rustles
    await page.wait_for_timeout(5600)
    rec('hide rustle', await ev("({on: !!BW.rustle, hint: document.querySelector('#q-hint').textContent})")); await page.screenshot(path=SHOTS + '/b10_hide_rustle.png')
    # find each in turn: look towards it, then tap the part that shows
    for k in range(5):
        pt = await ev("(k => { const pl = BW.D.place(BW, k); BW.cam = clamp(pl.mx - BW.w / 2, 0, BW.w * (HIDE.screens - 1)); return { x: BW.x + pl.mx - BW.cam, y: pl.my }; })(%d)" % k)
        await page.wait_for_timeout(120)
        if k == 1: await page.screenshot(path=SHOTS + '/b11_hide_spot.png')
        await page.mouse.click(pt['x'], pt['y']); await page.wait_for_timeout(150)
        if k == 1: await page.wait_for_timeout(500); await page.screenshot(path=SHOTS + '/b12_hide_found.png')
    rec('hide all', await ev("({found: BW.hid.filter(h => h.found).length, won: !!BW.won, count: document.querySelector('#q-shards').textContent})"))
    await page.wait_for_function("BW && BW.over", timeout=5000); await page.wait_for_timeout(200)
    rec('hide result', await ev(RESULT))
    await page.click('#sheet [data-do="ok"]'); await page.wait_for_timeout(200)
    rec('hide back', await ev(BACK)); rec('hide home', await ev(HOME))
    rec('hide egg', await ev("(n => { const e = S.eggs[S.eggs.length - 1]; return { more: S.eggs.length - n, kinds: e && e.kinds, twin: e && e.twin }; })(%d)" % eggs))
    # the egg hatches a little of the wild one's kind
    rec('hide hatch', await ev("(() => { closeSheet(); const i = S.eggs.length - 1, k = S.eggs[i].kinds[0]; hatch(i); const l = S.littles[S.littles.length - 1]; closeSheet(); return l.kind === k && !l.kind2; })()"))
    # with the nest full the wild littles leave stardust instead
    rec('hide full', await ev("(() => { const b = { hid: [1, 2, 3, 4, 5].map(() => ({ found: 1 })), g: { egg: 'tide' }, loot: { dust: 0, eggs: [] }, q: { loot: { eggs: [] } } }; const keep = S.eggs; S.eggs = Array(8).fill({}); const line = BONUS.hide.end(b, false); S.eggs = keep; return { dust: b.loot.dust, eggs: b.loot.eggs.length, line }; })()"))
    await page.context.close()

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        await the_door(b, errs)
        await starfall(b, errs)
        await garden(b, errs)
        await hide(b, errs)
        await b.close()
    R = RESULTS; print('errors', errs)
    sf, sp = R['starfall start'], R['starfall play']
    gm, gp = R['garden made'], R['garden pay']
    finish([
        ('no errors', not errs),
        ('no door before bonus worlds open', R['locked'] == {'door': False, 'unlocked': False}),
        ('the sixth quest opens secret doors and says so', R['unlock'] == {'ids': ['bonus'], 'title': 'Secret doors', 'seen': True}),
        ('about one world in four hides a door', 70 <= R['rate'] <= 130),
        ('walking onto the door asks before going through', R['door']['title'] == 'A secret door' and R['door']['name'] == 'Starfall' and R['door']['at'] == [R['door']['door']['x'], R['door']['door']['y']]),
        ('not now keeps the door, and it asks again', R['not now'] == {'scene': 'quest', 'used': False, 'sheet': False, 'again': 'A secret door'}),
        ('stepping through starts starfall with its own top and bar', sf['scene'] == 'bonus' and sf['id'] == 'starfall' and sf['biome'] == 'Bonus world' and sf['chip'] == 'Starfall' and sf['barQuest'] and not sf['barBonus'] and sf['leave'] and sf['hint'].startswith('Drag')),
        ('the name at the top explains starfall', R['starfall rule'].startswith('Starfall | Motes of light')),
        ('dragging moves the cloud', R['starfall drag']['go'] and R['starfall drag']['tx'] == 0.8 and R['starfall drag']['cx'] > 0.6),
        ('a gloom only bumps: motes fly back up and play goes on', R['starfall bump']['caught'] and R['starfall bump']['bumps'] == 1 and R['starfall bump']['tossed'] == min(3, R['starfall bump']['had']) and R['starfall bump']['now'] == R['starfall bump']['had'] - R['starfall bump']['tossed'] and not R['starfall bump']['over']),
        ('starfall can be played to the end, catching nearly everything', sp['caught'] >= sp['of'] * 0.9 and sp['bumps'] == 1 and sp['clock'] >= 60),
        ('the results pay stardust into the quest', R['starfall result']['title'] == 'Starfall' and 10 <= R['starfall result']['loot']['dust'] <= 30 and R['starfall result']['questDust'] >= R['starfall result']['loot']['dust']),
        ('back in the quest where it was left, the door gone', R['starfall back']['scene'] == 'quest' and not R['starfall back']['bw'] and R['starfall back']['used'] and R['starfall back']['bag'] and R['starfall back']['name'] == 'Test' and not R['starfall back']['barQuest'] and R['starfall back']['chips'] >= 1),
        ('the quest still finishes, and the stardust comes home', R['starfall home']['sheet'] == 'Through the portal' and not R['starfall home']['stuck'] and R['starfall home']['bonus'].get('starfall') == 1 and R['starfall paid'] >= R['starfall result']['loot']['dust'] + 15),
        ('the journal counts bonus worlds', len(R['journal']) == 1 and re.match(r'Bonus worlds · \d of \d$', R['journal'][0])),
        ('the garden door leads to the night garden', R['garden door'] == 'Night garden' and R['garden start']['id'] == 'garden' and R['garden start']['chip'] == 'Night garden'),
        ('a garden has three littles, wild ones making up the number', len(gm['pieces']) == 3 and gm['wild'] == 3 - gm['party'] and gm['buds'] >= 6 and gm['ways'] >= 1 and gm['placed'] == 0),
        ('a little cannot stand on a bud', R['garden on a bud']['at'] is None and 'bud' in R['garden on a bud']['toast']),
        ('a little can be dragged onto a tile, and buds it reaches open', R['garden dragged']['at'] == R['garden dragged']['want'] and R['garden dragged']['open'] >= 2),
        ('tapping a little says where it reaches, and a tapped tile takes it', R['garden picked']['sel'] == 1 and 'reaches' in R['garden picked']['hint'] and R['garden tapped']['at'] == R['garden tapped']['want'] and R['garden tapped']['sel'] is None and R['garden tapped']['count'].startswith('Blooming ' + str(R['garden tapped']['open']))),
        ('after a while a tile glimmers for a little not yet in place', R['garden hint']['for'] == 2 and R['garden hint']['hint'].startswith('Stuck?')),
        ('with all three placed every bud opens', R['garden won'] == {'won': True, 'open': True}),
        ('the garden pays berries and stardust into the quest', R['garden result']['title'] == 'Night garden' and R['garden result']['loot']['berries'] == gp['berries'] and R['garden result']['loot']['dust'] == gp['dust'] and gp['dust'] == 8 and sum(gp['berries'].values()) >= 3),
        ('back from the garden the quest finishes and the berries come home', R['garden back']['scene'] == 'quest' and R['garden back']['used'] and R['garden home']['sheet'] == 'Through the portal' and R['garden home']['bonus'].get('garden') == 1 and R['garden berries'] >= sum(gp['berries'].values())),
        ('the hide and seek door leads to hide and seek', R['hide door'] == 'Hide and seek' and R['hide start']['id'] == 'hide'),
        ('five hide: the party and wild littles', R['hide made']['hiders'] == 5 and R['hide made']['wild'] == 5 - R['hide made']['party'] and R['hide made']['cam'] == R['hide made']['w'] and R['hide made']['egg'] in ['ember', 'tide', 'stone', 'bloom', 'gale', 'glow']),
        ('dragging looks around, as far as the edge, and finds nobody', R['hide pan']['moved'] == 240 and R['hide pan']['edge'] and R['hide pan']['found'] == 0),
        ('a tap on nothing finds nothing', R['hide miss']['taps'] >= 1 and R['hide miss']['found'] == 0),
        ('a hiding place rustles after a while', R['hide rustle']['on'] and 'rustles' in R['hide rustle']['hint']),
        ('tapping the part that shows finds each little', R['hide all'] == {'found': 5, 'won': True, 'count': 'Found 5 of 5'}),
        ('finding all five pays stardust and a wild egg', R['hide result']['loot']['dust'] == 15 and len(R['hide result']['loot']['eggs']) == 1 and R['hide result']['loot']['eggs'][0]['kinds'] == [R['hide made']['egg']]),
        ('the egg comes home and hatches the wild kind', R['hide back']['scene'] == 'quest' and R['hide home']['sheet'] == 'Through the portal' and R['hide egg']['more'] >= 1 and R['hide egg']['kinds'] == [R['hide made']['egg']] and R['hide hatch']),
        ('a full nest gets stardust instead of the egg', R['hide full']['dust'] == 27 and R['hide full']['eggs'] == 0 and 'nest is full' in R['hide full']['line']),
        ('leaving early pays what was earned so far', R['early result']['title'] == 'Starfall' and R['early result']['loot']['dust'] < 10 and R['early back']['scene'] == 'quest' and R['early back']['used']),
    ])
asyncio.run(main())
