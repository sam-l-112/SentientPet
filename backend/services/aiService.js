const axios = require('axios')

exports.askAI = async (req, res) =>{
    try {
        const{ prompt } = req.body;

        const response = await axios.post(
            process.env.HF_MODEL_URL,
            {  
                model: process.env.HF_MODEL_NAME,
                messages: [{ role: "user", content: prompt }], // 新網址必須用 messages 格式
                max_tokens: 500
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.HF_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        )
        const aiReply = response.data.choices[0].message.content
        res.json({ success: true, answer: aiReply })

    } catch (error) {
        console.error("HF API Error: ", error.response?.data || error.message)
        res.status(500).json({ success: false, message: "AI 服務暫不可用" })
    }
}