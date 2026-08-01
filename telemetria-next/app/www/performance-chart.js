'use strict';

(function () {
  const MAX_BARS = 16;
  const LAPS_KEY = 'gt7_next_all_laps_v1';
  let lastSignature = '';

  function validLaps() {
    if (Array.isArray(window.gt7AllLaps?.validLaps)) {
      return window.gt7AllLaps.validLaps
        .map((lap) => ({ lap: Number(lap.lap), timeMs: Number(lap.timeMs) }))
        .filter((lap) => Number.isFinite(lap.timeMs) && lap.timeMs > 0);
    }
    try {
      const saved = JSON.parse(localStorage.getItem(LAPS_KEY) || '{}');
      return (Array.isArray(saved.laps) ? saved.laps : [])
        .filter((lap) => lap?.valid !== false)
        .map((lap) => ({ lap: Number(lap.lap), timeMs: Number(lap.timeMs) }))
        .filter((lap) => Number.isFinite(lap.timeMs) && lap.timeMs > 0);
    } catch { return []; }
  }

  function averageTime(laps) {
    return laps.reduce((total, lap) => total + lap.timeMs, 0) / laps.length;
  }

  function formatDifference(milliseconds) {
    const value = Number(milliseconds) || 0;
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}${(Math.abs(value) / 1000).toFixed(3)} s`;
  }

  function formatLap(milliseconds) {
    const value = Math.max(0, Number(milliseconds) || 0);
    const minutes = Math.floor(value / 60000);
    const seconds = Math.floor((value % 60000) / 1000);
    const millis = Math.floor(value % 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  function classify(deltaMs) {
    if (deltaMs > 1) return 'slower';
    if (deltaMs < -1) return 'faster';
    return 'average';
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function renderBars(allLaps, average) {
    const shownLaps = allLaps.slice(-MAX_BARS);
    const deviations = shownLaps.map((lap) => lap.timeMs - average);
    const maxMagnitude = Math.max(1, ...deviations.map((value) => Math.abs(value)));
    return shownLaps.map((lap, index) => {
      const delta = deviations[index];
      const state = classify(delta);
      const height = state === 'average' ? 4 : Math.max(7, Math.round(Math.abs(delta) / maxMagnitude * 43));
      const title = `Volta ${lap.lap}: ${formatLap(lap.timeMs)} (${formatDifference(delta)} da média)`;
      return `<span class="performance-column" title="${esc(title)}">` +
        `<i class="performance-bar ${state}" style="--bar-height:${height}px"></i>` +
        `<small>${esc(lap.lap)}</small></span>`;
    }).join('');
  }

  function render() {
    const chart = document.getElementById('performanceBars');
    const status = document.getElementById('performanceStatus');
    const deltaLabel = document.getElementById('performanceDelta');
    const empty = document.getElementById('performanceEmpty');
    if (!chart || !status || !deltaLabel || !empty) return;

    const laps = validLaps();
    const signature = laps.map((lap) => `${lap.lap}:${lap.timeMs}`).join(',');
    if (signature === lastSignature) return;
    lastSignature = signature;

    if (!laps.length) {
      chart.innerHTML = '';
      empty.hidden = false;
      status.textContent = 'AGUARDANDO VOLTAS';
      status.className = 'performance-status flat';
      deltaLabel.textContent = '--';
      return;
    }

    const average = averageTime(laps);
    const latestDelta = laps.at(-1).timeMs - average;
    const state = classify(latestDelta);
    empty.hidden = true;
    chart.innerHTML = renderBars(laps, average);
    chart.dataset.average = formatLap(average);

    if (state === 'slower') {
      status.className = 'performance-status down';
      status.textContent = 'ACIMA DA MÉDIA ▲';
    } else if (state === 'faster') {
      status.className = 'performance-status up';
      status.textContent = 'ABAIXO DA MÉDIA ▼';
    } else {
      status.className = 'performance-status flat';
      status.textContent = 'NA MÉDIA';
    }
    deltaLabel.textContent = formatDifference(latestDelta);
  }

  function loadLayoutVariants() {
    if (!document.querySelector('link[href="layout-variants.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'layout-variants.css';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[src="layout-variants.js"]')) {
      const script = document.createElement('script');
      script.src = 'layout-variants.js';
      document.body.appendChild(script);
    }
  }

  function install() {
    loadLayoutVariants();
    window.addEventListener('gt7-lap-recorded', () => { lastSignature = ''; render(); });
    window.addEventListener('gt7-laps-reset', () => { lastSignature = ''; render(); });
    render();
    setInterval(render, 750);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
