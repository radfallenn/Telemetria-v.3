(() => {
  'use strict';

  function applyCockpitBackground() {
    const chunks = Array.isArray(window.__cockpitBgChunks)
      ? window.__cockpitBgChunks.filter(Boolean)
      : [];
    const encoded = chunks.join('');
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
