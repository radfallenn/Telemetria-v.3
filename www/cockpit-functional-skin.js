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

  function widthOf(id, fallbackValueId) {
    const width = Number.parseFloat($(id)?.style?.width || '');
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
      <div id="skinConnection" class="skinCenter skinConnection"><span>--<small>--ms</small></span></div>
      <div id="skinBridge" class="skinCenter skinBridge">--</div>
      <div id="skinSpeed" class="skinCenter skinSpeed">0</div>
      <div id="skinGear" class="skinCenter skinGear">N</div>

      <div class="skinMetricBox skinLeft skinRow1">
        <span class="skinLabel">RPM</span>
        <b id="skinRpm" class="skinValue">0</b>
        <div class="skinBar"><i id="skinRpmBar" class="skinRpmFill"></i></div>
      </div>

      <div id="skinTotalBox" class="skinMetricBox skinRight skinRow1 clickable">
        <span class="skinLabel">TEMPO TOTAL</span>
        <b id="skinTotal" class="skinValue">00:00.000</b>
      </div>

      <div class="skinMetricBox skinLeft skinRow2">
        <span class="skinLabel">ACELERADOR</span>
        <b id="skinThrottle" class="skinValue skinCyan">0%</b>
        <div class="skinBar"><i id="skinThrBar" class="skinThrFill"></i></div>
      </div>

      <div class="skinMetricBox skinRight skinRow2">
        <span class="skinLabel">FREIO</span>
        <b id="skinBrake" class="skinValue skinRed">0%</b>
        <div class="skinBar"><i id="skinBrkBar" class="skinBrkFill"></i></div>
      </div>

      <div id="skinBestBox" class="skinMetricBox skinLeft skinRow3 clickable">
        <span class="skinLabel">MELHOR VOLTA</span>
        <b id="skinBest" class="skinValue">--</b>
        <small class="skinSmallText">Toque para copiar</small>
      </div>

      <div class="skinMetricBox skinRight skinRow3">
        <span class="skinLabel">COMBUSTÍVEL</span>
        <b id="skinFuel" class="skinValue skinCyan">--%</b>
        <div class="skinBar"><i id="skinFuelBar" class="skinFuelFill"></i></div>
      </div>

      <div class="skinMetricBox skinLeft skinRow4">
        <span class="skinLabel">VOLTAS VÁLIDAS</span>
        <b id="skinValid" class="skinValue skinCyan">0</b>
      </div>

      <div class="skinMetricBox skinRight skinRow4">
        <span class="skinLabel">MAX SPEED</span>
        <b id="skinMax" class="skinValue">0</b>
        <small class="skinSmallText">Velocidade máxima da seção atual</small>
      </div>

      <div class="skinMetricBox skinUdmBox">
        <span class="skinLabel">UDM NOTA</span>
        <b id="skinUdm" class="skinValue skinCyan">--</b>
        <small id="skinUdmTxt" class="skinSmallText">Aguardando voltas válidas.</small>
      </div>

      <div class="skinTyreTitle">TEMPERATURA DOS PNEUS</div>

      <div class="skinTyreBox skinTyreFL">
        <span class="skinLabel">DIANTEIRO ESQ.</span>
        <b id="skinTyreFL" class="skinValue">--</b>
        <div class="skinBar"><i id="skinTyreBarFL" class="skinTyreFill"></i></div>
      </div>

      <div class="skinTyreBox skinTyreFR">
        <span class="skinLabel">DIANTEIRO DIR.</span>
        <b id="skinTyreFR" class="skinValue">--</b>
        <div class="skinBar"><i id="skinTyreBarFR" class="skinTyreFill"></i></div>
      </div>

      <div class="skinTyreBox skinTyreRL">
        <span class="skinLabel">TRASEIRO ESQ.</span>
        <b id="skinTyreRL" class="skinValue">--</b>
        <div class="skinBar"><i id="skinTyreBarRL" class="skinTyreFill"></i></div>
      </div>

      <div class="skinTyreBox skinTyreRR">
        <span class="skinLabel">TRASEIRO DIR.</span>
        <b id="skinTyreRR" class="skinValue">--</b>
        <div class="skinBar"><i id="skinTyreBarRR" class="skinTyreFill"></i></div>
      </div>`;

    dash.appendChild(legacy);
    dash.appendChild(skin);
    dash.classList.add('cockpitSkinActive');

    $('skinTotalBox')?.addEventListener('click', () => copyValue('total', 'skinTotalBox'));
    $('skinBestBox')?.addEventListener('click', () => copyValue('best', 'skinBestBox'));
  }

  function syncSkin() {
    if (!$('cockpitFunctionalSkin')) return;

    const connection = $('skinConnection');
    if (connection) {
      connection.innerHTML = `<span>${readText('st', '--')}<small>${readText('lat', '--ms')}</small></span>`;
    }

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
    setText('skinUdmTxt', readText('udmTxt', 'Aguardando voltas válidas.'));
    setText('skinTyreFL', readText('tyreTempFL'));
    setText('skinTyreFR', readText('tyreTempFR'));
    setText('skinTyreRL', readText('tyreTempRL'));
    setText('skinTyreRR', readText('tyreTempRR'));

    setWidth('skinRpmBar', widthOf('rpmBarFill', 'rpmTop'));
    setWidth('skinThrBar', widthOf('thrBar', 'thr'));
    setWidth('skinBrkBar', widthOf('brkBar', 'brk'));
    setWidth('skinFuelBar', readNumber('fuelDash'));
    setWidth('skinTyreBarFL', widthOf('tyreBarFL', 'tyreTempFL'));
    setWidth('skinTyreBarFR', widthOf('tyreBarFR', 'tyreTempFR'));
    setWidth('skinTyreBarRL', widthOf('tyreBarRL', 'tyreTempRL'));
    setWidth('skinTyreBarRR', widthOf('tyreBarRR', 'tyreTempRR'));
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
