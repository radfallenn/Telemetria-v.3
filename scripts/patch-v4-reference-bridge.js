const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 STABLE REFERENCE BRIDGE 8788';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}
const code=`
<script>
/* ${MARK} */
(function(){
 const el=id=>document.getElementById(id);
 let refTimer=null,activeBase='',activeLivePath='/api/live',failures=0,lastGood=null,lastHealth=null,connecting=false;
 function normalize(raw,port='8788'){
  let v=String(raw||'').trim();if(!v)v='http://192.168.1.70:'+port;if(!/^https?:\/\//i.test(v))v='http://'+v;
  try{let u=new URL(v);if(!u.port)u.port=port;return u.origin}catch{return 'http://192.168.1.70:'+port}
 }
 function candidates(){
  const saved=localStorage.getItem('gt7_active_bridge');
  const input=el('bridgeUrl')?.value||localStorage.getItem('gt7_bridge_url')||localStorage.getItem('gt7_bridge')||'http://192.168.1.70:8788';
  const first=normalize(input);let u;try{u=new URL(first)}catch{}
  const out=[];if(saved)out.push(normalize(saved));out.push(first);if(u){out.push(u.protocol+'//'+u.hostname+':8788');out.push(u.protocol+'//'+u.hostname+':8787')}
  return [...new Set(out)];
 }
 async function request(base,p,method='GET',data=null,timeout=5500){
  const url=base.replace(/\/$/,'')+p,cap=window.Capacitor,http=cap&&cap.Plugins&&cap.Plugins.CapacitorHttp;
  if(http&&typeof http.request==='function'){
   const r=await http.request({url,method,headers:{Accept:'application/json','Content-Type':'application/json'},data,connectTimeout:timeout,readTimeout:timeout});
   if(r.status<200||r.status>=300)throw Error('HTTP '+r.status);return typeof r.data==='string'?JSON.parse(r.data):r.data;
  }
  const c=new AbortController(),tid=setTimeout(()=>c.abort(),timeout);
  try{const r=await fetch(url,{method,cache:'no-store',signal:c.signal,headers:{Accept:'application/json','Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data||{})});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(tid)}
 }
 const get=(o,p,d)=>{const v=p.split('.').reduce((a,k)=>a&&a[k]!=null?a[k]:undefined,o);return v==null?d:v};
 const one=(...v)=>v.find(x=>x!==undefined&&x!==null&&x!==''&&!Number.isNaN(x));
 const good=v=>v!==undefined&&v!==null&&v!==''&&v!=='--'&&!(typeof v==='number'&&!Number.isFinite(v));
 function mergeValid(oldObj,newObj){
  if(Array.isArray(newObj))return newObj.length?newObj:(Array.isArray(oldObj)?oldObj:[]);
  if(newObj&&typeof newObj==='object'){
   const out={...(oldObj&&typeof oldObj==='object'?oldObj:{})};
   Object.keys(newObj).forEach(k=>{out[k]=mergeValid(out[k],newObj[k])});return out;
  }
  return good(newObj)?newObj:oldObj;
 }
 function adapt(payload,health){
  const root=payload||{},L=root.live||root,S=root.session||root.active||{},legacy=L.legacy||{},packet=L.packet||{},car=L.car||{},input=L.input||{},lap=L.lap||{},fuel=L.fuel||{},tyres=L.tyres||{};
  const ps5Connected=Boolean(packet.connected||legacy.connected||health?.connectedToPs5||L.connected||((Number(packet.ageMs)<5000)&&(Number(packet.count)>0)));
  const laps=Array.isArray(S.laps)?S.laps:[];
  const lapTimes=Array.isArray(L.lapTimes)?L.lapTimes:laps.map(x=>x.time||x.formatted||x.lapTime||x.ms).filter(Boolean);
  const bestMs=one(lap.bestLapMs,S.bestLapMs,L.analysis?.bestMs,0),lastMs=one(lap.lastLapMs,S.lastLapMs,L.analysis?.lastMs,0);
  const fmt=ms=>{ms=Number(ms)||0;if(ms<=0)return'--';let m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000),z=Math.floor(ms%1000);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(z).padStart(3,'0')};
  const valid=Number(one(S.validLaps,lap.validLaps,L.voltasCompletadas,laps.length,0))||0;
  const speed=Number(one(car.speedKmh,legacy.speedKmh,legacy.speed,L.velocidade,0))||0;
  const adv=L.advanced||{};const tt=get(tyres,'temp',{})||adv.tyreTemp||L.motecChannels?.tyreTemp||{};
  const mapped={...L,connected:true,bridgeConnected:true,ps5Connected,decodeOk:Boolean(ps5Connected||packet.count||car.rpm||speed),velocidade:speed,rpm:Number(one(car.rpm,legacy.rpm,L.rpm,0))||0,marcha:one(car.gear,legacy.gear,L.marcha,'N'),acelerador:Number(one(input.throttlePct,legacy.throttlePct,L.acelerador,0))||0,freio:Number(one(input.brakePct,legacy.brakePct,L.freio,0))||0,combustivelPorcentagem:one(fuel.percent,L.combustivelPorcentagem,null),velocidadeMaxima:Number(one(S.maxSpeed,L.velocidadeMaxima,0))||0,melhorVolta:one(L.melhorVolta,bestMs?fmt(bestMs):null,'--'),ultimaVolta:one(L.ultimaVolta,lastMs?fmt(lastMs):null,'--'),voltasCompletadas:valid,lapTimes,advanced:{...adv,tyreTemp:{FL:one(tt.FL,tt.fl),FR:one(tt.FR,tt.fr),RL:one(tt.RL,tt.rl),RR:one(tt.RR,tt.rr)}},analysis:L.analysis||S.analysis||{laps:valid,best:bestMs?fmt(bestMs):'--',last:lastMs?fmt(lastMs):'--',total:S.totalMs?fmt(S.totalMs):'--',average:S.avgLapMs?fmt(S.avgLapMs):'--'}};
  lastGood=mergeValid(lastGood,mapped);lastGood.connected=true;lastGood.bridgeConnected=true;lastGood.ps5Connected=ps5Connected;return lastGood;
 }
 function status(ok,msg,ms){if(el('topStatus'))el('topStatus').textContent=ok?'OK':'OFF';if(el('latency'))el('latency').textContent=ok?ms+'ms':'--ms';if(el('bridgeText'))el('bridgeText').textContent=(ok?'OK · ':'OFF · ')+(msg||'GT7-UDP');if(el('statusDot')){el('statusDot').style.background=ok?'var(--cyan)':'#555';el('statusDot').style.boxShadow=ok?'0 0 18px var(--cyan)':'none'}}
 function doRender(d){try{if(typeof window.render==='function')window.render(d);else if(typeof render==='function')render(d)}catch(e){console.error('render bridge',e)}status(true,(lastHealth&&lastHealth.app)||'GT7-UDP',0)}
 async function readLive(base){try{const d=await request(base,'/api/live','GET',null,4500);activeLivePath='/api/live';return d}catch(e){const d=await request(base,'/api/fields','GET',null,4500);activeLivePath='/api/fields';return d}}
 async function connect(){
  if(connecting)return false;connecting=true;status(false,'CONECTANDO',0);let lastErr='sem resposta';
  for(const base of candidates()){
   try{const t=performance.now(),h=await request(base,'/api/health','GET',null,5500),live=await readLive(base);activeBase=base;lastHealth=h;failures=0;localStorage.setItem('gt7_active_bridge',base);localStorage.setItem('gt7_bridge_url',base);localStorage.setItem('gt7_bridge',base);if(el('bridgeUrl'))el('bridgeUrl').value=base;const d=adapt(live,h);doRender(d);status(true,h.app||'GT7-UDP',Math.round(performance.now()-t));clearInterval(refTimer);refTimer=setInterval(poll,850);connecting=false;return true}catch(e){lastErr=e.message||String(e)}
  }
  connecting=false;if(lastGood){doRender(lastGood);status(true,'RECONectando',0)}else status(false,lastErr,0);return false;
 }
 async function poll(){
  if(!activeBase)return connect();
  try{const t=performance.now();let h=lastHealth;try{h=await request(activeBase,'/api/health','GET',null,2600);lastHealth=h}catch{}let live;try{live=await request(activeBase,activeLivePath,'GET',null,3800)}catch{live=await readLive(activeBase)}const d=adapt(live,h);failures=0;doRender(d);status(true,(h&&h.app)||'GT7-UDP',Math.round(performance.now()-t))}
  catch(e){failures++;if(lastGood)doRender(lastGood);if(failures<5){status(true,'SINAL INSTÁVEL',0);return}clearInterval(refTimer);refTimer=null;activeBase='';status(false,e.message||'GT7-UDP',0);setTimeout(connect,1200)}
 }
 async function command(p,data){if(!activeBase)await connect();return request(activeBase,p,'POST',data||{})}
 window.v4ReferenceConnect=connect;window.v4ReferencePoll=poll;window.api=command;
 const bind=()=>{const b=el('connectBtn');if(b)b.onclick=connect;const s=el('startSection');if(s)s.onclick=async()=>{await command('/api/session/start',{name:'Nova seção'});poll()};const save=el('saveSection');if(save)save.onclick=async()=>{const name=prompt('Nome da seção:','Seção '+new Date().toLocaleString('pt-BR'));if(name!==null){await command('/api/session/finish',{name});poll()}};const reset=el('resetSection');if(reset)reset.onclick=async()=>{await command('/api/reset',{});poll()};connect()};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else setTimeout(bind,0);
})();
</script>`;
html=html.replace('</body>',code+'\n</body>');
fs.writeFileSync(file,html);
console.log('Bridge 8788 estabilizado: endpoint fixo, anti-flicker e tolerancia a falhas.');
