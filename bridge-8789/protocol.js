'use strict';

const KEY = Buffer.from('Simulator Interface Packet GT7 ver 0.0', 'ascii').subarray(0, 32);
const MAGIC = 0x47375330;

function safe(reader, fallback = 0) {
  try {
    const value = reader();
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

const f32 = (buffer, offset) => safe(() => buffer.readFloatLE(offset));
const i32 = (buffer, offset) => safe(() => buffer.readInt32LE(offset));
const i16 = (buffer, offset) => safe(() => buffer.readInt16LE(offset));
const u16 = (buffer, offset) => safe(() => buffer.readUInt16LE(offset));
const u8 = (buffer, offset) => safe(() => buffer.readUInt8(offset));
const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
  for (let index = 0; index < 4; index += 1) state[1 + index] = key.readUInt32LE(index * 4);
  for (let index = 0; index < 4; index += 1) state[11 + index] = key.readUInt32LE(16 + index * 4);
  state[6] = iv.readUInt32LE(0);
  state[7] = iv.readUInt32LE(4);
  state[8] = counter >>> 0;
  const work = new Uint32Array(state);
  for (let index = 0; index < 10; index += 1) {
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
  for (let index = 0; index < 16; index += 1) output.writeUInt32LE((work[index] + state[index]) >>> 0, index * 4);
  return output;
}

function salsaXor(input, key, iv) {
  const output = Buffer.alloc(input.length);
  let counter = 0;
  for (let offset = 0; offset < input.length; offset += 64) {
    const block = salsaBlock(key, iv, counter++);
    const length = Math.min(64, input.length - offset);
    for (let index = 0; index < length; index += 1) output[offset + index] = input[offset + index] ^ block[index];
  }
  return output;
}

function decrypt(packet) {
  if (!Buffer.isBuffer(packet) || packet.length < 0x44) return null;
  const seed = safe(() => packet.readUInt32LE(0x40), -1);
  if (seed < 0) return null;
  for (const constant of [0xDEADBEAF, 0xDEADBEEF, 0x55FABB4F]) {
    const iv = Buffer.alloc(8);
    iv.writeUInt32LE((seed ^ constant) >>> 0, 0);
    iv.writeUInt32LE(seed >>> 0, 4);
    const decoded = salsaXor(packet, KEY, iv);
    if (safe(() => decoded.readUInt32LE(0), 0) === MAGIC) return decoded;
  }
  return null;
}

function packetType(length) {
  return length === 368 ? 'C' : length === 344 ? '~' : length === 316 ? 'B' : length === 296 ? 'A' : '?';
}

function decode(packet) {
  const speed = clamp(Math.round(f32(packet, 0x4c) * 3.6), 0, 700);
  const rpm = clamp(Math.round(f32(packet, 0x3c)), 0, 25000);
  const fuelCurrent = f32(packet, 0x44);
  const fuelCapacity = f32(packet, 0x48);
  const fuelPct = fuelCapacity > 0 ? clamp(Math.round((fuelCurrent / fuelCapacity) * 100), 0, 100) : null;
  const gearByte = u8(packet, 0x90);
  const gearNumber = gearByte & 15;
  const suggestedGear = (gearByte >> 4) & 15;
  const gear = gearNumber === 0 ? 'N' : String(gearNumber);
  const throttle = clamp(Math.round(u8(packet, 0x91) / 2.55), 0, 100);
  const brake = clamp(Math.round(u8(packet, 0x92) / 2.55), 0, 100);
  const tyreTemp = {
    FL: round(f32(packet, 0x60)), FR: round(f32(packet, 0x64)),
    RL: round(f32(packet, 0x68)), RR: round(f32(packet, 0x6c))
  };
  const advanced = {
    packetType: packetType(packet.length),
    packetId: i32(packet, 0x70),
    boost: round(f32(packet, 0x50) - 1),
    oilPressure: round(f32(packet, 0x54)),
    waterTemp: round(f32(packet, 0x58)),
    oilTemp: round(f32(packet, 0x5c)),
    tyreTemp,
    flags: u16(packet, 0x8e),
    currentGear: gear,
    suggestedGear: suggestedGear === 15 ? '--' : suggestedGear,
    carCode: i32(packet, 0x124),
    currentLapMs: packet.length >= 368 ? i32(packet, 0x15c) : 0
  };
  return {
    speed,
    rpm,
    gear,
    gearNumber,
    suggestedGear: suggestedGear === 15 ? '--' : String(suggestedGear),
    throttle,
    brake,
    fuelCurrent: Number.isFinite(fuelCurrent) ? round(fuelCurrent) : null,
    fuelCapacity: Number.isFinite(fuelCapacity) ? round(fuelCapacity) : null,
    fuelPct,
    lapNumber: i16(packet, 0x74),
    totalLaps: i16(packet, 0x76),
    bestLapMs: i32(packet, 0x78),
    lastLapMs: i32(packet, 0x7c),
    packetId: advanced.packetId,
    packetType: advanced.packetType,
    advanced,
    motecChannels: {
      speedKmh: speed, rpm, gear, throttle, brake,
      fuel: Number.isFinite(fuelCurrent) ? round(fuelCurrent) : null,
      fuelPct, boost: advanced.boost, oilPressure: advanced.oilPressure,
      oilTemp: advanced.oilTemp, waterTemp: advanced.waterTemp,
      tyreTemp, carCode: advanced.carCode, packetId: advanced.packetId
    }
  };
}

module.exports = { decrypt, decode, packetType };
