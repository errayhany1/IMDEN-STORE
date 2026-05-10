import React from 'react';
import SocialButton from './SocialButton';

const TELEGRAM_URL = 'https://t.me/Imden_technology';
const WA_NUMBER = '212664630566';

const PromotionalBanner = () => {
    return (
        <section className="mb-12 rounded-2xl overflow-hidden shadow-lg relative bg-primary">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-dark to-primary opacity-90"></div>
            <div className="relative z-10 px-6 py-6 md:py-8 flex flex-col md:flex-row-reverse items-center justify-between text-center md:text-right gap-4">
                <div className="max-w-3xl">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">التوصيل متوفر لجميع المدن</h2>
                    <ul className="text-blue-50 text-sm md:text-base space-y-1">
                        <li>📦 أقل مبلغ للطلب: 800 درهم (لإجمالي السلة وليس لمنتج واحد).</li>
                        <li>للكميات الكبيرة يمكن ان ينقص الثمن.</li>
                    </ul>
                    <p className="mt-2 text-blue-100 text-sm font-medium">📞 للمزيد من التفاصيل، تواصل معنا:</p>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
                    <SocialButton
                        type="whatsapp"
                        href={`https://wa.me/${WA_NUMBER}`}
                        label="واتساب"
                        size="md"
                    />
                    <SocialButton
                        type="telegram"
                        href={TELEGRAM_URL}
                        label="تلغرام"
                        size="md"
                    />
                    <a
                        href="/ImdenStore.apk"
                        download="ImdenStore.apk"
                        className="flex items-center gap-2 px-4 py-2 bg-white text-primary font-bold rounded-xl shadow-md hover:bg-slate-50 transition hover:scale-105"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        حمل التطبيق (APK)
                    </a>
                </div>
            </div>
        </section>
    );
};

export default PromotionalBanner;
