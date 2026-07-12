const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const MARK = 'V4 LAPS FUEL REFERENCES FIX';

if (html.includes(MARK)) {
  console.log('JA OK:', MARK);
  process.exit(0);
}

const css = `
/* ${MARK} */
.v4FuelCard{
  min-height:92px!important;
  padding:12px 16px!important;
}
.v4FuelTop{align-items:center!important}
.v4FuelPct{font-size:30px!important}
.v4FuelCard .v4Label{font-size:15px!important}
.v4FuelBars{margin-top:12px!important;gap:5px!important}
.v4FuelBar{height:24px!important;border-radius:6px!important}
.customReferences{margin:14px 0 6px}
.customReferencesTitle{font-size:13px;font-weight:900;letter-spacing:1.2px;color:#aeb4b6;margin-bottom:9px}
.customReferenceGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.customReference{border:1px solid #45494b;border-radius:12px;background:#151718;color:#e8edef;padding:10px;text-align:left;min-width:0}
.customReference b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.customReference small{display:block;color:#00d9f2;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.customReference.active{border-color:#4a89f4;box-shadow:0 0 0 1px #4a89f4 inset;background:#1b2940}
.customSlotRow.selected{outline:2px solid #4a89f4;border-radius:14px;padding:3px}
@media(max-width:430px){
 .v4FuelCard{min-height:84px!important;padding:10px 13px!important}
 .v4FuelPct{font-size:27px!important}
 .v4FuelBar{height:21px!important}
 .customReferenceGrid{grid-template-columns:1fr 1fr}
}
`;
html = html.replace('</style>', css + '\n</style>');

const js = `
<script>
/* ${MARK} JS */
(function(){
  const REF_FIELDS = [
    ['speed','Velocidade','KM/H'],['gear','Marcha',''],['rpm','RPM','rpm'],['total','Tempo total',''],
    ['throttle','Acelerador','%'],['brake','Freio','%'],['best','Melhor volta',''],['fuel','Combustível','%'],
    ['laps','Voltas válidas',''],['maxSpeed','Max Speed','KM/H'],['grade','UDM Nota',''],['score','Consistência','%'],
    ['tFL','Pneu dianteiro esq.','°C'],['tFR','Pneu dianteiro dir.','°C'],['tRL','Pneu traseiro esq.','°C'],['tRR','Pneu traseiro dir.','°C']
  ];

  function parseLapMs(v){
    if(v===null||v===undefined||v==='') return null;
    if(typeof v==='object') v=v.time??v.lapTime??v.value??v.ms;
    if(typeof v==='number'){
      if(!Number.isFinite(v)||v<=0) return null;
      return v < 1000 ? Math.round(v*1000) : Math.round(v);
    }
    const s=String(v).trim().replace(',', '.');
    if(!s||s==='--') return null;
    const p=s.split(':').map(Number);
    if(p.some(x=>!Number.isFinite(x))) return null;
    let sec=0;
    if(p.length===3) sec=p[0]*3600+p[1]*60+p[2];
    else if(p.length===2) sec=p[0]*60+p[1];
    else sec=p[0];
    return sec>0?Math.round(sec*1000):null;
  }

  function formatLapMs(ms){
    ms=Math.max(0,Math.round(Number(ms)||0));
    const h=Math.floor(ms/3600000); ms%=3600000;
    const m=Math.floor(ms/60000); ms%=60000;
    const s=Math.floor(ms/1000); const z=ms%1000;
    const ss=String(s).padStart(2,'0');
    const zz=String(z).padStart(3,'0');
    return h>0 ? String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+ss+'.'+zz : String(m).padStart(2,'0')+':'+ss+'.'+zz;
  }

  function correctLapData(d){
    if(!d||typeof d!=='object') return d;
    const source = Array.isArray(d.lapTimes) ? d.lapTimes :
      Array.isArray(d.analysis?.lapTimes) ? d.analysis.lapTimes :
      Array.isArray(d.laps) ? d.laps : [];
    const allMs=source.map(parseLapMs).filter(x=>Number.isFinite(x)&&x>0);
    const validMs=allMs.length ? allMs.slice(1) : [];
    const rawCount=Number(d.voltasCompletadas ?? d.voltasCorridas ?? d.analysis?.laps ?? 0) || 0;
    const validCount=allMs.length ? validMs.length : Math.max(0,rawCount-1);
    const totalMs=validMs.reduce((a,b)=>a+b,0);
    d.analysis = d.analysis || {};
    d.analysis.laps = validCount;
    d.voltasValidas = validCount;
    d.voltasCorrigidas = validCount;
    if(totalMs>0){
      const formatted=formatLapMs(totalMs);
      d.analysis.total=formatted;
      d.tempoTotalCorrida=formatted;
      d.tempoTotalValido=formatted;
    } else if(validCount===0){
      d.analysis.total='--';
      d.tempoTotalCorrida='--';
      d.tempoTotalValido='--';
    }
    d.validLapTimes=validMs.map(formatLapMs);
    return d;
  }

  function installRenderWrapper(){
    if(typeof window.render!=='function'||window.render.__v4Corrected) return false;
    const original=window.render;
    const wrapped=function(d){
      d=correctLapData(d);
      window.live=d;
      const out=original.call(this,d);
      const laps=document.getElementById('laps'); if(laps) laps.textContent=d.analysis?.laps??d.voltasValidas??0;
      const total=document.getElementById('total'); if(total) total.textContent=d.analysis?.total||d.tempoTotalCorrida||'--';
      const v4Total=document.getElementById('v4TotalValue'); if(v4Total) v4Total.textContent=d.analysis?.total||d.tempoTotalCorrida||'--';
      return out;
    };
    wrapped.__v4Corrected=true;
    window.render=wrapped;
    return true;
  }

  function currentValue(id){
    const L=window.live||{},A=L.analysis||{};
    const map={speed:L.velocidade,gear:L.marcha,rpm:L.rpm,total:A.total||L.tempoTotalCorrida,throttle:L.acelerador,brake:L.freio,best:A.best||L.melhorVolta,fuel:L.combustivelPorcentagem,laps:A.laps??L.voltasValidas,maxSpeed:L.velocidadeMaxima,grade:A.grade,score:A.consistency,tFL:L.advanced?.tyreTemp?.FL??L.motecChannels?.tyreTemp?.FL,tFR:L.advanced?.tyreTemp?.FR??L.motecChannels?.tyreTemp?.FR,tRL:L.advanced?.tyreTemp?.RL??L.motecChannels?.tyreTemp?.RL,tRR:L.advanced?.tyreTemp?.RR??L.motecChannels?.tyreTemp?.RR};
    let v=map[id];
    if(v===undefined||v===null||v==='') v=document.getElementById(id)?.textContent;
    return v===undefined||v===null||v===''?'--':String(v);
  }

  let selectedSlot=0;
  function ensureReferences(){
    const slots=document.getElementById('customSlots');
    if(!slots||document.getElementById('customReferenceList')) return;
    const wrap=document.createElement('div');
    wrap.className='customReferences'; wrap.id='customReferenceList';
    wrap.innerHTML='<div class="customReferencesTitle">REFERÊNCIAS DISPONÍVEIS — TOQUE PARA USAR</div><div class="customReferenceGrid"></div>';
    slots.parentNode.insertBefore(wrap,slots);
    slots.addEventListener('click',e=>{
      const row=e.target.closest('.customSlotRow'); if(!row)return;
      const rows=[...slots.querySelectorAll('.customSlotRow')]; selectedSlot=Math.max(0,rows.indexOf(row));
      rows.forEach((r,i)=>r.classList.toggle('selected',i===selectedSlot));
    });
    renderReferences();
  }

  function renderReferences(){
    const grid=document.querySelector('#customReferenceList .customReferenceGrid'); if(!grid)return;
    grid.innerHTML=REF_FIELDS.map(([id,name,unit])=>'<button type="button" class="customReference" data-ref-field="'+id+'"><b>'+name+'</b><small>'+currentValue(id)+(unit?' '+unit:'')+'</small></button>').join('');
    grid.querySelectorAll('[data-ref-field]').forEach(btn=>btn.onclick=()=>{
      const selects=[...document.querySelectorAll('[data-custom-slot]')];
      const target=selects[Math.min(selectedSlot,Math.max(0,selects.length-1))];
      if(target){target.value=btn.dataset.refField;target.dispatchEvent(new Event('change',{bubbles:true}));}
      grid.querySelectorAll('.customReference').forEach(x=>x.classList.toggle('active',x===btn));
    });
  }

  function loop(){
    installRenderWrapper();
    ensureReferences();
    renderReferences();
    requestAnimationFrame(loop);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(loop));
  else requestAnimationFrame(loop);
})();
</script>
`;
html = html.replace('</body>', js + '\n</body>');

fs.writeFileSync(file, html);
console.log('Voltas validas, tempo total, combustível compacto e referências corrigidos.');
