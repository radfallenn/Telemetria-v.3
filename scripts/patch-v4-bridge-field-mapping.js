const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'www', 'bridge-v408.js');
let js = fs.readFileSync(file, 'utf8');
const MARK = 'GT7 BRIDGE FIELD MAPPING V2';
if (js.includes(MARK)) {
  console.log('JA OK:', MARK);
  process.exit(0);
}

const start = js.indexOf('  function normalize(raw){');
const end = js.indexOf('\n  function paint(', start);
if (start < 0 || end < 0) throw new Error('Função normalize não encontrada');

const replacement = `  /* ${MARK} */
  function readPath(obj, path){
    if (!obj || !path) return undefined;
    return path.split('.').reduce((value, key) => value == null ? undefined : value[key], obj);
  }

  function first(root, paths, fallback){
    for (const path of paths) {
      const value = readPath(root, path);
      if (value !== undefined && value !== null && value !== '' && !(typeof value === 'number' && Number.isNaN(value))) return value;
    }
    return fallback;
  }

  function numeric(root, paths, fallback = 0){
    const value = first(root, paths, fallback);
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function formatMs(value){
    let ms = Number(value);
    if (!Number.isFinite(ms) || ms <= 0) return '--';
    const hours = Math.floor(ms / 3600000);
    ms %= 3600000;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return (hours ? String(hours).padStart(2, '0') + ':' : '') +
      String(minutes).padStart(2, '0') + ':' +
      String(seconds).padStart(2, '0') + '.' +
      String(millis).padStart(3, '0');
  }

  function normalize(raw){
    const root = parse(raw);
    const source = root.live && typeof root.live === 'object' ? root.live :
      root.fields && typeof root.fields === 'object' ? root.fields :
      root.data && typeof root.data === 'object' ? root.data :
      root.telemetry && typeof root.telemetry === 'object' ? root.telemetry : root;

    const merged = {
      ...root,
      ...source,
      live: source,
      session: root.session || root.active || source.session || {},
      bridgeEndpoint: activeEndpoint,
      bridgeUrl: BRIDGE,
      ps5Ip: PS5
    };

    const speed = numeric(merged, [
      'velocidade','speedKmh','speed','car.speedKmh','car.speed','vehicle.speedKmh',
      'legacy.speedKmh','legacy.speed','telemetry.speedKmh','data.speedKmh'
    ]);
    const rpm = numeric(merged, [
      'rpm','engineRpm','car.rpm','engine.rpm','vehicle.rpm','legacy.rpm','telemetry.rpm'
    ]);
    const gearRaw = first(merged, [
      'marcha','gear','currentGear','car.gear','transmission.gear','legacy.gear','telemetry.gear'
    ], 'N');
    const gear = gearRaw === 0 || gearRaw === '0' ? 'N' : gearRaw;
    const throttle = numeric(merged, [
      'acelerador','throttlePct','throttle','input.throttlePct','input.throttle',
      'controls.throttlePct','legacy.throttlePct','telemetry.throttlePct'
    ]);
    const brake = numeric(merged, [
      'freio','brakePct','brake','input.brakePct','input.brake',
      'controls.brakePct','legacy.brakePct','telemetry.brakePct'
    ]);
    const fuel = first(merged, [
      'combustivelPorcentagem','fuelPct','fuelPercent','fuel.percent','fuel.percentage',
      'car.fuelPct','legacy.fuelPct','telemetry.fuelPct'
    ], null);
    const maxSpeed = numeric(merged, [
      'velocidadeMaxima','maxSpeedKmh','maxSpeed','session.maxSpeedKmh','session.maxSpeed',
      'active.maxSpeedKmh','analysis.maxSpeedKmh'
    ]);

    const bestMs = numeric(merged, [
      'bestLapMs','lap.bestLapMs','session.bestLapMs','analysis.bestMs','analysis.bestLapMs'
    ]);
    const lastMs = numeric(merged, [
      'lastLapMs','lap.lastLapMs','session.lastLapMs','analysis.lastMs','analysis.lastLapMs'
    ]);
    const totalMs = numeric(merged, [
      'totalTimeMs','totalMs','session.totalMs','session.totalTimeMs','analysis.totalMs'
    ]);
    const averageMs = numeric(merged, [
      'averageLapMs','avgLapMs','session.avgLapMs','analysis.averageMs','analysis.avgMs'
    ]);
    const validLaps = numeric(merged, [
      'voltasCompletadas','voltasCorrigidas','voltasValidas','validLaps','lap.validLaps',
      'session.validLaps','analysis.laps','session.laps.length'
    ]);

    const tyreTemp = {
      FL: first(merged, ['advanced.tyreTemp.FL','advanced.tyreTemp.fl','motecChannels.tyreTemp.FL','tyres.temp.FL','tyres.FL.temp','tireTempFL','tyreTempFL'], undefined),
      FR: first(merged, ['advanced.tyreTemp.FR','advanced.tyreTemp.fr','motecChannels.tyreTemp.FR','tyres.temp.FR','tyres.FR.temp','tireTempFR','tyreTempFR'], undefined),
      RL: first(merged, ['advanced.tyreTemp.RL','advanced.tyreTemp.rl','motecChannels.tyreTemp.RL','tyres.temp.RL','tyres.RL.temp','tireTempRL','tyreTempRL'], undefined),
      RR: first(merged, ['advanced.tyreTemp.RR','advanced.tyreTemp.rr','motecChannels.tyreTemp.RR','tyres.temp.RR','tyres.RR.temp','tireTempRR','tyreTempRR'], undefined)
    };

    const lapArray = first(merged, ['lapTimes','session.lapTimes','session.laps','laps'], []);
    const lapTimes = Array.isArray(lapArray) ? lapArray.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'number') return formatMs(item);
      if (!item || typeof item !== 'object') return null;
      return item.formatted || item.time || item.lapTime || item.timeFormatted ||
        formatMs(item.ms || item.timeMs || item.lapTimeMs);
    }).filter(Boolean) : [];

    const existingAnalysis = merged.analysis && typeof merged.analysis === 'object' ? merged.analysis : {};
    const analysis = {
      ...existingAnalysis,
      laps: first(merged, ['analysis.laps'], validLaps),
      best: first(merged, ['analysis.best','melhorVolta'], bestMs ? formatMs(bestMs) : '--'),
      last: first(merged, ['analysis.last','ultimaVolta'], lastMs ? formatMs(lastMs) : '--'),
      total: first(merged, ['analysis.total','tempoTotalCorrida'], totalMs ? formatMs(totalMs) : '--'),
      average: first(merged, ['analysis.average','mediaVoltas','mediaGeral'], averageMs ? formatMs(averageMs) : '--')
    };

    return {
      ...merged,
      connected: true,
      decodeOk: first(merged, ['decodeOk','decoded','packetDecoded'], true) !== false,
      velocidade: speed,
      speedKmh: speed,
      rpm,
      marcha: gear,
      gear,
      acelerador: throttle,
      throttlePct: throttle,
      freio: brake,
      brakePct: brake,
      combustivelPorcentagem: fuel,
      fuelPct: fuel,
      velocidadeMaxima: maxSpeed,
      maxSpeedKmh: maxSpeed,
      melhorVolta: analysis.best,
      ultimaVolta: analysis.last,
      tempoTotalCorrida: analysis.total,
      mediaVoltas: analysis.average,
      voltasCompletadas: validLaps,
      lapTimes,
      analysis,
      advanced: {
        ...(merged.advanced || {}),
        tyreTemp
      }
    };
  }
`;

js = js.slice(0, start) + replacement + js.slice(end);
fs.writeFileSync(file, js);
console.log('Mapeamento completo dos campos da Bridge aplicado.');
