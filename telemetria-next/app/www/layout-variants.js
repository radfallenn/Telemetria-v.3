'use strict';

(function () {
  const STORAGE_KEY = 'gt7_next_dashboard_layout_v1';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ARC_LENGTH = 280;

  function numericText(id) {
    const raw = String(document.getElementById(id)?.textContent || '').replace(',', '.');
    const value = Number(raw.match(/-?\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(value) ? value : 0;
  }

  function createArc(side, label, valueId, maxValue, pathData) {
    const wrapper = document.createElement('div');
    wrapper.className = `side-gauge ${side}`;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 360');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const track = document.createElementNS(SVG_NS, 'path');
    track.setAttribute('d', pathData);
    track.setAttribute('pathLength', String(ARC_LENGTH));
    track.setAttribute('class', 'side-gauge-track');

    const progress = document.createElementNS(SVG_NS, 'path');
    progress.setAttribute('d', pathData);
    progress.setAttribute('pathLength', String(ARC_LENGTH));
    progress.setAttribute('class', 'side-gauge-progress');
    progress.style.strokeDasharray = String(ARC_LENGTH);
    progress.style.strokeDashoffset = String(ARC_LENGTH);

    svg.append(track, progress);

    const caption = document.createElement('div');
    caption.className = 'side-gauge-label';
    caption.innerHTML = `<span>${label}</span><strong>0</strong>`;

    wrapper.append(svg, caption);
    wrapper.dataset.valueId = valueId;
    wrapper.dataset.maxValue = String(maxValue);
    wrapper._progress = progress;
    wrapper._value = caption.querySelector('strong');
    return wrapper;
  }

  function installSideGauges() {
    const stage = document.querySelector('.gauge-stage');
    if (!stage || stage.querySelector('.side-gauges')) return;

    const layer = document.createElement('div');
    layer.className = 'side-gauges';

    const fuelPath = 'M 88 330 C 25 280, 16 90, 88 30';
    const rpmPath = 'M 12 30 C 84 90, 75 280, 12 330';
    layer.append(
      createArc('left', 'COMB.', 'fuel', 100, fuelPath),
      createArc('right', 'RPM', 'rpmCard', 10000, rpmPath)
    );
    stage.appendChild(layer);
  }

  function colorFuel(percent) {
    if (percent <= 20) return '#ff475d';
    if (percent <= 45) return '#ffb52e';
    return '#24e36a';
  }

  function colorRpm(percent) {
    if (percent >= 90) return '#ff475d';
    if (percent >= 72) return '#ffe92d';
    if (percent >= 45) return '#24e36a';
    return '#08d9f4';
  }

  function updateSideGauges() {
    document.querySelectorAll('.side-gauge').forEach((gauge) => {
      const value = numericText(gauge.dataset.valueId);
      const max = Number(gauge.dataset.maxValue) || 100;
      const ratio = Math.max(0, Math.min(1, value / max));
      gauge._progress.style.strokeDashoffset = String(ARC_LENGTH * (1 - ratio));
      gauge._value.textContent = gauge.classList.contains('left') ? `${Math.round(value)}%` : String(Math.round(value));
      const color = gauge.classList.contains('left') ? colorFuel(ratio * 100) : colorRpm(ratio * 100);
      gauge._progress.style.stroke = color;
      gauge._progress.style.color = color;
    });
  }

  function setLayout(layout) {
    const normalized = layout === 'side' ? 'side' : 'classic';
    document.documentElement.dataset.dashboardLayout = normalized;
    localStorage.setItem(STORAGE_KEY, normalized);
    document.querySelectorAll('.layout-option').forEach((button) => {
      button.classList.toggle('active', button.dataset.layout === normalized);
    });
  }

  function installSelector() {
    const panel = document.querySelector('#settingsModal .modal-panel');
    if (!panel || panel.querySelector('.layout-selector')) return;

    const section = document.createElement('div');
    section.className = 'layout-selector';
    section.innerHTML = '<span>LAYOUT DO DASHBOARD</span><div class="layout-options"><button type="button" class="layout-option" data-layout="classic">LAYOUT 1<br>CLÁSSICO</button><button type="button" class="layout-option" data-layout="side">LAYOUT 2<br>LATERAIS</button></div>';
    const firstAction = panel.querySelector('#testConnection');
    panel.insertBefore(section, firstAction || null);
    section.querySelectorAll('.layout-option').forEach((button) => {
      button.addEventListener('click', () => setLayout(button.dataset.layout));
    });
  }

  function install() {
    installSideGauges();
    installSelector();
    setLayout(localStorage.getItem(STORAGE_KEY) || 'classic');
    updateSideGauges();
    setInterval(updateSideGauges, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
