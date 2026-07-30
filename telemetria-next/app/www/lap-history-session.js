'use strict';

(function () {
  const LAPS_KEY = 'gt7_next_all_laps_v1';
  const SESSION_KEY = 'gt7_next_session_meta_v1';
  let state = loadLapState();
  let lastVisibleLap = 0;
  let lastValidCount = 0;

  function loadLapState() {
    try {
      const saved = JSON.parse(localStorage.getItem(LAPS_KEY) || '{}');
      return {
        identity: String(saved.identity || ''),
        laps: Array.isArray(saved.laps) ? saved.laps : [],
        lastToken: String(saved.lastToken || ''),
        lastLapNumber: Math.max(0, Number(saved.lastLapNumber) || 0)
      };
    } catch {
      return { identity: '', laps: [], lastToken: '', lastLapNumber: 0 };
    }
  }

  function saveLapState() {
    localStorage.setItem(LAPS_KEY, JSON.stringify(state));
  }

  function networkIdentity() {
    try {
      const network = JSON.parse(localStorage.getItem('gt7_telemetria_next_network_v1') || '{}');
      return `${network.bridgeUrl || ''}|${network.ps5Ip || ''}`;
    } catch {
      return '';
    }
  }

  function formatLap(milliseconds) {
    const value = Number(milliseconds);
    if (!Number.isFinite(value) || value <= 0) return '--:--.---';
    const minutes = Math.floor(value / 60000);
    const seconds = Math.floor((value % 60000) / 1000);
    const millis = Math.floor(value % 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  function parseLapTime(value) {
    const match = String(value || '').trim().match(/^(\d+):(\d{2})[.,](\d{3})$/);
    if (!match) return 0;
    return Number(match[1]) * 60000 + Number(match[2]) * 1000 + Number(match[3]);
  }

  function visibleLapNumber() {
    const match = String(document.getElementById('lapNumber')?.textContent || '').match(/\d+/);
    return match ? Math.max(0, Number(match[0]) || 0) : 0;
  }

  function visibleValidCount() {
    return Math.max(0, Number(document.getElementById('validLaps')?.textContent) || 0);
  }

  function registerVisibleLap() {
    const identity = networkIdentity();
    if (state.identity !== identity) {
      state = { identity, laps: [], lastToken: '', lastLapNumber: 0 };
      lastVisibleLap = 0;
      lastValidCount = 0;
    }

    const lapNumber = visibleLapNumber();
    const validCount = visibleValidCount();
    const lastLapMs = parseLapTime(
      document.getElementById('lastLapPage')?.textContent ||
      document.getElementById('lastLap')?.textContent
    );

    const restarted =
      (lastVisibleLap > 1 && lapNumber === 0) ||
      (lapNumber > 0 && lastVisibleLap > 0 && lapNumber < lastVisibleLap);

    if (restarted) {
      state.laps = [];
      state.lastToken = '';
      lastValidCount = 0;
    }

    if (lapNumber > 1 && lastLapMs > 0) {
      const completedLap = lapNumber - 1;
      const token = `${completedLap}:${lastLapMs}`;
      if (token !== state.lastToken) {
        const valid = validCount > lastValidCount;
        const entry = {
          lap: completedLap,
          timeMs: lastLapMs,
          valid,
          savedAt: new Date().toISOString()
        };
        state.laps.push(entry);
        state.lastToken = token;
        saveLapState();
        paintLaps();
        window.dispatchEvent(new CustomEvent('gt7-lap-recorded', { detail: entry }));
      }
    }

    lastVisibleLap = lapNumber;
    lastValidCount = validCount;
    state.lastLapNumber = lapNumber;
    saveLapState();
  }

  function paintLaps() {
    const list = document.getElementById('allLapsList');
    const count = document.getElementById('allLapsCount');
    if (count) count.textContent = String(state.laps.length);
    if (!list) return;

    if (!state.laps.length) {
      list.innerHTML = '<div class="lap-history-empty">Nenhuma volta concluída registrada.</div>';
      return;
    }

    list.innerHTML = [...state.laps].reverse().map((lap) =>
      `<div class="lap-history-row${lap.valid ? '' : ' invalid'}">` +
        `<span>VOLTA ${lap.lap}</span>` +
        `<strong>${formatLap(lap.timeMs)}</strong>` +
        `<span class="lap-status">${lap.valid ? 'VÁLIDA' : 'INVÁLIDA'}</span>` +
      `</div>`
    ).join('');
  }

  function loadSessionMeta() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); }
    catch { return {}; }
  }

  function installSessionMeta() {
    const track = document.getElementById('sessionTrack');
    const car = document.getElementById('sessionCar');
    const save = document.getElementById('saveSessionMeta');
    const result = document.getElementById('sessionMetaResult');
    if (!track || !car || !save) return;

    const saved = loadSessionMeta();
    track.value = saved.track || '';
    car.value = saved.car || '';

    save.addEventListener('click', () => {
      const value = { track: track.value.trim(), car: car.value.trim(), savedAt: new Date().toISOString() };
      localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      if (result) result.textContent = 'Pista e carro salvos neste dispositivo.';
    });
  }

  function install() {
    installSessionMeta();
    paintLaps();
    lastVisibleLap = visibleLapNumber();
    lastValidCount = visibleValidCount();
    setInterval(registerVisibleLap, 350);
  }

  window.gt7AllLaps = {
    get laps() { return [...state.laps]; },
    get validLaps() { return state.laps.filter((lap) => lap.valid); },
    reset() {
      state = { identity: networkIdentity(), laps: [], lastToken: '', lastLapNumber: 0 };
      saveLapState();
      paintLaps();
      window.dispatchEvent(new CustomEvent('gt7-laps-reset'));
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();