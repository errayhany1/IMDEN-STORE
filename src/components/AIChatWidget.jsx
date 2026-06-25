import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../store/useStore';

const AIChatWidget = () => {
    const { products, darkMode } = useStore();
    const dm = darkMode;

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'مرحباً! أنا المساعد الذكي لمتجر IMDEN STORE. كيف يمكنني مساعدتك اليوم؟' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        // Use OpenAI API Key
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (!apiKey) {
            setMessages(prev => [...prev, 
                { role: 'user', content: input }, 
                { role: 'assistant', content: 'المرجو إضافة مفتاح VITE_OPENAI_API_KEY في إعدادات البيئة (Environment Variables) ليعمل المساعد الذكي.' }
            ]);
            setInput('');
            return;
        }

        const userMessage = { role: 'user', content: input };
        
        // If this is the first message from the user, send an alert to Telegram so the admin knows what people are asking!
        if (messages.filter(m => m.role === 'user').length === 0) {
            try {
                const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
                const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;
                if (botToken && chatId) {
                    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
                    const formData = new FormData();
                    formData.append('chat_id', chatId);
                    formData.append('text', `🤖 **محادثة جديدة مع البوت:**\n\nالزائر يسأل:\n"${input}"`);
                    fetch(telegramUrl, { method: 'POST', body: formData }).catch(e => console.log('Telegram log error', e));
                }
            } catch (e) {
                // ignore
            }
        }

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        try {
            // Context Injection: Prepare product catalog string (concise to save context tokens)
            const catalogStr = products.slice(0, 50).map(p => `- منتج: ${p.name || 'بدون اسم'} | المرجع: ${p.ref} | السعر: ${p.price} DH`).join('\n');
            const systemPrompt = `أنت مساعد مبيعات ذكي ومحترف لمتجر "IMDEN STORE" المتخصص في بيع التقنيات والإلكترونيات بالجملة في المغرب.
مهمتك الرد على استفسارات الزوار باللغة العربية بأسلوب راقٍ وودي ومختصر.
يجب أن تركز دائماً على إقناع الزبون والترحيب به. أسعارنا كلها بالدرهم المغربي (DH).
هذه قائمة بأهم المنتجات المتوفرة حالياً في قاعدة البيانات مع أسعارها ومراجعها:
${catalogStr}

إذا سألك الزبون عن منتج غير موجود في القائمة، أخبره بلباقة أنه يمكننا التحقق من المخزن الداخلي وتوفير أي منتج يحتاجه عبر تقديم طلب من خلال نافذة الشكاوي والاقتراحات أو التواصل معنا عبر واتساب.
مهم جداً: في محادثاتك، حاول بين الحين والآخر (بشكل ذكي وغير مزعج) أن تنصح الزبون بتسجيل الدخول في الموقع لحفظ معلوماته، وكذلك اقترح عليه تحميل تطبيق المتجر للأندرويد (APK) المتاح في الموقع لتجربة أسرع وأفضل.
الرد يجب أن يكون مباشراً بدون أي أكواد أو تفاصيل تقنية معقدة.`;

            // Prepare messages for API
            const apiMessages = [
                { role: 'system', content: systemPrompt },
                ...messages.map(m => ({ role: m.role, content: m.content })),
                userMessage
            ];

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini', // The most cost-effective and smart model!
                    messages: apiMessages,
                    temperature: 0.7,
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("OpenAI API Error:", data);
                let errorMsg = 'حدث خطأ في الاتصال بالخادم. المرجو المحاولة لاحقاً.';
                if (data.error && data.error.message) {
                    errorMsg = `الخادم رفض الطلب: ${data.error.message}`;
                }
                throw new Error(errorMsg);
            }

            const aiReply = data.choices[0].message.content;

            setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);

        } catch (error) {
            console.error('AI Chat Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: error.message || 'عذراً، حدث خطأ في الاتصال بالخادم.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`w-80 h-[450px] shadow-2xl rounded-2xl flex flex-col overflow-hidden border ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'}`}
                       
                    >
                        {/* Header */}
                        <div className={`p-4 flex items-center justify-between border-b ${dm ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-l from-primary to-primary-dark'}`}>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
                                    <Bot size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-white">المساعد الذكي (AI)</h3>
                                    <span className="text-[10px] text-blue-100 font-medium flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                        متصل الآن
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1 rounded-full text-white/80 hover:bg-white/10 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Chat History */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                                        msg.role === 'user' 
                                            ? 'bg-primary text-white rounded-tr-sm shadow-md' 
                                            : `${dm ? 'bg-gray-800 text-gray-200 shadow-sm' : 'bg-slate-100 text-slate-800 shadow-sm border border-slate-200'} rounded-tl-sm`
                                    }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className={`p-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5 ${dm ? 'bg-gray-800' : 'bg-slate-100 border border-slate-200'}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className={`p-3 border-t ${dm ? 'border-gray-700 bg-gray-800' : 'border-slate-100 bg-white'}`}>
                            <form onSubmit={handleSubmit} className="flex items-center gap-2 relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="اكتب رسالتك هنا..."
                                    className={`w-full py-2.5 pr-4 pl-12 rounded-full text-sm border focus:outline-none focus:ring-2 focus:ring-primary/50 ${dm ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                    disabled={isTyping}
                                />
                                <button 
                                    type="submit" 
                                    disabled={isTyping || !input.trim()}
                                    className="absolute left-1.5 w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white disabled:opacity-50 transition-all hover:scale-105"
                                >
                                    {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="-ml-1" />}
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 bg-gradient-to-tr from-primary-dark to-primary hover:from-primary hover:to-blue-400 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 group relative border-2 border-white/20"
                >
                    <Bot size={28} className="animate-pulse" />
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                    </span>
                    <div className={`absolute left-16 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 ${dm ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-slate-800 border border-slate-100'}`}>
                        اسأل المساعد الذكي
                        <div className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 rotate-45 border-l border-b ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}></div>
                    </div>
                </button>
            )}
        </div>
    );
};

export default AIChatWidget;
