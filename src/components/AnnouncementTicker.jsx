import React from 'react';
import { Package, Truck, ShoppingCart, ChevronsLeft, ChevronsRight } from 'lucide-react';

const TICKER_ITEMS = [
    { icon: Package, text: 'البيع بالجملة فقط' },
    { icon: Truck, text: 'التوصيل لجميع المدن في أقل من 48 ساعة' },
    { icon: ShoppingCart, text: 'شري من دارك' },
];

function TickerSegment({ hidden = false }) {
    return (
        <ul
            className="flex items-center shrink-0"
            aria-hidden={hidden || undefined}
        >
            {TICKER_ITEMS.map(({ icon: Icon, text }) => (
                <li
                    key={text}
                    className="flex items-center gap-2 px-8 sm:px-12 text-white text-[13px] sm:text-sm font-bold whitespace-nowrap"
                    dir="rtl"
                >
                    <Icon size={16} strokeWidth={2.25} className="shrink-0" />
                    <span>{text}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/45 mx-1" aria-hidden />
                </li>
            ))}
        </ul>
    );
}

/**
 * Full-bleed announcement bar under the header — seamless infinite scroll.
 */
const AnnouncementTicker = () => {
    return (
        <div
            className="relative w-full overflow-hidden bg-[#1d6fff]"
            role="marquee"
            aria-label="معلومات المتجر"
        >
            <div className="flex w-max items-center py-2 announcement-ticker-track">
                <TickerSegment />
                <TickerSegment hidden />
            </div>

            <span className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-14 bg-gradient-to-l from-[#1d6fff] to-transparent flex items-center justify-end pe-1.5 text-white/90">
                <ChevronsRight size={16} strokeWidth={2.5} aria-hidden />
            </span>
            <span className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-14 bg-gradient-to-r from-[#1d6fff] to-transparent flex items-center justify-start ps-1.5 text-white/90">
                <ChevronsLeft size={16} strokeWidth={2.5} aria-hidden />
            </span>
        </div>
    );
};

export default AnnouncementTicker;
