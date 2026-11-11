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
import asyncio, sys, json
from playwright.async_api import async_playwright
BOT = """
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = [];
  let waits = 0;
  for (let guard = 0; guard < 240 && Q && !Q.done; guard++) {
    while (Q && (Q.busy || Q.walking)) await sleep(60);
    if (!Q || Q.done) break;
    const w = Q.world, prev = flood(w, Q.px, Q.py, Q), seen = k => !Q.seen || Q.seen[k] > 0;
    // plate
    if (w.plate && !Q.gateOpen && prev.has(w.plate.y*w.W+w.plate.x) && nearIn(w, prev, w.gate.x, w.gate.y) >= 0) { const f = Q.lits.slice().sort((a,b)=>a.sp-b.sp)[0]; log.push('station'); await sendStation(f); continue; }
    if (w.gate && Q.gateOpen && !Q.gateLatched && prev.has(w.gate.y*w.W+w.gate.x) && (!Q.seen || Q.seen[w.gate.y*w.W+w.gate.x])) { questTap({x: Q.ox + (w.gate.x+.5)*Q.ts, y: Q.oy + (w.gate.y+.5)*Q.ts}); log.push('gate'); await sleep(250); continue; }
    // loot in reach
    let item = -1; for (const k of prev.keys()) if (w.cells[k].item && k !== Q.py*w.W+Q.px && seen(k)) { item = k; break; }
    if (item >= 0) { const [x,y] = [item % w.W, Math.floor(item / w.W)]; questTap({x: Q.ox + (x+.5)*Q.ts, y: Q.oy + (y+.5)*Q.ts}); log.push('fetch'); await sleep(80); continue; }
    if (w.song && !Q.songOpen && w.song.every(p => prev.has(p.y*w.W+p.x))) { const p = w.song[Q.songAt]; if (p.x === Q.px && p.y === Q.py) { const o = DIRS.map(([dx,dy]) => (p.y+dy)*w.W+p.x+dx).find(k => prev.has(k) && !w.song.some(s => s.y*w.W+s.x === k)); questTap({x: Q.ox + (o % w.W + .5)*Q.ts, y: Q.oy + (Math.floor(o / w.W) + .5)*Q.ts}); } else questTap({x: Q.ox + (p.x+.5)*Q.ts, y: Q.oy + (p.y+.5)*Q.ts}); log.push('ring'); await sleep(80); continue; }
    if (Q.loot.shards >= w.need && prev.has(w.exit.y*w.W+w.exit.x)) { questTap({x: Q.ox + (w.exit.x+.5)*Q.ts, y: Q.oy + (w.exit.y+.5)*Q.ts}); log.push('exit'); await sleep(300); continue; }
    let did = false;
    for (let k = 0; k < w.cells.length && !did; k++) { const c = w.cells[k]; if (!c.crit) continue; const x = k % w.W, y = Math.floor(k / w.W); if (nearIn(w, prev, x, y) < 0) continue;
      if (c.t === 'ob' && !c.cleared && OBST[c.ob].pair) { const [A, B] = OBST[c.ob].pair, free = Q.lits.filter(f => !f.stationed && f.sp >= 1);
        const a = free.find(f => f.l.kind === A) || free.find(f => f.kinds.includes(A)), b = free.find(f => f !== a && f.l.kind === B) || free.find(f => f !== a && f.kinds.includes(B)), t = free.find(f => f.kinds.includes(A) && f.kinds.includes(B) && f.sp >= 2);
        if (a && b) { log.push('pair ' + c.ob); await sendPair([a, b], k); did = true; } else if (t) { log.push('twin ' + c.ob); await sendPair([t], k); did = true; } }
      else if (c.t === 'ob' && !c.cleared) { const f = Q.lits.filter(f => !f.stationed && f.kinds.some(z => KINDS[z].clears === c.ob) && f.sp >= 1)[0]; if (f) { log.push('clear ' + c.ob); await sendClear(f, k); did = true; } }
      else if (c.enemy) { const cost = f => c.enemy.boss ? 1 : fightCost(c.enemy, f.kinds, f.ring); const f = Q.lits.filter(f => !f.stationed && f.sp >= cost(f)).sort((a,b)=>b.sp-a.sp)[0]; if (f) { log.push(c.enemy.boss ? 'strike' : 'fight'); await sendFight(f, k); did = true; } } }
    if (!did && Q.seen) { // in the dark: walk to the nearest seen tile that borders darkness
      let best = -1, bl = 1e9; for (const k of prev.keys()) { if (!seen(k) || k === Q.py*w.W+Q.px) continue; const x = k % w.W, y = Math.floor(k / w.W);
        if (!DIRS.some(([dx,dy]) => { const a = x+dx, b = y+dy; return a >= 0 && b >= 0 && a < w.W && b < w.H && !seen(b*w.W+a) && w.cells[b*w.W+a].t !== 'wall'; })) continue;
        const l = pathFrom(prev, k).length; if (l < bl) { bl = l; best = k; } }
      if (best >= 0 && waits++ < 120) { questTap({x: Q.ox + (best % w.W + .5)*Q.ts, y: Q.oy + (Math.floor(best / w.W) + .5)*Q.ts}); log.push('explore'); await sleep(80); continue; }
    }
    if (!did && Q.tide && waits++ < 120) { await sleep(150); continue; }   // the tide is in: wait for it to turn
    if (!did) { const held = Q.lits.find(f => f.stationed); if (held && !(w.gate.x===Q.px&&w.gate.y===Q.py)) { /* walk through gate first */ } log.push('stuck'); break; }
  }
  await sleep(window.__fast ? 150 : 1500);
  return { log, scene, quests: S.quests, sheet: document.querySelector('#sheet h2') && document.querySelector('#sheet h2').textContent };
}
"""
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        ctx = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page()
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.add_init_script(SEED_JS)
        await page.goto(PAGE)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=SHOTS + '/s1_home.png')
        # stroke the pet
        box = await page.evaluate("({x: home.cx, y: home.gy - home.petS*0.5})")
        await page.mouse.move(box['x']-30, box['y']); await page.mouse.down()
        for i in range(14):
            await page.mouse.move(box['x'] + (30 if i % 2 else -30), box['y'] + (i % 3) * 4, steps=4)
        await page.wait_for_timeout(100)
        await page.screenshot(path=SHOTS + '/s2_stroke.png')
        await page.mouse.up()
        # feed
        await page.click('[data-act="feed"]'); await page.wait_for_timeout(200)
        await page.click('.food:not([disabled])'); await page.wait_for_timeout(900)
        await page.screenshot(path=SHOTS + '/s3_feed.png')
        await page.click('[data-act="littles"]'); await page.wait_for_timeout(300)
        await page.screenshot(path=SHOTS + '/s4_littles.png')
        await page.click('[data-do="ok"]')
        await page.evaluate("rollPortals(); S.portals.list[0] = {seed: 777, biome: 'mossroot', size: 'nook', name: 'The Test Thicket'}")
        await page.click('[data-act="quest"]'); await page.wait_for_timeout(300)
        await page.screenshot(path=SHOTS + '/s5_portals.png')
        await page.click('[data-do="go"]'); await page.wait_for_timeout(900)
        await page.screenshot(path=SHOTS + '/s6_quest.png')
        info = await page.evaluate("({W: Q.world.W, H: Q.world.H, ts: Q.ts, lits: Q.lits.map(f => f.l.kind + ':' + f.sp), need: Q.world.need})")
        rec('quest', info)
        # tap an obstacle to show the sheet
        ob = await page.evaluate("(() => { const w = Q.world; for (let k = 0; k < w.cells.length; k++) if (w.cells[k].crit) return {x: Q.ox + (k % w.W + .5) * Q.ts, y: Q.oy + (Math.floor(k / w.W) + .5) * Q.ts}; })()")
        await page.mouse.click(ob['x'], ob['y']); await page.wait_for_timeout(300)
        await page.screenshot(path=SHOTS + '/s7_target.png')
        await page.evaluate("closeSheet()")
        res = await page.evaluate(BOT)
        rec('bot', res)
        await page.screenshot(path=SHOTS + '/s8_result.png')
        # second, larger quest with a full hatched roster to exercise more paths
        res2 = await page.evaluate("""async () => { closeSheet(); const r = RNG(5); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r)); S.party = S.littles.filter(l => ['gale','glow','bloom'].includes(l.kind)).map(l => l.id); S.pet.rest = 100; S.pet.joy = 90; S.pet.belly = 90; S.pet.xp = 260; S.pet.diet = {ember: 4, tide: 2}; S.quests = 5; S.eggs.push({hue: 200, seed: 9, warm: 0}); rebuildHome(); updateHud(); return S.littles.length; }""")
        await page.wait_for_timeout(600)
        await page.screenshot(path=SHOTS + '/s9_home_full.png')
        await page.evaluate("startQuest({seed: 4242, biome: 'gloamglass', size: 'realm', name: 'The Humming Vault'})")
        await page.wait_for_timeout(900)
        await page.screenshot(path=SHOTS + '/s10_quest2.png')
        res = await page.evaluate(BOT)
        rec('bot2', res)
        # run many more quests headlessly across biomes to shake out errors
        out = await page.evaluate("""async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); const bot = __BOT__; const rs = []; let i = 0; for (const b of BIOMES) { closeSheet(); S.pet.rest = 100; S.party = S.littles.slice(i % 4, i % 4 + 3).map(l => l.id); startQuest({seed: 100 + i * 77, biome: b.id, size: ['nook','vale','realm'][i % 3], name: 'Test ' + b.name}); await sleep(400); window.__shots = window.__shots || []; window.__shots.push(document.getElementById('stage').toDataURL('image/jpeg', 0.8)); const r = await bot(); rs.push(b.id + ':' + r.log[r.log.length-1] + ':' + r.scene); i++; } return rs; }""".replace('__BOT__', BOT))
        rec('sweep', out)
        import base64
        shots = await page.evaluate("window.__shots")
        for i, d in enumerate(shots): open(SHOTS + '/b%d.jpg' % i, 'wb').write(base64.b64decode(d.split(',')[1]))
        await b.close()
    rec('errors', [e for e in errs if 'Failed to load resource' not in e])
asyncio.run(main())
R = RESULTS
finish([('no page errors', not R['errors']), ('first quest finished', R['bot']['scene'] == 'home' and R['bot']['sheet'] == 'Through the portal'), ('second quest finished', R['bot2']['scene'] == 'home'), ('every world type finished', len(R['sweep']) == 6 and all(x.endswith(':exit:home') for x in R['sweep']))])
