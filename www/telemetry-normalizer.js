/* GT7 Telemetria - normalização ampliada baseada em parsers GT7 A/B/~ /C */
(function(){
  'use strict';
  if (window.__gt7TelemetryNormalizerInstalled) return;
  window.__gt7TelemetryNormalizerInstalled = true;

  const first = (...values) => values.find(v => v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && Number.isNaN(v)));
  const n = (...values) => {
    const v = first(...values);
    if (v === undefined) return undefined;
    const x = Number(v);
    return Number.isFinite(x) ? x : undefined;
  };
  const pct = v => {
    const x = n(v);
    if (x === undefined) return undefined;
    return x <= 1 ? x * 100 : x <= 255 ? x / 2.55 : x;
  };
  const arr = (v, i) => Array.isArray(v) ? v[i] : undefined;
  const wheel = ['FL','FR','RL','RR'];

  function enrich(input){
    const root = input && typeof input === 'object' ? input : {};
    const live = root.live && typeof root.live === 'object' ? root.live : root;
    const car = live.car || {};
    const inputData = live.input || {};
    const engine = live.engine || {};
    const fuel = live.fuel || {};
    const tyres = live.tyres || {};
    const advanced = live.advanced || {};
    const session = root.session || root.active || live.session || {};
    const flags = live.flags || {};
    const position = live.position || advanced.position || {};
    const velocity = live.worldVelocity || live.velocity || advanced.velocity || {};
    const rotation = live.rotation || advanced.rotation || {};
    const angular = live.angularVelocity || advanced.angularVelocity || {};
    const wheelRps = live.wheelRPS || live.wheelRps || advanced.wheelRPS || [];
    const tyreRadius = live.tyreRadius || live.tyreDiameter || tyres.radius || [];
    const tyreTemp = live.tyreTemp || tyres.temp || advanced.tyreTemp || {};
    const susp = live.suspHeight || live.suspension || advanced.suspension || {};
    const slips = live.tyreSlipRatio || advanced.tyreSlipRatio || tyres.slip || {};
    const surfaces = live.surfaceType || tyres.surface || {};
    const gearRatios = live.gearRatios || car.gearRatios || [];
    const torqueVectors = live.torqueVectors || advanced.torqueVectors || [];

    const speedMps = n(live.speedMps, live.speed, car.speedMps);
    const speedKmh = n(live.speedKmh, live.velocidade, car.speedKmh, live.carSpeed, speedMps !== undefined ? speedMps * 3.6 : undefined);
    const fuelCurrent = n(live.fuelCurrent, live.combustivelAtual, fuel.current, live.fuelLevel);
    const fuelCapacity = n(live.fuelCapacity, live.combustivelCapacidade, fuel.capacity);
    const fuelPct = n(live.fuelPct, live.combustivelPorcentagem, fuel.percent,
      fuelCurrent !== undefined && fuelCapacity > 0 ? fuelCurrent / fuelCapacity * 100 : undefined);

    const out = {
      ...live,
      session,
      speedKmh,
      velocidade: first(live.velocidade, speedKmh),
      rpm: n(live.rpm, car.rpm, live.engineRPM),
      gear: first(live.gear, live.marcha, car.gear, live.currentGear),
      marcha: first(live.marcha, live.gear, car.gear, live.currentGear),
      suggestedGear: first(live.suggestedGear, car.suggestedGear),
      throttlePct: pct(first(live.throttlePct, live.acelerador, inputData.throttlePct, live.throttle, live.throttleFiltered)),
      acelerador: pct(first(live.acelerador, live.throttlePct, inputData.throttlePct, live.throttle, live.throttleFiltered)),
      brakePct: pct(first(live.brakePct, live.freio, inputData.brakePct, live.brake, live.brakeFiltered)),
      freio: pct(first(live.freio, live.brakePct, inputData.brakePct, live.brake, live.brakeFiltered)),
      clutchPct: pct(first(live.clutchPct, inputData.clutchPct, advanced.clutch, live.clutch)),
      clutchEngagement: pct(first(live.clutchEngagement, live.clutchEngaged, advanced.clutchEngagement)),
      rpmAfterClutch: n(live.rpmAfterClutch, live.rpmFromClutchToGearbox, live.RPMFromClutchToGearbox),
      fuelCurrent,
      fuelCapacity,
      fuelPct,
      combustivelPorcentagem: first(live.combustivelPorcentagem, fuelPct),
      boost: n(live.boost, live.boostKpa, advanced.boost, engine.boost),
      oilPressure: n(live.oilPressure, advanced.oilPressure, engine.oilPressure),
      waterTemp: n(live.waterTemp, advanced.waterTemp, engine.waterTemp),
      oilTemp: n(live.oilTemp, advanced.oilTemp, engine.oilTemp),
      rideHeight: n(live.rideHeight, live.bodyHeight, advanced.rideHeight),
      rpmRevWarning: n(live.rpmRevWarning, live.minAlertRPM),
      rpmRevLimiter: n(live.rpmRevLimiter, live.maxAlertRPM),
      estimatedTopSpeed: n(live.estimatedTopSpeed, live.calcMaxSpeed),
      position: first(live.positionNumber, live.currentPosition, live.posicao, session.position),
      totalPositions: n(live.totalPositions, live.carsOnTrack, session.totalPositions),
      currentLap: n(live.currentLap, live.lapCount, session.currentLap),
      totalLaps: n(live.totalLaps, session.totalLaps),
      bestLapMs: n(live.bestLapMs, live.bestLap, session.bestLapMs),
      lastLapMs: n(live.lastLapMs, live.lastLap, session.lastLapMs),
      timeOnTrack: n(live.timeOnTrack, live.timeOnTrackMs, live.dayProgression),
      packetId: n(live.packetId, live.packageID, live.packetID),
      carId: n(live.carId, live.carID, live.carCode),
      carCategory: first(live.carCategory, car.category),
      wheelBase: n(live.wheelBase),
      positionX: n(live.positionX, position.x, position.X, arr(live.position,0)),
      positionY: n(live.positionY, position.y, position.Y, arr(live.position,1)),
      positionZ: n(live.positionZ, position.z, position.Z, arr(live.position,2)),
      velocityX: n(live.velocityX, velocity.x, velocity.X, arr(live.worldVelocity,0)),
      velocityY: n(live.velocityY, velocity.y, velocity.Y, arr(live.worldVelocity,1)),
      velocityZ: n(live.velocityZ, velocity.z, velocity.Z, arr(live.worldVelocity,2)),
      rotationPitch: n(live.rotationPitch, live.pitch, rotation.pitch, rotation.x, arr(live.rotation,0)),
      rotationYaw: n(live.rotationYaw, live.yaw, rotation.yaw, rotation.y, arr(live.rotation,1)),
      rotationRoll: n(live.rotationRoll, live.roll, rotation.roll, rotation.z, arr(live.rotation,2)),
      orientationRelativeToNorth: n(live.orientationRelativeToNorth, live.orientationNorth),
      angularVelocityX: n(live.angularVelocityX, angular.x, angular.X, arr(live.angularVelocity,0)),
      angularVelocityY: n(live.angularVelocityY, angular.y, angular.Y, arr(live.angularVelocity,1)),
      angularVelocityZ: n(live.angularVelocityZ, angular.z, angular.Z, arr(live.angularVelocity,2)),
      wheelRotation: n(live.wheelRotation, advanced.wheelRotation),
      steeringAngularVelocity: n(live.steeringAngularVelocity, advanced.steeringAngularVelocity),
      gForceLateral: n(live.gForceLateral, live.sway, advanced.sway, advanced.gForce && advanced.gForce.lateral),
      gForceVertical: n(live.gForceVertical, live.heave, advanced.heave, advanced.gForce && advanced.gForce.vertical),
      gForceLongitudinal: n(live.gForceLongitudinal, live.surge, advanced.surge, advanced.gForce && advanced.gForce.longitudinal),
      roadPlaneDistance: n(live.roadPlaneDistance),
      energyRecovery: n(live.energyRecovery, advanced.energyRecovery),
      inRace: first(live.inRace, live.carOnTrack, flags.inRace, flags.carOnTrack),
      isPaused: first(live.isPaused, live.paused, flags.paused),
      isLoading: first(live.isLoading, live.loading, flags.loading),
      isInGear: first(live.isInGear, live.inGear, flags.inGear),
      carHasTurbo: first(live.carHasTurbo, live.hasTurbo, flags.carHasTurbo),
      isRevLimiterFlashing: first(live.isRevLimiterFlashing, live.revLimiterBlinkAlertActive, flags.revLimiter),
      isHandbrakeEngaged: first(live.isHandbrakeEngaged, live.handBrakeActive, flags.handbrake),
      isLightsOn: first(live.isLightsOn, live.lightsActive, flags.lights),
      isHighBeamOn: first(live.isHighBeamOn, live.highBeamActive, flags.highBeam),
      isLowBeamOn: first(live.isLowBeamOn, live.lowBeamActive, flags.lowBeam),
      isASMEngaged: first(live.isASMEngaged, live.asmActive, flags.asm),
      isTCSEngaged: first(live.isTCSEngaged, live.tcsActive, flags.tcs)
    };

    out.advanced = {
      ...advanced,
      tyreTemp: {
        FL: n(live.tyreTempFL, tyreTemp.FL, tyreTemp.fl, arr(live.tyreTemp,0)),
        FR: n(live.tyreTempFR, tyreTemp.FR, tyreTemp.fr, arr(live.tyreTemp,1)),
        RL: n(live.tyreTempRL, tyreTemp.RL, tyreTemp.rl, arr(live.tyreTemp,2)),
        RR: n(live.tyreTempRR, tyreTemp.RR, tyreTemp.rr, arr(live.tyreTemp,3))
      },
      suspension: {
        FL: n(live.suspensionFL, susp.FL, susp.fl, arr(live.suspHeight,0)),
        FR: n(live.suspensionFR, susp.FR, susp.fr, arr(live.suspHeight,1)),
        RL: n(live.suspensionRL, susp.RL, susp.rl, arr(live.suspHeight,2)),
        RR: n(live.suspensionRR, susp.RR, susp.rr, arr(live.suspHeight,3))
      },
      wheelSpeed: {},
      tyreSlipRatio: {},
      gForce: {
        lateral: out.gForceLateral,
        vertical: out.gForceVertical,
        longitudinal: out.gForceLongitudinal,
        sway: out.gForceLateral,
        heave: out.gForceVertical,
        surge: out.gForceLongitudinal
      }
    };

    wheel.forEach((key, i) => {
      const radius = n(live['tyreRadius'+key], live['tyreDiameter'+key], tyreRadius[key], tyreRadius[i]);
      const rps = n(live['wheelRPS'+key], wheelRps[key], wheelRps[i]);
      const wheelSpeed = n(live['wheelSpeed'+key], advanced.wheelSpeed && advanced.wheelSpeed[key],
        radius !== undefined && rps !== undefined ? Math.abs(3.6 * radius * rps) : undefined);
      const slip = n(live['tyreSlipRatio'+key], slips[key],
        speedKmh > 0 && wheelSpeed !== undefined ? wheelSpeed / speedKmh : undefined);
      out['tyreRadius'+key] = radius;
      out['wheelSpeed'+key] = wheelSpeed;
      out['tyreSlipRatio'+key] = slip;
      out['suspension'+key] = out.advanced.suspension[key];
      out['tyreTemp'+key] = out.advanced.tyreTemp[key];
      out.advanced.wheelSpeed[key] = wheelSpeed;
      out.advanced.tyreSlipRatio[key] = slip;
      out['surface'+key] = first(surfaces[key], surfaces[i]);
      out['torqueVector'+key] = n(torqueVectors[key], torqueVectors[i]);
    });

    for (let i=0;i<8;i++) out['gear'+(i+1)] = n(live['gear'+(i+1)], gearRatios[i]);
    const rp = live.roadPlane || [];
    out.roadPlaneX = n(live.roadPlaneX, rp.X, rp.x, rp[0]);
    out.roadPlaneY = n(live.roadPlaneY, rp.Y, rp.y, rp[1]);
    out.roadPlaneZ = n(live.roadPlaneZ, rp.Z, rp.z, rp[2]);
    const wa = live.wheelSteeringAngle || [];
    out.wheelSteeringAngleFL = n(live.wheelSteeringAngleFL, wa.FL, wa[0]);
    out.wheelSteeringAngleFR = n(live.wheelSteeringAngleFR, wa.FR, wa[1]);

    return out;
  }

  function install(){
    const original = window.render;
    if (typeof original !== 'function' || original.__gt7Normalized) {
      setTimeout(install, 100);
      return;
    }
    function normalizedRender(data){
      return original(enrich(data));
    }
    normalizedRender.__gt7Normalized = true;
    normalizedRender.__originalRender = original;
    window.render = normalizedRender;
    window.gt7NormalizeTelemetry = enrich;
  }

  install();
})();
