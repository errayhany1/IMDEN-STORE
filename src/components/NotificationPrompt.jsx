import React from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import useStore from '../store/useStore';
import { useState } from 'react';

const NotificationPrompt = () => {
    const { permission, supported, requestPermission } = useNotifications();
    const darkMode = useStore(s => s.darkMode);
    const dm = darkMode;
    const [dismissed, setDismissed] = useState(
        () => localStorage.getItem('notif-dismissed') === '1'
    );

    // Only show if: supported, not yet decided, and not dismissed
    if (!supported || permission !== 'default' || dismissed) return null;

    const dismiss = () => {
        localStorage.setItem('notif-dismissed', '1');
        setDismissed(true);
    };

    const enable = async () => {
        await requestPermission();
        dismiss();
    };

    return (
        <div className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm
            ${dm ? 'bg-gray-800 text-gray-200' : 'bg-primary/10 text-primary'}`}
            dir="rtl"
        >
            <div className="flex items-center gap-2">
                <Bell size={16} />
                <span>فعّل الإشعارات لتصلك المنتجات الجديدة فوراً</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={enable}
                    className="bg-primary text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-primary-dark transition-colors"
                >
                    تفعيل
                </button>
                <button onClick={dismiss} className="opacity-60 hover:opacity-100 transition-opacity">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default NotificationPrompt;
