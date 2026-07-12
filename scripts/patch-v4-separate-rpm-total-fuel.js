const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 SEPARATE RPM TOTAL FUEL';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

html=html.replace('</style>',`
/* ${MARK} */
.v4MetricsSeparate{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}
.v4MetricCard{min-height:126px;padding:17px;border:1px solid #15383b;border-radius:22px;background:linear-gradient(180deg,rgba(5,22,22,.96),rgba(1,8,9,.98));box-shadow:inset 0 1px rgba(255,255,255,.025),0 14px 28px rgba(0,0,0,.28)}
.v4MetricCard .v4Label{font-family:Georgia,serif;font-size:16px;font-weight:800;letter-spacing:1.5px;color:#cfd0d1}
.v4MetricCard .v4Value{font-size:40px;line-height:1.05;margin-top:22px;color:#fff;font-weight:300}
.v4FuelCard{grid-column:1/-1;min-height:148px}
.v4FuelTop{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.v4FuelPct{font-size:36px;color:var(--cyan);font-weight:300;line-height:1}
.v4FuelBars{display:grid;grid-template-columns:repeat(12,1fr);gap:6px;margin-top:22px;direction:ltr}
.v4FuelBar{height:38px;border-radius:7px;background:#172326;opacity:.7;transition:background .12s,box-shadow .12s,opacity .12s}
.v4FuelBar.on{opacity:1}
.v4FuelBar.on:nth-child(-n+2){background:#ff344f;box-shadow:0 0 10px rgba(255,52,79,.75)}
.v4FuelBar.on:nth-child(n+3):nth-child(-n+4){background:#ff7a18;box-shadow:0 0 10px rgba(255,122,24,.68)}
.v4FuelBar.on:nth-child(n+5):nth-child(-n+7){background:#e7ff19;box-shadow:0 0 10px rgba(231,255,25,.62)}
.v4FuelBar.on:nth-child(n+8){background:#10ef55;box-shadow:0 0 10px rgba(16,239,85,.62)}
.v4FuelCard.lowFuel{animation:v4FuelBlink .7s steps(2,end) infinite}
.v4FuelCard.lowFuel .v4FuelBar.on{background:#ff344f;box-shadow:0 0 16px rgba(255,52,79,.95)}
@keyframes v4FuelBlink{0%,48%{opacity:1;filter:none}49%,100%{opacity:.35;filter:drop-shadow(0 0 14px #ff344f)}}
.v4OldCombinedHidden{display:none!important}
@media(max-width:430px){.v4MetricsSeparate{gap:9px}.v4MetricCard{min-height:112px;padding:14px}.v4MetricCard .v4Label{font-size:14px}.v4MetricCard .v4Value{font-size:34px;margin-top:18px}.v4FuelPct{font-size:30px}.v4FuelBars{gap:4px;margin-top:18px}.v4FuelBar{height:32px}}
</style>`);

html=html.replace('</body>',`<script>
(function(){
 const MARK='${MARK}';
 function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
 function txt(id){return document.getElementById(id)?.textContent?.trim()||''}
 function fuelValue(){
  const L=window.live||{};
  const direct=L.combustivelPorcentagem??L.fuel?.percent??L.legacy?.fuelPercent??L.fuelPercent;
  if(direct!==undefined&&direct!==null&&direct!=='')return Math.max(0,Math.min(100,n(direct)));
  const fromDom=txt('fuel')||txt('fuelValue')||txt('fuelPct');
  return Math.max(0,Math.min(100,n(String(fromDom).replace('%',''))));
 }
 function create(){
  if(document.getElementById('v4MetricsSeparate'))return;
  const rpm=document.getElementById('rpm');
  const total=document.getElementById('totalTime')||document.getElementById('totalTimeCard');
  let anchor=rpm?.closest('.card,.rpmblock,.panel,.stats')||total?.closest('.card,.rpmblock,.panel,.stats');
  if(!anchor){
   const gauge=document.getElementById('rpmCWrap');
   anchor=gauge?.nextElementSibling||gauge;
  }
  if(!anchor)return;
  const wrap=document.createElement('section');
  wrap.id='v4MetricsSeparate';wrap.className='v4MetricsSeparate';
  wrap.innerHTML='<article class="v4MetricCard"><div class="v4Label">RPM</div><div class="v4Value" id="v4RpmValue">0</div></article>'+ 
   '<article class="v4MetricCard"><div class="v4Label">TEMPO TOTAL</div><div class="v4Value" id="v4TotalValue">--</div></article>'+ 
   '<article class="v4MetricCard v4FuelCard" id="v4FuelCard"><div class="v4FuelTop"><div class="v4Label">COMBUSTÍVEL</div><div class="v4FuelPct" id="v4FuelPct">0%</div></div><div class="v4FuelBars" id="v4FuelBars"></div></article>';
  anchor.parentNode.insertBefore(wrap,anchor);
  anchor.classList.add('v4OldCombinedHidden');
  const bars=document.getElementById('v4FuelBars');
  for(let i=0;i<12;i++){const b=document.createElement('i');b.className='v4FuelBar';bars.appendChild(b)}
 }
 function update(){
  create();
  const L=window.live||{};
  const rpm=n(L.rpm,n(txt('rpm')));
  const total=L.tempoTotalCorrida||L.analysis?.total||txt('totalTime')||txt('totalTimeCard')||'--';
  const fuel=fuelValue();
  const barsOn=Math.max(0,Math.min(12,Math.ceil(fuel/100*12)));
  const rv=document.getElementById('v4RpmValue');if(rv)rv.textContent=Math.round(rpm);
  const tv=document.getElementById('v4TotalValue');if(tv)tv.textContent=total||'--';
  const fp=document.getElementById('v4FuelPct');if(fp)fp.textContent=Math.round(fuel)+'%';
  document.querySelectorAll('#v4FuelBars .v4FuelBar').forEach((b,i)=>b.classList.toggle('on',i<barsOn));
  document.getElementById('v4FuelCard')?.classList.toggle('lowFuel',barsOn>0&&barsOn<=5);
  requestAnimationFrame(update);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(update));else requestAnimationFrame(update);
})();
</script>\n</body>`);

fs.writeFileSync(file,html);
console.log('Combustivel vermelho a esquerda, verde a direita e fontes reduzidas.');
