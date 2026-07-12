const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const marker='V4_DEFINITIVE_CONNECTION_2026';
if(html.includes(marker)){console.log('JA OK: conexão definitiva');process.exit(0)}
const code=`
<script id="${marker}">
(function(){
  'use strict';
  let bridgeTimer=null;
  let requestBusy=false;
  const el=id=>document.getElementById(id);
  function normalize(raw){
    let v=String(raw||'').trim();
    if(!v)v='http://192.168.1.70:8787';
    if(!/^https?:\/\//i.test(v))v='http://'+v;
    try{const u=new URL(v);if(!u.port)u.port='8787';return u.origin}catch(e){return 'http://192.168.1.70:8787'}
  }
  function showState(status,message,latency){
    const top=el('topStatus'),txt=el('bridgeText'),dot=el('statusDot'),lat=el('latency');
    if(top)top.textContent=status;
    if(txt)txt.textContent=message;
    if(lat)lat.textContent=latency==null?'--ms':latency+'ms';
    if(dot){dot.style.background=status==='OK'?'var(--cyan)':status==='...'?'#ffb000':'#555';dot.style.boxShadow=status==='OK'?'0 0 18px var(--cyan)':'none'}
  }
  async function nativeHttp(url,method='GET',data=null,timeout=7000){
    const cap=window.Capacitor;
    const plugin=cap&&cap.Plugins&&cap.Plugins.CapacitorHttp;
    if(plugin&&typeof plugin.request==='function'){
      const response=await plugin.request({url,method,headers:{Accept:'application/json','Content-Type':'application/json'},data:data||undefined,connectTimeout:timeout,readTimeout:timeout});
      if(response.status<200||response.status>=300)throw new Error('HTTP '+response.status);
      return typeof response.data==='string'?JSON.parse(response.data):response.data;
    }
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const response=await fetch(url,{method,cache:'no-store',signal:controller.signal,headers:{Accept:'application/json','Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data||{})});
      if(!response.ok)throw new Error('HTTP '+response.status);
      return await response.json();
    }finally{clearTimeout(timer)}
  }
  function base(){
    const input=el('bridgeUrl');
    const value=normalize(input?input.value:localStorage.getItem('gt7_bridge_url'));
    if(input)input.value=value;
    return value;
  }
  async function readFields(){
    if(requestBusy)return;
    requestBusy=true;
    const started=performance.now();
    try{
      const data=await nativeHttp(base()+'/api/fields','GET',null,6000);
      const ms=Math.max(1,Math.round(performance.now()-started));
      showState('OK','OK · GT7-UDP',ms);
      if(typeof window.render==='function')window.render(data);
      else if(typeof render==='function')render(data);
    }catch(error){
      showState('OFF','OFF · '+String(error&&error.message||error),null);
    }finally{requestBusy=false}
  }
  async function connect(){
    if(bridgeTimer){clearInterval(bridgeTimer);bridgeTimer=null}
    const url=base();
    localStorage.setItem('gt7_bridge_url',url);
    showState('...','CONECTANDO · GT7-UDP',null);
    try{
      const started=performance.now();
      const health=await nativeHttp(url+'/api/health','GET',null,7000);
      if(!health||health.ok===false)throw new Error('Resposta inválida');
      showState('OK','OK · '+String(health.app||'GT7-UDP'),Math.max(1,Math.round(performance.now()-started)));
      await readFields();
      bridgeTimer=setInterval(readFields,700);
      return true;
    }catch(error){
      showState('OFF','OFF · '+String(error&&error.message||error),null);
      return false;
    }
  }
  async function post(path,data){return nativeHttp(base()+path,'POST',data||{},7000)}
  window.gt7Bridge={connect,readFields,post,base};
  function bind(){
    const input=el('bridgeUrl');
    if(input)input.value=normalize(localStorage.getItem('gt7_bridge_url')||input.value);
    const connectBtn=el('connectBtn');
    if(connectBtn){connectBtn.onclick=function(ev){ev.preventDefault();ev.stopPropagation();connect()}}
    const start=el('startSection');
    if(start)start.onclick=async function(ev){ev.preventDefault();await post('/api/session/start',{name:'Nova seção'});await readFields()};
    const save=el('saveSection');
    if(save)save.onclick=async function(ev){ev.preventDefault();const name=prompt('Nome da seção:','Seção '+new Date().toLocaleString('pt-BR'));if(name!==null){await post('/api/session/finish',{name});if(typeof window.loadSessions==='function')window.loadSessions()}};
    const reset=el('resetSection');
    if(reset)reset.onclick=async function(ev){ev.preventDefault();await post('/api/reset',{});await readFields()};
    connect();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else setTimeout(bind,0);
})();
</script>`;
html=html.replace('</body>',code+'\n</body>');
fs.writeFileSync(file,html);
console.log('OK: conexão definitiva Bridge V4');
