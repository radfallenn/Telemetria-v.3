(() => {
  'use strict';

  function activate(button) {
    if (!button) return;
    const pageId = button.dataset.p;
    const page = document.getElementById(pageId);
    if (!page) return;

    document.querySelectorAll('.nb').forEach((item) => item.classList.remove('on'));
    document.querySelectorAll('.page').forEach((item) => item.classList.remove('on'));
    button.classList.add('on');
    page.classList.add('on');

    window.dispatchEvent(new CustomEvent('gt7:pagechange', { detail: { page: pageId } }));
  }

  function handle(event) {
    const button = event.target && event.target.closest ? event.target.closest('.nb[data-p]') : null;
    if (button) activate(button);
  }

  document.addEventListener('click', handle, true);
  document.addEventListener('pointerup', handle, true);

  window.GT7Navigation = { activate };
})();
