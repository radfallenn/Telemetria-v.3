const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 PERSISTENT BRIDGE SINGLE OWNER';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

const code=`
<script>
/* ${MARK} */
(function(){
 'use strict';
 const BRIDGE='http://192.168.1.70:8788';
 const PS5='192.168.1.71';
 const q=id=>document.getElementById(id);
 let stopped=false,busy=false,retryTimer=0,failures=0,lastOk=0,lastLatency=0,lastData=null;

 function fixedInputs(){
  if(q('bridgeUrl'))q('bridgeUrl').value=BRIDGE;
  if(q('ps5Ip'))q('ps5Ip').value=PS5;
  localStorage.setItem('gt7_bridge_url',BRIDGE);
  localStorage.setItem('gt7_bridge',BRIDGE);
  localStorage.setItem('gt7_ps5_ip',PS5);
 }
 function paint(ok,waiting=false,message='GT7-UDP'){
  const fresh=Date.now()-lastOk<7000;
  const connected=ok||fresh;
  if(q('topStatus'))q('topStatus').textContent=connected?'OK':waiting?'...':'OFF';
  if(q('latency'))q('latency').textContent=connected?(lastLatency+'ms'):'--ms';
  if(q('statusDot')){
   q('statusDot').style.background=connected?'var(--cyan)':waiting?'#ffb000':'#555';
   q('statusDot').style.boxShadow=connected?'0 0 18px var(--cyan)':'none';
  }
  if(q('bridgeText'))q('bridgeText').textContent=(connected?'OK · ':waiting?'CONECTANDO · ':'OFF · ')+message;
 }
 async function json(path,timeout=3500){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),timeout);
  try{
   const r=await fetch(BRIDGE+path,{cache:'no-store',signal:ctrl.signal,headers:{Accept:'application/json'}});
   if(!r.ok)throw new Error('HTTP '+r.status);
   return await r.json();
  }finally{clearTimeout(tid)}
 }
 async function live(){
  try{return await json('/api/live',3200)}catch(e){return await json('/api/fields',3200)}
 }
 function forceConnectedPayload(raw){
  const d=(raw&&raw.live)?{...raw.live,session:raw.session||raw.active||raw.live.session}:({...raw});
  d.connected=true;
  d.decodeOk=d.decodeOk!==false;
  return d;
 }
 async function tick(){
  if(stopped||busy)return;
  busy=true;
  const start=performance.now();
  try{
   const raw=await live();
   const d=forceConnectedPayload(raw||{});
   lastLatency=Math.max(1,Math.round(performance.now()-start));
   lastOk=Date.now();failures=0;lastData=d;
   if(typeof window.render==='function'){
    try{window.render(d)}catch(err){console.warn('Render não derrubou Bridge:',err)}
   }
   paint(true,false,(raw&&raw.app)||'GT7-UDP');
  }catch(err){
   failures++;
   paint(false,failures<6,'GT7-UDP');
  }finally{
   busy=false;
   clearTimeout(retryTimer);
   retryTimer=setTimeout(tick,failures?Math.min(2500,700+failures*250):850);
  }
 }
 async function post(path,data){
  const r=await fetch(BRIDGE+path,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})});
  if(!r.ok)throw new Error('HTTP '+r.status);
  return r.json();
 }
 function start(){
  fixedInputs();
  // Desativa o temporizador legado quando ele ainda estiver acessível.
  try{if(typeof timer!=='undefined'&&timer){clearInterval(timer);timer=null}}catch{}
  try{if(window.__v4PersistentBridgeTimer)clearTimeout(window.__v4PersistentBridgeTimer)}catch{}
  stopped=false;paint(false,true);tick();
 }
 function bind(){
  fixedInputs();
  if(q('connectBtn'))q('connectBtn').onclick=start;
  if(q('startSection'))q('startSection').onclick=async()=>{await post('/api/session/start',{name:'Nova seção'});tick()};
  if(q('saveSection'))q('saveSection').onclick=async()=>{const name=prompt('Nome da seção:','Seção '+new Date().toLocaleString('pt-BR'));if(name!==null){await post('/api/session/finish',{name});tick()}};
  if(q('resetSection'))q('resetSection').onclick=async()=>{await post('/api/reset',{});tick()};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){clearTimeout(retryTimer);tick()}});
  window.addEventListener('online',()=>{clearTimeout(retryTimer);tick()});
  start();
 }
 // Impede que renders antigos deixem o indicador OFF depois de uma resposta válida.
 const statusGuard=setInterval(()=>{if(Date.now()-lastOk<7000)paint(true,false,'GT7-UDP')},500);
 window.v4PersistentBridge={start,tick,stop(){stopped=true;clearTimeout(retryTimer);clearInterval(statusGuard)},get lastData(){return lastData}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else setTimeout(bind,0);
})();
</script>`;
html=html.replace('</body>',code+'\n</body>');
fs.writeFileSync(file,html);
console.log('Controlador único e persistente da Bridge aplicado.');
