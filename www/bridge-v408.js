/* GT7 Telemetria - controlador unico, adaptador V4.08 e diagnostico UDP */
(function(){
  'use strict';
  if (window.__gt7CleanBridgeStarted) return;
  window.__gt7CleanBridgeStarted = true;

  const BRIDGE = 'http://192.168.1.70:8788';
  const DEFAULT_PS5 = '192.168.1.81';
  const q = id => document.getElementById(id);

  let timer = 0;
  let running = false;
  let failures = 0;
  let lastHttpOkAt = 0;
  let lastPacketAt = 0;
  let lastLatency = 0;
  let lastData = null;
  let activeEndpoint = '';
  let lastError = '';
  let configuredPs5 = '';

  function validIp(value){
    const parts = String(value || '').trim().split('.');
    return parts.length === 4 && parts.every(p => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
  }

  function getPs5Ip(){
    const saved = localStorage.getItem('gt7_ps5_ip');
    return validIp(saved) ? saved : DEFAULT_PS5;
  }

  function savePs5Ip(value){
    const ip = String(value || '').trim();
    if (!validIp(ip)) return false;
    localStorage.setItem('gt7_ps5_ip', ip);
    configuredPs5 = '';
    if (q('ps5Ip')) q('ps5Ip').value = ip;
    configurePs5(true);
    return true;
  }

  function applyConfig(){
    if (q('bridgeUrl')) {
      q('bridgeUrl').value = BRIDGE;
      q('bridgeUrl').readOnly = true;
    }
    if (q('ps5Ip')) {
      q('ps5Ip').removeAttribute('readonly');
      q('ps5Ip').disabled = false;
      q('ps5Ip').value = getPs5Ip();
    }
    localStorage.setItem('gt7_bridge_url', BRIDGE);
    localStorage.setItem('gt7_bridge', BRIDGE);
  }

  function parse(value){
    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) return {};
      try { return JSON.parse(text); } catch { return { raw: text }; }
    }
    return value && typeof value === 'object' ? value : {};
  }

  function nativePlugin(){
    return window.CapacitorHttp ||
      (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || null;
  }

  async function http(path, options = {}){
    const method = options.method || 'GET';
    const data = options.data || null;
    const timeout = options.timeout || 4500;
    const url = BRIDGE + path;
    const plugin = nativePlugin();

    if (plugin && typeof plugin.request === 'function') {
      const response = await plugin.request({
        url, method,
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
        method, cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(data || {})
      });
      if (!response.ok) throw new Error('HTTP ' + response.status + ' em ' + path);
      return parse(await response.text());
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('Timeout em ' + path);
      throw error;
    } finally { clearTimeout(timeoutId); }
  }

  async function getTelemetry(){
    const endpoints = ['/api/live', '/api/fields', '/api/status'];
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

  function readPath(obj, path){
    return path.split('.').reduce((v, k) => v == null ? undefined : v[k], obj);
  }
  function first(obj, paths, fallback){
    for (const path of paths) {
      const value = readPath(obj, path);
      if (value !== undefined && value !== null && value !== '' && !(typeof value === 'number' && Number.isNaN(value))) return value;
    }
    return fallback;
  }
  function number(obj, paths, fallback = 0){
    const n = Number(first(obj, paths, fallback));
    return Number.isFinite(n) ? n : fallback;
  }
  function percent(value){
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    if (n >= 0 && n <= 1) return n * 100;
    if (n > 100 && n <= 255) return n / 2.55;
    return Math.max(0, Math.min(100, n));
  }
  function formatMs(value){
    let ms = Number(value);
    if (!Number.isFinite(ms) || ms <= 0) return '--';
    const h = Math.floor(ms / 3600000); ms %= 3600000;
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const x = Math.floor(ms % 1000);
    return (h ? String(h).padStart(2,'0') + ':' : '') + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + '.' + String(x).padStart(3,'0');
  }

  /* Adaptador restaurado do APK V4.08, ampliado para os parsers enviados. */
  function adapt(raw){
    const root = parse(raw);
    const source = root.live && typeof root.live === 'object' ? root.live :
      root.fields && typeof root.fields === 'object' ? root.fields :
      root.data && typeof root.data === 'object' ? root.data :
      root.telemetry && typeof root.telemetry === 'object' ? root.telemetry : root;
    const merged = { ...root, ...source };
    const session = root.session || root.active || source.session || {};
    const car = source.car || merged.car || {};
    const input = source.input || source.controls || {};
    const fuel = source.fuel || {};
    const lap = source.lap || {};
    const legacy = source.legacy || {};

    const speed = number(merged, ['velocidade','speedKmh','carSpeedKmh','car.speedKmh','vehicle.speedKmh','legacy.speedKmh','speed'], 0);
    const rpm = number(merged, ['rpm','engineRpm','car.rpm','engine.rpm','legacy.rpm'], 0);
    let gear = first(merged, ['marcha','gear','currentGear','car.gear','transmission.gear','legacy.gear'], 'N');
    if (gear === 0 || gear === '0' || gear === 15) gear = 'N';
    const throttle = percent(first(merged, ['acelerador','throttlePct','input.throttlePct','input.throttle','controls.throttlePct','legacy.throttlePct','throttle'], 0));
    const brake = percent(first(merged, ['freio','brakePct','input.brakePct','input.brake','controls.brakePct','legacy.brakePct','brake'], 0));
    const currentFuel = Number(first(merged, ['fuelCurrent','fuel.current','fuelLevel','currentFuel'], NaN));
    const capacityFuel = Number(first(merged, ['fuelCapacity','fuel.capacity','fuelMax','maxFuel'], NaN));
    const fuelPctRaw = first(merged, ['combustivelPorcentagem','fuelPct','fuel.percent','fuel.percentage','legacy.fuelPct'], NaN);
    const fuelPct = Number.isFinite(Number(fuelPctRaw)) ? percent(fuelPctRaw) :
      (Number.isFinite(currentFuel) && Number.isFinite(capacityFuel) && capacityFuel > 0 ? currentFuel / capacityFuel * 100 : 0);

    const bestMs = number(merged, ['bestLapMs','lap.bestLapMs','session.bestLapMs','bestLap'], 0);
    const lastMs = number(merged, ['lastLapMs','lap.lastLapMs','session.lastLapMs','lastLap'], 0);
    const totalMs = number(merged, ['totalTimeMs','session.totalTimeMs','analysis.totalMs'], 0);
    const avgMs = number(merged, ['averageLapMs','session.averageLapMs','analysis.averageMs'], 0);
    const validLaps = number(merged, ['voltasCompletadas','voltasCorrigidas','voltasValidas','validLaps','session.validLaps','currentLap'], 0);
    const maxSpeed = number(merged, ['velocidadeMaxima','maxSpeedKmh','session.maxSpeedKmh','analysis.maxSpeedKmh'], 0);

    const packetId = number(merged, ['packetId','packetID','packageID','packet.id','sequence'], 0);
    const packetTimestamp = number(merged, ['packetTimestamp','timestamp','receivedAt','lastPacketAt','udp.lastPacketAt'], 0);
    const explicitPacketAge = number(merged, ['packetAgeMs','udp.packetAgeMs','ageMs'], -1);
    const packetFresh = first(merged, ['packetFresh','udp.receiving','receivingPackets','hasTelemetry','decodeOk'], undefined);
    const telemetrySignal = packetFresh === true || speed > 0 || rpm > 0 || throttle > 0 || brake > 0 || packetId > 0 ||
      (packetTimestamp > 0 && Date.now() - packetTimestamp < 5000) || (explicitPacketAge >= 0 && explicitPacketAge < 5000);
    if (telemetrySignal) lastPacketAt = Date.now();

    const tyre = source.advanced?.tyreTemp || source.motecChannels?.tyreTemp || source.tyres?.temp || source.tyreTemp || {};
    const analysis = {
      ...(source.analysis || root.analysis || {}),
      laps: first(merged, ['analysis.laps'], validLaps),
      best: first(merged, ['analysis.best','melhorVolta'], bestMs ? formatMs(bestMs) : '--'),
      last: first(merged, ['analysis.last','ultimaVolta'], lastMs ? formatMs(lastMs) : '--'),
      total: first(merged, ['analysis.total','tempoTotalCorrida'], totalMs ? formatMs(totalMs) : '--'),
      average: first(merged, ['analysis.average','mediaGeral','mediaVoltas'], avgMs ? formatMs(avgMs) : '--')
    };

    return {
      ...root, ...source,
      session, car, input, fuel, lap, legacy,
      connected: true,
      bridgeConnected: true,
      telemetryReceiving: Date.now() - lastPacketAt < 5000,
      decodeOk: first(merged, ['decodeOk','decoded','packetDecoded'], true) !== false,
      velocidade: speed, speedKmh: speed,
      rpm,
      marcha: gear, gear,
      acelerador: throttle, throttlePct: throttle,
      freio: brake, brakePct: brake,
      combustivelPorcentagem: fuelPct, fuelPct,
      fuelCurrent: Number.isFinite(currentFuel) ? currentFuel : undefined,
      fuelCapacity: Number.isFinite(capacityFuel) ? capacityFuel : undefined,
      velocidadeMaxima: maxSpeed, maxSpeedKmh: maxSpeed,
      melhorVolta: analysis.best,
      ultimaVolta: analysis.last,
      tempoTotalCorrida: analysis.total,
      mediaGeral: analysis.average,
      mediaVoltas: analysis.average,
      voltasCompletadas: validLaps,
      packetId,
      ps5Ip: getPs5Ip(),
      bridgeUrl: BRIDGE,
      bridgeEndpoint: activeEndpoint,
      analysis,
      advanced: {
        ...(source.advanced || {}),
        tyreTemp: {
          FL: first({tyre,source}, ['tyre.FL','tyre.fl','source.tyreTempFL','source.tireTempFL'], undefined),
          FR: first({tyre,source}, ['tyre.FR','tyre.fr','source.tyreTempFR','source.tireTempFR'], undefined),
          RL: first({tyre,source}, ['tyre.RL','tyre.rl','source.tyreTempRL','source.tireTempRL'], undefined),
          RR: first({tyre,source}, ['tyre.RR','tyre.rr','source.tyreTempRR','source.tireTempRR'], undefined)
        }
      }
    };
  }

  function paint(state, detail){
    const httpFresh = Date.now() - lastHttpOkAt < 9000;
    const packetFresh = Date.now() - lastPacketAt < 5000;
    if (q('topStatus')) q('topStatus').textContent = httpFresh ? (packetFresh ? 'OK' : 'BRIDGE') : (state === 'wait' ? '...' : 'OFF');
    if (q('latency')) q('latency').textContent = httpFresh ? lastLatency + 'ms' : '--ms';
    if (q('statusDot')) {
      q('statusDot').style.background = packetFresh ? 'var(--cyan)' : httpFresh ? '#ffb000' : '#555';
      q('statusDot').style.boxShadow = packetFresh ? '0 0 18px var(--cyan)' : httpFresh ? '0 0 12px #ffb000' : 'none';
    }
    if (q('bridgeText')) {
      q('bridgeText').textContent = packetFresh ? 'OK · PACOTES GT7 · 33740' :
        httpFresh ? 'BRIDGE ONLINE · SEM PACOTES DO PS5 ' + getPs5Ip() :
        state === 'wait' ? 'CONECTANDO À BRIDGE · 8788' : 'OFF · ' + (detail || lastError || 'SEM RESPOSTA');
    }
  }

  function writeDiagnostic(){
    if (!q('raw')) return;
    q('raw').textContent = JSON.stringify({
      bridge: BRIDGE,
      ps5: getPs5Ip(),
      heartbeat: { message: 'A', destinationPort: 33739 },
      udpReceivePort: 33740,
      endpoint: activeEndpoint || null,
      bridgeOnline: Date.now() - lastHttpOkAt < 9000,
      telemetryReceiving: Date.now() - lastPacketAt < 5000,
      packetAgeMs: lastPacketAt ? Date.now() - lastPacketAt : null,
      latencyMs: lastLatency || null,
      failures,
      lastError: lastError || null,
      lastData
    }, null, 2);
  }

  async function configurePs5(force = false){
    const ip = getPs5Ip();
    if (!force && configuredPs5 === ip) return true;
    const attempts = [
      ['/api/config', { ps5Ip: ip, ps5_ip: ip, ip }],
      ['/api/settings', { ps5Ip: ip, ps5_ip: ip, ip }],
      ['/api/ps5', { ps5Ip: ip, ip }],
      ['/api/config/ps5', { ip }]
    ];
    for (const [path, data] of attempts) {
      try { await http(path, { method: 'POST', data, timeout: 2500 }); configuredPs5 = ip; return true; } catch (_) {}
    }
    return false;
  }

  function stopLegacy(){
    try { if (typeof window.timer !== 'undefined' && window.timer) clearInterval(window.timer); } catch (_) {}
    try { if (window.__v4PersistentBridgeTimer) clearTimeout(window.__v4PersistentBridgeTimer); } catch (_) {}
    try { if (window.v4PersistentBridge && typeof window.v4PersistentBridge.stop === 'function') window.v4PersistentBridge.stop(); } catch (_) {}
  }

  async function tick(){
    if (running || document.hidden) return;
    running = true;
    const started = performance.now();
    try {
      const raw = await getTelemetry();
      lastLatency = Math.max(1, Math.round(performance.now() - started));
      lastHttpOkAt = Date.now();
      failures = 0;
      lastError = '';
      const data = adapt(raw);
      lastData = data;
      if (typeof window.render === 'function') {
        try { window.render(data); } catch (error) { console.warn('Erro visual sem derrubar a Bridge:', error); }
      }
      paint('ok');
      configurePs5(false);
      writeDiagnostic();
    } catch (error) {
      failures += 1;
      lastError = error && error.message ? error.message : String(error);
      paint(failures < 4 ? 'wait' : 'off', lastError);
      writeDiagnostic();
    } finally {
      running = false;
      clearTimeout(timer);
      timer = setTimeout(tick, failures ? Math.min(3000, 900 + failures * 350) : 700);
      window.__gt7CleanTimer = timer;
    }
  }

  async function command(path, data){ return http(path, { method: 'POST', data: data || {}, timeout: 6000 }); }

  function start(){
    applyConfig(); stopLegacy(); clearTimeout(timer); failures = 0; lastError = ''; paint('wait');
    configurePs5(true).finally(tick);
  }

  function bind(){
    applyConfig(); stopLegacy();
    if (q('connectBtn')) q('connectBtn').onclick = start;
    if (q('ps5Ip')) {
      const save = () => savePs5Ip(q('ps5Ip').value);
      q('ps5Ip').addEventListener('change', save);
      q('ps5Ip').addEventListener('blur', save);
      q('ps5Ip').addEventListener('keydown', e => { if (e.key === 'Enter') { save(); q('ps5Ip').blur(); } });
    }
    if (q('startSection')) q('startSection').onclick = async () => { await command('/api/session/start', { name:'Nova seção' }); tick(); };
    if (q('saveSection')) q('saveSection').onclick = async () => { const name=prompt('Nome da seção:','Seção '+new Date().toLocaleString('pt-BR')); if(name!==null){await command('/api/session/finish',{name});tick();} };
    if (q('resetSection')) q('resetSection').onclick = async () => { await command('/api/reset',{}); tick(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else start(); });
    window.addEventListener('online', start);
    window.addEventListener('focus', () => { if (Date.now() - lastHttpOkAt > 2500) start(); });
    start();
  }

  window.gt7Bridge = {
    start, tick, request:http, command, adapt, setPs5Ip:savePs5Ip,
    get connected(){ return Date.now()-lastHttpOkAt<9000; },
    get telemetryReceiving(){ return Date.now()-lastPacketAt<5000; },
    get lastData(){ return lastData; },
    get lastError(){ return lastError; },
    get endpoint(){ return activeEndpoint; },
    get ps5Ip(){ return getPs5Ip(); }
  };
  window.api = command;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true});
  else setTimeout(bind,0);
})();