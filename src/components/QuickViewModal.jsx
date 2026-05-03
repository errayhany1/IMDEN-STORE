import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, ShoppingCart, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';

const WA_ICON = "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg";

const QuickViewModal = ({ isOpen, onClose, product }) => {
    const addToCart = useStore((state) => state.addToCart);
    const darkMode = useStore((state) => state.darkMode);
    const dm = darkMode;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [copied, setCopied] = useState(false);
    const [addedToCart, setAddedToCart] = useState(false);

    if (!product) return null;

    const allImages = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []);
    const isOutOfStock = product.category === 'Out of Stock';

    const handlePrev = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
    };

    const handleNext = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
    };

    const handleCopyRef = () => {
        navigator.clipboard.writeText(product.ref);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleAddToCart = () => {
        if (!isOutOfStock) {
            addToCart(product);
            setAddedToCart(true);
            setTimeout(() => setAddedToCart(false), 1500);
        }
    };

    // Reset state when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setCurrentIndex(0);
            setCopied(false);
            setAddedToCart(false);
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className={`relative w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col
                            rounded-t-3xl sm:rounded-2xl shadow-2xl border
                            ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}
                        dir="rtl"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className={`absolute top-3 left-3 z-20 p-2 rounded-full transition-colors
                                ${dm ? 'bg-gray-800/80 hover:bg-gray-700 text-gray-300' : 'bg-white/80 hover:bg-white text-slate-500'} backdrop-blur-sm shadow-lg`}
                        >
                            <X size={18} />
                        </button>

                        {/* Out of Stock Badge */}
                        {isOutOfStock && (
                            <div className="absolute top-3 right-3 z-20 bg-red-600/90 text-white font-bold px-3 py-1 rounded-lg text-xs shadow-lg">
                                نفد من المخزون
                            </div>
                        )}

                        {/* Image Gallery */}
                        <div className={`relative w-full aspect-square sm:aspect-[4/3] overflow-hidden ${dm ? 'bg-gray-950' : 'bg-slate-50'}`}>
                            {allImages.length > 0 ? (
                                <img
                                    src={allImages[currentIndex]}
                                    alt={product.name || product.ref}
                                    className="w-full h-full object-contain p-4"
                                />
                            ) : (
                                <div className={`w-full h-full flex items-center justify-center text-sm ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                    لا توجد صورة
                                </div>
                            )}

                            {/* Navigation Arrows */}
                            {allImages.length > 1 && (
                                <>
                                    <button onClick={handlePrev}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-all backdrop-blur-sm">
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button onClick={handleNext}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-all backdrop-blur-sm">
                                        <ChevronRight size={20} />
                                    </button>
                                </>
                            )}

                            {/* Image Dots */}
                            {allImages.length > 1 && (
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                                    {allImages.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                                            className={`w-2 h-2 rounded-full transition-all ${currentIndex === idx ? 'bg-white w-5 shadow-lg' : 'bg-white/50 hover:bg-white/80'}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                            {/* Price and Ref */}
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <span className="text-2xl font-extrabold text-primary">{product.price} DH</span>
                                </div>
                                <button
                                    onClick={handleCopyRef}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all
                                        ${copied ? 'bg-green-500/15 text-green-500' : dm ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    {copied ? <Check size={12} /> : <Copy size={12} />}
                                    REF: {product.ref}
                                </button>
                            </div>

                            {/* Product Name */}
                            {product.name && product.name.trim() !== '' && product.name !== 'Unnamed Product' && (
                                <h3 className={`text-base font-bold leading-relaxed ${dm ? 'text-white' : 'text-slate-800'}`}>
                                    {product.name}
                                </h3>
                            )}

                            {/* Category */}
                            {product.category && product.category !== 'Out of Stock' && (
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${dm ? 'bg-gray-800 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
                                    {product.category}
                                </span>
                            )}

                            {/* Thumbnail Strip */}
                            {allImages.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {allImages.map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentIndex(idx)}
                                            className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all
                                                ${currentIndex === idx 
                                                    ? 'border-primary shadow-lg scale-105' 
                                                    : dm ? 'border-gray-700 opacity-60 hover:opacity-100' : 'border-slate-200 opacity-60 hover:opacity-100'}`}
                                        >
                                            <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className={`p-4 border-t flex gap-2 ${dm ? 'border-gray-800 bg-gray-900' : 'border-slate-100 bg-white'}`}>
                            <button
                                onClick={handleAddToCart}
                                disabled={isOutOfStock}
                                className={`flex-1 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-white transition-all active:scale-[0.97] shadow-lg
                                    ${addedToCart ? 'bg-green-500 shadow-green-500/20' 
                                        : isOutOfStock ? 'bg-gray-400 cursor-not-allowed shadow-none' 
                                        : 'bg-primary hover:bg-primary/90 shadow-primary/20'}`}
                            >
                                {addedToCart ? (
                                    <><Check size={18} /> تمت الإضافة!</>
                                ) : (
                                    <><ShoppingCart size={18} /> إضافة للسلة</>
                                )}
                            </button>
                            <a
                                href={`https://wa.me/212664630566?text=السلام عليكم، أريد الاستفسار بخصوص هذا المنتج:%0A%0A*المنتج:* ${product.name || 'بدون اسم'}%0A*المرجع:* ${product.ref}%0A*الثمن:* ${product.price} DH`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 transition-all shadow-lg shadow-green-500/20"
                            >
                                <img src={WA_ICON} alt="WhatsApp" className="w-6 h-6" />
                            </a>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default QuickViewModal;
