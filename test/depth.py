# Drives the deeper solo play in a phone-sized headless browser: wishes, world rules, littles working
# together, Mythic forms, the journey, and the littles in the nest.
import os, pathlib, tempfile, re, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
BOT = re.search(r'BOT = """(.*?)"""', (ROOT / 'test' / 'smoke.py').read_text(), re.S).group(1)
FAST = "const _a = window.anim; window.anim = (d, f) => _a(d * 0.1, f); const bot = __BOT__;".replace('__BOT__', BOT)

async def wishes(page, ev):
    rec('wish start', await ev("({has: !!S.wish, day: S.wish.day === localDay(), kind: S.wish.k})"))
    # a berry wish comes true when that berry is eaten
    await ev("S.wish = {day: localDay(), n: 0, k: 'eat', a: 'tide', got: 0, need: 1, done: false}; S.pantry.tide = 2; S.pet.belly = 50; S.pet.joy = 70")
    xp = await ev("S.pet.xp")
    await page.click('[data-act="feed"]'); await page.wait_for_timeout(150); await page.click('[data-food="tide"]'); await page.wait_for_timeout(900)
    rec('wish eat', await ev("({granted: S.j.wishes, next: S.wish.n, waits: S.wish.wait > Date.now(), gained: S.pet.xp - %s})" % xp))
    await ev("ui.tray.hidden = true")
    # the bubble shows the wish and opens it
    await ev("S.wish = {day: localDay(), n: 1, k: 'cuddle', a: '', got: 0, need: 24, done: false}; S.pet.belly = 80; S.pet.joy = 80; S.pet.rest = 90; S.pet.asleep = false")
    await page.wait_for_timeout(2600); await page.screenshot(path=SHOTS + "/d1_wish.png")
    b = await ev("home.bubble"); await page.mouse.click(b['x'], b['y']); await page.wait_for_timeout(250)
    rec('wish sheet', await ev("document.querySelector('#sheet h2').textContent + ' | ' + document.querySelector('#sheet p').textContent"))
    await page.screenshot(path=SHOTS + '/d2_wish_sheet.png'); await ev("closeSheet()")
    # a trip wish keeps its world on offer and is granted by finishing a quest there
    await ev("S.wish = {day: localDay(), n: 2, k: 'visit', a: 'stonesong', got: 0, need: 1, done: false}; rollPortals(true)")
    res = await ev("async () => { %s const i = S.portals.list.findIndex(o => o.biome === 'stonesong'); S.pet.rest = 100; startQuest(S.portals.list[i]); const r = await bot(); window.anim = _a; return {offered: i >= 0, scene: r.scene, granted: S.j.wishes, lines: [...document.querySelectorAll('#sheet li')].map(e => e.textContent)}; }" % FAST)
    rec('wish visit', res); await ev("closeSheet()")

def quest_js(biome, seed, size, kinds):
    # a quest in one world type with a chosen party, after the first quest so the world's rule applies
    return "S.quests = Math.max(S.quests, 3); S.pet.rest = 100; S.pet.joy = 90; S.party = %s.map(k => S.littles.find(l => l.kind === k && !l.kind2).id); startQuest({seed: %d, biome: '%s', size: '%s', name: 'Test'})" % (kinds, seed, biome, size)
async def finish_quest(ev):
    return await ev("async () => { %s const r = await bot(); window.anim = _a; return {log: r.log.join(','), scene: r.scene}; }" % FAST)

async def tides(page, ev):
    await ev("closeSheet(); " + quest_js('tidehollow', 3101, 'realm', "['tide', 'ember', 'bloom']"))
    await page.wait_for_timeout(400)
    rec('tide world', await ev("({rule: Q.rule, flats: Q.world.cells.filter(c => c.flat).length, chip: document.getElementById('q-rule').textContent})"))
    await ev("Q.tide = true; Q.tideT = 0; Q.tideLv = 1; updateRuleChip()"); await page.wait_for_timeout(300)
    await page.screenshot(path=SHOTS + '/d3_tide_in.png')
    # with the tide in a flat cannot be walked onto; a Tide little freezes one for good
    k = await ev("(() => { const w = Q.world, prev = flood(w, Q.px, Q.py, Q); for (let k = 0; k < w.cells.length; k++) { const c = w.cells[k]; if (c.flat && !prev.has(k) && nearIn(w, prev, k % w.W, Math.floor(k / w.W)) >= 0) return k; } for (const [dx, dy] of DIRS) { const x = Q.px + dx, y = Q.py + dy, c = w.cells[y * w.W + x]; if (x >= 0 && y >= 0 && x < w.W && y < w.H && c.t === 'floor' && !c.enemy) { c.flat = true; return y * w.W + x; } } return -1; })()")
    if k >= 0:
        await ev("(k => { const w = Q.world; questTap({x: Q.ox + (k %% w.W + .5) * Q.ts, y: Q.oy + (Math.floor(k / w.W) + .5) * Q.ts}); })(%d)" % k); await page.wait_for_timeout(250)
        await page.screenshot(path=SHOTS + '/d4_tide_sheet.png')
        title = await ev("document.querySelector('#sheet strong').textContent")
        await page.click('#sheet [data-do="send"]:not([disabled])'); await page.wait_for_timeout(1800)
        rec('tide freeze', {'title': title, 'frozen': await ev("Q.world.cells[%d].frozen === true" % k), 'walkable': await ev("passable(Q.world, %d %% Q.world.W, Math.floor(%d / Q.world.W), Q)" % (k, k))})
    else:
        rec('tide freeze', {'title': 'no flat in reach', 'frozen': True, 'walkable': True})
    rec('tide quest', await finish_quest(ev)); await ev("closeSheet()")

async def darkness(page, ev):
    await ev("closeSheet(); " + quest_js('gloamglass', 3203, 'realm', "['glow', 'stone', 'gale']"))
    await page.wait_for_timeout(500); await page.screenshot(path=SHOTS + '/d5_dark.png')
    rec('dark world', await ev("({rule: Q.rule, lamps: Q.world.cells.filter(c => c.lamp).length, seen: Q.seen.filter(Boolean).length, cells: Q.world.cells.length, r: Q.lightR})"))
    # a tap on a tile nobody has seen does nothing but explain
    k = await ev("(() => { for (let k = 0; k < Q.seen.length; k++) if (!Q.seen[k]) return k; return -1; })()")
    await ev("(k => { const w = Q.world; questTap({x: Q.ox + (k %% w.W + .5) * Q.ts, y: Q.oy + (Math.floor(k / w.W) + .5) * Q.ts}); })(%d)" % k); await page.wait_for_timeout(200)
    rec('dark tap', await ev("({toast: document.getElementById('toast').textContent, walking: Q.walking})"))
    rec('dark quest', await finish_quest(ev))
    rec('dark after', await ev("({lit: true})")); await ev("closeSheet()")

async def song(page, ev):
    await ev("closeSheet(); " + quest_js('stonesong', 3307, 'realm', "['stone', 'bloom', 'ember']"))
    await page.wait_for_timeout(400)
    rec('song world', await ev("({rule: Q.rule, stones: (Q.world.song || []).length, door: Q.world.door && Q.world.cells[Q.world.door.y * Q.world.W + Q.world.door.x].t, closed: !passable(Q.world, Q.world.door.x, Q.world.door.y, Q)})"))
    await ev("(() => { const w = Q.world; questTap({x: Q.ox + (w.door.x + .5) * Q.ts, y: Q.oy + (w.door.y + .5) * Q.ts}); })()"); await page.wait_for_timeout(250)
    await page.screenshot(path=SHOTS + '/d6_song_door.png')
    rec('song sheet', await ev("document.querySelector('#sheet strong').textContent")); await ev("closeSheet()")
    # stones in order count up; a wrong stone starts again
    rec('song order', await ev("(() => { const w = Q.world, k = p => p.y * w.W + p.x, out = []; ruleStep(Q, k(w.song[0])); out.push(Q.songAt); ruleStep(Q, k(w.song[2] || w.song[1])); out.push(Q.songAt); ruleStep(Q, k(w.song[0])); out.push(Q.songAt); Q.songAt = 0; updateRuleChip(); return out; })()"))
    rec('song quest', await finish_quest(ev)); await ev("closeSheet()")

async def gusts(page, ev):
    await ev("closeSheet(); " + quest_js('cloudspire', 3409, 'realm', "['gale', 'tide', 'glow']"))
    await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/d7_gusts.png')
    rec('gust world', await ev("({rule: Q.rule, pads: Q.world.cells.filter(c => c.pad !== undefined).length})"))
    # stepping onto a wind pad lands on its twin
    rec('gust ride', await ev("async () => { const w = Q.world; let k = -1, n = null; for (let i = 0; i < w.cells.length && !n; i++) { if (w.cells[i].pad === undefined) continue; const x = i % w.W, y = Math.floor(i / w.W); n = DIRS.map(([dx, dy]) => [x + dx, y + dy]).find(([a, b]) => a >= 0 && b >= 0 && a < w.W && b < w.H && w.cells[b * w.W + a].t === 'floor' && w.cells[b * w.W + a].pad === undefined && !w.cells[b * w.W + a].enemy); k = i; } Q.px = Q.fx = n[0]; Q.py = Q.fy = n[1]; const _a = window.anim; window.anim = (d, f) => _a(d * 0.1, f); await doWalk(w.cells[k].pad); window.anim = _a; return {at: Q.py * w.W + Q.px, twin: w.cells[k].pad}; }"))
    await ev("(() => { const w = Q.world; Q.px = Q.fx = w.start.x; Q.py = Q.fy = w.start.y; })()")
    rec('gust quest', await finish_quest(ev)); await ev("closeSheet()")

async def moss(page, ev):
    await ev("closeSheet(); " + quest_js('mossroot', 3511, 'realm', "['bloom', 'ember', 'stone']"))
    await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/d8_moss.png')
    rec('moss world', await ev("({rule: Q.rule, slick: Q.world.cells.filter(c => c.slick).length})"))
    # a step onto moss slides on: find a move from a reachable tile that lands two or more tiles away
    rec('moss slide', await ev("async () => { const w = Q.world, prev = flood(w, Q.px, Q.py, Q); for (const k of prev.keys()) { const x = k % w.W, y = Math.floor(k / w.W); for (const [dx, dy] of DIRS) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= w.W || b >= w.H || !w.cells[b * w.W + a].slick || !passable(w, a, b, Q)) continue; const end = landing(w, a, b, dx, dy, Q); if (end === b * w.W + a) continue; const _a = window.anim; window.anim = (d, f) => _a(d * 0.1, f); await doWalk(k); Q.walkTok++; await doWalk(end); window.anim = _a; return {slid: true, at: Q.py * w.W + Q.px, end}; } } return {slid: false}; }"))
    await ev("(() => { const w = Q.world; Q.px = Q.fx = w.start.x; Q.py = Q.fy = w.start.y; })()")
    rec('moss quest', await finish_quest(ev)); await ev("closeSheet()")

async def fire(page, ev):
    # find a world where a bramble that can spread fire to a thicket is in reach from the start
    await ev("""(() => { for (let seed = 3613; seed < 3713; seed++) { closeSheet(); %s; const w = Q.world, prev = flood(w, Q.px, Q.py, Q);
      if (w.cells.some((c, i) => c.t === 'ob' && c.ob === 'bramble' && nearIn(w, prev, i %% w.W, Math.floor(i / w.W)) >= 0 && fireFrom(w, i).some(v => v.some(a => w.cells[a].t === 'thicket')))) return seed;
      Q = null; scene = 'home'; setSceneUI(); } return -1; })()""" % quest_js('emberfall', 0, 'realm', "['ember', 'tide', 'stone']").replace('seed: 0', 'seed'))
    await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/d9_fire.png')
    rec('fire world', await ev("({rule: Q.rule, thickets: Q.world.cells.filter(c => c.t === 'thicket').length})"))
    # burn a bramble that touches others: the fire spreads; give one if this world has none in reach
    rec('fire spread', await ev("async () => { const w = Q.world, prev = flood(w, Q.px, Q.py, Q); let k = -1; for (let i = 0; i < w.cells.length; i++) { const c = w.cells[i]; if (c.t === 'ob' && c.ob === 'bramble' && !c.cleared && nearIn(w, prev, i % w.W, Math.floor(i / w.W)) >= 0) { k = i; if (fireFrom(w, i).length > 1) break; } } if (k < 0) return {k}; const x = k % w.W, y = Math.floor(k / w.W); let t = -1; for (let dy = -1; dy <= 1 && t < 0; dy++) for (let dx = -1; dx <= 1; dx++) { const a = x + dx, b = y + dy; if ((dx || dy) && a >= 0 && b >= 0 && a < w.W && b < w.H && (w.cells[b * w.W + a].t === 'thicket')) { t = b * w.W + a; break; } } if (t < 0) { for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < w.W && b < w.H && w.cells[b * w.W + a].t === 'wall') { w.cells[b * w.W + a].t = 'thicket'; t = b * w.W + a; break; } } } const _a = window.anim; window.anim = (d, f) => _a(d * 0.1, f); const f = Q.lits.find(f => f.kinds.includes('ember')); await sendClear(f, k); await new Promise(r => setTimeout(r, 1500)); window.anim = _a; return {k, thicket: t, burnt: t >= 0 && w.cells[t].t === 'floor' && !!w.cells[t].ash, toast: document.getElementById('toast').textContent}; }"))
    await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/d10_fire_after.png')
    rec('fire quest', await finish_quest(ev)); await ev("closeSheet()")

FIND = '''(() => { for (let seed = %d; seed < %d; seed++) { closeSheet(); S.quests = 6; S.pet.rest = 100; S.pet.joy = 90; S.party = %s; startQuest({seed, biome: '%s', size: 'realm', name: 'Test'}); const w = Q.world, prev = flood(w, Q.px, Q.py, Q);
  if (w.cells.some((c, i) => c.crit && c.t === 'ob' && OBST[c.ob].pair && %s)) return seed; Q = null; scene = 'home'; setSceneUI(); } return -1; })()'''
async def together(page, ev):
    pick = "['ember', 'tide', 'stone'].map(k => S.littles.find(l => l.kind === k && !l.kind2).id)"
    rec('pair seed', await ev(FIND % (5000, 5200, pick, 'tidehollow', "nearIn(w, prev, i % w.W, Math.floor(i / w.W)) >= 0"))); await page.wait_for_timeout(300)
    k = await ev("Q.world.cells.findIndex((c, i) => c.crit && c.t === 'ob' && OBST[c.ob].pair)")
    await ev("(k => { const w = Q.world; questTap({x: Q.ox + (k %% w.W + .5) * Q.ts, y: Q.oy + (Math.floor(k / w.W) + .5) * Q.ts}); })(%d)" % k); await page.wait_for_timeout(250)
    await page.screenshot(path=SHOTS + '/d11_pair_sheet.png')
    rows = await ev("[...document.querySelectorAll('#sheet [data-do=send]')].map(b => b.dataset.i + ':' + b.querySelector('strong').textContent + (b.disabled ? ':off' : ''))")
    sp = await ev("Q.lits.map(f => f.sp)")
    await page.click('#sheet [data-do="send"]:not([disabled])'); await page.wait_for_timeout(2500)
    rec('pair clear', {'rows': rows, 'cleared': await ev("Q.world.cells[%d].cleared === true" % k), 'before': sp, 'after': await ev("Q.lits.map(f => f.sp)"), 'journal': await ev("(S.j.pairs || {}).fog || 0")})
    rec('pair quest', await finish_quest(ev)); await ev("closeSheet()")
    # a twin with both kinds does it alone
    await ev("(() => { const r = RNG(77); const t = newLittle('ember', r, 'tide'); S.littles.push(t); S.j.twins = 1; })()")
    tpick = "[S.littles[S.littles.length - 1].id].concat(['gale', 'glow'].map(k => S.littles.find(l => l.kind === k && !l.kind2).id))"
    rec('twin seed', await ev(FIND % (6000, 6300, tpick, 'emberfall', "true")))
    rec('quest sheet line', await ev("togetherLine()"))
    rec('twin quest', await finish_quest(ev)); await ev("closeSheet(); S.littles.pop()")

async def forms(page, ev):
    await ev("closeSheet(); S.pet.form = undefined; S.pet.xp = petNeed(9) - 1; S.pet.ate = {tide: 30, ember: 4}; S.pet.diet = {tide: 2}; home.look = petLook(S.pet)")
    rec('form leaning', await ev("formFor(S.pet, S.j.biomes)"))
    msg = await ev("(() => { const m = gainXp(5); updateHud(); return m; })()")   # callers refresh the HUD after gainXp, as finishQuest does
    await page.wait_for_timeout(600); await page.screenshot(path=SHOTS + '/d12_mythic.png')
    rec('form grown', {'form': await ev("S.pet.form"), 'msg': msg, 'tag': await ev("document.getElementById('stage-tag').textContent"), 'look': await ev("home.look.form")})
    # a Mythic from before forms existed is given one when its save loads
    rec('form old save', await ev("(() => { S.pet.form = undefined; S.pet.ate = undefined; S.pet.diet = {bloom: 20}; afterLoad(); return S.pet.form + JSON.stringify(formScores(S.pet, S.j.biomes)); })()"))
    await ev("S.pet.form = 'tide'; afterLoad()")
    await page.click('#btn-journal'); await page.wait_for_timeout(300)
    rec('form journal', await ev("[...document.querySelectorAll('#sheet p.dim')].map(p => p.textContent).find(t => t.includes('Tidecaller')) || ''")); await ev("closeSheet()")

async def journey(page, ev):
    await ev("closeSheet(); delete S.reg; afterLoad()")
    rec('journey start', await ev("({reg: S.reg, offered: S.portals.list.some(o => o.biome === 'mossroot'), boss: S.portals.boss && S.portals.boss.biome})"))
    # the third quest in the region's world type opens its heart
    await ev("S.reg.n = 2; S.quests = Math.max(S.quests, 3); S.pet.rest = 100; S.pet.joy = 90; S.party = ['bloom', 'stone', 'ember'].map(k => S.littles.find(l => l.kind === k && !l.kind2).id); startQuest({seed: 4242, biome: 'mossroot', size: 'vale', name: 'Test'})")
    res = await finish_quest(ev)
    rec('journey third', {'scene': res['scene'], 'n': await ev("S.reg.n"), 'lines': await ev("[...document.querySelectorAll('#sheet li')].map(e => e.textContent).join(' | ')")})
    # the boss portal shows under Where to? and the region opens when it is beaten
    await ev("closeSheet(); S.pet.rest = 100; S.pet.asleep = false; openQuestSheet()"); await page.wait_for_timeout(300)
    await page.screenshot(path=SHOTS + '/d13_heart_portal.png')
    rec('journey heart card', await ev("(() => { const b = document.querySelector('#sheet [data-i=\"boss\"]'); return b ? b.textContent : ''; })()"))
    await page.click('#sheet [data-i="boss"]'); await page.wait_for_timeout(300)
    rec('journey heart quest', await ev("({region: Q && Q.region, boss: Q && Q.world.cells.some(c => c.enemy && c.enemy.boss), maps: S.maps})"))
    res = await finish_quest(ev)
    rec('journey heart beaten', {'scene': res['scene'], 'reg': await ev("S.reg"), 'regions': await ev("S.j.regions"), 'lines': await ev("[...document.querySelectorAll('#sheet li')].map(e => e.textContent).join(' | ')"), 'next': await ev("S.portals.boss && S.portals.boss.biome"), 'offered': await ev("S.portals.list.some(o => o.biome === 'emberfall')")})
    # a boss portal cannot be entered before its heart is open
    await ev("closeSheet(); S.pet.rest = 100; startQuest(S.portals.boss)")
    rec('journey locked heart', await ev("scene"))
    # the journey sheet builds the nest piece the beaten region unlocked
    await ev("S.dust = 70; openQuestSheet()"); await page.click('#sheet [data-do="journey"]'); await page.wait_for_timeout(300)
    await page.screenshot(path=SHOTS + '/d14_journey.png')
    locked = await ev("document.querySelector('#sheet [data-id=\"emberfall\"]').disabled")
    await page.click('#sheet [data-do="build"][data-id="mossroot"]'); await page.wait_for_timeout(300)
    rec('journey build', {'built': await ev("S.reg.built"), 'dust': await ev("S.dust"), 'locked': locked, 'tag': await ev("document.querySelector('#sheet [data-id=\"mossroot\"] .tag').textContent")})
    await page.click('#sheet [data-do="back"]'); await page.wait_for_timeout(200)
    rec('journey back', await ev("document.querySelector('#sheet h2').textContent")); await ev("closeSheet()")
    await page.wait_for_timeout(500); await page.screenshot(path=SHOTS + '/d15_nest_piece.png')
    await page.click('#btn-journal'); await page.wait_for_timeout(300)
    rec('journey journal', await ev("[...document.querySelectorAll('#sheet h3')].map(h => h.textContent).find(t => t.startsWith('The journey')) || ''")); await ev("closeSheet()")

async def nest(page, ev):
    # eight littles: the party on the nest, the rest on perches, nobody standing on anybody, eggs in the cradle
    await ev("closeSheet(); const r = RNG(77); while (S.littles.length < 8) S.littles.push(newLittle(Object.keys(KINDS)[S.littles.length % 6], r)); S.eggs = [{hue: 300, seed: 3, warm: 0}, {hue: 190, seed: 4, warm: 0}]; S.party = S.littles.slice(0, 3).map(l => l.id); S.pet.asleep = false; rebuildHome()")
    await page.wait_for_timeout(2500); await page.screenshot(path=SHOTS + '/d16_perches.png')
    rec('nest perches', await ev("(() => { const H = home, bs = H.baseS, party = H.lits.filter(f => S.party.includes(f.l.id)), rest = H.lits.filter(f => !S.party.includes(f.l.id)); let gap = 1e9; for (const a of H.lits) for (const b of H.lits) if (a !== b) gap = Math.min(gap, Math.hypot(a.hx - b.hx, a.hy - b.hy)); return {party: party.every(f => f.perch === -1 && f.hy < H.gy + H.ry), rest: rest.length, perched: rest.every(f => f.perch >= 0 && f.hy > H.gy + H.ry), gap: gap / bs, onScreen: H.lits.every(f => f.hx > 0 && f.hx < VW && f.hy < VH - botIn)}; })()"))
    e = await ev("({x: home.eggs[0].x, y: home.eggs[0].y, below: home.eggs[0].y > home.gy + home.ry})")
    await page.mouse.click(e['x'], e['y']); await page.wait_for_timeout(200)
    rec('nest cradle', {'below': e['below'], 'warm': await ev("S.eggs[0].warm")})
    # a little that joins the party leaves its perch for the nest
    await ev("toggleParty(S.party[2]); toggleParty(S.littles[7].id)")
    rec('nest move', await ev("(() => { const f = home.lits.find(f => f.l.id === S.littles[7].id), g = home.lits.find(f => f.l.id === S.littles[2].id); return {joined: f.perch === -1, rested: g.perch >= 0}; })()"))
    await ev("S.eggs = []; S.littles = S.littles.slice(0, 6); S.party = S.littles.slice(0, 3).map(l => l.id); rebuildHome()")

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
        await ev("""() => { window.__fast = true; const r = RNG(5); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r)); S.littles = S.littles.slice(0, 6); S.quests = 5; S.dust = 200; S.pet.rest = 100; afterLoad(); }""")
        await wishes(page, ev)
        await tides(page, ev)
        await darkness(page, ev)
        await song(page, ev)
        await gusts(page, ev)
        await moss(page, ev)
        await fire(page, ev)
        await together(page, ev)
        await forms(page, ev)
        await journey(page, ev)
        await nest(page, ev)
        await b.close()
    rec('errors', [e for e in errs if 'Failed to load resource' not in e])
asyncio.run(main())
R = RESULTS
finish([('no page errors', not R['errors']),
        ('a wish is ready on the first day', R['wish start']['has'] and R['wish start']['day']),
        ('eating the wished berry grants the wish', R['wish eat']['granted'] == 1 and R['wish eat']['next'] == 1 and R['wish eat']['waits'] and R['wish eat']['gained'] > 1),
        ('the bubble opens the wish', R['wish sheet'].startswith('A wish') and 'long cuddle' in R['wish sheet']),
        ('Tidehollow has tidal flats and a tide clock', R['tide world']['rule'] == 'tidehollow' and R['tide world']['flats'] > 0 and 'Tide' in R['tide world']['chip']),
        ('a Tide little freezes a flat under the tide', R['tide freeze']['frozen'] and R['tide freeze']['walkable']),
        ('a Tidehollow world is finished through the tides', R['tide quest']['scene'] == 'home' and R['tide quest']['log'].endswith('exit')),
        ('Gloamglass is dark, with lamps, and a Glow little lights further', R['dark world']['rule'] == 'gloamglass' and R['dark world']['lamps'] > 0 and 0 < R['dark world']['seen'] < R['dark world']['cells'] and R['dark world']['r'] >= 2.5),
        ('a tile nobody has seen cannot be walked to', 'Too dark' in R['dark tap']['toast'] and not R['dark tap']['walking']),
        ('a Gloamglass world is finished in the dark', R['dark quest']['scene'] == 'home' and R['dark quest']['log'].endswith('exit')),
        ('Stonesong has a closed song door and its stones', R['song world']['rule'] == 'stonesong' and R['song world']['stones'] >= 2 and R['song world']['door'] == 'door' and R['song world']['closed']),
        ('tapping the song door explains it', R['song sheet'] == 'Song door'),
        ('song stones count in order and a wrong one restarts', R['song order'][0] == 1 and R['song order'][1] == 0 and R['song order'][2] == 1),
        ('a Stonesong world is finished through the song door', R['song quest']['scene'] == 'home' and 'ring' in R['song quest']['log'] and R['song quest']['log'].endswith('exit')),
        ('Cloudspire has wind pads in pairs', R['gust world']['rule'] == 'cloudspire' and R['gust world']['pads'] >= 2 and R['gust world']['pads'] % 2 == 0),
        ('a gust carries the Glimmerkin to the twin pad', R['gust ride']['at'] == R['gust ride']['twin']),
        ('a Cloudspire world is finished by gust', R['gust quest']['scene'] == 'home' and R['gust quest']['log'].endswith('exit')),
        ('Mossroot has slick moss', R['moss world']['rule'] == 'mossroot' and R['moss world']['slick'] > 0),
        ('a step onto slick moss slides to where it stops', not R['moss slide']['slid'] or R['moss slide']['at'] == R['moss slide']['end']),
        ('a Mossroot world is finished over the moss', R['moss quest']['scene'] == 'home' and R['moss quest']['log'].endswith('exit')),
        ('Emberfall has dry thickets', R['fire world']['rule'] == 'emberfall' and R['fire world']['thickets'] > 0),
        ('fire spreads from a burnt bramble and burns a thicket away', R['fire spread'].get('burnt') and 'fire spreads' in R['fire spread']['toast']),
        ('an Emberfall world is finished', R['fire quest']['scene'] == 'home' and R['fire quest']['log'].endswith('exit')),
        ('a pair blocker offers two littles together', R['pair seed'] >= 0 and any(',' in r and 'and' in r for r in R['pair clear']['rows'])),
        ('two littles clear it for a spark each', R['pair clear']['cleared'] and sum(R['pair clear']['before']) - sum(R['pair clear']['after']) == 2 and R['pair clear']['journal'] >= 1),
        ('a world with a pair blocker is finished', R['pair quest']['scene'] == 'home' and R['pair quest']['log'].endswith('exit')),
        ('the party sheet says what the party can do together', 'steam' in R['quest sheet line']),
        ('a twin with both kinds clears a pair blocker alone', R['twin seed'] >= 0 and R['twin quest']['scene'] == 'home' and 'twin fog' in R['twin quest']['log'] and R['twin quest']['log'].endswith('exit')),
        ('a creature fed on Tide berries leans to the Tidecaller', R['form leaning'] == 'tide'),
        ('reaching bond level 10 makes it a Mythic Tidecaller', R['form grown']['form'] == 'tide' and 'Tidecaller' in R['form grown']['msg'] and R['form grown']['tag'].startswith('Tidecaller') and R['form grown']['look'] == 'tide'),
        ('an older Mythic save gets a form from its diet', R['form old save'].startswith('bloom')),
        ('the journal records the Mythic form', 'Tidecaller' in R['form journal']),
        ('an older save starts the journey in Mossroot, with Mossroot on offer', R['journey start']['reg']['i'] == 0 and R['journey start']['offered'] and R['journey start']['boss'] == 'mossroot'),
        ('the third quest in a region opens its heart', R['journey third']['scene'] == 'home' and R['journey third']['n'] == 3 and 'heart of Mossroot is open' in R['journey third']['lines']),
        ('the heart portal shows under Where to?', 'Heart of Mossroot' in R['journey heart card']),
        ('the heart is a boss world that needs no map pieces', R['journey heart quest']['region'] and R['journey heart quest']['boss']),
        ('beating the heart opens the next region', R['journey heart beaten']['scene'] == 'home' and R['journey heart beaten']['reg']['i'] == 1 and R['journey heart beaten']['reg']['n'] == 0 and R['journey heart beaten']['regions'] == 1 and 'Emberfall is the next region' in R['journey heart beaten']['lines'] and R['journey heart beaten']['next'] == 'emberfall' and R['journey heart beaten']['offered']),
        ('a heart that is not open cannot be entered', R['journey locked heart'] == 'home'),
        ('a beaten region lets you build its nest piece for stardust', R['journey build']['built'] == ['mossroot'] and R['journey build']['dust'] == 10 and R['journey build']['locked'] and R['journey build']['tag'] == 'Built'),
        ('the journey sheet goes back to Where to?', R['journey back'] == 'Where to?'),
        ('the journal shows the journey', R['journey journal'].startswith('The journey · 1 of 6')),
        ('the party stands on the nest and resting littles sit on perches, apart and on screen', R['nest perches']['party'] and R['nest perches']['rest'] == 5 and R['nest perches']['perched'] and R['nest perches']['gap'] > 0.3 and R['nest perches']['onScreen']),
        ('eggs hang in the cradle and a tap warms one', R['nest cradle']['below'] and R['nest cradle']['warm'] > 0),
        ('a little moves between the nest and a perch as the party changes', R['nest move']['joined'] and R['nest move']['rested']),
        ('a trip wish stays on offer and comes true', R['wish visit']['offered'] and R['wish visit']['scene'] == 'home' and R['wish visit']['granted'] == 2 and any('Wish granted' in l for l in R['wish visit']['lines']))])
