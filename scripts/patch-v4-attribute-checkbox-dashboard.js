const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 ATTRIBUTE CHECKBOX TO DASHBOARD';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

const css=`
/* ${MARK} */
#attributes .telemetryAttribute{position:relative!important;padding-right:48px!important}
.attrDashCheck{position:absolute;right:12px;top:12px;width:23px;height:23px;margin:0;accent-color:var(--cyan);cursor:pointer}
.attrDashCheckLabel{position:absolute;inset:0;pointer-events:none;border-radius:14px}
.telemetryAttribute:has(.attrDashCheck:checked){border-color:#00bcd4!important;box-shadow:inset 0 0 0 1px rgba(0,217,242,.28),0 0 12px rgba(0,217,242,.10)}
#fieldGrid>.v4AttrDashCard{position:relative!important;grid-column:span 1!important;min-height:104px!important;padding:13px 14px!important}
#fieldGrid>.v4AttrDashCard .label{padding-right:42px;font-size:12px!important}
#fieldGrid>.v4AttrDashCard .value{font-size:25px!important;margin-top:10px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#fieldGrid>.v4AttrDashCard .attrPathHint{font-size:8px;color:#597075;margin-top:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.attrCardMover{position:absolute;right:5px;top:5px;width:38px;height:38px;display:grid;grid-template-columns:repeat(3,11px);grid-template-rows:repeat(3,11px);gap:1px;opacity:.34;z-index:9}
.v4AttrDashCard:active .attrCardMover,.attrCardMover:focus-within{opacity:.95}
.attrCardMover button{border:0;background:rgba(0,217,242,.13);color:#83efff;border-radius:3px;width:11px;height:11px;padding:0;font-size:8px;line-height:11px;display:grid;place-items:center}
.attrCardMover .up{grid-column:2;grid-row:1}.attrCardMover .left{grid-column:1;grid-row:2}.attrCardMover .right{grid-column:3;grid-row:2}.attrCardMover .down{grid-column:2;grid-row:3}
`;
html=html.replace('</style>',css+'\n</style>');

const js=`
<script>
/* ${MARK} JS */
(function(){
 'use strict';
 const KEY='gt7_v4_checked_attributes_v1';
 const META_KEY='gt7_v4_checked_attributes_meta_v1';
 const ORDER_KEY='gt7_v4_dashboard_order_v2';
 let selected=new Set();
 let metadata={};
 try{selected=new Set(JSON.parse(localStorage.getItem(KEY)||'[]'))}catch{}
 try{metadata=JSON.parse(localStorage.getItem(META_KEY)||'{}')||{}}catch{}
 function save(){localStorage.setItem(KEY,JSON.stringify([...selected]));localStorage.setItem(META_KEY,JSON.stringify(metadata))}
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
 function keyFor(card){const path=card.querySelector('.telemetryAttributePath')?.textContent?.trim()||card.querySelector('.label')?.textContent?.trim()||'';return 'attr_'+hash(path)}
 function cardMeta(card){return{key:keyFor(card),name:card.querySelector('.label')?.textContent?.trim()||'Atributo',path:card.querySelector('.telemetryAttributePath')?.textContent?.trim()||'',value:card.querySelector('.telemetryAttributeValue')?.textContent?.trim()||'--'}}
 function saveOrder(){const grid=document.getElementById('fieldGrid');if(!grid)return;localStorage.setItem(ORDER_KEY,JSON.stringify([...grid.children].map(e=>e.dataset.field).filter(Boolean)))}
 function moveCard(el,dir){const grid=document.getElementById('fieldGrid');if(!grid)return;const items=[...grid.children].filter(e=>e.dataset.field&&!e.classList.contains('hiddenByDesigner'));const i=items.indexOf(el);if(i<0)return;let n=i+(dir==='left'?-1:dir==='right'?1:dir==='up'?-2:2);if(n<0||n>=items.length)return;const other=items[n];if(n<i)grid.insertBefore(el,other);else grid.insertBefore(other,el);saveOrder()}
 function addMover(el){if(el.querySelector('.attrCardMover'))return;const m=document.createElement('div');m.className='attrCardMover';m.innerHTML='<button class="up">▲</button><button class="left">◀</button><button class="right">▶</button><button class="down">▼</button>';['up','left','right','down'].forEach(d=>m.querySelector('.'+d).onclick=e=>{e.stopPropagation();moveCard(el,d)});el.appendChild(m)}
 function restoreOrder(){const grid=document.getElementById('fieldGrid');if(!grid)return;let order=[];try{order=JSON.parse(localStorage.getItem(ORDER_KEY)||'[]')}catch{};order.forEach(id=>{const el=grid.querySelector('[data-field="'+CSS.escape(id)+'"]');if(el)grid.appendChild(el)})}
 function syncDash(){
  const grid=document.getElementById('fieldGrid');if(!grid)return;
  const attrCards=[...document.querySelectorAll('#attributes .telemetryAttribute')];
  attrCards.forEach(c=>{const m=cardMeta(c);metadata[m.key]=m});
  grid.querySelectorAll('.v4AttrDashCard').forEach(el=>{if(!selected.has(el.dataset.attrKey))el.remove()});
  selected.forEach(key=>{
   const m=metadata[key];if(!m)return;
   let el=grid.querySelector('.v4AttrDashCard[data-attr-key="'+key+'"]');
   if(!el){el=document.createElement('div');el.className='card stat v4AttrDashCard';el.dataset.field=key;el.dataset.attrKey=key;el.innerHTML='<div class="label"></div><div class="value cyan">--</div><div class="attrPathHint"></div>';grid.appendChild(el);addMover(el)}
   el.querySelector('.label').textContent=m.name;
   el.querySelector('.value').textContent=m.value||'--';
   el.querySelector('.attrPathHint').textContent=m.path;
  });
  save();restoreOrder();
 }
 function decorate(){
  document.querySelectorAll('#attributes .telemetryAttribute').forEach(card=>{
   const m=cardMeta(card);metadata[m.key]=m;
   let box=card.querySelector('.attrDashCheck');
   if(!box){box=document.createElement('input');box.type='checkbox';box.className='attrDashCheck';box.setAttribute('aria-label','Mostrar '+m.name+' no DASH');card.appendChild(box);box.onchange=()=>{box.checked?selected.add(m.key):selected.delete(m.key);metadata[m.key]=cardMeta(card);save();syncDash()}}
   box.checked=selected.has(m.key);
  });
  syncDash();
 }
 function install(){
  if(typeof window.renderAttrs==='function'&&!window.renderAttrs.__attrChecks){const old=window.renderAttrs;window.renderAttrs=function(d){const out=old.call(this,d);setTimeout(decorate,0);return out};window.renderAttrs.__attrChecks=true}
  if(typeof window.render==='function'&&!window.render.__attrChecks){const old=window.render;window.render=function(d){const out=old.call(this,d);setTimeout(()=>{decorate();syncDash()},0);return out};window.render.__attrChecks=true}
  const list=document.getElementById('attrList');if(list&&!window.__attrCheckObserver){let pending=false;window.__attrCheckObserver=new MutationObserver(()=>{if(pending)return;pending=true;setTimeout(()=>{pending=false;decorate()},40)});window.__attrCheckObserver.observe(list,{childList:true,subtree:false})}
  decorate();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
 setTimeout(install,700);
})();
</script>`;
html=html.replace('</body>',js+'\n</body>');
fs.writeFileSync(file,html);
console.log('Checks de atributos integrados ao DASH.');