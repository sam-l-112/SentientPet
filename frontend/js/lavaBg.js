/* 熔岩燈背景：依情緒分數調整泡泡大小，對外 LavaBg.update(scores) */
(function () {
  const EMOTIONS = ['joy', 'sadness', 'anger', 'fear', 'disgust', 'surprise'];
  const MIN_PX = 140;
  const MAX_PX = 440;

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function ensureLava() {
    let el = document.getElementById('lava-bg');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'lava-bg';
    el.setAttribute('aria-hidden', 'true');
    EMOTIONS.forEach((key) => {
      const blob = document.createElement('div');
      blob.className = 'lava-blob lava-blob--' + key;
      blob.dataset.emotion = key;
      el.appendChild(blob);
    });
    document.body.insertBefore(el, document.body.firstChild);
    return el;
  }

  function update(scores) {
    const root = ensureLava();
    const s = scores && typeof scores === 'object' ? scores : {};
    EMOTIONS.forEach((key) => {
      const raw = Number(s[key]);
      const v = clamp(isFinite(raw) ? raw : 0, 0, 100);
      const px = MIN_PX + (v / 100) * (MAX_PX - MIN_PX);
      const blob = root.querySelector('[data-emotion="' + key + '"]');
      if (blob) {
        blob.style.setProperty('--lava-d', px + 'px');
      }
    });
  }

  function boot() {
    ensureLava();
    update({});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.LavaBg = { update };
})();
