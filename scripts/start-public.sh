#!/usr/bin/env bash
# Starts the game server in the background and exposes it with a Cloudflare quick tunnel.
# Requires `cloudflared` on PATH (or at ~/bin/cloudflared). The trycloudflare URL changes on every restart.
set -e
cd "$(dirname "$0")/.."
mkdir -p logs
PORT=${PORT:-8080}
pgrep -f "node server.js" >/dev/null || PORT=$PORT nohup node server.js > logs/server.log 2>&1 &
CF=$(command -v cloudflared || echo ~/bin/cloudflared)
nohup "$CF" tunnel --no-autoupdate --protocol http2 --url http://localhost:$PORT > logs/tunnel.log 2>&1 &
for i in $(seq 1 30); do sleep 1; U=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' logs/tunnel.log | head -1); [ -n "$U" ] && break; done
echo "$U" | tee logs/tunnel-url.txt
