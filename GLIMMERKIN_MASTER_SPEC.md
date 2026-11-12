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
files. The only outside resource is two Google Fonts (Mystery Quest, Nunito). `build.sh` concatenates the
source parts below into `dist/index.html`.

| File | Responsibility |
| --- | --- |
| `src/head.html` | Page shell, styles, HUD markup |
| `src/core.js` | Random numbers, data tables, world generator, pathfinding. No DOM; runs in Node |
| `src/draw.js` | Procedural drawing of creatures, tiles, items and enemies |
| `src/game.js` | Shared state, saving, sound, particles, icons, sheets |
| `src/things.js` | Tools, charms, toys, decorations, rare finds, the trader, the journal |
| `src/home.js` | The nest: care, feeding, decorations, nest music |
| `src/wishes.js` | The creature's daily wishes |
| `src/journey.js` | The journey: regions in order, their bosses, nest pieces and the map |
| `src/quest.js` | Quests: walking, sending littles, tools, bosses, results |
| `src/rules.js` | Each world type's own rule, at play: clocks, drawing, taps |
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
- **Mythic form.** At bond level 10 it becomes one of six Mythics, fixed for good:

  | Element | Mythic | Looks |
  | --- | --- | --- |
  | Ember | Sunflare | A mane of living flame |
  | Tide | Tidecaller | Fins and a cresting wave |
  | Stone | Cairnheart | Stone horns and crystal plates |
  | Bloom | Wildcrown | A crown of flowers and leaf wings |
  | Gale | Skydancer | Great wings that keep it aloft |
  | Glow | Starlantern | Orbiting lights and glowing antennae |

  The element with the highest pull wins: 1 for every berry of it ever eaten (`pet.ate`), 3 for each point of
  recent diet, and 2 for every visit to its world type. A tie goes to the element the creature's seed favours.
  Until then the journal says which form it leans towards. A save that was already Mythic before forms
  existed is given its form, from the same pull, when it loads. The HUD shows the form's name in place of
  "Mythic".

### 4.2.1 Wishes

The Glimmerkin wants things, up to three a day. A wish shows as a glowing thought bubble beside it whenever no
need is low; tapping the bubble says what it wants and how to grant it. A wish is one of:

| Wish | Granted when |
| --- | --- |
| A particular berry | That berry is fed to it. Berries already in the pantry are chosen first |
| A trip to a world type | A quest in that world type is finished. A portal to it stays on offer until then |
| A game with a toy | That toy is tapped in the nest. Only offered once a toy is owned |
| To take a little on a quest | A quest is finished with that little in the party |
| A long cuddle | It has been stroked 24 times |

Granting a wish adds 4 + 3 × bond level to the bond (not to the stardust wallet) and 8 Joy. The next wish
appears 90 seconds later. Each wish is rolled from the local day and the creature's seed and saved with the creature
(`wish` in the save). The journal counts wishes granted.

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

**Littles together.** Three blockers need two littles at once, one of each kind, for 1 spark each, or one
twin little with both kinds, for 2 sparks:

| Blocker | Pair | Skill | Most often in |
| --- | --- | --- | --- |
| Fog bank | Ember and Tide | Steam | Tidehollow, Emberfall |
| Root-bound stones | Stone and Bloom | Uproot | Mossroot, Stonesong |
| Singing crystal | Gale and Glow | Shatter | Gloamglass, Cloudspire |

From the second quest on, a world puts one pair blocker on the way to the portal (55% of worlds) when the
party can clear it: two littles whose main kinds make the pair, or a twin with both kinds that is the only
little of its main kind (so the sparks budgeted are surely its own). The pair's sparks come out of the same
budget as every other blocker, and the world type's own pair is chosen first. About one optional blocker in
seven is a pair blocker, guarding loot. The party sheet says which pair skills the chosen three can use, and
the journal counts each skill used. The generator test gives one little in five a second kind and clears pair
blockers by the same rules.

A little carries 3 sparks, plus 1 at level 3 and 1 at level 6. A twin little, hatched from a twin egg, has
two kinds and both skills. A little can wear one charm: the ember ring (fights cost 1 less), the feather
(the wearer can fly to fetch) or the lucky clover (chests give double).

### 4.4 Quests and worlds

A quest is one generated world on a grid. The player taps a tile to walk, taps anything in the way to send a
little, and taps loot to have one fetch it. Sparks belong to each little, not to the party. In the sheet that
opens to send a little, each little's portrait has the sparks it has left under it, as a number and a row of
pips out of the most it can carry, beside the cost of the job. The world is finished by collecting its star shards,
which wake the exit portal, and stepping through.

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

### 4.4.1 World rules

From the second quest on (and in every rare portal), each world type has one rule of its own. The rule is named
at the top of the quest; tapping the name explains it, and the first three visits to a world type explain it
as the quest starts. Fallback worlds (see below) have no rule.

| World type | Rule | How it plays | How the generator keeps it finishable |
| --- | --- | --- | --- |
| Tidehollow | Tides | The tide is out for 10 seconds, then in for 7. Sandy flats (3 to 5 a world, two of them on the way to the portal when there is room) can be crossed only while it is out. A walk stops at a flooded flat. A Tide little can freeze a flat for 1 spark, after which it holds at any tide | The plan is made at low tide, which always comes round again. No flat lies under the start, the portal or the moon plate |
| Emberfall | Wildfire | Fire spreads. Burning a bramble wall sets alight every bramble wall and dry thicket touching it, corners included, wave by wave. Dry thickets stand on about 60% of the pillars between paths; burnt, they leave open ground and a new way through. Any gloom (not a boss) beside the blaze runs from it. Half of Emberfall's optional blockers are brambles, so fires have something to spread through | Fire only ever opens ground or chases glooms off, never blocks, so it cannot make a world unfinishable. The plan does not count on it. The generator test burns every bramble (and all the fire spreads to) after the plan and checks the planned route is still all there |
| Mossroot | Slick moss | About half the open floor that is not beside a blocker, gate, door or gloom is slick moss. A step onto it slides on until the next tile would stop the slide or the ground is no longer slick, picking up anything on the way. Nothing that could be picked up waits where the slide cannot stop. Littles slide too | Moss never borders anything that can change, so a slide always ends in the same place whatever has been cleared. Slides make some moves one-way, so at every stage of the plan, and again with everything cleared and opened, the generator checks that every reachable tile still has a way back to the start; a world that could strand the player is thrown away. The generator test repeats that check at every step of its play-through |
| Cloudspire | Gusts | Wind pads come in twin pairs of one colour: one pair in a Nook, two in a Vale or Realm. Stepping onto a pad carries the Glimmerkin, or a little, to its twin, over walls and gaps. One step of the route to the portal is walled off, and the first pair links its two sides | The generator walls off a free step of the route and puts the first pad before it and its twin beyond it, so the plan crosses by gust. Pads stay off the start, the portal, the moon plate and each other, and hold no loot. Pathfinding treats a pad as a step to its twin, so the plan and the generator test use gusts like any other step. The test also checks every pad has a twin |
| Stonesong | Song stones | A song door stands on the way to the portal, as near the portal as the route allows. Its two (Nook) or three song stones, marked with one, two and three dots, lie before it. The Glimmerkin steps on them in order to open the door for good; a wrong stone starts the song again. Tapping a stone walks round the other stones where it can | The stones are placed only where they can be reached without passing the door. When the plan reaches them all, the generator finds an order in which each stone can be walked to from the one before without stepping on another, and numbers them that way. A world with no such order is thrown away. The generator test replays the song in its order |
| Gloamglass | Darkness | Only tiles near a light can be seen or tapped. The Glimmerkin lights 1.5 tiles around it, plus one tile for each Glow little in the party; a little out on an errand carries a small light. Two or three crystal lamps, mostly in dead ends, light up as the Glimmerkin passes and stay lit. Seen tiles stay dimly remembered, and the portal always glimmers. A Glow little's marks on what blocks the way show through the dark | Darkness never blocks a path. The generator test walks each dark world with only the Glimmerkin's own light, stepping only onto tiles already seen, and checks that it reaches every tile of the planned route |

**Every world is proven finishable before it is accepted.** `genWorld` builds a maze, places the blockers on
the route to the exit and budgets them against the sparks the party carries, leaving one spark spare per
little. `planSolve` then replays the intended route. `test/gen.test.js` checks 6,000 worlds on every run.

### 4.4.2 The journey

The long goal. The six world types are six regions, opened one after another in this order: Mossroot,
Emberfall, Tidehollow, Cloudspire, Gloamglass, Stonesong.

- **Opening a heart.** Three finished quests in the current region's world type open that region's heart. One
  of the three portals on offer is always in the current region's world type, and says it counts towards the
  journey. Leaving a quest early does not count.
- **The heart.** An open heart appears at the top of the portals as "The Heart of <region>". It is a boss world
  built exactly like a rare portal (a Realm with a boss gloom on the way out, the world's rule, rare gifts and
  a twin egg when there is room) but uses no map pieces. It cannot be entered before it is open. Beating it
  opens the next region; leaving it early keeps it open to try again.
- **The nest grows.** Each region beaten lets one nest piece be built for stardust. The nest widens a little
  with each one:

  | Region | Piece | Price |
  | --- | --- | --- |
  | Mossroot | Moss lining | 60 |
  | Emberfall | Ember coals | 80 |
  | Tidehollow | Shell rim | 100 |
  | Cloudspire | Feather crest | 130 |
  | Gloamglass | Glow crystals | 160 |
  | Stonesong | Standing stones | 200 |

- **The map.** "The journey" opens from Where to? and shows the six regions on a path, the quests done in the
  current one, and the nest pieces to build. The journal shows the regions opened and the pieces built.

Pieces are decoration only. They do not change care, quests or the balance of the game. A save from before the
journey starts it in Mossroot with nothing counted.

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
(30 for a rare portal or a region's heart). Leaving early pays half.

**The trader** arrives by balloon after the first finished quest, then on about three days in five, with
four items that change each visit. Prices run from 12 (a tool) to 90 (a twin egg).

**The journal** records every kind of little, world type, gloom and item met or found.

### 4.6 The save document

The whole game state for one player is a single JSON object, `S` in `src/game.js`, of a few kilobytes. It
carries a format version (`v: 1`) and the time it was last saved (`savedAt`).

Fields added after the move get a default in `afterLoad`, so older saves load unchanged: `wish` (today's wish)
`j.wishes` (wishes granted), `j.pairs` (pair skills used), `pet.ate` (berries ever eaten, by element) and
`pet.form` (the Mythic form), `reg` (the journey: `i` the current region, `n` the quests counted
there, `built` the nest pieces built) and `j.regions` (regions beaten).

Loading and storing happens in one place: `loadLocal`, `saveLocal`, `save`, `initCloud` and `pushCloud`. That
is the only part of the game the hosted version changes. The rule it applies stays the same: the newer of
the browser copy and the account copy wins, and a browser that is behind picks up the account copy.

The account copy lives in one of two stores behind the same two calls, `get` and `set`: the Claude artifact
store when the game runs inside Claude, and this server (`GET` and `PUT /api/save`) when it is hosted. A guest
on the hosted site has no account copy and saves in the browser only.

On the hosted site the browser also remembers which account its copy belongs to (`glimmerkin.account`), so
that one player's creature is never pushed into another's account:

| The browser holds | The account holds | What happens at sign-in |
| --- | --- | --- |
| Nothing, or this account's creature | A creature | The newer copy wins |
| A guest's creature | Nothing | The guest's creature becomes the account's |
| A guest's creature | A creature | The account's creature is shown. The guest's is set aside in the browser (`glimmerkin.guest`) and the account page offers to bring it in |
| Another account's creature | Anything | The account's creature is shown, or a new one hatches. Nothing is copied across |

If the server cannot be reached the game keeps saving in the browser and tries again: every 8 seconds for a
save, every 15 seconds for sign-in state, without interrupting play.

**Keep a copy.** The "?" sheet has a "Keep a copy" button that shows the whole save as a code, `GLIM1.` followed
by the save in base64. Pasting it into the account page brings that creature into the account. This is also how
the owner's creature leaves the Claude-hosted version.

## 5. Architecture

Three containers in one Docker Compose stack (the game server, Postgres and the backup job), reached from
the internet through a Cloudflare Tunnel.

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

The folder is the owner's choice. The game is then at `http://<server>:7777/play`. The owner adds a Cloudflare Tunnel public hostname,
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
| `/` | The landing page. A browser that has played before goes straight to `/play`; `/?home` shows the page anyway |
| `/play` | The game. Never requires sign-in |
| `/signin`, `/join` | Sign in; create an account with an invite code |
| `/account` | Account details, change password, sign out, import a save, delete |
| `/owner` | The owner page. Owner role only |
| `/privacy` | What is kept and how to have it deleted |

Inside the game, the "?" sheet says whether progress is saving to an account or only to this browser, links
to sign in or to the account page, and has a "Keep a copy" button. Those are the game's only new controls.

### API

All bodies are JSON. All routes except sign-up and sign-in need a session.

| Route | Purpose |
| --- | --- |
| `POST /api/signup` | Invite code, username, password; optionally a guest save to adopt |
| `POST /api/signin`, `POST /api/signout` | Start and end a session |
| `GET /api/me` | Who is signed in, and their role |
| `GET /api/save` | The account's save and its `savedAt` |
| `PUT /api/save` | Store a save. Refused if the stored copy is newer; the reply carries the newer copy |
| `POST /api/save/import` | Replace the account's creature with one from a copy code or a save. Stamped as saved now, so every device takes it |
| `POST /api/password` | Change password |
| `DELETE /api/account` | Remove the account and its save. Needs the password again. Refused for the only owner |
| `GET /api/owner/invites`, `POST /api/owner/invites`, `DELETE /api/owner/invites/:code` | Manage invite codes |
| `GET /api/owner/players`, `POST /api/owner/players/:id/reset`, `DELETE /api/owner/players/:id` | Manage players |
| `GET /api/owner/summary` | Player count, unused codes and when the last backup ran |
| `GET /api/save/summary` | The creature's name and form and when it was last saved, for the account page |

### Sign-in flow

1. An invite code, a username and a password create an account. The code is used up.
   A username is 3 to 20 letters, numbers or underscores, and is unique whatever its capitals.
2. Signing in sets a session cookie that lasts 30 days.
3. Every save is checked against that session, then written to the player's row.
4. An owner reset issues a one-time password. The player must choose a new one at next sign-in. Until they
   do, the account can do nothing else.
5. Signing out also clears the creature from that browser, after bringing the account up to date, so that
   whoever plays there next starts with their own.
6. Changing a password, or an owner reset, signs the account out everywhere else.

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
  Sessions that have run out are deleted at the next sign-in.
- **Sign-in attempts.** Rate-limited per address and per username. The player's address is read from
  Cloudflare's `CF-Connecting-IP` header. In any ten minutes: 20 sign-in tries per address, 5 wrong
  passwords per username, 10 sign-up tries per address. Wrong invite codes are also capped at 30 an hour
  across the whole site, because a code is short.
- **Requests that change data.** Must be JSON and carry the site's own `Origin`.
- **Saves.** Capped at 256 KB and checked for the expected shape and version before they are stored. A player
  can edit their own save in the browser. That is accepted, because nothing compares players.
- **Backups.** A nightly `pg_dump` at 03:00 UTC, gzipped and encrypted with AES-256 as it is written, using a
  passphrase from the environment file, with 14 days kept. Nothing readable is ever written to the backups
  folder. They are written to `BACKUP_DIR`, by default `./backups` beside the stack. That default is on the
  same server: the owner points `BACKUP_DIR` at storage elsewhere, or copies the folder off the server, and
  keeps a copy of the passphrase somewhere else. Restoring is three commands in the README, and the automated
  checks restore into an empty stack on every pull request.
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
8. **Go live.** The owner points the Cloudflare Tunnel at port 7777 for `glimmerkin.flokr.io`, creates the owner
   account, sends the first invite codes, and brings their own creature across with "Keep a copy". The steps
   are under "Going live with accounts" in the README.

## 11. Open questions

Answered by the build and the first install:

| Question | Answer |
| --- | --- |
| Which server does it run on? | `flokr-webserver`, as a stack in `/opt/stacks/glimmerkin`. Live at `glimmerkin.flokr.io` since 11 November 2026 |
| Is the site open to anyone with the address? | Yes for guest play. Accounts are by invite code only |
| Can guests play without an invite code? | Yes. Rule 2 in the overview depends on it |
| Who creates a child's account? | Whoever holds the invite code. The owner gives a child's code to a parent |
| Where do backups go? | `BACKUP_DIR`, by default `./backups` beside the stack |

Still open, for the owner:

| Question | Working assumption |
| --- | --- |
| Which storage off the server do backups reach? | None yet. Until `BACKUP_DIR` points elsewhere, or the folder is copied off, losing the server loses the backups too |
| Does the tunnel run on the same host as the stack? | If `cloudflared` runs directly on the host, set `BIND_ADDRESS=127.0.0.1` |
| Is the database volume on encrypted storage? | Depends on the server. Backups are encrypted either way |
