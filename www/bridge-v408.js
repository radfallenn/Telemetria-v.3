/* GT7 Telemetria - conexão limpa, única e automática */
(function(){
  'use strict';

  if (window.__gt7CleanBridgeStarted) return;
  window.__gt7CleanBridgeStarted = true;

  const BRIDGE = 'http://192.168.1.70:8788';
  const PS5 = '192.168.1.71';
  const q = id => document.getElementById(id);

  let timer = 0;
  let running = false;
  let failures = 0;
  let lastOkAt = 0;
  let lastLatency = 0;
  let lastData = null;
  let activeEndpoint = '';
  let lastError = '';

  function applyFixedConfig(){
    if (q('bridgeUrl')) q('bridgeUrl').value = BRIDGE;
    if (q('ps5Ip')) q('ps5Ip').value = PS5;
    localStorage.setItem('gt7_bridge_url', BRIDGE);
    localStorage.setItem('gt7_bridge', BRIDGE);
    localStorage.setItem('gt7_ps5_ip', PS5);
  }

  function parse(value){
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (e) { throw new Error('JSON inválido'); }
    }
    if (!value || typeof value !== 'object') throw new Error('Resposta vazia');
    return value;
  }

  function nativePlugin(){
    return window.CapacitorHttp ||
      (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) ||
      null;
  }

  async function http(path, options = {}){
    const method = options.method || 'GET';
    const data = options.data || null;
    const timeout = options.timeout || 4500;
    const url = BRIDGE + path;
    const plugin = nativePlugin();

    if (plugin && typeof plugin.request === 'function') {
      const response = await plugin.request({
        url,
        method,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        data: method === 'GET' ? undefined : data,
        connectTimeout: timeout,
        readTimeout: timeout
      });
      const status = Number(response.status || 0);
      if (status < 200 || status >= 300) throw new Error('HTTP ' + status + ' em ' + path);
      return parse(response.data);
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
      if (!response.ok) throw new Error('HTTP ' + response.status + ' em ' + path);
      return parse(await response.text());
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('Timeout em ' + path);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function getTelemetry(){
    const endpoints = ['/api/live', '/api/fields'];
    const errors = [];
    for (const endpoint of endpoints) {
      try {
        const payload = await http(endpoint, { timeout: 4200 });
        activeEndpoint = endpoint;
        return payload;
      } catch (error) {
        errors.push(endpoint + ': ' + (error.message || error));
      }
    }
    throw new Error(errors.join(' | '));
  }

  function normalize(raw){
    const root = parse(raw);
    const live = root.live && typeof root.live === 'object' ? root.live : root;
    const session = root.session || root.active || live.session || {};
    return {
      ...live,
      session,
      connected: true,
      decodeOk: live.decodeOk !== false,
      bridgeEndpoint: activeEndpoint,
      bridgeUrl: BRIDGE,
      ps5Ip: PS5
    };
  }

  function paint(state, detail){
    const fresh = Date.now() - lastOkAt < 9000;
    const ok = state === 'ok' || fresh;
    const waiting = state === 'wait' && !ok;

    if (q('topStatus')) q('topStatus').textContent = ok ? 'OK' : waiting ? '...' : 'OFF';
    if (q('latency')) q('latency').textContent = ok ? lastLatency + 'ms' : '--ms';
    if (q('statusDot')) {
      q('statusDot').style.background = ok ? 'var(--cyan)' : waiting ? '#ffb000' : '#555';
      q('statusDot').style.boxShadow = ok ? '0 0 18px var(--cyan)' : 'none';
    }
    if (q('bridgeText')) {
      q('bridgeText').textContent = ok
        ? 'OK · ' + (activeEndpoint || 'GT7-UDP') + ' · 8788'
        : waiting
          ? 'CONECTANDO AUTOMATICAMENTE · 8788'
          : 'OFF · ' + (detail || lastError || 'SEM RESPOSTA');
    }
  }

  function writeDiagnostic(){
    const raw = q('raw');
    if (!raw) return;
    const diagnostic = {
      bridge: BRIDGE,
      ps5: PS5,
      endpoint: activeEndpoint || null,
      connected: Date.now() - lastOkAt < 9000,
      latencyMs: lastLatency || null,
      failures,
      lastError: lastError || null,
      lastData
    };
    raw.textContent = JSON.stringify(diagnostic, null, 2);
  }

  async function configurePs5(){
    const attempts = [
      ['/api/config', { ps5Ip: PS5 }],
      ['/api/settings', { ps5Ip: PS5 }],
      ['/api/ps5', { ip: PS5 }]
    ];
    for (const [path, data] of attempts) {
      try { await http(path, { method: 'POST', data, timeout: 2500 }); return true; } catch (_) {}
    }
    return false;
  }

  function stopLegacy(){
    try { if (typeof window.timer !== 'undefined' && window.timer) clearInterval(window.timer); } catch (_) {}
    try { if (typeof timer !== 'undefined' && timer && timer !== window.__gt7CleanTimer) clearInterval(timer); } catch (_) {}
    try { if (window.__v4PersistentBridgeTimer) clearTimeout(window.__v4PersistentBridgeTimer); } catch (_) {}
    try { if (window.v4PersistentBridge && typeof window.v4PersistentBridge.stop === 'function') window.v4PersistentBridge.stop(); } catch (_) {}
  }

  async function tick(){
    if (running || document.hidden) return;
    running = true;
    const started = performance.now();
    try {
      const raw = await getTelemetry();
      const data = normalize(raw);
      lastLatency = Math.max(1, Math.round(performance.now() - started));
      lastOkAt = Date.now();
      lastData = data;
      lastError = '';
      failures = 0;

      if (typeof window.render === 'function') {
        try { window.render(data); } catch (error) { console.warn('Render não derrubou a Bridge:', error); }
      }
      paint('ok');
      if (!window.__gt7Ps5Configured) {
        configurePs5().then(ok => { if (ok) window.__gt7Ps5Configured = true; });
      }
    } catch (error) {
      failures += 1;
      lastError = error && error.message ? error.message : String(error);
      paint(failures < 4 ? 'wait' : 'off', lastError);
      writeDiagnostic();
    } finally {
      running = false;
      clearTimeout(timer);
      const delay = failures ? Math.min(3000, 900 + failures * 350) : 750;
      timer = setTimeout(tick, delay);
      window.__gt7CleanTimer = timer;
    }
  }

  async function command(path, data){
    return http(path, { method: 'POST', data: data || {}, timeout: 6000 });
  }

  function start(){
    applyFixedConfig();
    stopLegacy();
    clearTimeout(timer);
    failures = 0;
    lastError = '';
    paint('wait');
    tick();
  }

  function bind(){
    applyFixedConfig();
    stopLegacy();

    if (q('connectBtn')) q('connectBtn').onclick = start;
    if (q('startSection')) q('startSection').onclick = async () => { await command('/api/session/start', { name: 'Nova seção' }); tick(); };
    if (q('saveSection')) q('saveSection').onclick = async () => {
      const name = prompt('Nome da seção:', 'Seção ' + new Date().toLocaleString('pt-BR'));
      if (name !== null) { await command('/api/session/finish', { name }); tick(); }
    };
    if (q('resetSection')) q('resetSection').onclick = async () => { await command('/api/reset', {}); tick(); };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTimeout(timer);
      else start();
    });
    window.addEventListener('online', start);
    window.addEventListener('focus', start);

    start();
  }

  window.gt7Bridge = {
    start,
    tick,
    request: http,
    command,
    get connected(){ return Date.now() - lastOkAt < 9000; },
    get lastData(){ return lastData; },
    get lastError(){ return lastError; },
    get endpoint(){ return activeEndpoint; }
  };
  window.api = command;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else setTimeout(bind, 0);
})();