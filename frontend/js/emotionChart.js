/* ═══════════════════════════════════════════════════════════
   emotionChart.js — 六大情緒雷達圖模組
   ───────────────────────────────────────────────────────────
   使用方式：
     EmotionChart.update({ joy: 72, sadness: 18, anger: 5,
                           fear: 10, disgust: 3, surprise: 40 })

   數值範圍：0 ~ 100
   ═══════════════════════════════════════════════════════════ */

const EmotionChart = (() => {

  /* ── 情緒設定 ─────────────────────────────────────────── */
  const EMOTIONS = [
    { key: 'joy',      label: '快樂 Joy',      color: '#E24B4A' },
    { key: 'sadness',  label: '悲傷 Sadness',   color: '#378ADD' },
    { key: 'anger',    label: '憤怒 Anger',     color: '#D85A30' },
    { key: 'fear',     label: '恐懼 Fear',      color: '#7F77DD' },
    { key: 'disgust',  label: '厭惡 Disgust',   color: '#1D9E75' },
    { key: 'surprise', label: '驚訝 Surprise',  color: '#BA7517' },
  ];

  /* ── 預設初始數值（全部 0，代表尚未分析） ──────────── */
  const DEFAULT_DATA = { joy: 0, sadness: 0, anger: 0, fear: 0, disgust: 0, surprise: 0 };

  let chartInstance = null;

  /* ── 建立面板 HTML ────────────────────────────────────── */
  function buildPanel() {
    const panel = document.getElementById('emotion-panel');
    if (!panel) {
      console.warn('[EmotionChart] 找不到 #emotion-panel，請確認 index.html 有加這個 div');
      return;
    }

    panel.innerHTML = `
      <div class="ec-wrap">

        <p class="ec-title">情緒分析</p>

        <!-- 圖例 -->
        <div class="ec-legend">
          ${EMOTIONS.map(e => `
            <span class="ec-legend-item">
              <span class="ec-dot" style="background:${e.color}"></span>
              ${e.label.split(' ')[0]}
            </span>
          `).join('')}
        </div>

        <!-- 雷達圖 -->
        <div class="ec-canvas-wrap">
          <canvas id="ec-canvas"
            role="img"
            aria-label="六大情緒雷達圖，顯示快樂、悲傷、憤怒、恐懼、厭惡、驚訝六個維度的強度數值">
            六大情緒雷達圖
          </canvas>
        </div>

        <!-- 數值卡片 -->
        <div class="ec-cards">
          ${EMOTIONS.map(e => `
            <div class="ec-card">
              <p class="ec-card-label">${e.label.split(' ')[0]}</p>
              <p class="ec-card-value" id="ec-val-${e.key}">0</p>
            </div>
          `).join('')}
        </div>

        <p class="ec-hint">每次對話後自動更新</p>

      </div>
    `;
  }

  /* ── 建立 Chart.js 雷達圖 ─────────────────────────────── */
  function buildChart() {
    const canvas = document.getElementById('ec-canvas');
    if (!canvas) return;

    const isDark = matchMedia('(prefers-color-scheme: dark)').matches;
    const gridColor   = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(180,140,200,0.35)';
    const labelColor  = isDark ? '#bbb' : '#7a6d8a';

    chartInstance = new Chart(canvas.getContext('2d'), {
      type: 'radar',
      data: {
        labels: EMOTIONS.map(e => e.label),
        datasets: [{
          data: EMOTIONS.map(() => 0),
          backgroundColor: 'rgba(127,119,221,0.15)',
          borderColor: '#7F77DD',
          borderWidth: 2,
          pointBackgroundColor: EMOTIONS.map(e => e.color),
          pointBorderColor: isDark ? '#1a1a2e' : '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${Math.round(ctx.raw)}`
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 25,
              color: labelColor,
              font: { size: 10 },
              backdropColor: 'transparent',
              callback: v => v
            },
            grid:        { color: gridColor },
            angleLines:  { color: gridColor },
            pointLabels: { color: labelColor, font: { size: 11 } }
          }
        }
      }
    });
  }

  /* ── 更新圖表與數值卡片 ──────────────────────────────── */
  function update(scores) {
    if (!chartInstance) {
      console.warn('[EmotionChart] 圖表尚未初始化，請先呼叫 EmotionChart.init()');
      return;
    }

    /* 把傳入的 scores 安全地映射到六個情緒 */
    const values = EMOTIONS.map(e => {
      const v = Number(scores[e.key]);
      return isNaN(v) ? 0 : Math.min(100, Math.max(0, Math.round(v)));
    });

    /* 更新雷達圖數據 */
    chartInstance.data.datasets[0].data = values;
    chartInstance.update();

    /* 更新數值卡片 */
    EMOTIONS.forEach((e, i) => {
      const el = document.getElementById(`ec-val-${e.key}`);
      if (el) el.textContent = values[i];
    });
  }

  /* ── 重置為全 0 ──────────────────────────────────────── */
  function reset() {
    update(DEFAULT_DATA);
  }

  /* ── 初始化（建面板 + 建圖表） ───────────────────────── */
  function init() {
    buildPanel();

    /* 等 Chart.js 載入後才建圖表 */
    if (typeof Chart !== 'undefined') {
      buildChart();
    } else {
      /* Chart.js 還沒載入，等 script onload */
      const script = document.getElementById('ec-chartjs-cdn');
      if (script) {
        script.addEventListener('load', buildChart);
      } else {
        console.warn('[EmotionChart] 找不到 Chart.js，請確認 index.html 有引入');
      }
    }
  }

  /* ── 公開 API ─────────────────────────────────────────── */
  return { init, update, reset };

})();

/* 頁面載入完成後自動初始化 */
document.addEventListener('DOMContentLoaded', () => EmotionChart.init());
