import React, { useState, useEffect } from 'react';
import { X, Share, Plus } from 'lucide-react';
import useStore from '../store/useStore';

const IOSInstallPrompt = () => {
    const { darkMode } = useStore();
    const dm = darkMode;
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Detect iOS Safari (not in standalone mode = not already installed as PWA)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.navigator.standalone === true;
        const alreadyDismissed = localStorage.getItem('ios_pwa_dismissed');
        
        if (isIOS && !isStandalone && !alreadyDismissed) {
            // Show after 5 seconds
            const timer = setTimeout(() => setShow(true), 5000);
            return () => clearTimeout(timer);
        }
    }, []);

    const dismiss = () => {
        setShow(false);
        localStorage.setItem('ios_pwa_dismissed', 'true');
    };

    if (!show) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[200] p-4" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <div className={`rounded-2xl shadow-2xl border overflow-hidden max-w-md mx-auto ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'}`}>
                {/* Header */}
                <div className={`px-4 py-3 border-b flex items-center justify-between ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                        <img
                            src={dm ? '/logo-dark.png' : '/logo.png'}
                            alt="Errayhany Store"
                            className="w-8 h-8 rounded-lg object-cover shadow-sm"
                        />
                        <div>
                            <p className="text-sm font-bold">تثبيت تطبيق Errayhany Store</p>
                            <p className={`text-[10px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>أضف التطبيق لشاشتك الرئيسية</p>
                        </div>
                    </div>
                    <button onClick={dismiss} className={`p-1.5 rounded-full ${dm ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-slate-100 text-slate-400'}`}>
                        <X size={16} />
                    </button>
                </div>

                {/* Steps */}
                <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${dm ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>1</div>
                        <div>
                            <p className="text-xs font-bold">اضغط على زر المشاركة</p>
                            <p className={`text-[10px] mt-0.5 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                اضغط على أيقونة <span className="inline-flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 mx-0.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg></span> أسفل المتصفح
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${dm ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>2</div>
                        <div>
                            <p className="text-xs font-bold">اختر "إضافة إلى الشاشة الرئيسية"</p>
                            <p className={`text-[10px] mt-0.5 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                مرر للأسفل واضغط على <span className="font-bold">Add to Home Screen</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${dm ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-600'}`}>✓</div>
                        <div>
                            <p className="text-xs font-bold">جاهز!</p>
                            <p className={`text-[10px] mt-0.5 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                سيظهر التطبيق على شاشة هاتفك مثل أي تطبيق عادي
                            </p>
                        </div>
                    </div>
                </div>

                {/* Dismiss */}
                <div className={`px-4 py-3 border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                    <button onClick={dismiss} className={`w-full text-center text-xs font-medium py-2 rounded-xl transition-colors ${dm ? 'text-gray-500 hover:bg-gray-800' : 'text-slate-400 hover:bg-slate-50'}`}>
                        ليس الآن
                    </button>
                </div>
            </div>
            
            {/* Arrow pointing down to Safari toolbar */}
            <div className="flex justify-center mt-2">
                <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-blue-500" style={{filter: 'drop-shadow(0 2px 4px rgba(59,130,246,0.3))'}}></div>
            </div>
        </div>
    );
};

export default IOSInstallPrompt;
