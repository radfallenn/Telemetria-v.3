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

html=html.replace(/\s*<script\s+src=["']bridge-v408\.js["']><\/script>\s*/ig,'\n');
html=html.replaceAll('http://192.168.1.70:8787','http://192.168.1.70:8788');
html=html.replaceAll('192.168.1.68','192.168.1.71');

html=html.replace(
 /\$\('bridgeUrl'\)\.value=localStorage\.getItem\('gt7_bridge_url'\)[\s\S]*?timer=setInterval\(poll,700\);/,
 "$('bridgeUrl').value='http://192.168.1.70:8788';$('ps5Ip').value='192.168.1.71';renderSegments(0);renderFuel(0);"
);

html=html.replace('</body>','<script src="bridge-v408.js"></script>\n</body>');
if(!html.includes('bridge-v408.js'))throw new Error('Bridge V4.08 não foi injetada');
if(html.includes('http://192.168.1.70:8787')||html.includes('192.168.1.68'))throw new Error('Configuração antiga ainda presente');
fs.writeFileSync(indexPath,html);
console.log('Bridge extraída do APK V4.08 instalada sem reescrever sua lógica.');
