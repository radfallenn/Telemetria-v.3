const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join('www', 'index.html');
let html = fs.readFileSync(target, 'utf8');

if (!html.includes('href="identity-track.css"')) {
  html = html.replace('</head>', '<link rel="stylesheet" href="identity-track.css"></head>');
}
if (!html.includes('src="identity-track.js"')) {
  html = html.replace('</body>', '<script src="identity-track.js"></script></body>');
}
if (!html.includes('src="navigation-guard.js"')) {
  html = html.replace('</body>', '<script src="navigation-guard.js"></script></body>');
}
if (!html.includes('viewport-fit=cover')) {
  html = html.replace('user-scalable=no', 'user-scalable=no,viewport-fit=cover');
}

for (const marker of ['href="identity-track.css"', 'src="identity-track.js"', 'src="navigation-guard.js"', 'viewport-fit=cover']) {
  if (!html.includes(marker)) throw new Error(`Falha ao aplicar identidade/fullscreen: ${marker}`);
}

fs.writeFileSync(target, html);
console.log('Identificação, fullscreen e navegação segura aplicados:', target);
