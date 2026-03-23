// /home/prometheus/project/backend/controllers/aiController.js
const axios = require('axios')
// const exports = require('express')

exports.askAI = async (req, res) => {
    try {
        const { prompt } = req.body;
        const response = await axios.post(
            process.env.HF_MODEL_URL, // 確保 .env 裡有這個網址
            {
                model: process.env.HF_MODEL_NAME, // 確保 .env 裡有這個模型名
                messages: [
                    {
                        role: "system", 
                        content: "你是一個友善、樂於助人的虛擬寵物，請以口語化、自然且簡潔的繁體中文回答，不需要顯示思考過程。" 

                    }, // 增加系統提示詞
                    { role: "user", content: prompt }
                ],
                max_tokens: 500,
                temperature: 0.7 // 讓回答更有變化
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.HF_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log("HF 原始回傳:", JSON.stringify(response.data, null, 2));

        // 安全地抓取路徑，避免 choices[0] 未定義導致 crash
        const choice = response.data?.choices?.[0] || {};
        const message = choice.message || {};
        
        // 嘗試抓取內容
        let aiAnswer = message.content || "";

        // 如果內容是空的，檢查是不是在特殊的 reasoning 欄位
        if (!aiAnswer && message.reasoning_content) {
            aiAnswer = message.reasoning_content;
        }

        // 過濾掉 <think> 標籤
        aiAnswer = aiAnswer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        // 如果最後還是空的，給個預設回覆
        if (!aiAnswer) {
            aiAnswer = "主人，我剛才發呆了一下，沒聽清楚呢 ! 喵~ !";
        }

        res.json({ success: true, answer: aiAnswer });

    } catch (error) {
        // 這邊會印出到底為什麼出錯（是 401 權限不足？還是 404 網址錯了？）
        console.error("--- AI Controller 發生錯誤 ---");
        if (error.response) {
            console.error("狀態碼:", error.response.status);
            console.error("錯誤訊息:", error.response.data);
        } else {
            console.error("錯誤原因:", error.message);
        }
        
        res.status(500).json({ 
            success: false, 
            message: "寵物去睡午覺了喵～",
            debug: error.message // 暫時把錯誤訊息傳給前端看，方便修 Bug
        });
    }
};