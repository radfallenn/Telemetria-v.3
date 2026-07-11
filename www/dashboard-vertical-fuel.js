(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULT_BASE = 'http://192.168.1.70:8788';
  const STATE_KEY = 'gt7_fuel_autonomy_state_v3';
  const CAR_AVG_KEY = 'gt7_fuel_average_by_car_v2';

  let lastFuelPercent = null;
  let lastRemainingLaps = null;
  let lastConsumptionPerLap = null;
  let requestRunning = false;
  let fuelState = loadJson(STATE_KEY, {});
  let averagesByCar = loadJson(CAR_AVG_KEY, {});

  function bridgeBase() {
    return (localStorage.getItem('gt7_bridge_url') || DEFAULT_BASE).replace(/\/$/, '');
  }

  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function parseFuelPercent(text) {
    const match = String(text || '').replace(',', '.').match(/(-?\d+(?:\.\d+)?)\s*%/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
  }

  function ensureMeta() {
    const tile = $('fuelDash')?.closest('.fuelTile');
    if (!tile || $('fuelEstimateMeta')) return;
    const meta = document.createElement('div');
    meta.id = 'fuelEstimateMeta';
    meta.className = 'sub';
    meta.textContent = 'Calculando consumo por volta';
    $('fuelDash').insertAdjacentElement('afterend', meta);
  }

  function buildMarker() {
    const root = $('fuelMiniMarker');
    if (!root || root.dataset.ready === '1') return;
    root.innerHTML = Array.from({ length: 14 }, (_, index) => {
      const hue = Math.round(8 + (index / 13) * 112);
      return `<i class="fuelSeg" data-hue="${hue}" style="color:hsl(${hue},100%,50%)"></i>`;
    }).join('');
    root.dataset.ready = '1';
  }

  function formatRemainingLaps(value) {
    if (!Number.isFinite(value) || value < 0) return 'CALCULANDO';
    if (value >= 100) return '99+ VOLTAS';
    if (value < 10) return `${value.toFixed(1)} VOLTAS`;
    return `${value.toFixed(0)} VOLTAS`;
  }

  function renderFuel() {
    const source = $('fuel');
    const value = $('fuelDash');
    const marker = $('fuelMiniMarker');
    if (!value || !marker) return;

    ensureMeta();
    const sourcePercent = parseFuelPercent(source?.textContent?.trim());
    const percent = lastFuelPercent ?? sourcePercent;
    value.textContent = formatRemainingLaps(lastRemainingLaps);

    const meta = $('fuelEstimateMeta');
    if (meta) {
      if (Number.isFinite(lastConsumptionPerLap)) {
        const percentText = Number.isFinite(percent) ? ` · tanque ${percent.toFixed(0)}%` : '';
        meta.textContent = `Média ${lastConsumptionPerLap.toFixed(2)} L/volta${percentText}`;
      } else {
        meta.textContent = 'Complete uma volta para calcular';
      }
    }

    buildMarker();
    const active = percent == null ? 0 : Math.round((percent / 100) * 14);
    [...marker.children].forEach((segment, index) => {
      const hue = segment.dataset.hue;
      const on = percent != null && index < active;
      segment.classList.toggle('on', on);
      segment.style.background = on ? `hsl(${hue},100%,50%)` : '#222d31';
    });
  }

  function validSamples(samples) {
    return (Array.isArray(samples) ? samples : [])
      .map(Number)
      .filter((value) => Number.isFinite(value) && value >= 0.03 && value <= 50)
      .slice(-12);
  }

  function robustAverage(samples) {
    const values = validSamples(samples).sort((a, b) => a - b);
    if (!values.length) return null;
    const trimmed = values.length >= 5 ? values.slice(1, -1) : values;
    return trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
  }

  function carKey(live) {
    const code = live?.car?.carCode ?? live?.telemetry?.carCode;
    return Number.isFinite(Number(code)) ? String(Number(code)) : 'default';
  }

  function completedLapCount(live, session) {
    const sessionLaps = Array.isArray(session?.laps)
      ? session.laps.filter((lap) => lap && lap.valid !== false && Number(lap.ms) > 0).length
      : 0;
    const sessionValid = Math.max(0, Number(session?.validLaps || 0));
    const currentLap = Math.max(0, Number(live?.lap?.currentLap || live?.telemetry?.lap?.count || 0));
    return Math.max(sessionLaps, sessionValid, currentLap > 0 ? currentLap - 1 : 0);
  }

  function updateLocalFuelModel(live, session, levelLiters) {
    if (!Number.isFinite(levelLiters) || levelLiters < 0) return null;

    const sessionId = String(session?.id || 'legacy-session');
    const completed = completedLapCount(live, session);
    const key = carKey(live);

    if (!fuelState || typeof fuelState !== 'object' || fuelState.sessionId !== sessionId) {
      fuelState = {
        sessionId,
        carKey: key,
        lapStartFuel: levelLiters,
        lastFuel: levelLiters,
        completedLaps: completed,
        samples: []
      };
    }

    if (!Array.isArray(fuelState.samples)) fuelState.samples = [];

    const previousFuel = numberOrNull(fuelState.lastFuel);
    if (Number.isFinite(previousFuel) && levelLiters > previousFuel + 0.25) {
      fuelState.lapStartFuel = levelLiters;
      fuelState.samples = [];
      fuelState.completedLaps = completed;
    }

    if (!Number.isFinite(numberOrNull(fuelState.lapStartFuel))) {
      fuelState.lapStartFuel = levelLiters;
    }

    if (completed > Number(fuelState.completedLaps || 0)) {
      const used = Number(fuelState.lapStartFuel) - levelLiters;
      if (Number.isFinite(used) && used >= 0.03 && used <= 50) {
        fuelState.samples.push(used);
        fuelState.samples = validSamples(fuelState.samples);
      }
      fuelState.lapStartFuel = levelLiters;
      fuelState.completedLaps = completed;
    }

    fuelState.lastFuel = levelLiters;
    fuelState.carKey = key;
    saveJson(STATE_KEY, fuelState);

    const localAverage = robustAverage(fuelState.samples);
    if (Number.isFinite(localAverage)) {
      const previous = numberOrNull(averagesByCar[key]);
      averagesByCar[key] = Number.isFinite(previous)
        ? previous * 0.65 + localAverage * 0.35
        : localAverage;
      saveJson(CAR_AVG_KEY, averagesByCar);
      return localAverage;
    }

    return numberOrNull(averagesByCar[key]);
  }

  function estimateRemainingLaps(payload) {
    const live = payload?.live || payload || {};
    const session = payload?.session || {};
    const fuel = live.fuel || {};

    const levelLiters = numberOrNull(fuel.levelLiters);
    const percent = numberOrNull(fuel.percent);
    const directRemaining = numberOrNull(fuel.remainingLaps ?? session.remainingLaps);
    const directAverage = numberOrNull(
      fuel.consumptionPerLapLiters ?? fuel.fuelPerLapLiters ?? session.fuelPerLapLiters
    );
    const consumedLiters = numberOrNull(
      fuel.consumedSessionLiters ?? session.fuelConsumedLiters
    );
    const completed = completedLapCount(live, session);

    if (Number.isFinite(percent)) lastFuelPercent = Math.max(0, Math.min(100, percent));

    if (Number.isFinite(directRemaining) && directRemaining >= 0) {
      lastRemainingLaps = directRemaining;
      lastConsumptionPerLap = Number.isFinite(directAverage) && directAverage > 0
        ? directAverage
        : Number.isFinite(levelLiters) && directRemaining > 0
          ? levelLiters / directRemaining
          : null;
      return;
    }

    let average = Number.isFinite(directAverage) && directAverage > 0 ? directAverage : null;

    if (!Number.isFinite(average) && Number.isFinite(consumedLiters) && consumedLiters > 0.03 && completed > 0) {
      average = consumedLiters / completed;
    }

    const localAverage = updateLocalFuelModel(live, session, levelLiters);
    if (!Number.isFinite(average) && Number.isFinite(localAverage)) average = localAverage;

    if (Number.isFinite(levelLiters) && levelLiters >= 0 && Number.isFinite(average) && average > 0.001) {
      lastConsumptionPerLap = average;
      lastRemainingLaps = Math.max(0, levelLiters / average);
    } else {
      lastRemainingLaps = null;
      lastConsumptionPerLap = null;
    }
  }

  async function refreshFuelEstimate() {
    if (requestRunning || !$('dash')?.classList.contains('on')) return;
    requestRunning = true;
    try {
      const response = await fetch(`${bridgeBase()}/api/live`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      estimateRemainingLaps(await response.json());
    } catch (_) {
      const sourcePercent = parseFuelPercent($('fuel')?.textContent?.trim());
      if (sourcePercent != null) lastFuelPercent = sourcePercent;
    } finally {
      requestRunning = false;
      renderFuel();
    }
  }

  function init() {
    const dashboardGrid = document.querySelector('#dash > .grid');
    if (dashboardGrid) dashboardGrid.classList.add('dashGrid');

    const source = $('fuel');
    if (source) {
      new MutationObserver(() => {
        const percent = parseFuelPercent(source.textContent);
        if (percent != null) lastFuelPercent = percent;
        renderFuel();
      }).observe(source, { childList: true, subtree: true, characterData: true });
    }

    $('startSec')?.addEventListener('click', () => {
      fuelState = {};
      lastRemainingLaps = null;
      lastConsumptionPerLap = null;
      saveJson(STATE_KEY, fuelState);
      renderFuel();
    });

    renderFuel();
    refreshFuelEstimate();
    window.addEventListener('gt7:pagechange', (event) => {
      if (event.detail?.page === 'dash') refreshFuelEstimate();
    });
    setInterval(refreshFuelEstimate, 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
