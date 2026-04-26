import React, { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import useStore from '../store/useStore';
import ImageModal from './ImageModal';
import SocialButton from './SocialButton';
import './ProductCard.css';

const ProductCard = ({ product }) => {
    const addToCart = useStore((state) => state.addToCart);
    const darkMode = useStore((state) => state.darkMode);
    const gridColumns = useStore((state) => state.gridColumns);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const dm = darkMode;
    const singleCol = gridColumns === 1;
    const isOutOfStock = product.category === 'Out of Stock';

    return (
        <>
            <article className={`rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border flex flex-col overflow-hidden group h-full relative
                ${dm ? 'bg-gray-800 border-gray-700' : 'bg-surface-light border-slate-100'}`}>

                {/* Out of Stock Overlay */}
                {isOutOfStock && (
                    <div className="absolute inset-0 z-20 pointer-events-none bg-black/10 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="bg-red-600/90 text-white font-bold px-6 py-2 rounded-lg transform -rotate-12 border-2 border-red-200 shadow-2xl text-lg backdrop-blur-sm">
                            نفد من المخزون
                        </div>
                    </div>
                )}

                <div className={`relative aspect-[3/4] overflow-hidden cursor-pointer ${dm ? 'bg-gray-900' : 'bg-white'}`} onClick={() => setIsModalOpen(true)}>

                    {product.image ? (
                        <img
                            src={product.image}
                            alt={product.name}
                            className={`w-full h-full object-contain p-1 transform group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-70' : ''}`}
                            loading="lazy"
                        />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center text-sm ${dm ? 'text-gray-500 bg-gray-900' : 'text-slate-400 bg-slate-200'}`}>
                            لا توجد صورة
                        </div>
                    )}

                </div>

                <div className={`p-3 flex flex-col gap-3 ${isOutOfStock ? 'opacity-80' : ''}`}>
                    {/* Price and Ref Row */}
                    <div className="flex items-center justify-between flex-row-reverse gap-1">
                        <div className="text-right flex-shrink-0">
                            <span className={`text-lg font-bold text-primary`}>{product.price} DH</span>
                        </div>
                        <div className="text-left min-w-0 flex-1">
                            <span
                                className={`font-mono px-1.5 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis block max-w-full
                                    ${dm ? 'bg-gray-700 text-gray-300' : 'bg-slate-100 text-slate-500'}`}
                                style={{ fontSize: singleCol ? '0.75rem' : 'clamp(7px, 1.8vw, 10px)' }}
                            >REF: {product.ref}</span>
                        </div>
                    </div>

                    {product.name && product.name.trim() !== '' && (
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
                        <SocialButton
                            type="whatsapp"
                            onClick={() => window.open(`https://wa.me/212664630566?text=السلام عليكم، أريد الاستفسار بخصوص هذا المنتج:%0A%0A*المنتج:* ${product.name}%0A*المرجع:* ${product.ref}%0A*الثمن:* ${product.price} DH`, '_blank')}
                            iconOnly
                            size="sm"
                            className="rounded-lg"
                        />
                    </div>
                </div>
            </article>

            {/* Lightbox Modal */}
            <ImageModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                image={product.image}
                alt={product.name}
            />
        </>
    );
};

export default ProductCard;
