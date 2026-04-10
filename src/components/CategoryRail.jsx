import React, { useState } from 'react';
import useStore from '../store/useStore';
import { MessageSquarePlus } from 'lucide-react';
import FeedbackModal from './FeedbackModal';

const CategoryRail = () => {
    const { darkMode } = useStore();
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    return (
        <section className="mb-6 mt-4 px-2">
            <div className={`p-6 rounded-2xl border text-center shadow-sm flex flex-col items-center justify-center gap-3 transition-colors
                ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-primary/5 border-primary/20 text-slate-800'}`}>
                <h2 className="text-xl font-bold">مرحباً بك في متجر IMDEN TECHNOLOGY</h2>
                <p className={`text-sm max-w-md ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                    نحن نعمل على تحديث وتطوير الأقسام لتقديم أفضل تجربة لكم. نرحب بجميع اقتراحاتكم وشكاويكم لتطوير المتجر.
                </p>
                <button 
                    onClick={() => setIsFeedbackOpen(true)}
                    className="mt-2 bg-primary hover:bg-primary/90 text-white font-semibold py-2 px-6 rounded-xl flex items-center gap-2 transition-transform active:scale-95 shadow-md"
                >
                    <MessageSquarePlus size={18} />
                    أرسل اقتراحأ أو شكوى
                </button>
            </div>

            <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        </section>
    );
};

export default CategoryRail;
