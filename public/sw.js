/* global clients */
import { precacheAndRoute } from 'workbox-precaching';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { registerRoute } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST);

// Product images are self-hosted and content-hashed. Cache only images the
// visitor actually views, then reuse them instantly on later visits.
registerRoute(
    ({ url, request }) => (
        request.destination === 'image'
        && url.origin === self.location.origin
        && url.pathname.startsWith('/product-images/')
    ),
    new CacheFirst({
        cacheName: 'product-images-v1',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 1200,
                maxAgeSeconds: 60 * 60 * 24 * 365,
                purgeOnQuotaError: true
            })
        ]
    })
);

// Service Worker for WholesaleCatalog
// Handles: push notifications + periodic new-product checks

const CACHE_NAME = 'wsc-v1';
const SEEN_PRODUCTS_KEY = 'seen_product_ids';

// ── Install & Activate ──────────────────────────────────────────
self.addEventListener('install', () => {
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
        icon: '/app-icon-192.png',
        badge: '/app-icon-192.png',
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
    const targetUrl = new URL(url, self.location.origin).href;
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url === targetUrl && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});

const RESTOCK_NOTIFIED_KEY = 'restock_notified_ids';

const getCachedSet = async (key) => {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(key);
    return response ? new Set(await response.json()) : new Set();
};

const saveCachedSet = async (key, values) => {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, new Response(JSON.stringify([...values])));
};

const checkNewProducts = async ({ apiUrl, apiToken, tableId }) => {
    const resp = await fetch(
        `${apiUrl}/api/v2/tables/${tableId}/records?limit=25&where=(POSTEBL,eq,POSTEBL)&sort=-CreatedAt`,
        { headers: { 'xc-token': apiToken, accept: 'application/json' } }
    );
    if (!resp.ok) return;

    const data = await resp.json();
    const records = data.list || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = records.filter((record) => (
        new Date(record.CreatedAt || record.created_at || 0) >= today
    ));
    if (newToday.length === 0) return;

    const seen = await getCachedSet(SEEN_PRODUCTS_KEY);
    const unseen = newToday.filter((record) => !seen.has(String(record.Id || record.id)));
    if (unseen.length === 0) return;

    unseen.forEach((record) => seen.add(String(record.Id || record.id)));
    await saveCachedSet(SEEN_PRODUCTS_KEY, seen);

    const count = unseen.length;
    await self.registration.showNotification('IMDEN TECHNOLOGY 🆕', {
        body: count === 1
            ? `منتج جديد: ${unseen[0].Title || 'منتج جديد'}`
            : `${count} منتجات جديدة وصلت اليوم! تحقق الآن.`,
        icon: '/app-icon-192.png',
        badge: '/app-icon-192.png',
        dir: 'rtl',
        lang: 'ar',
        tag: 'new-products',
        data: { url: '/' }
    });
};

const fetchSubscribedProduct = async ({ apiUrl, apiToken, tableId }, subscription) => {
    if (subscription.id) {
        const response = await fetch(
            `${apiUrl}/api/v2/tables/${tableId}/records/${encodeURIComponent(subscription.id)}`,
            { headers: { 'xc-token': apiToken, accept: 'application/json' } }
        );
        if (response.ok) return response.json();
    }

    if (!subscription.ref) return null;
    const response = await fetch(
        `${apiUrl}/api/v2/tables/${tableId}/records?limit=1&where=(SKU,eq,${encodeURIComponent(subscription.ref)})`,
        { headers: { 'xc-token': apiToken, accept: 'application/json' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.list?.[0] || null;
};

const checkRestocks = async (config) => {
    const subscriptions = config.restockSubscriptions || [];
    if (subscriptions.length === 0) return;

    const notified = await getCachedSet(RESTOCK_NOTIFIED_KEY);
    const available = [];

    for (const subscription of subscriptions) {
        const key = String(subscription.id || subscription.ref);
        if (notified.has(key)) continue;

        const record = await fetchSubscribedProduct(config, subscription);
        if (record?.POSTEBL === 'POSTEBL') {
            notified.add(key);
            available.push({ subscription, record });
        }
    }

    if (available.length === 0) return;
    await saveCachedSet(RESTOCK_NOTIFIED_KEY, notified);

    for (const { subscription, record } of available) {
        const productName = record.Title || subscription.name || record.SKU || 'المنتج';
        await self.registration.showNotification('عاد المنتج للمخزون 🔔', {
            body: `${productName} متوفر الآن. اطلبه قبل نفاد الكمية.`,
            icon: '/app-icon-192.png',
            badge: '/app-icon-192.png',
            dir: 'rtl',
            lang: 'ar',
            tag: `restock-${subscription.id || subscription.ref}`,
            data: { url: `/?search=${encodeURIComponent(record.SKU || subscription.ref || '')}` }
        });
    }

    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    clientList.forEach((client) => client.postMessage({
        type: 'RESTOCK_AVAILABLE',
        productKeys: available.map(({ subscription }) => String(subscription.id || subscription.ref)),
    }));
};

// Called from the main app immediately and then every hour.
self.addEventListener('message', event => {
    if (!['CHECK_CATALOG_UPDATES', 'CHECK_NEW_PRODUCTS'].includes(event.data?.type)) return;
    const config = event.data;

    event.waitUntil(
        Promise.all([
            checkNewProducts(config),
            checkRestocks(config),
        ]).catch((err) => console.error('[SW] Error checking catalog updates:', err))
    );
});
