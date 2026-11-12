# Drives the game's rhythm in a phone-sized headless browser: the gentle start that opens the game up one
# thing at a time, and the news a returning player is shown.
import os, pathlib, tempfile, re, asyncio, json
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
# Finish one quest in a world type, then close the results and wait for whatever opens after them.
QUEST = "async () => { __FAST__ closeSheet(); S.pet.rest = 100; S.pet.joy = 90; startQuest({seed: __SEED__, biome: '__BIOME__', size: 'nook', name: 'Test'}); const rule = Q.world.rule, pair = Q.world.cells.some(c => c.t === 'ob' && PAIRS[c.ob]); const r = await bot(); window.anim = _a; const results = document.querySelector('#sheet h2').textContent; closeSheet(); await new Promise(res => setTimeout(res, 400)); return {rule, pair, scene: r.scene, quests: S.quests, results, after: ui.sheet.hidden ? '' : [...document.querySelectorAll('#sheet strong')].map(e => e.textContent).join(', ')}; }".replace('__FAST__', FAST)

async def new_page(b, errs, init=None):
    ctx = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)
    page = await ctx.new_page()
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    await page.add_init_script(SEED_JS)
    if init: await page.add_init_script(init)
    await page.goto(PAGE); await page.wait_for_timeout(1300)
    return page

async def gentle_start(b, errs):
    page = await new_page(b, errs); ev = page.evaluate
    await ev("window.__fast = true")
    rec('fresh', await ev("({quests: S.quests, seen: S.seen, news: S.news === NEWS_V, sheet: !ui.sheet.hidden, wish: !!wishLive(), lwish: !!littleWishLive(), treats: unlocked('treats')})"))
    await ev("openQuestSheet()"); await page.wait_for_timeout(200)
    rec('fresh portals', await ev("({journey: !!document.querySelector('#sheet [data-do=journey]'), together: document.querySelector('#sheet').textContent.includes('work together') || document.querySelector('#sheet').textContent.includes('Together they'), portals: S.portals.list.map(o => o.biome)})"))
    await page.screenshot(path=SHOTS + '/r1_fresh_portals.png')
    seq = []
    for i, biome in enumerate(['tidehollow', 'gloamglass', 'mossroot', 'emberfall', 'stonesong']):
        res = await ev(QUEST.replace('__SEED__', str(5100 + i)).replace('__BIOME__', biome))
        seq.append(res)
        if i == 0: await page.screenshot(path=SHOTS + '/r2_something_new.png')
        if i == 2: await page.screenshot(path=SHOTS + '/r3_journey_unlocked.png')
    rec('quests', seq)
    rec('after five', await ev("({seen: S.seen, wish: unlocked('wishes') && !!S.wish, treats: unlocked('treats'), journeyCard: (openQuestSheet(), !!document.querySelector('#sheet [data-do=journey]')), reg: S.reg.n})"))
    await ev("closeSheet()")
    await page.context.close()

OLD = "localStorage.setItem('glimmerkin.v1', JSON.stringify(%s))"
async def returning(b, errs):
    # a save from before the gentle start, well into the game: it is shown what is new, once
    page = await new_page(b, errs); ev = page.evaluate
    old = await ev("(() => { const s = JSON.parse(JSON.stringify(S)); delete s.seen; delete s.news; s.quests = 7; s.savedAt = Date.now(); return s; })()")
    await page.context.close()
    page = await new_page(b, errs, "if (!sessionStorage.getItem('once')) { sessionStorage.setItem('once', 1); " + (OLD % json.dumps(old)) + " }")
    ev = page.evaluate
    await page.wait_for_function("!ui.sheet.hidden", timeout=5000); await page.wait_for_timeout(300)
    await page.screenshot(path=SHOTS + '/r4_whats_new.png')
    rec('returning', await ev("({title: document.querySelector('#sheet h2') && document.querySelector('#sheet h2').textContent, items: [...document.querySelectorAll('#sheet strong')].map(e => e.textContent), seen: S.seen, news: S.news === NEWS_V})"))
    await ev("closeSheet()"); await page.wait_for_timeout(300); await page.reload(); await page.wait_for_timeout(1600)
    rec('returning again', await ev("({sheet: !ui.sheet.hidden, title: ui.sheet.hidden ? '' : ui.sheet.querySelector('h2') && ui.sheet.querySelector('h2').textContent, quests: S.quests, news: S.news})"))
    await ev("closeSheet()"); await page.click('#btn-help'); await page.click('#sheet [data-do="news"]'); await page.wait_for_timeout(200)
    rec('help news', await ev("document.querySelector('#sheet h2').textContent"))
    await page.context.close()
    # a save from before the gentle start that never finished a quest has nothing to catch up on
    old2 = dict(old); old2['quests'] = 0
    page = await new_page(b, errs, "if (!sessionStorage.getItem('once')) { sessionStorage.setItem('once', 1); " + (OLD % json.dumps(old2)) + " }")
    rec('returning beginner', await page.evaluate("({sheet: !ui.sheet.hidden, seen: S.seen, news: S.news === NEWS_V})"))
    await page.context.close()

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        await gentle_start(b, errs)
        await returning(b, errs)
        await b.close()
    rec('errors', [e for e in errs if 'Failed to load resource' not in e])
asyncio.run(main())
R = RESULTS
Q = R['quests']
finish([('no page errors', not R['errors']),
        ('a new player starts with care and plain quests only', R['fresh']['quests'] == 0 and R['fresh']['seen'] == [] and R['fresh']['news'] and not R['fresh']['sheet'] and not R['fresh']['wish'] and not R['fresh']['lwish'] and not R['fresh']['treats']),
        ('Where to? holds back the journey and littles together', not R['fresh portals']['journey'] and not R['fresh portals']['together']),
        ('every quest of the first five is finished', all(q['scene'] == 'home' for q in Q) and Q[-1]['quests'] == 5),
        ('the first two quests have no world rule', Q[0]['rule'] is None and Q[1]['rule'] is None),
        ('world rules start on the third quest', Q[2]['rule'] == 'mossroot' and Q[3]['rule'] == 'emberfall'),
        ('no pair blocker before the fifth quest', not any(q['pair'] for q in Q[:4])),
        ('each unlock is shown once, after the quest that opens it', [q['after'] for q in Q] == ['Wishes', 'World rules', 'The journey', 'Littles together', 'Treats and little wishes']),
        ('after five quests everything is open', R['after five']['seen'] == ['wishes', 'rules', 'journey', 'together', 'treats'] and R['after five']['wish'] and R['after five']['treats'] and R['after five']['journeyCard']),
        ('the journey counts only once it is open', R['after five']['reg'] == 1),
        ('a returning player is shown what is new', R['returning']['title'] == "What's new" and len(R['returning']['items']) == 6 and R['returning']['news']),
        ('what a returning player has reached counts as shown', R['returning']['seen'] == ['wishes', 'rules', 'journey', 'together', 'treats']),
        ('the news is shown only once', not R['returning again']['sheet'] and R['returning again']['quests'] == 7),
        ('the help sheet opens the news again', R['help news'] == "What's new"),
        ('a returning beginner is not shown news', not R['returning beginner']['sheet'] and R['returning beginner']['seen'] == [] and R['returning beginner']['news']),
       ])
