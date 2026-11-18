const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const bridgeFile = path.join(root, 'www', 'bridge-v408.js');
const indexFile = path.join(root, 'www', 'index.html');
const from = '192.168.1.70:8789';
const to = '192.168.1.70:8788';

let bridge = fs.readFileSync(bridgeFile, 'utf8');
let html = fs.readFileSync(indexFile, 'utf8');
bridge = bridge.replace(/192\\.168\\.1\\.70:\\d+/g, to);\nbridge = bridge.replace(/192\\.168\\.1\\.81:8788/g, to);

// Migrate addresses persisted by previous APK versions. Updating the default
// alone is insufficient because Android WebView preserves localStorage.
const oldGetter = "function getBridgeUrl(){return normalizeBridgeUrl(localStorage.getItem('gt7_bridge_url')||DEFAULT_BRIDGE)}";
const newGetter = "function getBridgeUrl(){const saved=localStorage.getItem('gt7_bridge_url')||localStorage.getItem('gt7_bridge')||'';const stale=/^https?:\\/\\/192\\.168\\.1\\.(70:(8787|8789)|81:8788)\\/?$/i.test(saved);const value=stale||!saved?DEFAULT_BRIDGE:normalizeBridgeUrl(saved);localStorage.setItem('gt7_bridge_url',value);localStorage.setItem('gt7_bridge',value);return value}";
if (bridge.includes(oldGetter)) bridge = bridge.replace(oldGetter, newGetter);
else if (!bridge.includes("const stale=/^https?:")) throw new Error('Migração de endereço salvo não foi instalada no controlador');

const oldFill = "q('setBridgeUrl').value=localStorage.getItem('gt7_bridge_url')||D.bridgeUrl;";
const newFill = "const saved=localStorage.getItem('gt7_bridge_url')||localStorage.getItem('gt7_bridge')||'';const stale=/^https?:\\/\\/192\\.168\\.1\\.(70:(8787|8789)|81:8788)\\/?$/i.test(saved);const bridgeValue=stale||!saved?D.bridgeUrl:saved;q('setBridgeUrl').value=bridgeValue;localStorage.setItem('gt7_bridge_url',bridgeValue);localStorage.setItem('gt7_bridge',bridgeValue);";
if (html.includes(oldFill)) html = html.replace(oldFill, newFill);

fs.writeFileSync(bridgeFile, bridge);
fs.writeFileSync(indexFile, html);
if (!bridge.includes("const DEFAULT_BRIDGE = 'http://192.168.1.70:8788'")) throw new Error('Controlador não aponta para Bridge 8788');
if (!bridge.includes('const stale=')) throw new Error('Migração de localStorage ausente');
if (!html.includes('http://192.168.1.70:8788')) html = html.replace('</body>', '<!-- GT7_BRIDGE_URL=http://192.168.1.70:8788 -->\\n</body>');
if (html.includes(from)) throw new Error('Referência à porta antiga 8789');
console.log('OK: Bridge Raspberry 192.168.1.70:8788; PS5 192.168.1.81; endereços antigos migrados automaticamente.');
