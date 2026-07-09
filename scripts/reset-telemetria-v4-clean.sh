#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/telemetria-v3}"
PORT="${PORT:-8788}"
PS5_IP="${PS5_IP:-192.168.1.71}"
SERVICE="gt7-telemetria-v4.service"

cd "$APP_DIR"

echo "== GT7 Telemetria V4 Clean =="
echo "Projeto: $APP_DIR"
echo "Porta HTTP: $PORT"
echo "PS5 IP: $PS5_IP"

echo "== Parando testes/versões misturadas =="
pkill -f "gt7-teste" 2>/dev/null || true
pkill -f "server.js" 2>/dev/null || true
pkill -f "TESTE-DINAMICO" 2>/dev/null || true
sudo systemctl stop "$SERVICE" 2>/dev/null || true
sudo systemctl disable "$SERVICE" 2>/dev/null || true
sudo rm -f "/etc/systemd/system/$SERVICE"
sudo systemctl daemon-reload

echo "== Gravando .env oficial V4 =="
cat > .env <<EOF
PORT=$PORT
PS5_IP=$PS5_IP
GT7_UDP_PORT=33740
GT7_HEARTBEAT_PORT=33739
GT7_PACKET_VERSION=A
GT7_DRIVER=Sergio
NODE_ENV=production
EOF

echo "== Instalando dependências =="
npm install --no-audit --no-fund

echo "== Criando serviço limpo =="
sudo tee "/etc/systemd/system/$SERVICE" >/dev/null <<EOF
[Unit]
Description=GT7 Telemetria V4 Clean Bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/env node bridge/server.cjs
Restart=always
RestartSec=3
User=$USER

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE"
sudo systemctl restart "$SERVICE"

echo "== Status =="
sudo systemctl status "$SERVICE" --no-pager || true

echo "== Testes =="
curl -s "http://localhost:$PORT/api/health" || true
echo
curl -s "http://localhost:$PORT/api/live" || true
echo

echo "OK: V4 limpa configurada. Use no APK: http://IP_DO_RASPBERRY:$PORT"
