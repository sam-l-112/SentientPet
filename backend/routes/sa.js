const express = require("express")
const router = express.Router()
const saController = require('../controllers/saController');
const authMiddleware = require('../middleware/authMiddleware');

// 接收對話訊息並啟動情緒分析流程
// 前端可直接呼叫 POST /api/sa
router.post('/', authMiddleware, saController.handleSentimentAnalysis);
// 兼容舊路徑 POST /api/sa/sa
router.post('/sa', authMiddleware, saController.handleSentimentAnalysis);

// 取得情緒追蹤歷史 (Emotional Tracking)
router.get('/et/:cs_id', authMiddleware, saController.getEmotionalTracking);

module.exports = router;
