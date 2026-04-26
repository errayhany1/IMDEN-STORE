import React, { useState } from 'react';
import { X, Send, User } from 'lucide-react';
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

            // Generate PDF file but do not save to disk
            const pdfFile = await generatePDF(cart, false);

            const caption = `🚨 **طلبية جديدة (IMDEN TECHNOLOGY)** 🚨\n\n` +
                `👤 **الاسم:** ${formData.name}\n` +
                `📞 **رقم الهاتف:** ${formData.phone}\n` +
                `📍 **العنوان:** ${formData.address}\n\n` +
                `📦 **عدد المنتجات:** ${cart.length}\n` +
                `💰 **المجموع الكلي:** ${subtotal.toFixed(2)} DH\n\n` +
                `📄 _مرفق مع هذه الرسالة ملف PDF يحتوي على تفاصيل المنتجات._`;

            await sendToTelegram(pdfFile, caption);

            setSuccessMessage('تم إرسال طلبيتك بنجاح! سيتم التواصل معك قريباً.');
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
                    dir="rtl"
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

                    {/* Login suggestion for non-logged users */}
                    {!user && (
                        <div 
                            onClick={() => { onClose(); setAuthModalOpen(true); }}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md mb-4
                            ${dm ? 'bg-primary/10 border-primary/30 hover:bg-primary/20' : 'bg-primary/5 border-primary/20 hover:bg-primary/10'}`}
                            dir="rtl"
                        >
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                <User size={16} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-primary">سجل دخولك لحفظ بياناتك!</p>
                                <p className={`text-[10px] ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                    لن تحتاج لإعادة إدخال معلوماتك في كل طلب
                                </p>
                            </div>
                            <span className="text-primary text-lg">←</span>
                        </div>
                    )}

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
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CheckoutModal;
