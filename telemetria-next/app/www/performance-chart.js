'use strict';

(function () {
  const MAX_BARS = 14;
  let mode = 'trend';
  let lastSignature = '';

  function lapTimes() {
    const source = window.gt7V5LapTotal?.validLapTimes;
    if (Array.isArray(source)) return source.map(Number).filter(Number.isFinite);
    try {
      const saved = JSON.parse(localStorage.getItem('gt7_v5_valid_laps_v2') || '{}');
      return Array.isArray(saved.validLapTimes) ? saved.validLapTimes.map(Number).filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  }

  function signedDelta(current, previous) {
    return Number(current) - Number(previous);
  }

  function formatDelta(milliseconds) {
    const value = Number(milliseconds) || 0;
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}${(Math.abs(value) / 1000).toFixed(3)} s`;
  }

  function classify(delta) {
    if (delta < -1) return 'up';
    if (delta > 1) return 'down';
    return 'flat';
  }

  function render() {
    const bars = document.getElementById('performanceBars');
    const status = document.getElementById('performanceStatus');
    const deltaLabel = document.getElementById('performanceDelta');
    const empty = document.getElementById('performanceEmpty');
    if (!bars || !status || !deltaLabel || !empty) return;

    const times = lapTimes().slice(-MAX_BARS);
    const signature = `${mode}:${times.join(',')}`;
    if (signature === lastSignature) return;
    lastSignature = signature;

    if (times.length < 2) {
      bars.innerHTML = '';
      empty.hidden = false;
      status.textContent = 'AGUARDANDO VOLTAS';
      status.className = 'performance-status flat';
      deltaLabel.textContent = '--';
      return;
    }

    empty.hidden = true;
    const deltas = times.slice(1).map((time, index) => signedDelta(time, times[index]));
    const displayValues = mode === 'trend'
      ? deltas
      : times.map((time) => time - Math.min(...times)).slice(1);
    const maxMagnitude = Math.max(1, ...displayValues.map((value) => Math.abs(value)));

    bars.innerHTML = displayValues.map((value, index) => {
      const delta = deltas[index];
      const state = classify(delta);
      const height = Math.max(8, Math.round(Math.abs(value) / maxMagnitude * 46));
      const title = `Volta ${times.length - displayValues.length + index + 1}: ${formatDelta(delta)}`;
      return `<i class="performance-bar ${state}" style="height:${height}px" title="${title}"></i>`;
    }).join('');

    const latest = deltas.at(-1) || 0;
    const state = classify(latest);
    status.className = `performance-status ${state}`;
    status.textContent = state === 'up' ? 'EVOLUÇÃO ▲' : state === 'down' ? 'INVOLUÇÃO ▼' : 'ESTÁVEL';
    deltaLabel.textContent = formatDelta(latest);
  }

  function setMode(nextMode) {
    mode = nextMode;
    document.querySelectorAll('.performance-tab').forEach((button) => {
      button.classList.toggle('active', button.dataset.performanceMode === mode);
    });
    lastSignature = '';
    render();
  }

  function install() {
    document.querySelectorAll('.performance-tab').forEach((button) => {
      button.addEventListener('click', () => setMode(button.dataset.performanceMode || 'trend'));
    });
    render();
    setInterval(render, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
