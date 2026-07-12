const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');

const marker='/* V4 NATIVE HTTP BRIDGE */';
if(!html.includes(marker)){
  const inject=`
${marker}
function bridgeBase(){
  let v=String(($('bridgeUrl')&&$('bridgeUrl').value)||localStorage.getItem('gt7_bridge_url')||'http://192.168.1.70:8787').trim();
  if(!/^https?:\\/\\//i.test(v))v='http://'+v;
  try{const u=new URL(v);if(!u.port)u.port='8787';return u.origin}catch{return 'http://192.168.1.70:8787'}
}
async function nativeRequest(path,method='GET',data=null,timeout=5000){
  const url=bridgeBase()+path;
  const cap=window.Capacitor;
  const http=cap&&cap.Plugins&&cap.Plugins.CapacitorHttp;
  if(http&&typeof http.request==='function'){
    const r=await http.request({url,method,headers:{Accept:'application/json','Content-Type':'application/json'},data,connectTimeout:timeout,readTimeout:timeout});
    if(r.status<200||r.status>=300)throw new Error('HTTP '+r.status);
    return typeof r.data==='string'?JSON.parse(r.data):r.data;
  }
  const c=new AbortController();const id=setTimeout(()=>c.abort(),timeout);
  try{const r=await fetch(url,{method,cache:'no-store',signal:c.signal,headers:{Accept:'application/json','Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data||{})});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(id)}
}
async function hardConnect(){
  const base=bridgeBase();$('bridgeUrl').value=base;localStorage.setItem('gt7_bridge_url',base);
  set('topStatus','...');set('latency','--ms');set('bridgeText','CONECTANDO · GT7-UDP');$('statusDot').style.background='#ffb000';
  try{const t=performance.now();const h=await nativeRequest('/api/health','GET',null,6000);lat=Math.round(performance.now()-t);if(!h||h.ok===false)throw new Error('Bridge inválido');set('topStatus','OK');set('latency',lat+'ms');set('bridgeText','OK · '+(h.app||'GT7-UDP'));$('statusDot').style.background='var(--cyan)';clearInterval(timer);await hardPoll();timer=setInterval(hardPoll,700);return true}catch(e){clearInterval(timer);timer=null;set('topStatus','OFF');set('latency','--ms');set('bridgeText','OFF · '+String(e.message||'GT7-UDP'));$('statusDot').style.background='#555';return false}
}
async function hardPoll(){try{const t=performance.now();const d=await nativeRequest('/api/fields','GET',null,5000);lat=Math.round(performance.now()-t);set('latency',lat+'ms');render(d)}catch(e){set('topStatus','OFF');set('latency','--ms');set('bridgeText','OFF · '+String(e.message||'GT7-UDP'));$('statusDot').style.background='#555'}}
`;
  html=html.replace('const $=id=>document.getElementById(id);let live={},timer=null,lastGood={},lat=0;',`const $=id=>document.getElementById(id);let live={},timer=null,lastGood={},lat=0;${inject}`);
}

html=html.replace(/async function poll\(\)\{.*?\}\nasync function api/s,`async function poll(){return hardPoll()}\nasync function api`);
html=html.replace(/async function api\(path,body\)\{.*?\}\nasync function loadSessions/s,`async function api(path,body){return nativeRequest(path,'POST',body||{},6000)}\nasync function loadSessions`);
html=html.replace(/async function loadSessions\(\)\{.*?\}\nfunction showPage/s,`async function loadSessions(){try{let j=await nativeRequest('/api/sessions','GET',null,6000);$('sectionList').innerHTML=(j.sessions||[]).map(s=>'<div class="sectionItem"><b>'+safe(s.name,'Seção')+'</b><div class="smallsub">'+safe(s.analysis?.laps,s.laps?.length||0)+' voltas · '+safe(s.analysis?.best,'--')+'</div></div>').join('')||'<div class="smallsub">Nenhuma seção salva.</div>'}catch(e){$('sectionList').innerHTML='<div class="smallsub">Bridge offline: '+String(e.message||e)+'</div>'}}\nfunction showPage`);
html=html.replace(/\$\('connectBtn'\)\.onclick=.*?;\$\('startSection'\)/s,`$('connectBtn').onclick=hardConnect;$('startSection')`);
html=html.replace(/\$\('bridgeUrl'\)\.value=.*?;applyPref\(\);renderSegments\(0\);renderFuel\(0\);.*?;/s,`$('bridgeUrl').value=localStorage.getItem('gt7_bridge_url')||'http://192.168.1.70:8787';applyPref();renderSegments(0);renderFuel(0);hardConnect();`);

fs.writeFileSync(file,html);
console.log('Native HTTP Bridge aplicado.');
