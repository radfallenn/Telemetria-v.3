#!/bin/sh
set -eu

cd "$(dirname "$0")"

if docker info >/dev/null 2>&1; then
  DOCKER="docker"
elif command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
else
  echo "ERRO: Docker não está disponível para o usuário atual." >&2
  exit 1
fi

mkdir -p data
if [ ! -f config.json ]; then
  cat > config.json <<'JSON'
{
  "ps5Ip": "192.168.1.81",
  "heartbeatIntervalMs": 1000,
  "autoSession": true
}
JSON
fi

cat > compose.yml <<'YAML'
services:
  telemetria-v3-bridge:
    image: node:22-alpine
    container_name: telemetria-v3-bridge
    working_dir: /app
    network_mode: host
    restart: unless-stopped
    stop_grace_period: 5s
    environment:
      PS5_IP: "192.168.1.81"
      HTTP_PORT: "8788"
      UDP_LISTEN_PORT: "33740"
      PS5_HEARTBEAT_PORT: "33739"
      BRIDGE_CONFIG_FILE: "/app/config.json"
      BRIDGE_DATA_DIR: "/app/data"
    volumes:
      - ./:/app
    command: ["node", "server.js"]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8788/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 4s
      retries: 3
      start_period: 5s
YAML

$DOCKER compose -f compose.yml up -d --force-recreate --remove-orphans

healthy=0
attempt=1
while [ "$attempt" -le 15 ]; do
  if $DOCKER exec telemetria-v3-bridge node -e "fetch('http://127.0.0.1:8788/api/health').then(async r=>{const j=await r.json();if(!r.ok||!j.ok||!j.udpBound||j.heartbeatByte!=='A'||j.sameSocket!==true)process.exit(1);console.log(JSON.stringify(j))}).catch(()=>process.exit(1))"; then
    healthy=1
    break
  fi
  sleep 1
  attempt=$((attempt + 1))
done

if [ "$healthy" -ne 1 ]; then
  echo "ERRO: a Bridge não ficou saudável." >&2
  $DOCKER logs --tail 120 telemetria-v3-bridge >&2 || true
  exit 1
fi

echo "Bridge GT7 instalada e ativa."
echo "HTTP: http://192.168.1.70:8788"
echo "PS5: 192.168.1.81"
echo "Heartbeat: A -> UDP 33739"
echo "Recepção: mesmo socket UDP 33740"
$DOCKER logs --tail 30 telemetria-v3-bridge || true
