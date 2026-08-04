import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  ShieldCheck,
  Truck,
  Send,
  MessageCircle,
  Globe,
  Star,
  Package,
  Users,
  ArrowLeft,
} from 'lucide-react';

/* ── Constants ─────────────────────────────────────────────── */
const WA_NUMBER = '212664630566';
const TELEGRAM_URL = 'https://t.me/Imden_technology';
const STORE_URL = '/catalog';

const CATEGORIES = [
  { nameAr: 'شواحن', nameEn: 'Chargers', img: '/category-images/chargers.png' },
  { nameAr: 'سماعات', nameEn: 'Audio', img: '/category-images/audio.png' },
  { nameAr: 'ساعات ذكية', nameEn: 'Smart Watches', img: '/category-images/smart-watches.png' },
  { nameAr: 'باوربانك', nameEn: 'Power Banks', img: '/category-images/batteries-power-banks.png' },
  { nameAr: 'كاميرات', nameEn: 'Cameras', img: '/category-images/cameras.png' },
  { nameAr: 'إضاءة', nameEn: 'Lighting', img: '/category-images/lighting.png' },
  { nameAr: 'ألعاب', nameEn: 'Gaming', img: '/category-images/gaming.png' },
  { nameAr: 'تخزين', nameEn: 'Storage', img: '/category-images/storage.png' },
  { nameAr: 'شبكات', nameEn: 'Network', img: '/category-images/network.png' },
  { nameAr: 'ميكروفونات', nameEn: 'Microphones', img: '/category-images/microphones.png' },
  { nameAr: 'ماوس و كيبورد', nameEn: 'Mouse & Keyboard', img: '/category-images/mouse-keyboard.png' },
  { nameAr: 'كابلات', nameEn: 'Cables', img: '/category-images/cables.png' },
];

const BANNERS = [
  { img: '/banners/family-power.jpg', alt: 'طاقة وشواحن' },
  { img: '/banners/family-audio.jpg', alt: 'صوت وترفيه' },
  { img: '/banners/family-devices.jpg', alt: 'أجهزة وإكسسوارات' },
];

const STATS = [
  { icon: Package, value: '+500', label: 'منتج متوفر' },
  { icon: Users, value: '+1000', label: 'تاجر يثق بنا' },
  { icon: Star, value: '4.9', label: 'تقييم العملاء' },
  { icon: Truck, value: '48h', label: 'توصيل سريع' },
];

/* ── Pixel helpers ─────────────────────────────────────────── */
const trackPixelEvent = (eventName) => {
  if (window.fbq) window.fbq('trackCustom', eventName);
  if (window.ttq) window.ttq.track(eventName);
};

/* ── Stagger animation wrapper ─────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
});

/* ══════════════════════════════════════════════════════════════
   Banner Slider Component
   ══════════════════════════════════════════════════════════════ */
const BannerSlider = () => {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  const resetTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent((p) => (p + 1) % BANNERS.length), 4000);
  };

  useEffect(() => {
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, []);

  const go = (dir) => {
    setCurrent((p) => (p + dir + BANNERS.length) % BANNERS.length);
    resetTimer();
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl aspect-[16/7] md:aspect-[16/6] group">
      {BANNERS.map((b, i) => (
        <img
          key={i}
          src={b.img}
          alt={b.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out ${
            i === current ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
          }`}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}
      {/* Nav arrows */}
      <button
        onClick={() => go(-1)}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
        aria-label="السابق"
      >
        <ChevronLeft size={20} className="text-slate-800" />
      </button>
      <button
        onClick={() => go(1)}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
        aria-label="التالي"
      >
        <ChevronRight size={20} className="text-slate-800" />
      </button>
      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrent(i); resetTimer(); }}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? 'w-7 bg-white' : 'w-2 bg-white/50'
            }`}
            aria-label={`الشريحة ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Category Scroll Rail
   ══════════════════════════════════════════════════════════════ */
const CategoryRail = () => {
  const railRef = useRef(null);

  return (
    <div className="relative">
      <div
        ref={railRef}
        className="flex gap-5 overflow-x-auto no-scrollbar pb-4 snap-x snap-mandatory px-1"
      >
        {CATEGORIES.map((cat, i) => (
          <motion.a
            key={cat.nameEn}
            href={`/${cat.nameEn.toLowerCase().replace(/\s+&?\s*/g, '-')}`}
            onClick={(e) => {
              e.preventDefault();
              trackPixelEvent('ViewCategory_Landing');
              window.location.href = STORE_URL;
            }}
            {...fadeUp(0.05 * i)}
            className="snap-start shrink-0 flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white shadow-md border border-slate-100 overflow-hidden flex items-center justify-center p-2 group-hover:shadow-xl group-hover:scale-105 group-hover:border-primary/30 transition-all duration-300">
              <img
                src={cat.img}
                alt={cat.nameAr}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
            <span className="text-xs md:text-sm font-bold text-slate-700 group-hover:text-primary transition-colors whitespace-nowrap">
              {cat.nameAr}
            </span>
          </motion.a>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MarketingLandingPage — Main Component
   ══════════════════════════════════════════════════════════════ */
const MarketingLandingPage = () => {
  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-b from-[#0d1b2a] via-[#142038] to-[#0d1b2a] text-white overflow-x-hidden"
      style={{ direction: 'rtl', fontFamily: "'Tajawal', sans-serif" }}
    >
      {/* ─── Floating Particles Background ─── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[10%] right-[15%] w-96 h-96 bg-primary/8 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[20%] left-[10%] w-80 h-80 bg-indigo-500/8 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[60%] right-[60%] w-64 h-64 bg-cyan-400/5 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '6s' }} />
      </div>

      {/* ═══════════════════════════════════════
          HEADER
          ═══════════════════════════════════════ */}
      <header className="relative z-10 px-6 py-5 flex justify-between items-center max-w-6xl mx-auto w-full">
        <img src="/logo-dark.png" alt="Errayhany Grossiste" className="h-10 md:h-14 object-contain" />
        <a
          href={STORE_URL}
          onClick={() => trackPixelEvent('EnterStore_Header')}
          className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-sm font-bold hover:bg-white/20 transition-all"
        >
          <Globe size={16} />
          تصفح المتجر
        </a>
      </header>

      {/* ═══════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════ */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-8 pb-16 max-w-4xl mx-auto w-full">
        <motion.div {...fadeUp(0)}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-bold border border-primary/20 mb-6">
            <Zap size={14} />
            الخيار الأول لتجار الجملة في المغرب
          </span>
        </motion.div>

        <motion.h1
          {...fadeUp(0.1)}
          className="text-4xl md:text-6xl lg:text-7xl font-black leading-[1.15] tracking-tight mb-6"
        >
          استورد منتجاتك
          <br />
          <span className="bg-gradient-to-l from-primary via-blue-400 to-cyan-300 bg-clip-text text-transparent">
            بأفضل الأسعار
          </span>
        </motion.h1>

        <motion.p
          {...fadeUp(0.2)}
          className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-2xl mb-10"
        >
          منصة <strong className="text-white">الريحاني</strong> توفر لك أحدث
          الإلكترونيات وإكسسوارات الهواتف بأسعار الجملة التنافسية.
          <br className="hidden md:block" />
          تشكيلة واسعة، جودة مضمونة، وتوصيل سريع إلى جميع المدن المغربية.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div {...fadeUp(0.3)} className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
          <a
            href={STORE_URL}
            onClick={() => trackPixelEvent('EnterStore_Hero')}
            className="group relative flex-1 flex items-center justify-center gap-3 py-4 px-8 rounded-2xl bg-gradient-to-l from-primary to-blue-500 text-white font-bold text-lg shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.03] active:scale-[0.98] overflow-hidden"
          >
            <span className="relative z-10">تصفح المتجر والأسعار</span>
            <ArrowLeft size={20} className="relative z-10 group-hover:-translate-x-1 transition-transform" />
            <div className="absolute inset-0 bg-white/15 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </a>
        </motion.div>

        <motion.div {...fadeUp(0.4)} className="flex gap-3 mt-4 w-full max-w-lg">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackPixelEvent('JoinTelegram_Hero')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-[#229ED9]/15 text-[#5ec4f5] border border-[#229ED9]/25 hover:bg-[#229ED9]/25 transition-all hover:scale-105 active:scale-95"
          >
            <Send size={18} />
            قناة تيليجرام
          </a>
          <a
            href={`https://wa.me/${WA_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackPixelEvent('ContactWhatsApp_Hero')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-[#25D366]/15 text-[#5ee89a] border border-[#25D366]/25 hover:bg-[#25D366]/25 transition-all hover:scale-105 active:scale-95"
          >
            <MessageCircle size={18} />
            واتساب
          </a>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════
          STATS BAR
          ═══════════════════════════════════════ */}
      <section className="relative z-10 max-w-5xl mx-auto w-full px-6 pb-16">
        <motion.div
          {...fadeUp(0)}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {STATS.map((stat, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 py-6 px-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/8"
            >
              <stat.icon size={24} className="text-primary" />
              <span className="text-2xl md:text-3xl font-black">{stat.value}</span>
              <span className="text-xs text-slate-400 font-bold">{stat.label}</span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════
          BANNER SLIDER
          ═══════════════════════════════════════ */}
      <section className="relative z-10 max-w-5xl mx-auto w-full px-6 pb-16">
        <motion.div {...fadeUp(0)}>
          <h2 className="text-2xl md:text-3xl font-black mb-6 text-center">
            عروضنا <span className="text-primary">الحصرية</span>
          </h2>
          <BannerSlider />
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════
          CATEGORIES
          ═══════════════════════════════════════ */}
      <section className="relative z-10 max-w-5xl mx-auto w-full px-6 pb-16">
        <motion.h2 {...fadeUp(0)} className="text-2xl md:text-3xl font-black mb-6 text-center">
          تشكيلة <span className="text-primary">واسعة</span> من الفئات
        </motion.h2>
        <CategoryRail />
      </section>

      {/* ═══════════════════════════════════════
          FEATURES
          ═══════════════════════════════════════ */}
      <section className="relative z-10 max-w-5xl mx-auto w-full px-6 pb-16">
        <motion.h2 {...fadeUp(0)} className="text-2xl md:text-3xl font-black mb-8 text-center">
          لماذا <span className="text-primary">الريحاني</span>؟
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: Zap,
              title: 'أسعار تنافسية',
              desc: 'هوامش ربح ممتازة مقارنة بالسوق. أسعارنا مباشرة من المصدر بدون وسطاء.',
              gradient: 'from-amber-500/20 to-orange-500/20',
              iconColor: 'text-amber-400',
            },
            {
              icon: ShieldCheck,
              title: 'جودة مضمونة',
              desc: 'جميع المنتجات أصلية ومختبرة. ضمان الاستبدال في حالة أي خلل في التصنيع.',
              gradient: 'from-emerald-500/20 to-teal-500/20',
              iconColor: 'text-emerald-400',
            },
            {
              icon: Truck,
              title: 'توصيل سريع',
              desc: 'توصيل لجميع مدن المغرب في أقل من 48 ساعة. دفع عند الاستلام أو تحويل بنكي.',
              gradient: 'from-blue-500/20 to-cyan-500/20',
              iconColor: 'text-blue-400',
            },
          ].map((feat, i) => (
            <motion.div
              key={i}
              {...fadeUp(i * 0.1)}
              className="relative p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/8 overflow-hidden group hover:border-white/15 transition-all duration-300"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                  <feat.icon className={feat.iconColor} size={28} />
                </div>
                <h3 className="text-xl font-bold mb-2">{feat.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feat.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════ */}
      <section className="relative z-10 max-w-4xl mx-auto w-full px-6 pb-20">
        <motion.div
          {...fadeUp(0)}
          className="relative rounded-3xl overflow-hidden bg-gradient-to-l from-primary/90 to-blue-600/90 p-8 md:p-12 text-center shadow-2xl"
        >
          <div className="absolute inset-0 bg-[url('/banners/family-devices.jpg')] bg-cover bg-center opacity-15" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              ابدأ تجارتك الآن مع الريحاني
            </h2>
            <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
              انضم لأكثر من 1000 تاجر يثقون بنا. تصفح الكتالوج، اختر منتجاتك، وابدأ البيع بأرباح عالية.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <a
                href={STORE_URL}
                onClick={() => trackPixelEvent('EnterStore_CTA')}
                className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-white text-primary font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95"
              >
                <Globe size={20} />
                الدخول للمتجر
              </a>
              <a
                href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('السلام عليكم، أريد الاستفسار عن منتجاتكم بالجملة')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPixelEvent('ContactWhatsApp_CTA')}
                className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-[#25D366] text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95"
              >
                <MessageCircle size={20} />
                تواصل واتساب
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/8 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/logo-dark.png" alt="Errayhany Grossiste" className="h-8 object-contain opacity-70" />
          <p className="text-xs text-slate-500 text-center">
            © {new Date().getFullYear()} Errayhany Grossiste. جميع الحقوق محفوظة.
          </p>
          <div className="flex items-center gap-4">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-[#229ED9] transition-colors" aria-label="تيليجرام">
              <Send size={18} />
            </a>
            <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-[#25D366] transition-colors" aria-label="واتساب">
              <MessageCircle size={18} />
            </a>
            <a href="https://errayhany.com" className="text-slate-500 hover:text-primary transition-colors" aria-label="الموقع">
              <Globe size={18} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLandingPage;
