# Drives the sound button (spec 4.1.1) in a phone-sized headless browser: one button, in the top right corner of every
# screen and above any open sheet, that turns sound off at once and on again, keeps the choice in the save, and on the
# nest sits in the HUD's top row without covering its other buttons.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 1357; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
ELDER = "(name, seed, form) => ({ name, seed, xp: 99999, diet: { [form]: 3 }, marks: [], form, tricks: [], born: 1, done: 2, quests: 40 })"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright

# Is the sound button showing, in the top right, and the thing a tap at its middle lands on?
TOP = """() => { const b = document.querySelector('#btn-sound'), r = b.getBoundingClientRect(), a = document.querySelector('#app').getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { shown: r.width > 0 && getComputedStyle(b).display !== 'none', top: hit === b, corner: r.top - a.top < 40 && a.right - r.right < 40, on: b.getAttribute('aria-pressed') }; }"""
ok_top = lambda v: v['shown'] and v['top'] and v['corner']
# Do two boxes overlap?
OVERLAP = """(sel) => { const a = document.querySelector('#btn-sound').getBoundingClientRect(), b = document.querySelector(sel).getBoundingClientRect();
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top); }"""

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        ctx = await b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page()
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.add_init_script(SEED_JS)
        await page.goto(PAGE); await page.wait_for_timeout(800)
        ev = page.evaluate
        await ev("""() => { window.__fast = true; closeSheet(); S.quests = 20; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; S.pet.rest = 100; S.pet.asleep = false; S.dust = 500;
          window.__sfx = []; const s0 = sfx; window.sfx = (n, f) => { if (S.sound && AC && AC.state === 'running') __sfx.push(n); s0(n, f); }; updateHud(); }""")

        # the nest: in the top row, clear of the name, the journal and How to play
        rec('nest', await ev(TOP))
        rec('nest clear', await ev("(o) => ['#petname', '#btn-journal', '#btn-help', '#wallet'].map(s => eval(o)(s))", OVERLAP))
        rec('nest gap', await ev("() => { const g = document.querySelector('.ico-gap').getBoundingClientRect(), b = document.querySelector('#btn-sound').getBoundingClientRect(); return Math.abs(g.left - b.left) < 2 && Math.abs(g.top - b.top) < 2; }"))
        await page.screenshot(path=os.path.join(SHOTS, 'sound-nest.png'), clip={'x': 0, 'y': 0, 'width': 360, 'height': 140})

        # turned off with a tap, from the nest: saved, and silent straight away
        await page.tap('#stage', position={'x': 180, 'y': 400}); await page.wait_for_function("AC && AC.state === 'running'", timeout=5000)
        await page.tap('#btn-sound'); await page.wait_for_timeout(200)
        rec('off', await ev("() => ({ sound: S.sound, pressed: document.querySelector('#btn-sound').getAttribute('aria-pressed'), saved: JSON.parse(localStorage.getItem('glimmerkin.v1')).sound, ac: AC ? AC.state : 'none', toast: ui.toast.textContent })"))
        await ev("() => { __sfx.length = 0; unlockAudio(); sfx('chirp'); }")
        rec('silent', await ev("() => __sfx.length"))
        await page.screenshot(path=os.path.join(SHOTS, 'sound-off.png'), clip={'x': 0, 'y': 0, 'width': 360, 'height': 140})

        # a sheet open: still on top, and a tap there turns it back on without closing the sheet
        await ev("() => openJournal()")
        rec('sheet', await ev(TOP))
        await page.tap('#btn-sound'); await page.wait_for_function("S.sound === true && AC && AC.state === 'running'", timeout=5000)
        rec('on in sheet', await ev("() => ({ sound: S.sound, sheet: !ui.sheet.hidden, pressed: document.querySelector('#btn-sound').getAttribute('aria-pressed') })"))
        await page.screenshot(path=os.path.join(SHOTS, 'sound-sheet.png'))
        await ev("() => closeSheet()")

        # a quest: on top, clear of the world's name and its line, and works with a quest sheet open
        await ev("() => startQuest(S.portals.list[0])"); await page.wait_for_function("scene === 'quest'", timeout=5000)
        rec('quest', await ev(TOP))
        rec('quest clear', await ev("(o) => { const f = eval(o); return { name: document.querySelector('#q-name').scrollWidth <= document.querySelector('#q-name').clientWidth + 1, meta: [...document.querySelectorAll('#q-meta > *')].filter(e => e.offsetWidth).some(e => { const a = document.querySelector('#btn-sound').getBoundingClientRect(), r = e.getBoundingClientRect(); return !(a.right <= r.left || r.right <= a.left || a.bottom <= r.top || r.bottom <= a.top); }) }; }", OVERLAP))
        await page.screenshot(path=os.path.join(SHOTS, 'sound-quest.png'), clip={'x': 0, 'y': 0, 'width': 360, 'height': 160})
        await ev("() => openChip(Q.lits[0])")
        quest_sheet = rec('quest sheet', await ev("() => ({ open: !ui.sheet.hidden, ...(" + TOP + ")() })"))
        await page.tap('#btn-sound'); await page.wait_for_timeout(150)
        rec('off in quest', await ev("() => ({ sound: S.sound, scene, sheet: !ui.sheet.hidden })"))
        await page.tap('#btn-sound'); await page.wait_for_timeout(150)
        await ev("() => { closeSheet(); finishQuest(false); closeSheet(); }")

        # a bonus world, a little game, the garden and the village
        await ev("() => { startQuest({seed: 4243, biome: 'mossroot', size: 'nook', name: 'Bonus test'}); enterBonus(Object.keys(BONUS)[0]); }")
        await page.wait_for_function("scene === 'bonus'", timeout=5000)
        rec('bonus', await ev(TOP))
        await ev("() => { leaveBonus(); finishQuest(false); closeSheet(); }")
        await page.wait_for_function("scene === 'home'", timeout=5000)
        await ev("() => startGame('pile', S.littles[0], false)"); await page.wait_for_function("scene === 'bonus' && BW && BW.gid === 'pile'", timeout=5000)
        rec('little game', await ev(TOP))
        await page.screenshot(path=os.path.join(SHOTS, 'sound-game.png'))
        await ev("() => { leaveBonus(); closeSheet(); }"); await page.wait_for_function("scene === 'home'", timeout=5000)
        await ev("() => { closeSheet(); enterGarden(); }"); await page.wait_for_function("scene === 'garden'", timeout=5000)
        rec('garden', await ev(TOP))
        await ev("() => { openGardenMap(); }")
        rec('garden sheet', await ev(TOP))
        await ev("() => { closeSheet(); leaveGarden(); }")
        await ev("(E) => { const mk = eval(E); S.gen = 3; S.elders = [mk('Ember', 111, 'ember')]; afterLoad(); closeSheet(); enterVillage(); }", ELDER)
        await page.wait_for_function("scene === 'village'", timeout=5000)
        rec('village', await ev(TOP))
        await ev("() => leaveVillage()")

        # off, then the page opened again (as the home screen app does, online or not): still off, and the button says so
        await page.tap('#btn-sound'); await page.wait_for_timeout(150)
        await page.reload(); await page.wait_for_function("typeof S !== 'undefined' && S", timeout=8000); await page.wait_for_timeout(400)
        rec('kept', await ev("() => ({ sound: S.sound, pressed: document.querySelector('#btn-sound').getAttribute('aria-pressed') })"))
        await b.close()

    q = RESULTS
    finish([
        ('nest: top right, on top', ok_top(q['nest']) and q['nest']['on'] == 'true'),
        ('nest: clear of the other buttons', not any(q['nest clear'])),
        ('nest: in the gap kept for it', q['nest gap']),
        ('off: saved, pressed false, audio stopped, said', q['off']['sound'] is False and q['off']['pressed'] == 'false' and q['off']['saved'] is False and q['off']['ac'] in ('suspended', 'closed') and q['off']['toast'] == 'Sound off'),
        ('off: no sound plays', q['silent'] == 0),
        ('sheet: on top', ok_top(q['sheet'])),
        ('sheet: back on, sheet stays', q['on in sheet'] == {'sound': True, 'sheet': True, 'pressed': 'true'}),
        ('quest: on top', ok_top(q['quest'])),
        ('quest: clear of the name and line', q['quest clear']['name'] and not q['quest clear']['meta']),
        ('quest sheet: on top', quest_sheet['open'] and ok_top(quest_sheet)),
        ('quest: off in a quest with a sheet open', q['off in quest'] == {'sound': False, 'scene': 'quest', 'sheet': True}),
        ('bonus world', ok_top(q['bonus'])),
        ('little game', ok_top(q['little game'])),
        ('garden', ok_top(q['garden'])),
        ('garden sheet', ok_top(q['garden sheet'])),
        ('village', ok_top(q['village'])),
        ('kept after opening again', q['kept'] == {'sound': False, 'pressed': 'false'}),
        ('no errors', rec('errors', errs) == []),
    ])

asyncio.run(main())
