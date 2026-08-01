'use strict';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'gt7_telemetria_next_network_v1';
const DEFAULTS = { bridgeUrl: 'http://192.168.1.70:8790', ps5Ip: '192.168.1.81' };

let settings = loadSettings();
let pollTimer = null;
let lastBridgeAt = 0;
let maxSpeed = 0;
let sessionStartAt = null;
let telemetryActive = false;
let lastPayload = null;

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}

function text(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function formatLap(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value) || value <= 0) return '--:--.---';
  const minutes = Math.floor(value / 60000);
  const seconds = Math.floor((value % 60000) / 1000);
  const millis = Math.floor(value % 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '--';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function buildGauge() {
  const outer = $('outerRing');
  const inner = $('rpmRing');
  const outerCount = 48;
  const innerCount = 36;

  outer.innerHTML = Array.from({ length: outerCount }, (_, index) => {
    const angle = -132 + (264 * index / (outerCount - 1));
    return `<i class="outer-tick" style="--angle:${angle}deg"></i>`;
  }).join('');

  inner.innerHTML = Array.from({ length: innerCount }, (_, index) => {
    const angle = -130 + (260 * index / (innerCount - 1));
    const major = index % 5 === 0 ? ' major' : '';
    const hot = index >= innerCount - 7 ? ' hot' : '';
    return `<i class="rpm-tick${major}${hot}" style="--angle:${angle}deg"></i>`;
  }).join('');
}

function buildFuelSegments() {
  $('fuelSegments').innerHTML = Array.from({ length: 12 }, () => '<i></i>').join('');
}

function renderRpm(rpm, limit) {
  const safeLimit = Math.max(1000, Number(limit) || 10000);
  const ratio = clamp(Number(rpm) / safeLimit, 0, 1);
  const innerTicks = [...document.querySelectorAll('.rpm-tick')];
  const outerTicks = [...document.querySelectorAll('.outer-tick')];
  const innerActive = Math.round(ratio * innerTicks.length);
  const outerActive = Math.round(ratio * outerTicks.length);

  innerTicks.forEach((tick, index) => tick.classList.toggle('active', index < innerActive));
  outerTicks.forEach((tick, index) => tick.classList.toggle('active', index < outerActive));
}

function renderFuel(value) {
  const number = Number(value);
  const hasFuel = Number.isFinite(number);
  const percentage = hasFuel ? clamp(number) : 0;
  const activeCount = Math.round(percentage / 100 * 12);

  [...$('fuelSegments').children].forEach((segment, index) => {
    segment.classList.toggle('active', hasFuel && index < activeCount);
    segment.classList.toggle('low', hasFuel && percentage <= 20);
  });
}

function renderTyre(id, value) {
  const number = Number(value);
  text(id, Number.isFinite(number) ? `${Math.round(number)}°` : '--°');
}

function normalize(payload) {
  const root = payload?.state || payload || {};
  const data = root.telemetry || payload?.telemetry || {};
  const tyres = data.tyres || data.tyreTemp || data.advanced?.tyreTemp || {};

  return {
    bridgeOnline: Boolean(root.ok ?? true),
    telemetryReceiving: Boolean(root.telemetryReceiving ?? data.connected),
    udpBound: Boolean(root.udpBound),
    bridgeName: root.bridge?.name || root.name || 'GT7 Bridge Next',
    bridgeVersion: root.bridge?.version || root.version || '',
    speed: Number(data.speedKmh ?? data.speed ?? 0),
    rpm: Number(data.rpm ?? 0),
    rpmLimit: Number(data.rpmLimit ?? data.maxRpm ?? 10000),
    gear: data.gear ?? 'N',
    throttle: Number(data.throttlePct ?? data.throttle ?? 0),
    brake: Number(data.brakePct ?? data.brake ?? 0),
    fuel: data.fuelPct,
    lapNumber: Number(data.lapNumber ?? 0),
    totalLaps: Number(data.totalLaps ?? 0),
    bestLapMs: Number(data.bestLapMs ?? 0),
    lastLapMs: Number(data.lastLapMs ?? 0),
    packetRate: Number(root.packetRate ?? data.packetRate ?? 0),
    rawPacketRate: Number(root.rawPacketRate ?? 0),
    decodeErrors: Number(root.decodeErrors ?? 0),
    tyres,
    ps5Ip: root.config?.ps5Ip || root.ps5Ip || settings.ps5Ip,
    diagnostics: root.diagnostics || {},
    updatedAt: root.updatedAt || new Date().toISOString()
  };
}

function setBridgeConnection(online, latency = null) {
  $('statusDot').classList.toggle('online', Boolean(online));
  text('connectionStatus', online ? 'BRIDGE' : 'OFF');
  text('latency', Number.isFinite(latency) ? `${Math.round(latency)} ms` : '-- ms');
}

function updateSessionClock() {
  const value = sessionStartAt ? formatDuration(Date.now() - sessionStartAt) : '--';
  text('totalTime', value);
  text('totalTimePage', value);
}

function render(payload, latency = null) {
  const data = normalize(payload);
  lastPayload = payload;
  lastBridgeAt = Date.now();
  telemetryActive = data.telemetryReceiving;

  if (telemetryActive && !sessionStartAt) sessionStartAt = Date.now();
  maxSpeed = Math.max(maxSpeed, data.speed || 0);

  const speed = Math.round(clamp(data.speed, 0, 700));
  const rpm = Math.round(clamp(data.rpm, 0, 25000));
  const throttle = Math.round(clamp(data.throttle));
  const brake = Math.round(clamp(data.brake));
  const fuelText = Number.isFinite(Number(data.fuel)) ? `${Math.round(clamp(data.fuel))}%` : '--%';
  const best = formatLap(data.bestLapMs);
  const last = formatLap(data.lastLapMs);
  const validLaps = Math.max(0, data.lapNumber > 0 ? data.lapNumber - 1 : 0);

  text('speed', speed);
  text('gear', String(data.gear || 'N'));
  text('rpm', rpm);
  text('rpmCard', rpm);
  text('throttle', `${throttle}%`);
  text('brake', `${brake}%`);
  $('throttleBar').style.width = `${throttle}%`;
  $('brakeBar').style.width = `${brake}%`;
  text('fuel', fuelText);
  text('bestLap', best);
  text('bestLapPage', best);
  text('lastLap', last);
  text('lastLapPage', last);
  text('validLaps', validLaps);
  text('lapNumber', `${Math.max(0, data.lapNumber)} / ${Math.max(0, data.totalLaps)}`);
  text('maxSpeed', Math.round(maxSpeed));
  text('maxSpeedPage', Math.round(maxSpeed));
  text('packetRate', `${Math.max(0, Math.round(data.packetRate))}/s`);
  text('bridgeVersion', data.bridgeVersion ? `v${data.bridgeVersion}` : '--');
  text('sessionStatus', telemetryActive ? 'EM PISTA' : 'AGUARDANDO');

  renderRpm(rpm, data.rpmLimit);
  renderFuel(data.fuel);
  renderTyre('tyreFL', data.tyres.FL ?? data.tyres.fl);
  renderTyre('tyreFR', data.tyres.FR ?? data.tyres.fr);
  renderTyre('tyreRL', data.tyres.RL ?? data.tyres.rl);
  renderTyre('tyreRR', data.tyres.RR ?? data.tyres.rr);
  updateSessionClock();

  const udpText = data.udpBound ? 'UDP ATIVO' : 'UDP INATIVO';
  const versionText = data.bridgeVersion ? ` v${data.bridgeVersion}` : '';
  text('bridgeLabel', `${data.bridgeName}${versionText} · ${udpText}`);

  if (!data.udpBound) {
    text('footerState', 'Bridge conectada, mas a porta UDP 33740 está inativa');
  } else if (data.telemetryReceiving) {
    text('footerState', `Recebendo GT7 de ${data.ps5Ip}`);
  } else if (data.rawPacketRate > 0 && data.packetRate === 0) {
    text('footerState', `Pacotes recebidos, mas não decodificados · erros ${data.decodeErrors}`);
  } else {
    text('footerState', `Bridge conectada · aguardando GT7 de ${data.ps5Ip}`);
  }

  text('updatedAt', new Date(data.updatedAt).toLocaleTimeString('pt-BR'));
  $('rawTelemetry').textContent = JSON.stringify({
    bridge: `${data.bridgeName}${versionText}`,
    udpBound: data.udpBound,
    telemetryReceiving: data.telemetryReceiving,
    packetRate: data.packetRate,
    rawPacketRate: data.rawPacketRate,
    decodeErrors: data.decodeErrors,
    ps5Ip: data.ps5Ip,
    telemetry: payload?.telemetry || payload?.state?.telemetry || null,
    diagnostics: data.diagnostics
  }, null, 2);

  setBridgeConnection(true, latency);
}

function httpBase() {
  return String(settings.bridgeUrl || DEFAULTS.bridgeUrl).trim().replace(/\/$/, '');
}

function markBridgeOffline() {
  setBridgeConnection(false);
  text('bridgeLabel', `Sem resposta em ${httpBase()}`);
  text('footerState', 'Abra SET e teste a Bridge no Raspberry');
  text('sessionStatus', 'SEM BRIDGE');
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

async function pollBridge() {
  const started = performance.now();
  try {
    const response = await fetch(`${httpBase()}/api/state`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json(), performance.now() - started);
  } catch {
    if (Date.now() - lastBridgeAt > 2500) markBridgeOffline();
  }
}

function connect() {
  stopPolling();
  text('bridgeLabel', `Conectando em ${httpBase()}...`);
  pollBridge();
  pollTimer = setInterval(pollBridge, 700);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function healthSummary(body, latency) {
  const udp = body.udpBound ? 'UDP ativo' : 'UDP inativo';
  const gt7 = body.telemetryReceiving ? `GT7 ${body.packetRate || 0}/s` : 'GT7 sem dados';
  const raw = body.rawPacketRate > 0 ? `brutos ${body.rawPacketRate}/s` : 'sem pacotes brutos';
  return `Bridge v${body.version || '?'} em ${Math.round(latency)} ms · ${udp} · ${gt7} · ${raw} · PS5 ${body.ps5Ip || settings.ps5Ip}.`;
}

async function testConnection() {
  const result = $('settingsResult');
  result.textContent = 'Testando HTTP, UDP e recepção do GT7...';
  const started = performance.now();
  try {
    const base = String($('bridgeUrl').value || '').trim().replace(/\/$/, '');
    const response = await fetchWithTimeout(`${base}/api/health`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
    result.textContent = healthSummary(body, performance.now() - started);
    if (body.ps5Ip) $('ps5Ip').value = body.ps5Ip;
  } catch (error) {
    const message = error.name === 'AbortError' ? 'tempo esgotado' : error.message;
    result.textContent = `Bridge não encontrada: ${message}. Confirme o IP do Raspberry e a porta 8790.`;
  }
}

async function restartBridge() {
  const result = $('settingsResult');
  result.textContent = 'Reiniciando a recepção UDP...';
  try {
    const base = String($('bridgeUrl').value || '').trim().replace(/\/$/, '');
    const response = await fetchWithTimeout(`${base}/api/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }, 4000);
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
    result.textContent = `UDP reiniciado. Porta 33740: ${body.state?.udpBound ? 'ativa' : 'inativa'}.`;
    connect();
  } catch (error) {
    result.textContent = `Falha ao reiniciar UDP: ${error.message}`;
  }
}

async function saveAndConnect() {
  settings = {
    bridgeUrl: String($('bridgeUrl').value || DEFAULTS.bridgeUrl).trim().replace(/\/$/, ''),
    ps5Ip: String($('ps5Ip').value || DEFAULTS.ps5Ip).trim()
  };
  saveSettings();
  maxSpeed = 0;
  sessionStartAt = null;
  connect();

  const result = $('settingsResult');
  result.textContent = 'URL salva. Enviando o IP do PS5 para a Bridge...';
  try {
    const response = await fetchWithTimeout(`${httpBase()}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ps5Ip: settings.ps5Ip })
    });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
    result.textContent = 'Configuração salva na Bridge.';
    setTimeout(closeSettings, 500);
  } catch (error) {
    result.textContent = `URL salva no APK, mas a Bridge não respondeu: ${error.message}`;
  }
}

function openSettings() {
  $('bridgeUrl').value = settings.bridgeUrl;
  $('ps5Ip').value = settings.ps5Ip;
  $('settingsModal').classList.add('open');
  $('settingsModal').setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  $('settingsModal').classList.remove('open');
  $('settingsModal').setAttribute('aria-hidden', 'true');
}

function showPage(pageId, button) {
  document.querySelectorAll('.page').forEach((page) => page.classList.toggle('active', page.id === pageId));
  document.querySelectorAll('.bottom-nav button').forEach((item) => item.classList.toggle('active', item === button));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.bottom-nav button[data-page]').forEach((button) => {
  button.addEventListener('click', () => showPage(button.dataset.page, button));
});

$('openSettings').addEventListener('click', openSettings);
$('navSettings').addEventListener('click', openSettings);
$('closeSettings').addEventListener('click', closeSettings);
$('settingsModal').addEventListener('click', (event) => {
  if (event.target === $('settingsModal')) closeSettings();
});
$('testConnection').addEventListener('click', testConnection);
$('restartBridge').addEventListener('click', restartBridge);
$('saveConnection').addEventListener('click', saveAndConnect);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) connect();
});

buildGauge();
buildFuelSegments();
renderRpm(0, 10000);
renderFuel(null);
updateSessionClock();
setInterval(updateSessionClock, 1000);
connect();
