const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const marker = '/* Advanced GT7 UDP / MoTeC widgets */';
if (!html.includes(marker)) {
  const js = `
${marker}
setTimeout(() => {
  try {
    const extra = [
      ['boostW','BOOST','advanced.boost','bar',''],
      ['oilPW','ÓLEO PRESSÃO','advanced.oilPressure','bar',''],
      ['oilTW','ÓLEO TEMP','advanced.oilTemp','°C',''],
      ['waterTW','ÁGUA TEMP','advanced.waterTemp','°C',''],
      ['tyreFLW','PNEU FL','advanced.tyreTemp.FL','°C',''],
      ['tyreFRW','PNEU FR','advanced.tyreTemp.FR','°C',''],
      ['tyreRLW','PNEU RL','advanced.tyreTemp.RL','°C',''],
      ['tyreRRW','PNEU RR','advanced.tyreTemp.RR','°C',''],
      ['gSwayW','G LATERAL','advanced.gForce.sway','G',''],
      ['gHeaveW','G VERTICAL','advanced.gForce.heave','G',''],
      ['gSurgeW','G LONG.','advanced.gForce.surge','G',''],
      ['steerW','DIREÇÃO','advanced.steeringAngularVelocity','rad/s',''],
      ['clutchW','EMBREAGEM','advanced.clutch','%',''],
      ['surfaceW','SUPERFÍCIE','advanced.surfaceType','',''],
      ['categoryW','CATEGORIA','advanced.carCategory','',''],
      ['carCodeW','CAR CODE','advanced.carCode','',''],
      ['packetW','PACKET','advanced.packetType','',''],
      ['suggestW','MARCHA SUG.','marchaSugerida','','']
    ];
    const getPath = (obj, p) => p.split('.').reduce((a,k)=>a && a[k] !== undefined ? a[k] : undefined, obj);
    if (Array.isArray(window.widgets)) {
      extra.forEach(w => { if (!window.widgets.some(x => x[0] === w[0])) window.widgets.push(w); });
    } else if (typeof widgets !== 'undefined' && Array.isArray(widgets)) {
      extra.forEach(w => { if (!widgets.some(x => x[0] === w[0])) widgets.push(w); });
    }
    const oldCockpitValue = window.cockpitValue || (typeof cockpitValue !== 'undefined' ? cockpitValue : null);
    window.cockpitValue = function(k) {
      if (String(k).startsWith('advanced.')) {
        const v = getPath(window.modLive || modLive || {}, k);
        return v === undefined || v === null || v === '' ? '--' : v;
      }
      if (k === 'marchaSugerida') return (window.modLive || modLive || {}).marchaSugerida || '--';
      return oldCockpitValue ? oldCockpitValue(k) : '--';
    };
    if (typeof buildCockpit === 'function') buildCockpit();
  } catch(e) { console.error('advanced widgets', e); }
}, 120);
`;
  html = html.replace('</script>', js + '\n</script>');
}

fs.writeFileSync(indexPath, html);
console.log('Patch advanced widgets aplicado.');
