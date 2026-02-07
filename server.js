const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://api.nvcf.nvidia.com/v2/nvcf';

// Маппинг моделей Janitor → NVIDIA NIM
const MODEL_MAP = {
  'deepseek-chat': 'deepseek/deepseek-chat',
  'deepseek-v3.2': 'deepseek/deepseek-chat', // fallback на доступную модель
  'default': 'deepseek/deepseek-chat'
};

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model = 'deepseek-chat', messages, max_tokens = 2048, temperature = 0.7 } = req.body;
    const nvidiaModel = MODEL_MAP[model] || MODEL_MAP['default'];

    const response = await axios.post(
      `${NVIDIA_BASE_URL}/pexec/functions/${nvidiaModel}`,
      { messages, max_tokens, temperature, top_p: 0.95 },
      {
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        timeout: 180000
      }
    );

    // Форматируем ответ под OpenAI API
    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.data.choices[0]?.message?.content || response.data.content || ''
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
    console.error('Ошибка прокси:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: {
        message: error.response?.data?.detail || 'Ошибка генерации',
        type: 'proxy_error',
        code: error.response?.status || 500
      }
    });
  }
});

// Health check для хостинга
app.get('/health', (req, res) => res.json({ status: 'ok', model: 'deepseek/deepseek-chat' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Прокси запущен. Модель: deepseek/deepseek-chat`));