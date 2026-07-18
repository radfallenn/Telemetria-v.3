'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const bridgePath = path.join(root, 'www', 'bridge-v408.js');
const indexPath = path.join(root, 'www', 'index.html');
const MARK = 'V4 RELAY SETTINGS UI';
const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script>\s*/gi;

function removeScriptBlocksByMarker(source, marker) {
  return source.replace(SCRIPT_BLOCK, block => block.includes(marker) ? '' : block);
}

let js = fs.readFileSync(bridgePath, 'utf8');
let html = fs.readFileSync(indexPath, 'utf8');

if (!js.includes('async function getRelayStatus(){')) {
  const anchor = '  async function command(path, data){ return http(path, { method: \'POST\', data: data || {}, timeout: 6000 }); }';
  if (!js.includes(anchor)) throw new Error('Ponto de instalação da API do relay não encontrado');
  const relayApi = `  /* ${MARK} API */
  async function getRelayStatus(){
    const payload=await http('/api/relay',{timeout:4500});
    return payload&&payload.relay?payload.relay:payload;
  }
  async function saveRelayTargets(targets){
    const payload=await http('/api/relay',{method:'POST',data:{targets:Array.isArray(targets)?targets:[]},timeout:6000});
    return payload&&payload.relay?payload.relay:payload;
  }

`;
  js = js.replace(anchor, relayApi + anchor);
}

if (!js.includes('getRelayStatus, saveRelayTargets,')) {
  const apiAnchor = 'start, tick, request:http, command, adapt, setPs5Ip:savePs5Ip, saveNetworkSettings,';
  if (!js.includes(apiAnchor)) throw new Error('API editável da Bridge não encontrada antes do relay');
  js = js.replace(apiAnchor, apiAnchor + ' getRelayStatus, saveRelayTargets,');
}

const ui = `<script>
/* ${MARK} */
(function(){
 'use strict';
 const q=id=>document.getElementById(id);
 let relayTargets=[];
 let lastForwarded=0;
 let statusTimer=0;
 function esc(value){return String(value==null?'':value).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}
 function api(){return window.gt7Bridge||{}}
 function selectedIndex(){const n=Number(q('relayTargetSelect')&&q('relayTargetSelect').value);return Number.isInteger(n)&&n>=0?n:-1}
 function setMessage(text,error){const el=q('relaySettingsStatus');if(!el)return;el.textContent=text||'';el.style.color=error?'#ff6b6b':''}
 function formatTime(value){if(!value)return'--';try{return new Date(value).toLocaleTimeString('pt-BR')}catch(_){return'--'}}
 function renderStats(relay){
  const el=q('relayStats');if(!el)return;
  relay=relay||{};
  el.innerHTML='<b>'+(relay.enabled?'ATIVO':'DESATIVADO')+'</b> · DESTINOS '+Number(relay.activeTargets||0)+'<br>'+ 
   'PS5 '+Number(relay.packetsFromPs5||0)+' · ENVIADOS '+Number(relay.packetsForwarded||0)+' · ERROS '+Number(relay.sendErrors||0)+'<br>'+ 
   'ÚLTIMO PACOTE '+esc(formatTime(relay.lastPacketAt))+' · ÚLTIMO ENVIO '+esc(formatTime(relay.lastForwardAt));
 }
 function renderSelect(preferred){
  const select=q('relayTargetSelect');if(!select)return;
  const current=Number.isInteger(preferred)?preferred:selectedIndex();
  select.innerHTML='<option value="-1">NOVO DESTINO</option>'+relayTargets.map(function(target,index){return '<option value="'+index+'">'+esc(target.name||('Destino '+(index+1)))+' · '+esc(target.host)+':'+Number(target.port||0)+'</option>'}).join('');
  select.value=current>=0&&current<relayTargets.length?String(current):'-1';
  fillForm();
 }
 function fillForm(){
  const index=selectedIndex(),target=index>=0?relayTargets[index]:null;
  q('relayName').value=target&&target.name||'';
  q('relayHost').value=target&&target.host||'';
  q('relayPort').value=target&&target.port||'33741';
  q('relayEnabled').checked=!target||target.enabled!==false;
  q('removeRelayTarget').disabled=index<0;
 }
 function readForm(){
  const name=String(q('relayName').value||'').trim()||'Destino';
  const host=String(q('relayHost').value||'').trim();
  const port=Number(q('relayPort').value);
  const parts=host.split('.');
  const validIp=parts.length===4&&parts.every(function(part){return /^\\d{1,3}$/.test(part)&&Number(part)>=0&&Number(part)<=255});
  if(!validIp)throw new Error('IP do destino inválido');
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Porta do destino inválida');
  return{name:name.slice(0,40),host:host,port:port,enabled:q('relayEnabled').checked};
 }
 async function refreshRelay(silent){
  try{
   if(typeof api().getRelayStatus!=='function')throw new Error('Atualize a Bridge e reinstale o aplicativo');
   const relay=await api().getRelayStatus();
   relayTargets=Array.isArray(relay&&relay.targets)?relay.targets:[];
   renderSelect(selectedIndex());
   renderStats(relay);
   if(!silent)setMessage('STATUS ATUALIZADO');
   return relay;
  }catch(error){if(!silent)setMessage('ERRO · '+(error.message||error),true);throw error}
 }
 async function saveTarget(){
  try{
   if(typeof api().saveRelayTargets!=='function')throw new Error('Controlador do relay indisponível');
   const target=readForm(),index=selectedIndex();
   if(index>=0)relayTargets[index]=target;else{
    if(relayTargets.length>=10)throw new Error('Limite de 10 destinos atingido');
    relayTargets.push(target);
   }
   const relay=await api().saveRelayTargets(relayTargets);
   relayTargets=Array.isArray(relay&&relay.targets)?relay.targets:relayTargets;
   const savedIndex=index>=0?index:relayTargets.length-1;
   renderSelect(savedIndex);renderStats(relay);setMessage('DESTINO SALVO · RELAY '+(relay&&relay.enabled?'ATIVO':'DESATIVADO'));
  }catch(error){setMessage('ERRO · '+(error.message||error),true)}
 }
 async function removeTarget(){
  try{
   const index=selectedIndex();if(index<0)return;
   relayTargets.splice(index,1);
   const relay=await api().saveRelayTargets(relayTargets);
   relayTargets=Array.isArray(relay&&relay.targets)?relay.targets:relayTargets;
   renderSelect(-1);renderStats(relay);setMessage('DESTINO REMOVIDO');
  }catch(error){setMessage('ERRO · '+(error.message||error),true)}
 }
 async function testRelay(){
  try{
   setMessage('TESTANDO RELAY...');
   const before=await refreshRelay(true);lastForwarded=Number(before&&before.packetsForwarded||0);
   await new Promise(function(resolve){setTimeout(resolve,1800)});
   const after=await refreshRelay(true),forwarded=Number(after&&after.packetsForwarded||0),fromPs5=Number(after&&after.packetsFromPs5||0);
   if(Number(after&&after.activeTargets||0)<1)setMessage('RELAY SEM DESTINO ATIVO',true);
   else if(forwarded>lastForwarded)setMessage('TESTE OK · PACOTES ENCAMINHADOS');
   else if(fromPs5<1)setMessage('CONFIGURADO · AGUARDANDO TELEMETRIA DO PS5');
   else setMessage('ATIVO · SEM NOVO PACOTE DURANTE O TESTE');
  }catch(error){setMessage('ERRO · '+(error.message||error),true)}
 }
 function install(){
  const settings=q('settings');if(!settings||q('relaySettingsCard'))return;
  const host=settings.querySelector('.settings')||settings;
  const card=document.createElement('div');card.className='card';card.id='relaySettingsCard';
  card.innerHTML='<div class="label">RELAY UDP · VICTORY / SIM DASHBOARD</div>'+ 
   '<label class="smallsub">DESTINO CONFIGURADO</label><select id="relayTargetSelect"><option value="-1">NOVO DESTINO</option></select>'+ 
   '<label class="smallsub">NOME</label><input id="relayName" placeholder="Victory">'+ 
   '<label class="smallsub">IP DO CELULAR / DISPOSITIVO</label><input id="relayHost" inputmode="decimal" placeholder="192.168.1.50">'+ 
   '<label class="smallsub">PORTA UDP DO DESTINO</label><input id="relayPort" inputmode="numeric" type="number" min="1" max="65535" value="33741">'+ 
   '<label class="smallsub" style="display:flex;gap:10px;align-items:center"><input id="relayEnabled" type="checkbox" checked style="width:auto"> DESTINO ATIVO</label>'+ 
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="action" id="saveRelayTarget" type="button">SALVAR DESTINO</button><button class="action" id="removeRelayTarget" type="button">REMOVER</button></div>'+ 
   '<button class="action" id="testRelayTarget" type="button">TESTAR / ATUALIZAR STATUS</button>'+ 
   '<div class="smallsub" id="relayStats">CARREGANDO...</div><div class="smallsub" id="relaySettingsStatus"></div>';
  const network=q('networkSettingsCard');if(network&&network.parentNode===host)network.insertAdjacentElement('afterend',card);else host.prepend(card);
  q('relayTargetSelect').onchange=fillForm;
  q('saveRelayTarget').onclick=saveTarget;
  q('removeRelayTarget').onclick=removeTarget;
  q('testRelayTarget').onclick=testRelay;
  refreshRelay(false).catch(function(){});
  clearInterval(statusTimer);statusTimer=setInterval(function(){if(!document.hidden)refreshRelay(true).catch(function(){})},4000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else setTimeout(install,0);
})();
</script>`;

// Remove somente o bloco <script> que contém o marcador do relay.
// A versão anterior podia começar em um script anterior e apagar a UI de rede.
html = removeScriptBlocksByMarker(html, MARK);
html = html.replace('</body>', ui + '\n</body>');

for (const required of ['async function getRelayStatus(){', 'async function saveRelayTargets(targets){', 'getRelayStatus, saveRelayTargets,']) {
  if (!js.includes(required)) throw new Error('API do relay não instalada: ' + required);
}
for (const required of ['relaySettingsCard', 'relayTargetSelect', 'saveRelayTarget', 'testRelayTarget']) {
  if (!html.includes(required)) throw new Error('Interface do relay não instalada: ' + required);
}
const relayUiCount = (html.match(/V4 RELAY SETTINGS UI/g) || []).length;
if (relayUiCount !== 1) throw new Error('Quantidade inválida de interfaces do relay: ' + relayUiCount);

fs.writeFileSync(bridgePath, js);
fs.writeFileSync(indexPath, html);
console.log('Configuração visual do relay UDP instalada no aplicativo sem remover outros scripts.');