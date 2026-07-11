(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULT_BASE = 'http://192.168.1.70:8788';
  let rpmLimit = 9000;
  let requestRunning = false;

  function bridgeBase() {
    return (localStorage.getItem('gt7_bridge_url') || DEFAULT_BASE).replace(/\/$/, '');
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getPath(object, path) {
    return path.split('.').reduce((current, key) => {
      if (current == null || typeof current !== 'object') return undefined;
      return current[key];
    }, object);
  }

  function firstNumber(object, paths) {
    for (const path of paths) {
      const value = number(getPath(object, path));
      if (value != null) return value;
    }
    return null;
  }

  function ensureGraph() {
    const card = $('rpmMetricCard') || $('rpmTop')?.closest('.packMetricCard');
    if (!card || $('rpmBarFill')) return;
    const graph = document.createElement('div');
    graph.className = 'rpmGraph';
    graph.innerHTML = '<i id="rpmBarFill"></i>';
    card.appendChild(graph);
  }

  function currentRpm() {
    const text = String($('rpmTop')?.textContent || '').replace(',', '.');
    const match = text.match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function render() {
    ensureGraph();
    const fill = $('rpmBarFill');
    if (!fill) return;
    const rpm = Math.max(0, currentRpm());
    const limit = Math.max(1000, rpmLimit, rpm * 1.02);
    fill.style.width = `${Math.max(0, Math.min(100, (rpm / limit) * 100))}%`;
  }

  async function refreshLimit() {
    if (requestRunning) return;
    requestRunning = true;
    try {
      const response = await fetch(`${bridgeBase()}/api/live`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const detected = firstNumber(payload, [
        'live.telemetry.engine.maxAlertRpm',
        'live.telemetry.engine.revLimiterRpm',
        'live.car.maxRpm',
        'session.maxRpm'
      ]);
      if (detected != null && detected > 1000) rpmLimit = detected;
    } catch (_) {
      // Mantém o limite anterior quando a Bridge estiver indisponível.
    } finally {
      requestRunning = false;
      render();
    }
  }

  function init() {
    ensureGraph();
    const rpm = $('rpmTop');
    if (rpm) new MutationObserver(render).observe(rpm, { childList: true, subtree: true, characterData: true });
    render();
    refreshLimit();
    setInterval(refreshLimit, 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
