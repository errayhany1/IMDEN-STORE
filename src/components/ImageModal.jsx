import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

const ImageModal = ({
    isOpen,
    onClose,
    images = [],
    image,
    alt,
    productRef,
    initialIndex = 0,
    onIndexChange,
    zIndexClass = 'z-[110]',
}) => {
    const allImages = images.length > 0 ? images : (image ? [image] : []);
    const [currentIndex, setCurrentIndex] = useState(0);

    const goTo = (next) => {
        setCurrentIndex(next);
        onIndexChange?.(next);
    };

    const handlePrev = (e) => {
        e.stopPropagation();
        goTo(currentIndex === 0 ? allImages.length - 1 : currentIndex - 1);
    };

    const handleNext = (e) => {
        e.stopPropagation();
        goTo(currentIndex === allImages.length - 1 ? 0 : currentIndex + 1);
    };

    // Reset / sync index when modal opens
    React.useEffect(() => {
        if (!isOpen) return;
        const start = Math.min(
            Math.max(0, Number(initialIndex) || 0),
            Math.max(0, allImages.length - 1)
        );
        setCurrentIndex(start);
    }, [isOpen, initialIndex, allImages.length]);

    return (
        <AnimatePresence>
            {isOpen && allImages.length > 0 && (
                <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-3 sm:p-4`}>
                    {/* Backdrop */}
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/92 backdrop-blur-sm"
                    />

                    {/* Image Container */}
                    <Motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative max-w-5xl w-full max-h-[92vh] flex flex-col items-center"
                    >
                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors bg-white/10 p-2 rounded-full z-10"
                            aria-label="إغلاق"
                        >
                            <X size={24} />
                        </button>

                        {/* Main Image with REF overlay */}
                        <div className="relative w-full">
                            <img
                                src={allImages[currentIndex]}
                                alt={alt}
                                className="w-full h-full object-contain max-h-[80vh] rounded-lg shadow-2xl select-none"
                                draggable={false}
                            />

                            {/* REF Badge on image */}
                            {productRef && (
                                <div className="absolute top-3 right-3 bg-black/70 text-white text-xs font-mono px-3 py-1.5 rounded-lg backdrop-blur-sm shadow-lg border border-white/10">
                                    REF: {productRef}
                                </div>
                            )}

                            {allImages.length > 1 && (
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/55 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
                                    {currentIndex + 1} / {allImages.length}
                                </div>
                            )}

                            {/* Navigation Arrows */}
                            {allImages.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handlePrev}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/55 hover:bg-black/75 text-white p-2.5 rounded-full transition-all backdrop-blur-sm"
                                        aria-label="السابق"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/55 hover:bg-black/75 text-white p-2.5 rounded-full transition-all backdrop-blur-sm"
                                        aria-label="التالي"
                                    >
                                        <ChevronRight size={24} />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Thumbnail strip */}
                        {allImages.length > 1 && (
                            <div className="flex gap-2 mt-3 max-w-full overflow-x-auto no-scrollbar px-1">
                                {allImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); goTo(idx); }}
                                        className={`w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                                            currentIndex === idx
                                                ? 'border-primary shadow-lg scale-110'
                                                : 'border-white/30 hover:border-white/60 opacity-70 hover:opacity-100'
                                        }`}
                                    >
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </Motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ImageModal;
