'use strict';

(function () {
  const STORAGE_KEY = 'gt7_next_dashboard_layout_v1';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let gaugeSequence = 0;

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

    const defs = document.createElementNS(SVG_NS, 'defs');
    const clip = document.createElementNS(SVG_NS, 'clipPath');
    const clipId = `sideGaugeClip${++gaugeSequence}`;
    clip.setAttribute('id', clipId);
    const reveal = document.createElementNS(SVG_NS, 'rect');
    reveal.setAttribute('x', '0');
    reveal.setAttribute('y', '360');
    reveal.setAttribute('width', '100');
    reveal.setAttribute('height', '0');
    clip.appendChild(reveal);
    defs.appendChild(clip);

    const track = document.createElementNS(SVG_NS, 'path');
    track.setAttribute('d', pathData);
    track.setAttribute('class', 'side-gauge-track');

    const progress = document.createElementNS(SVG_NS, 'path');
    progress.setAttribute('d', pathData);
    progress.setAttribute('class', 'side-gauge-progress');
    progress.setAttribute('clip-path', `url(#${clipId})`);

    svg.append(defs, track, progress);

    const caption = document.createElement('div');
    caption.className = 'side-gauge-label';
    caption.innerHTML = `<span>${label}</span><strong>0</strong>`;

    wrapper.append(svg, caption);
    wrapper.dataset.valueId = valueId;
    wrapper.dataset.maxValue = String(maxValue);
    wrapper._progress = progress;
    wrapper._reveal = reveal;
    wrapper._value = caption.querySelector('strong');
    return wrapper;
  }

  function installSideGauges() {
    const stage = document.querySelector('.gauge-stage');
    if (!stage || stage.querySelector('.side-gauges')) return;

    const layer = document.createElement('div');
    layer.className = 'side-gauges';

    const fuelPath = 'M 82 326 C 28 270, 24 94, 82 34';
    const rpmPath = 'M 18 34 C 76 94, 72 270, 18 326';
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
      const visibleHeight = 360 * ratio;
      gauge._reveal.setAttribute('y', String(360 - visibleHeight));
      gauge._reveal.setAttribute('height', String(visibleHeight));
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
