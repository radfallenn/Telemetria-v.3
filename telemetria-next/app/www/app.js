'use strict';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'gt7_telemetria_next_network_v1';
const DEFAULTS = { bridgeUrl: 'http://192.168.1.70:8790', ps5Ip: '192.168.1.81' };

let settings = loadSettings();
let socket = null;
let reconnectTimer = null;
let pollTimer = null;
let lastMessageAt = 0;
let maxSpeed = 0;

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
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

function renderRpm(rpm, limit) {
  const safeLimit = Math.max(1000, Number(limit) || 9000);
  const active = Math.round(clamp(rpm, 0, safeLimit) / safeLimit * 24);
  $('rpmSegments').innerHTML = Array.from({ length: 24 }, (_, index) => {
    const classes = [index < active ? 'on' : '', index >= 15 ? 'mid' : '', index >= 21 ? 'hot' : ''].filter(Boolean).join(' ');
    return `<i class="${classes}"></i>`;
  }).join('');
  text('rpmLimit', Math.round(safeLimit));
}

function renderTyre(id, value) {
  const number = Number(value);
  text(id, Number.isFinite(number) ? `${Math.round(number)}°` : '--°');
}

function normalize(payload) {
  const data = payload?.telemetry || payload?.state?.telemetry || payload || {};
  const tyres = data.tyres || data.tyreTemp || data.advanced?.tyreTemp || {};
  return {
    connected: Boolean(payload?.telemetryReceiving ?? payload?.state?.telemetryReceiving ?? data.connected),
    bridgeName: payload?.bridge?.name || payload?.name || 'GT7 Bridge Next',
    speed: Number(data.speedKmh ?? data.speed ?? 0),
    rpm: Number(data.rpm ?? 0),
    rpmLimit: Number(data.rpmLimit ?? data.maxRpm ?? 9000),
    gear: data.gear ?? 'N',
    throttle: Number(data.throttlePct ?? data.throttle ?? 0),
    brake: Number(data.brakePct ?? data.brake ?? 0),
    fuel: data.fuelPct,
    lapNumber: Number(data.lapNumber ?? 0),
    totalLaps: Number(data.totalLaps ?? 0),
    bestLapMs: Number(data.bestLapMs ?? 0),
    lastLapMs: Number(data.lastLapMs ?? 0),
    packetRate: Number(payload?.packetRate ?? payload?.state?.packetRate ?? data.packetRate ?? 0),
    tyres,
    ps5Ip: payload?.config?.ps5Ip || payload?.state?.config?.ps5Ip || settings.ps5Ip,
    updatedAt: payload?.updatedAt || payload?.state?.updatedAt || new Date().toISOString()
  };
}

function render(payload, latency = null) {
  const data = normalize(payload);
  lastMessageAt = Date.now();
  maxSpeed = Math.max(maxSpeed, data.speed || 0);
  text('speed', Math.round(clamp(data.speed, 0, 700)));
  text('gear', String(data.gear || 'N'));
  text('rpm', Math.round(clamp(data.rpm, 0, 25000)));
  text('throttle', `${Math.round(clamp(data.throttle))}%`);
  text('brake', `${Math.round(clamp(data.brake))}%`);
  $('throttleBar').style.width = `${clamp(data.throttle)}%`;
  $('brakeBar').style.width = `${clamp(data.brake)}%`;
  text('bestLap', formatLap(data.bestLapMs));
  text('lastLap', formatLap(data.lastLapMs));
  text('lapNumber', `${Math.max(0, data.lapNumber)} / ${Math.max(0, data.totalLaps)}`);
  text('fuel', Number.isFinite(Number(data.fuel)) ? `${Math.round(clamp(data.fuel))}%` : '--%');
  text('maxSpeed', Math.round(maxSpeed));
  text('packetRate', `${Math.max(0, Math.round(data.packetRate))}/s`);
  renderRpm(data.rpm, data.rpmLimit);
  renderTyre('tyreFL', data.tyres.FL ?? data.tyres.fl);
  renderTyre('tyreFR', data.tyres.FR ?? data.tyres.fr);
  renderTyre('tyreRL', data.tyres.RL ?? data.tyres.rl);
  renderTyre('tyreRR', data.tyres.RR ?? data.tyres.rr);
  text('bridgeLabel', data.bridgeName);
  text('footerState', data.connected ? `Recebendo GT7 de ${data.ps5Ip}` : `Aguardando GT7 em ${data.ps5Ip}`);
  text('updatedAt', new Date(data.updatedAt).toLocaleTimeString('pt-BR'));
  setConnection(data.connected, latency);
}

function setConnection(online, latency = null) {
  $('statusDot').classList.toggle('online', Boolean(online));
  text('connectionStatus', online ? 'OK' : 'OFF');
  text('latency', Number.isFinite(latency) ? `${Math.round(latency)} ms` : '-- ms');
}

function httpBase() {
  return String(settings.bridgeUrl || DEFAULTS.bridgeUrl).replace(/\/$/, '');
}

function websocketUrl() {
  const url = new URL(httpBase());
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  return url.toString();
}

function stopConnections() {
  clearTimeout(reconnectTimer);
  clearInterval(pollTimer);
  reconnectTimer = null;
  pollTimer = null;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

function startPolling() {
  if (pollTimer) return;
  const poll = async () => {
    const started = performance.now();
    try {
      const response = await fetch(`${httpBase()}/api/state`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      render(await response.json(), performance.now() - started);
    } catch {
      if (Date.now() - lastMessageAt > 2500) setConnection(false);
    }
  };
  poll();
  pollTimer = setInterval(poll, 700);
}

function connect() {
  stopConnections();
  text('bridgeLabel', 'Conectando...');
  try {
    socket = new WebSocket(websocketUrl());
    socket.onopen = () => {
      clearInterval(pollTimer);
      pollTimer = null;
      text('bridgeLabel', 'GT7 Bridge Next');
    };
    socket.onmessage = (event) => {
      try { render(JSON.parse(event.data)); } catch { /* pacote inválido é ignorado */ }
    };
    socket.onerror = () => socket?.close();
    socket.onclose = () => {
      socket = null;
      startPolling();
      reconnectTimer = setTimeout(connect, 3000);
    };
  } catch {
    startPolling();
    reconnectTimer = setTimeout(connect, 3000);
  }
}

async function testConnection() {
  const result = $('settingsResult');
  result.textContent = 'Testando a Bridge...';
  const started = performance.now();
  try {
    const base = String($('bridgeUrl').value || '').replace(/\/$/, '');
    const response = await fetch(`${base}/api/health`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
    result.textContent = `Bridge encontrada em ${Math.round(performance.now() - started)} ms. UDP: ${body.udpBound ? 'ativo' : 'inativo'}.`;
  } catch (error) {
    result.textContent = `Falha: ${error.message}`;
  }
}

async function saveAndConnect() {
  settings = {
    bridgeUrl: String($('bridgeUrl').value || DEFAULTS.bridgeUrl).trim().replace(/\/$/, ''),
    ps5Ip: String($('ps5Ip').value || DEFAULTS.ps5Ip).trim()
  };
  saveSettings();
  const result = $('settingsResult');
  result.textContent = 'Salvando configuração na Bridge...';
  try {
    const response = await fetch(`${httpBase()}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ps5Ip: settings.ps5Ip })
    });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
    result.textContent = 'Configuração salva. Reconectando...';
    closeSettings();
    maxSpeed = 0;
    connect();
  } catch (error) {
    result.textContent = `Não foi possível salvar no Raspberry: ${error.message}`;
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

$('openSettings').addEventListener('click', openSettings);
$('closeSettings').addEventListener('click', closeSettings);
$('settingsModal').addEventListener('click', (event) => { if (event.target === $('settingsModal')) closeSettings(); });
$('testConnection').addEventListener('click', testConnection);
$('saveConnection').addEventListener('click', saveAndConnect);

document.addEventListener('visibilitychange', () => { if (!document.hidden && !socket) connect(); });
renderRpm(0, 9000);
connect();
