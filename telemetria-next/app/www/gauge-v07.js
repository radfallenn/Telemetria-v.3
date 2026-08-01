'use strict';

(function () {
  const TICK_COUNT = 48;
  const ARC_DEGREES = 300;
  const START_ANGLE = -150;

  function buildRpmCircle() {
    const ring = document.getElementById('rpmRing');
    if (!ring) return;

    ring.innerHTML = Array.from({ length: TICK_COUNT }, (_, index) => {
      const angle = START_ANGLE + (ARC_DEGREES * index / (TICK_COUNT - 1));
      const major = index % 9 === 0 || index === TICK_COUNT - 1 ? ' major' : '';
      const hot = index >= TICK_COUNT - 8 ? ' hot' : '';
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
    new MutationObserver(sync).observe(source, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function installRpmProgress() {
    const source = document.getElementById('rpm');
    const arc = document.getElementById('rpmProgressArc');
    if (!source || !arc) return;

    const sync = () => {
      const rpm = Math.max(0, Number(source.textContent) || 0);
      const limit = Math.max(1000, Number(window.__gt7RpmLimit) || 10000);
      const ratio = Math.max(0, Math.min(1, rpm / limit));
      arc.style.setProperty('--rpm-progress', `${ratio * ARC_DEGREES}deg`);
      arc.setAttribute('aria-valuenow', String(Math.round(rpm)));
      arc.setAttribute('aria-valuemax', String(Math.round(limit)));
    };

    sync();
    new MutationObserver(sync).observe(source, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function install() {
    buildRpmCircle();
    mirrorMaximumSpeed();
    installRpmProgress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
