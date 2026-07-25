import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

const TELEGRAM_URL = 'https://t.me/Imden_technology';
const WA_NUMBER = '212664630566';

const WA_ICON = 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg';
const TG_ICON = 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg';

/**
 * Combined floating contact button.
 * Collapsed: one round 3D button — left half WhatsApp, right half Telegram.
 * Expanded: both full buttons pop upward + a collapse control.
 */
const FloatingWhatsApp = () => {
    const [open, setOpen] = useState(false);

    return (
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 z-50 flex flex-col items-center gap-3">
            <AnimatePresence>
                {open && (
                    <>
                        <Motion.a
                            key="tg"
                            href={TELEGRAM_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, y: 30, scale: 0.5 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 30, scale: 0.5 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300, delay: 0.05 }}
                            className="w-14 h-14 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-transform hover:shadow-xl flex items-center justify-center bg-white"
                            aria-label="تواصل معنا عبر تلغرام"
                        >
                            <img
                                src={TG_ICON}
                                alt="Telegram"
                                className="w-full h-full object-contain drop-shadow-md p-0.5"
                            />
                        </Motion.a>

                        <Motion.a
                            key="wa"
                            href={`https://wa.me/${WA_NUMBER}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, y: 20, scale: 0.5 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.5 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            className="w-14 h-14 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-transform hover:shadow-xl flex items-center justify-center bg-white"
                            aria-label="تواصل معنا عبر واتساب"
                        >
                            <img
                                src={WA_ICON}
                                alt="WhatsApp"
                                className="w-full h-full object-contain drop-shadow-md"
                            />
                        </Motion.a>
                    </>
                )}
            </AnimatePresence>

            {/* Toggle: split WA/TG when closed, collapse arrow when open */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative w-14 h-14 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-transform hover:shadow-xl bg-white overflow-hidden"
                aria-label={open ? 'إخفاء أزرار التواصل' : 'أزرار التواصل'}
                aria-expanded={open}
            >
                {open ? (
                    <span className="w-full h-full flex items-center justify-center text-slate-500">
                        <ChevronDown size={26} strokeWidth={2.5} />
                    </span>
                ) : (
                    <>
                        <img
                            src={WA_ICON}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-contain drop-shadow-md"
                            style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }}
                        />
                        <img
                            src={TG_ICON}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-contain drop-shadow-md p-0.5"
                            style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' }}
                        />
                        {/* Thin divider between the two halves */}
                        <span className="absolute top-1.5 bottom-1.5 left-1/2 -translate-x-1/2 w-px bg-white/90" aria-hidden="true" />
                    </>
                )}
            </button>
        </div>
    );
};

export default FloatingWhatsApp;
