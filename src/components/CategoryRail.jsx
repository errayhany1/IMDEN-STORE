import React from 'react';
import useStore from '../store/useStore';
import { ArrowRight } from 'lucide-react';
import { getFamilyById } from '../data/families';
import { CATEGORY_LABEL_AR, getCategoryImage } from '../data/categories';

export const categoryTranslation = CATEGORY_LABEL_AR;

const BRAND_BLUE = '#197fe6';

/**
 * Mobile: ~5.5 cards visible across the viewport.
 * main px-4 (2rem) + rail px-1 (0.5rem) + 5 gaps of gap-2 (2.5rem).
 */
const CARD_WIDTH =
    'w-[calc((100vw-5rem)/5.5)] sm:w-[88px] md:w-[96px]';

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
        <section id="family-products" className="mb-3 mt-1 px-0.5 flex flex-col gap-2.5 scroll-mt-20">
            {activeFamily && (
                <div
                    className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3 mx-1 ${
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

            {/* Image-only Template-2 cards — ~5.5 visible on phone */}
            <div
                className="flex gap-2 overflow-x-auto pb-1.5 px-1 scrollbar-hide snap-x"
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
                            className={`snap-start shrink-0 ${CARD_WIDTH} focus:outline-none transition-transform
                                ${isActive ? 'scale-[1.04]' : 'active:scale-[0.98]'}`}
                        >
                            <div
                                className={`relative w-full aspect-[3/4] rounded-[14px] overflow-hidden
                                    ${isActive
                                        ? 'ring-2 ring-primary shadow-md'
                                        : darkMode
                                            ? 'ring-1 ring-white/10'
                                            : 'ring-1 ring-slate-200/70 shadow-sm'}`}
                            >
                                {thumb ? (
                                    <img
                                        src={thumb}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover object-center bg-[#f4f7fb]"
                                        loading="lazy"
                                    />
                                ) : (
                                    /* "All" — icon only, no text */
                                    <div className={`absolute inset-0 flex flex-col ${darkMode ? 'bg-slate-800' : 'bg-[#f4f7fb]'}`}>
                                        <div className="flex-1 flex items-center justify-center">
                                            <span className="grid grid-cols-2 gap-1">
                                                {[0, 1, 2, 3].map((i) => (
                                                    <span
                                                        key={i}
                                                        className="w-3.5 h-3.5 rounded-[5px]"
                                                        style={{ backgroundColor: BRAND_BLUE }}
                                                    />
                                                ))}
                                            </span>
                                        </div>
                                        <div
                                            className="relative h-[28%] shrink-0"
                                            style={{ backgroundColor: BRAND_BLUE }}
                                        >
                                            <svg
                                                className="absolute left-0 right-0 -top-[10px] w-full h-[11px] pointer-events-none"
                                                viewBox="0 0 120 16"
                                                preserveAspectRatio="none"
                                                aria-hidden
                                            >
                                                <path d="M0 16 C30 2 90 2 120 16 L120 16 L0 16 Z" fill={BRAND_BLUE} />
                                            </svg>
                                        </div>
                                    </div>
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
