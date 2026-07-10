(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULT_BASE = 'http://192.168.1.70:8788';
  let lastFuelPercent = null;
  let lastRemainingLaps = null;
  let lastConsumptionPerLap = null;
  let requestRunning = false;

  function bridgeBase() {
    return (localStorage.getItem('gt7_bridge_url') || DEFAULT_BASE).replace(/\/$/, '');
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
    meta.textContent = 'Aguardando uma volta válida';
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
    if (!Number.isFinite(value) || value < 0) return '--';
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
      meta.textContent = Number.isFinite(lastConsumptionPerLap)
        ? `Consumo médio ${lastConsumptionPerLap.toFixed(2)} L/volta`
        : 'Aguardando uma volta válida';
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

  function estimateRemainingLaps(payload) {
    const live = payload?.live || payload || {};
    const session = payload?.session || {};
    const fuel = live.fuel || {};

    const levelLiters = numberOrNull(fuel.levelLiters);
    const percent = numberOrNull(fuel.percent);
    const consumedLiters = numberOrNull(
      fuel.consumedSessionLiters ?? session.fuelConsumedLiters
    );

    const validSessionLaps = Array.isArray(session.laps)
      ? session.laps.filter((lap) => lap && lap.valid !== false && Number(lap.ms) > 0).length
      : 0;
    const completedLaps = Math.max(
      validSessionLaps,
      Number(session.validLaps || 0),
      0
    );

    if (Number.isFinite(percent)) lastFuelPercent = Math.max(0, Math.min(100, percent));

    if (
      Number.isFinite(levelLiters) && levelLiters >= 0 &&
      Number.isFinite(consumedLiters) && consumedLiters > 0.01 &&
      completedLaps >= 1
    ) {
      const consumptionPerLap = consumedLiters / completedLaps;
      if (Number.isFinite(consumptionPerLap) && consumptionPerLap > 0.001) {
        lastConsumptionPerLap = consumptionPerLap;
        lastRemainingLaps = Math.max(0, levelLiters / consumptionPerLap);
        return;
      }
    }

    lastRemainingLaps = null;
    lastConsumptionPerLap = null;
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

    renderFuel();
    refreshFuelEstimate();
    window.addEventListener('gt7:pagechange', (event) => {
      if (event.detail?.page === 'dash') refreshFuelEstimate();
    });
    setInterval(refreshFuelEstimate, 2200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
