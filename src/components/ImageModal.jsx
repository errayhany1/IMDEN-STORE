import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ImageModal = ({ isOpen, onClose, images = [], image, alt, productRef }) => {
    const allImages = images.length > 0 ? images : (image ? [image] : []);
    const [currentIndex, setCurrentIndex] = useState(0);

    const handlePrev = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
    };

    const handleNext = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
    };

    // Reset index when modal opens
    React.useEffect(() => {
        if (isOpen) setCurrentIndex(0);
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && allImages.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                    />

                    {/* Image Container */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors bg-white/10 p-2 rounded-full z-10"
                        >
                            <X size={24} />
                        </button>

                        {/* Main Image with REF overlay */}
                        <div className="relative w-full">
                            <img
                                src={allImages[currentIndex]}
                                alt={alt}
                                className="w-full h-full object-contain max-h-[85vh] rounded-lg shadow-2xl"
                            />

                            {/* REF Badge on image */}
                            {productRef && (
                                <div className="absolute top-3 right-3 bg-black/70 text-white text-xs font-mono px-3 py-1.5 rounded-lg backdrop-blur-sm shadow-lg border border-white/10">
                                    REF: {productRef}
                                </div>
                            )}

                            {/* Navigation Arrows */}
                            {allImages.length > 1 && (
                                <>
                                    <button
                                        onClick={handlePrev}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all backdrop-blur-sm"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button
                                        onClick={handleNext}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all backdrop-blur-sm"
                                    >
                                        <ChevronRight size={24} />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Thumbnail Dots / Thumbnails */}
                        {allImages.length > 1 && (
                            <div className="flex gap-2 mt-3">
                                {allImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                                        className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
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
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ImageModal;
