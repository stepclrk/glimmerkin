# Drives every new feature once in a phone-sized headless browser.
import os, pathlib, tempfile
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
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
        await page.goto(PAGE); await page.wait_for_timeout(800)
        ev = page.evaluate
        # stock the nest with everything
        print('setup', await ev("""() => { window.__fast = true; const r = RNG(5); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r)); S.littles = S.littles.slice(0, 6); S.quests = 5; S.dust = 200; S.pet.xp = 300; S.pet.rest = 100; S.pet.joy = 90; S.pet.belly = 60;
          allDecor().forEach(giveThing); giveThing('toy:ball'); giveThing('toy:musicbox'); for (let i = 0; i < 6; i++) giveThing('chime'); giveThing('star'); giveThing('star'); for (let i = 0; i < 3; i++) giveThing('map');
          for (const k of Object.keys(CHARMS)) giveThing('charm:' + k); for (const k of Object.keys(TOOLS)) { giveThing('tool:' + k); giveThing('tool:' + k); }
          S.trader = null; S.j.trader = false; S.eggs.push({hue: 200, seed: 77, warm: 0, twin: true}); afterLoad(); return {decor: S.decor.length, chimes: S.chimes, trader: !!traderToday(), stock: S.trader.stock.map(o => o.id)}; }"""))
        await page.wait_for_timeout(700); await page.screenshot(path=SHOTS + '/f1_home.png')
        # toys, stones, chimes
        pos = await ev("({ball: {x: home.ball.px, y: home.ball.py - 10}, box: {x: home.box.x, y: home.box.y - 10}, bal: home.balloon, stone: home.stonePos.find(Boolean), chime: home.chimePos.find(Boolean)})")
        for k in ['ball', 'box', 'chime']:
            await page.mouse.click(pos[k]['x'], pos[k]['y']); await page.wait_for_timeout(120)
        print('toys', await ev("({vx: Math.abs(home.ball.vx) > 0.1, boxT: home.boxT > 0, kick: home.kick.some(v => v > 0)})"))
        # trader
        await page.mouse.click(pos['bal']['x'], pos['bal']['y'] + 10); await page.wait_for_timeout(300)
        await page.screenshot(path=SHOTS + '/f2_shop.png')
        await page.click('[data-do="buy"]:not([disabled])'); await page.wait_for_timeout(200)
        print('shop', await ev("({dust: S.dust, sold: S.trader.stock.filter(o => o.sold).length, sheet: document.querySelector('#sheet h2').textContent})"))
        await page.click('[data-do="ok"]')
        # journal
        await page.click('#btn-journal'); await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/f3_journal.png')
        await ev("document.getElementById('sheet').scrollTop = 900"); await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/f3b_journal.png')
        await page.click('#sheet [data-do="ok"]')
        # starfruit
        await page.click('[data-act="feed"]'); await page.wait_for_timeout(150); await page.click('[data-food="star"]'); await page.wait_for_timeout(900)
        await page.click('[data-food="star"]'); await page.wait_for_timeout(900)
        print('star', await ev("({marks: S.pet.marks, eaten: S.j.star, left: S.pantry.star})"))
        await ev("S.pet.marks = Object.keys(MARKS); home.look = petLook(S.pet); ui.tray.hidden = true"); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/f4_marks.png')
        # charms
        await page.click('[data-act="littles"]'); await page.wait_for_timeout(200); await page.click('#sheet [data-do="open"]'); await page.wait_for_timeout(200)
        await page.click('[data-do="charm"][data-k="feather"]'); await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/f5_little.png')
        print('charm', await ev("({worn: S.littles[0].charm, left: S.charms.feather})"))
        await ev("closeSheet()")
        # twin egg
        await ev("(() => { for (let i = 0; i < 14; i++) strokeEgg(S.eggs.length - 1); })()"); await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/f6_twin.png')
        print('twin', await ev("({last: S.littles[S.littles.length - 1].kind + '+' + S.littles[S.littles.length - 1].kind2, twins: S.j.twins, title: document.querySelector('#sheet h2').textContent})"))
        await ev("closeSheet()")
        # rare portal with a boss
        await ev("S.party = S.littles.slice(0, 3).map(l => l.id); S.pet.rest = 100")
        await page.click('[data-act="quest"]'); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/f7_portals.png')
        await page.click('[data-do="go"][data-i="rare"]'); await page.wait_for_timeout(900); await page.screenshot(path=SHOTS + '/f8_rare.png')
        print('rare', await ev("({maps: S.maps, boss: Q.world.cells.filter(c => c.enemy && c.enemy.boss).map(c => c.enemy.tough), gifts: Q.world.cells.filter(c => c.item && c.item.k === 'gift').map(c => c.item.id), twinEgg: Q.world.cells.some(c => c.item && c.item.k === 'egg' && c.item.twin), bag: document.getElementById('q-bag').textContent})"))
        # tools: lantern via chip, key/seed/bell where the world offers a target
        await ev("Q.lits[0].sp = 1; updateQuestBar()"); await page.click('[data-chip="0"]'); await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/f9_chip.png'); await page.click('[data-do="lantern"]'); await page.wait_for_timeout(200)
        print('tools', await ev("""() => { const w = Q.world, out = {lantern: Q.lits[0].sp === Q.lits[0].max, left: S.tools.lantern}; const prev = flood(w, Q.px, Q.py, Q);
          w.cells.forEach((c, k) => { const x = k % w.W, y = Math.floor(k / w.W), near = nearIn(w, prev, x, y) >= 0; if (!out.seed && c.t === 'ob' && !c.cleared && (c.ob === 'water' || c.ob === 'chasm') && near) { useTool('seed', k); out.seed = c.cleared; } if (!out.bell && c.enemy && !c.enemy.boss && near) { useTool('bell', k); out.bell = 'rung'; } });
          if (w.gate) { useTool('key', w.gate.y * w.W + w.gate.x); out.key = Q.gateLatched; } return out; }"""))
        await page.wait_for_timeout(700)
        boss = await ev("(() => { const w = Q.world; for (let k = 0; k < w.cells.length; k++) if (w.cells[k].enemy && w.cells[k].enemy.boss) return {x: Q.ox + (k % w.W + .5) * Q.ts, y: Q.oy + (Math.floor(k / w.W) + .5) * Q.ts}; })()")
        await page.mouse.click(boss['x'], boss['y']); await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/f10_boss.png'); await ev("closeSheet()")
        res = await ev("async () => { const _a = window.anim; window.anim = (d, f) => _a(d * 0.1, f); const bot = __BOT__; const r = await bot(); window.anim = _a; return {log: r.log.join(','), scene: r.scene, sheet: r.sheet, boss: S.j.glooms.boss, eggs: S.eggs.map(e => !!e.twin), found: [...document.querySelectorAll('#sheet .loot span')].map(e => e.textContent)}; }".replace('__BOT__', BOT))
        print('bot', res)
        await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/f11_result.png')
        # several more quests with gifts to shake out errors
        out = await ev("""async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); const _a = window.anim; window.anim = (d, f) => _a(d * 0.08, f); const bot = __BOT__; const rs = [];
          for (let t = 0; t < 12; t++) { closeSheet(); S.decor = []; S.chimes = 0; S.maps = t % 4 === 3 ? 3 : 0; S.toys = {}; S.pet.rest = 100; S.party = S.littles.slice(t % 5, t % 5 + 3).map(l => l.id); const rare = t % 4 === 3; startQuest({seed: 900 + t * 53, biome: BIOMES[t % 6].id, size: ['vale', 'realm'][t % 2], name: 'T' + t, rare}); await sleep(60); const gifts = Q.world.cells.filter(c => c.item && c.item.k === 'gift').length; const r = await bot(); rs.push(t + (rare ? 'R' : '') + ':' + gifts + 'g:' + r.log[r.log.length - 1] + ':' + r.scene); if (Q) finishQuest(false); }
          window.anim = _a; return rs; }""".replace('__BOT__', BOT))
        print('sweep', out)
        await b.close()
    print('ERRORS', errs)
asyncio.run(main())
