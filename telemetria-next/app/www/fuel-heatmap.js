'use strict';

(() => {
  const SEGMENT_COUNT = 20;
  const CRITICAL_SEGMENTS = 10;

  const fuelElement = document.getElementById('fuel');
  const segmentsElement = document.getElementById('fuelSegments');
  const fuelCard = document.getElementById('fuelCard') || segmentsElement?.closest('.fuel-card');

  if (!fuelElement || !segmentsElement || !fuelCard) return;

  function clampFuel(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
  }

  function buildSegments() {
    segmentsElement.innerHTML = Array.from({ length: SEGMENT_COUNT }, (_, index) => (
      `<i aria-hidden="true" style="--fuel-index:${index}"></i>`
    )).join('');
    segmentsElement.dataset.segmentCount = String(SEGMENT_COUNT);
  }

  function fuelFromLabel() {
    const match = String(fuelElement.textContent || '').match(/-?\d+(?:[.,]\d+)?/);
    return match ? clampFuel(match[0].replace(',', '.')) : null;
  }

  function renderFuelHeatmap(value) {
    const percentage = clampFuel(value);
    const hasFuel = percentage !== null;
    const activeCount = hasFuel && percentage > 0
      ? Math.max(1, Math.ceil((percentage / 100) * SEGMENT_COUNT))
      : 0;
    const critical = hasFuel && activeCount <= CRITICAL_SEGMENTS;
    const baseHue = hasFuel ? Math.round((percentage / 100) * 120) : 120;

    fuelCard.style.setProperty('--fuel-hue', String(baseHue));
    fuelCard.classList.toggle('fuel-critical', critical);
    fuelCard.dataset.activeSegments = String(activeCount);

    segmentsElement.setAttribute('aria-valuenow', hasFuel ? String(Math.round(percentage)) : '0');
    segmentsElement.setAttribute(
      'aria-valuetext',
      hasFuel
        ? `${Math.round(percentage)}% de combustível, ${activeCount} de ${SEGMENT_COUNT} blocos ativos`
        : 'Combustível indisponível'
    );

    [...segmentsElement.children].forEach((segment, index) => {
      const active = hasFuel && index < activeCount;
      const spread = activeCount > 1 ? ((index / (activeCount - 1)) - .5) * 14 : 0;
      const segmentHue = Math.max(0, Math.min(126, Math.round(baseHue + spread)));

      segment.style.setProperty('--segment-hue', String(segmentHue));
      segment.classList.toggle('active', active);
      segment.classList.toggle('low', active && percentage <= 30);
      segment.classList.toggle('critical', active && critical);
    });
  }

  buildSegments();

  const originalRenderFuel = window.renderFuel;
  window.renderFuel = function patchedRenderFuel(value) {
    renderFuelHeatmap(value);
  };

  const observer = new MutationObserver(() => renderFuelHeatmap(fuelFromLabel()));
  observer.observe(fuelElement, { childList: true, characterData: true, subtree: true });

  renderFuelHeatmap(fuelFromLabel());

  window.addEventListener('pageshow', () => renderFuelHeatmap(fuelFromLabel()));

  if (typeof originalRenderFuel !== 'function') {
    console.warn('[combustível] renderFuel original não encontrado; heatmap funcionando pelo valor exibido.');
  }
})();
