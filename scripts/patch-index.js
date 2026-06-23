const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

function replaceOrFail(pattern, replacement, label) {
  const next = html.replace(pattern, replacement);
  if (next === html) {
    throw new Error(`Patch nao aplicado: ${label}`);
  }
  html = next;
  console.log(`OK: ${label}`);
}

// Média correta:
// - 1 a 4 voltas: média simples, pois não há sobra após cortes.
// - 5 a 9 voltas: remove 2 melhores e 2 piores.
// - 10+ voltas: remove 3 melhores e 3 piores.
replaceOrFail(
  /function avgMs\(\)\{if\(!lapRecords\.length\)return 0;let arr=lapRecords\.map\(x=>x\.ms\);if\(arr\.length>=7\)arr=arr\.slice\(\)\.sort\(\(a,b\)=>a-b\)\.slice\(3,-3\);return arr\.length\?Math\.round\(arr\.reduce\(\(a,b\)=>a\+b,0\)\/arr\.length\):0\}/,
  "function avgMs(){let arr=lapRecords.map(x=>x.ms).filter(validLap);if(!arr.length)return 0;let cut=arr.length>=10?3:(arr.length>=5?2:0);let used=arr.slice().sort((a,b)=>a-b);if(cut>0&&used.length>(cut*2))used=used.slice(cut,-cut);return used.length?Math.round(used.reduce((a,b)=>a+b,0)/used.length):0}",
  'media filtrada por quantidade de voltas'
);

// Tempo Total deve ser apenas soma de voltas finalizadas/validas.
// Se nao existe volta registrada, fica zerado/-- e nao usa tempo corrente do Bridge.
replaceOrFail(
  /set\('totalTimeCard',lapRecords\.length\?fmtMs\(totalMs\(\)\):keep\('total',n\.total\)\);/,
  "set('totalTimeCard',lapRecords.length?fmtMs(totalMs()):'--');",
  'tempo total somente por voltas concluidas'
);

// Garante que o zerar limpe tambem totais e medias imediatamente.
replaceOrFail(
  /set\('correctedLaps',0\);set\('rLaps',0\);renderLaps\(\);renderUDM\(\);toast\('Tudo zerado, seções salvas mantidas'\)\}/,
  "set('correctedLaps',0);set('rLaps',0);set('totalTimeCard','--');set('rTotal','--');set('avgTimeCard','--');set('rAvg','--');set('lastLapCard','--');set('rLast','--');set('bestLapCard','--');set('rBest','--');renderLaps();renderUDM();toast('Tudo zerado, seções salvas mantidas')}",
  'zerar numeros da tela'
);

fs.writeFileSync(indexPath, html);
console.log('Patch GT7 Telemetria aplicado com sucesso.');
