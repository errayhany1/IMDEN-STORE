import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import useStore from '../store/useStore';
import { sendToTelegram } from '../utils/telegramApi';
import { AnimatePresence, motion } from 'framer-motion';

const FeedbackModal = ({ isOpen, onClose }) => {
    const { darkMode, user, customerInfo } = useStore();
    const dm = darkMode;

    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!message.trim()) {
            setErrorMessage('المرجو كتابة رسالتك قبل الإرسال.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const userName = customerInfo?.name || user?.displayName || 'غير معروف';
            const userPhone = customerInfo?.phone || user?.phoneNumber || 'غير معروف';

            const caption = `🛒 **طلب توفير منتج جديد** 🛒\n\n` +
                `👤 **الاسم:** ${userName}\n` +
                `📞 **الهاتف:** ${userPhone}\n\n` +
                `📦 **المنتجات المطلوبة:**\n${message}`;
            
            const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '8652359538:AAGqVf2MpKHGEAhYuZ1rD5ekk-J3XqBXfqk';
            const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID || '-1003868832013';

            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('text', caption);
            formData.append('parse_mode', 'Markdown');

            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Failed to send text');

            setSuccessMessage('شكراً لك! تم إرسال رسالتك بنجاح.');
            setTimeout(() => {
                onClose();
                setMessage('');
                setSuccessMessage('');
            }, 3000);

        } catch (error) {
            console.error('Feedback error:', error);
            setErrorMessage('حدث خطأ أثناء إرسال الرسالة. المرجو المحاولة مرة أخرى.');
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

                    <h2 className={`text-xl font-bold mb-2 ${dm ? 'text-white' : 'text-slate-900'}`}>طلب منتجات غير متوفرة</h2>
                    <p className={`text-sm mb-6 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                        اكتب لنا أسماء المنتجات أو الأجهزة التي تبحث عنها، وسنقوم بالبحث عنها واستيرادها لك بأفضل أسعار الجملة.
                    </p>

                    {successMessage ? (
                        <div className="bg-green-100 text-green-800 p-4 rounded-xl text-center font-medium my-4 animate-pulse">
                            {successMessage}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    required
                                    rows="5"
                                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none ${dm ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-primary' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-primary focus:bg-white'}`}
                                    placeholder="مثال: أبحث عن طابعات صغيرة، أو أجهزة أندرويد بوكس..."
                                    disabled={isSubmitting}
                                />
                            </div>

                            {errorMessage && (
                                <p className="text-red-500 text-sm font-semibold">{errorMessage}</p>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70"
                            >
                                {isSubmitting ? (
                                    <span className="animate-pulse">جاري الإرسال...</span>
                                ) : (
                                    <>
                                        <Send size={18} className="rotate-180" />
                                        <span>إرسال الرسالة</span>
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

export default FeedbackModal;
