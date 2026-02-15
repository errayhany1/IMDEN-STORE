import React from 'react';
import { ShoppingCart, MessageCircle, Plus } from 'lucide-react';
import useStore from '../store/useStore';

const ProductCard = ({ product }) => {
    const addToCart = useStore((state) => state.addToCart);
    const isAvailable = product.postebl === 'POSTEBL' || product.postebl === true || product.isAvailable; // Robust check

    return (
        <article className="bg-surface-light rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-300 border border-slate-100 flex flex-col overflow-hidden group h-full">
            <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                {/* Randomly show NEW badge for demo purposes or if flagged */}
                {Math.random() > 0.8 && (
                    <span className="absolute top-2 left-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded z-10">NEW</span>
                )}

                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className={`w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 ${!isAvailable ? 'grayscale' : ''}`}
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-200">
                        No Image
                    </div>
                )}

                {!isAvailable && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-20">
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">نفد من المخزون</span>
                    </div>
                )}
            </div>

            <div className="p-4 flex flex-col flex-grow">
                <div className="text-xs font-mono text-slate-400 mb-1">REF-{product.ref}</div>
                <h3 className="text-slate-900 font-medium text-lg leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                    {product.name}
                </h3>

                <div className="mt-auto pt-2 flex items-center justify-between">
                    <div>
                        <span className="block text-xs text-slate-500">Wholesale Price</span>
                        <span className="text-xl font-bold text-primary">${product.price}</span>
                    </div>
                    <div className="text-right">
                        <span className="block text-xs text-slate-500">Min. Order</span>
                        <span className="text-sm font-semibold text-slate-700">5 Units</span>
                    </div>
                </div>

                <div className="mt-4 flex gap-2">
                    <button
                        onClick={() => isAvailable && addToCart(product)}
                        disabled={!isAvailable}
                        className={`flex-1 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2
                            ${isAvailable
                                ? 'bg-primary hover:bg-primary-dark text-white'
                                : 'bg-red-100 text-red-500 cursor-not-allowed border border-red-200'
                            }`}
                    >
                        {isAvailable ? <><ShoppingCart size={18} /> Add</> : <span className="text-sm font-bold">نفد من المخزون</span>}
                    </button>
                    <button
                        onClick={() => window.open(`https://wa.me/212681652324?text=Hello, I am interested in: ${product.name} (Ref: ${product.ref})`, '_blank')}
                        aria-label="Inquire via WhatsApp"
                        className="bg-surface-light border border-slate-200 hover:bg-slate-50 text-whatsapp font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center"
                    >
                        <MessageCircle size={20} />
                    </button>
                </div>
            </div>
        </article>
    );
};

export default ProductCard;
