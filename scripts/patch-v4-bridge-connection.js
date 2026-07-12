const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');

function replaceOnce(rx,repl,label){
  if(!rx.test(html)){console.log('SKIP:',label);return}
  html=html.replace(rx,repl);console.log('OK:',label)
}

const helper=`
function normalizeBridgeUrl(raw){
  let v=String(raw||'').trim();
  if(!v)v='192.168.1.70:8787';
  if(!/^https?:\\/\\//i.test(v))v='http://'+v;
  try{const u=new URL(v);if(!u.port)u.port='8787';return u.origin}catch{return 'http://192.168.1.70:8787'}
}
async function fetchJson(url,timeout=3500){
  const c=new AbortController();const id=setTimeout(()=>c.abort(),timeout);
  try{const r=await fetch(url,{cache:'no-store',signal:c.signal,headers:{Accept:'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(id)}
}
async function connectBridge(){
  const input=$('bridgeUrl');const base=normalizeBridgeUrl(input.value);input.value=base;localStorage.setItem('gt7_bridge_url',base);
  set('topStatus','...');set('bridgeText','CONECTANDO · GT7-UDP');$('statusDot').style.background='#ffb000';
  try{
    const t=performance.now();const health=await fetchJson(base+'/api/health',4000);lat=Math.round(performance.now()-t);
    if(!health||health.ok===false)throw new Error('Bridge inválido');
    set('latency',lat+'ms');set('topStatus','OK');set('bridgeText','OK · '+(health.app||'GT7-UDP'));$('statusDot').style.background='var(--cyan)';
    clearInterval(timer);await poll();timer=setInterval(poll,700);return true;
  }catch(e){
    clearInterval(timer);timer=null;set('topStatus','OFF');set('latency','--ms');set('bridgeText','OFF · GT7-UDP');$('statusDot').style.background='#555';return false;
  }
}
`;

if(!html.includes('function normalizeBridgeUrl('))html=html.replace("const $=id=>document.getElementById(id);let live={},timer=null,lastGood={},lat=0;",`const $=id=>document.getElementById(id);let live={},timer=null,lastGood={},lat=0;${helper}`);

replaceOnce(/async function poll\(\)\{.*?\}\nasync function api/s,
`async function poll(){let base=normalizeBridgeUrl($('bridgeUrl').value);let t=performance.now();try{let d=await fetchJson(base+'/api/fields',3500);lat=Math.round(performance.now()-t);set('latency',lat+'ms');render(d)}catch(e){set('topStatus','OFF');set('latency','--ms');set('bridgeText','OFF · GT7-UDP');$('statusDot').style.background='#555'}}\nasync function api`,
'poll Bridge V4');

replaceOnce(/async function api\(path,body\)\{.*?\}\nasync function loadSessions/s,
`async function api(path,body){let base=normalizeBridgeUrl($('bridgeUrl').value);let r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body||{})});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}\nasync function loadSessions`,
'API Bridge V4');

replaceOnce(/async function loadSessions\(\)\{.*?\}\nfunction showPage/s,
`async function loadSessions(){try{let base=normalizeBridgeUrl($('bridgeUrl').value);let j=await fetchJson(base+'/api/sessions',4000);$('sectionList').innerHTML=(j.sessions||[]).map(s=>'<div class="sectionItem"><b>'+safe(s.name,'Seção')+'</b><div class="smallsub">'+safe(s.analysis?.laps,s.laps?.length||0)+' voltas · '+safe(s.analysis?.best,'--')+'</div></div>').join('')||'<div class="smallsub">Nenhuma seção salva.</div>'}catch(e){$('sectionList').innerHTML='<div class="smallsub">Bridge offline.</div>'}}\nfunction showPage`,
'sessões Bridge V4');

replaceOnce(/\$\('connectBtn'\)\.onclick=\(\)=>\{.*?\};\$\('startSection'\)/s,
`$('connectBtn').onclick=connectBridge;$('startSection')`,
'botão conectar');

replaceOnce(/\$\('bridgeUrl'\)\.value=localStorage\.getItem\('gt7_bridge_url'\)\|\|'http:\/\/192\.168\.1\.70:8787';applyPref\(\);renderSegments\(0\);renderFuel\(0\);poll\(\);timer=setInterval\(poll,700\);/,
`$('bridgeUrl').value=normalizeBridgeUrl(localStorage.getItem('gt7_bridge_url')||'http://192.168.1.70:8787');applyPref();renderSegments(0);renderFuel(0);connectBridge();`,
'inicialização Bridge V4');

fs.writeFileSync(file,html);console.log('Conexão Bridge V4 corrigida.');
