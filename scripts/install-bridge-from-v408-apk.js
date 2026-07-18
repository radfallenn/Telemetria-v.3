const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const indexPath=path.join(root,'www','index.html');
const bridgePath=path.join(root,'www','bridge-v408.js');
let html=fs.readFileSync(indexPath,'utf8');
if(!fs.existsSync(bridgePath))throw new Error('bridge-v408.js não encontrado');

const markers=[
 'V4 FIXED NETWORK 8788 PS5 71',
 'V4 PERSISTENT BRIDGE SINGLE OWNER',
 'V4 BRIDGE AUDIT SINGLE NATIVE CONTROLLER'
];
for(const marker of markers){
 const escaped=marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 html=html.replace(new RegExp('<script>[\\s\\S]*?\\/\\* '+escaped+' \\*\\/[\\s\\S]*?<\\/script>','g'),'');
}

const bridgeScriptTag=/<script\b(?=[^>]*\bsrc\s*=\s*["'][^"']*bridge-v408\.js(?:[?#][^"']*)?["'])[^>]*>\s*<\/script>\s*/gi;
html=html.replace(bridgeScriptTag,'\n');
html=html.replaceAll('http://192.168.1.70:8787','http://192.168.1.70:8788');
html=html.replaceAll('192.168.1.68','192.168.1.81');
html=html.replaceAll('192.168.1.71','192.168.1.81');

html=html.replace(
 /\$\('bridgeUrl'\)\.value=localStorage\.getItem\('gt7_bridge_url'\)[\s\S]*?timer=setInterval\(poll,700\);/,
 "$ ('bridgeUrl')".replace(' ','')+".value='http://192.168.1.70:8788';$('ps5Ip').value=localStorage.getItem('gt7_ps5_ip')||'192.168.1.81';renderSegments(0);renderFuel(0);"
);
html=html.replace(/poll\(\);\s*timer=setInterval\(poll,700\);/g,'');
html=html.replace(/timer=setInterval\(poll,700\);/g,'');
html=html.replace('</body>','<script src="bridge-v408.js"></script>\n</body>');

const installedBridgeTags=html.match(bridgeScriptTag)||[];
if(installedBridgeTags.length!==1)throw new Error('Referência duplicada da Bridge: '+installedBridgeTags.length+' tags');
if(html.includes('http://192.168.1.70:8787')||html.includes('192.168.1.68')||html.includes('192.168.1.71'))throw new Error('Configuração antiga ainda presente');
fs.writeFileSync(indexPath,html);
console.log('Conexão GT7 instalada: Bridge 192.168.1.70:8788 / PS5 padrão 192.168.1.81');
