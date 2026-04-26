import React from 'react';
import useStore from '../store/useStore';
import { X, Mail, Phone } from 'lucide-react';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup } from 'firebase/auth';

const AuthModal = () => {
    const { isAuthModalOpen, setAuthModalOpen, darkMode } = useStore();

    if (!isAuthModalOpen) return null;

    const handleGoogleSignIn = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            setAuthModalOpen(false);
        } catch (error) {
            console.error("Error signing in with Google", error);
            alert("حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
            <div 
                className={`relative w-full max-w-md p-8 rounded-3xl shadow-2xl overflow-hidden
                ${darkMode ? 'bg-gray-900 border border-gray-700 text-white' : 'bg-white text-slate-800'}`}
                style={{ direction: 'rtl' }}
            >
                {/* Close button */}
                <button 
                    onClick={() => setAuthModalOpen(false)}
                    className={`absolute top-4 left-4 p-2 rounded-full transition-colors 
                    ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-slate-100 text-slate-400'}`}
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-8 mt-2">
                    <h2 className="text-2xl font-bold mb-2">مرحباً بك في IMDEN</h2>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        سجل دخولك لتتبع طلباتك وحفظ معلوماتك للمرات القادمة
                    </p>
                </div>

                <div className="flex flex-col gap-4">
                    <button 
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-xl hover:bg-gray-50 hover:text-slate-800 transition-colors bg-white text-slate-700 font-semibold shadow-sm"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                        المتابعة باستخدام Google
                    </button>

                    {/* Placeholder for Email/Phone options later if needed */}
                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className={`w-full border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className={`px-2 ${darkMode ? 'bg-gray-900 text-gray-500' : 'bg-white text-gray-500'}`}>أو</span>
                        </div>
                    </div>

                    <button 
                        onClick={() => alert('قريباً...')}
                        className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border transition-colors font-medium
                        ${darkMode ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                    >
                        <Phone size={18} />
                        التسجيل برقم الهاتف
                    </button>

                    <button 
                        onClick={() => alert('قريباً...')}
                        className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border transition-colors font-medium
                        ${darkMode ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                    >
                        <Mail size={18} />
                        التسجيل بالبريد الإلكتروني
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
