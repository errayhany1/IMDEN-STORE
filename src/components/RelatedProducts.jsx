import React, { useMemo } from 'react';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import useStore from '../store/useStore';

const normalizeWords = (value = '') => (
    value
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2)
);

const RelatedProducts = ({ product, onSelect }) => {
    const products = useStore((state) => state.products);
    const addToCart = useStore((state) => state.addToCart);
    const darkMode = useStore((state) => state.darkMode);

    const related = useMemo(() => {
        if (!product) return [];

        const targetCategory = product.baseCategory || product.category;
        const targetWords = new Set(normalizeWords(`${product.name || ''} ${product.ref || ''}`));

        return products
            .filter((candidate) => (
                candidate.id !== product.id
                && candidate.category !== 'Out of Stock'
                && candidate.isAvailable !== false
            ))
            .map((candidate) => {
                const candidateCategory = candidate.baseCategory || candidate.category;
                const sharedWords = normalizeWords(`${candidate.name || ''} ${candidate.ref || ''}`)
                    .filter((word) => targetWords.has(word)).length;
                const categoryScore = candidateCategory === targetCategory ? 10 : 0;
                const priceDistance = Math.abs(Number(candidate.price || 0) - Number(product.price || 0));
                const priceScore = Math.max(0, 3 - priceDistance / Math.max(Number(product.price || 1), 1));

                return { candidate, score: categoryScore + sharedWords * 3 + priceScore };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 6)
            .map(({ candidate }) => candidate);
    }, [product, products]);

    if (related.length === 0) return null;

    return (
        <section className="space-y-2.5">
            <div className="flex items-center justify-between">
                <h4 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                    قد يعجبك أيضاً
                </h4>
                <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                    منتجات مشابهة
                </span>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar snap-x">
                {related.map((item) => (
                    <article
                        key={item.id}
                        className={`shrink-0 w-36 rounded-xl border overflow-hidden snap-start transition-all hover:-translate-y-0.5 hover:shadow-md
                            ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}
                    >
                        <button
                            type="button"
                            onClick={() => onSelect(item)}
                            className={`block w-full aspect-square overflow-hidden ${darkMode ? 'bg-gray-950' : 'bg-slate-50'}`}
                        >
                            {item.image ? (
                                <img
                                    src={item.image}
                                    alt={`${item.name || item.ref} - إلكترونيات بالجملة Errayhany Store`}
                                    className="w-full h-full object-contain p-1.5"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="h-full flex items-center justify-center text-[10px] text-slate-400">
                                    بدون صورة
                                </span>
                            )}
                        </button>

                        <div className="p-2 space-y-2">
                            <button type="button" onClick={() => onSelect(item)} className="w-full text-right">
                                <p className={`text-[11px] font-semibold line-clamp-2 min-h-8 ${darkMode ? 'text-gray-200' : 'text-slate-700'}`}>
                                    {item.name || item.ref}
                                </p>
                            </button>
                            <div className="flex items-center justify-between gap-1">
                                <strong className="text-xs text-primary whitespace-nowrap">{item.price} DH</strong>
                                <button
                                    type="button"
                                    onClick={() => addToCart(item)}
                                    className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
                                    aria-label="إضافة للسلة"
                                >
                                    <ShoppingCart size={13} />
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => onSelect(item)}
                                className={`w-full flex items-center justify-center gap-1 text-[10px] font-semibold py-1 rounded-lg
                                    ${darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                عرض التفاصيل <ArrowLeft size={11} />
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
};

export default RelatedProducts;
