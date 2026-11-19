# Drives using what you carry (spec 4.4.10) in a phone-sized headless browser: a tool in the bag glows while
# something it would help with is in reach, and not before; the glow fades once that thing is dealt with; the first
# glow of each tool explains itself once; and tapping a tool in the bag says what it does.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 2468; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
GLOWING = "[...document.querySelectorAll('#q-bag .hint')].map(e => e.dataset.tool).sort().join()"
# The tiles beside the start that are open floor, with nothing on them.
# Starts a quest and opens every way: every blocker cleared, every gloom gone, the gate and any song door open.
OPEN_UP = """() => { startQuest(%s); const w = Q.world; w.cells.forEach(c => { if (c.t === 'ob') c.cleared = true; c.enemy = null; }); Q.gateOpen = true; Q.songOpen = true; Q.hintT = 0; }"""
# Taps the treasure vault where it is drawn.
TAP_VAULT = "() => { const v = Q.world.vault; questTap({x: Q.ox + (v.x + 0.5) * Q.ts, y: Q.oy + (v.y + 0.5) * Q.ts}); }"
NEXT = "(() => { const w = Q.world, s = w.start, out = []; for (const [dx, dy] of DIRS) { const x = s.x + dx, y = s.y + dy; if (x < 0 || y < 0 || x >= w.W || y >= w.H) continue; const c = w.cells[y * w.W + x]; if (c.t === 'floor' && !c.enemy && !c.item && !c.slick && !c.pad) out.push(y * w.W + x); } return out; })()"

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
        # a player well on: every unlock seen, no tools yet; toasts are counted as they come
        await ev("""() => { window.__fast = true; closeSheet(); S.quests = 14; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; S.pet.rest = 100; S.pet.asleep = false; S.pet.joy = 50; S.tools = {}; S.j.toolTold = {};
          S.party = S.littles.slice(0, 2).map(l => l.id); window.__toasts = []; const t0 = toast; window.toast = (m, ms) => { __toasts.push(m); t0(m, ms); }; }""")
        # a quiet world: every blocker on the way cleared, every gloom gone, no moon gate
        await ev("""() => { startQuest({seed: 823576, biome: 'mossroot', size: 'vale', name: 'Hint Hollow'}); const w = Q.world;
          w.cells.forEach(c => { if (c.t === 'ob') c.cleared = true; c.enemy = null; if (c.t === 'gate') c.t = 'floor'; }); w.gate = null; w.plate = null; Q.hintT = 0; }""")
        await page.wait_for_function("Q && Q.hintKey !== undefined")
        rec('no tools', await ev("({bag: document.getElementById('q-bag').textContent, glowing: " + GLOWING + "})"))
        # tools in the bag, with nothing to use them on
        await ev("S.tools = {seed: 1, bell: 1, key: 1, lantern: 1}; Q.bag = null; updateQuestHud(); Q.hintT = 0")
        await page.wait_for_function("document.querySelectorAll('#q-bag [data-tool]').length === 4 && Q.hintKey !== undefined")
        rec('nothing to help with', await ev(GLOWING))
        nxt = await ev(NEXT)
        # a chasm out of reach: no glow
        far = await ev("""() => { const w = Q.world, s = w.start; for (let k = 0; k < w.cells.length; k++) { const x = k % w.W, y = (k - x) / w.W; if (Math.abs(x - s.x) + Math.abs(y - s.y) < 4 || (x === w.exit.x && y === w.exit.y)) continue;
          // a chasm walled in on every side: nothing can walk up to it
          const c = w.cells[k]; c.t = 'ob'; c.ob = 'chasm'; c.cleared = false; for (const [dx, dy] of DIRS) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < w.W && b < w.H && !(a === w.exit.x && b === w.exit.y)) { const d = w.cells[b * w.W + a]; d.t = 'wall'; d.item = null; d.enemy = null; } } Q.hintT = 0; return k; } return -1; }""")
        await page.wait_for_timeout(600)
        rec('a chasm out of reach', {'k': far, 'glowing': await ev(GLOWING)})
        # a chasm beside the start: the seed glows, and says how it is used the first time
        await ev("k => { const c = Q.world.cells[k]; c.t = 'ob'; c.ob = 'chasm'; c.cleared = false; Q.hintT = 0; }", nxt[0])
        await page.wait_for_function("document.querySelector('#q-bag [data-tool=seed]').classList.contains('hint')")
        await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/i1_seed_glows.png')
        rec('a chasm in reach', {'glowing': await ev(GLOWING), 'toasts': await ev("__toasts.slice()"), 'told': await ev("S.j.toolTold")})
        # planting the seed: the glow fades
        await ev("k => useTool('seed', k)", nxt[0])
        await page.wait_for_function("!document.querySelector('#q-bag [data-tool=seed]') || !document.querySelector('#q-bag [data-tool=seed]').classList.contains('hint')")
        rec('the seed planted', {'seed': await ev("S.tools.seed || 0"), 'glowing': await ev(GLOWING)})
        # a second chasm with another seed: it glows again, but says nothing more
        await ev("k => { S.tools.seed = 1; Q.bag = null; updateQuestHud(); const c = Q.world.cells[k]; c.t = 'ob'; c.ob = 'chasm'; c.cleared = false; Q.hintT = 0; __toasts.length = 0; }", nxt[0])
        await ev("k => { const c = Q.world.cells[k]; c.t = 'ob'; c.ob = 'water'; c.cleared = false; Q.hintT = 0; }", nxt[1] if len(nxt) > 1 else nxt[0])
        await page.wait_for_function("document.querySelector('#q-bag [data-tool=seed]').classList.contains('hint')")
        rec('a pool in reach, told before', {'glowing': await ev(GLOWING), 'toasts': await ev("__toasts.slice()")})
        await ev("k => { Q.world.cells[k].cleared = true; Q.hintT = 0; }", nxt[1] if len(nxt) > 1 else nxt[0])
        # a gloom beside the start: the scare-bell glows
        await ev("k => { Q.world.cells[k].enemy = {g: 0, tough: 2}; Q.hintT = 0; __toasts.length = 0; }", nxt[0])
        await page.wait_for_function("document.querySelector('#q-bag [data-tool=bell]').classList.contains('hint')")
        rec('a gloom in reach', {'glowing': await ev(GLOWING), 'toasts': await ev("__toasts.slice()")})
        # a boss is no use to the bell
        await ev("k => { Q.world.cells[k].enemy = {g: 0, tough: 3, boss: true}; Q.hintT = 0; }", nxt[0])
        await page.wait_for_function("!document.querySelector('#q-bag [data-tool=bell]').classList.contains('hint')")
        rec('a boss in reach', await ev(GLOWING))
        await ev("k => { Q.world.cells[k].enemy = null; Q.hintT = 0; }", nxt[0])
        # a little out of sparks: the lantern glows
        await ev("() => { Q.lits[0].sp = 0; Q.hintT = 0; __toasts.length = 0; }")
        await page.wait_for_function("document.querySelector('#q-bag [data-tool=lantern]').classList.contains('hint')")
        rec('a little out of sparks', {'glowing': await ev(GLOWING), 'toasts': await ev("__toasts.slice()")})
        await ev("() => { Q.lits[0].sp = Q.lits[0].max; Q.hintT = 0; }")
        # a sealed moon gate beside the start: the key glows, and turning it fades the glow
        await ev("k => { const w = Q.world, c = w.cells[k]; c.t = 'gate'; w.gate = {x: k % w.W, y: Math.floor(k / w.W)}; Q.gateOpen = false; Q.hintT = 0; __toasts.length = 0; }", nxt[0])
        await page.wait_for_function("document.querySelector('#q-bag [data-tool=key]').classList.contains('hint')")
        rec('a moon gate in reach', {'glowing': await ev(GLOWING), 'toasts': await ev("__toasts.slice()")})
        await ev("k => useTool('key', k)", nxt[0])
        await page.wait_for_function("!document.querySelector('#q-bag [data-tool=key]')")
        rec('the gate opened', {'gate': await ev("Q.gateOpen"), 'glowing': await ev(GLOWING)})
        # tapping a tool in the bag says what it does
        await ev("__toasts.length = 0"); await page.click('#q-bag [data-tool="bell"]')
        rec('tap the bell', await ev("__toasts.slice()"))
        # treasure vaults: every world asked for one, so this one has it, locked with the only tool held
        await ev("() => { closeSheet(); Q = null; scene = 'home'; setSceneUI(); const g0 = genWorld; window.genWorld = (seed, party, q, size, b, opts) => g0(seed, party, q, size, b, Object.assign({}, opts, {vault: 1})); S.tools = {key: 1}; S.pet.rest = 100; }")
        await ev(OPEN_UP % "{seed: 4711, biome: 'emberfall', size: 'vale', name: 'Vault Vale'}")
        rec('a vault', await ev("({vault: Q.world.vault, wall: Q.world.cells[Q.world.vault.y * Q.world.W + Q.world.vault.x].t})"))
        await page.wait_for_function("document.querySelector('#q-bag [data-tool=key]') && document.querySelector('#q-bag [data-tool=key]').classList.contains('hint')")
        await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/i2_vault.png')
        await ev(TAP_VAULT)
        rec('the vault sheet', await ev("({text: ui.sheet.textContent, tool: !!ui.sheet.querySelector('[data-do=tool]')})"))
        await page.screenshot(path=SHOTS + '/i3_vault_sheet.png')
        await page.click('#sheet [data-do="tool"]')
        await page.wait_for_function("!ui.sheet.hidden && ui.sheet.textContent.includes('The vault opens')")
        await page.screenshot(path=SHOTS + '/i4_vault_open.png')
        rec('opened', await ev("({key: S.tools.key || 0, found: Q.found.slice(), dust: Q.loot.dust, vaults: S.j.vaults, open: Q.world.cells[Q.world.vault.y * Q.world.W + Q.world.vault.x].vault.open, text: ui.sheet.textContent})"))
        await ev("() => { closeSheet(); __toasts.length = 0; }"); await ev(TAP_VAULT)
        rec('opened again', await ev("__toasts.slice()"))
        await ev("finishQuest(true)")
        rec('home with it', await ev("({text: ui.sheet.textContent, names: Q === null ? null : 1})"))
        rec('journal', await ev("() => { closeSheet(); openJournal(); const h = [...ui.sheet.querySelectorAll('h3')].map(e => e.textContent).find(t => t.startsWith('Tools and charms')); closeSheet(); return h; }"))
        # with no tool at all: the vault says what would open it, and where to get one
        await ev("() => { closeSheet(); S.tools = {}; S.pet.rest = 100; }")
        await ev(OPEN_UP % "{seed: 4712, biome: 'emberfall', size: 'vale', name: 'Empty Bag'}")
        await ev(TAP_VAULT)
        rec('no tool', await ev("({tool: Q.world.vault.tool, text: ui.sheet.textContent, button: !!ui.sheet.querySelector('[data-do=tool]')})"))
        await ev("() => { closeSheet(); finishQuest(false); closeSheet(); }")
        # a locked world: its card says what it needs, and going sets those tools aside for its locks
        await ev("() => { window.genWorld = window.genWorld; S.tools = {seed: 1, bell: 1}; S.pet.rest = 100; S.portals.locked = {seed: 5150, biome: 'emberfall', size: 'vale', locked: true, needs: ['seed', 'bell'], name: 'The Bramble Steps'}; openQuestSheet(); }")
        await page.wait_for_selector('#sheet [data-do="go"][data-i="locked"]')
        await ev("document.querySelector('#sheet [data-i=locked]').scrollIntoView()"); await page.screenshot(path=SHOTS + '/i5_locked_card.png')
        rec('locked card', await ev("document.querySelector('#sheet [data-i=locked]').textContent"))
        await page.click('#sheet [data-do="go"][data-i="locked"]')
        await page.wait_for_function("Q && Q.locked")
        rec('locked world', await ev("({kept: Q.kept, locks: Q.world.locks, cells: Q.world.cells.filter(c => c.lock).map(c => c.lock + ':' + (c.ob || (c.enemy && c.enemy.giant ? 'giant' : '?'))), portal: S.portals.locked, vault: !!Q.world.vault, biome: document.getElementById('q-biome').textContent, bag: document.getElementById('q-bag').textContent, j: S.j.locked})"))
        # a kept tool cannot be spent on anything else
        await ev("() => { const w = Q.world; w.cells.forEach(c => { if (c.t === 'ob' && !c.lock) c.cleared = true; if (!c.lock) c.enemy = null; }); Q.gateOpen = true; Q.songOpen = true; }")
        nxt = await ev(NEXT)
        await ev("k => { const c = Q.world.cells[k]; c.t = 'ob'; c.ob = 'water'; c.cleared = false; useTool('seed', k); }", nxt[0])
        rec('spare seed', await ev("k => ({seed: S.tools.seed, cleared: !!Q.world.cells[k].cleared})", nxt[0]))
        await ev("k => { Q.world.cells[k].cleared = true; Q.hintT = 0; }", nxt[0])
        # the giant gloom: no little can move it, the kept scare-bell can
        await ev("() => { const w = Q.world, k = w.cells.findIndex(c => c.lock === 'bell'); questTap({x: Q.ox + (k % w.W + 0.5) * Q.ts, y: Q.oy + (Math.floor(k / w.W) + 0.5) * Q.ts}); }")
        await page.wait_for_function("!ui.sheet.hidden")
        await page.screenshot(path=SHOTS + '/i6_giant.png')
        rec('giant sheet', await ev("({text: ui.sheet.textContent, sends: ui.sheet.querySelectorAll('[data-do=send]:not([disabled])').length, tool: !!ui.sheet.querySelector('[data-do=tool]')})"))
        await page.click('#sheet [data-do="tool"]')
        await page.wait_for_function("!Q.world.cells.some(c => c.lock === 'bell' && c.enemy)")
        # the wide chasm, right in front of the portal: the kept bridge seed
        await ev("() => { const w = Q.world, k = w.cells.findIndex(c => c.lock === 'seed'); questTap({x: Q.ox + (k % w.W + 0.5) * Q.ts, y: Q.oy + (Math.floor(k / w.W) + 0.5) * Q.ts}); }")
        await page.wait_for_function("!ui.sheet.hidden")
        await page.screenshot(path=SHOTS + '/i7_wide.png')
        rec('wide sheet', await ev("({text: ui.sheet.textContent, sends: ui.sheet.querySelectorAll('[data-do=send]:not([disabled])').length, tool: !!ui.sheet.querySelector('[data-do=tool]')})"))
        await page.click('#sheet [data-do="tool"]')
        await page.wait_for_function("Q.world.cells.every(c => c.lock !== 'seed' || c.cleared)")
        rec('through', await ev("() => ({kept: Q.kept, tools: S.tools, exit: flood(Q.world, Q.px, Q.py, Q).has(Q.world.exit.y * Q.world.W + Q.world.exit.x)})"))
        await ev("() => { closeSheet(); finishQuest(true); closeSheet(); }")
        # leaving a locked world early keeps the tools; and with a tool gone, the card says so and the world will not open
        await ev("() => { S.tools = {key: 1}; S.pet.rest = 100; startQuest({seed: 5151, biome: 'mossroot', size: 'vale', locked: true, needs: ['key'], name: 'Keyhole Vale'}); }")
        rec('kept key', await ev("({kept: Q && Q.kept, locks: Q && Q.world.locks})"))
        await ev("() => { finishQuest(false); closeSheet(); }")
        rec('left early', await ev("S.tools.key"))
        await ev("() => { S.tools = {}; S.pet.rest = 100; __toasts.length = 0; S.portals.locked = {seed: 5152, biome: 'mossroot', size: 'vale', locked: true, needs: ['key'], name: 'Keyhole Vale'}; openQuestSheet(); }")
        rec('without the key', await ev("() => { const b = document.querySelector('#sheet [data-i=locked]'); const out = {text: b.textContent, off: b.disabled}; closeSheet(); startQuest(S.portals.locked); out.quest = !!Q; out.toasts = __toasts.slice(); return out; }"))
        # the explanations stay told after a save and a reload
        await ev("save()")
        await page.reload(); await page.wait_for_timeout(800)
        rec('after a reload', await ev("S.j.toolTold"))
        rec('errors', errs)
        await b.close()

    R = RESULTS
    finish([
        ('no tools: the bag says so and nothing glows', 'No tools' in R['no tools']['bag'] and R['no tools']['glowing'] == ''),
        ('tools with nothing to help with do not glow', R['nothing to help with'] == ''),
        ('a chasm out of reach does not glow', R['a chasm out of reach']['k'] >= 0 and R['a chasm out of reach']['glowing'] == ''),
        ('a chasm in reach lights the bridge seed', R['a chasm in reach']['glowing'] == 'seed'),
        ('the first glow explains the seed once', any('bridge seed' in t for t in R['a chasm in reach']['toasts']) and R['a chasm in reach']['told'].get('seed') is True),
        ('planting the seed uses it and the glow fades', R['the seed planted']['seed'] == 0 and 'seed' not in R['the seed planted']['glowing']),
        ('a pool lights the seed again without a second explanation', R['a pool in reach, told before']['glowing'] == 'seed' and not any('bridge seed' in t for t in R['a pool in reach, told before']['toasts'])),
        ('a gloom in reach lights the scare-bell and explains it', R['a gloom in reach']['glowing'] == 'bell' and any('scare-bell' in t for t in R['a gloom in reach']['toasts'])),
        ('a boss does not light the scare-bell', 'bell' not in R['a boss in reach']),
        ('a little out of sparks lights the lantern and explains it', R['a little out of sparks']['glowing'] == 'lantern' and any('spark lantern' in t for t in R['a little out of sparks']['toasts'])),
        ('a sealed gate lights the moon key and explains it', R['a moon gate in reach']['glowing'] == 'key' and any('moon key' in t for t in R['a moon gate in reach']['toasts'])),
        ('turning the key opens the gate and the key is gone', R['the gate opened']['gate'] is True and 'key' not in R['the gate opened']['glowing']),
        ('tapping a tool in the bag says what it does', any(t.startswith('Scare-bell:') for t in R['tap the bell'])),
        ('a vault stands in a wall, locked with the tool held', R['a vault']['vault'] is not None and R['a vault']['vault']['tool'] == 'key' and R['a vault']['wall'] == 'wall'),
        ('the vault sheet offers the moon key and greys out the littles', 'Treasure vault' in R['the vault sheet']['text'] and 'Turn a moon key' in R['the vault sheet']['text'] and 'Only a moon key opens a moon lock' in R['the vault sheet']['text'] and R['the vault sheet']['tool']),
        ('opening it spends the key and gives stardust and two finds', R['opened']['key'] == 0 and len(set(R['opened']['found'])) == 2 and R['opened']['dust'] >= 25 and R['opened']['vaults'] == 1 and R['opened']['open'] is True and 'stardust' in R['opened']['text']),
        ('an open vault is empty', any('empty' in t for t in R['opened again'])),
        ('the finds come home', 'Found' in R['home with it']['text']),
        ('the journal counts vaults opened', R['journal'] and '1 vault opened' in R['journal']),
        ('with no tool the vault says where to get one', 'You have no' in R['no tool']['text'] and 'trader' in R['no tool']['text'] and not R['no tool']['button']),
        ('the locked card lists what it needs and the vault', all(t in R['locked card'] for t in ['Locked world', 'Bridge seed', 'Scare-bell', 'set aside', 'treasure vault'])),
        ('going sets the tools aside for the locks', R['locked world']['kept'] == {'seed': 1, 'bell': 1} and sorted(R['locked world']['cells']) == ['bell:giant', 'seed:wide'] and R['locked world']['portal'] is None and R['locked world']['vault'] and 'Locked world' in R['locked world']['biome'] and 'kept' in R['locked world']['bag'] and R['locked world']['j'] == 1),
        ('a kept seed is not spent on a pool', R['spare seed']['seed'] == 1 and not R['spare seed']['cleared']),
        ('the giant gloom takes the scare-bell, not a little', 'Giant' in R['giant sheet']['text'] and 'Too big to chase off' in R['giant sheet']['text'] and R['giant sheet']['sends'] == 0 and R['giant sheet']['tool']),
        ('the wide chasm takes the bridge seed, not a little', 'Wide chasm' in R['wide sheet']['text'] and 'Plant your bridge seed' in R['wide sheet']['text'] and R['wide sheet']['sends'] == 0 and R['wide sheet']['tool']),
        ('with both locks open the way out is clear', R['through']['kept'] == {'seed': 0, 'bell': 0} and not R['through']['tools'].get('seed') and not R['through']['tools'].get('bell') and R['through']['exit']),
        ('leaving early keeps the kept tool', R['kept key']['kept'] == {'key': 1} and R['left early'] == 1),
        ('without the tool the card says so and the world will not open', R['without the key']['off'] and 'no longer have a moon key' in R['without the key']['text'] and not R['without the key']['quest'] and any('needs a moon key' in t for t in R['without the key']['toasts'])),
        ('what was explained is kept', all(R['after a reload'].get(k) for k in ['seed', 'bell', 'lantern', 'key'])),
        ('no page errors', not R['errors']),
    ])

asyncio.run(main())
