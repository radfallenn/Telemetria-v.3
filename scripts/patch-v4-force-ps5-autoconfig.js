const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','bridge-v408.js');
let js=fs.readFileSync(file,'utf8');
const MARK='V4 FORCE PS5 81 AUTOCONFIG';
if(js.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

js=js.replace(
  /async function configurePs5\(force = false\)\{[\s\S]*?\n  \}\n\n  function stopLegacy/,
`async function configurePs5(force = false){
    /* ${MARK} */
    const ip = getPs5Ip();
    if (!force && configuredPs5 === ip && Date.now() - lastPacketAt < 5000) return true;
    const body = { ps5Ip: ip, ps5_ip: ip, ip, host: ip, target: ip, heartbeatPort: 33739, receivePort: 33740 };
    const attempts = [
      ['POST','/api/config',body],
      ['POST','/api/settings',body],
      ['POST','/api/ps5',body],
      ['POST','/api/config/ps5',body],
      ['POST','/api/bridge/config',body],
      ['POST','/api/udp/config',body],
      ['POST','/api/udp/start',body],
      ['POST','/api/start',body],
      ['GET','/api/config?ps5Ip='+encodeURIComponent(ip),null],
      ['GET','/api/ps5?ip='+encodeURIComponent(ip),null]
    ];
    const errors=[];
    for (const [method,path,data] of attempts) {
      try {
        await http(path,{method,data,timeout:2200});
        configuredPs5=ip;
        window.__gt7Ps5Config={ok:true,path,ip,at:Date.now()};
        return true;
      } catch(error) { errors.push(path+': '+(error&&error.message||error)); }
    }
    window.__gt7Ps5Config={ok:false,ip,at:Date.now(),errors};
    return false;
  }

  function stopLegacy`);

if(!js.includes(MARK))throw new Error('configurePs5 não foi substituída');

js=js.replace(
  /paint\('ok'\);\n\s*configurePs5\(false\);\n\s*writeDiagnostic\(\);/,
  "paint('ok');\n      if (Date.now() - lastPacketAt >= 5000 || !configuredPs5) configurePs5(true);\n      writeDiagnostic();"
);

js=js.replace(
  /lastData\n\s*\}, null, 2\);/,
  "lastData,\n      ps5Configuration: window.__gt7Ps5Config || null\n    }, null, 2);"
);

fs.writeFileSync(file,js);
console.log('Configuração automática reforçada: PS5 192.168.1.81 / UDP 33739-33740.');
