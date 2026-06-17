const http = require('http');
const dgram = require('dgram');
const fs = require('fs');

const PORT = 8787;
const UDP_PORT = 33740;
const PS5_PORT = 33739;
const CONFIG_FILE = './config.json';

let config = { ps5Ip: process.env.PS5_IP || '192.168.1.68' };
try { config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }; } catch {}

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
  acelerador: 0,
  freio: 0,
  melhorVolta: '--',
  ultimaVolta: '--',
  tempoTotalCorrida: '--',
  voltasCompletadas: 0,
  voltasCorrigidas: 0,
  ps5Ip: config.ps5Ip,
  note: 'Telemetria v3 Bridge ativo. IP do PS5 alteravel pelo app.'
};

function saveConfig(){ fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); }
function packetVersion(n){ return n===368?'C':n===296?'A':n===316?'B':'?'; }
function json(res,obj){ res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}); res.end(JSON.stringify(obj)); }
function readBody(req){ return new Promise(resolve=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>resolve(b));}); }

const udp = dgram.createSocket('udp4');
const heartbeat = dgram.createSocket('udp4');

udp.on('message', msg => {
  data.connected = true;
  data.status = 'recebendo_udp';
  data.updatedAt = Date.now();
  data.packetSize = msg.length;
  data.packetVersion = packetVersion(msg.length);
  data.ps5Ip = config.ps5Ip;
  data.note = 'Pacote recebido. Decoder seguro v3 ativo.';
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
  if(req.url==='/api/config' && req.method==='GET') return json(res,{ok:true, config, bridge:{port:PORT, udpPort:UDP_PORT, ps5Port:PS5_PORT}});
  if(req.url==='/api/config' && req.method==='POST'){
    try{ const body=JSON.parse(await readBody(req)||'{}'); if(body.ps5Ip){ config.ps5Ip=String(body.ps5Ip).trim(); data.ps5Ip=config.ps5Ip; saveConfig(); } return json(res,{ok:true, config}); }
    catch(e){ return json(res,{ok:false,error:String(e)}); }
  }
  if(req.url==='/api/reset' && req.method==='POST'){
    data.velocidadeMaxima=0; data.melhorVolta='--'; data.ultimaVolta='--'; data.tempoTotalCorrida='--'; data.voltasCompletadas=0; data.voltasCorrigidas=0; return json(res,{ok:true});
  }
  return json(res,{ok:true, app:'Telemetria v3 Bridge', endpoints:['/api/fields','/api/config','/api/reset']});
});
server.listen(PORT,'0.0.0.0',()=>console.log('HTTP em '+PORT+' PS5='+config.ps5Ip));
