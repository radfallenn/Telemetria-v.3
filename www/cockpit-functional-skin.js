(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function readText(id, fallback = '--') {
    const value = String($(id)?.textContent || '').trim();
    return value || fallback;
  }

  function readNumber(id) {
    const match = readText(id, '0').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function percentFromWidth(id, fallbackValueId) {
    const element = $(id);
    const width = Number.parseFloat(element?.style?.width || '');
    if (Number.isFinite(width)) return Math.max(0, Math.min(100, width));
    return Math.max(0, Math.min(100, readNumber(fallbackValueId)));
  }

  function setText(id, value) {
    const element = $(id);
    if (element && element.textContent !== String(value)) element.textContent = String(value);
  }

  function setWidth(id, value) {
    const element = $(id);
    if (element) element.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
  }

  function copyValue(sourceId, targetId) {
    const text = readText(sourceId, '');
    if (!text || text === '--' || text === '00:00.000') return;
    const target = $(targetId);
    const flash = () => {
      target?.classList.add('skinCopied');
      setTimeout(() => target?.classList.remove('skinCopied'), 720);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(flash).catch(() => {});
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      flash();
    }
  }

  function buildSkin() {
    const dash = $('dash');
    if (!dash || $('cockpitFunctionalSkin')) return;

    const legacy = document.createElement('div');
    legacy.id = 'dashLegacySources';
    legacy.setAttribute('aria-hidden', 'true');
    while (dash.firstChild) legacy.appendChild(dash.firstChild);

    const skin = document.createElement('div');
    skin.id = 'cockpitFunctionalSkin';
    skin.className = 'cockpitFunctionalSkin';
    skin.innerHTML = `
      <div id="skinConnection" class="skinMask skinConnection"><span>--<small>--ms</small></span></div>
      <div id="skinBridge" class="skinMask skinBridge">--</div>
      <div id="skinSpeed" class="skinMask skinSpeed">0</div>
      <div id="skinGear" class="skinMask skinGear">N</div>
      <div id="skinRpm" class="skinMask skinRpm">0</div>
      <div id="skinTotal" class="skinMask skinTotal" role="button" tabindex="0">00:00.000</div>
      <div id="skinThrottle" class="skinMask skinThr">0%</div>
      <div id="skinBrake" class="skinMask skinBrk">0%</div>
      <div id="skinBest" class="skinMask skinBest" role="button" tabindex="0">--</div>
      <div id="skinFuel" class="skinMask skinFuel">--%</div>
      <div id="skinValid" class="skinMask skinValid">0</div>
      <div id="skinMax" class="skinMask skinMax">0</div>
      <div id="skinUdm" class="skinMask skinUdm">--</div>
      <div id="skinTyreFL" class="skinMask skinTyre skinTyreFL">--</div>
      <div id="skinTyreFR" class="skinMask skinTyre skinTyreFR">--</div>
      <div id="skinTyreRL" class="skinMask skinTyre skinTyreRL">--</div>
      <div id="skinTyreRR" class="skinMask skinTyre skinTyreRR">--</div>
      <div class="skinTrack skinRpmTrack"><i id="skinRpmBar"></i></div>
      <div class="skinTrack skinThrTrack"><i id="skinThrBar"></i></div>
      <div class="skinTrack skinBrkTrack"><i id="skinBrkBar"></i></div>
      <div class="skinTrack skinFuelTrack"><i id="skinFuelBar"></i></div>
      <div class="skinTrack skinTyreTrack skinTyreTrackFL"><i id="skinTyreBarFL"></i></div>
      <div class="skinTrack skinTyreTrack skinTyreTrackFR"><i id="skinTyreBarFR"></i></div>
      <div class="skinTrack skinTyreTrack skinTyreTrackRL"><i id="skinTyreBarRL"></i></div>
      <div class="skinTrack skinTyreTrack skinTyreTrackRR"><i id="skinTyreBarRR"></i></div>`;

    dash.appendChild(legacy);
    dash.appendChild(skin);
    dash.classList.add('cockpitSkinActive');

    $('skinTotal')?.addEventListener('click', () => copyValue('total', 'skinTotal'));
    $('skinBest')?.addEventListener('click', () => copyValue('best', 'skinBest'));
    $('skinTotal')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') copyValue('total', 'skinTotal');
    });
    $('skinBest')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') copyValue('best', 'skinBest');
    });
  }

  function syncSkin() {
    if (!$('cockpitFunctionalSkin')) return;

    const status = readText('st', '--');
    const latency = readText('lat', '--ms');
    const connection = $('skinConnection');
    if (connection) connection.innerHTML = `<span>${status}<small>${latency}</small></span>`;

    setText('skinBridge', readText('bridge'));
    setText('skinSpeed', Math.round(readNumber('speed')));
    setText('skinGear', readText('gear', 'N'));
    setText('skinRpm', Math.round(readNumber('rpmTop')));
    setText('skinTotal', readText('total', '00:00.000'));
    setText('skinThrottle', readText('thr', '0%'));
    setText('skinBrake', readText('brk', '0%'));
    setText('skinBest', readText('best'));
    setText('skinFuel', readText('fuelDash', '--%'));
    setText('skinValid', readText('valid', '0'));
    setText('skinMax', readText('max', '0'));
    setText('skinUdm', readText('udm'));
    setText('skinTyreFL', readText('tyreTempFL'));
    setText('skinTyreFR', readText('tyreTempFR'));
    setText('skinTyreRL', readText('tyreTempRL'));
    setText('skinTyreRR', readText('tyreTempRR'));

    setWidth('skinRpmBar', percentFromWidth('rpmBarFill', 'rpmTop'));
    setWidth('skinThrBar', percentFromWidth('thrBar', 'thr'));
    setWidth('skinBrkBar', percentFromWidth('brkBar', 'brk'));
    setWidth('skinFuelBar', readNumber('fuelDash'));
    setWidth('skinTyreBarFL', percentFromWidth('tyreBarFL', 'tyreTempFL'));
    setWidth('skinTyreBarFR', percentFromWidth('tyreBarFR', 'tyreTempFR'));
    setWidth('skinTyreBarRL', percentFromWidth('tyreBarRL', 'tyreTempRL'));
    setWidth('skinTyreBarRR', percentFromWidth('tyreBarRR', 'tyreTempRR'));
  }

  function init() {
    buildSkin();
    syncSkin();
    setInterval(syncSkin, 160);
    window.addEventListener('gt7:pagechange', syncSkin);
    window.addEventListener('gt7:telemetry', syncSkin);
    window.addEventListener('gt7-mobile-telemetry', syncSkin);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
