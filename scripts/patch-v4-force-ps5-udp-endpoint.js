const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const bridgePath = path.join(root, 'www', 'bridge-v408.js');
const indexPath = path.join(root, 'www', 'index.html');

let bridge = fs.readFileSync(bridgePath, 'utf8');
let index = fs.readFileSync(indexPath, 'utf8');

// Configuração definitiva do PS5/UDP.
bridge = bridge
  .replace(/const DEFAULT_PS5\s*=\s*['"][^'"]+['"];?/g, "const DEFAULT_PS5 = '192.168.1.81';")
  .replace(/const PS5_UDP_PORT\s*=\s*\d+;?/g, 'const PS5_UDP_PORT = 33740;')
  .replace(/const PS5_UDP_ENDPOINT\s*=\s*[^;]+;?/g, "const PS5_UDP_ENDPOINT = '192.168.1.81:33740';")
  .replaceAll('192.168.1.71', '192.168.1.81')
  .replaceAll('192.168.1.68', '192.168.1.81');

if (!bridge.includes('const PS5_UDP_PORT = 33740;')) {
  bridge = bridge.replace(
    "const DEFAULT_PS5 = '192.168.1.81';",
    "const DEFAULT_PS5 = '192.168.1.81';\n  const PS5_UDP_PORT = 33740;\n  const PS5_UDP_ENDPOINT = '192.168.1.81:33740';"
  );
}

// Garante que os payloads enviados ao Raspberry incluam a porta UDP correta.
bridge = bridge.replace(
  /\{ ps5Ip: ip, ps5_ip: ip, ip \}/g,
  '{ ps5Ip: ip, ps5_ip: ip, ip, udpPort: PS5_UDP_PORT, receivePort: PS5_UDP_PORT, endpoint: ip + ":" + PS5_UDP_PORT }'
);
bridge = bridge.replace(
  /\{ ps5Ip: ip, ip \}/g,
  '{ ps5Ip: ip, ip, udpPort: PS5_UDP_PORT, receivePort: PS5_UDP_PORT, endpoint: ip + ":" + PS5_UDP_PORT }'
);
bridge = bridge.replace(
  /\{ ip \}/g,
  '{ ip, udpPort: PS5_UDP_PORT, receivePort: PS5_UDP_PORT, endpoint: ip + ":" + PS5_UDP_PORT }'
);

// Expõe o endpoint no diagnóstico e na API pública do app.
bridge = bridge.replace(
  'udpReceivePort: 33740,',
  'udpReceivePort: PS5_UDP_PORT,\n      ps5UdpEndpoint: getPs5Ip() + ":" + PS5_UDP_PORT,'
);
bridge = bridge.replace(
  'get ps5Ip(){ return getPs5Ip(); }',
  'get ps5Ip(){ return getPs5Ip(); },\n    get ps5UdpEndpoint(){ return getPs5Ip() + ":" + PS5_UDP_PORT; }'
);

index = index
  .replaceAll('192.168.1.71', '192.168.1.81')
  .replaceAll('192.168.1.68', '192.168.1.81');

if (!bridge.includes("const DEFAULT_PS5 = '192.168.1.81'")) throw new Error('IP do PS5 não aplicado');
if (!bridge.includes('const PS5_UDP_PORT = 33740')) throw new Error('Porta UDP 33740 não aplicada');
if (!bridge.includes("const PS5_UDP_ENDPOINT = '192.168.1.81:33740'")) throw new Error('Endpoint UDP não aplicado');
if (bridge.includes('192.168.1.71') || bridge.includes('192.168.1.68')) throw new Error('IP antigo ainda presente na Bridge');

fs.writeFileSync(bridgePath, bridge);
fs.writeFileSync(indexPath, index);
console.log('PS5 UDP configurado definitivamente em 192.168.1.81:33740');
