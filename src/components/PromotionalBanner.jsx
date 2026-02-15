import React from 'react';
import { MessageCircle } from 'lucide-react';

const PromotionalBanner = () => {
    return (
        <section className="mb-12 rounded-2xl overflow-hidden shadow-lg relative bg-primary">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-dark to-primary opacity-90"></div>
            <div className="relative z-10 px-8 py-10 md:py-12 flex flex-col md:flex-row items-center justify-between text-center md:text-left gap-6">
                <div className="max-w-2xl">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Need a Bulk Custom Order?</h2>
                    <p className="text-blue-100 text-lg">Chat directly with our wholesale agents to negotiate prices for large volumes.</p>
                </div>
                <button
                    onClick={() => window.open('https://wa.me/212681652324', '_blank')}
                    className="bg-whatsapp hover:brightness-110 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center gap-3 whitespace-nowrap"
                >
                    <MessageCircle size={24} fill="currentColor" />
                    Start Chat
                </button>
            </div>
        </section>
    );
};

export default PromotionalBanner;
