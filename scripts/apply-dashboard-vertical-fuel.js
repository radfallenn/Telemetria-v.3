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
  '<div class="card tile fuelTile"><div class="label">COMBUSTÍVEL</div><div id="fuelDash" class="val cyan">--</div><div id="fuelMiniMarker" class="fuelMiniMarker"></div><div class="fuelMiniScale"><b>0</b><span>%</span><b>100</b></div><span id="last" hidden></span></div>'
);

const required = [
  'class="grid dashGrid"',
  'id="fuelDash"',
  'id="fuelMiniMarker"',
  'id="last" hidden',
  'href="dashboard-vertical-fuel.css"',
  'src="dashboard-vertical-fuel.js"'
];

for (const marker of required) {
  if (!html.includes(marker)) throw new Error(`Dashboard vertical incompleto: ${marker}`);
}

if (html.includes('<div class="label">ÚLTIMA VOLTA</div>')) {
  throw new Error('A célula Última volta ainda está visível');
}

fs.writeFileSync(target, html);
console.log('Primeira página organizada verticalmente com combustível:', target);
