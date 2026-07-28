'use strict';

const dgram = require('dgram');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const HTTP_PORT = toPort(process.env.HTTP_PORT, 8788);
const UDP_LISTEN_PORT = toPort(process.env.UDP_LISTEN_PORT, 33740);
const PS5_HEARTBEAT_PORT = toPort(process.env.PS5_HEARTBEAT_PORT, 33739);
const CONFIG_FILE = process.env.BRIDGE_CONFIG_FILE || path.join(__dirname, 'config.json');
const DATA_DIR = process.env.BRIDGE_DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'telemetry-v4.json');
const HEARTBEAT = Buffer.from('A', 'ascii');
const PACKET_TIMEOUT_MS = 5000;
const DECODE_TIMEOUT_MS = 5000;
const SALSA_KEY = Buffer.from('Simulator Interface Packet GT7 ver 0.0', 'ascii').subarray(0, 32);
const MAGIC = 0x47375330;

function toPort(value, fallback) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

function validIpv4(value) {
  const parts = String(value || '').trim().split('.');
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeRead(reader, fallback = 0) {
  try {
    const value = reader();
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readFloat(buffer, offset) {
  return safeRead(() => buffer.readFloatLE(offset));
}

function readInt32(buffer, offset) {
  return safeRead(() => buffer.readInt32LE(offset));
}

function readInt16(buffer, offset) {
  return safeRead(() => buffer.readInt16LE(offset));
}

function readUInt16(buffer, offset) {
  return safeRead(() => buffer.readUInt16LE(offset));
}

function readUInt8(buffer, offset) {
  return safeRead(() => buffer.readUInt8(offset));
}

function readText4(buffer, offset) {
  try {
    return buffer.subarray(offset, offset + 4).toString('ascii').replace(/\0/g, '').trim();
  } catch {
    return '';
  }
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

function formatMs(value) {
  let ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '--';
  const hours = Math.floor(ms / 3600000);
  ms %= 3600000;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return (hours ? String(hours).padStart(2, '0') + ':' : '') +
    String(minutes).padStart(2, '0') + ':' +
    String(seconds).padStart(2, '0') + '.' +
    String(millis).padStart(3, '0');
}

function validLap(ms) {
  return Number.isFinite(ms) && ms >= 30000 && ms <= 900000;
}

function average(values) {
  const valid = values.filter(validLap);
  if (!valid.length) return 0;
  const cut = valid.length >= 10 ? 2 : valid.length >= 6 ? 1 : 0;
  const sorted = valid.slice().sort((a, b) => a - b);
  const trimmed = cut && sorted.length > cut * 2 ? sorted.slice(cut, -cut) : sorted;
  return Math.round(trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length);
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function analyseLaps(laps) {
  const values = laps.map((lap) => Number(lap.ms)).filter(validLap);
  const bestMs = values.length ? Math.min(...values) : 0;
  const lastMs = values.length ? values[values.length - 1] : 0;
  const totalMs = values.reduce((sum, value) => sum + value, 0);
  const averageMs = average(values);
  const consistency = values.length > 1 && bestMs
    ? Math.max(0, 100 - Math.round((standardDeviation(values) / bestMs) * 100))
    : values.length ? 100 : 0;
  return {
    laps: laps.length,
    bestMs,
    best: formatMs(bestMs),
    lastMs,
    last: formatMs(lastMs),
    totalMs,
    total: formatMs(totalMs),
    averageMs,
    average: formatMs(averageMs),
    deltaBest: bestMs && lastMs ? formatMs(Math.max(0, lastMs - bestMs)) : '--',
    consistency: values.length ? consistency + '%' : '--',
    grade: !values.length ? '--' : consistency >= 97 ? 'A+' : consistency >= 93 ? 'A' : consistency >= 87 ? 'B' : consistency >= 78 ? 'C' : 'D'
  };
}

function loadJson(file, fallback) {
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { ...fallback };
  }
}

function writeJson(file, value) {
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

let config = loadJson(CONFIG_FILE, {
  ps5Ip: validIpv4(process.env.PS5_IP) ? process.env.PS5_IP : '192.168.1.81',
  heartbeatIntervalMs: 1000,
  autoSession: true
});
if (!validIpv4(config.ps5Ip)) config.ps5Ip = '192.168.1.81';
config.heartbeatIntervalMs = clamp(Number(config.heartbeatIntervalMs) || 1000, 500, 5000);

let database = loadJson(DB_FILE, { version: 4, sessions: [], ranking: [] });
if (!Array.isArray(database.sessions)) database.sessions = [];
if (!Array.isArray(database.ranking)) database.ranking = [];

function saveConfig() {
  writeJson(CONFIG_FILE, config);
}

function saveDatabase() {
  writeJson(DB_FILE, database);
}

function rotateLeft(value, count) {
  return ((value << count) | (value >>> (32 - count))) >>> 0;
}

function quarterRound(state, a, b, c, d) {
  state[b] ^= rotateLeft((state[a] + state[d]) >>> 0, 7);
  state[c] ^= rotateLeft((state[b] + state[a]) >>> 0, 9);
  state[d] ^= rotateLeft((state[c] + state[b]) >>> 0, 13);
  state[a] ^= rotateLeft((state[d] + state[c]) >>> 0, 18);
}

function salsaBlock(key, iv, counter) {
  const sigma = Buffer.from('expand 32-byte k', 'ascii');
  const state = new Uint32Array(16);
  state[0] = sigma.readUInt32LE(0);
  state[5] = sigma.readUInt32LE(4);
  state[10] = sigma.readUInt32LE(8);
  state[15] = sigma.readUInt32LE(12);
  for (let i = 0; i < 4; i += 1) state[1 + i] = key.readUInt32LE(i * 4);
  for (let i = 0; i < 4; i += 1) state[11 + i] = key.readUInt32LE(16 + i * 4);
  state[6] = iv.readUInt32LE(0);
  state[7] = iv.readUInt32LE(4);
  state[8] = counter >>> 0;
  state[9] = 0;
  const work = new Uint32Array(state);
  for (let i = 0; i < 10; i += 1) {
    quarterRound(work, 0, 4, 8, 12);
    quarterRound(work, 5, 9, 13, 1);
    quarterRound(work, 10, 14, 2, 6);
    quarterRound(work, 15, 3, 7, 11);
    quarterRound(work, 0, 1, 2, 3);
    quarterRound(work, 5, 6, 7, 4);
    quarterRound(work, 10, 11, 8, 9);
    quarterRound(work, 15, 12, 13, 14);
  }
  const output = Buffer.alloc(64);
  for (let i = 0; i < 16; i += 1) output.writeUInt32LE((work[i] + state[i]) >>> 0, i * 4);
  return output;
}

function salsaXor(input, key, iv) {
  const output = Buffer.alloc(input.length);
  let counter = 0;
  for (let offset = 0; offset < input.length; offset += 64) {
    const block = salsaBlock(key, iv, counter++);
    const length = Math.min(64, input.length - offset);
    for (let i = 0; i < length; i += 1) output[offset + i] = input[offset + i] ^ block[i];
  }
  return output;
}

function decryptPacket(packet) {
  if (!Buffer.isBuffer(packet) || packet.length < 0x44) return null;
  const seed = safeRead(() => packet.readUInt32LE(0x40), -1);
  if (seed < 0) return null;
  for (const constant of [0xDEADBEAF, 0xDEADBEEF, 0x55FABB4F]) {
    const iv = Buffer.alloc(8);
    iv.writeUInt32LE((seed ^ constant) >>> 0, 0);
    iv.writeUInt32LE(seed >>> 0, 4);
    const decoded = salsaXor(packet, SALSA_KEY, iv);
    if (safeRead(() => decoded.readUInt32LE(0), 0) === MAGIC) return decoded;
  }
  return null;
}

function packetKind(length) {
  return length === 368 ? 'C' : length === 344 ? '~' : length === 316 ? 'B' : length === 296 ? 'A' : '?';
}

function flagsObject(value) {
  return {
    raw: value,
    carOnTrack: Boolean(value & 1),
    paused: Boolean(value & 2),
    loading: Boolean(value & 4),
    inGear: Boolean(value & 8),
    hasTurbo: Boolean(value & 16),
    revLimiter: Boolean(value & 32),
    handBrake: Boolean(value & 64),
    lights: Boolean(value & 128),
    highBeam: Boolean(value & 256),
    lowBeam: Boolean(value & 512),
    asm: Boolean(value & 1024),
    tcs: Boolean(value & 2048)
  };
}

function decodeAdvanced(packet) {
  const gearByte = readUInt8(packet, 0x90);
  const currentGear = gearByte & 15;
  const suggestedGear = (gearByte >> 4) & 15;
  const flags = readUInt16(packet, 0x8e);
  const advanced = {
    packetType: packetKind(packet.length),
    packetId: readInt32(packet, 0x70),
    position: { x: round(readFloat(packet, 0x04), 3), y: round(readFloat(packet, 0x08), 3), z: round(readFloat(packet, 0x0c), 3) },
    worldVelocity: { x: round(readFloat(packet, 0x10), 3), y: round(readFloat(packet, 0x14), 3), z: round(readFloat(packet, 0x18), 3) },
    rotation: { pitch: round(readFloat(packet, 0x1c), 3), yaw: round(readFloat(packet, 0x20), 3), roll: round(readFloat(packet, 0x24), 3) },
    orientationNorth: round(readFloat(packet, 0x28), 3),
    angularVelocity: { x: round(readFloat(packet, 0x2c), 3), y: round(readFloat(packet, 0x30), 3), z: round(readFloat(packet, 0x34), 3) },
    bodyHeight: round(readFloat(packet, 0x38), 3),
    boost: round(readFloat(packet, 0x50) - 1),
    boostRaw: round(readFloat(packet, 0x50)),
    oilPressure: round(readFloat(packet, 0x54)),
    waterTemp: round(readFloat(packet, 0x58)),
    oilTemp: round(readFloat(packet, 0x5c)),
    tyreTemp: {
      FL: round(readFloat(packet, 0x60)), FR: round(readFloat(packet, 0x64)),
      RL: round(readFloat(packet, 0x68)), RR: round(readFloat(packet, 0x6c))
    },
    dayProgression: readInt32(packet, 0x80),
    raceStartPosition: readInt16(packet, 0x84),
    preRaceNumCars: readInt16(packet, 0x86),
    minAlertRPM: readInt16(packet, 0x88),
    maxAlertRPM: readInt16(packet, 0x8a),
    calcMaxSpeed: readInt16(packet, 0x8c),
    flags: flagsObject(flags),
    currentGear: currentGear === 0 ? 'N' : currentGear,
    suggestedGear: suggestedGear === 15 ? '--' : suggestedGear,
    roadPlane: {
      x: round(readFloat(packet, 0x94), 3), y: round(readFloat(packet, 0x98), 3),
      z: round(readFloat(packet, 0x9c), 3), distance: round(readFloat(packet, 0xa0), 3)
    },
    wheelRPS: {
      FL: round(readFloat(packet, 0xa4), 3), FR: round(readFloat(packet, 0xa8), 3),
      RL: round(readFloat(packet, 0xac), 3), RR: round(readFloat(packet, 0xb0), 3)
    },
    tyreRadius: {
      FL: round(readFloat(packet, 0xb4), 3), FR: round(readFloat(packet, 0xb8), 3),
      RL: round(readFloat(packet, 0xbc), 3), RR: round(readFloat(packet, 0xc0), 3)
    },
    suspensionHeight: {
      FL: round(readFloat(packet, 0xc4), 3), FR: round(readFloat(packet, 0xc8), 3),
      RL: round(readFloat(packet, 0xcc), 3), RR: round(readFloat(packet, 0xd0), 3)
    },
    clutch: round(readFloat(packet, 0xf4)),
    clutchEngagement: round(readFloat(packet, 0xf8)),
    rpmClutchToGearbox: Math.round(readFloat(packet, 0xfc)),
    transmissionTopSpeed: round(readFloat(packet, 0x100)),
    gearRatios: Array.from({ length: 8 }, (_, index) => round(readFloat(packet, 0x104 + index * 4), 3)),
    carCode: readInt32(packet, 0x124)
  };
  if (packet.length >= 316) {
    advanced.steeringAngularVelocity = round(readFloat(packet, 0x12c), 3);
    advanced.gForce = {
      sway: round(readFloat(packet, 0x130), 3),
      heave: round(readFloat(packet, 0x134), 3),
      surge: round(readFloat(packet, 0x138), 3)
    };
  }
  if (packet.length >= 344) {
    advanced.throttleFiltered = Math.round(readUInt8(packet, 0x13c) / 2.55);
    advanced.brakeFiltered = Math.round(readUInt8(packet, 0x13d) / 2.55);
    advanced.energyRecovery = round(readFloat(packet, 0x150), 3);
  }
  if (packet.length >= 368) {
    advanced.surfaceType = readText4(packet, 0x158);
    advanced.currentLapMs = readInt32(packet, 0x15c);
    advanced.wheelSteeringAngle = { left: round(readFloat(packet, 0x160), 3), right: round(readFloat(packet, 0x164), 3) };
    advanced.wheelBase = round(readFloat(packet, 0x168), 3);
    advanced.carCategory = readText4(packet, 0x16c);
  }
  return advanced;
}

const startedAt = Date.now();
const transport = {
  bound: false,
  binding: false,
  localAddress: null,
  lastError: null,
  lastHeartbeatAt: 0,
  lastHeartbeatError: null,
  heartbeatSent: 0,
  packetsReceived: 0,
  packetsDecoded: 0,
  packetsRejected: 0,
  lastPacketAt: 0,
  lastDecodedAt: 0,
  lastPacketSize: 0,
  lastPacketType: '?',
  lastSourceIp: null,
  lastSourcePort: null
};

let live = {
  connected: false,
  bridgeConnected: true,
  telemetryReceiving: false,
  packetFresh: false,
  decodeOk: false,
  status: 'iniciando_bridge',
  updatedAt: null,
  packetSize: 0,
  packetVersion: '?',
  packetId: 0,
  ps5Ip: config.ps5Ip,
  sessionState: 'WAITING',
  currentSessionId: null,
  velocidade: 0,
  speedKmh: 0,
  velocidadeMaxima: 0,
  maxSpeedKmh: 0,
  rpm: 0,
  marcha: 'N',
  gear: 'N',
  marchaNumero: 0,
  marchaSugerida: '--',
  acelerador: 0,
  throttlePct: 0,
  freio: 0,
  brakePct: 0,
  combustivel: null,
  combustivelPorcentagem: null,
  fuelPct: null,
  fuelCapacity: null,
  bestLapMs: 0,
  lastLapMs: 0,
  melhorVolta: '--',
  ultimaVolta: '--',
  voltaAtualTempo: '--',
  tempoTotalCorrida: '--',
  mediaVoltas: '--',
  voltasCompletadas: 0,
  voltasCorrigidas: 0,
  totalLaps: 0,
  lapTimes: [],
  analysis: analyseLaps([]),
  advanced: {},
  motecChannels: {},
  note: 'Bridge GT7 única aguardando UDP'
};

let activeSession = null;
let lastLapToken = '';
let currentLapNumber = 0;
let currentLapStartedAt = 0;
let udpSocket = null;
let heartbeatTimer = null;
let socketGeneration = 0;
let shuttingDown = false;

function startSession(name = 'Nova seção') {
  activeSession = {
    id: 's-' + Date.now(),
    name: String(name || 'Nova seção').slice(0, 80),
    startedAt: new Date().toISOString(),
    endedAt: null,
    laps: [],
    maxSpeed: 0,
    analysis: analyseLaps([])
  };
  lastLapToken = '';
  currentLapNumber = 0;
  currentLapStartedAt = 0;
  Object.assign(live, {
    sessionState: 'RUNNING', currentSessionId: activeSession.id,
    velocidadeMaxima: 0, maxSpeedKmh: 0, melhorVolta: '--', ultimaVolta: '--',
    bestLapMs: 0, lastLapMs: 0, tempoTotalCorrida: '--', mediaVoltas: '--',
    voltasCompletadas: 0, voltasCorrigidas: 0, lapTimes: [], analysis: analyseLaps([])
  });
  return activeSession;
}

function finishSession(name) {
  if (!activeSession) return null;
  if (name) activeSession.name = String(name).slice(0, 80);
  activeSession.endedAt = new Date().toISOString();
  activeSession.analysis = analyseLaps(activeSession.laps);
  database.sessions.unshift(activeSession);
  database.sessions = database.sessions.slice(0, 300);
  if (activeSession.analysis.bestMs) {
    database.ranking.push({
      sessionId: activeSession.id,
      name: activeSession.name,
      date: activeSession.endedAt,
      bestMs: activeSession.analysis.bestMs,
      best: activeSession.analysis.best,
      laps: activeSession.laps.length
    });
    database.ranking = database.ranking.sort((a, b) => a.bestMs - b.bestMs).slice(0, 100);
  }
  saveDatabase();
  const completed = activeSession;
  activeSession = null;
  live.sessionState = 'FINISHED';
  live.currentSessionId = null;
  return completed;
}

function registerLap(ms, reportedLap) {
  if (!validLap(ms)) return false;
  if (!activeSession) startSession('Sessão automática');
  const token = String(reportedLap) + ':' + String(ms);
  if (token === lastLapToken || activeSession.laps.some((lap) => lap.token === token)) return false;
  lastLapToken = token;
  const record = {
    lap: activeSession.laps.length + 1,
    reportedLap,
    ms,
    time: formatMs(ms),
    token,
    maxSpeed: live.velocidadeMaxima,
    at: new Date().toISOString()
  };
  activeSession.laps.push(record);
  activeSession.maxSpeed = Math.max(activeSession.maxSpeed, live.velocidadeMaxima || 0);
  activeSession.analysis = analyseLaps(activeSession.laps);
  Object.assign(live, {
    analysis: activeSession.analysis,
    lapTimes: activeSession.laps.map((lap) => lap.time),
    melhorVolta: activeSession.analysis.best,
    ultimaVolta: record.time,
    bestLapMs: activeSession.analysis.bestMs,
    lastLapMs: record.ms,
    tempoTotalCorrida: activeSession.analysis.total,
    mediaVoltas: activeSession.analysis.average,
    voltasCompletadas: activeSession.laps.length,
    voltasCorrigidas: activeSession.laps.length
  });
  return true;
}

function decodeTelemetry(packet) {
  const speedRaw = readFloat(packet, 0x4c) * 3.6;
  const rpmRaw = readFloat(packet, 0x3c);
  const fuel = readFloat(packet, 0x44);
  const fuelCapacity = readFloat(packet, 0x48);
  const lapNumber = readInt16(packet, 0x74);
  const totalLaps = readInt16(packet, 0x76);
  const bestLapMs = readInt32(packet, 0x78);
  const lastLapMs = readInt32(packet, 0x7c);
  const gearByte = readUInt8(packet, 0x90);
  const gearNumber = gearByte & 15;
  const suggestedGear = (gearByte >> 4) & 15;
  const throttle = clamp(Math.round(readUInt8(packet, 0x91) / 2.55), 0, 100);
  const brake = clamp(Math.round(readUInt8(packet, 0x92) / 2.55), 0, 100);
  const speed = Number.isFinite(speedRaw) && speedRaw >= 0 && speedRaw < 700 ? Math.round(speedRaw) : 0;
  const rpm = Number.isFinite(rpmRaw) && rpmRaw >= 0 && rpmRaw < 25000 ? Math.round(rpmRaw) : 0;
  const gear = gearNumber === 0 ? 'N' : String(gearNumber);
  const advanced = decodeAdvanced(packet);
  const now = Date.now();

  if (config.autoSession && !activeSession && (speed > 3 || rpm > 1200)) startSession('Sessão automática');
  if (activeSession) {
    live.velocidadeMaxima = Math.max(live.velocidadeMaxima || 0, speed);
    live.maxSpeedKmh = live.velocidadeMaxima;
  }

  if (lapNumber > 0 && lapNumber !== currentLapNumber) {
    currentLapNumber = lapNumber;
    currentLapStartedAt = now;
  }

  const currentLapMs = advanced.currentLapMs > 0 ? advanced.currentLapMs : currentLapStartedAt ? now - currentLapStartedAt : 0;
  if (lastLapMs > 0 && lapNumber > 1) registerLap(lastLapMs, lapNumber - 1);

  const fuelPct = Number.isFinite(fuel) && Number.isFinite(fuelCapacity) && fuelCapacity > 0
    ? clamp(Math.round((fuel / fuelCapacity) * 100), 0, 100)
    : null;

  live = {
    ...live,
    connected: true,
    bridgeConnected: true,
    telemetryReceiving: true,
    packetFresh: true,
    decodeOk: true,
    status: 'recebendo_udp_decodificado',
    updatedAt: now,
    packetSize: packet.length,
    packetVersion: packetKind(packet.length),
    packetId: advanced.packetId,
    ps5Ip: config.ps5Ip,
    velocidade: speed,
    speedKmh: speed,
    rpm,
    marcha: gear,
    gear,
    marchaNumero: gearNumber,
    marchaSugerida: suggestedGear === 15 ? '--' : String(suggestedGear),
    acelerador: throttle,
    throttlePct: throttle,
    freio: brake,
    brakePct: brake,
    combustivel: Number.isFinite(fuel) ? round(fuel) : null,
    combustivelPorcentagem: fuelPct,
    fuelPct,
    fuelCapacity: Number.isFinite(fuelCapacity) ? round(fuelCapacity) : null,
    totalLaps: totalLaps > 0 ? totalLaps : 0,
    melhorVolta: activeSession ? live.melhorVolta : validLap(bestLapMs) ? formatMs(bestLapMs) : '--',
    bestLapMs: activeSession ? live.bestLapMs : validLap(bestLapMs) ? bestLapMs : 0,
    ultimaVolta: activeSession ? live.ultimaVolta : validLap(lastLapMs) ? formatMs(lastLapMs) : '--',
    lastLapMs: activeSession ? live.lastLapMs : validLap(lastLapMs) ? lastLapMs : 0,
    voltaAtualTempo: currentLapMs > 0 ? formatMs(currentLapMs) : '--',
    advanced,
    motecChannels: {
      speedKmh: speed,
      rpm,
      gear,
      suggestedGear: advanced.suggestedGear,
      throttle,
      brake,
      fuel: Number.isFinite(fuel) ? round(fuel) : null,
      fuelPct,
      boost: advanced.boost,
      oilPressure: advanced.oilPressure,
      oilTemp: advanced.oilTemp,
      waterTemp: advanced.waterTemp,
      tyreTemp: advanced.tyreTemp,
      wheelRPS: advanced.wheelRPS,
      suspensionHeight: advanced.suspensionHeight,
      clutch: advanced.clutch,
      gForce: advanced.gForce || {},
      steeringAngularVelocity: advanced.steeringAngularVelocity || 0,
      surfaceType: advanced.surfaceType || '',
      carCategory: advanced.carCategory || '',
      carCode: advanced.carCode,
      packetId: advanced.packetId
    },
    note: 'Bridge GT7 única: heartbeat A e recepção no mesmo socket UDP 33740'
  };
}

function statusSnapshot() {
  const now = Date.now();
  const packetFresh = transport.lastPacketAt > 0 && now - transport.lastPacketAt < PACKET_TIMEOUT_MS;
  const decodedFresh = transport.lastDecodedAt > 0 && now - transport.lastDecodedAt < DECODE_TIMEOUT_MS;
  const status = !transport.bound
    ? 'udp_desligado'
    : decodedFresh
      ? 'recebendo_udp_decodificado'
      : packetFresh
        ? 'recebendo_udp_sem_decode'
        : 'aguardando_pacotes';
  return {
    ...live,
    connected: decodedFresh,
    bridgeConnected: true,
    telemetryReceiving: decodedFresh,
    packetFresh: decodedFresh,
    udpPacketFresh: packetFresh,
    decodeOk: decodedFresh,
    status,
    ps5Ip: config.ps5Ip,
    bridge: {
      online: true,
      uptimeMs: now - startedAt,
      httpPort: HTTP_PORT,
      udpListenPort: UDP_LISTEN_PORT,
      heartbeatPort: PS5_HEARTBEAT_PORT,
      heartbeatByte: 'A',
      sameSocket: true,
      hostAddresses: localAddresses()
    },
    udp: {
      ...transport,
      packetFresh,
      decodedFresh,
      receiving: decodedFresh,
      packetAgeMs: transport.lastPacketAt ? now - transport.lastPacketAt : null,
      decodedAgeMs: transport.lastDecodedAt ? now - transport.lastDecodedAt : null
    }
  };
}

function localAddresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();
  for (const values of Object.values(interfaces)) {
    for (const value of values || []) {
      if (value.family === 'IPv4' && !value.internal) addresses.push(value.address);
    }
  }
  return addresses;
}

function clearHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function scheduleHeartbeat() {
  clearHeartbeat();
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, config.heartbeatIntervalMs);
  heartbeatTimer.unref?.();
}

function sendHeartbeat() {
  if (!udpSocket || !transport.bound || shuttingDown) return false;
  udpSocket.send(HEARTBEAT, 0, HEARTBEAT.length, PS5_HEARTBEAT_PORT, config.ps5Ip, (error) => {
    if (error) {
      transport.lastHeartbeatError = error.message;
      transport.lastError = error.message;
      return;
    }
    transport.lastHeartbeatAt = Date.now();
    transport.lastHeartbeatError = null;
    transport.heartbeatSent += 1;
  });
  return true;
}

function stopUdp() {
  clearHeartbeat();
  const socket = udpSocket;
  udpSocket = null;
  transport.bound = false;
  transport.binding = false;
  transport.localAddress = null;
  if (!socket) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      socket.removeAllListeners('message');
      socket.close(() => resolve());
    } catch {
      resolve();
    }
  });
}

async function startUdp() {
  if (shuttingDown) return;
  await stopUdp();
  const generation = ++socketGeneration;
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: false });
  udpSocket = socket;
  transport.binding = true;
  transport.lastError = null;

  socket.on('error', (error) => {
    if (generation !== socketGeneration) return;
    transport.lastError = error.message;
    transport.bound = false;
    transport.binding = false;
    live.status = 'erro_udp';
    console.error('[UDP]', error.message);
  });

  socket.on('message', (message, remote) => {
    if (generation !== socketGeneration) return;
    const now = Date.now();
    transport.packetsReceived += 1;
    transport.lastPacketAt = now;
    transport.lastPacketSize = message.length;
    transport.lastPacketType = packetKind(message.length);
    transport.lastSourceIp = remote.address;
    transport.lastSourcePort = remote.port;
    live.updatedAt = now;
    live.packetSize = message.length;
    live.packetVersion = packetKind(message.length);

    const decoded = decryptPacket(message);
    if (!decoded) {
      transport.packetsRejected += 1;
      live.decodeOk = false;
      live.status = 'recebendo_udp_sem_decode';
      return;
    }

    try {
      decodeTelemetry(decoded);
      transport.packetsDecoded += 1;
      transport.lastDecodedAt = now;
    } catch (error) {
      transport.packetsRejected += 1;
      transport.lastError = 'decode: ' + error.message;
      live.decodeOk = false;
      live.status = 'erro_decode';
    }
  });

  socket.on('listening', () => {
    if (generation !== socketGeneration) return;
    transport.bound = true;
    transport.binding = false;
    transport.localAddress = socket.address();
    try {
      socket.setRecvBufferSize(4 * 1024 * 1024);
    } catch {
      // O sistema pode limitar o buffer; a Bridge continua funcional.
    }
    live.status = 'aguardando_pacotes';
    console.log(`[UDP] ouvindo 0.0.0.0:${UDP_LISTEN_PORT}; heartbeat A -> ${config.ps5Ip}:${PS5_HEARTBEAT_PORT}`);
    scheduleHeartbeat();
  });

  socket.bind(UDP_LISTEN_PORT, '0.0.0.0');
}

async function restartUdp() {
  await startUdp();
  return statusSnapshot();
}

function json(res, value, code = 200) {
  const payload = JSON.stringify(value);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error('Corpo da requisição excede 1 MB'));
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, { ok: true });
  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && (pathname === '/' || pathname === '/api/health')) {
      const state = statusSnapshot();
      return json(res, {
        ok: true,
        app: 'GT7 Telemetria Bridge',
        version: '5.0.0',
        status: state.status,
        bridgeOnline: true,
        udpBound: state.udp.bound,
        packetFresh: state.packetFresh,
        udpPacketFresh: state.udpPacketFresh,
        telemetryReceiving: state.telemetryReceiving,
        ps5Ip: config.ps5Ip,
        httpPort: HTTP_PORT,
        udpListenPort: UDP_LISTEN_PORT,
        heartbeatPort: PS5_HEARTBEAT_PORT,
        heartbeatByte: 'A',
        sameSocket: true
      });
    }

    if (req.method === 'GET' && ['/api/live', '/api/fields', '/api/status', '/api/telemetry'].includes(pathname)) {
      return json(res, statusSnapshot());
    }

    if (req.method === 'GET' && pathname === '/api/diagnostic') {
      return json(res, { ok: true, state: statusSnapshot(), config, activeSession });
    }

    if (req.method === 'GET' && pathname === '/api/config') {
      return json(res, {
        ok: true,
        config,
        bridge: { httpPort: HTTP_PORT, udpListenPort: UDP_LISTEN_PORT, heartbeatPort: PS5_HEARTBEAT_PORT, heartbeatByte: 'A', sameSocket: true }
      });
    }

    if (req.method === 'POST' && ['/api/config', '/api/settings', '/api/ps5', '/api/config/ps5'].includes(pathname)) {
      const body = await readBody(req);
      const ps5Ip = String(body.ps5Ip || body.ps5_ip || body.ip || config.ps5Ip).trim();
      if (!validIpv4(ps5Ip)) return json(res, { ok: false, error: 'IP do PS5 inválido' }, 400);
      config.ps5Ip = ps5Ip;
      if (body.heartbeatIntervalMs !== undefined) {
        config.heartbeatIntervalMs = clamp(Number(body.heartbeatIntervalMs) || 1000, 500, 5000);
      }
      if (typeof body.autoSession === 'boolean') config.autoSession = body.autoSession;
      live.ps5Ip = config.ps5Ip;
      saveConfig();
      scheduleHeartbeat();
      return json(res, { ok: true, config, heartbeatSent: sendHeartbeat() });
    }

    if (req.method === 'POST' && pathname === '/api/heartbeat') {
      return json(res, { ok: true, sent: sendHeartbeat(), ps5Ip: config.ps5Ip, port: PS5_HEARTBEAT_PORT, byte: 'A' });
    }

    if (req.method === 'POST' && ['/api/restart', '/api/udp/restart'].includes(pathname)) {
      const state = await restartUdp();
      return json(res, { ok: true, state });
    }

    if (req.method === 'POST' && pathname === '/api/session/start') {
      const body = await readBody(req);
      return json(res, { ok: true, session: startSession(body.name || 'Nova seção') });
    }

    if (req.method === 'POST' && pathname === '/api/session/finish') {
      const body = await readBody(req);
      return json(res, { ok: true, session: finishSession(body.name) });
    }

    if (req.method === 'POST' && pathname === '/api/reset') {
      return json(res, { ok: true, session: startSession('Nova seção'), live: statusSnapshot() });
    }

    if (req.method === 'GET' && pathname === '/api/current-session') {
      return json(res, { ok: true, active: activeSession, live: statusSnapshot() });
    }

    if (req.method === 'GET' && pathname === '/api/sessions') {
      return json(res, { ok: true, sessions: database.sessions, active: activeSession });
    }

    if (req.method === 'GET' && pathname === '/api/ranking') {
      return json(res, { ok: true, ranking: database.ranking });
    }

    return json(res, { ok: false, error: 'Endpoint não encontrado', path: pathname }, 404);
  } catch (error) {
    return json(res, { ok: false, error: error.message || String(error) }, 500);
  }
});

server.on('error', (error) => {
  console.error('[HTTP]', error.message);
  process.exitCode = 1;
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Bridge] encerrando por ${signal}`);
  clearHeartbeat();
  await stopUdp();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  console.error('[Bridge] uncaughtException', error);
  transport.lastError = error.message;
});
process.on('unhandledRejection', (error) => {
  console.error('[Bridge] unhandledRejection', error);
  transport.lastError = error && error.message ? error.message : String(error);
});

server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`[HTTP] Bridge em 0.0.0.0:${HTTP_PORT}`);
  startUdp().catch((error) => {
    transport.lastError = error.message;
    console.error('[UDP] falha ao iniciar:', error.message);
  });
});
