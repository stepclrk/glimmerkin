# Drives the story of the glooms (spec 4.4.11) in a phone-sized headless browser: a chapter for each heart beaten,
# told after the quest and at start-up, several due at once told one after another, calming in place of chasing off
# (same sparks), calmed glooms counted and visiting the garden, and the journal keeping the story to read again.
import os, pathlib, tempfile, asyncio
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 1357; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
SHEET = "(() => ({ open: !ui.sheet.hidden, h2: ui.sheet.querySelector('h2') && ui.sheet.querySelector('h2').textContent, text: ui.sheet.textContent, btns: [...ui.sheet.querySelectorAll('.btns button')].map(b => b.textContent) }))()"
# A quest with a plain gloom next to ground the party can reach from the start, and a little brave enough with the sparks.
FIND = """() => { for (let s = 100; s < 400; s++) { if (Q) { Q = null; scene = 'home'; setSceneUI(); }
    S.pet.rest = 100; startQuest({ seed: s, biome: BIOMES[s % 6].id, size: 'vale', name: 'Calm test' }); const w = Q.world, prev = flood(w, Q.px, Q.py, Q);
    for (let k = 0; k < w.cells.length; k++) { const e = w.cells[k].enemy; if (!e || e.boss || e.giant) continue; const [x, y] = qXY(k); if (nearIn(w, prev, x, y) < 0) continue;
      const i = Q.lits.findIndex(f => !afraid(f, e) && f.sp >= fightCost(e, f.kinds, f.ring)); if (i >= 0) return { k, i, g: e.g, cost: fightCost(e, Q.lits[i].kinds, Q.lits[i].ring), sp: Q.lits[i].sp, biome: Q.B.id }; } }
  return null; }"""

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
        await ev("""() => { window.__fast = true; closeSheet(); S.quests = 14; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; S.pet.rest = 100; S.pet.asleep = false;
          const r = RNG(5); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r)); S.littles = S.littles.slice(0, 6); S.party = S.littles.slice(0, 3).map(l => l.id); partyLittles(); }""")

        # before any heart: nothing to tell, and glooms are chased off
        rec('before', await ev("() => ({ told: S.story.told, calm: storyCalm(), due: chapterDue(), opened: tellStory() })"))
        f0 = rec('found', await ev(FIND))
        await ev("([k]) => { const w = Q.world; openTarget(k, 'enemy', flood(w, Q.px, Q.py, Q)); }", [f0['k']])
        rec('chase label', await ev("() => ui.sheet.textContent.includes('Chase it off') && !ui.sheet.textContent.includes('Calm it')"))
        await ev("() => { closeSheet(); Q = null; scene = 'home'; setSceneUI(); }")

        # the first heart beaten: chapter 1, told by the trader while there is no elder
        await ev("() => { S.reg.most = 1; tellStory(); }")
        rec('chapter 1', await ev(SHEET))
        await page.screenshot(path=os.path.join(SHOTS, 'story-chapter.png'))
        rec('after 1', await ev("() => ({ told: S.story.told, calm: storyCalm() })"))
        await ev("() => ui.sheet.querySelector('[data-do=\"ok\"]').click()")

        # two more due at once: told one after the other
        await ev("() => { S.reg.most = 3; tellStory(); }")
        rec('chapter 2', await ev(SHEET))
        await ev("() => ui.sheet.querySelector('[data-do=\"next\"]').click()")
        rec('chapter 3', await ev(SHEET))
        rec('after 3', await ev("() => S.story.told"))
        await ev("() => closeSheet()")

        # a quest: the same gloom is calmed for the same sparks, counted, and steps aside
        f = rec('found again', await ev(FIND))
        await ev("([k]) => { const w = Q.world; openTarget(k, 'enemy', flood(w, Q.px, Q.py, Q)); }", [f['k']])
        rec('calm label', await ev("() => ui.sheet.textContent.includes('Calm it') && !ui.sheet.textContent.includes('Chase it off')"))
        await page.screenshot(path=os.path.join(SHOTS, 'story-calm-sheet.png'))
        await ev("() => closeSheet()")
        await ev("async ([k, i]) => { await sendFight(Q.lits[i], k); }", [f['k'], f['i']])
        rec('calmed', await ev("([k, i]) => ({ gone: !Q.world.cells[k].enemy, sp: Q.lits[i].sp, calmed: S.calmed.length, last: S.calmed[S.calmed.length - 1], j: S.j.calmed, fx: (Q.calmFx || []).length })", [f['k'], f['i']]))
        await page.screenshot(path=os.path.join(SHOTS, 'story-calmed.png'))
        await page.wait_for_function("!Q.calmFx || Q.calmFx.length === 0", timeout=8000)
        rec('steps aside', True)

        # the results sheet, closed, tells a chapter that has come due
        await ev("() => { S.reg.most = 4; finishQuest(false); }")
        await ev("() => ui.sheet.querySelector('[data-do=\"ok\"]').click()")
        await page.wait_for_function("!ui.sheet.hidden", timeout=5000)
        rec('after results', await ev(SHEET))
        await ev("() => closeSheet()")

        # the garden: the calmed kind comes to visit, the others do not
        await ev("() => { S.quests = 14; S.pet.asleep = false; enterGarden(); closeSheet(); }")
        rec('visitors', await ev("([g]) => VISITORS.filter(v => v.calm).map(v => [v.g, visitAnchors(v, GA).length > 0, v.g === g])", [f['g']]))
        rec('visitor line', await ev("([g]) => visitorById('calm' + g).line", [f['g']]))
        await ev("() => leaveGarden()")

        # the journal keeps the story and the count, and a chapter opens again from it
        await ev("() => openJournal()")
        rec('journal', await ev("() => ({ story: ui.sheet.textContent.includes('The story · 4 of 6 chapters'), count: ui.sheet.textContent.includes('1 gloom calmed'), met: ui.sheet.textContent.includes('Glooms met'), chapters: ui.sheet.querySelectorAll('[data-do=\"chapter\"]').length })"))
        await ev("() => ui.sheet.querySelector('[data-do=\"chapter\"][data-i=\"1\"]').click()")
        rec('reread', await ev(SHEET))
        rec('reread keeps count', await ev("() => S.story.told"))
        await ev("() => ui.sheet.querySelector('[data-do=\"back\"]').click()")
        rec('back to journal', await ev("() => ui.sheet.querySelector('h2').textContent"))
        await ev("() => closeSheet()")

        # an elder tells it once there is one
        await ev("() => { S.elders = [{ name: 'Ember', seed: 111, xp: 99999, diet: { ember: 3 }, marks: [], form: 'ember', tricks: [], born: 1, done: 2, quests: 9 }]; openChapter(0); }")
        rec('elder tells', await ev("() => ui.sheet.textContent.includes('Ember tells a story')"))
        await ev("() => closeSheet()")

        # kept over a reload, and a save from before the story starts it at nothing told
        rec('reload', await ev("() => { const d = JSON.parse(JSON.stringify(S)); S = d; afterLoad(); return { told: S.story.told, calmed: S.calmed.length }; }"))
        rec('old save', await ev("() => { const d = JSON.parse(JSON.stringify(S)); delete d.story; delete d.calmed; S = d; afterLoad(); return { told: S.story.told, calmed: S.calmed.length, calm: storyCalm() }; }"))
        await b.close()

    R = RESULTS
    rec('errors', errs)
    finish([
        ('before any heart: nothing told, glooms are chased off', R['before'] == {'told': 0, 'calm': False, 'due': False, 'opened': False} and R['chase label']),
        ('the first heart brings chapter 1, told by the wandering trader', R['chapter 1']['h2'] == 'The lamp that went out' and 'The wandering trader tells a story' in R['chapter 1']['text'] and 'calms it instead of chasing it off' in R['chapter 1']['text']),
        ('after chapter 1, glooms are calmed', R['after 1'] == {'told': 1, 'calm': True}),
        ('two chapters due are told one after the other', R['chapter 2']['h2'] == 'Where the light went' and R['chapter 2']['btns'] == ['Next chapter'] and R['chapter 3']['h2'] == 'Wick' and R['after 3'] == 3),
        ('a gloom\'s sheet offers Calm it, not Chase it off', R['calm label']),
        ('calming takes the same sparks as chasing off, and clears the way', R['calmed']['gone'] and R['calmed']['sp'] == R['found again']['sp'] - R['found again']['cost']),
        ('a calmed gloom is counted with its kind and where it was met', R['calmed']['calmed'] == 1 and R['calmed']['j'] == 1 and R['calmed']['last']['g'] == R['found again']['g'] and R['calmed']['last']['b'] == R['found again']['biome']),
        ('it steps aside and fades away', R['calmed']['fx'] == 1 and R['steps aside']),
        ('closing the results tells a chapter that has come due', R['after results']['h2'] == 'The keepers'),
        ('only the calmed kind visits the garden', all(ok == mine for g, ok, mine in R['visitors'])),
        ('its visitor line says where it was calmed', 'the gloom you calmed in' in R['visitor line']),
        ('the journal keeps the story, the count and every chapter', R['journal'] == {'story': True, 'count': True, 'met': True, 'chapters': 4}),
        ('a chapter reads again from the journal, and goes back to it', R['reread']['h2'] == 'Where the light went' and R['reread keeps count'] == 4 and R['back to journal'] == 'Journal'),
        ('an elder tells the story once there is one', R['elder tells']),
        ('the story survives a reload', R['reload'] == {'told': 4, 'calmed': 1}),
        ('a save from before the story starts at nothing told', R['old save'] == {'told': 0, 'calmed': 0, 'calm': False}),
        ('no script errors', not errs),
    ])

asyncio.run(main())
