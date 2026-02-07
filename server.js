const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://api.nvcf.nvidia.com/v2/nvcf';
const NIM_MODEL_ID = 'deepseek/deepseek-v3.2'; // ← заменено на запрошенную модель

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, max_tokens = 4096, temperature = 0.7 } = req.body;
    
    const response = await axios.post(
      `${NVIDIA_BASE_URL}/pexec/functions/${NIM_MODEL_ID}`,
      { messages, max_tokens, temperature, top_p: 0.95, stream: false },
      {
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        timeout: 180000
      }
    );

    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: NIM_MODEL_ID,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.data.choices?.[0]?.message?.content || response.data.content || ''
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: response.data.usage?.prompt_tokens || 0,
        completion_tokens: response.data.usage?.completion_tokens || 0,
        total_tokens: response.data.usage?.total_tokens || 0
      }
    });
  } catch (error) {
    console.error('Ошибка:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: {
        message: error.response?.data?.detail || error.message || 'Ошибка генерации',
        type: 'proxy_error',
        code: error.response?.status || 500
      }
    });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', model: NIM_MODEL_ID }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Прокси запущен. Модель: ${NIM_MODEL_ID}`));
