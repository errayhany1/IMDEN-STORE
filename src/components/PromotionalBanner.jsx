import React from 'react';
import { MessageCircle } from 'lucide-react';

const PromotionalBanner = () => {
    return (
        <section className="mb-12 rounded-2xl overflow-hidden shadow-lg relative bg-primary">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-dark to-primary opacity-90"></div>
            <div className="relative z-10 px-8 py-10 md:py-12 flex flex-col md:flex-row-reverse items-center justify-between text-center md:text-right gap-6" dir="rtl">
                <div className="max-w-2xl">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">التوصيل متوفر لجميع المدن</h2>
                    <ul className="text-blue-50 text-base md:text-lg space-y-2">
                        <li>📦 أقل مبلغ للطلب: 800 درهم (لإجمالي السلة وليس لمنتج واحد).</li>
                        <li>للكميات الكبيرة يمكن ان ينقص الثمن.</li>
                    </ul>
                    <p className="mt-4 text-blue-100 font-medium">📞 للمزيد من التفاصيل، تواصل معنا عبر الواتساب:</p>
                </div>
                <button
                    onClick={() => window.open('https://wa.me/212681652324', '_blank')}
                    className="bg-whatsapp hover:brightness-110 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center gap-3 whitespace-nowrap"
                >
                    <MessageCircle size={24} fill="currentColor" />
                    تواصل معنا
                </button>
            </div>
        </section>
    );
};

export default PromotionalBanner;
