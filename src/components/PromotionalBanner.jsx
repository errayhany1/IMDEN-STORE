import React, { useState, useEffect } from 'react';

const TELEGRAM_URL = 'https://t.me/ERRAYHANY_GROSSISTE';
const WA_NUMBER = '212664630566';

const PromotionalBanner = () => {
    const [visible, setVisible] = useState(true);
    const [animateOut, setAnimateOut] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimateOut(true);
            setTimeout(() => setVisible(false), 600);
        }, 8000); // auto-hide after 8 seconds
        return () => clearTimeout(timer);
    }, []);

    if (!visible) return null;

    return (
        <div
            style={{
                transition: 'all 0.6s ease',
                opacity: animateOut ? 0 : 1,
                transform: animateOut ? 'translateY(-20px)' : 'translateY(0)',
                maxHeight: animateOut ? '0' : '80px',
                overflow: 'hidden',
            }}
            className="mb-6 relative"
        >
            <div className="rounded-2xl overflow-hidden shadow-lg bg-primary relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-dark to-primary opacity-90"></div>
                <div className="relative z-10 flex items-center justify-between px-4 py-3 gap-4">

                    {/* Scrolling Ticker Text */}
                    <div className="overflow-hidden flex-1 relative">
                        <div className="flex items-center gap-2 whitespace-nowrap animate-marquee text-white text-sm font-medium">
                            <span>🛍️ تسوق الآن من متجر Errayhany Grossiste</span>
                            <span className="mx-6">•</span>
                            <span>📦 توصيل لجميع المدن المغربية</span>
                            <span className="mx-6">•</span>
                            <span>💬 تواصل معنا عبر واتساب أو تلغرام</span>
                            <span className="mx-6">•</span>
                            <span>📲 حمل التطبيق الآن</span>
                            <span className="mx-6">•</span>
                            <span>🛍️ تسوق الآن من متجر Errayhany Grossiste</span>
                            <span className="mx-6">•</span>
                            <span>📦 توصيل لجميع المدن المغربية</span>
                        </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                        <a
                            href={`https://wa.me/${WA_NUMBER}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition"
                        >
                            واتساب
                        </a>
                        <a
                            href={TELEGRAM_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition"
                        >
                            تلغرام
                        </a>
                        <button
                            onClick={() => { setAnimateOut(true); setTimeout(() => setVisible(false), 600); }}
                            className="text-white/70 hover:text-white text-lg leading-none px-1"
                            aria-label="إغلاق"
                        >
                            ×
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes marquee {
                    0%   { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 18s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default PromotionalBanner;

