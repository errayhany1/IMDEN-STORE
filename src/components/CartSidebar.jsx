import React from 'react';
import { X, Minus, Plus, Trash2, Share2 } from 'lucide-react';
import useStore from '../store/useStore';
import { generatePDF, generateWhatsAppMessage } from '../utils/pdfGenerator';
import { motion, AnimatePresence } from 'framer-motion';

const CartSidebar = () => {
    const { cart, isCartOpen, toggleCart, updateQuantity, removeFromCart } = useStore();

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.08; // 8% Tax Estimate as per design
    const total = subtotal + tax;

    const handleShare = () => {
        if (cart.length === 0) return;
        generatePDF(cart);
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
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white z-10">
                            <div className="flex items-baseline gap-3">
                                <h2 className="text-xl font-bold text-slate-900">Shopping Cart</h2>
                                <span className="text-sm font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                                    {cart.length} Items
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
                                    <p>Your cart is empty</p>
                                    <button onClick={toggleCart} className="text-primary font-semibold hover:underline">
                                        Browse Products
                                    </button>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div key={item.id} className="group flex gap-4">
                                        <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-100">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No Img</div>
                                            )}
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between py-0.5">
                                            <div>
                                                <div className="flex justify-between items-start gap-2">
                                                    <h3 className="font-semibold text-slate-900 leading-tight line-clamp-2">{item.name}</h3>
                                                    <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">Ref: {item.ref}</p>
                                            </div>
                                            <div className="flex items-center justify-between mt-3">
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
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-slate-900">${(item.price * item.quantity).toFixed(2)}</p>
                                                    <p className="text-[10px] text-slate-400">${item.price} / unit</p>
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
                                <div className="flex justify-between">
                                    <span>Subtotal</span>
                                    <span className="font-medium text-slate-900">${subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Tax Estimate (8%)</span>
                                    <span className="font-medium text-slate-900">${tax.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-end pt-2 pb-2">
                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Estimate</span>
                                    <p className="text-xs text-slate-400 font-light">Excludes shipping</p>
                                </div>
                                <span className="text-2xl font-bold text-slate-900">${total.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={handleShare}
                                disabled={cart.length === 0}
                                className="w-full bg-whatsapp hover:brightness-110 text-white font-semibold py-4 px-6 rounded-lg shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Share2 size={24} />
                                <span>Share via WhatsApp (PDF)</span>
                            </button>
                            <p className="text-center text-[11px] text-slate-400">Order generated via NocoDB & processed manually.</p>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
};

export default CartSidebar;
