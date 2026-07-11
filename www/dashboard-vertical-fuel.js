(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULT_BASE = 'http://192.168.1.70:8788';

  const DIRECT_AUTONOMY_KEYS = new Set([
    'autonomy',
    'autonomylaps',
    'autonomiavoltas',
    'autonomiacombustivel',
    'fuelautonomy',
    'fuelautonomylaps',
    'fuellaps',
    'fuellapsleft',
    'fuellapsremaining',
    'fuelremaininglaps',
    'remainingfuellaps',
    'remaininglaps',
    'remaininglapsfuel',
    'lapsremaining',
    'lapsremainingfuel',
    'fuelrange',
    'fuelrangelaps',
    'gameautonomy',
    'gameautonomylaps',
    'gamefuelautonomy',
    'gamefuellaps',
    'estimatedlaps',
    'estimatedfuellaps',
    'fuelestimatedlaps'
  ]);

  const DIRECT_PATHS = [
    'live.fuel.gameRemainingLaps',
    'live.fuel.remainingFuelLaps',
    'live.fuel.fuelLapsRemaining',
    'live.fuel.lapsRemaining',
    'live.fuel.remainingLaps',
    'live.fuel.fuelLaps',
    'live.fuel.fuelAutonomy',
    'live.fuel.autonomyLaps',
    'live.fuel.autonomy',
    'live.fuel.fuelRangeLaps',
    'live.fuel.fuelRange',
    'live.telemetry.fuel.gameRemainingLaps',
    'live.telemetry.fuel.remainingFuelLaps',
    'live.telemetry.fuel.fuelLapsRemaining',
    'live.telemetry.fuel.lapsRemaining',
    'live.telemetry.fuel.remainingLaps',
    'live.telemetry.fuel.fuelLaps',
    'live.telemetry.fuel.fuelAutonomy',
    'live.telemetry.fuel.autonomy',
    'live.legacy.remainingFuelLaps',
    'live.legacy.fuelAutonomy',
    'live.legacy.autonomy',
    'session.gameRemainingLaps',
    'session.remainingFuelLaps',
    'session.fuelLapsRemaining',
    'session.lapsRemaining',
    'session.remainingLaps',
    'session.fuelAutonomy',
    'session.autonomy',
    'remainingFuelLaps',
    'fuelLapsRemaining',
    'lapsRemaining',
    'remainingLaps',
    'fuelAutonomy',
    'autonomy'
  ];

  let lastFuelPercent = null;
  let directAutonomy = null;
  let directAutonomyPath = null;
  let requestRunning = false;

  function bridgeBase() {
    return (localStorage.getItem('gt7_bridge_url') || DEFAULT_BASE).replace(/\/$/, '');
  }

  function normalizeKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function parseNumber(value) {
    if (value && typeof value === 'object') {
      for (const key of ['value', 'laps', 'remaining', 'current', 'amount']) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const parsed = parseNumber(value[key]);
          if (parsed != null) return parsed;
        }
      }
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) && value >= 0 && value < 1000 ? value : null;
    }

    const match = String(value ?? '')
      .replace(',', '.')
      .match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const number = Number(match[0]);
    return Number.isFinite(number) && number >= 0 && number < 1000 ? number : null;
  }

  function getPath(object, path) {
    return path.split('.').reduce((current, key) => {
      if (current == null || typeof current !== 'object') return undefined;
      return current[key];
    }, object);
  }

  function findDirectGameAutonomy(payload) {
    for (const path of DIRECT_PATHS) {
      const value = parseNumber(getPath(payload, path));
      if (value != null) return { value, path };
    }

    const visited = new WeakSet();
    const queue = [{ value: payload, path: '' }];
    let checked = 0;

    while (queue.length && checked < 2500) {
      const item = queue.shift();
      const object = item.value;
      if (!object || typeof object !== 'object') continue;
      if (visited.has(object)) continue;
      visited.add(object);

      for (const [key, value] of Object.entries(object)) {
        checked += 1;
        const path = item.path ? `${item.path}.${key}` : key;
        if (DIRECT_AUTONOMY_KEYS.has(normalizeKey(key))) {
          const parsed = parseNumber(value);
          if (parsed != null) return { value: parsed, path };
        }
        if (value && typeof value === 'object') queue.push({ value, path });
      }
    }

    return null;
  }

  function parseFuelPercent(text) {
    const match = String(text || '').replace(',', '.').match(/(-?\d+(?:\.\d+)?)\s*%/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
  }

  function findFuelPercent(payload) {
    const paths = [
      'live.fuel.percent',
      'live.telemetry.fuel.percent',
      'live.legacy.fuelPercent',
      'fuel.percent',
      'fuelPercent',
      'fuel_percent',
      'combustivelPorcentagem'
    ];
    for (const path of paths) {
      const value = parseNumber(getPath(payload, path));
      if (value != null && value <= 100) return value;
    }
    return null;
  }

  function ensureMeta() {
    const tile = $('fuelDash')?.closest('.fuelTile');
    if (!tile || $('fuelEstimateMeta')) return;
    const meta = document.createElement('div');
    meta.id = 'fuelEstimateMeta';
    meta.className = 'sub';
    meta.textContent = 'Aguardando autonomia enviada pelo jogo';
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

  function formatDirectAutonomy(value) {
    if (!Number.isFinite(value)) return '-- VOLTAS';
    if (Number.isInteger(value)) return `${value} VOLTAS`;
    return `${Number(value.toFixed(1))} VOLTAS`;
  }

  function renderFuel() {
    const source = $('fuel');
    const value = $('fuelDash');
    const marker = $('fuelMiniMarker');
    if (!value || !marker) return;

    ensureMeta();
    const sourcePercent = parseFuelPercent(source?.textContent?.trim());
    const percent = lastFuelPercent ?? sourcePercent;
    value.textContent = formatDirectAutonomy(directAutonomy);

    const meta = $('fuelEstimateMeta');
    if (meta) {
      meta.textContent = directAutonomyPath
        ? `Valor direto do jogo · ${directAutonomyPath}`
        : 'Aguardando atributo de autonomia do jogo';
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

  function applyPayload(payload) {
    const autonomy = findDirectGameAutonomy(payload);
    if (autonomy) {
      directAutonomy = autonomy.value;
      directAutonomyPath = autonomy.path;
    } else {
      directAutonomy = null;
      directAutonomyPath = null;
    }

    const percent = findFuelPercent(payload);
    if (percent != null) lastFuelPercent = Math.max(0, Math.min(100, percent));
  }

  async function refreshDirectAutonomy() {
    if (requestRunning || !$('dash')?.classList.contains('on')) return;
    requestRunning = true;
    try {
      const response = await fetch(`${bridgeBase()}/api/live`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      applyPayload(await response.json());
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

    window.addEventListener('gt7-mobile-telemetry', (event) => {
      applyPayload(event.detail || {});
      renderFuel();
    });
    window.addEventListener('gt7:telemetry', (event) => {
      applyPayload(event.detail || {});
      renderFuel();
    });
    window.addEventListener('message', (event) => {
      if (event.data && typeof event.data === 'object') {
        applyPayload(event.data);
        renderFuel();
      }
    });
    window.addEventListener('gt7:pagechange', (event) => {
      if (event.detail?.page === 'dash') refreshDirectAutonomy();
    });

    renderFuel();
    refreshDirectAutonomy();
    setInterval(refreshDirectAutonomy, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
