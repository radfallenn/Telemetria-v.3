const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const marker = 'V4_MD_DESIGN_2026';
if (html.includes(marker)) {
  console.log('JA OK: V4 MD design');
  process.exit(0);
}

const css = `
/* ${marker} */
:root{--md-cyan:#00eaff;--md-green:#36ff4c;--md-yellow:#ffe600;--md-orange:#ff8a00;--md-red:#ff4b73;--md-bg:#00100f;--md-card:rgba(2,15,15,.94);--md-line:rgba(0,235,225,.24)}
#dashPage.mdDash{padding-bottom:18px;font-family:Georgia,'Times New Roman',serif;background:radial-gradient(circle at 20% 0,rgba(0,255,235,.10),transparent 34%),linear-gradient(180deg,#001310 0%,#000706 100%)}
.mdHeader{display:flex;align-items:flex-start;justify-content:space-between;padding:4px 2px 12px}.mdHeader h1{font-family:Arial,sans-serif;font-size:27px;margin:0;font-weight:950;letter-spacing:.04em}.mdPing{display:flex;gap:10px;align-items:center;padding:8px 18px;border-radius:30px;border:1px solid var(--md-line);background:linear-gradient(145deg,#071b1a,#020908);box-shadow:inset 0 1px rgba(255,255,255,.08),0 8px 24px #000}.mdDot{width:15px;height:15px;border-radius:50%;background:var(--md-cyan);box-shadow:0 0 14px var(--md-cyan)}.mdPing b{font:900 16px Arial}.mdPing small{display:block;color:#aebbbb;text-align:center;font:12px Arial}.mdPanel{border:1px solid var(--md-line);border-radius:18px;background:linear-gradient(145deg,rgba(3,22,21,.97),rgba(0,8,8,.96));box-shadow:inset 0 1px rgba(255,255,255,.035),0 14px 34px rgba(0,0,0,.44)}.mdBridge{padding:13px;text-align:center}.mdLabel{font-size:14px;font-weight:900;letter-spacing:.12em;color:#b9c6c6;text-transform:uppercase}.mdBridgeVal{font-size:28px;color:var(--md-cyan);font-weight:900;text-shadow:0 0 12px rgba(0,234,255,.6);margin-top:4px}.mdHero{display:grid;grid-template-columns:1.25fr 1fr;margin-top:12px;overflow:hidden}.mdHeroCell{min-height:190px;padding:30px 22px;text-align:center;display:flex;flex-direction:column;justify-content:center}.mdHeroCell+ .mdHeroCell{border-left:1px solid rgba(255,255,255,.11)}.mdHeroNum{font-size:76px;line-height:.92;color:#f5f7f5;font-weight:400}.mdHeroUnit{font-size:25px;color:#b8c1c0;margin-top:12px}.mdGear{font-size:74px;color:var(--md-cyan);line-height:1;text-shadow:0 0 12px rgba(0,234,255,.5)}.mdPacket{margin-top:12px;padding:20px}.mdPacketTop{display:grid;grid-template-columns:1fr 1.1fr;gap:14px}.mdPacketTop>div:nth-child(2){border-left:1px solid rgba(255,255,255,.1);padding-left:24px}.mdPacketName{font:900 28px Arial;color:var(--md-cyan);margin-top:9px}.mdTime{font:500 34px Arial;color:#f4f4f4;margin-top:9px}.mdDivider{height:1px;background:rgba(255,255,255,.13);margin:18px 0 15px}.mdSpeedBarTitle{text-align:center;margin-bottom:17px}.mdSegments{height:36px;display:grid;grid-template-columns:repeat(24,1fr);gap:5px;align-items:end}.mdSeg{height:20px;border-radius:6px;background:#10201f}.mdSeg.on:nth-child(-n+8){background:linear-gradient(#31ff18,#17d500);box-shadow:0 0 11px #2aff20}.mdSeg.on:nth-child(n+9):nth-child(-n+16){background:linear-gradient(#faff00,#ffe000);box-shadow:0 0 11px #ffe900}.mdSeg.on:nth-child(n+17){background:linear-gradient(#ffb000,#ff7200);box-shadow:0 0 11px #ff9300}.mdScale{display:flex;justify-content:space-between;color:#aeb7b6;font-size:16px;margin-top:7px}.mdGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.mdCard{min-height:132px;padding:22px 20px}.mdCard .mdLabel.cyan{color:var(--md-cyan)}.mdCard .mdLabel.red{color:#ff6d91}.mdValue{font:400 40px Arial;color:#f6f7f7;margin-top:16px}.mdValue.cyan{color:var(--md-cyan)}.mdValue.red{color:#ff6d91}.mdBar{height:13px;background:#273333;border-radius:99px;margin-top:28px;overflow:hidden}.mdFill{height:100%;width:0;background:linear-gradient(90deg,var(--md-cyan),#00aaff);border-radius:99px}.mdFill.red{background:linear-gradient(90deg,#ff174c,#ff6d91)}.mdSmall{font:13px Arial;color:#9da8a7;margin-top:8px}.mdWide{grid-column:1/-1}.mdTyres{margin-top:14px;padding:20px}.mdTyreGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:13px}.mdTyre{padding:13px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:rgba(0,0,0,.22)}.mdTyreVal{font:700 25px Arial;color:var(--md-cyan);margin-top:7px}.mdTyre .mdBar{margin-top:10px}.mdBottomNav{grid-template-columns:repeat(6,1fr)!important;height:68px!important}.mdBottomNav button{font-size:9px!important}.mdBottomNav button.on{color:var(--md-cyan)!important;box-shadow:inset 0 -3px var(--md-cyan)}
`;
html = html.replace('</style>', css + '\n</style>');

const js = `
/* ${marker} JS */
(function(){
 const page=document.getElementById('dashPage'); if(!page)return;
 page.classList.add('mdDash');
 page.innerHTML=\`
 <div class="mdHeader"><h1>V4 COCKPIT</h1><div class="mdPing"><i class="mdDot" id="mdDot"></i><div><b id="mdOk">--</b><small id="mdPing">-- ms</small></div></div></div>
 <div class="mdPanel mdBridge"><div class="mdLabel">Bridge</div><div class="mdBridgeVal" id="mdBridge">AGUARDANDO</div></div>
 <div class="mdPanel mdHero"><div class="mdHeroCell"><div class="mdLabel">Velocidade</div><div class="mdHeroNum" id="mdSpeed">0</div><div class="mdHeroUnit">KM/H</div></div><div class="mdHeroCell"><div class="mdLabel">Marcha</div><div class="mdGear" id="mdGear">N</div></div></div>
 <div class="mdPanel mdPacket"><div class="mdPacketTop"><div><div class="mdLabel">Pacote</div><div class="mdPacketName" id="mdPacket">GT7-UDP</div></div><div><div class="mdLabel">Tempo Total</div><div class="mdTime" id="mdTotal">--</div></div></div><div class="mdDivider"></div><div class="mdLabel mdSpeedBarTitle">Velocidade</div><div class="mdSegments" id="mdSegments"></div><div class="mdScale"><span>0</span><span>KM/H</span><span>300</span></div></div>
 <div class="mdGrid">
  <div class="mdPanel mdCard"><div class="mdLabel cyan">RPM</div><div class="mdValue" id="mdRpm">0</div></div>
  <div class="mdPanel mdCard"><div class="mdLabel cyan">Acelerador</div><div class="mdValue cyan" id="mdThrottle">0%</div><div class="mdBar"><div class="mdFill" id="mdThrottleFill"></div></div></div>
  <div class="mdPanel mdCard"><div class="mdLabel red">Freio</div><div class="mdValue red" id="mdBrake">0%</div><div class="mdBar"><div class="mdFill red" id="mdBrakeFill"></div></div></div>
  <div class="mdPanel mdCard"><div class="mdLabel">Melhor Volta</div><div class="mdValue" id="mdBest">--</div></div>
  <div class="mdPanel mdCard"><div class="mdLabel">Última Volta</div><div class="mdValue" id="mdLast">--</div></div>
  <div class="mdPanel mdCard"><div class="mdLabel cyan">Combustível</div><div class="mdValue cyan" id="mdFuel">--%</div><div class="mdBar"><div class="mdFill" id="mdFuelFill"></div></div></div>
  <div class="mdPanel mdCard"><div class="mdLabel">Voltas Válidas</div><div class="mdValue cyan" id="mdLaps">0</div></div>
  <div class="mdPanel mdCard"><div class="mdLabel">Max Speed</div><div class="mdValue" id="mdMax">0</div><div class="mdSmall">Velocidade máxima da seção atual</div></div>
  <div class="mdPanel mdCard mdWide"><div class="mdLabel">UDM Nota</div><div class="mdValue cyan" id="mdGrade">--</div><div class="mdSmall" id="mdUdmSub">Consistência -- · Delta --</div></div>
 </div>
 <div class="mdPanel mdTyres"><div class="mdLabel">Temperatura dos Pneus</div><div class="mdTyreGrid">
  <div class="mdTyre"><div class="mdLabel">Dianteiro Esq.</div><div class="mdTyreVal" id="mdTFL">--°C</div><div class="mdBar"><div class="mdFill" id="mdTFLF"></div></div></div>
  <div class="mdTyre"><div class="mdLabel">Dianteiro Dir.</div><div class="mdTyreVal" id="mdTFR">--°C</div><div class="mdBar"><div class="mdFill" id="mdTFRF"></div></div></div>
  <div class="mdTyre"><div class="mdLabel">Traseiro Esq.</div><div class="mdTyreVal" id="mdTRL">--°C</div><div class="mdBar"><div class="mdFill" id="mdTRLF"></div></div></div>
  <div class="mdTyre"><div class="mdLabel">Traseiro Dir.</div><div class="mdTyreVal" id="mdTRR">--°C</div><div class="mdBar"><div class="mdFill" id="mdTRRF"></div></div></div>
 </div></div>\`;
 const seg=document.getElementById('mdSegments');seg.innerHTML=Array.from({length:24},()=>'<i class="mdSeg"></i>').join('');
 const nav=document.querySelector('.nav');if(nav){nav.classList.add('mdBottomNav');nav.innerHTML='<button class="navBtn on" data-page="dashPage">DASH</button><button class="navBtn" data-page="modPage">ATRIB</button><button class="navBtn" data-page="lapsPage">VOLTAS</button><button class="navBtn" data-page="sectionsPage">SEÇÃO</button><button class="navBtn" data-page="infoPage">TELEMETRIA</button><button class="navBtn" data-page="setPage">SET</button>';nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(typeof showPage==='function')showPage(b.dataset.page);nav.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))});}
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};const width=(id,v)=>{const e=document.getElementById(id);if(e)e.style.width=Math.max(0,Math.min(100,Number(v)||0))+'%'};
 const tyre=(id,fill,v)=>{let n=Number(v);set(id,Number.isFinite(n)&&n>0?Math.round(n)+'°C':'--°C');width(fill,Number.isFinite(n)?Math.max(0,Math.min(100,(n-30)/90*100)):0)};
 async function refresh(){let url=(document.getElementById('bridgeUrl')?.value||localStorage.getItem('bridgeUrl')||'http://192.168.1.70:8787').replace(/\\/$/,'');let t=performance.now();try{let r=await fetch(url+'/api/fields',{cache:'no-store'});let d=await r.json(),a=d.analysis||{},adv=d.advanced||{},ty=adv.tyreTemp||d.motecChannels?.tyreTemp||{};let ping=Math.round(performance.now()-t);set('mdOk','OK');set('mdPing',ping+'ms');set('mdBridge',d.decodeOk?'OK · '+(d.packetVersion||adv.packetType||'GT7-UDP'):'OK · GT7-UDP');document.getElementById('mdDot').style.background='#00eaff';set('mdSpeed',Math.round(d.velocidade||0));set('mdGear',d.marcha||'N');set('mdPacket','GT7-UDP '+(d.packetVersion||adv.packetType||''));set('mdTotal',a.total||d.tempoTotalCorrida||'--');set('mdRpm',Math.round(d.rpm||0));set('mdThrottle',Math.round(d.acelerador||0)+'%');width('mdThrottleFill',d.acelerador);set('mdBrake',Math.round(d.freio||0)+'%');width('mdBrakeFill',d.freio);set('mdBest',a.best||d.melhorVolta||'--');set('mdLast',a.last||d.ultimaVolta||'--');let fuel=d.combustivelPorcentagem??d.fuel??0;set('mdFuel',Math.round(fuel)+'%');width('mdFuelFill',fuel);set('mdLaps',a.laps??d.voltasCorrigidas??d.voltasCompletadas??0);set('mdMax',Math.round(d.velocidadeMaxima||0));set('mdGrade',a.grade||'--');set('mdUdmSub','Consistência '+(a.consistency||'--')+' · Delta '+(a.deltaBest||'--'));tyre('mdTFL','mdTFLF',ty.FL);tyre('mdTFR','mdTFRF',ty.FR);tyre('mdTRL','mdTRLF',ty.RL);tyre('mdTRR','mdTRRF',ty.RR);let active=Math.round(Math.min(24,(Number(d.velocidade)||0)/300*24));seg.querySelectorAll('.mdSeg').forEach((x,i)=>x.classList.toggle('on',i<active));}catch(e){set('mdOk','OFF');set('mdPing','-- ms');set('mdBridge','SEM CONEXÃO');document.getElementById('mdDot').style.background='#ff4b73';}}
 refresh();setInterval(refresh,500);
})();
`;
html = html.replace('</script>', js + '\n</script>');
fs.writeFileSync(file, html);
console.log('OK: V4 MD design aplicado');
