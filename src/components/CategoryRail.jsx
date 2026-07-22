import React from 'react';
import useStore from '../store/useStore';
import { ArrowRight } from 'lucide-react';
import { getFamilyById } from '../data/families';
import { CATEGORY_LABEL_AR, getCategoryImage } from '../data/categories';

export const categoryTranslation = CATEGORY_LABEL_AR;

const BRAND_BLUE = '#197fe6';

/** Wave divider matching Template-2 blue footer */
const WaveFooter = ({ label, active }) => (
    <div
        className="absolute inset-x-0 bottom-0 z-[1] flex items-end justify-center pb-2.5 pt-5 px-1.5"
        style={{ backgroundColor: active ? '#156cb8' : BRAND_BLUE }}
    >
        <svg
            className="absolute left-0 right-0 -top-[14px] w-full h-[15px] pointer-events-none"
            viewBox="0 0 120 16"
            preserveAspectRatio="none"
            aria-hidden
        >
            <path
                d="M0 16 C30 2 90 2 120 16 L120 16 L0 16 Z"
                fill={active ? '#156cb8' : BRAND_BLUE}
            />
        </svg>
        <span className="relative z-[1] text-white text-[11px] sm:text-xs font-bold text-center leading-tight line-clamp-2">
            {label}
        </span>
    </div>
);

const CategoryRail = () => {
    const {
        darkMode,
        categories,
        categoryImages,
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
        <section id="family-products" className="mb-4 mt-2 px-1 flex flex-col gap-3 scroll-mt-20">
            {activeFamily && (
                <div
                    className={`rounded-xl border px-3 py-3 flex items-center justify-between gap-3 mx-1 ${
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

            {/* Template-2 style category cards */}
            <div
                className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 px-1 scrollbar-hide snap-x"
                style={{ direction: 'rtl' }}
            >
                {visibleCategories.map((cat) => {
                    const label = CATEGORY_LABEL_AR[cat] || cat;
                    const thumb = cat !== 'All' && cat !== 'Out of Stock'
                        ? getCategoryImage(cat, categoryImages)
                        : null;
                    const isActive = selectedCategory === cat;

                    return (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            aria-label={label}
                            aria-current={isActive ? 'true' : undefined}
                            className={`snap-center shrink-0 w-[104px] sm:w-[112px] focus:outline-none transition-transform
                                ${isActive ? 'scale-[1.03]' : 'hover:scale-[1.02]'}`}
                        >
                            <div
                                className={`relative w-full aspect-[3/4] rounded-[18px] overflow-hidden shadow-sm
                                    ${isActive
                                        ? 'ring-2 ring-primary ring-offset-1 shadow-md'
                                        : darkMode
                                            ? 'ring-1 ring-white/10'
                                            : 'ring-1 ring-slate-200/80'}`}
                            >
                                {thumb ? (
                                    <>
                                        {/* Product area — crop bottom English banner from artwork */}
                                        <img
                                            src={thumb}
                                            alt=""
                                            className="absolute inset-0 w-full h-[72%] object-cover object-top bg-[#f4f7fb]"
                                            loading="lazy"
                                        />
                                        <WaveFooter label={label} active={isActive} />
                                    </>
                                ) : (
                                    <>
                                        {/* "All" card */}
                                        <div className={`absolute inset-0 h-[72%] flex items-center justify-center
                                            ${darkMode ? 'bg-slate-800' : 'bg-[#f4f7fb]'}`}>
                                            <span className="grid grid-cols-2 gap-1.5 p-2">
                                                {[0, 1, 2, 3].map((i) => (
                                                    <span
                                                        key={i}
                                                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-md"
                                                        style={{ backgroundColor: BRAND_BLUE }}
                                                    />
                                                ))}
                                            </span>
                                        </div>
                                        <WaveFooter label={label} active={isActive} />
                                    </>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

export default CategoryRail;
