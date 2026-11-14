#!/bin/sh
# Concatenate the source parts into one self-contained page.
set -e
cd "$(dirname "$0")"
mkdir -p dist
{ cat src/head.html; sed '/^if (typeof module/d' src/core.js; cat src/draw.js src/game.js src/things.js src/wardrobe.js src/home.js src/play.js src/wishes.js src/intro.js src/days.js src/journey.js src/family.js src/quest.js src/rules.js src/bonus.js src/starfall.js src/garden.js src/hide.js src/starweave.js src/skyglide.js src/wander.js src/grounds.js src/gardenplay.js src/visitors.js src/burrow.js src/adventure.js src/homescreen.js src/boot.js; } > dist/index.html
cp src/sw.js dist/sw.js   # the offline copy: served beside the page, not part of it
wc -c dist/index.html
