import React from 'react';
import useStore from '../store/useStore';
import {
    Layers, Zap, Headphones, Watch, Gamepad2,
    Mouse, HardDrive, Laptop, MonitorUp, Lightbulb, Camera,
    Wifi, Mic, BatteryCharging, Box, XCircle, ArrowRight, Cable, Car
} from 'lucide-react';
import { getFamilyById } from '../data/families';

export const categoryTranslation = {
    'All': 'الكل',
    'Chargers': 'شواحن جوال',
    'Audio': 'سماعات',
    'Smart Watches': 'ساعات ذكية',
    'Gaming': 'ألعاب',
    'Mouse & Keyboard': 'ماوس وكيبورد',
    'Storage': 'تخزين',
    'Laptop Chargers': 'شواحن حواسيب',
    'Stands': 'حوامل',
    'Lighting': 'إضاءة',
    'Cameras': 'كاميرات',
    'Network': 'شبكات',
    'Microphones': 'ميكروفونات',
    'Batteries & Power Banks': 'بطاريات وباوربانك',
    'Cables': 'كابلات',
    'Car Accessories': 'إكسسوارات السيارة',
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
    'Cables': Cable,
    'Car Accessories': Car,
    'General': Box,
    'Out of Stock': XCircle
};

const CategoryRail = () => {
    const {
        darkMode,
        categories,
        selectedCategory,
        setCategory,
        selectedFamily,
        clearFamily,
    } = useStore();

    const activeFamily = selectedFamily ? getFamilyById(selectedFamily) : null;
    const visibleCategories = activeFamily
        ? ['All', ...activeFamily.categories]
        : categories.filter((cat) => cat !== 'Out of Stock');

    const handleBackToHome = () => {
        clearFamily();
        const homePath = useStore.getState().browseMode === 'catalog' ? '/catalog' : '/';
        window.history.pushState({}, '', homePath);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <section id="family-products" className="mb-4 mt-2 px-2 flex flex-col gap-3 scroll-mt-20">
            {activeFamily && (
                <div
                    className={`rounded-xl border px-3 py-3 flex items-center justify-between gap-3 ${
                        darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'
                    }`}
                    style={{ direction: 'rtl' }}
                >
                    <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: activeFamily.accent }}>
                            {activeFamily.nameAr}
                        </p>
                        <p className={`text-xs mt-0.5 truncate ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                            {activeFamily.taglineAr}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleBackToHome}
                        className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition
                            ${darkMode
                                ? 'border-gray-600 text-gray-200 hover:bg-gray-800'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <ArrowRight size={14} />
                        كل العائلات
                    </button>
                </div>
            )}

            {/* Category Chips Horizontal Rail */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x rtl" style={{ direction: 'rtl' }}>
                {visibleCategories.map((cat) => {
                    const Icon = categoryIcons[cat] || Box;
                    return (
                        <button
                            key={cat}
                            type="button"
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
        </section>
    );
};

export default CategoryRail;
