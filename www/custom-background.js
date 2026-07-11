(() => {
  'use strict';

  const DB_NAME = 'gt7-cockpit-customization';
  const DB_VERSION = 1;
  const STORE_NAME = 'assets';
  const RECORD_KEY = 'dashboard-background';
  const MAX_WIDTH = 1440;
  const MAX_HEIGHT = 2400;
  const QUALITY = 0.86;

  let objectUrl = null;
  let defaultBackground = '';
  let databasePromise = null;

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento.'));
    });
    return databasePromise;
  }

  async function readBackground() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Não foi possível ler o fundo salvo.'));
    });
  }

  async function saveBackground(record) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(record, RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível salvar o fundo.'));
    });
  }

  async function deleteBackground() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível remover o fundo.'));
    });
  }

  function setStatus(message, type = '') {
    const status = document.getElementById('customBgStatus');
    if (!status) return;
    status.textContent = message;
    status.className = `customBgStatus${type ? ` ${type}` : ''}`;
  }

  function setBusy(busy) {
    const choose = document.getElementById('customBgChoose');
    const remove = document.getElementById('customBgRemove');
    if (choose) choose.disabled = busy;
    if (remove) remove.disabled = busy;
  }

  function restoreDefaultBackground() {
    if (!defaultBackground) {
      const chunks = Array.isArray(window.__cockpitBgChunks)
        ? window.__cockpitBgChunks.filter(Boolean)
        : [];
      const encoded = chunks.join('');
      if (encoded) defaultBackground = `url("data:image/webp;base64,${encoded}")`;
    }
    if (defaultBackground) {
      document.documentElement.style.setProperty('--cockpit-art', defaultBackground);
    } else {
      document.documentElement.style.removeProperty('--cockpit-art');
    }
    document.documentElement.classList.remove('customCockpitBackground');
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    updatePreview(null);
  }

  function updatePreview(blob) {
    const preview = document.getElementById('customBgPreview');
    const image = document.getElementById('customBgPreviewImage');
    if (!preview || !image) return;

    const oldPreviewUrl = image.dataset.previewUrl;
    if (oldPreviewUrl) URL.revokeObjectURL(oldPreviewUrl);
    delete image.dataset.previewUrl;
    image.removeAttribute('src');
    preview.classList.remove('hasImage');

    if (blob instanceof Blob) {
      const previewUrl = URL.createObjectURL(blob);
      image.dataset.previewUrl = previewUrl;
      image.src = previewUrl;
      preview.classList.add('hasImage');
    }
  }

  function applyBackgroundBlob(blob) {
    if (!(blob instanceof Blob)) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(blob);
    document.documentElement.style.setProperty('--cockpit-art', `url("${objectUrl}")`);
    document.documentElement.classList.add('customCockpitBackground');
    updatePreview(blob);
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('A imagem selecionada não pôde ser aberta.'));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível processar a imagem.')),
        mimeType,
        quality
      );
    });
  }

  async function compressImage(file) {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('O processador de imagem não está disponível.');
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    try {
      return await canvasToBlob(canvas, 'image/webp', QUALITY);
    } catch (_) {
      return canvasToBlob(canvas, 'image/jpeg', QUALITY);
    }
  }

  function buildSettingsPanel() {
    const settingsPage = document.getElementById('set');
    if (!settingsPage || document.getElementById('customBgCard')) return;

    const card = document.createElement('div');
    card.id = 'customBgCard';
    card.className = 'customBgCard';
    card.innerHTML = `
      <div class="customBgTitle">IMAGEM DE FUNDO</div>
      <div class="customBgText">Escolha uma imagem do celular para usar no fundo da página DASH. Ela ficará salva neste aparelho.</div>
      <div id="customBgPreview" class="customBgPreview">
        <img id="customBgPreviewImage" alt="Prévia do fundo escolhido">
        <span>NENHUMA IMAGEM PERSONALIZADA</span>
      </div>
      <div class="customBgActions">
        <button id="customBgChoose" class="customBgButton" type="button">ESCOLHER IMAGEM</button>
        <button id="customBgRemove" class="customBgButton remove" type="button">REMOVER FUNDO</button>
      </div>
      <input id="customBgInput" type="file" accept="image/*" hidden>
      <div id="customBgStatus" class="customBgStatus">Fundo padrão ativo.</div>`;
    settingsPage.appendChild(card);

    const input = document.getElementById('customBgInput');
    document.getElementById('customBgChoose')?.addEventListener('click', () => input?.click());
    document.getElementById('customBgRemove')?.addEventListener('click', async () => {
      setBusy(true);
      setStatus('Removendo imagem...');
      try {
        await deleteBackground();
        restoreDefaultBackground();
        setStatus('Fundo padrão restaurado.', 'ok');
      } catch (error) {
        setStatus(error?.message || 'Não foi possível remover o fundo.', 'error');
      } finally {
        setBusy(false);
      }
    });

    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setStatus('Selecione um arquivo de imagem.', 'error');
        return;
      }

      setBusy(true);
      setStatus('Processando imagem...');
      try {
        const blob = await compressImage(file);
        await saveBackground({
          blob,
          name: file.name,
          type: blob.type,
          updatedAt: Date.now()
        });
        applyBackgroundBlob(blob);
        setStatus('Imagem aplicada e salva.', 'ok');
      } catch (error) {
        setStatus(error?.message || 'Não foi possível aplicar a imagem.', 'error');
      } finally {
        setBusy(false);
      }
    });
  }

  async function init() {
    defaultBackground = document.documentElement.style.getPropertyValue('--cockpit-art').trim();
    buildSettingsPanel();
    try {
      const record = await readBackground();
      if (record?.blob instanceof Blob) {
        applyBackgroundBlob(record.blob);
        setStatus('Imagem personalizada ativa.', 'ok');
      }
    } catch (_) {
      setStatus('Fundo padrão ativo.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
