const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const indexPath=path.join(root,'www','index.html');
const bridgePath=path.join(root,'www','bridge-v408.js');
let html=fs.readFileSync(indexPath,'utf8');
let bridge=fs.readFileSync(bridgePath,'utf8');
const MARK='V5 STABLE EDITABLE NETWORK AND TOTAL';
const DEFAULT_BRIDGE='http://192.168.1.70:8789';
const DEFAULT_PS5='192.168.1.81';

function removeMarkedScripts(source){
  const script=/<script\b[^>]*>[\s\S]*?<\/script>\s*/gi;
  return source.replace(script,block=>
    block.includes('V4 EDITABLE NETWORK SETTINGS UI')||
    block.includes('V4 SET REBUILD BRIDGE CONTROL UI')||
    block.includes(MARK) ? '' : block
  );
}

html=html.replace(
  /\[data-field=["']rpmtotal["']\],\s*\[data-field=["']tyres["']\],\s*\[data-field=["']last["']\],\s*\[data-field=["']total["']\]\s*\{display:none!important\}/g,
  '[data-field="rpmtotal"],[data-field="tyres"],[data-field="last"]{display:none!important}'
);
html=html.replace(
  /new Set\(\[\s*["']rpmtotal["']\s*,\s*["']tyres["']\s*,\s*["']last["']\s*,\s*["']total["']\s*\]\)/g,
  "new Set(['rpmtotal','tyres','last'])"
);
html=removeMarkedScripts(html);

bridge=bridge.replace(
  /const\s+(?:BRIDGE|DEFAULT_BRIDGE)\s*=\s*["'][^"']+["'];/,
  `const DEFAULT_BRIDGE = '${DEFAULT_BRIDGE}';`
);
if(!bridge.includes("const DEFAULT_PS5 =")){
  bridge=bridge.replace(/const DEFAULT_BRIDGE[^\n]*\n/,match=>match+`  const DEFAULT_PS5 = '${DEFAULT_PS5}';\n`);
}

const anchor='const q = id => document.getElementById(id);';
if(!bridge.includes(anchor))throw new Error('Âncora do controlador da Bridge não encontrada');
if(!bridge.includes(`/* ${MARK} BRIDGE */`)){
  const injected=`${anchor}\n\n  /* ${MARK} BRIDGE */\n  function v5NormalizeBridge(value){\n    let text=String(value||'').trim();\n    if(!text)text=DEFAULT_BRIDGE;\n    if(!/^https?:\\/\\//i.test(text))text='http://'+text;\n    return text.replace(/\\/$/,'');\n  }\n  function v5BridgeUrl(){return v5NormalizeBridge(localStorage.getItem('gt7_bridge_url')||DEFAULT_BRIDGE)}\n  function v5Ps5Ip(){const value=String(localStorage.getItem('gt7_ps5_ip')||DEFAULT_PS5).trim();return validIp(value)?value:DEFAULT_PS5}\n  function v5PollInterval(){return Math.max(250,Math.min(5000,Number(localStorage.getItem('gt7_poll_interval')||700)||700))}\n  function v5SaveNetworkSettings(settings){\n    const bridgeUrl=v5NormalizeBridge(settings&&settings.bridgeUrl);\n    const ps5Ip=String(settings&&settings.ps5Ip||'').trim();\n    const pollInterval=Math.max(250,Math.min(5000,Number(settings&&settings.pollInterval)||700));\n    if(!validIp(ps5Ip))throw new Error('IP do PS5 inválido');\n    localStorage.setItem('gt7_bridge_url',bridgeUrl);\n    localStorage.setItem('gt7_bridge',bridgeUrl);\n    localStorage.setItem('gt7_ps5_ip',ps5Ip);\n    localStorage.setItem('gt7_poll_interval',String(pollInterval));\n    configuredPs5='';\n    if(q('bridgeUrl')){q('bridgeUrl').value=bridgeUrl;q('bridgeUrl').readOnly=false;q('bridgeUrl').disabled=false}\n    if(q('ps5Ip')){q('ps5Ip').value=ps5Ip;q('ps5Ip').readOnly=false;q('ps5Ip').disabled=false}\n    return {bridgeUrl,ps5Ip,pollInterval};\n  }\n  async function v5TestBridge(){\n    const started=performance.now();\n    const paths=['/api/health','/api/status','/api/live','/api/fields'];\n    const errors=[];\n    for(const path of paths){\n      try{return {ok:true,path,latencyMs:Math.max(1,Math.round(performance.now()-started)),data:await http(path,{timeout:4000})}}\n      catch(error){errors.push(path+': '+(error&&error.message||error))}\n    }\n    throw new Error(errors.join(' | '));\n  }\n  function v5Reconnect(){clearTimeout(timer);running=false;failures=0;lastError='';start()}\n  function v5Stop(){clearTimeout(timer);running=false;paint('off','PARADA MANUAL')}\n  async function v5Restart(){const result=await http('/api/restart',{method:'POST',data:{},timeout:9000});setTimeout(v5Reconnect,500);return result}\n`;
  bridge=bridge.replace(anchor,injected);
}

bridge=bridge.replace(/const url\s*=\s*(?:BRIDGE|DEFAULT_BRIDGE|getBridgeUrl\(\)|v5BridgeUrl\(\))\s*\+\s*path;/g,'const url = v5BridgeUrl() + path;');
bridge=bridge.replace(/bridgeUrl:\s*(?:BRIDGE|DEFAULT_BRIDGE|getBridgeUrl\(\))/g,'bridgeUrl: v5BridgeUrl()');
bridge=bridge.replace(/bridge:\s*(?:BRIDGE|DEFAULT_BRIDGE|getBridgeUrl\(\))/g,'bridge: v5BridgeUrl()');
bridge=bridge.replace(/q\('bridgeUrl'\)\.value\s*=\s*(?:BRIDGE|DEFAULT_BRIDGE|getBridgeUrl\(\));/g,"q('bridgeUrl').value=v5BridgeUrl();");
bridge=bridge.replace(/q\('bridgeUrl'\)\.readOnly\s*=\s*true;/g,"q('bridgeUrl').readOnly=false;q('bridgeUrl').disabled=false;");
bridge=bridge.replace(/localStorage\.setItem\('gt7_bridge_url',\s*(?:BRIDGE|DEFAULT_BRIDGE|getBridgeUrl\(\))\)\s*;?/g,"localStorage.setItem('gt7_bridge_url',v5BridgeUrl());");
bridge=bridge.replace(/localStorage\.setItem\('gt7_bridge',\s*(?:BRIDGE|DEFAULT_BRIDGE|getBridgeUrl\(\))\)\s*;?/g,"localStorage.setItem('gt7_bridge',v5BridgeUrl());");
bridge=bridge.replace(/timer\s*=\s*setTimeout\(tick,\s*failures\s*\?\s*Math\.min\(3000,\s*900\s*\+\s*failures\s*\*\s*350\)\s*:\s*(?:700|getPollInterval\(\)|v5PollInterval\(\))\s*\);/g,'timer=setTimeout(tick,failures?Math.min(3000,900+failures*350):v5PollInterval());');

const exportAnchor='window.api = command;';
if(!bridge.includes(exportAnchor))throw new Error('Exportação do controlador não encontrada');
if(!bridge.includes('window.gt7V5Network =')){
  bridge=bridge.replace(exportAnchor,`if(window.gt7Bridge){\n    window.gt7Bridge.saveNetworkSettings=v5SaveNetworkSettings;\n    window.gt7Bridge.testBridgeConnection=v5TestBridge;\n    window.gt7Bridge.restartBridgeService=v5Restart;\n    window.gt7Bridge.reconnectBridge=v5Reconnect;\n    window.gt7Bridge.stopBridge=v5Stop;\n  }\n  window.gt7V5Network={save:v5SaveNetworkSettings,test:v5TestBridge,restart:v5Restart,reconnect:v5Reconnect,stop:v5Stop,get bridgeUrl(){return v5BridgeUrl()},get ps5Ip(){return v5Ps5Ip()},get pollInterval(){return v5PollInterval()}};\n  ${exportAnchor}`);
}

const runtime=`<script>\n/* ${MARK} UI */\n(function(){\n const DEFAULTS={bridgeUrl:'${DEFAULT_BRIDGE}',ps5Ip:'${DEFAULT_PS5}',pollInterval:700};\n const q=id=>document.getElementById(id);\n function status(text,bad){const out=q('setBridgeStatus');if(out){out.textContent=text;out.style.color=bad?'#ff5b70':'var(--cyan)'}}\n function network(){return window.gt7V5Network||window.gt7Bridge}\n function values(){return {bridgeUrl:q('setBridgeUrl').value.trim(),ps5Ip:q('setPs5Ip').value.trim(),pollInterval:Number(q('setPollInterval').value)}}\n function installSettings(){\n  const page=q('settings');if(!page)return;\n  const host=page.querySelector('.settings')||page;host.innerHTML='';\n  const card=document.createElement('div');card.className='card';card.id='setBridgeControl';\n  card.innerHTML='<div class="label">CONEXÃO EDITÁVEL</div><label class="smallsub" for="setBridgeUrl">URL HTTP DA BRIDGE</label><input id="setBridgeUrl" inputmode="url" autocomplete="off"><label class="smallsub" for="setPs5Ip">IP DO PS5</label><input id="setPs5Ip" inputmode="decimal" autocomplete="off"><label class="smallsub" for="setPollInterval">INTERVALO DE LEITURA (MS)</label><input id="setPollInterval" type="number" min="250" max="5000"><button class="action" id="setSaveReconnect" type="button">SALVAR E RECONECTAR</button><button class="action" id="setTestBridge" type="button">TESTAR CONEXÃO</button><button class="action red" id="setRestartBridge" type="button">REINICIAR BRIDGE</button><button class="action red" id="setStopBridge" type="button">PARAR LEITURA</button><div class="smallsub" id="setBridgeStatus">PRONTO PARA CONFIGURAR</div>';\n  host.appendChild(card);\n  q('setBridgeUrl').value=localStorage.getItem('gt7_bridge_url')||DEFAULTS.bridgeUrl;\n  q('setPs5Ip').value=localStorage.getItem('gt7_ps5_ip')||DEFAULTS.ps5Ip;\n  q('setPollInterval').value=localStorage.getItem('gt7_poll_interval')||DEFAULTS.pollInterval;\n  q('setSaveReconnect').onclick=()=>{try{const api=network();if(!api||typeof api.save!=='function')throw new Error('Controlador ainda não carregou');const saved=api.save(values());status('SALVO · '+saved.bridgeUrl+' · PS5 '+saved.ps5Ip);api.reconnect()}catch(error){status('ERRO · '+(error.message||error),true)}};\n  q('setTestBridge').onclick=async()=>{try{const api=network();status('TESTANDO...');const result=await api.test();status('BRIDGE ONLINE · '+result.latencyMs+' ms · '+result.path)}catch(error){status('FALHOU · '+(error.message||error),true)}};\n  q('setRestartBridge').onclick=async()=>{try{const api=network();api.save(values());status('REINICIANDO...');await api.restart();status('BRIDGE REINICIADA')}catch(error){status('ERRO · '+(error.message||error),true)}};\n  q('setStopBridge').onclick=()=>{const api=network();if(api&&api.stop)api.stop();status('LEITURA PARADA')};\n }\n function parseLapMs(value){\n  if(value===null||value===undefined||value==='')return null;\n  if(typeof value==='object')value=value.ms??value.timeMs??value.lapTimeMs??value.durationMs??value.time??value.lapTime??value.formatted??value.value;\n  if(typeof value==='number')return Number.isFinite(value)&&value>0?(value<1000?Math.round(value*1000):Math.round(value)):null;\n  const text=String(value).trim().replace(',', '.');if(!text||text==='--')return null;\n  const parts=text.split(':').map(Number);if(parts.some(v=>!Number.isFinite(v)))return null;\n  let seconds=parts.length===3?parts[0]*3600+parts[1]*60+parts[2]:parts.length===2?parts[0]*60+parts[1]:parts[0];\n  return seconds>0?Math.round(seconds*1000):null;\n }\n function completedLaps(data){\n  const sources=[data&&data.lapTimes,data&&data.completedLapTimes,data&&data.analysis&&data.analysis.lapTimes,data&&data.completedLaps,data&&data.laps,data&&data.session&&data.session.laps,data&&data.active&&data.active.laps];\n  const source=sources.find(list=>Array.isArray(list)&&list.length)||[];\n  return source.map(parseLapMs).filter(ms=>Number.isFinite(ms)&&ms>0);\n }\n function formatMs(input){let ms=Math.max(0,Math.round(Number(input)||0));if(!ms)return'--';const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);ms%=60000;const s=Math.floor(ms/1000),z=ms%1000;const core=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(z).padStart(3,'0');return h?String(h).padStart(2,'0')+':'+core:core}\n function ensureTotalCard(){\n  const grid=q('fieldGrid');if(!grid)return;\n  let card=grid.querySelector('[data-field="total"]');\n  if(!card){card=document.createElement('div');card.className='card stat';card.dataset.field='total';card.innerHTML='<div class="label">TEMPO TOTAL</div><div class="value cyan" id="v5TotalValue">--</div>';const udm=grid.querySelector('[data-field="udm"]');udm?grid.insertBefore(card,udm):grid.appendChild(card)}\n  card.style.removeProperty('display');card.classList.remove('hiddenByDesigner');\n  if(!q('v5TotalValue')){const value=card.querySelector('.value');if(value)value.id='v5TotalValue'}\n }\n function updateTotal(data){\n  ensureTotalCard();const laps=completedLaps(data||{});const totalMs=laps.reduce((sum,ms)=>sum+ms,0);\n  const text=totalMs?formatMs(totalMs):(data&&data.analysis&&data.analysis.total||data&&data.tempoTotalCorrida||'--');\n  const value=q('v5TotalValue');if(value)value.textContent=text;const old=q('total');if(old)old.textContent=text;\n  if(data&&typeof data==='object'){data.analysis=data.analysis||{};data.analysis.total=text;data.analysis.totalMs=totalMs;data.tempoTotalCorrida=text}\n }\n function patchRender(){if(typeof window.render!=='function'||window.render.__v5Stable)return;const previous=window.render;const wrapped=function(data){const result=previous.apply(this,arguments);updateTotal(data||{});return result};wrapped.__v5Stable=true;window.render=wrapped}\n function init(){installSettings();ensureTotalCard();patchRender();updateTotal(window.live||{})}\n if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else setTimeout(init,0);\n})();\n</script>`;
html=html.replace('</body>',runtime+'\n</body>');

for(const token of ['setBridgeUrl','setPs5Ip','setSaveReconnect','v5SaveNetworkSettings','v5BridgeUrl','v5TotalValue','laps.reduce((sum,ms)=>sum+ms,0)']){
  if(!html.includes(token)&&!bridge.includes(token))throw new Error('Validação V5 ausente: '+token);
}
if(/const\s+BRIDGE\s*=/.test(bridge))throw new Error('A Bridge ainda está fixa no controlador');
if(!/const url\s*=\s*v5BridgeUrl\(\)\s*\+\s*path;/.test(bridge))throw new Error('HTTP ainda não usa o endereço editável');
fs.writeFileSync(bridgePath,bridge);
fs.writeFileSync(indexPath,html);
console.log('V5 estável: Bridge e PS5 editáveis; Tempo Total soma todas as voltas concluídas.');
