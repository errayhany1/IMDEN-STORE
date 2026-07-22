import React from 'react';
import {
    Layers, Zap, Headphones, Watch, Gamepad2,
    Mouse, HardDrive, Laptop, MonitorUp, Lightbulb, Camera,
    Wifi, Mic, BatteryCharging, Box, Cable, Car,
    Usb, Tv, Fan, Smartphone,
} from 'lucide-react';
import Header from '../components/Header';
import BottomNavBar from '../components/BottomNavBar';
import useStore from '../store/useStore';
import { productFamilies } from '../data/families';
import { CATEGORY_LABEL_AR } from '../data/categories';

const categoryIcons = {
    Chargers: Zap,
    Audio: Headphones,
    'Smart Watches': Watch,
    Gaming: Gamepad2,
    'Mouse & Keyboard': Mouse,
    Storage: HardDrive,
    'Laptop Chargers': Laptop,
    Stands: MonitorUp,
    Lighting: Lightbulb,
    Cameras: Camera,
    Network: Wifi,
    Microphones: Mic,
    'Batteries & Power Banks': BatteryCharging,
    Cables: Cable,
    'Car Accessories': Car,
    'Adapters & Hubs': Usb,
    'TV Boxes': Tv,
    Cooling: Fan,
    Phones: Smartphone,
    General: Box,
};

/**
 * Dedicated mobile page: families + category grid only (no product list).
 */
const CategoriesPage = () => {
    const {
        darkMode,
        categories,
        setCategory,
        setFamily,
        clearFamily,
        setBrowseMode,
    } = useStore();

    const dm = darkMode;
    const list = categories.filter((c) => c !== 'All' && c !== 'Out of Stock');

    const openShopWithCategory = (cat) => {
        clearFamily();
        setBrowseMode('shop');
        setCategory(cat);
        window.location.assign('/');
    };

    const openFamily = (familyId) => {
        setBrowseMode('shop');
        setFamily(familyId);
        setCategory('All');
        window.location.assign(`/family/${familyId}`);
    };

    return (
        <div
            className={`min-h-screen font-sans flex flex-col transition-colors duration-300
                ${dm ? 'bg-gray-950 text-gray-100' : 'bg-background-light text-slate-800'}`}
        >
            <Header />

            <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-5 pb-28 md:pb-8" style={{ direction: 'rtl' }}>
                <h1 className={`text-xl font-bold mb-1 ${dm ? 'text-white' : 'text-slate-900'}`}>
                    التصنيفات
                </h1>
                <p className={`text-sm mb-5 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                    اختر عائلة أو فئة لعرض المنتجات
                </p>

                {/* Families */}
                <section className="mb-6">
                    <h2 className={`text-sm font-bold mb-3 ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                        العائلات
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {productFamilies.map((family) => (
                            <button
                                key={family.id}
                                type="button"
                                onClick={() => openFamily(family.id)}
                                className={`text-start rounded-2xl overflow-hidden border transition shadow-sm
                                    ${dm ? 'bg-gray-900 border-gray-800 hover:border-gray-600' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                            >
                                <div className="aspect-[16/7] overflow-hidden">
                                    <img
                                        src={family.banner}
                                        alt={family.nameAr}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="px-3 py-2.5">
                                    <p className="font-bold text-sm" style={{ color: family.accent }}>
                                        {family.nameAr}
                                    </p>
                                    <p className={`text-xs mt-0.5 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                        {family.taglineAr}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                {/* All categories */}
                <section>
                    <h2 className={`text-sm font-bold mb-3 ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                        كل الفئات
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        <button
                            type="button"
                            onClick={() => openShopWithCategory('All')}
                            className={`flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-sm font-semibold transition
                                ${dm
                                    ? 'bg-gray-900 border-gray-800 text-gray-200 hover:bg-gray-800'
                                    : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50 shadow-sm'}`}
                        >
                            <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${dm ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'}`}>
                                <Layers size={18} />
                            </span>
                            الكل
                        </button>
                        {list.map((cat) => {
                            const Icon = categoryIcons[cat] || Box;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => openShopWithCategory(cat)}
                                    className={`flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-sm font-semibold transition
                                        ${dm
                                            ? 'bg-gray-900 border-gray-800 text-gray-200 hover:bg-gray-800'
                                            : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50 shadow-sm'}`}
                                >
                                    <span className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0
                                        ${dm ? 'bg-gray-800 text-gray-300' : 'bg-slate-50 text-slate-600'}`}>
                                        <Icon size={18} />
                                    </span>
                                    <span className="truncate">{CATEGORY_LABEL_AR[cat] || cat}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            </main>

            <BottomNavBar activeOverride="categories" />
        </div>
    );
};

export default CategoriesPage;
