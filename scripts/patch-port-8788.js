const fs = require('fs');
const path = require('path');
const indexPath = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

html = html
  .replaceAll('http://IP_DO_RASPBERRY:8787', 'http://IP_DO_RASPBERRY:8788')
  .replaceAll('http://192.168.1.100:8787', 'http://192.168.1.100:8788')
  .replaceAll('http://192.168.1.70:8787', 'http://192.168.1.70:8788')
  .replaceAll('porta 8787', 'porta 8788')
  .replaceAll(':8787', ':8788');

// Migração para quem instalou APK anterior: se o app ficou preso no 8787 salvo no localStorage,
// troca automaticamente para 8788, mantendo o mesmo IP.
if (!html.includes('gt7_bridge_port_migration_8788')) {
  html = html.replace(
    '<script>',
    `<script>\n/* gt7_bridge_port_migration_8788 */\ntry {\n  const saved = localStorage.getItem('gt7_bridge');\n  if (!saved || saved.includes(':8787')) {\n    localStorage.setItem('gt7_bridge', (saved || 'http://192.168.1.70:8788').replace(':8787', ':8788'));\n  }\n} catch (e) {}\n`
  );
}

fs.writeFileSync(indexPath, html);
console.log('OK: Telemetria GT7 configurada para Bridge HTTP 8788');
