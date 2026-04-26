import React from 'react';
import SocialButton from './SocialButton';

const TELEGRAM_URL = 'https://t.me/Imden_technology';
const WA_NUMBER = '212664630566';

const FloatingWhatsApp = () => (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-4">
        {/* Telegram (SVG) */}
        <SocialButton
            type="telegram"
            href={TELEGRAM_URL}
            iconOnly
            className="w-14 h-14 shadow-lg hover:scale-110 active:scale-95 transition-transform"
        />
        {/* Realistic WhatsApp Icon */}
        <a 
            href={`https://wa.me/${WA_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-14 h-14 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-transform hover:shadow-xl flex items-center justify-center bg-white"
            aria-label="تواصل معنا عبر واتساب"
        >
            <img 
                src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
                alt="WhatsApp" 
                className="w-full h-full object-contain drop-shadow-md"
            />
        </a>
    </div>
);

export default FloatingWhatsApp;
