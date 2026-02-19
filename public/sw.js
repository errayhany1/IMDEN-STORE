// Service Worker for WholesaleCatalog
// Handles: push notifications + periodic new-product checks

const CACHE_NAME = 'wsc-v1';
const API_URL = self.__API_URL__ || 'https://app.nocodb.com';
const API_TOKEN = self.__API_TOKEN__ || '';
const TABLE_ID = self.__TABLE_ID__ || '';
const SEEN_PRODUCTS_KEY = 'seen_product_ids';

// ── Install & Activate ──────────────────────────────────────────
self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

// ── Push Notification (from server) ───────────────────────────
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'IMDEN TECHNOLOGY';
    const options = {
        body: data.body || 'تحقق من المنتجات الجديدة!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        dir: 'rtl',
        lang: 'ar',
        tag: data.tag || 'new-products',
        data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click ─────────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url === url && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});

// ── Periodic Background Check for New Products ─────────────────
// Called from the main app every hour via postMessage
self.addEventListener('message', async event => {
    if (event.data?.type !== 'CHECK_NEW_PRODUCTS') return;
    const { apiUrl, apiToken, tableId } = event.data;

    try {
        const resp = await fetch(
            `${apiUrl}/api/v2/tables/${tableId}/records?limit=25&where=(POSTEBL,eq,POSTEBL)&sort=-CreatedAt`,
            { headers: { 'xc-token': apiToken, accept: 'application/json' } }
        );
        if (!resp.ok) return;
        const data = await resp.json();
        const records = data.list || [];

        // Today's records
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newToday = records.filter(r => {
            const d = new Date(r.CreatedAt || r.created_at || 0);
            return d >= today;
        });

        if (newToday.length === 0) return;

        // Check which ones we haven't notified about yet
        const cache = await caches.open(CACHE_NAME);
        const seenResp = await cache.match(SEEN_PRODUCTS_KEY);
        const seen = seenResp ? new Set(await seenResp.json()) : new Set();

        const unseen = newToday.filter(r => !seen.has(String(r.Id || r.id)));
        if (unseen.length === 0) return;

        // Mark as seen
        const newSeen = [...seen, ...unseen.map(r => String(r.Id || r.id))];
        await cache.put(SEEN_PRODUCTS_KEY, new Response(JSON.stringify(newSeen)));

        // Show notification
        const count = unseen.length;
        await self.registration.showNotification('IMDEN TECHNOLOGY 🆕', {
            body: count === 1
                ? `منتج جديد: ${unseen[0].Title || 'منتج جديد'}`
                : `${count} منتجات جديدة وصلت اليوم! تحقق الآن.`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            dir: 'rtl',
            lang: 'ar',
            tag: 'new-products',
            data: { url: '/' }
        });
    } catch (err) {
        console.error('[SW] Error checking new products:', err);
    }
});
