'use strict';

const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
const configFile = path.join(__dirname, 'config.json');
const desiredPs5Ip = process.env.PS5_IP || '192.168.1.81';

function replaceRequired(source, oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`OK: ${label} já aplicado`);
    return source;
  }
  if (!source.includes(oldText)) {
    throw new Error(`Não foi possível localizar o trecho obrigatório: ${label}`);
  }
  console.log(`OK: aplicando ${label}`);
  return source.replace(oldText, newText);
}

let source = fs.readFileSync(serverFile, 'utf8');
source = replaceRequired(
  source,
  'const PORT=8787,UDP_PORT=33740,PS5_PORT=33739,',
  'const PORT=8788,UDP_PORT=33740,PS5_PORT=33739,',
  'porta HTTP 8788',
);
source = replaceRequired(
  source,
  "process.env.PS5_IP||'192.168.1.68'",
  "process.env.PS5_IP||'192.168.1.81'",
  'PS5 padrão 192.168.1.81',
);
source = replaceRequired(
  source,
  "const udp=dgram.createSocket('udp4'),hb=dgram.createSocket('udp4');",
  "const udp=dgram.createSocket('udp4');",
  'socket UDP único',
);
source = replaceRequired(
  source,
  "hb.send(b,0,b.length,PS5_PORT,config.ps5Ip,()=>{});",
  "udp.send(b,0,b.length,PS5_PORT,config.ps5Ip,()=>{});",
  'heartbeat enviado pelo socket receptor',
);
fs.writeFileSync(serverFile, source);

let config = {};
if (fs.existsSync(configFile)) {
  try {
    config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (error) {
    console.warn(`AVISO: config.json inválido; recriando (${error.message})`);
  }
}
if (!config.ps5Ip || config.ps5Ip === '192.168.1.68') config.ps5Ip = desiredPs5Ip;
if (!config.packetType) config.packetType = 'C';
if (typeof config.autoSession !== 'boolean') config.autoSession = true;
fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);

if (!source.includes('const PORT=8788,UDP_PORT=33740,PS5_PORT=33739,')) {
  throw new Error('Validação falhou: porta HTTP 8788 não encontrada');
}
if (!source.includes("const udp=dgram.createSocket('udp4');")) {
  throw new Error('Validação falhou: socket UDP único não encontrado');
}
if (source.includes("hb=dgram.createSocket('udp4')") || source.includes('hb.send(')) {
  throw new Error('Validação falhou: socket de heartbeat separado ainda existe');
}
if (!source.includes("udp.send(b,0,b.length,PS5_PORT,config.ps5Ip,()=>{});")) {
  throw new Error('Validação falhou: heartbeat não usa o socket UDP receptor');
}

console.log(`OK: Bridge HTTP em 0.0.0.0:8788`);
console.log(`OK: Bridge preparada para PS5 ${config.ps5Ip}`);
console.log(`OK: heartbeat ${config.packetType} em UDP 33739 e recepção no mesmo socket UDP 33740`);
