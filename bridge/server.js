const http = require('http');
const dgram = require('dgram');
const fs = require('fs');

const PORT = 8787;
const UDP_PORT = 33740;
const PS5_PORT = 33739;
const CONFIG_FILE = './config.json';

let config = { ps5Ip: process.env.PS5_IP || '192.168.1.68' };
try { config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }; } catch {}

let lapTimes = [];
let lastStoredLapMs = 0;
let lastStoredLapNumber = 0;
let currentLapNumber = 0;
let currentLapStartedAt = 0;

let data = {
  connected: false,
  status: 'aguardando_pacotes',
  decodeOk: false,
  updatedAt: null,
  packetSize: 0,
  packetVersion: '?',
  velocidade: 0,
  velocidadeMaxima: 0,
  rpm: 0,
  marcha: 'N',
  marchaNumero: 0,
  acelerador: 0,
  freio: 0,
  combustivel: null,
  combustivelPorcentagem: null,
  fuelCapacity: null,
  melhorVolta: '--',
  ultimaVolta: '--',
  voltaAtualTempo: '--',
  tempoTotalCorrida: '--',
  mediaVoltas: '--',
  voltasCompletadas: 0,
  voltasCorrigidas: 0,
  voltasCorridas: 0,
  lapTimes: [],
  lapDebug: {},
  ps5Ip: config.ps5Ip,
  note: 'Telemetria v3 Bridge ativo. IP do PS5 alteravel pelo app.'
};

function readFloat(b,o){ try{return b.readFloatLE(o)}catch{return 0} }
function readInt32(b,o){ try{return b.readInt32LE(o)}catch{return 0} }
function readUInt32(b,o){ try{return b.readUInt32LE(o)}catch{return 0} }
function readInt16(b,o){ try{return b.readInt16LE(o)}catch{return 0} }
function readUInt16(b,o){ try{return b.readUInt16LE(o)}catch{return 0} }
function readUInt8(b,o){ try{return b.readUInt8(o)}catch{return 0} }
function lap(ms){
  if(!ms || ms <= 0) return '--';
  const m=Math.floor(ms/60000), sec=Math.floor((ms%60000)/1000), z=Math.floor(ms%1000);
  return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0')+'.'+String(z).padStart(3,'0');
}
function sum(arr){ return arr.reduce((a,b)=>a+b,0); }
function computeAverage(times){
  if(!times.length) return '--';
  let used = times.slice();
  if(used.length > 10){
    used = used.slice().sort((a,b)=>a-b).slice(3, -3);
  }
  if(!used.length) return '--';
  return lap(Math.round(sum(used) / used.length));
}
function scanLapDebug(buf){
  const intMs = [];
  const floatSec = [];
  const lapNums = [];
  const interestingOffsets = {};
  for(let o=0; o<=buf.length-4; o+=4){
    const i = readInt32(buf,o);
    const u = readUInt32(buf,o);
    const f = readFloat(buf,o);
    if(i >= 10000 && i <= 900000) intMs.push({off:'0x'+o.toString(16), type:'i32ms', value:i, time:lap(i)});
    if(u >= 10000 && u <= 900000 && u !== i) intMs.push({off:'0x'+o.toString(16), type:'u32ms', value:u, time:lap(u)});
    if(f >= 10 && f <= 900) floatSec.push({off:'0x'+o.toString(16), type:'f32sec', value:Number(f.toFixed(3)), time:lap(Math.round(f*1000))});
    if(o >= 0x60 && o <= 0x90){
      interestingOffsets['0x'+o.toString(16)] = { i32:i, u32:u, f32:Number.isFinite(f)?Number(f.toFixed(3)):null };
    }
  }
  for(let o=0; o<=buf.length-2; o+=2){
    const u = readUInt16(buf,o);
    const i = readInt16(buf,o);
    if(o >= 0x60 && o <= 0x96 && u >= 0 && u <= 200 && (u > 0 || i > 0)) lapNums.push({off:'0x'+o.toString(16), u16:u, i16:i});
  }
  return {
    packetSize: buf.length,
    possibleLapTimesMs: intMs.slice(0,20),
    possibleLapTimesSec: floatSec.slice(0,20),
    possibleLapNumbers: lapNums.slice(0,30),
    knownOffsets: {
      currentLap_0x74_i16: readInt16(buf,0x74),
      bestLap_0x78_i32: readInt32(buf,0x78),
      lastLap_0x7c_i32: readInt32(buf,0x7c),
      speed_0x4c: Number(readFloat(buf,0x4c).toFixed(3)),
      rpm_0x3c: Number(readFloat(buf,0x3c).toFixed(3))
    },
    window_0x60_0x90: interestingOffsets
  };
}
function rotl(v,c){ return ((v << c) | (v >>> (32-c))) >>> 0; }
function qr(x,a,b,c,d){
  x[b]^=rotl((x[a]+x[d])>>>0,7);
  x[c]^=rotl((x[b]+x[a])>>>0,9);
  x[d]^=rotl((x[c]+x[b])>>>0,13);
  x[a]^=rotl((x[d]+x[c])>>>0,18);
}
function salsaBlock(key,iv,counter){
  const sigma=Buffer.from('expand 32-byte k');
  const st=new Uint32Array(16);
  st[0]=sigma.readUInt32LE(0); st[5]=sigma.readUInt32LE(4); st[10]=sigma.readUInt32LE(8); st[15]=sigma.readUInt32LE(12);
  for(let i=0;i<4;i++) st[1+i]=key.readUInt32LE(i*4);
  for(let i=0;i<4;i++) st[11+i]=key.readUInt32LE(16+i*4);
  st[6]=iv.readUInt32LE(0); st[7]=iv.readUInt32LE(4);
  st[8]=counter>>>0; st[9]=0;
  const x=new Uint32Array(st);
  for(let i=0;i<10;i++){
    qr(x,0,4,8,12); qr(x,5,9,13,1); qr(x,10,14,2,6); qr(x,15,3,7,11);
    qr(x,0,1,2,3); qr(x,5,6,7,4); qr(x,10,11,8,9); qr(x,15,12,13,14);
  }
  const out=Buffer.alloc(64);
  for(let i=0;i<16;i++) out.writeUInt32LE((x[i]+st[i])>>>0,i*4);
  return out;
}
function salsaXor(buf,key,iv){
  const out=Buffer.alloc(buf.length);
  let counter=0;
  for(let off=0;off<buf.length;off+=64){
    const block=salsaBlock(key,iv,counter++);
    for(let i=0;i<Math.min(64,buf.length-off);i++) out[off+i]=buf[off+i]^block[i];
  }
  return out;
}
function decryptGT7(msg){
  try{
    const key=Buffer.from('Simulator Interface Packet GT7 ver 0.0').subarray(0,32);
    const iv1=msg.readUInt32LE(0x40);
    const iv2=(iv1 ^ 0xDEADBEAF)>>>0;
    const iv=Buffer.alloc(8);
    iv.writeUInt32LE(iv2,0);
    iv.writeUInt32LE(iv1,4);
    const out=salsaXor(msg,key,iv);
    if(out.readUInt32LE(0)!==0x47375330) return null;
    return out;
  }catch(e){ console.log('Erro decoder:',e.message); return null; }
}
function decodeGT7(msg){
  const d=decryptGT7(msg);
  if(!d) return false;
  const speed=readFloat(d,0x4C)*3.6;
  const rpm=readFloat(d,0x3C);
  const gear=readUInt8(d,0x90)&0x0F;
  const throttle=readUInt8(d,0x91)/2.55;
  const brake=readUInt8(d,0x92)/2.55;
  const currentLap=readInt16(d,0x74);
  const bestLap=readInt32(d,0x78);
  const lastLap=readInt32(d,0x7C);
  const fuel=readFloat(d,0x44);
  const fuelCap=readFloat(d,0x48);
  const now = Date.now();
  data.lapDebug = scanLapDebug(d);

  if(currentLap === 0){
    lapTimes = [];
    lastStoredLapMs = 0;
    lastStoredLapNumber = 0;
    currentLapNumber = 0;
    currentLapStartedAt = 0;
  }

  if(currentLap > 0 && currentLap !== currentLapNumber){
    currentLapNumber = currentLap;
    currentLapStartedAt = now;
  }

  if(lastLap > 0 && currentLap > 1 && (lastLap !== lastStoredLapMs || currentLap !== lastStoredLapNumber)){
    lapTimes.push(lastLap);
    lastStoredLapMs = lastLap;
    lastStoredLapNumber = currentLap;
  }

  const safeCurrentLap = currentLap>=0&&currentLap<300?currentLap:0;
  const correctedLap = Math.max(0, safeCurrentLap - 1);
  const runningLapMs = currentLapStartedAt && currentLap > 0 ? Math.max(0, now - currentLapStartedAt) : 0;
  const totalMs = sum(lapTimes) + runningLapMs;

  data.decodeOk=true;
  data.status='recebendo_udp_decodificado';
  data.velocidade=Number.isFinite(speed)&&speed>=0&&speed<600?Math.round(speed):0;
  data.velocidadeMaxima=Math.max(data.velocidadeMaxima||0,data.velocidade);
  data.rpm=Number.isFinite(rpm)&&rpm>=0&&rpm<20000?Math.round(rpm):0;
  data.marcha=gear===0?'N':String(gear);
  data.marchaNumero=gear;
  data.acelerador=Math.max(0,Math.min(100,Math.round(throttle)));
  data.freio=Math.max(0,Math.min(100,Math.round(brake)));
  data.voltasCompletadas=safeCurrentLap;
  data.voltasCorrigidas=correctedLap;
  data.voltasCorridas=correctedLap;
  data.lapTimes=lapTimes.map(lap);
  data.melhorVolta=lap(bestLap);
  data.ultimaVolta=lap(lastLap);
  data.voltaAtualTempo=lap(runningLapMs);
  data.tempoTotalCorrida=totalMs > 0 ? lap(totalMs) : '--';
  data.mediaVoltas=computeAverage(lapTimes);
  data.combustivel=Number.isFinite(fuel)?Number(fuel.toFixed(2)):null;
  data.fuelCapacity=Number.isFinite(fuelCap)?Number(fuelCap.toFixed(2)):null;
  data.combustivelPorcentagem=fuelCap>0?Math.round((fuel/fuelCap)*100):null;
  data.note='Pacote decodificado com sucesso. Debug de voltas ativo.';
  return true;
}

function saveConfig(){ fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); }
function packetVersion(n){ return n===368?'C':n===296?'A':n===316?'B':'?'; }
function json(res,obj){ res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}); res.end(JSON.stringify(obj)); }
function readBody(req){ return new Promise(resolve=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>resolve(b));}); }

const udp = dgram.createSocket('udp4');
const heartbeat = dgram.createSocket('udp4');

udp.on('message', msg => {
  data.connected = true;
  data.updatedAt = Date.now();
  data.packetSize = msg.length;
  data.packetVersion = packetVersion(msg.length);
  data.ps5Ip = config.ps5Ip;
  const ok = decodeGT7(msg);
  if(!ok){
    data.decodeOk = false;
    data.status = 'recebendo_udp_sem_decode';
    data.note = 'Pacote recebido, mas nao decodificado.';
  }
  console.log('Pacote UDP recebido: '+msg.length+' bytes | decode='+ok+' | vel='+data.velocidade+' | rpm='+data.rpm+' | marcha='+data.marcha);
});

udp.bind(UDP_PORT, '0.0.0.0', () => console.log('UDP ouvindo '+UDP_PORT));

setInterval(()=>{
  const hb = Buffer.from('A');
  heartbeat.send(hb, 0, hb.length, PS5_PORT, config.ps5Ip, ()=>{});
  if(data.updatedAt && Date.now()-data.updatedAt>5000){ data.connected=false; data.status='aguardando_pacotes'; }
},1000);

const server = http.createServer(async (req,res)=>{
  if(req.method==='OPTIONS') return json(res,{ok:true});
  if(req.url==='/api/fields' || req.url==='/api/health' || req.url==='/api/telemetry') return json(res,data);
  if(req.url==='/api/debug-laps') return json(res,{ok:true, lapDebug:data.lapDebug, lapTimes:data.lapTimes, best:data.melhorVolta, last:data.ultimaVolta, laps:data.voltasCompletadas, corrected:data.voltasCorrigidas});
  if(req.url==='/api/config' && req.method==='GET') return json(res,{ok:true, config, bridge:{port:PORT, udpPort:UDP_PORT, ps5Port:PS5_PORT}});
  if(req.url==='/api/config' && req.method==='POST'){
    try{ const body=JSON.parse(await readBody(req)||'{}'); if(body.ps5Ip){ config.ps5Ip=String(body.ps5Ip).trim(); data.ps5Ip=config.ps5Ip; saveConfig(); } return json(res,{ok:true, config}); }
    catch(e){ return json(res,{ok:false,error:String(e)}); }
  }
  if(req.url==='/api/reset' && req.method==='POST'){
    data.velocidadeMaxima=0; data.melhorVolta='--'; data.ultimaVolta='--'; data.voltaAtualTempo='--'; data.tempoTotalCorrida='--'; data.mediaVoltas='--'; data.voltasCompletadas=0; data.voltasCorrigidas=0; data.voltasCorridas=0; data.lapTimes=[]; lapTimes=[]; lastStoredLapMs=0; lastStoredLapNumber=0; currentLapNumber=0; currentLapStartedAt=0; return json(res,{ok:true});
  }
  return json(res,{ok:true, app:'Telemetria v3 Bridge', endpoints:['/api/fields','/api/config','/api/reset','/api/debug-laps']});
});
server.listen(PORT,'0.0.0.0',()=>console.log('HTTP em '+PORT+' PS5='+config.ps5Ip));
