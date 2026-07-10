(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const BASE_DEFAULT = 'http://192.168.1.70:8788';
  const CAR_DB_URL = 'https://raw.githubusercontent.com/ddm999/gt7info/web-new/_data/db/cars.csv';
  const CAR_CACHE_KEY = 'gt7_car_names_v1';
  const TRACKS_KEY = 'gt7_track_fingerprints_v2';
  const TRACE_LIMIT = 5000;
  const SAMPLE_MS = 450;
  const SAMPLE_DISTANCE_M = 2.5;

  const fallbackCars = {
    1409:"F40 '92",1484:"Countach LP400 '74",1551:"330 P4 '67",1646:"908 HDi FAP '10",1902:"Z4 GT3 '11",1935:"GT40 Mark I '66",2049:"Veyron 16.4 '13",2108:"SRT Tomahawk X VGT",2123:"LF-LC GT VGT",2158:"458 Italia GT3 '13",2162:"LaFerrari '13",2177:"Huracan GT3 '15",2183:"Corvette C7 Gr.3",2184:"F-type Gr.3",2186:"WRX Gr.3",3183:"PEUGEOT VGT (Gr.3)",3188:"SRT Tomahawk VGT (Gr.1)",3218:"M6 GT3 Endurance Model '16",3224:"Mercedes-AMG GT3 '16",3235:"NSX Gr.3",3247:"Corvette C7 Gr.4",3258:"Lancer Evolution Final Gr.4",3261:"WRX Gr.4",3263:"458 Italia Gr.4",3268:"911 GT3 RS (991) '16",3298:"TT Cup '16",3305:"Beetle Gr.3",3311:"911 RSR (991) '17",3334:"R18 '16",3350:"GT-R NISMO GT500 '16",3357:"S660 '15",3360:"McLaren P1 GTR '16",3373:"962 C '88",3394:"DBR9 GT1 '10",3405:"R8 LMS Evo '19",3419:"RX-VISION GT3 CONCEPT",3457:"A220 Race Car '68",3480:"Swift Sport Gr.4",3502:"Genesis X GR3"
  };

  let carNames = { ...fallbackCars };
  let fingerprints = loadJson(TRACKS_KEY, []);
  let trace = [];
  let lastSampleAt = 0;
  let lastPoint = null;
  let lastLapToken = null;
  let lastCompletedSignature = null;
  let currentIdentity = { car: null, track: null };
  let timer = null;

  function loadJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function bridgeBase() {
    return (localStorage.getItem('gt7_bridge_url') || BASE_DEFAULT).replace(/\/$/, '');
  }

  function parseCarsCsv(csv) {
    const map = {};
    for (const rawLine of String(csv || '').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('ID,')) continue;
      const first = line.indexOf(',');
      const last = line.lastIndexOf(',');
      if (first <= 0 || last <= first) continue;
      const id = Number(line.slice(0, first));
      const name = line.slice(first + 1, last).trim();
      if (Number.isFinite(id) && name) map[id] = name;
    }
    return map;
  }

  async function loadCarDatabase() {
    const cached = loadJson(CAR_CACHE_KEY, null);
    if (cached && typeof cached === 'object') carNames = { ...carNames, ...cached };
    try {
      const response = await fetch(CAR_DB_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = parseCarsCsv(await response.text());
      if (Object.keys(parsed).length > 100) {
        carNames = { ...carNames, ...parsed };
        saveJson(CAR_CACHE_KEY, parsed);
      }
    } catch (_) {}
  }

  function distance(a, b) {
    if (!a || !b) return Infinity;
    return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), (a.z || 0) - (b.z || 0));
  }

  function addPoint(position, speedKmh) {
    const now = Date.now();
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return;
    if (Number(speedKmh || 0) < 5) return;
    if (now - lastSampleAt < SAMPLE_MS) return;
    const point = { x: Number(position.x), y: Number(position.y || 0), z: Number(position.z), at: now };
    if (lastPoint && distance(point, lastPoint) < SAMPLE_DISTANCE_M) return;
    trace.push(point);
    if (trace.length > TRACE_LIMIT) trace.splice(0, trace.length - TRACE_LIMIT);
    lastPoint = point;
    lastSampleAt = now;
  }

  function summarize(points) {
    if (!Array.isArray(points) || points.length < 8) return null;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, sumX = 0, sumZ = 0, pathLength = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      sumX += p.x; sumZ += p.z;
      if (i) pathLength += distance(points[i - 1], p);
    }
    const width = Math.max(1, maxX - minX);
    const depth = Math.max(1, maxZ - minZ);
    return {
      pointCount: points.length,
      minX, maxX, minZ, maxZ,
      centerX: sumX / points.length,
      centerZ: sumZ / points.length,
      width, depth,
      diagonal: Math.hypot(width, depth),
      pathLength,
      start: { x: points[0].x, y: points[0].y, z: points[0].z },
      end: { x: points[points.length - 1].x, y: points[points.length - 1].y, z: points[points.length - 1].z }
    };
  }

  function relativeLog(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return 2;
    return Math.min(2, Math.abs(Math.log(a / b)));
  }

  function scoreFingerprint(current, reference, completed) {
    if (!current || !reference) return 0;
    const sizeDiff = (relativeLog(current.width, reference.width) + relativeLog(current.depth, reference.depth)) / 2;
    const refDiag = Math.max(50, reference.diagonal || Math.hypot(reference.width || 1, reference.depth || 1));
    const centerDist = Math.hypot((current.centerX || 0) - (reference.centerX || 0), (current.centerZ || 0) - (reference.centerZ || 0));
    const centerDiff = Math.min(2, centerDist / refDiag);
    const startDiff = Math.min(2, distance(current.start, reference.start) / 150);
    let pathDiff = 0.6;
    if (completed && current.pathLength > 0 && reference.pathLength > 0) pathDiff = relativeLog(current.pathLength, reference.pathLength);
    const total = completed
      ? sizeDiff * 0.35 + centerDiff * 0.2 + startDiff * 0.15 + pathDiff * 0.3
      : sizeDiff * 0.55 + centerDiff * 0.3 + startDiff * 0.15;
    return Math.max(0, Math.min(100, Math.round(100 - total * 72)));
  }

  function identifyTrack(signature, completed = false) {
    if (!signature || !fingerprints.length) return null;
    let best = null;
    for (const item of fingerprints) {
      const confidence = scoreFingerprint(signature, item.signature, completed);
      if (!best || confidence > best.confidence) best = { name: item.name, confidence, learnedAt: item.learnedAt };
    }
    return best && best.confidence >= 45 ? best : null;
  }

  function normalizeName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ');
  }

  function learnTrack(name, signature) {
    const clean = normalizeName(name);
    if (!clean || !signature || signature.pointCount < 8) return { ok: false, message: 'Digite a pista e rode ao menos alguns segundos.' };
    const key = clean.toLocaleLowerCase('pt-BR');
    const existingIndex = fingerprints.findIndex((item) => item.key === key);
    const entry = { key, name: clean, signature, learnedAt: new Date().toISOString() };
    if (existingIndex >= 0) fingerprints[existingIndex] = entry;
    else fingerprints.push(entry);
    fingerprints = fingerprints.slice(-100);
    saveJson(TRACKS_KEY, fingerprints);
    return { ok: true, message: `Pista “${clean}” aprendida. Nas próximas sessões ela será sugerida automaticamente.` };
  }

  function ensureUi() {
    const grid = document.querySelector('#dash .grid');
    if (grid && !$('identityCarCard')) {
      const car = document.createElement('div');
      car.id = 'identityCarCard';
      car.className = 'card tile wide identity-card';
      car.innerHTML = '<div class="label">CARRO DETECTADO</div><div id="identityCarName" class="val cyan">Aguardando...</div><div class="sub"><span id="identityCarMeta" class="identity-muted">CarCode --</span><span class="identity-badge">AUTO</span></div>';
      const track = document.createElement('div');
      track.id = 'identityTrackCard';
      track.className = 'card tile wide identity-card';
      track.innerHTML = '<div class="label">PISTA IDENTIFICADA</div><div id="identityTrackName" class="val">Aguardando volta...</div><div class="sub"><span id="identityTrackMeta" class="identity-muted">Aprendizado local</span><span id="identityTrackConfidence" class="identity-badge">--%</span></div>';
      const udm = grid.querySelector('.wide');
      grid.insertBefore(car, udm || null);
      grid.insertBefore(track, udm || null);
    }

    const startButton = $('startSec');
    if (startButton && !$('learnTrackBtn')) {
      const button = document.createElement('button');
      button.id = 'learnTrackBtn';
      button.className = 'btn';
      button.textContent = 'APRENDER / ATUALIZAR PISTA';
      const status = document.createElement('div');
      status.id = 'learnTrackStatus';
      status.className = 'learn-track-status';
      status.textContent = 'Digite o nome da pista, rode uma volta e toque em aprender.';
      startButton.insertAdjacentElement('afterend', button);
      button.insertAdjacentElement('afterend', status);
      button.addEventListener('click', () => {
        const name = $('track')?.value;
        const sig = lastCompletedSignature || summarize(trace);
        const result = learnTrack(name, sig);
        status.textContent = result.message;
        if (result.ok) {
          currentIdentity.track = { name: normalizeName(name), confidence: 100 };
          renderIdentity();
        }
      });
    }
  }

  function renderIdentity() {
    ensureUi();
    const carName = $('identityCarName');
    const carMeta = $('identityCarMeta');
    const trackName = $('identityTrackName');
    const trackMeta = $('identityTrackMeta');
    const trackConfidence = $('identityTrackConfidence');

    if (carName) carName.textContent = currentIdentity.car?.name || 'Carro não identificado';
    if (carMeta) carMeta.textContent = currentIdentity.car ? `CarCode ${currentIdentity.car.code}${currentIdentity.car.category ? ` · ${currentIdentity.car.category}` : ''}` : 'CarCode --';
    if (trackName) trackName.textContent = currentIdentity.track?.name || 'Pista ainda não identificada';
    if (trackMeta) trackMeta.textContent = currentIdentity.track ? 'Reconhecimento por assinatura da volta' : `${fingerprints.length} pista(s) aprendida(s)`;
    if (trackConfidence) trackConfidence.textContent = currentIdentity.track ? `${currentIdentity.track.confidence}%` : '--%';

    const carInput = $('car');
    if (carInput && currentIdentity.car?.name && (!carInput.value.trim() || /^CAR-ID-/i.test(carInput.value.trim()))) carInput.value = currentIdentity.car.name;
    const trackInput = $('track');
    if (trackInput && currentIdentity.track?.confidence >= 65 && !trackInput.value.trim()) trackInput.value = currentIdentity.track.name;
  }

  function handleLap(live, telemetry) {
    const lap = live?.lap || telemetry?.lap || {};
    const token = Number(lap.lastLapMs || lap.lastMs || 0);
    if (!token || token === lastLapToken) return;
    lastLapToken = token;
    const signature = summarize(trace);
    if (signature) {
      signature.lapMs = token;
      lastCompletedSignature = signature;
      const manualName = normalizeName($('track')?.value);
      if (manualName) learnTrack(manualName, signature);
      currentIdentity.track = identifyTrack(signature, true);
    }
    trace = [];
    lastPoint = null;
  }

  async function refreshIdentity() {
    ensureUi();
    try {
      const response = await fetch(`${bridgeBase()}/api/live`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const live = payload.live || payload;
      const telemetry = live.telemetry || {};
      const carCode = Number(telemetry.carCode ?? live.car?.carCode);
      const name = carNames[carCode] || (Number.isFinite(carCode) ? `CAR-ID-${carCode}` : null);
      currentIdentity.car = name ? { code: carCode, name, category: telemetry.packetC?.carCategory || live.car?.category || null } : null;

      const position = telemetry.position;
      const speed = telemetry.motion?.speedKmh ?? live.car?.speedKmh;
      addPoint(position, speed);
      handleLap(live, telemetry);

      if (!currentIdentity.track && trace.length >= 24) {
        currentIdentity.track = identifyTrack(summarize(trace), false);
      }
      renderIdentity();
    } catch (_) {
      renderIdentity();
    }
  }

  function enableFullscreen() {
    document.documentElement.classList.add('fullscreen-app');
    const request = () => {
      const element = document.documentElement;
      if (!document.fullscreenElement && element.requestFullscreen) element.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    };
    document.addEventListener('pointerdown', request, { once: true, passive: true });
    document.addEventListener('touchstart', request, { once: true, passive: true });
  }

  function init() {
    ensureUi();
    enableFullscreen();
    loadCarDatabase().finally(renderIdentity);
    $('track')?.addEventListener('change', () => {
      const status = $('learnTrackStatus');
      if (status && $('track').value.trim()) status.textContent = 'Nome registrado. Rode uma volta e toque em aprender.';
    });
    $('saveSec')?.addEventListener('click', () => {
      const name = $('track')?.value;
      const sig = lastCompletedSignature || summarize(trace);
      if (name && sig) learnTrack(name, sig);
    });
    refreshIdentity();
    timer = setInterval(refreshIdentity, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  window.addEventListener('beforeunload', () => timer && clearInterval(timer));
})();
