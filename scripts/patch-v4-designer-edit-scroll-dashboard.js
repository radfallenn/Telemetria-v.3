const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 DESIGNER EDIT SCROLL DASHBOARD';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

html=html.replace('</style>',`
/* ${MARK} */
.rpmCRpmReadout{display:none!important}
#v4MetricsSeparate>.v4MetricCard:not(.v4FuelCard){display:none!important}
#v4MetricsSeparate{display:block!important}
#v4MetricsSeparate>.v4FuelCard{width:100%;min-height:82px!important}

/* O modal sempre usa a tela inteira e nao depende do controle do DASH */
#designer{z-index:320!important;align-items:flex-end!important}
#designer .dialog{width:min(650px,100%)!important;max-height:calc(100dvh - env(safe-area-inset-top) - 8px)!important;height:auto!important;overflow-y:auto!important;overflow-x:hidden!important;padding-bottom:calc(150px + env(safe-area-inset-bottom))!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;touch-action:pan-y!important}
#designer #fieldsPane{padding-bottom:180px!important}
body.modalOpen .nav{visibility:hidden!important;pointer-events:none!important}

/* Tamanhos editaveis em uma grade de 6 colunas */
#fieldGrid{grid-template-columns:repeat(6,minmax(0,1fr))!important}
#fieldGrid>[data-field]{grid-column:span 3}
#fieldGrid>[data-field][data-size="Cheio"]{grid-column:1/-1}
#fieldGrid>[data-field][data-size="1/2"]{grid-column:span 3}
#fieldGrid>[data-field][data-size="1/3"]{grid-column:span 2}

/* O controle ALTURA DA JANELA/ABA afeta somente o DASH */
#dash .stats .card,#dash .v4CustomCell{min-height:var(--dash-window-h,158px)!important}
#dash .v4FuelCard{min-height:82px!important}

.fieldItem{grid-template-columns:48px minmax(0,1fr) auto 44px!important}
.fieldGear{width:42px;height:42px;border:1px solid #555;border-radius:50%;background:#343638;color:#dce7ea;font-size:20px;display:grid;place-items:center}
.fieldGear:active{transform:scale(.94)}

.fieldEditor{position:fixed;inset:0;z-index:420;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(8px)}
.fieldEditor.on{display:flex}
.fieldEditorDialog{width:min(620px,100%);max-height:88dvh;overflow:auto;background:#202122;border:1px solid #4b4b4b;border-radius:26px 26px 0 0;padding:0 22px calc(28px + env(safe-area-inset-bottom))}
.fieldEditorHead{display:flex;align-items:center;justify-content:space-between;padding:24px 0 18px;border-bottom:1px solid #444}
.fieldEditorHead b{font-size:25px}.fieldEditorHead button{border:0;background:transparent;color:#aaa;font-size:34px}
.fieldEditorRow{margin-top:22px}.fieldEditorRow label{display:block;color:#bbb;font-weight:900;letter-spacing:1.4px;margin-bottom:10px}
.fieldEditorRow input,.fieldEditorRow select{width:100%;background:#0f1011;color:#fff;border:1px solid #4a4a4a;border-radius:14px;padding:15px;font-size:17px}
.fieldEditorCheck{display:flex;align-items:center;justify-content:space-between;padding:15px 0;color:#ddd;font-weight:800}
.fieldEditorCheck input{width:24px;height:24px;accent-color:#4a89f4}
.fieldEditorActions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:26px}
.fieldEditorActions button{border:0;border-radius:14px;padding:16px;font-weight:900}.fieldEditorCancel{background:#3a3a3a;color:#fff}.fieldEditorSave{background:#4a89f4;color:#fff}
@media(max-width:430px){#designer .dialog{padding-bottom:calc(165px + env(safe-area-inset-bottom))!important}.fieldItem{grid-template-columns:44px minmax(0,1fr) auto 40px!important}.fieldGear{width:38px;height:38px}}
</style>`);

html=html.replace('</body>',`<div class="fieldEditor" id="fieldEditor">
 <div class="fieldEditorDialog">
  <div class="fieldEditorHead"><b>Editar item</b><button id="closeFieldEditor">×</button></div>
  <div class="fieldEditorRow"><label>NOME DO ITEM</label><input id="fieldEditName" maxlength="40"></div>
  <div class="fieldEditorRow"><label>TAMANHO</label><select id="fieldEditSize"><option value="Cheio">Cheio</option><option value="1/2">1/2</option><option value="1/3">1/3</option></select></div>
  <div class="fieldEditorCheck"><span>EXIBIR NO DASH</span><input id="fieldEditShow" type="checkbox"></div>
  <div class="fieldEditorActions"><button class="fieldEditorCancel" id="cancelFieldEditor">CANCELAR</button><button class="fieldEditorSave" id="saveFieldEditor">SALVAR ALTERACOES</button></div>
 </div>
</div>\n</body>`);

html=html.replace('</body>',`<script>
/* ${MARK} JS */
(function(){
 const q=id=>document.getElementById(id);
 let editingId=null;
 function applyDashboardSizes(){
   const fields=(window.pref&&Array.isArray(window.pref.fields))?window.pref.fields:(typeof pref!=='undefined'&&Array.isArray(pref.fields)?pref.fields:[]);
   fields.forEach(f=>{
     const el=document.querySelector('[data-field="'+f.id+'"]');
     if(!el)return;
     el.dataset.size=f.size||'1/2';
     const label=el.querySelector('.label');
     if(label&&f.name&&!['speedgear','rpmtotal'].includes(f.id))label.textContent=f.name;
   });
 }
 function removeMarkedDefaults(){
   document.querySelector('.rpmCRpmReadout')?.remove();
   document.querySelectorAll('#v4MetricsSeparate>.v4MetricCard:not(.v4FuelCard)').forEach(e=>e.remove());
 }
 function dashboardHeight(){
   try{
     const p=(typeof pref!=='undefined')?pref:{};
     const percent=Math.max(55,Math.min(96,Number(p.sheetHeight||88)));
     const px=Math.round(180*percent/100);
     document.documentElement.style.setProperty('--dash-window-h',px+'px');
     const out=q('sheetHeightVal');if(out)out.textContent=percent+'%';
     const label=q('sheetHeightRange')?.closest('.control')?.querySelector('.controlLine span');
     if(label)label.textContent='ALTURA DAS JANELAS/ABAS DO DASH';
   }catch{}
 }
 function decorateFields(){
   const list=q('fieldsList');if(!list)return;
   const fields=(typeof pref!=='undefined'&&Array.isArray(pref.fields))?pref.fields:[];
   [...list.querySelectorAll('.fieldItem:not(.customFieldEntry)')].forEach((item,i)=>{
     const f=fields[i];if(!f)return;
     let gear=item.querySelector('.fieldGear');
     if(!gear){gear=document.createElement('button');gear.className='fieldGear';gear.type='button';gear.textContent='⚙';item.appendChild(gear)}
     gear.onclick=e=>{e.stopPropagation();openEditor(f.id)};
   });
 }
 function openEditor(id){
   const f=(typeof pref!=='undefined'?pref.fields:[]).find(x=>x.id===id);if(!f)return;
   editingId=id;q('fieldEditName').value=f.name||'';q('fieldEditSize').value=f.size||'1/2';q('fieldEditShow').checked=f.show!==false;
   q('fieldEditor').classList.add('on');document.body.classList.add('modalOpen');
 }
 function closeEditor(){q('fieldEditor')?.classList.remove('on');if(!q('designer')?.classList.contains('on'))document.body.classList.remove('modalOpen')}
 function saveEditor(){
   const f=(typeof pref!=='undefined'?pref.fields:[]).find(x=>x.id===editingId);if(!f)return closeEditor();
   f.name=q('fieldEditName').value.trim()||f.name;f.size=q('fieldEditSize').value;f.show=q('fieldEditShow').checked;
   if(typeof savePref==='function')savePref();
   if(typeof applyPref==='function')applyPref();
   applyDashboardSizes();decorateFields();closeEditor();
 }
 function patchFunctions(){
   try{
     if(typeof renderFields==='function'&&!renderFields.__v4patched){
       const old=renderFields;
       renderFields=function(){old();setTimeout(()=>{decorateFields();applyDashboardSizes()},0)};
       renderFields.__v4patched=true;
     }
     if(typeof applyPref==='function'&&!applyPref.__v4patched){
       const old=applyPref;
       applyPref=function(){old();dashboardHeight();applyDashboardSizes();setTimeout(decorateFields,0)};
       applyPref.__v4patched=true;
     }
   }catch{}
 }
 function bind(){
   removeMarkedDefaults();patchFunctions();dashboardHeight();applyDashboardSizes();decorateFields();
   q('closeFieldEditor').onclick=closeEditor;q('cancelFieldEditor').onclick=closeEditor;q('saveFieldEditor').onclick=saveEditor;
   q('fieldEditor').onclick=e=>{if(e.target===q('fieldEditor'))closeEditor()};
   const designer=q('designer'),dialog=designer?.querySelector('.dialog');
   if(dialog){dialog.style.maxHeight='calc(100dvh - env(safe-area-inset-top) - 8px)';dialog.style.paddingBottom='calc(150px + env(safe-area-inset-bottom))'}
   const sh=q('sheetHeightRange');if(sh)sh.oninput=e=>{if(typeof pref!=='undefined'){pref.sheetHeight=+e.target.value;if(typeof savePref==='function')savePref()}dashboardHeight()};
   const observer=new MutationObserver(()=>{decorateFields();applyDashboardSizes()});
   if(q('fieldsList'))observer.observe(q('fieldsList'),{childList:true,subtree:false});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else setTimeout(bind,0);
})();
</script>\n</body>`);

fs.writeFileSync(file,html);
console.log('Designer editavel, rolagem completa e altura exclusiva do DASH aplicados.');