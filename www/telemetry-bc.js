(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULT_BASE = 'http://192.168.1.70:8788';
  const SCHEMA_BC = {
    packetB: {
      wheelRotationRad: null,
      steeringAngularVelocityRadS: null,
      sway: null,
      heave: null,
      surge: null,
      gForce: { lateral: null, vertical: null, longitudinal: null }
    },
    packetC: {
      surfaceRaw: { fl: null, fr: null, rl: null, rr: null },
      surface: { fl: null, fr: null, rl: null, rr: null },
      currentLapMs: null,
      wheelSteeringAngleRad: { fl: null, fr: null },
      wheelBaseM: null,
      carCategory: null
    }
  };

  let latest = {};
  let timer = null;

  function bridgeBase() {
    return (localStorage.getItem('gt7_bridge_url') || DEFAULT_BASE).replace(/\/$/, '');
  }

  function merge(schema, data) {
    if (Array.isArray(schema)) return Array.isArray(data) ? data : [...schema];
    if (schema && typeof schema === 'object') {
      const source = data && typeof data === 'object' ? data : {};
      const output = {};
      const keys = new Set([...Object.keys(schema), ...Object.keys(source)]);
      for (const key of keys) output[key] = merge(schema[key], source[key]);
      return output;
    }
    return data === undefined ? schema : data;
  }

  function flatten(value, prefix = '', output = []) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => flatten(item, prefix ? `${prefix}.${index}` : String(index), output));
      return output;
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => flatten(item, prefix ? `${prefix}.${key}` : key, output));
      return output;
    }
    output.push({ path: prefix, value });
    return output;
  }

  function packetFor(path) {
    if (path.startsWith('packetC.')) return 'C';
    if (path.startsWith('packetB.')) return 'B';
    return 'A';
  }

  function groupFor(path) {
    const key = path.split('.')[0] || 'geral';
    const names = {
      packetVersion: 'PACOTE', packetSize: 'PACOTE', magic: 'PACOTE', packetId: 'PACOTE',
      position: 'POSIÇÃO', worldVelocity: 'VELOCIDADE VETORIAL', rotation: 'ROTAÇÃO',
      orientationRelativeToNorth: 'ORIENTAÇÃO', angularVelocity: 'VELOCIDADE ANGULAR',
      bodyHeightM: 'CARROCERIA', engine: 'MOTOR', fuel: 'COMBUSTÍVEL', motion: 'MOVIMENTO',
      tyres: 'PNEUS / RODAS / SUSPENSÃO', lap: 'VOLTAS', race: 'CORRIDA',
      transmission: 'TRANSMISSÃO', input: 'COMANDOS', road: 'PISTA', unknownA: 'DESCONHECIDOS A',
      clutch: 'EMBREAGEM', carCode: 'IDENTIFICAÇÃO', flagsRaw: 'ESTADOS', flags: 'ESTADOS',
      packetB: 'PACOTE B — VOLANTE E G-FORCE', packetC: 'PACOTE C — SUPERFÍCIE E GEOMETRIA'
    };
    return names[key] || key.toUpperCase();
  }

  function labelFor(path) {
    const last = path.split('.').pop();
    const labels = {
      fl: 'Dianteiro esquerdo', fr: 'Dianteiro direito', rl: 'Traseiro esquerdo', rr: 'Traseiro direito',
      rpm: 'RPM', speedKmh: 'Velocidade km/h', speedMs: 'Velocidade m/s',
      throttlePct: 'Acelerador', brakePct: 'Freio', currentGear: 'Marcha atual',
      suggestedGear: 'Marcha sugerida', bestMs: 'Melhor volta', lastMs: 'Última volta',
      currentMs: 'Tempo de volta atual', currentLapMs: 'Tempo de volta atual',
      waterTempC: 'Temperatura da água', oilTempC: 'Temperatura do óleo',
      oilPressureBar: 'Pressão do óleo', boostBar: 'Boost', boostRaw: 'Boost bruto',
      levelLiters: 'Nível', capacityLiters: 'Capacidade', percent: 'Percentual',
      carOnTrack: 'Carro na pista', loadingOrProcessing: 'Carregando/processando',
      hasTurbo: 'Tem turbo', revLimiterAlert: 'Alerta limitador', handBrake: 'Freio de mão',
      highBeam: 'Farol alto', lowBeam: 'Farol baixo', wheelRotationRad: 'Rotação do volante',
      steeringAngularVelocityRadS: 'Velocidade angular do volante', sway: 'Sway lateral',
      heave: 'Heave vertical', surge: 'Surge longitudinal', lateral: 'G lateral',
      vertical: 'G vertical', longitudinal: 'G longitudinal', surfaceRaw: 'Superfície bruta',
      surface: 'Superfície', wheelSteeringAngleRad: 'Ângulo real das rodas',
      wheelBaseM: 'Distância entre eixos', carCategory: 'Categoria do carro'
    };
    return labels[last] || last.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
  }

  function unitFor(path) {
    if (/Kmh$/.test(path)) return 'km/h';
    if (/Ms$/.test(path) && !path.endsWith('speedMs')) return 'ms';
    if (path.endsWith('speedMs')) return 'm/s';
    if (/TempC$/.test(path) || path.includes('temperatureC.')) return '°C';
    if (/Liters$/.test(path)) return 'L';
    if (/Pct$/.test(path) || path.endsWith('.percent')) return '%';
    if (/Rpm$/.test(path) || path.endsWith('.rpm')) return 'rpm';
    if (/Bar$/.test(path)) return 'bar';
    if (/HeightM$/.test(path) || /RadiusM\./.test(path) || path.endsWith('wheelBaseM') || path.endsWith('planeDistanceM')) return 'm';
    if (/Rad$/.test(path) || path.includes('AngleRad')) return 'rad';
    if (/RadS$/.test(path) || path.includes('wheelRps.')) return 'rad/s';
    if (path.includes('gForce.')) return 'g';
    return '';
  }

  function formatLap(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value) || value <= 0) return '--';
    const minutes = Math.floor(value / 60000);
    const seconds = Math.floor((value % 60000) / 1000);
    const millis = Math.floor(value % 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  function formatValue(value, path) {
    if (value === null || value === undefined || value === '') return '--';
    if (typeof value === 'boolean') return value ? 'ATIVO' : 'INATIVO';
    if (path.endsWith('bestMs') || path.endsWith('lastMs') || path.endsWith('currentMs') || path.endsWith('currentLapMs')) {
      return formatLap(value);
    }
    if (typeof value === 'number') {
      if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString('pt-BR');
      return String(Number(value.toFixed(Math.abs(value) < 10 ? 3 : 1)));
    }
    return String(value);
  }

  function fallback(live, health) {
    return {
      packetVersion: live?.packet?.version ?? live?.legacy?.packetVersion ?? null,
      packetSize: live?.packet?.size ?? health?.lastPacketSize ?? null,
      motion: { speedKmh: live?.car?.speedKmh ?? null },
      engine: { rpm: live?.car?.rpm ?? null },
      transmission: { currentGear: live?.car?.gear ?? null, suggestedGear: live?.car?.suggestedGear ?? null },
      input: { throttlePct: live?.input?.throttlePct ?? null, brakePct: live?.input?.brakePct ?? null },
      lap: {
        count: live?.lap?.currentLap ?? null, total: live?.lap?.totalLaps ?? null,
        bestMs: live?.lap?.bestLapMs ?? null, lastMs: live?.lap?.lastLapMs ?? null,
        currentLapMs: live?.lap?.currentLapMs ?? null
      },
      fuel: {
        levelLiters: live?.fuel?.levelLiters ?? null, capacityLiters: live?.fuel?.capacityLiters ?? null,
        percent: live?.fuel?.percent ?? null
      },
      tyres: { temperatureC: live?.tyres?.temp ?? {} }
    };
  }

  function render() {
    const root = $('telemetryAll');
    if (!root) return;
    const source = latest.telemetry || fallback(latest.live || {}, latest.health || {});
    const data = merge(SCHEMA_BC, source);
    const term = ($('telemetrySearch')?.value || '').toLowerCase().trim();
    const rows = flatten(data).filter((item) => {
      const haystack = `${item.path} ${labelFor(item.path)} ${groupFor(item.path)}`.toLowerCase();
      return !term || haystack.includes(term);
    });
    const groups = {};
    rows.forEach((item) => (groups[groupFor(item.path)] ||= []).push(item));

    const version = source.packetVersion ?? latest.live?.packet?.version ?? '--';
    const size = source.packetSize ?? latest.live?.packet?.size ?? latest.health?.lastPacketSize ?? '--';
    const status = $('telemetryStatus');
    if (status) status.textContent = `PACOTE ${version} · ${size} B`;

    root.innerHTML = Object.entries(groups).map(([group, items]) => {
      const cards = items.map(({ path, value }) => {
        const unit = unitFor(path);
        const boolClass = typeof value === 'boolean' ? ' bool' : '';
        const naClass = value == null ? ' na' : '';
        return `<div class="metric${naClass}${boolClass}"><span class="mp">${packetFor(path)}</span><div class="mn">${labelFor(path)}</div><div class="mv">${formatValue(value, path)}${value != null && unit ? `<span class="mu">${unit}</span>` : ''}</div></div>`;
      }).join('');
      return `<div class="tgroup"><h3>${group}</h3><div class="tgrid">${cards}</div></div>`;
    }).join('') || '<div class="item">Nenhum atributo encontrado.</div>';
  }

  async function refresh() {
    if (!$('telemetryAll')) return;
    try {
      const base = bridgeBase();
      const [healthResponse, liveResponse] = await Promise.all([
        fetch(`${base}/api/health`, { cache: 'no-store' }),
        fetch(`${base}/api/live`, { cache: 'no-store' })
      ]);
      if (!healthResponse.ok || !liveResponse.ok) throw new Error('Bridge indisponível');
      const health = await healthResponse.json();
      const payload = await liveResponse.json();
      latest = {
        health,
        live: payload.live || payload,
        telemetry: (payload.live || payload).telemetry || null
      };
      render();
    } catch (error) {
      const message = $('packetMessage');
      if (message) message.textContent = `Bridge offline: ${error.message}`;
      render();
    }
  }

  async function requestPacket() {
    const select = $('packetSelect');
    const message = $('packetMessage');
    if (!select || !message) return;
    const packetVersion = select.value;
    message.textContent = `Solicitando pacote ${packetVersion}...`;
    try {
      const response = await fetch(`${bridgeBase()}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packetVersion })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      localStorage.setItem('gt7_packet_version', packetVersion);
      message.textContent = `Pacote ${result.packetVersion || packetVersion} solicitado. Aguarde novos dados do GT7.`;
      await refresh();
    } catch (error) {
      message.textContent = `Não foi possível alterar o pacote: ${error.message}`;
    }
  }

  function init() {
    const search = $('telemetrySearch');
    const button = $('applyPacket');
    const select = $('packetSelect');
    if (!search || !button || !select) return;
    select.value = localStorage.getItem('gt7_packet_version') || 'C';
    search.addEventListener('input', render);
    button.addEventListener('click', requestPacket);
    refresh();
    timer = setInterval(refresh, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  window.addEventListener('beforeunload', () => {
    if (timer) clearInterval(timer);
  });
})();
