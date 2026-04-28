import React, { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import useStore from '../store/useStore';
import ImageModal from './ImageModal';
import './ProductCard.css';

const WA_ICON = "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg";

const ProductCard = ({ product }) => {
    const addToCart = useStore((state) => state.addToCart);
    const darkMode = useStore((state) => state.darkMode);
    const gridColumns = useStore((state) => state.gridColumns);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [hoveredThumb, setHoveredThumb] = useState(null);

    const dm = darkMode;
    const singleCol = gridColumns === 1;
    const isOutOfStock = product.category === 'Out of Stock';

    // Multi-image support
    const allImages = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []);
    const displayImage = hoveredThumb !== null ? allImages[hoveredThumb] : (product.image || null);
    const extraThumbs = allImages.length > 1 ? allImages.slice(1, 3) : []; // max 2 thumbnails

    return (
        <>
            <article className={`rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border flex flex-col overflow-hidden group h-full relative
                ${dm ? 'bg-gray-800 border-gray-700' : 'bg-surface-light border-slate-100'}`}>

                {/* Out of Stock Overlay */}
                {isOutOfStock && (
                    <div className="absolute inset-0 z-20 pointer-events-none bg-black/5 flex items-center justify-center">
                        <div className="bg-red-600/90 text-white font-bold px-4 py-1 rounded-md transform -rotate-12 border border-red-200 shadow-xl text-sm">
                            نفد من المخزون
                        </div>
                    </div>
                )}

                <div className={`relative aspect-[3/4] overflow-hidden cursor-pointer ${dm ? 'bg-gray-900' : 'bg-white'}`} onClick={() => setIsModalOpen(true)}>

                    {displayImage ? (
                        <img
                            src={displayImage}
                            alt={product.name || product.ref}
                            className={`w-full h-full object-contain p-1 transform group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'opacity-90' : ''}`}
                            loading="lazy"
                        />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center text-sm ${dm ? 'text-gray-500 bg-gray-900' : 'text-slate-400 bg-slate-200'}`}>
                            لا توجد صورة
                        </div>
                    )}

                    {/* Thumbnails for extra images */}
                    {extraThumbs.length > 0 && (
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                            {extraThumbs.map((thumb, idx) => (
                                <div
                                    key={idx}
                                    onMouseEnter={() => setHoveredThumb(idx + 1)}
                                    onMouseLeave={() => setHoveredThumb(null)}
                                    onClick={(e) => { e.stopPropagation(); setHoveredThumb(idx + 1); }}
                                    className={`w-8 h-8 rounded-md border-2 overflow-hidden cursor-pointer transition-all hover:scale-110
                                    ${hoveredThumb === idx + 1 ? 'border-primary shadow-md' : (dm ? 'border-gray-600 bg-gray-800' : 'border-white bg-white')} shadow-sm`}
                                >
                                    <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                <div className={`p-3 flex flex-col gap-3 ${isOutOfStock ? 'opacity-80' : ''}`}>
                    {/* Price and Ref Row */}
                    <div className="flex items-center justify-between flex-row-reverse gap-1">
                        <div className="text-right flex-shrink-0">
                            <span className={`text-lg font-bold text-primary`}>{product.price} DH</span>
                        </div>
                        <div className="text-left min-w-0 flex-1 flex items-center gap-0.5">
                            <button
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(product.ref); }}
                                className={`shrink-0 p-0.5 rounded opacity-30 hover:opacity-100 transition-opacity ${dm ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                                title="نسخ المرجع"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            </button>
                            <span
                                className={`font-mono px-1.5 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis block max-w-full
                                    ${dm ? 'bg-gray-700 text-gray-300' : 'bg-slate-100 text-slate-500'}`}
                                style={{ fontSize: singleCol ? '0.75rem' : 'clamp(7px, 1.8vw, 10px)' }}
                            >REF: {product.ref}</span>
                        </div>
                    </div>

                    {product.name && product.name.trim() !== '' && product.name !== 'Unnamed Product' && (
                        <div 
                            className={`text-right text-xs font-medium line-clamp-2 leading-relaxed ${dm ? 'text-gray-300' : 'text-slate-600'}`} 
                            title={product.name}
                        >
                            {product.name}
                        </div>
                    )}

                    <div className="flex gap-2 flex-row-reverse">
                        <button
                            onClick={() => {
                                if (!isOutOfStock) addToCart(product);
                            }}
                            disabled={isOutOfStock}
                            className={`btn-add-cart flex-1 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-white ${isOutOfStock ? 'bg-gray-400 cursor-not-allowed border-gray-400 shadow-none' : ''}`}
                        >
                            <ShoppingCart size={18} />
                            إضافة
                        </button>
                        <a
                            href={`https://wa.me/212664630566?text=السلام عليكم، أريد الاستفسار بخصوص هذا المنتج:%0A%0A*المنتج:* ${product.name || 'بدون اسم'}%0A*المرجع:* ${product.ref}%0A*الثمن:* ${product.price} DH`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 transition-all shadow-sm"
                        >
                            <img src={WA_ICON} alt="WhatsApp" className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </article>

            {/* Lightbox Modal */}
            <ImageModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                images={allImages}
                alt={product.name || product.ref}
                productRef={product.ref}
            />
        </>
    );
};

export default ProductCard;
