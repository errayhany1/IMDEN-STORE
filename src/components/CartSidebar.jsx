import React from 'react';
import { X, Minus, Plus, Trash2, Share2, MessageCircle } from 'lucide-react';
import useStore from '../store/useStore';
import { generatePDF, generateWhatsAppMessage } from '../utils/pdfGenerator';
import { motion, AnimatePresence } from 'framer-motion';

const CartSidebar = () => {
    const { cart, isCartOpen, toggleCart, updateQuantity, removeFromCart } = useStore();

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.08; // 8% Tax Estimate as per design
    const total = subtotal + tax;

    const handleShare = async () => {
        if (cart.length === 0) return;

        // 1. Generate and Download PDF
        await generatePDF(cart);

        // 2. Open WhatsApp
        const message = generateWhatsAppMessage(cart);
        const phoneNumber = "212681652324";
        const url = `https://wa.me/${phoneNumber}?text=${message}`;
        window.open(url, '_blank');
    };

    return (
        <AnimatePresence>
            {isCartOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleCart}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-40 transition-opacity"
                    />

                    {/* Sidebar */}
                    <motion.aside
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-surface-light shadow-2xl z-50 flex flex-col border-l border-slate-200"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white z-10" dir="rtl">
                            <div className="flex items-baseline gap-3">
                                <h2 className="text-xl font-bold text-slate-900">عربة التسوق</h2>
                                <span className="text-sm font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                                    {cart.length} منتجات
                                </span>
                            </div>
                            <button
                                onClick={toggleCart}
                                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Items */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                                    <ShoppingCart size={48} />
                                    <p>عربة التسوق فارغة</p>
                                    <button onClick={toggleCart} className="text-primary font-semibold hover:underline">
                                        تصفح المنتجات
                                    </button>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div key={item.id} className="group flex gap-4 flex-row-reverse">
                                        <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-100">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No Img</div>
                                            )}
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between py-0.5 text-right">
                                            <div>
                                                <div className="flex justify-between items-start gap-2 flex-row-reverse">
                                                    <h3 className="font-semibold text-slate-900 leading-tight line-clamp-2">{item.name}</h3>
                                                    <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">Ref: {item.ref}</p>
                                            </div>
                                            <div className="flex items-center justify-between mt-3 flex-row-reverse">
                                                <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                                                    <button
                                                        onClick={() => updateQuantity(item.id, -1)}
                                                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-primary hover:bg-white rounded-l-lg transition-colors"
                                                    >
                                                        <Minus size={16} />
                                                    </button>
                                                    <span className="w-10 text-center text-sm font-medium text-slate-900">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, 1)}
                                                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-primary hover:bg-white rounded-r-lg transition-colors"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-bold text-slate-900">{(item.price * item.quantity).toFixed(2)} DH</p>
                                                    <p className="text-[10px] text-slate-400">{item.price} DH / قطعة</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-slate-200 bg-slate-50 p-6 space-y-4">
                            <div className="space-y-2 text-sm text-slate-500">
                                <div className="flex justify-between flex-row-reverse">
                                    <span>المجموع الفرعي</span>
                                    <span className="font-medium text-slate-900">{subtotal.toFixed(2)} DH</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-end pt-2 pb-2 flex-row-reverse">
                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">المجموع الكلي</span>
                                </div>
                                <span className="text-2xl font-bold text-slate-900">{subtotal.toFixed(2)} DH</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => generatePDF(cart)}
                                    disabled={cart.length === 0}
                                    className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-4 px-4 rounded-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Share2 size={20} />
                                    <span>تحميل PDF</span>
                                </button>
                                <button
                                    onClick={handleShare}
                                    disabled={cart.length === 0}
                                    className="flex-1 bg-whatsapp hover:brightness-110 text-white font-semibold py-4 px-4 rounded-lg shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <MessageCircle size={20} />
                                    <span>إرسال واتساب</span>
                                </button>
                            </div>
                            <p className="text-center text-[11px] text-slate-400">تم إنشاء الطلب تلقائياً</p>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
};

export default CartSidebar;
