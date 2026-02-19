import React, { useState } from 'react';
import { X, Minus, Plus, Trash2, Share2, MessageCircle } from 'lucide-react';
import useStore from '../store/useStore';
import { generatePDF, generateWhatsAppMessage } from '../utils/pdfGenerator';
import { motion, AnimatePresence } from 'framer-motion';
import ImageModal from './ImageModal';

const CartSidebar = () => {
    const { cart, isCartOpen, toggleCart, updateQuantity, removeFromCart, darkMode, clearCart } = useStore();
    const dm = darkMode;
    const [modalImage, setModalImage] = useState(null);
    const [modalAlt, setModalAlt] = useState('');
    const [confirmClear, setConfirmClear] = useState(false);

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleShare = async () => {
        if (cart.length === 0) return;
        await generatePDF(cart);
        alert("تم تحميل ملف الطلبية (PDF). المرجو إرفاقه في محادثة الواتساب التي ستفتح الآن.");
        const message = generateWhatsAppMessage(cart);
        const phoneNumber = "212681652324";
        const url = `https://wa.me/${phoneNumber}?text=${message}`;
        window.open(url, '_blank');
    };

    return (
        <>
            <AnimatePresence>
                {isCartOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={toggleCart}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-40"
                        />

                        {/* Sidebar */}
                        <motion.aside
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className={`fixed top-0 right-0 h-full w-full sm:w-[440px] shadow-2xl z-50 flex flex-col border-l transition-colors duration-300
                                ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'}`}
                        >
                            {/* Header */}
                            <div className={`flex items-center justify-between px-6 py-5 border-b z-10 ${dm ? 'border-gray-700' : 'border-slate-100'}`} dir="rtl">
                                <div className="flex items-baseline gap-2">
                                    <h2 className={`text-xl font-bold ${dm ? 'text-white' : 'text-slate-900'}`}>عربة التسوق</h2>
                                    <span className="text-sm font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                                        {cart.length} منتجات
                                    </span>
                                    {/* Clear all button */}
                                    {cart.length > 0 && (
                                        <button
                                            onClick={() => setConfirmClear(true)}
                                            className="text-[11px] text-red-400 hover:text-red-600 hover:underline transition-colors"
                                        >
                                            حذف الكل
                                        </button>
                                    )}
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
                                        <p>عربة التسوق فارغة</p>
                                        <button onClick={toggleCart} className="text-primary font-semibold hover:underline">
                                            تصفح المنتجات
                                        </button>
                                    </div>
                                ) : (
                                    cart.map((item) => (
                                        <div key={item.id} className="group flex gap-4 flex-row-reverse">
                                            {/* Thumbnail — click to zoom */}
                                            <div
                                                className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 cursor-zoom-in"
                                                onClick={() => { if (item.image) { setModalImage(item.image); setModalAlt(item.name); } }}
                                            >
                                                {item.image ? (
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No Img</div>
                                                )}
                                            </div>

                                            <div className="flex-1 flex flex-col justify-between py-0.5 text-right">
                                                <div>
                                                    <div className="flex justify-between items-start gap-2 flex-row-reverse">
                                                        <h3 className={`font-semibold leading-tight line-clamp-2 ${dm ? 'text-white' : 'text-slate-900'}`}>{item.name}</h3>
                                                        <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1">Ref: {item.ref}</p>
                                                </div>
                                                <div className="flex items-center justify-between mt-3 flex-row-reverse">
                                                    <div className={`flex items-center border rounded-lg ${dm ? 'border-gray-600 bg-gray-800' : 'border-slate-200 bg-slate-50'}`}>
                                                        {/* -5 */}
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -5)}
                                                            className="w-8 h-8 flex items-center justify-center text-[11px] font-bold text-slate-400 hover:text-red-500 hover:bg-white rounded-l-lg transition-colors border-r border-slate-200"
                                                            title="نقصان 5"
                                                        >-5</button>
                                                        {/* -1 */}
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -1)}
                                                            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-primary hover:bg-white transition-colors border-r border-slate-200"
                                                        >
                                                            <Minus size={16} />
                                                        </button>
                                                        <span className={`w-10 text-center text-sm font-medium ${dm ? 'text-white' : 'text-slate-900'}`}>{item.quantity}</span>
                                                        {/* +1 */}
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 1)}
                                                            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-primary hover:bg-white transition-colors border-l border-slate-200"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                        {/* +5 */}
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 5)}
                                                            className="w-8 h-8 flex items-center justify-center text-[11px] font-bold text-slate-400 hover:text-primary hover:bg-white rounded-r-lg transition-colors border-l border-slate-200"
                                                            title="زيادة 5"
                                                        >+5</button>
                                                    </div>
                                                    <div className="text-left">
                                                        <p className={`text-sm font-bold ${dm ? 'text-white' : 'text-slate-900'}`}>{(item.price * item.quantity).toFixed(2)} DH</p>
                                                        <p className="text-[10px] text-slate-400">{item.price} DH / قطعة</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Footer */}
                            <div className={`border-t p-6 space-y-4 ${dm ? 'border-gray-700 bg-gray-900' : 'border-slate-200 bg-slate-50'}`}>
                                <div className="flex justify-between items-end flex-row-reverse">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">المجموع الكلي</span>
                                    <span className={`text-2xl font-bold ${dm ? 'text-white' : 'text-slate-900'}`}>{subtotal.toFixed(2)} DH</span>
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

            {/* Image lightbox */}
            <ImageModal
                isOpen={!!modalImage}
                onClose={() => setModalImage(null)}
                image={modalImage}
                alt={modalAlt}
            />

            {/* ── Confirm Clear Cart Modal ── */}
            {confirmClear && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setConfirmClear(false)}
                    />
                    {/* Dialog */}
                    <div className={`relative rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center space-y-4 z-10
                        ${dm ? 'bg-gray-800 text-white' : 'bg-white text-slate-900'}`}
                        dir="rtl"
                    >
                        <div className="text-4xl">🗑️</div>
                        <h3 className="text-lg font-bold">حذف جميع المنتجات؟</h3>
                        <p className={`text-sm ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                            سيتم حذف جميع المنتجات من عربة التسوق. هل أنت متأكد؟
                        </p>
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => setConfirmClear(false)}
                                className={`flex-1 py-2.5 rounded-xl font-medium transition-colors
                                    ${dm ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={() => { clearCart(); setConfirmClear(false); }}
                                className="flex-1 py-2.5 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
                            >
                                حذف الكل
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CartSidebar;
