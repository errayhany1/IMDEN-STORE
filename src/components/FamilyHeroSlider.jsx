import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { productFamilies } from '../data/families';
import useStore from '../store/useStore';

const AUTO_MS = 5000;

const FamilyHeroSlider = () => {
    const { setFamily, selectedFamily } = useStore();
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const touchStartX = useRef(null);

    const goTo = useCallback((next) => {
        const total = productFamilies.length;
        setIndex(((next % total) + total) % total);
    }, []);

    const openFamily = useCallback((familyId) => {
        setFamily(familyId);
        // Shareable family URL without a full router rewrite
        const url = new URL(window.location.href);
        url.pathname = `/family/${familyId}`;
        url.search = '';
        window.history.pushState({ family: familyId }, '', url.pathname);
        // Scroll products into view after paint
        requestAnimationFrame(() => {
            document.getElementById('family-products')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        });
    }, [setFamily]);

    useEffect(() => {
        if (paused || selectedFamily) return undefined;
        const timer = setInterval(() => goTo(index + 1), AUTO_MS);
        return () => clearInterval(timer);
    }, [index, paused, selectedFamily, goTo]);

    // Keep slide in sync when returning from a family view
    useEffect(() => {
        if (!selectedFamily) return;
        const familyIndex = productFamilies.findIndex((f) => f.id === selectedFamily);
        if (familyIndex >= 0) setIndex(familyIndex);
    }, [selectedFamily]);

    const onTouchStart = (e) => {
        touchStartX.current = e.changedTouches[0]?.clientX ?? null;
        setPaused(true);
    };

    const onTouchEnd = (e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        setPaused(false);
        if (start == null) return;
        const delta = e.changedTouches[0].clientX - start;
        if (Math.abs(delta) < 40) return;
        // RTL: swipe right → previous visual (next index in our LTR track of RTL content)
        if (delta > 0) goTo(index - 1);
        else goTo(index + 1);
    };

    // On a family page, hide the hero so products take the focus
    if (selectedFamily) return null;

    return (
        <section
            id="categories-section"
            className="mb-4 mt-1 scroll-mt-20"
            aria-roledescription="carousel"
            aria-label="عائلات المنتجات"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <div
                className="relative overflow-hidden rounded-2xl shadow-md border border-slate-200/70 bg-slate-100"
                style={{ direction: 'ltr' }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${index * 100}%)` }}
                >
                    {productFamilies.map((family) => (
                        <button
                            key={family.id}
                            type="button"
                            onClick={() => openFamily(family.id)}
                            className="relative w-full shrink-0 basis-full cursor-pointer text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                            aria-label={`فتح عائلة ${family.nameAr}`}
                        >
                            <img
                                src={family.banner}
                                alt={family.taglineAr}
                                className="block w-full h-auto aspect-[3/2] sm:aspect-[16/9] object-cover object-center select-none"
                                draggable={false}
                                loading={family.id === productFamilies[0].id ? 'eager' : 'lazy'}
                            />
                            <span className="sr-only">{family.nameAr} — اضغط لفتح العائلة</span>
                        </button>
                    ))}
                </div>

                {/* Prev / Next */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goTo(index + 1); }}
                    className="absolute top-1/2 right-2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-700 shadow flex items-center justify-center backdrop-blur-sm"
                    aria-label="الشريحة التالية"
                >
                    <ChevronRight size={18} />
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goTo(index - 1); }}
                    className="absolute top-1/2 left-2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-700 shadow flex items-center justify-center backdrop-blur-sm"
                    aria-label="الشريحة السابقة"
                >
                    <ChevronLeft size={18} />
                </button>

                {/* Dots */}
                <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2 z-10">
                    {productFamilies.map((family, i) => (
                        <button
                            key={family.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goTo(i); }}
                            className={`h-2 rounded-full transition-all ${
                                i === index ? 'w-6 bg-white shadow' : 'w-2 bg-white/55 hover:bg-white/80'
                            }`}
                            aria-label={`عرض ${family.nameAr}`}
                            aria-current={i === index ? 'true' : undefined}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FamilyHeroSlider;
