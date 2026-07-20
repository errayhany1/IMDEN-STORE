import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { productFamilies } from '../data/families';
import useStore from '../store/useStore';

const AUTO_MS = 5000;
/** Slide width ≈ half the viewport so ~half of each neighbor stays visible. */
const SLIDE_FRAC = 0.5;
const GAP_PX = 12;

const FamilyHeroSlider = () => {
    const { setFamily, selectedFamily, browseMode } = useStore();
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [trackWidth, setTrackWidth] = useState(0);
    const viewportRef = useRef(null);
    const touchStartX = useRef(null);

    const goTo = useCallback((next) => {
        const total = productFamilies.length;
        setIndex(((next % total) + total) % total);
    }, []);

    const openFamily = useCallback((familyId) => {
        setFamily(familyId);
        const nextPath = browseMode === 'catalog'
            ? `/catalog/family/${familyId}`
            : `/family/${familyId}`;
        window.history.pushState({ family: familyId }, '', nextPath);
        requestAnimationFrame(() => {
            document.getElementById('family-products')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        });
    }, [setFamily, browseMode]);

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return undefined;
        const measure = () => setTrackWidth(el.clientWidth);
        measure();
        const ro = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(measure)
            : null;
        ro?.observe(el);
        window.addEventListener('resize', measure);
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

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
        if (delta > 0) goTo(index - 1);
        else goTo(index + 1);
    };

    // On a family page, hide the hero so products take the focus
    if (selectedFamily) return null;

    const slideWidth = trackWidth > 0 ? trackWidth * SLIDE_FRAC : 0;
    const sidePad = trackWidth > 0 ? (trackWidth - slideWidth) / 2 : 0;
    const offset = trackWidth > 0
        ? sidePad - index * (slideWidth + GAP_PX)
        : 0;

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
                ref={viewportRef}
                className="relative overflow-hidden"
                style={{ direction: 'ltr' }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                <div
                    className="flex items-stretch transition-transform duration-500 ease-out will-change-transform"
                    style={{
                        gap: GAP_PX,
                        transform: `translateX(${offset}px)`,
                    }}
                >
                    {productFamilies.map((family, i) => {
                        const isActive = i === index;
                        return (
                            <button
                                key={family.id}
                                type="button"
                                onClick={() => openFamily(family.id)}
                                className={`relative shrink-0 overflow-hidden rounded-xl border text-right cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-[opacity,transform,box-shadow] duration-500 ${
                                    isActive
                                        ? 'border-slate-200/80 shadow-md opacity-100 scale-100'
                                        : 'border-slate-200/40 shadow-sm opacity-70 scale-[0.96]'
                                }`}
                                style={{
                                    width: slideWidth || `${SLIDE_FRAC * 100}%`,
                                }}
                                aria-label={`فتح عائلة ${family.nameAr}`}
                                aria-current={isActive ? 'true' : undefined}
                            >
                                <img
                                    src={family.banner}
                                    alt={family.taglineAr}
                                    className="block w-full h-auto aspect-[16/9] object-cover object-center select-none"
                                    draggable={false}
                                    loading={family.id === productFamilies[0].id ? 'eager' : 'lazy'}
                                />
                                <span className="sr-only">{family.nameAr} — اضغط لفتح العائلة</span>
                            </button>
                        );
                    })}
                </div>

                {/* Prev / Next */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goTo(index + 1); }}
                    className="absolute top-1/2 right-1 sm:right-2 -translate-y-1/2 z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow flex items-center justify-center backdrop-blur-sm"
                    aria-label="الشريحة التالية"
                >
                    <ChevronRight size={16} />
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goTo(index - 1); }}
                    className="absolute top-1/2 left-1 sm:left-2 -translate-y-1/2 z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow flex items-center justify-center backdrop-blur-sm"
                    aria-label="الشريحة السابقة"
                >
                    <ChevronLeft size={16} />
                </button>

                {/* Dots */}
                <div className="mt-2.5 flex justify-center gap-2">
                    {productFamilies.map((family, i) => (
                        <button
                            key={family.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goTo(i); }}
                            className={`h-1.5 rounded-full transition-all ${
                                i === index
                                    ? 'w-5 bg-primary'
                                    : 'w-1.5 bg-slate-300 hover:bg-slate-400'
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
