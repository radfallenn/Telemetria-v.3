const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 GRID ARROWS ALL ATTRIBUTES';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

const css=`
/* ${MARK} */
#fieldGrid{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:10px!important;
  align-items:stretch!important;
}
#fieldGrid>[data-field]{
  position:relative!important;
  min-width:0!important;
  width:auto!important;
  grid-column:span 1!important;
  min-height:104px!important;
  padding:13px 14px!important;
  overflow:hidden!important;
}
#fieldGrid>[data-field].v4FullCard,
#fieldGrid>[data-field="udm"],
#fieldGrid>[data-field="tyres"]{grid-column:1/-1!important}
#fieldGrid>[data-field] .label{font-size:12px!important;line-height:1.12!important;letter-spacing:1.2px!important}
#fieldGrid>[data-field] .value{font-size:26px!important;margin-top:9px!important;line-height:1!important}
#fieldGrid>[data-field] .smallsub{font-size:11px!important;line-height:1.25!important;margin-top:7px!important}
#fieldGrid>[data-field] .bar{height:8px!important;margin-top:12px!important}
#fieldGrid>[data-field="tyres"]{min-height:230px!important}
#fieldGrid>[data-field="udm"]{min-height:112px!important}
.cardMover{
  position:absolute;right:5px;top:5px;z-index:8;
  width:40px;height:40px;display:grid;
  grid-template-columns:repeat(3,12px);grid-template-rows:repeat(3,12px);
  gap:1px;opacity:.35;transition:opacity .15s;
}
[data-field]:active .cardMover,.cardMover:focus-within{opacity:.95}
.cardMover button{
  border:0;background:rgba(0,217,242,.12);color:#80efff;
  border-radius:4px;padding:0;margin:0;font-size:9px;line-height:12px;
  width:12px;height:12px;display:grid;place-items:center;
}
.cardMover button:active{background:rgba(0,217,242,.45);transform:scale(.9)}
.cardMover .up{grid-column:2;grid-row:1}.cardMover .left{grid-column:1;grid-row:2}.cardMover .right{grid-column:3;grid-row:2}.cardMover .down{grid-column:2;grid-row:3}
.v4ExtraField.hiddenByDesigner{display:none!important}
@media(max-width:390px){
 #fieldGrid{gap:8px!important}
 #fieldGrid>[data-field]{min-height:96px!important;padding:11px 12px!important}
 #fieldGrid>[data-field] .value{font-size:23px!important}
}
`;
html=html.replace('</style>',css+'\n</style>');

const js=`
<script>
/* ${MARK} JS */
(function(){
 const q=id=>document.getElementById(id);
 const ORDER_KEY='gt7_v4_dashboard_order_v2';
 const EXTRA=[
  ['last','Última volta','ultimaVolta'],['total','Tempo total','tempoTotalCorrida'],['rpm2','RPM','rpm'],['speed2','Velocidade','velocidade'],
  ['gear2','Marcha','marcha'],['fuelRaw','Combustível bruto','combustivelAtual'],['fuelCap','Capacidade combustível','combustivelCapacidade'],
  ['fuelLaps','Autonomia em voltas','autonomiaVoltas'],['lapCurrent','Volta atual','voltaAtual'],['lapCount','Voltas completadas','voltasCompletadas'],
  ['position','Posição','posicao'],['cars','Carros na pista','carrosNaPista'],['packet','Pacote','packetVersion'],['latencyField','Latência','latencia'],
  ['boost','Turbo/Boost','boost'],['oilTemp','Temperatura do óleo','temperaturaOleo'],['waterTemp','Temperatura da água','temperaturaAgua'],
  ['oilPressure','Pressão do óleo','pressaoOleo'],['tireFL','Pneu dianteiro esq.','advanced.tyreTemp.FL'],['tireFR','Pneu dianteiro dir.','advanced.tyreTemp.FR'],
  ['tireRL','Pneu traseiro esq.','advanced.tyreTemp.RL'],['tireRR','Pneu traseiro dir.','advanced.tyreTemp.RR'],['suspFL','Suspensão dianteira esq.','advanced.suspension.FL'],
  ['suspFR','Suspensão dianteira dir.','advanced.suspension.FR'],['suspRL','Suspensão traseira esq.','advanced.suspension.RL'],['suspRR','Suspensão traseira dir.','advanced.suspension.RR'],
  ['wheelFL','Rotação roda dianteira esq.','advanced.wheelSpeed.FL'],['wheelFR','Rotação roda dianteira dir.','advanced.wheelSpeed.FR'],
  ['wheelRL','Rotação roda traseira esq.','advanced.wheelSpeed.RL'],['wheelRR','Rotação roda traseira dir.','advanced.wheelSpeed.RR'],
  ['yaw','Yaw','advanced.yaw'],['pitch','Pitch','advanced.pitch'],['roll','Roll','advanced.roll'],['gLat','Força G lateral','advanced.gForce.lateral'],
  ['gLong','Força G longitudinal','advanced.gForce.longitudinal'],['gVert','Força G vertical','advanced.gForce.vertical']
 ];
 function getPath(obj,path){return String(path).split('.').reduce((a,k)=>a&&a[k],obj)}
 function valueText(v){if(v===undefined||v===null||v==='')return'--';if(typeof v==='number')return Number.isInteger(v)?String(v):v.toFixed(2);return String(v)}
 function ensureExtraCards(){
  const grid=q('fieldGrid');if(!grid)return;
  EXTRA.forEach(([id,name])=>{
   if(grid.querySelector('[data-field="'+id+'"]'))return;
   const el=document.createElement('div');el.className='card stat v4ExtraField hiddenByDesigner';el.dataset.field=id;
   el.innerHTML='<div class="label">'+name+'</div><div class="value cyan" data-extra-value="'+id+'">--</div>';
   grid.appendChild(el);
  });
 }
 function ensurePreferences(){
  try{
   const fields=(typeof pref!=='undefined'&&Array.isArray(pref.fields))?pref.fields:null;if(!fields)return;
   EXTRA.forEach(([id,name])=>{if(!fields.some(f=>f.id===id))fields.push({id,name,size:'1/2',show:false})});
   if(typeof savePref==='function')savePref();
  }catch{}
 }
 function applyVisibility(){
  try{
   const fields=(typeof pref!=='undefined'&&Array.isArray(pref.fields))?pref.fields:[];
   fields.forEach(f=>{const el=document.querySelector('#fieldGrid>[data-field="'+f.id+'"]');if(el)el.classList.toggle('hiddenByDesigner',f.show===false)});
  }catch{}
 }
 function updateExtras(data){EXTRA.forEach(([id,,path])=>{const el=document.querySelector('[data-extra-value="'+id+'"]');if(el)el.textContent=valueText(getPath(data,path))})}
 function saveOrder(){const grid=q('fieldGrid');if(!grid)return;localStorage.setItem(ORDER_KEY,JSON.stringify([...grid.children].map(e=>e.dataset.field).filter(Boolean)))}
 function restoreOrder(){
  const grid=q('fieldGrid');if(!grid)return;
  let order=[];try{order=JSON.parse(localStorage.getItem(ORDER_KEY)||'[]')}catch{}
  order.forEach(id=>{const el=grid.querySelector('[data-field="'+id+'"]');if(el)grid.appendChild(el)});
 }
 function move(el,dir){
  const grid=q('fieldGrid');if(!grid)return;
  const items=[...grid.children].filter(x=>x.dataset.field&&!x.classList.contains('hiddenByDesigner'));
  const i=items.indexOf(el);if(i<0)return;
  let target=i;
  if(dir==='left')target=i-1;if(dir==='right')target=i+1;if(dir==='up')target=i-2;if(dir==='down')target=i+2;
  if(target<0||target>=items.length)return;
  const other=items[target];
  if(target<i)grid.insertBefore(el,other);else grid.insertBefore(other,el);
  saveOrder();
 }
 function decorate(){
  const grid=q('fieldGrid');if(!grid)return;
  [...grid.children].forEach(el=>{
   if(!el.dataset.field||el.querySelector('.cardMover'))return;
   const m=document.createElement('div');m.className='cardMover';
   m.innerHTML='<button class="up" aria-label="Mover para cima">▲</button><button class="left" aria-label="Mover para esquerda">◀</button><button class="right" aria-label="Mover para direita">▶</button><button class="down" aria-label="Mover para baixo">▼</button>';
   ['up','left','right','down'].forEach(d=>m.querySelector('.'+d).onclick=e=>{e.stopPropagation();move(el,d)});
   el.appendChild(m);
  });
 }
 function patchRender(){
  if(typeof window.render!=='function'||window.render.__v4GridAttrs)return;
  const old=window.render;
  const wrapped=function(d){const out=old.call(this,d);updateExtras(d||{});return out};wrapped.__v4GridAttrs=true;window.render=wrapped;
 }
 function patchPref(){
  try{
   if(typeof renderFields==='function'&&!renderFields.__v4AllAttrs){const old=renderFields;renderFields=function(){old();setTimeout(()=>{decorate();applyVisibility()},0)};renderFields.__v4AllAttrs=true}
   if(typeof applyPref==='function'&&!applyPref.__v4AllAttrs){const old=applyPref;applyPref=function(){old();setTimeout(()=>{applyVisibility();decorate()},0)};applyPref.__v4AllAttrs=true}
  }catch{}
 }
 function init(){ensureExtraCards();ensurePreferences();restoreOrder();applyVisibility();decorate();patchRender();patchPref();setTimeout(()=>{ensurePreferences();applyVisibility();decorate()},500)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else setTimeout(init,0);
})();
</script>`;
html=html.replace('</body>',js+'\n</body>');
fs.writeFileSync(file,html);
console.log('Grid proporcional, quatro setas e catalogo completo de atributos aplicados.');
