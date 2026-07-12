const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 REFERENCE APK BRIDGE 8788';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}
const code=`
<script>
/* ${MARK} */
(function(){
 const el=id=>document.getElementById(id);
 let refTimer=null,activeBase='';
 function normalize(raw,port='8788'){
  let v=String(raw||'').trim();if(!v)v='http://192.168.1.70:'+port;if(!/^https?:\\/\\//i.test(v))v='http://'+v;
  try{let u=new URL(v);if(!u.port)u.port=port;return u.origin}catch{return 'http://192.168.1.70:'+port}
 }
 function candidates(){
  const input=el('bridgeUrl')?.value||localStorage.getItem('gt7_bridge_url')||localStorage.getItem('gt7_bridge')||'http://192.168.1.70:8788';
  const first=normalize(input);let u;try{u=new URL(first)}catch{}
  const out=[first];if(u){out.push(u.protocol+'//'+u.hostname+':8788');out.push(u.protocol+'//'+u.hostname+':8787')}
  return [...new Set(out)];
 }
 async function request(base,p,method='GET',data=null,timeout=5500){
  const url=base.replace(/\\/$/,'')+p,cap=window.Capacitor,http=cap&&cap.Plugins&&cap.Plugins.CapacitorHttp;
  if(http&&typeof http.request==='function'){
   const r=await http.request({url,method,headers:{Accept:'application/json','Content-Type':'application/json'},data,connectTimeout:timeout,readTimeout:timeout});
   if(r.status<200||r.status>=300)throw Error('HTTP '+r.status);return typeof r.data==='string'?JSON.parse(r.data):r.data;
  }
  const c=new AbortController(),tid=setTimeout(()=>c.abort(),timeout);
  try{const r=await fetch(url,{method,cache:'no-store',signal:c.signal,headers:{Accept:'application/json','Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data||{})});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(tid)}
 }
 const get=(o,p,d)=>{const v=p.split('.').reduce((a,k)=>a&&a[k]!=null?a[k]:undefined,o);return v==null?d:v};
 const one=(...v)=>v.find(x=>x!==undefined&&x!==null&&x!==''&&!Number.isNaN(x));
 function adapt(payload,health){
  const root=payload||{},L=root.live||root,S=root.session||root.active||{},legacy=L.legacy||{},packet=L.packet||{},car=L.car||{},input=L.input||{},lap=L.lap||{},fuel=L.fuel||{},tyres=L.tyres||{};
  const connected=Boolean(packet.connected||legacy.connected||health?.connectedToPs5||L.connected||((Number(packet.ageMs)<5000)&&(Number(packet.count)>0)));
  const laps=Array.isArray(S.laps)?S.laps:[];
  const lapTimes=Array.isArray(L.lapTimes)?L.lapTimes:laps.map(x=>x.time||x.formatted||x.lapTime||x.ms).filter(Boolean);
  const bestMs=one(lap.bestLapMs,S.bestLapMs,L.analysis?.bestMs,0),lastMs=one(lap.lastLapMs,S.lastLapMs,L.analysis?.lastMs,0);
  const fmt=ms=>{ms=Number(ms)||0;if(ms<=0)return'--';let m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000),z=Math.floor(ms%1000);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(z).padStart(3,'0')};
  const valid=Number(one(S.validLaps,lap.validLaps,L.voltasCompletadas,laps.length,0))||0;
  const speed=Number(one(car.speedKmh,legacy.speedKmh,legacy.speed,L.velocidade,0))||0;
  const adv=L.advanced||{};const tt=get(tyres,'temp',{})||adv.tyreTemp||L.motecChannels?.tyreTemp||{};
  return {...L,connected,decodeOk:connected,velocidade:speed,rpm:Number(one(car.rpm,legacy.rpm,L.rpm,0))||0,marcha:one(car.gear,legacy.gear,L.marcha,'N'),acelerador:Number(one(input.throttlePct,legacy.throttlePct,L.acelerador,0))||0,freio:Number(one(input.brakePct,legacy.brakePct,L.freio,0))||0,combustivelPorcentagem:one(fuel.percent,L.combustivelPorcentagem,null),velocidadeMaxima:Number(one(S.maxSpeed,L.velocidadeMaxima,0))||0,melhorVolta:one(L.melhorVolta,bestMs?fmt(bestMs):null,'--'),ultimaVolta:one(L.ultimaVolta,lastMs?fmt(lastMs):null,'--'),voltasCompletadas:valid,lapTimes,advanced:{...adv,tyreTemp:{FL:one(tt.FL,tt.fl),FR:one(tt.FR,tt.fr),RL:one(tt.RL,tt.rl),RR:one(tt.RR,tt.rr)}},analysis:L.analysis||S.analysis||{laps:valid,best:bestMs?fmt(bestMs):'--',last:lastMs?fmt(lastMs):'--',total:S.totalMs?fmt(S.totalMs):'--',average:S.avgLapMs?fmt(S.avgLapMs):'--'}};
 }
 function status(ok,msg,ms){if(el('topStatus'))el('topStatus').textContent=ok?'OK':'OFF';if(el('latency'))el('latency').textContent=ok?ms+'ms':'--ms';if(el('bridgeText'))el('bridgeText').textContent=(ok?'OK · ':'OFF · ')+(msg||'GT7-UDP');if(el('statusDot'))el('statusDot').style.background=ok?'var(--cyan)':'#555'}
 async function connect(){status(false,'CONECTANDO',0);let lastErr='sem resposta';for(const base of candidates()){try{const t=performance.now(),h=await request(base,'/api/health');let live;try{live=await request(base,'/api/live')}catch{live=await request(base,'/api/fields')}activeBase=base;localStorage.setItem('gt7_bridge_url',base);localStorage.setItem('gt7_bridge',base);if(el('bridgeUrl'))el('bridgeUrl').value=base;const d=adapt(live,h);if(typeof window.render==='function')window.render(d);else if(typeof render==='function')render(d);status(true,h.app||'GT7-UDP',Math.round(performance.now()-t));clearInterval(refTimer);refTimer=setInterval(poll,650);return true}catch(e){lastErr=e.message||String(e)}}status(false,lastErr,0);return false}
 async function poll(){if(!activeBase)return connect();try{const t=performance.now();let h={};try{h=await request(activeBase,'/api/health', 'GET',null,3000)}catch{}let live;try{live=await request(activeBase,'/api/live','GET',null,4000)}catch{live=await request(activeBase,'/api/fields','GET',null,4000)}const d=adapt(live,h);if(typeof window.render==='function')window.render(d);else if(typeof render==='function')render(d);status(true,h.app||'GT7-UDP',Math.round(performance.now()-t))}catch(e){status(false,e.message||'GT7-UDP',0)}}
 async function command(p,data){if(!activeBase)await connect();return request(activeBase,p,'POST',data||{})}
 window.v4ReferenceConnect=connect;window.v4ReferencePoll=poll;window.api=command;
 const bind=()=>{const b=el('connectBtn');if(b)b.onclick=connect;const s=el('startSection');if(s)s.onclick=async()=>{await command('/api/session/start',{name:'Nova seção'});poll()};const save=el('saveSection');if(save)save.onclick=async()=>{const name=prompt('Nome da seção:','Seção '+new Date().toLocaleString('pt-BR'));if(name!==null){await command('/api/session/finish',{name});poll()}};const reset=el('resetSection');if(reset)reset.onclick=async()=>{await command('/api/reset',{});poll()};connect()};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else setTimeout(bind,0);
})();
</script>`;
html=html.replace('</body>',code+'\n</body>');
fs.writeFileSync(file,html);
console.log('Conexao do APK V4 de referencia aplicada: porta 8788 + /api/live.');
