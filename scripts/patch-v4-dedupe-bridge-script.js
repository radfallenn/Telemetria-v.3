'use strict';

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'www', 'index.html');
const canonicalTag = '<script src="bridge-v408.js"></script>';
const bridgeScriptTag = /<script\b(?=[^>]*\bsrc\s*=\s*["'][^"']*bridge-v408\.js(?:[?#][^"']*)?["'])[^>]*>\s*<\/script>\s*/gi;

let html = fs.readFileSync(indexPath, 'utf8');
const foundBefore = html.match(bridgeScriptTag) || [];

// Remove somente tags externas reais da Bridge. Menções em comentários, textos ou
// scripts de diagnóstico não são consideradas inclusões duplicadas.
html = html.replace(bridgeScriptTag, '\n');

if (!/<\/body>/i.test(html)) {
  throw new Error('Não foi possível localizar </body> para instalar a Bridge');
}

html = html.replace(/<\/body>/i, `${canonicalTag}\n</body>`);

const foundAfter = html.match(bridgeScriptTag) || [];
if (foundAfter.length !== 1) {
  throw new Error(`Falha ao normalizar a Bridge: ${foundAfter.length} tags encontradas`);
}

fs.writeFileSync(indexPath, html);
console.log(`OK: Bridge normalizada; ${foundBefore.length} tag(s) anterior(es), 1 tag final`);
