import React, { useEffect, useState } from 'react';
import {
    Package, Clock, Truck, XCircle, ArrowRight, Loader2, Phone,
    ShoppingBag, CheckCircle, ShieldCheck, RotateCcw, MapPin,
} from 'lucide-react';
import useStore from '../store/useStore';
import {
    sendTrackingCode,
    confirmCodeAndFetchOrders,
    clearRecaptcha,
} from '../services/orderTracking';
import { formatMoroccanPhone } from '../services/customerAccount';

const RECAPTCHA_ID = 'tracking-recaptcha';

const statusStyles = {
    pending: { icon: Clock, border: 'border-yellow-500/30', bg: 'from-yellow-500/20 to-amber-500/20', text: 'text-yellow-500' },
    confirmed: { icon: ShieldCheck, border: 'border-indigo-500/30', bg: 'from-indigo-500/20 to-violet-500/20', text: 'text-indigo-500' },
    shipped: { icon: Truck, border: 'border-green-500/30', bg: 'from-green-500/20 to-emerald-500/20', text: 'text-green-500' },
    delivered: { icon: CheckCircle, border: 'border-blue-500/30', bg: 'from-blue-500/20 to-cyan-500/20', text: 'text-blue-500' },
    cancelled: { icon: XCircle, border: 'border-red-500/30', bg: 'from-red-500/20 to-rose-500/20', text: 'text-red-500' },
    returned: { icon: RotateCcw, border: 'border-orange-500/30', bg: 'from-orange-500/20 to-amber-500/20', text: 'text-orange-500' },
};

const steps = [
    { label: 'تم الاستلام', icon: ShoppingBag, step: 1 },
    { label: 'تم التأكيد', icon: ShieldCheck, step: 2 },
    { label: 'تم الشحن', icon: Truck, step: 3 },
    { label: 'تم التوصيل', icon: CheckCircle, step: 4 },
];

const OrderTracking = () => {
    const { darkMode } = useStore();
    const dm = darkMode;

    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [confirmation, setConfirmation] = useState(null);
    const [verifiedPhone, setVerifiedPhone] = useState('');
    const [orders, setOrders] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => () => clearRecaptcha(RECAPTCHA_ID), []);

    const handleSendCode = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            const result = await sendTrackingCode(phone, RECAPTCHA_ID);
            setPhone(formatMoroccanPhone(result.phone));
            setConfirmation(result.confirmation);
        } catch (err) {
            console.error('Tracking code error:', err);
            clearRecaptcha(RECAPTCHA_ID);
            if (err?.code === 'auth/too-many-requests') {
                setError('تم تجاوز عدد المحاولات. حاول لاحقاً.');
            } else if (err?.code === 'auth/unauthorized-domain') {
                setError('هذا الدومين غير مضاف في إعدادات Firebase.');
            } else {
                setError(err?.message || 'تعذر إرسال رمز SMS. تأكد من الرقم.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (event) => {
        event.preventDefault();
        if (code.trim().length < 6) {
            setError('أدخل رمز التحقق المكوّن من 6 أرقام.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const result = await confirmCodeAndFetchOrders(confirmation, code, RECAPTCHA_ID);
            setVerifiedPhone(formatMoroccanPhone(result.phone) || phone);
            setOrders(result.orders);
            setConfirmation(null);
            setCode('');
        } catch (err) {
            console.error('Tracking verify error:', err);
            if (err?.code === 'auth/invalid-verification-code' || err?.code === 'auth/code-expired') {
                setError('رمز التحقق غير صحيح أو انتهت صلاحيته.');
            } else {
                setError(err?.message || 'تعذّر جلب الطلبات. حاول مرة أخرى.');
            }
        } finally {
            setLoading(false);
        }
    };

    const resetFlow = () => {
        setOrders(null);
        setConfirmation(null);
        setVerifiedPhone('');
        setCode('');
        setError('');
        clearRecaptcha(RECAPTCHA_ID);
    };

    const formatDate = (value) => {
        if (!value) return '—';
        return new Date(value).toLocaleDateString('ar-MA', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <div className={`min-h-screen ${dm ? 'bg-gray-950 text-white' : 'bg-gradient-to-br from-slate-50 to-blue-50 text-slate-900'}`}>
            <header className={`border-b backdrop-blur-xl sticky top-0 z-10 ${dm ? 'bg-gray-950/90 border-gray-800' : 'bg-white/80 border-slate-200'}`}>
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Package size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-extrabold tracking-tight">Errayhany Store</h1>
                            <p className={`text-[10px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>تتبع طلبك</p>
                        </div>
                    </div>
                    <button onClick={() => { window.location.href = '/'; }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${dm ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                        <ArrowRight size={14} />
                        العودة للمتجر
                    </button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
                {!orders && (
                    <div className="text-center space-y-3 mb-8">
                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2 ${dm ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                            <Truck size={32} className="text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold">تتبع طلبك</h2>
                        <p className={`text-sm max-w-md mx-auto ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                            {confirmation
                                ? `أدخل الرمز الذي أرسلناه إلى ${phone}`
                                : 'أدخل رقم هاتفك، سنرسل لك رمز SMS لعرض طلباتك أنت فقط.'}
                        </p>
                    </div>
                )}

                <div id={RECAPTCHA_ID} />

                {error && (
                    <div className={`p-4 rounded-xl border text-center text-sm ${dm ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
                        {error}
                    </div>
                )}

                {!orders && !confirmation && (
                    <form onSubmit={handleSendCode} className={`rounded-2xl border p-4 shadow-lg space-y-3 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className="relative">
                            <Phone size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 ${dm ? 'text-gray-500' : 'text-slate-400'}`} />
                            <input
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="06 XX XX XX XX"
                                className={`w-full pr-10 pl-4 py-3 rounded-xl border outline-none text-sm font-medium transition-colors ${dm ? 'bg-gray-800 border-gray-700 focus:border-blue-500 placeholder-gray-600' : 'bg-slate-50 border-slate-200 focus:border-blue-500 placeholder-slate-400'}`}
                            />
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                            إرسال رمز التحقق
                        </button>
                        <p className={`text-[11px] text-center ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                            التحقق يضمن أن طلباتك لا يراها أحد غيرك.
                        </p>
                    </form>
                )}

                {!orders && confirmation && (
                    <form onSubmit={handleVerify} className={`rounded-2xl border p-4 shadow-lg space-y-3 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`} dir="ltr">
                        <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            className={`w-full px-4 py-3 text-center text-xl tracking-[0.35em] rounded-xl border outline-none ${dm ? 'bg-gray-800 border-gray-700 focus:border-blue-500' : 'bg-slate-50 border-slate-200 focus:border-blue-500'}`}
                        />
                        <button type="submit" disabled={loading}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2">
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            عرض طلباتي
                        </button>
                        <button type="button" onClick={resetFlow}
                            className={`w-full text-xs py-2 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                            تغيير الرقم
                        </button>
                    </form>
                )}

                {orders && (
                    <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-2 text-sm">
                            <ShieldCheck size={16} className="text-green-500" />
                            <span className="font-bold">{verifiedPhone}</span>
                            <span className={dm ? 'text-gray-500' : 'text-slate-400'}>
                                • {orders.length} طلب
                            </span>
                        </div>
                        <button onClick={resetFlow}
                            className={`text-xs font-semibold ${dm ? 'text-blue-400' : 'text-blue-600'}`}>
                            رقم آخر
                        </button>
                    </div>
                )}

                {orders && orders.length === 0 && (
                    <div className={`p-6 rounded-2xl border text-center text-sm ${dm ? 'bg-gray-900 border-gray-800 text-gray-400' : 'bg-white border-slate-200 text-slate-500'}`}>
                        لا توجد طلبات مرتبطة بهذا الرقم.
                    </div>
                )}

                {orders && orders.map((order) => {
                    const style = statusStyles[order.status] || statusStyles.pending;
                    const StatusIcon = style.icon;
                    const isStopped = order.step === 0;

                    return (
                        <div key={order.id} className={`rounded-2xl border overflow-hidden shadow-lg ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                            <div className={`p-4 border-b ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold truncate">{order.reference}</p>
                                        <p className={`text-[10px] mt-1 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                            {formatDate(order.createdAt)}
                                        </p>
                                    </div>
                                    <div className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${style.border} bg-gradient-to-r ${style.bg} ${style.text}`}>
                                        <StatusIcon size={12} />
                                        {order.statusLabel}
                                    </div>
                                </div>
                            </div>

                            {!isStopped ? (
                                <div className="px-6 py-5">
                                    <div className="flex items-center justify-between relative">
                                        <div className={`absolute top-5 right-5 left-5 h-0.5 ${dm ? 'bg-gray-800' : 'bg-slate-200'}`} />
                                        <div className="absolute top-5 right-5 h-0.5 bg-blue-500 transition-all duration-500"
                                            style={{ width: `${Math.max(0, Math.min(3, order.step - 1)) * 33.33}%` }} />

                                        {steps.map((step) => {
                                            const StepIcon = step.icon;
                                            const isActive = order.step >= step.step;
                                            const isCurrent = order.step === step.step;
                                            return (
                                                <div key={step.step} className="relative z-10 flex flex-col items-center gap-2">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                                        ${isCurrent ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-110'
                                                            : isActive ? 'bg-blue-500 border-blue-500 text-white'
                                                            : dm ? 'bg-gray-800 border-gray-700 text-gray-600' : 'bg-slate-100 border-slate-300 text-slate-400'}`}>
                                                        <StepIcon size={16} />
                                                    </div>
                                                    <span className={`text-[10px] font-bold ${isActive ? 'text-blue-500' : dm ? 'text-gray-600' : 'text-slate-400'}`}>
                                                        {step.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="px-6 py-4 text-center">
                                    <p className={`text-sm font-bold ${style.text}`}>{order.statusLabel}</p>
                                </div>
                            )}

                            {(order.trackingNumber || order.shippingCompany || order.city) && (
                                <div className={`px-4 py-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] ${dm ? 'border-gray-800 text-gray-400' : 'border-slate-100 text-slate-500'}`}>
                                    {order.shippingCompany && (
                                        <span className="flex items-center gap-1">
                                            <Truck size={12} /> {order.shippingCompany}
                                        </span>
                                    )}
                                    {order.city && (
                                        <span className="flex items-center gap-1">
                                            <MapPin size={12} /> {order.city}
                                        </span>
                                    )}
                                    {order.trackingNumber && (
                                        <span className="font-mono" dir="ltr">{order.trackingNumber}</span>
                                    )}
                                </div>
                            )}

                            {order.products.length > 0 && (
                                <div className={`px-4 py-3 border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                    <p className={`text-[10px] font-bold mb-2 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>المنتجات</p>
                                    <div className="space-y-2">
                                        {order.products.map((item, idx) => (
                                            <div key={idx} className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${dm ? 'bg-gray-800/50' : 'bg-slate-50'}`}>
                                                <span className="text-xs font-medium truncate flex-1">{item.name}</span>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className={dm ? 'text-gray-500' : 'text-slate-400'}>×{item.quantity}</span>
                                                    <span className="font-bold text-green-500">
                                                        {item.totalPrice || item.unitPrice * item.quantity} DH
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className={`px-4 py-3 border-t flex items-center justify-between ${dm ? 'border-gray-800 bg-gray-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
                                <span className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>المجموع</span>
                                <span className="text-lg font-extrabold text-green-500">{order.total} DH</span>
                            </div>
                        </div>
                    );
                })}

                <div className={`text-center text-xs py-6 ${dm ? 'text-gray-600' : 'text-slate-400'}`}>
                    <p>هل لديك سؤال حول طلبك؟</p>
                    <a href="https://wa.me/212664630566" target="_blank" rel="noopener noreferrer"
                        className="text-green-500 font-bold hover:underline mt-1 inline-block">
                        تواصل معنا عبر واتساب
                    </a>
                </div>
            </main>
        </div>
    );
};

export default OrderTracking;
