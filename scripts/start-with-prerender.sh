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

echo "[startup] starting application server on port $app_port"
NODE_ENV=production PORT="$app_port" node --import ./dist/instrument.cjs dist/index.cjs &
server_pid=$!

echo "[startup] generating and validating crawler snapshots"
PRERENDER_SKIP_SPAWN=1 \
PRERENDER_BASE_URL="http://localhost:$app_port" \
npm run prerender
prerender_status=$?

if [ "$prerender_status" -ne 0 ]; then
  echo "[startup] prerender failed with exit code $prerender_status; refusing to keep the service online" >&2
  stop_server
  exit "$prerender_status"
fi

if ! kill -0 "$server_pid" 2>/dev/null; then
  echo "[startup] application server exited during prerender" >&2
  wait "$server_pid"
  exit $?
fi

echo "[startup] prerender complete and validated; service is ready"
wait "$server_pid"
server_status=$?
server_pid=""
exit "$server_status"
