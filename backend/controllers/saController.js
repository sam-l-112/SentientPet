// controllers/saController.js
const axios = require('axios');
const pool = require('../config/database');
const saService = require('../services/saService');

exports.handleSentimentAnalysis = async (req, res) => {
    const { cs_id, mes_id, content, typing, history_last10 } = req.body;

    if (!cs_id || !mes_id || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: '缺少 cs_id、mes_id 或 content' });
    }

    try {
        const response = await saService.analyzeTextFromPython(content, typing, history_last10 || []);

        if (!response.success || !response.data) {
            throw new Error('Invalid response from Python service');
        }

        const emotionData = response.data;

        if (
            !emotionData.ekman ||
            typeof emotionData.ekman.happiness !== 'number' ||
            typeof emotionData.ekman.sadness !== 'number' ||
            typeof emotionData.ekman.anger !== 'number' ||
            typeof emotionData.ekman.fear !== 'number' ||
            typeof emotionData.ekman.disgust !== 'number' ||
            typeof emotionData.ekman.surprise !== 'number' ||
            typeof emotionData.vad?.valence !== 'number' ||
            typeof emotionData.context_shift !== 'string'
        ) {
            throw new Error('Invalid emotion data from Python service');
        }

        // 映射 Python 的回應到 Node.js 期望的格式
        const contextShift = emotionData.context_shift;
        let stage;
        switch (contextShift) {
            case 'stable':
            case 'mixed':
                stage = 'neutral';
                break;
            case 'up':
                stage = 'positive';
                break;
            case 'down':
                stage = 'negative';
                break;
            default:
                stage = 'neutral'; // fallback
        }

        const mappedData = {
            joy: emotionData.ekman.happiness,
            sadness: emotionData.ekman.sadness,
            anger: emotionData.ekman.anger,
            fear: emotionData.ekman.fear,
            disgust: emotionData.ekman.disgust,
            surprise: emotionData.ekman.surprise,
            valence: emotionData.vad.valence,
            stage: stage
        };

        const query = `
            INSERT INTO Emotion_Tracker 
            (cs_id, mes_id, joy, sadness, anger, fear, disgust, surprise, valence, stage) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            cs_id,
            mes_id,
            mappedData.joy,
            mappedData.sadness,
            mappedData.anger,
            mappedData.fear,
            mappedData.disgust,
            mappedData.surprise,
            mappedData.valence,
            mappedData.stage,
        ];

        await pool.execute(query, params);

        // 回傳給前端
        res.json({
            success: true,
            data: mappedData
        });
        // 在 aiController 存完 message 之後...

    } catch (error){
        console.error('SA Controller Error:', error);
        res.status(500).json({ error: '情緒分析紀錄失敗' });
    }
};
// 獲取歷史趨勢 (ET 功能)
exports.getEmotionalTracking = async (req, res) => {
    const { cs_id } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM Emotion_Tracker WHERE cs_id = ? ORDER BY analyzed_at ASC',
            [cs_id]
        );
        res.json({ success: true, history: rows });
    } catch (error) {
        res.status(500).json({ error: '獲取追蹤資料失敗' });
    }
};