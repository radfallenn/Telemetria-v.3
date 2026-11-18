const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const bridgeFile = path.join(root, 'www', 'bridge-v408.js');
const indexFile = path.join(root, 'www', 'index.html');
const target = 'http://192.168.1.70:8788';
const oldUrls = ['192.168.1.70:8787', '192.168.1.70:8789', '192.168.1.81:8788'];

let bridge = fs.readFileSync(bridgeFile, 'utf8');
let html = fs.readFileSync(indexFile, 'utf8');
for (const oldUrl of oldUrls) {
  bridge = bridge.split(oldUrl).join('192.168.1.70:8788');
  html = html.split(oldUrl).join('192.168.1.70:8788');
}

const oldGetter = "function getBridgeUrl(){return normalizeBridgeUrl(localStorage.getItem('gt7_bridge_url')||DEFAULT_BRIDGE)}";
const newGetter = "function getBridgeUrl(){const saved=localStorage.getItem('gt7_bridge_url')||localStorage.getItem('gt7_bridge')||'';const stale=!saved||saved.includes('192.168.1.70:8787')||saved.includes('192.168.1.70:8789')||saved.includes('192.168.1.81:8788');const value=stale?DEFAULT_BRIDGE:normalizeBridgeUrl(saved);localStorage.setItem('gt7_bridge_url',value);localStorage.setItem('gt7_bridge',value);return value}";
if (bridge.includes(oldGetter)) bridge = bridge.replace(oldGetter, newGetter);
else if (!bridge.includes('const stale=!saved')) throw new Error('Migração de endereço salvo não foi instalada');

const oldFill = "q('setBridgeUrl').value=localStorage.getItem('gt7_bridge_url')||D.bridgeUrl;";
const newFill = "const saved=localStorage.getItem('gt7_bridge_url')||localStorage.getItem('gt7_bridge')||'';const stale=!saved||saved.includes('192.168.1.70:8787')||saved.includes('192.168.1.70:8789')||saved.includes('192.168.1.81:8788');const bridgeValue=stale?D.bridgeUrl:saved;q('setBridgeUrl').value=bridgeValue;localStorage.setItem('gt7_bridge_url',bridgeValue);localStorage.setItem('gt7_bridge',bridgeValue);";
if (html.includes(oldFill)) html = html.replace(oldFill, newFill);
html = html.replace('id="setBridgeUrl" inputmode="url"', 'id="setBridgeUrl" inputmode="url" value="' + target + '"');

fs.writeFileSync(bridgeFile, bridge);
fs.writeFileSync(indexFile, html);
if (!bridge.includes("const DEFAULT_BRIDGE = 'http://192.168.1.70:8788'")) throw new Error('Controlador não aponta para Bridge 8788');
if (!bridge.includes('const stale=!saved')) throw new Error('Migração de localStorage ausente');
if (!html.includes(target)) throw new Error('SET não aponta para Bridge 8788');
for (const oldUrl of oldUrls) {
  if (bridge.includes(oldUrl) || html.includes(oldUrl)) throw new Error('Endereço antigo permaneceu: ' + oldUrl);
}
console.log('OK: app usa Bridge Raspberry 192.168.1.70:8788; PS5 192.168.1.81; URLs antigas migradas.');
