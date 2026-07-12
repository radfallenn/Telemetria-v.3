const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 WINDOWS CARD HEIGHT FIX';

if(!html.includes(MARK)){
  const css=`
/* ${MARK} */
:root{--card-h:160px;--sheet-h:88vh}
.sheet{touch-action:pan-y;overscroll-behavior:contain;pointer-events:auto}
.sheet.on{display:flex!important}
.dialog{max-height:var(--sheet-h)!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}
.dialog *{touch-action:manipulation}
.dialog .pane{overflow:visible}
body.modalOpen{overflow:hidden!important;touch-action:none}
.stats .card{min-height:var(--card-h)!important;height:auto}
.fieldItem{min-height:calc(var(--card-h) * .62)}
@media(max-width:430px){.dialog{max-height:min(var(--sheet-h),92vh)!important}.stats .card{min-height:var(--card-h)!important}}
`;
  html=html.replace('</style>',css+'\n</style>');

  const anchor='</div></div><div class="pane" id="fieldsPane">';
  const controls=`</div><div class="control"><div class="controlLine"><span>ALTURA DOS CARDS</span><b id="cardHeightVal">160px</b></div><input id="cardHeightRange" type="range" min="110" max="260" value="160"></div><div class="control"><div class="controlLine"><span>ALTURA DA JANELA/ABA</span><b id="sheetHeightVal">88%</b></div><input id="sheetHeightRange" type="range" min="55" max="96" value="88"></div></div><div class="pane" id="fieldsPane">`;
  if(html.includes(anchor)) html=html.replace(anchor,controls);
  else console.log('SKIP: ancora controles altura');

  const js=`
/* ${MARK} JS */
(function(){
  pref.cardHeight=Number(pref.cardHeight||160);
  pref.sheetHeight=Number(pref.sheetHeight||88);
  const originalApplyPref=applyPref;
  applyPref=function(){
    originalApplyPref();
    document.documentElement.style.setProperty('--card-h',pref.cardHeight+'px');
    document.documentElement.style.setProperty('--sheet-h',pref.sheetHeight+'vh');
    const ch=$('cardHeightRange'),sh=$('sheetHeightRange');
    if(ch)ch.value=pref.cardHeight;if(sh)sh.value=pref.sheetHeight;
    set('cardHeightVal',pref.cardHeight+'px');set('sheetHeightVal',pref.sheetHeight+'%');
  };
  function openDesigner(){
    const s=$('designer');if(!s)return;
    s.classList.add('on');document.body.classList.add('modalOpen');
    requestAnimationFrame(()=>{const d=s.querySelector('.dialog');if(d)d.scrollTop=0});
  }
  function closeDesigner(){const s=$('designer');if(s)s.classList.remove('on');document.body.classList.remove('modalOpen')}
  const db=$('designerBtn'),cb=$('closeDesigner'),sheet=$('designer'),dialog=sheet&&sheet.querySelector('.dialog');
  if(db)db.onclick=openDesigner;if(cb)cb.onclick=closeDesigner;
  if(sheet)sheet.onclick=e=>{if(e.target===sheet)closeDesigner()};
  if(dialog){dialog.onclick=e=>e.stopPropagation();dialog.ontouchmove=e=>e.stopPropagation()}
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDesigner()});
  const ch=$('cardHeightRange'),sh=$('sheetHeightRange');
  if(ch)ch.oninput=e=>{pref.cardHeight=+e.target.value;savePref();applyPref()};
  if(sh)sh.oninput=e=>{pref.sheetHeight=+e.target.value;savePref();applyPref()};
  applyPref();
})();
`;
  html=html.replace('</script>',js+'\n</script>');
}

fs.writeFileSync(file,html);
console.log('Janelas destravadas e controles de altura adicionados.');
