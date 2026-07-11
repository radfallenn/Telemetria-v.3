const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join('www', 'index.html');
let html = fs.readFileSync(target, 'utf8');

const section = `<section id="telemetria" class="page"><h2 class="sectionTitle">TELEMETRIA COMPLETA</h2><div class="telemetryHead"><input id="telemetrySearch" class="inp" placeholder="Buscar atributo"><div id="telemetryStatus" class="telemetryStatus">PACOTE --</div></div><div class="packetControls"><select id="packetSelect"><option value="B">Pacote B — volante e G-Force</option><option value="C" selected>Pacote C — superfície e geometria</option></select><button id="applyPacket" class="btn">SOLICITAR</button></div><div id="packetMessage" class="packetNote">O pacote C inclui os dados do pacote B e acrescenta superfície, ângulo das rodas, entre-eixos e categoria.</div><div id="telemetryAll"></div></section>`;

if (!html.includes('href="telemetry-bc.css"')) {
  html = html.replace('</head>', '<link rel="stylesheet" href="telemetry-bc.css"></head>');
}

if (!html.includes('id="telemetria"')) {
  html = html.replace('<section id="set" class="page">', `${section}<section id="set" class="page">`);
}

if (!html.includes('data-p="telemetria"')) {
  html = html.replace(
    '<button class="nb" data-p="set">⚙<br>SET</button>',
    '<button class="nb" data-p="telemetria">⌁<br>TELEMETRIA</button><button class="nb" data-p="set">⚙<br>SET</button>'
  );
}

html = html.replace('grid-template-columns:repeat(5,1fr)', 'grid-template-columns:repeat(6,1fr)');

if (!html.includes('src="telemetry-bc.js"')) {
  html = html.replace('</body>', '<script src="telemetry-bc.js"></script></body>');
}

const required = [
  'id="telemetria"',
  'data-p="telemetria"',
  'href="telemetry-bc.css"',
  'src="telemetry-bc.js"'
];
for (const marker of required) {
  if (!html.includes(marker)) throw new Error(`Falha ao aplicar Telemetria: ${marker}`);
}

fs.writeFileSync(target, html);
console.log('Página Telemetria B/C aplicada sem alterar o JavaScript principal:', target);
