const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const marker = '/* Semicircle gauge V1 - open center */';

if (!html.includes(marker)) {
  const gaugeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 240" preserveAspectRatio="none">
  <defs>
    <linearGradient id="rpmGradient" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#28ff22"/>
      <stop offset="42%" stop-color="#7dff24"/>
      <stop offset="60%" stop-color="#ffe428"/>
      <stop offset="78%" stop-color="#ff9b16"/>
      <stop offset="100%" stop-color="#ff281d"/>
    </linearGradient>
    <filter id="blueGlow" x="-30%" y="-30%" width="160%" height="180%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="rpmGlow" x="-30%" y="-30%" width="160%" height="180%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Somente a circunferência: centro totalmente aberto e sem preenchimento. -->
  <path d="M 24 218 A 196 196 0 0 1 416 218" fill="none" stroke="#09243a" stroke-width="20" stroke-linecap="round" opacity="0.9"/>
  <path d="M 24 218 A 196 196 0 0 1 416 218" fill="none" stroke="#21bfff" stroke-width="2.4" stroke-linecap="round" opacity="0.95" filter="url(#blueGlow)"/>
  <path d="M 35 215 A 185 185 0 0 1 405 215" fill="none" stroke="#0d3856" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
  <path d="M 43 211 A 177 177 0 0 1 397 211" fill="none" stroke="url(#rpmGradient)" stroke-width="13" stroke-linecap="round" stroke-dasharray="16 5" filter="url(#rpmGlow)"/>
  <path d="M 52 207 A 168 168 0 0 1 388 207" fill="none" stroke="#dff9ff" stroke-width="1" stroke-linecap="round" stroke-dasharray="1 15" opacity="0.7"/>
</svg>`;

  const gaugeUri = `url("data:image/svg+xml,${encodeURIComponent(gaugeSvg)}")`;
  const css = `
${marker}
.hero,.rTach{
  position:relative!important;
  height:240px!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  overflow:visible!important;
  isolation:isolate;
}
.hero:before,.rTach:before{
  content:""!important;
  position:absolute!important;
  inset:0!important;
  border-radius:0!important;
  background-image:${gaugeUri}!important;
  background-position:center top!important;
  background-size:100% 100%!important;
  background-repeat:no-repeat!important;
  filter:none!important;
  opacity:1!important;
  pointer-events:none!important;
  z-index:0!important;
}
.hero:after,.rTach:after{display:none!important;content:none!important}
.hero.high,.rTach.high{animation:none!important;box-shadow:none!important}
.hero .center,.rTach .center{position:relative!important;z-index:2!important;transform:translateY(12px)}
`;

  html = html.replace('</style>', css + '\n</style>');
  fs.writeFileSync(indexPath, html);
  console.log('Conta-giros semicircular aberto aplicado.');
} else {
  console.log('Conta-giros semicircular ja aplicado.');
}
