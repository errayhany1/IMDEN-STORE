import React, { useState } from 'react';
import { X, Minus, Plus, Trash2, Share2, Download } from 'lucide-react';
import useStore from '../store/useStore';
import { generatePDF } from '../utils/pdfGenerator';
import { sendToTelegram } from '../utils/telegramApi';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import ImageModal from './ImageModal';
import SocialButton from './SocialButton';
import CheckoutModal from './CheckoutModal';

const generateAndSendSilentTelegram = async (cart, actionName) => {
    try {
        const orderId = Math.floor(10000 + Math.random() * 90000).toString();
        const pdfFile = await generatePDF(cart, false);
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const caption = `🚨 **طلب سريع غير مؤكد عبر (${actionName})** 🚨\n\n` +
            `📌 **رمز الطلب:** #${orderId}\n` +
            `📦 **عدد المنتجات:** ${cart.length}\n` +
            `💰 **المجموع الكلي:** ${subtotal.toFixed(2)} DH\n\n` +
            `📄 _مرفق مع هذه الرسالة ملف PDF لتفاصيل المنتجات._`;

        // Send silently in the background
        sendToTelegram(pdfFile, caption).catch(console.error);
        return orderId;
    } catch (error) {
        console.error("Silent telegram error:", error);
        return Math.floor(10000 + Math.random() * 90000).toString();
    }
};

const CartSidebar = () => {
    const { cart, isCartOpen, toggleCart, updateQuantity, removeFromCart, darkMode, clearCart, products } = useStore();
    const dm = darkMode;
    const [modalImage, setModalImage] = useState(null);
    const [modalAlt, setModalAlt] = useState('');
    const [confirmClear, setConfirmClear] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const [currentLang, setCurrentLang] = useState('ar');

    React.useEffect(() => {
        const match = document.cookie.match(/googtrans=\/ar\/([a-z]{2})/);
        if (match && match[1]) {
            setCurrentLang(match[1]);
        }
    }, []);

    const isRtl = currentLang === 'ar';

    const handleShare = async () => {
        if (cart.length === 0) return;
        const orderId = await generateAndSendSilentTelegram('واتساب');
        const phoneNumber = "212664630566";
        const message = encodeURIComponent(`مرحباً، لقد أتممت هذا الطلب. رمز الطلب هو: #${orderId}\nالمرجو تأكيد استلام الطلبية.`);
        const url = `https://wa.me/${phoneNumber}?text=${message}`;
        window.open(url, '_blank');
    };

    const handlePDF = async () => {
        if (cart.length === 0) return;
        generateAndSendSilentTelegram('تحميل PDF');
        await generatePDF(cart, true); // this triggers doc.save() inside
    };

    const handleNativeShare = async () => {
        if (cart.length === 0) return;

        const orderId = await generateAndSendSilentTelegram('المشاركة العادية');

        try {
            const pdfFile = await generatePDF(cart, false);

            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    title: `طلبية من IMDEN STORE #${orderId}`,
                    text: `مرفق تفاصيل الطلبية. رمز الطلب: #${orderId}`,
                    files: [pdfFile]
                });
            } else {
                alert("متصفحك لا يدعم مشاركة الملفات مباشرة. سيتم حفظ الملف في جهازك للتمكن من مشاركته.");
                await generatePDF(cart, true); // Fallback to download
            }
        } catch (error) {
            console.error('Error sharing:', error);
            // AbortError is common if the user cancels the share dialog, no need to alert
            if (error.name !== 'AbortError') {
                alert("حدث خطأ أثناء محاولة المشاركة.");
            }
        }
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
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[90]"
                        />

                        {/* Sidebar */}
                        <motion.aside
                            initial={{ x: isRtl ? '100%' : '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: isRtl ? '100%' : '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className={`fixed top-0 ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} h-full w-full sm:w-[440px] shadow-2xl z-[100] flex flex-col transition-colors duration-300
                                ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'}`}
                        >
                            {/* Header */}
                            <div className={`flex items-center justify-between px-4 sm:px-6 py-3 border-b z-10 ${dm ? 'border-gray-700' : 'border-slate-100'}`}>
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
                            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-3">
                                {cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                                        <p className="text-sm">عربة التسوق فارغة</p>
                                        <button onClick={toggleCart} className="text-primary text-sm font-semibold hover:underline">
                                            تصفح المنتجات
                                        </button>
                                    </div>
                                ) : (
                                    cart.map((item) => {
                                        // Fetch fresh image from products store to avoid expired signed URLs from localStorage
                                        const liveProduct = products.find(p => p.id === item.id);
                                        const displayImage = liveProduct?.image || item.image;

                                        return (
                                            <div key={item.id} className={`group flex gap-3 flex-row-reverse pb-3 border-b border-dashed last:border-b-0 ${dm ? 'border-gray-700' : 'border-slate-200'}`}>
                                                {/* Thumbnail — click to zoom */}
                                                <div
                                                    className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-md overflow-hidden bg-slate-100 border border-slate-100 cursor-zoom-in"
                                                    onClick={() => { if (displayImage) { setModalImage(displayImage); setModalAlt(item.name); } }}
                                                >
                                                    {displayImage ? (
                                                        <img src={displayImage} alt={item.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs text-slate-400">بدون صورة</div>
                                                    )}
                                                </div>

                                                <div className="flex-1 flex flex-col justify-between py-0 text-right">
                                                    <div>
                                                        <div className="flex justify-between items-start gap-1 sm:gap-2 flex-row-reverse">
                                                            <h3 className={`font-semibold leading-tight text-sm sm:text-base line-clamp-2 ${dm ? 'text-white' : 'text-slate-900'}`}>{item.name}</h3>
                                                            <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 -m-1">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                        <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Ref: {item.ref}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1.5 flex-row-reverse">

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
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            <div className={`border-t p-4 space-y-3 ${dm ? 'border-gray-700 bg-gray-900' : 'border-slate-200 bg-slate-50'}`}>
                                <div className="flex justify-between items-end flex-row-reverse">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">المجموع الكلي</span>
                                    <span className={`text-2xl font-bold ${dm ? 'text-white' : 'text-slate-900'}`}>{subtotal.toFixed(2)} DH</span>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => setIsCheckoutOpen(true)}
                                        disabled={cart.length === 0}
                                        className={`w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${cart.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}
                                    >
                                        <span className="text-lg">إتمام الطلب الآن</span>
                                    </button>

                                    <div className="flex gap-2">
                                        <SocialButton
                                            type="whatsapp"
                                            onClick={cart.length > 0 ? handleShare : undefined}
                                            label="واتساب"
                                            size="sm"
                                            className={`flex-1 py-2 rounded-lg text-xs shadow-sm font-semibold justify-center ${cart.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}
                                        />
                                        <button
                                            onClick={() => handlePDF()}
                                            disabled={cart.length === 0}
                                            className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 px-2 rounded-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                        >
                                            <Download size={14} />
                                            <span>PDF</span>
                                        </button>
                                        <button
                                            onClick={handleNativeShare}
                                            disabled={cart.length === 0}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-2 rounded-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs overflow-hidden relative"
                                        >
                                            <Share2 size={14} className="animate-pulse" />
                                            <span>مشاركة</span>
                                            <span className="absolute inset-0 bg-white/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-0 rounded-lg"></span>
                                        </button>
                                    </div>
                                </div>
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

            {/* Checkout Form Modal */}
            <CheckoutModal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
            />
        </>
    );
};

export default CartSidebar;
