const fs = require('fs');
const path = require('path');

const htmlPath = process.argv[2] || path.join('www', 'index.html');
const root = path.dirname(htmlPath);
const html = fs.readFileSync(htmlPath, 'utf8');

const requiredRefs = [
  'href="custom-background.css"',
  'src="custom-background.js"'
];
for (const marker of requiredRefs) {
  if (!html.includes(marker)) throw new Error(`Opção de fundo ausente no HTML: ${marker}`);
}

const jsPath = path.join(root, 'custom-background.js');
const cssPath = path.join(root, 'custom-background.css');
if (!fs.existsSync(jsPath)) throw new Error('custom-background.js ausente');
if (!fs.existsSync(cssPath)) throw new Error('custom-background.css ausente');

const js = fs.readFileSync(jsPath, 'utf8');
new Function(js);
for (const marker of [
  'indexedDB.open',
  'accept="image/*"',
  'ESCOLHER IMAGEM',
  'REMOVER FUNDO',
  'compressImage',
  'saveBackground',
  'deleteBackground',
  '--cockpit-art',
  'customCockpitBackground'
]) {
  if (!js.includes(marker)) throw new Error(`Função de fundo incompleta: ${marker}`);
}

const css = fs.readFileSync(cssPath, 'utf8');
for (const marker of ['.customBgCard', '.customBgPreview', '.customBgButton', '.customCockpitBackground']) {
  if (!css.includes(marker)) throw new Error(`Estilo de fundo incompleto: ${marker}`);
}

console.log('Seletor de imagem de fundo validado: escolha, persistência e remoção');
