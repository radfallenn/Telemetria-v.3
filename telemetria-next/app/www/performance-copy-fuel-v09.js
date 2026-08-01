'use strict';

(() => {
  const TARGET_FPS = 120;
  const FRAME_MS = 1000 / TARGET_FPS;
  const LOW_FUEL_SEGMENTS = 5;
  const BEEP_INTERVAL_MS = 15000;

  let lastFrameAt = 0;
  let audioContext = null;
  let lastLowFuelBeepAt = 0;
  let lowFuelActive = false;

  function unlockAudio() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioContext = new AudioContextClass();
    }
    if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
  }

  function beep() {
    unlockAudio();
    if (!audioContext) return;

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(660, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.3);

    navigator.vibrate?.([120, 80, 120]);
  }

  function numericText(element) {
    const raw = String(element?.textContent || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw === '--' || raw.includes('AGUARDANDO') || raw.includes('Sem conexão')) return '';

    const time = raw.match(/\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?/);
    if (time) return time[0].replace(',', '.');

    const number = raw.match(/-?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?/);
    return number ? number[0].replace(',', '.') : '';
  }

  async function copyValue(element) {
    const value = numericText(element);
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    showToast(`Copiado: ${value}`);
    navigator.vibrate?.(35);
  }

  function showToast(message) {
    let toast = document.getElementById('copyToastV09');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'copyToastV09';
      Object.assign(toast.style, {
        position: 'fixed', left: '50%', bottom: '105px', zIndex: '9999',
        transform: 'translateX(-50%) translateY(12px)', padding: '9px 14px',
        border: '1px solid rgba(8,217,244,.55)', borderRadius: '999px',
        background: 'rgba(0,10,12,.94)', color: '#eaffff', fontSize: '12px',
        opacity: '0', transition: 'opacity .16s ease, transform .16s ease',
        pointerEvents: 'none', boxShadow: '0 0 18px rgba(8,217,244,.2)'
      });
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(12px)';
    }, 1200);
  }

  function installCopyByTap() {
    document.addEventListener('click', (event) => {
      unlockAudio();
      if (event.target.closest('.card-layout-controls, button, input, .bottom-nav')) return;

      const candidate = event.target.closest(
        '.page strong, .page .speed-value, .page .gear-badge, .page .scale-number, .bridge-pill small'
      );
      if (candidate) copyValue(candidate);
    }, { passive: true });

    document.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
  }

  function monitorFuelBars() {
    const fuelCard = document.getElementById('fuelCard');
    if (!fuelCard) return;

    const evaluate = () => {
      const activeBars = Number(fuelCard.dataset.activeSegments || 0);
      const isLow = activeBars > 0 && activeBars < LOW_FUEL_SEGMENTS;
      const now = Date.now();

      if (isLow && (!lowFuelActive || now - lastLowFuelBeepAt >= BEEP_INTERVAL_MS)) {
        beep();
        lastLowFuelBeepAt = now;
      }

      lowFuelActive = isLow;
      fuelCard.classList.toggle('fuel-audio-warning', isLow);
    };

    new MutationObserver(evaluate).observe(fuelCard, {
      attributes: true,
      attributeFilter: ['data-active-segments']
    });
    evaluate();
  }

  function start120HzLoop() {
    document.documentElement.dataset.targetFps = String(TARGET_FPS);

    const frame = (timestamp) => {
      if (timestamp - lastFrameAt >= FRAME_MS - 0.5) {
        lastFrameAt = timestamp;
        document.documentElement.style.setProperty('--frame-time', String(timestamp));
      }
      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }

  function install() {
    installCopyByTap();
    monitorFuelBars();
    start120HzLoop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
