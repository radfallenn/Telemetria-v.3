const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const xmlDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'xml');
const networkPath = path.join(xmlDir, 'network_security_config.xml');

if (!fs.existsSync(manifestPath)) {
  console.error('AndroidManifest.xml não encontrado. Execute npx cap add android antes.');
  process.exit(1);
}

let manifest = fs.readFileSync(manifestPath, 'utf8');

const permissions = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.WAKE_LOCK',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.RECEIVE_BOOT_COMPLETED'
];

for (const permission of permissions) {
  if (!manifest.includes(`android:name="${permission}"`)) {
    manifest = manifest.replace('<application', `    <uses-permission android:name="${permission}" />\n\n    <application`);
  }
}

if (!manifest.includes('android:usesCleartextTraffic="true"')) {
  manifest = manifest.replace('<application', '<application android:usesCleartextTraffic="true"');
}

if (!manifest.includes('android:networkSecurityConfig="@xml/network_security_config"')) {
  manifest = manifest.replace('<application', '<application android:networkSecurityConfig="@xml/network_security_config"');
}

fs.mkdirSync(xmlDir, { recursive: true });
fs.writeFileSync(networkPath, `<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n  <base-config cleartextTrafficPermitted="true">\n    <trust-anchors>\n      <certificates src="system" />\n      <certificates src="user" />\n    </trust-anchors>\n  </base-config>\n</network-security-config>\n`);
fs.writeFileSync(manifestPath, manifest);
console.log('Telemetria V4: AndroidManifest ajustado para rede local HTTP e permissões básicas.');
