'use strict';

(function () {
  const STORAGE_KEY = 'gt7_next_card_layout_v1';
  const CARD_SELECTOR = '.page .data-card';
  const CONTROL_CLASS = 'card-layout-controls';
  let moveLock = false;

  function slug(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'card';
  }

  function loadLayouts() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function saveLayouts(value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  function directCards(parent) {
    return [...parent.children].filter((element) => element.classList?.contains('data-card'));
  }

  function pageKey(card) {
    const page = card.closest('.page');
    const parent = card.parentElement;
    const parentName = parent.id || [...parent.classList].sort().join('-') || 'cards';
    return `${page?.id || 'page'}:${parentName}`;
  }

  function ensureCardId(card, index) {
    if (card.dataset.layoutId) return card.dataset.layoutId;
    const nestedId = card.querySelector('[id]')?.id;
    const title = card.querySelector('.card-title')?.textContent;
    card.dataset.layoutId = slug(card.id || nestedId || title || `card-${index + 1}`);
    return card.dataset.layoutId;
  }

  function saveContainer(parent) {
    const cards = directCards(parent);
    if (!cards.length) return;
    const layouts = loadLayouts();
    layouts[pageKey(cards[0])] = cards.map((card, index) => ensureCardId(card, index));
    saveLayouts(layouts);
  }

  function restoreContainer(parent) {
    const cards = directCards(parent);
    if (!cards.length) return;
    const byId = new Map(cards.map((card, index) => [ensureCardId(card, index), card]));
    const order = loadLayouts()[pageKey(cards[0])];
    if (!Array.isArray(order)) return;
    order.forEach((id) => {
      const card = byId.get(id);
      if (card) parent.appendChild(card);
    });
  }

  function center(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function closestHorizontal(card, direction) {
    const sourceRect = card.getBoundingClientRect();
    const source = center(sourceRect);
    const candidates = directCards(card.parentElement)
      .filter((candidate) => candidate !== card)
      .map((candidate) => ({ candidate, rect: candidate.getBoundingClientRect() }))
      .filter(({ rect }) => {
        const point = center(rect);
        const sameRow = Math.abs(point.y - source.y) <= Math.max(sourceRect.height, rect.height) * .58;
        return sameRow && (direction === 'left' ? point.x < source.x : point.x > source.x);
      })
      .sort((a, b) => Math.abs(center(a.rect).x - source.x) - Math.abs(center(b.rect).x - source.x));
    return candidates[0]?.candidate || null;
  }

  function closestVertical(card, direction) {
    const sourceRect = card.getBoundingClientRect();
    const source = center(sourceRect);
    const candidates = directCards(card.parentElement)
      .filter((candidate) => candidate !== card)
      .map((candidate) => ({ candidate, rect: candidate.getBoundingClientRect() }))
      .filter(({ rect }) => {
        const point = center(rect);
        return direction === 'up' ? point.y < source.y - 8 : point.y > source.y + 8;
      })
      .sort((a, b) => {
        const pa = center(a.rect);
        const pb = center(b.rect);
        return (Math.abs(pa.y - source.y) * 4 + Math.abs(pa.x - source.x)) -
          (Math.abs(pb.y - source.y) * 4 + Math.abs(pb.x - source.x));
      });
    return candidates[0]?.candidate || null;
  }

  function fallbackSibling(card, direction) {
    const cards = directCards(card.parentElement);
    const index = cards.indexOf(card);
    return direction === 'left' || direction === 'up' ? cards[index - 1] || null : cards[index + 1] || null;
  }

  function animate(card) {
    card.classList.remove('layout-moving');
    void card.offsetWidth;
    card.classList.add('layout-moving');
    setTimeout(() => card.classList.remove('layout-moving'), 180);
  }

  function moveCard(card, direction) {
    if (moveLock || !card?.parentElement) return;
    moveLock = true;
    const parent = card.parentElement;
    const target = direction === 'left' || direction === 'right'
      ? closestHorizontal(card, direction) || fallbackSibling(card, direction)
      : closestVertical(card, direction) || fallbackSibling(card, direction);

    if (target) {
      if (direction === 'left' || direction === 'up') parent.insertBefore(card, target);
      else parent.insertBefore(card, target.nextSibling);
      saveContainer(parent);
      animate(card);
    }
    setTimeout(() => { moveLock = false; }, 120);
  }

  function controls() {
    const element = document.createElement('div');
    element.className = CONTROL_CLASS;
    element.setAttribute('aria-label', 'Mover cartão');
    element.innerHTML = [
      ['up', '▲', 'Mover para cima'],
      ['left', '◀', 'Mover para a esquerda'],
      ['right', '▶', 'Mover para a direita'],
      ['down', '▼', 'Mover para baixo']
    ].map(([direction, symbol, label]) =>
      `<button type="button" data-layout-move="${direction}" aria-label="${label}" title="${label}">${symbol}</button>`
    ).join('');
    return element;
  }

  function prepareCard(card, index) {
    ensureCardId(card, index);
    card.classList.add('layout-enabled');
    card.querySelectorAll(`.${CONTROL_CLASS}`).forEach((item) => item.remove());
    card.appendChild(controls());
  }

  function install() {
    const cards = [...document.querySelectorAll(CARD_SELECTOR)];
    const parents = [...new Set(cards.map((card) => card.parentElement).filter(Boolean))];
    parents.forEach(restoreContainer);
    [...document.querySelectorAll(CARD_SELECTOR)].forEach(prepareCard);
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-layout-move]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      moveCard(button.closest('.data-card'), button.dataset.layoutMove);
    });
  }

  window.gt7CardLayout = {
    reset() { localStorage.removeItem(STORAGE_KEY); location.reload(); },
    save() {
      const parents = [...new Set([...document.querySelectorAll(CARD_SELECTOR)].map((card) => card.parentElement))];
      parents.forEach(saveContainer);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
