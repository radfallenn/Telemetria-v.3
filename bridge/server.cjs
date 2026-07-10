'use strict';

const http = require('http');
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');

const VERSION = '4.1.1-full-telemetry-autofallback';
const PORT = Number(process.env.PORT || 8788);
const UDP_PORT = Number(process.env.GT7_UDP_PORT || 33740);
const HEARTBEAT_PORT = Number(process.env.GT7_HEARTBEAT_PORT || 33739);
const CONNECTED_TIMEOUT_MS = Number(process.env.GT7_CONNECTED_TIMEOUT_MS || 5000);
const FALLBACK_STEP_MS = Number(process.env.GT7_FALLBACK_STEP_MS || 4500);
let PS5_IP = process.env.PS5_IP || '192.168.1.71';
let REQUESTED_PACKET = String(process.env.GT7_PACKET_VERSION || 'C').slice(0, 1);
if (!['A', 'B', '~', 'C'].includes(REQUESTED_PACKET)) REQUESTED_PACKET = 'C';
let ACTIVE_PACKET = REQUESTED_PACKET;
let fallbackIndex = 0;
let lastPacketSwitchAt = Date.now();

const KEY = Buffer.from('Simulator Interface Packet GT7 ver 0.0', 'ascii').subarray(0, 32);
const XOR_BY_SIZE = { 296: 0xDEADBEAF, 316: 0xDEADBEEF, 344: 0x55FABB4F, 368: 0xDEADBEEF };
const VERSION_BY_SIZE = { 296: 'A', 316: 'B', 344: '~', 368: 'C' };
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'full-telemetry-state.json');

const round = (v, d = 2) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
const nowIso = () => new Date().toISOString();

function packetSequence(preferred) {
  if (preferred === 'C') return ['C', 'B', 'A'];
  if (preferred === '~') return ['~', 'B', 'A'];
  if (preferred === 'B') return ['B', 'A'];
  return ['A'];
}

function packetIsFresh() {
  return Boolean(lastPacketAt && Date.now() - lastPacketAt < CONNECTED_TIMEOUT_MS);
}

function selectActivePacket(packet, reason = '') {
  if (!['A', 'B', '~', 'C'].includes(packet)) return;
  if (ACTIVE_PACKET !== packet) {
    console.log(`Pacote ativo ${ACTIVE_PACKET} -> ${packet}${reason ? ` (${reason})` : ''}`);
  }
  ACTIVE_PACKET = packet;
  const sequence = packetSequence(REQUESTED_PACKET);
  fallbackIndex = Math.max(0, sequence.indexOf(packet));
  lastPacketSwitchAt = Date.now();
  if (live?.packet) {
    live.packet.requestedVersion = REQUESTED_PACKET;
    live.packet.activeVersion = ACTIVE_PACKET;
  }
}

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (_) {}
  return { sessions: [], config: { ps5Ip: PS5_IP, packetVersion: REQUESTED_PACKET } };
}
function saveState() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify({ sessions, config: { ps5Ip: PS5_IP, packetVersion: REQUESTED_PACKET } }, null, 2));
    fs.renameSync(STATE_FILE + '.tmp', STATE_FILE);
  } catch (err) { console.error('Falha ao salvar estado:', err.message); }
}

const persisted = readState();
if (persisted.config?.ps5Ip) PS5_IP = persisted.config.ps5Ip;
if (['A', 'B', '~', 'C'].includes(persisted.config?.packetVersion)) REQUESTED_PACKET = persisted.config.packetVersion;
ACTIVE_PACKET = REQUESTED_PACKET;
let sessions = Array.isArray(persisted.sessions) ? persisted.sessions : [];

let packetCount = 0;
let lastPacketAt = 0;
let lastPacketSize = 0;
let decodeErrors = 0;
let previousFuel = null;
let fuelConsumedSession = 0;
let currentSession = newSession();
let lastSeenLastLapMs = 0;
let live = defaultLive();

function newSession() {
  return {
    id: `session-${Date.now()}`,
    startedAt: nowIso(),
    maxSpeedKmh: 0,
    maxRpm: 0,
    fuelConsumedLiters: 0,
    laps: [],
    totalCompletedLapMs: 0,
    validLaps: 0,
    bestLapMs: null,
    lastLapMs: null,
    averageLapMs: null
  };
}

function defaultLive() {
  return {
    packet: { connected: false, version: '-', requestedVersion: REQUESTED_PACKET, activeVersion: ACTIVE_PACKET, size: 0, ageMs: null, packetId: 0, count: 0, decodeErrors: 0 },
    car: { speedKmh: 0, rpm: 0, gear: 'N', suggestedGear: 0, maxSpeedSessionKmh: 0, carCode: null, category: null },
    input: { throttlePct: 0, brakePct: 0, throttleFilteredPct: null, brakeFilteredPct: null },
    lap: { currentLap: 0, totalLaps: 0, bestLapMs: null, lastLapMs: null, currentLapMs: null },
    fuel: { levelLiters: null, capacityLiters: null, percent: null, consumedSessionLiters: 0 },
    tyres: { temp: { fl: null, fr: null, rl: null, rr: null }, speedKmh: { fl: null, fr: null, rl: null, rr: null }, slipRatio: { fl: null, fr: null, rl: null, rr: null } },
    telemetry: {},
    legacy: { connected: false, packetVersion: '-', packetCount: 0, speedKmh: 0, speed: 0, rpm: 0, gear: 'N', throttlePct: 0, brakePct: 0, maxSpeedSessionKmh: 0 }
  };
}

function rotl(v, c) { return ((v << c) | (v >>> (32 - c))) >>> 0; }
function u32(buf, off) { return ((buf[off] || 0) | ((buf[off + 1] || 0) << 8) | ((buf[off + 2] || 0) << 16) | ((buf[off + 3] || 0) << 24)) >>> 0; }
function putU32(buf, off, v) { buf[off] = v & 255; buf[off + 1] = (v >>> 8) & 255; buf[off + 2] = (v >>> 16) & 255; buf[off + 3] = (v >>> 24) & 255; }
function salsaBlock(key, nonce, counter) {
  const c = Buffer.from('expand 32-byte k', 'ascii');
  const s = new Uint32Array(16);
  s[0] = u32(c,0); s[5] = u32(c,4); s[10] = u32(c,8); s[15] = u32(c,12);
  s[1]=u32(key,0); s[2]=u32(key,4); s[3]=u32(key,8); s[4]=u32(key,12);
  s[11]=u32(key,16); s[12]=u32(key,20); s[13]=u32(key,24); s[14]=u32(key,28);
  s[6]=u32(nonce,0); s[7]=u32(nonce,4); s[8]=counter>>>0; s[9]=Math.floor(counter/0x100000000)>>>0;
  const x = new Uint32Array(s);
  const qr=(a,b,c,d)=>{x[b]^=rotl((x[a]+x[d])>>>0,7);x[c]^=rotl((x[b]+x[a])>>>0,9);x[d]^=rotl((x[c]+x[b])>>>0,13);x[a]^=rotl((x[d]+x[c])>>>0,18);};
  for(let i=0;i<10;i++){qr(0,4,8,12);qr(5,9,13,1);qr(10,14,2,6);qr(15,3,7,11);qr(0,1,2,3);qr(5,6,7,4);qr(10,11,8,9);qr(15,12,13,14);}
  const out=Buffer.alloc(64); for(let i=0;i<16;i++) putU32(out,i*4,(x[i]+s[i])>>>0); return out;
}
function salsaXor(data, nonce) {
  const out=Buffer.alloc(data.length); let counter=0;
  for(let off=0;off<data.length;off+=64){const stream=salsaBlock(KEY,nonce,counter++);for(let i=0;i<64&&off+i<data.length;i++)out[off+i]=data[off+i]^stream[i];}
  return out;
}
function decrypt(raw) {
  if (raw.length < 68) return null;
  const iv1=raw.readUInt32LE(64); const preferred=XOR_BY_SIZE[raw.length];
  const xs=[]; if(preferred!=null) xs.push(preferred); for(const x of Object.values(XOR_BY_SIZE)) if(!xs.includes(x)) xs.push(x); xs.push(0);
  for(const xor of xs){const nonce=Buffer.alloc(8);nonce.writeUInt32LE((iv1^xor)>>>0,0);nonce.writeUInt32LE(iv1,4);const d=xor===0?raw:salsaXor(raw,nonce);if(d.length>=4&&d.readUInt32LE(0)===0x47375330)return d;}
  return null;
}

const rf=(b,o)=>o+4<=b.length&&Number.isFinite(b.readFloatLE(o))?b.readFloatLE(o):null;
const ri32=(b,o)=>o+4<=b.length?b.readInt32LE(o):null;
const ru32=(b,o)=>o+4<=b.length?b.readUInt32LE(o):null;
const ri16=(b,o)=>o+2<=b.length?b.readInt16LE(o):null;
const ru16=(b,o)=>o+2<=b.length?b.readUInt16LE(o):null;
const ru8=(b,o)=>o<b.length?b.readUInt8(o):null;
const vec3=(b,o)=>({x:round(rf(b,o)),y:round(rf(b,o+4)),z:round(rf(b,o+8))});
const vec4=(b,o)=>({fl:round(rf(b,o)),fr:round(rf(b,o+4)),rl:round(rf(b,o+8)),rr:round(rf(b,o+12))});
const arr8=(b,o)=>Array.from({length:8},(_,i)=>round(rf(b,o+i*4)));
function string4(b,o){if(o+4>b.length)return null;return b.subarray(o,o+4).toString('ascii').replace(/\0/g,'').trim()||null;}
function surfaceName(c){return ({T:'Asfalto',C:'Zebra',D:'Terra/Grama',G:'Grama',S:'Areia',N:'Neve'})[c]||c||null;}
function flagsObject(raw){return {carOnTrack:!!(raw&1),paused:!!(raw&2),loadingOrProcessing:!!(raw&4),inGear:!!(raw&8),hasTurbo:!!(raw&16),revLimiterAlert:!!(raw&32),handBrake:!!(raw&64),lights:!!(raw&128),highBeam:!!(raw&256),lowBeam:!!(raw&512),asm:!!(raw&1024),tcs:!!(raw&2048)};}

function decode(raw) {
  const b=decrypt(raw); if(!b) return null;
  const version=VERSION_BY_SIZE[b.length]||VERSION_BY_SIZE[raw.length]||'?';
  const speedMs=rf(b,76)||0, speedKmh=speedMs*3.6;
  const wheelRps=vec4(b,164), tyreRadius=vec4(b,180);
  const wheelSpeed={}; const slip={};
  for(const k of ['fl','fr','rl','rr']){const ws=Math.abs(3.6*(tyreRadius[k]||0)*(wheelRps[k]||0));wheelSpeed[k]=round(ws,2);slip[k]=speedKmh>0.5?round(ws/speedKmh,3):0;}
  const fuelLevel=rf(b,68), fuelCap=rf(b,72), gearByte=ru8(b,144)||0, flagsRaw=ru16(b,142)||0;
  const t={
    packetVersion:version, packetSize:b.length, magic:ru32(b,0), packetId:ri32(b,112),
    position:vec3(b,4), worldVelocity:vec3(b,16), rotation:{pitch:round(rf(b,28)),yaw:round(rf(b,32)),roll:round(rf(b,36))},
    orientationRelativeToNorth:round(rf(b,40)), angularVelocity:vec3(b,44), bodyHeightM:round(rf(b,56),4),
    engine:{rpm:round(rf(b,60),0),boostRaw:round(rf(b,80),3),boostBar:round((rf(b,80)||1)-1,3),oilPressureBar:round(rf(b,84),2),waterTempC:round(rf(b,88),1),oilTempC:round(rf(b,92),1),minAlertRpm:ri16(b,136),maxAlertRpm:ri16(b,138),revLimiterActive:!!(flagsRaw&32)},
    fuel:{levelLiters:round(fuelLevel,2),capacityLiters:round(fuelCap,2),percent:fuelCap>0?round(fuelLevel/fuelCap*100,1):null,powertrain:fuelCap===0?'Elétrico':fuelCap===5?'Kart/Híbrido':'Combustão'},
    motion:{speedMs:round(speedMs,3),speedKmh:round(speedKmh,1)},
    tyres:{temperatureC:vec4(b,96),wheelRps,tyreRadiusM:tyreRadius,wheelSpeedKmh:wheelSpeed,slipRatio:slip,suspensionHeightM:vec4(b,196)},
    lap:{count:ri16(b,116),total:ri16(b,118),bestMs:ri32(b,120)>0?ri32(b,120):null,lastMs:ri32(b,124)>0?ri32(b,124):null,dayProgressionMs:ri32(b,128),currentMs:b.length>=368&&ri32(b,348)>0?ri32(b,348):null},
    race:{startPosition:ri16(b,132),preRaceCars:ri16(b,134)},
    transmission:{currentGear:gearByte&15,suggestedGear:(gearByte>>4)&15,calculatedMaxSpeedKmh:ri16(b,140),topSpeedRatio:round(rf(b,256),4),gearRatios:arr8(b,260)},
    input:{throttleRaw:ru8(b,145),brakeRaw:ru8(b,146),throttlePct:round((ru8(b,145)||0)/255*100,1),brakePct:round((ru8(b,146)||0)/255*100,1)},
    road:{plane:vec3(b,148),planeDistanceM:round(rf(b,160),4)},
    unknownA:arr8(b,212),
    clutch:{pedal:round(rf(b,244),3),engagement:round(rf(b,248),3),rpmToGearbox:round(rf(b,252),0)},
    carCode:ru32(b,292), flagsRaw, flags:flagsObject(flagsRaw)
  };
  if(b.length>=316){t.packetB={wheelRotationRad:round(rf(b,296),4),steeringAngularVelocityRadS:round(rf(b,300),4),sway:round(rf(b,304),4),heave:round(rf(b,308),4),surge:round(rf(b,312),4),gForce:{lateral:round((rf(b,304)||0)/9.81,3),vertical:round((rf(b,308)||0)/9.81,3),longitudinal:round((rf(b,312)||0)/9.81,3)}};}
  if(b.length>=344){t.packetTilda={throttleFilteredRaw:ru8(b,316),brakeFilteredRaw:ru8(b,317),throttleFilteredPct:round((ru8(b,316)||0)/255*100,1),brakeFilteredPct:round((ru8(b,317)||0)/255*100,1),unknownByte1:ru8(b,318),unknownByte2:ru8(b,319),torqueVector:vec4(b,320),energyRecovery:round(rf(b,336),4),unknownFloat11:round(rf(b,340),4)};}
  if(b.length>=368){const sr=string4(b,344)||'';const sRaw={fl:sr[0]||null,fr:sr[1]||null,rl:sr[2]||null,rr:sr[3]||null};t.packetC={surfaceRaw:sRaw,surface:{fl:surfaceName(sRaw.fl),fr:surfaceName(sRaw.fr),rl:surfaceName(sRaw.rl),rr:surfaceName(sRaw.rr)},currentLapMs:ri32(b,348),wheelSteeringAngleRad:{fl:round(rf(b,352),4),fr:round(rf(b,356),4)},wheelBaseM:round(rf(b,360),3),carCategory:string4(b,364)};}
  return t;
}

function updateSession(t) {
  currentSession.maxSpeedKmh=Math.max(currentSession.maxSpeedKmh,t.motion.speedKmh||0);
  currentSession.maxRpm=Math.max(currentSession.maxRpm,t.engine.rpm||0);
  const fuel=t.fuel.levelLiters;
  if(Number.isFinite(fuel)&&Number.isFinite(previousFuel)&&fuel<=previousFuel&&previousFuel-fuel<5)fuelConsumedSession+=previousFuel-fuel;
  if(Number.isFinite(fuel))previousFuel=fuel;
  currentSession.fuelConsumedLiters=round(fuelConsumedSession,3);
  const last=t.lap.lastMs;
  if(last&&last>0&&last!==lastSeenLastLapMs){lastSeenLastLapMs=last;currentSession.laps.push({lap:currentSession.laps.length+1,ms:last,valid:true,maxSpeedKmh:currentSession.maxSpeedKmh,at:nowIso()});currentSession.lastLapMs=last;currentSession.bestLapMs=currentSession.bestLapMs==null?last:Math.min(currentSession.bestLapMs,last);currentSession.validLaps=currentSession.laps.length;currentSession.totalCompletedLapMs=currentSession.laps.reduce((a,x)=>a+x.ms,0);currentSession.averageLapMs=Math.round(currentSession.totalCompletedLapMs/currentSession.laps.length);saveState();}
}

function applyDecoded(t) {
  updateSession(t);
  selectActivePacket(t.packetVersion, 'pacote detectado');
  live.packet={connected:true,version:t.packetVersion,requestedVersion:REQUESTED_PACKET,activeVersion:ACTIVE_PACKET,size:t.packetSize,ageMs:0,packetId:t.packetId,count:packetCount,decodeErrors};
  live.car={speedKmh:t.motion.speedKmh,rpm:t.engine.rpm,gear:t.transmission.currentGear===0?'N':String(t.transmission.currentGear),suggestedGear:t.transmission.suggestedGear,maxSpeedSessionKmh:round(currentSession.maxSpeedKmh,1),carCode:t.carCode,category:t.packetC?.carCategory||null};
  live.input={throttlePct:t.input.throttlePct,brakePct:t.input.brakePct,throttleFilteredPct:t.packetTilda?.throttleFilteredPct??null,brakeFilteredPct:t.packetTilda?.brakeFilteredPct??null};
  live.lap={currentLap:t.lap.count,totalLaps:t.lap.total,bestLapMs:t.lap.bestMs,lastLapMs:t.lap.lastMs,currentLapMs:t.packetC?.currentLapMs??t.lap.currentMs};
  live.fuel={levelLiters:t.fuel.levelLiters,capacityLiters:t.fuel.capacityLiters,percent:t.fuel.percent,consumedSessionLiters:round(fuelConsumedSession,3)};
  live.tyres={temp:t.tyres.temperatureC,speedKmh:t.tyres.wheelSpeedKmh,slipRatio:t.tyres.slipRatio};
  live.telemetry=t;
  live.legacy={connected:true,packetVersion:t.packetVersion,packetCount,speedKmh:t.motion.speedKmh,speed:t.motion.speedKmh,rpm:t.engine.rpm,gear:live.car.gear,throttlePct:t.input.throttlePct,brakePct:t.input.brakePct,maxSpeedSessionKmh:live.car.maxSpeedSessionKmh};
}

function responseSession(){return {...currentSession,laps:currentSession.laps.slice(-200),maxSpeedKmh:round(currentSession.maxSpeedKmh,1),fuelConsumedLiters:round(fuelConsumedSession,3)};}
function sendJson(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
function readBody(req){return new Promise(resolve=>{let s='';req.on('data',d=>s+=d);req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch{resolve({});}});});}

const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS')return sendJson(res,200,{ok:true});
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/health')return sendJson(res,200,{ok:true,status:'ONLINE',version:VERSION,port:PORT,packets:packetCount,lastPacketAgeMs:lastPacketAt?Date.now()-lastPacketAt:null,lastPacketSize,connectedToPs5:packetIsFresh(),decodeErrors,udp:{ps5Ip:PS5_IP,listeningPort:UDP_PORT,heartbeatPort:HEARTBEAT_PORT,requestedPacket:REQUESTED_PACKET,activePacket:ACTIVE_PACKET,detectedPacket:live.packet.version,fallbackOrder:packetSequence(REQUESTED_PACKET)}});
  if(url.pathname==='/api/live') { live.packet.connected=packetIsFresh(); live.packet.ageMs=lastPacketAt?Date.now()-lastPacketAt:null; live.packet.requestedVersion=REQUESTED_PACKET; live.packet.activeVersion=ACTIVE_PACKET; live.legacy.connected=live.packet.connected; return sendJson(res,200,{live,session:responseSession()}); }
  if(url.pathname==='/api/fields')return sendJson(res,200,{version:VERSION,packetVersions:{A:296,B:316,'~':344,C:368},telemetry:live.telemetry});
  if(url.pathname==='/api/config'&&req.method==='POST'){const body=await readBody(req);if(typeof body.ps5Ip==='string'&&body.ps5Ip.trim())PS5_IP=body.ps5Ip.trim();if(['A','B','~','C'].includes(body.packetVersion)){REQUESTED_PACKET=body.packetVersion;fallbackIndex=0;lastPacketAt=0;selectActivePacket(REQUESTED_PACKET,'preferência alterada');}live.packet.requestedVersion=REQUESTED_PACKET;live.packet.activeVersion=ACTIVE_PACKET;saveState();return sendJson(res,200,{ok:true,ps5Ip:PS5_IP,packetVersion:REQUESTED_PACKET,activePacket:ACTIVE_PACKET});}
  if(url.pathname==='/api/session/start'&&req.method==='POST'){if(currentSession.laps.length||currentSession.maxSpeedKmh>0){sessions.unshift({...currentSession,finishedAt:nowIso()});sessions=sessions.slice(0,100);}currentSession=newSession();fuelConsumedSession=0;previousFuel=null;lastSeenLastLapMs=0;saveState();return sendJson(res,200,{ok:true,session:responseSession()});}
  if(url.pathname==='/api/session/history')return sendJson(res,200,{sessions});
  return sendJson(res,200,{ok:true,name:'GT7 Telemetria V4 Full',version:VERSION,endpoints:['/api/health','/api/live','/api/fields','/api/config','/api/session/start','/api/session/history']});
});

server.listen(PORT,'0.0.0.0',()=>console.log(`GT7 Full Telemetry ${VERSION} em http://0.0.0.0:${PORT}`));
const udp=dgram.createSocket({type:'udp4',reuseAddr:true});
udp.on('message',(msg)=>{packetCount++;lastPacketAt=Date.now();lastPacketSize=msg.length;try{const t=decode(msg);if(t)applyDecoded(t);else decodeErrors++;}catch(err){decodeErrors++;console.error('Decode:',err.message);}});
udp.on('error',err=>console.error('UDP:',err.message));
udp.bind(UDP_PORT,'0.0.0.0',()=>console.log(`UDP GT7 em 0.0.0.0:${UDP_PORT}, preferência ${REQUESTED_PACKET}, ativo ${ACTIVE_PACKET}`));
setInterval(()=>{
  if (!packetIsFresh() && Date.now() - lastPacketSwitchAt >= FALLBACK_STEP_MS) {
    const sequence = packetSequence(REQUESTED_PACKET);
    fallbackIndex = (fallbackIndex + 1) % sequence.length;
    selectActivePacket(sequence[fallbackIndex], 'fallback sem pacotes');
  }
  udp.send(Buffer.from(ACTIVE_PACKET),HEARTBEAT_PORT,PS5_IP,()=>{});
},1000);
setInterval(saveState,30000);
process.on('SIGINT',()=>{saveState();process.exit(0);});
process.on('SIGTERM',()=>{saveState();process.exit(0);});
