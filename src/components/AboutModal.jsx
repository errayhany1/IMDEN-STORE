import React from 'react';
import { X, CheckCircle, Package, Truck, HeadphonesIcon, MapPin, Mail, Phone } from 'lucide-react';
import useStore from '../store/useStore';

const AboutModal = () => {
    const { isAboutModalOpen, setAboutModalOpen, darkMode } = useStore();

    if (!isAboutModalOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
            <div 
                className={`relative w-full max-w-2xl p-6 md:p-8 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto
                ${darkMode ? 'bg-gray-900 border border-gray-700 text-white' : 'bg-white text-slate-800'}`}
                style={{ direction: 'rtl' }}
            >
                {/* Close button */}
                <button 
                    onClick={() => setAboutModalOpen(false)}
                    className={`absolute top-4 left-4 p-2 rounded-full transition-colors flex items-center justify-center
                    ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-slate-100 text-slate-400'}`}
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="text-center mb-8 mt-2">
                    <div className="inline-block p-3 rounded-2xl bg-primary/10 mb-4">
                        <img src="/logo.png" alt="IMDEN STORE" className="h-12 w-auto object-contain mx-auto mix-blend-multiply dark:mix-blend-normal" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold mb-3 text-primary">IMDEN STORE</h2>
                    <p className={`text-lg font-medium ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                        شريكك الموثوق لتجارة الإلكترونيات بالجملة
                    </p>
                </div>

                {/* Content */}
                <div className={`space-y-6 text-base leading-relaxed ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                    <p>
                        تأسست <strong>IMDEN STORE</strong> لتكون الوجهة الأولى والمورد الأقوى لأصحاب المحلات التجارية والموزعين في مجال الإلكترونيات وإكسسوارات الهواتف المحمولة في المغرب.
                    </p>
                    <p>
                        نحن لا نبيع المنتجات فقط، بل نبني شراكات نجاح حقيقية مع عملائنا. من خلال تواجدنا في قلب الدار البيضاء، نضمن لك الوصول إلى أحدث التقنيات في عالم الإلكترونيات، وكل ذلك بـ <strong className="text-primary">أسعار جملة تنافسية لا تقبل المنافسة</strong>.
                    </p>

                    <div className="my-8">
                        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-800'}`}>لماذا تختار التعامل معنا؟</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-start gap-3">
                                    <Package className="text-primary mt-1 flex-shrink-0" size={24} />
                                    <div>
                                        <h4 className={`font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>تنوع هائل وجودة مضمونة</h4>
                                        <p className="text-sm">تشكيلة واسعة من أحدث المنتجات التقنية التي يطلبها السوق وتلبي احتياجات زبائنك.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="text-primary mt-1 flex-shrink-0" size={24} />
                                    <div>
                                        <h4 className={`font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>أسعار الجملة الأفضل</h4>
                                        <p className="text-sm">صممنا أسعارنا لضمان أعلى هامش ربح لشركائنا وتجارنا.</p>
                                    </div>
                                </div>
                            </div>

                            <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-start gap-3">
                                    <Truck className="text-primary mt-1 flex-shrink-0" size={24} />
                                    <div>
                                        <h4 className={`font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>توصيل سريع وموثوق</h4>
                                        <p className="text-sm">فريقنا اللوجستي يسهر على وصول طلبياتك في الوقت المحدد إلى جميع مدن المغرب.</p>
                                    </div>
                                </div>
                            </div>

                            <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-start gap-3">
                                    <HeadphonesIcon className="text-primary mt-1 flex-shrink-0" size={24} />
                                    <div>
                                        <h4 className={`font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>خدمة ما بعد البيع</h4>
                                        <p className="text-sm">دعم مستمر، سهولة في التعامل مع المرتجعات، وتجاوب سريع مع كل استفساراتك.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="text-center font-medium">
                        في <strong>IMDEN STORE</strong>، التزامنا هو تزويدك بأفضل السلع التقنية لتنمية تجارتك ومضاعفة أرباحك. نحن نعمل بشغف لكي تكون أنت دائماً في الصدارة.
                    </p>
                </div>

                {/* Footer Contact */}
                <div className={`mt-8 pt-6 border-t flex flex-wrap gap-4 justify-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <a href="https://wa.me/212664630566" target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                        <Phone size={16} className="text-green-500" />
                        تواصل معنا
                    </a>
                    <a href="mailto:contact@imden.com" className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                        <Mail size={16} className="text-blue-500" />
                        راسلنا
                    </a>
                    <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                        <MapPin size={16} className="text-red-500" />
                        موقعنا
                    </a>
                </div>
            </div>
        </div>
    );
};

export default AboutModal;
