import React from 'react';
import { Layers } from 'lucide-react';
import Header from '../components/Header';
import BottomNavBar from '../components/BottomNavBar';
import useStore from '../store/useStore';
import { productFamilies } from '../data/families';
import { CATEGORY_LABEL_AR, getCategoryImage } from '../data/categories';

/**
 * Dedicated page: families + Template-2 category image grid.
 */
const CategoriesPage = () => {
    const {
        darkMode,
        categories,
        categoryImages,
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

                {/* All categories — Template 2 cards */}
                <section>
                    <h2 className={`text-sm font-bold mb-3 ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                        كل الفئات
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        <button
                            type="button"
                            onClick={() => openShopWithCategory('All')}
                            className={`rounded-2xl overflow-hidden border aspect-square flex flex-col items-center justify-center gap-2 transition shadow-sm
                                ${dm
                                    ? 'bg-gray-900 border-gray-800 text-gray-200 hover:border-primary/50'
                                    : 'bg-white border-slate-100 text-slate-700 hover:border-primary/40'}`}
                        >
                            <span className={`flex items-center justify-center w-14 h-14 rounded-2xl
                                ${dm ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'}`}>
                                <Layers size={28} />
                            </span>
                            <span className="text-sm font-bold">الكل</span>
                        </button>

                        {list.map((cat) => {
                            const src = getCategoryImage(cat, categoryImages);
                            const label = CATEGORY_LABEL_AR[cat] || cat;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => openShopWithCategory(cat)}
                                    className="group flex flex-col gap-1.5 text-start"
                                    aria-label={label}
                                >
                                    <span
                                        className={`relative block w-full aspect-square rounded-2xl overflow-hidden border transition shadow-sm
                                            ${dm
                                                ? 'border-gray-800 group-hover:border-primary/50'
                                                : 'border-slate-100 group-hover:border-primary/40 group-hover:shadow-md'}`}
                                    >
                                        {src ? (
                                            <img
                                                src={`${src}?v=transparent`}
                                                alt={label}
                                                className="absolute inset-0 w-full h-full object-contain object-center p-1 bg-transparent transition-transform duration-300 group-hover:scale-[1.03]"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold
                                                ${dm ? 'bg-gray-900 text-gray-300' : 'bg-slate-100 text-slate-600'}`}>
                                                {label}
                                            </span>
                                        )}
                                    </span>
                                    <span className={`text-xs sm:text-sm font-bold text-center truncate px-0.5
                                        ${dm ? 'text-gray-200' : 'text-slate-700'}`}>
                                        {label}
                                    </span>
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
