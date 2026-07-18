'use strict';

const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
const configFile = path.join(__dirname, 'config.json');
const marker = 'GT7_UDP_RELAY_V1';

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

if (!source.includes(marker)) {
  source = replaceRequired(
    source,
    "let config={ps5Ip:process.env.PS5_IP||'192.168.1.81',autoSession:true,packetType:'C'};",
    "let config={ps5Ip:process.env.PS5_IP||'192.168.1.81',autoSession:true,packetType:'C',relayTargets:[]};",
    'configuração padrão do relay',
  );

  const relayCore = `/* ${marker} */
const relayStats={packetsFromPs5:0,packetsForwarded:0,sendErrors:0,lastPacketAt:null,lastForwardAt:null,lastError:null};
function validRelayIp(value){let parts=String(value||'').trim().split('.');return parts.length===4&&parts.every(part=>/^\\d{1,3}$/.test(part)&&Number(part)>=0&&Number(part)<=255)}
function normalizeRelayTargets(value){if(!Array.isArray(value))return[];let seen=new Set(),out=[];for(let i=0;i<value.length&&out.length<10;i++){let item=value[i]||{},host=String(item.host||item.ip||'').trim(),port=Number.parseInt(item.port,10);if(!validRelayIp(host)||host==='0.0.0.0'||host==='255.255.255.255'||!Number.isInteger(port)||port<1||port>65535)continue;let key=host+':'+port;if(seen.has(key))continue;seen.add(key);out.push({name:String(item.name||('Destino '+(out.length+1))).slice(0,40),host,port,enabled:item.enabled!==false})}return out}
function relayStatus(){config.relayTargets=normalizeRelayTargets(config.relayTargets);return{enabled:config.relayTargets.some(target=>target.enabled),targets:config.relayTargets,activeTargets:config.relayTargets.filter(target=>target.enabled).length,...relayStats}}
function relayPacket(msg,rinfo){if(!rinfo||rinfo.address!==config.ps5Ip)return;relayStats.packetsFromPs5++;relayStats.lastPacketAt=Date.now();config.relayTargets=normalizeRelayTargets(config.relayTargets);for(const target of config.relayTargets){if(!target.enabled||target.host===config.ps5Ip)continue;if(target.host==='127.0.0.1'&&target.port===UDP_PORT)continue;udp.send(msg,0,msg.length,target.port,target.host,error=>{if(error){relayStats.sendErrors++;relayStats.lastError=String(error.message||error);return}relayStats.packetsForwarded++;relayStats.lastForwardAt=Date.now()})}}
config.relayTargets=normalizeRelayTargets(config.relayTargets);
`;

  source = replaceRequired(
    source,
    "const udp=dgram.createSocket('udp4');",
    `${relayCore}const udp=dgram.createSocket('udp4');`,
    'núcleo do relay UDP',
  );

  source = replaceRequired(
    source,
    "udp.on('message',msg=>{live.connected=true;",
    "udp.on('message',(msg,rinfo)=>{if(!rinfo||rinfo.address!==config.ps5Ip)return;relayPacket(msg,rinfo);live.connected=true;",
    'encaminhamento apenas dos pacotes do PS5',
  );

  source = replaceRequired(
    source,
    "'/api/reset','/api/config']",
    "'/api/reset','/api/relay','/api/config']",
    'endpoint do relay na saúde da Bridge',
  );

  source = replaceRequired(
    source,
    "if(u.pathname==='/api/config'&&req.method==='GET')",
    "if(u.pathname==='/api/relay'&&req.method==='GET')return js(res,{ok:true,relay:relayStatus()});if(u.pathname==='/api/relay'&&req.method==='POST'){try{let j=JSON.parse(await body(req)||'{}'),targets=Array.isArray(j)?j:(j.targets||j.relayTargets||[]);config.relayTargets=normalizeRelayTargets(targets);saveConfig();return js(res,{ok:true,relay:relayStatus()})}catch(e){return js(res,{ok:false,error:String(e)},400)}}if(u.pathname==='/api/config'&&req.method==='GET')",
    'API de configuração do relay',
  );
}

fs.writeFileSync(serverFile, source);

let config = {};
if (fs.existsSync(configFile)) {
  try {
    config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (error) {
    console.warn(`AVISO: config.json inválido; preservando configuração vazia (${error.message})`);
  }
}

if (process.env.RELAY_TARGETS_JSON) {
  try {
    config.relayTargets = JSON.parse(process.env.RELAY_TARGETS_JSON);
  } catch (error) {
    throw new Error(`RELAY_TARGETS_JSON inválido: ${error.message}`);
  }
}
if (!Array.isArray(config.relayTargets)) config.relayTargets = [];
fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);

for (const required of [
  marker,
  'function normalizeRelayTargets',
  'function relayPacket',
  "udp.on('message',(msg,rinfo)=>{if(!rinfo||rinfo.address!==config.ps5Ip)return;relayPacket(msg,rinfo);",
  "u.pathname==='/api/relay'&&req.method==='GET'",
  "u.pathname==='/api/relay'&&req.method==='POST'",
]) {
  if (!source.includes(required)) throw new Error(`Validação falhou: ${required}`);
}

console.log(`OK: relay UDP instalado; ${config.relayTargets.length} destino(s) configurado(s)`);
console.log('OK: API disponível em GET/POST /api/relay');
