/*
 * 負責與 Python Port 5000 溝通的服務
*/

const FETCH_TIMEOUT_MS = 100000;

exports.analyzeTextFromPython = async (text, typing = null, history_last10 = []) => {
    const baseUrl = process.env.PYTHON_API_URL_sa?.replace(/\/+$/, '') || 'http://127.0.0.1:5000';
    const url = `${baseUrl}/analyze`;

    const payload = {
        text: text,
        history_last10: history_last10,
        typing: typing || {
            timestamps: [],
            duration_sec: 0.0,
            total_chars: text.length,
            wpm: 0,
            backspaces: 0,
            pauses: 0,
            hesitation_index: 0.0,
        }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('Python 服務回傳錯誤:', response.status, text);
            throw new Error('Python Sentiment Service Unavailable');
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('呼叫 Python 服務失敗：超時', FETCH_TIMEOUT_MS, 'ms');
            throw new Error('Python Sentiment Service Timeout');
        }
        console.error('呼叫 Python 服務失敗:', error.message);
        throw new Error('Python Sentiment Service Unavailable');
    } finally {
        clearTimeout(timeoutId);
    }
};
