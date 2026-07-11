(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULT_BASE = 'http://192.168.1.70:8788';
  const SEGMENTS = 14;
  let requestRunning = false;
  let fuelPercent = null;

  function bridgeBase() {
    return (localStorage.getItem('gt7_bridge_url') || DEFAULT_BASE).replace(/\/$/, '');
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
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

  function buildMarker() {
    const root = $('fuelMiniMarker');
    if (!root || root.dataset.ready === '1') return;
    root.innerHTML = Array.from({ length: SEGMENTS }, (_, index) => {
      const hue = Math.round(8 + (index / (SEGMENTS - 1)) * 112);
      return `<i class="fuelSeg" data-hue="${hue}" style="color:hsl(${hue},100%,50%)"></i>`;
    }).join('');
    root.dataset.ready = '1';
  }

  function removeUnwantedDashboardCards() {
    $('identityCarCard')?.remove();
    $('identityTrackCard')?.remove();
    $('fuelEstimateMeta')?.remove();
  }

  function render() {
    const value = $('fuelDash');
    const marker = $('fuelMiniMarker');
    if (!value || !marker) return;

    removeUnwantedDashboardCards();
    buildMarker();

    value.textContent = fuelPercent == null ? '--%' : `${Math.round(fuelPercent)}%`;
    const active = fuelPercent == null
      ? 0
      : Math.max(0, Math.min(SEGMENTS, Math.round((fuelPercent / 100) * SEGMENTS)));

    marker.classList.toggle('fuelLow', fuelPercent != null && active <= 3);

    [...marker.children].forEach((segment, index) => {
      const hue = segment.dataset.hue;
      const on = fuelPercent != null && index < active;
      segment.classList.toggle('on', on);
      segment.style.background = on ? `hsl(${hue},100%,50%)` : '#222d31';
    });
  }

  function applyPayload(payload) {
    const nextPercent = firstNumber(payload, [
      'live.fuel.percent',
      'live.telemetry.fuel.percent',
      'live.legacy.fuelPercent',
      'fuel.percent',
      'fuelPercent'
    ]);
    if (nextPercent != null) fuelPercent = Math.max(0, Math.min(100, nextPercent));
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
    if (dashboardGrid) {
      dashboardGrid.classList.add('dashGrid');
      new MutationObserver(removeUnwantedDashboardCards).observe(dashboardGrid, { childList: true });
    }

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

    removeUnwantedDashboardCards();
    render();
    refresh();
    setInterval(refresh, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
