# Glimmerkin

A creature-care and quest game. Look after a Glimmerkin (stroke it, feed it, let it sleep), then take it
and its follower creatures, the littles, through portals into worlds that are generated fresh every time.

This repository holds the game as it was first built: a single self-contained web page with no runtime
dependencies. It currently runs as a Claude artifact and saves through the artifact platform. The next phase
moves it to self-hosting with its own accounts and database.

## Layout

| Path | What it is |
| --- | --- |
| `src/head.html` | Page shell, styles and HUD markup |
| `src/core.js` | Random numbers, data tables, world generator, pathfinding. No DOM; runs in Node |
| `src/draw.js` | Procedural drawing: creatures, tiles, items, enemies |
| `src/game.js` | Shared state, saving, sound, particles, icons, sheets |
| `src/things.js` | Tools, charms, toys, decorations, rare finds, the trader, the journal |
| `src/home.js` | The nest: care, feeding, decorations, music |
| `src/quest.js` | Quests: walking, sending littles, tools, bosses, results |
| `src/boot.js` | Sizing, input, frame loop, start-up |
| `build.sh` | Concatenates the parts into `dist/index.html` |
| `test/` | Generator solvability test (Node) and browser playthroughs (Python + Playwright) |

## Build and test

```sh
sh build.sh                 # writes dist/index.html
node test/syntax.js         # the built script parses
node test/gen.test.js       # 6,000 generated worlds must all be finishable
```

Browser tests need Python 3 with Playwright and a Chromium browser:

```sh
pip install playwright && playwright install chromium
python3 test/smoke.py       # plays full quests in every world type
python3 test/features.py    # exercises tools, charms, toys, trader, journal, boss worlds
python3 test/cloud.py       # account-save behaviour against a stand-in database
```

Set `CHROME_PATH` to use an existing Chrome binary and `SHOTS_DIR` to choose where screenshots go.
Each test prints `ALL CHECKS PASSED` or names what failed. CI runs all of them on every pull request.

The canonical spec is `GLIMMERKIN_MASTER_SPEC.md`. Working rules are in `CLAUDE.md`.

## How the game is put together

- **One page, no libraries.** Everything is drawn on a canvas at run time; there are no image or sound files.
  The only outside resource is two Google Fonts.
- **Worlds are generated, then proven finishable.** `genWorld` builds a maze, places the blockers that sit on
  the route to the exit, and budgets them against the sparks the party carries. `planSolve` replays the
  intended route before a world is accepted.
- **One save document per player.** The whole game state is a single JSON object (`S` in `src/game.js`).
  Loading and storing it happens in one place (`loadLocal`, `save`, `initCloud`, `pushCloud`), which is the
  seam the self-hosted backend will replace.
