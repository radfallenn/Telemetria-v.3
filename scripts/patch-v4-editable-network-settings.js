const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const bridgePath=path.join(root,'www','bridge-v408.js');
const indexPath=path.join(root,'www','index.html');
let js=fs.readFileSync(bridgePath,'utf8');
let html=fs.readFileSync(indexPath,'utf8');
const MARK='V4 EDITABLE NETWORK SETTINGS';
const SCRIPT_BLOCK=/<script\b[^>]*>[\s\S]*?<\/script>\s*/gi;

function removeScriptBlocksByMarker(source,marker){
 return source.replace(SCRIPT_BLOCK,block=>block.includes(marker)?'':block);
}

// Torna a URL HTTP da Bridge dinâmica e persistente.
js=js.replace("const BRIDGE = 'http://192.168.1.70:8788';", "const DEFAULT_BRIDGE = 'http://192.168.1.70:8788';");
if(!js.includes('function getBridgeUrl(){')){
  js=js.replace("const q = id => document.getElementById(id);", `const q = id => document.getElementById(id);\n\n  /* ${MARK} */\n  function normalizeBridgeUrl(value){\n    let text=String(value||'').trim();\n    if(!text)return DEFAULT_BRIDGE;\n    if(!/^https?:\\/\\//i.test(text))text='http://'+text;\n    return text.replace(/\\/$/,'');\n  }\n  function getBridgeUrl(){return normalizeBridgeUrl(localStorage.getItem('gt7_bridge_url')||DEFAULT_BRIDGE)}\n  function getUdpPort(){const n=Number(localStorage.getItem('gt7_udp_port')||33740);return Number.isInteger(n)&&n>0&&n<65536?n:33740}\n  function getHeartbeatPort(){const n=Number(localStorage.getItem('gt7_heartbeat_port')||33739);return Number.isInteger(n)&&n>0&&n<65536?n:33739}\n  function saveNetworkSettings(settings){\n    const bridge=normalizeBridgeUrl(settings.bridgeUrl);\n    const ps5=String(settings.ps5Ip||'').trim();\n    const udp=Number(settings.udpPort);\n    const heartbeat=Number(settings.heartbeatPort);\n    if(!validIp(ps5))throw new Error('IP do PS5 inválido');\n    if(!Number.isInteger(udp)||udp<1||udp>65535)throw new Error('Porta UDP inválida');\n    if(!Number.isInteger(heartbeat)||heartbeat<1||heartbeat>65535)throw new Error('Porta heartbeat inválida');\n    localStorage.setItem('gt7_bridge_url',bridge);\n    localStorage.setItem('gt7_bridge',bridge);\n    localStorage.setItem('gt7_ps5_ip',ps5);\n    localStorage.setItem('gt7_udp_port',String(udp));\n    localStorage.setItem('gt7_heartbeat_port',String(heartbeat));\n    configuredPs5='';\n    applyConfig();\n    start();\n    return true;\n  }`);
}
js=js.replace(/const url = BRIDGE \+ path;/g,'const url = getBridgeUrl() + path;');
js=js.replace(/bridgeUrl: BRIDGE/g,'bridgeUrl: getBridgeUrl()');
js=js.replace(/bridge: BRIDGE/g,'bridge: getBridgeUrl()');
js=js.replace(/q\('bridgeUrl'\)\.value = BRIDGE;/g,"q('bridgeUrl').value = getBridgeUrl();");
js=js.replace(/q\('bridgeUrl'\)\.readOnly = true;/g,"q('bridgeUrl').removeAttribute('readonly'); q('bridgeUrl').disabled=false;");
js=js.replace(/localStorage\.setItem\('gt7_bridge_url', BRIDGE\);/g,"localStorage.setItem('gt7_bridge_url', getBridgeUrl());");
js=js.replace(/localStorage\.setItem\('gt7_bridge', BRIDGE\);/g,"localStorage.setItem('gt7_bridge', getBridgeUrl());");
js=js.replace(/destinationPort:\s*33739/g,'destinationPort: getHeartbeatPort()');
js=js.replace(/udpReceivePort:\s*33740/g,'udpReceivePort: getUdpPort()');
js=js.replace(/heartbeatPort:\s*33739/g,'heartbeatPort: getHeartbeatPort()');
js=js.replace(/receivePort:\s*33740/g,'receivePort: getUdpPort()');
js=js.replace(/heartbeat_port:\s*33739/g,'heartbeat_port: getHeartbeatPort()');
js=js.replace(/udp_port:\s*33740/g,'udp_port: getUdpPort()');

// Expõe a API editável.
js=js.replace('start, tick, request:http, command, adapt, setPs5Ip:savePs5Ip,', 'start, tick, request:http, command, adapt, setPs5Ip:savePs5Ip, saveNetworkSettings,');
js=js.replace('get ps5Ip(){ return getPs5Ip(); }', 'get ps5Ip(){ return getPs5Ip(); },\n    get bridgeUrl(){ return getBridgeUrl(); },\n    get udpPort(){ return getUdpPort(); },\n    get heartbeatPort(){ return getHeartbeatPort(); }');

// Configuração automática pronta; campos técnicos ficam recolhidos em Avançado.
const ui=`<script>\n/* ${MARK} UI */\n(function(){\n const AUTO={bridgeUrl:'http://192.168.1.70:8788',ps5Ip:'192.168.1.81',udpPort:33740,heartbeatPort:33739};\n function q(id){return document.getElementById(id)}\n function applyAutomatic(showMessage){\n  try{\n   const api=window.gt7Bridge||{};\n   if(typeof api.saveNetworkSettings!=='function')throw new Error('Controlador da Bridge indisponível');\n   api.saveNetworkSettings(AUTO);\n   if(q('networkSettingsStatus'))q('networkSettingsStatus').textContent=showMessage?'CONFIGURAÇÃO AUTOMÁTICA APLICADA · RECONECTANDO':'CONFIGURAÇÃO AUTOMÁTICA ATIVA';\n  }catch(e){if(q('networkSettingsStatus'))q('networkSettingsStatus').textContent='ERRO · '+(e.message||e)}\n }\n function saveAdvanced(){\n  try{\n   const api=window.gt7Bridge||{};\n   if(typeof api.saveNetworkSettings!=='function')throw new Error('Controlador da Bridge indisponível');\n   api.saveNetworkSettings({bridgeUrl:q('editableBridgeUrl').value,ps5Ip:q('editablePs5Ip').value,udpPort:Number(q('editableUdpPort').value),heartbeatPort:Number(q('editableHeartbeatPort').value)});\n   q('networkSettingsStatus').textContent='CONFIGURAÇÃO AVANÇADA SALVA · RECONECTANDO';\n  }catch(e){q('networkSettingsStatus').textContent='ERRO · '+(e.message||e)}\n }\n function install(){\n  const settings=q('settings');if(!settings||q('networkSettingsCard'))return;\n  const host=settings.querySelector('.settings')||settings;\n  const card=document.createElement('div');card.className='card';card.id='networkSettingsCard';\n  card.innerHTML='<div class="label">CONEXÃO AUTOMÁTICA</div>'+\n   '<div class="smallsub">Bridge e PS5 já configurados. Não é necessário preencher endereço ou portas.</div>'+\n   '<button class="action" id="applyAutomaticNetwork" type="button">RECONECTAR AUTOMATICAMENTE</button>'+\n   '<div class="smallsub" id="networkSettingsStatus">CONFIGURAÇÃO AUTOMÁTICA ATIVA</div>'+\n   '<details id="advancedNetworkSettings" style="margin-top:10px"><summary class="smallsub">CONFIGURAÇÃO AVANÇADA</summary>'+\n   '<label class="smallsub">BRIDGE HTTP</label><input id="editableBridgeUrl" inputmode="url">'+\n   '<label class="smallsub">IP DO PS5</label><input id="editablePs5Ip" inputmode="decimal">'+\n   '<label class="smallsub">PORTA UDP</label><input id="editableUdpPort" inputmode="numeric" type="number" min="1" max="65535">'+\n   '<label class="smallsub">PORTA HEARTBEAT</label><input id="editableHeartbeatPort" inputmode="numeric" type="number" min="1" max="65535">'+\n   '<button class="action" id="saveNetworkSettings" type="button">SALVAR AVANÇADO</button></details>';\n  host.prepend(card);\n  q('editableBridgeUrl').value=localStorage.getItem('gt7_bridge_url')||AUTO.bridgeUrl;\n  q('editablePs5Ip').value=localStorage.getItem('gt7_ps5_ip')||AUTO.ps5Ip;\n  q('editableUdpPort').value=localStorage.getItem('gt7_udp_port')||String(AUTO.udpPort);\n  q('editableHeartbeatPort').value=localStorage.getItem('gt7_heartbeat_port')||String(AUTO.heartbeatPort);\n  q('applyAutomaticNetwork').onclick=()=>applyAutomatic(true);\n  q('saveNetworkSettings').onclick=saveAdvanced;\n  if(!localStorage.getItem('gt7_auto_network_v1')){\n   localStorage.setItem('gt7_auto_network_v1','1');\n   setTimeout(()=>applyAutomatic(false),150);\n  }\n }\n if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else setTimeout(install,0);\n})();\n</script>`;

html=removeScriptBlocksByMarker(html,MARK+' UI');
html=html.replace('</body>',ui+'\n</body>');

if(!js.includes('saveNetworkSettings'))throw new Error('Configuração automática não instalada na Bridge');
for(const required of ['applyAutomaticNetwork','advancedNetworkSettings','editableBridgeUrl','editablePs5Ip','editableUdpPort','editableHeartbeatPort']){
 if(!html.includes(required))throw new Error('Campo ou controle de rede não instalado: '+required);
}
const networkUiCount=(html.match(/V4 EDITABLE NETWORK SETTINGS UI/g)||[]).length;
if(networkUiCount!==1)throw new Error('Quantidade inválida de interfaces de rede: '+networkUiCount);
fs.writeFileSync(bridgePath,js);
fs.writeFileSync(indexPath,html);
console.log('Conexão automática instalada; campos técnicos ficam ocultos em Configuração avançada.');
