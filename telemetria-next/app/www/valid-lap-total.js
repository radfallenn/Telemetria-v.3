'use strict';

(function () {
  const STORAGE_KEY = 'gt7_next_valid_laps_v1';
  const NETWORK_KEY = 'gt7_telemetria_next_network_v1';
  const MIN_VALID_LAP_MS = 30_000;
  const MAX_VALID_LAP_MS = 900_000;
  let painting = false;

  function readNetworkIdentity() {
    try {
      const network = JSON.parse(localStorage.getItem(NETWORK_KEY) || '{}');
      return `${network.bridgeUrl || ''}|${network.ps5Ip || ''}`;
    } catch { return ''; }
  }

  function validLap(value) {
    const milliseconds = Number(value);
    return Number.isFinite(milliseconds) && milliseconds >= MIN_VALID_LAP_MS && milliseconds <= MAX_VALID_LAP_MS;
  }

  function lapMilliseconds(value) {
    if (value && typeof value === 'object') {
      if (value.valid === false || value.isValid === false || value.invalid === true || value.isInvalid === true) return null;
      value = value.ms ?? value.timeMs ?? value.lapTimeMs ?? value.durationMs ?? value.lastLapMs ?? value.time;
    }
    return validLap(value) ? Math.round(Number(value)) : null;
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        identity: String(saved.identity || ''),
        validLapTimes: Array.isArray(saved.validLapTimes) ? saved.validLapTimes.map(lapMilliseconds).filter(validLap) : [],
        lastToken: String(saved.lastToken || ''),
        lastLapNumber: Math.max(0, Number(saved.lastLapNumber) || 0)
      };
    } catch {
      return { identity: '', validLapTimes: [], lastToken: '', lastLapNumber: 0 };
    }
  }

  let session = loadState();

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); }
  function reset(identity = readNetworkIdentity()) {
    session = { identity, validLapTimes: [], lastToken: '', lastLapNumber: 0 };
    saveState();
    paint();
  }

  function formatTime(value) {
    let milliseconds = Math.max(0, Math.round(Number(value) || 0));
    if (!milliseconds) return '--';
    const hours = Math.floor(milliseconds / 3_600_000);
    milliseconds %= 3_600_000;
    const minutes = Math.floor(milliseconds / 60_000);
    milliseconds %= 60_000;
    const seconds = Math.floor(milliseconds / 1000);
    const millis = milliseconds % 1000;
    const core = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
    return hours ? `${String(hours).padStart(2, '0')}:${core}` : core;
  }

  function payloadData(payload) {
    const root = payload?.state || payload || {};
    const telemetry = root.telemetry || payload?.telemetry || {};
    return { root, telemetry };
  }

  function explicitValidLapTimes(root, telemetry) {
    const sources = [
      telemetry.validLapTimes, root.validLapTimes, telemetry.lapTimes, telemetry.completedLapTimes,
      root.lapTimes, root.completedLapTimes, root.session?.validLaps, root.session?.laps,
      root.activeSession?.validLaps, root.activeSession?.laps
    ];
    const source = sources.find((list) => Array.isArray(list) && list.length);
    return source ? source.map(lapMilliseconds).filter(validLap) : [];
  }

  function update(payload) {
    const identity = readNetworkIdentity();
    if (session.identity !== identity) reset(identity);
    const { root, telemetry } = payloadData(payload);
    const lapNumber = Math.max(0, Number(telemetry.lapNumber ?? root.lapNumber ?? 0) || 0);
    const lastLapMs = lapMilliseconds(telemetry.lastLapMs ?? root.lastLapMs);
    const lastLapDeclaredValid = (telemetry.lastLapValid ?? root.lastLapValid) !== false;
    const complete = explicitValidLapTimes(root, telemetry);

    if (complete.length) {
      session.validLapTimes = complete;
      session.lastToken = `${complete.length}:${complete.at(-1)}`;
    } else {
      const sessionRestarted =
        (session.lastLapNumber > 1 && lapNumber === 0) ||
        (lapNumber > 0 && session.lastLapNumber > 0 && lapNumber < session.lastLapNumber);
      if (sessionRestarted) {
        session.validLapTimes = [];
        session.lastToken = '';
      }
      if (lastLapDeclaredValid && lastLapMs && lapNumber > 1) {
        const token = `${lapNumber - 1}:${lastLapMs}`;
        if (token !== session.lastToken) {
          session.validLapTimes.push(lastLapMs);
          session.lastToken = token;
        }
      }
    }
    session.lastLapNumber = lapNumber;
    saveState();
    paint();
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element && element.textContent !== value) element.textContent = value;
  }

  function paint() {
    if (painting) return;
    painting = true;

    const lapCount = session.validLapTimes.length;
    const totalMs = session.validLapTimes.reduce((sum, milliseconds) => sum + milliseconds, 0);
    const averageMs = lapCount > 0 ? Math.round(totalMs / lapCount) : 0;
    const formattedTotal = formatTime(totalMs);
    const formattedAverage = averageMs ? formatTime(averageMs) : '--:--.---';

    for (const id of ['totalTime', 'totalTimePage', 'averageTotalTime']) setText(id, formattedTotal);
    setText('validLaps', String(lapCount));
    setText('averageLapCount', String(lapCount));
    setText('averageLapTime', formattedAverage);

    painting = false;
  }

  function install() {
    if (typeof window.render === 'function' && !window.render.__validLapTotal) {
      const previous = window.render;
      const wrapped = function (payload) {
        const result = previous.apply(this, arguments);
        update(payload);
        return result;
      };
      wrapped.__validLapTotal = true;
      window.render = wrapped;
    }

    for (const id of ['totalTime', 'totalTimePage', 'averageTotalTime', 'averageLapTime', 'averageLapCount']) {
      const element = document.getElementById(id);
      if (element) new MutationObserver(paint).observe(element, { childList: true, subtree: true, characterData: true });
    }

    paint();
    setInterval(paint, 250);
  }

  window.gt7ValidLapTotal = {
    reset,
    get validLapTimes() { return [...session.validLapTimes]; },
    get totalMs() { return session.validLapTimes.reduce((sum, milliseconds) => sum + milliseconds, 0); },
    get averageMs() {
      return session.validLapTimes.length
        ? Math.round(session.validLapTimes.reduce((sum, milliseconds) => sum + milliseconds, 0) / session.validLapTimes.length)
        : 0;
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
