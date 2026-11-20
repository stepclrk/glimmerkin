# Drives the gesture tricks in a phone-sized headless browser: a hug and a stretch, a boop, a tickle, a light to
# follow, a beat to echo, the new trick shapes, a shake of the phone and two fingers.
import os, pathlib, tempfile, asyncio, math
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()          # run `sh build.sh` first
CHROME = os.environ.get('CHROME_PATH')                   # optional: path to a Chrome/Chromium binary
SHOTS = os.environ.get('SHOTS_DIR', tempfile.gettempdir())
LAUNCH = dict(args=['--no-sandbox'], **({'executable_path': CHROME} if CHROME else {}))
SEED_JS = "(() => { let a = 4321; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()"
RESULTS = {}
def rec(label, value):
    print(label, value); RESULTS[label] = value; return value
def finish(checks):
    failed = [name for name, ok in checks if not ok]
    print('FAILED: ' + ', '.join(failed) if failed else 'ALL CHECKS PASSED')
    raise SystemExit(1 if failed else 0)
from playwright.async_api import async_playwright
TOAST = "document.getElementById('toast').textContent"
SPOTS = "(() => { const H = home, ps = H.petS, ny = H.gy + H.ry * 0.12; return {cx: H.cx, ny, ps, cheek: [H.cx + ps * 0.3, ny - ps * 0.5], face: [H.cx, ny - ps * 0.45], tummy: [H.cx, ny - ps * 0.15], head: [H.cx, ny - ps * 0.85], sky: [VW * 0.22, H.gy - ps * 1.9], gy: H.gy}; })()"
RESET = "closeSheet(); ui.tray.hidden = true; S.pet.asleep = false; S.pet.joy = 50; S.j.touch = {}; home.tg = null; home.pa.trick = null; home.praise = null; home.selfT = 999; S.wish = {day: localDay(), n: 0, k: 'cuddle', a: '', need: 99999, got: 0, done: false, at: 0}"

async def hug(page, ev, P):
    # held still on the Glimmerkin: it closes its eyes and leans in; held for three seconds, a big hug
    await ev(RESET)
    joy = await ev("S.pet.joy")
    x, y = P['cheek']
    await page.mouse.move(x, y); await page.mouse.down()
    await page.wait_for_function("home.ptr && home.ptr.hug", timeout=4000)
    pose = await ev("(() => { const o = touchPose({sx: 1, tilt: 0, squash: 0, mood: null}, 0); return {mood: o.mood, tilt: o.tilt}; })()")
    await page.wait_for_timeout(300); await page.screenshot(path=SHOTS + '/g1_hug.png')
    await page.wait_for_function("home.ptr && home.ptr.hug && home.ptr.hug.big", timeout=8000)
    rec('hug', {'pose': pose, 'joy': await ev("S.pet.joy") - joy, 'n': await ev("S.j.touch.hug"), 'toast': await ev(TOAST)})
    # then pulled: it stretches after the finger, and boings back when let go
    for i in range(1, 7):
        await page.mouse.move(x, y - i * 12); await page.wait_for_timeout(16)
    pulled = await ev("(() => { const o = touchPose({sx: 1, tilt: 0, squash: 0, mood: null}, 0); return {pull: !!home.ptr.pull, sy: o.sy, sx: o.sx}; })()")
    strokes = await ev("home.strokes")
    await page.mouse.move(x, y - 80); await page.wait_for_timeout(16)
    strokes = await ev("home.strokes") - strokes
    await page.screenshot(path=SHOTS + '/g2_stretch.png')
    await page.mouse.up()
    rec('stretch', {'pulled': pulled, 'strokes': strokes, 'boing': await ev("!!home.tg.boing"), 'n': await ev("S.j.touch.stretch"), 'toast': await ev(TOAST)})
    await page.wait_for_function("!home.tg.boing", timeout=4000)

async def boop(page, ev, P):
    await ev(RESET)
    x, y = P['face']
    await page.mouse.click(x, y); await page.wait_for_timeout(120); await page.mouse.click(x, y)
    first = await ev("({sneeze: !!home.tg.sneeze, n: S.j.touch.boop, toast: %s})" % TOAST)
    await page.wait_for_timeout(200); await page.screenshot(path=SHOTS + '/g3_boop.png')
    for _ in range(2):
        await page.wait_for_timeout(500); await page.mouse.click(x, y); await page.wait_for_timeout(120); await page.mouse.click(x, y)
    back = await ev("({back: !!home.tg.boopBack, n: S.j.touch.boop, toast: %s})" % TOAST)
    # two taps a long way apart are only taps
    await page.wait_for_timeout(1200); await page.mouse.click(x, y); await page.wait_for_timeout(700); await page.mouse.click(x, y)
    rec('boop', {'first': first, 'back': back, 'slow': await ev("S.j.touch.boop")})

async def scribble(page, x, y, amp, n, gap):
    await page.mouse.move(x, y); await page.mouse.down()
    for i in range(n):
        await page.mouse.move(x + (amp if i % 2 == 0 else -amp), y, steps=2); await page.wait_for_timeout(gap)
    await page.mouse.up()

async def tickle(page, ev, P):
    await ev(RESET)
    x, y = P['tummy']
    # long, slow strokes are strokes
    await scribble(page, x, y, P['ps'] * 0.4, 6, 60)
    slow = await ev("S.j.touch.tickle || 0")
    # quick little scribbles are a tickle: it rolls over giggling, then peeks for more
    await page.mouse.move(x, y); await page.mouse.down()
    for i in range(12):
        await page.mouse.move(x + (12 if i % 2 == 0 else -12), y); await page.wait_for_timeout(16)
    on = await ev("({tickle: home.tg.tickle > 0, tilt: touchPose({sx: 1, tilt: 0, squash: 0, mood: null}, 0).tilt, toast: %s})" % TOAST)
    await page.screenshot(path=SHOTS + '/g4_tickle.png')
    await page.mouse.up()
    await page.wait_for_function("home.tg.peek > 0", timeout=4000)
    rec('tickle', {'slow': slow, 'on': on, 'n': await ev("S.j.touch.tickle")})

async def light(page, ev, P):
    await ev(RESET)
    x, y = P['sky']
    hit = await ev("homeHit({x: %f, y: %f})" % (x, y))
    await page.mouse.move(x, y); await page.mouse.down()
    await page.wait_for_function("home.tg && home.tg.light", timeout=4000)
    for i in range(1, 9):
        await page.mouse.move(x - i * 4, y + i * 10); await page.wait_for_timeout(16)
    await page.wait_for_function("home.tg.dx < -40", timeout=5000)
    moved = await ev("home.tg.dx")
    await page.screenshot(path=SHOTS + '/g5_light.png')
    # lifted high over its head, it leaps for the light
    px = await ev("home.cx + home.tg.dx")
    await page.mouse.move(px, P['gy'] - P['ps'] * 1.7, steps=4)
    await page.wait_for_function("home.tg.light && home.tg.light.leapT > 0", timeout=5000)
    await page.mouse.up()
    gone = await ev("!home.tg.light")
    await page.wait_for_function("Math.abs(home.tg.dx) < 1", timeout=5000)
    rec('light', {'hit': hit, 'moved': moved, 'gone': gone, 'trick': await ev("home.pa.trick && home.pa.trick.k"), 'n': await ev("S.j.touch.light")})

async def beat(page, ev, P):
    await ev(RESET)
    x, y = P['sky']
    for i, w in enumerate([150, 150, 300, 0]):
        await page.mouse.click(x + i * 20, y); 
        if w: await page.wait_for_timeout(w)
    await page.wait_for_function("home.tg.echo", timeout=4000)
    gaps = await ev("home.tg.echo.gaps")
    await page.wait_for_timeout(400); await page.screenshot(path=SHOTS + '/g6_beat.png')
    await page.wait_for_function("!home.tg.echo", timeout=6000)
    # two taps are not a beat
    await page.mouse.click(x, y); await page.wait_for_timeout(150); await page.mouse.click(x, y); await page.wait_for_timeout(1300)
    rec('beat', {'gaps': gaps, 'n': await ev("S.j.touch.beat"), 'toast': await ev(TOAST)})

def heart(cx, cy, s):
    return [(cx + 16 * math.sin(t) ** 3 * s, cy - (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) * s) for t in [i / 40 * 2 * math.pi for i in range(41)]]
def star(cx, cy, r):
    v = [(cx + math.cos(-math.pi / 2 + i * 4 * math.pi / 5) * r, cy + math.sin(-math.pi / 2 + i * 4 * math.pi / 5) * r) for i in range(6)]
    out = []
    for a, b in zip(v, v[1:]):
        out += [(a[0] + (b[0] - a[0]) * k / 8, a[1] + (b[1] - a[1]) * k / 8) for k in range(8)]
    return out + [v[-1]]
def spiral(cx, cy):
    return [(cx + math.cos(i / 50 * 2 * math.pi * 2.3) * (8 + i * 0.9), cy + math.sin(i / 50 * 2 * math.pi * 2.3) * (8 + i * 0.9)) for i in range(51)]
def circle(cx, cy, r):
    return [(cx + math.cos(i / 24 * 6.4) * r, cy + math.sin(i / 24 * 6.4) * r) for i in range(25)]

async def draw(page, pts):
    await page.mouse.move(*pts[0]); await page.mouse.down()
    for q in pts[1:]: await page.mouse.move(*q)
    await page.mouse.up()

async def shapes(page, ev, P):
    await ev(RESET + "; S.pet.tricks = {}")
    x, y = P['cx'] + 40, P['gy'] - P['ps'] * 1.9
    as_js = lambda pts: '[' + ','.join('{x:%f,y:%f}' % p for p in pts) + ']'
    zig = [(x - 60 + (i % 2) * 120, y + i * 6) for i in range(6)]
    up = [(x, y + 80 - i * 16) for i in range(11)]
    across = [(x - 80 + i * 16, y + i) for i in range(11)]
    named = {}
    for name, pts in [('circle', circle(x, y, 45)), ('heart', heart(x, y, 3)), ('small heart', heart(x, y, 2.2)), ('star', star(x, y, 60)), ('spiral', spiral(x, y)), ('zigzag', zig), ('up', up), ('across', across), ('back across', list(reversed(across)))]:
        named[name] = await ev("shapeOf(%s)" % as_js(pts))
    rec('shape names', named)
    # drawn on the sky: a heart asks for a kiss, and a stroke praises it
    await draw(page, heart(x, y, 3)); await page.wait_for_timeout(100)
    tried = await ev("({k: home.pa.trick && home.pa.trick.k, toast: %s})" % TOAST)
    await page.wait_for_timeout(250); await page.screenshot(path=SHOTS + '/g7_kiss.png')
    await scribble(page, P['head'][0], P['head'][1], 20, 4, 30)
    praised = await ev("S.pet.tricks.kiss")
    # one short of knowing how to roll over: the fifth praised try teaches it, and then it rolls right over
    await page.wait_for_function("!home.pa.trick", timeout=4000)
    await ev("S.pet.tricks.roll = learnAt('roll') - 1")
    await draw(page, [(px, py) for px, py in [(x - 80 + i * 16, y + i) for i in range(11)]]); await page.wait_for_timeout(100)
    await scribble(page, P['head'][0], P['head'][1], 20, 4, 30)
    learned = await ev("({knows: knows('roll'), toast: %s})" % TOAST)
    await page.wait_for_function("!home.pa.trick", timeout=4000)
    await draw(page, across); await page.wait_for_timeout(300)
    good = await ev("({k: home.pa.trick && home.pa.trick.k, good: home.pa.trick && home.pa.trick.good, tilt: Math.abs(petPose(0).tilt)})")
    await page.screenshot(path=SHOTS + '/g8_roll.png')
    await page.wait_for_function("!home.pa.trick", timeout=4000)
    rec('shapes drawn', {'tried': tried, 'praised': praised, 'learned': learned, 'good': good, 'journal': await ev("(() => { openJournal(); const t = ui.sheet.textContent; closeSheet(); return t.includes('roll over'); })()")})

async def shake(page, ev, P):
    await ev(RESET)
    jolt = "window.dispatchEvent(new DeviceMotionEvent('devicemotion', {acceleration: {x: %f, y: 3, z: 1}, accelerationIncludingGravity: {x: %f, y: 9.8, z: 1}, interval: 16}))"
    for _ in range(5): await ev(jolt % (4, 4))   # a gentle sway is nothing
    gentle = await ev("!!home.tg.globe")
    for v in (24, -24, 24): await ev(jolt % (v, v))
    on = await ev("({globe: !!home.tg.globe, n: S.j.touch.shake, toast: %s})" % TOAST)
    await page.wait_for_timeout(500); await page.screenshot(path=SHOTS + '/g9_shake.png')
    await page.wait_for_function("!home.tg.globe", timeout=6000)
    # asleep, it sleeps on
    await ev("S.pet.asleep = true")
    await page.wait_for_timeout(1700)
    for v in (24, -24, 24): await ev(jolt % (v, v))
    asleep = await ev("!!home.tg.globe")
    await ev("S.pet.asleep = false")
    rec('shake', {'gentle': gentle, 'on': on, 'asleep': asleep})

async def fingers(page, ev, P):
    await ev(RESET)
    cx, y = P['cx'], P['ny'] - P['ps'] * 0.5
    pe = "(() => { const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent('%s', {pointerId: %d, clientX: r.left + %f, clientY: r.top + %f, bubbles: true, isPrimary: %s, pointerType: 'touch'})); })()"
    async def two(frm, to):
        await ev(pe % ('pointerdown', 11, cx - frm, y, 'true')); await ev(pe % ('pointerdown', 12, cx + frm, y, 'false'))
        for k in range(1, 7):
            d = frm + (to - frm) * k / 6
            await ev(pe % ('pointermove', 11, cx - d, y, 'true')); await ev(pe % ('pointermove', 12, cx + d, y, 'false')); await page.wait_for_timeout(16)
        s = await ev("home.tg.pinch && home.tg.pinch.s")
        sx = await ev("touchPose({sx: 1, tilt: 0, squash: 0, mood: null}, 0).sx")
        return s, sx
    s, sx = await two(30, 95)
    await page.screenshot(path=SHOTS + '/g10_puff.png')
    await ev(pe % ('pointerup', 12, cx + 95, y, 'false')); await ev(pe % ('pointerup', 11, cx - 95, y, 'true'))
    puff = {'s': s, 'sx': sx, 'n': await ev("S.j.touch.puff"), 'stroked': await ev("!!home.ptr"), 'toast': await ev(TOAST)}
    await page.wait_for_function("!home.tg.boing", timeout=4000)
    s, sx = await two(95, 30)
    await page.screenshot(path=SHOTS + '/g11_curl.png')
    await ev(pe % ('pointerup', 11, cx - 30, y, 'true')); await ev(pe % ('pointerup', 12, cx + 30, y, 'false'))
    curl = {'s': s, 'sx': sx, 'n': await ev("S.j.touch.curl")}
    # one finger still works after
    await page.wait_for_function("!home.tg.boing", timeout=4000)
    await page.mouse.click(*P['face']); await page.wait_for_timeout(100)
    rec('fingers', {'puff': puff, 'curl': curl, 'after': await ev("home.pa.hopY > 0 || home.pa.hopV !== 0")})

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
        await ev("""() => { window.__fast = true; const r = RNG(5); for (const k of Object.keys(KINDS)) if (!S.littles.some(l => l.kind === k)) S.littles.push(newLittle(k, r)); S.littles = S.littles.slice(0, 6); S.party = S.littles.slice(0, 3).map(l => l.id); S.quests = 6; S.seen = UNLOCKS.map(u => u.id); S.news = NEWS_V; S.dust = 200; S.pet.rest = 100; S.pet.belly = 50; S.pet.joy = 50; S.trader = null; afterLoad(); closeSheet(); }""")
        await page.wait_for_timeout(1500)
        P = await ev(SPOTS)
        await hug(page, ev, P)
        await boop(page, ev, P)
        await tickle(page, ev, P)
        await light(page, ev, P)
        await beat(page, ev, P)
        await shapes(page, ev, P)
        await shake(page, ev, P)
        await fingers(page, ev, P)
        rec('journal', await ev("(() => { S.j.touch = {hug: 2, boop: 1}; openJournal(); const t = ui.sheet.textContent; closeSheet(); return t.includes('Fingertip play: 2 big hugs, 1 boop.'); })()"))
        rec('news', await ev("NEWS.some(n => n.title === 'Fingertip play' && /hug/i.test(n.text))"))
        rec('old save', await ev("(() => { const s = JSON.parse(JSON.stringify(S)); delete s.motion; delete s.j.touch; S = s; afterLoad(); return {motion: S.motion, journal: touchJournal()}; })()"))
        await b.close()
    rec('errors', [e for e in errs if 'Failed to load resource' not in e])
asyncio.run(main())
R = RESULTS
near = lambda a, b: abs(a - b) < 0.09
finish([('no page errors', not R['errors']),
        ('held still on it, it closes its eyes and leans in', R['hug']['pose']['mood'] == 'sleep' and R['hug']['pose']['tilt'] > 0),
        ('a three-second hold is a big hug: Joy rises and it is counted once', R['hug']['joy'] > 0 and R['hug']['n'] == 1 and 'big hug' in R['hug']['toast']),
        ('held and pulled, it stretches after the finger instead of being stroked', R['stretch']['pulled']['pull'] and R['stretch']['pulled']['sy'] > 1.2 and R['stretch']['pulled']['sx'] < 1 and R['stretch']['strokes'] == 0),
        ('let go, it boings back', R['stretch']['boing'] and R['stretch']['n'] == 1 and 'boings back' in R['stretch']['toast']),
        ('two quick taps on its face are a boop and a sneeze', R['boop']['first']['sneeze'] and R['boop']['first']['n'] == 1 and 'Boop' in R['boop']['first']['toast']),
        ('the third boop in a row boops you back', R['boop']['back']['back'] and R['boop']['back']['n'] == 3 and 'boops you back' in R['boop']['back']['toast']),
        ('two slow taps are not a boop', R['boop']['slow'] == 3),
        ('long strokes on the tummy are not a tickle', R['tickle']['slow'] == 0),
        ('quick scribbles on the tummy are a tickle: it rolls over, then peeks for more', R['tickle']['on']['tickle'] and R['tickle']['on']['tilt'] > 0.3 and R['tickle']['n'] == 1 and 'ticklish' in R['tickle']['on']['toast']),
        ('held on the sky, a light: it hops along the nest after it and leaps for it', R['light']['hit'] is None and R['light']['moved'] < -40 and R['light']['gone'] and R['light']['n'] == 1),
        ('following the light asks for no trick', R['light']['trick'] is None),
        ('four taps on the sky are echoed back in the same rhythm', len(R['beat']['gaps']) == 3 and near(R['beat']['gaps'][0], 0.15) and near(R['beat']['gaps'][2], 0.3) and R['beat']['n'] == 1 and 'beat back' in R['beat']['toast']),
        ('a heart, a star, a spiral and a swipe across are new shapes, and the old ones still read the same', R['shape names'] == {'circle': 'spin', 'heart': 'kiss', 'small heart': 'kiss', 'star': 'pose', 'spiral': 'chase', 'zigzag': 'wiggle', 'up': 'leap', 'across': 'roll', 'back across': 'roll'}),
        ('a heart drawn on the sky asks for a kiss, and a stroke praises it', R['shapes drawn']['tried']['k'] == 'kiss' and 'blow a kiss' in R['shapes drawn']['tried']['toast'] and R['shapes drawn']['praised'] == 1),
        ('a new trick is learned like the others, done neatly, and listed in the journal', R['shapes drawn']['learned']['knows'] and 'roll over' in R['shapes drawn']['learned']['toast'] and R['shapes drawn']['good']['k'] == 'roll' and R['shapes drawn']['good']['good'] and R['shapes drawn']['journal']),
        ('a shake swirls the nest like a snow globe; a gentle sway does not', not R['shake']['gentle'] and R['shake']['on']['globe'] and R['shake']['on']['n'] == 1 and 'snow globe' in R['shake']['on']['toast']),
        ('a sleeping Glimmerkin sleeps through a shake', not R['shake']['asleep']),
        ('two fingers spread puff it up, and it lets it out with a Pfft', R['fingers']['puff']['s'] > 1.3 and R['fingers']['puff']['sx'] > 1.2 and R['fingers']['puff']['n'] == 1 and 'Pfft' in R['fingers']['puff']['toast'] and not R['fingers']['puff']['stroked']),
        ('two fingers pinched curl it into a ball', R['fingers']['curl']['s'] < 0.8 and R['fingers']['curl']['sx'] < 0.9 and R['fingers']['curl']['n'] == 1),
        ('one finger works as before after two', R['fingers']['after']),
        ('the journal counts fingertip play', R['journal']),
        ('What\'s new tells of it', R['news']),
        ('an older save loads with motion off and nothing counted', R['old save'] == {'motion': False, 'journal': ''}),
        ])
