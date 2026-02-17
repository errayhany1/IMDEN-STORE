import React, { useState } from 'react';
import { ShoppingCart, MessageCircle } from 'lucide-react';
import useStore from '../store/useStore';
import ImageModal from './ImageModal';

const ProductCard = ({ product }) => {
    const addToCart = useStore((state) => state.addToCart);
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <article className="bg-surface-light rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-300 border border-slate-100 flex flex-col overflow-hidden group h-full">
                <div className="relative aspect-[4/3] bg-white overflow-hidden cursor-pointer" onClick={() => setIsModalOpen(true)}>
                    {/* Randomly show NEW badge for demo purposes or if flagged */}
                    {Math.random() > 0.8 && (
                        <span className="absolute top-2 left-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded z-10">جديد</span>
                    )}

                    {product.image ? (
                        <img
                            src={product.image}
                            alt={product.name}
                            className={`w-full h-full object-contain p-2 transform group-hover:scale-105 transition-transform duration-500`}
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-200">
                            لا توجد صورة
                        </div>
                    )}

                </div>

                <div className="p-4 flex flex-col flex-grow">
                    <div className="text-xs font-mono text-slate-400 mb-1 text-right" dir="rtl">REF-{product.ref}</div>
                    <h3 className="text-slate-900 font-medium text-lg leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors text-right" dir="rtl">
                        {product.name}
                    </h3>

                    <div className="mt-auto pt-2 flex items-center justify-between flex-row-reverse">
                        <div className="text-right">
                            <span className="block text-xs text-slate-500">سعر الجملة</span>
                            <span className="text-xl font-bold text-primary">{product.price} DH</span>
                        </div>
                        <div className="text-left">
                            <span className="block text-xs text-slate-500">أقل طلب</span>
                            <span className="text-sm font-semibold text-slate-700">5 قطع</span>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-2 flex-row-reverse">
                        <button
                            onClick={() => addToCart(product)}
                            className="flex-1 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white"
                        >
                            <ShoppingCart size={18} />
                            إضافة
                        </button>
                        <button
                            onClick={() => window.open(`https://wa.me/212681652324?text=السلام عليكم، أنا مهتم بـ: ${product.name} (Ref: ${product.ref})`, '_blank')}
                            aria-label="Inquire via WhatsApp"
                            className="bg-surface-light border border-slate-200 hover:bg-slate-50 text-whatsapp font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center"
                        >
                            <MessageCircle size={20} />
                        </button>
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
