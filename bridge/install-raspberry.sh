#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ ! -f .env ]; then cp .env.example .env; fi
npm install --no-audit --no-fund
sudo tee /etc/systemd/system/gt7-telemetria-v4.service >/dev/null <<SERVICE
[Unit]
Description=GT7 Telemetria V4 Bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT
EnvironmentFile=$ROOT/.env
ExecStart=/usr/bin/env node bridge/server.cjs
Restart=always
RestartSec=3
User=$USER

[Install]
WantedBy=multi-user.target
SERVICE
sudo systemctl daemon-reload
sudo systemctl enable gt7-telemetria-v4.service
sudo systemctl restart gt7-telemetria-v4.service
sudo systemctl status gt7-telemetria-v4.service --no-pager
