const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

function soft(find, replace, label) {
  if (html.includes(find)) {
    html = html.replace(find, replace);
    console.log('OK:', label);
  } else {
    console.log('SKIP:', label);
  }
}
function injectBefore(find, insert, marker, label) {
  if (!html.includes(marker) && html.includes(find)) {
    html = html.replace(find, insert + find);
    console.log('OK:', label);
  } else {
    console.log(html.includes(marker) ? 'JA OK:' : 'SKIP:', label);
  }
}
function appendBeforeScript(insert, marker, label) {
  if (!html.includes(marker) && html.includes('</script>')) {
    html = html.replace('</script>', insert + '\n</script>');
    console.log('OK:', label);
  } else {
    console.log(html.includes(marker) ? 'JA OK:' : 'SKIP:', label);
  }
}

soft('<div class="lab">VOLTAS CORRIGIDAS</div><div class="val" id="correctedLaps">0</div><div class="sub">registros válidos - 1</div>','<div class="lab">VOLTAS VÁLIDAS</div><div class="val" id="correctedLaps">0</div><div class="sub">voltas registradas</div>','label voltas validas classico');
soft('<div class="lab">VOLTAS</div><div class="val" id="rLaps">0</div>','<div class="lab">VOLTAS VÁLIDAS</div><div class="val" id="rLaps">0</div>','label voltas validas racing');
soft("function avgMs(){if(!lapRecords.length)return 0;let arr=lapRecords.map(x=>x.ms);if(arr.length>=7)arr=arr.slice().sort((a,b)=>a-b).slice(3,-3);return arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):0}","function avgMs(){let arr=lapRecords.map(x=>x.ms).filter(validLap);if(!arr.length)return 0;let cut=arr.length>=10?3:(arr.length>=5?2:0);let used=arr.slice().sort((a,b)=>a-b);if(cut>0&&used.length>(cut*2))used=used.slice(cut,-cut);return used.length?Math.round(used.reduce((a,b)=>a+b,0)/used.length):0}",'media filtrada');
soft("set('totalTimeCard',lapRecords.length?fmtMs(totalMs()):keep('total',n.total));","set('totalTimeCard',lapRecords.length?fmtMs(totalMs()):(good(n.total)?keep('total',n.total):'--'));",'tempo total fallback bridge');
soft("set('correctedLaps',Math.max(0,lapRecords.length-1));set('rLaps',Math.max(0,lapRecords.length-1));","const visibleLaps=lapRecords.length?lapRecords.length:Math.max(0,(n.bridgeLaps||n.laps||0));set('correctedLaps',visibleLaps);set('rLaps',visibleLaps);",'voltas validas sem subtrair');
soft("maxSpeed=Math.max(maxSpeed,Math.round(n.speed),n.max);","maxSpeed=Math.max(maxSpeed,Math.round(n.speed));",'max speed secao atual');

injectBefore('</style>', `
/* Cockpit Modular V4 */
.modularTools{position:sticky;top:0;z-index:12;margin:10px 0;padding:10px;background:rgba(2,7,18,.92);border:1px solid var(--line);border-radius:16px;backdrop-filter:blur(10px)}
.modularTools .row{margin-top:6px}.cockpit{position:relative;min-height:820px;margin-top:10px;border:1px solid var(--line);border-radius:20px;background:radial-gradient(circle at 50% 0,#102343,#020712 62%,#000);overflow:hidden}.cockpit.edit{background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px),radial-gradient(circle at 50% 0,#102343,#020712 62%,#000);background-size:24px 24px,24px 24px,auto}.mw{position:absolute;left:10px;top:10px;width:132px;min-height:76px;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:10px;background:linear-gradient(145deg,rgba(10,27,50,.95),rgba(2,7,18,.92));box-shadow:0 18px 35px rgba(0,0,0,.45),inset 0 1px rgba(255,255,255,.06);touch-action:none;user-select:none}.mw.hide{display:none}.mw.drag{outline:2px solid var(--green);z-index:30}.mw .lab{padding-right:28px}.mw .val{font-size:24px}.mw .editBtn{position:absolute;right:8px;top:8px;width:28px;height:28px;padding:0;border-radius:9px;background:rgba(255,255,255,.09)}.mw.gauge{width:178px;height:178px;border-radius:999px;display:grid;place-items:center;text-align:center}.mw.gauge:before{content:"";position:absolute;inset:9px;border-radius:999px;background:conic-gradient(from 225deg,var(--green),var(--yellow),var(--red),transparent 265deg);filter:drop-shadow(0 0 13px rgba(34,245,162,.45))}.mw.gauge:after{content:"";position:absolute;inset:27px;border-radius:999px;background:#07101f;box-shadow:inset 0 0 30px #000}.mw.gauge>*{position:relative;z-index:2}.mw.bigSpeed .val,.mw.bigRpm .val{font-size:38px}.widgetDrawer{display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:90;padding:18px;overflow:auto}.drawerBox{max-width:440px;margin:42px auto}.widgetList{display:grid;grid-template-columns:1fr 1fr;gap:8px}.widgetList label{padding:10px;border:1px solid var(--line);border-radius:12px;background:#061022;font-size:12px}
`, 'Cockpit Modular V4', 'css cockpit modular');

injectBefore('<section id="dashPage"', `<section id="modPage" class="page on"><div class="title"><b>COCKPIT MODULAR</b><div class="lab">TODOS UDM / TELEMETRIA EM UMA PÁGINA</div></div><div class="modularTools"><div class="row"><button id="editCockpitBtn" class="green">EDITAR</button><button id="widgetsBtn">WIDGETS</button></div><div class="row"><button id="saveLayoutBtn">SALVAR LAYOUT</button><button id="resetLayoutBtn" class="red">RESET LAYOUT</button></div><div class="small">Arraste no modo EDITAR. Toque em ⚙ para renomear.</div></div><div id="cockpit" class="cockpit"></div></section>`, 'id="modPage"', 'pagina cockpit modular');
soft('<section id="dashPage" class="page on">','<section id="dashPage" class="page">','dash nao inicial');
soft('<nav class="nav"><button class="navBtn on" data-page="dashPage">DASH</button><button class="navBtn" data-page="lapsPage">VOLTAS</button><button class="navBtn" data-page="infoPage">INFO</button><button class="navBtn" data-page="setPage">SET</button></nav>','<nav class="nav"><button class="navBtn" data-page="dashPage">DASH</button><button class="navBtn on" data-page="modPage">COCKPIT</button><button class="navBtn" data-page="lapsPage">VOLTAS</button><button class="navBtn" data-page="setPage">SET</button></nav>','nav cockpit');

injectBefore('</main>', `<div id="widgetDrawer" class="widgetDrawer"><div class="drawerBox panel"><div class="top"><div><b>WIDGETS</b><div class="lab">ESCOLHA O QUE USAR</div></div><button id="drawerClose" class="red" style="width:72px">FECHAR</button></div><div id="widgetList" class="widgetList" style="margin-top:12px"></div></div></div>`, 'id="widgetDrawer"', 'drawer widgets');

soft("let pollTimer=null,connected=false,lastValid={},rawData={},lapRecords=[],sessionActive=false,maxSpeed=0,lastLapToken='',smoothRpm=0,targetRpm=0;","let pollTimer=null,connected=false,lastValid={},rawData={},lapRecords=[],sessionActive=false,maxSpeed=0,lastLapToken='',smoothRpm=0,targetRpm=0,modEdit=false,modLive={};",'variaveis cockpit');
soft('function render(d){rawData=d;const n=normalize(d);targetRpm=n.rpm;','function render(d){rawData=d;const n=normalize(d);modLive={...d,...n,analysis:d.analysis||{}};targetRpm=n.rpm;','render alimenta cockpit');
soft("renderLaps();renderUDM();$('rawOut').textContent=JSON.stringify(d,null,2)}","renderLaps();renderUDM();renderCockpitValues();$('rawOut').textContent=JSON.stringify(d,null,2)}",'render cockpit values');

appendBeforeScript(`
/* Cockpit Modular V4 JS */
const WKEY='gt7_modular_layout_v1';
const widgets=[['speedGauge','VELOCIDADE','speed','km/h','gauge bigSpeed'],['rpmGauge','RPM','rpm','rpm','gauge bigRpm'],['gearW','MARCHA','gear','', ''],['maxW','MAX SPEED','maxSpeed','km/h',''],['fuelW','FUEL','fuel','%',''],['thrW','ACELERADOR','throttle','%',''],['brakeW','FREIO','brake','%',''],['bestW','MELHOR VOLTA','best','', ''],['lastW','ÚLTIMA VOLTA','last','', ''],['totalW','TEMPO TOTAL','total','', ''],['avgW','MÉDIA','avg','', ''],['lapsW','VOLTAS','laps','', ''],['gradeW','UDM NOTA','grade','', ''],['consW','CONSISTÊNCIA','consistency','', ''],['deltaW','DELTA','delta','', ''],['raspW','RASPBERRY','rasp','', '']];
function defaultLayout(){let o={};widgets.forEach((w,i)=>o[w[0]]={x:10+(i%2)*145,y:205+Math.floor(i/2)*92,show:i<12,title:w[1]});o.speedGauge={x:10,y:10,show:true,title:'VELOCIDADE'};o.rpmGauge={x:205,y:10,show:true,title:'RPM'};return o}
function getLayout(){try{return {...defaultLayout(),...JSON.parse(localStorage.getItem(WKEY)||'{}')}}catch(e){return defaultLayout()}}
function saveModLayout(){let o={};document.querySelectorAll('.mw').forEach(el=>o[el.dataset.id]={x:parseInt(el.style.left)||0,y:parseInt(el.style.top)||0,show:!el.classList.contains('hide'),title:el.querySelector('.lab').textContent});localStorage.setItem(WKEY,JSON.stringify(o));if(typeof toast==='function')toast('Layout salvo')}
function cockpitValue(k){let a=(modLive&&modLive.analysis)||{};let map={speed:modLive.speed??modLive.velocidade??0,rpm:modLive.rpm??0,gear:modLive.gear??modLive.marcha??'N',maxSpeed:maxSpeed||modLive.velocidadeMaxima||0,fuel:modLive.fuel??modLive.combustivelPorcentagem??'--',throttle:modLive.throttle??modLive.acelerador??0,brake:modLive.brake??modLive.freio??0,best:a.best||modLive.melhorVolta||document.getElementById('bestLapCard')?.textContent||'--',last:a.last||modLive.ultimaVolta||document.getElementById('lastLapCard')?.textContent||'--',total:a.total||document.getElementById('totalTimeCard')?.textContent||'--',avg:a.average||document.getElementById('avgTimeCard')?.textContent||'--',laps:a.laps??lapRecords?.length??0,grade:a.grade||document.getElementById('grade')?.textContent||'--',consistency:a.consistency||document.getElementById('consistency')?.textContent||'--',delta:a.deltaBest||document.getElementById('deltaBest')?.textContent||'--',rasp:document.getElementById('raspStatus')?.textContent||'--'};return map[k]??'--'}
function buildCockpit(){let c=document.getElementById('cockpit');if(!c)return;let lay=getLayout();c.innerHTML=widgets.map(w=>{let l=lay[w[0]]||{};return '<div class="mw '+w[4]+' '+(l.show?'':'hide')+'" data-id="'+w[0]+'" data-key="'+w[2]+'" style="left:'+(l.x||10)+'px;top:'+(l.y||10)+'px"><button class="editBtn">⚙</button><div class="lab">'+(l.title||w[1])+'</div><div class="val">--</div><div class="sub">'+w[3]+'</div></div>'}).join('');bindModWidgets();renderCockpitValues();buildWidgetList()}
function renderCockpitValues(){document.querySelectorAll('.mw').forEach(el=>{let v=cockpitValue(el.dataset.key);let val=el.querySelector('.val');if(val)val.textContent=v})}
function buildWidgetList(){let list=document.getElementById('widgetList');if(!list)return;let lay=getLayout();list.innerHTML=widgets.map(w=>'<label><input type="checkbox" data-wid="'+w[0]+'" '+((lay[w[0]]||{}).show?'checked':'')+'> '+w[1]+'</label>').join('');list.querySelectorAll('input').forEach(i=>i.onchange=()=>{let el=document.querySelector('.mw[data-id="'+i.dataset.wid+'"]');if(el)el.classList.toggle('hide',!i.checked);saveModLayout()})}
function bindModWidgets(){document.querySelectorAll('.mw').forEach(el=>{let sx=0,sy=0,ox=0,oy=0;el.onpointerdown=e=>{if(!modEdit||e.target.classList.contains('editBtn'))return;sx=e.clientX;sy=e.clientY;ox=parseInt(el.style.left)||0;oy=parseInt(el.style.top)||0;el.classList.add('drag');el.setPointerCapture(e.pointerId)};el.onpointermove=e=>{if(!el.classList.contains('drag'))return;el.style.left=Math.max(0,ox+e.clientX-sx)+'px';el.style.top=Math.max(0,oy+e.clientY-sy)+'px'};el.onpointerup=()=>{if(el.classList.contains('drag')){el.classList.remove('drag');saveModLayout()}};let b=el.querySelector('.editBtn');if(b)b.onclick=ev=>{ev.stopPropagation();let title=prompt('Nome do widget:',el.querySelector('.lab').textContent);if(title){el.querySelector('.lab').textContent=title;saveModLayout()}}})}
setTimeout(()=>{try{if(typeof showPage==='function')showPage('modPage');buildCockpit();let e=document.getElementById('editCockpitBtn'),w=document.getElementById('widgetsBtn'),s=document.getElementById('saveLayoutBtn'),r=document.getElementById('resetLayoutBtn'),d=document.getElementById('drawerClose');if(e)e.onclick=()=>{modEdit=!modEdit;document.getElementById('cockpit')?.classList.toggle('edit',modEdit);e.textContent=modEdit?'SAIR EDIÇÃO':'EDITAR'};if(w)w.onclick=()=>{document.getElementById('widgetDrawer').style.display='block';buildWidgetList()};if(d)d.onclick=()=>document.getElementById('widgetDrawer').style.display='none';if(s)s.onclick=saveModLayout;if(r)r.onclick=()=>{localStorage.removeItem(WKEY);buildCockpit();if(typeof toast==='function')toast('Layout resetado')}}catch(e){console.error(e)}},50);
`, 'Cockpit Modular V4 JS', 'js cockpit modular');

fs.writeFileSync(indexPath, html);
console.log('Patch GT7 Telemetria aplicado com sucesso.');
