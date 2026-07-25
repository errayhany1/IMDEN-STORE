/**
 * Generate template preview JPEGs and optionally send them to Telegram.
 * Usage:
 *   node scripts/send-template-previews.mjs
 *   node scripts/send-template-previews.mjs --chat=123456789
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import {
  REGULAR_TEMPLATES,
  SALE_TEMPLATES,
  renderTemplatePreview,
} from '../bot/imageTemplates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'bot', '.env') });

const token = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
const outDir = path.join(root, 'bot', 'template-previews');
fs.mkdirSync(outDir, { recursive: true });

const chatArg = process.argv.find((a) => a.startsWith('--chat='));
let chatId = chatArg ? chatArg.split('=')[1] : (process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID || '');

async function resolveChatId() {
  if (chatId) return chatId;
  if (!token) return '';
  const { data } = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, {
    params: { limit: 50 },
    timeout: 20000,
  });
  const updates = data?.result || [];
  for (let i = updates.length - 1; i >= 0; i--) {
    const u = updates[i];
    const id = u.message?.chat?.id || u.callback_query?.message?.chat?.id;
    if (id) return String(id);
  }
  return '';
}

async function sendPhoto(chat, buffer, caption) {
  const form = new FormData();
  form.append('chat_id', String(chat));
  form.append('photo', buffer, { filename: 'preview.jpg', contentType: 'image/jpeg' });
  form.append('caption', caption);
  await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, {
    headers: form.getHeaders(),
    timeout: 60000,
    maxBodyLength: Infinity,
  });
}

const all = [
  ...REGULAR_TEMPLATES.map((t) => ({ ...t, group: 'عادي' })),
  ...SALE_TEMPLATES.map((t) => ({ ...t, group: 'تخفيض' })),
];

console.log('Rendering template previews…');
for (const tpl of all) {
  const buf = await renderTemplatePreview(tpl);
  const file = path.join(outDir, `${tpl.id}.jpg`);
  fs.writeFileSync(file, buf);
  console.log(' wrote', file);
}

chatId = await resolveChatId();
if (!token || !chatId) {
  console.log('\nPreviews saved to bot/template-previews/');
  console.log('Could not send to Telegram (missing token or chat).');
  console.log('After Deploy, open the bot and tap: 🎨 قوالب الصور  /  🔥 قوالب التخفيض');
  process.exit(0);
}

console.log(`\nSending ${all.length} previews to chat ${chatId}…`);
await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
  chat_id: chatId,
  text: '🎨 معاينات قوالب الصور\nاختر ما يعجبك من الأزرار داخل البوت بعد Deploy عبر:\n/templates و /templates_sale',
});

for (const tpl of all) {
  const buf = fs.readFileSync(path.join(outDir, `${tpl.id}.jpg`));
  await sendPhoto(
    chatId,
    buf,
    `${tpl.group === 'تخفيض' ? '🔥' : '🎨'} ${tpl.nameAr}\n${tpl.blurbAr}\n🆔 ${tpl.id}`
  );
  console.log(' sent', tpl.id);
}

console.log('Done.');
