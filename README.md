# Glimmerkin

A creature-care and quest game. Look after a Glimmerkin (stroke it, feed it, let it sleep), then take it
and its follower creatures, the littles, through portals into worlds that are generated fresh every time.

The game is a single self-contained web page with no runtime dependencies. A small server and a Postgres
database in a Docker stack serve it on port 7777. Anyone can play as a guest, with their creature kept in
their own browser. Accounts are by invitation.

## Install

On a server with Docker and the Compose plugin:

```sh
git clone https://github.com/stepclrk/glimmerkin.git /opt/stacks/glimmerkin
cd /opt/stacks/glimmerkin
sh setup.sh
docker compose up -d --build
```

`setup.sh` creates `.env` and fills in the secrets it needs, such as the database password. It never changes
a value that is already set, so it is safe to run again. The folder is your choice; `/opt/stacks/glimmerkin` is only a suggestion. The game is then at
`http://<server>:7777/play`. Check it with:

```sh
curl http://localhost:7777/healthz      # answers {"ok":true}
docker compose ps                       # the web service shows as healthy
```

**Port 7777 is fixed.** The compose file publishes it and the Cloudflare Tunnel points at it.

### Create the owner

Once, after the first start:

```sh
docker compose exec web node dist/cli.js owner <username>
```

It prints a one-time password. Sign in at `/signin` with it and you are asked to choose your own straight
away. Run the same command again if the owner is ever locked out.

After that, everything is done from the owner page at `/owner`: create invite codes, reset a player's
password, remove an account.

Signing in works only through the HTTPS address (`https://glimmerkin.flokr.io`), not on
`http://<server>:7777`, because the sign-in cookie is marked `Secure`. Guest play works on both.

### Cloudflare Tunnel

Add a public hostname to the tunnel: `glimmerkin.flokr.io`, service type HTTP, URL as below.

| Where `cloudflared` runs | Service URL | `BIND_ADDRESS` in `.env` |
| --- | --- | --- |
| Directly on the same server | `localhost:7777` | `127.0.0.1`, which keeps the port off the rest of the network |
| In a Docker container on the same server | `<server's LAN address>:7777` | `0.0.0.0` (the default) |
| On another machine | `<server's LAN address>:7777` | `0.0.0.0` (the default) |

After changing `.env`, run `docker compose up -d` again.

### Update

```sh
cd /opt/stacks/glimmerkin
git pull
sh setup.sh
docker compose up -d --build
```

The database updates itself when the server starts.

### Stop or remove

```sh
docker compose stop         # stop, keep everything
docker compose down         # remove the containers, keep the database
docker compose down -v      # remove the containers AND every account and save. There is no undo
```

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
| `server/src/` | The server: Node 22, TypeScript, Fastify. Serves the game at `/play`, the pages and the API |
| `server/pages/` | The pages around the game (landing, privacy, sign in, join, account, owner), in the Flokr Design System |
| `Dockerfile`, `compose.yaml`, `.env.example`, `setup.sh` | The Docker stack |
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

The server has its own checks, and one browser test runs against the running stack:

```sh
cd server && npm ci && npm run lint && npm test     # type-check, then the server's tests
python3 test/hosted.py      # against http://127.0.0.1:7777, or set BASE_URL
```

The account tests need an empty Postgres that they may wipe, named in `DATABASE_URL`; without it they are
skipped. A throwaway one:

```sh
docker run --rm -d -p 5433:5432 -e POSTGRES_PASSWORD=test postgres:16-alpine
export DATABASE_URL=postgres://postgres:test@127.0.0.1:5433/postgres
```

Set `CHROME_PATH` to use an existing Chrome binary and `SHOTS_DIR` to choose where screenshots go.
Each test prints `ALL CHECKS PASSED` or names what failed. CI runs all of them on every pull request.

The canonical spec is `GLIMMERKIN_MASTER_SPEC.md`. Working rules are in `CLAUDE.md`.

## How the game is put together

- **One page, no libraries in the game.** Everything is drawn on a canvas at run time; there are no image or sound files.
  The only outside resource is two Google Fonts.
- **Worlds are generated, then proven finishable.** `genWorld` builds a maze, places the blockers that sit on
  the route to the exit, and budgets them against the sparks the party carries. `planSolve` replays the
  intended route before a world is accepted.
- **One save document per player.** The whole game state is a single JSON object (`S` in `src/game.js`).
  Loading and storing it happens in one place (`loadLocal`, `save`, `initCloud`, `pushCloud`), which is the
  seam the self-hosted backend will replace.
