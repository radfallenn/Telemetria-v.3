const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = ['www/bridge-v408.js', 'www/index.html'];
const from = '192.168.1.70:8789';
const to = '192.168.1.70:8788';
for (const relative of files) {
  const file = path.join(root, relative);
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes(from)) throw new Error(relative + ': endereço 8789 não encontrado; build interrompido para evitar APK inconsistente');
  source = source.split(from).join(to);
  fs.writeFileSync(file, source);
}
const bridge = fs.readFileSync(path.join(root, files[0]), 'utf8');
const html = fs.readFileSync(path.join(root, files[1]), 'utf8');
if (!bridge.includes("const DEFAULT_BRIDGE = 'http://192.168.1.70:8788'")) throw new Error('Controlador não aponta para Bridge 8788');
if (!html.includes('http://192.168.1.70:8788')) throw new Error('SET não aponta para Bridge 8788');
if (html.includes('192.168.1.70:8789') || bridge.includes('192.168.1.70:8789')) throw new Error('Referência à porta antiga 8789');
console.log('OK: APK alinhado à Bridge Raspberry 192.168.1.70:8788; PS5 192.168.1.81.');
