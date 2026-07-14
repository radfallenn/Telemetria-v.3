/* GT7 Telemetria - controlador unico e automatico da Bridge */
(function(){
  'use strict';

  if (window.__gt7BridgeControllerStarted) return;
  window.__gt7BridgeControllerStarted = true;

  const BRIDGE = 'http://192.168.1.70:8788';
  const PS5 = '192.168.1.71';
  const q = id => document.getElementById(id);

  let retryTimer = 0;
  let busy = false;
  let failures = 0;
  let lastOkAt = 0;
  let lastLatency = 0;
  let lastPayload = null;
  let ps5Configured = false;

  function setFixedConfiguration(){
    if (q('bridgeUrl')) q('bridgeUrl').value = BRIDGE;
    if (q('ps5Ip')) q('ps5Ip').value = PS5;
    localStorage.setItem('gt7_bridge_url', BRIDGE);
    localStorage.setItem('gt7_bridge', BRIDGE);
    localStorage.setItem('gt7_ps5_ip', PS5);
  }

  function parsePayload(value){
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return {}; }
    }
    return value && typeof value === 'object' ? value : {};
  }

  async function request(path, method = 'GET', data = null, timeout = 5000){
    const url = BRIDGE + path;
    const nativeHttp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;

    if (nativeHttp && typeof nativeHttp.request === 'function') {
      const response = await nativeHttp.request({
        url,
        method,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        data: method === 'GET' ? undefined : (data || {}),
        connectTimeout: timeout,
        readTimeout: timeout
      });
      const status = Number(response.status || 0);
      if (status < 200 || status >= 300) throw new Error('HTTP ' + status + ' ' + path);
      return parsePayload(response.data);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        method,
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(data || {})
      });
      if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + path);
      return parsePayload(await response.text());
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function readTelemetry(){
    const endpoints = ['/api/live', '/api/fields'];
    let lastError;
    for (const endpoint of endpoints) {
      try {
        const result = await request(endpoint, 'GET', null, 4500);
        if (result && typeof result === 'object') return result;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Bridge sem resposta');
  }

  function normalize(raw){
    const root = parsePayload(raw);
    const live = root.live && typeof root.live === 'object' ? root.live : root;
    const session = root.session || root.active || live.session || {};
    return {
      ...live,
      session,
      connected: true,
      decodeOk: live.decodeOk !== false
    };
  }

  function setStatus(state, message){
    const fresh = Date.now() - lastOkAt < 10000;
    const connected = state === 'ok' || fresh;
    const waiting = state === 'wait' && !connected;

    if (q('topStatus')) q('topStatus').textContent = connected ? 'OK' : waiting ? '...' : 'OFF';
    if (q('latency')) q('latency').textContent = connected ? lastLatency + 'ms' : '--ms';
    if (q('statusDot')) {
      q('statusDot').style.background = connected ? 'var(--cyan)' : waiting ? '#ffb000' : '#555';
      q('statusDot').style.boxShadow = connected ? '0 0 18px var(--cyan)' : 'none';
    }
    if (q('bridgeText')) {
      q('bridgeText').textContent = connected
        ? 'OK · GT7-UDP · 8788'
        : waiting
          ? 'CONECTANDO AUTOMATICAMENTE · 8788'
          : 'OFF · ' + (message || 'SEM RESPOSTA');
    }
  }

  async function configurePs5(){
    if (ps5Configured) return;
    const attempts = [
      ['/api/config', { ps5Ip: PS5 }],
      ['/api/settings', { ps5Ip: PS5 }],
      ['/api/ps5', { ip: PS5 }]
    ];
    for (const [path, body] of attempts) {
      try {
        await request(path, 'POST', body, 3000);
        ps5Configured = true;
        return;
      } catch {}
    }
  }

  function stopLegacyPolling(){
    try {
      if (typeof timer !== 'undefined' && timer) {
        clearInterval(timer);
        timer = null;
      }
    } catch {}
    try {
      if (window.__v4PersistentBridgeTimer) clearTimeout(window.__v4PersistentBridgeTimer);
    } catch {}
  }

  async function tick(){
    if (busy) return;
    busy = true;
    const started = performance.now();

    try {
      const raw = await readTelemetry();
      const data = normalize(raw);
      lastLatency = Math.max(1, Math.round(performance.now() - started));
      lastOkAt = Date.now();
      lastPayload = data;
      failures = 0;

      if (typeof window.render === 'function') {
        try { window.render(data); } catch (error) { console.warn('Erro visual sem derrubar a Bridge:', error); }
      }

      setStatus('ok');
      configurePs5();
    } catch (error) {
      failures += 1;
      setStatus(failures < 5 ? 'wait' : 'off', error && error.message ? error.message : 'SEM RESPOSTA');
    } finally {
      busy = false;
      clearTimeout(retryTimer);
      const delay = failures ? Math.min(3000, 700 + failures * 350) : 750;
      retryTimer = setTimeout(tick, delay);
    }
  }

  async function command(path, data){
    return request(path, 'POST', data || {}, 6000);
  }

  function start(){
    setFixedConfiguration();
    stopLegacyPolling();
    clearTimeout(retryTimer);
    failures = 0;
    setStatus('wait');
    tick();
  }

  function bind(){
    setFixedConfiguration();
    stopLegacyPolling();

    if (q('connectBtn')) q('connectBtn').onclick = start;
    if (q('startSection')) q('startSection').onclick = async () => {
      await command('/api/session/start', { name: 'Nova seção' });
      tick();
    };
    if (q('saveSection')) q('saveSection').onclick = async () => {
      const name = prompt('Nome da seção:', 'Seção ' + new Date().toLocaleString('pt-BR'));
      if (name !== null) {
        await command('/api/session/finish', { name });
        tick();
      }
    };
    if (q('resetSection')) q('resetSection').onclick = async () => {
      await command('/api/reset', {});
      tick();
    };

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) start();
    });
    window.addEventListener('online', start);
    window.addEventListener('focus', () => {
      if (Date.now() - lastOkAt > 3000) start();
    });

    start();
  }

  window.gt7Bridge = {
    start,
    tick,
    request,
    get connected(){ return Date.now() - lastOkAt < 10000; },
    get lastData(){ return lastPayload; }
  };
  window.api = command;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    setTimeout(bind, 0);
  }
})();
