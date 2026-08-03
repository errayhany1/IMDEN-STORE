import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Zap, ShieldCheck, Truck, Send, MessageCircle, ShoppingBag } from 'lucide-react';
import useStore from '../store/useStore';

const MarketingLandingPage = () => {
    const { darkMode } = useStore();

    const trackPixelEvent = (eventName) => {
        // Facebook Pixel
        if (window.fbq) {
            window.fbq('trackCustom', eventName);
        }
        // TikTok Pixel
        if (window.ttq) {
            window.ttq.track(eventName);
        }
    };

    const handleStoreClick = () => {
        trackPixelEvent('EnterStore_Landing');
        window.location.href = '/catalog';
    };

    const handleTelegramClick = () => {
        trackPixelEvent('JoinTelegram_Landing');
        window.open('https://t.me/Imden_technology', '_blank');
    };

    const handleWhatsAppClick = () => {
        trackPixelEvent('ContactWhatsApp_Landing');
        window.open('https://wa.me/212664630566', '_blank');
    };

    return (
        <div className={`min-h-screen flex flex-col font-sans ${darkMode ? 'bg-gray-950 text-gray-50' : 'bg-slate-50 text-slate-900'}`} style={{ direction: 'rtl' }}>
            {/* Minimal Header */}
            <header className="p-6 flex justify-center items-center relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/30">
                        <ShoppingBag size={24} className="text-white" />
                    </div>
                    <span className="text-2xl font-black bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">الريحاني</span>
                </div>
            </header>

            {/* Hero Section */}
            <main className="flex-1 flex flex-col justify-center items-center px-4 md:px-8 pb-20 relative overflow-hidden">
                {/* Background Decor */}
                <div className={`absolute top-20 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl -z-10 animate-pulse`} />
                <div className={`absolute bottom-10 right-10 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl -z-10 animate-pulse`} style={{ animationDelay: '2s' }} />

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="max-w-3xl w-full text-center space-y-8 relative z-10 mt-8 md:mt-16"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm mb-4 border border-primary/20 backdrop-blur-sm"
                    >
                        🚀 الخيار الأول لتجار الجملة في المغرب
                    </motion.div>

                    <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight">
                        استورد منتجاتك{' '}
                        <span className="bg-gradient-to-l from-primary to-indigo-500 bg-clip-text text-transparent block mt-2">
                            بأفضل الأسعار
                        </span>
                    </h1>

                    <p className={`text-lg md:text-xl max-w-2xl mx-auto leading-relaxed ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                        منصة الريحاني توفر لك أحدث الإلكترونيات وإكسسوارات الهواتف بأسعار الجملة التنافسية. تشكيلة واسعة، جودة مضمونة، وتوصيل سريع إلى جميع المدن.
                    </p>

                    {/* Features */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 pb-8 max-w-2xl mx-auto">
                        {[
                            { icon: Zap, title: "أسعار تنافسية", desc: "هوامش ربح ممتازة لتجارتك", color: "text-amber-500", bg: "bg-amber-500/10" },
                            { icon: ShieldCheck, title: "جودة مضمونة", desc: "منتجات أصلية وموثوقة", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                            { icon: Truck, title: "توصيل سريع", desc: "لجميع مدن المغرب", color: "text-blue-500", bg: "bg-blue-500/10" },
                        ].map((feat, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + i * 0.1 }}
                                className={`flex flex-col items-center p-5 rounded-2xl border ${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-100'} shadow-sm backdrop-blur-sm`}
                            >
                                <div className={`w-12 h-12 rounded-full ${feat.bg} flex items-center justify-center mb-3`}>
                                    <feat.icon className={feat.color} size={24} />
                                </div>
                                <h3 className="font-bold text-lg mb-1">{feat.title}</h3>
                                <p className={`text-sm text-center ${darkMode ? 'text-gray-500' : 'text-slate-500'}`}>{feat.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
                        className="flex flex-col gap-4 max-w-sm mx-auto"
                    >
                        <button
                            onClick={handleStoreClick}
                            className="group relative flex items-center justify-center gap-3 w-full py-5 px-8 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 text-white font-bold text-lg overflow-hidden shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <span className="relative z-10">تصفح المتجر والأسعار</span>
                            <ChevronRight size={22} className="relative z-10 group-hover:-translate-x-1 transition-transform" />
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                        </button>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleTelegramClick}
                                className={`flex items-center justify-center gap-2 py-4 px-4 rounded-xl font-bold border transition-all hover:scale-105 active:scale-95 ${darkMode ? 'bg-[#229ED9]/10 text-[#229ED9] border-[#229ED9]/30 hover:bg-[#229ED9]/20' : 'bg-[#229ED9]/5 text-[#229ED9] border-[#229ED9]/20 hover:bg-[#229ED9]/10'}`}
                            >
                                <Send size={20} />
                                <span>قناتنا تيليجرام</span>
                            </button>
                            <button
                                onClick={handleWhatsAppClick}
                                className={`flex items-center justify-center gap-2 py-4 px-4 rounded-xl font-bold border transition-all hover:scale-105 active:scale-95 ${darkMode ? 'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/20' : 'bg-[#25D366]/5 text-[#25D366] border-[#25D366]/20 hover:bg-[#25D366]/10'}`}
                            >
                                <MessageCircle size={20} />
                                <span>تواصل واتساب</span>
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            </main>
        </div>
    );
};

export default MarketingLandingPage;
