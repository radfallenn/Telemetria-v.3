#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/gt7-telemetria-next}"
SERVICE_NAME="gt7-telemetria-next"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_USER="${SUDO_USER:-$USER}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute com sudo: sudo bash install.sh"
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 20 ou superior e npm são obrigatórios."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  echo "Node.js 20 ou superior é obrigatório. Versão atual: $(node -v)"
  exit 1
fi

install -d -m 0755 "${APP_DIR}"
install -d -m 0755 "${APP_DIR}/data"
cp -R "${SOURCE_DIR}/package.json" "${APP_DIR}/"
rm -rf "${APP_DIR}/src"
cp -R "${SOURCE_DIR}/src" "${APP_DIR}/src"

cd "${APP_DIR}"
npm install --omit=dev --no-audit --no-fund
chown -R "${RUN_USER}:${RUN_USER}" "${APP_DIR}"

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<SERVICE
[Unit]
Description=GT7 Telemetria Next Bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=HTTP_PORT=8790
Environment=UDP_RECEIVE_PORT=33740
Environment=PS5_HEARTBEAT_PORT=33739
Environment=DATA_DIR=${APP_DIR}/data
ExecStart=/usr/bin/env node ${APP_DIR}/src/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"
systemctl --no-pager --full status "${SERVICE_NAME}.service" || true

echo
echo "Bridge Next instalada em ${APP_DIR}."
echo "Abra no navegador: http://IP_DO_RASPBERRY:8790/api/health"
