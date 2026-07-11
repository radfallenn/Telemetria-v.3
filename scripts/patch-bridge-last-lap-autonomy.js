const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'bridge', 'server.cjs');
let source = fs.readFileSync(target, 'utf8');

if (source.includes("VERSION = '4.1.4-last-lap-fuel-autonomy'")) {
  console.log('Bridge: autonomia pela última volta já aplicada');
  process.exit(0);
}

source = source.replace(
  /const VERSION = '[^']+';/,
  "const VERSION = '4.1.4-last-lap-fuel-autonomy';"
);

source = source.replace(
  'let previousFuel = null;\nlet fuelConsumedSession = 0;',
  'let previousFuel = null;\nlet fuelAtLapStart = null;\nlet fuelLapStartNumber = null;\nlet lastLapFuelConsumed = null;\nlet fuelLapsRemaining = null;\nlet fuelConsumedSession = 0;'
);

source = source.replace(
  '    fuelConsumedLiters: 0,\n    laps: [],',
  '    fuelConsumedLiters: 0,\n    lastLapFuelConsumedLiters: null,\n    fuelLapsRemaining: null,\n    laps: [],'
);

source = source.replace(
  "    fuel: { levelLiters: null, capacityLiters: null, percent: null, consumedSessionLiters: 0 },",
  "    fuel: { levelLiters: null, capacityLiters: null, percent: null, consumedSessionLiters: 0, lastLapConsumedLiters: null, lapsRemaining: null, remainingFuelLaps: null },"
);

const replacement = `function updateSession(t) {
  currentSession.maxSpeedKmh=Math.max(currentSession.maxSpeedKmh,t.motion.speedKmh||0);
  currentSession.maxRpm=Math.max(currentSession.maxRpm,t.engine.rpm||0);
  const fuel=t.fuel.levelLiters;
  const lapNumber=Number(t.lap.count||0);

  if(Number.isFinite(fuel)){
    if(Number.isFinite(previousFuel)){
      const delta=previousFuel-fuel;
      if(delta>=0&&delta<5)fuelConsumedSession+=delta;
      if(fuel>previousFuel+0.25){
        fuelAtLapStart=fuel;
        fuelLapStartNumber=lapNumber;
        lastLapFuelConsumed=null;
        fuelLapsRemaining=null;
      }
    }
    previousFuel=fuel;
    if(!Number.isFinite(fuelAtLapStart)){
      fuelAtLapStart=fuel;
      fuelLapStartNumber=lapNumber;
    }
  }

  currentSession.fuelConsumedLiters=round(fuelConsumedSession,3);
  const last=t.lap.lastMs;
  if(last&&last>0&&last!==lastSeenLastLapMs){
    lastSeenLastLapMs=last;
    let usedLiters=null;
    if(Number.isFinite(fuel)&&Number.isFinite(fuelAtLapStart)){
      const used=fuelAtLapStart-fuel;
      if(used>0.001&&used<50){
        usedLiters=round(used,3);
        lastLapFuelConsumed=used;
        fuelLapsRemaining=round(fuel/used,2);
      }
      fuelAtLapStart=fuel;
      fuelLapStartNumber=lapNumber;
    }

    currentSession.laps.push({
      lap:currentSession.laps.length+1,
      ms:last,
      valid:true,
      maxSpeedKmh:currentSession.maxSpeedKmh,
      fuelConsumedLiters:usedLiters,
      fuelLapsRemaining,
      at:nowIso()
    });
    currentSession.lastLapMs=last;
    currentSession.bestLapMs=currentSession.bestLapMs==null?last:Math.min(currentSession.bestLapMs,last);
    currentSession.validLaps=currentSession.laps.length;
    currentSession.totalCompletedLapMs=currentSession.laps.reduce((a,x)=>a+x.ms,0);
    currentSession.averageLapMs=Math.round(currentSession.totalCompletedLapMs/currentSession.laps.length);
    saveState();
  }

  if(Number.isFinite(fuel)&&Number.isFinite(lastLapFuelConsumed)&&lastLapFuelConsumed>0.001){
    fuelLapsRemaining=round(fuel/lastLapFuelConsumed,2);
  }
  currentSession.lastLapFuelConsumedLiters=Number.isFinite(lastLapFuelConsumed)?round(lastLapFuelConsumed,3):null;
  currentSession.fuelLapsRemaining=Number.isFinite(fuelLapsRemaining)?fuelLapsRemaining:null;
}

function applyDecoded`;

source = source.replace(
  /function updateSession\(t\) \{[\s\S]*?\n\}\s*function applyDecoded/,
  replacement
);

source = source.replace(
  "  live.fuel={levelLiters:t.fuel.levelLiters,capacityLiters:t.fuel.capacityLiters,percent:t.fuel.percent,consumedSessionLiters:round(fuelConsumedSession,3)};",
  "  live.fuel={levelLiters:t.fuel.levelLiters,capacityLiters:t.fuel.capacityLiters,percent:t.fuel.percent,consumedSessionLiters:round(fuelConsumedSession,3),lastLapConsumedLiters:Number.isFinite(lastLapFuelConsumed)?round(lastLapFuelConsumed,3):null,lapsRemaining:Number.isFinite(fuelLapsRemaining)?fuelLapsRemaining:null,remainingFuelLaps:Number.isFinite(fuelLapsRemaining)?fuelLapsRemaining:null};"
);

source = source.replace(
  /function responseSession\(\)\{return \{\.\.\.currentSession,laps:currentSession\.laps\.slice\(-200\),maxSpeedKmh:round\(currentSession\.maxSpeedKmh,1\),fuelConsumedLiters:round\(fuelConsumedSession,3\)\};\}/,
  "function responseSession(){return {...currentSession,laps:currentSession.laps.slice(-200),maxSpeedKmh:round(currentSession.maxSpeedKmh,1),fuelConsumedLiters:round(fuelConsumedSession,3),lastLapFuelConsumedLiters:Number.isFinite(lastLapFuelConsumed)?round(lastLapFuelConsumed,3):null,fuelLapsRemaining:Number.isFinite(fuelLapsRemaining)?fuelLapsRemaining:null,remainingFuelLaps:Number.isFinite(fuelLapsRemaining)?fuelLapsRemaining:null};}"
);

source = source.replace(
  'currentSession=newSession();fuelConsumedSession=0;previousFuel=null;lastSeenLastLapMs=0;',
  'currentSession=newSession();fuelConsumedSession=0;previousFuel=null;fuelAtLapStart=null;fuelLapStartNumber=null;lastLapFuelConsumed=null;fuelLapsRemaining=null;lastSeenLastLapMs=0;'
);

const required = [
  "VERSION = '4.1.4-last-lap-fuel-autonomy'",
  'fuelAtLapStart',
  'lastLapFuelConsumed',
  'fuelLapsRemaining=round(fuel/lastLapFuelConsumed,2)',
  'lastLapConsumedLiters',
  'remainingFuelLaps'
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Bridge sem autonomia da última volta: ${marker}`);
}

for (const forbidden of ['fuelLapSamples', 'robustAverage', 'consumptionPerLapLiters']) {
  if (source.includes(forbidden)) throw new Error(`Média indevida encontrada: ${forbidden}`);
}

new Function(source);
fs.writeFileSync(target, source);
console.log('Bridge: autonomia = combustível atual / consumo da última volta');
