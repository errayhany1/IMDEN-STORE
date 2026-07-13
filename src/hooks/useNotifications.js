import { useEffect, useState } from 'react';
import useStore from '../store/useStore';

export function useNotifications() {
    const restockSubscriptions = useStore((state) => state.restockSubscriptions);
    const notificationSupported = (
        typeof navigator !== 'undefined'
        && 'serviceWorker' in navigator
        && typeof window !== 'undefined'
        && 'Notification' in window
    );
    const [permission, setPermission] = useState(
        notificationSupported
            ? Notification.permission
            : 'denied'
    );
    const supported = notificationSupported;

    useEffect(() => {
        if (!notificationSupported) return;

        let hourlyTimer;
        let initialTimer;
        let cancelled = false;

        const subscriptions = restockSubscriptions.map(({ id, ref, name }) => ({ id, ref, name }));
        const trigger = (registration) => {
            const worker = registration.active || registration.waiting;
            worker?.postMessage({
                type: 'CHECK_CATALOG_UPDATES',
                apiUrl: import.meta.env.VITE_NOCODB_URL,
                apiToken: import.meta.env.VITE_NOCODB_API_TOKEN,
                tableId: import.meta.env.VITE_NOCODB_TABLE_PRODUCTS,
                restockSubscriptions: subscriptions,
            });
        };

        navigator.serviceWorker.ready
            .then((registration) => {
                if (cancelled) return;

                trigger(registration);
                const msUntilNextHour = 3600000 - (Date.now() % 3600000);
                initialTimer = window.setTimeout(() => {
                    trigger(registration);
                    hourlyTimer = window.setInterval(() => trigger(registration), 3600000);
                }, msUntilNextHour);
            })
            .catch(err => console.error('[SW] Not ready:', err));

        return () => {
            cancelled = true;
            window.clearTimeout(initialTimer);
            window.clearInterval(hourlyTimer);
        };
    }, [notificationSupported, restockSubscriptions]);

    const requestPermission = async () => {
        if (!supported) return 'denied';
        const result = await Notification.requestPermission();
        setPermission(result);
        return result;
    };

    return { permission, supported, requestPermission };
}
