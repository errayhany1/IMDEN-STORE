import { useEffect, useState } from 'react';

export function useNotifications() {
    const [permission, setPermission] = useState(
        typeof window !== 'undefined' && 'Notification' in window
            ? Notification.permission
            : 'denied'
    );
    const [supported, setSupported] = useState(false);

    // Schedule hourly checks via SW postMessage
    const scheduleHourlyCheck = (reg) => {
        const trigger = () => {
            if (reg.active) {
                reg.active.postMessage({
                    type: 'CHECK_NEW_PRODUCTS',
                    apiUrl: import.meta.env.VITE_NOCODB_URL,
                    apiToken: import.meta.env.VITE_NOCODB_API_TOKEN,
                    tableId: import.meta.env.VITE_NOCODB_TABLE_PRODUCTS,
                });
            }
        };

        // Run immediately when SW is ready
        trigger();

        // Schedule at the top of each subsequent hour
        const now = Date.now();
        const msUntilNextHour = 3600000 - (now % 3600000);
        setTimeout(() => {
            trigger();
            setInterval(trigger, 3600000);
        }, msUntilNextHour);
    };

    useEffect(() => {
        if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
        setSupported(true);

        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                // Wait for SW to be active
                if (reg.active) {
                    scheduleHourlyCheck(reg);
                } else {
                    reg.addEventListener('updatefound', () => {
                        reg.installing?.addEventListener('statechange', () => {
                            if (reg.active) scheduleHourlyCheck(reg);
                        });
                    });
                }
            })
            .catch(err => console.error('[SW] Registration failed:', err));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const requestPermission = async () => {
        if (!supported) return 'denied';
        const result = await Notification.requestPermission();
        setPermission(result);
        return result;
    };

    return { permission, supported, requestPermission };
}
