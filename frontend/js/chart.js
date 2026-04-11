// js/chart.js
console.log("chart.js 已成功載入！");

let emotionChart = null;
const emotionData = [];
const emotionLabels = [];
const IS_MOCK_MODE = true; 

function initChart() {
    console.log("正在初始化圖表...");
    const canvas = document.getElementById('emotionChart');
    if (!canvas) {
        console.error("找不到 ID 為 emotionChart 的 Canvas！");
        return;
    }
    const ctx = canvas.getContext('2d');
    
    emotionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: emotionLabels,
            datasets: [{
                label: '情緒分數',
                data: emotionData,
                borderColor: '#e8a0bf',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(232, 160, 191, 0.2)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: 0, max: 100 } }
        }
    });
}

// 這是你點擊按鈕時呼叫的函式
function toggleChart() {
    console.log("切換按鈕被點擊了！");
    const wrapper = document.getElementById('chartWrapper');
    const btn = document.getElementById('toggleChartBtn');
    
    if (!wrapper) {
        console.error("找不到 ID 為 chartWrapper 的容器！");
        return;
    }

    wrapper.classList.toggle('open');
    if (btn) {
        btn.textContent = wrapper.classList.contains('open') ? '隱藏情緒曲線' : '查看情緒曲線';
    }
    
    if (wrapper.classList.contains('open') && !emotionChart) {
        initChart();
    }
}

// 供測試用的模擬分數
function mockEmotionScore(text) {
    if (!IS_MOCK_MODE) return;
    let score = Math.floor(Math.random() * 60) + 20; // 產生 20-80 的隨機分
    updateEmotionChart(score);
}

function updateEmotionChart(score) {
    if (!emotionChart) initChart();
    emotionData.push(score);
    emotionLabels.push(""); 
    if (emotionData.length > 10) {
        emotionData.shift();
        emotionLabels.shift();
    }
    emotionChart.update();
}

// 綁定事件
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('toggleChartBtn');
    if (btn) {
        btn.addEventListener('click', toggleChart);
        console.log("按鈕事件綁定成功！");
    } else {
        console.error("找不到 ID 為 toggleChartBtn 的按鈕，請檢查 index.html");
    }
});