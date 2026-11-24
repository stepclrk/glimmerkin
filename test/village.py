# Drives Glimmer village (spec 4.4.12) in a phone-sized headless browser: shut until there is an elder, then a card
# under Where to?, a cottage for each elder, roles given and taken back (one elder to a role), the gardener tending
# once a day, the storyteller at the fire, the trader's weekly stall, the lamplighter's board, and the back button.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 9753; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
SHEET = "(() => ({ open: !ui.sheet.hidden, h2: ui.sheet.querySelector('h2') && ui.sheet.querySelector('h2').textContent, text: ui.sheet.textContent }))()"
ELDER = "(name, seed, form) => ({ name, seed, xp: 99999, diet: { [form]: 3 }, marks: [], form, tricks: [], born: 1, done: 2, quests: 40 })"

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
        await ev("""() => { window.__fast = true; closeSheet(); S.quests = 20; S.seen = UNLOCKS.map(u => u.id).filter(id => id !== 'village'); S.news = NEWS_V; S.pet.rest = 100; S.pet.asleep = false; S.dust = 500;
          S.littles.forEach(l => l.xp = 200); window.__toasts = []; const t0 = toast; window.toast = (m, ms) => { __toasts.push(m); t0(m, ms); }; }""")

        # no elder: no village
        rec('shut', await ev("() => { openQuestSheet(); const r = { open: villageOpen(), card: !!ui.sheet.querySelector('[data-do=\"village\"]'), unlock: unlocked('village') }; closeSheet(); return r; }"))

        # an elder: the unlock sheet, then a card under Where to?
        await ev("(E) => { const mk = eval(E); S.gen = 3; S.elders = [mk('Ember', 111, 'ember'), mk('Moss', 222, 'bloom')]; afterLoad(); }", ELDER)
        rec('unlock', await ev("() => { const due = takeUnlocks(); return due.map(u => u.id); }"))
        await ev("() => openQuestSheet()")
        rec('card', await ev("() => { const c = ui.sheet.querySelector('[data-do=\"village\"]'); return c && c.textContent; }"))
        await ev("() => ui.sheet.querySelector('[data-do=\"village\"]').click()")
        await page.wait_for_timeout(500)
        rec('in', await ev("() => ({ scene, bar: !ui.barVillage.hidden, garden: ui.barGarden.hidden, home: ui.barHome.hidden, name: $('#q-name').textContent, spots: VL.spots.filter(s => s.kind === 'elder').map(s => s.i), fire: VL.spots.some(s => s.kind === 'fire') })"))
        await page.screenshot(path=os.path.join(SHOTS, 'village.png'))

        # an elder's sheet: tap it, give it a role, give the same role to the other, take it back
        await ev("() => { const s = VL.spots.find(s => s.kind === 'elder' && s.i === 1); villageTap({ x: s.x, y: s.y }); }")
        rec('elder sheet', await ev(SHEET))
        await ev("() => ui.sheet.querySelector('[data-r=\"storyteller\"]').click()")
        rec('role given', await ev("() => ({ roles: S.village.roles, h2: ui.sheet.querySelector('h2').textContent })"))
        await page.screenshot(path=os.path.join(SHOTS, 'village-elder.png'))
        await ev("() => { closeSheet(); openElder(0); ui.sheet.querySelector('[data-r=\"storyteller\"]').click(); }")
        rec('role moved', await ev("() => S.village.roles"))
        await ev("() => ui.sheet.querySelector('[data-r=\"storyteller\"]').click()")
        rec('role taken back', await ev("() => S.village.roles"))

        # the storyteller at the fire, with the chapters told so far, and the story's teller
        await ev("() => { closeSheet(); openElder(1); ui.sheet.querySelector('[data-r=\"storyteller\"]').click(); closeSheet(); S.story.told = 2; S.reg.most = Math.max(S.reg.most || 0, 2); openFire(); }")
        rec('fire', await ev("() => ({ h2: ui.sheet.querySelector('h2').textContent, text: ui.sheet.textContent, chapters: ui.sheet.querySelectorAll('[data-do=\"chapter\"]').length })"))
        await ev("() => ui.sheet.querySelector('[data-do=\"chapter\"]').click()")
        rec('fire chapter', await ev("() => ({ h2: ui.sheet.querySelector('h2').textContent, teller: ui.sheet.textContent.includes('Moss tells a story'), back: [...ui.sheet.querySelectorAll('.btns button')].map(b => b.textContent) })"))
        await ev("() => closeSheet()")

        # the gardener: one waiting flower tended, once a local day
        await ev("() => { openElder(0); ui.sheet.querySelector('[data-r=\"gardener\"]').click(); closeSheet(); }")
        rec('gardener', await ev("""() => { const g = ensureGarden(); g.beds = { 0: { el: 'ember', st: 0, t: 0, w: 1, gl: true }, 1: { el: 'tide', st: 0, t: 0, w: 1, gl: true } }; S.village.tended = 0;
          const a = gardenerRound(), tended = Object.values(g.beds).filter(b => b.t).length, again = gardenerRound(), still = Object.values(g.beds).filter(b => b.t).length; return { a, tended, again, still, day: S.village.tended === localDay() }; }"""))

        # the trader's stall: one thing a week, bought once
        await ev("() => { openElder(1); ui.sheet.querySelector('[data-r=\"trader\"]').click(); closeSheet(); }")
        rec('teller after', await ev("() => storyTeller().name"))
        st = rec('stall', await ev("() => { const s = stallThing(); return { id: s.id, price: s.price, bought: s.bought, inSeason: s.id.startsWith('wear:') ? WEAR[s.id.slice(5)].season === seasonNow() : null }; }"))
        # the stall's spot is laid out as the village is drawn, so wait for a frame with the trader in it
        await page.wait_for_function("VL.spots.some(s => s.kind === 'stall')", timeout=5000)
        await ev("() => { const s = VL.spots.find(s => s.kind === 'stall'); villageTap({ x: s.x, y: s.y }); }")
        rec('stall sheet', await ev(SHEET))
        rec('bought', await ev("() => { const d = S.dust; ui.sheet.querySelector('[data-do=\"buy\"]').click(); return { spent: d - S.dust, bought: stallThing().bought, again: ui.sheet.querySelector('[data-do=\"buy\"]').disabled }; }"))
        await ev("() => closeSheet()")

        # the lamplighter's board: the latest pictures from littles away
        await ev("""() => { const l = S.littles[S.littles.length - 1]; setOff(l.id); closeSheet(); S.away[0].left = Date.now() - 25 * 86400000; adventureMail(); closeSheet();
          openElder(0); ui.sheet.querySelector('[data-r=\"lamplighter\"]').click(); closeSheet(); }""")
        await page.wait_for_function("VL.spots.some(s => s.kind === 'board')", timeout=5000)
        rec('board', await ev("() => { const s = VL.spots.find(s => s.kind === 'board'); if (!s) return null; villageTap({ x: s.x, y: s.y }); return { h2: ui.sheet.querySelector('h2').textContent, pics: ui.sheet.querySelectorAll('[data-do=\"selfie\"]').length }; }"))
        await ev("() => ui.sheet.querySelector('[data-do=\"selfie\"]').click()")
        rec('board pic', await ev("() => ({ h2: ui.sheet.querySelector('h2').textContent, back: [...ui.sheet.querySelectorAll('.btns button')].map(b => b.textContent) })"))
        await ev("() => closeSheet()")
        await page.screenshot(path=os.path.join(SHOTS, 'village-roles.png'))

        # leaving, and kept over a reload; a save from before the village loads with no roles
        await ev("() => ui.barVillage.querySelector('[data-v=\"leave\"]').click()")
        rec('left', await ev("() => ({ scene, home: !ui.barHome.hidden, vl: VL })"))
        rec('reload', await ev("() => { const d = JSON.parse(JSON.stringify(S)); S = d; afterLoad(); return S.village.roles; }"))
        rec('old save', await ev("() => { const d = JSON.parse(JSON.stringify(S)); delete d.village; S = d; afterLoad(); return S.village; }"))
        await b.close()

    R = RESULTS
    rec('errors', errs)
    finish([
        ('no elder: no village, no card, no unlock', R['shut'] == {'open': False, 'card': False, 'unlock': False}),
        ('an elder opens the village, told once', R['unlock'] == ['village']),
        ('Where to? has a card for the village', R['card'] and 'Glimmer village' in R['card'] and '2 elders live there' in R['card']),
        ('walking in shows the village, its bar and a spot for each elder and the fire', R['in']['scene'] == 'village' and R['in']['bar'] and R['in']['garden'] and R['in']['home'] and R['in']['name'] == 'Glimmer village' and sorted(R['in']['spots']) == [0, 1] and R['in']['fire']),
        ('tapping an elder opens its sheet with the four roles', R['elder sheet']['h2'] == 'Moss' and all(w in R['elder sheet']['text'] for w in ['Gardener', 'Storyteller', 'Trader', 'Lamplighter', 'Elders have no needs'])),
        ('a role is given, and the sheet says so', R['role given'] == {'roles': {'1': 'storyteller'}, 'h2': 'Moss, the storyteller'}),
        ('a role goes to one elder at a time', R['role moved'] == {'0': 'storyteller'}),
        ('tapping a role again takes it back', R['role taken back'] == {}),
        ('the storyteller tells a family tale at the fire, with the chapters so far', R['fire']['h2'] == 'By the fire' and 'Moss, the storyteller' in R['fire']['text'] and R['fire']['chapters'] == 2),
        ('a chapter from the fire is told by the storyteller, and goes back to the fire', R['fire chapter']['teller'] and R['fire chapter']['back'][0] == 'Back to the fire'),
        ('the gardener tends one waiting flower, once a day', R['gardener']['tended'] == 1 and 'Ember tended the' in R['gardener']['a'] and R['gardener']['again'] == '' and R['gardener']['still'] == 1 and R['gardener']['day']),
        ('without a storyteller, the most recent elder tells the story', R['teller after'] == 'Moss'),
        ('the stall has one thing the trader never has: a costume out of season, or frostberries out of winter', (st['inSeason'] is False) or st['id'] in ('frost', 'star')),
        ('the stall opens from the village', R['stall sheet']['h2'] == 'Moss\'s stall'),
        ('it is bought once a week', R['bought']['spent'] == st['price'] and R['bought']['bought'] and R['bought']['again']),
        ('the lamplighter\'s board shows pictures from littles away', R['board'] and R['board']['h2'] == 'The village board' and R['board']['pics'] >= 1),
        ('a picture opens and goes back to the board', R['board pic']['back'][-1] == 'Back to the list'),
        ('Back to the nest leaves the village', R['left'] == {'scene': 'home', 'home': True, 'vl': None}),
        ('roles survive a reload', R['reload'] == {'0': 'lamplighter', '1': 'trader'}),
        ('a save from before the village loads with no roles', R['old save']['roles'] == {}),
        ('no script errors', not errs),
    ])

asyncio.run(main())
