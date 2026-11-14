# Drives every new feature once in a phone-sized headless browser.
import os, pathlib, tempfile
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))

# A fixed random sequence makes the starting creature and littles the same on every run.
SEED_JS = "(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
import asyncio, re, json
from playwright.async_api import async_playwright
BOT = re.search(r'BOT = """(.*?)"""', (ROOT / 'test' / 'smoke.py').read_text(), re.S).group(1)
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
        # stock the nest with everything
        rec('setup', await ev("""() => { window.__fast = true; const r = RNG(5); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r)); S.littles = S.littles.slice(0, 6); S.quests = 5; S.dust = 200; S.pet.xp = 300; S.pet.rest = 100; S.pet.joy = 90; S.pet.belly = 60;
          allDecor().forEach(giveThing); giveThing('toy:ball'); giveThing('toy:musicbox'); for (let i = 0; i < 6; i++) giveThing('chime'); giveThing('star'); giveThing('star'); for (let i = 0; i < 3; i++) giveThing('map');
          for (const k of Object.keys(CHARMS)) giveThing('charm:' + k); for (const k of Object.keys(TOOLS)) { giveThing('tool:' + k); giveThing('tool:' + k); }
          S.trader = null; S.j.trader = false; S.eggs.push({hue: 200, seed: 77, warm: 0, twin: true}); afterLoad(); return {decor: S.decor.length, chimes: S.chimes, trader: !!traderToday(), stock: S.trader.stock.map(o => o.id)}; }"""))
        await page.wait_for_timeout(700); await page.screenshot(path=SHOTS + '/f1_home.png')
        # toys, stones, chimes
        pos = await ev("({ball: {x: home.ball.px, y: home.ball.py - 10}, box: {x: home.box.x, y: home.box.y - 10}, bal: home.balloon, stone: home.stonePos.find(Boolean), chime: home.chimePos.find(Boolean)})")
        for k in ['ball', 'box', 'chime']:
            await page.mouse.click(pos[k]['x'], pos[k]['y']); await page.wait_for_timeout(120)
        rec('toys', await ev("({vx: Math.abs(home.ball.vx) > 0.1, boxT: home.boxT > 0, kick: home.kick.some(v => v > 0)})"))
        # chime stones: one stays silent, two start the tune and explain it once; a tap says what a stone is
        await ev("closeSheet(); S.chimes = 1; S.j.chimeTold = false")
        one = await ev("(() => { home.tuneT = 0.5; nestMusic(0.1); return home.tuneT; })()")
        await page.wait_for_timeout(300)
        st = await ev("home.stonePos[0]"); await page.mouse.click(st['x'], st['y']); await page.wait_for_timeout(150)
        tap = await ev("document.getElementById('toast').textContent")
        await ev("S.chimes = 2")
        two = await ev("(() => { const stub = typeof AC !== 'undefined' && AC && AC.state === 'running'; for (let i = 0; i < 40 && !S.j.chimeTold; i++) { home.tuneT = 0; nestMusic(0.1); } return {tuneT: home.tuneT, audio: stub, told: !!S.j.chimeTold, toast: document.getElementById('toast').textContent}; })()")
        rec('chime stones', {'one': one, 'tap': tap, 'two': two})
        await ev("S.chimes = 6")
        # trader
        await page.mouse.click(pos['bal']['x'], pos['bal']['y'] + 10); await page.wait_for_timeout(300)
        await page.screenshot(path=SHOTS + '/f2_shop.png')
        await page.click('[data-do="buy"]:not([disabled])'); await page.wait_for_timeout(200)
        rec('shop', await ev("({dust: S.dust, sold: S.trader.stock.filter(o => o.sold).length, sheet: document.querySelector('#sheet h2').textContent})"))
        await page.click('[data-do="ok"]')
        # journal
        await page.click('#btn-journal'); await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/f3_journal.png')
        await ev("document.getElementById('sheet').scrollTop = 900"); await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/f3b_journal.png')
        await page.click('#sheet [data-do="ok"]')
        # starfruit
        await page.click('[data-act="feed"]'); await page.wait_for_timeout(150); await page.click('[data-food="star"]'); await page.wait_for_timeout(900)
        await page.click('[data-food="star"]'); await page.wait_for_timeout(900)
        rec('star', await ev("({marks: S.pet.marks, eaten: S.j.star, left: S.pantry.star})"))
        await ev("S.pet.marks = Object.keys(MARKS); home.look = petLook(S.pet); ui.tray.hidden = true"); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/f4_marks.png')
        # charms
        await page.click('[data-act="littles"]'); await page.wait_for_timeout(200); await page.click('#sheet [data-do="open"]'); await page.wait_for_timeout(200)
        await page.click('[data-do="charm"][data-k="feather"]'); await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/f5_little.png')
        rec('charm', await ev("({worn: S.littles[0].charm, left: S.charms.feather})"))
        await ev("closeSheet()")
        # twin egg
        await ev("(() => { for (let i = 0; i < 14; i++) strokeEgg(S.eggs.length - 1); })()"); await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/f6_twin.png')
        rec('twin', await ev("({last: S.littles[S.littles.length - 1].kind + '+' + S.littles[S.littles.length - 1].kind2, twins: S.j.twins, title: document.querySelector('#sheet h2').textContent})"))
        await ev("closeSheet()")
        # rare portal with a boss
        await ev("S.party = S.littles.slice(0, 3).map(l => l.id); S.pet.rest = 100")
        await ev("rollPortals(); S.portals.rare.seed = 4242; S.portals.rare.biome = 'stonesong'")
        await page.click('[data-act="quest"]'); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/f7_portals.png')
        await page.click('[data-do="go"][data-i="rare"]'); await page.wait_for_timeout(900); await page.screenshot(path=SHOTS + '/f8_rare.png')
        rec('rare', await ev("({maps: S.maps, boss: Q.world.cells.filter(c => c.enemy && c.enemy.boss).map(c => c.enemy.tough), gifts: Q.world.cells.filter(c => c.item && c.item.k === 'gift').map(c => c.item.id), twinEgg: Q.world.cells.some(c => c.item && c.item.k === 'egg' && c.item.twin), bag: document.getElementById('q-bag').textContent})"))
        # tools: lantern via chip, key/seed/bell where the world offers a target
        await ev("Q.lits[0].sp = 1; updateQuestBar()"); await page.click('[data-chip="0"]'); await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/f9_chip.png'); await page.click('[data-do="lantern"]'); await page.wait_for_timeout(200)
        rec('tools', await ev("""() => { const w = Q.world, out = {lantern: Q.lits[0].sp === Q.lits[0].max, left: S.tools.lantern}; const prev = flood(w, Q.px, Q.py, Q);
          w.cells.forEach((c, k) => { const x = k % w.W, y = Math.floor(k / w.W), near = nearIn(w, prev, x, y) >= 0; if (!out.seed && c.t === 'ob' && !c.cleared && (c.ob === 'water' || c.ob === 'chasm') && near) { useTool('seed', k); out.seed = c.cleared; } if (!out.bell && c.enemy && !c.enemy.boss && near) { useTool('bell', k); out.bell = 'rung'; } });
          if (w.gate) { useTool('key', w.gate.y * w.W + w.gate.x); out.key = Q.gateLatched; } return out; }"""))
        await page.wait_for_timeout(700)
        boss = await ev("(() => { const w = Q.world; for (let k = 0; k < w.cells.length; k++) if (w.cells[k].enemy && w.cells[k].enemy.boss) return {x: Q.ox + (k % w.W + .5) * Q.ts, y: Q.oy + (Math.floor(k / w.W) + .5) * Q.ts}; })()")
        await page.mouse.click(boss['x'], boss['y']); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/f10_boss.png'); await ev("closeSheet()")
        res = await ev("async () => { const _a = window.anim; window.anim = (d, f) => _a(d * 0.1, f); const bot = __BOT__; const r = await bot(); window.anim = _a; return {log: r.log.join(','), scene: r.scene, sheet: r.sheet, boss: S.j.glooms.boss, eggs: S.eggs.map(e => !!e.twin), found: [...document.querySelectorAll('#sheet .loot span')].map(e => e.textContent)}; }".replace('__BOT__', BOT))
        rec('bot', res)
        await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/f11_result.png')
        # several more quests with gifts to shake out errors
        out = await ev("""async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); const _a = window.anim; window.anim = (d, f) => _a(d * 0.08, f); const bot = __BOT__; const rs = [];
          for (let t = 0; t < 12; t++) { closeSheet(); S.decor = []; S.chimes = 0; S.maps = t % 4 === 3 ? 3 : 0; S.toys = {}; S.pet.rest = 100; S.party = S.littles.slice(t % 5, t % 5 + 3).map(l => l.id); const rare = t % 4 === 3; startQuest({seed: 900 + t * 53, biome: BIOMES[t % 6].id, size: ['vale', 'realm'][t % 2], name: 'T' + t, rare}); await sleep(60); const gifts = Q.world.cells.filter(c => c.item && c.item.k === 'gift').length; const r = await bot(); rs.push(t + (rare ? 'R' : '') + ':' + gifts + 'g:' + r.log[r.log.length - 1] + ':' + r.scene); if (Q) finishQuest(false); }
          window.anim = _a; return rs; }""".replace('__BOT__', BOT))
        rec('sweep', out)
        # a full nest: the rare portal still holds its twin egg, the card says it will turn to stardust, and coming home says so
        out = await ev("""async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); closeSheet(); const had = S.eggs.length; while (S.littles.length + S.eggs.length < 8) S.eggs.push({hue: 10, seed: 5, warm: 0});
          S.maps = 3; S.pet.rest = 100; S.party = S.littles.slice(0, 3).map(l => l.id); rollPortals(true); openQuestSheet(); await sleep(60);
          const card = document.querySelector('[data-do="go"][data-i="rare"]').textContent; closeSheet();
          startQuest(Object.assign({}, S.portals.rare)); await sleep(60);
          const k = Q.world.cells.findIndex(c => c.item && c.item.k === 'egg' && c.item.twin), egg = k >= 0 && planSolve(Q.world).has(k);
          if (k >= 0) collectAt(k); const dust0 = S.dust; finishQuest(false); await sleep(60);
          const lines = [...document.querySelectorAll('#sheet li')].map(e => e.textContent); closeSheet(); S.eggs.length = had; return {card, egg, lines, eggs: S.littles.length + S.eggs.length}; }""")
        rec('full nest', out)
        # brave or scared: a gloom that scares one little in the party; then a bright finish at the portal
        out = await ev("""async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); closeSheet(); S.pet.rest = 100; S.party = S.littles.slice(0, 3).map(l => l.id);
          startQuest({seed: 4242, biome: 'mossroot', size: 'vale', name: 'Fear'}); await sleep(60);
          const w = Q.world, f0 = Q.lits[0], g = GLOOMS.findIndex(g => g.scares === f0.l.kind), prev = flood(w, Q.px, Q.py, Q);
          const k = w.cells.findIndex((c, i) => c.t === 'floor' && !c.item && i !== Q.py * w.W + Q.px && nearIn(w, prev, i % w.W, (i - i % w.W) / w.W) >= 0 && Math.abs(i % w.W - Q.px) + Math.abs((i - i % w.W) / w.W - Q.py) <= 2);
          w.cells[k].enemy = {g, tough: 2}; f0.x = Q.px; f0.y = Q.py; openTarget(k, 'enemy', flood(w, Q.px, Q.py, Q)); await sleep(60);
          const rows = [...document.querySelectorAll('#sheet [data-do="send"]')].map(b => ({off: b.disabled, text: b.textContent})), text = document.querySelector('#sheet .tx small').textContent, afraid = afraidNear(w, f0);
          closeSheet(); await sendFight(f0, k); const stays = !!w.cells[k].enemy;
          Q.lits.forEach(f => { f.sp = 2; }); Q.loot.shards = w.need; const d0 = S.dust; await arriveExit(); await sleep(60);
          return {rows, text, afraid, stays, gained: S.dust - d0, lines: [...document.querySelectorAll('#sheet li')].map(e => e.textContent)}; }""")
        rec('brave or scared', out)
        # the boss swipes back: the little it eyes goes dizzy for one strike, the eyed little dodges, and it never
        # swipes when nobody else could strike next
        out = await ev("""async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); closeSheet(); if (Q) finishQuest(false); closeSheet(); S.pet.rest = 100; S.party = S.littles.slice(0, 3).map(l => l.id);
          startQuest({seed: 4343, biome: 'mossroot', size: 'vale', name: 'Swipe'}); await sleep(60);
          const w = Q.world, [a, b, d] = Q.lits, prev = flood(w, Q.px, Q.py, Q), brave = GLOOMS.findIndex(g => !Q.lits.some(f => f.l.kind === g.scares));
          const k = w.cells.findIndex((c, i) => c.t === 'floor' && !c.item && i !== Q.py * w.W + Q.px && nearIn(w, prev, i % w.W, (i - i % w.W) / w.W) >= 0);
          w.cells[k].enemy = {g: brave, tough: 20, boss: true}; Q.lits.forEach(f => { f.sp = 5; });
          Q.eye = b; await sendFight(a, k); const swiped = b.dizzy && !a.dizzy;
          openTarget(k, 'enemy', flood(w, Q.px, Q.py, Q)); await sleep(60); const row = document.querySelectorAll('#sheet [data-do="send"]')[1], dizzyRow = row.disabled && row.textContent.includes('Dizzy'); closeSheet();
          await sendFight(b, k); const stillDizzy = b.dizzy;
          Q.eye = d; await sendFight(a, k); const before = d.dizzy; Q.eye = a; await sendFight(a, k); const dodged = !Q.lits.some(f => f.dizzy) && before;
          a.sp = 1; b.sp = 0; d.sp = 0; Q.eye = b; await sendFight(a, k); const spared = !b.dizzy;
          return {swiped, dizzyRow, stillDizzy, dodged, spared}; }""")
        rec('boss swipes back', out)
        await b.close()
    rec('errors', [e for e in errs if 'Failed to load resource' not in e])
asyncio.run(main())
R = RESULTS
finish([('no page errors', not R['errors']), ('nest stocked and trader present', R['setup']['decor'] == 18 and R['setup']['trader']), ('toys respond', all(R['toys'].values())),
        ('one chime stone stays silent, and a tap says what it is', R['chime stones']['one'] == 0.5 and 'Chime stone 1 of 8' in R['chime stones']['tap'] and 'one more' in R['chime stones']['tap']),
        ('two chime stones start the tune and it is explained once', R['chime stones']['two']['tuneT'] > 0 and (not R['chime stones']['two']['audio'] or (R['chime stones']['two']['told'] and 'Chime stones sing' in R['chime stones']['two']['toast']))),
        ('trader sells', R['shop']['sold'] == 1), ('starfruit leaves marks', R['star']['eaten'] == 2 and len(R['star']['marks']) == 2), ('charm equips', R['charm']['worn'] == 'feather'),
        ('twin egg hatches', R['twin']['title'] == 'A twin hatched' and R['twin']['twins'] == 1), ('rare portal has a boss and a twin egg', R['rare']['maps'] == 0 and len(R['rare']['boss']) == 1 and R['rare']['twinEgg']),
        ('spark lantern refills', R['tools']['lantern']), ('boss world finished', R['bot']['scene'] == 'home' and (R['bot']['boss'] or 0) >= 1),
        ('a scared little will not go near its gloom, and looks worried', R['brave or scared']['rows'][0]['off'] and 'Too scared' in R['brave or scared']['rows'][0]['text'] and 'Too scared' not in R['brave or scared']['rows'][1]['text'] and 'too scared to go near it' in R['brave or scared']['text'] and R['brave or scared']['afraid'] and R['brave or scared']['stays']),
        ('unspent sparks are a bright finish', any('Bright finish: 6 sparks left over, worth 12 stardust.' == l for l in R['brave or scared']['lines'])),
        ('the boss swipes back: dizzy for one strike, the eyed little dodges, never when nobody else can strike', R['boss swipes back'] == {'swiped': True, 'dizzyRow': True, 'stillDizzy': True, 'dodged': True, 'spared': True}),
        ('a full nest: the rare portal keeps its twin egg on the way and says it will turn into stardust', R['full nest']['egg'] and 'the nest is full, so it will turn into stardust' in R['full nest']['card'] and 'The nest is full, so the twin egg turned into 12 stardust.' in R['full nest']['lines']),
        ('gift worlds finished', len(R['sweep']) == 12 and all(x.endswith(':exit:home') for x in R['sweep']))])
