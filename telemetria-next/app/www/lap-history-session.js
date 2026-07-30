'use strict';

(function () {
  const LAPS_KEY = 'gt7_next_all_laps_v1';
  const SESSION_KEY = 'gt7_next_session_meta_v1';
  let state = loadLapState();

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

  function lapData(payload) {
    const root = payload?.state || payload || {};
    const telemetry = root.telemetry || payload?.telemetry || {};
    const lapNumber = Math.max(0, Number(telemetry.lapNumber ?? root.lapNumber ?? 0) || 0);
    const lastLapMs = Number(telemetry.lastLapMs ?? root.lastLapMs ?? 0);
    const validity = telemetry.lastLapValid ?? root.lastLapValid;
    return {
      lapNumber,
      lastLapMs,
      valid: validity !== false
    };
  }

  function register(payload) {
    const identity = networkIdentity();
    if (state.identity !== identity) {
      state = { identity, laps: [], lastToken: '', lastLapNumber: 0 };
    }

    const data = lapData(payload);
    const restarted =
      (state.lastLapNumber > 1 && data.lapNumber === 0) ||
      (data.lapNumber > 0 && state.lastLapNumber > 0 && data.lapNumber < state.lastLapNumber);

    if (restarted) {
      state.laps = [];
      state.lastToken = '';
    }

    if (Number.isFinite(data.lastLapMs) && data.lastLapMs > 0 && data.lapNumber > 1) {
      const completedLap = data.lapNumber - 1;
      const token = `${completedLap}:${Math.round(data.lastLapMs)}`;
      if (token !== state.lastToken) {
        state.laps.push({
          lap: completedLap,
          timeMs: Math.round(data.lastLapMs),
          valid: data.valid,
          savedAt: new Date().toISOString()
        });
        state.lastToken = token;
      }
    }

    state.lastLapNumber = data.lapNumber;
    saveLapState();
    paintLaps();
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
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    } catch {
      return {};
    }
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
      const value = {
        track: track.value.trim(),
        car: car.value.trim(),
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      if (result) result.textContent = 'Pista e carro salvos neste dispositivo.';
    });
  }

  function install() {
    if (typeof window.render === 'function' && !window.render.__allLapsHistory) {
      const previous = window.render;
      const wrapped = function (payload) {
        const result = previous.apply(this, arguments);
        register(payload);
        return result;
      };
      wrapped.__allLapsHistory = true;
      window.render = wrapped;
    }

    installSessionMeta();
    paintLaps();
  }

  window.gt7AllLaps = {
    get laps() { return [...state.laps]; },
    reset() {
      state = { identity: networkIdentity(), laps: [], lastToken: '', lastLapNumber: 0 };
      saveLapState();
      paintLaps();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
