import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Globe,
  Send,
  Smartphone,
  Headphones,
  Watch,
  BatteryCharging,
  Star,
  ChevronDown
} from 'lucide-react';
import useStore from '../store/useStore';

const WA_NUMBER = '212664630566';
const TELEGRAM_URL = 'https://t.me/Imden_technology';
const STORE_URL = '/catalog';

const trackPixelEvent = (eventName) => {
  if (window.fbq) {
    // Map to Standard Events for better Facebook Ads optimization
    if (eventName.includes('WhatsApp') || eventName.includes('Telegram')) {
      window.fbq('track', 'Contact');
    } else if (eventName.includes('EnterStore')) {
      window.fbq('track', 'Lead');
    } else {
      window.fbq('trackCustom', eventName);
    }
  }
  if (window.ttq) window.ttq.track(eventName);
};

const MarketingLandingPage = () => {
  const { darkMode } = useStore();

  return (
    <div className={`min-h-screen overflow-x-hidden ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-[#eef6ff] text-[#0f172a]'}`} style={{ direction: 'rtl', fontFamily: "'Tajawal', 'Inter', sans-serif" }}>
      
      {/* Background Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[5%] right-[8%] w-[320px] h-[320px] rounded-full bg-blue-400/30 blur-[70px] mix-blend-multiply animate-[pulse_10s_ease-in-out_infinite]" />
        <div className="absolute bottom-0 left-[5%] w-[420px] h-[420px] rounded-full bg-sky-400/20 blur-[70px] mix-blend-multiply animate-[pulse_10s_ease-in-out_infinite] [animation-delay:-5s]" />
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-50 py-4 ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/70 border-blue-100'} backdrop-blur-xl border-b`}>
        <div className="max-w-[1200px] w-[92%] mx-auto flex justify-between items-center">
          <img src={darkMode ? "/logo-dark.png" : "/logo.png"} alt="Errayhany" className="h-10 object-contain" />
          <nav className="hidden md:flex gap-8">
            <a href="#" className={`font-semibold hover:text-blue-600 transition-colors ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>الرئيسية</a>
            <a href="#categories" className={`font-semibold hover:text-blue-600 transition-colors ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>الفئات</a>
            <a href="#products" className={`font-semibold hover:text-blue-600 transition-colors ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>المنتجات</a>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        
        {/* Hero Section */}
        <section className="max-w-[1200px] w-[92%] mx-auto min-h-[calc(100vh-80px)] grid grid-cols-1 md:grid-cols-2 items-center gap-16 py-16 md:py-0">
          <div>
            <div className={`inline-block px-5 py-2.5 rounded-full font-bold text-sm mb-6 ${darkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
              إلكترونيات بالجملة • المغرب
            </div>
            <h1 className="text-[clamp(40px,5vw,64px)] font-black leading-[1.1] mb-6">
              طريقة جديدة لشراء <br/>
              <span className="bg-gradient-to-r from-blue-600 to-sky-400 bg-clip-text text-transparent">
                الإلكترونيات بالجملة
              </span>
            </h1>
            <p className={`text-lg leading-[1.8] max-w-[620px] mb-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              منصة الريحاني توفر لك أحدث الإلكترونيات وإكسسوارات الهواتف بأسعار الجملة التنافسية. تشكيلة واسعة، جودة مضمونة، وتوصيل سريع إلى جميع مدن المغرب.
            </p>
            <div className="flex flex-wrap gap-4">
              <a 
                href={STORE_URL}
                onClick={() => trackPixelEvent('EnterStore_Hero')}
                className="flex items-center gap-2 px-7 py-4 rounded-2xl bg-blue-600 text-white font-bold hover:-translate-y-1 transition-transform shadow-[0_15px_35px_rgba(37,99,235,0.2)]"
              >
                <Globe size={20} />
                دخول المتجر
              </a>
              <a 
                href={`https://wa.me/${WA_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPixelEvent('ContactWhatsApp_Hero')}
                className="flex items-center gap-2 px-7 py-4 rounded-2xl bg-green-500 text-white font-bold hover:-translate-y-1 transition-transform shadow-[0_15px_35px_rgba(34,197,94,0.2)]"
              >
                <MessageCircle size={20} />
                واتساب
              </a>
              <a 
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPixelEvent('JoinTelegram_Hero')}
                className="flex items-center gap-2 px-7 py-4 rounded-2xl bg-sky-500 text-white font-bold hover:-translate-y-1 transition-transform shadow-[0_15px_35px_rgba(14,165,233,0.2)]"
              >
                <Send size={20} />
                تيليجرام
              </a>
            </div>
          </div>
          
          {/* Showcase Device */}
          <div className="relative h-[420px] md:h-[620px] flex items-center justify-center">
            <div className={`absolute inset-0 rounded-[40px] backdrop-blur-[18px] shadow-[0_25px_70px_rgba(37,99,235,0.15)] ${darkMode ? 'bg-slate-800/60 border border-slate-700' : 'bg-white/60'}`} />
            <div className="absolute top-[10%] right-[10%] w-[120px] h-[120px] rounded-full bg-blue-400/40 blur-md animate-[bounce_6s_infinite]" />
            <div className="absolute bottom-[10%] left-[10%] w-[100px] h-[100px] rounded-full bg-cyan-400/40 blur-md animate-[bounce_6s_infinite_reverse]" />
            
            <div className={`absolute inset-8 border-2 border-dashed rounded-[30px] flex items-center justify-center overflow-hidden ${darkMode ? 'border-blue-500/30' : 'border-blue-300'}`}>
               <img src="/banners/family-devices.jpg" alt="Showcase" className="w-full h-full object-cover rounded-[28px]" />
            </div>
          </div>
        </section>

        {/* Categories Grid */}
        <section id="categories" className="max-w-[1200px] w-[92%] mx-auto py-20">
          <h2 className="text-4xl font-black text-center mb-4">الفئات الشائعة</h2>
          <p className={`text-center max-w-[700px] mx-auto mb-14 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            استكشف مجموعة واسعة من المنتجات المصممة لتلبية احتياجات تجارتك بأفضل الأسعار الممكنة في السوق.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'شواحن', desc: 'أحدث الشواحن السريعة.', img: '/category-images/chargers.png' },
              { title: 'صوتيات', desc: 'سماعات ومكبرات صوت.', img: '/category-images/audio.png' },
              { title: 'ساعات ذكية', desc: 'ساعات ذكية احترافية.', img: '/category-images/smart-watches.png' },
              { title: 'إكسسوارات', desc: 'كابلات وباوربانك.', img: '/category-images/batteries-power-banks.png' }
            ].map((cat, i) => (
              <div key={i} className={`relative p-8 rounded-3xl transition-all duration-300 hover:-translate-y-2 hover:rotate-1 group ${darkMode ? 'bg-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.3)]' : 'bg-white shadow-[0_20px_50px_rgba(37,99,235,0.08)]'}`}>
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-600/5 to-sky-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center p-3 mb-6">
                     <img src={cat.img} alt={cat.title} className="w-full h-full object-contain filter drop-shadow-md" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{cat.title}</h3>
                  <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{cat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="max-w-[1200px] w-[92%] mx-auto py-10">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
             {[
               { num: '+500', label: 'منتج' },
               { num: '48h', label: 'توصيل' },
               { num: '60+', label: 'مدينة' },
               { num: '7/7', label: 'دعم فني' }
             ].map((stat, i) => (
               <div key={i} className={`text-center p-8 rounded-3xl ${darkMode ? 'bg-slate-800' : 'bg-white shadow-[0_20px_50px_rgba(37,99,235,0.08)]'}`}>
                 <div className="text-4xl md:text-5xl font-black text-blue-600 mb-2">{stat.num}</div>
                 <div className={`font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{stat.label}</div>
               </div>
             ))}
           </div>
        </section>

        {/* Products Showcase (Glassmorphism) */}
        <section id="products" className="max-w-[1200px] w-[92%] mx-auto py-20">
          <h2 className="text-4xl font-black text-center mb-4">المنتجات المميزة</h2>
          <p className={`text-center max-w-[700px] mx-auto mb-14 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            منتجات عالية الجودة بأسعار تنافسية، اخترنا لك الأفضل لزيادة مبيعاتك.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { badge: 'جديد', title: 'سماعات بلوتوث', price: 'جملة', img: '/category-images/audio.png' },
              { badge: 'الأكثر مبيعاً', title: 'شواحن سريعة', price: 'جملة', img: '/category-images/chargers.png' },
              { badge: 'عرض', title: 'ساعات ذكية', price: 'جملة', img: '/category-images/smart-watches.png' }
            ].map((prod, i) => (
              <div key={i} className={`p-6 rounded-[30px] border transition-all duration-350 hover:-translate-y-3 hover:rotate-2 shadow-[0_18px_55px_rgba(37,99,235,0.08)] ${darkMode ? 'bg-slate-800/70 border-slate-700 backdrop-blur-xl' : 'bg-white/70 border-blue-100 backdrop-blur-xl'}`}>
                <div className={`h-[220px] rounded-2xl flex items-center justify-center p-4 ${darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-blue-100 to-white'}`}>
                  <img src={prod.img} alt={prod.title} className="max-h-full object-contain" />
                </div>
                <div className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold my-4 ${darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                  {prod.badge}
                </div>
                <h3 className="text-xl font-bold mb-2">{prod.title}</h3>
                <div className="text-2xl font-black text-blue-600 mb-4">{prod.price}</div>
                <a 
                  href={STORE_URL}
                  className="block text-center py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-400 text-white font-bold shadow-lg hover:shadow-xl transition-shadow"
                >
                  استعرض المنتج
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Call To Action */}
        <section className="max-w-[1200px] w-[92%] mx-auto py-20">
          <div className="bg-gradient-to-br from-blue-600 to-sky-400 rounded-[34px] p-12 text-center text-white shadow-2xl">
             <h2 className="text-4xl font-black mb-6 text-white">هل أنت مستعد للبدء؟</h2>
             <p className="text-blue-100 mb-10 max-w-2xl mx-auto text-lg">انضم إلى شبكة التجار المستفيدين من أفضل أسعار الإلكترونيات في المغرب.</p>
             <div className="flex flex-wrap justify-center gap-4">
                <a href={`https://wa.me/${WA_NUMBER}`} className="px-8 py-4 rounded-xl bg-white text-blue-600 font-bold hover:scale-105 transition-transform shadow-lg">تواصل عبر واتساب</a>
                <a href={STORE_URL} className="px-8 py-4 rounded-xl bg-white text-blue-600 font-bold hover:scale-105 transition-transform shadow-lg">الدخول للموقع</a>
             </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-20 bg-gradient-to-br from-blue-900 to-sky-600 text-white relative z-10">
         <div className="max-w-[1200px] w-[92%] mx-auto py-16 grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
               <img src="/logo-dark.png" alt="Errayhany" className="h-10 mb-4" />
               <p className="text-blue-100 leading-relaxed max-w-sm mb-6">
                 الريحاني - منصة البيع بالجملة الرائدة للإلكترونيات وإكسسوارات الهواتف في الدار البيضاء والمغرب.
               </p>
            </div>
            <div>
               <h3 className="text-xl font-bold mb-4">روابط سريعة</h3>
               <ul className="space-y-3 text-blue-100">
                 <li><a href={STORE_URL} className="hover:text-white">تصفح المتجر</a></li>
                 <li><a href="#categories" className="hover:text-white">الفئات</a></li>
                 <li><a href={`https://wa.me/${WA_NUMBER}`} className="hover:text-white">اتصل بنا</a></li>
               </ul>
            </div>
            <div>
               <h3 className="text-xl font-bold mb-4">خدماتنا</h3>
               <ul className="space-y-3 text-blue-100">
                 <li>شحن وتوصيل لجميع المدن</li>
                 <li>أسعار تنافسية للتجار</li>
                 <li>خدمة عملاء 7/7</li>
               </ul>
            </div>
         </div>
      </footer>

      {/* Floating WhatsApp */}
      <a 
        href={`https://wa.me/${WA_NUMBER}`} 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed right-6 bottom-6 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-[0_20px_40px_rgba(0,0,0,0.18)] hover:-translate-y-1 transition-transform z-50"
      >
        <MessageCircle size={32} />
      </a>
      
    </div>
  );
};

export default MarketingLandingPage;
