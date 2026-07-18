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
    environment:
      PS5_IP: "192.168.1.81"
    volumes:
      - ./:/app
    command: sh -c "node patch-single-socket.js && node server.js"
EOF
sudo docker compose -f compose.yml up -d --force-recreate
