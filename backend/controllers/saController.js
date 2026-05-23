// controllers/saController.js
const axios = require('axios');
// const express = require('express')
const pool = require('../config/database');
const saService = require('../services/saService');

exports.handleSentimentAnalysis = async (req, res) => {
    const { cs_id, mes_id, content, typing, history_last10 } = req.body;

    if (!cs_id || !mes_id || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: '缺少 cs_id、mes_id 或 content' });
    }

    try {
        const saStart = Date.now();
        const response = await saService.analyzeTextFromPython(content, typing, history_last10 || []);
        const saElapsedMs = Date.now() - saStart;
        const sa_elapsed = Math.round((saElapsedMs / 1000) * 10) / 10; // seconds, 1 decimal

        // 🔥 【核心除錯】放最前面，保證 100% 執行！看清楚 Python 回傳的真實 JSON 結構
        console.log('====== Python 實際回傳的資料內容 ======', JSON.stringify(response, null, 2));

        if (!response.success || !response.data) {
            throw new Error('Invalid response from Python service');
        }

        const emotionData = response.data;

        // 驗證必要的欄位結構
        if (!emotionData.ekman) {
            console.error('Missing ekman field in response:', emotionData);
            throw new Error('Invalid emotion data: missing ekman field');
        }

        // 檢查 ekman 中的所有情緒值
        const requiredEmotions = ['happiness', 'sadness', 'anger', 'fear', 'disgust', 'surprise'];
        for (const emotion of requiredEmotions) {
            if (typeof emotionData.ekman[emotion] !== 'number') {
                console.error(`Missing or invalid ${emotion}:`, emotionData.ekman[emotion]);
                throw new Error(`Invalid emotion data: missing or invalid ${emotion}`);
            }
        }

        // 檢查 context_shift 欄位
        if (typeof emotionData.context_shift !== 'string') {
            console.error('Invalid context_shift:', emotionData.context_shift);
            throw new Error('Invalid emotion data: missing context_shift');
        }

        // 安全取得 ekman 欄位，避免 undefined 錯誤
        const ekmanObj = emotionData.ekman || {};

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

        const valenceValue = (emotionData.vad && typeof emotionData.vad.valence === 'number')
            ? Math.round(emotionData.vad.valence)
            : null;

        const mappedData = {
            joy: Math.round(ekmanObj.happiness),
            sadness: Math.round(ekmanObj.sadness),
            anger: Math.round(ekmanObj.anger),
            fear: Math.round(ekmanObj.fear),
            disgust: Math.round(ekmanObj.disgust),
            surprise: Math.round(ekmanObj.surprise),
            valence: valenceValue,
            stage: stage,
            summary: emotionData.summary || ekmanObj.summary || ''
        };

        const query = `
            INSERT INTO Emotion_Tracker 
            (cs_id, mes_id, joy, sadness, anger, fear, disgust, surprise, valence, stage, sa_elapsed, summary) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            sa_elapsed,
            mappedData.summary
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
        // const [rows] = await pool.execute()
        //        []              axios.query
        const rows = await pool.query(
            'SELECT * FROM Emotion_Tracker WHERE cs_id = ? ORDER BY analyzed_at ASC',
            [cs_id]
        );
        res.json({ success: true, history: rows });
    } catch (error) {
        res.status(500).json({ error: '獲取追蹤資料失敗' });
    }
};