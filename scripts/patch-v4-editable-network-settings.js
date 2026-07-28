const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const bridgePath=path.join(root,'www','bridge-v408.js');
const indexPath=path.join(root,'www','index.html');
let js=fs.readFileSync(bridgePath,'utf8');
let html=fs.readFileSync(indexPath,'utf8');
const MARK='V4 SET REBUILD BRIDGE CONTROL';
const SCRIPT_BLOCK=/<script\b[^>]*>[\s\S]*?<\/script>\s*/gi;

function removeMarked(source){
 return source.replace(SCRIPT_BLOCK,block=>
  block.includes('V4 EDITABLE NETWORK SETTINGS UI')||
  block.includes('V4 SET REBUILD BRIDGE CONTROL UI') ? '' : block);
}

js=js.replace("const BRIDGE = 'http://192.168.1.70:8788';","const DEFAULT_BRIDGE = 'http://192.168.1.70:8788';");
js=js.replace("const DEFAULT_PS5 = '192.168.1.81';","const DEFAULT_PS5 = '192.168.1.81';");

if(!js.includes(`/* ${MARK} */`)){
 const anchor="const q = id => document.getElementById(id);";
 if(!js.includes(anchor))throw new Error('Âncora da Bridge não encontrada');
 js=js.replace(anchor,`${anchor}\n\n  /* ${MARK} */\n  function normalizeBridgeUrl(value){\n    let text=String(value||'').trim();\n    if(!text)return DEFAULT_BRIDGE;\n    if(!/^https?:\\/\\//i.test(text))text='http://'+text;\n    return text.replace(/\\/$/,'');\n  }\n  function validPort(value,fallback){\n    const n=Number(value);return Number.isInteger(n)&&n>0&&n<65536?n:fallback;\n  }\n  function getBridgeUrl(){return normalizeBridgeUrl(localStorage.getItem('gt7_bridge_url')||DEFAULT_BRIDGE)}\n  function getUdpPort(){return validPort(localStorage.getItem('gt7_udp_port'),33740)}\n  function getHeartbeatPort(){return validPort(localStorage.getItem('gt7_heartbeat_port'),33739)}\n  function getPollInterval(){return Math.max(250,Math.min(5000,Number(localStorage.getItem('gt7_poll_interval')||700)||700))}\n  function saveNetworkSettings(settings){\n    const bridge=normalizeBridgeUrl(settings.bridgeUrl);\n    const ps5=String(settings.ps5Ip||'').trim();\n    const udp=validPort(settings.udpPort,0);\n    const heartbeat=validPort(settings.heartbeatPort,0);\n    const poll=Math.max(250,Math.min(5000,Number(settings.pollInterval)||700));\n    if(!validIp(ps5))throw new Error('IP do PS5 inválido');\n    if(!udp)throw new Error('Porta UDP inválida');\n    if(!heartbeat)throw new Error('Porta heartbeat inválida');\n    localStorage.setItem('gt7_bridge_url',bridge);\n    localStorage.setItem('gt7_bridge',bridge);\n    localStorage.setItem('gt7_ps5_ip',ps5);\n    localStorage.setItem('gt7_udp_port',String(udp));\n    localStorage.setItem('gt7_heartbeat_port',String(heartbeat));\n    localStorage.setItem('gt7_poll_interval',String(poll));\n    configuredPs5='';applyConfig();return {bridgeUrl:bridge,ps5Ip:ps5,udpPort:udp,heartbeatPort:heartbeat,pollInterval:poll};\n  }\n  async function testBridgeConnection(){\n    const started=performance.now();\n    const paths=['/api/health','/api/status','/api/live','/api/fields'];\n    const errors=[];\n    for(const path of paths){try{const data=await http(path,{timeout:3000});return {ok:true,path,latencyMs:Math.max(1,Math.round(performance.now()-started)),data}}catch(e){errors.push(path+': '+(e.message||e))}}\n    throw new Error(errors.join(' | '));\n  }\n  async function restartBridgeService(){\n    clearTimeout(timer);running=false;\n    const paths=['/api/restart','/api/bridge/restart','/api/control/restart'];\n    const errors=[];\n    for(const path of paths){try{await http(path,{method:'POST',data:{ps5Ip:getPs5Ip(),udpPort:getUdpPort(),heartbeatPort:getHeartbeatPort()},timeout:3500});setTimeout(start,1400);return {ok:true,path}}catch(e){errors.push(path+': '+(e.message||e))}}\n    start();return {ok:false,localRestart:true,errors};\n  }\n  function stopBridge(){clearTimeout(timer);running=false;paint('off','PARADA MANUAL');}\n  function reconnectBridge(){clearTimeout(timer);failures=0;lastError='';start();}\n`);
}

js=js.replace(/const url = BRIDGE \+ path;/g,'const url = getBridgeUrl() + path;');
js=js.replace(/bridgeUrl: BRIDGE/g,'bridgeUrl: getBridgeUrl()');
js=js.replace(/bridge: BRIDGE/g,'bridge: getBridgeUrl()');
js=js.replace(/q\('bridgeUrl'\)\.value = BRIDGE;/g,"q('bridgeUrl').value = getBridgeUrl();");
js=js.replace(/q\('bridgeUrl'\)\.readOnly = true;/g,"q('bridgeUrl').removeAttribute('readonly');q('bridgeUrl').disabled=false;");
js=js.replace(/localStorage\.setItem\('gt7_bridge_url', BRIDGE\);/g,"localStorage.setItem('gt7_bridge_url',getBridgeUrl());");
js=js.replace(/localStorage\.setItem\('gt7_bridge', BRIDGE\);/g,"localStorage.setItem('gt7_bridge',getBridgeUrl());");
js=js.replace(/destinationPort:\s*33739/g,'destinationPort:getHeartbeatPort()');
js=js.replace(/udpReceivePort:\s*33740/g,'udpReceivePort:getUdpPort()');
js=js.replace(/heartbeatPort:\s*33739/g,'heartbeatPort:getHeartbeatPort()');
js=js.replace(/receivePort:\s*33740/g,'receivePort:getUdpPort()');
js=js.replace(/timer = setTimeout\(tick, failures \? Math\.min\(3000, 900 \+ failures \* 350\) : 700\);/g,'timer=setTimeout(tick,failures?Math.min(3000,900+failures*350):getPollInterval());');

if(!js.includes('saveNetworkSettings, testBridgeConnection, restartBridgeService')){
 js=js.replace('start, tick, request:http, command, adapt, setPs5Ip:savePs5Ip,','start, tick, request:http, command, adapt, setPs5Ip:savePs5Ip, saveNetworkSettings, testBridgeConnection, restartBridgeService, reconnectBridge, stopBridge,');
}
js=js.replace('get ps5Ip(){ return getPs5Ip(); }','get ps5Ip(){return getPs5Ip();},\n    get bridgeUrl(){return getBridgeUrl();},\n    get udpPort(){return getUdpPort();},\n    get heartbeatPort(){return getHeartbeatPort();},\n    get pollInterval(){return getPollInterval();}');

const ui=`<script>\n/* ${MARK} UI */\n(function(){\n const D={bridgeUrl:'http://192.168.1.70:8788',ps5Ip:'192.168.1.81',udpPort:33740,heartbeatPort:33739,pollInterval:700};\n const q=id=>document.getElementById(id);\n function status(text,bad){const e=q('setBridgeStatus');if(e){e.textContent=text;e.style.color=bad?'#ff5b70':'var(--cyan)'}}\n function values(){return {bridgeUrl:q('setBridgeUrl').value,ps5Ip:q('setPs5Ip').value,udpPort:Number(q('setUdpPort').value),heartbeatPort:Number(q('setHeartbeatPort').value),pollInterval:Number(q('setPollInterval').value)}}\n function fill(){q('setBridgeUrl').value=localStorage.getItem('gt7_bridge_url')||D.bridgeUrl;q('setPs5Ip').value=localStorage.getItem('gt7_ps5_ip')||D.ps5Ip;q('setUdpPort').value=localStorage.getItem('gt7_udp_port')||D.udpPort;q('setHeartbeatPort').value=localStorage.getItem('gt7_heartbeat_port')||D.heartbeatPort;q('setPollInterval').value=localStorage.getItem('gt7_poll_interval')||D.pollInterval}\n async function save(){try{window.gt7Bridge.saveNetworkSettings(values());status('SALVO · REINICIANDO CONEXÃO');window.gt7Bridge.reconnectBridge()}catch(e){status('ERRO · '+(e.message||e),true)}}\n async function test(){status('TESTANDO BRIDGE...');try{const r=await window.gt7Bridge.testBridgeConnection();status('ONLINE · '+r.path+' · '+r.latencyMs+' ms')}catch(e){status('FALHOU · '+(e.message||e),true)}}\n async function restart(){status('REINICIANDO BRIDGE...');try{window.gt7Bridge.saveNetworkSettings(values());const r=await window.gt7Bridge.restartBridgeService();status(r.ok?'REINÍCIO ENVIADO · '+r.path:'REINÍCIO LOCAL · ENDPOINT REMOTO INDISPONÍVEL',!r.ok)}catch(e){status('ERRO · '+(e.message||e),true)}}\n function install(){\n  const page=q('settings');if(!page)return;\n  const host=page.querySelector('.settings')||page;host.innerHTML='';\n  const card=document.createElement('div');card.className='card';card.id='setBridgeControl';\n  card.innerHTML='<div class="label">BRIDGE E PS5</div><label class="smallsub">BRIDGE HTTP</label><input id="setBridgeUrl" inputmode="url"><label class="smallsub">IP DO PS5</label><input id="setPs5Ip" inputmode="decimal"><div class="row2"><div><label class="smallsub">UDP</label><input id="setUdpPort" type="number" min="1" max="65535"></div><div><label class="smallsub">HEARTBEAT</label><input id="setHeartbeatPort" type="number" min="1" max="65535"></div></div><label class="smallsub">INTERVALO DE LEITURA (MS)</label><input id="setPollInterval" type="number" min="250" max="5000"><button class="action" id="setSaveReconnect" type="button">SALVAR E RECONECTAR</button><button class="action" id="setTestBridge" type="button">TESTAR BRIDGE</button><button class="action red" id="setRestartBridge" type="button">REINICIAR BRIDGE</button><button class="action red" id="setStopBridge" type="button">PARAR CONEXÃO</button><div class="smallsub" id="setBridgeStatus">PRONTO</div>';
  host.appendChild(card);fill();q('setSaveReconnect').onclick=save;q('setTestBridge').onclick=test;q('setRestartBridge').onclick=restart;q('setStopBridge').onclick=()=>{window.gt7Bridge.stopBridge();status('CONEXÃO PARADA')};\n }\n if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else setTimeout(install,0);\n})();\n</script>`;

html=removeMarked(html);
html=html.replace('</body>',ui+'\n</body>');

for(const id of ['setBridgeControl','setBridgeUrl','setPs5Ip','setUdpPort','setHeartbeatPort','setSaveReconnect','setTestBridge','setRestartBridge'])if(!html.includes(id))throw new Error('Controle SET ausente: '+id);
for(const fn of ['saveNetworkSettings','testBridgeConnection','restartBridgeService','reconnectBridge','stopBridge'])if(!js.includes(fn))throw new Error('Função da Bridge ausente: '+fn);
fs.writeFileSync(bridgePath,js);
fs.writeFileSync(indexPath,html);
console.log('SET reconstruído e controles da Bridge instalados.');