import React, { useEffect, useState } from 'react';
import { Download, X, MonitorSmartphone } from 'lucide-react';
import useStore from '../store/useStore';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.imden.store';
const INTERNAL_TEST_URL = 'https://play.google.com/apps/internaltest/4700737002005896985';

const InstallAppBanner = () => {
  const { darkMode } = useStore();
  const dm = darkMode;
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('install_banner_dismissed');
    if (dismissed) return;

    const ua = navigator.userAgent || '';
    const android = /Android/i.test(ua);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsAndroid(android);

    const onBip = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!standalone) setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    if (android && !standalone) {
      const t = setTimeout(() => setShow(true), 8000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBip);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('install_banner_dismissed', 'true');
  };

  const installPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-3 right-3 z-[190] flex justify-center pointer-events-none">
      <div
        className={`pointer-events-auto max-w-md w-full rounded-2xl border shadow-xl px-4 py-3 flex items-center gap-3 ${
          dm ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${dm ? 'bg-blue-500/20 text-blue-300' : 'bg-[#142038]/10 text-[#142038]'}`}>
          <MonitorSmartphone size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">ثبّت Errayhany Store</p>
          <p className={`text-[11px] ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
            {isAndroid ? 'من Google Play أو كتطبيق على الشاشة الرئيسية' : 'ثبّته كتطبيق سطح مكتب سريع'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {deferredPrompt ? (
            <button
              type="button"
              onClick={installPwa}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#142038] text-white hover:opacity-90"
            >
              تثبيت
            </button>
          ) : isAndroid ? (
            <a
              href={PLAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 inline-flex items-center gap-1"
            >
              <Download size={14} />
              Play
            </a>
          ) : (
            <a
              href={INTERNAL_TEST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#142038] text-white"
            >
              تطبيق
            </a>
          )}
          <button type="button" onClick={dismiss} className={`p-1.5 rounded-full ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-slate-100 text-slate-400'}`} aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallAppBanner;
