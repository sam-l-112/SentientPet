/* ═══════════════════════════════════════════════════════════
   emotionChart.js — 情緒趨勢圖 + 詳細情緒面板
   ───────────────────────────────────────────────────────────
   公開 API（介面固定）：
     EmotionChart.update({
       joy, sadness, anger, fear, disgust, surprise, valence, stage
     })

   - 主面板：綜合情緒分數折線圖（0~100）
   - 點擊資料點：右側滑入詳細 overlay（雷達圖 + 六格情緒 + 大字分數 + 階段）
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

  const STORAGE_KEY = 'sentientpet_emotion_history_v1';

  const PANEL_WIDTH = 340;
  const trendLabels = [];
  const trendScores = [];
  const history = []; // 每次對話的完整 scores（用於點擊後顯示）

  let trendChartInstance = null;
  let detailRadarInstance = null;
  let lastStageColor = '#BA7517';

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

        <div class="ec-trend-head">
          <div class="ec-trend-kpi">
            <p class="ec-score-label">最新綜合分數</p>
            <p class="ec-score-value" id="ec-score">50</p>
            <p class="ec-score-stage" id="ec-stage">中性</p>
            <p class="ec-score-change" id="ec-change">變化-不變</p>
          </div>
          <p class="ec-hint">點擊折線圖的資料點可查看詳細</p>
        </div>

        <div class="ec-trend-wrap">
          <canvas id="ec-trend-canvas"
            role="img"
            aria-label="綜合情緒分數趨勢折線圖，X 軸為對話次數，Y 軸為 0 到 100 分">
            綜合情緒分數趨勢折線圖
          </canvas>
        </div>

      </div>

      <!-- 詳細資訊 Overlay（點擊折線圖資料點後顯示） -->
      <div class="ec-overlay" id="ec-overlay" aria-hidden="true">
        <div class="ec-overlay-panel" role="dialog" aria-label="該次對話情緒詳細資訊">
          <div class="ec-overlay-header">
            <div class="ec-overlay-titlewrap">
              <p class="ec-overlay-title" id="ec-detail-title">第 1 次對話</p>
              <p class="ec-overlay-sub" id="ec-detail-sub">情緒詳細資訊</p>
            </div>
            <button class="ec-overlay-close" id="ec-overlay-close" type="button" aria-label="關閉詳細資訊">×</button>
          </div>

          <div class="ec-detail-score-wrap">
            <p class="ec-score-label">綜合情緒分數</p>
            <p class="ec-detail-score" id="ec-detail-score">50</p>
            <p class="ec-detail-stage" id="ec-detail-stage">中性</p>
            <p class="ec-detail-change" id="ec-detail-change">變化-不變</p>
          </div>

          <div class="ec-detail-legend">
            ${EMOTIONS.map(e => `
              <span class="ec-legend-item">
                <span class="ec-dot" style="background:${e.color}"></span>
                ${e.label.split(' ')[0]}
              </span>
            `).join('')}
          </div>

          <div class="ec-detail-canvas-wrap">
            <canvas id="ec-detail-radar"
              role="img"
              aria-label="六大情緒雷達圖詳細資訊">
              六大情緒雷達圖
            </canvas>
          </div>

          <div class="ec-cards ec-cards--detail">
            ${EMOTIONS.map(e => `
              <div class="ec-card">
                <p class="ec-card-label">${e.label.split(' ')[0]}</p>
                <p class="ec-card-value" id="ec-detail-val-${e.key}">0</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('ec-overlay-close');
    if (closeBtn) closeBtn.addEventListener('click', closeDetailOverlay);
  }

  function safeParseJSON(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  function persistToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, history }));
    } catch (e) {
      console.warn('[EmotionChart] localStorage 寫入失敗：', e);
    }
  }

  function loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = safeParseJSON(raw);
    const saved = parsed?.history;
    if (!Array.isArray(saved) || !saved.length) return;

    // 清空現有並重建
    trendLabels.length = 0;
    trendScores.length = 0;
    history.length = 0;

    saved.forEach((scores, i) => {
      history.push(scores);
      const values = EMOTIONS.map(e => clamp01to100(scores?.[e.key]));
      const score = computeCompositeScore(values, scores);
      trendLabels.push(`第${i + 1}次`);
      trendScores.push(score);
    });

    if (trendChartInstance) trendChartInstance.update();
    updateLatestKPI();
  }

  function clamp01to100(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return 0;
    return Math.min(100, Math.max(0, Math.round(v)));
  }

  function normalizeStage(stage, score) {
    const s = String(stage ?? '').trim().toLowerCase();
    if (s) {
      if (['positive', 'pos', 'p', '正面', '正向', '好'].includes(s)) return '正面';
      if (['neutral', 'neu', 'n', '中性', '一般'].includes(s)) return '中性';
      if (['negative', 'neg', 'm', '負面', '負向', '差'].includes(s)) return '負面';
    }
    if (score <= 40) return '負面';
    if (score <= 70) return '中性';
    return '正面';
  }

  function stageToColor(stage) {
    if (stage === '負面') return '#E24B4A';
    if (stage === '正面') return '#1D9E75';
    return '#BA7517';
  }

  function computeCompositeScore(values, scores) {
    // 若後端有給 valence（0~100）就以它為主；否則沿用原先的加權邏輯（基準 50）
    const val = Number(scores?.valence);
    if (!Number.isNaN(val)) return clamp01to100(val);
    return clamp01to100(50 + values[0] * 0.5 - values[1] * 0.3 - values[2] * 0.3 - values[3] * 0.2 - values[4] * 0.2);
  }

  function computeChangeText(currScore, prevScore) {
    if (typeof currScore !== 'number' || Number.isNaN(currScore)) return '變化-不變';
    if (typeof prevScore !== 'number' || Number.isNaN(prevScore)) return '變化-不變';
    if (currScore > prevScore) return '變化-上升';
    if (currScore < prevScore) return '變化-下降';
    return '變化-不變';
  }

  function updateLatestKPI() {
    const scoreEl = document.getElementById('ec-score');
    const stageEl = document.getElementById('ec-stage');
    const changeEl = document.getElementById('ec-change');

    if (!trendScores.length) {
      if (scoreEl) scoreEl.textContent = '50';
      if (stageEl) {
        stageEl.textContent = '中性';
        stageEl.style.color = stageToColor('中性');
      }
      if (changeEl) changeEl.textContent = '變化-不變';
      return;
    }

    const curr = trendScores[trendScores.length - 1];
    const prev = trendScores.length >= 2 ? trendScores[trendScores.length - 2] : curr;
    const record = history[history.length - 1] ?? {};
    const stage = normalizeStage(record.stage, curr);
    const color = stageToColor(stage);
    lastStageColor = color;

    if (scoreEl) scoreEl.textContent = String(curr);
    if (stageEl) {
      stageEl.textContent = stage;
      stageEl.style.color = color;
    }
    if (changeEl) changeEl.textContent = computeChangeText(curr, prev);
  }

  /* ── 建立 Chart.js 趨勢折線圖 ─────────────────────────── */
  function buildTrendChart() {
    const canvas = document.getElementById('ec-trend-canvas');
    if (!canvas) return;

    const isDark = matchMedia('(prefers-color-scheme: dark)').matches;
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(180,140,200,0.28)';
    const labelColor = isDark ? 'rgba(255,255,255,0.72)' : '#7a6d8a';
    const primary = '#7F77DD';
    const accent = '#e8a0bf';

    trendChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: trendLabels,
        datasets: [{
          label: '綜合情緒分數',
          data: trendScores,
          borderColor: primary,
          backgroundColor: 'rgba(127,119,221,0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBorderWidth: 2,
          pointBackgroundColor: accent,
          pointBorderColor: isDark ? '#1a1a2e' : '#ffffff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450, easing: 'easeInOutQuart' },
        interaction: { mode: 'nearest', intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: items => items?.[0]?.label ?? '',
              label: ctx => `分數：${Math.round(ctx.parsed.y)}`
            }
          }
        },
        onClick: (evt) => {
          const points = trendChartInstance.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
          if (!points?.length) return;
          openDetailOverlay(points[0].index);
        },
        onHover: (evt, elements) => {
          const el = evt?.native?.target;
          if (el && el.style) el.style.cursor = elements?.length ? 'pointer' : 'default';
        },
        scales: {
          x: {
            ticks: { color: labelColor, maxRotation: 0, autoSkip: true },
            grid: { display: false }
          },
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20, color: labelColor },
            grid: { color: gridColor }
          }
        }
      }
    });
  }

  /* ── 建立 Chart.js 詳細雷達圖 ─────────────────────────── */
  function buildDetailRadarChart() {
    const canvas = document.getElementById('ec-detail-radar');
    if (!canvas) return;

    const isDark = matchMedia('(prefers-color-scheme: dark)').matches;
    const gridColor   = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(180,140,200,0.35)';
    const labelColor  = isDark ? '#bbb' : '#7a6d8a';

    detailRadarInstance = new Chart(canvas.getContext('2d'), {
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

  function openDetailOverlay(index) {
    const overlay = document.getElementById('ec-overlay');
    const panel = document.getElementById('emotion-panel');
    if (!overlay || !panel) return;

    const record = history[index];
    if (!record) return;

    const values = EMOTIONS.map(e => clamp01to100(record[e.key]));
    const score = computeCompositeScore(values, record);
    const stage = normalizeStage(record.stage, score);
    const color = stageToColor(stage);
    lastStageColor = color;
    const prevScore = index >= 1 ? trendScores[index - 1] : score;
    const changeText = computeChangeText(score, prevScore);

    const titleEl = document.getElementById('ec-detail-title');
    if (titleEl) titleEl.textContent = `第 ${index + 1} 次對話`;

    const scoreEl = document.getElementById('ec-detail-score');
    const stageEl = document.getElementById('ec-detail-stage');
    const changeEl = document.getElementById('ec-detail-change');
    if (scoreEl) scoreEl.textContent = String(score);
    if (stageEl) {
      stageEl.textContent = stage;
      stageEl.style.color = color;
    }
    if (changeEl) changeEl.textContent = changeText;

    EMOTIONS.forEach((e, i) => {
      const el = document.getElementById(`ec-detail-val-${e.key}`);
      if (el) el.textContent = String(values[i]);
    });

    if (detailRadarInstance) {
      detailRadarInstance.data.datasets[0].data = values;
      detailRadarInstance.update();
    }

    overlay.classList.add('ec-overlay--open');
    overlay.setAttribute('aria-hidden', 'false');
    panel.classList.add('ec-has-overlay');
  }

  function closeDetailOverlay() {
    const overlay = document.getElementById('ec-overlay');
    const panel = document.getElementById('emotion-panel');
    if (!overlay || !panel) return;
    overlay.classList.remove('ec-overlay--open');
    overlay.setAttribute('aria-hidden', 'true');
    panel.classList.remove('ec-has-overlay');
  }

  /* ── 更新趨勢圖與最新 KPI ─────────────────────────────── */
  function update(scores) {
    if (!trendChartInstance) {
      console.warn('[EmotionChart] 圖表尚未初始化，請先呼叫 EmotionChart.init()');
      return;
    }

    // 保存原始資料（用於點擊後顯示詳細）
    history.push({ ...scores });

    const values = EMOTIONS.map(e => clamp01to100(scores?.[e.key]));
    const score = computeCompositeScore(values, scores);
    const stage = normalizeStage(scores?.stage, score);
    const color = stageToColor(stage);
    lastStageColor = color;

    const n = trendScores.length + 1;
    trendLabels.push(`第${n}次`);
    trendScores.push(score);

    trendChartInstance.update();

    // 持久化（F5/關掉也保留）
    persistToStorage();

    // 更新右側 KPI（最新分數、階段、變化）
    updateLatestKPI();

    if (window.LavaBg) LavaBg.update(scores);
  }

  /* ── 重置為全 0 ──────────────────────────────────────── */
  function reset() {
    // 清空趨勢資料
    trendLabels.length = 0;
    trendScores.length = 0;
    history.length = 0;

    if (trendChartInstance) trendChartInstance.update();
    closeDetailOverlay();

    try { localStorage.removeItem(STORAGE_KEY); } catch {}

    // 重置 KPI
    const scoreEl = document.getElementById('ec-score');
    const stageEl = document.getElementById('ec-stage');
    const changeEl = document.getElementById('ec-change');
    if (scoreEl) scoreEl.textContent = '50';
    if (stageEl) {
      stageEl.textContent = '中性';
      stageEl.style.color = stageToColor('中性');
    }
    if (changeEl) changeEl.textContent = '變化-不變';
  }

  /* ── 初始化（建面板 + 建圖表） ───────────────────────── */
  function init() {
    buildPanel();

    /* 等 Chart.js 載入後才建圖表 */
    if (typeof Chart !== 'undefined') {
      buildTrendChart();
      buildDetailRadarChart();
      loadFromStorage();
    } else {
      /* Chart.js 還沒載入，等 script onload */
      const script = document.getElementById('ec-chartjs-cdn');
      if (script) {
        script.addEventListener('load', () => {
          buildTrendChart();
          buildDetailRadarChart();
          loadFromStorage();
        });
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
