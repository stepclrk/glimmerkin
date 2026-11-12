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
| `src/play.js` | Nest play: the favourite spot and the other ways to be with the Glimmerkin and the littles |
| `src/wishes.js` | The creature's daily wishes |
| `src/intro.js` | The gentle start: what opens after how many quests, and the news for returning players |
| `src/days.js` | Things that follow the calendar: today's world, the seasons, December's gifts |
| `src/journey.js` | The journey: regions in order, their bosses, nest pieces and the map |
| `src/quest.js` | Quests: walking, sending littles, tools, bosses, results |
| `src/rules.js` | Each world type's own rule, at play: clocks, drawing, taps |
| `src/bonus.js` | Bonus worlds: the secret door, going in and coming back, what every bonus world shares |
| `src/starfall.js` | The bonus world Starfall |
| `src/garden.js` | The bonus world Night garden |
| `src/hide.js` | The bonus world Hide and seek |
| `src/starweave.js` | The bonus world Starweave, and the kept constellations drawn over the nest |
| `src/skyglide.js` | The bonus world Skyglide |
| `src/wander.js` | The bonus world Wanderlings |
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

Once littles together have opened (the fifth quest, see 4.4.3), a world puts one pair blocker on the way to the portal (55% of worlds) when the
party can clear it: two littles whose main kinds make the pair, or a twin with both kinds that is the only
little of its main kind (so the sparks budgeted are surely its own). The pair's sparks come out of the same
budget as every other blocker, and the world type's own pair is chosen first. About one optional blocker in
seven is a pair blocker, guarding loot. The party sheet says which pair skills the chosen three can use, and
the journal counts each skill used. The generator test gives one little in five a second kind and clears pair
blockers by the same rules.

**In the nest.** The party stands on the nest beside the Glimmerkin. Littles who are resting sit on four
small floating perches beside and below the isle: one to a perch first, then two, the two lower perches
filling first, so no little stands in front of another. A little that changes place leaps across. Eggs wait
in a cradle that hangs from the front of the nest, three to a row; a finger rubs them there to warm them.

**Playing with littles.** A finger stroked over a little makes it happy, with a heart every 34 px. One tap
names it and its skill; two quick taps make it show off its kind's trick: a Cinderkit puffs a flame, a
Puddlefin blows a bubble, a Pebblit stamps the ground, a Sproutling bursts into flowers, a Zephyrmoth loops
the loop and a Lanternbug lights up. A twin takes turns with its two kinds. None of this changes play.

**Carrying.** Pressing on a little for 0.45 seconds without moving picks it up, and glowing rings mark the
three places in the party. Put down on the nest, it joins the party; when the party is full it takes the
place of the nearest of the three, who goes to rest. Put down anywhere else, a party little rests, unless it
is the only one. Put down on the Glimmerkin, the two have a cuddle. The party picker in Where to? and in
Littles still works as before.

**Treats.** A berry dragged from the pantry onto a little is a treat. Its own kind's berry (either kind, for a
twin) is its favourite and gives it 3 experience; any other berry gives 1. A little takes up to three treats a
local day (`treats` on the little: `day` and `n`). A treat does not feed the Glimmerkin; a berry dragged onto
the Glimmerkin feeds it as a tap does.

**Toys and littles.** When the bouncy ball is tapped, the party chases it for 3 seconds and bumps it on when
they reach it, up to 8 bumps, each keeping the chase going a little longer. While the music box plays, every
little sways and hops to it. Neither changes play.

**Little wishes.** Each local day one little, chosen from the day and the creature's seed, has a wish, shown as
a small bubble beside it; tapping the bubble says what it wants. It is either a trip to its home world type
(the one whose berry matches its kind), granted by finishing a quest there with that little in the party, or
(two times in five, when the pantry holds one) its favourite berry as a treat. A portal to a wished-for world
stays on offer, in a place not held by the journey's region or the Glimmerkin's own wish. Granting it gives
the little 4 experience. The wish is saved as `lwish` (`day`, `id`, `k`, `a`, `done`), and the journal
counts little wishes granted (`j.lwishes`).

**Friends.** Every pair of littles who finish a quest together counts it (`friends`, keyed by the two ids).
At five they become friends: the quest results say so, the little's sheet names its friends, and a small
heart floats between friends who sit together. When resting littles must share perches, friends share one.

**Friends' eggs.** The moment two littles become friends they leave an egg in the cradle, once per pair. It
carries their main kinds (`kinds` on the egg, with `from`, their names) and hatches a little of those kinds: a twin
when the kinds differ, otherwise one of that kind. The egg has a small heart on it, the results say what it will
hatch, and the hatching sheet names the two friends. When the nest already holds 8 littles and eggs, they bring
25 stardust instead. The journal counts friends' eggs (`j.feggs`). Pairs who were friends before this existed
leave no egg.

**Grown up.** At level 6 a little is all grown up: drawn 12% bigger, with fluffy tufts at its sides and a gold
star on its brow. The level-up line says so, and Littles and the little's sheet show "grown up". It changes
nothing else: the extra spark at level 6 was already there.

A little carries 3 sparks, plus 1 at level 3 and 1 at level 6. A twin little, hatched from a twin egg, has
two kinds and both skills. A little can wear one charm: the ember ring (fights cost 1 less), the feather
(the wearer can fly to fetch) or the lucky clover (chests give double).

### 4.3.1 Nest play

More ways to be with the Glimmerkin and the littles in the nest. None of it changes quests, sparks or the balance
of the game, and all of it is there from the start. Each part has an entry in What's new (news version 6).

**Its favourite spot.** A stroke on the Glimmerkin lands on one of four spots, measured from where it stands:
the top of its head, the cheek on the left, the cheek on the right, or its tummy. Each answers in its own way: a
stroke on the head closes its eyes, a cheek leans into the finger, and the tummy makes it wiggle. One spot a day is
its favourite, rolled from the local day and its seed. Strokes there purr more, throw sparkles, and count twice
towards the long cuddle wish. The first time each day it is found, a toast names it. The save keeps `spot` (`day`
and `found`), and the journal counts the days it was found (`j.spots`) and which spot it was (`j.spotKinds`).

**Catch.** A berry or frostberry flicked upwards from Feed (released while moving up fast) flies in an arc
towards the Glimmerkin: the flick sets how high it goes and how far it leans to one side. The Glimmerkin watches
it and, when it comes down within reach, leaps and catches it. A caught berry feeds it exactly as a tap does, so
it is not thrown at all when it is full or asleep. Catches in a row are counted on screen, and the best run is
kept in the journal (`j.catchBest`); the tenth in a row gets a toast. A berry it misses that lands on the isle is
fetched by the nearest little on the nest and, if treats have opened and it has treats left today, eaten as a
treat; otherwise it goes back to the pantry, as does one that falls past the isle. Nothing is lost.

**Tricks.** A shape drawn with a finger on open sky (not on anything that can be tapped) asks the Glimmerkin
for a trick, and the line shows as it is drawn: a circle for spin, a zigzag (three turns or more) for wiggle, a
swipe up for leap and a swipe down for bow. Anything else is ignored. It tries the trick clumsily (half a turn, a
small hop) and a toast says to stroke it as praise. One stroke within about five seconds counts as praise, once
per try. Five praised tries and it knows the trick (`pet.tricks`, praised tries by trick, 5 when learned): from
then on it does it neatly, every little on the nest joins in with its own kind's trick, and when Joy is 60 or more
it shows off a learned trick by itself every 40 to 80 seconds. The journal lists the tricks it knows.

**Home with bits of the world on them.** Every little in the party comes home from a quest, finished or left
early, carrying seven bits of its world type: soot from Emberfall, seaweed from Tidehollow, leaves from Mossroot,
fluff from Cloudspire, glitter from Gloamglass, grit from Stonesong. The results say so. Each stroke on a little
(34 px of finger travel, as for hearts) rubs one bit off; when the last goes it gives a happy shake. Nothing else
depends on it. The little keeps `muck` (`b` the world type, `n` the bits left) until it is clean.

**Keepsakes.** After a finished quest, when no keepsake is waiting and fewer than eight are kept, there is a 35%
chance that one little of the party brings home something it found there (preferring one of that world type's
three not yet kept). The results say so. That little stands in front of the Glimmerkin holding it up until a tap
on the little gives it over: the Glimmerkin is delighted and the keepsake sits on the back rim of the nest, eight
places in all. Tapping one there tells its story, as in "Sea glass from Tidehollow, found by Pim on 12 November".
Each world type has three: Mossroot an oak leaf, a mossy pebble and a seed pod; Emberfall an ember stone, an ash
feather and a fire opal; Tidehollow a sea shell, sea glass and a pearl; Cloudspire a cloud feather, sky glass and a
wind-smoothed pebble; Gloamglass a glow crystal, a moth wing and a lamp bead; Stonesong a singing pebble, a fossil
shell and a quartz chip. The save keeps `keeps` (each with `b` the world type, `i` which of its three, `by` the
little's name and `at` the local day) and `offer` (the one waiting: the little's `id`, `b` and `i`). The journal
lists them.

**Little tower.** A little carried and put down with its feet on another little's head climbs on top of it,
up to three high, onto the top one only. Put down anywhere else, carrying works as before, so the party and the
perches do not change. Two high stand steady for 9 seconds. Three high wobble more and more and topple after 4.5
seconds, or 7 when each is friends with the one below. A Pebblit at the bottom never wobbles and stands for 12
seconds. A tap on any of them brings the tower down at once, as does the Glimmerkin falling asleep: they tumble
apart in a giggling heap and go back to their places. Only one tower stands at a time. The journal keeps the
tallest (`j.tower`).

**Bedtime pile.** While the Glimmerkin sleeps, every little leaves the nest or its perch and curls up against
it, spread round the front of it from left to right with its face left clear, a second row when there are more
than six. They are ordered so that friends lie side by side. On waking they go back to their places. A tap on a
sleeping little makes it shuffle a little closer without waking anyone. A dream bubble beside the sleeping
Glimmerkin shows the last world type it visited (`dream`, set as any quest ends), drawn from that world's own tiles
with a portal glowing in it.

**Nest life.** When nobody has touched the nest for 12 seconds, no sheet is open, the Glimmerkin is awake and
nothing else is going on (a toy, a tower, a catch, a trick), the littles do something of their own every 10 to 18
seconds, picking friends together where they can: two on the nest chase each other round it for 5 seconds; one
dozes off for 6; one hops over to another and tidies it, with hearts; or one does its kind's trick at the
Glimmerkin, which is pleased. Nothing is saved.

**Copy me.** Littles has a Play copy me button, which works when two or three littles are on the nest. The
Glimmerkin points at them one after another with a sparkling line, and each does its kind's trick with a note of
its own. Then it is the player's turn: tapping the littles in the same order. The first round shows two, and each
round copied right adds one more to the same sequence. A wrong tap ends the game, raises Joy as a toy does, and
says how many rounds were copied; the best is kept (`j.copyBest`). Picking a little up or the Glimmerkin falling
asleep ends a game without a score.

**Pictures.** The journal has a Take a picture button. It closes the journal, and everyone poses for a moment
(the Glimmerkin hops, every little does its trick; a sleeping nest stays asleep) before a white flash takes the
picture. The album keeps how to draw it, not an image: the time of day, the season, whether it was asleep, the
Glimmerkin's look (name, seed, bond, diet, marks and form) and each little's kind, seed, name and whether it was
grown up, party first. That is a few hundred bytes a picture. It holds twelve; a thirteenth pushes out the
oldest, and the toast says so. The journal shows them newest first, and tapping one shows it larger with its date
and who was in it, with a button to remove it. The save keeps `pics`. The button sits in the journal rather than
the top bar, where a fourth button would crowd out the creature's name on narrow phones.

**Welcome home.** When a quest ends and its results are closed, the littles who stayed behind rush over to
the party for three and a half seconds, hopping: each to a friend in the party if it has one, where the two hug
with hearts, otherwise to the nearest of the party, staying on the isle. Then everyone goes back to their places.
Nothing is saved.

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

Once world rules have opened (the third quest, see 4.4.3), each world type has one rule of its own, in every rare
portal too. The rule is named
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

### 4.4.3 A gentle start

A new player meets one thing at a time. Care, plain quests and playing with littles (stroking, tricks, carrying,
toys) are there from the start; the rest opens as quests are finished:

| Finished quests | What opens | Until then |
| --- | --- | --- |
| 1 | Today's world and wishes | Where to? has no today's world, and no wish bubble shows |
| 2 | World rules | Worlds are built without their rule |
| 3 | The journey | Where to? has no journey card, the journey's region is not held on offer, and quests do not count towards it |
| 4 | Littles together | Worlds are built without pair blockers, and Where to? does not say what the party can do together |
| 5 | Treats and little wishes | A berry dragged onto a little does nothing, and no little has a wish |
| 6 | Secret doors and bonus worlds | No world hides a secret door |

The generator takes `noRule` and `noPair` options for this, and `test/gen.test.js` builds worlds with each held
back. When the quest that opens something is finished, a "Something new" sheet tells of it as soon as the
results are closed; an unlock that was never shown (`seen` in the save) is shown at the next start instead.
Moon gates, glooms, twin eggs and world sizes keep the steps they already had. The rule's own explanation at
the start of a quest now counts the first three visits made while the rule applies (`j.rules`).

**What's new.** A returning player is shown, once, a "What's new" sheet of the changes they have not yet been
told of. Each entry carries the news version it came in, and the save keeps the last version shown (`news`).
An entry about something still locked for that player is left out; its unlock sheet tells of it later. The "?"
sheet has a "What's new" button that shows every entry. A save from before the gentle start counts what it has
already reached as shown, and gets the news only if it has finished a quest. Being told of something in the news
counts as its unlock being shown.

### 4.4.4 Today's world

Once a player has finished a quest, Where to? has one extra portal at the top of the list: today's world. It is
built from the local date alone (its seed, world type and name), so every player is sent to the same world that
day; as with every world, the generator fits the blockers to the party that goes. It is a Vale, follows its world
type's rule, and counts towards the journey and wishes as any quest there does.

Finishing it pays the usual stardust and 10 more, once a day. After that its card says it is done until the next
local day. Leaving early does not count, and it can be tried again. The save keeps `today` (`day` and `done`), and
the journal counts the days it was finished (`j.days`).

### 4.4.5 The seasons and December's gifts

The nest follows the real calendar, by the local month, northern seasons: winter is December to February, spring
March to May, summer June to August, autumn September to November. Nothing here changes care, quests or the
balance of the game.

| Season | At the nest |
| --- | --- |
| Winter | Snow falls, lies on the isle and along the rim of the nest. The trader carries two frostberries for 10 stardust, as a fifth item |
| Spring | Blossom petals drift down |
| Summer | Seeds float up on warm air |
| Autumn | Leaves tumble down |

**Frostberries.** Kept in the pantry (`pantry.frost`) and fed like a berry: 15 Belly, 8 Joy and 1 bond. A
frostberry does not change the creature's colours or count towards its Mythic form, and it is not a treat for a
little. The journal counts those eaten (`j.frost`).

**December's gifts.** From the 1st to the 25th of December a wrapped gift floats on a small cloud under the moon,
with the number waiting on it. Tapping it opens the oldest waiting gift; a gift missed waits for the next visit,
counted from the 1st, or from the day the creature hatched if that was in the same December. What is inside is
rolled from the year, the day and the creature's seed, so it is the same on every device: two frostberries
(30%), three of one berry (25%), 15 stardust (15%), a tool (10%), a chime stone while there is room (10%,
otherwise 15 stardust) or a starfruit (10%). The 25th holds a starfruit and three frostberries. The save keeps
`advent` (`y` the year, `got` the days opened), and the journal counts gifts opened (`j.gifts`).

### 4.4.6 Secret doors and bonus worlds

Once secret doors have opened (the sixth finished quest, see 4.4.3), about one world in four hides a small
shimmering door. Behind it is a bonus world: a short world, one to three minutes, that plays in a way of its own
and has no sparks, blockers or star shards.

**The door.** The generator puts it on a quiet tile that the planned route reaches, so it can always be walked
to: open floor with nothing on it (it may take the place of a berry), never slick moss, a sandy flat, a wind pad,
a lamp, a song stone, the start, the portal or the moon plate. It picks a dead end, or a tile off the way to the
portal, where one is free. The door is rolled from numbers of its own, so the rest of the world is the same with
or without it. Rare portals, a region's heart and fallback worlds never hide one. Today's world can.

**Going through.** Walking onto the door, or tapping it, opens a sheet that names the bonus world and offers
"Not now" and "Step through". Walking past it does nothing. The door leads to the bonus world this player has
visited least (`j.bonus` counts visits by world), so all of them come round; ties are settled by the world's seed.
The quest waits exactly as it was left, with its tide clock stopped. A door is used up once stepped through.

**Inside.** The top of the screen shows the bonus world's name, "Bonus world", a count of progress and the name of
its way of playing, which opens its rule when tapped. The bar holds "Back to the quest", which leaves early with
what was earned so far, beside any button of the bonus world's own (Starweave's "Start again", Wanderlings' "Go"). Nobody can lose a bonus world: there are no lives and no failure screen.

**Coming back.** When the bonus world ends, a sheet says what was earned. It is added to what the quest has found
so far, and goes home with the rest when the quest ends (so leaving the quest early halves its stardust, like any
other). The game goes back to the quest where it was left. Two keepsakes are the exception and go straight to the nest: a constellation from Starweave and a chime stone
from Skyglide. Nothing else about a bonus world is saved except the count of visits, which the journal shows; like a quest, one in progress is not kept if the page is closed.

**Every bonus world is built by code and checked to be fair.** Each has a generator in `src/core.js`, and
`test/bonus.test.js` checks the door's placement over 3,000 worlds and each generator over 1,500 seeds.

| Bonus world | You | How it plays | How the generator keeps it fair | Pays |
| --- | --- | --- | --- | --- |
| Starfall | Catch | The Glimmerkin and its party ride a cloud for 60 seconds while motes of light fall. Dragging anywhere moves the cloud. A mote is worth 1 point, or 2 when it is the colour of a kind in the party (those have a ring round them; four motes in ten are rolled from the party's kinds). About one drop in twelve is a star shard, which goes in a jar. Small glooms fall too: bumping one wobbles the cloud and tosses up to 3 points' worth of motes back up, to be caught again nearby | Drops come 0.45 to 0.95 seconds apart. Each mote or shard is close enough to the one before to reach at 0.8 sky-widths a second (the cloud itself manages twice that), and a gloom lands at least 0.3 of the sky's width from the straight line between the two drops either side of it, where the reach of a catch is 0.13. So a run that catches everything and bumps nothing always exists; the test replays it | 1 stardust per 5 points and 1 per shard, at least 10 and at most 30. Leaving early pays the same without the least |
| Night garden | Arrange | A 5 by 5 garden bed holds 6 to 9 sleeping buds, each ringed in the colour of the kind of little it needs. Three littles are placed on it: the party, with wild littles of other kinds joining when the party is smaller than three. A bud opens the moment a little of its kind reaches it, and each kind reaches in its own pattern: a Cinderkit the four tiles beside it, a Lanternbug the four at its corners, a Pebblit the four tiles two steps away in a straight line, a Sproutling the three tiles above it, a Puddlefin its whole row and a Zephyrmoth its whole column. A twin reaches in both its patterns. A little is dragged onto a tile, or tapped and then a tile tapped; it cannot stand on a bud, and can be moved freely. The tray shows each little's pattern. After 30 seconds with no new bud open, the right tile for one little glimmers | The generator stands the three littles on the bed first and sets two or three buds for each only on tiles it reaches, so an answer always exists. It then counts every other way to place them and keeps a garden with exactly one answer, trying up to 240 beds (about 24 gardens in 25 have one answer; the rest have the fewest it found) | 8 stardust and a berry for every two buds of a kind, rounded up. Leaving early pays 1 stardust for each open bud |
| Hide and seek | Find | A scene three screens wide, drawn from the world type's own scenery, with nine hiding places along it: single pieces of scenery, clumps of it, and pools. Five littles hide, each behind a place of its own: the party, and wild littles of any kind to make up the five. Dragging looks left and right; arrows at the edges show where there is more. Each hider shows a part of itself, over the top of its cover, round one side, or out of the water. Tapping that part finds it: it hops out in front and is named. A tap on anything else does nothing. There is no clock. After 20 seconds without a find, the nearest hiding place still in use rustles, and the top says which way it is | Hiding places are spread evenly along the scene with a little jitter, never nearer than 0.15 of a screen to the next. Each hider is set so that at least three tenths of it shows past its cover, and none shares a place. The test checks every scene for that | 3 stardust a find. When all five are found, one wild little (picked by the generator) leaves an egg that hatches its own kind; with the nest full it is 12 stardust instead. The egg is kept as `kinds` on the egg, as a friends' egg is |
| Starweave | Join | Fourteen bright stars mark the outline of one little of the party (picked by the world's seed), its two ear tips included, among dim stars that cannot be touched. Starting on any star, dragging from star to star lays a thread. The thread stretches only to a star within reach, and may not cross itself or visit a star twice; the stars it can reach from where it is are ringed, and a refused star says why (too far, or it would cross). Lifting the finger keeps the thread. Tapping a star already on the thread rubs it back to there, and Start again clears it. A thread with no star left in reach says so. When all fourteen are joined the thread closes and the little appears in the stars. There is no clock | The stars are sampled in order round the little's own body outline. The reach is 1.3 times the longest gap between neighbours, so going round the outline, from any star and either way, is always a thread that can be drawn and never crosses itself, while more than half of all pairs of stars are out of reach. The test checks every sky for that | 12 stardust. The first time for each little its constellation is kept (`sky`: the little's `id`, `kind`, `kind2`, `seed` and `name`, and the sky's seed `ws`) and drawn small and faint over the nest at night, between the balloon and the moon; the journal counts them. Leaving early pays 1 stardust for every three stars joined and keeps nothing |
| Skyglide | Fly | The Glimmerkin glides across the sky for 45 seconds, the party trailing behind. Holding a finger anywhere rises and letting go sinks; the flight starts on the first touch, or after 2.5 seconds. Dewdrops lie along one line through the sky, with four wind rings on it, each worth 3 dewdrops. Brushing a storm cloud bounces the flier away and shakes one dewdrop loose, and the flight goes on. The top and bottom of the sky only stop the flier. A Gale little in the party tows the Glimmerkin on a wisp of cloud; without one it hangs under a balloon. The flight ends on an island | The line never climbs or falls faster than half of what the flier can do, and every storm cloud is at least 0.27 of the sky's height from it. The test flies every sky with a flier that only holds when it is below the line: it must gather at least 95 in 100 of the dewdrops and every ring, and touch no cloud | 5 stardust and 1 more for every four dewdrops. About one island in three holds a chime stone, while the nest has fewer than eight; it goes straight to the nest. Leaving early pays 1 stardust for every four dewdrops |
| Wanderlings | Steer | A board of 6 by 7 tiles with a burrow, a nest, rocks, and up to three tiles that are shut: brambles, a pool or a gap. Five wanderlings leave the burrow one after another and all walk the same way: straight on, turning right when they cannot go on (left if right is shut too, back if both are). Three littles are placed to steer them: the party, and wild littles to make up three. A little is dragged onto a tile, or tapped and then a tile tapped; it cannot stand on a rock, the burrow, the nest or another little. A Cinderkit burns away brambles it stands in, a Puddlefin freezes a pool and a Sproutling bridges a gap; only they may stand there. A Pebblit blocks its tile like a rock. A Zephyrmoth sends them the way it faces, and turns a quarter when tapped. A Lanternbug draws any wanderling that sees it along a clear row or column to its tile, once. A little with two skills uses both, but a Pebblit only blocks. A dotted line shows where they would walk as things stand. Go sends them. If they do not reach the nest nothing is lost: the littles can be moved and Go pressed again, as often as wanted. After two runs that fail, or 40 seconds, a tile glimmers for one little that is not yet in its place | The generator lays a way from burrow to nest, gives each little one job on it (a corner to make, or a shut tile to open), and puts rocks at the other corners. It keeps a board only if its stored answer brings the wanderlings home in at least 8 steps and, in nearly every board (97 in 100), they do not get home with any one little missing. Nothing is ever shut that no little present can open. The test checks every board for that | 15 stardust and an egg of the wanderlings' kind; with the nest full, 12 more stardust instead. Leaving early pays nothing |


| Group | Items | Where they come from |
| --- | --- | --- |
| Tools (single use) | Bridge seed, spark lantern, moon key, scare-bell | Chests (45% hold one), the trader |
| Charms | Ember ring, feather, lucky clover | Worlds (12%), rare portal, the trader |
| Toys | Bouncy ball, music box | Worlds (15%), the trader |
| Decorations | A lantern, banner and wind chime for each world type: 18 in all | That world type (50%), the trader |
| Chime stones | Up to 8; each adds a note to the tune the nest plays, once there are two | Worlds (24%), the trader |
| Starfruit | Leaves a permanent mark | Worlds (22%), the trader |
| Map pieces | Three reveal the rare portal | Worlds (30%), the trader |
| Frostberries | Belly and Joy, no change of colour | December's gifts, the trader in winter |
| Eggs | Hatch a little when rubbed warm; 15% are twins after 3 quests | Worlds, rare portal, the trader |

Special finds are only ever placed where the current party can reach.

**Chime stones** circle above the nest. Once there are two or more, the nest plays a slow tune by itself, about
a note a second (half that while the Glimmerkin sleeps), wandering between the stones' notes; each stone glows
as its note plays. A single stone stays silent. The first time the tune plays, a toast says "Chime stones sing.
Find more and the nest's tune grows." (`j.chimeTold`). Tapping a stone plays its note and says which of the 8 it
is, and, with only one, that one more starts the tune.

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
`pet.form` (the Mythic form), `friends` (quests finished together, by pair of littles), `lwish` (today's little wish), `reg` (the journey: `i` the current region, `n` the quests counted
there, `built` the nest pieces built), `j.regions` (regions beaten), `seen` (unlocks shown), `news` (the last news
version shown), `today` (today's world: `day`, `done`), `j.days` (days today's world was finished), `advent` (December's gifts:
`y`, `got`), `j.gifts` (gifts opened), `j.frost` (frostberries eaten), and on an egg `kinds` and `from`
(a friends' egg) with `j.feggs` (friends' eggs laid), `j.rules` (visits made while a world's rule applied, by world type) and `j.bonus`
(visits to each bonus world), `sky` (constellations kept from Starweave), and for nest play (4.3.1) `spot` with `j.spots` and `j.spotKinds`, `j.catchBest`, `pet.tricks`, `muck` on a little, `keeps`, `offer`, `j.tower`, `dream`, `j.copyBest` and `pics`.

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
to sign in or to the account page, and has a "Keep a copy" button. Those are the game's only new controls for
accounts. The same sheet's "What's new" button belongs to the game (4.4.3).

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
