import React from 'react';
import { MessageCircle } from 'lucide-react';

const PromotionalBanner = () => {
    return (
        <section className="mb-12 rounded-2xl overflow-hidden shadow-lg relative bg-primary">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-dark to-primary opacity-90"></div>
            <div className="relative z-10 px-6 py-6 md:py-8 flex flex-col md:flex-row-reverse items-center justify-between text-center md:text-right gap-4" dir="rtl">
                <div className="max-w-3xl">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">التوصيل متوفر لجميع المدن</h2>
                    <ul className="text-blue-50 text-sm md:text-base space-y-1">
                        <li>📦 أقل مبلغ للطلب: 800 درهم (لإجمالي السلة وليس لمنتج واحد).</li>
                        <li>للكميات الكبيرة يمكن ان ينقص الثمن.</li>
                    </ul>
                    <p className="mt-2 text-blue-100 text-sm font-medium">📞 للمزيد من التفاصيل، تواصل معنا عبر الواتساب:</p>
                </div>
                <button
                    onClick={() => window.open('https://wa.me/212681652324', '_blank')}
                    className="bg-whatsapp hover:brightness-110 text-white font-bold py-2 px-6 rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center gap-2 whitespace-nowrap text-sm md:text-base"
                >
                    <MessageCircle size={20} fill="currentColor" />
                    تواصل معنا
                </button>
            </div>
        </section>
    );
};

export default PromotionalBanner;
