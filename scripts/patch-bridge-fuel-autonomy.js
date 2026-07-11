const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'bridge', 'server.cjs');
let source = fs.readFileSync(target, 'utf8');

if (source.includes("VERSION = '4.1.2-full-telemetry-fuel-autonomy'")) {
  console.log('Bridge: autonomia em voltas já aplicada');
  process.exit(0);
}

source = source.replace(
  "const VERSION = '4.1.1-full-telemetry-autofallback';",
  "const VERSION = '4.1.2-full-telemetry-fuel-autonomy';"
);

source = source.replace(
  'let previousFuel = null;\nlet fuelConsumedSession = 0;',
  'let previousFuel = null;\nlet fuelAtLapStart = null;\nlet fuelLapSamples = [];\nlet fuelConsumedSession = 0;'
);

source = source.replace(
  '    fuelConsumedLiters: 0,\n    laps: [],',
  '    fuelConsumedLiters: 0,\n    fuelPerLapLiters: null,\n    remainingLaps: null,\n    laps: [],'
);

source = source.replace(
  "    fuel: { levelLiters: null, capacityLiters: null, percent: null, consumedSessionLiters: 0 },",
  "    fuel: { levelLiters: null, capacityLiters: null, percent: null, consumedSessionLiters: 0, consumptionPerLapLiters: null, remainingLaps: null },"
);

const updateSessionReplacement = `function updateSession(t) {
  currentSession.maxSpeedKmh=Math.max(currentSession.maxSpeedKmh,t.motion.speedKmh||0);
  currentSession.maxRpm=Math.max(currentSession.maxRpm,t.engine.rpm||0);
  const fuel=t.fuel.levelLiters;

  if(Number.isFinite(fuel)){
    if(Number.isFinite(previousFuel)){
      const delta=previousFuel-fuel;
      if(delta>=0&&delta<5)fuelConsumedSession+=delta;
      if(fuel>previousFuel+0.25){
        fuelAtLapStart=fuel;
        fuelLapSamples=[];
      }
    }
    previousFuel=fuel;
    if(!Number.isFinite(fuelAtLapStart))fuelAtLapStart=fuel;
  }

  currentSession.fuelConsumedLiters=round(fuelConsumedSession,3);
  const last=t.lap.lastMs;
  if(last&&last>0&&last!==lastSeenLastLapMs){
    lastSeenLastLapMs=last;
    let fuelUsedLiters=null;
    if(Number.isFinite(fuel)&&Number.isFinite(fuelAtLapStart)){
      const used=fuelAtLapStart-fuel;
      if(used>=0.03&&used<=50){
        fuelUsedLiters=round(used,3);
        fuelLapSamples.push(used);
        if(fuelLapSamples.length>12)fuelLapSamples=fuelLapSamples.slice(-12);
      }
      fuelAtLapStart=fuel;
    }
    currentSession.laps.push({lap:currentSession.laps.length+1,ms:last,valid:true,maxSpeedKmh:currentSession.maxSpeedKmh,fuelUsedLiters,at:nowIso()});
    currentSession.lastLapMs=last;
    currentSession.bestLapMs=currentSession.bestLapMs==null?last:Math.min(currentSession.bestLapMs,last);
    currentSession.validLaps=currentSession.laps.length;
    currentSession.totalCompletedLapMs=currentSession.laps.reduce((a,x)=>a+x.ms,0);
    currentSession.averageLapMs=Math.round(currentSession.totalCompletedLapMs/currentSession.laps.length);
  }

  const samples=fuelLapSamples.filter(v=>Number.isFinite(v)&&v>=0.03&&v<=50).sort((a,b)=>a-b);
  const trimmed=samples.length>=5?samples.slice(1,-1):samples;
  let fuelPerLap=trimmed.length?trimmed.reduce((a,b)=>a+b,0)/trimmed.length:null;
  if(!Number.isFinite(fuelPerLap)&&currentSession.validLaps>0&&fuelConsumedSession>0.03){
    fuelPerLap=fuelConsumedSession/currentSession.validLaps;
  }
  currentSession.fuelPerLapLiters=Number.isFinite(fuelPerLap)?round(fuelPerLap,3):null;
  currentSession.remainingLaps=Number.isFinite(fuel)&&Number.isFinite(fuelPerLap)&&fuelPerLap>0.001?round(fuel/fuelPerLap,2):null;
  saveState();
}

function applyDecoded`;

source = source.replace(
  /function updateSession\(t\) \{[\s\S]*?\n\}\n\nfunction applyDecoded/,
  updateSessionReplacement
);

source = source.replace(
  "  live.fuel={levelLiters:t.fuel.levelLiters,capacityLiters:t.fuel.capacityLiters,percent:t.fuel.percent,consumedSessionLiters:round(fuelConsumedSession,3)};",
  "  live.fuel={levelLiters:t.fuel.levelLiters,capacityLiters:t.fuel.capacityLiters,percent:t.fuel.percent,consumedSessionLiters:round(fuelConsumedSession,3),consumptionPerLapLiters:currentSession.fuelPerLapLiters,remainingLaps:currentSession.remainingLaps};"
);

source = source.replace(
  /function responseSession\(\)\{return \{\.\.\.currentSession,laps:currentSession\.laps\.slice\(-200\),maxSpeedKmh:round\(currentSession\.maxSpeedKmh,1\),fuelConsumedLiters:round\(fuelConsumedSession,3\)\};\}/,
  "function responseSession(){return {...currentSession,laps:currentSession.laps.slice(-200),maxSpeedKmh:round(currentSession.maxSpeedKmh,1),fuelConsumedLiters:round(fuelConsumedSession,3),fuelPerLapLiters:currentSession.fuelPerLapLiters,remainingLaps:currentSession.remainingLaps};}"
);

source = source.replace(
  'currentSession=newSession();fuelConsumedSession=0;previousFuel=null;lastSeenLastLapMs=0;',
  'currentSession=newSession();fuelConsumedSession=0;previousFuel=null;fuelAtLapStart=null;fuelLapSamples=[];lastSeenLastLapMs=0;'
);

const required = [
  "VERSION = '4.1.2-full-telemetry-fuel-autonomy'",
  'fuelAtLapStart',
  'fuelLapSamples',
  'consumptionPerLapLiters',
  'remainingLaps',
  'fuelUsedLiters'
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Bridge sem autonomia: ${marker}`);
}

new Function(source);
fs.writeFileSync(target, source);
console.log('Bridge: autonomia em voltas e consumo por volta aplicados');
