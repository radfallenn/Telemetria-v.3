#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SOURCE_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale o CasaOS ou Docker antes de continuar."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Docker Compose não encontrado."
  exit 1
fi

mkdir -p data
"${COMPOSE[@]}" down --remove-orphans || true
"${COMPOSE[@]}" up -d --build

for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8790/api/health >/tmp/gt7-next-health.json 2>/dev/null; then
    echo
    cat /tmp/gt7-next-health.json
    echo
    echo "Bridge Next instalada e respondendo na porta 8790."
    exit 0
  fi
  sleep 1
done

"${COMPOSE[@]}" logs --tail=100
exit 1
