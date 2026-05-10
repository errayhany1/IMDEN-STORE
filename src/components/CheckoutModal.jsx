import React, { useState } from 'react';
import { X, Send, User, ShoppingBag, Shield } from 'lucide-react';
import useStore from '../store/useStore';
import { generatePDF } from '../utils/pdfGenerator';
import { sendToTelegram } from '../utils/telegramApi';
import { AnimatePresence, motion } from 'framer-motion';

const CheckoutModal = ({ isOpen, onClose }) => {
    const { cart, darkMode, clearCart, customerInfo, setCustomerInfo, user, setAuthModalOpen } = useStore();
    const dm = darkMode;

    // Pre-fill form with saved customer info or Firebase user data
    const [formData, setFormData] = useState({
        name: customerInfo?.name || user?.displayName || '',
        phone: customerInfo?.phone || user?.phoneNumber || '',
        address: customerInfo?.address || ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [showGate, setShowGate] = useState(!user); // Show login gate for non-logged users

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Strict Validation
        if (!formData.name.trim() || !formData.phone.trim() || !formData.address.trim()) {
            setErrorMessage('المرجو إدخال جميع المعلومات بشكل صحيح.');
            return;
        }

        const phoneRegex = /^(06|07)\d{8}$/;
        if (!phoneRegex.test(formData.phone.trim().replace(/\s/g, ''))) {
            setErrorMessage('المرجو إدخال رقم هاتف صحيح (يجب أن يتكون من 10 أرقام ويبدأ بـ 06 أو 07)');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            // Save the customer info to the global store (localStorage)
            setCustomerInfo(formData);

            // 1. Format the items and address for the Notes column
            let notesContent = `📍 **العنوان:**\n${formData.address}\n\n📦 **المنتجات المطلوبة:**\n`;
            cart.forEach(item => {
                notesContent += `- ${item.name} (Ref: ${item.ref}) | الكمية: ${item.quantity} | السعر: ${item.price} DH\n`;
            });

            // Prepare Order Metadata for Admin Dashboard
            const orderMetaData = cart.map(item => ({
                id: item.id || item.Id,
                name: item.name || item.Title,
                ref: item.ref || item.SKU,
                price: item.price || item.Price,
                qty: item.quantity
            }));

            // 2. Save to NocoDB Orders Table (New Account)
            const nocodbUrl = import.meta.env.VITE_NOCODB_URL;
            const ordersToken = import.meta.env.VITE_NOCODB_API_TOKEN || import.meta.env.VITE_NOCODB_ORDERS_TOKEN;
            const ordersTableId = import.meta.env.VITE_NOCODB_TABLE_ORDERS;

            try {
                console.log('[CheckoutModal] Saving order to NocoDB...', { nocodbUrl, ordersTableId });
                const orderBody = {
                    'Customer Name': formData.name,
                    'Customer Phone': formData.phone,
                    'Delivery Address': formData.address,
                    'Sale Price': subtotal,
                    'Notes': notesContent,
                    'Order Metadata': JSON.stringify(orderMetaData),
                    'Status': 'قيد المراجعة'
                };
                console.log('[CheckoutModal] Order payload:', orderBody);

                const nocoResponse = await fetch(`${nocodbUrl}/api/v2/tables/${ordersTableId}/records`, {
                    method: 'POST',
                    headers: {
                        'xc-token': ordersToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(orderBody)
                });
                
                const responseText = await nocoResponse.text();
                console.log('[CheckoutModal] NocoDB response status:', nocoResponse.status, 'body:', responseText);

                if (!nocoResponse.ok) {
                    console.error("Failed to save to NocoDB:", nocoResponse.status, responseText);
                    // Try again with array format (NocoDB v2 sometimes expects array)
                    console.log('[CheckoutModal] Retrying with array format...');
                    const retryResponse = await fetch(`${nocodbUrl}/api/v2/tables/${ordersTableId}/records`, {
                        method: 'POST',
                        headers: {
                            'xc-token': ordersToken,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify([orderBody])
                    });
                    const retryText = await retryResponse.text();
                    console.log('[CheckoutModal] Retry response status:', retryResponse.status, 'body:', retryText);
                    if (!retryResponse.ok) {
                        console.error("Retry also failed:", retryResponse.status, retryText);
                    }
                }
            } catch (dbError) {
                console.error("Error saving to database:", dbError);
            }

            // 3. Generate PDF file and send via Telegram
            const pdfFile = await generatePDF(cart, false);

            const caption = `🚨 **طلبية جديدة (IMDEN TECHNOLOGY)** 🚨\n\n` +
                `👤 **الاسم:** ${formData.name}\n` +
                `📞 **رقم الهاتف:** ${formData.phone}\n` +
                `📍 **العنوان:** ${formData.address}\n\n` +
                `📦 **عدد المنتجات:** ${cart.length}\n` +
                `💰 **المجموع الكلي:** ${subtotal.toFixed(2)} DH\n\n` +
                `📄 _مرفق مع هذه الرسالة ملف PDF يحتوي على تفاصيل المنتجات._\n` +
                `✅ _تم تسجيل الطلبية في قاعدة البيانات._`;

            await sendToTelegram(pdfFile, caption);

            setSuccessMessage('تم إرسال طلبيتك بنجاح! سيتم التواصل معك قريباً.');
            setCustomerInfo(formData); // Save phone number for Account Page
            // Clear cart and clear form after a delay
            setTimeout(() => {
                clearCart();
                onClose();
                setSuccessMessage('');
            }, 3000);

        } catch (error) {
            console.error('Checkout error:', error);
            setErrorMessage('حدث خطأ أثناء إرسال الطلبية. المرجو المحاولة مرة أخرى.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className={`relative w-full max-w-md rounded-2xl shadow-2xl p-6 sm:p-8 z-10 overflow-hidden flex flex-col ${dm ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}
                   
                >
                    <button
                        onClick={onClose}
                        className={`absolute top-4 left-4 p-2 rounded-full transition-colors ${dm ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                    >
                        <X size={20} />
                    </button>

                    <h2 className={`text-2xl font-bold mb-2 ${dm ? 'text-white' : 'text-slate-900'}`}>إتمام الطلب</h2>
                    <p className={`text-sm mb-4 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                        المرجو إدخال معلوماتك الشخصية لتأكيد إرسال الطلبية.
                    </p>

                    {/* Login Gate for non-logged users */}
                    {!user && showGate ? (
                        <div className="space-y-5 py-2">
                            {/* Icon */}
                            <div className="text-center">
                                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 ${dm ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                                    <ShoppingBag size={32} className="text-blue-500" />
                                </div>
                                <h3 className={`text-lg font-bold ${dm ? 'text-white' : 'text-slate-900'}`}>سجل دخولك لتجربة أفضل</h3>
                                <p className={`text-xs mt-1.5 max-w-xs mx-auto ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                    سجل دخولك لحفظ طلباتك ومتابعتها من صفحة "حسابي" في أي وقت
                                </p>
                            </div>

                            {/* Benefits */}
                            <div className={`rounded-xl p-3.5 space-y-2.5 ${dm ? 'bg-gray-900/50' : 'bg-slate-50'}`}>
                                {[
                                    { icon: '📦', text: 'تتبع جميع طلباتك من مكان واحد' },
                                    { icon: '⚡', text: 'إتمام الطلبات بشكل أسرع بدون إعادة إدخال بياناتك' },
                                    { icon: '🔔', text: 'إشعارات فورية عند تحديث حالة طلبك' },
                                ].map((b, i) => (
                                    <div key={i} className="flex items-center gap-2.5">
                                        <span className="text-base">{b.icon}</span>
                                        <span className={`text-xs font-medium ${dm ? 'text-gray-300' : 'text-slate-600'}`}>{b.text}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Login Button */}
                            <button
                                onClick={() => { onClose(); setAuthModalOpen(true); }}
                                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                            >
                                <User size={18} />
                                تسجيل الدخول
                            </button>

                            {/* Continue as Guest */}
                            <button
                                onClick={() => setShowGate(false)}
                                className={`w-full text-center text-xs font-medium py-2.5 rounded-xl transition-colors ${dm ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            >
                                المتابعة كزائر بدون حساب ←
                            </button>

                            <div className="flex items-center justify-center gap-1.5">
                                <Shield size={10} className={dm ? 'text-gray-600' : 'text-slate-300'} />
                                <span className={`text-[9px] ${dm ? 'text-gray-600' : 'text-slate-300'}`}>معلوماتك محمية ومؤمنة بالكامل</span>
                            </div>
                        </div>
                    ) : (
                    <>

                    {successMessage ? (
                        <div className="bg-green-100 text-green-800 p-4 rounded-xl text-center font-medium my-4 animate-pulse">
                            {successMessage}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div>
                                <label className={`block text-sm font-semibold mb-1.5 ${dm ? 'text-slate-300' : 'text-slate-700'}`}>الاسم الكامل <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${dm ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-primary' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-primary focus:bg-white'}`}
                                    placeholder="أدخل اسمك الكامل"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-semibold mb-1.5 ${dm ? 'text-slate-300' : 'text-slate-700'}`}>رقم الهاتف <span className="text-red-500">*</span></label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    dir="ltr"
                                    className={`w-full px-4 py-3 text-right rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${dm ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-primary' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-primary focus:bg-white'}`}
                                    placeholder="06 XX XX XX XX"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-semibold mb-1.5 ${dm ? 'text-slate-300' : 'text-slate-700'}`}>المدينة والعنوان <span className="text-red-500">*</span></label>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    required
                                    rows="3"
                                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none ${dm ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-primary' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-primary focus:bg-white'}`}
                                    placeholder="أدخل مدينتك وعنوانك بالتفصيل"
                                    disabled={isSubmitting}
                                ></textarea>
                            </div>

                            {errorMessage && (
                                <p className="text-red-500 text-sm font-medium">{errorMessage}</p>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || cart.length === 0}
                                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>جاري الإرسال...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>تأكيد الطلبية</span>
                                        <Send size={18} className="mr-2" style={{ transform: 'rotate(180deg)' }} />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                    </>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CheckoutModal;
