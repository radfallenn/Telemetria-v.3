(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function parseFuelPercent(text) {
    const match = String(text || '').replace(',', '.').match(/(-?\d+(?:\.\d+)?)\s*%/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
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

  function renderFuel() {
    const source = $('fuel');
    const value = $('fuelDash');
    const marker = $('fuelMiniMarker');
    if (!value || !marker) return;

    const text = source?.textContent?.trim() || '--';
    value.textContent = text;
    const percent = parseFuelPercent(text);
    buildMarker();
    const active = percent == null ? 0 : Math.round((percent / 100) * 14);

    [...marker.children].forEach((segment, index) => {
      const hue = segment.dataset.hue;
      const on = percent != null && index < active;
      segment.classList.toggle('on', on);
      segment.style.background = on ? `hsl(${hue},100%,50%)` : '#222d31';
    });
  }

  function init() {
    const dashboardGrid = document.querySelector('#dash > .grid');
    if (dashboardGrid) dashboardGrid.classList.add('dashGrid');

    const source = $('fuel');
    if (source) new MutationObserver(renderFuel).observe(source, { childList: true, subtree: true, characterData: true });

    renderFuel();
    setInterval(() => {
      if ($('dash')?.classList.contains('on')) renderFuel();
    }, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
