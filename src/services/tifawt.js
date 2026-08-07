/**
 * Tifawt ERP integration helpers for the storefront.
 *
 * syncOrderSideEffects fires-and-forgets an order to the tracking server
 * (/bot-api/api/orders/sync) which persists it as a Tifawt bundled lead.
 * Errors are swallowed here – the caller already caught the promise.
 */

export const createStoreOrderId = () =>
    'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();

/**
 * Push a completed store order to the Tifawt ERP via the bot-api tracking
 * server. Non-critical: the caller catches errors, so a network blip never
 * blocks the checkout success page.
 *
 * @param {{ orderId, name, phone, address, city, items }} orderData
 */
export const syncOrderSideEffects = async (orderData) => {
    const { orderId, name, phone, address, city, items } = orderData || {};

    if (!orderId || !name || !phone || !Array.isArray(items) || !items.length) {
        console.warn('[tifawt] syncOrderSideEffects: missing required fields', orderData);
        return false;
    }

    try {
        const response = await fetch('/bot-api/api/orders/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Store-Order-Id': orderId,
            },
            body: JSON.stringify({
                orderId,
                name,
                phone,
                address: address || '',
                city: city || 'المغرب',
                items,
            }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.warn('[tifawt] sync returned non-OK status', response.status, result);
            return false;
        }

        if (result?.duplicate) {
            console.info('[tifawt] order already synced (duplicate):', orderId);
        } else {
            console.info('[tifawt] order synced successfully:', orderId, 'leadId:', result?.leadId);
        }

        return true;
    } catch (err) {
        console.error('[tifawt] syncOrderSideEffects failed:', err?.message || err);
        return false;
    }
};
