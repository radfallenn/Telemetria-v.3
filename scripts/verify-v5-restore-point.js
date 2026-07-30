'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failures = 0;

function file(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    console.error(`FALHA: arquivo ausente: ${relativePath}`);
    failures += 1;
    return '';
  }
  const content = fs.readFileSync(absolute, 'utf8');
  if (!content.trim()) {
    console.error(`FALHA: arquivo vazio: ${relativePath}`);
    failures += 1;
  } else {
    console.log(`OK: arquivo: ${relativePath}`);
  }
  return content;
}

function requireToken(content, token, label) {
  if (!content.includes(token)) {
    console.error(`FALHA: ${label}`);
    failures += 1;
  } else {
    console.log(`OK: ${label}`);
  }
}

const index = file('telemetria-next/app/www/index.html');
const app = file('telemetria-next/app/www/app.js');
const lapTotal = file('telemetria-next/app/www/v5-lap-total.js');
const rpmHeatmap = file('telemetria-next/app/www/rpm-heatmap.css');
const cardLayoutCss = file('telemetria-next/app/www/card-layout.css');
const cardLayoutJs = file('telemetria-next/app/www/card-layout.js');
const fuelHeatmapCss = file('telemetria-next/app/www/fuel-heatmap.css');
const fuelHeatmapJs = file('telemetria-next/app/www/fuel-heatmap.js');
const styles = file('telemetria-next/app/www/styles.css');
const bridge = file('telemetria-next/bridge/src/server.js');
const protocol = file('telemetria-next/bridge/src/protocol.js');
const compose = file('telemetria-next/bridge/docker-compose.yml');
const workflow = file('.github/workflows/build-v5-next.yml');

for (const asset of [
  'styles.css',
  'fuel-heatmap.css',
  'rpm-heatmap.css',
  'card-layout.css',
  'app.js',
  'v5-lap-total.js',
  'card-layout.js',
  'fuel-heatmap.js'
]) {
  requireToken(index, asset, `index carrega ${asset}`);
}

for (const id of [
  'bridgeUrl',
  'ps5Ip',
  'testConnection',
  'restartBridge',
  'saveConnection',
  'totalTime',
  'totalTimePage',
  'validLaps'
]) {
  requireToken(index, `id="${id}"`, `elemento obrigatório: ${id}`);
}

requireToken(app, "http://192.168.1.70:8790", 'Bridge padrão usa porta 8790');
requireToken(app, '/api/state', 'app lê estado da Bridge');
requireToken(app, '/api/health', 'app testa saúde da Bridge');
requireToken(app, '/api/config', 'app envia IP do PS5');
requireToken(app, '/api/restart', 'app reinicia recepção UDP');
requireToken(app, 'gt7_telemetria_next_network_v1', 'configuração de rede persistente');

requireToken(lapTotal, 'session.validLapTimes.reduce', 'Tempo Total soma voltas válidas');
requireToken(lapTotal, 'MIN_VALID_LAP_MS = 30_000', 'limite mínimo de volta válida');
requireToken(lapTotal, 'MAX_VALID_LAP_MS = 900_000', 'limite máximo de volta válida');
requireToken(lapTotal, 'value.valid === false', 'voltas explicitamente inválidas são excluídas');
requireToken(lapTotal, 'gt7_v5_valid_laps_v2', 'voltas válidas persistidas');

requireToken(rpmHeatmap, '.outer-ring', 'anel externo controlado pelo heatmap');
requireToken(rpmHeatmap, '.speed-title', 'título central removido');
requireToken(rpmHeatmap, 'nth-child(n+31)', 'faixa vermelha do RPM');
requireToken(rpmHeatmap, '--rpm-heat', 'cores progressivas do RPM');

requireToken(cardLayoutJs, 'gt7_v5_card_layout_v1', 'layout dos cartões persistente');
for (const direction of ['up', 'left', 'right', 'down']) {
  requireToken(cardLayoutJs, `data-layout-move="${direction}"`, `controle de movimento: ${direction}`);
}
requireToken(cardLayoutJs, "CARD_SELECTOR = '.page .data-card'", 'controles instalados em todas as abas');
requireToken(cardLayoutCss, '.card-layout-controls', 'estilo dos controles de movimento');

requireToken(fuelHeatmapCss, 'fuel-cell-alert', 'alerta visual do combustível');
requireToken(fuelHeatmapJs, 'SEGMENT_COUNT', 'segmentos do combustível ativos');
requireToken(styles, '.bottom-nav', 'navegação inferior preservada');

requireToken(bridge, "HTTP_PORT || 8790", 'Bridge HTTP na porta 8790');
requireToken(bridge, "UDP_RECEIVE_PORT || 33740", 'recepção GT7 na porta 33740');
requireToken(bridge, "PS5_HEARTBEAT_PORT || 33739", 'heartbeat GT7 na porta 33739');
requireToken(bridge, "Buffer.from('A', 'ascii')", 'heartbeat A preservado');
requireToken(bridge, "url.pathname === '/api/state'", 'endpoint de estado preservado');
requireToken(bridge, "url.pathname === '/api/config'", 'endpoint de configuração preservado');
requireToken(bridge, "url.pathname === '/api/restart'", 'endpoint de reinício preservado');
requireToken(protocol, 'decodeEncryptedPacket', 'decodificador GT7 preservado');
requireToken(compose, 'network_mode: host', 'Docker usa rede host');

requireToken(workflow, 'telemetria-v5', 'workflow acompanha branch V5');
requireToken(workflow, 'GT7-Telemetria-V5.3-Layout-Movel-Heatmap', 'artifact APK V5.3 correto');
requireToken(workflow, 'GT7-Bridge-V5.3-CasaOS', 'artifact Bridge V5.3 correto');

if (failures) {
  console.error(`\nV5 RESTORE POINT FALHOU: ${failures} problema(s).`);
  process.exit(1);
}

console.log('\nV5 RESTORE POINT OK');
