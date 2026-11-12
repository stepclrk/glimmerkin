#!/bin/sh
# Concatenate the source parts into one self-contained page.
set -e
cd "$(dirname "$0")"
mkdir -p dist
{ cat src/head.html; sed '/^if (typeof module/d' src/core.js; cat src/draw.js src/game.js src/things.js src/home.js src/wishes.js src/journey.js src/quest.js src/rules.js src/boot.js; } > dist/index.html
wc -c dist/index.html
