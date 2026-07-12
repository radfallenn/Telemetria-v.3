const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 CUSTOM ITEMS THREE SLOTS';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

const css=`
/* ${MARK} */
.customBuilder{position:fixed;inset:0;z-index:180;background:rgba(0,0,0,.72);backdrop-filter:blur(10px);display:none;align-items:flex-end;justify-content:center}
.customBuilder.on{display:flex}
.customBuilderDialog{width:min(650px,100%);max-height:91vh;overflow:auto;background:#202122;border:1px solid #454545;border-radius:28px 28px 0 0;padding:0 22px calc(24px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}
.customBuilderHead{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;background:#202122;padding:24px 4px 18px;border-bottom:1px solid #414141}
.customBuilderHead b{font-size:25px}.customBuilderHead button{border:0;background:transparent;color:#aaa;font-size:34px}
.customChoice{margin:20px 0}.customChoice>label{display:block;color:#bbb;font-weight:800;letter-spacing:1.5px;margin-bottom:10px}
.customChoice input,.customChoice select{width:100%;background:#101112;color:#fff;border:1px solid #464646;border-radius:14px;padding:14px;font-size:16px}
.customMode{display:grid;grid-template-columns:1fr 1fr;gap:10px}.customMode button{border:1px solid #474747;border-radius:14px;background:#151617;color:#aaa;padding:14px;font-weight:900}.customMode button.on{background:#4a89f4;color:#fff;border-color:#6ba1fa}
.customSlots{display:grid;gap:10px}.customSlotRow{display:grid;grid-template-columns:42px 1fr;gap:10px;align-items:center}.customSlotRow span{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#27334b;color:#6ba1fa;font-weight:900}
.customBuilderActions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}.customBuilderActions button{border:0;border-radius:14px;padding:15px;font-weight:900}.customCancel{background:#3a3a3a;color:#fff}.customSave{background:#4a89f4;color:#fff}
.v4CustomArea{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:var(--gap);margin-bottom:var(--gap)}
.v4CustomGroup{grid-column:1/-1;display:grid;background:linear-gradient(180deg,rgba(8,18,19,.96),rgba(2,8,9,.98));border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.v4CustomGroup.slots-1{grid-template-columns:1fr}.v4CustomGroup.slots-2{grid-template-columns:repeat(2,1fr)}.v4CustomGroup.slots-3{grid-template-columns:repeat(3,1fr)}
.v4CustomGroup.joined .v4CustomCell+.v4CustomCell{border-left:1px solid #173235}
.v4CustomGroup.separate{display:contents}
.v4CustomGroup.separate .v4CustomCell{background:linear-gradient(180deg,rgba(8,18,19,.96),rgba(2,8,9,.98));border:1px solid var(--line);border-radius:var(--radius)}
.v4CustomGroup.separate.slots-1 .v4CustomCell{grid-column:span 6}.v4CustomGroup.separate.slots-2 .v4CustomCell{grid-column:span 3}.v4CustomGroup.separate.slots-3 .v4CustomCell{grid-column:span 2}
.v4CustomCell{min-height:128px;padding:18px;display:flex;flex-direction:column;justify-content:center;min-width:0}
.v4CustomLabel{font-family:Georgia,serif;font-size:14px;font-weight:800;letter-spacing:1.4px;color:#c7c8c9;overflow:hidden;text-overflow:ellipsis}
.v4CustomValue{font-size:34px;line-height:1.05;margin-top:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v4CustomUnit{font-size:12px;color:#93a3a6;margin-top:6px}
.customFieldEntry{position:relative}.customDelete{position:absolute;right:16px;bottom:12px;border:0;background:#54252d;color:#ff8095;border-radius:10px;padding:7px 10px;font-weight:900}
@media(max-width:430px){.v4CustomGroup.separate.slots-3 .v4CustomCell{grid-column:span 2}.v4CustomCell{min-height:112px;padding:14px}.v4CustomValue{font-size:28px}.v4CustomLabel{font-size:12px}.customBuilderDialog{padding-left:16px;padding-right:16px}}
`;
html=html.replace('</style>',css+'\n</style>');

const modal=`
<div class="customBuilder" id="customBuilder">
 <div class="customBuilderDialog">
  <div class="customBuilderHead"><b>Criar item personalizado</b><button id="closeCustomBuilder">×</button></div>
  <div class="customChoice"><label>NOME DO ITEM/GRUPO</label><input id="customGroupName" maxlength="40" placeholder="Ex.: Corrida, Motor, Volta"></div>
  <div class="customChoice"><label>QUANTIDADE DE LUGARES</label><select id="customSlotCount"><option value="1">1 lugar</option><option value="2">2 lugares</option><option value="3">3 lugares</option></select></div>
  <div class="customChoice"><label>FORMATO</label><div class="customMode"><button class="on" data-custom-mode="joined">JUNTOS</button><button data-custom-mode="separate">SEPARADOS</button></div></div>
  <div class="customChoice"><label>CONTEÚDO DOS LUGARES</label><div class="customSlots" id="customSlots"></div></div>
  <div class="customBuilderActions"><button class="customCancel" id="cancelCustomBuilder">CANCELAR</button><button class="customSave" id="saveCustomBuilder">CRIAR</button></div>
 </div>
</div>`;
html=html.replace('</body>',modal+'\n</body>');

const js=`
<script>
/* ${MARK} JS */
(function(){
 const KEY='gt7_v4_custom_groups_v1';
 const OPTIONS=[
  ['speed','Velocidade','KM/H'],['gear','Marcha',''],['rpm','RPM','rpm'],['total','Tempo total',''],
  ['throttle','Acelerador','%'],['brake','Freio','%'],['best','Melhor volta',''],['fuel','Combustível','%'],
  ['laps','Voltas válidas',''],['maxSpeed','Max Speed','KM/H'],['grade','UDM Nota',''],['score','Consistência','%'],
  ['tFL','Pneu dianteiro esq.','°C'],['tFR','Pneu dianteiro dir.','°C'],['tRL','Pneu traseiro esq.','°C'],['tRR','Pneu traseiro dir.','°C']
 ];
 let groups=[];try{groups=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(groups))groups=[]}catch{groups=[]}
 let mode='joined';
 const q=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function save(){localStorage.setItem(KEY,JSON.stringify(groups))}
 function options(selected){return OPTIONS.map(o=>'<option value="'+o[0]+'" '+(o[0]===selected?'selected':'')+'>'+o[1]+'</option>').join('')}
 function buildSlots(){const n=Number(q('customSlotCount')?.value||1),box=q('customSlots');if(!box)return;const old=[...box.querySelectorAll('select')].map(x=>x.value);box.innerHTML=Array.from({length:n},(_,i)=>'<div class="customSlotRow"><span>'+(i+1)+'</span><select data-custom-slot="'+i+'">'+options(old[i]||OPTIONS[i][0])+'</select></div>').join('')}
 function open(){q('customBuilder')?.classList.add('on');document.body.classList.add('modalOpen');q('customGroupName').value='';q('customSlotCount').value='1';mode='joined';document.querySelectorAll('[data-custom-mode]').forEach(b=>b.classList.toggle('on',b.dataset.customMode===mode));buildSlots()}
 function close(){q('customBuilder')?.classList.remove('on');document.body.classList.remove('modalOpen')}
 function readValue(id){
  const L=window.live||{},A=L.analysis||{};
  const map={speed:L.velocidade,gear:L.marcha,rpm:L.rpm,total:A.total||L.tempoTotalCorrida,throttle:L.acelerador,brake:L.freio,best:A.best||L.melhorVolta,fuel:L.combustivelPorcentagem,laps:A.laps??L.voltasCompletadas,maxSpeed:L.velocidadeMaxima,grade:A.grade,score:String(A.consistency||'').replace('%',''),tFL:L.advanced?.tyreTemp?.FL??L.motecChannels?.tyreTemp?.FL,tFR:L.advanced?.tyreTemp?.FR??L.motecChannels?.tyreTemp?.FR,tRL:L.advanced?.tyreTemp?.RL??L.motecChannels?.tyreTemp?.RL,tRR:L.advanced?.tyreTemp?.RR??L.motecChannels?.tyreTemp?.RR};
  let v=map[id];if(v===undefined||v===null||v===''){const e=q(id);v=e?e.textContent:'--'}return v===undefined||v===null||v===''?'--':v
 }
 function area(){let a=q('v4CustomArea');if(a)return a;a=document.createElement('section');a.id='v4CustomArea';a.className='v4CustomArea';const grid=q('fieldGrid'),sep=q('v4MetricsSeparate');if(sep&&sep.parentNode)sep.parentNode.insertBefore(a,sep.nextSibling);else if(grid&&grid.parentNode)grid.parentNode.insertBefore(a,grid);return a}
 function renderGroups(){const a=area();if(!a)return;a.innerHTML=groups.map(g=>'<article class="v4CustomGroup '+esc(g.mode)+' slots-'+g.slots.length+'" data-custom-group="'+esc(g.id)+'">'+g.slots.map(s=>{const o=OPTIONS.find(x=>x[0]===s)||[s,s,''];return '<div class="v4CustomCell"><div class="v4CustomLabel">'+esc(o[1])+'</div><div class="v4CustomValue" data-custom-value="'+esc(s)+'">--</div><div class="v4CustomUnit">'+esc(o[2])+'</div></div>'}).join('')+'</article>').join('');renderFieldEntries()}
 function renderFieldEntries(){const list=q('fieldsList');if(!list)return;list.querySelectorAll('.customFieldEntry').forEach(e=>e.remove());groups.forEach((g,i)=>{const d=document.createElement('div');d.className='fieldItem customFieldEntry';d.innerHTML='<button class="eye">●</button><div><b>'+esc(g.name||'Personalizado')+'</b><div class="smallsub">'+g.slots.length+' lugar(es) · '+(g.mode==='joined'?'Juntos':'Separados')+'</div></div><div class="move"><button data-cup="'+i+'">⌃</button><button data-cdown="'+i+'">⌄</button></div><button class="customDelete" data-cdel="'+esc(g.id)+'">EXCLUIR</button>';list.appendChild(d)});list.querySelectorAll('[data-cdel]').forEach(b=>b.onclick=()=>{groups=groups.filter(g=>g.id!==b.dataset.cdel);save();renderGroups()});list.querySelectorAll('[data-cup]').forEach(b=>b.onclick=()=>move(+b.dataset.cup,-1));list.querySelectorAll('[data-cdown]').forEach(b=>b.onclick=()=>move(+b.dataset.cdown,1))}
 function move(i,d){const j=i+d;if(j<0||j>=groups.length)return;[groups[i],groups[j]]=[groups[j],groups[i]];save();renderGroups()}
 function tick(){document.querySelectorAll('[data-custom-value]').forEach(e=>{const id=e.dataset.customValue,v=readValue(id);e.textContent=v});requestAnimationFrame(tick)}
 function createGroup(){const count=Number(q('customSlotCount').value||1),slots=[...document.querySelectorAll('[data-custom-slot]')].slice(0,count).map(s=>s.value);groups.push({id:'custom-'+Date.now(),name:q('customGroupName').value.trim()||'Personalizado',mode,slots});save();renderGroups();close()}
 function bind(){const btn=q('resetFields');if(btn){btn.textContent='+ PERSONALIZADO';btn.onclick=open}q('closeCustomBuilder').onclick=close;q('cancelCustomBuilder').onclick=close;q('saveCustomBuilder').onclick=createGroup;q('customSlotCount').onchange=buildSlots;q('customBuilder').onclick=e=>{if(e.target===q('customBuilder'))close()};document.querySelectorAll('[data-custom-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.customMode;document.querySelectorAll('[data-custom-mode]').forEach(x=>x.classList.toggle('on',x===b))});renderGroups();requestAnimationFrame(tick)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else setTimeout(bind,0)
})();
</script>`;
html=html.replace('</body>',js+'\n</body>');
fs.writeFileSync(file,html);
console.log('Criador personalizado com 1, 2 ou 3 lugares aplicado.');
