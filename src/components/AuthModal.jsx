import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { X, Mail, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { auth, googleProvider } from '../services/firebase';
import { 
    signInWithPopup, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    RecaptchaVerifier, 
    signInWithPhoneNumber 
} from 'firebase/auth';

const AuthModal = () => {
    const { isAuthModalOpen, setAuthModalOpen, darkMode } = useStore();
    
    const [view, setView] = useState('main'); // 'main', 'email', 'phone'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [phoneNumber, setPhoneNumber] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);

    // FIX: cleanupRecaptcha must be hoisted above the early return to avoid TDZ errors!
    const cleanupRecaptcha = () => {
        try {
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.clear();
                window.recaptchaVerifier = null;
            }
        } catch (e) {
            window.recaptchaVerifier = null;
        }
        const container = document.getElementById('recaptcha-container');
        if (container) container.innerHTML = '';
    };

    useEffect(() => {
        if (isAuthModalOpen) {
            setView('main');
            setError('');
            setLoading(false);
            setEmail('');
            setPassword('');
            setPhoneNumber('');
            setOtpCode('');
            setConfirmationResult(null);
            cleanupRecaptcha();
        }
        return () => cleanupRecaptcha();
    }, [isAuthModalOpen]);

    if (!isAuthModalOpen) return null;

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithPopup(auth, googleProvider);
            setAuthModalOpen(false);
        } catch (err) {
            console.error(err);
            if (err.code !== 'auth/popup-closed-by-user') {
                setError('حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (isRegister) => {
        if (!email || !password) {
            setError('المرجو إدخال البريد وكلمة المرور');
            return;
        }
        setLoading(true);
        setError('');
        try {
            if (isRegister) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            setAuthModalOpen(false);
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') setError('هذا البريد مسجل مسبقاً، قم بتسجيل الدخول.');
            else if (err.code === 'auth/invalid-credential') setError('البريد أو كلمة المرور غير صحيحة.');
            else if (err.code === 'auth/weak-password') setError('كلمة المرور ضعيفة (6 أحرف على الأقل).');
            else setError('حدث خطأ، يرجى المحاولة مجدداً.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendOTP = async () => {
        if (!phoneNumber) {
            setError('المرجو إدخال رقم الهاتف');
            return;
        }

        let formattedPhone = phoneNumber.replace(/\s/g, '');
        if (formattedPhone.startsWith('06') || formattedPhone.startsWith('07')) {
            formattedPhone = '+212' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone;
        }

        setLoading(true);
        setError('');
        try {
            cleanupRecaptcha();
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
                callback: () => {},
                'expired-callback': () => {
                    cleanupRecaptcha();
                }
            });
            const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
            setConfirmationResult(confirmation);
        } catch (err) {
            console.error("Phone Auth Error:", err);
            cleanupRecaptcha();
            if (err.code === 'auth/unauthorized-domain') setError('يجب إضافة رابط الموقع إلى Authorized Domains في Firebase');
            else if (err.code === 'auth/invalid-phone-number') setError('رقم الهاتف غير صالح.');
            else if (err.code === 'auth/too-many-requests') setError('كثرة المحاولات. يرجى المحاولة بعد قليل.');
            else setError('حدث خطأ، يرجى المحاولة مجدداً.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otpCode || !confirmationResult) return;
        setLoading(true);
        setError('');
        try {
            await confirmationResult.confirm(otpCode);
            setAuthModalOpen(false);
        } catch (err) {
            console.error(err);
            setError('الكود غير صحيح، يرجى المحاولة مرة أخرى.');
        } finally {
            setLoading(false);
        }
    };

    // --- UI Renderers ---

    const renderMainView = () => (
        <div className="flex flex-col gap-4">
            <button 
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors bg-white text-slate-700 font-semibold shadow-sm"
            >
                {loading ? <Loader2 className="animate-spin" /> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />}
                المتابعة باستخدام Google
            </button>

            <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                    <div className={`w-full border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className={`px-2 ${darkMode ? 'bg-gray-900 text-gray-500' : 'bg-white text-gray-500'}`}>أو استخدام طرق أخرى</span>
                </div>
            </div>

            <button 
                onClick={() => setView('phone')}
                disabled={loading}
                className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border transition-colors font-medium
                ${darkMode ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
            >
                <Phone size={18} />
                المتابعة برقم الهاتف (SMS)
            </button>

            <button 
                onClick={() => setView('email')}
                disabled={loading}
                className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border transition-colors font-medium
                ${darkMode ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
            >
                <Mail size={18} />
                المتابعة بالبريد الإلكتروني
            </button>
        </div>
    );

    const renderEmailView = () => (
        <div className="flex flex-col gap-4">
            <input 
                type="email" 
                placeholder="البريد الإلكتروني" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={`w-full p-3 rounded-xl border text-right focus:ring-2 focus:ring-primary focus:border-primary outline-none
                ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-slate-50 border-slate-200'}`}
            />
            <input 
                type="password" 
                placeholder="كلمة المرور" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={`w-full p-3 rounded-xl border text-right focus:ring-2 focus:ring-primary focus:border-primary outline-none
                ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-slate-50 border-slate-200'}`}
            />
            
            <div className="flex gap-2 mt-2">
                <button 
                    onClick={() => handleEmailAuth(false)}
                    disabled={loading}
                    className="flex-1 bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-dark transition flex justify-center"
                >
                    {loading ? <Loader2 className="animate-spin" /> : "تسجيل الدخول"}
                </button>
                <button 
                    onClick={() => handleEmailAuth(true)}
                    disabled={loading}
                    className={`flex-1 py-3 rounded-xl font-bold transition flex justify-center border
                    ${darkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                >
                    {loading ? <Loader2 className="animate-spin" /> : "إنشاء حساب"}
                </button>
            </div>
        </div>
    );

    const renderPhoneView = () => (
        <div className="flex flex-col gap-4">
            {!confirmationResult ? (
                <>
                    <input 
                        type="tel" 
                        placeholder="رقم الهاتف (مثال: 0612345678)" 
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        className={`w-full p-3 rounded-xl border text-right focus:ring-2 focus:ring-primary focus:border-primary outline-none text-left
                        ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                        dir="ltr"
                    />
                    <div id="recaptcha-container"></div>
                    <button 
                        onClick={handleSendOTP}
                        disabled={loading}
                        className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-dark transition flex justify-center mt-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "إرسال رمز التحقق (SMS)"}
                    </button>
                </>
            ) : (
                <>
                    <p className={`text-sm text-center ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                        أدخل الرمز المكون من 6 أرقام المرسل إلى {phoneNumber}
                    </p>
                    <input 
                        type="text" 
                        placeholder="رمز التحقق (123456)" 
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value)}
                        className={`w-full p-3 rounded-xl border text-center text-xl tracking-widest focus:ring-2 focus:ring-primary focus:border-primary outline-none
                        ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                        dir="ltr"
                        maxLength={6}
                    />
                    <button 
                        onClick={handleVerifyOTP}
                        disabled={loading}
                        className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-dark transition flex justify-center mt-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "تأكيد وتسجيل الدخول"}
                    </button>
                    <button 
                        onClick={() => setConfirmationResult(null)}
                        className={`w-full py-2 text-sm underline ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}
                    >
                        تعديل رقم الهاتف
                    </button>
                </>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
            <div 
                className={`relative w-full max-w-md p-8 rounded-3xl shadow-2xl overflow-hidden
                ${darkMode ? 'bg-gray-900 border border-gray-700 text-white' : 'bg-white text-slate-800'}`}
                style={{ direction: 'rtl' }}
            >
                {/* Back / Close button */}
                <button 
                    onClick={() => view === 'main' ? setAuthModalOpen(false) : setView('main')}
                    className={`absolute top-4 left-4 p-2 rounded-full transition-colors flex items-center justify-center
                    ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-slate-100 text-slate-400'}`}
                >
                    {view === 'main' ? <X size={20} /> : <ArrowRight size={20} />}
                </button>

                <div className="text-center mb-6 mt-2">
                    <h2 className="text-2xl font-bold mb-2">
                        {view === 'main' ? 'مرحباً بك في IMDEN' : view === 'email' ? 'البريد الإلكتروني' : 'رقم الهاتف'}
                    </h2>
                    {view === 'main' && (
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                            سجل دخولك لتتبع طلباتك وحفظ معلوماتك للمرات القادمة
                        </p>
                    )}
                </div>

                {error && (
                    <div className="bg-red-100 text-red-700 text-sm p-3 rounded-xl mb-4 text-center border border-red-200">
                        {error}
                    </div>
                )}

                {view === 'main' && renderMainView()}
                {view === 'email' && renderEmailView()}
                {view === 'phone' && renderPhoneView()}

            </div>
        </div>
    );
};

export default AuthModal;
