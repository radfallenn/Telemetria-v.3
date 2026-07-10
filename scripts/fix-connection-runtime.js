const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join('www', 'index.html');
let html = fs.readFileSync(target, 'utf8');

const oldConnection = "ok:!!one(g(L,'packet.connected',null),g(L,'legacy.connected',null),g(H,'connectedToPs5',false))";
const newConnection = "ok:Boolean(g(L,'packet.connected',false)||g(L,'legacy.connected',false)||g(H,'connectedToPs5',false)||(n(g(L,'packet.ageMs',999999))<5000&&n(g(L,'packet.count',0))>0))";

if (html.includes(oldConnection)) html = html.replace(oldConnection, newConnection);

html = html.replace(
  "$('bridge').textContent=f.ok?'OK':'WAIT';",
  "$('bridge').textContent=f.ok?('OK · '+f.ver):('PS5 WAIT');"
);

html = html.replace(
  "catch(e){$('st').textContent='OFF';$('bridge').textContent='OFF';",
  "catch(e){$('st').textContent='OFF';$('bridge').textContent='BRIDGE OFF';"
);

if (!html.includes(newConnection)) throw new Error('Lógica de conexão real não foi aplicada');
if (!html.includes("('OK · '+f.ver)")) throw new Error('Pacote conectado não aparece no painel');
if (!html.includes("'PS5 WAIT'")) throw new Error('Estado PS5 WAIT não foi aplicado');

const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
for (const match of scripts) new Function(match[1]);

fs.writeFileSync(target, html);
console.log('Status real da Bridge e conexão PS5 corrigidos:', target);
