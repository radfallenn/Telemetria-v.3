'use strict';

const KEY = Buffer.from('Simulator Interface Packet GT7 ver 0.0', 'ascii').subarray(0, 32);
const MAGIC = 0x47375330;
const SUPPORTED_LENGTHS = new Set([296, 316, 344, 368]);

function readSafely(reader, fallback = 0) {
  try {
    const value = reader();
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

const f32 = (buffer, offset) => readSafely(() => buffer.readFloatLE(offset));
const i32 = (buffer, offset) => readSafely(() => buffer.readInt32LE(offset));
const i16 = (buffer, offset) => readSafely(() => buffer.readInt16LE(offset));
const u16 = (buffer, offset) => readSafely(() => buffer.readUInt16LE(offset));
const u8 = (buffer, offset) => readSafely(() => buffer.readUInt8(offset));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;

function rotateLeft(value, bits) {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function quarterRound(state, a, b, c, d) {
  state[b] ^= rotateLeft((state[a] + state[d]) >>> 0, 7);
  state[c] ^= rotateLeft((state[b] + state[a]) >>> 0, 9);
  state[d] ^= rotateLeft((state[c] + state[b]) >>> 0, 13);
  state[a] ^= rotateLeft((state[d] + state[c]) >>> 0, 18);
}

function salsa20Block(key, nonce, counter) {
  const sigma = Buffer.from('expand 32-byte k', 'ascii');
  const initial = new Uint32Array(16);
  initial[0] = sigma.readUInt32LE(0);
  initial[5] = sigma.readUInt32LE(4);
  initial[10] = sigma.readUInt32LE(8);
  initial[15] = sigma.readUInt32LE(12);
  for (let index = 0; index < 4; index += 1) initial[index + 1] = key.readUInt32LE(index * 4);
  for (let index = 0; index < 4; index += 1) initial[index + 11] = key.readUInt32LE(16 + index * 4);
  initial[6] = nonce.readUInt32LE(0);
  initial[7] = nonce.readUInt32LE(4);
  initial[8] = counter >>> 0;
  initial[9] = Math.floor(counter / 0x100000000) >>> 0;

  const state = new Uint32Array(initial);
  for (let round = 0; round < 10; round += 1) {
    quarterRound(state, 0, 4, 8, 12);
    quarterRound(state, 5, 9, 13, 1);
    quarterRound(state, 10, 14, 2, 6);
    quarterRound(state, 15, 3, 7, 11);
    quarterRound(state, 0, 1, 2, 3);
    quarterRound(state, 5, 6, 7, 4);
    quarterRound(state, 10, 11, 8, 9);
    quarterRound(state, 15, 12, 13, 14);
  }

  const output = Buffer.alloc(64);
  for (let index = 0; index < 16; index += 1) {
    output.writeUInt32LE((state[index] + initial[index]) >>> 0, index * 4);
  }
  return output;
}

function salsa20Xor(input, key, nonce) {
  const output = Buffer.alloc(input.length);
  let counter = 0;
  for (let offset = 0; offset < input.length; offset += 64) {
    const block = salsa20Block(key, nonce, counter);
    const size = Math.min(64, input.length - offset);
    for (let index = 0; index < size; index += 1) output[offset + index] = input[offset + index] ^ block[index];
    counter += 1;
  }
  return output;
}

function decryptPacket(encrypted) {
  if (!Buffer.isBuffer(encrypted) || encrypted.length < 0x44 || !SUPPORTED_LENGTHS.has(encrypted.length)) return null;
  const seed = readSafely(() => encrypted.readUInt32LE(0x40), -1);
  if (seed < 0) return null;

  for (const constant of [0xDEADBEAF, 0xDEADBEEF]) {
    const nonce = Buffer.alloc(8);
    nonce.writeUInt32LE((seed ^ constant) >>> 0, 0);
    nonce.writeUInt32LE(seed >>> 0, 4);
    const decoded = salsa20Xor(encrypted, KEY, nonce);
    if (readSafely(() => decoded.readUInt32LE(0), 0) === MAGIC) return decoded;
  }
  return null;
}

function packetVersion(length) {
  if (length === 296) return 'A';
  if (length === 316) return 'B';
  if (length === 344) return 'B+';
  if (length === 368) return 'C';
  return '?';
}

function decodePacket(packet) {
  if (!Buffer.isBuffer(packet) || readSafely(() => packet.readUInt32LE(0), 0) !== MAGIC) return null;

  const speedKmh = clamp(Math.round(f32(packet, 0x4c) * 3.6), 0, 700);
  const rpm = clamp(Math.round(f32(packet, 0x3c)), 0, 25000);
  const fuelCurrent = f32(packet, 0x44);
  const fuelCapacity = f32(packet, 0x48);
  const fuelPct = fuelCapacity > 0 ? clamp(Math.round((fuelCurrent / fuelCapacity) * 100), 0, 100) : null;
  const gearByte = u8(packet, 0x90);
  const gearNumber = gearByte & 0x0f;
  const suggestedGearNumber = (gearByte >> 4) & 0x0f;

  return {
    protocolVersion: 1,
    packetVersion: packetVersion(packet.length),
    packetLength: packet.length,
    packetId: i32(packet, 0x70),
    speedKmh,
    rpm,
    rpmLimit: clamp(u16(packet, 0x8a) || 9000, 1000, 25000),
    gear: gearNumber === 0 ? 'N' : String(gearNumber),
    gearNumber,
    suggestedGear: suggestedGearNumber === 15 ? null : suggestedGearNumber,
    throttlePct: clamp(Math.round(u8(packet, 0x91) / 2.55), 0, 100),
    brakePct: clamp(Math.round(u8(packet, 0x92) / 2.55), 0, 100),
    fuelCurrent: Number.isFinite(fuelCurrent) ? round(fuelCurrent) : null,
    fuelCapacity: Number.isFinite(fuelCapacity) ? round(fuelCapacity) : null,
    fuelPct,
    lapNumber: i16(packet, 0x74),
    totalLaps: i16(packet, 0x76),
    bestLapMs: i32(packet, 0x78),
    lastLapMs: i32(packet, 0x7c),
    flags: u16(packet, 0x8e),
    tyres: {
      FL: round(f32(packet, 0x60)),
      FR: round(f32(packet, 0x64)),
      RL: round(f32(packet, 0x68)),
      RR: round(f32(packet, 0x6c))
    },
    engine: {
      boost: round(f32(packet, 0x50) - 1),
      oilPressure: round(f32(packet, 0x54)),
      waterTemp: round(f32(packet, 0x58)),
      oilTemp: round(f32(packet, 0x5c))
    },
    carCode: packet.length >= 296 ? i32(packet, 0x124) : 0
  };
}

function decodeEncryptedPacket(encrypted) {
  const decrypted = decryptPacket(encrypted);
  return decrypted ? decodePacket(decrypted) : null;
}

module.exports = { decodeEncryptedPacket, decryptPacket, decodePacket, packetVersion };
