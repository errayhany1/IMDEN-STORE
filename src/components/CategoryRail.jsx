import React, { useState } from 'react';
import useStore from '../store/useStore';
import { MessageSquarePlus } from 'lucide-react';
import FeedbackModal from './FeedbackModal';

const CategoryRail = () => {
    const { darkMode } = useStore();
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    return (
        <section className="mb-4 mt-2 px-2">
            <div className={`p-4 rounded-xl border text-center shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors
                ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-primary/5 border-primary/20 text-slate-800'}`}>
                <div className="text-right flex-1">
                    <h2 className="text-base sm:text-lg font-bold">هل تبحث عن منتج غير متوفر في السوق؟</h2>
                    <p className={`text-xs sm:text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                        اكتب لنا أسماء المنتجات أو الأجهزة التي تبحث عنها وسنقوم باستيرادها وتوفيرها لك بأفضل الأسعار.
                    </p>
                </div>
                <button 
                    onClick={() => setIsFeedbackOpen(true)}
                    className="w-full sm:w-auto shrink-0 bg-primary hover:bg-primary/90 text-white font-semibold py-2 px-4 text-sm rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-sm"
                >
                    <MessageSquarePlus size={16} />
                    اطلب منتجك الآن
                </button>
            </div>

            <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        </section>
    );
};

export default CategoryRail;
