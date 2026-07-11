const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join('www', 'index.html');
let html = fs.readFileSync(target, 'utf8');

html = html.replace(
  /sectionMax\s*=\s*n\(localStorage\.gt7_section_max\s*\|\|\s*0\)/g,
  'sectionMax=Number(localStorage.gt7_section_max||0)'
);

html = html.replace(
  /q\('\.nb'\)\.forEach\(b=>b\.onclick=\(\)=>\{q\('\.nb'\)\.forEach\(x=>x\.classList\.remove\('on'\)\);b\.classList\.add\('on'\);q\('\.page'\)\.forEach\(p=>p\.classList\.remove\('on'\)\);\$\(b\.dataset\.p\)\.classList\.add\('on'\)\}\);/g,
  "q('.nb').forEach(b=>b.addEventListener('click',()=>{q('.nb').forEach(x=>x.classList.remove('on'));b.classList.add('on');q('.page').forEach(p=>p.classList.remove('on'));const page=$(b.dataset.p);if(page)page.classList.add('on')}));"
);

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
if (!inlineScripts.length) throw new Error('Script principal não encontrado em ' + target);
for (const match of inlineScripts) new Function(match[1]);

if (/sectionMax\s*=\s*n\(localStorage\.gt7_section_max/.test(html)) {
  throw new Error('Inicialização inválida de sectionMax ainda presente');
}

const requiredPages = ['dash', 'atrib', 'voltas', 'secao', 'telemetria', 'set'];
for (const id of requiredPages) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Página obrigatória ausente: ${id}`);
  if (!html.includes(`data-p="${id}"`)) throw new Error(`Botão de navegação ausente: ${id}`);
}

const sourceMarkers = [
  'id="speed"', 'id="gear"', 'id="rpmTop"', 'id="total"',
  'id="thr"', 'id="brk"', 'id="best"', 'id="fuelDash"',
  'id="valid"', 'id="max"', 'id="udm"',
  'id="tyreTempFL"', 'id="tyreTempFR"', 'id="tyreTempRL"', 'id="tyreTempRR"'
];
for (const marker of sourceMarkers) {
  if (!html.includes(marker)) throw new Error(`Fonte de telemetria ausente: ${marker}`);
}

const externalFiles = [
  ['telemetry-bc.js', 'src="telemetry-bc.js"'],
  ['telemetry-bc.css', 'href="telemetry-bc.css"'],
  ['identity-track.js', 'src="identity-track.js"'],
  ['identity-track.css', 'href="identity-track.css"'],
  ['navigation-guard.js', 'src="navigation-guard.js"'],
  ['dashboard-vertical-fuel.js', 'src="dashboard-vertical-fuel.js"'],
  ['dashboard-vertical-fuel.css', 'href="dashboard-vertical-fuel.css"'],
  ['rpm-graph.js', 'src="rpm-graph.js"'],
  ['rpm-graph.css', 'href="rpm-graph.css"'],
  ['dashboard-art-background.js', 'src="dashboard-art-background.js"'],
  ['dashboard-art-background.css', 'href="dashboard-art-background.css"'],
  ['cockpit-bg-1.js', 'src="cockpit-bg-1.js"'],
  ['cockpit-bg-2.js', 'src="cockpit-bg-2.js"'],
  ['cockpit-bg-3.js', 'src="cockpit-bg-3.js"'],
  ['cockpit-functional-skin.js', 'src="cockpit-functional-skin.js"'],
  ['cockpit-functional-skin.css', 'href="cockpit-functional-skin.css"']
];
for (const [fileName, marker] of externalFiles) {
  if (!html.includes(marker)) throw new Error(`Referência ausente no HTML: ${marker}`);
  const filePath = path.join(path.dirname(target), fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Arquivo obrigatório ausente: ${fileName}`);
  if (fileName.endsWith('.js')) new Function(fs.readFileSync(filePath, 'utf8'));
}

const telemetryCode = fs.readFileSync(path.join(path.dirname(target), 'telemetry-bc.js'), 'utf8');
if (!telemetryCode.includes("page.classList.contains('on')")) {
  throw new Error('Telemetria ainda renderiza quando a janela está fechada');
}

const identityCode = fs.readFileSync(path.join(path.dirname(target), 'identity-track.js'), 'utf8');
if (identityCode.includes('    enableFullscreen();')) {
  throw new Error('Fullscreen web ainda consome o primeiro toque');
}

const fuelCode = fs.readFileSync(path.join(path.dirname(target), 'dashboard-vertical-fuel.js'), 'utf8');
for (const marker of ['fuelPercent', 'active <= 3', "classList.toggle('fuelLow'", 'renderTyres']) {
  if (!fuelCode.includes(marker)) throw new Error(`Telemetria auxiliar incompleta: ${marker}`);
}

const rpmCode = fs.readFileSync(path.join(path.dirname(target), 'rpm-graph.js'), 'utf8');
for (const marker of ['rpmBarFill', 'maxAlertRpm', 'style.width']) {
  if (!rpmCode.includes(marker)) throw new Error(`Fonte do RPM incompleta: ${marker}`);
}

const backgroundCode = fs.readFileSync(path.join(path.dirname(target), 'dashboard-art-background.js'), 'utf8');
for (const marker of ['__cockpitBgChunks', "chunks.join('')", '--cockpit-art']) {
  if (!backgroundCode.includes(marker)) throw new Error(`Carregador da arte incompleto: ${marker}`);
}

const skinCode = fs.readFileSync(path.join(path.dirname(target), 'cockpit-functional-skin.js'), 'utf8');
for (const marker of [
  'dashLegacySources', 'cockpitFunctionalSkin', 'skinSpeed', 'skinGear',
  'skinRpmArc', 'skinRpmArcFill', 'skinRpmArcValue', 'setRpmArc',
  'id="skinTotalBox" class="skinMetricBox skinRight skinRow3 clickable"',
  'id="skinFuelBox" class="skinMetricBox skinFuelBox"',
  'skinFuelBar', 'skinTyreBarFL',
  'setInterval(syncSkin, 160)', "copyValue('total'", "copyValue('best'"
]) {
  if (!skinCode.includes(marker)) throw new Error(`Interface funcional incompleta: ${marker}`);
}
if (skinCode.includes('id="skinRpmBar"') || skinCode.includes('skinMetricBox skinLeft skinRow1')) {
  throw new Error('Card retangular de RPM ainda presente na interface visível');
}

const skinCss = fs.readFileSync(path.join(path.dirname(target), 'cockpit-functional-skin.css'), 'utf8');
for (const marker of [
  '#dashLegacySources{display:none!important}',
  'background-image:var(--cockpit-art)',
  '.cockpitFunctionalSkin::after', '.skinMetricBox',
  '.skinRpmArc', '.skinRpmArcFill', '.skinRpmArcGlow',
  '.skinFuelBox{left:50.5%;top:73.3%',
  '.skinFuelFill', '.skinTyreBox', '.skinTyreTitle'
]) {
  if (!skinCss.includes(marker)) throw new Error(`Composição da interface sobre a arte incompleta: ${marker}`);
}

for (const marker of ["ok:Boolean(g(L,'packet.connected'", "('OK · '+f.ver)", "'PS5 WAIT'", "'BRIDGE OFF'"]) {
  if (!html.includes(marker)) throw new Error(`Correção de conexão ausente: ${marker}`);
}

if (html.includes('src="cockpit-bg-tiny.js"')) throw new Error('Fundo reduzido antigo ainda carregado');
if (!html.includes('viewport-fit=cover')) throw new Error('Viewport fullscreen ausente');

fs.writeFileSync(target, html);
console.log('RPM em arco, tempo total e combustível reposicionados e validados no APK:', target);
