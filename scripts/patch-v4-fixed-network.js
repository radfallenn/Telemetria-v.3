const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 FIXED NETWORK 8788 PS5 71';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

// Remove a inicializacao antiga para impedir dois polling loops concorrentes.
html=html.replace(/\$\('bridgeUrl'\)\.value=localStorage\.getItem\('gt7_bridge_url'\)[\s\S]*?timer=setInterval\(poll,700\);/,
  "$('bridgeUrl').value='http://192.168.1.70:8788';$('ps5Ip').value='192.168.1.71';applyPref();renderSegments(0);renderFuel(0);");

const code=`
<script>
/* ${MARK} */
(function(){
 const BRIDGE='http://192.168.1.70:8788';
 const PS5='192.168.1.71';
 const el=id=>document.getElementById(id);
 let loop=null,busy=false,failures=0,lastPayload=null,lastHealth=null;

 function setFixedValues(){
  if(el('bridgeUrl'))el('bridgeUrl').value=BRIDGE;
  if(el('ps5Ip'))el('ps5Ip').value=PS5;
  localStorage.setItem('gt7_bridge_url',BRIDGE);
  localStorage.setItem('gt7_bridge',BRIDGE);
  localStorage.setItem('gt7_ps5_ip',PS5);
 }

 async function req(path,method='GET',data=null,timeout=5500){
  const url=BRIDGE+path;
  const cap=window.Capacitor;
  const nativeHttp=cap&&cap.Plugins&&cap.Plugins.CapacitorHttp;
  if(nativeHttp&&typeof nativeHttp.request==='function'){
   const r=await nativeHttp.request({url,method,headers:{Accept:'application/json','Content-Type':'application/json'},data,connectTimeout:timeout,readTimeout:timeout});
   if(r.status<200||r.status>=300)throw new Error('HTTP '+r.status+' '+path);
   return typeof r.data==='string'?JSON.parse(r.data):r.data;
  }
  const c=new AbortController(),tid=setTimeout(()=>c.abort(),timeout);
  try{
   const r=await fetch(url,{method,cache:'no-store',signal:c.signal,headers:{Accept:'application/json','Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data||{})});
   if(!r.ok)throw new Error('HTTP '+r.status+' '+path);
   return await r.json();
  }finally{clearTimeout(tid)}
 }

 const one=(...v)=>v.find(x=>x!==undefined&&x!==null&&x!==''&&!Number.isNaN(x));
 function fmt(ms){ms=Number(ms)||0;if(ms<=0)return'--';let h=Math.floor(ms/3600000);ms%=3600000;let m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000),z=Math.floor(ms%1000);return(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(z).padStart(3,'0')}
 function adapt(root){
  root=root||{};
  const L=root.live||root;
  const S=root.session||root.active||{};
  const packet=L.packet||{},car=L.car||{},input=L.input||{},lap=L.lap||{},fuel=L.fuel||{},legacy=L.legacy||{},tyres=L.tyres||{};
  const laps=Array.isArray(S.laps)?S.laps:[];
  const valid=Number(one(S.validLaps,lap.validLaps,L.voltasCompletadas,L.voltasCorridas,laps.length,0))||0;
  const bestMs=Number(one(lap.bestLapMs,S.bestLapMs,L.analysis&&L.analysis.bestMs,0))||0;
  const lastMs=Number(one(lap.lastLapMs,S.lastLapMs,L.analysis&&L.analysis.lastMs,0))||0;
  const totalMs=Number(one(S.totalMs,L.analysis&&L.analysis.totalMs,0))||0;
  const avgMs=Number(one(S.avgLapMs,L.analysis&&L.analysis.avgMs,0))||0;
  const tt=(tyres.temp||((L.advanced||{}).tyreTemp)||((L.motecChannels||{}).tyreTemp)||{});
  return {...L,
   connected:true,decodeOk:true,
   velocidade:Number(one(car.speedKmh,legacy.speedKmh,legacy.speed,L.velocidade,0))||0,
   rpm:Number(one(car.rpm,legacy.rpm,L.rpm,0))||0,
   marcha:one(car.gear,legacy.gear,L.marcha,'N'),
   acelerador:Number(one(input.throttlePct,legacy.throttlePct,L.acelerador,0))||0,
   freio:Number(one(input.brakePct,legacy.brakePct,L.freio,0))||0,
   combustivelPorcentagem:one(fuel.percent,L.combustivelPorcentagem,null),
   velocidadeMaxima:Number(one(S.maxSpeed,L.velocidadeMaxima,0))||0,
   melhorVolta:one(L.melhorVolta,bestMs?fmt(bestMs):null,'--'),
   ultimaVolta:one(L.ultimaVolta,lastMs?fmt(lastMs):null,'--'),
   tempoTotalCorrida:one(L.tempoTotalCorrida,totalMs?fmt(totalMs):null,'--'),
   mediaVoltas:one(L.mediaVoltas,avgMs?fmt(avgMs):null,'--'),
   voltasCompletadas:valid,
   lapTimes:Array.isArray(L.lapTimes)?L.lapTimes:laps.map(x=>x.time||x.formatted||x.lapTime||(x.ms?fmt(x.ms):null)).filter(Boolean),
   advanced:{...(L.advanced||{}),tyreTemp:{FL:one(tt.FL,tt.fl),FR:one(tt.FR,tt.fr),RL:one(tt.RL,tt.rl),RR:one(tt.RR,tt.rr)}},
   analysis:L.analysis||S.analysis||{laps:valid,best:bestMs?fmt(bestMs):'--',last:lastMs?fmt(lastMs):'--',total:totalMs?fmt(totalMs):'--',average:avgMs?fmt(avgMs):'--'}
  };
 }

 function status(mode,text,ms){
  if(el('topStatus'))el('topStatus').textContent=mode==='ok'?'OK':mode==='wait'?'...':'OFF';
  if(el('latency'))el('latency').textContent=mode==='ok'?ms+'ms':'--ms';
  if(el('bridgeText'))el('bridgeText').textContent=(mode==='ok'?'OK · ':mode==='wait'?'CONECTANDO · ':'OFF · ')+(text||'GT7-UDP');
  if(el('statusDot'))el('statusDot').style.background=mode==='ok'?'var(--cyan)':mode==='wait'?'#ffb000':'#555';
 }

 async function readLive(){
  try{return await req('/api/live','GET',null,5000)}catch(first){return await req('/api/fields','GET',null,5000)}
 }

 async function applyPs5(){
  const bodies=[['/api/config',{ps5Ip:PS5}],['/api/settings',{ps5Ip:PS5}],['/api/ps5',{ip:PS5}]];
  for(const [p,b] of bodies){try{await req(p,'POST',b,3000);return true}catch{}}
  return false;
 }

 async function connect(){
  setFixedValues();status('wait','GT7-UDP',0);
  try{
   const t=performance.now();
   try{lastHealth=await req('/api/health','GET',null,4500)}catch{lastHealth=null}
   const raw=await readLive();
   const d=adapt(raw);lastPayload=d;failures=0;
   if(typeof render==='function')render(d);
   status('ok',(lastHealth&&lastHealth.app)||'GT7-UDP',Math.round(performance.now()-t));
   applyPs5();
   if(loop)clearInterval(loop);
   loop=setInterval(poll,1000);
   try{if(typeof timer!=='undefined'&&timer){clearInterval(timer);timer=null}}catch{}
   return true;
  }catch(e){
   failures++;
   status('off',e.message||'SEM RESPOSTA',0);
   return false;
  }
 }

 async function poll(){
  if(busy)return;busy=true;
  try{
   const t=performance.now(),raw=await readLive(),d=adapt(raw);
   failures=0;lastPayload=d;
   if(typeof render==='function')render(d);
   status('ok',(lastHealth&&lastHealth.app)||'GT7-UDP',Math.round(performance.now()-t));
  }catch(e){
   failures++;
   // Mantém os dados corretos visíveis durante falhas curtas.
   if(failures<8){
    if(el('bridgeText'))el('bridgeText').textContent='SINAL INSTÁVEL · '+failures+'/8';
    if(el('statusDot'))el('statusDot').style.background='#ffb000';
   }else status('off',e.message||'SEM RESPOSTA',0);
  }finally{busy=false}
 }

 async function command(path,data){return req(path,'POST',data||{},6000)}
 function bind(){
  setFixedValues();
  const c=el('connectBtn');if(c)c.onclick=connect;
  const ap=el('applyPs5Btn');if(ap)ap.onclick=async()=>{setFixedValues();await applyPs5();connect()};
  const st=el('startSection');if(st)st.onclick=async()=>{await command('/api/session/start',{name:'Nova seção'});poll()};
  const sv=el('saveSection');if(sv)sv.onclick=async()=>{const name=prompt('Nome da seção:','Seção '+new Date().toLocaleString('pt-BR'));if(name!==null){await command('/api/session/finish',{name});poll()}};
  const rz=el('resetSection');if(rz)rz.onclick=async()=>{await command('/api/reset',{});poll()};
  connect();
 }
 window.v4FixedConnect=connect;window.v4FixedPoll=poll;window.api=command;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else setTimeout(bind,0);
})();
</script>`;
html=html.replace('</body>',code+'\n</body>');
fs.writeFileSync(file,html);
console.log('Rede fixa aplicada: Bridge 192.168.1.70:8788 / PS5 192.168.1.71');
