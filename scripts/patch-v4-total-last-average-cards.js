const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 TOTAL LAST AVERAGE CARDS';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

const css=`
/* ${MARK} */
#fieldGrid>[data-field="total"],
#fieldGrid>[data-field="last"],
#fieldGrid>[data-field="average"]{
  min-height:104px!important;
}
`;
html=html.replace('</style>',css+'\n</style>');

const js=`
<script>
/* ${MARK} JS */
(function(){
 const q=id=>document.getElementById(id);
 const ORDER_KEY='gt7_v4_dashboard_order_v2';

 function parseLapMs(value){
  if(value===null||value===undefined||value==='')return null;
  if(typeof value==='object')value=value.time??value.lapTime??value.formatted??value.value??value.ms??value.duration;
  if(typeof value==='number'){
   if(!Number.isFinite(value)||value<=0)return null;
   return value<1000?Math.round(value*1000):Math.round(value);
  }
  const text=String(value).trim().replace(',', '.');
  if(!text||text==='--')return null;
  const parts=text.split(':').map(Number);
  if(parts.some(v=>!Number.isFinite(v)))return null;
  let seconds=0;
  if(parts.length===3)seconds=parts[0]*3600+parts[1]*60+parts[2];
  else if(parts.length===2)seconds=parts[0]*60+parts[1];
  else seconds=parts[0];
  return seconds>0?Math.round(seconds*1000):null;
 }

 function formatMs(input){
  let ms=Math.max(0,Math.round(Number(input)||0));
  if(!ms)return'--';
  const hours=Math.floor(ms/3600000);ms%=3600000;
  const minutes=Math.floor(ms/60000);ms%=60000;
  const seconds=Math.floor(ms/1000),millis=ms%1000;
  const core=String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0')+'.'+String(millis).padStart(3,'0');
  return hours>0?String(hours).padStart(2,'0')+':'+core:core;
 }

 function lapTimes(data){
  const candidates=[data?.lapTimes,data?.analysis?.lapTimes,data?.completedLapTimes,data?.laps,data?.session?.laps];
  const source=candidates.find(Array.isArray)||[];
  return source.map(parseLapMs).filter(v=>Number.isFinite(v)&&v>0);
 }

 function ensureCard(id,label){
  const grid=q('fieldGrid');if(!grid)return null;
  let card=grid.querySelector('[data-field="'+id+'"]');
  if(!card){
   card=document.createElement('div');
   card.className='card stat';
   card.dataset.field=id;
   card.innerHTML='<div class="label">'+label+'</div><div class="value cyan" data-extra-value="'+id+'">--</div>';
   const udm=grid.querySelector('[data-field="udm"]');
   if(udm)grid.insertBefore(card,udm);else grid.appendChild(card);
  }
  card.classList.remove('hiddenByDesigner','v4ExtraField');
  return card;
 }

 function saveOrder(){
  const grid=q('fieldGrid');if(!grid)return;
  localStorage.setItem(ORDER_KEY,JSON.stringify([...grid.children].map(el=>el.dataset.field).filter(Boolean)));
 }

 function move(card,dir){
  const grid=q('fieldGrid');if(!grid)return;
  const items=[...grid.children].filter(el=>el.dataset.field&&!el.classList.contains('hiddenByDesigner'));
  const index=items.indexOf(card);if(index<0)return;
  const delta=dir==='left'?-1:dir==='right'?1:dir==='up'?-2:2;
  const target=index+delta;if(target<0||target>=items.length)return;
  const other=items[target];
  if(target<index)grid.insertBefore(card,other);else grid.insertBefore(other,card);
  saveOrder();
 }

 function ensureMover(card){
  if(!card||card.querySelector('.cardMover'))return;
  const mover=document.createElement('div');mover.className='cardMover';
  mover.innerHTML='<button class="up" aria-label="Mover para cima">▲</button><button class="left" aria-label="Mover para esquerda">◀</button><button class="right" aria-label="Mover para direita">▶</button><button class="down" aria-label="Mover para baixo">▼</button>';
  ['up','left','right','down'].forEach(dir=>mover.querySelector('.'+dir).onclick=event=>{event.stopPropagation();move(card,dir)});
  card.appendChild(mover);
 }

 function ensurePreferences(){
  try{
   const fields=(typeof pref!=='undefined'&&Array.isArray(pref.fields))?pref.fields:null;if(!fields)return;
   const required=[['total','Tempo Total'],['last','Última Volta'],['average','Média Geral']];
   required.forEach(([id,name])=>{
    let field=fields.find(item=>item.id===id);
    if(!field){field={id,name,size:'1/2',show:true};fields.push(field)}
    field.name=name;field.show=true;field.size=field.size||'1/2';
   });
   if(typeof savePref==='function')savePref();
   if(typeof renderFields==='function')renderFields();
  }catch{}
 }

 function update(data){
  const all=lapTimes(data||{});
  const valid=all.length>0?all.slice(1):[];
  const totalValid=valid.reduce((sum,value)=>sum+value,0);
  const totalAll=all.reduce((sum,value)=>sum+value,0);
  const last=all.length?all[all.length-1]:0;
  const average=all.length?Math.round(totalAll/all.length):0;
  const totalText=totalValid?formatMs(totalValid):(data?.analysis?.total||data?.tempoTotalCorrida||'--');
  const lastText=last?formatMs(last):(data?.ultimaVolta||data?.analysis?.last||'--');
  const averageText=average?formatMs(average):(data?.mediaGeral||data?.analysis?.average||'--');
  const totalEl=document.querySelector('[data-extra-value="total"]');if(totalEl)totalEl.textContent=totalText;
  const lastEl=document.querySelector('[data-extra-value="last"]');if(lastEl)lastEl.textContent=lastText;
  const averageEl=document.querySelector('[data-extra-value="average"]');if(averageEl)averageEl.textContent=averageText;
  if(data&&typeof data==='object'){
   data.analysis=data.analysis||{};
   data.analysis.total=totalText;
   data.analysis.last=lastText;
   data.analysis.average=averageText;
   data.tempoTotalCorrida=totalText;
   data.ultimaVolta=lastText;
   data.mediaGeral=averageText;
  }
 }

 function patchRender(){
  if(typeof window.render!=='function'||window.render.__v4TotalLastAverage)return;
  const previous=window.render;
  const wrapped=function(data){const result=previous.call(this,data);update(data||{});return result};
  wrapped.__v4TotalLastAverage=true;
  window.render=wrapped;
 }

 function init(){
  const total=ensureCard('total','TEMPO TOTAL');
  const last=ensureCard('last','ÚLTIMA VOLTA');
  const average=ensureCard('average','MÉDIA GERAL');
  [total,last,average].forEach(ensureMover);
  ensurePreferences();
  patchRender();
  update(window.live||{});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else setTimeout(init,0);
})();
</script>`;
html=html.replace('</body>',js+'\n</body>');
fs.writeFileSync(file,html);
console.log('Cards Tempo Total, Ultima Volta e Media Geral adicionados.');
