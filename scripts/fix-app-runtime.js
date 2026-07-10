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

const externalTelemetry = path.join(path.dirname(target), 'telemetry-bc.js');
if (!fs.existsSync(externalTelemetry)) throw new Error('Arquivo telemetry-bc.js ausente');
new Function(fs.readFileSync(externalTelemetry, 'utf8'));

fs.writeFileSync(target, html);
console.log('Runtime, navegação e Telemetria externa validados:', target);
