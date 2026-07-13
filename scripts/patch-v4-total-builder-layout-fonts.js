const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const MARK = 'V4 TOTAL BUILDER LAYOUT FONTS FINAL';

if (html.includes(MARK)) {
  console.log('JA OK:', MARK);
  process.exit(0);
}

const css = `
/* ${MARK} */
:root{
  --v4-font-scale:1;
  --v4-dash-card-height:150px;
}

/* Criador: uma escolha de função por lugar, sem referências sobrepostas. */
.customReferences,
#customReferenceList{display:none!important}
.customBuilder{z-index:220!important;align-items:flex-end!important}
.customBuilderDialog{
  display:flex!important;
  flex-direction:column!important;
  width:min(650px,100%)!important;
  height:min(91dvh,860px)!important;
  max-height:calc(100dvh - env(safe-area-inset-top) - 12px)!important;
  padding:0!important;
  overflow:hidden!important;
}
.customBuilderHead{flex:0 0 auto;padding-left:22px!important;padding-right:22px!important}
.customBuilderScroll{
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
  overflow-x:hidden;
  padding:0 22px 24px;
  -webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;
}
.customBuilderActions{
  position:static!important;
  flex:0 0 auto;
  margin:0!important;
  padding:14px 22px calc(14px + env(safe-area-inset-bottom))!important;
  background:#202122!important;
  border-top:1px solid #414141!important;
  box-shadow:0 -12px 24px rgba(0,0,0,.32)!important;
  z-index:4!important;
}
.customChoice>label{font-size:13px!important}
.customSlotRow{grid-template-columns:42px minmax(0,1fr)!important}
.customSlotRow select{min-width:0!important;width:100%!important}
.customFunctionHint{font-size:12px;color:#8f9a9d;margin:7px 0 0 52px}

/* Altura dos cards e janelas do DASH, sem alterar o modal. */
#dash .card,
#dash .v4MetricCard,
#dash .v4CustomCell{
  min-height:var(--v4-dash-card-height)!important;
  height:auto!important;
}
#dash .v4FuelCard{min-height:calc(var(--v4-dash-card-height) * .58)!important}
#dash .tyre{min-height:calc(var(--v4-dash-card-height) * .66)!important}

/* Escala geral das fontes do cockpit. */
#dash .label,#dash .v4Label,#dash .v4CustomLabel{font-size:calc(15px * var(--v4-font-scale))!important}
#dash .stat .value,#dash .v4Value,#dash .v4CustomValue{font-size:calc(34px * var(--v4-font-scale))!important}
#dash .smallsub,#dash .v4CustomUnit{font-size:calc(13px * var(--v4-font-scale))!important}
#dash .v4FuelPct{font-size:calc(30px * var(--v4-font-scale))!important}
#dash .rpmCTitle{font-size:calc(16px * var(--v4-font-scale))!important}
#dash .rpmCValue{font-size:calc(68px * var(--v4-font-scale))!important}
#dash .rpmCSub{font-size:calc(15px * var(--v4-font-scale))!important}
#dash .rpmCGear{font-size:calc(39px * var(--v4-font-scale))!important}
.nav button,.nav a{font-size:calc(11px * var(--v4-font-scale))!important}

/* O Designer deve rolar até o último controle/item. */
#designer .dialog{
  height:min(94dvh,920px)!important;
  max-height:calc(100dvh - env(safe-area-inset-top) - 8px)!important;
  padding-bottom:calc(100px + env(safe-area-inset-bottom))!important;
  overflow-y:auto!important;
  overscroll-behavior:contain!important;
}
#designer .pane{padding-bottom:130px!important}
body.modalOpen .nav{pointer-events:none!important;opacity:.18!important}

@media(max-width:430px){
  .customBuilderDialog{height:92dvh!important}
  .customBuilderHead{padding-left:16px!important;padding-right:16px!important}
  .customBuilderScroll{padding-left:16px!important;padding-right:16px!important}
  .customBuilderActions{padding-left:16px!important;padding-right:16px!important}
}
`;
html = html.replace('</style>', css + '\n</style>');

const js = `
<script>
/* ${MARK} JS */
(function(){
  const q=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));

  function parseLapMs(v){
    if(v===null||v===undefined||v==='')return null;
    if(typeof v==='object')v=v.time??v.lapTime??v.value??v.ms??v.duration;
    if(typeof v==='number'){
      if(!Number.isFinite(v)||v<=0)return null;
      return v<1000?Math.round(v*1000):Math.round(v);
    }
    const s=String(v).trim().replace(',', '.');
    if(!s||s==='--')return null;
    const p=s.split(':').map(Number);
    if(p.some(x=>!Number.isFinite(x)))return null;
    let seconds=0;
    if(p.length===3)seconds=p[0]*3600+p[1]*60+p[2];
    else if(p.length===2)seconds=p[0]*60+p[1];
    else seconds=p[0];
    return seconds>0?Math.round(seconds*1000):null;
  }

  function formatMs(value){
    let ms=Math.max(0,Math.round(Number(value)||0));
    const h=Math.floor(ms/3600000);ms%=3600000;
    const m=Math.floor(ms/60000);ms%=60000;
    const s=Math.floor(ms/1000),z=ms%1000;
    const ss=String(s).padStart(2,'0'),zz=String(z).padStart(3,'0');
    return h>0?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+ss+'.'+zz:String(m).padStart(2,'0')+':'+ss+'.'+zz;
  }

  function completedLapTimes(d){
    const candidates=[d?.lapTimes,d?.analysis?.lapTimes,d?.completedLapTimes,d?.laps,d?.session?.laps];
    const source=candidates.find(Array.isArray)||[];
    return source.map(parseLapMs).filter(x=>Number.isFinite(x)&&x>0);
  }

  function applyTotal(d){
    if(!d||typeof d!=='object')return d;
    const all=completedLapTimes(d);
    const rawCount=Number(d.voltasCompletadas??d.voltasCorridas??d.analysis?.laps??all.length)||0;
    const validCount=Math.max(0,rawCount-1);
    const totalMs=all.reduce((sum,v)=>sum+v,0);
    d.analysis=d.analysis||{};
    d.analysis.laps=validCount;
    d.voltasValidas=validCount;
    d.voltasCorrigidas=validCount;
    if(totalMs>0){
      const total=formatMs(totalMs);
      d.analysis.total=total;
      d.tempoTotalCorrida=total;
      d.tempoTotalCompletadas=total;
    }
    return d;
  }

  function installRender(){
    if(typeof window.render!=='function'||window.render.__v4TotalAllLaps)return;
    const previous=window.render;
    const wrapped=function(data){
      data=applyTotal(data);
      window.live=data;
      const out=previous.call(this,data);
      const total=data?.analysis?.total||data?.tempoTotalCorrida||'--';
      const laps=data?.analysis?.laps??data?.voltasValidas??0;
      ['total','totalTime','totalTimeCard','v4TotalValue'].forEach(id=>{const e=q(id);if(e)e.textContent=total});
      const lapEl=q('laps');if(lapEl)lapEl.textContent=laps;
      document.querySelectorAll('[data-custom-value="total"]').forEach(e=>e.textContent=total);
      document.querySelectorAll('[data-custom-value="laps"]').forEach(e=>e.textContent=laps);
      return out;
    };
    wrapped.__v4TotalAllLaps=true;
    window.render=wrapped;
  }

  function normalizeBuilder(){
    const dialog=document.querySelector('.customBuilderDialog');
    const head=dialog?.querySelector('.customBuilderHead');
    const actions=dialog?.querySelector('.customBuilderActions');
    if(!dialog||!head||!actions)return;
    let scroll=dialog.querySelector('.customBuilderScroll');
    if(!scroll){
      scroll=document.createElement('div');
      scroll.className='customBuilderScroll';
      const movable=[...dialog.children].filter(e=>e!==head&&e!==actions);
      movable.forEach(e=>scroll.appendChild(e));
      dialog.insertBefore(scroll,actions);
    }
    dialog.querySelectorAll('.customReferences,#customReferenceList').forEach(e=>e.remove());
    const slots=dialog.querySelector('#customSlots');
    const choice=slots?.closest('.customChoice');
    const label=choice?.querySelector(':scope > label');
    if(label)label.textContent='FUNÇÃO DE CADA CAMPO';
    dialog.querySelectorAll('.customSlotRow').forEach((row,index)=>{
      if(!row.querySelector('.customFunctionHint')){
        const hint=document.createElement('div');
        hint.className='customFunctionHint';
        hint.textContent='Escolha a função exibida no lugar '+(index+1)+'.';
        row.insertAdjacentElement('afterend',hint);
      }
    });
  }

  const PREF='gt7_v4_direct_ui_v1';
  function readPref(){try{return JSON.parse(localStorage.getItem(PREF)||'{}')}catch{return {}}}
  function writePref(p){localStorage.setItem(PREF,JSON.stringify(p))}

  function ensureFontControl(){
    const pane=q('stylePane');if(!pane||q('fontScaleRange'))return;
    const control=document.createElement('div');
    control.className='control';
    control.innerHTML='<div class="controlLine"><span>TAMANHO GERAL DAS FONTES</span><b id="fontScaleVal">100%</b></div><input id="fontScaleRange" type="range" min="70" max="135" value="100">';
    pane.appendChild(control);
    const p=readPref();
    const range=q('fontScaleRange');
    range.value=clamp(p.fontScale||100,70,135);
    range.oninput=e=>{const v=clamp(e.target.value,70,135);const pref=readPref();pref.fontScale=v;writePref(pref);applyDashboardControls()};
  }

  function applyDashboardControls(){
    const p=readPref();
    const base=clamp(p.cardHeight||160,90,280);
    const scale=clamp(p.sheetHeight||100,45,140)/100;
    const actual=Math.round(base*scale);
    const font=clamp(p.fontScale||100,70,135);
    document.documentElement.style.setProperty('--v4-dash-card-height',actual+'px');
    document.documentElement.style.setProperty('--v4-font-scale',String(font/100));
    const ch=q('cardHeightVal');if(ch)ch.textContent=base+'px';
    const sh=q('sheetHeightVal');if(sh)sh.textContent=Math.round(scale*100)+'%';
    const fv=q('fontScaleVal');if(fv)fv.textContent=font+'%';
    const fr=q('fontScaleRange');if(fr&&Number(fr.value)!==font)fr.value=font;
  }

  function rebindHeightControls(){
    const card=q('cardHeightRange'),dash=q('sheetHeightRange');
    if(card&&!card.__v4Bound){
      card.__v4Bound=true;
      card.oninput=e=>{const p=readPref();p.cardHeight=clamp(e.target.value,90,280);writePref(p);applyDashboardControls()};
    }
    if(dash&&!dash.__v4Bound){
      dash.__v4Bound=true;
      dash.min='45';dash.max='140';
      const label=dash.closest('.control')?.querySelector('.controlLine span');if(label)label.textContent='ALTURA DAS JANELAS/CARDS/ABAS DO DASH';
      dash.oninput=e=>{const p=readPref();p.sheetHeight=clamp(e.target.value,45,140);writePref(p);applyDashboardControls()};
    }
  }

  function loop(){
    installRender();
    normalizeBuilder();
    ensureFontControl();
    rebindHeightControls();
    applyDashboardControls();
    requestAnimationFrame(loop);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(loop));
  else requestAnimationFrame(loop);
})();
</script>
`;
html = html.replace('</body>', js + '\n</body>');

fs.writeFileSync(file, html);
console.log('Tempo total, criador, alturas e fontes corrigidos.');
