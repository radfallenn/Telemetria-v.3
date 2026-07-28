#!/bin/sh
set -eu

cd "$(dirname "$0")"

if docker info >/dev/null 2>&1; then
  DOCKER="docker"
elif command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
else
  echo "ERRO: Docker não está disponível." >&2
  exit 1
fi

# Remove apenas Bridges antigas conhecidas para liberar o protocolo GT7.
for container in telemetria-v3-bridge telemetria-bridge gt7-bridge gt7-telemetria-bridge telemetria-bridge-8789; do
  $DOCKER rm -f "$container" >/dev/null 2>&1 || true
done

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

if command -v ss >/dev/null 2>&1 && ss -lun | grep -Eq '(^|[[:space:]])[^[:space:]]*:33740[[:space:]]'; then
  echo "ERRO: a porta do protocolo GT7 ainda está ocupada no Raspberry." >&2
  echo "Execute: sudo ss -lunp | grep 33740" >&2
  exit 1
fi

cat > compose.yml <<'YAML'
services:
  telemetria-bridge-8789:
    image: node:22-alpine
    container_name: telemetria-bridge-8789
    working_dir: /app
    network_mode: host
    restart: unless-stopped
    stop_grace_period: 5s
    environment:
      HTTP_PORT: "8789"
      UDP_RECEIVE_PORT: "33740"
      PS5_HEARTBEAT_PORT: "33739"
      PS5_IP: "192.168.1.81"
      CONFIG_FILE: "/app/config.json"
      DATA_DIR: "/app/data"
    volumes:
      - ./:/app
    command: ["node", "server.js"]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8789/api/health').then(async r=>{const j=await r.json();if(!r.ok||!j.ok||!j.udpBound||j.httpPort!==8789)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 4s
      retries: 3
      start_period: 5s
YAML

$DOCKER compose -f compose.yml up -d --force-recreate --remove-orphans

attempt=1
while [ "$attempt" -le 20 ]; do
  if $DOCKER exec telemetria-bridge-8789 node -e "fetch('http://127.0.0.1:8789/api/health').then(async r=>{const j=await r.json();if(!r.ok||!j.ok||!j.udpBound||j.httpPort!==8789||j.heartbeatByte!=='A')process.exit(1);console.log(JSON.stringify(j))}).catch(()=>process.exit(1))"; then
    echo "NOVA BRIDGE INSTALADA COM SUCESSO"
    echo "App: http://192.168.1.70:8789"
    echo "PS5: 192.168.1.81"
    echo "Status: http://192.168.1.70:8789/api/health"
    $DOCKER logs --tail 30 telemetria-bridge-8789 || true
    exit 0
  fi
  sleep 1
  attempt=$((attempt + 1))
done

echo "ERRO: a nova Bridge 8789 não ficou saudável." >&2
$DOCKER logs --tail 120 telemetria-bridge-8789 >&2 || true
exit 1
