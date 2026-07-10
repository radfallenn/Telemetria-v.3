const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join('www', 'index.html');
let s = fs.readFileSync(target, 'utf8');

if (s.includes('function renderTelemetryBC')) {
  console.log('Atributos B e C já aplicados');
  process.exit(0);
}

const css = `.telemetryHead{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:8px}.telemetryHead .inp{margin-top:0}.telemetryStatus{display:flex;align-items:center;padding:0 10px;border:1px solid rgba(0,229,255,.25);border-radius:10px;color:var(--c);font:12px var(--mono)}.packetControls{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:12px}.packetControls select{height:39px;border-radius:10px;border:1px solid rgba(0,229,255,.28);background:#050707;color:#fff;font:13px var(--mono);padding:0 9px}.packetControls button{height:39px;margin:0;width:auto;padding:0 14px}.tgroup{margin:0 0 12px}.tgroup h3{margin:0 0 7px;font:900 14px Arial;color:#dffcff;letter-spacing:.08em}.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.metric{min-height:60px;padding:9px 10px;border:1px solid rgba(0,229,255,.16);border-radius:9px;background:#050909}.metric .mn{font:800 9px Arial;color:#98a3aa;letter-spacing:.08em;text-transform:uppercase}.metric .mv{font:500 16px var(--mono);color:#fff;margin-top:5px;word-break:break-word}.metric .mu{font:9px Arial;color:#617178;margin-left:3px}.metric .mp{float:right;color:#00e5ff;font:8px Arial;border:1px solid rgba(0,229,255,.22);border-radius:8px;padding:1px 4px}.metric.na .mv{color:#566267}.metric.bool .mv{color:#00e5ff}.packetNote{font:11px Arial;color:#8e9aa0;line-height:1.35;margin:-3px 0 10px}@media(max-width:380px){.tgrid{grid-template-columns:1fr}.navIn{gap:2px;padding-left:5px;padding-right:5px}.nb{font-size:8px}}`;

const section = `<section id="telemetria" class="page"><h2 class="sectionTitle">TELEMETRIA COMPLETA</h2><div class="telemetryHead"><input id="telemetrySearch" class="inp" placeholder="Buscar atributo"><div id="telemetryStatus" class="telemetryStatus">PACOTE --</div></div><div class="packetControls"><select id="packetSelect"><option value="B">Pacote B — volante e G-Force</option><option value="C" selected>Pacote C — superfície e geometria</option></select><button id="applyPacket" class="btn">SOLICITAR</button></div><div id="packetMessage" class="packetNote">O pacote C inclui os dados do pacote B e acrescenta superfície, ângulo das rodas, entre-eixos e categoria.</div><div id="telemetryAll"></div></section>`;

const js = `
const TELEMETRY_BC_SCHEMA={
  packetB:{
    wheelRotationRad:null,
    steeringAngularVelocityRadS:null,
    sway:null,
    heave:null,
    surge:null,
    gForce:{lateral:null,vertical:null,longitudinal:null}
  },
  packetC:{
    surfaceRaw:{fl:null,fr:null,rl:null,rr:null},
    surface:{fl:null,fr:null,rl:null,rr:null},
    currentLapMs:null,
    wheelSteeringAngleRad:{fl:null,fr:null},
    wheelBaseM:null,
    carCategory:null
  }
};
function mergeTelemetrySchema(schema,data){if(Array.isArray(schema))return Array.isArray(data)?data:schema.slice();if(schema&&typeof schema==='object'){const out={};const keys=new Set([...Object.keys(schema),...Object.keys(data&&typeof data==='object'?data:{})]);keys.forEach(k=>out[k]=mergeTelemetrySchema(schema[k],data&&typeof data==='object'?data[k]:undefined));return out}return data===undefined?schema:data}
function flattenTelemetry(obj,prefix='',out=[]){if(Array.isArray(obj)){obj.forEach((v,i)=>flattenTelemetry(v,prefix?prefix+'.'+i:String(i),out));return out}if(obj&&typeof obj==='object'){Object.entries(obj).forEach(([k,v])=>flattenTelemetry(v,prefix?prefix+'.'+k:k,out));return out}out.push({path:prefix,value:obj});return out}
function telemetryPacketFor(path){return path.startsWith('packetC.')?'C':path.startsWith('packetB.')?'B':'A'}
function telemetryGroup(path){let p=path.split('.')[0]||'geral';const names={packetVersion:'PACOTE',packetSize:'PACOTE',magic:'PACOTE',packetId:'PACOTE',position:'POSIÇÃO',worldVelocity:'VELOCIDADE VETORIAL',rotation:'ROTAÇÃO',orientationRelativeToNorth:'ORIENTAÇÃO',angularVelocity:'VELOCIDADE ANGULAR',bodyHeightM:'CARROCERIA',engine:'MOTOR',fuel:'COMBUSTÍVEL',motion:'MOVIMENTO',tyres:'PNEUS / RODAS / SUSPENSÃO',lap:'VOLTAS',race:'CORRIDA',transmission:'TRANSMISSÃO',input:'COMANDOS',road:'PISTA',unknownA:'DESCONHECIDOS A',clutch:'EMBREAGEM',carCode:'IDENTIFICAÇÃO',flagsRaw:'ESTADOS',flags:'ESTADOS',packetB:'PACOTE B — VOLANTE E G-FORCE',packetC:'PACOTE C — SUPERFÍCIE E GEOMETRIA'};return names[p]||p.toUpperCase()}
function telemetryLabel(path){const last=path.split('.').pop();const names={fl:'Dianteiro esquerdo',fr:'Dianteiro direito',rl:'Traseiro esquerdo',rr:'Traseiro direito',rpm:'RPM',speedKmh:'Velocidade km/h',speedMs:'Velocidade m/s',throttlePct:'Acelerador',brakePct:'Freio',currentGear:'Marcha atual',suggestedGear:'Marcha sugerida',bestMs:'Melhor volta',lastMs:'Última volta',currentMs:'Tempo de volta atual',currentLapMs:'Tempo de volta atual',waterTempC:'Temperatura da água',oilTempC:'Temperatura do óleo',oilPressureBar:'Pressão do óleo',boostBar:'Boost',boostRaw:'Boost bruto',levelLiters:'Nível',capacityLiters:'Capacidade',percent:'Percentual',carOnTrack:'Carro na pista',loadingOrProcessing:'Carregando/processando',hasTurbo:'Tem turbo',revLimiterAlert:'Alerta limitador',handBrake:'Freio de mão',highBeam:'Farol alto',lowBeam:'Farol baixo',wheelRotationRad:'Rotação do volante',steeringAngularVelocityRadS:'Velocidade angular do volante',sway:'Sway lateral',heave:'Heave vertical',surge:'Surge longitudinal',lateral:'G lateral',vertical:'G vertical',longitudinal:'G longitudinal',surfaceRaw:'Superfície bruta',surface:'Superfície',wheelSteeringAngleRad:'Ângulo real das rodas',wheelBaseM:'Distância entre eixos',carCategory:'Categoria do carro'};return names[last]||last.replace(/([A-Z])/g,' $1').replace(/_/g,' ').trim()}
function telemetryUnit(path){if(/Kmh$/.test(path))return'km/h';if(/Ms$/.test(path)&&!path.endsWith('speedMs'))return'ms';if(path.endsWith('speedMs'))return'm/s';if(/TempC$/.test(path)||path.includes('temperatureC.'))return'°C';if(/Liters$/.test(path))return'L';if(/Pct$/.test(path)||path.endsWith('.percent'))return'%';if(/Rpm$/.test(path)||path.endsWith('.rpm'))return'rpm';if(/Bar$/.test(path))return'bar';if(/HeightM$/.test(path)||/RadiusM\./.test(path)||path.endsWith('wheelBaseM')||path.endsWith('planeDistanceM'))return'm';if(/Rad$/.test(path)||path.includes('AngleRad'))return'rad';if(/RadS$/.test(path)||path.includes('wheelRps.'))return'rad/s';if(path.includes('gForce.'))return'g';return''}
function telemetryValueText(v,path){if(v==null||v==='')return'--';if(typeof v==='boolean')return v?'ATIVO':'INATIVO';if((path.endsWith('bestMs')||path.endsWith('lastMs')||path.endsWith('currentMs')||path.endsWith('currentLapMs'))&&typeof ms==='function')return ms(v);if(typeof v==='number'){if(Math.abs(v)>=1000)return Math.round(v).toLocaleString('pt-BR');return Number(v.toFixed(Math.abs(v)<10?3:1)).toString()}return String(v)}
function telemetryFallback(){return{packetVersion:g(L,'packet.version',g(L,'legacy.packetVersion',null)),packetSize:g(L,'packet.size',g(H,'lastPacketSize',null)),motion:{speedKmh:g(L,'car.speedKmh',null)},engine:{rpm:g(L,'car.rpm',null)},transmission:{currentGear:g(L,'car.gear',null),suggestedGear:g(L,'car.suggestedGear',null)},input:{throttlePct:g(L,'input.throttlePct',null),brakePct:g(L,'input.brakePct',null)},lap:{count:g(L,'lap.currentLap',null),total:g(L,'lap.totalLaps',null),bestMs:g(L,'lap.bestLapMs',null),lastMs:g(L,'lap.lastLapMs',null),currentLapMs:g(L,'lap.currentLapMs',null)},fuel:{levelLiters:g(L,'fuel.levelLiters',null),capacityLiters:g(L,'fuel.capacityLiters',null),percent:g(L,'fuel.percent',null)},tyres:{temperatureC:g(L,'tyres.temp',{})}}}
function renderTelemetryBC(){const root=$('telemetryAll');if(!root)return;const source=g(L,'telemetry',null)||telemetryFallback();const data=mergeTelemetrySchema(TELEMETRY_BC_SCHEMA,source);const term=($('telemetrySearch')?.value||'').toLowerCase().trim();const rows=flattenTelemetry(data).filter(x=>!term||(x.path+' '+telemetryLabel(x.path)+' '+telemetryGroup(x.path)).toLowerCase().includes(term));const groups={};rows.forEach(x=>(groups[telemetryGroup(x.path)]??=[]).push(x));const version=g(source,'packetVersion',g(L,'packet.version','--'));const size=g(source,'packetSize',g(L,'packet.size',g(H,'lastPacketSize','--')));$('telemetryStatus').textContent='PACOTE '+version+' · '+size+' B';root.innerHTML=Object.entries(groups).map(([name,items])=>'<div class="tgroup"><h3>'+name+'</h3><div class="tgrid">'+items.map(x=>{const unit=telemetryUnit(x.path),bool=typeof x.value==='boolean';return'<div class="metric '+(x.value==null?'na ':'')+(bool?'bool':'')+'"><span class="mp">'+telemetryPacketFor(x.path)+'</span><div class="mn">'+telemetryLabel(x.path)+'</div><div class="mv">'+telemetryValueText(x.value,x.path)+(x.value!=null&&unit?'<span class="mu">'+unit+'</span>':'')+'</div></div>'}).join('')+'</div></div>').join('')||'<div class="item">Nenhum atributo encontrado.</div>'}
async function requestTelemetryPacket(){const packet=$('packetSelect').value;const msg=$('packetMessage');msg.textContent='Solicitando pacote '+packet+'...';try{const r=await fetch(base.replace(/\/$/,'')+'/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({packetVersion:packet})});if(!r.ok)throw Error(r.status);const j=await r.json();msg.textContent='Pacote '+(j.packetVersion||packet)+' solicitado. Aguarde novos dados do GT7.';localStorage.gt7_packet_version=packet}catch(e){msg.textContent='Não foi possível alterar o pacote: '+e.message}}
`;

if (!s.includes('id="telemetria"')) {
  s = s.replace('grid-template-columns:repeat(5,1fr)', 'grid-template-columns:repeat(6,1fr)');
  s = s.replace('</style>', css + '</style>');
  s = s.replace('<section id="set" class="page">', section + '<section id="set" class="page">');
  s = s.replace('<button class="nb" data-p="set">⚙<br>SET</button>', '<button class="nb" data-p="telemetria">⌁<br>TELEMETRIA</button><button class="nb" data-p="set">⚙<br>SET</button>');
} else {
  s = s.replace('</style>', css + '</style>');
  s = s.replace(/<section id="telemetria" class="page">[\s\S]*?<\/section><section id="set" class="page">/, section + '<section id="set" class="page">');
}

s = s.replace('function R(){', js + 'function R(){');
s = s.replace('marker(f.sp);secList();renderTelemetryFull()', 'marker(f.sp);secList();renderTelemetryBC()');
s = s.replace('marker(f.sp);secList()', 'marker(f.sp);secList();renderTelemetryBC()');
s = s.replace("$('telemetrySearch').oninput=renderTelemetryFull;marker(0);refresh();", "$('telemetrySearch').oninput=renderTelemetryBC;$('applyPacket').onclick=requestTelemetryPacket;$('packetSelect').value=localStorage.gt7_packet_version||'C';marker(0);refresh();");
s = s.replace('marker(0);refresh();', "$('telemetrySearch').oninput=renderTelemetryBC;$('applyPacket').onclick=requestTelemetryPacket;$('packetSelect').value=localStorage.gt7_packet_version||'C';marker(0);refresh();");

fs.writeFileSync(target, s);
console.log('Atributos dos pacotes B e C aplicados em', target);
