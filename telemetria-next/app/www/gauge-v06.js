'use strict';

(function () {
  const TICK_COUNT = 36;

  function buildRpmSemicircle() {
    const ring = document.getElementById('rpmRing');
    if (!ring) return;
    ring.innerHTML = Array.from({ length: TICK_COUNT }, (_, index) => {
      const angle = -90 + (180 * index / (TICK_COUNT - 1));
      const major = index % 7 === 0 || index === TICK_COUNT - 1 ? ' major' : '';
      const hot = index >= TICK_COUNT - 6 ? ' hot' : '';
      return `<i class="rpm-tick${major}${hot}" style="--angle:${angle}deg;--tick-index:${index}"></i>`;
    }).join('');
  }

  function mirrorMaximumSpeed() {
    const source = document.getElementById('maxSpeed');
    const target = document.getElementById('maxSpeedGauge');
    if (!source || !target) return;
    const sync = () => {
      const value = String(source.textContent || '0').trim();
      target.textContent = value || '0';
    };
    sync();
    new MutationObserver(sync).observe(source, { childList: true, subtree: true, characterData: true });
  }

  function install() {
    buildRpmSemicircle();
    mirrorMaximumSpeed();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
