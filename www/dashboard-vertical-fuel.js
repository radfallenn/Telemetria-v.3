(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULT_BASE = 'http://192.168.1.70:8788';
  let requestRunning = false;
  let fuelPercent = null;
  let lapsRemaining = null;
  let lastLapConsumedLiters = null;

  function bridgeBase() {
    return (localStorage.getItem('gt7_bridge_url') || DEFAULT_BASE).replace(/\/$/, '');
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function getPath(object, path) {
    return path.split('.').reduce((current, key) => {
      if (current == null || typeof current !== 'object') return undefined;
      return current[key];
    }, object);
  }

  function firstNumber(payload, paths) {
    for (const path of paths) {
      const value = numberOrNull(getPath(payload, path));
      if (value != null) return value;
    }
    return null;
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
    meta.textContent = 'Complete uma volta válida';
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

  function formatLaps(value) {
    if (!Number.isFinite(value)) return '-- VOLTAS';
    if (value >= 100) return '99+ VOLTAS';
    return `${value < 10 ? value.toFixed(1) : value.toFixed(0)} VOLTAS`;
  }

  function render() {
    const value = $('fuelDash');
    const marker = $('fuelMiniMarker');
    if (!value || !marker) return;

    ensureMeta();
    buildMarker();
    value.textContent = formatLaps(lapsRemaining);

    const meta = $('fuelEstimateMeta');
    if (meta) {
      meta.textContent = Number.isFinite(lastLapConsumedLiters)
        ? `Última volta: ${lastLapConsumedLiters.toFixed(2)} L consumidos`
        : 'Complete uma volta válida';
    }

    const active = fuelPercent == null ? 0 : Math.round((fuelPercent / 100) * 14);
    [...marker.children].forEach((segment, index) => {
      const hue = segment.dataset.hue;
      const on = fuelPercent != null && index < active;
      segment.classList.toggle('on', on);
      segment.style.background = on ? `hsl(${hue},100%,50%)` : '#222d31';
    });
  }

  function applyPayload(payload) {
    const nextLaps = firstNumber(payload, [
      'live.fuel.lapsRemaining',
      'live.fuel.remainingFuelLaps',
      'session.fuelLapsRemaining',
      'session.remainingFuelLaps',
      'fuel.lapsRemaining',
      'fuel.remainingFuelLaps'
    ]);
    const nextConsumed = firstNumber(payload, [
      'live.fuel.lastLapConsumedLiters',
      'session.lastLapFuelConsumedLiters',
      'fuel.lastLapConsumedLiters'
    ]);
    const nextPercent = firstNumber(payload, [
      'live.fuel.percent',
      'live.telemetry.fuel.percent',
      'fuel.percent'
    ]);

    lapsRemaining = nextLaps;
    lastLapConsumedLiters = nextConsumed;
    if (nextPercent != null && nextPercent <= 100) fuelPercent = nextPercent;
  }

  async function refresh() {
    if (requestRunning || !$('dash')?.classList.contains('on')) return;
    requestRunning = true;
    try {
      const response = await fetch(`${bridgeBase()}/api/live`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      applyPayload(await response.json());
    } catch (_) {
      const percent = parseFuelPercent($('fuel')?.textContent?.trim());
      if (percent != null) fuelPercent = percent;
    } finally {
      requestRunning = false;
      render();
    }
  }

  function init() {
    const dashboardGrid = document.querySelector('#dash > .grid');
    if (dashboardGrid) dashboardGrid.classList.add('dashGrid');

    const source = $('fuel');
    if (source) {
      new MutationObserver(() => {
        const percent = parseFuelPercent(source.textContent);
        if (percent != null) fuelPercent = percent;
        render();
      }).observe(source, { childList: true, subtree: true, characterData: true });
    }

    window.addEventListener('gt7:pagechange', (event) => {
      if (event.detail?.page === 'dash') refresh();
    });
    window.addEventListener('gt7-mobile-telemetry', (event) => {
      applyPayload(event.detail || {});
      render();
    });
    window.addEventListener('gt7:telemetry', (event) => {
      applyPayload(event.detail || {});
      render();
    });

    render();
    refresh();
    setInterval(refresh, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
