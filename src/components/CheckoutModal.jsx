import React, { useEffect, useState } from 'react';
import { X, Send, User, ShoppingBag, Shield, Banknote, Landmark, UploadCloud, FileCheck2, Copy, Check } from 'lucide-react';
import useStore from '../store/useStore';
import { generatePDF } from '../utils/pdfGenerator';
import { sendToTelegram, sendTransferProofToTelegram } from '../utils/telegramApi';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
    normalizeMoroccanPhone,
    upsertCustomerProfile,
} from '../services/customerAccount';

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
    const [showGate, setShowGate] = useState(false); // Changed: do not show gate initially
    const [orderCompleted, setOrderCompleted] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery');
    const [transferReference, setTransferReference] = useState('');
    const [transferProof, setTransferProof] = useState(null);
    const [bankDetailsCopied, setBankDetailsCopied] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const savedInfo = !user || customerInfo?.uid === user.uid
            ? customerInfo
            : {};
        setFormData({
            name: savedInfo?.name || user?.displayName || '',
            phone: savedInfo?.phone || user?.phoneNumber || '',
            address: savedInfo?.address || '',
        });
    }, [isOpen, user, customerInfo]);

    const bankDetails = {
        bankName: import.meta.env.VITE_BANK_NAME || '',
        accountHolder: import.meta.env.VITE_BANK_ACCOUNT_HOLDER || '',
        rib: import.meta.env.VITE_BANK_RIB || '',
        iban: import.meta.env.VITE_BANK_IBAN || '',
    };
    const bankTransferConfigured = Boolean(bankDetails.bankName && bankDetails.accountHolder && bankDetails.rib);

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleProofChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setErrorMessage('صيغة الإثبات غير مدعومة. استخدم JPG أو PNG أو WEBP أو PDF.');
            event.target.value = '';
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setErrorMessage('حجم ملف الإثبات يجب ألا يتجاوز 10 MB.');
            event.target.value = '';
            return;
        }

        setTransferProof(file);
        setErrorMessage('');
    };

    const copyBankDetails = async () => {
        const details = [
            bankDetails.bankName,
            bankDetails.accountHolder,
            `RIB: ${bankDetails.rib}`,
            bankDetails.iban ? `IBAN: ${bankDetails.iban}` : '',
        ].filter(Boolean).join('\n');
        await navigator.clipboard.writeText(details);
        setBankDetailsCopied(true);
        setTimeout(() => setBankDetailsCopied(false), 1500);
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

        if (paymentMethod === 'bank_transfer') {
            if (!bankTransferConfigured) {
                setErrorMessage('بيانات الحساب البنكي غير مكتملة حالياً. اختر الدفع عند الاستلام أو تواصل معنا.');
                return;
            }
            if (transferReference.trim().length < 4) {
                setErrorMessage('المرجو إدخال مرجع التحويل البنكي.');
                return;
            }
            if (!transferProof) {
                setErrorMessage('المرجو إرفاق صورة أو ملف إثبات التحويل.');
                return;
            }
        }

        setIsSubmitting(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            // Save the customer info to the global store (localStorage)
            setCustomerInfo({ ...customerInfo, ...formData });

            // 1. Format the items and address for the Notes column
            const paymentLabel = paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'الدفع عند الاستلام';
            let notesContent = `📍 **العنوان:**\n${formData.address}\n\n💳 **طريقة الدفع:** ${paymentLabel}\n`;
            if (paymentMethod === 'bank_transfer') {
                notesContent += `🔖 **مرجع التحويل:** ${transferReference.trim()}\n`;
            }
            notesContent += `\n📦 **المنتجات المطلوبة:**\n`;
            cart.forEach(item => {
                notesContent += `- ${item.name} (Ref: ${item.ref}) | الكمية: ${item.quantity} | السعر: ${item.price} DH\n`;
            });

            const orderMetadata = cart.map(item => ({
                id: item.id || item.Id,
                name: item.name || item.Title,
                ref: item.ref || item.SKU,
                price: item.price || item.Price,
                qty: item.quantity
            }));

            // 2. Save to NocoDB Orders Table (New Account)
            const nocodbUrl = import.meta.env.VITE_NOCODB_URL;
            const ordersToken = import.meta.env.VITE_NOCODB_ORDERS_TOKEN || import.meta.env.VITE_NOCODB_API_TOKEN;
            const ordersTableId = import.meta.env.VITE_NOCODB_TABLE_ORDERS;

            try {
                const normalizedOrderPhone = normalizeMoroccanPhone(formData.phone);
                const legacyOrderBody = {
                    'Customer Name': formData.name,
                    'Customer Phone': formData.phone,
                    'Sale Price': subtotal,
                    'Delivery Address': formData.address,
                    'Order Metadata': JSON.stringify(orderMetadata),
                    'Notes': notesContent,
                    // Keep the existing NocoDB status vocabulary; payment verification is recorded in Notes.
                    'Status': 'Pending'
                };
                const orderBody = {
                    ...legacyOrderBody,
                    ...(user ? {
                        'Customer UID': user.uid,
                        'Customer Email': user.email || '',
                        'Customer Phone Normalized': normalizedOrderPhone,
                    } : {}),
                };

                const saveOrder = body => fetch(
                    `${nocodbUrl}/api/v2/tables/${ordersTableId}/records`,
                    {
                        method: 'POST',
                        headers: {
                            'xc-token': ordersToken,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(body)
                    }
                );

                let nocoResponse = await saveOrder(orderBody);
                let responseText = await nocoResponse.text();

                // A signed-in order must never be silently saved without its
                // Firebase UID, otherwise it disappears from the account.
                if (!nocoResponse.ok && user) {
                    console.warn(
                        '[CheckoutModal] Optional account columns unavailable; retrying with UID.',
                        nocoResponse.status
                    );
                    nocoResponse = await saveOrder({
                        ...legacyOrderBody,
                        'Customer UID': user.uid,
                    });
                    responseText = await nocoResponse.text();
                }

                if (!nocoResponse.ok) {
                    console.error("Failed to save to NocoDB:", nocoResponse.status, responseText);
                    if (user) {
                        throw new Error(
                            'عمود Customer UID غير موجود في جدول الطلبات.'
                        );
                    }
                    // Guest checkout can use the historical array payload.
                    const retryResponse = await saveOrder([legacyOrderBody]);
                    const retryText = await retryResponse.text();
                    if (!retryResponse.ok) {
                        console.error("Retry also failed:", retryResponse.status, retryText);
                        throw new Error('تعذر حفظ الطلب في قاعدة البيانات.');
                    }
                }

                if (user) {
                    try {
                        const verifiedAccountPhone = normalizeMoroccanPhone(
                            user.phoneNumber
                            || (
                                customerInfo?.uid === user.uid
                                && customerInfo?.phoneVerified
                                && customerInfo?.phone
                            )
                        );
                        const canUpdateVerifiedPhone = Boolean(
                            verifiedAccountPhone
                            && verifiedAccountPhone === normalizedOrderPhone
                        );
                        await upsertCustomerProfile(user, {
                            name: formData.name,
                            address: formData.address,
                            ...(canUpdateVerifiedPhone ? {
                                phone: formData.phone,
                                normalizedPhone: normalizedOrderPhone,
                                phoneVerified: true,
                            } : {}),
                        });
                    } catch (profileError) {
                        // The order is already saved; profile sync must not
                        // create duplicate orders on a customer retry.
                        console.error('Customer profile update failed:', profileError);
                    }
                }
            } catch (dbError) {
                console.error("Error saving to database:", dbError);
                throw new Error('تعذر تسجيل الطلب. يرجى المحاولة مرة أخرى.');
            }

            // 3. Generate PDF file and send via Telegram
            const pdfFile = await generatePDF(cart, false);

            const caption = `🚨 **طلبية جديدة (Errayhany Store)** 🚨\n\n` +
                `👤 **الاسم:** ${formData.name}\n` +
                `📞 **رقم الهاتف:** ${formData.phone}\n` +
                `📍 **العنوان:** ${formData.address}\n\n` +
                `💳 **طريقة الدفع:** ${paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'الدفع عند الاستلام'}\n` +
                (paymentMethod === 'bank_transfer' ? `🔖 **مرجع التحويل:** ${transferReference.trim()}\n` : '') +
                `📦 **عدد المنتجات:** ${cart.length}\n` +
                `💰 **المجموع الكلي:** ${subtotal.toFixed(2)} DH\n\n` +
                `📄 _مرفق مع هذه الرسالة ملف PDF يحتوي على تفاصيل المنتجات._\n` +
                `✅ _تم تسجيل الطلبية في قاعدة البيانات._`;

            await sendToTelegram(pdfFile, caption);

            if (paymentMethod === 'bank_transfer' && transferProof) {
                await sendTransferProofToTelegram(
                    transferProof,
                    `🏦 إثبات تحويل بنكي\n👤 ${formData.name}\n📞 ${formData.phone}\n🔖 المرجع: ${transferReference.trim()}\n💰 المبلغ: ${subtotal.toFixed(2)} DH`
                );
            }

            setSuccessMessage(
                paymentMethod === 'bank_transfer'
                    ? 'تم استلام طلبك وإثبات التحويل. سنراجعه ونؤكد الدفع قريباً.'
                    : 'تم إرسال طلبيتك بنجاح! سيتم التواصل معك قريباً.'
            );
            setCustomerInfo({ ...customerInfo, ...formData }); // Save details for the next checkout
            clearCart();
            setOrderCompleted(true);

            if (!user) {
                // Show login gate after short delay
                setTimeout(() => {
                    setShowGate(true);
                    setSuccessMessage('');
                }, 1500);
            } else {
                // Close modal after delay if already logged in
                setTimeout(() => {
                    onClose();
                    setSuccessMessage('');
                    setOrderCompleted(false);
                }, 3000);
            }

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
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <Motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className={`relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl p-6 sm:p-8 z-10 flex flex-col ${dm ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}
                   
                >
                    <button
                        onClick={() => { onClose(); setOrderCompleted(false); setShowGate(false); }}
                        className={`absolute top-4 left-4 p-2 rounded-full transition-colors ${dm ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                    >
                        <X size={20} />
                    </button>

                    <h2 className={`text-2xl font-bold mb-2 ${dm ? 'text-white' : 'text-slate-900'}`}>
                        {orderCompleted && showGate ? 'اكتمل الطلب بنجاح! 🎉' : 'إتمام الطلب'}
                    </h2>
                    <p className={`text-sm mb-4 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                        {orderCompleted && showGate ? 'بقي خطوة واحدة لحفظ طلبك ومتابعته لاحقاً.' : 'المرجو إدخال معلوماتك الشخصية لتأكيد إرسال الطلبية.'}
                    </p>

                    {/* Login Gate for non-logged users */}
                    {!user && showGate && orderCompleted ? (
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

                            {/* Continue as Guest / Close */}
                            <button
                                onClick={() => { onClose(); setOrderCompleted(false); setShowGate(false); }}
                                className={`w-full text-center text-xs font-medium py-2.5 rounded-xl transition-colors ${dm ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            >
                                إغلاق والعودة للمتجر ←
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

                            {/* Payment method */}
                            <fieldset className="space-y-2.5">
                                <legend className={`block text-sm font-semibold mb-1.5 ${dm ? 'text-slate-300' : 'text-slate-700'}`}>
                                    طريقة الدفع <span className="text-red-500">*</span>
                                </legend>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setPaymentMethod('cash_on_delivery'); setErrorMessage(''); }}
                                        className={`p-3 rounded-xl border text-right transition-all
                                            ${paymentMethod === 'cash_on_delivery'
                                                ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                                : dm ? 'border-gray-700 bg-gray-900 hover:border-gray-600' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                                    >
                                        <Banknote size={20} className={paymentMethod === 'cash_on_delivery' ? 'text-primary' : 'text-slate-400'} />
                                        <p className={`text-xs font-bold mt-2 ${dm ? 'text-white' : 'text-slate-800'}`}>عند الاستلام</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">ادفع عند وصول الطلب</p>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={!bankTransferConfigured}
                                        onClick={() => { setPaymentMethod('bank_transfer'); setErrorMessage(''); }}
                                        className={`p-3 rounded-xl border text-right transition-all
                                            ${paymentMethod === 'bank_transfer'
                                                ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                                                : dm ? 'border-gray-700 bg-gray-900 hover:border-gray-600' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}
                                            ${!bankTransferConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <Landmark size={20} className={paymentMethod === 'bank_transfer' ? 'text-emerald-500' : 'text-slate-400'} />
                                        <p className={`text-xs font-bold mt-2 ${dm ? 'text-white' : 'text-slate-800'}`}>تحويل بنكي</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            {bankTransferConfigured ? 'أرفق إثبات التحويل' : 'يحتاج إعداد بيانات البنك'}
                                        </p>
                                    </button>
                                </div>
                            </fieldset>

                            {paymentMethod === 'bank_transfer' && bankTransferConfigured && (
                                <div className={`rounded-xl border p-3.5 space-y-3 ${dm ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/70'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className={`text-xs font-bold ${dm ? 'text-emerald-300' : 'text-emerald-800'}`}>{bankDetails.bankName}</p>
                                            <p className={`text-[11px] mt-1 ${dm ? 'text-gray-300' : 'text-slate-600'}`}>{bankDetails.accountHolder}</p>
                                            <p dir="ltr" className={`font-mono text-[11px] mt-1 text-left ${dm ? 'text-gray-300' : 'text-slate-700'}`}>RIB: {bankDetails.rib}</p>
                                            {bankDetails.iban && (
                                                <p dir="ltr" className={`font-mono text-[10px] mt-0.5 text-left break-all ${dm ? 'text-gray-400' : 'text-slate-500'}`}>IBAN: {bankDetails.iban}</p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={copyBankDetails}
                                            className={`shrink-0 p-2 rounded-lg transition-colors ${dm ? 'bg-gray-800 text-gray-300' : 'bg-white text-slate-500 shadow-sm'}`}
                                            title="نسخ بيانات الحساب"
                                        >
                                            {bankDetailsCopied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                                        </button>
                                    </div>

                                    <div>
                                        <label className={`block text-xs font-semibold mb-1.5 ${dm ? 'text-gray-300' : 'text-slate-700'}`}>
                                            مرجع التحويل <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={transferReference}
                                            onChange={(event) => setTransferReference(event.target.value)}
                                            placeholder="مثال: TRX-123456"
                                            dir="ltr"
                                            className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${dm ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-emerald-200 text-slate-900'}`}
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <label className={`block rounded-xl border-2 border-dashed p-3 cursor-pointer transition-colors text-center
                                        ${transferProof
                                            ? 'border-emerald-500 bg-emerald-500/10'
                                            : dm ? 'border-gray-600 hover:border-emerald-500' : 'border-emerald-200 hover:border-emerald-400 bg-white'}`}
                                    >
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,application/pdf"
                                            onChange={handleProofChange}
                                            className="hidden"
                                            disabled={isSubmitting}
                                        />
                                        {transferProof ? (
                                            <span className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-600">
                                                <FileCheck2 size={18} />
                                                <span className="truncate max-w-[240px]">{transferProof.name}</span>
                                            </span>
                                        ) : (
                                            <span className={`flex flex-col items-center gap-1.5 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                                <UploadCloud size={21} />
                                                <span className="text-xs font-semibold">ارفع إثبات التحويل</span>
                                                <span className="text-[9px]">JPG, PNG, WEBP أو PDF — حتى 10 MB</span>
                                            </span>
                                        )}
                                    </label>
                                </div>
                            )}

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
                </Motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CheckoutModal;
