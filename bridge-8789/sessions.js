'use strict';

const fs = require('fs');

function formatMs(value) {
  let ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '--';
  const hours = Math.floor(ms / 3600000);
  ms %= 3600000;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return (hours ? String(hours).padStart(2, '0') + ':' : '') +
    String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + '.' + String(millis).padStart(3, '0');
}

const validLap = (value) => Number.isFinite(value) && value >= 30000 && value <= 900000;

function analyse(laps) {
  const values = laps.map((lap) => Number(lap.ms)).filter(validLap);
  const bestMs = values.length ? Math.min(...values) : 0;
  const lastMs = values.length ? values[values.length - 1] : 0;
  const totalMs = values.reduce((sum, value) => sum + value, 0);
  const sorted = values.slice().sort((a, b) => a - b);
  const trimmed = sorted.length >= 6 ? sorted.slice(1, -1) : sorted;
  const averageMs = trimmed.length ? Math.round(trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length) : 0;
  return { laps: laps.length, bestMs, best: formatMs(bestMs), lastMs, last: formatMs(lastMs), totalMs, total: formatMs(totalMs), averageMs, average: formatMs(averageMs) };
}

function load(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { version: 1, sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [], ranking: Array.isArray(parsed.ranking) ? parsed.ranking : [] };
  } catch {
    return { version: 1, sessions: [], ranking: [] };
  }
}

function save(file, database) {
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(database, null, 2));
  fs.renameSync(temporary, file);
}

function createSessionStore(file) {
  const database = load(file);
  let active = null;
  let lastToken = '';

  function start(name = 'Sessão automática') {
    active = { id: 's-' + Date.now(), name: String(name).slice(0, 80), startedAt: new Date().toISOString(), endedAt: null, laps: [], maxSpeed: 0, analysis: analyse([]) };
    lastToken = '';
    return active;
  }

  function finish(name) {
    if (!active) return null;
    if (name) active.name = String(name).slice(0, 80);
    active.endedAt = new Date().toISOString();
    active.analysis = analyse(active.laps);
    database.sessions.unshift(active);
    database.sessions = database.sessions.slice(0, 300);
    if (active.analysis.bestMs) {
      database.ranking.push({ sessionId: active.id, name: active.name, date: active.endedAt, bestMs: active.analysis.bestMs, best: active.analysis.best, laps: active.laps.length });
      database.ranking = database.ranking.sort((a, b) => a.bestMs - b.bestMs).slice(0, 100);
    }
    save(file, database);
    const completed = active;
    active = null;
    return completed;
  }

  function register(ms, reportedLap, maxSpeed) {
    if (!validLap(ms)) return false;
    if (!active) start();
    const token = reportedLap + ':' + ms;
    if (token === lastToken || active.laps.some((lap) => lap.token === token)) return false;
    lastToken = token;
    active.laps.push({ lap: active.laps.length + 1, reportedLap, ms, time: formatMs(ms), token, maxSpeed, at: new Date().toISOString() });
    active.maxSpeed = Math.max(active.maxSpeed, maxSpeed || 0);
    active.analysis = analyse(active.laps);
    return true;
  }

  return {
    start,
    finish,
    register,
    analyse,
    formatMs,
    get active() { return active; },
    get sessions() { return database.sessions; },
    get ranking() { return database.ranking; }
  };
}

module.exports = { createSessionStore, formatMs, validLap };
