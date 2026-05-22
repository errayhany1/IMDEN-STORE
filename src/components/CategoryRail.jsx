import React, { useState } from 'react';
import useStore from '../store/useStore';
import { 
    MessageSquarePlus, Layers, Zap, Headphones, Watch, Gamepad2, 
    Mouse, HardDrive, Laptop, MonitorUp, Lightbulb, Camera, 
    Wifi, Mic, BatteryCharging, Box, XCircle 
} from 'lucide-react';
import FeedbackModal from './FeedbackModal';

export const categoryTranslation = {
    'All': 'الكل',
    'Chargers': 'شواحن',
    'Audio': 'سماعات',
    'Smart Watches': 'ساعات ذكية',
    'Gaming': 'ألعاب',
    'Mouse & Keyboard': 'ماوس وكيبورد',
    'Storage': 'تخزين',
    'Laptop Chargers': 'شواحن حواسيب',
    'Stands': 'ستاندات',
    'Lighting': 'إضاءة',
    'Cameras': 'كاميرات',
    'Network': 'شبكات',
    'Microphones': 'ميكروفونات',
    'Batteries & Power Banks': 'بطاريات وباوربانك',
    'General': 'عام',
    'Out of Stock': 'نفد من المخزون'
};

const categoryIcons = {
    'All': Layers,
    'Chargers': Zap,
    'Audio': Headphones,
    'Smart Watches': Watch,
    'Gaming': Gamepad2,
    'Mouse & Keyboard': Mouse,
    'Storage': HardDrive,
    'Laptop Chargers': Laptop,
    'Stands': MonitorUp,
    'Lighting': Lightbulb,
    'Cameras': Camera,
    'Network': Wifi,
    'Microphones': Mic,
    'Batteries & Power Banks': BatteryCharging,
    'General': Box,
    'Out of Stock': XCircle
};

const CategoryRail = () => {
    const { darkMode, categories, selectedCategory, setCategory, user, setAuthModalOpen } = useStore();
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    const handleRequestProduct = () => {
        if (user) {
            setIsFeedbackOpen(true);
        } else {
            setAuthModalOpen(true);
        }
    };

    return (
        <section className="mb-4 mt-2 px-2 flex flex-col gap-3">
            {/* Category Chips Horizontal Rail */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x rtl" style={{ direction: 'rtl' }}>
                {categories.map((cat, idx) => {
                    const Icon = categoryIcons[cat] || Box;
                    return (
                        <button
                            key={idx}
                            onClick={() => setCategory(cat)}
                            className={`snap-center shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-sm flex items-center gap-2 border whitespace-nowrap
                                ${selectedCategory === cat 
                                    ? 'bg-primary text-white border-primary shadow-md transform scale-105' 
                                    : darkMode 
                                        ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700' 
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                            <Icon size={16} className={selectedCategory === cat ? 'text-white' : (darkMode ? 'text-gray-400' : 'text-slate-500')} />
                            {categoryTranslation[cat] || cat}
                        </button>
                    );
                })}
            </div>

            {/* Compact Request Product Banner */}
            <div 
                onClick={handleRequestProduct}
                className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-all hover:shadow-md active:scale-[0.98]
                ${darkMode ? 'bg-gray-800/60 border-gray-700 text-white hover:bg-gray-800' : 'bg-primary/5 border-primary/20 text-slate-700 hover:bg-primary/10'}`}
                style={{ direction: 'rtl' }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <MessageSquarePlus size={16} className="text-primary shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold truncate">تبحث عن منتج؟ اطلبه الآن</span>
                </div>
                <span className={`text-[10px] sm:text-xs shrink-0 px-2 py-0.5 rounded-full font-medium
                    ${darkMode ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'}`}>
                    طلب →
                </span>
            </div>

            <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        </section>
    );
};

export default CategoryRail;
