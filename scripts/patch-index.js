const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

function patch(find, replace, label) {
  if (!html.includes(find)) throw new Error('Patch nao aplicado: ' + label);
  html = html.replace(find, replace);
  console.log('OK: ' + label);
}

patch(
  '<div class="lab">VOLTAS CORRIGIDAS</div><div class="val" id="correctedLaps">0</div><div class="sub">registros válidos - 1</div>',
  '<div class="lab">VOLTAS VÁLIDAS</div><div class="val" id="correctedLaps">0</div><div class="sub">voltas registradas</div>',
  'label voltas validas classico'
);

patch(
  '<div class="lab">VOLTAS</div><div class="val" id="rLaps">0</div>',
  '<div class="lab">VOLTAS VÁLIDAS</div><div class="val" id="rLaps">0</div>',
  'label voltas validas racing'
);

patch(
  "function avgMs(){if(!lapRecords.length)return 0;let arr=lapRecords.map(x=>x.ms);if(arr.length>=7)arr=arr.slice().sort((a,b)=>a-b).slice(3,-3);return arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):0}",
  "function avgMs(){let arr=lapRecords.map(x=>x.ms).filter(validLap);if(!arr.length)return 0;let cut=arr.length>=10?3:(arr.length>=5?2:0);let used=arr.slice().sort((a,b)=>a-b);if(cut>0&&used.length>(cut*2))used=used.slice(cut,-cut);return used.length?Math.round(used.reduce((a,b)=>a+b,0)/used.length):0}",
  'media filtrada'
);

patch(
  "set('totalTimeCard',lapRecords.length?fmtMs(totalMs()):keep('total',n.total));",
  "set('totalTimeCard',lapRecords.length?fmtMs(totalMs()):(good(n.total)?keep('total',n.total):'--'));",
  'tempo total fallback bridge'
);

patch(
  "set('correctedLaps',Math.max(0,lapRecords.length-1));set('rLaps',Math.max(0,lapRecords.length-1));",
  "const visibleLaps=lapRecords.length?lapRecords.length:Math.max(0,(n.bridgeLaps||n.laps||0));set('correctedLaps',visibleLaps);set('rLaps',visibleLaps);",
  'voltas validas sem subtrair'
);

patch(
  "set('correctedLaps',0);set('rLaps',0);renderLaps();renderUDM();toast('Tudo zerado, seções salvas mantidas')}",
  "set('correctedLaps',0);set('rLaps',0);set('totalTimeCard','--');set('rTotal','--');set('avgTimeCard','--');set('rAvg','--');set('lastLapCard','--');set('rLast','--');set('bestLapCard','--');set('rBest','--');renderLaps();renderUDM();toast('Tudo zerado, seções salvas mantidas')}",
  'zerar numeros'
);

fs.writeFileSync(indexPath, html);
console.log('Patch GT7 Telemetria aplicado com sucesso.');
