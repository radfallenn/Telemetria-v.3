'use strict';

const dgram = require('dgram');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { decrypt, decode, packetType } = require('./protocol');
const { createSessionStore, formatMs, validLap } = require('./sessions');

const HTTP_PORT = Number(process.env.HTTP_PORT || 8789);
const UDP_RECEIVE_PORT = Number(process.env.UDP_RECEIVE_PORT || 33740);
const PS5_HEARTBEAT_PORT = Number(process.env.PS5_HEARTBEAT_PORT || 33739);
const CONFIG_FILE = process.env.CONFIG_FILE || path.join(__dirname, 'config.json');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'telemetry.json');
const HEARTBEAT = Buffer.from('A', 'ascii');
const FRESH_MS = 5000;

const validIp = (value) => {
  const parts = String(value || '').trim().split('.');
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
};

function loadConfig() {
  try {
    return { ps5Ip: '192.168.1.81', heartbeatIntervalMs: 1000, autoSession: true, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ps5Ip: validIp(process.env.PS5_IP) ? process.env.PS5_IP : '192.168.1.81', heartbeatIntervalMs: 1000, autoSession: true };
  }
}

function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

fs.mkdirSync(DATA_DIR, { recursive: true });
let config = loadConfig();
if (!validIp(config.ps5Ip)) config.ps5Ip = '192.168.1.81';
const sessions = createSessionStore(DB_FILE);
const startedAt = Date.now();

const udp = {
  bound: false, lastError: null, heartbeatSent: 0, lastHeartbeatAt: 0,
  packetsReceived: 0, packetsDecoded: 0, packetsRejected: 0,
  lastPacketAt: 0, lastDecodedAt: 0, lastPacketSize: 0,
  lastPacketType: '?', lastSourceIp: null, lastSourcePort: null
};

let live = {
  connected: false, bridgeConnected: true, telemetryReceiving: false, packetFresh: false, decodeOk: false,
  status: 'iniciando_bridge_8789', updatedAt: null, packetId: 0, ps5Ip: config.ps5Ip,
  velocidade: 0, speedKmh: 0, rpm: 0, marcha: 'N', gear: 'N', marchaSugerida: '--',
  acelerador: 0, throttlePct: 0, freio: 0, brakePct: 0,
  combustivel: null, fuelCurrent: null, fuelCapacity: null, combustivelPorcentagem: null, fuelPct: null,
  velocidadeMaxima: 0, maxSpeedKmh: 0, melhorVolta: '--', ultimaVolta: '--', bestLapMs: 0, lastLapMs: 0,
  voltaAtualTempo: '--', tempoTotalCorrida: '--', mediaVoltas: '--', voltasCompletadas: 0, voltasCorrigidas: 0,
  totalLaps: 0, lapTimes: [], analysis: sessions.analyse([]), advanced: {}, motecChannels: {},
  sessionState: 'WAITING', currentSessionId: null, note: 'Nova Bridge independente em HTTP 8789'
};

let socket = null;
let heartbeatTimer = null;
let generation = 0;
let currentLap = 0;
let currentLapStartedAt = 0;
let closing = false;

function syncSession() {
  const active = sessions.active;
  live.sessionState = active ? 'RUNNING' : 'WAITING';
  live.currentSessionId = active ? active.id : null;
  live.analysis = active ? active.analysis : live.analysis;
  live.lapTimes = active ? active.laps.map((lap) => lap.time) : live.lapTimes;
  live.voltasCompletadas = active ? active.laps.length : live.voltasCompletadas;
  live.voltasCorrigidas = live.voltasCompletadas;
  live.melhorVolta = live.analysis.best || '--';
  live.ultimaVolta = live.analysis.last || '--';
  live.bestLapMs = live.analysis.bestMs || 0;
  live.lastLapMs = live.analysis.lastMs || 0;
  live.tempoTotalCorrida = live.analysis.total || '--';
  live.mediaVoltas = live.analysis.average || '--';
}

function applyTelemetry(data) {
  const now = Date.now();
  if (config.autoSession && !sessions.active && (data.speed > 3 || data.rpm > 1200)) sessions.start();
  live.velocidadeMaxima = Math.max(live.velocidadeMaxima || 0, data.speed);
  live.maxSpeedKmh = live.velocidadeMaxima;
  if (data.lapNumber > 0 && data.lapNumber !== currentLap) {
    currentLap = data.lapNumber;
    currentLapStartedAt = now;
  }
  if (data.lastLapMs > 0 && data.lapNumber > 1) sessions.register(data.lastLapMs, data.lapNumber - 1, live.velocidadeMaxima);
  syncSession();
  const currentLapMs = data.advanced.currentLapMs > 0 ? data.advanced.currentLapMs : currentLapStartedAt ? now - currentLapStartedAt : 0;
  Object.assign(live, {
    connected: true, telemetryReceiving: true, packetFresh: true, decodeOk: true,
    status: 'recebendo_udp_decodificado', updatedAt: now, packetId: data.packetId, ps5Ip: config.ps5Ip,
    velocidade: data.speed, speedKmh: data.speed, rpm: data.rpm, marcha: data.gear, gear: data.gear,
    marchaSugerida: data.suggestedGear, acelerador: data.throttle, throttlePct: data.throttle,
    freio: data.brake, brakePct: data.brake, combustivel: data.fuelCurrent, fuelCurrent: data.fuelCurrent,
    fuelCapacity: data.fuelCapacity, combustivelPorcentagem: data.fuelPct, fuelPct: data.fuelPct,
    totalLaps: data.totalLaps > 0 ? data.totalLaps : 0,
    melhorVolta: sessions.active ? live.melhorVolta : validLap(data.bestLapMs) ? formatMs(data.bestLapMs) : '--',
    ultimaVolta: sessions.active ? live.ultimaVolta : validLap(data.lastLapMs) ? formatMs(data.lastLapMs) : '--',
    bestLapMs: sessions.active ? live.bestLapMs : validLap(data.bestLapMs) ? data.bestLapMs : 0,
    lastLapMs: sessions.active ? live.lastLapMs : validLap(data.lastLapMs) ? data.lastLapMs : 0,
    voltaAtualTempo: currentLapMs > 0 ? formatMs(currentLapMs) : '--', advanced: data.advanced, motecChannels: data.motecChannels
  });
}

function snapshot() {
  const now = Date.now();
  const packetFresh = udp.lastPacketAt > 0 && now - udp.lastPacketAt < FRESH_MS;
  const decodedFresh = udp.lastDecodedAt > 0 && now - udp.lastDecodedAt < FRESH_MS;
  return {
    ...live,
    connected: decodedFresh, telemetryReceiving: decodedFresh, packetFresh: decodedFresh, decodeOk: decodedFresh,
    status: !udp.bound ? 'udp_desligado' : decodedFresh ? 'recebendo_udp_decodificado' : packetFresh ? 'recebendo_udp_sem_decode' : 'aguardando_pacotes',
    bridge: { name: 'GT7 Bridge 8789', version: '1.0.0', online: true, uptimeMs: now - startedAt, httpPort: HTTP_PORT, udpReceivePort: UDP_RECEIVE_PORT, ps5HeartbeatPort: PS5_HEARTBEAT_PORT, heartbeatByte: 'A' },
    udp: { ...udp, receiving: decodedFresh, packetFresh, decodedFresh, packetAgeMs: udp.lastPacketAt ? now - udp.lastPacketAt : null }
  };
}

function stopUdp() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  const old = socket;
  socket = null;
  udp.bound = false;
  if (!old) return Promise.resolve();
  return new Promise((resolve) => { try { old.close(resolve); } catch { resolve(); } });
}

function heartbeat() {
  if (!socket || !udp.bound || closing) return false;
  socket.send(HEARTBEAT, PS5_HEARTBEAT_PORT, config.ps5Ip, (error) => {
    if (error) udp.lastError = error.message;
    else { udp.lastHeartbeatAt = Date.now(); udp.heartbeatSent += 1; }
  });
  return true;
}

async function startUdp() {
  await stopUdp();
  const currentGeneration = ++generation;
  const current = dgram.createSocket({ type: 'udp4', reuseAddr: false });
  socket = current;
  const ready = new Promise((resolve, reject) => { current.once('listening', resolve); current.once('error', reject); });
  current.on('error', (error) => { if (currentGeneration === generation) { udp.lastError = error.message; udp.bound = false; } });
  current.on('message', (message, remote) => {
    if (currentGeneration !== generation) return;
    udp.packetsReceived += 1; udp.lastPacketAt = Date.now(); udp.lastPacketSize = message.length;
    udp.lastPacketType = packetType(message.length); udp.lastSourceIp = remote.address; udp.lastSourcePort = remote.port;
    const decrypted = decrypt(message);
    if (!decrypted) { udp.packetsRejected += 1; return; }
    try { applyTelemetry(decode(decrypted)); udp.packetsDecoded += 1; udp.lastDecodedAt = Date.now(); }
    catch (error) { udp.packetsRejected += 1; udp.lastError = 'decode: ' + error.message; }
  });
  current.on('listening', () => {
    if (currentGeneration !== generation) return;
    udp.bound = true;
    heartbeat();
    heartbeatTimer = setInterval(heartbeat, Number(config.heartbeatIntervalMs) || 1000);
    heartbeatTimer.unref?.();
    console.log(`[UDP] ${UDP_RECEIVE_PORT}; A -> ${config.ps5Ip}:${PS5_HEARTBEAT_PORT}`);
  });
  current.bind(UDP_RECEIVE_PORT, '0.0.0.0');
  await ready;
  return snapshot();
}

function json(res, value, code = 200) {
  const body = JSON.stringify(value);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Cache-Control': 'no-store' });
  res.end(body);
}

function body(req) {
  return new Promise((resolve, reject) => {
    let text = '';
    req.on('data', (chunk) => { text += chunk; if (text.length > 1048576) reject(new Error('Requisição muito grande')); });
    req.on('end', () => { try { resolve(text.trim() ? JSON.parse(text) : {}); } catch { reject(new Error('JSON inválido')); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, { ok: true });
  const endpoint = new URL(req.url, 'http://127.0.0.1').pathname;
  try {
    if (req.method === 'GET' && (endpoint === '/' || endpoint === '/api/health')) {
      const state = snapshot();
      return json(res, { ok: true, app: 'GT7 Bridge 8789', status: state.status, bridgeOnline: true, udpBound: state.udp.bound, telemetryReceiving: state.telemetryReceiving, ps5Ip: config.ps5Ip, httpPort: HTTP_PORT, udpReceivePort: UDP_RECEIVE_PORT, ps5HeartbeatPort: PS5_HEARTBEAT_PORT, heartbeatByte: 'A' });
    }
    if (req.method === 'GET' && ['/api/live', '/api/fields', '/api/status', '/api/telemetry'].includes(endpoint)) return json(res, snapshot());
    if (req.method === 'GET' && endpoint === '/api/diagnostic') return json(res, { ok: true, state: snapshot(), config, activeSession: sessions.active });
    if (req.method === 'GET' && endpoint === '/api/config') return json(res, { ok: true, config });
    if (req.method === 'POST' && ['/api/config', '/api/settings', '/api/ps5', '/api/config/ps5'].includes(endpoint)) {
      const data = await body(req);
      const ps5Ip = String(data.ps5Ip || data.ps5_ip || data.ip || config.ps5Ip).trim();
      if (!validIp(ps5Ip)) return json(res, { ok: false, error: 'IP do PS5 inválido' }, 400);
      config.ps5Ip = ps5Ip; live.ps5Ip = ps5Ip; saveConfig(); heartbeat();
      return json(res, { ok: true, config });
    }
    if (req.method === 'POST' && ['/api/restart', '/api/udp/restart'].includes(endpoint)) return json(res, { ok: true, state: await startUdp() });
    if (req.method === 'POST' && endpoint === '/api/heartbeat') return json(res, { ok: true, sent: heartbeat() });
    if (req.method === 'POST' && endpoint === '/api/session/start') { const data = await body(req); const session = sessions.start(data.name || 'Nova seção'); syncSession(); return json(res, { ok: true, session }); }
    if (req.method === 'POST' && endpoint === '/api/session/finish') { const data = await body(req); const session = sessions.finish(data.name); syncSession(); return json(res, { ok: true, session }); }
    if (req.method === 'POST' && endpoint === '/api/reset') { const session = sessions.start('Nova seção'); live.velocidadeMaxima = 0; syncSession(); return json(res, { ok: true, session }); }
    if (req.method === 'GET' && endpoint === '/api/current-session') return json(res, { ok: true, active: sessions.active, live: snapshot() });
    if (req.method === 'GET' && endpoint === '/api/sessions') return json(res, { ok: true, sessions: sessions.sessions, active: sessions.active });
    if (req.method === 'GET' && endpoint === '/api/ranking') return json(res, { ok: true, ranking: sessions.ranking });
    return json(res, { ok: false, error: 'Endpoint não encontrado' }, 404);
  } catch (error) { return json(res, { ok: false, error: error.message || String(error) }, 500); }
});

async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`[Bridge 8789] encerrando: ${signal}`);
  await stopUdp();
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`[HTTP] Bridge nova em 0.0.0.0:${HTTP_PORT}`);
  startUdp().catch((error) => { udp.lastError = error.message; console.error('[UDP]', error.message); });
});
