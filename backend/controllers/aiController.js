// /home/prometheus/project/backend/controllers/aiController.js
const axios = require('axios');

exports.askAI = async (req, res) => {
    try {
        const { prompt } = req.body;
        const response = await axios.post(
            process.env.HF_MODEL_URL, // 確保 .env 裡有這個網址
            {
                model: process.env.HF_MODEL_NAME, // 確保 .env 裡有這個模型名
                messages: [
                    {role: "system", content: "你是一個友善、樂於助人的虛擬寵物，請以口語化、自然且簡潔的繁體中文回答，不需要顯示思考過程。" }, // 增加系統提示詞
                    { role: "user", content: prompt }
                ],
                max_tokens: 500
                // temperature: 0.7 // 讓回答更有變化
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.HF_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        const choice = response.data.choices[0].message
        console.log("HF Response Data:", JSON.stringify(response.data, null, 2));

        const aiAnswer = choice.content || choice.reasoning || "模型思考了很久但沒說話";
        // const aiAnswer = response.data.choices[0].message.content || "模型沒有回傳內容"
        res.json({ success: true, answer: aiAnswer });

    } catch (error) {
        console.error("AI Error:", error.response?.data || error.message);
        res.status(500).json({ success: false, message: "AI 暫時無法回應" });
    }
};