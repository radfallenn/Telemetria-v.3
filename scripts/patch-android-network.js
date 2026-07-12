const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..','android','app','src','main');
const manifest=path.join(root,'AndroidManifest.xml');
const xmlDir=path.join(root,'res','xml');
const config=path.join(xmlDir,'network_security_config.xml');
if(!fs.existsSync(manifest))throw new Error('AndroidManifest nao encontrado');
fs.mkdirSync(xmlDir,{recursive:true});
fs.writeFileSync(config,`<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>
`);
let m=fs.readFileSync(manifest,'utf8');
if(!m.includes('android:usesCleartextTraffic='))m=m.replace('<application','<application\n        android:usesCleartextTraffic="true"\n        android:networkSecurityConfig="@xml/network_security_config"');
else m=m.replace(/android:usesCleartextTraffic="[^"]*"/,'android:usesCleartextTraffic="true"');
if(!m.includes('android:networkSecurityConfig='))m=m.replace('<application','<application\n        android:networkSecurityConfig="@xml/network_security_config"');
fs.writeFileSync(manifest,m);
console.log('HTTP local liberado para Raspberry/Bridge V4.');
