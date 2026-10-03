#!/bin/sh

set -u

app_port="${PORT:-5000}"
server_pid=""

stop_server() {
  if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
}

handle_signal() {
  echo "[startup] termination requested; stopping server"
  stop_server
  exit 143
}

trap handle_signal INT TERM HUP

# Copy the previous deploy's snapshots before the server starts, so this instance
# never serves crawlers the empty app shell while its own prerender runs below.
# Best-effort and time-boxed; the server starts regardless.
echo "[startup] seeding crawler snapshots from the previous deploy"
timeout 120 npx tsx scripts/seed-snapshots.ts || echo "[startup] snapshot seeding skipped"

echo "[startup] starting application server on port $app_port"
NODE_ENV=production PORT="$app_port" node --import ./dist/instrument.cjs dist/index.cjs &
server_pid=$!

echo "[startup] generating and validating crawler snapshots"
PRERENDER_SKIP_SPAWN=1 \
PRERENDER_BASE_URL="http://localhost:$app_port" \
npm run prerender
prerender_status=$?

if [ "$prerender_status" -ne 0 ]; then
  # Pages that failed to render fresh keep the snapshot copied from the previous
  # deploy (or fall back to the app shell). Taking the whole site down over one
  # page would be worse, and on Render a failing startup becomes a restart loop.
  echo "[startup] WARNING: prerender exited with code $prerender_status (see [fail]/[keep] lines above); keeping the service online" >&2
fi

if ! kill -0 "$server_pid" 2>/dev/null; then
  echo "[startup] application server exited during prerender" >&2
  wait "$server_pid"
  exit $?
fi

if [ "$prerender_status" -eq 0 ]; then
  echo "[startup] prerender complete and validated; service is ready"
else
  echo "[startup] service is ready (some pages are using copied or shell HTML until the next deploy)"
fi
wait "$server_pid"
server_status=$?
server_pid=""
exit "$server_status"
