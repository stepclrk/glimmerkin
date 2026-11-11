# Exercises account saving against a stand-in for the viewer's db/user capabilities.
import os, pathlib, tempfile
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))

# A fixed random sequence makes the starting creature and littles the same on every run.
SEED_JS = "(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
OUTS = []
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
import asyncio, json
from playwright.async_api import async_playwright
MOCK = """
window.__store = %s; window.__sets = 0;
window.claude = { use: async n => n === 'user' ? { id: async () => 'u_test' } : n === 'db' ? { doc: path => ({ path,
  get: async () => { await new Promise(r => setTimeout(r, 150)); const v = window.__store[path]; return { exists: !!v, data: () => v }; },
  set: async v => { window.__sets++; window.__store[path] = JSON.parse(JSON.stringify(v)); } }) } : null };
"""
async def run(b, store, local=None, act=False):
    ctx = await b.new_context(viewport={'width': 390, 'height': 760}); page = await ctx.new_page()
    errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
    await page.add_init_script(MOCK % json.dumps(store))
    if local: await page.add_init_script("try { if (!localStorage.getItem('glimmerkin.v1')) localStorage.setItem('glimmerkin.v1', %s); } catch (e) {}" % json.dumps(json.dumps(local)))
    await page.add_init_script(SEED_JS)
    await page.goto(PAGE); await page.wait_for_timeout(900)
    if act:
        await page.click('[data-act="feed"]'); await page.click('.food:not([disabled])'); await page.wait_for_timeout(5600)
    out = await page.evaluate("({name: S.pet.name, quests: S.quests, savedAt: S.savedAt, sets: window.__sets, path: Object.keys(window.__store)[0] || null, remote: (() => { const v = Object.values(window.__store)[0]; return v ? JSON.parse(v.json) : null; })(), note: saveNote()})")
    await ctx.close(); return out, errs
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        # 1. brand-new player, empty account: first save is pushed
        o, e = await run(b, {}); OUTS.append(json.loads(json.dumps(o))); print('1 new player   ', 'sets', o['sets'], 'path', o['path'], 'remote pet', o['remote'] and o['remote']['pet']['name'], '==', o['name'], e)
        saved = o['remote']
        # 2. new browser, account has a save: account copy is adopted
        saved['pet']['name'] = 'Cloudy'; saved['quests'] = 7; saved['savedAt'] = 5000
        o, e = await run(b, {'data/users/u_test/save': {'json': json.dumps(saved), 'savedAt': 5000}}); OUTS.append(json.loads(json.dumps(o))); print('2 new device   ', 'name', o['name'], 'quests', o['quests'], 'sets', o['sets'], '|', o['note'], e)
        # 3. this browser is behind the account: account copy wins
        old = json.loads(json.dumps(saved)); old['pet']['name'] = 'Stale'; old['savedAt'] = 1000; old['quests'] = 2
        o, e = await run(b, {'data/users/u_test/save': {'json': json.dumps(saved), 'savedAt': 5000}}, local=old); OUTS.append(json.loads(json.dumps(o))); print('3 stale browser', 'name', o['name'], 'quests', o['quests'], 'sets', o['sets'], e)
        # 4. this browser is ahead of the account: local is pushed up
        new = json.loads(json.dumps(saved)); new['pet']['name'] = 'Ahead'; new['savedAt'] = 9000; new['quests'] = 9
        o, e = await run(b, {'data/users/u_test/save': {'json': json.dumps(saved), 'savedAt': 5000}}, local=new); OUTS.append(json.loads(json.dumps(o))); print('4 browser ahead ', 'name', o['name'], 'remote', o['remote']['pet']['name'], o['remote']['quests'], 'sets', o['sets'], e)
        # 5. in sync, then feed once: exactly one more write, carrying the change
        o, e = await run(b, {'data/users/u_test/save': {'json': json.dumps(new), 'savedAt': 9000}}, local=new, act=True); OUTS.append(json.loads(json.dumps(o))); print('5 play then save', 'sets', o['sets'], 'remote newer', o['remote']['savedAt'] > 9000, 'belly', round(o['remote']['pet']['belly']), '|', o['note'], e)
        await b.close()
asyncio.run(main())
o1, o2, o3, o4, o5 = OUTS
finish([('a new player is saved to the account', o1['sets'] == 1 and o1['remote']['pet']['name'] == o1['name']), ('a new device adopts the account save', o2['name'] == 'Cloudy' and o2['sets'] == 0),
        ('a browser that is behind adopts the account save', o3['name'] == 'Cloudy' and o3['quests'] == 7), ('a browser that is ahead pushes its save', o4['remote']['pet']['name'] == 'Ahead' and o4['sets'] == 1),
        ('playing writes exactly one more save', o5['sets'] == 1 and o5['remote']['savedAt'] > 9000)])
