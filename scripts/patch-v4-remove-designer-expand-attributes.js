const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 REMOVE CARD DESIGNER EXPAND ATTRIBUTES';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

const css=`
/* ${MARK} */
#openDesigner,#designer,#customBuilder,.customBuilder,#fieldEditor,.fieldEditor,
.fieldToolbar .customBtn,[data-action="open-designer"]{display:none!important}
#attributes .telemetryCatalog{display:grid;gap:10px;margin-top:14px}
#attributes .telemetryGroup{grid-column:1/-1;margin:14px 0 4px;color:#87eaff;font-size:13px;font-weight:900;letter-spacing:1.4px}
#attributes .telemetryAttr{padding:13px 15px;border:1px solid #17363a;border-radius:14px;background:#071012;min-width:0}
#attributes .telemetryAttrHead{display:flex;align-items:center;justify-content:space-between;gap:12px}
#attributes .telemetryAttrName{font-family:Georgia,serif;font-weight:800;letter-spacing:1px;color:#d9e1e3;font-size:14px;min-width:0}
#attributes .telemetryAttrValue{color:var(--cyan);font-size:18px;font-weight:700;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%}
#attributes .telemetryAttrPath{color:#718287;font-size:10px;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(min-width:560px){#attributes .telemetryCatalog{grid-template-columns:1fr 1fr}}
`;
html=html.replace('</style>',css+'\n</style>');

const js=`
<script>
/* ${MARK} JS */
(function(){
 'use strict';
 const q=id=>document.getElementById(id);
 const BASE=()=>String(q('bridgeUrl')?.value||localStorage.getItem('gt7_bridge_url')||'http://192.168.1.70:8788').replace(/\/$/,'');
 const CATALOG=[
  ['CORRIDA','speedKmh','Velocidade',['speedKmh','velocidade','car.speedKmh'],'km/h'],
  ['CORRIDA','rpm','RPM',['rpm','car.rpm'],'rpm'],
  ['CORRIDA','gear','Marcha',['gear','marcha','car.gear'],''],
  ['CORRIDA','maxSpeedKmh','Velocidade máxima',['maxSpeedKmh','velocidadeMaxima','session.maxSpeed'],'km/h'],
  ['CORRIDA','position','Posição',['position','posicao'],''],
  ['CORRIDA','carsOnTrack','Carros na pista',['carsOnTrack','carrosNaPista'],''],
  ['VOLTAS','bestLapMs','Melhor volta',['bestLapMs','melhorVolta','lap.bestLapMs','session.bestLapMs'],''],
  ['VOLTAS','lastLapMs','Última volta',['lastLapMs','ultimaVolta','lap.lastLapMs','session.lastLapMs'],''],
  ['VOLTAS','totalTimeMs','Tempo total',['totalTimeMs','tempoTotalCorrida','analysis.total'],''],
  ['VOLTAS','averageLapMs','Média geral',['averageLapMs','mediaGeral','analysis.average'],''],
  ['VOLTAS','validLaps','Voltas válidas',['validLaps','voltasValidas','analysis.laps'],''],
  ['VOLTAS','currentLap','Volta atual',['currentLap','voltaAtual','lap.currentLap'],''],
  ['CONTROLES','throttlePct','Acelerador',['throttlePct','acelerador','input.throttlePct'],'%'],
  ['CONTROLES','brakePct','Freio',['brakePct','freio','input.brakePct'],'%'],
  ['CONTROLES','clutchPct','Embreagem',['clutchPct','embreagem','input.clutchPct'],'%'],
  ['CONTROLES','handbrakePct','Freio de mão',['handbrakePct','freioMao','input.handbrakePct'],'%'],
  ['COMBUSTÍVEL','fuelPct','Nível de combustível',['fuelPct','combustivelPorcentagem','fuel.percent'],'%'],
  ['COMBUSTÍVEL','fuelCurrent','Combustível atual',['fuelCurrent','combustivelAtual','fuel.current'],'L'],
  ['COMBUSTÍVEL','fuelCapacity','Capacidade do tanque',['fuelCapacity','combustivelCapacidade','fuel.capacity'],'L'],
  ['COMBUSTÍVEL','fuelLaps','Autonomia em voltas',['fuelLaps','autonomiaVoltas','fuel.lapsRemaining'],''],
  ['MOTOR','oilTemp','Temperatura do óleo',['oilTemp','temperaturaOleo','engine.oilTemp'],'°C'],
  ['MOTOR','waterTemp','Temperatura da água',['waterTemp','temperaturaAgua','engine.waterTemp'],'°C'],
  ['MOTOR','oilPressure','Pressão do óleo',['oilPressure','pressaoOleo','engine.oilPressure'],''],
  ['MOTOR','boostKpa','Turbo/Boost',['boostKpa','boost','engine.boostKpa'],'kPa'],
  ['MOTOR','engineTorque','Torque do motor',['engineTorque','torque','engine.torque'],'Nm'],
  ['MOTOR','enginePower','Potência do motor',['enginePower','potencia','engine.power'],'cv'],
  ['PNEUS','tyreTempFL','Pneu dianteiro esquerdo',['advanced.tyreTemp.FL','motecChannels.tyreTemp.FL','tyres.temp.FL'],'°C'],
  ['PNEUS','tyreTempFR','Pneu dianteiro direito',['advanced.tyreTemp.FR','motecChannels.tyreTemp.FR','tyres.temp.FR'],'°C'],
  ['PNEUS','tyreTempRL','Pneu traseiro esquerdo',['advanced.tyreTemp.RL','motecChannels.tyreTemp.RL','tyres.temp.RL'],'°C'],
  ['PNEUS','tyreTempRR','Pneu traseiro direito',['advanced.tyreTemp.RR','motecChannels.tyreTemp.RR','tyres.temp.RR'],'°C'],
  ['PNEUS','tyreSlipRatio','Slip dos pneus',['tyreSlipRatio','advanced.tyreSlipRatio'],''],
  ['RODAS','wheelSpeed','Velocidade das rodas',['wheelSpeed','advanced.wheelSpeed'],''],
  ['RODAS','wheelSpeedFL','Roda dianteira esquerda',['advanced.wheelSpeed.FL'],'km/h'],
  ['RODAS','wheelSpeedFR','Roda dianteira direita',['advanced.wheelSpeed.FR'],'km/h'],
  ['RODAS','wheelSpeedRL','Roda traseira esquerda',['advanced.wheelSpeed.RL'],'km/h'],
  ['RODAS','wheelSpeedRR','Roda traseira direita',['advanced.wheelSpeed.RR'],'km/h'],
  ['SUSPENSÃO','suspensionFL','Suspensão dianteira esquerda',['advanced.suspension.FL'],''],
  ['SUSPENSÃO','suspensionFR','Suspensão dianteira direita',['advanced.suspension.FR'],''],
  ['SUSPENSÃO','suspensionRL','Suspensão traseira esquerda',['advanced.suspension.RL'],''],
  ['SUSPENSÃO','suspensionRR','Suspensão traseira direita',['advanced.suspension.RR'],''],
  ['DINÂMICA','gForce','Força G',['gForce','advanced.gForce'],'G'],
  ['DINÂMICA','gForceLateral','Força G lateral',['advanced.gForce.lateral'],'G'],
  ['DINÂMICA','gForceLongitudinal','Força G longitudinal',['advanced.gForce.longitudinal'],'G'],
  ['DINÂMICA','gForceVertical','Força G vertical',['advanced.gForce.vertical'],'G'],
  ['DINÂMICA','yaw','Yaw',['advanced.yaw'],''],
  ['DINÂMICA','pitch','Pitch',['advanced.pitch'],''],
  ['DINÂMICA','roll','Roll',['advanced.roll'],''],
  ['ANÁLISE','grade','UDM Nota',['grade','analysis.grade'],''],
  ['ANÁLISE','score','UDM Score',['score','analysis.score'],''],
  ['ANÁLISE','consistency','Consistência',['consistency','analysis.consistency'],'%'],
  ['ANÁLISE','deltaBestMs','Delta para melhor volta',['deltaBestMs','analysis.deltaBestMs'],''],
  ['SISTEMA','latencyMs','Latência',['latencyMs','latencia'],'ms'],
  ['SISTEMA','packetVersion','Versão do pacote',['packetVersion','packet.version'],''],
  ['SISTEMA','ps5','PS5',['ps5','ps5Ip'],''],
  ['SISTEMA','rasp','Raspberry',['rasp','bridge'],''],
  ['SESSÃO','track','Pista',['track','pista','session.track'],''],
  ['SESSÃO','car','Carro',['carName','carro','session.car'],''],
  ['SESSÃO','tires','Pneus',['tires','pneus','session.tires'],''],
  ['SESSÃO','coach','Coach',['coach','analysis.coach'],'']
 ];
 const discovered=new Map();
 function removeDesigner(){
  ['openDesigner','designer','customBuilder','fieldEditor'].forEach(id=>q(id)?.remove());
  document.querySelectorAll('button').forEach(b=>{if(/DESIGNER DO CARD/i.test(b.textContent||''))b.remove()});
  document.querySelectorAll('.fieldToolbar .customBtn').forEach(e=>e.remove());
 }
 function getPath(obj,path){return String(path).split('.').reduce((a,k)=>a==null?undefined:a[k],obj)}
 function firstValue(data,paths){for(const p of paths){const v=getPath(data,p);if(v!==undefined&&v!==null&&v!=='')return v}return undefined}
 function fmt(v,unit=''){
  if(v===undefined||v===null||v==='')return'--';
  if(Array.isArray(v))v=v.map(x=>typeof x==='number'?Number(x).toFixed(2):String(x)).join(' · ');
  else if(typeof v==='object')v=Object.entries(v).map(([k,x])=>k+': '+(typeof x==='number'?Number(x).toFixed(2):String(x))).join(' · ');
  else if(typeof v==='number')v=Math.abs(v)>=100?Math.round(v):Number(v.toFixed(2));
  return String(v)+(unit?' '+unit:'');
 }
 function flatten(obj,prefix='',depth=0){
  if(!obj||typeof obj!=='object'||depth>3)return;
  Object.entries(obj).forEach(([k,v])=>{
   const p=prefix?prefix+'.'+k:k;
   if(v!==null&&typeof v==='object'&&!Array.isArray(v))flatten(v,p,depth+1);
   else if(['string','number','boolean'].includes(typeof v))discovered.set(p,v);
  });
 }
 function ensureContainer(){
  const page=q('attributes');if(!page)return null;
  let root=q('telemetryCatalog');
  if(!root){root=document.createElement('div');root.id='telemetryCatalog';root.className='telemetryCatalog';page.appendChild(root)}
  return root;
 }
 function renderCatalog(data){
  const root=ensureContainer();if(!root)return;
  const rows=[];let lastGroup='';
  CATALOG.forEach(([group,id,name,paths,unit])=>{
   if(group!==lastGroup){rows.push('<div class="telemetryGroup">'+group+'</div>');lastGroup=group}
   const value=firstValue(data||{},paths);
   rows.push('<div class="telemetryAttr" data-attr-id="'+id+'"><div class="telemetryAttrHead"><span class="telemetryAttrName">'+name+'</span><span class="telemetryAttrValue">'+fmt(value,unit)+'</span></div><div class="telemetryAttrPath">'+paths.join(' · ')+'</div></div>');
  });
  const known=new Set(CATALOG.flatMap(x=>x[3]));
  const extras=[...discovered.entries()].filter(([p])=>!known.has(p)).slice(0,120);
  if(extras.length){rows.push('<div class="telemetryGroup">OUTROS CAMPOS DO BRIDGE</div>');extras.forEach(([p,v])=>rows.push('<div class="telemetryAttr"><div class="telemetryAttrHead"><span class="telemetryAttrName">'+p.split('.').pop()+'</span><span class="telemetryAttrValue">'+fmt(v)+'</span></div><div class="telemetryAttrPath">'+p+'</div></div>'))}
  root.innerHTML=rows.join('');
 }
 async function loadFieldDatabase(){
  try{const r=await fetch(BASE()+'/api/fields',{cache:'no-store'});if(!r.ok)return;const j=await r.json();flatten(j);renderCatalog(window.live||{})}catch{}
 }
 function patchRender(){
  if(typeof window.render!=='function'||window.render.__v4AttrExpanded)return;
  const old=window.render;
  const wrapped=function(d){const out=old.call(this,d);flatten(d||{});if(q('attributes')?.classList.contains('on'))renderCatalog(d||{});return out};
  wrapped.__v4AttrExpanded=true;window.render=wrapped;
 }
 function init(){removeDesigner();patchRender();flatten(window.live||{});renderCatalog(window.live||{});loadFieldDatabase();setTimeout(()=>{removeDesigner();patchRender()},700)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else setTimeout(init,0);
})();
</script>`;
html=html.replace('</body>',js+'\n</body>');
fs.writeFileSync(file,html);
console.log('Designer removido e atributos do APK/API/GitHub adicionados.');
