/**
 * Registers the admin Mini App menu button on Telegram bots.
 * Opens https://errayhany.com/admin inside Telegram.
 */
import axios from 'axios';

export function adminWebAppUrl() {
  return (
    process.env.TELEGRAM_WEBAPP_URL
    || `${(process.env.PUBLIC_SITE_URL || 'https://errayhany.com').replace(/\/+$/, '')}/admin?from=tg&tab=dashboard`
  ).trim();
}

function catalogBotTokens() {
  return [...new Set([
    process.env.TELEGRAM_CATALOG_IMDEN_BOT_TOKEN,
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.VITE_TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_NOTIFY_BOT_TOKEN,
  ].map((token) => String(token || '').trim()).filter(Boolean))];
}

export async function setupAdminWebAppMenus() {
  const url = adminWebAppUrl();
  const tokens = catalogBotTokens();
  if (!tokens.length) {
    console.warn('[admin-webapp] no bot tokens to register');
    return { ok: false, error: 'no_bot_token' };
  }

  const results = [];
  for (const token of tokens) {
    try {
      const me = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 15000 });
      const username = me.data?.result?.username || '';
      await axios.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
        menu_button: {
          type: 'web_app',
          text: 'أدمن',
          web_app: { url },
        },
      }, { timeout: 15000 });
      results.push({ ok: true, username });
      console.log(`[admin-webapp] menu @${username} → ${url}`);
    } catch (error) {
      results.push({
        ok: false,
        error: error?.response?.data?.description || error.message,
      });
      console.warn('[admin-webapp] menu failed:', error?.response?.data || error.message);
    }
  }
  return { ok: results.some((row) => row.ok), url, results };
}
