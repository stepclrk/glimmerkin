#!/bin/sh
# Creates .env, or completes one that is already there. Values you have set are never changed:
# only missing ones are added. Safe to run again after every update.
set -e
cd "$(dirname "$0")"

[ -f .env ] || { cp .env.example .env; echo "Created .env"; }

random() { head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

# has KEY: true when .env gives KEY a value.
has() { grep -Eq "^$1=.+" .env; }

# fill KEY VALUE: gives KEY a value if it has none, replacing an empty "KEY=" line or adding a new one.
fill() {
  if has "$1"; then return; fi
  if grep -q "^$1=" .env; then
    tmp=$(mktemp) && sed "s|^$1=.*|$1=$2|" .env > "$tmp" && cat "$tmp" > .env && rm -f "$tmp"
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
  echo "Added $1 to .env"
}

fill BIND_ADDRESS 0.0.0.0
fill POSTGRES_PASSWORD "$(random)"

chmod 600 .env
echo ".env is ready. Next: docker compose up -d --build"
