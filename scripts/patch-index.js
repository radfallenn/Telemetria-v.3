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

// Tempo total: soma voltas registradas quando existem; se o Bridge ja entregar
// tempo total fechado, usa como fallback. Nao usa cronometro corrente.
replaceOrFail(
  /set\('totalTimeCard',lapRecords\.length\?fmtMs\(totalMs\(\)\):keep\('total',n\.total\)\);/,
  "set('totalTimeCard',lapRecords.length?fmtMs(totalMs()):(good(n.total)?keep('total',n.total):'--'));",
  'tempo total por voltas concluidas com fallback bridge'
);

// Voltas: se o app ainda nao conseguiu montar lapRecords, usa a contagem do Bridge.
// Como no GT7 a contagem registrada ja inicia em 1, corrigida = registrada - 1.
replaceOrFail(
  /set\('correctedLaps',Math\.max\(0,lapRecords\.length-1\)\);set\('rLaps',Math\.max\(0,lapRecords\.length-1\)\);/,
  "const visibleLaps=lapRecords.length?Math.max(0,lapRecords.length-1):Math.max(0,(n.bridgeLaps||n.laps||0)-1);set('correctedLaps',visibleLaps);set('rLaps',visibleLaps);",
  'voltas corrigidas com fallback bridge'
);

// Se o Bridge enviar array de voltas prontas, importa automaticamente para lapRecords.
replaceOrFail(
  /function addLapIfNeeded\(d,n\)\{if\(!sessionActive\|\|n\.speed<2\)return;const ms=parseMs\(n\.last\);const token=n\.bridgeLaps\+':'\+ms;if\(validLap\(ms\)&&token!==lastLapToken\)\{lastLapToken=token;if\(!lapRecords\.some\(x=>x\.ms===ms&&x\.token===token\)\)\{lapRecords\.push\(\{ms,token,at:Date\.now\(\),speed:n\.speed,max:maxSpeed\}\);if\(lapRecords\.length>100\)lapRecords=lapRecords\.slice\(-100\);localStorage\.setItem\(K\.laps,JSON\.stringify\(lapRecords\)\);updateRanking\(ms\)\}\}\}/,
  "function addLapIfNeeded(d,n){let arr=Array.isArray(d.lapTimes)?d.lapTimes:(Array.isArray(d.voltas)?d.voltas:[]);arr.forEach((x,i)=>{let raw=typeof x==='object'?(x.time??x.tempo??x.ms??x.lap):x;let ms=parseMs(raw);let token='arr:'+i+':'+ms;if(validLap(ms)&&!lapRecords.some(v=>v.token===token||Math.abs(v.ms-ms)<250)){lapRecords.push({ms,token,at:Date.now(),speed:n.speed,max:maxSpeed});updateRanking(ms)}});if(lapRecords.length>100)lapRecords=lapRecords.slice(-100);if(arr.length)localStorage.setItem(K.laps,JSON.stringify(lapRecords));if(!sessionActive||n.speed<2)return;const ms=parseMs(n.last);const token=n.bridgeLaps+':'+ms;if(validLap(ms)&&token!==lastLapToken){lastLapToken=token;if(!lapRecords.some(x=>x.ms===ms&&x.token===token)){lapRecords.push({ms,token,at:Date.now(),speed:n.speed,max:maxSpeed});if(lapRecords.length>100)lapRecords=lapRecords.slice(-100);localStorage.setItem(K.laps,JSON.stringify(lapRecords));updateRanking(ms)}}}",
  'importar voltas do bridge quando disponiveis'
);

// Garante que o zerar limpe tambem totais e medias imediatamente.
replaceOrFail(
  /set\('correctedLaps',0\);set\('rLaps',0\);renderLaps\(\);renderUDM\(\);toast\('Tudo zerado, seções salvas mantidas'\)\}/,
  "set('correctedLaps',0);set('rLaps',0);set('totalTimeCard','--');set('rTotal','--');set('avgTimeCard','--');set('rAvg','--');set('lastLapCard','--');set('rLast','--');set('bestLapCard','--');set('rBest','--');renderLaps();renderUDM();toast('Tudo zerado, seções salvas mantidas')}",
  'zerar numeros da tela'
);

fs.writeFileSync(indexPath, html);
console.log('Patch GT7 Telemetria aplicado com sucesso.');
