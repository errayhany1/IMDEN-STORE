import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { productFamilies } from '../data/families';
import useStore from '../store/useStore';

const AUTO_MS = 5000;
/** Desktop only: slide ≈ half viewport so neighbors peek. */
const DESKTOP_SLIDE_FRAC = 0.5;
const DESKTOP_GAP_PX = 12;
const DESKTOP_MQ = '(min-width: 640px)';

const FamilyHeroSlider = () => {
    const { setFamily, selectedFamily, browseMode } = useStore();
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);
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
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const mq = window.matchMedia(DESKTOP_MQ);
        const update = () => setIsDesktop(mq.matches);
        update();
        mq.addEventListener?.('change', update);
        mq.addListener?.(update);
        return () => {
            mq.removeEventListener?.('change', update);
            mq.removeListener?.(update);
        };
    }, []);

    useEffect(() => {
        if (!isDesktop) {
            setTrackWidth(0);
            return undefined;
        }
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
    }, [isDesktop]);

    useEffect(() => {
        if (paused || selectedFamily) return undefined;
        const timer = setInterval(() => goTo(index + 1), AUTO_MS);
        return () => clearInterval(timer);
    }, [index, paused, selectedFamily, goTo]);

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

    if (selectedFamily) return null;

    // Mobile: full-bleed original slider. Desktop: peek + capped height.
    const slideWidth = isDesktop && trackWidth > 0
        ? trackWidth * DESKTOP_SLIDE_FRAC
        : 0;
    const sidePad = isDesktop && trackWidth > 0
        ? (trackWidth - slideWidth) / 2
        : 0;
    const desktopOffset = isDesktop && trackWidth > 0
        ? sidePad - index * (slideWidth + DESKTOP_GAP_PX)
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
                className={
                    isDesktop
                        ? 'relative overflow-hidden'
                        : 'relative overflow-hidden rounded-2xl shadow-md border border-slate-200/70 bg-slate-100'
                }
                style={{ direction: 'ltr' }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                <div
                    className={`flex transition-transform duration-500 ease-out ${
                        isDesktop ? 'items-stretch will-change-transform' : ''
                    }`}
                    style={
                        isDesktop
                            ? {
                                gap: DESKTOP_GAP_PX,
                                transform: `translateX(${desktopOffset}px)`,
                            }
                            : { transform: `translateX(-${index * 100}%)` }
                    }
                >
                    {productFamilies.map((family, i) => {
                        const isActive = i === index;

                        if (!isDesktop) {
                            return (
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
                                        className="block w-full h-auto aspect-[3/2] object-cover object-center select-none"
                                        draggable={false}
                                        loading={family.id === productFamilies[0].id ? 'eager' : 'lazy'}
                                    />
                                    <span className="sr-only">{family.nameAr} — اضغط لفتح العائلة</span>
                                </button>
                            );
                        }

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
                                    width: slideWidth || `${DESKTOP_SLIDE_FRAC * 100}%`,
                                }}
                                aria-label={`فتح عائلة ${family.nameAr}`}
                                aria-current={isActive ? 'true' : undefined}
                            >
                                <img
                                    src={family.banner}
                                    alt={family.taglineAr}
                                    className="block w-full h-auto max-h-[180px] md:max-h-[220px] aspect-[16/9] object-cover object-center select-none"
                                    draggable={false}
                                    loading={family.id === productFamilies[0].id ? 'eager' : 'lazy'}
                                />
                                <span className="sr-only">{family.nameAr} — اضغط لفتح العائلة</span>
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goTo(index + 1); }}
                    className={`absolute top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/85 hover:bg-white text-slate-700 shadow flex items-center justify-center backdrop-blur-sm ${
                        isDesktop
                            ? 'right-1 sm:right-2 w-8 h-8 sm:w-9 sm:h-9'
                            : 'right-2 w-9 h-9'
                    }`}
                    aria-label="الشريحة التالية"
                >
                    <ChevronRight size={isDesktop ? 16 : 18} />
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goTo(index - 1); }}
                    className={`absolute top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/85 hover:bg-white text-slate-700 shadow flex items-center justify-center backdrop-blur-sm ${
                        isDesktop
                            ? 'left-1 sm:left-2 w-8 h-8 sm:w-9 sm:h-9'
                            : 'left-2 w-9 h-9'
                    }`}
                    aria-label="الشريحة السابقة"
                >
                    <ChevronLeft size={isDesktop ? 16 : 18} />
                </button>

                <div className={
                    isDesktop
                        ? 'mt-2.5 flex justify-center gap-2'
                        : 'absolute bottom-3 inset-x-0 flex justify-center gap-2 z-10'
                }
                >
                    {productFamilies.map((family, i) => (
                        <button
                            key={family.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goTo(i); }}
                            className={`rounded-full transition-all ${
                                isDesktop
                                    ? (i === index
                                        ? 'h-1.5 w-5 bg-primary'
                                        : 'h-1.5 w-1.5 bg-slate-300 hover:bg-slate-400')
                                    : (i === index
                                        ? 'h-2 w-6 bg-white shadow'
                                        : 'h-2 w-2 bg-white/55 hover:bg-white/80')
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
