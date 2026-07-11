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

  function parseTemperature(text) {
    const match = String(text || '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const value = Number(match[0]);
    return Number.isFinite(value) ? value : null;
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

  function prepareHeroCards() {
    const hero = document.querySelector('#dash .hero');
    if (!hero) return;
    hero.classList.add('heroSeparated');
    [...hero.children].forEach((child) => child.classList.add('heroMetricCard'));
  }

  function preparePackCards() {
    const pack = document.querySelector('#dash .pack');
    if (!pack) return;
    pack.classList.add('packSeparated');

    const packTop = pack.querySelector('.packTop');
    if (packTop) {
      packTop.classList.add('packMetricsGrid');
      [...packTop.children].forEach((child) => child.classList.add('packMetricCard'));
    }

    if (!pack.querySelector('.speedGaugePanel')) {
      const line = pack.querySelector('.line');
      const title = pack.querySelector('.mt');
      const marker = pack.querySelector('#marker');
      const scale = pack.querySelector('.scale');
      if (line && title && marker && scale) {
        const panel = document.createElement('div');
        panel.className = 'speedGaugePanel';
        line.remove();
        panel.append(title, marker, scale);
        pack.append(panel);
      }
    }
  }

  function copyTextFallback(text) {
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }

  async function copyMetric(card, valueElement) {
    const text = String(valueElement?.textContent || '').trim();
    if (!text || text === '--' || text === '00:00.000') return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else copyTextFallback(text);
      card.classList.add('copiedMetric');
      const old = card.dataset.copyLabel;
      card.dataset.copyLabel = 'COPIADO';
      setTimeout(() => {
        card.classList.remove('copiedMetric');
        if (old) card.dataset.copyLabel = old;
        else delete card.dataset.copyLabel;
      }, 900);
    } catch (_) {
      copyTextFallback(text);
    }
  }

  function enableTimeCopy() {
    const targets = [
      { value: $('total'), label: 'Toque para copiar' },
      { value: $('best'), label: 'Toque para copiar' }
    ];
    for (const item of targets) {
      const card = item.value?.closest('.card, .packMetricCard');
      if (!card || card.dataset.copyReady === '1') continue;
      card.dataset.copyReady = '1';
      card.dataset.copyLabel = item.label;
      card.classList.add('copyTimeCard');
      card.addEventListener('click', () => copyMetric(card, item.value));
    }
  }

  function ensureTyrePanel() {
    if ($('tyreTempsPanel')) return;
    const grid = document.querySelector('#dash .dashGrid');
    const udmCard = $('udm')?.closest('.card');
    if (!grid || !udmCard) return;

    udmCard.classList.add('udmFullCard');
    const panel = document.createElement('div');
    panel.id = 'tyreTempsPanel';
    panel.className = 'tyreTempsPanel';
    panel.innerHTML = `
      <div class="tyrePanelTitle">TEMPERATURA DOS PNEUS</div>
      <div class="tyreGrid">
        <div class="tyreTempCard"><div class="label">DIANTEIRO ESQ.</div><div id="tyreTempFL" class="tyreTempValue">--</div><div class="tyreTempBar"><i id="tyreBarFL"></i></div></div>
        <div class="tyreTempCard"><div class="label">DIANTEIRO DIR.</div><div id="tyreTempFR" class="tyreTempValue">--</div><div class="tyreTempBar"><i id="tyreBarFR"></i></div></div>
        <div class="tyreTempCard"><div class="label">TRASEIRO ESQ.</div><div id="tyreTempRL" class="tyreTempValue">--</div><div class="tyreTempBar"><i id="tyreBarRL"></i></div></div>
        <div class="tyreTempCard"><div class="label">TRASEIRO DIR.</div><div id="tyreTempRR" class="tyreTempValue">--</div><div class="tyreTempBar"><i id="tyreBarRR"></i></div></div>
      </div>`;
    udmCard.insertAdjacentElement('afterend', panel);
  }

  function renderTyreValue(sourceId, valueId, barId) {
    const value = parseTemperature($(sourceId)?.textContent);
    const valueEl = $(valueId);
    const bar = $(barId);
    if (!valueEl || !bar) return;
    valueEl.textContent = value == null ? '--' : `${Math.round(value)}°C`;
    const normalized = value == null ? 0 : Math.max(0, Math.min(100, ((value - 40) / 80) * 100));
    const hue = value == null ? 190 : Math.max(0, Math.min(190, 190 - normalized * 1.9));
    bar.style.width = `${normalized}%`;
    bar.style.background = `hsl(${hue},100%,50%)`;
    bar.style.boxShadow = value == null ? 'none' : `0 0 9px hsl(${hue},100%,50%)`;
  }

  function renderTyres() {
    ensureTyrePanel();
    renderTyreValue('tfl', 'tyreTempFL', 'tyreBarFL');
    renderTyreValue('tfr', 'tyreTempFR', 'tyreBarFR');
    renderTyreValue('trl', 'tyreTempRL', 'tyreBarRL');
    renderTyreValue('trr', 'tyreTempRR', 'tyreBarRR');
  }

  function renderFuel() {
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
      renderFuel();
      renderTyres();
    }
  }

  function init() {
    const dashboardGrid = document.querySelector('#dash > .grid');
    if (dashboardGrid) {
      dashboardGrid.classList.add('dashGrid');
      new MutationObserver(() => {
        removeUnwantedDashboardCards();
        ensureTyrePanel();
      }).observe(dashboardGrid, { childList: true });
    }

    prepareHeroCards();
    preparePackCards();
    enableTimeCopy();
    ensureTyrePanel();

    const source = $('fuel');
    if (source) {
      new MutationObserver(() => {
        const percent = parseFuelPercent(source.textContent);
        if (percent != null) fuelPercent = percent;
        renderFuel();
      }).observe(source, { childList: true, subtree: true, characterData: true });
    }

    for (const id of ['tfl', 'tfr', 'trl', 'trr']) {
      const sourceTemp = $(id);
      if (sourceTemp) new MutationObserver(renderTyres).observe(sourceTemp, { childList: true, subtree: true, characterData: true });
    }

    window.addEventListener('gt7:pagechange', (event) => {
      if (event.detail?.page === 'dash') {
        refresh();
        renderTyres();
      }
    });
    window.addEventListener('gt7-mobile-telemetry', (event) => {
      applyPayload(event.detail || {});
      renderFuel();
      renderTyres();
    });
    window.addEventListener('gt7:telemetry', (event) => {
      applyPayload(event.detail || {});
      renderFuel();
      renderTyres();
    });

    removeUnwantedDashboardCards();
    renderFuel();
    renderTyres();
    refresh();
    setInterval(() => {
      refresh();
      renderTyres();
    }, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
