const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join('www', 'index.html');
let html = fs.readFileSync(target, 'utf8');

if (!html.includes('href="dashboard-vertical-fuel.css"')) {
  html = html.replace('</head>', '<link rel="stylesheet" href="dashboard-vertical-fuel.css"></head>');
}
if (!html.includes('src="dashboard-vertical-fuel.js"')) {
  html = html.replace('</body>', '<script src="dashboard-vertical-fuel.js"></script></body>');
}

html = html.replace(
  /(<section id="dash" class="page on">[\s\S]*?<div class="grid)(")/,
  '$1 dashGrid$2'
);

html = html.replace(
  '<div class="card tile"><div class="label">ÚLTIMA VOLTA</div><div id="last" class="val">--</div></div>',
  '<div class="card tile fuelTile"><div class="label">COMBUSTÍVEL</div><div id="fuelDash" class="val cyan">--%</div><div id="fuelMiniMarker" class="fuelMiniMarker"></div><div class="fuelMiniScale"><b>0</b><span>%</span><b>100</b></div><span id="last" hidden></span></div>'
);

const oldHero = '<div class="card hero"><div class="box"><div class="label">VELOCIDADE</div><div id="speed" class="speed">0</div><div class="unit">KM/H</div></div><div class="box gearBox"><div class="label">MARCHA</div><div id="gear" class="gear">N</div></div></div>';
const newHero = '<div class="hero heroSeparated"><div class="box card heroMetricCard"><div class="label">VELOCIDADE</div><div id="speed" class="speed">0</div><div class="unit">KM/H</div></div><div class="box gearBox card heroMetricCard"><div class="label">MARCHA</div><div id="gear" class="gear">N</div></div></div>';
if (html.includes(oldHero)) html = html.replace(oldHero, newHero);

const oldPack = '<div class="card pack"><div class="packTop"><div><div class="label">RPM</div><div id="rpmTop" class="rpmTop">0</div></div><div><div class="label">TEMPO TOTAL</div><div id="total" class="time">00:00.000</div></div></div><div class="line"></div><div class="mt">VELOCIDADE</div><div id="marker" class="marker"></div><div class="scale"><b>0</b><span>KM/H</span><b>300</b></div></div>';
const newPack = '<div class="pack packSeparated"><div class="packTop packMetricsGrid"><div id="rpmMetricCard" class="card packMetricCard"><div class="label">RPM</div><div id="rpmTop" class="rpmTop">0</div></div><div id="totalTimeCard" class="card packMetricCard copyTimeCard" data-copy-label="Toque para copiar"><div class="label">TEMPO TOTAL</div><div id="total" class="time">00:00.000</div></div></div><div class="card speedGaugePanel"><div class="mt">VELOCIDADE</div><div id="marker" class="marker"></div><div class="scale"><b>0</b><span>KM/H</span><b>300</b></div></div></div>';
if (html.includes(oldPack)) html = html.replace(oldPack, newPack);

html = html.replace(
  '<div class="card tile"><div class="label">MELHOR VOLTA</div><div id="best" class="val">--</div></div>',
  '<div id="bestTimeCard" class="card tile copyTimeCard" data-copy-label="Toque para copiar"><div class="label">MELHOR VOLTA</div><div id="best" class="val">--</div></div>'
);

const oldUdm = '<div class="card tile wide"><div class="label">UDM NOTA</div><div id="udm" class="val cyan">--</div><div id="udmTxt" class="sub">Aguardando voltas válidas.</div></div>';
const tyrePanel = '<div class="card tile wide udmFullCard"><div class="label">UDM NOTA</div><div id="udm" class="val cyan">--</div><div id="udmTxt" class="sub">Aguardando voltas válidas.</div></div><div id="tyreTempsPanel" class="tyreTempsPanel"><div class="tyrePanelTitle">TEMPERATURA DOS PNEUS</div><div class="tyreGrid"><div class="tyreTempCard"><div class="label">DIANTEIRO ESQ.</div><div id="tyreTempFL" class="tyreTempValue">--</div><div class="tyreTempBar"><i id="tyreBarFL"></i></div></div><div class="tyreTempCard"><div class="label">DIANTEIRO DIR.</div><div id="tyreTempFR" class="tyreTempValue">--</div><div class="tyreTempBar"><i id="tyreBarFR"></i></div></div><div class="tyreTempCard"><div class="label">TRASEIRO ESQ.</div><div id="tyreTempRL" class="tyreTempValue">--</div><div class="tyreTempBar"><i id="tyreBarRL"></i></div></div><div class="tyreTempCard"><div class="label">TRASEIRO DIR.</div><div id="tyreTempRR" class="tyreTempValue">--</div><div class="tyreTempBar"><i id="tyreBarRR"></i></div></div></div></div>';
if (html.includes(oldUdm)) html = html.replace(oldUdm, tyrePanel);

html = html.replace(/<div id="identityCarCard"[\s\S]*?<\/div><\/div>/g, '');
html = html.replace(/<div id="identityTrackCard"[\s\S]*?<\/div><\/div>/g, '');

const required = [
  'class="hero heroSeparated"',
  'class="box card heroMetricCard"',
  'id="rpmMetricCard"',
  'id="totalTimeCard"',
  'class="card speedGaugePanel"',
  'id="bestTimeCard"',
  'id="fuelDash"',
  'id="fuelMiniMarker"',
  'id="tyreTempsPanel"',
  'id="tyreTempFL"',
  'id="tyreTempRR"',
  'href="dashboard-vertical-fuel.css"',
  'src="dashboard-vertical-fuel.js"'
];
for (const marker of required) {
  if (!html.includes(marker)) throw new Error(`Dashboard estático incompleto: ${marker}`);
}
if (html.includes('<div class="label">ÚLTIMA VOLTA</div>')) throw new Error('Última volta ainda visível');

fs.writeFileSync(target, html);
console.log('Dashboard estático aplicado: cards separados, cópia de tempos e pneus');
