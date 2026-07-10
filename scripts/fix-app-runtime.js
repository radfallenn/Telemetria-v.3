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

const externalFiles = [
  ['telemetry-bc.js', 'src="telemetry-bc.js"'],
  ['telemetry-bc.css', 'href="telemetry-bc.css"'],
  ['identity-track.js', 'src="identity-track.js"'],
  ['identity-track.css', 'href="identity-track.css"'],
  ['navigation-guard.js', 'src="navigation-guard.js"'],
  ['dashboard-vertical-fuel.js', 'src="dashboard-vertical-fuel.js"'],
  ['dashboard-vertical-fuel.css', 'href="dashboard-vertical-fuel.css"']
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
if (!html.includes('class="grid dashGrid"')) throw new Error('Primeira página não está em coluna vertical');
if (!html.includes('id="fuelDash"') || !html.includes('id="fuelMiniMarker"')) throw new Error('Célula de combustível incompleta');
if (html.includes('<div class="label">ÚLTIMA VOLTA</div>')) throw new Error('Última volta ainda visível no dashboard');
if (!html.includes('id="last" hidden')) throw new Error('Compatibilidade com última volta oculta ausente');
if (!html.includes('viewport-fit=cover')) throw new Error('Viewport fullscreen ausente');

fs.writeFileSync(target, html);
console.log('Runtime, navegação, dashboard vertical, combustível e fullscreen validados:', target);
