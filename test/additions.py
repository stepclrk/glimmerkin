"""Browser checks for what has been added to the game since it first shipped: wishes, world rules,
littles working together, Mythic forms and the journey. Each section sets the state it needs."""
import os, pathlib, tempfile, asyncio, re
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
BOT = re.search(r'BOT = """(.*?)"""', (ROOT / 'test' / 'smoke.py').read_text(), re.S).group(1)
RESULTS, CHECKS = {}, []
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def check(name, ok):
    CHECKS.append((name, bool(ok)))

async def wishes(page, ev):
    # A wish is rolled on load, is the same all day, and has words and a place in the quest sheet.
    w = rec('wish', await ev("({kind: S.wish.kind, day: S.wish.day === localDay(), text: wishText(S.wish), again: rollWish() === S.wish})"))
    check('a wish is rolled for today and stays the same all day', w['day'] and w['again'] and w['kind'] in ('berry', 'world', 'cuddle', 'nap') and len(w['text']) > 20)
    # Berry: the right berry grants it, the wrong one does not.
    r = rec('berry wish', await ev("""() => { S.wish = {day: localDay(), kind: 'berry', el: 'tide', done: false}; S.pantry.tide = 0; S.pet.belly = 40; const dust = S.dust, n = S.j.wishes || 0;
      const needs = wishBiome(S.wish); rollPortals(true); const offered = S.portals.list.some(o => o.biome === 'tidehollow');
      eat('ember'); const wrong = S.wish.done; S.pantry.tide = 1; const needsNow = wishBiome(S.wish); eat('tide');
      return {needs, offered, wrong, needsNow, done: S.wish.done, dust: S.dust - dust, count: (S.j.wishes || 0) - n, joy: S.pet.joy}; }"""))
    check('a berry wish with none in the pantry puts its world among the portals', r['needs'] == 'tidehollow' and r['offered'] and r['needsNow'] is None)
    check('only the wished-for berry grants the wish, once, and pays stardust', r['wrong'] is False and r['done'] and r['dust'] == 10 and r['count'] == 1)
    again = await ev("() => { const d = S.dust; S.pantry.tide = 1; S.pet.belly = 40; eat('tide'); return S.dust - d; }")
    check('a granted wish does not pay twice', again == 0)
    # Cuddle: stroking to Joy 90.
    r = rec('cuddle wish', await ev("""() => { S.wish = {day: localDay(), kind: 'cuddle', done: false}; S.pet.asleep = false; S.pet.joy = 80; strokePet(); const early = S.wish.done; for (let i = 0; i < 12 && !S.wish.done; i++) strokePet(); return {early, done: S.wish.done, joy: Math.round(S.pet.joy)}; }"""))
    check('a cuddle wish is granted when Joy reaches 90, not before', r['early'] is False and r['done'] and r['joy'] >= 90)
    # Nap: asleep, rest full, then woken with the Sleep button.
    await ev("() => { S.wish = {day: localDay(), kind: 'nap', done: false}; S.pet.asleep = false; S.pet.rest = 50; closeSheet(); }")
    await page.click('[data-act="sleep"]'); await page.click('[data-act="sleep"]')
    early = await ev("S.wish.done")
    await page.click('[data-act="sleep"]'); await ev("S.pet.rest = 100"); await page.click('[data-act="sleep"]')
    check('a nap wish is granted on waking with Rest full, not on a short doze', early is False and await ev("S.wish.done"))
    # World: finishing a quest in the wished-for world type. The bot plays it through.
    await ev("() => { S.wish = {day: localDay(), kind: 'world', biome: 'emberfall', done: false}; S.quests = Math.max(S.quests, 2); S.pet.rest = 100; S.pet.joy = 90; S.pet.belly = 70; rollPortals(true); }")
    await page.click('[data-act="quest"]'); await page.wait_for_timeout(300)
    sheet = rec('quest sheet', await ev("document.getElementById('sheet').textContent"))
    check('the quest sheet names the wish and marks the portal that grants it', "Today's wish" in sheet and "today's wish" in sheet)
    await page.screenshot(path=SHOTS + '/a1_wish_sheet.png')
    idx = await ev("S.portals.list.findIndex(o => o.biome === 'emberfall')")
    await page.click('[data-do="go"][data-i="%d"]' % idx); await page.wait_for_timeout(900)
    await ev(BOT); await page.wait_for_timeout(1500)   # the way out takes a moment to carry the party home
    r = rec('world wish', await ev("({scene, done: S.wish.done, sheet: document.getElementById('sheet').textContent})"))
    check('finishing a quest in the wished-for world grants the wish and says so', r['scene'] == 'home' and r['done'] and "today's wish" in r['sheet'])
    await page.click('[data-do="ok"]')
    # Every fifth wish earns a present; the bubble shows an ungranted wish and says it when tapped.
    r = rec('fifth wish', await ev("""() => { S.j.wishes = 4; const tools = Object.values(S.tools).reduce((a, b) => a + b, 0); S.wish = {day: localDay(), kind: 'berry', el: 'glow', done: false}; S.pantry.glow = 1; S.pet.belly = 40; eat('glow'); return Object.values(S.tools).reduce((a, b) => a + b, 0) - tools; }"""))
    check('every fifth wish granted earns a tool', r == 1)
    await ev("() => { S.wish = {day: localDay(), kind: 'cuddle', done: false}; S.pet.joy = 60; S.pet.belly = 70; S.pet.rest = 90; home.pa.moodT = 0; }")
    await page.wait_for_timeout(2400)
    pos = await ev("home.wishPos"); await page.screenshot(path=SHOTS + '/a2_wish_bubble.png')
    await page.mouse.click(pos['x'], pos['y']); await page.wait_for_timeout(200)
    check('the thought bubble shows the wish and says it when tapped', pos and 'long cuddle' in await ev("document.getElementById('toast').textContent"))
    await page.click('#btn-journal'); await page.wait_for_timeout(200)
    check('the journal counts wishes granted', 'Wishes · 5 granted' in await ev("document.getElementById('sheet').textContent"))
    await page.click('[data-do="ok"]')
    # A save from before wishes existed loads and gets one.
    r = await ev("() => { delete S.wish; delete S.j.wishes; afterLoad(); return !!S.wish && openJournal() === undefined; }")
    check('a save from before wishes existed loads and gets a wish', r); await ev("closeSheet()")

SECTIONS = [wishes]

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        page = await (await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)).new_page()
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_' not in m.text else None)
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await page.add_init_script(SEED_JS)
        await page.goto(PAGE); await page.wait_for_timeout(800)
        await page.evaluate("() => { window.__fast = true; const r = RNG(5); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r)); S.littles = S.littles.slice(0, 6); S.party = S.littles.slice(0, 3).map(l => l.id); S.quests = 5; S.dust = 100; afterLoad(); }")
        for section in SECTIONS:
            await section(page, page.evaluate)
        rec('page errors', errs); check('no page errors', errs == [])
        await b.close()
    failed = [name for name, ok in CHECKS if not ok]
    print('%d checks' % len(CHECKS)); print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)

asyncio.run(main())
