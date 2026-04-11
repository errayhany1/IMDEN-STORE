import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../store/useStore';

const AIChatWidget = () => {
    const { products, darkMode } = useStore();
    const dm = darkMode;

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'مرحباً! أنا المساعد الذكي لمتجر IMDEN TECHNOLOGY. كيف يمكنني مساعدتك اليوم؟' }
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

        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
        if (!apiKey) {
            setMessages(prev => [...prev, 
                { role: 'user', content: input }, 
                { role: 'assistant', content: 'المرجو التحقق من إعداد مفتاح API الخاص بـ OpenRouter (VITE_OPENROUTER_API_KEY).' }
            ]);
            setInput('');
            return;
        }

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        try {
            // Context Injection: Prepare product catalog string (concise to save context tokens)
            const catalogStr = products.slice(0, 50).map(p => `- منتج: ${p.name || 'بدون اسم'} | المرجع: ${p.ref} | السعر: ${p.price} DH`).join('\n');
            
            const systemPrompt = `أنت مساعد مبيعات ذكي ومحترف لمتجر "IMDEN TECHNOLOGY" المتخصص في بيع التقنيات والإلكترونيات بالجملة في المغرب.
مهمتك الرد على استفسارات الزوار باللغة العربية بأسلوب راقٍ وودي ومختصر.
يجب أن تركز دائماً على إقناع الزبون والترحيب به. أسعارنا كلها بالدرهم المغربي (DH).
هذه قائمة بأهم المنتجات المتوفرة حالياً في قاعدة البيانات مع أسعارها ومراجعها:
${catalogStr}

إذا سألك الزبون عن منتج غير موجود في القائمة، أخبره بلباقة أنه يمكننا التحقق من المخزن الداخلي وتوفير أي منتج يحتاجه عبر تقديم طلب من خلال نافذة الشكاوي والاقتراحات.
الرد يجب أن يكون مباشراً بدون أي أكواد أو تفاصيل تقنية معقدة.`;

            // Prepare messages for API (excluding the local initial welcome object ideally, but keeping it is fine as context history)
            const apiMessages = [
                { role: 'system', content: systemPrompt },
                ...messages.map(m => ({ role: m.role, content: m.content })),
                userMessage
            ];

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.href, // Recommended for OpenRouter
                    'X-Title': 'IMDEN Technology Bot',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.5-flash', // Fast and cheap default parameter
                    messages: apiMessages,
                    temperature: 0.7,
                })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch AI response');
            }

            const data = await response.json();
            const aiReply = data.choices[0].message.content;

            setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);

        } catch (error) {
            console.error('AI Chat Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'عذراً، حدث خطأ في الاتصال بالخادم. المرجو المحاولة لاحقاً.' }]);
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
                        dir="rtl"
                    >
                        {/* Header */}
                        <div className={`p-4 flex items-center justify-between border-b ${dm ? 'bg-gray-800 border-gray-700' : 'bg-primary/5 border-slate-100'}`}>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                                    <Bot size={20} />
                                </div>
                                <div>
                                    <h3 className={`font-bold text-sm ${dm ? 'text-white' : 'text-slate-900'}`}>المساعد الذكي</h3>
                                    <span className="text-[10px] text-green-500 font-medium">متصل الآن</span>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className={`p-1 rounded-full transition-colors ${dm ? 'text-gray-400 hover:bg-gray-700' : 'text-slate-400 hover:bg-slate-200'}`}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Chat History */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                                        msg.role === 'user' 
                                            ? 'bg-primary text-white rounded-tr-sm' 
                                            : `${dm ? 'bg-gray-800 text-gray-200' : 'bg-slate-100 text-slate-800'} rounded-tl-sm`
                                    }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className={`p-3 rounded-2xl rounded-tl-sm flex items-center gap-1 ${dm ? 'bg-gray-800' : 'bg-slate-100'}`}>
                                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></span>
                                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
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
                                    className={`w-full py-2.5 pr-4 pl-12 rounded-full text-sm border focus:outline-none focus:ring-1 focus:ring-primary ${dm ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                    disabled={isTyping}
                                />
                                <button 
                                    type="submit" 
                                    disabled={isTyping || !input.trim()}
                                    className="absolute left-1 w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white disabled:opacity-50 transition-opacity"
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
                    className="w-14 h-14 bg-slate-800 hover:bg-slate-900 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-110 group relative"
                >
                    <MessageCircle size={28} />
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full"></span>
                    <div className={`absolute left-16 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity ${dm ? 'bg-gray-800 text-white' : 'bg-white text-slate-800'}`}>
                        تحدث مع المساعد الذكي
                    </div>
                </button>
            )}
        </div>
    );
};

export default AIChatWidget;
