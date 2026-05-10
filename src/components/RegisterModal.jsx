import React, { useState } from 'react';
import { X, UserPlus, CheckCircle2, Loader2 } from 'lucide-react';
import useStore from '../store/useStore';

const NOCODB_URL = import.meta.env.VITE_NOCODB_URL;
const NOCODB_TOKEN = import.meta.env.VITE_NOCODB_API_TOKEN;
// Customer accounts table — create one in NocoDB or fallback to localStorage only
const CUSTOMERS_TABLE = import.meta.env.VITE_NOCODB_TABLE_CUSTOMERS || null;

const RegisterModal = ({ isOpen, onClose }) => {
    const darkMode = useStore(s => s.darkMode);
    const dm = darkMode;

    const [form, setForm] = useState({ name: '', phone: '', city: '' });
    const [status, setStatus] = useState('idle'); // idle | loading | success | error

    if (!isOpen) return null;

    const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.phone.trim()) return;
        setStatus('loading');

        try {
            // 1. Save locally always
            const saved = JSON.parse(localStorage.getItem('customer') || '{}');
            const customer = { ...saved, ...form, createdAt: new Date().toISOString() };
            localStorage.setItem('customer', JSON.stringify(customer));

            // 2. Optionally push to NocoDB if table env is set
            if (CUSTOMERS_TABLE) {
                await fetch(`${NOCODB_URL}/api/v2/tables/${CUSTOMERS_TABLE}/records`, {
                    method: 'POST',
                    headers: {
                        'xc-token': NOCODB_TOKEN,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        Name: form.name,
                        Phone: form.phone,
                        City: form.city,
                    }),
                });
            }

            setStatus('success');
        } catch {
            // Save locally even if NocoDB fails
            setStatus('success');
        }
    };

    const alreadySaved = !!localStorage.getItem('customer');

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div
                className={`relative rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden
                    ${dm ? 'bg-gray-800 text-white' : 'bg-white text-slate-900'}`}
               
            >
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={20} />
                </button>

                {status === 'success' ? (
                    /* ── Success State ── */
                    <div className="flex flex-col items-center gap-4 p-8 text-center">
                        <CheckCircle2 size={56} className="text-green-500" />
                        <h3 className="text-xl font-bold">تم التسجيل بنجاح! 🎉</h3>
                        <p className={`text-sm ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                            سنتواصل معك على <span className="font-semibold text-primary">{form.phone}</span> لتأكيد طلباتك القادمة.
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-2 w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold transition-colors"
                        >
                            حسناً
                        </button>
                    </div>
                ) : (
                    /* ── Form State ── */
                    <>
                        {/* Header banner */}
                        <div className="bg-gradient-to-l from-primary to-blue-700 px-6 py-5 text-white">
                            <div className="flex items-center gap-3">
                                <UserPlus size={26} />
                                <div>
                                    <h3 className="text-lg font-bold">أنشئ حسابك مجاناً</h3>
                                    <p className="text-sm text-blue-100">تابع طلباتك واستفد من العروض الحصرية</p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className={`block text-sm font-medium mb-1.5 ${dm ? 'text-gray-300' : 'text-slate-700'}`}>
                                    الاسم الكامل *
                                </label>
                                <input
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    required
                                    placeholder="محمد أحمد"
                                    className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/30
                                        ${dm ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                                            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className={`block text-sm font-medium mb-1.5 ${dm ? 'text-gray-300' : 'text-slate-700'}`}>
                                    رقم الهاتف *
                                </label>
                                <input
                                    name="phone"
                                    value={form.phone}
                                    onChange={handleChange}
                                    required
                                    type="tel"
                                    placeholder="06XXXXXXXX"
                                    className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/30
                                        ${dm ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                                            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                />
                            </div>

                            {/* City */}
                            <div>
                                <label className={`block text-sm font-medium mb-1.5 ${dm ? 'text-gray-300' : 'text-slate-700'}`}>
                                    المدينة
                                </label>
                                <input
                                    name="city"
                                    value={form.city}
                                    onChange={handleChange}
                                    placeholder="الدار البيضاء"
                                    className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/30
                                        ${dm ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                                            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className={`flex-1 py-2.5 rounded-xl font-medium transition-colors
                                        ${dm ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                                >
                                    {alreadySaved ? 'إغلاق' : 'لاحقاً'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={status === 'loading'}
                                    className="flex-1 py-2.5 rounded-xl font-semibold bg-primary hover:bg-primary-dark text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    {status === 'loading'
                                        ? <><Loader2 size={16} className="animate-spin" /> جارٍ الحفظ...</>
                                        : 'تسجيل'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default RegisterModal;
