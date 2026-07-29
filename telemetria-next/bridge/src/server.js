'use strict';

const dgram = require('node:dgram');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { WebSocketServer, WebSocket } = require('ws');
const { decodeEncryptedPacket } = require('./protocol');

const HTTP_PORT = Number(process.env.HTTP_PORT || 8790);
const UDP_RECEIVE_PORT = Number(process.env.UDP_RECEIVE_PORT || 33740);
const PS5_HEARTBEAT_PORT = Number(process.env.PS5_HEARTBEAT_PORT || 33739);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const CONFIG_FILE = process.env.CONFIG_FILE || path.join(DATA_DIR, 'config.json');
const HEARTBEAT = Buffer.from('A', 'ascii');

fs.mkdirSync(DATA_DIR, { recursive: true });

function validIpv4(value) {
  const parts = String(value || '').trim().split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function loadConfig() {
  const fallback = { ps5Ip: process.env.PS5_IP || '192.168.1.81' };
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return validIpv4(saved.ps5Ip) ? { ps5Ip: saved.ps5Ip } : fallback;
  } catch {
    return fallback;
  }
}

function saveConfig(nextConfig) {
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
}

let config = loadConfig();
let udpSocket = null;
let heartbeatTimer = null;
let statusTimer = null;
let lastPacketAt = 0;
let packetCounter = 0;
let packetRate = 0;
let decodeErrors = 0;
let maxSpeedKmh = 0;
let telemetry = null;
let lastBroadcastAt = 0;

const state = () => ({
  ok: true,
  schemaVersion: 1,
  bridge: { name: 'GT7 Bridge Next', version: '0.1.0' },
  config: { ps5Ip: config.ps5Ip, udpReceivePort: UDP_RECEIVE_PORT, ps5HeartbeatPort: PS5_HEARTBEAT_PORT, httpPort: HTTP_PORT },
  udpBound: Boolean(udpSocket),
  telemetryReceiving: Date.now() - lastPacketAt < 2500,
  packetRate,
  decodeErrors,
  maxSpeedKmh,
  telemetry,
  updatedAt: new Date().toISOString()
});

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store'
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 16_384) reject(new Error('Corpo da requisição excede o limite.'));
    });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('JSON inválido.')); }
    });
    request.on('error', reject);
  });
}

function broadcast(force = false) {
  const now = Date.now();
  if (!force && now - lastBroadcastAt < 50) return;
  lastBroadcastAt = now;
  const message = JSON.stringify(state());
  for (const client of webSocketServer.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

function stopUdp() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  if (udpSocket) {
    const current = udpSocket;
    udpSocket = null;
    try { current.close(); } catch { /* já fechado */ }
  }
}

function sendHeartbeat() {
  if (!udpSocket || !validIpv4(config.ps5Ip)) return;
  udpSocket.send(HEARTBEAT, PS5_HEARTBEAT_PORT, config.ps5Ip, (error) => {
    if (error) console.error('[heartbeat]', error.message);
  });
}

function startUdp() {
  stopUdp();
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('error', (error) => {
    console.error('[udp]', error.message);
    if (udpSocket === socket) stopUdp();
    broadcast(true);
  });

  socket.on('message', (packet) => {
    packetCounter += 1;
    const decoded = decodeEncryptedPacket(packet);
    if (!decoded) {
      decodeErrors += 1;
      return;
    }
    lastPacketAt = Date.now();
    maxSpeedKmh = Math.max(maxSpeedKmh, decoded.speedKmh || 0);
    telemetry = { ...decoded, maxSpeedKmh };
    broadcast(false);
  });

  socket.on('listening', () => {
    udpSocket = socket;
    console.log(`[udp] ouvindo 0.0.0.0:${UDP_RECEIVE_PORT}; PS5 ${config.ps5Ip}:${PS5_HEARTBEAT_PORT}`);
    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, 1000);
    broadcast(true);
  });

  socket.bind(UDP_RECEIVE_PORT, '0.0.0.0');
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      name: 'GT7 Bridge Next',
      version: '0.1.0',
      httpPort: HTTP_PORT,
      udpBound: Boolean(udpSocket),
      telemetryReceiving: Date.now() - lastPacketAt < 2500,
      packetRate,
      ps5Ip: config.ps5Ip
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/state') {
    sendJson(response, 200, state());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/config') {
    sendJson(response, 200, { ok: true, config: state().config });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/config') {
    try {
      const body = await readJson(request);
      if (!validIpv4(body.ps5Ip)) {
        sendJson(response, 400, { ok: false, error: 'Informe um IPv4 válido para o PS5.' });
        return;
      }
      config = { ps5Ip: String(body.ps5Ip).trim() };
      saveConfig(config);
      startUdp();
      sendJson(response, 200, { ok: true, config: state().config });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/restart') {
    startUdp();
    sendJson(response, 200, { ok: true, state: state() });
    return;
  }

  sendJson(response, 404, { ok: false, error: 'Rota não encontrada.' });
});

const webSocketServer = new WebSocketServer({ noServer: true });
webSocketServer.on('connection', (client) => {
  client.send(JSON.stringify(state()));
});

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket, head, (client) => {
    webSocketServer.emit('connection', client, request);
  });
});

statusTimer = setInterval(() => {
  packetRate = packetCounter;
  packetCounter = 0;
  broadcast(true);
}, 1000);

function shutdown() {
  clearInterval(statusTimer);
  stopUdp();
  for (const client of webSocketServer.clients) client.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startUdp();
server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`[http] GT7 Bridge Next em http://0.0.0.0:${HTTP_PORT}`);
});
