import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Phone } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { phoneVerificationAuth } from '../services/firebase';
import {
    formatMoroccanPhone,
    normalizeMoroccanPhone,
    upsertCustomerProfile,
} from '../services/customerAccount';

const RECAPTCHA_ID = 'account-phone-recaptcha';

const PhoneVerificationCard = ({ user, darkMode, onVerified }) => {
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [confirmation, setConfirmation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const cleanupRecaptcha = () => {
        try {
            window.accountRecaptchaVerifier?.clear();
        } catch {
            // Firebase may already have released the widget.
        }
        window.accountRecaptchaVerifier = null;
        const container = document.getElementById(RECAPTCHA_ID);
        if (container) container.innerHTML = '';
    };

    useEffect(() => () => cleanupRecaptcha(), []);

    const sendCode = async event => {
        event.preventDefault();
        const normalized = normalizeMoroccanPhone(phone);
        if (!normalized) {
            setError('أدخل رقم هاتف مغربي صحيح يبدأ بـ 06 أو 07.');
            return;
        }

        setLoading(true);
        setError('');
        cleanupRecaptcha();

        try {
            window.accountRecaptchaVerifier = new RecaptchaVerifier(
                phoneVerificationAuth,
                RECAPTCHA_ID,
                { size: 'invisible' }
            );
            const result = await signInWithPhoneNumber(
                phoneVerificationAuth,
                normalized,
                window.accountRecaptchaVerifier
            );
            setPhone(formatMoroccanPhone(normalized));
            setConfirmation(result);
        } catch (err) {
            console.error('Account phone verification error:', err);
            cleanupRecaptcha();
            if (err.code === 'auth/too-many-requests') {
                setError('تم تجاوز عدد المحاولات. حاول لاحقاً.');
            } else if (err.code === 'auth/unauthorized-domain') {
                setError('الدومين الجديد غير مضاف إلى Authorized Domains في Firebase.');
            } else {
                setError('تعذر إرسال رمز SMS. تأكد من الرقم وحاول مرة أخرى.');
            }
        } finally {
            setLoading(false);
        }
    };

    const verifyCode = async event => {
        event.preventDefault();
        if (!confirmation || code.trim().length < 6) {
            setError('أدخل رمز التحقق المكوّن من 6 أرقام.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const credential = await confirmation.confirm(code.trim());
            const verifiedPhone = normalizeMoroccanPhone(
                credential.user.phoneNumber
            );
            const profile = await upsertCustomerProfile(user, {
                phone: formatMoroccanPhone(verifiedPhone),
                normalizedPhone: verifiedPhone,
                phoneVerified: true,
            });
            await phoneVerificationAuth.signOut();
            cleanupRecaptcha();
            await onVerified?.(profile || {
                uid: user.uid,
                name: user.displayName || '',
                email: user.email || '',
                phone: formatMoroccanPhone(verifiedPhone),
                normalizedPhone: verifiedPhone,
                phoneVerified: true,
            });
        } catch (err) {
            console.error('Account phone code error:', err);
            setError('رمز التحقق غير صحيح أو انتهت صلاحيته.');
        } finally {
            setLoading(false);
        }
    };

    const dm = darkMode;

    return (
        <div className={`max-w-sm mx-auto px-4 py-2 ${dm ? 'text-white' : 'text-slate-900'}`}>
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${dm ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                {confirmation
                    ? <CheckCircle2 size={32} className="text-green-500" />
                    : <Phone size={32} className="text-blue-500" />}
            </div>
            <h3 className="text-base font-bold mb-2">
                {confirmation ? 'تأكيد رقم الهاتف' : 'اربط طلباتك السابقة'}
            </h3>
            <p className={`text-xs mb-5 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                {confirmation
                    ? `أرسلنا رمزاً إلى ${phone}`
                    : 'أدخل الرقم الذي استعملته في طلباتك. سنرسِل رمز SMS لحماية سجل طلباتك.'}
            </p>

            {error && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                </div>
            )}

            <div id={RECAPTCHA_ID} />

            {!confirmation ? (
                <form onSubmit={sendCode} className="space-y-3" dir="ltr">
                    <input
                        type="tel"
                        value={phone}
                        onChange={event => setPhone(event.target.value)}
                        placeholder="06 XX XX XX XX"
                        autoComplete="tel"
                        className={`w-full px-4 py-3 text-center rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${dm ? 'bg-gray-800 border-gray-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        إرسال رمز SMS
                    </button>
                </form>
            ) : (
                <form onSubmit={verifyCode} className="space-y-3" dir="ltr">
                    <input
                        type="text"
                        inputMode="numeric"
                        value={code}
                        onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        autoComplete="one-time-code"
                        className={`w-full px-4 py-3 text-center text-xl tracking-[0.35em] rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${dm ? 'bg-gray-800 border-gray-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        تأكيد وربط الطلبات
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setConfirmation(null);
                            setCode('');
                            cleanupRecaptcha();
                        }}
                        className={`w-full text-xs py-2 ${dm ? 'text-gray-400' : 'text-slate-500'}`}
                    >
                        تعديل الرقم
                    </button>
                </form>
            )}
        </div>
    );
};

export default PhoneVerificationCard;

