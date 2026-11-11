# Glimmerkin master spec

This file is the sole canonical spec for Glimmerkin. Decisions made in chat, on the kickoff board or in a
pull request are folded back into it the same day.

Status: draft for review, 11 November 2026. Decisions folded in the same day: Cloudflare Tunnel in front,
Docker port 7777, install by README command.

## 1. Overview

Glimmerkin is a creature-care and quest game. The player looks after one creature, a Glimmerkin, and takes it
and its follower creatures, the littles, through portals into worlds that are generated fresh every time.

**The game is the product, and it is already designed and built.** It runs today as a single self-contained
web page. This project moves that game, unchanged, onto Flokr's own server at `glimmerkin.flokr.io` and adds
the smallest account layer that lets invited family and friends keep their creature on any device.

Two rules follow from that and govern every decision below:

1. **The game ships as it is.** Section 4 records the game as built. Nothing in the move redesigns, reskins
   or rebalances it. A change to the game is its own pull request with its own reason.
2. **Nobody meets a sign-in screen before they can play.** A visitor can be stroking a creature within one
   tap. Accounts exist to save progress, never to gate play.

## 2. Users

| Who | What they do | What we hold about them |
| --- | --- | --- |
| Player | Plays as a guest or signs in; a few dozen at most, some of them children | A username, a password hash, one save |
| Owner (Stephen) | Creates invite codes, resets passwords, removes accounts | The same, with the owner role |

Players join by invitation. The game is free, with no adverts and no purchases. Glimmerkin is a passion
project and a showpiece for Flokr, not a commercial product.

## 3. Scope

### MVP

1. The game served at `https://glimmerkin.flokr.io`, playing exactly as it does today.
2. Guest play with no account: the save lives in the browser.
3. Invite-only accounts with a username and password.
4. One save per account in the database, loaded on any device the player signs in on.
5. A guest's creature moves into the account when they create one. A save exported from the Claude-hosted
   version imports the same way.
6. An owner page: create and cancel invite codes, reset a password, remove an account.
7. A nightly, encrypted database backup kept off the server.

### Non-goals

- Multiplayer, trading, gifting, chat or leaderboards.
- Payments, adverts or analytics.
- Email addresses, real names or any other personal detail.
- Public sign-up.
- Phone apps. Glimmerkin stays a web page.
- New game content as part of the move.

### Success metric

Within four weeks of going live: 10 invited players have accounts, 5 of them play on three or more separate
days in one week, and no save is lost. If this is missed, work stops at the MVP.

## 4. The game, as built

This section describes what exists in `src/`. It is a record, not a proposal.

### 4.1 Shape of the code

One page with no runtime dependencies. Everything is drawn on a canvas in code; there are no image or sound
files. The only outside resource is two Google Fonts (Mystery Quest, Nunito). `build.sh` concatenates eight
source parts into `dist/index.html`.

| File | Responsibility |
| --- | --- |
| `src/head.html` | Page shell, styles, HUD markup |
| `src/core.js` | Random numbers, data tables, world generator, pathfinding. No DOM; runs in Node |
| `src/draw.js` | Procedural drawing of creatures, tiles, items and enemies |
| `src/game.js` | Shared state, saving, sound, particles, icons, sheets |
| `src/things.js` | Tools, charms, toys, decorations, rare finds, the trader, the journal |
| `src/home.js` | The nest: care, feeding, decorations, nest music |
| `src/quest.js` | Quests: walking, sending littles, tools, bosses, results |
| `src/boot.js` | Sizing, input, frame loop, start-up |

### 4.2 The Glimmerkin and its care

The player has one Glimmerkin with three needs, each 0 to 100. There is no way to lose it.

| Need | Falls | Rises |
| --- | --- | --- |
| Belly | 1 point every 6 minutes | A berry gives 18; a starfruit gives 25 |
| Joy | 1 point every 4 min 40 s; each toy owned slows this by a quarter | Stroking gives 1.3 per 34 px of finger travel; a berry gives 3 |
| Rest | A quest costs 25 | 1 point a minute awake, 1 point every 4 seconds asleep |

Time away counts, capped at 10 hours, and never takes Belly or Joy below 8.

The creature changes in three ways:

- **Bond.** Stardust earned raises its bond level. It grows through four forms: Hatchling, Fledgling at
  level 3, Wanderer at level 6, Mythic at level 10.
- **Diet.** There are six berries, one per element. What it eats shifts its colour and adds that element's
  feature (a flame, a leaf sprout, a halo and so on).
- **Starfruit.** Each one eaten leaves one of eight permanent marks.

### 4.3 Littles

Littles are follower creatures. A player holds up to 8 and takes up to 3 on a quest. Each is drawn uniquely
from its seed.

| Kind | Species | Clears | Perk |
| --- | --- | --- | --- |
| Ember | Cinderkit | Bramble walls | Fights cost 1 spark less |
| Tide | Puddlefin | Deep pools | Dewdrops restore 2 sparks, not 1 |
| Stone | Pebblit | Boulders | Carries one extra spark |
| Bloom | Sproutling | Chasms | Berries count double |
| Gale | Zephyrmoth | Storm clouds | Flies to fetch anything in sight |
| Glow | Lanternbug | Shadow veils | Marks what blocks the way to the portal |

A little carries 3 sparks, plus 1 at level 3 and 1 at level 6. A twin little, hatched from a twin egg, has
two kinds and both skills. A little can wear one charm: the ember ring (fights cost 1 less), the feather
(the wearer can fly to fetch) or the lucky clover (chests give double).

### 4.4 Quests and worlds

A quest is one generated world on a grid. The player taps a tile to walk, taps anything in the way to send a
little, and taps loot to have one fetch it. The world is finished by collecting its star shards, which wake
the exit portal, and stepping through.

- **Sizes.** Nook 5x7 (2 shards), Vale 7x7 (3 shards), Realm 7x9 (3 shards).
- **World types.** Mossroot, Emberfall, Tidehollow, Cloudspire, Gloamglass, Stonesong. Each has its own
  palette, scenery and home berry.
- **Portals.** Three are on offer. They are replaced after every quest and every 3 hours.
- **Mood.** Joy of 60 or more gives every little one extra spark. Belly of 60 or more allows one Rally per
  quest, which gives each little a spark.
- **Blockers.** Six obstacle types, each cleared by one kind of little for 1 spark. Glooms block the way and
  cost 2 or 3 sparks to chase off, less for the kind they fear.
- **Moon gate.** Some worlds have a gate that opens only while a little sits on a moon plate. Walking
  through it keeps it open for good.
- **Islets.** Loot on islets can only be reached by a flier.
- **Rare portal.** Three map pieces reveal it. It holds a boss gloom with 2 to 4 hearts, worn down one spark
  per strike, and a guaranteed twin egg.

**Every world is proven finishable before it is accepted.** `genWorld` builds a maze, places the blockers on
the route to the exit and budgets them against the sparks the party carries, leaving one spark spare per
little. `planSolve` then replays the intended route. `test/gen.test.js` checks 6,000 worlds on every run.

### 4.5 Things

| Group | Items | Where they come from |
| --- | --- | --- |
| Tools (single use) | Bridge seed, spark lantern, moon key, scare-bell | Chests (45% hold one), the trader |
| Charms | Ember ring, feather, lucky clover | Worlds (12%), rare portal, the trader |
| Toys | Bouncy ball, music box | Worlds (15%), the trader |
| Decorations | A lantern, banner and wind chime for each world type: 18 in all | That world type (50%), the trader |
| Chime stones | Up to 8; each adds a note to the tune the nest plays | Worlds (24%), the trader |
| Starfruit | Leaves a permanent mark | Worlds (22%), the trader |
| Map pieces | Three reveal the rare portal | Worlds (30%), the trader |
| Eggs | Hatch a little when rubbed warm; 15% are twins after 3 quests | Worlds, rare portal, the trader |

Special finds are only ever placed where the current party can reach.

**Stardust** is both bond progress and a wallet. A finished quest pays its loot, 3 per shard and 15 more
(30 for a rare portal). Leaving early pays half.

**The trader** arrives by balloon after the first finished quest, then on about three days in five, with
four items that change each visit. Prices run from 12 (a tool) to 90 (a twin egg).

**The journal** records every kind of little, world type, gloom and item met or found.

### 4.6 The save document

The whole game state for one player is a single JSON object, `S` in `src/game.js`, of a few kilobytes. It
carries a format version (`v: 1`) and the time it was last saved (`savedAt`).

Loading and storing happens in one place: `loadLocal`, `saveLocal`, `save`, `initCloud` and `pushCloud`. That
is the only part of the game the hosted version changes. The rule it applies stays the same: the newer of
the browser copy and the account copy wins, and a browser that is behind picks up the account copy.

## 5. Architecture

Two containers in one Docker Compose stack, reached from the internet through a Cloudflare Tunnel.

```
Browser ── HTTPS ──> Cloudflare ══ tunnel ══> Game server (Node) ──> Postgres
 the game,           glimmerkin               port 7777              accounts, sessions,
 with a local        .flokr.io                serves the game,       invites, saves
 copy of the save                             sign-in, saves,             │
                                              owner page                  └──> nightly encrypted
                                                                               backup, off the server
```

**The game server listens on port 7777.** That number is fixed: the compose file publishes it and the tunnel
points at it. Nothing else on the server is opened to the internet; the tunnel dials out.

| Part | Choice | Why |
| --- | --- | --- |
| Game client | The existing plain JavaScript, built by `build.sh` | It is finished. A canvas game gains nothing from a framework |
| HTTPS front door | Cloudflare Tunnel, set up by the owner | No port is opened on the server, and Cloudflare handles the certificate |
| Server | Node 22, TypeScript, Fastify | The stack Roost and Scout use; Fastify is small and validates input by schema |
| Database | Postgres 16, reached with the `pg` client | One JSON document per player fits a `jsonb` column |
| Password hashing | `argon2` (argon2id) | The current recommended algorithm for stored passwords |

### Install

The stack is installed and updated with commands kept in the repository's README. They must stay this short:

```sh
git clone https://github.com/stepclrk/glimmerkin.git /opt/stacks/glimmerkin
cd /opt/stacks/glimmerkin
sh setup.sh                 # creates .env and fills in the secrets; never changes a value already set
docker compose up -d --build
```

The folder is the owner's choice. The game is then at `http://<server>:7777/play`; until the landing page
exists, `/` sends the browser on to `/play`. The owner adds a Cloudflare Tunnel public hostname,
`glimmerkin.flokr.io`, pointing at `http://localhost:7777`. To update: `git pull && sh setup.sh && docker compose up -d --build`.

The first owner account is made once with `docker compose exec web node dist/cli.js owner <username>`, which
prints a one-time password. The same command is the way back in if the owner is locked out.

The compose file publishes `7777:7777`. Where `cloudflared` runs directly on the same host, setting
`BIND_ADDRESS=127.0.0.1` in `.env` keeps the port off the rest of the network. Where `cloudflared` runs in a
container or on another machine, `localhost` is not this server from its point of view: the tunnel points at
the server's LAN address on port 7777 and `BIND_ADDRESS` stays at its default.

### Pages

| Address | What it serves |
| --- | --- |
| `/` | The landing page. A browser that has played before goes straight to `/play` |
| `/play` | The game. Never requires sign-in |
| `/signin`, `/join` | Sign in; create an account with an invite code |
| `/account` | Account details, change password, sign out, import a save, delete |
| `/owner` | The owner page. Owner role only |
| `/privacy` | What is kept and how to have it deleted |

Inside the game, the "?" sheet says whether progress is saving to an account or only to this browser, and
links to sign in or to the account page. That is the game's only new control.

### API

All bodies are JSON. All routes except sign-up and sign-in need a session.

| Route | Purpose |
| --- | --- |
| `POST /api/signup` | Invite code, username, password; optionally a guest save to adopt |
| `POST /api/signin`, `POST /api/signout` | Start and end a session |
| `GET /api/me` | Who is signed in, and their role |
| `GET /api/save` | The account's save and its `savedAt` |
| `PUT /api/save` | Store a save. Refused if the stored copy is newer; the reply carries the newer copy |
| `POST /api/password` | Change password |
| `DELETE /api/account` | Remove the account and its save |
| `GET /api/owner/invites`, `POST /api/owner/invites`, `DELETE /api/owner/invites/:code` | Manage invite codes |
| `GET /api/owner/players`, `POST /api/owner/players/:id/reset`, `DELETE /api/owner/players/:id` | Manage players |

### Sign-in flow

1. An invite code, a username and a password create an account. The code is used up.
   A username is 3 to 20 letters, numbers or underscores, and is unique whatever its capitals.
2. Signing in sets a session cookie that lasts 30 days.
3. Every save is checked against that session, then written to the player's row.
4. An owner reset issues a one-time password. The player must choose a new one at next sign-in.

## 6. Data model

| Table | Columns |
| --- | --- |
| `accounts` | `id` uuid, `username` unique and case-insensitive, `password_hash`, `role` (player or owner), `must_change_password`, `created_at`, `last_seen_at` |
| `sessions` | `token_hash`, `account_id`, `created_at`, `expires_at` |
| `invites` | `code`, `created_at`, `used_by`, `used_at`, `cancelled_at` |
| `saves` | `account_id` (one row per account), `doc` jsonb, `saved_at`, `updated_at` |

Removing an account removes its sessions and its save.

## 7. Integrations

- **Google Fonts**, for the game's two typefaces and the three Flokr typefaces on the surrounding pages.
- **GitHub**, for the code and automated checks.
- **Cloudflare**, for the tunnel and the certificate at `glimmerkin.flokr.io`.
- Nothing else. No email service, analytics, payments or third-party sign-in.

## 8. Security and privacy

Encryption is on by default at every hop the project controls.

- **In transit.** Players reach the game over HTTPS only, ended at Cloudflare and carried to the server inside
  the encrypted tunnel. Port 7777 itself speaks plain HTTP and is never exposed to the internet. Cloudflare
  can read what passes through it, sign-in requests included; that trust is accepted. Sign-in cookies are
  marked `Secure`, so signing in works only through the HTTPS address, not directly on port 7777.
- **Passwords.** Stored as argon2id hashes. Minimum 10 characters. Never logged.
- **Sessions.** A random token in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Only its hash is stored.
- **Sign-in attempts.** Rate-limited per address and per username. The player's address is read from
  Cloudflare's `CF-Connecting-IP` header. In any ten minutes: 20 sign-in tries per address, 5 wrong
  passwords per username, 10 sign-up tries per address. Wrong invite codes are also capped at 30 an hour
  across the whole site, because a code is short.
- **Requests that change data.** Must be JSON and carry the site's own `Origin`.
- **Saves.** Capped at 256 KB and checked for the expected shape and version before they are stored. A player
  can edit their own save in the browser. That is accepted, because nothing compares players.
- **Backups.** A nightly `pg_dump`, encrypted before it leaves the server, with 14 days kept.
- **Secrets.** In the stack's environment file on the server, never in the repository.
- **Personal data.** None beyond a made-up username. The `/privacy` page says so in plain words and tells a
  parent how to have an account deleted. Invite codes for children go to a parent.

This is a design position. It is not legal advice.

## 9. Screens

The game's own screens are the game as built (section 4) and are not redesigned.

The pages around the game are approved designs in the Flokr Design System:
[Glimmerkin screens](https://claude.ai/artifact/Pcg8zAG6uEWKsRahgF6P3q).

| Screen | Address |
| --- | --- |
| Landing page | `/` |
| Sign in | `/signin` |
| Create account | `/join` |
| Account | `/account` |
| Owner page | `/owner` |

Related: the [brief](https://claude.ai/artifact/KtahfRyFqTrnd4MLNgYDHd) and the
[kickoff board](https://claude.ai/artifact/AcVtKA9ZYC61iyydRMehF4).

## 10. Build order

The game comes first. Each step leaves something a player can use.

1. **The game, hosted.** Serve the existing build at `/play` from the Docker stack on port 7777, installed
   with the README commands. Guest play works exactly as today, saving in the browser.
2. **Automated checks.** Build, the generator test and the browser playthroughs on every pull request.
3. **Accounts and saves.** Database, sign-up with an invite code, sign-in, the save routes, and the game's
   storage swapped from the Claude store to the server.
4. **Guest to account, and import.** A guest's creature moves into a new account; an exported save imports.
5. **Owner page.** Invite codes, password reset, account removal.
6. **Landing, account and privacy pages.**
7. **Backup,** and a restore tested once.
8. **Go live.** The owner points the Cloudflare Tunnel at port 7777 for `glimmerkin.flokr.io`, and the owner's
   own creature is exported from Claude and imported.

## 11. Open questions

| Question | Working assumption |
| --- | --- |
| Which server does it run on? | The Flokr Docker server, as a stack under `/opt/stacks/glimmerkin` |
| Does the tunnel run on the same host as the stack? | Yes. If so, bind port 7777 to `127.0.0.1` |
| Where do backups go? | Not decided. Needs somewhere off the server |
| Is the site open to anyone with the address? | Yes for guest play; accounts stay invite-only |
| Can guests play without an invite code? | Yes. Rule 2 in the overview depends on it |
| Who creates a child's account? | A parent, who receives the invite code |
| Is the database volume on encrypted storage? | Depends on the server. To check before go-live |
