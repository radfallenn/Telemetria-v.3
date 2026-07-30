'use strict';

(function () {
  const MAX_BARS = 14;
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
    const sign = value > 0 ? '−' : value < 0 ? '+' : '';
    return `${sign}${(Math.abs(value) / 1000).toFixed(3)} s`;
  }

  function classify(gainMs) {
    if (gainMs > 1) return 'up';
    if (gainMs < -1) return 'down';
    return 'flat';
  }

  function render() {
    const bars = document.getElementById('performanceBars');
    const status = document.getElementById('performanceStatus');
    const deltaLabel = document.getElementById('performanceDelta');
    const empty = document.getElementById('performanceEmpty');
    if (!bars || !status || !deltaLabel || !empty) return;

    const laps = validLaps().slice(-MAX_BARS);
    const signature = `${mode}:${laps.map((lap) => `${lap.lap}:${lap.timeMs}`).join(',')}`;
    if (signature === lastSignature) return;
    lastSignature = signature;

    if (laps.length < 2) {
      bars.innerHTML = '';
      empty.hidden = false;
      status.textContent = 'AGUARDANDO VOLTAS';
      status.className = 'performance-status flat';
      deltaLabel.textContent = '--';
      return;
    }

    empty.hidden = true;
    const comparisons = laps.slice(1).map((lap, index) => ({
      lap: lap.lap,
      timeMs: lap.timeMs,
      gainMs: gain(lap.timeMs, laps[index].timeMs)
    }));

    const bestTime = Math.min(...laps.map((lap) => lap.timeMs));
    const values = mode === 'trend'
      ? comparisons.map((item) => item.gainMs)
      : comparisons.map((item) => bestTime - item.timeMs);

    const maxMagnitude = Math.max(1, ...values.map((value) => Math.abs(value)));

    bars.innerHTML = comparisons.map((item, index) => {
      const value = values[index];
      const state = classify(value);
      const height = Math.max(5, Math.round(Math.abs(value) / maxMagnitude * 43));
      const comparisonText = mode === 'trend'
        ? formatDifference(-item.gainMs)
        : `${((item.timeMs - bestTime) / 1000).toFixed(3)} s da melhor`;
      return `<span class="performance-column" title="Volta ${item.lap}: ${comparisonText}">` +
        `<i class="performance-bar ${state}" style="--bar-height:${height}px"></i>` +
        `<small>${item.lap}</small>` +
      `</span>`;
    }).join('');

    const latestGain = comparisons.at(-1)?.gainMs || 0;
    const state = classify(latestGain);
    status.className = `performance-status ${state}`;
    status.textContent = state === 'up' ? 'EVOLUÇÃO ▲' : state === 'down' ? 'INVOLUÇÃO ▼' : 'ESTÁVEL';
    deltaLabel.textContent = formatDifference(-latestGain);
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
    window.addEventListener('gt7-lap-recorded', () => {
      lastSignature = '';
      render();
    });
    window.addEventListener('gt7-laps-reset', () => {
      lastSignature = '';
      render();
    });
    render();
    setInterval(render, 750);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();