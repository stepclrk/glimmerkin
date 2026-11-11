# Glimmerkin

A creature-care and quest game. Look after a Glimmerkin (stroke it, feed it, let it sleep), then take it
and its follower creatures, the littles, through portals into worlds that are generated fresh every time.

The game is a single self-contained web page with no runtime dependencies. A small server, a Postgres
database and a nightly backup job in a Docker stack serve it on port 7777. Anyone can play as a guest, with their creature kept in
their own browser. Accounts are by invitation.

## Install

On a server with Docker and the Compose plugin:

```sh
git clone https://github.com/stepclrk/glimmerkin.git /opt/stacks/glimmerkin
cd /opt/stacks/glimmerkin
sh setup.sh
docker compose up -d --build
```

`setup.sh` creates `.env` and fills in the secrets it needs: the database password and the backup passphrase. It never changes
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

### Going live with accounts

For a server already running the game from before accounts existed:

1. Update: `git pull`, `sh setup.sh`, `docker compose up -d --build`. Nobody's guest creature is touched;
   those live in their own browsers.
2. Copy the `BACKUP_PASSPHRASE` line from `.env` to somewhere that is not this server.
3. Create the owner: `docker compose exec web node dist/cli.js owner <username>`.
4. Sign in at `https://glimmerkin.flokr.io/signin` with the one-time password and choose your own.
5. On the owner page, create an invite code for each player and pass it on. A child's code goes to a parent.
6. To keep a creature you already have: join or sign in from the browser that holds it and it comes with you.
   A creature in another copy of the game, such as the Claude-hosted one, comes across with "Keep a copy" in
   its "?" sheet, pasted into "Bring in a creature saved somewhere else" on the account page.
7. Decide where backups go off this server (see below).

### Backups

A third container makes one backup a night, at 03:00 UTC, and keeps 14 days of them. Each is a dump of the
database, encrypted as it is written with the `BACKUP_PASSPHRASE` from `.env`. The owner page shows when the
last one ran.

- **Keep a copy of `BACKUP_PASSPHRASE` somewhere that is not this server.** A backup cannot be read without it.
- **Backups land in `./backups`, which is on this server.** To survive losing the server, set `BACKUP_DIR`
  in `.env` to storage that is somewhere else, such as a mounted NAS share, or copy the folder elsewhere on a
  schedule. Then `docker compose up -d`.

```sh
docker compose exec backup backup.sh now      # make a backup straight away
ls backups/                                   # glimmerkin-<date>-<time>.sql.gz.enc
```

To restore, which replaces every account and save now in the database:

```sh
docker compose stop web
docker compose run --rm backup restore glimmerkin-20261112-030000.sql.gz.enc
docker compose start web
```

On a new server: install as above, copy the old `BACKUP_PASSPHRASE` line into `.env` and the backup file into
`backups/`, start the stack, then run the three restore commands. Automated checks do exactly this on every
pull request: back up, wipe the stack, restore into the empty one, and sign in.

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
| `src/wishes.js` | The creature's daily wish |
| `src/home.js` | The nest: care, feeding, decorations, music |
| `src/quest.js` | Quests: walking, sending littles, tools, bosses, results |
| `src/boot.js` | Sizing, input, frame loop, start-up |
| `build.sh` | Concatenates the parts into `dist/index.html` |
| `server/src/` | The server: Node 22, TypeScript, Fastify. Serves the game at `/play`, the pages and the API |
| `server/pages/` | The pages around the game (landing, privacy, sign in, join, account, owner), in the Flokr Design System |
| `Dockerfile`, `compose.yaml`, `.env.example`, `setup.sh` | The Docker stack |
| `backup/` | The nightly backup job and its restore command |
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
python3 test/additions.py   # wishes and everything else added since the game first shipped
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
