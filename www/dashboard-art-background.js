(() => {
  'use strict';

  function applyCockpitBackground() {
    const encoded = window.__cockpitBgTiny;
    if (!encoded) return;
    document.documentElement.style.setProperty(
      '--cockpit-art',
      `url("data:image/webp;base64,${encoded}")`
    );
    document.documentElement.classList.add('cockpit-art-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCockpitBackground, { once: true });
  } else {
    applyCockpitBackground();
  }
})();
