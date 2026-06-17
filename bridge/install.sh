#!/bin/sh
set -e
cd "$(dirname "$0")"
cat > compose.yml <<'EOF'
services:
  telemetria-v3-bridge:
    image: node:20-alpine
    container_name: telemetria-v3-bridge
    working_dir: /app
    network_mode: host
    restart: unless-stopped
    volumes:
      - ./:/app
    command: node server.js
EOF
sudo docker compose -f compose.yml up -d
