const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 BRIDGE AUDIT SINGLE NATIVE CONTROLLER';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

// Remove os controladores de rede adicionados anteriormente.
const oldMarkers=[
 'V4 FIXED NETWORK 8788 PS5 71',
 'V4 PERSISTENT BRIDGE SINGLE OWNER'
];
for(const marker of oldMarkers){
 const escaped=marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const re=new RegExp('<script>[\\s\\S]*?\\/\\* '+escaped+' \\*\\/[\\s\\S]*?<\\/script>','g');
 html=html.replace(re,'');
}

// Remove qualquer inicialização legada do polling base.
html=html.replace(/\$\('bridgeUrl'\)\.value=localStorage\.getItem\('gt7_bridge_url'\)[\s\S]*?timer=setInterval\(poll,700\);/,
  "$('bridgeUrl').value='http://192.168.1.70:8788';$('ps5Ip').value='192.168.1.71';renderSegments(0);renderFuel(0);");

const code=`
<script>
/* ${MARK} */
(function(){
 'use strict';
 const BRIDGE='http://192.168.1.70:8788';
 const PS5='192.168.1.71';
 const q=id=>document.getElementById(id);
 let timerId=0,busy=false,lastOk=0,lastLatency=0,failures=0;

 function fixed(){
  if(q('bridgeUrl'))q('bridgeUrl').value=BRIDGE;
  if(q('ps5Ip'))q('ps5Ip').value=PS5;
  localStorage.setItem('gt7_bridge_url',BRIDGE);
  localStorage.setItem('gt7_bridge',BRIDGE);
  localStorage.setItem('gt7_ps5_ip',PS5);
 }
 function parseData(v){
  if(typeof v==='string'){try{return JSON.parse(v)}catch{return {}}}
  return v&&typeof v==='object'?v:{};
 }
 async function nativeRequest(path,method='GET',data=null,timeout=3500){
  const url=BRIDGE+path;
  const plugin=globalThis.Capacitor&&globalThis.Capacitor.Plugins&&globalThis.Capacitor.Plugins.CapacitorHttp;
  if(plugin&&typeof plugin.request==='function'){
   const result=await plugin.request({
    url,method,
    headers:{Accept:'application/json','Content-Type':'application/json'},
    data:method==='GET'?undefined:(data||{}),
    connectTimeout:timeout,readTimeout:timeout
   });
   if(Number(result.status)<200||Number(result.status)>=300)throw new Error('HTTP '+result.status+' '+path);
   return parseData(result.data);
  }
  const ctrl=new AbortController();
  const stop=setTimeout(()=>ctrl.abort(),timeout);
  try{
   const r=await fetch(url,{method,cache:'no-store',signal:ctrl.signal,headers:{Accept:'application/json','Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data||{})});
   if(!r.ok)throw new Error('HTTP '+r.status+' '+path);
   return await r.json();
  }finally{clearTimeout(stop)}
 }
 async function readTelemetry(){
  // /api/fields é o endpoint confirmado no Raspberry.
  try{return await nativeRequest('/api/fields','GET',null,3200)}
  catch(first){return await nativeRequest('/api/live','GET',null,3200)}
 }
 function payload(raw){
  const source=raw&&raw.live&&typeof raw.live==='object'?raw.live:raw||{};
  return {...source,connected:true,decodeOk:source.decodeOk!==false};
 }
 function status(ok,waiting=false,error=''){
  const fresh=Date.now()-lastOk<8000;
  const active=ok||fresh;
  if(q('topStatus'))q('topStatus').textContent=active?'OK':waiting?'...':'OFF';
  if(q('latency'))q('latency').textContent=active?lastLatency+'ms':'--ms';
  if(q('statusDot')){
   q('statusDot').style.background=active?'var(--cyan)':waiting?'#ffb000':'#555';
   q('statusDot').style.boxShadow=active?'0 0 18px var(--cyan)':'none';
  }
  if(q('bridgeText'))q('bridgeText').textContent=active?'OK · GT7-UDP':waiting?'CONECTANDO · GT7-UDP':'OFF · '+(error||'SEM RESPOSTA');
 }
 async function tick(){
  if(busy)return;
  busy=true;
  const started=performance.now();
  try{
   const raw=await readTelemetry();
   const d=payload(raw);
   lastLatency=Math.max(1,Math.round(performance.now()-started));
   lastOk=Date.now();failures=0;
   if(typeof window.render==='function'){
    try{window.render(d)}catch(e){console.warn('Erro visual sem derrubar Bridge',e)}
   }
   status(true);
  }catch(e){
   failures++;
   status(false,failures<4,e&&e.message?e.message:'SEM RESPOSTA');
   console.warn('Bridge tentativa '+failures,e);
  }finally{
   busy=false;
   clearTimeout(timerId);
   timerId=setTimeout(tick,failures?Math.min(2500,650+failures*250):700);
  }
 }
 async function post(path,data){return nativeRequest(path,'POST',data||{},5000)}
 async function configurePs5(){
  const options=[['/api/config',{ps5Ip:PS5}],['/api/settings',{ps5Ip:PS5}],['/api/ps5',{ip:PS5}]];
  for(const [path,data] of options){try{await post(path,data);return}catch{}}
 }
 function start(){
  fixed();
  try{if(typeof timer!=='undefined'&&timer){clearInterval(timer);timer=null}}catch{}
  clearTimeout(timerId);failures=0;status(false,true);tick();configurePs5();
 }
 function bind(){
  fixed();
  if(q('connectBtn'))q('connectBtn').onclick=start;
  if(q('startSection'))q('startSection').onclick=async()=>{await post('/api/session/start',{name:'Nova seção'});tick()};
  if(q('saveSection'))q('saveSection').onclick=async()=>{const name=prompt('Nome da seção:','Seção '+new Date().toLocaleString('pt-BR'));if(name!==null){await post('/api/session/finish',{name});tick()}};
  if(q('resetSection'))q('resetSection').onclick=async()=>{await post('/api/reset',{});tick()};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){clearTimeout(timerId);tick()}});
  window.addEventListener('online',()=>{clearTimeout(timerId);tick()});
  start();
 }
 window.v4BridgeNative={start,tick,request:nativeRequest};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else setTimeout(bind,0);
})();
</script>`;
html=html.replace('</body>',code+'\n</body>');
fs.writeFileSync(file,html);
console.log('Bridge auditada: controlador nativo único, /api/fields principal e sem polling concorrente.');
