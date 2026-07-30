'use strict';

(function () {
  const MAX_POINTS = 16;
  const LAPS_KEY = 'gt7_next_all_laps_v1';
  let mode = 'trend';
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
    } catch {
      return [];
    }
  }

  function gain(current, previous) {
    return Number(previous) - Number(current);
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

  function classify(gainMs) {
    if (gainMs > 1) return 'up';
    if (gainMs < -1) return 'down';
    return 'flat';
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function lineChart(laps) {
    const width = 620;
    const height = 128;
    const left = 18;
    const right = 12;
    const top = 12;
    const bottom = 25;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const bestTime = Math.min(...laps.map((lap) => lap.timeMs));

    const values = mode === 'trend'
      ? laps.map((lap) => lap.timeMs)
      : laps.map((lap) => lap.timeMs - bestTime);

    let min = Math.min(...values);
    let max = Math.max(...values);
    const naturalRange = max - min;
    const padding = Math.max(mode === 'delta' ? 80 : 120, naturalRange * 0.18);
    min -= padding;
    max += padding;
    if (max === min) max = min + 1;

    const x = (index) => left + (laps.length === 1 ? plotWidth / 2 : index * plotWidth / (laps.length - 1));
    const y = (value) => top + (max - value) * plotHeight / (max - min);
    const points = values.map((value, index) => ({ x: x(index), y: y(value), value, lap: laps[index] }));

    const grid = [0.25, 0.5, 0.75].map((ratio) => {
      const gy = top + plotHeight * ratio;
      return `<line class="performance-grid-line" x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}" />`;
    }).join('');

    const baseline = mode === 'delta' && min <= 0 && max >= 0
      ? `<line class="performance-zero-line" x1="${left}" y1="${y(0)}" x2="${width - right}" y2="${y(0)}" />`
      : '';

    const segments = points.slice(1).map((point, index) => {
      const previous = points[index];
      const gainMs = gain(laps[index + 1].timeMs, laps[index].timeMs);
      const state = classify(gainMs);
      return `<line class="performance-line-segment ${state}" x1="${previous.x}" y1="${previous.y}" x2="${point.x}" y2="${point.y}" />`;
    }).join('');

    const dots = points.map((point, index) => {
      const previous = index > 0 ? laps[index - 1] : null;
      const gainMs = previous ? gain(point.lap.timeMs, previous.timeMs) : 0;
      const state = index === 0 ? 'flat' : classify(gainMs);
      const label = mode === 'trend'
        ? `Volta ${point.lap.lap}: ${formatLap(point.lap.timeMs)}`
        : `Volta ${point.lap.lap}: ${formatDifference(point.value)} da melhor`;
      return `<g class="performance-point ${state}">` +
        `<circle cx="${point.x}" cy="${point.y}" r="4.2"><title>${esc(label)}</title></circle>` +
        `<text x="${point.x}" y="${height - 8}" text-anchor="middle">${esc(point.lap.lap)}</text>` +
      `</g>`;
    }).join('');

    return `<svg class="performance-line-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Gráfico de linha dos tempos das voltas">${grid}${baseline}${segments}${dots}</svg>`;
  }

  function render() {
    const chart = document.getElementById('performanceBars');
    const status = document.getElementById('performanceStatus');
    const deltaLabel = document.getElementById('performanceDelta');
    const empty = document.getElementById('performanceEmpty');
    if (!chart || !status || !deltaLabel || !empty) return;

    const laps = validLaps().slice(-MAX_POINTS);
    const signature = `${mode}:${laps.map((lap) => `${lap.lap}:${lap.timeMs}`).join(',')}`;
    if (signature === lastSignature) return;
    lastSignature = signature;

    if (laps.length < 2) {
      chart.innerHTML = '';
      empty.hidden = false;
      status.textContent = 'AGUARDANDO VOLTAS';
      status.className = 'performance-status flat';
      deltaLabel.textContent = '--';
      return;
    }

    empty.hidden = true;
    chart.innerHTML = lineChart(laps);

    const latest = laps.at(-1);
    const previous = laps.at(-2);
    const latestGain = gain(latest.timeMs, previous.timeMs);
    const state = classify(latestGain);
    status.className = `performance-status ${state}`;
    status.textContent = state === 'up' ? 'EVOLUÇÃO ▲' : state === 'down' ? 'INVOLUÇÃO ▼' : 'ESTÁVEL';
    deltaLabel.textContent = formatDifference(latest.timeMs - previous.timeMs);
  }

  function setMode(nextMode) {
    mode = nextMode === 'delta' ? 'delta' : 'trend';
    document.querySelectorAll('.performance-tab').forEach((button) => {
      button.classList.toggle('active', button.dataset.performanceMode === mode);
    });
    lastSignature = '';
    render();
  }

  function install() {
    document.querySelectorAll('.performance-tab').forEach((button) => {
      button.addEventListener('click', () => setMode(button.dataset.performanceMode));
    });
    window.addEventListener('gt7-lap-recorded', () => { lastSignature = ''; render(); });
    window.addEventListener('gt7-laps-reset', () => { lastSignature = ''; render(); });
    window.addEventListener('resize', () => { lastSignature = ''; render(); });
    render();
    setInterval(render, 750);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
