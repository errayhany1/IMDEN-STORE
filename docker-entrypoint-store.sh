#!/bin/sh
set -eu
# Local tracking API (Tifawt order lookup) — same container as nginx.
# Always proxy /bot-api to the colocated process, even if EasyPanel still has
# a stale BOT_UPSTREAM pointing at the separate imden-bot service.
export TRACKING_PORT="${TRACKING_PORT:-3001}"
export PORT="$TRACKING_PORT"
export BOT_UPSTREAM="127.0.0.1:${TRACKING_PORT}"

node /tracking/trackingServer.js &
TRACK_PID=$!

nginx -g 'daemon off;' &
NGINX_PID=$!

term() {
  kill -TERM "$TRACK_PID" "$NGINX_PID" 2>/dev/null || true
  wait "$TRACK_PID" "$NGINX_PID" 2>/dev/null || true
}
trap term TERM INT

# If either child exits, shut everything down so the orchestrator restarts us.
while true; do
  if ! kill -0 "$TRACK_PID" 2>/dev/null; then
    echo "tracking process exited" >&2
    term
    exit 1
  fi
  if ! kill -0 "$NGINX_PID" 2>/dev/null; then
    echo "nginx process exited" >&2
    term
    exit 1
  fi
  sleep 2
done
