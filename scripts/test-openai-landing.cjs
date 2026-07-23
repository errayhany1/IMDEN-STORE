/**
 * Smoke-test OpenAI landing copy (uses OPENAI_API_KEY from .env).
 * node scripts/test-openai-landing.cjs
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const root = path.join(__dirname, '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
    })
);

const key = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY;
if (!key) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

(async () => {
  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: 'Reply ONLY with JSON: {"ok":true,"provider":"openai","note":"landing pipeline ready"}',
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
  console.log('OPENAI_OK', data?.choices?.[0]?.message?.content);
})().catch((e) => {
  console.error('OPENAI_FAIL', e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
