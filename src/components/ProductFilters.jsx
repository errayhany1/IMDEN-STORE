import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X, Check } from 'lucide-react';
import useStore from '../store/useStore';

const SORT_OPTIONS = [
    { id: 'default', label: 'الأحدث' },
    { id: 'price-asc', label: 'السعر: الأقل' },
    { id: 'price-desc', label: 'السعر: الأعلى' },
    { id: 'name-asc', label: 'الاسم أ → ي' },
];

const STOCK_OPTIONS = [
    { id: 'all', label: 'الكل' },
    { id: 'in-stock', label: 'متوفر' },
    { id: 'out-of-stock', label: 'نفد المخزون' },
];

const ProductFilters = () => {
    const darkMode = useStore((s) => s.darkMode);
    const sortBy = useStore((s) => s.sortBy);
    const stockFilter = useStore((s) => s.stockFilter);
    const setSortBy = useStore((s) => s.setSortBy);
    const setStockFilter = useStore((s) => s.setStockFilter);
    const resetProductFilters = useStore((s) => s.resetProductFilters);
    const dm = darkMode;

    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);

    const activeCount =
        (sortBy !== 'default' ? 1 : 0) + (stockFilter !== 'all' ? 1 : 0);

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (panelRef.current && !panelRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    return (
        <div className="relative mb-3" ref={panelRef} style={{ direction: 'rtl' }}>
            <div className="flex items-center justify-end">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95
                        ${open || activeCount > 0
                            ? 'bg-primary text-white border-primary shadow-sm shadow-primary/25'
                            : dm
                                ? 'bg-gray-800 text-gray-200 border-gray-700 hover:border-gray-500'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                    aria-expanded={open}
                    aria-label="فلاتر المنتجات"
                >
                    <SlidersHorizontal size={14} />
                    <span>فلاتر</span>
                    {activeCount > 0 && (
                        <span className="min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-white/20 text-[10px] leading-none flex items-center justify-center">
                            {activeCount}
                        </span>
                    )}
                </button>
            </div>

            {open && (
                <div
                    className={`absolute top-full left-0 right-0 z-30 mt-2 rounded-2xl border p-3 shadow-xl
                        ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'}`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className={`text-sm font-bold ${dm ? 'text-white' : 'text-slate-800'}`}>
                            تصفية وترتيب
                        </span>
                        <div className="flex items-center gap-2">
                            {activeCount > 0 && (
                                <button
                                    type="button"
                                    onClick={resetProductFilters}
                                    className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors
                                        ${dm ? 'text-sky-300 hover:bg-gray-800' : 'text-primary hover:bg-slate-50'}`}
                                >
                                    إعادة ضبط
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className={`p-1 rounded-lg ${dm ? 'text-gray-400 hover:bg-gray-800' : 'text-slate-400 hover:bg-slate-100'}`}
                                aria-label="إغلاق"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <p className={`text-[11px] font-semibold mb-1.5 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                الترتيب
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {SORT_OPTIONS.map((opt) => {
                                    const active = sortBy === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setSortBy(opt.id)}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-all
                                                ${active
                                                    ? 'bg-primary text-white border-primary'
                                                    : dm
                                                        ? 'bg-gray-800 text-gray-300 border-gray-700'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}
                                        >
                                            {active && <Check size={12} />}
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className={`text-[11px] font-semibold mb-1.5 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                التوفر
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {STOCK_OPTIONS.map((opt) => {
                                    const active = stockFilter === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setStockFilter(opt.id)}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-all
                                                ${active
                                                    ? 'bg-primary text-white border-primary'
                                                    : dm
                                                        ? 'bg-gray-800 text-gray-300 border-gray-700'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}
                                        >
                                            {active && <Check size={12} />}
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductFilters;
